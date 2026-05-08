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
  async getPopups(tenantId: string) {
    const { data } = await this.supabase.from("popups").select("*").eq("tenant_id", tenantId);
    return data ?? [];
  }
  async getBanners(tenantId: string) {
    const { data } = await this.supabase.from("banners").select("*").eq("tenant_id", tenantId);
    return data ?? [];
  }
}
