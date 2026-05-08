import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [BillingController], providers: [BillingService] })
export class BillingModule {}
