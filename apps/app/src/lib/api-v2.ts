/**
 * ISNA V2 — API Client complet
 * 
 * Client unifié pour tous les modules backend NestJS.
 * Remplace les appels supabase.from() directs.
 * 
 * Usage: import { api } from './api-v2'
 */

import axios from 'axios';
import { getApiBaseUrl } from './apiBase';
import { authStore } from './auth-store';

// ── Axios instance ──────────────────────────────────────────────────────────

export const apiV2 = axios.create({ baseURL: getApiBaseUrl() });

apiV2.interceptors.request.use((config) => {
  const token = authStore.getToken();
  const slug = authStore.getTenantSlug();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (slug) config.headers['X-Tenant-Slug'] = slug;
  return config;
});

apiV2.interceptors.response.use(
  (r) => r,
  (err: unknown) => {
    if (axios.isAxiosError(err) && err.response) {
      const data = err.response.data as { error?: { code?: string; message?: string } } | undefined;
      const msg = data?.error?.message ?? err.message;
      return Promise.reject(new Error(msg));
    }
    return Promise.reject(err);
  },
);

// ── Helpers ─────────────────────────────────────────────────────────────────

type ApiEnvelope<T> = { data: T };

function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  return response.data.data;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  me: () => apiV2.get<ApiEnvelope<any>>('/auth/me').then(unwrap),
};

// ── Tenant ──────────────────────────────────────────────────────────────────

/**
 * Une entrée du VOCABULAIRE DE L'ÉCOLE : l'orthographe qui fait foi, les graphies
 * fautives constatées, la nature du terme.
 *
 * ⚠️ LES NOMS DE CHAMPS SONT CEUX DES COLONNES de `public.tenant_glossary` (migration
 * 20260727180000), et ils le restent de la base jusqu'à l'écran. Le worker qui fabrique
 * les extraits lit les mêmes (`apps/worker/src/jobs/short-sous-titres.js`). Traduire
 * les clés en français à cet étage n'aurait acheté qu'une chose : une correspondance de
 * plus à tenir à jour. Le français est dans les LIBELLÉS de l'écran.
 * Le serveur reste seul juge du nettoyage (bornes, dédoublonnage) : ce type décrit la
 * forme, pas les limites.
 */
export interface VocabulaireEntree {
  /** Orthographe qui FAIT AUTORITÉ, celle qui sera affichée en 110 px. Ex. « Cheo ». */
  term: string;
  /** Graphies fautives DÉJÀ CONSTATÉES. Ex. ['Shao']. Peut être vide. */
  variants: string[];
  /** Nature du terme, envoyée au modèle avec lui. Ex. « personne », « lieu ». */
  category: string;
  /** Mémo pour l'humain (« entendu Shao le 12/03 ») — le moteur ne le lit pas. */
  note: string;
  /** false = l'entrée reste listée ici mais ne part plus au moteur. */
  active: boolean;
}

/**
 * Réponse des deux verbes. `indisponible` n'est pas une erreur d'appel : c'est l'aveu
 * que la table n'existe pas encore sur cette base (migrations Cimolace appliquées
 * hors-bande). L'écran doit le DIRE plutôt que d'afficher une liste vide rassurante.
 */
export interface VocabulaireReponse {
  entrees: VocabulaireEntree[];
  indisponible: string | null;
}

export const tenantsApi = {
  create: (body: { name: string; slug: string }) =>
    apiV2.post<ApiEnvelope<any>>('/tenants', body).then(unwrap),
  current: () => apiV2.get<ApiEnvelope<any>>('/tenants/current').then(unwrap),
  updateBranding: (body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>('/tenants/current/branding', body).then(unwrap),
  // Réglages tenant no-code (owner/admin) — ex: requiresStudentDossier (gating KYC).
  updateSettings: (body: { requiresStudentDossier?: boolean; memberDiscounts?: Record<string, number> }) =>
    apiV2.patch<ApiEnvelope<any>>('/tenants/current/settings', body).then(unwrap),
  // Activation self-serve du moteur École (owner/admin) — 402 si aucun abonnement
  // Cimolace actif (essai inclus).
  activateSchool: (active: boolean = true) =>
    apiV2.post<ApiEnvelope<any>>('/tenants/current/services/school/activate', { active }).then(unwrap),
  // KNOWLEDGE PACK OS (owner/admin) — le contenu que l'agent immersif REND (identité,
  // fondateur, offres, comparaison, FAQ…). Lu/écrit depuis tenants.metadata.os_knowledge.
  getOsKnowledge: () =>
    apiV2.get<ApiEnvelope<any>>('/tenants/current/os-knowledge').then(unwrap),
  updateOsKnowledge: (knowledge: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>('/tenants/current/os-knowledge', { knowledge }).then(unwrap),
  // VOCABULAIRE DE L'ÉCOLE (owner/admin) — les noms propres que la transcription
  // automatique écorche. Sert d'AUTORITÉ à la relecture des sous-titres : sans lui, la
  // machine écrit « Shao » et le modèle n'a aucun moyen de savoir qu'il faut lire
  // « Cheo » (ce n'est pas un mot de la langue, c'est le nom de l'orateur).
  // Le serveur renvoie l'objet NU { entrees, indisponible } — une seule enveloppe, pas
  // le double-wrap de /tenants/current.
  getVocabulaire: (): Promise<VocabulaireReponse> =>
    apiV2.get<ApiEnvelope<VocabulaireReponse>>('/tenants/current/vocabulaire').then(unwrap),
  // PUT = remplacement INTÉGRAL : c'est le seul verbe qui sache exprimer une
  // suppression (retirer un nom = envoyer la liste sans lui). La réponse est la liste
  // RELUE EN BASE, pas celle envoyée — l'écran s'aligne dessus sans recharger.
  saveVocabulaire: (entrees: VocabulaireEntree[]): Promise<VocabulaireReponse> =>
    apiV2.put<ApiEnvelope<VocabulaireReponse>>('/tenants/current/vocabulaire', { entrees }).then(unwrap),
  mine: () => apiV2.get<ApiEnvelope<any[]>>('/tenants/mine').then(unwrap),
  dashboard: () => apiV2.get<ApiEnvelope<any>>('/tenants/current/dashboard').then(unwrap),
  listMembers: () => apiV2.get<ApiEnvelope<any[]>>('/tenants/current/members').then(unwrap),
  inviteMember: (email: string, role: string) =>
    apiV2.post<ApiEnvelope<any>>('/tenants/current/members', { email, role }).then(unwrap),
  updateMemberRole: (userId: string, role: string) =>
    apiV2.patch<ApiEnvelope<any>>(`/tenants/current/members/${userId}`, { role }).then(unwrap),
  removeMember: (userId: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/tenants/current/members/${userId}`).then(unwrap),
};

// ── Réseaux sociaux (OAuth + config back-office) ─────────────────────────────
// Endpoints NestJS social-publisher/oauth/*. Le secret n'est jamais renvoyé
// (status = booléens configured/connected). `loose` = tolère l'enveloppe { data }.
const loose = (r: any) => r?.data?.data ?? r?.data;

export interface SocialPlatformStatus {
  platform: 'tiktok' | 'facebook' | 'linkedin';
  configured: boolean;
  connected: boolean;
}

/**
 * Token social RÉELLEMENT stocké (table social_tokens). `page_id` porte l'identifiant
 * SANS LEQUEL la publication échoue côté serveur : Page Facebook pour Meta, URN
 * `urn:li:person:…` pour LinkedIn. Le secret n'est jamais renvoyé.
 */
export interface SocialToken {
  platform: string;
  page_id: string | null;
  page_name: string | null;
  created_at?: string;
}

/**
 * Clip vidéo publiable (short_clips, statut `ready`). ⚠️ `storage_key` est la
 * CONDITION DURE de toute publication : le publieur présigne cette clé R2 puis
 * l'envoie à la plateforme (PULL_FROM_URL / upload d'octets). Sans elle, aucune
 * diffusion n'est possible — une publicité « texte + visuel » n'a pas de chemin.
 */
export interface SocialShortClip {
  id: string;
  title?: string | null;
  storage_key?: string | null;
  duration_sec?: number | null;
  thumbnail_url?: string | null;
}

export const socialApi = {
  status: (): Promise<SocialPlatformStatus[]> =>
    apiV2.get('/social-publisher/oauth/status').then(loose),
  saveConfig: (platform: string, clientId: string, clientSecret: string) =>
    apiV2
      .post(`/social-publisher/oauth/${platform}/config`, { clientId, clientSecret })
      .then(loose),
  authorizeUrl: (platform: string): Promise<{ url: string }> =>
    apiV2.get(`/social-publisher/oauth/${platform}/start`).then(loose),

  // ── Publieur (social_posts / short_clips) ─────────────────────────────────
  // ⚠️ Toutes ces réponses passent par le ResponseInterceptor NestJS : le corps
  // est TOUJOURS { data: … }. `loose` déballe une seule couche et tolère l'absence
  // d'enveloppe — c'est le piège {data:{data}} récurrent du projet.

  /** Comptes connectés, avec page_id/page_name (Page Meta, URN LinkedIn). */
  tokens: (): Promise<SocialToken[]> =>
    apiV2.get('/social-publisher/tokens').then(loose).then((r: any) => (Array.isArray(r) ? r : [])),

  /** Clips prêts à publier. Seuls ceux qui portent un `storage_key` sont diffusables. */
  shorts: (): Promise<SocialShortClip[]> =>
    apiV2.get('/social-publisher/shorts').then(loose).then((r: any) => (Array.isArray(r) ? r : [])),

  /** Brouillon de publication : exige un short_clip_id (UUID) — pas de chemin « texte seul ». */
  createDraft: (body: {
    short_clip_id: string;
    platform: 'tiktok' | 'facebook' | 'instagram' | 'linkedin' | 'youtube_shorts';
    title?: string;
    description?: string;
    hashtags?: string[];
  }): Promise<{ id: string }> => apiV2.post('/social-publisher/draft', body).then(loose),

  /** Envoi RÉEL vers le réseau. Irréversible : à n'appeler que sur action explicite. */
  publish: (
    postId: string,
    platform: 'tiktok' | 'facebook' | 'instagram' | 'linkedin',
  ): Promise<{ success: boolean; message?: string }> =>
    apiV2.post(`/social-publisher/publish/${postId}/${platform}`).then(loose),
};

// ── Lives ───────────────────────────────────────────────────────────────────

export const livesApi = {
  // ⚠️ GET /lives est DOUBLE-enveloppé : le controller renvoie { data: [...] } ET
  // l'interceptor global re-wrappe → unwrap (=r.data.data) rend { data: [...] } (objet),
  // pas un tableau. On extrait toujours le TABLEAU, sinon TenantAdminLivesPage (garde
  // Array.isArray→[]) affiche silencieusement 0 live.
  list: (limit = 20, offset = 0): Promise<any[]> =>
    apiV2.get<ApiEnvelope<{ data?: any[] } | any[]>>(`/lives?limit=${limit}&offset=${offset}`)
      .then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.data ?? []))),
  get: (id: string) => apiV2.get<ApiEnvelope<any>>(`/lives/${id}`).then(unwrap),
  create: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/lives', body).then(unwrap),
  getToken: (id: string) =>
    apiV2.get<ApiEnvelope<{ token: string; roomName: string }>>(`/lives/${id}/token`).then(unwrap),
  // Chat
  sendChat: (id: string, content: string) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/${id}/chat`, { content }).then(unwrap),
  getChat: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/lives/${id}/chat`).then(unwrap),
  // Questions
  askQuestion: (id: string, content: string) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/${id}/questions`, { content }).then(unwrap),
  getQuestions: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/lives/${id}/questions`).then(unwrap),
  answerQuestion: (id: string, qid: string, answer: string) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/${id}/questions/${qid}/answer`, { answer }).then(unwrap),
  // Transcript
  getTranscript: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/lives/${id}/transcript`).then(unwrap),
  // Participants
  getParticipants: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/lives/${id}/participants`).then(unwrap),
  // Scripts
  saveScript: (id: string, sections: unknown[]) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/${id}/scripts`, { sections }).then(unwrap),
  getScript: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/lives/${id}/scripts`).then(unwrap),
  // Waiting room
  getWaitingRoom: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/lives/${id}/waiting-room`).then(unwrap),
  admitToRoom: (id: string, userId: string) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/${id}/waiting-room/admit`, { userId }).then(unwrap),
  // Debate
  createDebate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/lives/debates', body).then(unwrap),
  listDebates: () =>
    apiV2.get<ApiEnvelope<any[]>>('/lives/debates').then(unwrap),
  getDebate: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/lives/debates/${id}`).then(unwrap),
  submitVote: (id: string, side: string) =>
    apiV2.post<ApiEnvelope<any>>(`/lives/debates/${id}/vote`, { side }).then(unwrap),
  getDebateResults: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/lives/debates/${id}/results`).then(unwrap),
};

