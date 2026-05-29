import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';
import {
  BUS_EVENTS,
  LONGIA_BUS_BROADCAST_EVENT,
  wrapLongiaBusPayload,
} from '@/lib/longiaRealtimeBus';
import { parseLangList } from '@/lib/liriMultilangApi';
import { runLiriMultilangCaptionPipeline } from '@/lib/liriMultilangLivePipeline';

/**
 * Actions bus LONGIA : diffusion des chunks de transcription hôte (multilingue),
 * publication d'événements bus côté invité, et visibilitychange pour signal d'attention.
 */
export function useLiveHostLongiaBusCallbacks({
  isGuestUi,
  phase,
  sessionId,
  userId,
  toast,
  longiaBusHostChRef,
  guestLongiaBusChRef,
  hostMultilangRef,
  multilangPartialTsRef,
  liriErrorLastToastAtRef,
}) {
  const broadcastTeacherTranscriptChunk = useCallback(
    (chunk) => {
      if (isGuestUi || phase !== PHASE.LIVE || !chunk || typeof chunk.text !== 'string') return;
      const ev = chunk.isFinal ? BUS_EVENTS.TRANSCRIPT_FINAL : BUS_EVENTS.TRANSCRIPT_PARTIAL;
      void broadcastRealtime(
        longiaBusHostChRef.current,
        LONGIA_BUS_BROADCAST_EVENT,
        wrapLongiaBusPayload(ev, {
          text: chunk.text,
          speaker_id: 'teacher',
        }),
      );
      const hm = hostMultilangRef.current;
      if (hm?.enabled) {
        const targetLangs = parseLangList(hm.targetsStr || '');
        if (targetLangs.length) {
          void runLiriMultilangCaptionPipeline({
            supabase,
            channel: longiaBusHostChRef.current,
            busEvent: LONGIA_BUS_BROADCAST_EVENT,
            chunk,
            sourceLang: hm.sourceLang || 'fr',
            targetLangs,
            lastPartialAtRef: multilangPartialTsRef,
            liveSessionId: sessionId,
            userId,
            onError: (lang, msg) => {
              const now = Date.now();
              if (now - liriErrorLastToastAtRef.current < 60_000) return;
              liriErrorLastToastAtRef.current = now;
              toast({
                title: 'LIRI — traduction échouée',
                description: `Langue : ${lang.toUpperCase()} — ${msg}`,
                variant: 'destructive',
              });
            },
          });
        }
      }
    },
    [isGuestUi, phase],
  );

  const publishGuestLongiaBusEvent = useCallback(
    (eventType, data) => {
      if (!isGuestUi || phase !== PHASE.LIVE || !eventType) return;
      void broadcastRealtime(
        guestLongiaBusChRef.current,
        LONGIA_BUS_BROADCAST_EVENT,
        wrapLongiaBusPayload(eventType, data && typeof data === 'object' ? data : {}),
      );
    },
    [isGuestUi, phase],
  );

  const guestAudienceMetricCooldownRef = useRef(0);
  useEffect(() => {
    if (!isGuestUi || phase !== PHASE.LIVE || !sessionId) return;
    const onVis = () => {
      if (!document.hidden) return;
      const now = Date.now();
      if (now - guestAudienceMetricCooldownRef.current < 180_000) return;
      guestAudienceMetricCooldownRef.current = now;
      publishGuestLongiaBusEvent(BUS_EVENTS.AUDIENCE_METRIC, {
        metric: 'attention_low',
        detail: 'Onglet invité masqué (signal d\'attention faible).',
      });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isGuestUi, phase, sessionId, publishGuestLongiaBusEvent]);

  return { broadcastTeacherTranscriptChunk, publishGuestLongiaBusEvent };
}
