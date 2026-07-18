import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';

type ApiKeyRequest = Request & {
  tenant?: TenantContext;
  apiKeyId?: string;
  authViaApiKey?: boolean;
};

/**
 * Préfixes acceptés pour les clés API tenant. Le format complet est :
 *   {prefix}_{slug}_{random32}
 *
 * - `cml_` : clé Cimolace générique (tous engines)
 * - `mdk_` : clé spécifique MEDOS (medical key)
 * - `mbk_` : clé spécifique Mbolo (storefront e-commerce)
 */
const VALID_PREFIXES = ['cml_', 'mdk_', 'mbk_'];

/**
 * Moteur porté par le PRÉFIXE d'une clé : `mdk_`=medos, `mbk_`=mbolo,
 * `cml_`=générique (wildcard, tous moteurs). null = wildcard.
 */
function keyEngineFromPrefix(raw: string): 'medos' | 'mbolo' | null {
  if (raw.startsWith('mdk_')) return 'medos';
  if (raw.startsWith('mbk_')) return 'mbolo';
  return null; // cml_ = générique
}

/**
 * Moteur ciblé par le CHEMIN de la requête (les endpoints gardés par ce guard
 * sont path-séparés : /v1/medos/*, /v1/mbolo/*). null = endpoint générique.
 */
function endpointEngineFromPath(path: string): 'medos' | 'mbolo' | null {
  const p = String(path || '');
  if (p.includes('/medos/') || p.includes('/medos')) return 'medos';
  if (p.includes('/mbolo/') || p.includes('/mbolo')) return 'mbolo';
  return null;
}

/**
 * Least-privilege : une clé spécifique à un moteur ne devrait PAS ouvrir un
 * autre moteur (ex : une `mbk_` fuitée chez un vendeur storefront ne doit pas
 * atteindre les endpoints MEDOS/PHI). Renvoie le détail de la violation, ou
 * null si l'accès est légitime (clé générique cml_, ou moteurs concordants,
 * ou endpoint générique). Fonction PURE (testable).
 */
export function apiKeyScopeViolation(
  raw: string,
  path: string,
): { keyEngine: string; endpointEngine: string } | null {
  const keyEngine = keyEngineFromPrefix(raw);
  const endpointEngine = endpointEngineFromPath(path);
  if (keyEngine && endpointEngine && keyEngine !== endpointEngine) {
    return { keyEngine, endpointEngine };
  }
  return null;
}

