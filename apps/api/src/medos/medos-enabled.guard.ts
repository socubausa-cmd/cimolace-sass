import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';

type MedosTenantRequest = Request & { tenant?: TenantContext };

const MEDOS_SERVICE_KEYS = new Set([
  'med_ehr',
  'med_notes',
  'med_prescriptions',
  'med_forms',
  'med_health',
  'med_programs',
  'med_charting',
  'gdpr_engine',
]);

function isMedosServiceKey(serviceKey: string): boolean {
  return serviceKey.startsWith('medos_') || MEDOS_SERVICE_KEYS.has(serviceKey);
}

@Injectable()
export class MedosEnabledGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<MedosTenantRequest>();
    const tenant = req.tenant;

    if (!tenant?.id) {
      throw new ForbiddenException('Tenant requis pour accéder à MedOS');
    }

    if (tenant.infrastructure_type === 'medos') {
      return true;
    }

    const { data, error } = await this.supabase.client
      .from('tenant_services')
      .select('service_key, active')
      .eq('tenant_id', tenant.id)
      .eq('active', true);

    if (error) {
      throw new InternalServerErrorException(
        'Vérification activation MedOS impossible',
      );
    }

    const hasActiveMedosService = (data ?? []).some((service) =>
      isMedosServiceKey(String(service.service_key)),
    );

    if (!hasActiveMedosService) {
      throw new ForbiddenException('MedOS n’est pas activé pour ce tenant');
    }

    return true;
  }
}
