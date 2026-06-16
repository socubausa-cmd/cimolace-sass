import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { TenantModule } from '../../tenant/tenant.module';
import { SupabaseModule } from '../../supabase/supabase.module';
import { TenantPaymentConfigController } from './tenant-payment-config.controller';
import { TenantPaymentConfigService } from './tenant-payment-config.service';

/**
 * Module de configuration des moyens de paiement par tenant.
 * - AuthModule    : JwtAuthGuard (stratégie JWT).
 * - TenantModule  : TenantGuard + TenantService (résolution X-Tenant-Slug).
 * - SupabaseModule: client service_role.
 * Importé par BillingModule (n'alourdit pas billing-advanced).
 */
@Module({
  imports: [AuthModule, TenantModule, SupabaseModule],
  controllers: [TenantPaymentConfigController],
  providers: [TenantPaymentConfigService],
  exports: [TenantPaymentConfigService],
})
export class TenantPaymentConfigModule {}
