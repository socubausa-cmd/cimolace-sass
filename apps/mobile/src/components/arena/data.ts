/**
 * Couche données du moteur Arena (Salle de Débat invité, rôle viewer).
 *
 * Source de vérité : portail web (LiveArenaPage.jsx + useLiveHostDebateArena.js).
 * Le mobile lit les MÊMES tables Supabase, donc tout débat piloté côté web/studio
 * se reflète ici en temps réel. Aucune maquette : si la session RLS n'est pas
 * connectée, les requêtes renvoient simplement vide (états « Aucun… » honnêtes).
 *
 * Tables :
 *   - live_sessions        (titre, statut, debate_id)
 *   - debates              (round courant, camp actif, deadline de tour, options)
 *   - debate_rounds        (scores A/B par round, statut voting)
 *   - debate_participants  (équipes A/B)
 *   - live_neuronq_questions (file de questions du public — realtime)
 *   - live_session_signals (votes A/B/Tie insérés par le viewer)
 *
 * Token LiveKit : POST /lives/:id/token (role student → abonnement seul).
 */
import { supabase } from '@/lib/supabase';
import { fetchLiveToken } from '@/lib/liri-api';

export type ActiveSide = 'A' | 'B' | null;
export type VoteChoice = 'A' | 'B' | 'tie';

export interface LiveSessionRow {
  id: string;
  title: string | null;
  status: string | null;
  debate_id: string | null;
  started_at: string | null;
}

export interface DebateRow {
  id: string;
  title: string | null;
  status: string | null;
  round_count: number | null;
  arena_current_round: number | null;
  arena_active_side: ActiveSide;
  arena_turn_deadline: string | null;
  neuronq_enabled: boolean | null;
  ai_judge_enabled: boolean | null;
  ai_weight: number | null;
}

export interface DebateRoundRow {
  id: string;
  round_number: number;
  status: string | null;
  score_a: number | null;
  score_b: number | null;
  active_side: ActiveSide;
}

export interface DebateParticipantRow {
  id: string;
  debate_id: string;
  user_id: string | null;
  side: string | null;
  role: string | null;
  display_name: string | null;
}

export interface NeuronqQuestionRow {
  id: string;
  question: string | null;
  raw_text: string | null;
  reformulated_text: string | null;
  status: string | null;
  user_id: string | null;
  created_at: string | null;
}

/** Vue débat consolidée, prête pour l'UI. */
export interface ArenaSnapshot {
  session: LiveSessionRow | null;
  debate: DebateRow | null;
  rounds: DebateRoundRow[];
  teamA: DebateParticipantRow[];
  teamB: DebateParticipantRow[];
  scoreA: number;
  scoreB: number;
}

/** Texte affichable d'une question NeuronQ (web stocke selon plusieurs colonnes). */
export function neuronqText(q: NeuronqQuestionRow): string {
  return (
    q.reformulated_text?.trim() ||
    q.question?.trim() ||
    q.raw_text?.trim() ||
    'Question'
  );
}

/** Round courant borné [1, round_count]. */
export function currentRoundNumber(debate: DebateRow | null): number {
  if (!debate) return 1;
  return Math.min(
    Math.max(1, Number(debate.arena_current_round) || 1),
    Math.max(1, Number(debate.round_count) || 1),
  );
}

