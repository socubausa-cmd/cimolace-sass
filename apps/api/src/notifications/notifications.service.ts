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
        .insert({ tenant_id: tenantId, user_id: userId, type, title: payload.title, body: payload.body, is_read: false, action_url: payload.actionUrl ?? null })
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
    const ctaUrl = NotificationsService.lienAbsolu(payload.actionUrl);
    const html = this.email.brandedHtml({
      title: payload.title,
      body: payload.body,
      ctaUrl,
      ctaLabel: ctaUrl ? "Ouvrir mon espace" : undefined,
    });
    await this.email.sendRaw(tenantId, to, payload.title, html);
  }

  /**
   * Rend un lien de notification ABSOLU avant de le mettre dans un e-mail.
   *
   * ⚠️ DÉFAUT VÉCU, ET IL EST SOURNOIS. Le même `actionUrl` sert DEUX canaux :
   *   • la cloche in-app, où `/liri/rdv` est CORRECT (navigation interne du SPA) ;
   *   • l'e-mail, où un chemin relatif n'a AUCUNE page de base pour se résoudre.
   * Dans un e-mail, `href="/liri/rendez-vous"` est lu par le navigateur comme le
   * DOMAINE `liri` suivi du chemin `/rendez-vous` → `ERR_NAME_NOT_RESOLVED`.
   * Aggravant : Resend réécrit le lien pour son suivi de clics
   * (`…resend-clicks-a.com/CL0/%2Fliri%2Frendez-vous/…`), servi en HTTP — le
   * destinataire voit d'abord un avertissement « site non sécurisé », puis une
   * page d'erreur. Un lien mort qui a l'air d'une alerte de sécurité.
   *
   * On normalise ICI, au seul point où l'URL part par e-mail, et PAS à la source :
   * les 7 `actionUrl` relatifs du module rendez-vous doivent rester relatifs pour
   * la cloche. Corriger les appelants aurait cassé la navigation in-app, et le
   * 8e ajouté demain serait reparti cassé.
   */
  private static lienAbsolu(url?: string | null): string | undefined {
    const u = String(url ?? '').trim();
    if (!u) return undefined;
    if (/^https?:\/\//i.test(u)) return u;           // déjà absolu — on ne touche pas
    if (/^mailto:|^tel:/i.test(u)) return u;         // schémas légitimes en e-mail
    const base = (process.env.FRONTEND_URL || 'https://app.cimolace.space').replace(/\/$/, '');
    return `${base}/${u.replace(/^\/+/, '')}`;
  }
}
