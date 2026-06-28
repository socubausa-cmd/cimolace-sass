import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { MarketingService } from "./marketing.service";

@Controller("marketing")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MarketingController {
  constructor(private svc: MarketingService) {}
  @Get("promos") async getPromos(@Req() req: any) { return { data: await this.svc.getPromos(req.tenant.id) }; }
  @Post("promos") @UseGuards(RolesGuard) @Roles("owner", "admin") async createPromo(@Req() req: any, @Body() b: any) { return { data: await this.svc.createPromo(req.tenant.id, b) }; }
  @Patch("promos/:id") @UseGuards(RolesGuard) @Roles("owner", "admin") async updatePromo(@Req() req: any, @Param("id") id: string, @Body() b: any) { return { data: await this.svc.updatePromo(req.tenant.id, id, b) }; }
  @Delete("promos/:id") @UseGuards(RolesGuard) @Roles("owner", "admin") async deletePromo(@Req() req: any, @Param("id") id: string) { return { data: await this.svc.deletePromo(req.tenant.id, id) }; }
  @Get("popups") async getPopups(@Req() req: any) { return { data: await this.svc.getPopups(req.tenant.id) }; }
  @Get("banners") async getBanners(@Req() req: any) { return { data: await this.svc.getBanners(req.tenant.id) }; }
}
