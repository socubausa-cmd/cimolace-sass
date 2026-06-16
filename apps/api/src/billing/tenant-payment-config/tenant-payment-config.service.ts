import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import { decryptJson, encryptJson } from '../../common/crypto.util';
import {
  PAYMENT_PROVIDERS,
  type PaymentProvider,
  type UpsertPaymentMethodDto,
} from './dto';

type AnyObj = Record<string, any>;

/**
 * Vue masquée d'un provider configuré : aucun secret en clair ne sort d'ici.
 * Chaque champ de credentials est résumé en { set, last4 }.
 */
export type MaskedPaymentMethod = {
  provider: PaymentProvider;
  enabled: boolean;
  mode: string | null;
  credentials: Record<string, { set: boolean; last4: string }>;
  productMap: Record<string, string> | null;
  lastTest: {
    at: string | null;
    ok: boolean | null;
    message: string | null;
  };
  updatedAt: string | null;
};

/**
 * Liste blanche des champs secrets attendus par provider — sert à produire un
 * masque stable (le front sait toujours quels champs existent, même non
 * renseignés) et à filtrer ce qu'on chiffre.
 */
const SECRET_FIELDS: Record<PaymentProvider, string[]> = {
  stripe: ['secret_key', 'webhook_secret'],
  pawapay: ['api_token', 'signing_secret'],
  chariow: ['api_key', 'webhook_secret'],
  paypal: ['client_id', 'client_secret', 'webhook_id'],
  cinetpay: ['api_key', 'site_id', 'secret_key'],
};

@Injectable()
export class TenantPaymentConfigService {
  private readonly logger = new Logger(TenantPaymentConfigService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Client Supabase service_role (non typé : table hors types générés). */
  private get sb(): AnyObj {
    return this.supabase.client as any;
  }

  private assertProvider(provider: string): PaymentProvider {
    const p = String(provider || '').toLowerCase();
    if (!(PAYMENT_PROVIDERS as readonly string[]).includes(p)) {
      throw new BadRequestException(`Provider invalide : ${provider}`);
    }
    return p as PaymentProvider;
  }

  /** 4 derniers caractères d'un secret (masque). */
  private last4(value: string | undefined | null): string {
    const v = String(value ?? '');
    return v.length <= 4 ? v : v.slice(-4);
  }

  /**
   * Déchiffre la colonne credentials (jsonb { enc }) → objet clair.
   * Tolérant : si la clé manque ou que le déchiffrement échoue, renvoie {} et
   * loggue (on ne casse jamais une lecture de liste à cause d'un secret illisible).
   */
  private safeDecrypt(credentials: AnyObj | null): Record<string, string> {
    const enc = credentials?.enc;
    if (!enc || typeof enc !== 'string') return {};
    try {
      return decryptJson<Record<string, string>>(enc) ?? {};
    } catch (e) {
      this.logger.warn(
        `Déchiffrement credentials impossible (clé absente/invalide ?) : ${(e as Error).message}`,
      );
      return {};
    }
  }

  /** Construit le masque { set, last4 } par champ secret pour un provider. */
  private maskCredentials(
    provider: PaymentProvider,
    plain: Record<string, string>,
  ): Record<string, { set: boolean; last4: string }> {
    const fields = new Set<string>([
      ...SECRET_FIELDS[provider],
      ...Object.keys(plain || {}),
    ]);
    const masked: Record<string, { set: boolean; last4: string }> = {};
    for (const field of fields) {
      const val = plain?.[field];
      const set = typeof val === 'string' && val.length > 0;
      masked[field] = { set, last4: set ? this.last4(val) : '' };
    }
    return masked;
  }

  /** Mappe une ligne DB → vue masquée renvoyée au front. */
  private toMasked(row: AnyObj): MaskedPaymentMethod {
    const provider = row.provider as PaymentProvider;
    const plain = this.safeDecrypt(row.credentials ?? null);
    return {
      provider,
      enabled: !!row.enabled,
      mode: row.mode ?? null,
      credentials: this.maskCredentials(provider, plain),
      productMap: (row.product_map as Record<string, string> | null) ?? null,
      lastTest: {
        at: row.last_test_at ?? null,
        ok: row.last_test_ok ?? null,
        message: row.last_test_message ?? null,
      },
      updatedAt: row.updated_at ?? null,
    };
  }

  // ─── GET : liste des providers configurés (masqués) ───────────────────────

  async list(t: TenantContext): Promise<{ providers: MaskedPaymentMethod[] }> {
    const { data, error } = await this.sb
      .from('tenant_payment_providers')
      .select(
        'provider, enabled, mode, credentials, product_map, last_test_at, last_test_ok, last_test_message, updated_at',
      )
      .eq('tenant_id', t.id)
      .order('provider', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    return { providers: (data ?? []).map((r: AnyObj) => this.toMasked(r)) };
  }

  // ─── POST : upsert d'un provider (chiffre les credentials) ─────────────────

  async upsert(
    t: TenantContext,
    body: UpsertPaymentMethodDto,
  ): Promise<MaskedPaymentMethod> {
    const provider = this.assertProvider(body.provider);

    // On ne retient que les champs string non vides (le reste = bruit).
    const cleanCreds: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.credentials ?? {})) {
      if (typeof v === 'string' && v.trim().length > 0) {
        cleanCreds[k] = v.trim();
      }
    }
    if (Object.keys(cleanCreds).length === 0) {
      throw new BadRequestException(
        'Aucun secret fourni (credentials vide).',
      );
    }

    // Chiffrement AES-256-GCM ; lève une 400 claire si la clé plateforme manque.
    let encrypted: string;
    try {
      encrypted = encryptJson(cleanCreds);
    } catch (e) {
      throw new BadRequestException(
        `Chiffrement impossible : ${(e as Error).message}`,
      );
    }

    const row: AnyObj = {
      tenant_id: t.id,
      provider,
      enabled: true,
      mode: body.mode ?? null,
      credentials: { enc: encrypted },
      updated_at: new Date().toISOString(),
    };
    if (provider === 'chariow' && body.productMap) {
      row.product_map = body.productMap;
    }

    const { data, error } = await this.sb
      .from('tenant_payment_providers')
      .upsert(row, { onConflict: 'tenant_id,provider' })
      .select(
        'provider, enabled, mode, credentials, product_map, last_test_at, last_test_ok, last_test_message, updated_at',
      )
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new BadRequestException('Upsert sans résultat.');

    return this.toMasked(data);
  }

