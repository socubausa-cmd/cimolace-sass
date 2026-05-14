import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class TenantService {
  constructor(private authService: AuthService) {}

  async resolveTenant(userId: string, tenantSlug?: string) {
    const supabase = this.authService.getClient();
    // If slug provided, resolve by slug; otherwise get user's first tenant
    if (tenantSlug) {
      const { data: tenant } = await supabase.from("tenants").select("*").eq("slug", tenantSlug).single();
      if (!tenant) return null;
      const { data: membership } = await supabase.from("tenant_memberships").select("role").eq("tenant_id", tenant.id).eq("user_id", userId).single();
      return { ...tenant, role: membership?.role ?? null };
    }
    const { data: membership } = await supabase.from("tenant_memberships").select("tenant_id, role, tenants(*)").eq("user_id", userId).single();
    if (!membership) return null;
    return { ...(membership.tenants as any), role: membership.role };
  }

  async resolveForUser(slug: string, userId: string) {
    return this.resolveTenant(userId, slug);
  }

  async getTenantById(tenantId: string) {
    const supabase = this.authService.getClient();
    const { data } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
    return data;
  }
}
