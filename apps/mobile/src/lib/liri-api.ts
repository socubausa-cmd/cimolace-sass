import { Platform } from 'react-native';
import EventSource from 'react-native-sse';

import { supabase } from '@/lib/supabase';

/**
 * Client LIRI Brain (mobile). Transport SSE cross-platform :
 *  - Web (react-native-web) : fetch + ReadableStream (comme le chat web).
 *  - Natif (iOS/Android)    : react-native-sse (EventSource avec headers custom).
 *
 * Config via env publiques Expo (EXPO_PUBLIC_*). L'auth réelle (Supabase) viendra ;
 * en attendant, EXPO_PUBLIC_DEV_TOKEN permet de tester contre l'API.
 */
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4002').replace(/\/+$/, '');
export const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'isna';
export const DEV_TOKEN = process.env.EXPO_PUBLIC_DEV_TOKEN ?? '';
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/** UUID du tenant ISNA — même valeur que le web (tenants/isna/tenant.config). */
export const ISNA_TENANT_ID =
  process.env.EXPO_PUBLIC_TENANT_ID ?? '4f6faaa8-43a0-46d6-b98a-99ea1154f9ea';
let activeTenantId = ISNA_TENANT_ID;
export const setActiveTenantId = (tenantId: string | null | undefined) => {
  activeTenantId = tenantId || ISNA_TENANT_ID;
};
export const getActiveTenantId = () => activeTenantId;

// Token de session — mis à jour par AuthProvider à chaque changement de session.
let sessionToken: string | null = null;
export function setAuthToken(token: string | null) {
  sessionToken = token;
}
/** Token courant : session Supabase si connectée, sinon DEV_TOKEN (test). */
export const currentToken = () => sessionToken ?? DEV_TOKEN;
export const hasToken = () => currentToken().length > 0;

const authHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  'X-Tenant-Slug': TENANT_SLUG,
});

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface BrainHandlers {
  onToken: (delta: string) => void;
  onToolConfirm?: (payload: unknown) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/** Stream une réponse LIRI Brain. Retourne une fonction d'annulation. */
export function streamBrain(
  opts: { message: string; conversationId?: string; model?: string; token?: string },
  h: BrainHandlers,
): () => void {
  const token = opts.token ?? currentToken();
  const model = opts.model ?? DEFAULT_MODEL;
  const qs = new URLSearchParams({ message: opts.message, model, tools: '1' });
  if (opts.conversationId) qs.set('conversationId', opts.conversationId);
  const url = `${API_BASE}/liri/brain/chat?${qs.toString()}`;
  const headers = authHeaders(token);

  // Renvoie true quand le flux est terminé (done).
  const consume = (raw: string | null | undefined): boolean => {
    if (!raw) return false;
    let obj: { content?: string; done?: boolean };
    try {
      obj = JSON.parse(raw);
    } catch {
      return false;
    }
    if (obj.content) {
      let confirm: { type?: string } | null = null;
      try {
        const inner = JSON.parse(obj.content);
        if (inner && inner.type === 'tool_confirm') confirm = inner;
      } catch {
        /* contenu texte normal */
      }
      if (confirm) h.onToolConfirm?.(confirm);
      else h.onToken(obj.content);
    }
    if (obj.done) {
      h.onDone();
      return true;
    }
    return false;
  };

  // ── Web : fetch streaming ──
  if (Platform.OS === 'web') {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch(url, { headers, signal: ctrl.signal });
        if (!res.ok || !res.body) {
          h.onError(`HTTP ${res.status}`);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buf.indexOf('\n\n')) >= 0) {
            const evt = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            const data = evt
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(l.indexOf(':') + 1).trim())
              .join('');
            if (consume(data)) {
              ctrl.abort();
              return;
            }
          }
        }
        h.onDone();
      } catch (e) {
        const err = e as { name?: string; message?: string };
        if (err?.name !== 'AbortError') h.onError(String(err?.message ?? e));
      }
    })();
    return () => ctrl.abort();
  }

  // ── Natif : react-native-sse ──
  const es = new EventSource(url, { headers, method: 'GET' });
  const close = () => {
    try {
      es.removeAllEventListeners();
      es.close();
    } catch {
      /* noop */
    }
  };
  es.addEventListener('message', (event) => {
    if (consume((event as { data?: string }).data)) close();
  });
  es.addEventListener('error', (event) => {
    h.onError((event as { message?: string }).message ?? 'Connexion interrompue');
    close();
  });
  return close;
}

