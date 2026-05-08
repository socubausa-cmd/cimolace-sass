import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { CheckoutService } from "./checkout.service";
import { CheckoutController } from "./checkout.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [CheckoutController], providers: [CheckoutService] })
export class CheckoutModule {}