/** Le round courant est-il en phase de vote ouvert ? */
export function isVotingOpen(snapshot: ArenaSnapshot): boolean {
  const r = currentRoundNumber(snapshot.debate);
  const row = snapshot.rounds.find((x) => x.round_number === r);
  return row?.status === 'voting';
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectures
// ─────────────────────────────────────────────────────────────────────────────

/** Charge la session live. RLS : null si non connecté / hors tenant. */
export async function fetchSession(sessionId: string): Promise<LiveSessionRow | null> {
  if (!sessionId) return null;
  const { data, error } = await supabase
    .from('live_sessions')
    .select('id,title,status,debate_id,started_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return data as LiveSessionRow;
}

/** Charge les métadonnées du débat. */
export async function fetchDebate(debateId: string): Promise<DebateRow | null> {
  if (!debateId) return null;
  const { data, error } = await supabase
    .from('debates')
    .select(
      'id,title,status,round_count,arena_current_round,arena_active_side,arena_turn_deadline,neuronq_enabled,ai_judge_enabled,ai_weight',
    )
    .eq('id', debateId)
    .maybeSingle();
  if (error || !data) return null;
  return data as DebateRow;
}

/** Charge les rounds (scores). */
export async function fetchRounds(debateId: string): Promise<DebateRoundRow[]> {
  if (!debateId) return [];
  const { data, error } = await supabase
    .from('debate_rounds')
    .select('id,round_number,status,score_a,score_b,active_side')
    .eq('debate_id', debateId)
    .order('round_number', { ascending: true });
  if (error || !data) return [];
  return data as DebateRoundRow[];
}

/** Charge les participants (débatteurs) et les répartit par camp. */
export async function fetchParticipants(
  debateId: string,
): Promise<DebateParticipantRow[]> {
  if (!debateId) return [];
  const { data, error } = await supabase
    .from('debate_participants')
    .select('*')
    .eq('debate_id', debateId);
  if (error || !data) return [];
  return data as DebateParticipantRow[];
}

const sumScore = (rounds: DebateRoundRow[], key: 'score_a' | 'score_b'): number =>
  rounds.reduce((s, r) => s + (Number(r[key]) || 0), 0);

const sideOf = (p: DebateParticipantRow): string =>
  String(p.side ?? '').trim().toUpperCase();

/** Snapshot complet du débat à partir d'un sessionId. */
export async function fetchArenaSnapshot(sessionId: string): Promise<ArenaSnapshot> {
  const empty: ArenaSnapshot = {
    session: null,
    debate: null,
    rounds: [],
    teamA: [],
    teamB: [],
    scoreA: 0,
    scoreB: 0,
  };
  const session = await fetchSession(sessionId);
  if (!session) return empty;
  const debateId = session.debate_id ?? '';
  if (!debateId) return { ...empty, session };

  const [debate, rounds, participants] = await Promise.all([
    fetchDebate(debateId),
    fetchRounds(debateId),
    fetchParticipants(debateId),
  ]);

  return {
    session,
    debate,
    rounds,
    teamA: participants.filter((p) => sideOf(p) === 'A'),
    teamB: participants.filter((p) => sideOf(p) === 'B'),
    scoreA: sumScore(rounds, 'score_a'),
    scoreB: sumScore(rounds, 'score_b'),
  };
}

/** File NeuronQ initiale (ordre chronologique). */
export async function fetchNeuronqQuestions(
  sessionId: string,
): Promise<NeuronqQuestionRow[]> {
  if (!sessionId) return [];
  const { data, error } = await supabase
    .from('live_neuronq_questions')
    .select('id,question,raw_text,reformulated_text,status,user_id,created_at')
    .eq('live_session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error || !data) return [];
  return data as NeuronqQuestionRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Écritures (viewer)
// ─────────────────────────────────────────────────────────────────────────────

/** Identifiant de l'utilisateur connecté (null si session anonyme). */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Enregistre un vote du viewer dans live_session_signals.
 * Signal type 'debate_vote', payload = camp choisi (A / B / tie), avec le round.
 * RLS : nécessite une session connectée → false si anonyme ou en échec.
 */
export async function castVote(
  sessionId: string,
  round: number,
  choice: VoteChoice,
): Promise<boolean> {
  const uid = await currentUserId();
  if (!sessionId || !uid) return false;
  const { error } = await supabase.from('live_session_signals').insert({
    live_session_id: sessionId,
    user_id: uid,
    type: 'debate_vote',
    payload: { side: choice, round },
  });
  return !error;
}

/**
 * Soumet une question NeuronQ dans la file du live.
 * RLS : nécessite une session connectée → false sinon.
 */
export async function submitNeuronqQuestion(
  sessionId: string,
  question: string,
): Promise<boolean> {
  const uid = await currentUserId();
  const text = question.trim();
  if (!sessionId || !uid || !text) return false;
  const { error } = await supabase.from('live_neuronq_questions').insert({
    live_session_id: sessionId,
    question: text,
    user_id: uid,
  });
  return !error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token LiveKit (viewer = student, abonnement seul)
// ─────────────────────────────────────────────────────────────────────────────

export interface ViewerToken {
  token: string;
  room: string;
}

/** Token LiveKit rôle student pour rejoindre la room en spectateur. */
export async function fetchViewerToken(sessionId: string): Promise<ViewerToken | null> {
  if (!sessionId) return null;
  const res = await fetchLiveToken(sessionId, 'student');
  if (!res?.token) return null;
  return { token: res.token, room: res.room };
}

// ─────────────────────────────────────────────────────────────────────────────
// Realtime
// ─────────────────────────────────────────────────────────────────────────────

type Unsubscribe = () => void;

/**
 * Souscrit aux mises à jour du débat (round courant, camp actif, deadline)
 * et des rounds (scores / passage en vote). Rappelle `onChange` à chaque
 * événement pour déclencher un re-fetch léger côté écran.
 */
export function subscribeDebate(
  debateId: string,
  handlers: {
    onDebate?: (next: Partial<DebateRow>) => void;
    onRound?: (next: Partial<DebateRoundRow>) => void;
  },
): Unsubscribe {
  if (!debateId) return () => {};
  const channel = supabase
    .channel(`arena-debate-${debateId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'debates', filter: `id=eq.${debateId}` },
      (payload) => handlers.onDebate?.(payload.new as Partial<DebateRow>),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'debate_rounds',
        filter: `debate_id=eq.${debateId}`,
      },
      (payload) => handlers.onRound?.(payload.new as Partial<DebateRoundRow>),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Souscrit à la file NeuronQ (insert + update de statut). */
export function subscribeNeuronq(
  sessionId: string,
  handlers: {
    onInsert?: (row: NeuronqQuestionRow) => void;
    onUpdate?: (row: NeuronqQuestionRow) => void;
  },
): Unsubscribe {
  if (!sessionId) return () => {};
  const channel = supabase
    .channel(`arena-neuronq-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'live_neuronq_questions',
        filter: `live_session_id=eq.${sessionId}`,
      },
      (payload) => handlers.onInsert?.(payload.new as NeuronqQuestionRow),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_neuronq_questions',
        filter: `live_session_id=eq.${sessionId}`,
      },
      (payload) => handlers.onUpdate?.(payload.new as NeuronqQuestionRow),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