/**
 * Guard d'authentification par clé API tenant.
 *
 * Utilisé pour les appels server-to-server depuis un site client externe
 * (ex : backend ZahirWellness → API MEDOS). Pas de session, pas de cookie,
 * pas de JWT Supabase — uniquement Authorization: Bearer <clé brute>.
 *
 * Sécurité :
 *  - La clé brute n'est jamais stockée, seul son hash SHA-256
 *  - last_used_at est mis à jour à chaque appel (audit)
 *  - revoked_at coupe immédiatement la clé
 *  - tenant_id résolu depuis la clé → isolation multi-tenant garantie
 *
 * Le guard peuple :
 *  - req.tenant       → TenantContext (avec userRole = 'clinic_admin')
 *  - req.apiKeyId     → UUID de la clé utilisée (pour audit)
 *  - req.authViaApiKey → true (utile pour différencier des JWT)
 *
 * NOTE : les clés API agissent avec un role 'clinic_admin' par défaut,
 * suffisant pour CRUD patients/notes/forms mais pas pour les routes
 * réservées au rôle 'patient' (espace patient). Pour le mode patient-portal
 * embeddé, utiliser EmbedTokenGuard plutôt qu'ApiKeyGuard.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ApiKeyRequest>();
    const auth = req.headers['authorization'];

    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token requis');
    }

    const raw = auth.slice(7).trim();
    if (!VALID_PREFIXES.some((p) => raw.startsWith(p))) {
      throw new UnauthorizedException(
        'Format de clé API invalide (préfixe attendu: cml_, mdk_ ou mbk_)',
      );
    }

    const hash = createHash('sha256').update(raw).digest('hex');

    const { data: key, error } = await (this.supabase.client as any)
      .from('tenant_api_keys')
      .select('id, tenant_id, revoked_at, label')
      .eq('key_hash', hash)
      .maybeSingle();

    if (error) {
      this.logger.error(`api_key lookup error: ${error.message}`);
      throw new UnauthorizedException('Clé API invalide');
    }

    if (!key) {
      throw new UnauthorizedException('Clé API inconnue');
    }

    if (key.revoked_at) {
      throw new UnauthorizedException('Clé API révoquée');
    }

    // Résoudre le tenant
    const { data: tenant, error: tErr } = await (this.supabase.client as any)
      .from('tenants')
      .select('*')
      .eq('id', key.tenant_id)
      .single();

    if (tErr || !tenant) {
      this.logger.error(
        `api_key tenant lookup failed for key ${key.id}: ${tErr?.message}`,
      );
      throw new UnauthorizedException('Tenant lié à la clé introuvable');
    }

    // ─── Gating abonnement plateforme ─────────────────────────────────────────
    // Opt-in PAR TENANT : seuls les tenants marqués
    // `metadata.billing.api_gating = true` sont soumis à la vérification d'un
    // abonnement Cimolace actif. Tous les autres (intégrations historiques,
    // MEDOS non facturé…) passent comme avant → aucune régression au déploiement.
    // Quand l'abonnement lapse, la clé `mbk_/mdk_/cml_` cesse de servir l'API.
    if ((tenant as any)?.metadata?.billing?.api_gating === true) {
      const { data: subs, error: subErr } = await (this.supabase.client as any)
        .from('billing_subscriptions')
        .select('status, current_period_end')
        .eq('tenant_id', key.tenant_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (subErr) {
        // Erreur DB transitoire : on NE coupe PAS le service du tenant (fail-open),
        // on loggue pour alerte. Seul un abonnement réellement inactif → 402.
        this.logger.error(
          `billing_subscriptions lookup error (tenant ${key.tenant_id}): ${subErr.message}`,
        );
      } else if (!(subs ?? []).some((s: any) => this.isSubscriptionUsable(s))) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            error: 'Payment Required',
            code: 'subscription_inactive',
            message: 'Abonnement Cimolace inactif ou expiré pour ce tenant.',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    // ─── Least-privilege : scope moteur par préfixe de clé ────────────────────
    // Une clé `mbk_`/`mdk_` ne doit pas ouvrir un autre moteur (cml_ = wildcard) —
    // sinon une clé mbolo fuitée atteint les endpoints MEDOS/PHI. ENFORCE PAR DÉFAUT
    // (fail-closed) ; échappatoire instantanée sans redeploy : API_KEY_SCOPE_ENFORCE=0
    // (repasse en OBSERVE si une intégration légitime venait à casser).
    const reqPath = req.originalUrl || req.path || (req as any).url || '';
    const violation = apiKeyScopeViolation(raw, reqPath);
    if (violation) {
      if (process.env.API_KEY_SCOPE_ENFORCE !== '0') {
        this.logger.warn(
          `[api-key scope] BLOQUÉ clé ${violation.keyEngine} sur endpoint ${violation.endpointEngine} ` +
            `(tenant=${key.tenant_id}, key=${key.id})`,
        );
        throw new ForbiddenException(
          `Clé « ${violation.keyEngine} » non autorisée sur un endpoint « ${violation.endpointEngine} ». Utilisez une clé cml_ (générique) ou ${violation.endpointEngine}.`,
        );
      }
      this.logger.warn(
        `[api-key scope] clé ${violation.keyEngine} sur endpoint ${violation.endpointEngine} ` +
          `(tenant=${key.tenant_id}, key=${key.id}) — OBSERVÉ (API_KEY_SCOPE_ENFORCE=0)`,
      );
    }

    req.tenant = {
      ...(tenant as any),
      userRole: 'clinic_admin', // role par défaut pour les clés API server-to-server
    };
    req.apiKeyId = key.id;
    req.authViaApiKey = true;

    // Mise à jour last_used_at — fire and forget, ne doit pas bloquer
    void (this.supabase.client as any)
      .from('tenant_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', key.id)
      .then(
        () => null,
        (err: any) =>
          this.logger.warn(`last_used_at update failed: ${err?.message}`),
      );

    return true;
  }

  /**
   * Un abonnement est exploitable si :
   *  - status `active` ET la période courante n'est pas dépassée (ou illimitée) ;
   *  - status `past_due` toléré pendant une fenêtre de grâce de 7 jours après
   *    `current_period_end` (le temps que la relance de paiement aboutisse).
   * Tout le reste (`pending`, `canceled`, `expired`, `paused`) → non exploitable.
   */
  private isSubscriptionUsable(s: {
    status?: string | null;
    current_period_end?: string | null;
  }): boolean {
    if (!s?.status) return false;
    const periodEnd = s.current_period_end
      ? new Date(s.current_period_end).getTime()
      : null;
    const now = Date.now();

    if (s.status === 'active') {
      return periodEnd === null || periodEnd >= now;
    }
    if (s.status === 'past_due') {
      const graceMs = 7 * 24 * 60 * 60 * 1000;
      return periodEnd === null || periodEnd + graceMs >= now;
    }
    return false;
  }
}
