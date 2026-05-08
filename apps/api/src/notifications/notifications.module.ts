import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";

@Module({ imports: [AuthModule, TenantModule], controllers: [NotificationsController], providers: [NotificationsService] })
export class NotificationsModule {}
