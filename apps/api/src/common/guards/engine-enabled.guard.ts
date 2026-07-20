import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  REQUIRE_ENGINE_KEY,
  type EngineFamily,
} from '../decorators/require-engine.decorator';

type EngineTenantRequest = Request & { tenant?: TenantContext };

/**
 * Carte famille de moteur → préfixes/clés de `tenant_services.service_key`.
 * Un moteur est « activé » si le tenant a AU MOINS une de ces clés `active=true`.
 */
const ENGINE_SERVICE_MATCH: Record<
  EngineFamily,
  { prefixes: string[]; keys: string[] }
> = {
  liri: { prefixes: ['liri_'], keys: ['live', 'studio', 'smartboard'] },
  medos: {
    prefixes: ['med_', 'medos_'],
    keys: ['gdpr_engine'],
  },
  mbolo: { prefixes: ['mbolo_'], keys: ['commerce', 'boutique'] },
  booking: { prefixes: ['booking'], keys: ['booking_engine', 'rdv'] },
  school: {
    prefixes: ['school'],
    keys: ['formations', 'ecole', 'formation'],
  },
  marketing: { prefixes: ['marketing'], keys: ['promos'] },
};

/**
 * Guard générique d'ACTIVATION de moteur. Fait pour `@RequireEngine('mbolo')` &c.
 *
 * Contrat de sûreté (aucune régression sur les tenants existants) :
 *  1. **Opt-in** : n'enforce QUE si `tenants.metadata.gating.runtime === true`.
 *     Sinon → laisse passer (le toggle marketplace reste indicatif).
 *  2. **Bypass** si `infrastructure_type` correspond au moteur (tenant dédié).
 *  3. **Fail-open** sur toute erreur DB (jamais bloquer un client pour une panne
 *     de lecture) — même philosophie que `MedosEnabledGuard`/`api-key.guard`.
 *  4. Refuse (403) uniquement si, opt-in ACTIVÉ, aucune clé de service du moteur
 *     n'est active pour le tenant.
 *
 * Barrière SERVEUR (la garde front est cosmétique). À appliquer sur les
 * contrôleurs d'un moteur EN PLUS de JwtAuthGuard + TenantGuard.
 */
@Injectable()
export class EngineEnabledGuard implements CanActivate {
  private readonly logger = new Logger(EngineEnabledGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const engine = this.reflector.getAllAndOverride<EngineFamily | undefined>(
      REQUIRE_ENGINE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!engine) return true; // pas de contrainte de moteur sur cette route

    const req = ctx.switchToHttp().getRequest<EngineTenantRequest>();
    const tenant = req.tenant;
    if (!tenant?.id) {
      throw new ForbiddenException('Tenant requis pour accéder à ce moteur');
    }

    // Bypass tenant dédié (ex. infrastructure_type='medos' pour medos).
    if (
      tenant.infrastructure_type &&
      String(tenant.infrastructure_type).toLowerCase() === engine
    ) {
      return true;
    }

    try {
      // 1) Opt-in par tenant : sans le flag, on n'enforce pas (0 régression).
      const { data: t, error: tErr } = await this.supabase.client
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();
      if (tErr) {
        this.logger.warn(
          `gating ${engine}: lecture tenant KO (${tErr.message}) → fail-open`,
        );
        return true;
      }
      const meta = (t as any)?.metadata ?? {};

      // 1bis) Gating ABONNEMENT (opt-in INDÉPENDANT : `metadata.billing.api_gating`).
      // Coupe l'accès in-app au moteur quand l'abonnement Cimolace lapse — MÊME contrat
      // que la garde clé API (`api-key.guard`), MÊME fenêtre de grâce (7 j). Aucun tenant
      // sans le flag n'est affecté ; erreur DB → fail-open (jamais couper sur une panne).
      if (meta?.billing?.api_gating === true) {
        const { data: subs, error: subErr } = await this.supabase.client
          .from('billing_subscriptions')
          .select('status, current_period_end')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(5);
        if (subErr) {
          this.logger.warn(
            `gating ${engine}: lecture billing KO (${subErr.message}) → fail-open`,
          );
        } else if (
          !(subs ?? []).some((s) => this.isSubscriptionUsable(s as any))
        ) {
          throw new HttpException(
            {
              statusCode: HttpStatus.PAYMENT_REQUIRED,
              error: 'Payment Required',
              code: 'subscription_inactive',
              message: `Abonnement Cimolace inactif ou expiré — accès au moteur « ${engine} » suspendu.`,
            },
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
      }

      // 1ter) Gating ACTIVATION moteur (opt-in : `metadata.gating.runtime`).
      const runtimeGating = meta?.gating?.runtime === true;
      if (!runtimeGating) return true;

      // 2) Le moteur est-il activé ?
      const { data: services, error: sErr } = await this.supabase.client
        .from('tenant_services')
        .select('service_key, active')
        .eq('tenant_id', tenant.id)
        .eq('active', true);
      if (sErr) {
        this.logger.warn(
          `gating ${engine}: lecture tenant_services KO (${sErr.message}) → fail-open`,
        );
        return true;
      }

      const match = ENGINE_SERVICE_MATCH[engine];
      const enabled = (services ?? []).some((s) => {
        const key = String((s as any).service_key ?? '');
        return (
          match.prefixes.some((p) => key.startsWith(p)) ||
          match.keys.includes(key)
        );
      });

      if (!enabled) {
        throw new ForbiddenException(
          `Le moteur « ${engine} » n'est pas activé pour ce tenant.`,
        );
      }
      return true;
    } catch (e) {
      // Décisions VOLONTAIRES (403 activation, 402 abonnement) : on les propage.
      if (e instanceof HttpException) throw e;
      // Toute autre erreur inattendue : fail-open (ne jamais bloquer sur panne).
      this.logger.warn(
        `gating ${engine}: erreur inattendue (${(e as Error).message}) → fail-open`,
      );
      return true;
    }
  }

  /**
   * Abonnement exploitable — logique ALIGNÉE sur `api-key.guard` (source de vérité) :
   *  - `active` tant que la période courante n'est pas dépassée (ou illimitée) ;
   *  - `past_due` toléré 7 jours après `current_period_end` (relance de paiement) ;
   *  - tout le reste (`pending`/`canceled`/`expired`/`paused`) → non exploitable.
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
    if (s.status === 'active') return periodEnd === null || periodEnd >= now;
    if (s.status === 'past_due') {
      const graceMs = 7 * 24 * 60 * 60 * 1000;
      return periodEnd === null || periodEnd + graceMs >= now;
    }
    return false;
  }
}
