import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { BillingAdvancedController } from "./billing-advanced.controller";
import { BillingAdvancedService } from "./billing-advanced.service";

@Module({
  imports: [AuthModule, TenantModule, SupabaseModule],
  controllers: [BillingController, BillingAdvancedController],
  providers: [BillingService, BillingAdvancedService],
  exports: [BillingService, BillingAdvancedService],
})
export class BillingModule {}
