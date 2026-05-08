import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { MedChartingService } from "./med-charting.service";
import { MedChartingController } from "./med-charting.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [MedChartingController], providers: [MedChartingService] })
export class MedChartingModule {}
