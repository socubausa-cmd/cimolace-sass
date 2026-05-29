/**
 * Exemple d'intégration React — consommation du flux SSE LIRI Brain.
 * Appelez l'URL où `route.ts` est montée (ex. `/api/liri/brain` en prod).
 */

import { useCallback, useRef, useState } from 'react';
import type { BrainRouteInput, LiriStructuredOutput } from './types';

export interface LiriBrainStreamState {
  text: string;
  structured: LiriStructuredOutput | null;
  loading: boolean;
  error: string | null;
}

const defaultState: LiriBrainStreamState = {
  text: '',
  structured: null,
  loading: false,
  error: null,
};

/**
 * @param apiUrl URL complète ou chemin relatif vers la route POST Brain (ex. `/api/liri/brain`).
 */
export function useLiriBrainClient(apiUrl = '/api/liri/brain') {
  const [state, setState] = useState<LiriBrainStreamState>(defaultState);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (input: BrainRouteInput) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setState({ text: '', structured: null, loading: true, error: null });

      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, stream: true }),
          signal: ac.signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error((errJson as { error?: string }).error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('Pas de flux de réponse');

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

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
              if (evt.type === 'token' && evt.text) {
                accumulated += evt.text;
                setState((s) => ({ ...s, text: accumulated }));
              }
              if (evt.type === 'done' && evt.structured) {
                setState((s) => ({ ...s, structured: evt.structured ?? null, loading: false }));
              }
              if (evt.type === 'error' && evt.message) {
                throw new Error(evt.message);
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }

        setState((s) => ({ ...s, loading: false }));
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        const msg = e instanceof Error ? e.message : String(e);
        setState((s) => ({ ...s, loading: false, error: msg }));
      }
    },
    [apiUrl],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { ...state, run, cancel };
}
