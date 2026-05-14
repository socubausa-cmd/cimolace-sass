/**
 * Appel HTTP au routeur LIRI Brain (SSE) depuis le navigateur.
 *
 * Définissez `VITE_LIRI_BRAIN_URL` (URL absolue du worker qui expose POST équivalent à `route.ts`)
 * ou `VITE_USE_LIRI_BRAIN=true` pour viser `/api/liri/brain` (proxy Vite → Netlify dev si configuré).
 */

import type { BrainRouteInput, LiriStructuredOutput } from './types';

export function resolveLiriBrainEndpoint(): string | null {
  const raw = import.meta.env?.VITE_LIRI_BRAIN_URL as string | undefined;
  if (raw === '0' || raw === 'false') return null;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (import.meta.env?.VITE_USE_LIRI_BRAIN === 'true') return '/api/liri/brain';
  return null;
}

export async function invokeLiriBrainStream(
  endpoint: string,
  input: BrainRouteInput,
  init?: RequestInit,
): Promise<{ answer: string; structured: LiriStructuredOutput | null }> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    body: JSON.stringify({ ...input, stream: true }),
    ...init,
  });

  if (!res.ok) {
    const errJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errJson?.error || `LIRI Brain HTTP ${res.status}`);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const j = (await res.json()) as {
      answer?: string;
      structured?: LiriStructuredOutput | null;
    };
    return {
      answer: j.answer ?? j.structured?.answer ?? '',
      structured: j.structured ?? null,
    };
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('LIRI Brain : flux vide');

  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let structured: LiriStructuredOutput | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      try {
        const evt = JSON.parse(jsonStr) as {
          type?: string;
          text?: string;
          structured?: LiriStructuredOutput;
          message?: string;
        };
        if (evt.type === 'token' && evt.text) accumulated += evt.text;
        if (evt.type === 'done' && evt.structured) structured = evt.structured;
        if (evt.type === 'error' && evt.message) throw new Error(evt.message);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  return {
    answer: structured?.answer ?? accumulated,
    structured,
  };
}