// ── Checkout ────────────────────────────────────────────────────────────────

export const checkoutApi = {
  createSession: (liveSessionId: string) =>
    apiV2.post<ApiEnvelope<{ checkoutUrl: string }>>('/checkout/sessions', { liveSessionId }).then(unwrap),
  createPawaPay: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/checkout/sessions/pawapay', body).then(unwrap),
  getPawaPayStatus: (depositId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/checkout/sessions/pawapay/${depositId}/status`).then(unwrap),
  getPawaPayProviders: () =>
    apiV2.get<ApiEnvelope<any[]>>('/checkout/pawapay/providers').then(unwrap),
  getStripeConnectOnboarding: (returnUrl?: string) =>
    apiV2.post<ApiEnvelope<{ url: string; accountId: string }>>('/checkout/stripe-connect/onboarding', { return_url: returnUrl }).then(unwrap),
};

// ── Offering checkout (PawaPay) — abonnement mentorat / consultation / offrande ──
export const offeringCheckoutApi = {
  createMobileMoney: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/mobile-money', body).then(unwrap),
  /** Paiement CARTE (Stripe Checkout) → renvoie { checkoutUrl } à ouvrir (redirect). */
  createCard: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/card', body).then(unwrap),
  /** Paiement CARTE intégré (Stripe Payment Element) → renvoie { clientSecret, publishableKey }. */
  createCardIntent: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/card-intent', body).then(unwrap),
  /** Finalise côté backend un paiement carte intégré confirmé par Stripe.js. */
  finalizeEmbedded: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/embedded-finalize', body).then(unwrap),
  /** Paiement PAYPAL → crée un ordre, renvoie { orderId, approveUrl } (redirect vers approveUrl). */
  createPaypal: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/paypal/create-order', body).then(unwrap),
  /** Capture d'un ordre PayPal approuvé (au retour) → { orderId, status, isCompleted }. */
  capturePaypal: (orderId: string) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/paypal/capture', { orderId }).then(unwrap),
  getStatus: (depositId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/offering-checkout/mobile-money/${depositId}/status`).then(unwrap),
  getProviders: (country?: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/offering-checkout/providers${country ? `?country=${encodeURIComponent(country)}` : ''}`).then(unwrap),
  /** Accès GRATUIT (service free/community) → débloque sans paiement, renvoie { ok }. */
  claimFree: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/claim-free', body).then(unwrap),

  // ── INVITÉ (sans compte) : email+nom dans le body ; provisionne le compte serveur ──
  /** INVITÉ — carte : { ...body, tenantSlug, email, first_name?, last_name? } → { checkoutUrl }. */
  guestCard: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/guest-card', body).then(unwrap),
  /** INVITÉ — carte intégrée : { ...body, tenantSlug, email, ... } → Payment Element. */
  guestCardIntent: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/guest-card-intent', body).then(unwrap),
  /** INVITÉ — Mobile Money : { ...body, tenantSlug, email, ... } → dépôt PawaPay. */
  guestMobileMoney: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/guest-mobile-money', body).then(unwrap),
  /** INVITÉ — PayPal : { ...body, tenantSlug, email, ... } → { orderId, approveUrl }. */
  guestPaypal: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/guest-paypal/create-order', body).then(unwrap),
  /** INVITÉ — accès gratuit : { planSlug, tenantSlug, email, first_name?, last_name? } → { ok }. */
  guestClaimFree: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/offering-checkout/guest-claim-free', body).then(unwrap),
};

/** Liens de live configurables (scénario A) — classe rejouable / individuel one-time. */
export const liveJoinApi = {
  /** Animateur/admin : génère les liens d'un live. */
  generate: (sessionId: string, body: { mode: 'class' | 'individual'; count?: number; students?: string[]; expiresAt?: string | null }) =>
    apiV2.post<ApiEnvelope<any>>(`/live-join/${sessionId}/codes`, body).then(unwrap),
  /** Liste les liens existants d'un live. */
  list: (sessionId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/live-join/${sessionId}/codes`).then(unwrap),
  /** Révoque un lien. */
  revoke: (sessionId: string, codeId: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/live-join/${sessionId}/codes/${codeId}`).then(unwrap),
  /** PUBLIC : l'élève échange un code contre un accès salle (token viewer LiveKit). */
  redeem: (body: { code: string; displayName?: string }) =>
    apiV2.post<ApiEnvelope<any>>('/live-join/redeem', body).then(unwrap),
};

/** Codes OTP d'accès élève (L5). */
export const studentInviteApi = {
  /** Owner/admin/secrétariat : génère + envoie un code d'accès à un élève. */
  send: (body: { email: string; role?: string }) =>
    apiV2.post<ApiEnvelope<any>>('/student-invite/send', body).then(unwrap),
  /** PUBLIC : l'élève échange (email + code + mot de passe) contre son accès. */
  redeem: (body: { tenantSlug: string; email: string; code: string; password: string }) =>
    apiV2.post<ApiEnvelope<any>>('/student-invite/redeem', body).then(unwrap),
};

// ── Marketing ───────────────────────────────────────────────────────────────

/**
 * TARIFICATION IA — pilotage PLATEFORME (staff Cimolace uniquement).
 * Aucun prix n'est codé en dur : la grille, les packs de recharge et les quotas
 * par palier se règlent depuis /cimolace/admin/ai-pricing.
 * `gaps` liste les modèles réellement appelés SANS tarif actif — sans lui, une
 * migration de modèle rend la facturation muette (elle compte alors 0 crédit).
 */
export const aiPricingAdminApi = {
  list: () => apiV2.get<ApiEnvelope<any[]>>('/admin/ai-billing/pricing/all').then(unwrap),
  gaps: () => apiV2.get<ApiEnvelope<any[]>>('/admin/ai-billing/pricing/gaps').then(unwrap),
  upsert: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/admin/ai-billing/pricing', body).then(unwrap),
  update: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/admin/ai-billing/pricing/${id}`, body).then(unwrap),
  listPackages: () => apiV2.get<ApiEnvelope<any[]>>('/ai-billing/topup-packages').then(unwrap),
  updatePackage: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/admin/ai-billing/topup-packages/${id}`, body).then(unwrap),
  listPlans: () => apiV2.get<ApiEnvelope<any[]>>('/ai-billing/plans').then(unwrap),
  updatePlan: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/admin/ai-billing/plans/${id}`, body).then(unwrap),
};

export const marketingApi = {
  // Promo codes (endpoint réel = /marketing/promos)
  listPromos: () => apiV2.get<ApiEnvelope<any[]>>('/marketing/promos').then(unwrap),
  createPromo: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/marketing/promos', body).then(unwrap),
  updatePromo: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/marketing/promos/${id}`, body).then(unwrap),
  deletePromo: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/marketing/promos/${id}`).then(unwrap),
  // Popups
  listPopups: () => apiV2.get<ApiEnvelope<any[]>>('/marketing/popups').then(unwrap),
  createPopup: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/marketing/popups', body).then(unwrap),
  updatePopup: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/marketing/popups/${id}`, body).then(unwrap),
  deletePopup: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/marketing/popups/${id}`).then(unwrap),
  // Banners
  listBanners: () => apiV2.get<ApiEnvelope<any[]>>('/marketing/banners').then(unwrap),
  createBanner: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/marketing/banners', body).then(unwrap),
  updateBanner: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/marketing/banners/${id}`, body).then(unwrap),
  deleteBanner: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/marketing/banners/${id}`).then(unwrap),
};

// ── Forum ───────────────────────────────────────────────────────────────────

export const forumApi = {
  listCategories: () => apiV2.get<ApiEnvelope<any[]>>('/forum/categories').then(unwrap),
  listTopics: (params?: Record<string, string>) =>
    apiV2.get<ApiEnvelope<any[]>>('/forum/topics', { params }).then(unwrap),
  searchTopics: (q: string) =>
    apiV2.get<ApiEnvelope<any[]>>('/forum/topics/search', { params: { q } }).then(unwrap),
  getTopic: (id: string) => apiV2.get<ApiEnvelope<any>>(`/forum/topics/${id}`).then(unwrap),
  createTopic: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/forum/topics', body).then(unwrap),
  deleteTopic: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/forum/topics/${id}`).then(unwrap),
  listPosts: (topicId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/forum/topics/${topicId}/posts`).then(unwrap),
  createPost: (topicId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/forum/topics/${topicId}/posts`, body).then(unwrap),
  deletePost: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/forum/posts/${id}`).then(unwrap),
};

