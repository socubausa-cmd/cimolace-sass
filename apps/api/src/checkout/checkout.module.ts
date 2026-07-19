import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { PawaPayModule } from "../pawapay/pawapay.module";
import { TenantPaymentConfigModule } from "../billing/tenant-payment-config/tenant-payment-config.module";
import { EmailEngineModule } from "../email-engine/email-engine.module";
import { LiriEntitlementsModule } from "../billing/liri-entitlements.module";
import { CheckoutService } from "./checkout.service";
import { CheckoutController } from "./checkout.controller";
import { OfferingCheckoutService } from "./offering-checkout.service";
import { OfferingCheckoutController } from "./offering-checkout.controller";
import { SubscriptionRenewalService } from "./subscription-renewal.service";

@Module({
  imports: [AuthModule, TenantModule, PawaPayModule, TenantPaymentConfigModule, EmailEngineModule, LiriEntitlementsModule],
  controllers: [CheckoutController, OfferingCheckoutController],
  providers: [CheckoutService, OfferingCheckoutService, SubscriptionRenewalService],
})
export class CheckoutModule {}
