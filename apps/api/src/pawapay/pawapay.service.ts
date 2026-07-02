import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, createSign } from 'crypto';
import type {
  PawaPayActiveConfig,
  PawaPayDepositCallback,
  PawaPayDepositInitResponse,
  PawaPayDepositRequest,
  PawaPayPayoutRequest,
  PawaPayPayoutInitResponse,
  PawaPayPayoutCallback,
  PawaPayRefundRequest,
  PawaPayRefundInitResponse,
  PawaPayRefundCallback,
} from './pawapay.types';

@Injectable()
export class PawaPayService {
  private readonly logger = new Logger(PawaPayService.name);

  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly signingSecret: string;
  private readonly privateKeyPem: string; // PEM ECDSA P-256 pour signer les requêtes (RFC 9421)
  private readonly keyId: string;          // nom de la clé publique déclarée dans le dashboard PawaPay

  constructor(config: ConfigService) {
    this.apiToken = config.get<string>('PAWAPAY_API_TOKEN') ?? '';
    this.signingSecret = config.get<string>('PAWAPAY_SIGNING_SECRET') ?? '';
    // Clé de signature des requêtes (RFC 9421). PAWAPAY_PRIVATE_KEY = PEM ECDSA P-256
    // encodé en base64 (env mono-ligne) ; PAWAPAY_KEY_ID = nom de la clé publique déclarée
    // dans le dashboard. Si absent → requêtes non signées (comportement précédent).
    const privB64 = config.get<string>('PAWAPAY_PRIVATE_KEY') ?? '';
    this.privateKeyPem = privB64 ? Buffer.from(privB64, 'base64').toString('utf8') : '';
    this.keyId = config.get<string>('PAWAPAY_KEY_ID') ?? '';
    // Sandbox par défaut si non configuré en production
    const env = config.get<string>('NODE_ENV');
    this.baseUrl =
      config.get<string>('PAWAPAY_BASE_URL') ??
      (env === 'production'
        ? 'https://api.pawapay.io'
        : 'https://api.sandbox.pawapay.io');
    this.logger.log(
      `PawaPay init: signing=${this.privateKeyPem && this.keyId ? `ON(keyId=${this.keyId})` : 'OFF'} baseUrl=${this.baseUrl}`,
    );
  }

  get isConfigured(): boolean {
    return Boolean(this.apiToken && this.apiToken !== 'replace_me');
  }

  /**
   * Signe une requête financière selon RFC 9421 (exigé par PawaPay si « Only accept
   * signed requests » est activé). Algo ECDSA P-256 SHA-256 ; en-têtes Content-Digest
   * (SHA-512) + Signature-Date + Signature-Input + Signature. Renvoie {} si la clé
   * privée n'est pas configurée → la requête part non signée (comportement précédent).
   */
  private signHeaders(
    method: string,
    url: string,
    body: string,
    contentType: string,
  ): Record<string, string> {
    if (!this.privateKeyPem || !this.keyId) return {};
    try {
      const u = new URL(url);
      const created = Math.floor(Date.now() / 1000);
      const expires = created + 60;
      const sigDate = new Date().toISOString();
      const contentDigest = `sha-512=:${createHash('sha512').update(body).digest('base64')}:`;
      const contentLength = Buffer.byteLength(body).toString();
      const components = [
        '@method',
        '@authority',
        '@path',
        'signature-date',
        'content-digest',
        'content-type',
        'content-length',
      ];
      const params = `(${components.map((c) => `"${c}"`).join(' ')});alg="ecdsa-p256-sha256";keyid="${this.keyId}";created=${created};expires=${expires}`;
      const base = [
        `"@method": ${method.toUpperCase()}`,
        `"@authority": ${u.host}`,
        `"@path": ${u.pathname}`,
        `"signature-date": ${sigDate}`,
        `"content-digest": ${contentDigest}`,
        `"content-type": ${contentType}`,
        `"content-length": ${contentLength}`,
        `"@signature-params": ${params}`,
      ].join('\n');
      // PawaPay vérifie la signature ECDSA en DER (encodage par DÉFAUT de crypto.sign,
      // cf. leur exemple officiel signed-deposit-example.js), PAS en IEEE-P1363.
      const signature = createSign('SHA256')
        .update(base)
        .sign(this.privateKeyPem, 'base64');
      return {
        'Content-Digest': contentDigest,
        'Content-Length': contentLength,
        'Signature-Date': sigDate,
        'Signature-Input': `sig-pp=${params}`,
        Signature: `sig-pp=:${signature}:`,
      };
    } catch (e) {
      this.logger.error(`pawaPay signHeaders échec: ${(e as Error).message}`);
      return {};
    }
  }