/** Persiste le transcript (mémoire entre tours). Retourne l'id de conversation. */
export async function saveConversation(opts: {
  conversationId?: string;
  model?: string;
  title?: string;
  messages: ChatMsg[];
  token?: string;
}): Promise<string | undefined> {
  const token = opts.token ?? currentToken();
  try {
    const res = await fetch(`${API_BASE}/liri/brain/conversations`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: opts.conversationId,
        model: opts.model ?? DEFAULT_MODEL,
        title: opts.title ?? '',
        messages: opts.messages,
      }),
    });
    if (!res.ok) return opts.conversationId;
    const json: unknown = await res.json();
    const data = (json as { data?: { id?: string }; id?: string })?.data ?? (json as { id?: string });
    return data?.id ?? opts.conversationId;
  } catch {
    return opts.conversationId;
  }
}

// ── Données Accueil ─────────────────────────────────────────────────────────
export interface Stats {
  totalMembers: number;
  totalLives: number;
  totalCourses: number;
  totalRevenueCents: number;
}
export interface Live {
  id: string;
  title?: string;
  status?: string;
  scheduled_at?: string;
  started_at?: string | null;
  ended_at?: string | null;
  price_cents?: number;
}

async function getJson<T>(path: string): Promise<T | null> {
  const token = currentToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders(token) });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return ((json as { data?: T })?.data ?? (json as T)) ?? null;
  } catch {
    return null;
  }
}

export const fetchStats = () => getJson<Stats>('/growth/stats');

export async function fetchLives(): Promise<Live[]> {
  // L'API renvoie {data:{data:[...]}} (ResponseInterceptor + pagination du contrôleur).
  // getJson déballe un niveau → il reste {data:[...]} ; on déballe le second.
  const raw = await getJson<{ data?: Live[] } | Live[]>('/lives');
  if (Array.isArray(raw)) return raw;
  const inner = (raw as { data?: Live[] } | null)?.data;
  return Array.isArray(inner) ? inner : [];
}

// ── Lancement / diffusion de live (LiveKit natif) ───────────────────────────
/**
 * URL WebSocket du serveur LiveKit. Pattern repo : le CLIENT fournit l'URL
 * (le web lit VITE_LIVEKIT_URL), l'API n'émet que le token. Même projet
 * LiveKit pour tous les tenants — les rooms sont scopées par nom côté serveur.
 */
export const LIVEKIT_URL =
  process.env.EXPO_PUBLIC_LIVEKIT_URL ?? 'wss://cimolace-yis8vna7.livekit.cloud';

export interface LiveToken {
  token: string;
  room: string;
  role: string;
  userId: string;
}

/** POST authentifié déballant l'enveloppe {data:…}. Renvoie null sur échec. */
export async function postJson<T>(path: string, body?: unknown): Promise<T | null> {
  const token = currentToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return ((json as { data?: T })?.data ?? (json as T)) ?? null;
  } catch {
    return null;
  }
}

/** Crée une session live (status = scheduled). */
export function createLive(input: { title?: string; scheduled_at?: string } = {}): Promise<Live | null> {
  return postJson<Live>('/lives', {
    title: input.title ?? 'Live LIRI',
    scheduled_at: input.scheduled_at ?? new Date().toISOString(),
  });
}

/** Passe la session « en direct » (status = live + started_at). */
export function startLive(id: string): Promise<Live | null> {
  return postJson<Live>(`/lives/${id}/start`);
}

/** Termine la session (status = ended + ended_at). */
export function endLive(id: string): Promise<Live | null> {
  return postJson<Live>(`/lives/${id}/end`);
}