// ── Notifications ───────────────────────────────────────────────────────────

export const notificationsApi = {
  list: () => apiV2.get<ApiEnvelope<any[]>>('/notifications').then(unwrap),
  send: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/notifications/send', body).then(unwrap),
  markRead: (id: string) =>
    apiV2.patch<ApiEnvelope<any>>(`/notifications/${id}/read`).then(unwrap),
  getPreferences: () =>
    apiV2.get<ApiEnvelope<any>>('/notifications/preferences').then(unwrap),
  updatePreferences: (body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>('/notifications/preferences', body).then(unwrap),
};

// ── Booking ─────────────────────────────────────────────────────────────────

export const bookingApi = {
  createSlot: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/booking/slots', body).then(unwrap),
  listSlots: (params?: Record<string, string>) =>
    apiV2.get<ApiEnvelope<any[]>>('/booking/slots', { params }).then(unwrap),
  getSlot: (id: string) => apiV2.get<ApiEnvelope<any>>(`/booking/slots/${id}`).then(unwrap),
  deleteSlot: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/booking/slots/${id}`).then(unwrap),
  createAppointment: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/booking/appointments', body).then(unwrap),
  listAppointments: () =>
    apiV2.get<ApiEnvelope<any[]>>('/booking/appointments').then(unwrap),
  getAppointment: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/booking/appointments/${id}`).then(unwrap),
  updateAppointment: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/booking/appointments/${id}`, body).then(unwrap),
  submitFeedback: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/booking/feedback', body).then(unwrap),
  getFeedback: (appointmentId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/booking/feedback/${appointmentId}`).then(unwrap),
};

// ── LIRI Brain ──────────────────────────────────────────────────────────────

export const liriApi = {
  getModels: () => apiV2.get<ApiEnvelope<any[]>>('/liri/brain/models').then(unwrap),
  listConversations: () =>
    apiV2.get<ApiEnvelope<any[]>>('/liri/brain/conversations').then(unwrap),
  getConversation: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/liri/brain/conversations/${id}`).then(unwrap),
  streamChat: (message: string, model: string, conversationId?: string) => {
    const base = getApiBaseUrl();
    const token = authStore.getToken();
    const slug = authStore.getTenantSlug();
    const params = new URLSearchParams({ message, model });
    if (conversationId) params.set('conversationId', conversationId);
    return fetch(`${base}/liri/brain/chat?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': slug,
        Accept: 'text/event-stream',
      },
    });
  },
};

// ── Course Builder ──────────────────────────────────────────────────────────

export const courseBuilderApi = {
  createPipeline: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/pipelines', body).then(unwrap),
  listPipelines: () =>
    apiV2.get<ApiEnvelope<any[]>>('/course-builder/pipelines').then(unwrap),
  autoSegment: (id: string) =>
    apiV2.post<ApiEnvelope<any>>(`/course-builder/pipelines/${id}/segment`).then(unwrap),
  listSegments: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/course-builder/pipelines/${id}/segments`).then(unwrap),
  enqueueRender: (id: string) =>
    apiV2.post<ApiEnvelope<any>>(`/course-builder/pipelines/${id}/render`).then(unwrap),
  getRenderJobs: () =>
    apiV2.get<ApiEnvelope<any[]>>('/course-builder/render-jobs').then(unwrap),
  getRenderStatus: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/course-builder/render-jobs/${id}`).then(unwrap),
  segmentAiGenerate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/segment-ai-generate', body).then(unwrap),
  listSegmentAi: (contentId: string) =>
    apiV2.get<ApiEnvelope<any>>('/course-builder/segment-ai', { params: { contentId } }).then(unwrap),
  segmentAiApprove: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/segment-ai-approve', body).then(unwrap),
  postprodVersionSave: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/postprod-version-save', body).then(unwrap),
  postprodVersionList: (contentId: string) =>
    apiV2.get<ApiEnvelope<any>>('/course-builder/postprod-version-list', { params: { contentId } }).then(unwrap),
  postprodVersionRestore: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/postprod-version-restore', body).then(unwrap),
  pipelineAutoSegment: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/pipeline-auto-segment', body).then(unwrap),
  pipelineMasterScript: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/pipeline-master-script', body).then(unwrap),
  segmentIllustrationRegenerate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/segment-illustration-regenerate', body).then(unwrap),
  renderEnqueue: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/course-builder/render-enqueue', body).then(unwrap),
  renderStatus: (contentId: string) =>
    apiV2.get<ApiEnvelope<any>>('/course-builder/render-status', { params: { contentId } }).then(unwrap),
  /**
   * URL présignée du MONTAGE, pour la LECTURE en classe.
   * À utiliser partout où un ÉLÈVE peut être derrière l'écran : `renderStatus` est
   * réservé à l'encadrement (owner/admin/teacher) et répond 403 à un élève.
   *
   * ⚠️ Cette route n'est PAS ouverte à tout membre du tenant : le montage EST le cours,
   * elle applique donc le MÊME gating que la vidéo source (`POST /courses/:id/video-url`)
   * — forfait actif pour un cours en abonnement, inscription payée pour un cours en
   * vente individuelle. Un 403 ici est une réponse NORMALE (cours non acheté), pas une
   * panne : l'appelant doit le traiter comme « montage indisponible pour cet élève ».
   *
   * Réponse : { url, jobId, storageKey, status } — `url` peut être null (pas encore rendu).
   */
  renderPlayback: (contentId: string) =>
    apiV2.get<ApiEnvelope<any>>('/course-builder/render-playback', { params: { contentId } }).then(unwrap),
};

// ── Rendu post-production : contrat TOLÉRANT sur course_render_jobs ──────────
//
// POURQUOI ces trois helpers plutôt qu'un accès direct aux champs :
//
// 1. La table `course_render_jobs` (migration 20260531000003) n'a QUE les colonnes
//    id / tenant_id / content_id / status / payload / output_url / error / dates.
//    L'UI lisait `output_video_url`, `render_mode`, `error_message`, `manifest_json`
//    — quatre colonnes INEXISTANTES : le bouton « Télécharger MP4 » ne pouvait donc
//    JAMAIS s'afficher et l'échec du worker restait totalement invisible (panne B3).
//
// 2. `output_url` n'est PAS une URL : le worker (apps/worker/src/jobs/courseRender.js,
//    uploadToR2) y stocke la CLÉ R2 d'un bucket PRIVÉ. Elle n'est donc jamais lisible
//    telle quelle — il faut une présignature à la lecture (même motif que
//    replay.service.generatePlaybackUrl). L'API est en train d'être complétée pour
//    renvoyer EN PLUS un `output_video_url` déjà présigné.
//
// 3. Front et API ne sont pas déployés au même instant. On accepte donc les DEUX
//    générations de noms : tant que l'API n'a pas basculé, le front dégrade
//    proprement au lieu d'afficher un lien mort ; dès qu'elle bascule, il fonctionne
//    sans redéploiement du front.

/** Une valeur est-elle une URL réellement ouvrable par le navigateur (≠ clé de stockage) ? */
export const isAbsoluteMediaUrl = (value: unknown): boolean =>
  /^(https?:\/\/|blob:|data:)/i.test(String(value ?? '').trim());

/**
 * URL de LECTURE/TÉLÉCHARGEMENT d'un job de rendu, ou '' si aucune n'est exploitable.
 * Ordre : nouveau nom présigné → variantes de lecture → ancien `output_url` (retenu
 * UNIQUEMENT s'il est déjà absolu, car il contient normalement une clé R2 brute qui,
 * mise dans un <video src>, serait résolue en URL RELATIVE de l'application).
 */
export function renderJobPlayableUrl(job: any): string {
  const candidates = [job?.output_video_url, job?.playback_url, job?.playbackUrl, job?.url, job?.output_url];
  for (const candidate of candidates) {
    if (isAbsoluteMediaUrl(candidate)) return String(candidate).trim();
  }
  return '';
}

/** Clé de stockage R2 du rendu (valeur non-absolue d'`output_url`), ou '' si absente. */
export function renderJobStorageKey(job: any): string {
  const raw = String(job?.output_storage_key ?? job?.storage_key ?? job?.output_url ?? '').trim();
  return raw && !isAbsoluteMediaUrl(raw) ? raw : '';
}

/** Message d'échec du worker, quel que soit le nom de colonne servi par l'API. */
export function renderJobErrorMessage(job: any): string {
  const raw =
    job?.error ??
    job?.error_message ??
    job?.errorMessage ??
    job?.manifest_json?.worker_error ??
    job?.payload?.worker_error ??
    '';
  return String(raw ?? '').trim();
}

// ── Courses ─────────────────────────────────────────────────────────────────

