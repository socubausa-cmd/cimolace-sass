import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import type {
  PawaPayActiveConfig,
  PawaPayDepositCallback,
  PawaPayDepositInitResponse,
  PawaPayDepositRequest,
} from './pawapay.types';

@Injectable()
export class PawaPayService {
  private readonly logger = new Logger(PawaPayService.name);

  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly signingSecret: string;

  constructor(config: ConfigService) {
    this.apiToken = config.get<string>('PAWAPAY_API_TOKEN') ?? '';
    this.signingSecret = config.get<string>('PAWAPAY_SIGNING_SECRET') ?? '';
    // Sandbox par défaut si non configuré en production
    const env = config.get<string>('NODE_ENV');
    this.baseUrl =
      config.get<string>('PAWAPAY_BASE_URL') ??
      (env === 'production'
        ? 'https://api.pawapay.io'
        : 'https://api.sandbox.pawapay.io');
  }

  get isConfigured(): boolean {
    return Boolean(this.apiToken && this.apiToken !== 'replace_me');
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
   */
  async initiateDeposit(
    payload: PawaPayDepositRequest,
  ): Promise<PawaPayDepositInitResponse> {
    this.assertConfigured();

    const response = await fetch(`${this.baseUrl}/v2/deposits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

    return (await response.json()) as PawaPayDepositInitResponse;
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

    return (await response.json()) as PawaPayDepositCallback;
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
