import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { ensureFreshSession, invokeFunctionWithAuthRetry } from '@/lib/supabaseResilience';

/**
 * Appelle `liri-smartboard-vision-describe` (JWT).
 * @param {{ imageDataUrl: string; centralIdea?: string; lang?: string }} opts
 * @returns {Promise<{ description: string; provider?: string } | null>}
 */
export async function callLiriSmartboardVisionDescribe(opts) {
  const { imageDataUrl, centralIdea = '', lang = 'fr' } = opts || {};
  const raw = String(imageDataUrl || '').trim();
  if (!raw) return null;

  let imageBase64 = raw;
  let mimeType = 'image/jpeg';
  const m = raw.match(/^data:([^;]+);base64,(.+)$/is);
  if (m) {
    mimeType = m[1] || mimeType;
    imageBase64 = m[2].replace(/\s/g, '');
  }

  await ensureFreshSession(supabase, 300);
  const { data, error } = await invokeFunctionWithAuthRetry(supabase, 'liri-smartboard-vision-describe', {
    body: { imageBase64, mimeType, centralIdea, lang },
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
  return { description, provider: data.provider };
}