export const coursesApi = {
  create: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/courses', body).then(unwrap),
  list: () => apiV2.get<ApiEnvelope<any[]>>('/courses').then(unwrap),
  get: (id: string) => apiV2.get<ApiEnvelope<any>>(`/courses/${id}`).then(unwrap),
  getFormationStructure: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/courses/${id}/formation-structure`).then(unwrap),
  update: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/courses/${id}`, body).then(unwrap),
  delete: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/courses/${id}`).then(unwrap),
  createModule: (courseId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/courses/${courseId}/modules`, body).then(unwrap),
  listModules: (courseId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/courses/${courseId}/modules`).then(unwrap),
  createLesson: (moduleId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/courses/modules/${moduleId}/lessons`, body).then(unwrap),
  listLessons: (moduleId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/courses/modules/${moduleId}/lessons`).then(unwrap),
  updateProgress: (lessonId: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/courses/progress/${lessonId}`, body).then(unwrap),
  getProgress: (courseId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/courses/${courseId}/progress`).then(unwrap),
};

// ── Messaging ───────────────────────────────────────────────────────────────

export const messagingApi = {
  send: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/messaging/send', body).then(unwrap),
  listConversations: () =>
    apiV2.get<ApiEnvelope<any[]>>('/messaging/conversations').then(unwrap),
  getConversation: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/messaging/conversations/${id}`).then(unwrap),
  createGroup: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/messaging/groups', body).then(unwrap),
  addGroupMember: (groupId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/messaging/groups/${groupId}/members`, body).then(unwrap),
  editMessage: (id: string, content: string) =>
    apiV2.patch<ApiEnvelope<any>>(`/messaging/messages/${id}`, { content }).then(unwrap),
  deleteMessage: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/messaging/messages/${id}`).then(unwrap),
  markRead: (conversationId: string) =>
    apiV2.post<ApiEnvelope<any>>(`/messaging/conversations/${conversationId}/read`, {}).then(unwrap),

  // ── Sujets (topics) — socle « forum connecté » greffé sur la messagerie ──────
  // Type de conversation `kind='topic'` (Phase A). Chemin de données PARALLÈLE au DM :
  // un sujet est un groupe (sans pair fixe) → il ne passe PAS par le regroupement par
  // pair de useRealtimeMessaging. Sous-module backend `messaging/topics`.
  listTopics: (params?: Record<string, string>) =>
    apiV2.get<ApiEnvelope<any[]>>('/messaging/topics', { params }).then(unwrap),
  getTopic: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/messaging/topics/${id}`).then(unwrap),
  getTopicMessages: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/messaging/topics/${id}/messages`).then(unwrap),
  createTopic: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/messaging/topics', body).then(unwrap),
  // Phase C — get-or-create idempotent du Sujet d'un contexte (vidéo de cours).
  // body = { contextType:'video', contextId:<video_id>, courseId:<course_id>, subject?:'…' }
  // Réservé aux inscrits au cours (ou encadrants) : 403 sinon. Renvoie LE Sujet
  // (existant ou créé) que le panneau Questions normalise puis ouvre.
  getOrCreateTopicForContext: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/messaging/topics/for-context', body).then(unwrap),
  // Phase D — consolidation post-live : copie le chat éphémère (live_session_chat)
  // dans le Sujet durable ('live', liveSessionId). body = { liveSessionId, subject? }.
  // RÉSERVÉ aux encadrants (403 sinon). Idempotent. Renvoie { topic, consolidated,
  // alreadyConsolidated }. À déclencher à la fin du live depuis le studio hôte.
  publishLiveTopic: (body: { liveSessionId: string; subject?: string }) =>
    apiV2.post<ApiEnvelope<any>>('/messaging/topics/publish-live', body).then(unwrap),
  sendTopicMessage: (id: string, content: string) =>
    apiV2.post<ApiEnvelope<any>>(`/messaging/topics/${id}/messages`, { content }).then(unwrap),
  closeTopic: (id: string) =>
    apiV2.post<ApiEnvelope<any>>(`/messaging/topics/${id}/close`, {}).then(unwrap),
  reopenTopic: (id: string) =>
    apiV2.post<ApiEnvelope<any>>(`/messaging/topics/${id}/reopen`, {}).then(unwrap),
};

// ── Chat Engine ─────────────────────────────────────────────────────────────

export const chatEngineApi = {
  createRoom: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/chat-engine/rooms', body).then(unwrap),
  listRooms: () => apiV2.get<ApiEnvelope<any[]>>('/chat-engine/rooms').then(unwrap),
  joinRoom: (id: string) =>
    apiV2.post<ApiEnvelope<any>>(`/chat-engine/rooms/${id}/join`).then(unwrap),
  sendMessage: (id: string, content: string) =>
    apiV2.post<ApiEnvelope<any>>(`/chat-engine/rooms/${id}/messages`, { content }).then(unwrap),
  getMessages: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/chat-engine/rooms/${id}/messages`).then(unwrap),
  getOnline: (id: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/chat-engine/rooms/${id}/online`).then(unwrap),
};

// ── MedOS ───────────────────────────────────────────────────────────────────

export const medosApi = {
  // Patients
  listPatients: () => apiV2.get<ApiEnvelope<any[]>>('/med/patients').then(unwrap),
  getPatient: (id: string) => apiV2.get<ApiEnvelope<any>>(`/med/patients/${id}`).then(unwrap),
  createPatient: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/med/patients', body).then(unwrap),
  updatePatient: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/med/patients/${id}`, body).then(unwrap),
  // Notes
  listNotes: (patientId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/med/patients/${patientId}/notes`).then(unwrap),
  createNote: (patientId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/med/patients/${patientId}/notes`, body).then(unwrap),
  updateNote: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/med/notes/${id}`, body).then(unwrap),
  signNote: (id: string) => apiV2.post<ApiEnvelope<any>>(`/med/notes/${id}/sign`).then(unwrap),
  shareNote: (id: string, shared: boolean) =>
    apiV2.post<ApiEnvelope<any>>(`/med/notes/${id}/share`, { is_shared: shared }).then(unwrap),
  // Patient self
  mySharedNotes: () => apiV2.get<ApiEnvelope<any[]>>('/med/me/notes').then(unwrap),
  markNoteRead: (noteId: string) =>
    apiV2.post<ApiEnvelope<any>>(`/med/me/notes/${noteId}/read`).then(unwrap),
  // Forms
  listForms: () => apiV2.get<ApiEnvelope<any[]>>('/med/forms').then(unwrap),
  getForm: (id: string) => apiV2.get<ApiEnvelope<any>>(`/med/forms/${id}`).then(unwrap),
  createForm: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/med/forms', body).then(unwrap),
  submitFormResponse: (formId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/med/forms/${formId}/responses`, body).then(unwrap),
  getFormResponses: (formId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/med/forms/${formId}/responses`).then(unwrap),
  // Health
  createHealthEntry: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/med/health', body).then(unwrap),
  getHealthEntries: (patientId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/med/health/patient/${patientId}`).then(unwrap),
};

// ── Secretariat ─────────────────────────────────────────────────────────────

export const secretariatApi = {
  createEnrollment: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/secretariat/enrollments', body).then(unwrap),
  listEnrollments: () => apiV2.get<ApiEnvelope<any[]>>('/secretariat/enrollments').then(unwrap),
  updateEnrollment: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/secretariat/enrollments/${id}`, body).then(unwrap),
  assignTeacher: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/secretariat/assign-teacher', body).then(unwrap),
  listAssignments: () => apiV2.get<ApiEnvelope<any[]>>('/secretariat/assignments').then(unwrap),
  createDocument: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/secretariat/documents', body).then(unwrap),
  listDocuments: () => apiV2.get<ApiEnvelope<any[]>>('/secretariat/documents').then(unwrap),
  getWorkflow: () => apiV2.get<ApiEnvelope<any[]>>('/secretariat/workflow').then(unwrap),
  updateWorkflow: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/secretariat/workflow/${id}`, body).then(unwrap),
};

// ── Growth ──────────────────────────────────────────────────────────────────

export const growthApi = {
  getStats: () => apiV2.get<ApiEnvelope<any>>('/growth/stats').then(unwrap),
  listLeads: () => apiV2.get<ApiEnvelope<any[]>>('/growth/leads').then(unwrap),
  createLead: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/growth/leads', body).then(unwrap),
  updateLeadScore: (id: string, score: number) =>
    apiV2.patch<ApiEnvelope<any>>(`/growth/leads/${id}/score`, { score }).then(unwrap),
  // Vue 360° d'un contact : identité + fan-out TOUS les moteurs (mbolo/RDV/école/messagerie).
  contact360: (email: string) =>
    apiV2.get<ApiEnvelope<any>>(`/growth/contact-360`, { params: { email } }).then(unwrap),
};

// ── CRM (cœur sales — Vague 2) ────────────────────────────────────────────────
// Le backend enveloppe déjà dans { data }, et unwrap = response.data.data → il reste
// la valeur BRUTE du controller. Or les listes CRM renvoient des OBJETS à clé nommée
// ({ companies:[] }, { contacts:[] }, …), PAS des tableaux : chaque list* extrait donc
// son tableau nommé (piège « enveloppe {data:{clé:[]}} → non-tableau »). board/summary
// = objets voulus (kanban) → NE PAS extraire.
export const crmApi = {
  summary: () => apiV2.get<ApiEnvelope<any>>('/crm/summary').then(unwrap),

  // Timeline d'activités — GET renvoie { activities: [...] } (flux récent ou filtré par entité).
  listActivities: (params?: Record<string, string>): Promise<any[]> =>
    apiV2.get<ApiEnvelope<{ activities?: any[] }>>('/crm/activities', { params }).then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.activities ?? []))),

  listCompanies: (params?: { search?: string; limit?: number; offset?: number }): Promise<any[]> =>
    apiV2.get<ApiEnvelope<{ companies?: any[] }>>('/crm/companies', { params }).then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.companies ?? []))),
  createCompany: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/crm/companies', body).then(unwrap),
  updateCompany: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/crm/companies/${id}`, body).then(unwrap),
  deleteCompany: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/crm/companies/${id}`).then(unwrap),

  listContacts: (params?: Record<string, string>): Promise<any[]> =>
    apiV2.get<ApiEnvelope<{ contacts?: any[] }>>('/crm/contacts', { params }).then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.contacts ?? []))),
  createContact: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/crm/contacts', body).then(unwrap),
  updateContact: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/crm/contacts/${id}`, body).then(unwrap),
  deleteContact: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/crm/contacts/${id}`).then(unwrap),
  convertLead: (leadId: string) =>
    apiV2.post<ApiEnvelope<any>>('/crm/contacts/convert-lead', { lead_id: leadId }).then(unwrap),
  importContacts: (contacts: any[]) =>
    apiV2.post<ApiEnvelope<any>>('/crm/contacts/import', { contacts }).then(unwrap),
  // Reliure écosystème — OBJET par design : { contact, isPlatformUser, userId, orders,
  // appointments, services, forum, messaging, counts } → identité plateforme + 360°.
  getContactPlatform: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/crm/contacts/${id}/platform`).then(unwrap),
  // Reliure société — OBJET : { company, contactsTotal, members, counts, externalTenantId, billing }.
  getCompanyPlatform: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/crm/companies/${id}/platform`).then(unwrap),
  // Back-office : génère un lien de paiement Stripe pour un tenant (relance/encaissement).
  // Owner Cimolace uniquement (garde CimolaceStaffGuard côté API). cycle ∈ monthly|quarterly|yearly
  // (trimestriel −10 %, annuel −20 % par défaut). Renvoie { url, ... }.
  createTenantPaymentLink: (tenantId: string, planKey?: string, cycle?: string) =>
    apiV2.post<ApiEnvelope<any>>(`/admin/billing/tenants/${tenantId}/payment-link`, {
      ...(planKey ? { planKey } : {}),
      ...(cycle && cycle !== 'monthly' ? { cycle } : {}),
    }).then(unwrap),
  // Recherche globale (Cmd-K) — OBJET { contacts, companies, deals }.
  search: (q: string, limit = 8) =>
    apiV2.get<ApiEnvelope<any>>('/crm/search', { params: { q, limit: String(limit) } }).then(unwrap),
  // Analytics sales — OBJET { totals, winRate, forecast, pipelineValue, byStage, leaderboard, avgCycleDays }.
  analytics: () => apiV2.get<ApiEnvelope<any>>('/crm/analytics').then(unwrap),
  // Envoi réel d'un message au contact (messagerie immersive), au nom de l'opérateur.
  sendMessageToContact: (id: string, content: string) =>
    apiV2.post<ApiEnvelope<any>>(`/crm/contacts/${id}/message`, { content }).then(unwrap),
  // CRUD étapes / pipelines (#10).
  createStage: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/crm/stages', body).then(unwrap),
  updateStage: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/crm/stages/${id}`, body).then(unwrap),
  deleteStage: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/crm/stages/${id}`).then(unwrap),

  listPipelines: (): Promise<any[]> =>
    apiV2.get<ApiEnvelope<{ pipelines?: any[] }>>('/crm/pipelines').then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.pipelines ?? []))),
  createPipeline: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/crm/pipelines', body).then(unwrap),
  listStages: (pipelineId: string): Promise<any[]> =>
    apiV2.get<ApiEnvelope<{ stages?: any[] }>>(`/crm/pipelines/${pipelineId}/stages`).then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.stages ?? []))),

  // Kanban — OBJET par design : { pipeline, stages:[{...,deals:[]}], orphans } → NE PAS extraire.
  dealsBoard: (pipelineId?: string) =>
    apiV2
      .get<ApiEnvelope<any>>('/crm/deals/board', { params: pipelineId ? { pipeline_id: pipelineId } : {} })
      .then(unwrap),
  createDeal: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/crm/deals', body).then(unwrap),
  updateDeal: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/crm/deals/${id}`, body).then(unwrap),
  deleteDeal: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/crm/deals/${id}`).then(unwrap),

  listNotes: (entityType: string, entityId: string): Promise<any[]> =>
    apiV2
      .get<ApiEnvelope<{ notes?: any[] }>>('/crm/notes', { params: { entity_type: entityType, entity_id: entityId } })
      .then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.notes ?? []))),
  createNote: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/crm/notes', body).then(unwrap),
  deleteNote: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/crm/notes/${id}`).then(unwrap),

  listTasks: (params?: Record<string, string>): Promise<any[]> =>
    apiV2.get<ApiEnvelope<{ tasks?: any[] }>>('/crm/tasks', { params }).then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.tasks ?? []))),
  createTask: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/crm/tasks', body).then(unwrap),
  updateTask: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/crm/tasks/${id}`, body).then(unwrap),
  deleteTask: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/crm/tasks/${id}`).then(unwrap),

  listTags: (): Promise<any[]> =>
    apiV2.get<ApiEnvelope<{ tags?: any[] }>>('/crm/tags').then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.tags ?? []))),
  listEntityTags: (entityType: string, entityId: string): Promise<any[]> =>
    apiV2
      .get<ApiEnvelope<{ tags?: any[] }>>('/crm/entity-tags', { params: { entity_type: entityType, entity_id: entityId } })
      .then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.tags ?? []))),
  createTag: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/crm/tags', body).then(unwrap),
  attachTag: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/crm/tags/attach', body).then(unwrap),
  detachTag: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/crm/tags/detach', body).then(unwrap),
};

