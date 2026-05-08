import { Controller, Get, Post, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { MarketingService } from "./marketing.service";

@Controller("marketing")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MarketingController {
  constructor(private svc: MarketingService) {}
  @Get("promos") async getPromos(@Req() req: any) { return { data: await this.svc.getPromos(req.tenant.id) }; }
  @Post("promos") async createPromo(@Req() req: any, @Body() b: any) { return { data: await this.svc.createPromo(req.tenant.id, b) }; }
  @Get("popups") async getPopups(@Req() req: any) { return { data: await this.svc.getPopups(req.tenant.id) }; }
  @Get("banners") async getBanners(@Req() req: any) { return { data: await this.svc.getBanners(req.tenant.id) }; }
}
