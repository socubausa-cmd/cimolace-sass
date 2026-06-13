import { API_BASE, currentToken, postJson, TENANT_SLUG } from '@/lib/liri-api';

/**
 * Couche données NeuroRecall — branchée sur l'API réelle ISNA.
 *
 * Endpoints (NeuroRecallController, tables recall_decks / recall_cards) :
 *  - GET  /neuro-recall/decks            → liste des decks de l'utilisateur
 *  - GET  /neuro-recall/decks/:id/due    → cartes dues (next_review_at ≤ now)
 *  - GET  /neuro-recall/stats            → stats globales (dont dueCards)
 *  - POST /neuro-recall/cards/:id/review → enregistre une révision { quality }
 *
 * RLS : ces routes exigent une session connectée (JwtAuthGuard + TenantGuard).
 * Sans token → on renvoie des valeurs vides honnêtes (jamais de fausses maquettes).
 */

export interface RecallDeck {
  id: string;
  title: string;
  created_at?: string;
  tenant_id?: string;
  user_id?: string;
}

export interface RecallCard {
  id: string;
  question: string;
  answer: string;
  interval_hours?: number;
  next_review_at?: string | null;
  review_count?: number;
}

export interface RecallStats {
  totalDecks: number;
  totalCards: number;
  dueCards: number;
  totalReviews: number;
  avgMastery: number;
}

/** Qualité de rappel (mappée sur les 4 boutons Again/Hard/Good/Easy). */
export type ReviewQuality = 1 | 2 | 3 | 4;

const STATS_EMPTY: RecallStats = {
  totalDecks: 0,
  totalCards: 0,
  dueCards: 0,
  totalReviews: 0,
  avgMastery: 0,
};

/**
 * GET authentifié déballant l'enveloppe {data:…} de l'API (ResponseInterceptor).
 * `getJson` n'étant pas exporté par liri-api, on reproduit ici le même contrat
 * (Authorization Bearer + X-Tenant-Slug). Renvoie null si non connecté / erreur.
 */
async function getJson<T>(path: string): Promise<T | null> {
  const token = currentToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': TENANT_SLUG },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return ((json as { data?: T })?.data ?? (json as T)) ?? null;
  } catch {
    return null;
  }
}

/** Déballe une liste éventuellement enveloppée ({data:[…]} ou […]). */
function asArray<T>(raw: { data?: T[] } | T[] | null): T[] {
  if (Array.isArray(raw)) return raw;
  const inner = (raw as { data?: T[] } | null)?.data;
  return Array.isArray(inner) ? inner : [];
}

/** Liste des decks de l'utilisateur connecté. [] si non connecté / vide. */
export async function fetchDecks(): Promise<RecallDeck[]> {
  return asArray(await getJson<{ data?: RecallDeck[] } | RecallDeck[]>('/neuro-recall/decks'));
}

/** Cartes dues d'un deck (filtre next_review_at.lte.now côté API). */
export async function fetchDueCards(deckId: string): Promise<RecallCard[]> {
  return asArray(
    await getJson<{ data?: RecallCard[] } | RecallCard[]>(`/neuro-recall/decks/${deckId}/due`),
  );
}

/** Stats globales NeuroRecall. Renvoie des zéros honnêtes si indisponible. */
export async function fetchStats(): Promise<RecallStats> {
  return (await getJson<RecallStats>('/neuro-recall/stats')) ?? STATS_EMPTY;
}

/**
 * Enregistre la révision d'une carte.
 * quality : 1=again, 2=hard, 3=good, 4=easy.
 * L'API recalcule interval_hours et next_review_at. Renvoie true si OK.
 */
export async function reviewCard(cardId: string, quality: ReviewQuality): Promise<boolean> {
  const res = await postJson<{ interval_hours?: number; next_review_at?: string }>(
    `/neuro-recall/cards/${cardId}/review`,
    { quality },
  );
  return res !== null;
}
