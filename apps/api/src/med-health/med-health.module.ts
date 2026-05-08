import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { MedHealthService } from "./med-health.service";
import { MedHealthController } from "./med-health.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [MedHealthController], providers: [MedHealthService] })
export class MedHealthModule {}
