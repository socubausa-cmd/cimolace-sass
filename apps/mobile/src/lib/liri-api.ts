import { Platform } from 'react-native';
import EventSource from 'react-native-sse';

/**
 * Client LIRI Brain (mobile). Transport SSE cross-platform :
 *  - Web (react-native-web) : fetch + ReadableStream (comme le chat web).
 *  - Natif (iOS/Android)    : react-native-sse (EventSource avec headers custom).
 *
 * Config via env publiques Expo (EXPO_PUBLIC_*). L'auth réelle (Supabase) viendra ;
 * en attendant, EXPO_PUBLIC_DEV_TOKEN permet de tester contre l'API.
 */
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4002').replace(/\/+$/, '');
export const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'isna';
export const DEV_TOKEN = process.env.EXPO_PUBLIC_DEV_TOKEN ?? '';
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export const hasToken = () => DEV_TOKEN.length > 0;

const authHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  'X-Tenant-Slug': TENANT_SLUG,
});

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface BrainHandlers {
  onToken: (delta: string) => void;
  onToolConfirm?: (payload: unknown) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/** Stream une réponse LIRI Brain. Retourne une fonction d'annulation. */
export function streamBrain(
  opts: { message: string; conversationId?: string; model?: string; token?: string },
  h: BrainHandlers,
): () => void {
  const token = opts.token ?? DEV_TOKEN;
  const model = opts.model ?? DEFAULT_MODEL;
  const qs = new URLSearchParams({ message: opts.message, model, tools: '1' });
  if (opts.conversationId) qs.set('conversationId', opts.conversationId);
  const url = `${API_BASE}/liri/brain/chat?${qs.toString()}`;
  const headers = authHeaders(token);

  // Renvoie true quand le flux est terminé (done).
  const consume = (raw: string | null | undefined): boolean => {
    if (!raw) return false;
    let obj: { content?: string; done?: boolean };
    try {
      obj = JSON.parse(raw);
    } catch {
      return false;
    }
    if (obj.content) {
      let confirm: { type?: string } | null = null;
      try {
        const inner = JSON.parse(obj.content);
        if (inner && inner.type === 'tool_confirm') confirm = inner;
      } catch {
        /* contenu texte normal */
      }
      if (confirm) h.onToolConfirm?.(confirm);
      else h.onToken(obj.content);
    }
    if (obj.done) {
      h.onDone();
      return true;
    }
    return false;
  };

  // ── Web : fetch streaming ──
  if (Platform.OS === 'web') {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch(url, { headers, signal: ctrl.signal });
        if (!res.ok || !res.body) {
          h.onError(`HTTP ${res.status}`);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buf.indexOf('\n\n')) >= 0) {
            const evt = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            const data = evt
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(l.indexOf(':') + 1).trim())
              .join('');
            if (consume(data)) {
              ctrl.abort();
              return;
            }
          }
        }
        h.onDone();
      } catch (e) {
        const err = e as { name?: string; message?: string };
        if (err?.name !== 'AbortError') h.onError(String(err?.message ?? e));
      }
    })();
    return () => ctrl.abort();
  }

  // ── Natif : react-native-sse ──
  const es = new EventSource(url, { headers, method: 'GET' });
  const close = () => {
    try {
      es.removeAllEventListeners();
      es.close();
    } catch {
      /* noop */
    }
  };
  es.addEventListener('message', (event) => {
    if (consume((event as { data?: string }).data)) close();
  });
  es.addEventListener('error', (event) => {
    h.onError((event as { message?: string }).message ?? 'Connexion interrompue');
    close();
  });
  return close;
}

/** Persiste le transcript (mémoire entre tours). Retourne l'id de conversation. */
export async function saveConversation(opts: {
  conversationId?: string;
  model?: string;
  title?: string;
  messages: ChatMsg[];
  token?: string;
}): Promise<string | undefined> {
  const token = opts.token ?? DEV_TOKEN;
  try {
    const res = await fetch(`${API_BASE}/liri/brain/conversations`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: opts.conversationId,
        model: opts.model ?? DEFAULT_MODEL,
        title: opts.title ?? '',
        messages: opts.messages,
      }),
    });
    if (!res.ok) return opts.conversationId;
    const json: unknown = await res.json();
    const data = (json as { data?: { id?: string }; id?: string })?.data ?? (json as { id?: string });
    return data?.id ?? opts.conversationId;
  } catch {
    return opts.conversationId;
  }
}
