import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

// La table `notifications` a pour colonnes : title, body, channel, template_key,
// data (jsonb), is_read, read_at, created_at (PAS `type` ni `read`). Le service
// mappe la forme attendue par les fronts ({ type, read }) sur ce schéma réel :
// `type` ↔ data.type, `read` ↔ is_read.
@Injectable()
export class NotificationsService {
  constructor(private auth: AuthService) {}
  private get supabase() { return this.auth.getClient(); }

  async getUserNotifications(tenantId: string, userId: string) {
    const { data } = await this.supabase
      .from("notifications")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []).map((n: any) => ({
      ...n,
      read: n.is_read ?? false,
      type: n.data?.type ?? n.template_key ?? "info",
    }));
  }

  async markRead(tenantId: string, notifId: string) {
    const { data, error } = await this.supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", notifId)
      .select()
      .single();
    if (error) return { id: notifId };
    return { ...(data as any), read: (data as any)?.is_read ?? true, type: (data as any)?.data?.type };
  }

  async send(tenantId: string, userId: string, payload: { title: string; body: string; type: string }) {
    const { data, error } = await this.supabase
      .from("notifications")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        title: payload.title,
        body: payload.body,
        channel: "in_app",
        data: { type: payload.type },
        is_read: false,
      })
      .select()
      .single();
    // On JETTE l'erreur : les appelants (événements MEDOS) sont en try/catch
    // best-effort → le warn devient VISIBLE au lieu d'un échec silencieux.
    if (error) throw new Error(error.message);
    return { ...(data as any), read: false, type: payload.type };
  }
}
