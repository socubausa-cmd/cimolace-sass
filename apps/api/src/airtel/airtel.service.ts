import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { publicEncrypt, constants as cryptoConstants } from 'crypto';
import type {
  AirtelDisbursementRequest,
  AirtelDisbursementResponse,
  AirtelDisbursementStatus,
  AirtelToken,
} from './airtel.types';

/**
 * Airtel Money (Airtel Africa Open API) — décaissement mobile money.
 *
 * Rail DIRECT (sans agrégateur), en parallèle de PawaPay. Débite le wallet Airtel
 * Money du marchand (à approvisionner) — NE récupère PAS l'argent PawaPay.
 *
 * Spec corroborée par 3+ SDKs (portail officiel JS/login-gated) → tout est piloté
 * par env (AIRTEL_*). Sandbox = https://openapiuat.airtel.africa, argent fictif.
 *
 * Flux : getToken() (OAuth2 client_credentials, mis en cache) → encryptPin() (RSA)
 *        → disburse() (POST /standard/v1/disbursements/) → getDisbursementStatus().
 */
@Injectable()
export class AirtelMoneyService {
  private readonly logger = new Logger(AirtelMoneyService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly publicKeyPem: string; // clé RSA Airtel pour chiffrer le PIN
  private readonly disbursementPin: string; // PIN de sécurité Airtel Money (marchand)
  private readonly country: string; // X-Country, ex. "GA" (Gabon)
  private readonly currency: string; // X-Currency, ex. "XAF"
  private readonly isConfigured: boolean;

  /** Devises sans décimale : le montant est envoyé en valeur entière directe. */
  private static readonly ZERO_DECIMAL = new Set(['XAF', 'XOF', 'RWF', 'UGX']);

  private cachedToken: AirtelToken | null = null;
  private tokenInFlight: Promise<string> | null = null;

  constructor(config: ConfigService) {
    const env = (config.get<string>('AIRTEL_ENV') ?? 'sandbox').toLowerCase();
    this.baseUrl = (
      config.get<string>('AIRTEL_BASE_URL') ??
      (env === 'production'
        ? 'https://openapi.airtel.africa'
        : 'https://openapiuat.airtel.africa')
    ).replace(/\/+$/, '');
    this.clientId = config.get<string>('AIRTEL_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('AIRTEL_CLIENT_SECRET') ?? '';
    this.country = (config.get<string>('AIRTEL_COUNTRY') ?? 'GA').toUpperCase();
    this.currency = (config.get<string>('AIRTEL_CURRENCY') ?? 'XAF').toUpperCase();
    this.disbursementPin = config.get<string>('AIRTEL_DISBURSEMENT_PIN') ?? '';

    // Clé publique : accepte un PEM direct OU un base64 DER (on l'enveloppe alors en PEM SPKI).
    const rawKey = (config.get<string>('AIRTEL_PUBLIC_KEY') ?? '').trim();
    this.publicKeyPem = rawKey
      ? rawKey.includes('BEGIN')
        ? rawKey
        : `-----BEGIN PUBLIC KEY-----\n${rawKey.replace(/(.{64})/g, '$1\n')}\n-----END PUBLIC KEY-----`
      : '';

    this.isConfigured = Boolean(this.clientId && this.clientSecret);
    this.logger.log(
      `Airtel init: configured=${this.isConfigured} env=${env} baseUrl=${this.baseUrl} country=${this.country} pinEncrypt=${this.publicKeyPem ? 'ON' : 'OFF'}`,
    );
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'AIRTEL_CLIENT_ID / AIRTEL_CLIENT_SECRET non configurés — Airtel Money désactivé',
      );
    }
  }