  /** Vérifie que le service est prêt, lève ServiceUnavailableException sinon */
  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'PAWAPAY_API_TOKEN non configuré — service Mobile Money désactivé',
      );
    }
  }

  /**
   * Initie un dépôt (collecte depuis le wallet Mobile Money du client).
   * Retourne { depositId, status: 'ACCEPTED' } si accepté par pawaPay.
   * La confirmation finale arrivera via callback/webhook.
   *
   * `override` optionnel : permet d'utiliser le token / la base d'API du TENANT
   * (config tenant_payment_providers) plutôt que ceux de l'env plateforme.
   *   - omis  → comportement inchangé (token + base de l'env, garde assertConfigured).
   *   - fourni avec apiToken → on bypasse assertConfigured (l'env peut être vide)
   *     et on utilise le token (et éventuellement la base) du tenant.
   */
  async initiateDeposit(
    payload: PawaPayDepositRequest,
    override?: { apiToken?: string; baseUrl?: string },
  ): Promise<PawaPayDepositInitResponse> {
    const apiToken = override?.apiToken || this.apiToken;
    const baseUrl = override?.baseUrl || this.baseUrl;

    // Si on s'appuie sur l'env (pas de token tenant), on garde la garde habituelle.
    if (!override?.apiToken) {
      this.assertConfigured();
    } else if (!apiToken) {
      throw new ServiceUnavailableException(
        'Token PawaPay tenant manquant — dépôt impossible.',
      );
    }

    const body = JSON.stringify(payload);
    const url = `${baseUrl}/v2/deposits`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        ...this.signHeaders('POST', url, body, 'application/json'),
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(
        `pawaPay initiateDeposit ${response.status}: ${text}`,
      );
      throw new BadRequestException(
        `Erreur pawaPay (${response.status}): ${text || 'inconnu'}`,
      );
    }

    const json = (await response.json()) as PawaPayDepositInitResponse;
    const status = String((json as any)?.status ?? '');
    const phone = (payload.payer as any)?.accountDetails?.phoneNumber;
    const provider = (payload.payer as any)?.accountDetails?.provider;
    // PawaPay renvoie 200 même pour un dépôt refusé (status REJECTED/FAILED/DUPLICATE)
    // → on remonte la vraie raison à l'appelant au lieu d'un faux « OK ».
    if (['REJECTED', 'FAILED', 'DUPLICATE_IGNORED'].includes(status)) {
      const reason = JSON.stringify(
        (json as any)?.failureReason ?? (json as any)?.rejectionReason ?? json,
      );
      this.logger.error(
        `pawaPay deposit ${status} depositId=${payload.depositId} phone=${phone} provider=${provider} reason=${reason}`,
      );
      throw new BadRequestException(
        `Dépôt refusé par PawaPay (${status}) : ${reason}`,
      );
    }
    this.logger.log(
      `pawaPay deposit OK depositId=${payload.depositId} status=${status} phone=${phone} provider=${provider}`,
    );
    return json;
  }

  /**
   * Vérifie le statut d'un dépôt par polling (si pas de callback configuré).
   */
  async getDepositStatus(
    depositId: string,
  ): Promise<PawaPayDepositCallback | null> {
    this.assertConfigured();

    const response = await fetch(
      `${this.baseUrl}/v2/deposits/${depositId}`,
      {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      },
    );

    if (!response.ok) {
      this.logger.warn(
        `pawaPay getDepositStatus ${response.status} pour ${depositId}`,
      );
      return null;
    }

    // PawaPay v2 renvoie une enveloppe { data: {...dépôt...}, status: "FOUND"|"NOT_FOUND" }.
    // Le vrai statut du dépôt est data.status (PROCESSING/COMPLETED/…), PAS l'enveloppe.
    const json = (await response.json()) as any;
    if (!json || json.status === 'NOT_FOUND') return null;
    const dep = json.data ?? json;
    return (dep ?? null) as PawaPayDepositCallback | null;
  }

  /**
   * Initie un REMBOURSEMENT d'un dépôt COMPLETED (renvoie l'argent au payeur).
   * Requête SIGNÉE (comme les dépôts). Remonte la vraie raison si REJECTED/FAILED.
   */
  async initiateRefund(
    payload: PawaPayRefundRequest,
  ): Promise<PawaPayRefundInitResponse> {
    this.assertConfigured();
    const body = JSON.stringify(payload);
    const url = `${this.baseUrl}/v2/refunds`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...this.signHeaders('POST', url, body, 'application/json'),
      },
      body,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`pawaPay initiateRefund ${response.status}: ${text}`);
      throw new BadRequestException(
        `Erreur pawaPay remboursement (${response.status}): ${text || 'inconnu'}`,
      );
    }
    const json = (await response.json()) as PawaPayRefundInitResponse;
    const status = String((json as any)?.status ?? '');
    // PawaPay renvoie 200 même pour un refund refusé → on remonte la vraie raison.
    if (['REJECTED', 'FAILED'].includes(status)) {
      const reason = JSON.stringify((json as any)?.failureReason ?? json);
      this.logger.error(
        `pawaPay refund ${status} refundId=${payload.refundId} depositId=${payload.depositId} reason=${reason}`,
      );
      throw new BadRequestException(
        `Remboursement refusé par PawaPay (${status}) : ${reason}`,
      );
    }
    this.logger.log(
      `pawaPay refund OK refundId=${payload.refundId} status=${status} depositId=${payload.depositId}`,
    );
    return json;
  }

  /** Statut d'un remboursement par polling (enveloppe v2 { data, status:"FOUND" }). */
  async getRefundStatus(
    refundId: string,
  ): Promise<PawaPayRefundCallback | null> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/v2/refunds/${refundId}`, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });
    if (!response.ok) {
      this.logger.warn(
        `pawaPay getRefundStatus ${response.status} pour ${refundId}`,
      );
      return null;
    }
    const json = (await response.json()) as any;
    if (!json || json.status === 'NOT_FOUND') return null;
    return (json.data ?? json) as PawaPayRefundCallback;
  }

  /**
   * Initie un PAYOUT (retrait / versement vers un mobile money). C'est l'inverse
   * d'un dépôt : on ENVOIE de l'argent au destinataire. Nécessite la permission
   * payouts (PAF) sur le token. Retourne { payoutId, status }.
   */
  async initiatePayout(
    payload: PawaPayPayoutRequest,
  ): Promise<PawaPayPayoutInitResponse> {
    this.assertConfigured();

    const response = await fetch(`${this.baseUrl}/v2/payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`pawaPay initiatePayout ${response.status}: ${text}`);
      throw new BadRequestException(
        `Erreur pawaPay payout (${response.status}): ${text || 'inconnu'}`,
      );
    }

    return (await response.json()) as PawaPayPayoutInitResponse;
  }

  /** Statut d'un payout par polling (si pas de callback). */
  async getPayoutStatus(
    payoutId: string,
  ): Promise<PawaPayPayoutCallback | null> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/v2/payouts/${payoutId}`, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });
    if (!response.ok) {
      this.logger.warn(`pawaPay getPayoutStatus ${response.status} pour ${payoutId}`);
      return null;
    }
    return (await response.json()) as PawaPayPayoutCallback;
  }

  /**
   * Récupère la configuration active (providers disponibles par pays).
   * Utilisé par le frontend pour afficher les opérateurs Mobile Money.
   */
  async getActiveConfig(
    country?: string,
  ): Promise<PawaPayActiveConfig | null> {
    this.assertConfigured();

    const url = country
      ? `${this.baseUrl}/v2/active-conf?country=${country}&operationType=DEPOSIT`
      : `${this.baseUrl}/v2/active-conf?operationType=DEPOSIT`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });

    if (!response.ok) {
      this.logger.warn(`pawaPay getActiveConfig ${response.status}`);
      return null;
    }

    return (await response.json()) as PawaPayActiveConfig;
  }

  /**
   * Vérifie la signature HMAC-SHA256 du callback pawaPay.
   * Retourne true si valid ou si pas de secret configuré (mode dev sans signature).
   * En production, toujours configurer PAWAPAY_SIGNING_SECRET.
   */
  verifyCallbackSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.signingSecret || this.signingSecret === 'replace_me') {
      this.logger.warn(
        'PAWAPAY_SIGNING_SECRET non configuré — signature non vérifiée',
      );
      return true; // Permissif en dev, strict en prod via config
    }

    const expected = createHmac('sha256', this.signingSecret)
      .update(rawBody)
      .digest('hex');

    return signature === expected;
  }
}
