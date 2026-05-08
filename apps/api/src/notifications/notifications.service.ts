import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class NotificationsService {
  constructor(private auth: AuthService) {}
  private get supabase() { return this.auth.getClient(); }

  async getUserNotifications(tenantId: string, userId: string) {
    const { data } = await this.supabase.from("notifications").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    return data ?? [];
  }
  async markRead(tenantId: string, notifId: string) {
    const { data } = await this.supabase.from("notifications").update({ read: true }).eq("tenant_id", tenantId).eq("id", notifId).select().single();
    return data;
  }
  async send(tenantId: string, userId: string, payload: { title: string; body: string; type: string }) {
    const { data } = await this.supabase.from("notifications").insert({ tenant_id: tenantId, user_id: userId, ...payload, read: false }).select().single();
    return data;
  }
}
