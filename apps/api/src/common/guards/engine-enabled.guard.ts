import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
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
      const runtimeGating =
        (t as any)?.metadata?.gating?.runtime === true;
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
      if (e instanceof ForbiddenException) throw e;
      // Toute autre erreur inattendue : fail-open (ne jamais bloquer sur panne).
      this.logger.warn(
        `gating ${engine}: erreur inattendue (${(e as Error).message}) → fail-open`,
      );
      return true;
    }
  }
}
