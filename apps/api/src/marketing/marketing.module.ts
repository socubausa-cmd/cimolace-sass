import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { TenantModule } from "../tenant/tenant.module";
import { MarketingService } from "./marketing.service";
import { MarketingController } from "./marketing.controller";
import { MarketingAdvancedController } from "./marketing-advanced.controller";
import { MarketingAdvancedService } from "./marketing-advanced.service";

@Module({
  imports: [AuthModule, TenantModule, SupabaseModule],
  controllers: [MarketingController, MarketingAdvancedController],
  providers: [MarketingService, MarketingAdvancedService],
  exports: [MarketingService, MarketingAdvancedService],
})
export class MarketingModule {}