// ── IRI ─────────────────────────────────────────────────────────────────────

export const iriApi = {
  listPages: () => apiV2.get<ApiEnvelope<any[]>>('/iri/pages').then(unwrap),
  getPage: (slug: string) => apiV2.get<ApiEnvelope<any>>(`/iri/pages/${slug}`).then(unwrap),
  createPage: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/iri/pages', body).then(unwrap),
  updatePage: (slug: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/iri/pages/${slug}`, body).then(unwrap),
  publishPage: (slug: string) =>
    apiV2.post<ApiEnvelope<any>>(`/iri/pages/${slug}/publish`).then(unwrap),
  deletePage: (slug: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/iri/pages/${slug}`).then(unwrap),
  getPublicPage: (slug: string) => apiV2.get<ApiEnvelope<any>>(`/iri/p/${slug}`).then(unwrap),
};

// ── Masterclass Factory ─────────────────────────────────────────────────────

export const masterclassApi = {
  generate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/masterclass-factory/generate', body).then(unwrap),
  list: () => apiV2.get<ApiEnvelope<any[]>>('/masterclass-factory').then(unwrap),
  get: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/masterclass-factory/${id}`).then(unwrap),
  analyzeDoc: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/masterclass-factory/analyze', body).then(unwrap),
  /**
   * Extrait un COURS ÉCRIT depuis la transcription d'un replay : le direct est
   * nettoyé de ses scories orales, reformulé et structuré en modules/leçons.
   * Long (analyse par segments) → timeout étendu.
   */
  fromReplay: (videoId: string) =>
    apiV2
      .post<ApiEnvelope<any>>('/masterclass-factory/from-replay', { videoId }, { timeout: 900000 })
      .then(unwrap),
  /**
   * CHAPITRAGE SÉMANTIQUE d'un replay : le modèle lit la transcription horodatée
   * et pose les VRAIES ruptures de sujet (au lieu du découpage à intervalle fixe
   * du lecteur). Les chapitres sont persistés côté API : un élève les lit ensuite
   * sans rien déclencher. Réservé aux créateurs (403 sinon).
   * Renvoie { chapters:[{t,label,summary}], generated_at, source:'ia'|'repli', persisted }.
   *
   * ⚠️ TIMEOUT ALIGNÉ SUR LE SERVEUR — chiffre à RECALCULER si l'on touche aux
   * constantes du service. Pire cas mesuré aujourd'hui (replay-chapters.service.ts) :
   * lecture ~1 s + MAP 360 s (BUDGET_MAP_MS, enveloppe dure : chaque tentative est
   * rognée sur l'échéance) + REDUCE 270 s (3 × TIMEOUT_REDUCE_MS) + sélection locale
   * + écriture ~1 s ≈ 633 s. Les 780 s laissent 147 s de marge. Un timeout client
   * plus court (300 s auparavant) coupait un
   * travail LÉGITIME encore en cours, affichait un message axios en anglais dans une
   * UI française, et rendait le bouton cliquable pendant que le premier run tournait
   * toujours — d'où un second appel modèle facturé pour rien.
   *
   * ⚠️ `force` N'EST PAS DÉCORATIF : le contrôleur lit littéralement
   * `{ force: d?.force === true }` (masterclass-factory.controller.ts) et le service
   * renvoie le CACHE de `published_videos.chapters` tant qu'il est faux. Ne pas
   * transmettre ce champ (ce qui était le cas) rendait « Rechapitrer avec l'IA »
   * strictement inopérant : l'écran annonçait « N chapitres générés » en réaffichant
   * exactement les chapitres déjà en base. On l'envoie donc explicitement, faux par
   * défaut — un premier chapitrage n'a rien à forcer, et forcer par défaut
   * refacturerait un appel modèle à chaque ouverture du replay.
   */
  chaptersFromReplay: (videoId: string, force = false) =>
    apiV2
      .post<ApiEnvelope<any>>(
        '/masterclass-factory/chapters-from-replay',
        { videoId, force },
        { timeout: 780000 },
      )
      .then(unwrap),
  /**
   * Demande la construction d'un COURS ENSEIGNABLE depuis un replay : extraction du
   * contenu, plan pédagogique, leçons (amorce → schéma → exemples → quiz corrigé).
   * Traitement long côté worker → renvoie une demande à suivre, pas le cours.
   */
  requestCourseFromReplay: (videoId: string) =>
    apiV2.post<ApiEnvelope<any>>('/masterclass-factory/course-from-replay', { videoId }).then(unwrap),
  courseJob: (jobId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/masterclass-factory/course-job/${jobId}`).then(unwrap),
  courseJobByVideo: (videoId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/masterclass-factory/course-job/by-video/${videoId}`).then(unwrap),
  /**
   * PONT « Importer une vidéo » du Studio → pipeline post-production. Le fichier a
   * déjà été téléversé dans le bucket public `videos` (VideoUploadModal) ; ce call
   * le recopie sur R2 et crée un VRAI `published_videos` (transcript vide → worker
   * Deepgram). Renvoie `{ publishedVideoId, storageKey, transcribed }` : on utilise
   * `publishedVideoId` comme contentId du Studio, à la place de l'UUID aléatoire —
   * sans quoi transcript / segments / course-from-replay renvoient 404.
   */
  studioImport: (body: { storagePath: string; title?: string; description?: string; durationSeconds?: number }) =>
    apiV2
      .post<ApiEnvelope<any>>('/masterclass-factory/studio-import', body, { timeout: 300000 })
      .then(unwrap),
  savePrecepteur: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/masterclass-factory/precepteur', body).then(unwrap),
};

// ── Cagnotte PUBLIQUE (dons anonymes) — Europe: Stripe · Afrique: pawaPay ──────
export const cagnotteApi = {
  campaign: (slug: string) =>
    apiV2.get<ApiEnvelope<any>>(`/cagnotte/${slug}`).then(unwrap),
  providers: (slug: string, country?: string) =>
    apiV2
      .get<ApiEnvelope<any>>(`/cagnotte/${slug}/providers${country ? `?country=${encodeURIComponent(country)}` : ''}`)
      .then(unwrap),
  stripe: (slug: string, body: { amountCents: number; donorName?: string; donorMessage?: string }) =>
    apiV2.post<ApiEnvelope<any>>(`/cagnotte/${slug}/stripe`, body).then(unwrap),
  confirmStripe: (slug: string, sessionId: string) =>
    apiV2.post<ApiEnvelope<any>>(`/cagnotte/${slug}/stripe/confirm`, { sessionId }).then(unwrap),
  pawapay: (
    slug: string,
    body: { amountCents: number; phoneNumber: string; provider: string; country: string; donorName?: string; donorMessage?: string },
  ) => apiV2.post<ApiEnvelope<any>>(`/cagnotte/${slug}/pawapay`, body).then(unwrap),
  pawapayStatus: (slug: string, depositId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/cagnotte/${slug}/pawapay/${depositId}`).then(unwrap),
};

// ── Master Factory officiel ─────────────────────────────────────────────────
//
// Nouveau point d'entrée Liri : un seul cerveau, plusieurs sorties.
// Les anciennes routes `masterclass-factory/*` restent compatibles, mais les
// nouveaux écrans doivent préférer cette API.

