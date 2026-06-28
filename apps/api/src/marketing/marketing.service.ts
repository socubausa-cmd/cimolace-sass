import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class MarketingService {
  constructor(private auth: AuthService) {}
  private get supabase() { return this.auth.getClient(); }

  async getPromos(tenantId: string) {
    const { data } = await this.supabase.from("promo_codes").select("*").eq("tenant_id", tenantId);
    return data ?? [];
  }
  async createPromo(tenantId: string, dto: any) {
    const { data } = await this.supabase.from("promo_codes").insert({ tenant_id: tenantId, ...dto }).select().single();
    return data;
  }
  async updatePromo(tenantId: string, id: string, dto: any) {
    const { id: _omitId, tenant_id: _omitTenant, ...patch } = dto || {};
    const { data } = await this.supabase
      .from("promo_codes").update(patch).eq("id", id).eq("tenant_id", tenantId).select().single();
    return data;
  }
  async deletePromo(tenantId: string, id: string) {
    await this.supabase.from("promo_codes").delete().eq("id", id).eq("tenant_id", tenantId);
    return { ok: true };
  }
  async getPopups(tenantId: string) {
    const { data } = await this.supabase.from("popups").select("*").eq("tenant_id", tenantId);
    return data ?? [];
  }
  async getBanners(tenantId: string) {
    const { data } = await this.supabase.from("banners").select("*").eq("tenant_id", tenantId);
    return data ?? [];
  }
}
