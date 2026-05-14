import { useEffect, useRef } from 'react';
import { mapLongiaRealtimeNotificationsToPanelPayloads } from '@/lib/mapLongiaRealtimeNotification';

const PARTIAL_DEBOUNCE_MS = 1400;

/**
 * STT navigateur (Web Speech API) — bêta / dev. Activer avec VITE_LONGIA_WEB_SPEECH=1.
 * Les données audio sont traitées par le moteur du navigateur (ex. Google sur Chrome).
 */
export function useLongiaHostWebSpeech({
  enabled,
  sessionId,
  language = 'fr-FR',
  analyzeLiveContext,
  pushLongiaHostNotif,
  /** Segments STT (partiels debouncés ou finaux) — ex. diffusion vers invités LONGIA. */
  onTranscriptChunk,
  /** Texte final seul — Decision Engine (définitions, smartboard, etc.). */
  onTranscriptFinalForEngine,
}) {
  const seenIdsRef = useRef(new Set());
  const partialTimerRef = useRef(null);
  const lastPartialTextRef = useRef('');

  useEffect(() => {
    if (!enabled || !sessionId || !analyzeLiveContext || !pushLongiaHostNotif) return;

    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    const flushPartial = (text) => {
      const t = text.trim();
      if (t.length < 14) return;
      try {
        onTranscriptChunk?.({ text: t, isFinal: false });
      } catch {
        /* ignore */
      }
      void (async () => {
        const now = Date.now();
        const result = await analyzeLiveContext({
          transcriptPartial: {
            text: t,
            startMs: now,
            endMs: now,
            language: language.split('-')[0] || 'fr',
            speakerId: 'teacher',
          },
          chatEvents: [],
          audienceMetrics: [],
          roomContext: { sessionId },
          silent: true,
        });
        if (!result.ok || !result.notifications?.length) return;
        const payloads = mapLongiaRealtimeNotificationsToPanelPayloads(result.notifications);
        for (const p of payloads) {
          const id = p.longiaRealtimeId;
          if (id) {
            if (seenIdsRef.current.has(id)) continue;
            seenIdsRef.current.add(id);
          }
          pushLongiaHostNotif(p);
        }
      })();
    };

    const roomCtx = { sessionId };

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const piece = res[0]?.transcript || '';
        if (res.isFinal) finalText += piece;
        else interim += piece;
      }

      const now = Date.now();

      if (finalText.trim()) {
        if (partialTimerRef.current) {
          clearTimeout(partialTimerRef.current);
          partialTimerRef.current = null;
        }
        const trimmedFinal = finalText.trim();
        try {
          onTranscriptChunk?.({ text: trimmedFinal, isFinal: true });
        } catch {
          /* ignore */
        }
        try {
          onTranscriptFinalForEngine?.(trimmedFinal);
        } catch {
          /* ignore */
        }
        void (async () => {
          const result = await analyzeLiveContext({
            transcriptFinal: {
              text: finalText.trim(),
              startMs: now,
              endMs: now,
              language: language.split('-')[0] || 'fr',
              speakerId: 'teacher',
            },
            chatEvents: [],
            audienceMetrics: [],
            roomContext: roomCtx,
            silent: true,
          });
          if (!result.ok || !result.notifications?.length) return;
          const payloads = mapLongiaRealtimeNotificationsToPanelPayloads(result.notifications);
          for (const p of payloads) {
            const id = p.longiaRealtimeId;
            if (id) {
              if (seenIdsRef.current.has(id)) continue;
              seenIdsRef.current.add(id);
            }
            pushLongiaHostNotif(p);
          }
        })();
      }

      const p = interim.trim();
      if (!p || p === lastPartialTextRef.current) return;
      lastPartialTextRef.current = p;
      if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
      partialTimerRef.current = setTimeout(() => {
        partialTimerRef.current = null;
        flushPartial(p);
      }, PARTIAL_DEBOUNCE_MS);
    };

    recognition.onerror = () => {
      /* ignore — micro refusé ou réseau */
    };

    try {
      recognition.start();
    } catch {
      /* already started */
    }

    return () => {
      if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, sessionId, language, analyzeLiveContext, pushLongiaHostNotif, onTranscriptChunk, onTranscriptFinalForEngine]);
}
