import { Injectable, Logger } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { EmailEngineService } from "../email-engine/email-engine.service";

// Schéma RÉEL (prod, introspecté) de `notifications` :
//   id, tenant_id, user_id, type, title, body, action_url, is_read,
//   sent_email, created_at, priority, is_silent, expires_at, scheduled_at.
// → PAS de colonne `read` (c'est `is_read`) ni `channel`/`data`. Le service
//   mappe `read` (attendu par les fronts) ↔ `is_read`.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(private auth: AuthService, private email: EmailEngineService) {}
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

  async send(
    tenantId: string,
    userId: string,
    payload: { title: string; body: string; type: string; email?: boolean; actionUrl?: string },
  ) {
    const insert = (type: string) =>
      this.supabase
        .from("notifications")
        .insert({ tenant_id: tenantId, user_id: userId, type, title: payload.title, body: payload.body, is_read: false })
        .select()
        .single();
    let { data, error } = await insert(payload.type);
    // La colonne `type` a une contrainte CHECK (valeurs limitées). Si le type
    // sémantique (message, form_assignment, note_shared…) n'est pas autorisé,
    // on retombe sur 'info' (valeur sûre) plutôt que de perdre la notification.
    if (error && /check constraint|notifications_type_check/i.test(error.message)) {
      ({ data, error } = await insert("info"));
    }
    if (error) throw new Error(error.message);
    // Email PAR TENANT optionnel (best-effort, jamais bloquant) : on double le
    // canal in-app par un email transactionnel depuis le domaine du tenant.
    if (payload.email) {
      this.emailUser(tenantId, userId, payload).catch((e) =>
        this.logger.warn(`notif email: ${(e as Error).message}`),
      );
    }
    return { ...(data as any), read: false, type: (data as any)?.type ?? payload.type };
  }

  /** Résout l'email de l'utilisateur (auth admin) puis envoie via le moteur tenant. */
  private async emailUser(
    tenantId: string,
    userId: string,
    payload: { title: string; body: string; actionUrl?: string },
  ) {
    const { data } = await this.supabase.auth.admin.getUserById(userId);
    const to = (data as any)?.user?.email as string | undefined;
    if (!to) return;
    const html = this.email.brandedHtml({
      title: payload.title,
      body: payload.body,
      ctaUrl: payload.actionUrl,
      ctaLabel: payload.actionUrl ? "Ouvrir mon espace" : undefined,
    });
    await this.email.sendRaw(tenantId, to, payload.title, html);
  }
}
