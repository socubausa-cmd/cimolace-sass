import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { MedProgramsService } from "./med-programs.service";
import { MedProgramsController } from "./med-programs.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [MedProgramsController], providers: [MedProgramsService] })
export class MedProgramsModule {}
