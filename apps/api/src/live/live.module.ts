import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { LiveService } from "./live.service";
import { LiveController } from "./live.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [LiveController], providers: [LiveService] })
export class LiveModule {}
