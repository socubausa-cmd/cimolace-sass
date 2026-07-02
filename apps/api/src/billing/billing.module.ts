import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { PawaPayModule } from "../pawapay/pawapay.module";
import { BillingService } from "./billing.service";
import { BillingController, AdminBillingController, BillingCronController } from "./billing.controller";
import { BillingWebhookController } from "./billing-webhook.controller";
import { BillingAdvancedController } from "./billing-advanced.controller";
import { BillingAdvancedService } from "./billing-advanced.service";
import { WebhookService } from "../liri-public/webhook.service";
import { TenantPaymentConfigModule } from "./tenant-payment-config/tenant-payment-config.module";
import { BillingCatalogModule } from "./billing-catalog/billing-catalog.module";
import { EmailEngineModule } from "../email-engine/email-engine.module";

@Module({
  imports: [AuthModule, TenantModule, SupabaseModule, PawaPayModule, TenantPaymentConfigModule, BillingCatalogModule, EmailEngineModule],
  controllers: [BillingController, AdminBillingController, BillingCronController, BillingWebhookController, BillingAdvancedController],
  providers: [BillingService, BillingAdvancedService, WebhookService],
  exports: [BillingService, BillingAdvancedService],
})
export class BillingModule {}
