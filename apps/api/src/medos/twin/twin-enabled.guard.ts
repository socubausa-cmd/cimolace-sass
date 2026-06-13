import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';

type TwinTenantRequest = Request & { tenant?: TenantContext };

/**
 * TwinEnabledGuard — vérifie que le module 'twin' (Bio Digital Twin)
 * est activé pour le tenant courant.
 *
 * Cohabite avec MedosEnabledGuard : MedosEnabledGuard valide l'accès global
 * à MedOS, TwinEnabledGuard restreint en plus aux tenants qui ont coché
 * le service 'twin' dans tenant_services (toggle marketplace).
 *
 * Les tenants avec infrastructure_type='medos' ne sont PAS exemptés ici :
 * on veut pouvoir couper le module Twin même pour une clinique MedOS pure
 * (par exemple en cas d'incident, ou pour les plans qui n'incluent pas
 * la couche Twin).
 */
@Injectable()
export class TwinEnabledGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<TwinTenantRequest>();
    const tenant = req.tenant;

    if (!tenant?.id) {
      throw new ForbiddenException(
        'Tenant requis pour accéder au Bio Digital Twin',
      );
    }

    const { data, error } = await this.supabase.client
      .from('tenant_services')
      .select('active')
      .eq('tenant_id', tenant.id)
      .eq('service_key', 'twin')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        'Vérification activation Twin impossible',
      );
    }

    if (!data || data.active !== true) {
      throw new ForbiddenException(
        'Le module Bio Digital Twin n’est pas activé pour ce tenant',
      );
    }

    return true;
  }
}
