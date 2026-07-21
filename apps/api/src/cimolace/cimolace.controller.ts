import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { ServiceCatalogService } from "./service-catalog.service";
import { FeatureGateService } from "./feature-gate.service";

// ⚠️ Contrôleur legacy (doublonne le module role-gated `catalog/*`). Les
// mutations sont désormais RÉSERVÉES owner/admin : avant, tout membre (élève
// inclus) pouvait activer un moteur payant gratuitement OU DÉSACTIVER un moteur
// d'un tenant payant (sabotage → 403 global). Faille P1, audit 2026-07-03.
@Controller("cimolace")
export class CimolaceController {
  constructor(private catalog: ServiceCatalogService, private gate: FeatureGateService) {}

  @Get("catalog")
  async getCatalog() { return { data: this.catalog.getCatalog() }; }

  @Get("templates")
  async getTemplates() { return { data: this.catalog.getTemplates() }; }

  @Get("services")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("owner", "admin")
  async getTenantServices(@Req() req: any) { return { data: await this.catalog.getTenantServices(req.tenant.id) }; }

  @Post("services/:key/toggle")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("owner", "admin")
  async toggle(@Req() req: any, @Param("key") key: string, @Body() b: any) { return { data: await this.catalog.toggleService(req.tenant.id, key, b.active) }; }

  @Post("activate-template/:type")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("owner", "admin")
  async activateTemplate(@Req() req: any, @Param("type") type: string) { return { data: await this.gate.activateTemplate(req.tenant.id, type) }; }
}
