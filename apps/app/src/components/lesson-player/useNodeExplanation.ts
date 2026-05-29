import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { tsToSeconds } from '@/components/lesson-player/types';
import type { MindMapNode } from '@/components/lesson-player/types';
import type { VisualSpec } from '@/components/lesson-player/VisualRenderer';

export type NodeExplanationData = {
  sourceQuotes?: string[];
  deepExplanation?: string;
  examples?: string[];
  insights?: string[];
  visuals?: VisualSpec[];
};

type TranscriptLine = {
  time?: string;
  timeText?: string;
  timeSeconds?: number;
  text?: string;
};

function parseLineSeconds(line: TranscriptLine): number | null {
  if (line.timeSeconds != null && Number.isFinite(line.timeSeconds)) return line.timeSeconds;
  const raw = line.timeText || line.time || '';
  const m = /^(\d+):(\d{1,2})$/.exec(raw.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function getRelevantTranscript(lines: TranscriptLine[], nodeSeconds: number | null, limit = 18) {
  if (!lines.length) return [];
  if (nodeSeconds == null) return lines.slice(0, limit).map((l) => ({ t: l.timeText || l.time || '', x: l.text || '' }));

  let closest = 0;
  let minDiff = Infinity;
  lines.forEach((line, i) => {
    const s = parseLineSeconds(line);
    if (s != null) {
      const diff = Math.abs(s - nodeSeconds);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    }
  });
  const start = Math.max(0, closest - 4);
  const end = Math.min(lines.length, start + limit);
  return lines.slice(start, end).map((l) => ({ t: l.timeText || l.time || '', x: String(l.text || '').slice(0, 220) }));
}

export function useNodeExplanation(
  node: MindMapNode | null,
  videoTitle?: string,
  transcript?: TranscriptLine[],
) {
  const [data, setData] = useState<NodeExplanationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetch_ = useCallback(
    async (n: MindMapNode) => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setData(null);
      setError(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const bearerToken = sessionData?.session?.access_token || '';
        const supabaseUrl = (import.meta as { env: Record<string, string> }).env.VITE_SUPABASE_URL;
        const supabaseAnonKey = (import.meta as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY;

        const nodeSeconds = tsToSeconds(n);
        const relevantTranscript = getRelevantTranscript(transcript || [], nodeSeconds);

        const tid = window.setTimeout(() => ctrl.abort(), 40_000);
        let res: Response;
        try {
          res = await fetch(`${supabaseUrl}/functions/v1/generate-node-explanation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${bearerToken || supabaseAnonKey}`,
            },
            body: JSON.stringify({
              nodeLabel: n.label,
              nodeSummary: n.summary || '',
              nodeTime: n.time || '',
              videoTitle: videoTitle || '',
              transcript: relevantTranscript,
            }),
            signal: ctrl.signal,
          });
        } finally {
          window.clearTimeout(tid);
        }

        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(txt || `Erreur ${res.status}`);
        }

        const responseData: NodeExplanationData = await res.json();
        if (!ctrl.signal.aborted) setData(responseData);
      } catch (e: unknown) {
        if (!ctrl.signal.aborted) {
          setError((e as Error)?.message || String(e));
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [videoTitle, JSON.stringify(transcript?.slice(0, 3))],
  );

  useEffect(() => {
    if (!node) return;
    fetch_(node);
    return () => { abortRef.current?.abort(); };
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => { if (node) fetch_(node); }, [node, fetch_]);

  return { data, loading, error, refetch };
}
