import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { ServiceCatalogService } from "./service-catalog.service";
import { FeatureGateService } from "./feature-gate.service";
import { CimolaceController } from "./cimolace.controller";

@Module({
  imports: [AuthModule, TenantModule],
  controllers: [CimolaceController],
  providers: [ServiceCatalogService, FeatureGateService],
  exports: [ServiceCatalogService, FeatureGateService],
})
export class CimolaceModule {}
