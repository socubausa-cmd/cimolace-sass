/**
 * Client LIRI multilingue — listes (PostgREST + RLS) et création via Edge (JWT utilisateur).
 */

const T_LIVE = 'liri_multilang_live_sessions';
const T_VIDEO = 'liri_multilang_video_projects';

export function estimateLiveCredits({ targetLangs = [], estimatedMinutes = 60, participants = 1 } = {}) {
  const l = Math.max(1, Array.isArray(targetLangs) && targetLangs.length ? targetLangs.length : 1);
  const m = Math.min(480, Math.max(1, Math.floor(Number(estimatedMinutes) || 60)));
  const p = Math.min(500, Math.max(1, Math.floor(Number(participants) || 1)));
  return Math.min(50000, m * p * l);
}

export function estimateVideoCredits({ targetLangs = [], durationMinutes = 10 } = {}) {
  const l = Math.max(1, Array.isArray(targetLangs) && targetLangs.length ? targetLangs.length : 1);
  const d = Math.min(600, Math.max(1, Math.floor(Number(durationMinutes) || 10)));
  return Math.min(100000, d * l * 8);
}

export function parseLangList(commaSeparated) {
  return String(commaSeparated || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase().slice(0, 12))
    .filter(Boolean)
    .slice(0, 12);
}

export async function listLiveSessions(supabase) {
  return supabase.from(T_LIVE).select('*').order('created_at', { ascending: false }).limit(40);
}

export async function listVideoProjects(supabase) {
  return supabase.from(T_VIDEO).select('*').order('created_at', { ascending: false }).limit(40);
}

export async function startLiveSessionEdge(supabase, body) {
  return supabase.functions.invoke('liri-multilang-live', { body });
}

export async function createVideoProjectEdge(supabase, body) {
  return supabase.functions.invoke('liri-multilang-video', { body });
}

const T_VT = 'liri_multilang_video_translations';

/** Récupère toutes les traductions d'un projet vidéo. */
export async function fetchVideoTranslations(supabase, projectId) {
  if (!projectId) return { data: [], error: new Error('projectId requis') };
  return supabase
    .from(T_VT)
    .select('target_lang, lines')
    .eq('project_id', projectId);
}

/** Enregistre les lignes traduites (upsert par projet + langue). */
export async function upsertVideoTranslations(supabase, projectId, targetLang, lines) {
  const tl = String(targetLang || '').toLowerCase().slice(0, 12);
  if (!projectId || !tl) return { data: null, error: new Error('projectId et targetLang requis') };
  return supabase.from(T_VT).upsert(
    {
      project_id: projectId,
      target_lang: tl,
      lines: Array.isArray(lines) ? lines : [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,target_lang' },
  );
}
