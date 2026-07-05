import { useCallback, useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// useWebSpeechScribe — dictée live via Web Speech API (navigateur natif, gratuit,
// aucune clé). Capte le MICRO LOCAL (le praticien qui dicte / narre). Accumule le
// texte final dans `transcript`, expose l'`interim` en cours. Redémarre tout seul
// quand Chrome coupe après un silence (`onend`). Non supporté → `supported=false`
// (Safari desktop OK via webkit ; Firefox non → l'UI retombe sur la saisie manuelle).
// ─────────────────────────────────────────────────────────────────────────────
export function useWebSpeechScribe({ lang = 'fr-FR' }: { lang?: string } = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<any>(null);
  const listeningRef = useRef(false);

  const supported =
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const start = useCallback(() => {
    if (!supported || recRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (e: any) => {
      let fin = '';
      let itm = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        const piece = r[0]?.transcript || '';
        if (r.isFinal) fin += piece;
        else itm += piece;
      }
      if (fin.trim()) {
        setTranscript((prev) => (prev ? `${prev} ${fin.trim()}` : fin.trim()));
        setInterim('');
      } else {
        setInterim(itm.trim());
      }
    };
    rec.onerror = (e: any) => {
      // 'no-speech' / 'aborted' = normaux (silence, stop) → on ignore.
      if (e?.error && e.error !== 'no-speech' && e.error !== 'aborted') setError(String(e.error));
    };
    rec.onend = () => {
      // Chrome coupe après un silence : on relance tant que l'utilisateur écoute.
      if (recRef.current === rec && listeningRef.current) {
        try { rec.start(); } catch { /* déjà démarré */ }
      }
    };

    recRef.current = rec;
    listeningRef.current = true;
    setListening(true);
    setError(null);
    try { rec.start(); } catch { /* déjà démarré */ }
  }, [supported, lang]);

  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    setInterim('');
    const rec = recRef.current;
    recRef.current = null;
    if (rec) { try { rec.stop(); } catch { /* ignore */ } }
  }, []);

  const toggle = useCallback(() => {
    if (listeningRef.current) stop(); else start();
  }, [start, stop]);

  const reset = useCallback(() => { setTranscript(''); setInterim(''); }, []);

  useEffect(() => () => {
    const rec = recRef.current;
    recRef.current = null;
    listeningRef.current = false;
    if (rec) { try { rec.stop(); } catch { /* ignore */ } }
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, toggle, reset, setTranscript };
}
