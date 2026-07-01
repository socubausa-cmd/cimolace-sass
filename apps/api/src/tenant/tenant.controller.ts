import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CimolaceStaffGuard } from "../cimolace-backoffice/cimolace-staff.guard";
import { TenantService, isEmbeddedTenant, isPlatformOrigin } from "./tenant.service";
import { UpdateBrandingDto } from "./update-branding.dto";
import { UpdateTenantSettingsDto } from "./update-tenant-settings.dto";

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
   * GET /tenants/mine — returns all tenants the authenticated user belongs to.
   *
   * Used by the frontend TenantProtectedRoute (TenantProtectedRoute.jsx) to
   * verify that a user is a member of the tenant in the URL before rendering
   * the admin dashboard. No TenantGuard needed here because the query is
   * scoped to req.user.id across all tenants.
   */
  @Get("mine")
  @UseGuards(JwtAuthGuard)
  async mine(@Req() req: any) {
    const memberships = await this.tenantService.getMineForUser(req.user.id);
    return { data: memberships };
  }

  /**
   * POST /tenants/:slug/join — l'utilisateur AUTHENTIFIÉ se rattache au tenant
   * `slug` en role 'student' (self-join idempotent, zéro escalade ; ne rétrograde
   * jamais un owner/teacher). Câble le flux public /t/:slug/signup
   * (SchoolSignupPage.autoJoinTenant). Pas de TenantGuard : on rejoint JUSTEMENT
   * un tenant dont on n'est pas encore membre ; le slug vient de l'URL publique,
   * l'utilisateur de l'auth. Le front accepte 200 (ok) ou 409.
   */
  @Post(":slug/join")
  @UseGuards(JwtAuthGuard)
  async join(@Req() req: any, @Param("slug") slug: string) {
    // Depuis le host neutre LIRI, on refuse de rejoindre un tenant EMBARQUÉ
    // (il a son propre site). Depuis le domaine du tenant, le self-join reste OK.
    const fromPlatformHost = isPlatformOrigin(
      req.headers?.origin || req.headers?.referer,
    );
    const result = await this.tenantService.joinAsStudent(
      req.user.id,
      slug,
      fromPlatformHost,
    );
    if (!result) throw new NotFoundException("École introuvable ou inactive.");
    return { data: result };
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
      // Don't leak which slugs exist — return null (interceptor wraps in
      // { data: null } automatically). Frontend treats this as "no tenant
      // found, keep engine defaults".
      return null;
    }
    const t = tenant as {
      name?: string;
      logo_url?: string | null;
      brand_colors?: Record<string, string> | null;
      slug: string;
      metadata?: {
        site?: Record<string, unknown> | null;
        settings?: { requiresStudentDossier?: boolean } | null;
      } | null;
    };
    // Return the bare payload — ResponseInterceptor wraps it in
    // `{ data: ... }`. The pre-existing `/tenants/current` returns
    // `{ data: req.tenant }` which double-wraps to
    // `{ data: { data: req.tenant } }` but only the BrandingProvider
    // frontends unwrap both layers — we don't replicate that quirk.
    // `site` = contenu éditable de la vitrine publique (stocké dans
    // metadata.site) ; null => le portail utilise ses textes par défaut.
    return {
      slug: t.slug,
      name: t.name ?? slug,
      logo_url: t.logo_url ?? null,
      brand_colors: t.brand_colors ?? {},
      site: t.metadata?.site ?? null,
      // null = non défini → le client retombe sur sa config (founder ISNA = true).
      requiresStudentDossier: t.metadata?.settings?.requiresStudentDossier ?? null,
      // Séparation dure : un tenant EMBARQUÉ (site propre) est signalé au front,
      // qui le traite comme « introuvable » sur le host neutre LIRI (on ne le
      // rejoint QUE par son domaine). Le branding reste renvoyé pour ses apps.
      embedded: isEmbeddedTenant(tenant),
    };
  }

  /**
   * Public endpoint — branding-only lookup by CUSTOM HOST (Enterprise
   * white-label). When the patient-portal is served on a tenant's own
   * domain (e.g. patient.zahirwellness.com), the URL carries no slug, so
   * the app resolves BOTH its branding and its tenant slug from the
   * hostname. The returned `slug` is what the client persists to send as
   * `X-Tenant-Slug` on later authenticated calls.
   *
   * Returns null (→ { data: null }) if the host isn't a registered active
   * custom domain — keeps the patient on engine defaults and leaks nothing.
   */
  @Get("by-host/:host/branding")
  async brandingByHost(@Param("host") host: string) {
    const tenant = await this.tenantService.getTenantByHost(host);
    if (!tenant) {
      return null;
    }
    const t = tenant as {
      name?: string;
      logo_url?: string | null;
      brand_colors?: Record<string, string> | null;
      slug: string;
      metadata?: { settings?: { requiresStudentDossier?: boolean } | null } | null;
    };
    return {
      slug: t.slug,
      name: t.name ?? t.slug,
      logo_url: t.logo_url ?? null,
      brand_colors: t.brand_colors ?? {},
      // null = non défini → le client retombe sur sa config (founder ISNA = true).
      requiresStudentDossier: t.metadata?.settings?.requiresStudentDossier ?? null,
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
   * Self-serve tenant settings (no-code) — RÉSERVÉ owner/admin (RolesGuard).
   * Distinct du branding : un élève ne doit pas pouvoir désactiver son propre
   * KYC. Pour l'instant : `requiresStudentDossier` (gating dossier élève →
   * certificats), stocké dans `tenants.metadata.settings`.
   */
  @Patch("current/settings")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("owner", "admin")
  async updateOwnSettings(
    @Req() req: any,
    @Body() dto: UpdateTenantSettingsDto,
  ) {
    return {
      data: await this.tenantService.updateTenantSettings(req.tenant.id, dto),
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

/**
 * Admin marketplace — toggle d'un service Cimolace (ex: 'twin') sur un
 * tenant. Réservé au staff Cimolace. Endpoint séparé sous `/admin/tenants/...`
 * pour ne pas mélanger avec les routes self-serve.
 *
 * Body : { active: boolean }
 */
@Controller("admin/tenants")
export class AdminTenantServicesController {
  constructor(private tenantService: TenantService) {}

  @Post(":tenantId/services/:serviceKey/toggle")
  @UseGuards(JwtAuthGuard, CimolaceStaffGuard)
  async toggleService(
    @Param("tenantId") tenantId: string,
    @Param("serviceKey") serviceKey: string,
    @Body() body: { active?: boolean },
  ) {
    if (typeof body?.active !== "boolean") {
      throw new BadRequestException("Body { active: boolean } requis");
    }
    return {
      data: await this.tenantService.updateTenantService(
        tenantId,
        serviceKey,
        body.active,
      ),
    };
  }
}
