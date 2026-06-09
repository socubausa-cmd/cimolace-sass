import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { PawaPayModule } from "../pawapay/pawapay.module";
import { BillingService } from "./billing.service";
import { BillingController, AdminBillingController } from "./billing.controller";
import { BillingWebhookController } from "./billing-webhook.controller";
import { BillingAdvancedController } from "./billing-advanced.controller";
import { BillingAdvancedService } from "./billing-advanced.service";

@Module({
  imports: [AuthModule, TenantModule, SupabaseModule, PawaPayModule],
  controllers: [BillingController, AdminBillingController, BillingWebhookController, BillingAdvancedController],
  providers: [BillingService, BillingAdvancedService],
  exports: [BillingService, BillingAdvancedService],
})
export class BillingModule {}
