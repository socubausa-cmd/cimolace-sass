/**
 * Son court « navigation d'écran » au changement de scène SmartBoard (Web Audio, sans fichier).
 * Style premium : deux tons doux (tierce majeure), attaque lente, très court.
 */

let sharedCtx;
let lastPlayAt = 0;
const MIN_INTERVAL_MS = 95;

export function playSmartboardSceneNavigationSound() {
  const now = Date.now();
  if (now - lastPlayAt < MIN_INTERVAL_MS) return;
  lastPlayAt = now;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new Ctx();
    }
    const ctx = sharedCtx;
    if (ctx.state === 'suspended') {
      ctx.resume?.().catch(() => {});
    }

    const t0 = ctx.currentTime;
    /** Tierce majeure douce (type UI glass / écran pro) */
    const tones = [
      { f: 392, t: 0, dur: 0.1 },
      { f: 493.88, t: 0.034, dur: 0.11 },
    ];

    tones.forEach(({ f, t, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;

      const start = t0 + t;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.038, start + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2800;
      filter.Q.value = 0.7;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  } catch {
    /* best effort — autoplay / context */
  }
}
