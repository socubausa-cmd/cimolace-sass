import { useEffect, useRef } from 'react';

const SILENCE_MS = 1600;

/**
 * Dialogue vocal : reconnaissance continue, envoi après silence post-résultat final,
 * barge-in sur synthèse si `ttsEnabled`.
 *
 * @param {{
 *   enabled: boolean;
 *   streaming: boolean;
 *   setDraft: (text: string) => void;
 *   getDraft: () => string;
 *   sendMessageRef: React.MutableRefObject<((text: string) => void) | null>;
 *   ttsEnabled: boolean;
 *   onSummary: (s: string) => void;
 * }} p
 */
export function useDesignerTurnDialogVoice(p) {
  const { enabled, streaming, setDraft, getDraft, sendMessageRef, ttsEnabled, onSummary } = p;

  const silenceTimerRef = useRef(null);
  const recRef = useRef(null);
  const enabledRef = useRef(false);
  const streamingRef = useRef(streaming);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  useEffect(() => {
    if (!enabled) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {
          /**/
        }
        recRef.current = null;
      }
      return;
    }

    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      onSummary?.('Reconnaissance vocale indisponible pour le mode dialogue.');
      return;
    }

    const clearSilence = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    const scheduleSend = () => {
      clearSilence();
      silenceTimerRef.current = window.setTimeout(() => {
        silenceTimerRef.current = null;
        if (!enabledRef.current || streamingRef.current) return;
        const text = (getDraft() || '').trim();
        if (text.length >= 4) {
          sendMessageRef.current?.(text);
        }
      }, SILENCE_MS);
    };

    const startRec = () => {
      if (!enabledRef.current) return;
      const rec = new SR();
      rec.lang = 'fr-FR';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (e) => {
        if (typeof window !== 'undefined' && window.speechSynthesis?.speaking && ttsEnabled) {
          try {
            window.speechSynthesis.cancel();
          } catch {
            /**/
          }
        }
        let full = '';
        for (let i = 0; i < e.results.length; i += 1) {
          full += e.results[i][0].transcript;
        }
        const trimmed = full.trim();
        setDraft(trimmed);
        const last = e.results[e.results.length - 1];
        if (last?.isFinal) {
          scheduleSend();
        }
      };

      rec.onerror = () => {
        clearSilence();
      };

      rec.onend = () => {
        recRef.current = null;
        if (enabledRef.current) {
          window.setTimeout(() => startRec(), 140);
        }
      };

      recRef.current = rec;
      try {
        rec.start();
      } catch {
        /**/
      }
    };

    onSummary?.(
      'Mode dialogue : pause courte après votre phrase pour envoyer ; la synthèse peut être interrompue en reprenant la parole.',
    );
    startRec();

    return () => {
      enabledRef.current = false;
      clearSilence();
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {
          /**/
        }
        recRef.current = null;
      }
    };
  }, [enabled, setDraft, getDraft, sendMessageRef, ttsEnabled, onSummary]);
}
