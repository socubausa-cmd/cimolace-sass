import { supabase } from '@/lib/customSupabaseClient';

export async function getBlueprint(liveSessionId) {
  return supabase.from('live_blueprints').select('*').eq('live_session_id', liveSessionId).maybeSingle();
}

export async function upsertBlueprint(liveSessionId, payload) {
  const row = {
    live_session_id: liveSessionId,
    outline_json: payload.outline_json ?? {},
    goals_json: payload.goals_json ?? {},
    private_notes: payload.private_notes ?? null,
    estimated_duration_minutes: payload.estimated_duration_minutes ?? null,
  };
  // key_points_json / blueprint_score sont posés par le publish Master Factory ;
  // l'autosave du studio ne les fournit pas. On ne les envoie à l'upsert QUE s'ils
  // sont explicitement fournis (undefined = champ omis → la valeur en base est
  // conservée au lieu d'être écrasée par []/null).
  if (payload.key_points_json !== undefined) row.key_points_json = payload.key_points_json;
  if (payload.blueprint_score !== undefined) row.blueprint_score = payload.blueprint_score;

  return supabase.from('live_blueprints').upsert(row, { onConflict: 'live_session_id' }).select().single();
}
