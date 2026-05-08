import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { MedFormsService } from "./med-forms.service";
import { MedFormsController } from "./med-forms.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [MedFormsController], providers: [MedFormsService] })
export class MedFormsModule {}