  // ─── PATCH : activer/désactiver ────────────────────────────────────────────

  async setEnabled(
    t: TenantContext,
    providerRaw: string,
    enabled: boolean,
  ): Promise<MaskedPaymentMethod> {
    const provider = this.assertProvider(providerRaw);

    const { data, error } = await this.sb
      .from('tenant_payment_providers')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('tenant_id', t.id)
      .eq('provider', provider)
      .select(
        'provider, enabled, mode, credentials, product_map, last_test_at, last_test_ok, last_test_message, updated_at',
      )
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Provider non configuré pour ce tenant.');

    return this.toMasked(data);
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────

  async remove(
    t: TenantContext,
    providerRaw: string,
  ): Promise<{ ok: true; provider: PaymentProvider }> {
    const provider = this.assertProvider(providerRaw);

    const { error } = await this.sb
      .from('tenant_payment_providers')
      .delete()
      .eq('tenant_id', t.id)
      .eq('provider', provider);

    if (error) throw new BadRequestException(error.message);

    return { ok: true, provider };
  }

  // ─── Résolution moteur : credentials TENANT déchiffrés (fallback env) ───────

  /**
   * Renvoie les credentials EN CLAIR du provider pour un tenant donné, UNIQUEMENT
   * si une ligne existe ET `enabled = true`. Sinon `null`.
   *
   * Conçu pour le moteur de checkout (offering-checkout) : il appelle ce helper
   * AVANT de retomber sur l'env plateforme. Contrat de sûreté STRICT :
   *   - ne lève JAMAIS (toute erreur DB / clé de chiffrement absente / déchiffrement
   *     impossible → `null`), afin que l'absence ou la mauvaise config tenant
   *     n'impacte jamais le flux existant basé sur l'env.
   *   - n'expose les secrets que via cette méthode serveur-à-serveur (jamais HTTP).
   *
   * @returns objet credentials clair (ex. { secret_key, webhook_secret }) ou null.
   */
  async resolveTenantProviderCreds(
    tenantId: string,
    providerRaw: string,
  ): Promise<{ creds: Record<string, string>; mode: string | null } | null> {
    if (!tenantId) return null;

    let provider: PaymentProvider;
    try {
      provider = this.assertProvider(providerRaw);
    } catch {
      return null;
    }

    try {
      const { data: row, error } = await this.sb
        .from('tenant_payment_providers')
        .select('credentials, enabled, mode')
        .eq('tenant_id', tenantId)
        .eq('provider', provider)
        .maybeSingle();

      // Erreur DB (ex. table absente sur un env pas encore migré) → fallback env.
      if (error || !row) return null;
      if (!row.enabled) return null;

      const creds = this.safeDecrypt(row.credentials ?? null);
      if (!creds || Object.keys(creds).length === 0) return null;

      return { creds, mode: row.mode ?? null };
    } catch (e) {
      // Filet de sécurité ultime : jamais d'exception ne remonte au checkout.
      this.logger.warn(
        `resolveTenantProviderCreds(${provider}) a échoué, fallback env : ${(e as Error).message}`,
      );
      return null;
    }
  }

  // ─── POST .../:provider/test : test de connexion RÉEL ───────────────────────

  async test(
    t: TenantContext,
    providerRaw: string,
  ): Promise<{ ok: boolean; message: string }> {
    const provider = this.assertProvider(providerRaw);

    const { data: row, error } = await this.sb
      .from('tenant_payment_providers')
      .select('provider, mode, credentials')
      .eq('tenant_id', t.id)
      .eq('provider', provider)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!row) throw new NotFoundException('Provider non configuré pour ce tenant.');

    const creds = this.safeDecrypt(row.credentials ?? null);

    let result: { ok: boolean; message: string };
    try {
      result = await this.runProviderTest(provider, creds, row.mode ?? null);
    } catch (e) {
      result = { ok: false, message: (e as Error).message || 'Échec du test.' };
    }

    // Trace du dernier test (best-effort : on n'échoue pas le endpoint dessus).
    const { error: upErr } = await this.sb
      .from('tenant_payment_providers')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_ok: result.ok,
        last_test_message: result.message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', t.id)
      .eq('provider', provider);
    if (upErr) {
      this.logger.warn(`Maj last_test_* échouée : ${upErr.message}`);
    }

    return result;
  }

