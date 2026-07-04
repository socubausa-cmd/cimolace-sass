import { supabase } from '@/lib/customSupabaseClient';

/** @typedef {'idle'|'processing'|'draft_generated'|'needs_review'|'approved'|'published'} NeuroRecallWorkflowStatus */

export const NEURO_RECALL_WORKFLOW_LABELS = {
  idle: 'Non démarré',
  processing: 'Traitement…',
  draft_generated: 'Brouillon généré',
  needs_review: 'À relire',
  approved: 'Validé',
  published: 'Publié',
};

/**
 * URL du constructeur de cours post-prod (mindmap, transcript, chapitres) — réutilisation NeuroRecall.
 * Route STUDIO (contexte portail LIRI, coque LiriPortalShell) — surtout PAS `/owner-dashboard/*`
 * qui sort l'utilisateur du portail vers la chrome ISNA Academy.
 * @param {string} formationDayContentId — UUID `formation_day_contents.id`
 */
export function postProductionEditorPath(formationDayContentId) {
  return `/studio/post-production/${formationDayContentId}`;
}

export async function fetchNeuroRecallState(sessionId) {
  return supabase
    .from('live_neuro_recall_state')
    .select('*')
    .eq('live_session_id', sessionId)
    .maybeSingle();
}

export async function upsertNeuroRecallState(sessionId, patch) {
  return supabase.from('live_neuro_recall_state').upsert(
    {
      live_session_id: sessionId,
      ...patch,
    },
    { onConflict: 'live_session_id' },
  );
}

export async function countNeuroFlashcards(sessionId) {
  const { count, error } = await supabase
    .from('live_neuro_flashcards')
    .select('*', { count: 'exact', head: true })
    .eq('live_session_id', sessionId);
  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

export async function countNeuroReports(sessionId) {
  const { count, error } = await supabase
    .from('live_neuro_recall_reports')
    .select('*', { count: 'exact', head: true })
    .eq('live_session_id', sessionId);
  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

export async function listNeuroFlashcards(sessionId) {
  return supabase
    .from('live_neuro_flashcards')
    .select('id, question, answer, card_type, difficulty, topic, sort_order')
    .eq('live_session_id', sessionId)
    .order('sort_order', { ascending: true });
}

export async function listNeuroReports(sessionId) {
  return supabase
    .from('live_neuro_recall_reports')
    .select('id, node_key, title, content, updated_at')
    .eq('live_session_id', sessionId)
    .order('title', { ascending: true });
}

export async function fetchNeuroUserProgress(sessionId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { data: null, error: null };
  return supabase
    .from('live_neuro_user_progress')
    .select('*')
    .eq('live_session_id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle();
}

/**
 * @param {string} sessionId
 * @param {{ flashcards_correct?: number, flashcards_attempted?: number, comprehension_score?: number|null, weak_concepts?: unknown[], strong_concepts?: unknown[], extra?: object }} patch
 */
export async function upsertNeuroUserProgress(sessionId, patch) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { data: null, error: new Error('Non connecté') };
  return supabase
    .from('live_neuro_user_progress')
    .upsert(
      {
        user_id: user.id,
        live_session_id: sessionId,
        ...patch,
      },
      { onConflict: 'user_id,live_session_id' },
    )
    .select('*')
    .maybeSingle();
}