  /**
   * Jeton OAuth2 (client_credentials), mis en cache jusqu'à expiration − 60 s.
   * ⚠ à confirmer sur le portail : identifiants dans le CORPS JSON (assumé) et non
   * en Authorization: Basic (écart vs RFC-6749). Piloté ici par le contrat corroboré.
   */
  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.accessToken;
    }
    if (this.tokenInFlight) return this.tokenInFlight; // anti-stampede

    this.tokenInFlight = (async () => {
      const resp = await fetch(`${this.baseUrl}/auth/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: '*/*' },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        this.logger.error(`Airtel token ${resp.status}: ${text}`);
        throw new BadRequestException(
          `Erreur auth Airtel (${resp.status}): ${text || 'inconnu'}`,
        );
      }
      const json: any = await resp.json();
      const token = json?.access_token;
      if (!token) {
        throw new BadRequestException("Airtel: pas d'access_token dans la réponse");
      }
      const ttlSec = Number(json?.expires_in) || 3600;
      this.cachedToken = { accessToken: token, expiresAt: now + ttlSec * 1000 };
      return token;
    })();

    try {
      return await this.tokenInFlight;
    } finally {
      this.tokenInFlight = null;
    }
  }

  /**
   * Chiffre le PIN de sécurité Airtel Money avec la clé publique RSA (base64).
   * ⚠ à confirmer : RSA/ECB/PKCS1Padding (PKCS#1 v1.5) 1024-bit assumé par les SDKs.
   * Si aucune clé publique n'est fournie, on renvoie le PIN en clair (certains flux
   * sandbox l'acceptent) — à valider selon ce que le portail Cash-Out exige.
   */
  private encryptPin(): string {
    if (!this.disbursementPin) return '';
    if (!this.publicKeyPem) return this.disbursementPin; // fallback: PIN en clair (⚠ à confirmer)
    const enc = publicEncrypt(
      { key: this.publicKeyPem, padding: cryptoConstants.RSA_PKCS1_PADDING },
      Buffer.from(this.disbursementPin, 'utf8'),
    );
    return enc.toString('base64');
  }

  private authHeaders(token: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: '*/*',
      'X-Country': this.country,
      'X-Currency': this.currency,
      Authorization: `Bearer ${token}`,
    };
  }

  /** MSISDN national, chiffres seuls, sans indicatif pays (241 retiré si présent). */
  private normalizeMsisdn(raw: string): string {
    let m = String(raw ?? '').replace(/[^0-9]/g, '');
    if (this.country === 'GA' && m.startsWith('241')) m = m.slice(3);
    if (m.startsWith('0')) m = m.slice(1);
    return m;
  }

  /**
   * Initie un décaissement (payout) vers un wallet Airtel Money.
   * POST /standard/v1/disbursements/  (⚠ à confirmer v1 vs v2 sur le portail).
   */
  async disburse(
    req: AirtelDisbursementRequest,
  ): Promise<AirtelDisbursementResponse> {
    this.assertConfigured();
    const token = await this.getToken();

    // XAF (zéro-décimale) → montant entier direct.
    const amount = AirtelMoneyService.ZERO_DECIMAL.has(this.currency)
      ? Math.round(req.amount)
      : Number(req.amount);

    const body = JSON.stringify({
      payee: { msisdn: this.normalizeMsisdn(req.msisdn) },
      reference: req.reference ?? 'Cimolace payout',
      pin: this.encryptPin(),
      transaction: { amount, id: req.transactionId },
    });

    const resp = await fetch(`${this.baseUrl}/standard/v1/disbursements/`, {
      method: 'POST',
      headers: this.authHeaders(token),
      body,
    });

    const text = await resp.text().catch(() => '');
    let json: AirtelDisbursementResponse = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      /* réponse non-JSON */
    }

    if (!resp.ok) {
      this.logger.error(`Airtel disburse ${resp.status}: ${text}`);
      throw new BadRequestException(
        `Erreur Airtel décaissement (${resp.status}): ${text || 'inconnu'}`,
      );
    }

    // Airtel peut renvoyer 200 avec un statut d'échec → on remonte la vraie raison.
    const txStatus = String(json?.data?.transaction?.status ?? '').toUpperCase();
    const success = json?.status?.success;
    if (txStatus === 'TF' || success === false) {
      const msg = json?.status?.message || json?.status?.result_code || text;
      this.logger.error(
        `Airtel disburse REJECTED txId=${req.transactionId} status=${txStatus} msg=${msg}`,
      );
      throw new BadRequestException(`Décaissement Airtel refusé : ${msg}`);
    }

    this.logger.log(
      `Airtel disburse OK txId=${req.transactionId} status=${txStatus || 'accepted'}`,
    );
    return json;
  }

  /** Statut d'un décaissement par polling. GET /standard/v1/disbursements/{id}. */
  async getDisbursementStatus(
    transactionId: string,
  ): Promise<AirtelDisbursementStatus | null> {
    this.assertConfigured();
    const token = await this.getToken();
    const resp = await fetch(
      `${this.baseUrl}/standard/v1/disbursements/${encodeURIComponent(transactionId)}`,
      { headers: this.authHeaders(token) },
    );
    if (!resp.ok) {
      this.logger.warn(`Airtel getDisbursementStatus ${resp.status} pour ${transactionId}`);
      return null;
    }
    const json: any = await resp.json().catch(() => null);
    const tx = json?.data?.transaction ?? {};
    return {
      transactionId,
      status: String(tx?.status ?? '').toUpperCase(),
      airtelMoneyId: tx?.airtel_money_id,
      message: json?.status?.message,
      raw: json,
    };
  }
}
