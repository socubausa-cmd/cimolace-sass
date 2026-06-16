// Lightweight typed API client for the patient portal.
// Keeps auth + tenant headers consistent across pages.

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('supabase_token') || '';
  const slug = localStorage.getItem('tenant_slug') || '';
  return {
    Authorization: 'Bearer ' + t,
    'X-Tenant-Slug': slug,
  };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { headers: authHeaders() });
  if (!res.ok) {
    let msg = 'Erreur ' + res.status;
    try {
      const body = await res.json();
      msg = body?.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const j = await res.json();
  // L'API enveloppe les réponses dans { data: ... } (ResponseInterceptor) ;
  // on dé-enveloppe comme le font les autres pages du portail (d.data || d).
  return ((j && typeof j === 'object' && 'data' in j ? j.data : j)) as T;
}

// Erreur typée pour distinguer le 503 « assistant indisponible » du reste.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = 'Erreur ' + res.status;
    try {
      const b = await res.json();
      msg = b?.message || msg;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, msg);
  }
  const j = await res.json();
  // L'API enveloppe les réponses dans { data: ... } (ResponseInterceptor) ;
  // on dé-enveloppe comme le font les autres pages du portail (d.data || d).
  return ((j && typeof j === 'object' && 'data' in j ? j.data : j)) as T;
}

// ── Formulaires assignés — « À remplir » côté patient ─────────────────
// Le praticien peut assigner un formulaire précis au patient ; la liste
// ci-dessous ne renvoie que les assignations actives (statut `pending`,
// les `cancelled` étant exclues côté serveur). Le patient est résolu
// server-side via son JWT + X-Tenant-Slug (aucun id envoyé).
export type FormAssignment = {
  id: string;
  form_id: string;
  form_title: string;
  form_description?: string | null;
  status: string;
  assigned_at: string;
};

// ── Bio Digital Twin — vue patient ────────────────────────────────────
export type TwinOrganScore = {
  organ_code: string;
  label: string;
  score: number | null;
  color: string | null;
};

export type TwinWheelDomain = {
  domain: string;
  score: number | null;
};

export type TwinEvent = {
  id: string;
  event_type: string;
  title: string;
  occurred_at: string;
};

export type TwinAlert = {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  message: string;
  created_at: string;
};

export type MyTwinState = {
  organs_scores: TwinOrganScore[];
  wheel: TwinWheelDomain[];
  events: TwinEvent[];
  alerts: TwinAlert[];
  disclaimer: string;
};

// ── Assistant santé — chat pédagogique patient ────────────────────────
export type AssistantTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantRequest = {
  message: string;
  history?: AssistantTurn[];
};

export type AssistantReply = {
  reply: string;
  disclaimer: string;
  suggestions?: string[];
  escalate?: boolean;
};

// ── Notifications — cloche du portail patient ─────────────────────────
// L'API expose `GET /notifications` (liste de l'utilisateur courant, max 50,
// tri `created_at` desc) et `POST /notifications/:id/read` (marque lu, body
// vide). Les deux routes sont gardées par JwtAuthGuard + TenantGuard : seuls
// les headers `Authorization` + `X-Tenant-Slug` sont requis (déjà posés par
// `authHeaders()`), `user.id` et `tenant.id` sont injectés côté serveur.
// Réponses enveloppées `{ data }` → `getJson`/`postJson` les dé-enveloppent.
export type Notification = {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
};

export const patientApi = {
  getMyTwin(): Promise<MyTwinState> {
    return getJson<MyTwinState>('/med/twin-me/state');
  },

  // GET /notifications — notifications de l'utilisateur courant (résolu via
  // le JWT + X-Tenant-Slug). Dégradation : l'appelant attrape l'erreur et
  // affiche la cloche sans badge plutôt que de crasher.
  getMyNotifications(): Promise<Notification[]> {
    return getJson<Notification[]>('/notifications');
  },

  // POST /notifications/:id/read — marque une notification comme lue (c'est
  // bien un POST côté API, pas un PATCH). Body vide ; renvoie la ligne mise
  // à jour (`read: true`).
  markNotificationRead(id: string): Promise<Notification> {
    return postJson<Notification>(
      `/notifications/${encodeURIComponent(id)}/read`,
      {},
    );
  },

  // GET /med/me/assignments — formulaires assignés au patient (statut
  // `pending`/`completed`, `cancelled` exclus server-side). Renvoie `[]`
  // tant que la table d'assignations n'est pas migrée (jamais 500 côté
  // serveur), ce qui permet à l'appelant de masquer la section sans erreur.
  getMyAssignments(): Promise<FormAssignment[]> {
    return getJson<FormAssignment[]>('/med/me/assignments');
  },

  // POST /med/twin-me/assistant — le patient est résolu côté serveur via le
  // JWT + X-Tenant-Slug (aucun patientId envoyé). `history` est tronqué côté
  // serveur ; on n'envoie que ce qui est utile pour borner les tokens.
  askAssistant(message: string, history: AssistantTurn[] = []): Promise<AssistantReply> {
    const body: AssistantRequest = { message };
    if (history.length > 0) body.history = history;
    return postJson<AssistantReply>('/med/twin-me/assistant', body);
  },
};
