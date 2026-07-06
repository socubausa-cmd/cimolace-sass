import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useImmersiveVoice — LE MOTEUR de voix/présence/son PARTAGÉ du cerveau immersif Cimolace.
 *
 * Extrait du pattern de `CimolaceCreationAgent` (présence 5 états + typewriter serif « voix » +
 * sons Web Audio) pour que TOUS les secteurs (marketing, service, tutoriel, FORMATION/Précepteur)
 * parlent avec la MÊME voix. La présence narre en écrivant (serif) ; aucun asset audio.
 *
 * Retour : { presence, setPresence, message, setMessage, speak, think, muted, setMuted,
 *            sHello, sTick, sPop, sChime, sThink }.
 *   - speak(text, done?) : la présence « écrit » le texte (état ecriture→attente), done() à la fin.
 *   - think(fn, delay?)  : état reflexion + son + fn() après delay.
 * Débloque l'audio au 1er geste utilisateur (autoplay policy). PURE (aucun rendu).
 */
export function useImmersiveVoice() {
  const [presence, setPresence] = useState('connexion'); // connexion|attente|reflexion|ecriture|pret
  const [message, setMessage] = useState('');
  const [muted, setMuted] = useState(false);

  const genRef = useRef(0);
  const typeTimer = useRef(null);
  const thinkTimer = useRef(null);
  const audioCtxRef = useRef(null);
  const audioUnlocked = useRef(false);
  const mutedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const audio = useCallback(() => {
    if (mutedRef.current) return null;
    try { if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return null; }
    const ctx = audioCtxRef.current;
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }, []);
  const tone = useCallback((freq, dur, gain, type, when) => {
    const ctx = audio(); if (!ctx) return;
    const t = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.03);
  }, [audio]);
  const sHello = useCallback(() => { tone(432, 0.16, 0.035, 'sine', 0); tone(648, 0.2, 0.03, 'sine', 0.09); }, [tone]);
  const sThink = useCallback(() => { tone(196, 0.85, 0.024, 'sine', 0); tone(294, 0.85, 0.015, 'sine', 0); }, [tone]);
  const sTick = useCallback(() => { tone(1180, 0.028, 0.011, 'triangle', 0); }, [tone]);
  const sPop = useCallback(() => { tone(540, 0.07, 0.03, 'sine', 0); }, [tone]);
  const sChime = useCallback(() => { tone(523, 0.14, 0.035, 'sine', 0); tone(659, 0.14, 0.03, 'sine', 0.1); tone(784, 0.22, 0.03, 'sine', 0.2); }, [tone]);

  useEffect(() => {
    const unlock = () => {
      if (audioUnlocked.current) return;
      audioUnlocked.current = true;
      audio();
      if (!mutedRef.current) sHello();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, [audio, sHello]);

  // La « voix » = révélation MOT À MOT (karaoké, style Sherpas), pas caractère par caractère :
  // beaucoup plus dynamique. Garde par génération (frappe périmée / double-mount → stop).
  const speak = useCallback((text, done) => {
    const gen = ++genRef.current;
    clearTimeout(typeTimer.current);
    const str = String(text || '').replace(/\s+/g, ' ').trim();
    if (document.hidden || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      setMessage(str); setPresence('attente'); if (done) done(); return;
    }
    setPresence('ecriture');
    setMessage('');
    const words = str.split(' ').filter(Boolean);
    let i = 0;
    const tick = () => {
      if (genRef.current !== gen) return;
      i += 1;
      setMessage(words.slice(0, i).join(' '));
      sTick(); // un tic par mot (comme un accent rythmique)
      if (i >= words.length) { setPresence('attente'); if (done) done(); return; }
      // cadence par mot ∝ longueur du mot (les mots courts défilent plus vite) : ~110–190ms.
      const w = words[i - 1] || '';
      typeTimer.current = setTimeout(tick, Math.min(190, 90 + w.length * 12));
    };
    typeTimer.current = setTimeout(tick, 120);
  }, [sTick]);

  const think = useCallback((fn, delay = 900) => {
    setPresence('reflexion');
    sThink();
    clearTimeout(thinkTimer.current);
    thinkTimer.current = setTimeout(fn, delay);
  }, [sThink]);

  useEffect(() => () => { clearTimeout(typeTimer.current); clearTimeout(thinkTimer.current); }, []);

  return { presence, setPresence, message, setMessage, speak, think, muted, setMuted, sHello, sTick, sPop, sChime, sThink };
}

export default useImmersiveVoice;
