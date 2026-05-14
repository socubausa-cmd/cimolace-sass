import { invokeSupabaseFunction } from '@/lib/supabaseEdgeInvoke';
import { ensureDefaultLongiaHubInContext } from '@/lib/longiaHub/schema';

/**
 * Chat LONGIA (AI Hub) — coach rapide vs architect lourd.
 * Toujours enrichit `context` avec `longia_hub` si absent (voir `@/lib/longiaHub` — préférer `invokeLongiaHub` pour un hub explicite par surface).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   mode: 'coach' | 'architect';
 *   messages: Array<{ role: 'user' | 'assistant'; content: string }>;
 *   context?: Record<string, unknown>;
 *   useRag?: boolean;
 * }} params
 * @returns {Promise<{
 *   text: string;
 *   suggestions?: Array<{ label: string; action: string; payload?: Record<string, unknown> }>;
 *   primaryActions?: Array<{ label: string; action: string; payload?: Record<string, unknown> }>;
 *   secondarySuggestions?: Array<{ label: string; action: string; payload?: Record<string, unknown> }>;
 *   unified?: {
 *     message: string;
 *     understanding?: Record<string, unknown> | null;
 *     actions: unknown[];
 *     suggestions: unknown[];
 *     preview?: string | null;
 *     explanations?: string | string[] | null;
 *     // understanding.longia_core : { studio_context, intent_resolution?, longia_pro_pack?, pipeline, routing }
 *     // longia_pro_pack : pré-analyse déterministe FULL_LONGIA_PRO (intent, tone_mode, actions de référence)
 *     // pipeline peut inclure intent_resolver_groq (coach) ou intent_resolver_skipped_architect_main_llm / _env / _trivial
 *   };
 *   intent?: Record<string, unknown> | null;
 *   strategy?: string | null;
 *   payload?: Record<string, unknown> | null;
 *   tone_mode?: string | null;
 *   routing?: { requestedMode: string; effectiveMode: string; routingReason: string };
 *   composed?: Record<string, unknown>;
 *   provider?: string;
 *   mode?: string;
 * }>}
 */
export async function invokeStudioLongiaChat(supabase, params) {
  const { mode, messages, context, useRag } = params;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages requis');
  }
  const ctxForBody = ensureDefaultLongiaHubInContext(
    mode === 'architect' ? 'architect' : 'coach',
    context ?? {},
    useRag === true,
  );
  return invokeSupabaseFunction(supabase, 'studio-longia-chat', {
    body: { mode, messages, context: ctxForBody, useRag: useRag === true },
  });
}
