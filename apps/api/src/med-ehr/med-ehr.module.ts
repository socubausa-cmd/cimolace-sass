import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { PatientRecordService } from "./patient-record.service";
import { PatientRecordController } from "./patient-record.controller";

@Module({
  imports: [AuthModule, TenantModule],
  controllers: [PatientRecordController],
  providers: [PatientRecordService],
})
export class MedEhrModule {}
