import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { ensureFreshSession, invokeFunctionWithAuthRetry } from '@/lib/supabaseResilience';

/**
 * @param {{ voice?: string; instructions?: string }} [opts]
 * @returns {Promise<{ ok: true; client_secret: unknown; expires_at?: string; model?: string } | { error: { code: string; message: string } }>}
 */
export async function callLiriDesignerVoiceRealtimeSession(opts = {}) {
  await ensureFreshSession(supabase, 300);
  const { data, error } = await invokeFunctionWithAuthRetry(supabase, 'liri-designer-voice-realtime-session', {
    body: opts,
  });
  if (error) {
    const msg = await getSupabaseFunctionErrorMessage(error);
    return { error: { code: 'INVOKE_FAILED', message: msg } };
  }
  if (data?.error) {
    return { error: data.error };
  }
  return data;
}
