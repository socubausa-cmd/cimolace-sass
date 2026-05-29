import { invokeStudioLongiaChat } from '@/lib/studioLongiaChat';
import { streamStudioLongiaChat } from '@/lib/streamStudioLongiaChat';
import { attachLongiaHubToContext } from '@/lib/longiaHub/schema';

/**
 * Point d'entrée unique LONGIA Hub — enveloppe le contexte avec `longia_hub` puis délègue à `studio-longia-chat*`.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} opts
 * @param {'coach'|'architect'} opts.mode
 * @param {{ role: 'user'|'assistant'; content: string }[]} opts.messages
 * @param {Record<string, unknown>} [opts.context]
 * @param {Record<string, unknown>|null} [opts.longiaHub] — si fourni, fusionné dans `context` (sinon `context.longia_hub` doit déjà exister)
 * @see `@/lib/longiaHub/intent` (`longia_captured_intent`) · `@/lib/longiaHub/events` (`longia_event_signal`, strip Edge)
 * @param {boolean} [opts.useRag]
 * @param {AbortSignal} [opts.signal]
 * @param {(chunk: string) => void} [opts.onChunk]
 * @param {(meta?: Record<string, unknown>) => void} [opts.onDone]
 * @param {(err: Error) => void} [opts.onError]
 */
export async function streamLongiaHub(supabase, opts) {
  const { mode, messages, context = {}, longiaHub, useRag, signal, onChunk, onDone, onError } = opts;
  const merged =
    longiaHub && typeof longiaHub === 'object'
      ? attachLongiaHubToContext(context, longiaHub)
      : context;
  return streamStudioLongiaChat({
    supabase,
    mode: mode || 'coach',
    messages,
    context: merged,
    useRag,
    signal,
    onChunk,
    onDone,
    onError,
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} opts
 * @param {'coach'|'architect'} opts.mode
 * @param {{ role: 'user'|'assistant'; content: string }[]} opts.messages
 * @param {Record<string, unknown>} [opts.context]
 * @param {Record<string, unknown>|null} [opts.longiaHub]
 * @param {boolean} [opts.useRag]
 */
export async function invokeLongiaHub(supabase, opts) {
  const { mode, messages, context = {}, longiaHub, useRag } = opts;
  const merged =
    longiaHub && typeof longiaHub === 'object'
      ? attachLongiaHubToContext(context, longiaHub)
      : context;
  return invokeStudioLongiaChat(supabase, {
    mode: mode || 'coach',
    messages,
    context: merged,
    useRag,
  });
}