export interface RecordingResult {
  egressId?: string | null;
  recording_active?: boolean;
  stopped?: boolean;
}

/** Démarre l'enregistrement (LiveKit Egress → MP4 + replay). */
export function startRecording(id: string): Promise<RecordingResult | null> {
  return postJson<RecordingResult>(`/lives/${id}/recording/start`);
}

/** Arrête l'enregistrement en cours. */
export function stopRecording(id: string): Promise<RecordingResult | null> {
  return postJson<RecordingResult>(`/lives/${id}/recording/stop`);
}

/**
 * Récupère un token LiveKit pour la room de la session.
 *  - role 'host'    → diffuseur (caméra + micro + admin)
 *  - role 'student' → spectateur (abonnement seul)
 */
export function fetchLiveToken(id: string, role: 'host' | 'student'): Promise<LiveToken | null> {
  return postJson<LiveToken>(`/lives/${id}/token`, { role });
}

export interface SmartboardDeckSummary {
  id: string;
  title?: string;
  status?: string;
  created_at?: string;
}

/**
 * Liste les decks smartboard générés du tenant (table `smartboard_decks`), pour
 * choisir lequel diffuser au lancement d'un live. RLS : visible une fois
 * connecté. [] si vide / inaccessible.
 */
export async function fetchSmartboardDecks(): Promise<SmartboardDeckSummary[]> {
  try {
    const { data, error } = await supabase
      .from('smartboard_decks')
      .select('id, title, status, created_at')
      .eq('tenant_id', getActiveTenantId())
      .order('created_at', { ascending: false })
      .limit(30);
    if (error || !data) return [];
    return data as SmartboardDeckSummary[];
  } catch {
    return [];
  }
}

/**
 * Deck smartboard lié à une session (colonne `live_sessions.smartboard_deck_id`).
 * Lecture DÉFENSIVE : si la colonne n'existe pas encore (migration non appliquée)
 * ou aucune valeur, renvoie null → l'appelant retombe sur le deck d'exemple.
 * Permet de rendre le deck automatique sans paramètre d'URL une fois la session
 * créée depuis une masterclass générée.
 */
/**
 * Lie un deck à une session (écrit `live_sessions.smartboard_deck_id`) pour que
 * l'élève le retrouve via fetchSessionDeckId. DÉFENSIF : si la colonne n'existe
 * pas / pas les droits, l'erreur est avalée (le host garde le param `?deck=`).
 */
export async function linkSessionDeck(sessionId: string, deckId: string): Promise<void> {
  if (!sessionId || !deckId) return;
  try {
    await supabase.from('live_sessions').update({ smartboard_deck_id: deckId }).eq('id', sessionId);
  } catch {
    /* colonne absente / RLS → ignore */
  }
}

