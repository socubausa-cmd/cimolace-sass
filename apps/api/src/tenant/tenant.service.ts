import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class TenantService {
  constructor(private authService: AuthService) {}

  async resolveTenant(userId: string, tenantSlug?: string) {
    const supabase = this.authService.getClient();
    // If slug provided, resolve by slug; otherwise get user's first tenant
    if (tenantSlug) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", tenantSlug)
        .single();
      if (!tenant) return null;
      const { data: membership } = await supabase
        .from("tenant_memberships")
        .select("role")
        .eq("tenant_id", tenant.id)
        .eq("user_id", userId)
        .eq("status", "active")
        .single();
      const role = (membership?.role ?? null) as string | null;
      // Both `role` (legacy callers) and `userRole` (TenantContext required by
      // RolesGuard) are returned so we don't break either side.
      return { ...tenant, role, userRole: role };
    }
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role, tenants(*)")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();
    if (!membership) return null;
    const role = membership.role as string | null;
    return { ...(membership.tenants as any), role, userRole: role };
  }

  async resolveForUser(slug: string, userId: string) {
    return this.resolveTenant(userId, slug);
  }

  /**
   * Self-join : rattache l'utilisateur AUTHENTIFIÉ au tenant `slug` en role
   * 'student' (idempotent). Miroir serveur de la RPC ensure_student_membership :
   * role figé 'student' (zéro escalade), ne rétrograde JAMAIS un owner/teacher
   * existant (réactive seulement un statut non 'active'). Sert le flux public
   * /t/:slug/signup (SchoolSignupPage.autoJoinTenant → POST /tenants/:slug/join).
   * Renvoie null si le tenant n'existe pas ou n'est pas actif.
   */
  async joinAsStudent(userId: string, slug: string) {
    const supabase = this.authService.getClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, status")
      .eq("slug", slug)
      .single();
    if (!tenant || (tenant as any).status !== "active") return null;
    const tenantId = (tenant as any).id as string;
    const { data: existing } = await supabase
      .from("tenant_memberships")
      .select("id, role, status")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if ((existing as any)?.id) {
      if ((existing as any).status !== "active") {
        await supabase
          .from("tenant_memberships")
          .update({ status: "active" })
          .eq("id", (existing as any).id);
      }
      return { ok: true, joined: false, role: (existing as any).role };
    }
    const { error } = await supabase
      .from("tenant_memberships")
      .insert({ tenant_id: tenantId, user_id: userId, role: "student", status: "active" });
    // Course condition (double POST simultané) → traiter comme idempotent.
    if (error) return { ok: true, joined: false };
    return { ok: true, joined: true, role: "student" };
  }

  async getTenantBySlug(slug: string) {
    const supabase = this.authService.getClient();
    const { data } = await supabase
      .from("tenants")
      .select("slug, name, logo_url, brand_colors, status, metadata")
      .eq("slug", slug)
      .single();
    if (!data || (data as any).status !== "active") return null;
    return data;
  }

  /**
   * Resolve a tenant's public branding from a CUSTOM HOST (Enterprise
   * white-label). The patient-portal served on a tenant's own domain
   * (e.g. patient.zahirwellness.com) can't know its slug from the URL, so
   * it resolves both branding AND its slug from the hostname.
   *
   * Looks up an ACTIVE `custom_host` row in tenant_domains matching the
   * hostname, then returns the same public payload as getTenantBySlug.
   * Returns null when the host isn't a registered active custom domain
   * (or its tenant isn't active) — so an unknown host leaks nothing.
   */
  async getTenantByHost(host: string) {
    const supabase = this.authService.getClient();
    const normalized = (host ?? "").trim().toLowerCase();
    if (!normalized) return null;
    const { data: domainRow } = await supabase
      .from("tenant_domains")
      .select("tenant_id")
      .eq("domain", normalized)
      .eq("usage", "custom_host")
      .eq("status", "active")
      .maybeSingle();
    const tenantId = (domainRow as any)?.tenant_id as string | undefined;
    if (!tenantId) return null;
    const { data } = await supabase
      .from("tenants")
      .select("slug, name, logo_url, brand_colors, status")
      .eq("id", tenantId)
      .single();
    if (!data || (data as any).status !== "active") return null;
    return data;
  }

  /**
   * Returns all tenants the given user is a member of, with their role.
   * Used by the frontend TenantProtectedRoute to verify membership.
   * Response shape mirrors the legacy Netlify tenant-context lambda so
   * the frontend doesn't need changes.
   */
  async getMineForUser(userId: string) {
    const supabase = this.authService.getClient();
    const { data, error } = await supabase
      .from("tenant_memberships")
      .select("role, status, tenants(id, slug, name, infrastructure_type, status, logo_url)")
      .eq("user_id", userId)
      .eq("status", "active");

    if (error || !data) return [];

    return (data as any[]).map((row) => ({
      role: row.role,
      slug: row.tenants?.slug ?? null,
      name: row.tenants?.name ?? null,
      infrastructure_type: row.tenants?.infrastructure_type ?? null,
      status: row.tenants?.status ?? null,
      logo_url: row.tenants?.logo_url ?? null,
      // Frontend also checks t.tenants?.slug shape:
      tenants: row.tenants ?? null,
    }));
  }

  async getTenantById(tenantId: string) {
    const supabase = this.authService.getClient();
    const { data } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();
    return data;
  }

  /**
   * Update branding columns on a tenant row. Only fields explicitly
   * provided in the DTO are written so partial updates (color picker
   * only, logo only) work as expected.
   */
  /**
   * Activate/désactiver un service Cimolace (ex: 'twin') pour un tenant donné.
   * Endpoint Cimolace staff. Upsert sur (tenant_id, service_key) — crée la
   * ligne si elle n'existe pas encore. Renvoie la ligne tenant_services
   * mise à jour.
   */
  async updateTenantService(
    tenantId: string,
    serviceKey: string,
    active: boolean,
  ) {
    const supabase = this.authService.getClient();
    const { data, error } = await supabase
      .from("tenant_services")
      .upsert(
        {
          tenant_id: tenantId,
          service_key: serviceKey,
          active,
        },
        { onConflict: "tenant_id,service_key" },
      )
      .select("*")
      .single();
    if (error) {
      throw new Error(
        `Mise à jour service ${serviceKey} impossible pour tenant ${tenantId}: ${error.message}`,
      );
    }
    return data;
  }

  async updateBranding(
    tenantId: string,
    dto: {
      name?: string;
      logo_url?: string;
      primary_domain?: string;
      brand_colors?: { primary?: string; secondary?: string; accent?: string };
    },
  ) {
    const supabase = this.authService.getClient();
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.logo_url !== undefined) patch.logo_url = dto.logo_url;
    if (dto.primary_domain !== undefined) patch.primary_domain = dto.primary_domain;
    if (dto.brand_colors !== undefined) patch.brand_colors = dto.brand_colors;
    if (Object.keys(patch).length === 0) {
      return this.getTenantById(tenantId);
    }
    const { data } = await supabase
      .from("tenants")
      .update(patch)
      .eq("id", tenantId)
      .select("*")
      .single();
    return data;
  }
}
