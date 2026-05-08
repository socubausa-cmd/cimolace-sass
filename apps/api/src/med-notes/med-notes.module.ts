import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { ConsultationNoteService } from "./consultation-note.service";
import { ConsultationNoteController } from "./consultation-note.controller";

@Module({
  imports: [AuthModule, TenantModule],
  controllers: [ConsultationNoteController],
  providers: [ConsultationNoteService],
})
export class MedNotesModule {}
