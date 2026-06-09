/**
 * Couche données du moteur « Régie Live Host ».
 *
 * Source de vérité = API NestJS (token/start/end) + Supabase (table live_sessions
 * et live_session_participants, + Realtime). Toutes les requêtes sont RÉELLES,
 * filtrées sur le tenant ISNA. RLS : la plupart de ces tables exigent une session
 * connectée → en l'absence de droits, on renvoie des états vides honnêtes
 * (session null, participants []) plutôt que des maquettes.
 */
import {
  ISNA_TENANT_ID,
  LIVEKIT_URL,
  endLive,
  fetchLiveToken,
  startLive,
  type LiveToken,
} from '@/lib/liri-api';
import { supabase } from '@/lib/supabase';

export { LIVEKIT_URL };

/** Statuts possibles d'une session live côté DB. */
export type LiveSessionStatus =
  | 'scheduled'
  | 'live'
  | 'ended'
  | 'cancelled'
  | string;

/** Ligne `live_sessions` (sous-ensemble utile à la régie hôte). */
export interface LiveSession {
  id: string;
  title: string | null;
  status: LiveSessionStatus | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
}

/** Colonnes lues sur `live_sessions`. */
const SESSION_COLS = 'id, title, status, scheduled_at, started_at, ended_at';

/**
 * Charge la session live ciblée depuis Supabase (lecture directe, comme le web).
 * Renvoie null si introuvable ou si la RLS bloque (utilisateur non autorisé).
 */
export async function fetchLiveSession(sessionId: string): Promise<LiveSession | null> {
  if (!sessionId) return null;
  const { data, error } = await supabase
    .from('live_sessions')
    .select(SESSION_COLS)
    .eq('id', sessionId)
    .eq('tenant_id', ISNA_TENANT_ID)
    .maybeSingle();
  if (error || !data) return null;
  return data as LiveSession;
}

/**
 * Récupère le token LiveKit hôte (POST /lives/:id/token role=host) + le nom de room.
 * Renvoie null si non connecté (token vide) ou si l'API refuse.
 */
export async function fetchHostToken(sessionId: string): Promise<LiveToken | null> {
  if (!sessionId) return null;
  return fetchLiveToken(sessionId, 'host');
}

/**
 * Passe la session « en direct » (POST /lives/:id/start). Best-effort : si la
 * session est déjà live, l'appel est idempotent côté API. Renvoie le started_at
 * effectif si disponible.
 */
export async function startHostLive(sessionId: string): Promise<string | null> {
  if (!sessionId) return null;
  const live = await startLive(sessionId);
  return live?.started_at ?? null;
}

/**
 * STOP régie : termine la session.
 *  1. POST /lives/:id/end (status=ended + ended_at côté API).
 *  2. PATCH Supabase live_sessions (filet de sécurité si l'API ne propage pas
 *     immédiatement le statut — aligné sur updateLiveSession du web).
 * Renvoie true si au moins une des deux écritures a réussi.
 */
export async function endHostLive(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  const apiOk = (await endLive(sessionId)) != null;

  const { error } = await supabase
    .from('live_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('tenant_id', ISNA_TENANT_ID);

  return apiOk || error == null;
}

/**
 * Enregistre la présence de l'hôte (upsert live_session_participants), comme
 * registerLiveSessionParticipant côté web. Best-effort : on n'interrompt jamais
 * le live si la RLS refuse l'écriture.
 */
export async function registerHostParticipant(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;

  await supabase.from('live_session_participants').upsert(
    {
      live_session_id: sessionId,
      user_id: userId,
      role: 'host',
      joined_at: new Date().toISOString(),
      left_at: null,
    },
    { onConflict: 'live_session_id,user_id' },
  );
}

/** Marque la sortie de l'hôte (left_at) — appelé à la déconnexion de la room. */
export async function markHostLeft(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;

  await supabase
    .from('live_session_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('live_session_id', sessionId)
    .eq('user_id', userId);
}

/**
 * Abonnement Realtime au statut de la session : déclenche `onEnded` dès qu'un
 * autre dispositif passe la session à `ended`/`cancelled` (co-régie, kill switch
 * studio…). Renvoie une fonction de désabonnement.
 */
export function subscribeSessionStatus(
  sessionId: string,
  onEnded: (status: LiveSessionStatus) => void,
): () => void {
  if (!sessionId) return () => {};
  const channel = supabase
    .channel(`live-host-status-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_sessions',
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        const next = (payload.new as { status?: LiveSessionStatus } | null)?.status;
        if (next === 'ended' || next === 'cancelled') onEnded(next);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