export type MasterFactorySourceType =
  | 'replay'
  | 'live'
  | 'tiktok'
  | 'document'
  | 'texte'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'url';

export const masterFactoryApi = {
  ingestSource: (body: { sourceType: MasterFactorySourceType; title?: string; contentText: string; sourceUrl?: string; mimeType?: string; durationSec?: number; metadata?: Record<string, unknown> }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/sources/ingest', body, { timeout: 120000 }).then(unwrap),
  listSources: (type: MasterFactorySourceType) =>
    apiV2.get<ApiEnvelope<any>>(`/master-factory/sources/${type}`).then(unwrap),
  getSource: (type: MasterFactorySourceType, sourceId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/master-factory/source/${type}/${encodeURIComponent(sourceId)}`).then(unwrap),
  understand: (body: { sourceType?: MasterFactorySourceType; sourceId: string; force?: boolean }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/understand', body, { timeout: 900000 }).then(unwrap),
  status: (sourceType: MasterFactorySourceType, sourceId: string) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/status', { sourceType, sourceId }).then(unwrap),
  produceCourse: (body: { sourceType?: MasterFactorySourceType; sourceId: string; force?: boolean }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/produce/course', body).then(unwrap),
  produceMasterScript: (body: { sourceType?: MasterFactorySourceType; sourceId: string; force?: boolean }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/produce/master-script', body).then(unwrap),
  produceMindmap: (body: { sourceType?: MasterFactorySourceType; sourceId: string }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/produce/mindmap', body).then(unwrap),
  produceSmartboard: (body: { sourceType?: MasterFactorySourceType; sourceId: string; force?: boolean }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/produce/smartboard', body).then(unwrap),
  produceLiveScenario: (body: { sourceType?: MasterFactorySourceType; sourceId: string; force?: boolean }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/produce/live-scenario', body).then(unwrap),
  produceLiveStack: (body: { sourceType?: MasterFactorySourceType; sourceId: string; force?: boolean }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/produce/live-stack', body).then(unwrap),
  publishLiveSession: (body: {
    sourceType?: MasterFactorySourceType;
    sourceId: string;
    liveSessionId: string;
    replaceExisting?: boolean;
    force?: boolean;
    // Sans ce flag, l'API répond 400 « Un direct est en cours… » : remplacer le
    // programme sous les yeux des invités exige une confirmation explicite de l'hôte.
    allowDuringLive?: boolean;
  }) => apiV2.post<ApiEnvelope<any>>('/master-factory/publish/live-session', body, { timeout: 900000 }).then(unwrap),
  renderPdf: (body: { sourceType?: MasterFactorySourceType; sourceId: string }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/render/pdf', body).then(unwrap),
  renderMasterclassProject: (body: { sourceType?: MasterFactorySourceType; sourceId: string }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/render/masterclass-project', body).then(unwrap),
  renderPrecepteur: (body: { sourceType?: MasterFactorySourceType; sourceId: string }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/render/precepteur', body).then(unwrap),
  renderManual: (body: { sourceType?: MasterFactorySourceType; sourceId: string }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/render/manual', body).then(unwrap),
  enrichVisualPedagogy: (body: { sourceType?: MasterFactorySourceType; sourceId: string; force?: boolean }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/enrich/visual-pedagogy', body, { timeout: 240000 }).then(unwrap),
  reviewVisualImage: (body: { sourceType?: MasterFactorySourceType; sourceId: string; chapterId: number; role: string; status: 'pending_review' | 'approved' | 'rejected'; imageUrl?: string; provider?: string; note?: string }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/review/visual-image', body).then(unwrap),
  /** Narration par scène (une scène = un audio) : synthèse longue, timeout large. */
  generateSceneAudio: (body: { liveSessionId: string; force?: boolean; languageCode?: string }) =>
    apiV2.post<ApiEnvelope<any>>('/master-factory/scene-audio/generate', body, { timeout: 900000 }).then(unwrap),
  sceneAudioStatus: (liveSessionId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/master-factory/scene-audio/status/${liveSessionId}`).then(unwrap),
};

// ── Vidéothèque : EXTRAITS COURTS (short_clips) d'un replay ──────────────────
//
// POURQUOI CE CONTRAT EST « MAIGRE » CÔTÉ CLIENT : la fabrication d'extraits est
// un travail de WORKER (téléchargement R2 → transcription → découpe ffmpeg →
// remontée R2), pas un appel synchrone. La route ne fait donc que POSER UNE
// DEMANDE ; elle rend la main tout de suite. C'est exactement le motif de
// `requestCourseFromReplay` juste au-dessus — surtout pas celui de
// `chaptersFromReplay`, qui attend le modèle en ligne avec un timeout de 780 s.
// Une requête qui resterait ouverte plusieurs minutes ici serait coupée par le
// proxy bien avant que le premier clip existe.
//
// ⚠️ VOCABULAIRE NORMALISÉ PAR LE SERVEUR. `state` ne trahit JAMAIS le nom ni les
// valeurs de la colonne d'idempotence portée par `zoom_recordings` (le worker et
// l'API en sont seuls propriétaires, et le poller peut les faire évoluer). L'écran
// ne connaît que ces cinq mots français, stables :
//   'aucun'   → jamais demandé pour ce replay ;
//   'demande' → demande enregistrée, le worker ne l'a pas encore prise ;
//   'encours' → découpage en cours (plusieurs minutes) ;
//   'pret'    → terminé — `clips` dit COMBIEN d'extraits sont réellement prêts
//               (peut valoir 0 : un replay sans passage saillant ne rend rien) ;
//   'erreur'  → échec, `error_message` porte le motif brut du worker.
export interface ReplayShortsState {
  state: 'aucun' | 'demande' | 'encours' | 'pret' | 'erreur';
  /** Nombre d'extraits en statut `ready` réellement disponibles pour ce replay. */
  clips: number;
  /** Motif d'échec renvoyé par le worker (déjà en français quand il vient de nous). */
  error_message?: string | null;
  /** Horodatage de la demande — sert à dire « demandé il y a X » sans deviner. */
  requested_at?: string | null;
  /**
   * VRAI quand ce replay n'a AUCUNE transcription et qu'il est trop long pour être
   * transcrit au vol : les extraits sortiront sans sous-titres, et aucun automatisme
   * ne viendra corriger ça (le poller de transcription a définitivement écarté les
   * replays qu'il a déjà tentés en vain). À DIRE AVANT LE CLIC — sans cet
   * avertissement, le créateur relance la fabrication de semaine en semaine en
   * croyant que la transcription va finir par arriver.
   */
  sans_transcription?: boolean;
}

export const videothequeApi = {
  /**
   * Demande la fabrication d'extraits courts pour UN replay (owner/admin/teacher).
   * Idempotent côté serveur : redemander pendant que le worker travaille ne
   * relance rien et ne refacture pas la transcription — la route renvoie l'état
   * courant. Le paramètre est l'ID de la vidéo PUBLIÉE (`published_videos.id`),
   * seul identifiant que la Vidéothèque manipule ; le serveur remonte lui-même
   * jusqu'à l'enregistrement source.
   */
  requestShorts: (videoId: string): Promise<ReplayShortsState> =>
    apiV2.post<ApiEnvelope<ReplayShortsState>>('/zoom-engine/shorts-from-replay', { videoId }).then(unwrap),

  /** État d'avancement d'UN replay — appelé en boucle lente pendant le travail. */
  shortsState: (videoId: string): Promise<ReplayShortsState> =>
    apiV2.get<ApiEnvelope<ReplayShortsState>>(`/zoom-engine/shorts-state/${videoId}`).then(unwrap),

  /**
   * Les extraits d'un replay, AVEC une URL jouable (présignée R2, ~6 h).
   * Distincte de `shortsState`, qui n'en renvoie que le NOMBRE : voir les extraits
   * et savoir combien il y en a sont deux questions, et la seconde se pose en
   * boucle alors que la première ne se pose qu'à l'ouverture d'un panneau.
   */
  listShorts: (videoId: string): Promise<{ clips: ReplayShortClip[]; refus: ReplayShortRefus[] }> =>
    apiV2.get<ApiEnvelope<{ clips: ReplayShortClip[]; refus: ReplayShortRefus[] }>>(`/zoom-engine/shorts/${videoId}`).then(unwrap),
};

/**
 * Un passage ÉCARTÉ au contrôle de sortie, et son motif.
 * Le moteur refuse plutôt que de livrer ; sans cette liste, le créateur verrait
 * « 2 extraits » là où il en attendait 5, sans savoir pourquoi ni pouvoir contester.
 */
export interface ReplayShortRefus {
  debut_sec: number;
  fin_sec: number;
  titre: string | null;
  /** FIN_LOGISTIQUE · QUESTION_SANS_REPONSE · TITRE_NON_TENU · JURY · citation_introuvable */
  code: string;
  motif: string;
  extrait_texte: string | null;
}

/** Un extrait court prêt à être regardé. `url` est nulle si la présignature a échoué. */
export interface ReplayShortClip {
  id: string;
  titre: string | null;
  description: string | null;
  debut_sec: number | null;
  fin_sec: number | null;
  duree_sec: number | null;
  extrait_texte: string | null;
  /** Lecture en ligne. */
  url: string | null;
  /**
   * Téléchargement forcé. DISTINCTE de `url` : l'attribut `download` d'un <a> est
   * ignoré quand la cible est sur un autre domaine (R2 en est un), donc seul un
   * `Content-Disposition: attachment` servi par le stockage enregistre le fichier
   * au lieu de l'ouvrir. Le serveur le demande dans l'URL présignée.
   */
  url_telechargement: string | null;
}

// ── Mbolo ───────────────────────────────────────────────────────────────────

export const mboloApi = {
  install: (body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>('/mbolo/install', body).then(unwrap),
  listCategories: () => apiV2.get<ApiEnvelope<any[]>>('/mbolo/categories').then(unwrap),
  createCategory: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/mbolo/categories', body).then(unwrap),
  listProducts: () => apiV2.get<ApiEnvelope<any[]>>('/mbolo/products').then(unwrap),
  getProduct: (id: string) => apiV2.get<ApiEnvelope<any>>(`/mbolo/products/${id}`).then(unwrap),
  createProduct: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/mbolo/products', body).then(unwrap),
  updateProduct: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/mbolo/products/${id}`, body).then(unwrap),
  deleteProduct: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/mbolo/products/${id}`).then(unwrap),
  getCart: () => apiV2.get<ApiEnvelope<any[]>>('/mbolo/cart').then(unwrap),
  addToCart: (productId: string, quantity: number) =>
    apiV2.post<ApiEnvelope<any>>('/mbolo/cart', { productId, quantity }).then(unwrap),
  removeFromCart: (productId: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/mbolo/cart/${productId}`).then(unwrap),
  createOrder: () => apiV2.post<ApiEnvelope<any>>('/mbolo/orders').then(unwrap),
  listOrders: () => apiV2.get<ApiEnvelope<any[]>>('/mbolo/orders').then(unwrap),
  getOrder: (id: string) => apiV2.get<ApiEnvelope<any>>(`/mbolo/orders/${id}`).then(unwrap),
  checkoutSession: (orderId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/mbolo/orders/${orderId}/checkout-session`, body).then(unwrap),
  confirmOrder: (orderId: string) =>
    apiV2.post<ApiEnvelope<any>>(`/mbolo/orders/${orderId}/confirm`).then(unwrap),
  updateOrder: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/mbolo/orders/${id}`, body).then(unwrap),
  // ── Liens de paiement / facturation ──
  listPaymentLinks: () => apiV2.get<ApiEnvelope<any[]>>('/mbolo/payment-links').then(unwrap),
  getPaymentLink: (id: string) => apiV2.get<ApiEnvelope<any>>(`/mbolo/payment-links/${id}`).then(unwrap),
  createPaymentLink: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/mbolo/payment-links', body).then(unwrap),
  updatePaymentLink: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/mbolo/payment-links/${id}`, body).then(unwrap),
  deletePaymentLink: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/mbolo/payment-links/${id}`).then(unwrap),
  // ── Factures ──
  listInvoices: () => apiV2.get<ApiEnvelope<any[]>>('/mbolo/invoices').then(unwrap),
  getInvoice: (id: string) => apiV2.get<ApiEnvelope<any>>(`/mbolo/invoices/${id}`).then(unwrap),
  createInvoice: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/mbolo/invoices', body).then(unwrap),
  updateInvoice: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/mbolo/invoices/${id}`, body).then(unwrap),
  deleteInvoice: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/mbolo/invoices/${id}`).then(unwrap),
  // ── Compta : entité légale du tenant ──
  getAccountingSettings: () => apiV2.get<ApiEnvelope<any>>('/mbolo/accounting-settings').then(unwrap),
  updateAccountingSettings: (body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>('/mbolo/accounting-settings', body).then(unwrap),
};

// ── Neuro Recall ────────────────────────────────────────────────────────────

export const neuroRecallApi = {
  createDeck: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/neuro-recall/decks', body).then(unwrap),
  listDecks: () => apiV2.get<ApiEnvelope<any[]>>('/neuro-recall/decks').then(unwrap),
  getDueCards: (deckId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/neuro-recall/decks/${deckId}/due`).then(unwrap),
  reviewCard: (cardId: string, quality: number) =>
    apiV2.post<ApiEnvelope<any>>(`/neuro-recall/cards/${cardId}/review`, { quality }).then(unwrap),
  getStats: () => apiV2.get<ApiEnvelope<any>>('/neuro-recall/stats').then(unwrap),
};

