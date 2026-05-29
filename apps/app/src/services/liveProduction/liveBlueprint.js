import { supabase } from '@/lib/customSupabaseClient';

export async function getBlueprint(liveSessionId) {
  return supabase.from('live_blueprints').select('*').eq('live_session_id', liveSessionId).maybeSingle();
}

export async function upsertBlueprint(liveSessionId, payload) {
  const row = {
    live_session_id: liveSessionId,
    outline_json: payload.outline_json ?? {},
    goals_json: payload.goals_json ?? {},
    key_points_json: payload.key_points_json ?? [],
    private_notes: payload.private_notes ?? null,
    estimated_duration_minutes: payload.estimated_duration_minutes ?? null,
    blueprint_score: payload.blueprint_score ?? null,
  };

  return supabase.from('live_blueprints').upsert(row, { onConflict: 'live_session_id' }).select().single();
}
