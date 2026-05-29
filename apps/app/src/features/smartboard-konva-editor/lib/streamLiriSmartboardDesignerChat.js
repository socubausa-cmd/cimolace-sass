import { supabase } from '@/lib/customSupabaseClient';
import { ensureFreshSession } from '@/lib/supabaseResilience';

const FN = 'liri-smartboard-designer-chat';

/**
 * @deprecated Préférer `streamLongiaHub` avec `context: { designer_konva_assist: true, lang, … }`
 * (pipeline unifié `studio-longia-chat-stream`). Conservé pour compatibilité / clients legacy.
 *
 * Appelle l'Edge Function `liri-smartboard-designer-chat` (SSE) avec le JWT session.
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} [opts.supabase] — même client que l'UI (URL/clé/session, ex. émulateur Android)
 * @param {{ role: 'user' | 'assistant'; content: string }[]} opts.messages
 * @param {Record<string, unknown>} [opts.context]
 * @param {Record<string, unknown>} [opts.coachArchitectHandoff] — fusionné dans `context.coach_architect_handoff` (validé côté Edge)
 * @param {'fr'|'en'} [opts.lang]
 * @param {AbortSignal} [opts.signal]
 * @param {(chunk: string) => void} [opts.onChunk]
 * @param {() => void} [opts.onDone]
 * @param {(err: Error) => void} [opts.onError]
 */
export async function streamLiriSmartboardDesignerChat(opts) {
  const {
    supabase: supabaseFromOpts,
    messages,
    context,
    coachArchitectHandoff,
    lang = 'fr',
    signal,
    onChunk,
    onDone,
    onError,
  } = opts;

  const sb = supabaseFromOpts || supabase;

  const mergedContext =
    context && typeof context === 'object' && !Array.isArray(context)
      ? coachArchitectHandoff != null &&
          typeof coachArchitectHandoff === 'object' &&
          !Array.isArray(coachArchitectHandoff)
        ? { ...context, coach_architect_handoff: coachArchitectHandoff }
        : context
      : coachArchitectHandoff != null &&
          typeof coachArchitectHandoff === 'object' &&
          !Array.isArray(coachArchitectHandoff)
        ? { coach_architect_handoff: coachArchitectHandoff }
        : context;

  const supabaseUrl = String(sb?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = sb?.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    onError?.(new Error('Supabase non configuré.'));
    return;
  }

  await ensureFreshSession(sb, 300);
  const { error: userErr } = await sb.auth.getUser();
  if (userErr) {
    await sb.auth.refreshSession();
    await ensureFreshSession(sb, 300);
  }

  let { data: { session } } = await sb.auth.getSession();
  let token = session?.access_token || '';
  if (!token) {
    onError?.(new Error('Connectez-vous pour utiliser le Copilot designer.'));
    return;
  }

  const body = JSON.stringify({ messages, context: mergedContext, lang });

  const baseHeaders = {
    'Content-Type': 'application/json',
    apikey: anonKey,
  };

  /** Passe la vérif JWT à l'ingress : Bearer = clé anon ; session utilisateur dans x-user-jwt. */
  function doFetchIngressAnon(userAccessToken) {
    return fetch(`${supabaseUrl}/functions/v1/${FN}`, {
      method: 'POST',
      headers: {
        ...baseHeaders,
        Authorization: `Bearer ${anonKey}`,
        'x-user-jwt': userAccessToken,
      },
      body,
      signal,
    });
  }

  /** Si l'ingress a verify_jwt désactivé : même schéma que le client JS officiel (Bearer = session). */
  function doFetchUserBearer(userAccessToken) {
    return fetch(`${supabaseUrl}/functions/v1/${FN}`, {
      method: 'POST',
      headers: {
        ...baseHeaders,
        Authorization: `Bearer ${userAccessToken}`,
      },
      body,
      signal,
    });
  }

  let res = await doFetchIngressAnon(token);
  if (res.status === 401) {
    await sb.auth.refreshSession();
    await ensureFreshSession(sb, 300);
    const s2 = await sb.auth.getSession();
    token = s2?.data?.session?.access_token || '';
    if (!token) {
      onError?.(new Error('Session expirée. Reconnectez-vous.'));
      return;
    }
    res = await doFetchIngressAnon(token);
  }
  // Dernier recours : ingress sans vérif JWT (après déploiement --no-verify-jwt) + Bearer session.
  if (res.status === 401) {
    res = await doFetchUserBearer(token);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let msg = raw?.trim() || `Erreur HTTP ${res.status}`;
    if (raw) {
      try {
        const j = JSON.parse(raw);
        if (j && typeof j === 'object') {
          if (j.error != null) msg = String(j.error);
          else if (j.message != null) msg = String(j.message);
          if (j.details != null) {
            const d = typeof j.details === 'string' ? j.details : JSON.stringify(j.details);
            msg = `${msg} — ${d}`;
          }
        }
      } catch {
        if (raw.length < 600) msg = raw;
        else msg = `${msg.slice(0, 200)}…`;
      }
    }
    if (res.status === 400 && /coach_architect_handoff|handoff/i.test(msg)) {
      msg = `Handoff Coach→Architect refusé par le serveur : ${msg}`;
    }
    if (res.status === 401 && /Invalid JWT/i.test(msg)) {
      msg = `${msg} — Côté projet Supabase, la fonction doit être déployée avec JWT désactivé à l'ingress : ex. npm run deploy:edge:liri-smartboard-designer-chat (ou Dashboard → Edge Functions → désactiver « Enforce JWT » pour cette fonction).`;
    }
    onError?.(new Error(msg));
    return;
  }

  if (!res.body) {
    onError?.(new Error('Réponse vide.'));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
            onDone?.();
            return;
          }
          if (typeof o.text === 'string' && o.text.length) onChunk?.(o.text);
        }
      }
    }
    onDone?.();
  } catch (e) {
    if (signal?.aborted) return;
    onError?.(e instanceof Error ? e : new Error(String(e)));
  }
}