// ── Pay Engine ──────────────────────────────────────────────────────────────

export const payEngineApi = {
  getProviders: () => apiV2.get<ApiEnvelope<any[]>>('/pay-engine/providers').then(unwrap),
  enableProvider: (provider: string, enabled: boolean) =>
    apiV2.patch<ApiEnvelope<any>>(`/pay-engine/providers/${provider}`, { enabled }).then(unwrap),
  createCinetPay: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/pay-engine/pay/cinetpay', body).then(unwrap),
  getTransactions: () =>
    apiV2.get<ApiEnvelope<any[]>>('/pay-engine/transactions').then(unwrap),
};

// ── Replay ──────────────────────────────────────────────────────────────────

export const replayApi = {
  listRecordings: () => apiV2.get<ApiEnvelope<any[]>>('/replay/recordings').then(unwrap),
  getRecording: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/replay/recordings/${id}`).then(unwrap),
  getPlayback: (id: string) =>
    apiV2.get<ApiEnvelope<any>>(`/replay/recordings/${id}/playback`).then(unwrap),
  listReplays: () => apiV2.get<ApiEnvelope<any[]>>('/replay').then(unwrap),
};

// ── Video Engine ────────────────────────────────────────────────────────────

export const videoEngineApi = {
  listAssets: () => apiV2.get<ApiEnvelope<any[]>>('/video-engine/assets').then(unwrap),
  getAsset: (id: string) => apiV2.get<ApiEnvelope<any>>(`/video-engine/assets/${id}`).then(unwrap),
  createAsset: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/video-engine/assets', body).then(unwrap),
  deleteAsset: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/video-engine/assets/${id}`).then(unwrap),
};

// ── Email Engine ────────────────────────────────────────────────────────────

export const emailEngineApi = {
  listTemplates: () => apiV2.get<ApiEnvelope<any[]>>('/email-engine/templates').then(unwrap),
  createTemplate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/email-engine/templates', body).then(unwrap),
  send: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/email-engine/send', body).then(unwrap),
  sendCampaign: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/email-engine/campaigns', body).then(unwrap),
  listCampaigns: () => apiV2.get<ApiEnvelope<any[]>>('/email-engine/campaigns').then(unwrap),
};

// ── SMS Engine ──────────────────────────────────────────────────────────────

export const smsEngineApi = {
  sendSms: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/sms-engine/send', body).then(unwrap),
  sendWhatsApp: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/sms-engine/whatsapp', body).then(unwrap),
  getLogs: (channel?: string) =>
    apiV2.get<ApiEnvelope<any[]>>('/sms-engine/logs', { params: { channel } }).then(unwrap),
};

// ── AI Worker ───────────────────────────────────────────────────────────────

export const aiWorkerApi = {
  enqueue: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/ai-worker/jobs', body).then(unwrap),
  listJobs: () => apiV2.get<ApiEnvelope<any[]>>('/ai-worker/jobs').then(unwrap),
  getJob: (id: string) => apiV2.get<ApiEnvelope<any>>(`/ai-worker/jobs/${id}`).then(unwrap),
};

// ── AI Utils (programme annuel, reformulation, ad-copy) ──────────────────────

export const aiUtilsApi = {
  generateAnnualProgram: (body: Record<string, unknown>, config?: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/ai-utils/annual-program/generate', body, config).then(unwrap),
  reformulate: (body: { text: string; context?: string }) =>
    apiV2.post<ApiEnvelope<any>>('/ai-utils/reformulate', body).then(unwrap),
};

// ── Cimolace Backoffice ─────────────────────────────────────────────────────

export const cimolaceBackofficeApi = {
  getStats: () => apiV2.get<ApiEnvelope<any>>('/cimolace-backoffice/stats').then(unwrap),
  listClients: () => apiV2.get<ApiEnvelope<any[]>>('/cimolace-backoffice/clients').then(unwrap),
  createClient: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/cimolace-backoffice/clients', body).then(unwrap),
  updateClient: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${id}`, body).then(unwrap),
  getClientControlPlane: (clientId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/control-plane`).then(unwrap),
  getClientDiagnostics: (clientId: string) =>
    apiV2.get<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/diagnostics`).then(unwrap),
  runTenantOperation: (clientId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/operations`, body).then(unwrap),
  updateAppTenantBranding: (clientId: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/app-tenant/branding`, body).then(unwrap),
  activateSchoolModelEngines: (clientId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/school-model/activate-engines`, body).then(unwrap),
  prepareSchoolModel: (clientId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/school-model/prepare`, body).then(unwrap),
  applySchoolModelQuotas: (clientId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/school-model/apply-quotas`, body).then(unwrap),
  prepareSchoolModelProviders: (clientId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/school-model/prepare-providers`, body).then(unwrap),
  getProviderDetail: (clientId: string, providerKey: string) =>
    apiV2.get<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/providers/${providerKey}`).then(unwrap),
  runProviderHealthCheck: (clientId: string, providerKey: string) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/providers/${providerKey}/health-check`, {}).then(unwrap),
  getMonitoringOverview: () =>
    apiV2.get<ApiEnvelope<any>>('/cimolace-backoffice/monitoring/overview').then(unwrap),
  runAllHealthChecks: () =>
    apiV2.post<ApiEnvelope<any>>('/cimolace-backoffice/monitoring/run-all', {}).then(unwrap),
  listSchoolProvisionings: () =>
    apiV2.get<ApiEnvelope<any[]>>('/cimolace-backoffice/provision-school').then(unwrap),
  previewProvisionSchool: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/cimolace-backoffice/provision-school/preview', body).then(unwrap),
  provisionSchoolFromTemplate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/cimolace-backoffice/provision-school', body).then(unwrap),
  updateTenantService: (clientId: string, serviceId: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/services/${serviceId}`, body).then(unwrap),
  /**
   * Admin marketplace — toggle on/off d'un service Cimolace (ex: 'twin')
   * sur un tenant. Réservé au staff Cimolace côté backend.
   */
  toggleTenantService: (tenantId: string, serviceKey: string, active: boolean) =>
    apiV2
      .post<ApiEnvelope<any>>(`/admin/tenants/${tenantId}/services/${serviceKey}/toggle`, { active })
      .then(unwrap),
  /**
   * Active l'abonnement forfaitaire d'un tenant : crée la ligne
   * billing_subscriptions active (depuis billing_plans) et arme le gating de la
   * clé tenant. Réservé au staff Cimolace côté backend.
   */
  activateTenantForfait: (tenantId: string, plan = 'zahir-forfait') =>
    apiV2
      .post<ApiEnvelope<any>>(`/admin/billing/tenants/${tenantId}/activate`, { plan })
      .then(unwrap),
  createCredentialReference: (clientId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/credentials`, body).then(unwrap),
  rotateCredential: (clientId: string, credentialId: string, body: Record<string, unknown> = {}) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/credentials/${credentialId}/rotate`, body).then(unwrap),
  createTenantTicket: (clientId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/tickets`, body).then(unwrap),
  // Impersonation encadrée (§15) — démarre une session (motif obligatoire) et renvoie le token + contexte.
  startImpersonation: (clientId: string, body: { reason: string; durationMinutes?: number; role?: string }) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/impersonate`, body).then(unwrap),
  createTenantInvoice: (clientId: string, body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>(`/cimolace-backoffice/clients/${clientId}/invoices`, body).then(unwrap),
  listSites: () => apiV2.get<ApiEnvelope<any[]>>('/cimolace-backoffice/sites').then(unwrap),
  createSite: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/cimolace-backoffice/sites', body).then(unwrap),
  updateSite: (id: string, body: Record<string, unknown>) =>
    apiV2.patch<ApiEnvelope<any>>(`/cimolace-backoffice/sites/${id}`, body).then(unwrap),
  deleteSite: (id: string) =>
    apiV2.delete<ApiEnvelope<any>>(`/cimolace-backoffice/sites/${id}`).then(unwrap),
  getClientSites: (clientId: string) =>
    apiV2.get<ApiEnvelope<any[]>>(`/cimolace-backoffice/clients/${clientId}/sites`).then(unwrap),
};

