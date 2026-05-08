import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get() async getAll(@Req() req: any) { return { data: await this.svc.getUserNotifications(req.tenant.id, req.user.id) }; }
  @Post(":id/read") async markRead(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.markRead(req.tenant.id, id) }; }
  @Post() async send(@Req() req: any, @Body() b: any) { return { data: await this.svc.send(req.tenant.id, b.user_id, b) }; }
}
