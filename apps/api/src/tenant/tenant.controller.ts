import { Controller, Get, Req, UseGuards, Headers } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { TenantService } from "./tenant.service";

@Controller("tenants")
export class TenantController {
  constructor(private tenantService: TenantService) {}

  @Get("current")
  @UseGuards(JwtAuthGuard, TenantGuard)
  async current(@Req() req: any) {
    return { data: req.tenant };
  }
}