export async function fetchSessionDeckId(sessionId: string): Promise<string | null> {
  if (!sessionId) return null;
  try {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('smartboard_deck_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (error || !data) return null;
    const id = (data as { smartboard_deck_id?: string | null }).smartboard_deck_id;
    return id ?? null;
  } catch {
    return null;
  }
}

/**
 * Création + passage en direct en un appel — pour le bouton « Démarrer ».
 * Renvoie la session (déjà en direct) ou null si l'une des étapes échoue.
 */
export async function quickStartLive(title?: string): Promise<Live | null> {
  const created = await createLive(title ? { title } : {});
  if (!created?.id) return null;
  const live = await startLive(created.id);
  return live ?? created;
}

/** Déballe une liste éventuellement enveloppée ({data:[…]} ou […]). */
function asArray<T>(raw: { data?: T[] } | T[] | null): T[] {
  if (Array.isArray(raw)) return raw;
  const inner = (raw as { data?: T[] } | null)?.data;
  return Array.isArray(inner) ? inner : [];
}

// ── Forum ─────────────────────────────────────────────────────────────────
export interface ForumTopic {
  id: string;
  title?: string;
  content?: string;
  category?: string;
  created_at?: string;
  last_post_at?: string | null;
  replies_count?: number;
  is_locked?: boolean;
  is_pinned?: boolean;
}

/**
 * Discussions du forum — lues DIRECTEMENT depuis Supabase (table forum_topics),
 * exactement comme le portail web (hooks/useLiriForumFeed.js). Web + mobile
 * partagent ainsi la MÊME source : toute discussion créée d'un côté apparaît
 * de l'autre. Filtré par tenant_id ISNA. Retourne [] si vide/inaccessible.
 */
export async function fetchForumTopics(): Promise<ForumTopic[]> {
  const { data, error } = await supabase
    .from('forum_topics')
    .select('id, title, category, created_at, last_post_at, replies_count, is_locked, is_pinned')
    .eq('tenant_id', getActiveTenantId())
    .eq('is_locked', false)
    .order('last_post_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data as ForumTopic[];
}

// ── Bibliothèque / Replays ─────────────────────────────────────────────────
export interface Replay {
  id: string;
  title?: string;
  status?: string;
  scheduled_at?: string;
  created_at?: string;
}

/**
 * Replays — sessions live terminées avec replay activé, lues DIRECTEMENT depuis
 * Supabase (table live_sessions), comme le web. Filtré tenant ISNA. RLS : visible
 * une fois connecté (membre du tenant). [] sinon.
 */
export async function fetchReplays(): Promise<Replay[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('id, title, status, scheduled_at, created_at')
    .eq('tenant_id', getActiveTenantId())
    .eq('replay_enabled', true)
    .order('scheduled_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data as Replay[];
}

// ── Intégrations / Clés API ─────────────────────────────────────────────────
export interface ApiKey {
  id: string;
  key_id?: string;
  name?: string;
  prefix?: string;
  masked?: string;
  created_at?: string;
  last_used_at?: string | null;
  environment?: string;
}

/** GET /tenants/api-keys — clés API du tenant. */
export async function fetchApiKeys(): Promise<ApiKey[]> {
  return asArray(await getJson<{ data?: ApiKey[] } | ApiKey[]>('/tenants/api-keys'));
}

// ── Formations / Cours ──────────────────────────────────────────────────────
export interface Course {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  status?: string;
  price_cents?: number;
  created_at?: string;
}

/** GET /courses — formations du tenant (token requis). */
export async function fetchCourses(): Promise<Course[]> {
  return asArray(await getJson<{ data?: Course[] } | Course[]>('/courses'));
}

/** POST /courses — crée une formation (brouillon). Rôle teacher+ requis. */
export function createCourse(input: {
  title: string;
  description?: string;
  category?: string;
  priceCents?: number;
}): Promise<Course | null> {
  return postJson<Course>('/courses', {
    title: input.title,
    description: input.description ?? '',
    category: input.category ?? 'general',
    ...(input.priceCents != null ? { priceCents: input.priceCents } : {}),
  });
}

// ── Curriculum : modules (chapitres) + leçons ───────────────────────────────
export interface CourseModule {
  id: string;
  title?: string;
  description?: string;
  order_index?: number;
}
export interface CourseLesson {
  id: string;
  title?: string;
  content?: string;
  video_url?: string;
  order_index?: number;
}

/** POST /courses/:courseId/modules — ajoute un chapitre. */
export function createModule(
  courseId: string,
  input: { title: string; description?: string; orderIndex: number },
): Promise<CourseModule | null> {
  return postJson<CourseModule>(`/courses/${courseId}/modules`, {
    title: input.title,
    description: input.description ?? '',
    orderIndex: input.orderIndex,
  });
}

/** POST /courses/modules/:moduleId/lessons — ajoute une leçon. */
export function createLesson(
  moduleId: string,
  input: { title: string; content?: string; videoUrl?: string; orderIndex: number },
): Promise<CourseLesson | null> {
  return postJson<CourseLesson>(`/courses/modules/${moduleId}/lessons`, {
    title: input.title,
    content: input.content ?? '',
    videoUrl: input.videoUrl ?? '',
    orderIndex: input.orderIndex,
  });
}

/** Leçon en cours d'édition côté UI (avant publication). */
export interface DraftLesson {
  title: string;
  kind: 'video' | 'text' | 'quiz';
  content?: string;
  videoUrl?: string;
}
export interface DraftModule {
  title: string;
  lessons: DraftLesson[];
}

/** Résultat de publication d'un curriculum complet. */
export interface CurriculumResult {
  course: Course;
  modules: number;
  lessons: number;
}

const relUuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const inferVideoType = (url?: string): string => {
  const u = String(url ?? '').trim();
  if (!u) return 'custom_url';
  if (/youtu\.be|youtube\.com/i.test(u)) return 'youtube';
  if (/vimeo\.com/i.test(u)) return 'vimeo';
  return 'custom_url';
};

const relToHtml = (s?: string): string => {
  const t = String(s ?? '').trim();
  if (!t) return '';
  return t.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
};

/**
 * Écrit la structure d'un cours dans les VRAIES tables relationnelles
 * (modules → formation_weeks → formation_days → formation_day_contents), la MÊME cible que le web
 * (`saveStructure`/`usePublishToClassroom`). Un DraftModule → un module (+ 1 semaine) ; une DraftLesson
 * → un jour + un content (vidéo | support). Ainsi un cours créé sur mobile est visible dans l'OS web
 * `/liri/formations` ET dans le lecteur natif — contrairement à l'ancien chemin course_modules/course_lessons.
 */
async function saveFormationStructureNative(
  courseId: string,
  modules: DraftModule[],
): Promise<{ modules: number; lessons: number }> {
  const modulesInsert: Record<string, unknown>[] = [];
  const weeksInsert: Record<string, unknown>[] = [];
  const daysInsert: Record<string, unknown>[] = [];
  const contentsInsert: Record<string, unknown>[] = [];
  let modCount = 0;
  let lessonCount = 0;

  modules.forEach((m, mi) => {
    if (!m.title.trim()) return;
    const moduleId = relUuid();
    modulesInsert.push({ id: moduleId, formation_id: courseId, title: m.title.trim(), description: null, sort_order: mi, status: 'locked' });
    modCount++;
    const weekId = relUuid();
    weeksInsert.push({ id: weekId, module_id: moduleId, title: 'Semaine 1', sort_order: 0 });
    m.lessons.forEach((l, li) => {
      if (!l.title.trim()) return;
      const dayId = relUuid();
      daysInsert.push({ id: dayId, week_id: weekId, title: l.title.trim(), sort_order: li });
      if (l.kind === 'video') {
        contentsInsert.push({
          id: relUuid(), day_id: dayId, type: 'video', sort_order: 0,
          data: { url: String(l.videoUrl ?? '').trim(), type: inferVideoType(l.videoUrl), title: l.title.trim() },
        });
      } else {
        // text & quiz → support (slide) : le contenu reste lisible dans l'OS web comme dans le natif.
        const slideTitle = l.kind === 'quiz' ? `Quiz — ${l.title.trim()}` : l.title.trim();
        contentsInsert.push({
          id: relUuid(), day_id: dayId, type: 'powerpoint', sort_order: 0,
          data: { type: 'slides', title: slideTitle, slides: [{ title: slideTitle, content: relToHtml(l.content) }] },
        });
      }
      lessonCount++;
    });
  });

  if (modulesInsert.length) { const { error } = await supabase.from('modules').insert(modulesInsert); if (error) throw new Error(error.message); }
  if (weeksInsert.length) { const { error } = await supabase.from('formation_weeks').insert(weeksInsert); if (error) throw new Error(error.message); }
  if (daysInsert.length) { const { error } = await supabase.from('formation_days').insert(daysInsert); if (error) throw new Error(error.message); }
  if (contentsInsert.length) { const { error } = await supabase.from('formation_day_contents').insert(contentsInsert); if (error) throw new Error(error.message); }

  return { modules: modCount, lessons: lessonCount };
}

/**
 * Publie une formation COMPLÈTE : crée le cours (ligne `courses`), puis persiste la structure dans
 * les VRAIES tables relationnelles via {@link saveFormationStructureNative} — visible dans l'OS web
 * ET le lecteur natif. Renvoie le compte créé, ou null si la création du cours échoue.
 */
export async function publishCurriculum(input: {
  title: string;
  description?: string;
  category?: string;
  priceCents?: number;
  modules: DraftModule[];
  onProgress?: (msg: string) => void;
}): Promise<CurriculumResult | null> {
  input.onProgress?.('Création de la formation…');
  const course = await createCourse({
    title: input.title,
    description: input.description,
    category: input.category,
    priceCents: input.priceCents,
  });
  if (!course?.id) return null;

  input.onProgress?.('Publication du programme…');
  const { modules, lessons } = await saveFormationStructureNative(course.id, input.modules);
  return { course, modules, lessons };
}

// ── Masterclass Factory (génération IA) ─────────────────────────────────────
export interface MasterclassResult {
  id?: string;
  title?: string;
  description?: string;
  modules?: { title?: string; lessons?: { title?: string }[] }[];
}

/** POST /masterclass-factory/generate — génère une masterclass depuis un texte. */
export function generateMasterclass(input: {
  title: string;
  sourceText: string;
}): Promise<MasterclassResult | null> {
  return postJson<MasterclassResult>('/masterclass-factory/generate', {
    title: input.title,
    sourceText: input.sourceText,
  });
}

// ── Création d'une discussion forum ─────────────────────────────────────────
/** POST /forum/topics — crée une discussion (token requis). */
export function createForumTopic(input: {
  title: string;
  content: string;
  category?: string;
}): Promise<ForumTopic | null> {
  return postJson<ForumTopic>('/forum/topics', {
    title: input.title,
    content: input.content,
    category: input.category ?? 'general',
  });
}

// ── Notifications ───────────────────────────────────────────────────────────
// Lues DIRECTEMENT depuis Supabase (table `notifications`), comme le web
// (components/notifications/NotificationDropdown.jsx). Mêmes colonnes, même RLS.
export interface AppNotification {
  id: string;
  title?: string | null;
  body?: string | null;
  channel?: string | null;
  data?: Record<string, unknown> | null;
  is_read?: boolean | null;
  created_at?: string | null;
  /** Compatibilité UI : dérivé de `body`. */
  message?: string | null;
  /** Compatibilité UI : dérivé de `data.type` ou `channel`. */
  type?: string | null;
  /** Compatibilité UI : dérivé de `data.action_url`. */
  action_url?: string | null;
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('id,user_id,tenant_id,title,body,channel,data,is_read,created_at')
    .eq('user_id', uid)
    .eq('tenant_id', getActiveTenantId())
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as Omit<AppNotification, 'message' | 'type' | 'action_url'>[]).map((row) => {
    const payload = row.data && typeof row.data === 'object' ? row.data : {};
    return {
      ...row,
      message: row.body ?? null,
      type: typeof payload.type === 'string' ? payload.type : row.channel ?? null,
      action_url: typeof payload.action_url === 'string' ? payload.action_url : null,
    };
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', uid)
    .eq('tenant_id', getActiveTenantId());
}

export async function markAllNotificationsRead(): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', uid)
    .eq('tenant_id', getActiveTenantId())
    .eq('is_read', false);
}

/** Id de l'utilisateur connecté (ou null). */
export const myUserId = currentUserId;

// ── Messagerie (DM 1-1) ─────────────────────────────────────────────────────
// En production, `messages` est protégé service_role et suit le modèle
// conversation_id + recipient_id. Le mobile passe donc par `/messaging/*`,
// exactement comme le web, puis normalise recipient_id → receiver_id.
export interface AppMessage {
  id: string;
  conversation_id?: string | null;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read?: boolean | null;
  created_at: string;
}
export interface AppConversation {
  conversationId: string;
  otherId: string;
  name: string;
  avatarUrl?: string | null;
  lastContent: string;
  lastAt: string;
  unread: number;
}

interface ApiConversation {
  id: string;
  updated_at?: string;
}

interface ApiMessage {
  id: string;
  conversation_id?: string | null;
  sender_id: string;
  recipient_id?: string | null;
  receiver_id?: string | null;
  content: string;
  is_read?: boolean | null;
  created_at: string;
}

const normalizeApiMessage = (row: ApiMessage): AppMessage => ({
  id: row.id,
  conversation_id: row.conversation_id ?? null,
  sender_id: row.sender_id,
  receiver_id: row.recipient_id ?? row.receiver_id ?? '',
  content: row.content,
  is_read: row.is_read ?? false,
  created_at: row.created_at,
});

let peerConversationIds = new Map<string, string>();

async function fetchAllMessagingRows(uid: string): Promise<AppMessage[]> {
  const conversations = (await getJson<ApiConversation[]>('/messaging/conversations')) ?? [];
  const perConversation = await Promise.all(
    conversations.map(async (conversation) => {
      const rows = (await getJson<ApiMessage[]>(`/messaging/conversations/${conversation.id}`)) ?? [];
      return rows.map(normalizeApiMessage);
    }),
  );
  const rows = perConversation.flat();
  const mapping = new Map<string, string>();
  for (const row of rows) {
    const otherId = row.sender_id === uid ? row.receiver_id : row.sender_id;
    if (otherId && row.conversation_id) mapping.set(otherId, row.conversation_id);
  }
  peerConversationIds = mapping;
  return rows;
}

export async function fetchConversations(): Promise<AppConversation[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const rows = await fetchAllMessagingRows(uid);
  const map = new Map<string, AppConversation>();
  for (const m of [...rows].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))) {
    const other = m.sender_id === uid ? m.receiver_id : m.sender_id;
    if (!other) continue;
    let conv = map.get(other);
    if (!conv) {
      conv = {
        conversationId: m.conversation_id ?? '',
        otherId: other,
        name: 'Membre',
        lastContent: m.content,
        lastAt: m.created_at,
        unread: 0,
      };
      map.set(other, conv);
    }
    if (!m.is_read && m.receiver_id === uid) conv.unread += 1;
  }
  const ids = [...map.keys()];
  if (ids.length) {
    const { data: profs } = await supabase.from('profiles').select('id, name, email, avatar_url').in('id', ids);
    for (const p of (profs as { id: string; name?: string; email?: string; avatar_url?: string }[]) ?? []) {
      const c = map.get(p.id);
      if (c) {
        c.name = p.name || p.email?.split('@')[0] || 'Membre';
        c.avatarUrl = p.avatar_url ?? null;
      }
    }
  }
  return [...map.values()].sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));
}

