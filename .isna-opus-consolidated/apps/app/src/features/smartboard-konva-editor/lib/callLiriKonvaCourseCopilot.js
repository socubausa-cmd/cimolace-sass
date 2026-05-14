import { supabase } from '@/lib/customSupabaseClient';
import { invokeFunctionWithAuthRetry } from '@/lib/supabaseResilience';

/**
 * Appelle l’Edge Function Supabase `liri-konva-course-copilot` (JWT session).
 * Utilise `invokeFunctionWithAuthRetry` : session proche de l’expiration rafraîchie, puis nouvel essai si 401.
 * Sans compte valide → null (pas d’appel) ; échec après retry → fallback `analyzeCourseDocumentLocal`.
 * @param {string} sourceText
 * @param {{ lang?: 'fr' | 'en' }} [opts]
 * @returns {Promise<{ course: unknown; provider?: string } | null>}
 */
export async function tryAnalyzeCourseWithCopilot(sourceText, opts = {}) {
  const trimmed = (sourceText || '').trim();
  if (!trimmed) return null;

  // Valide le JWT côté serveur — évite un 401 si la session locale est expirée / incohérente.
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return null;

  const { data, error } = await invokeFunctionWithAuthRetry(supabase, 'liri-konva-course-copilot', {
    body: { sourceText: trimmed, lang: opts.lang ?? 'fr' },
  });

  if (error) return null;
  if (!data || typeof data !== 'object' || data.course == null) return null;
  return { course: data.course, provider: data.provider };
}
