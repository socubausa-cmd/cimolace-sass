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
      .single();
    if (!membership) return null;
    const role = membership.role as string | null;
    return { ...(membership.tenants as any), role, userRole: role };
  }

  async resolveForUser(slug: string, userId: string) {
    return this.resolveTenant(userId, slug);
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
