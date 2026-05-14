import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { ensureFreshSession, invokeFunctionWithAuthRetry } from '@/lib/supabaseResilience';

/**
 * Analyse un segment vidéo déjà dans Storage (`liri-vision-temp`) via Edge + Gemini.
 * @param {{ storagePath: string; centralIdea?: string; lang?: string; deleteAfter?: boolean }} opts
 * @returns {Promise<{ description: string; provider?: string; model?: string } | null>}
 */
export async function callLiriSmartboardVisionSegment(opts) {
  const { storagePath, centralIdea = '', lang = 'fr', deleteAfter = true } = opts || {};
  const path = String(storagePath || '').trim();
  if (!path) return null;

  await ensureFreshSession(supabase, 300);
  const { data, error } = await invokeFunctionWithAuthRetry(supabase, 'liri-smartboard-vision-segment', {
    body: { storagePath: path, centralIdea, lang, deleteAfter },
  });

  if (error) {
    const msg = await getSupabaseFunctionErrorMessage(error);
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && data.error != null) {
    throw new Error(String(data.error));
  }
  if (!data || typeof data !== 'object') return null;
  const description = String(data.description || '').trim();
  if (!description) return null;
  return { description, provider: data.provider, model: data.model };
}
