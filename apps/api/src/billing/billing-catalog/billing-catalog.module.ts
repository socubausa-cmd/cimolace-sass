import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { TenantModule } from '../../tenant/tenant.module';
import { SupabaseModule } from '../../supabase/supabase.module';
import { BillingCatalogController } from './billing-catalog.controller';
import { BillingCatalogService } from './billing-catalog.service';

/**
 * Module du catalogue de services par tenant (CRUD sur billing_plans).
 * - AuthModule    : JwtAuthGuard (stratégie JWT).
 * - TenantModule  : TenantGuard + TenantService (résolution X-Tenant-Slug).
 * - SupabaseModule: client service_role.
 * Importé par BillingModule (même branchement que TenantPaymentConfigModule).
 */
@Module({
  imports: [AuthModule, TenantModule, SupabaseModule],
  controllers: [BillingCatalogController],
  providers: [BillingCatalogService],
  exports: [BillingCatalogService],
})
export class BillingCatalogModule {}