export async function fetchThread(otherId: string): Promise<AppMessage[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  let conversationId = peerConversationIds.get(otherId);
  if (!conversationId) {
    await fetchAllMessagingRows(uid);
    conversationId = peerConversationIds.get(otherId);
  }
  if (!conversationId) return [];
  const rows = (await getJson<ApiMessage[]>(`/messaging/conversations/${conversationId}`)) ?? [];
  await postJson(`/messaging/conversations/${conversationId}/read`, {});
  return rows.map(normalizeApiMessage);
}

export async function sendMessage(receiverId: string, content: string): Promise<AppMessage | null> {
  const uid = await currentUserId();
  if (!uid || !content.trim()) return null;
  const row = await postJson<ApiMessage>('/messaging/send', {
    recipientId: receiverId,
    content: content.trim(),
  });
  if (!row) return null;
  const normalized = normalizeApiMessage({ ...row, recipient_id: row.recipient_id ?? receiverId });
  if (normalized.conversation_id) peerConversationIds.set(receiverId, normalized.conversation_id);
  return normalized;
}

// ── Paiement Mobile Money (PawaPay, natif) ──────────────────────────────────
/**
 * Opérateur Mobile Money. Le code `provider` et le `country` (ISO alpha-3) sont
 * envoyés tels quels à l'API → PawaPay (cf. CreateOfferingDepositDto). Catalogue
 * embarqué pour les pays pilotes (robuste hors-ligne / sans token PawaPay en dev).
 */
