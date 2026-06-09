import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { CimolaceStaffGuard } from '../cimolace-backoffice/cimolace-staff.guard';
import { TenantService } from './tenant.service';
import {
  TenantController,
  AdminTenantServicesController,
} from './tenant.controller';
import { TenantApiKeyController } from './tenant-api-key.controller';
import { TenantPortalController } from './tenant-portal.controller';

@Module({
  // SupabaseModule is needed because CimolaceStaffGuard injects SupabaseService
  // (used by the PATCH /tenants/:id/branding endpoint and the marketplace
  // toggle on /admin/tenants/:tenantId/services/:serviceKey/toggle).
  imports: [AuthModule, SupabaseModule],
  controllers: [
    TenantController,
    TenantApiKeyController,
    TenantPortalController,
    AdminTenantServicesController,
  ],
  providers: [TenantService, CimolaceStaffGuard],
  exports: [TenantService],
})
export class TenantModule {}
