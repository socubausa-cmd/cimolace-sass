import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';

/**
 * @typedef {'light' | 'medium' | 'deep' | 'full'} ArchitectTier
 */

/**
 * Appelle l'Edge Function Supabase `liri-coach-slide` (JWT session), mode coach.
 * @param {string} slideContent — texte du slide ou extrait à analyser
 * @param {{ lang?: 'fr' | 'en'; context?: string }} [opts]
 * @returns {Promise<{ analysis: string; score?: number; coachTier?: ArchitectTier; provider?: string } | null>}
 */
export async function tryCoachSlideAnalysis(slideContent, opts = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.access_token) return null;

  const trimmed = (slideContent || '').trim();
  if (!trimmed) return null;

  const { data, error } = await supabase.functions.invoke('liri-coach-slide', {
    body: {
      slideContent: trimmed,
      lang: opts.lang ?? 'fr',
      ...(opts.context ? { context: String(opts.context).slice(0, 12000) } : {}),
    },
  });

  if (error) return null;
  if (!data || typeof data !== 'object' || typeof data.analysis !== 'string') return null;
  const out = {
    analysis: data.analysis,
    provider: data.provider,
  };
  if (typeof data.score === 'number' && !Number.isNaN(data.score)) {
    out.score = Math.min(100, Math.max(0, data.score));
  }
  if (data.coachTier === 'light' || data.coachTier === 'medium' || data.coachTier === 'deep' || data.coachTier === 'full') {
    out.coachTier = data.coachTier;
  }
  return out;
}

/**
 * Agent Architect (J4) — redesign selon profondeur (score coach ou palier forcé).
 * @param {string} slideContent
 * @param {{
 *   lang?: 'fr' | 'en';
 *   context?: string;
 *   coachScore?: number;
 *   architectTier?: ArchitectTier;
 *   coachArchitectHandoff?: Record<string, unknown>
 * }} [opts] — JSON v1 (`design_update`) validé côté Edge ; si `architectTier` est défini, il prime sur le palier du handoff / score
 * @returns {Promise<{ analysis: string; architectTier?: ArchitectTier; coachHandoffValidated?: boolean; provider?: string } | null>}
 */
export async function tryArchitectRedesign(slideContent, opts = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.access_token) return null;

  const trimmed = (slideContent || '').trim();
  if (!trimmed) return null;

  const body = {
    mode: 'architect',
    slideContent: trimmed,
    lang: opts.lang ?? 'fr',
    ...(opts.context ? { context: String(opts.context).slice(0, 12000) } : {}),
    ...(typeof opts.coachScore === 'number' && !Number.isNaN(opts.coachScore)
      ? { coachScore: Math.min(100, Math.max(0, opts.coachScore)) }
      : {}),
    ...(opts.architectTier ? { architectTier: opts.architectTier } : {}),
    ...(opts.coachArchitectHandoff && typeof opts.coachArchitectHandoff === 'object'
      ? { coachArchitectHandoff: opts.coachArchitectHandoff }
      : {}),
  };

  const { data, error } = await supabase.functions.invoke('liri-coach-slide', {
    body,
  });

  if (error) {
    const msg = await getSupabaseFunctionErrorMessage(error);
    throw new Error(msg);
  }
  if (!data || typeof data !== 'object' || typeof data.analysis !== 'string') {
    if (data && typeof data === 'object' && data.error != null) {
      throw new Error(String(data.error));
    }
    return null;
  }
  const out = { analysis: data.analysis, provider: data.provider };
  if (data.architectTier === 'light' || data.architectTier === 'medium' || data.architectTier === 'deep' || data.architectTier === 'full') {
    out.architectTier = data.architectTier;
  }
  if (typeof data.coachHandoffValidated === 'boolean') {
    out.coachHandoffValidated = data.coachHandoffValidated;
  }
  return out;
}