export interface MobileMoneyProvider {
  code: string; // ex: 'MTN_MOMO_CMR'
  label: string; // ex: 'MTN MoMo'
  country: string; // ISO 3166-1 alpha-3, ex: 'CMR'
  countryLabel: string;
  currency: string; // ex: 'XAF'
  dialCode: string; // ex: '+237'
  color: string;
}

export const MOBILE_MONEY_PROVIDERS: MobileMoneyProvider[] = [
  { code: 'MTN_MOMO_CMR', label: 'MTN MoMo', country: 'CMR', countryLabel: 'Cameroun', currency: 'XAF', dialCode: '+237', color: '#FFCC00' },
  { code: 'ORANGE_CMR', label: 'Orange Money', country: 'CMR', countryLabel: 'Cameroun', currency: 'XAF', dialCode: '+237', color: '#FF6600' },
  { code: 'MTN_MOMO_GAB', label: 'MTN MoMo', country: 'GAB', countryLabel: 'Gabon', currency: 'XAF', dialCode: '+241', color: '#FFCC00' },
  { code: 'AIRTEL_GAB', label: 'Airtel Money', country: 'GAB', countryLabel: 'Gabon', currency: 'XAF', dialCode: '+241', color: '#E4002B' },
  { code: 'ORANGE_CIV', label: 'Orange Money', country: 'CIV', countryLabel: "Côte d'Ivoire", currency: 'XOF', dialCode: '+225', color: '#FF6600' },
  { code: 'MTN_MOMO_CIV', label: 'MTN MoMo', country: 'CIV', countryLabel: "Côte d'Ivoire", currency: 'XOF', dialCode: '+225', color: '#FFCC00' },
  { code: 'MTN_MOMO_RWA', label: 'MTN MoMo', country: 'RWA', countryLabel: 'Rwanda', currency: 'RWF', dialCode: '+250', color: '#FFCC00' },
  { code: 'ORANGE_SEN', label: 'Orange Money', country: 'SEN', countryLabel: 'Sénégal', currency: 'XOF', dialCode: '+221', color: '#FF6600' },
];

