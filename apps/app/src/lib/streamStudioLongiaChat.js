import { supabase } from '@/lib/customSupabaseClient';
import { ensureFreshSession } from '@/lib/supabaseResilience';
import { ensureDefaultLongiaHubInContext } from '@/lib/longiaHub/schema';

const FN = 'studio-longia-chat-stream';

/**
 * LONGIA — streaming SSE (Edge `studio-longia-chat-stream`).
 * Enrichit `context` avec `longia_hub` par défaut si absent ; préférer `streamLongiaHub` pour un hub explicite par surface.
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} [opts.supabase] — défaut : client app
 * @param {'coach'|'architect'} opts.mode
 * @param {{ role: 'user' | 'assistant'; content: string }[]} opts.messages
 * @param {Record<string, unknown>} [opts.context]
 * @param {boolean} [opts.useRag]
 * @param {AbortSignal} [opts.signal]
 * @param {(chunk: string) => void} [opts.onChunk]
 * @param {(meta?: Record<string, unknown>) => void} [opts.onDone]
 * @param {(err: Error) => void} [opts.onError]
 */
export async function streamStudioLongiaChat(opts) {
  const {
    supabase: sb = supabase,
    mode,
    messages,
    context,
    useRag = false,
    signal,
    onChunk,
    onDone,
    onError,
  } = opts;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    onError?.(new Error('Supabase non configuré.'));
    return;
  }

  await ensureFreshSession(sb, 300);
  let {
    data: { session },
  } = await sb.auth.getSession();
  let token = session?.access_token || '';
  if (!token) {
    onError?.(new Error('Connectez-vous pour utiliser LONGIA.'));
    return;
  }

  const ctxForBody = ensureDefaultLongiaHubInContext(
    mode === 'architect' ? 'architect' : 'coach',
    context ?? {},
    !!useRag,
  );
  const body = JSON.stringify({
    mode: mode || 'coach',
    messages,
    context: ctxForBody,
    useRag: !!useRag,
  });

  async function doFetch(access) {
    return fetch(`${supabaseUrl}/functions/v1/${FN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${access}`,
      },
      body,
      signal,
    });
  }

  let res = await doFetch(token);
  if (res.status === 401) {
    await sb.auth.refreshSession();
    await ensureFreshSession(sb, 300);
    const s2 = await sb.auth.getSession();
    token = s2?.data?.session?.access_token || '';
    if (!token) {
      onError?.(new Error('Session expirée. Reconnectez-vous.'));
      return;
    }
    res = await doFetch(token);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    onError?.(new Error(raw?.trim() || `Erreur HTTP ${res.status}`));
    return;
  }

  if (!res.body) {
    onError?.(new Error('Réponse vide.'));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let routingMeta = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        for (const line of block.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;
          let o;
          try {
            o = JSON.parse(jsonStr);
          } catch {
            continue;
          }
          if (o.error) {
            onError?.(new Error(String(o.error)));
            return;
          }
          if (o.done) {
            if (o.routing && typeof o.routing === 'object') routingMeta = o.routing;
            onDone?.(routingMeta || undefined);
            return;
          }
          if (typeof o.text === 'string' && o.text.length) onChunk?.(o.text);
        }
      }
    }
    onDone?.(routingMeta || undefined);
  } catch (e) {
    if (signal?.aborted) return;
    onError?.(e instanceof Error ? e : new Error(String(e)));
  }
}
