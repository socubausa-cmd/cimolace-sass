import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { MarketingService } from "./marketing.service";
import { MarketingController } from "./marketing.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [MarketingController], providers: [MarketingService] })
export class MarketingModule {}