export type OfferingKind = 'subscription' | 'consultation' | 'donation';

export interface DepositResult {
  depositId: string;
  status: string;
  amountCents?: number;
  currency?: string;
}

export interface DepositStatus {
  depositId: string;
  status: string;
  isCompleted: boolean;
}

/**
 * Lance un dépôt Mobile Money (PawaPay). `kind` :
 *  - 'subscription' → planSlug requis (montant lu côté serveur)
 *  - 'consultation' | 'donation' → amountCents requis
 * Renvoie { depositId, status } → l'utilisateur valide sur son téléphone, puis on
 * interroge le statut via pollDepositStatus.
 */
export function createMobileMoneyDeposit(input: {
  kind: OfferingKind;
  phoneNumber: string;
  provider: string;
  country: string;
  planSlug?: string;
  amountCents?: number;
}): Promise<DepositResult | null> {
  return postJson<DepositResult>('/offering-checkout/mobile-money', input);
}

/** Statut ponctuel d'un dépôt Mobile Money. */
export function fetchDepositStatus(depositId: string): Promise<DepositStatus | null> {
  return getJson<DepositStatus>(`/offering-checkout/mobile-money/${depositId}/status`);
}

/**
 * Interroge le statut jusqu'à complétion / échec / timeout. `onTick` reçoit
 * chaque statut intermédiaire (PENDING…). Renvoie le statut final.
 */
export async function pollDepositStatus(
  depositId: string,
  opts: { intervalMs?: number; timeoutMs?: number; onTick?: (s: DepositStatus) => void } = {},
): Promise<DepositStatus | null> {
  const interval = opts.intervalMs ?? 3000;
  const timeout = opts.timeoutMs ?? 90000;
  const start = Date.now();
  while (true) {
    const s = await fetchDepositStatus(depositId);
    if (s) {
      opts.onTick?.(s);
      if (s.isCompleted || /COMPLETED|FAILED|REJECTED|CANCELLED/i.test(s.status)) return s;
    }
    if (Date.now() - start > timeout) return s ?? null;
    await new Promise((r) => setTimeout(r, interval));
  }
}
