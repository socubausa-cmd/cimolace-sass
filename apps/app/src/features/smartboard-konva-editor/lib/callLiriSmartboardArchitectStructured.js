import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { ensureFreshSession, invokeFunctionWithAuthRetry } from '@/lib/supabaseResilience';

/**
 * @param {{ assistantText: string; centralIdea?: string; lang?: string }} opts
 * @returns {Promise<{ items: { id: string; title: string; detail: string; kind?: string }[]; provider?: string } | null>}
 */
export async function callLiriSmartboardArchitectStructured(opts) {
  const { assistantText, centralIdea = '', lang = 'fr' } = opts || {};
  const text = String(assistantText || '').trim();
  if (text.length < 20) return null;

  await ensureFreshSession(supabase, 300);
  const { data, error } = await invokeFunctionWithAuthRetry(supabase, 'liri-smartboard-architect-structured', {
    body: { assistantText: text, centralIdea, lang },
  });

  if (error) {
    const msg = await getSupabaseFunctionErrorMessage(error);
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && data.error != null && !Array.isArray(data.items)) {
    return null;
  }
  if (!data?.items || !Array.isArray(data.items)) return null;
  const ok = data.ok !== false;
  const skipped = data.skipped === true;
  if (!ok && skipped) {
    return {
      items: [],
      provider: data.provider,
      skipped: true,
      error: data.error || null,
    };
  }
  return { items: data.items, provider: data.provider, ok: true };
}
