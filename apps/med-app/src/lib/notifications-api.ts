// MEDOS v2 — Notifications · client API (front med-app)
//
// Contrat backend (controller @Controller("notifications"), gardé par
// JwtAuthGuard + TenantGuard) :
//   - GET  /notifications        → { data: Notification[] } (≤50, created_at desc)
//   - POST /notifications/:id/read → { data: <row> }  (⚠ POST, pas PATCH)
//
// `tenant.id` / `user.id` sont injectés par les guards à partir des headers
// (Authorization: Bearer + X-Tenant-Slug) — le front ne les passe jamais dans
// le body. Réponses enveloppées { data } par le ResponseInterceptor → on
// dé-enveloppe ici (unwrap), comme twin/api.ts.

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {
    Authorization: 'Bearer ' + (localStorage.getItem('supabase_token') || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function unwrap(d: any): any {
  return d?.data !== undefined ? d.data : d;
}

/** Type de notification émis par le backend (Events 1/2/3). */
export type NotificationType =
  | 'form_assignment'
  | 'message'
  | 'note_shared'
  | string; // tolérant : un type futur n'empêche pas l'affichage

export type Notification = {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: NotificationType;
  read: boolean;
  created_at: string;
};

export const notificationsApi = {
  /** Liste les notifications de l'utilisateur courant (≤50, plus récentes d'abord). */
  async list(): Promise<Notification[]> {
    const r = await fetch(API + '/notifications', { headers: headers() });
    if (!r.ok) throw new Error(`Erreur ${r.status}`);
    const data = unwrap(await r.json());
    return Array.isArray(data) ? (data as Notification[]) : [];
  },

  /**
   * Marque une notification comme lue. ⚠ C'est un POST (pas un PATCH) côté
   * backend ; body vide. Renvoie la ligne mise à jour.
   */
  async markRead(id: string): Promise<Notification> {
    const r = await fetch(API + `/notifications/${id}/read`, {
      method: 'POST',
      headers: headers(true),
      body: '{}',
    });
    if (!r.ok) throw new Error(`Erreur ${r.status}`);
    return unwrap(await r.json()) as Notification;
  },
};
