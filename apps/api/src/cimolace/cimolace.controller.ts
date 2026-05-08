import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { ServiceCatalogService } from "./service-catalog.service";
import { FeatureGateService } from "./feature-gate.service";

@Controller("cimolace")
export class CimolaceController {
  constructor(private catalog: ServiceCatalogService, private gate: FeatureGateService) {}

  @Get("catalog")
  async getCatalog() { return { data: this.catalog.getCatalog() }; }

  @Get("templates")
  async getTemplates() { return { data: this.catalog.getTemplates() }; }

  @Get("services")
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getTenantServices(@Req() req: any) { return { data: await this.catalog.getTenantServices(req.tenant.id) }; }

  @Post("services/:key/toggle")
  @UseGuards(JwtAuthGuard, TenantGuard)
  async toggle(@Req() req: any, @Param("key") key: string, @Body() b: any) { return { data: await this.catalog.toggleService(req.tenant.id, key, b.active) }; }

  @Post("activate-template/:type")
  @UseGuards(JwtAuthGuard, TenantGuard)
  async activateTemplate(@Req() req: any, @Param("type") type: string) { return { data: await this.gate.activateTemplate(req.tenant.id, type) }; }
}
