import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { CimolaceStaffGuard } from "../cimolace-backoffice/cimolace-staff.guard";
import { TenantService } from "./tenant.service";
import { UpdateBrandingDto } from "./update-branding.dto";

@Controller("tenants")
export class TenantController {
  constructor(private tenantService: TenantService) {}

  /** Read the calling user's active tenant (with branding). */
  @Get("current")
  @UseGuards(JwtAuthGuard, TenantGuard)
  async current(@Req() req: any) {
    return { data: req.tenant };
  }

  /**
   * Public endpoint — branding-only lookup by tenant slug.
   *
   * Returns just the visible-to-public surface (name, logo_url, brand_colors).
   * No auth required — so the login pages of patient-portal / med-app can
   * theme themselves BEFORE the user is authenticated, when the URL carries
   * a `?tenant=<slug>` query param or a subdomain.
   *
   * Returns 404 if the slug doesn't match an active tenant.
   */
  @Get("by-slug/:slug/branding")
  async brandingBySlug(@Param("slug") slug: string) {
    const tenant = await this.tenantService.getTenantBySlug(slug);
    if (!tenant) {
      // Don't leak which slugs exist — return 404 silently.
      return { data: null };
    }
    const t = tenant as {
      name?: string;
      logo_url?: string | null;
      brand_colors?: Record<string, string> | null;
      slug: string;
    };
    return {
      data: {
        slug: t.slug,
        name: t.name ?? slug,
        logo_url: t.logo_url ?? null,
        brand_colors: t.brand_colors ?? {},
      },
    };
  }

  /**
   * Self-serve branding update — a tenant owner / admin editing their own
   * tenant from within apps/app. The TenantGuard resolves the tenant from
   * `X-Tenant-Slug` and we trust the auth context.
   *
   * Used by the self-serve branding editor in apps/app (tenantsApi.updateBranding).
   */
  @Patch("current/branding")
  @UseGuards(JwtAuthGuard, TenantGuard)
  async updateOwnBranding(
    @Req() req: any,
    @Body() dto: UpdateBrandingDto,
  ) {
    return {
      data: await this.tenantService.updateBranding(req.tenant.id, dto),
    };
  }

  /**
   * Staff-only branding update on an arbitrary tenant. Used by Cimolace
   * support to onboard a new tenant and apply their visual identity before
   * the tenant has any user able to self-serve.
   */
  @Patch(":tenantId/branding")
  @UseGuards(JwtAuthGuard, CimolaceStaffGuard)
  async updateBranding(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateBrandingDto,
  ) {
    return {
      data: await this.tenantService.updateBranding(tenantId, dto),
    };
  }
}
