import { supabase } from '@/lib/customSupabaseClient';

export async function listContents(liveSessionId) {
  return supabase
    .from('live_contents')
    .select('*')
    .eq('live_session_id', liveSessionId)
    .order('created_at', { ascending: true });
}

export async function insertContent(liveSessionId, item) {
  return supabase
    .from('live_contents')
    .insert({
      live_session_id: liveSessionId,
      content_type: item.content_type ?? 'text',
      title: item.title ?? null,
      asset_url: item.asset_url ?? null,
      content_json: item.content_json ?? {},
    })
    .select()
    .single();
}
