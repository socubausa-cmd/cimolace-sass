import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { MedPrescriptionsService } from "./med-prescriptions.service";
import { MedPrescriptionsController } from "./med-prescriptions.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [MedPrescriptionsController], providers: [MedPrescriptionsService] })
export class MedPrescriptionsModule {}
