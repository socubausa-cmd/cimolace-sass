/**
 * Sessions live « production » (table live_sessions — booking / studio).
 */
import { supabase } from '@/lib/customSupabaseClient';

export async function getLiveSession(sessionId) {
  if (!sessionId) return { data: null, error: new Error('sessionId manquant') };
  return supabase.from('live_sessions').select('*').eq('id', sessionId).maybeSingle();
}

export async function createDraftLiveSession({
  title = 'Nouveau live',
  productionLiveType = 'cours',
  roomMode = 'secret_classroom',
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('Non authentifié') };

  const scheduledAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  return supabase
    .from('live_sessions')
    .insert({
      teacher_id: user.id,
      title,
      session_type: 'conference_live',
      scheduled_at: scheduledAt,
      status: 'draft',
      visibility_mode: 'secret',
      production_live_type: productionLiveType,
      preparation_status: 'draft',
      room_mode: roomMode,
    })
    .select()
    .single();
}

export async function updateLiveSession(sessionId, patch) {
  if (!sessionId) return { data: null, error: new Error('sessionId manquant') };
  return supabase.from('live_sessions').update(patch).eq('id', sessionId).select().single();
}
