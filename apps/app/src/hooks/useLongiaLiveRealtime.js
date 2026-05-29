import { useCallback, useState } from 'react';

/**
 * Appelle l'Edge Function `longia-live-realtime` (JWT Supabase).
 */
export function useLongiaLiveRealtime(supabaseClient) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyzeLiveContext = useCallback(
    async ({
      transcriptChunk,
      transcriptPartial,
      transcriptFinal,
      chatEvents,
      audienceMetrics,
      roomContext,
      silent = false,
    }) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const { data, error: fnError } = await supabaseClient.functions.invoke('longia-live-realtime', {
          body: {
            transcriptChunk: transcriptChunk || undefined,
            transcriptPartial: transcriptPartial || undefined,
            transcriptFinal: transcriptFinal || undefined,
            chatEvents: chatEvents || [],
            audienceMetrics: audienceMetrics || [],
            roomContext: roomContext && typeof roomContext === 'object' ? roomContext : {},
          },
        });
        if (fnError) {
          const msg = fnError.message || String(fnError);
          if (!silent) setError(msg);
          return { ok: false, error: msg, notifications: [] };
        }
        return {
          ok: data?.ok === true,
          notifications: Array.isArray(data?.notifications) ? data.notifications : [],
          transcriptTier: data?.transcriptTier ?? null,
          transcriptEvent: data?.transcriptEvent ?? null,
          transcriptSignals: data?.transcriptSignals,
          chatSignals: data?.chatSignals,
          audienceSignals: data?.audienceSignals,
        };
      } catch (e) {
        const msg = e?.message || String(e);
        if (!silent) setError(msg);
        return { ok: false, error: msg, notifications: [] };
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [supabaseClient],
  );

  return { analyzeLiveContext, loading, error, clearError: () => setError(null) };
}
