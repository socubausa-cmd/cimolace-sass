import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";

// Schéma RÉEL (prod, introspecté) de `notifications` :
//   id, tenant_id, user_id, type, title, body, action_url, is_read,
//   sent_email, created_at, priority, is_silent, expires_at, scheduled_at.
// → PAS de colonne `read` (c'est `is_read`) ni `channel`/`data`. Le service
//   mappe `read` (attendu par les fronts) ↔ `is_read`.
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
    return (data ?? []).map((n: any) => ({ ...n, read: n.is_read ?? false }));
  }

  async markRead(tenantId: string, notifId: string) {
    const { data, error } = await this.supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("tenant_id", tenantId)
      .eq("id", notifId)
      .select()
      .single();
    if (error) return { id: notifId };
    return { ...(data as any), read: true };
  }

  async send(tenantId: string, userId: string, payload: { title: string; body: string; type: string }) {
    const { data, error } = await this.supabase
      .from("notifications")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        is_read: false,
      })
      .select()
      .single();
    // On JETTE l'erreur : les appelants (événements MEDOS) sont best-effort
    // (try/catch → logger.warn) → tout échec devient VISIBLE, plus de silence.
    if (error) throw new Error(error.message);
    return { ...(data as any), read: false };
  }
}
