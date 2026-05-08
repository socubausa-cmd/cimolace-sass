import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class BillingService {
  constructor(private auth: AuthService) {}
  private get supabase() { return this.auth.getClient(); }

  async getSubscription(tenantId: string) {
    const { data } = await this.supabase.from("subscriptions").select("*").eq("tenant_id", tenantId).single();
    return data;
  }
  async createSubscription(tenantId: string, plan: string, provider: string) {
    const { data } = await this.supabase.from("subscriptions").insert({ tenant_id: tenantId, plan, provider, status: "active" }).select().single();
    return data;
  }
  async getInvoices(tenantId: string) {
    const { data } = await this.supabase.from("invoices").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    return data ?? [];
  }
}
