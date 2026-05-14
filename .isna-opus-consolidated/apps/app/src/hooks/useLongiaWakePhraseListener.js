import { useCallback, useEffect, useRef, useState } from 'react';

const ENGAGE_MS = 10000;
const WAKE_COOLDOWN_MS = 4000;

/** @param {string} s */
function normalizeForWake(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const WAKE_SNIPPETS = [
  'dis longia',
  'dit longia',
  "s il te plait longia",
  "s il te plait  longia",
  'longia s il te plait',
  'parle longia',
  'ecoute longia',
  'allume longia',
];

function transcriptHasWake(plain) {
  const n = normalizeForWake(plain);
  if (n.length < 8) return false;
  return WAKE_SNIPPETS.some((w) => n.includes(normalizeForWake(w)));
}

/**
 * Écoute continue (fr-FR) : phrases du type « Dis LONGIA », « S'il te plaît LONGIA »
 * engagent l’assistant (état + événement global). Nécessite un geste utilisateur pour démarrer (API navigateur).
 */
export function useLongiaWakePhraseListener() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [engaged, setEngaged] = useState(false);
  const recRef = useRef(null);
  const listeningRef = useRef(false);
  const lastWakeAt = useRef(0);
  const bufferRef = useRef('');
  const engageTimer = useRef(null);
  const cooldownTimer = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
  }, []);

  const fireEngaged = useCallback(() => {
    const now = Date.now();
    if (now - lastWakeAt.current < WAKE_COOLDOWN_MS) return;
    lastWakeAt.current = now;
    setEngaged(true);
    if (engageTimer.current) clearTimeout(engageTimer.current);
    engageTimer.current = window.setTimeout(() => setEngaged(false), ENGAGE_MS);
    try {
      window.dispatchEvent(
        new CustomEvent('liri-longia-voice-engaged', {
          detail: { at: now },
        }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const onResult = useCallback(
    (ev) => {
      let piece = '';
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        piece += ev.results[i][0].transcript;
      }
      if (!piece.trim()) return;
      bufferRef.current = `${bufferRef.current} ${piece}`.slice(-500);
      if (transcriptHasWake(bufferRef.current) || transcriptHasWake(piece)) {
        fireEngaged();
        bufferRef.current = '';
      }
    },
    [fireEngaged],
  );

  const onError = useCallback((ev) => {
    const m = ev?.error;
    if (m === 'not-allowed' || m === 'service-not-allowed') {
      setError('Micro refusé — autorisez le micro pour « Dis LONGIA ».');
    } else if (m && m !== 'aborted' && m !== 'no-speech') {
      setError(null);
    }
  }, []);

  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    const r = recRef.current;
    if (r) {
      try {
        r.onend = null;
        r.stop();
      } catch {
        /* ignore */
      }
    }
    recRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (typeof window === 'undefined') return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setError('Reconnaissance vocale indisponible sur ce navigateur.');
      return;
    }
    setError(null);
    stop();
    const recognition = new Ctor();
    recRef.current = recognition;
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = onResult;
    recognition.onerror = onError;
    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
          listeningRef.current = false;
        }
      }
    };
    try {
      listeningRef.current = true;
      setListening(true);
      recognition.start();
    } catch (e) {
      setError(e?.message || 'Démarrage micro impossible');
      listeningRef.current = false;
      setListening(false);
    }
  }, [onError, onResult, stop]);

  useEffect(
    () => () => {
      if (engageTimer.current) clearTimeout(engageTimer.current);
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      listeningRef.current = false;
      const r = recRef.current;
      if (r) {
        try {
          r.onend = null;
          r.stop();
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  return {
    supported,
    listening,
    error,
    engaged,
    startListening: start,
    stopListening: stop,
  };
}