  /**
   * Test de connexion réel par agrégateur (fetch REST, aucun SDK).
   *  - stripe  : GET https://api.stripe.com/v1/account            (Bearer secret_key)
   *  - pawapay : GET {base}/v2/active-conf                        (Bearer api_token)
   *  - chariow : GET https://api.chariow.com/v1/me (léger, authn) (Bearer api_key)
   */
  private async runProviderTest(
    provider: PaymentProvider,
    creds: Record<string, string>,
    mode: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    const TIMEOUT_MS = 10_000;

    const doFetch = async (url: string, headers: Record<string, string>) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        return await fetch(url, { headers, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    if (provider === 'stripe') {
      const key = creds.secret_key;
      if (!key) return { ok: false, message: 'secret_key Stripe manquante.' };
      const res = await doFetch('https://api.stripe.com/v1/account', {
        Authorization: `Bearer ${key}`,
      });
      if (res.ok) {
        const acc = (await res.json().catch(() => ({}))) as AnyObj;
        const label = acc?.id ? ` (compte ${acc.id})` : '';
        return { ok: true, message: `Connexion Stripe OK${label}.` };
      }
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        message: `Stripe a refusé la clé (HTTP ${res.status}). ${body.slice(0, 200)}`,
      };
    }

    if (provider === 'pawapay') {
      const token = creds.api_token;
      if (!token) return { ok: false, message: 'api_token PawaPay manquant.' };
      // Sandbox vs production : base d'API distincte.
      const isSandbox = (mode ?? '').toLowerCase() === 'sandbox' ||
        (mode ?? '').toLowerCase() === 'test';
      const base = isSandbox
        ? 'https://api.sandbox.pawapay.io'
        : 'https://api.pawapay.io';
      const res = await doFetch(`${base}/v2/active-conf`, {
        Authorization: `Bearer ${token}`,
      });
      if (res.ok) {
        return { ok: true, message: `Connexion PawaPay OK (${isSandbox ? 'sandbox' : 'production'}).` };
      }
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        message: `PawaPay a refusé le token (HTTP ${res.status}). ${body.slice(0, 200)}`,
      };
    }

    if (provider === 'chariow') {
      const key = creds.api_key;
      if (!key) return { ok: false, message: 'api_key Chariow manquante.' };
      const res = await doFetch('https://api.chariow.com/v1/me', {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      });
      if (res.ok) {
        return { ok: true, message: 'Connexion Chariow OK.' };
      }
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        message: `Chariow a refusé la clé (HTTP ${res.status}). ${body.slice(0, 200)}`,
      };
    }

    return {
      ok: false,
      message: `Test non implémenté pour le provider ${provider}.`,
    };
  }
}
