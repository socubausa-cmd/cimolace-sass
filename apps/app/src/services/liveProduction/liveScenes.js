import { supabase } from '@/lib/customSupabaseClient';

export async function listScenes(liveSessionId) {
  return supabase
    .from('live_scenes')
    .select('*')
    .eq('live_session_id', liveSessionId)
    .order('order_index', { ascending: true });
}

export async function upsertScene(liveSessionId, scene) {
  const base = {
    live_session_id: liveSessionId,
    name: scene.name ?? 'Scène',
    scene_type: scene.scene_type ?? 'camera_only',
    order_index: scene.order_index ?? 0,
    content_payload_json: scene.content_payload_json ?? {},
    is_preset: scene.is_preset ?? false,
    preset_name: scene.preset_name ?? null,
    is_active: scene.is_active ?? false,
  };
  if (scene.id) {
    return supabase.from('live_scenes').update(base).eq('id', scene.id).select().single();
  }
  return supabase.from('live_scenes').insert(base).select().single();
}

export async function deleteScene(sceneId) {
  return supabase.from('live_scenes').delete().eq('id', sceneId);
}

/** Supprime toutes les scènes d'une session (ex. avant réimport constructeur). */
export async function deleteScenesForLiveSession(liveSessionId) {
  return supabase.from('live_scenes').delete().eq('live_session_id', liveSessionId);
}
