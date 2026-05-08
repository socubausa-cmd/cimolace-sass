import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { MedGdprService } from "./med-gdpr.service";
import { MedGdprController } from "./med-gdpr.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [MedGdprController], providers: [MedGdprService] })
export class MedGdprModule {}