// ── School Onboarding (self-service) ────────────────────────────────────────

export const schoolOnboardingApi = {
  getEngineManifest: () =>
    apiV2.get<ApiEnvelope<any>>('/school-onboarding/engines').then(unwrap),
  previewProvision: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/school-onboarding/provision/preview', body).then(unwrap),
  provision: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/school-onboarding/provision', body).then(unwrap),
  initiateCheckout: (body: { slug: string; plan: string; provider?: 'stripe' | 'chariow' | 'cinetpay' | 'pawapay'; phoneNumber?: string; pawapayProvider?: string; country?: string; success_url?: string; cancel_url?: string }) =>
    apiV2.post<ApiEnvelope<{ checkoutUrl: string; provider: string; plan: string; amountCents: number; currency: string; depositId?: string; status?: string }>>('/school-onboarding/checkout', body).then(unwrap),
};

// ── Catalog ─────────────────────────────────────────────────────────────────

export const catalogApi = {
  getEngines: () => apiV2.get<ApiEnvelope<any[]>>('/catalog/engines').then(unwrap),
  getTemplates: () => apiV2.get<ApiEnvelope<any[]>>('/catalog/templates').then(unwrap),
  getTenantServices: () => apiV2.get<ApiEnvelope<any[]>>('/catalog/tenant-services').then(unwrap),
  createTenantService: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/catalog/tenant-services', body).then(unwrap),
  applyTemplate: (body: Record<string, unknown>) =>
    apiV2.post<ApiEnvelope<any>>('/catalog/apply-template', body).then(unwrap),
};

// ── Moyens de paiement (config par tenant) ──────────────────────────────────
//
// Back-office → Paramètres → Paiements. Chaque tenant configure SES clés pour
// Stripe (carte) / PawaPay (mobile money) / Chariow (produits). Les secrets
// partent EN CLAIR au backend (chiffrés AES-256-GCM côté serveur) et ne
// reviennent JAMAIS en clair : la liste renvoie un masque { set, last4 } par
// champ. Tenant résolu via le header X-Tenant-Slug (déjà injecté par l'intercepteur).

/** Provider supporté — aligné sur le CHECK SQL + le DTO backend. */
export type PaymentProvider =
  | 'stripe'
  | 'pawapay'
  | 'chariow'
  | 'paypal'
  | 'cinetpay';

/** Champ secret masqué tel que renvoyé par la liste/upsert. */
export interface MaskedSecretField {
  set: boolean;
  last4: string;
}

/** Vue masquée d'un moyen de paiement configuré (aucun secret en clair). */
export interface MaskedPaymentMethod {
  provider: PaymentProvider;
  enabled: boolean;
  mode: string | null;
  credentials: Record<string, MaskedSecretField>;
  productMap: Record<string, string> | null;
  lastTest: {
    at: string | null;
    ok: boolean | null;
    message: string | null;
  };
  updatedAt: string | null;
}

/** Corps d'upsert — credentials EN CLAIR (chiffrés côté serveur). */
export interface SavePaymentMethodBody {
  provider: PaymentProvider;
  mode?: string;
  credentials: Record<string, string>;
  productMap?: Record<string, string>;
}

export const paymentMethodsApi = {
  /** Liste des moyens configurés du tenant (credentials masqués). */
  list: () =>
    apiV2
      .get<ApiEnvelope<{ providers: MaskedPaymentMethod[] }>>('/billing/payment-methods')
      .then(unwrap),
  /** Upsert d'un moyen : chiffre les credentials → enabled=true → renvoie le masque. */
  save: (body: SavePaymentMethodBody) =>
    apiV2
      .post<ApiEnvelope<MaskedPaymentMethod>>('/billing/payment-methods', body)
      .then(unwrap),
  /** Test de connexion RÉEL côté serveur ; met à jour last_test_* et renvoie {ok, message}. */
  test: (provider: PaymentProvider) =>
    apiV2
      .post<ApiEnvelope<{ ok: boolean; message: string }>>(
        `/billing/payment-methods/${provider}/test`,
        {},
      )
      .then(unwrap),
  /** Active / désactive un moyen. */
  toggle: (provider: PaymentProvider, enabled: boolean) =>
    apiV2
      .patch<ApiEnvelope<MaskedPaymentMethod>>(`/billing/payment-methods/${provider}`, {
        enabled,
      })
      .then(unwrap),
  /** Supprime la config d'un moyen. */
  remove: (provider: PaymentProvider) =>
    apiV2
      .delete<ApiEnvelope<{ ok: true; provider: PaymentProvider }>>(
        `/billing/payment-methods/${provider}`,
      )
      .then(unwrap),
};

// ── Catalogue & tarifs (services + prix par tenant) ─────────────────────────
//
// Back-office → Catalogue & tarifs. Chaque tenant déclare SES services
// vendables (cycles école, temple, consultations, mentorat, custom) avec leur
// prix. Source de vérité pour la vitrine, le hub et le checkout élève. CRUD via
// /billing/catalog. Tenant résolu par le header X-Tenant-Slug (intercepteur).
//
// NB : nommé `billingCatalogApi` car `catalogApi` (engines/templates) existe
// déjà plus haut. Les méthodes gardent la forme list/create/update/remove.

/** Catégorie de service — alignée sur le CHECK SQL + le DTO backend. */
export type ServiceCategory =
  | 'cycle'
  | 'temple'
  | 'consultation'
  | 'mentorat'
  | 'custom';

/** Service du catalogue tel que renvoyé/écrit (camelCase). */
export interface CatalogService {
  key: string;
  category: ServiceCategory;
  label: string;
  tagline: string | null;
  description: string | null;
  priceCents: number;
  currency: string;
  billingCycle: string; // 'month' | 'one_time' | 'year' (libre côté backend)
  isActive: boolean;
  sortOrder: number;
  features: string[] | null;
  metadata: Record<string, unknown> | null;
}

/** Corps de création — `key` peut être dérivé du label côté serveur. */
export type CreateCatalogServiceBody = Partial<CatalogService> &
  Pick<CatalogService, 'category' | 'label'>;

export const billingCatalogApi = {
  /** Liste des services du tenant (tous statuts confondus).
   *  ⚠️ `/billing/catalog` renvoie `{ data: { services: [...] } }` (enveloppe objet)
   *  et non `{ data: [...] }` → on extrait toujours un TABLEAU (robuste aux 2 formes),
   *  sinon l'appelant (LiriServicesPage `items.filter`) crashe. */
  list: (): Promise<CatalogService[]> =>
    apiV2
      .get<ApiEnvelope<{ services?: CatalogService[] } | CatalogService[]>>('/billing/catalog')
      .then(unwrap)
      .then((r: any) => (Array.isArray(r) ? r : (r?.services ?? []))),
  /** Crée un service. */
  create: (body: CreateCatalogServiceBody) =>
    apiV2.post<ApiEnvelope<CatalogService>>('/billing/catalog', body).then(unwrap),
  /** Met à jour un service (PATCH partiel : prix, statut, libellés…). */
  update: (key: string, body: Partial<CatalogService>) =>
    apiV2
      .patch<ApiEnvelope<CatalogService>>(`/billing/catalog/${key}`, body)
      .then(unwrap),
  /** Supprime un service. */
  remove: (key: string) =>
    apiV2
      .delete<ApiEnvelope<{ ok: true; key: string }>>(`/billing/catalog/${key}`)
      .then(unwrap),
};

// ── Join / résolution d'organisation (self-join par slug) ──
export const joinApi = {
  /** `invite` = code d'un lien d'invitation (?invite=CODE) — tracking best-effort côté serveur. */
  joinTenant: (slug: string, invite?: string) =>
    apiV2.post<ApiEnvelope<{ ok: boolean; joined: boolean; role: string }>>(`/tenants/${encodeURIComponent(slug)}/join`, invite ? { invite } : {}).then(unwrap),
  resolveOrg: (slug: string) =>
    apiV2.get<ApiEnvelope<{ slug: string; name: string; logo_url: string | null; embedded?: boolean; primary_domain?: string | null } | null>>(`/tenants/by-slug/${encodeURIComponent(slug)}/branding`).then(unwrap),
};

// ── Bibliothèque du Précepteur (cours générés depuis TikTok) ─────────────────
// ⚠️ PIÈGE double enveloppe {data:{data:[…]}} (contrôleur renvoie {data} + intercepteur global
// re-emballe) → dépiler EN PROFONDEUR jusqu'à la valeur utile (cf. MessagingContext).
const deep = (r: any): any => { let d = r; while (d && !Array.isArray(d) && typeof d === 'object' && 'data' in d) d = d.data; return d; };
export const precepteurLibraryApi = {
  list: (): Promise<any[]> => apiV2.get<ApiEnvelope<any[]>>('/precepteur-library').then(deep).then((d) => (Array.isArray(d) ? d : [])),
  get: (id: string): Promise<any> => apiV2.get<ApiEnvelope<any>>(`/precepteur-library/${id}`).then(deep),
};

// ── Studio monétisation propriétaire ─────────────────────────────────────────
/** Liens d'invitation multiples (tenant_invite_links) — owner ; lien = /rejoindre?org=slug&invite=CODE. */
export const inviteLinksApi = {
  list: () => apiV2.get<ApiEnvelope<any[]>>('/tenants/current/invite-links').then(unwrap),
  create: (body: { label?: string; expiresAt?: string; maxUses?: number }) =>
    apiV2.post<ApiEnvelope<any>>('/tenants/current/invite-links', body).then(unwrap),
  update: (id: string, body: { isActive?: boolean; label?: string }) =>
    apiV2.patch<ApiEnvelope<any>>(`/tenants/current/invite-links/${id}`, body).then(unwrap),
  remove: (id: string) => apiV2.delete<ApiEnvelope<any>>(`/tenants/current/invite-links/${id}`).then(unwrap),
};
