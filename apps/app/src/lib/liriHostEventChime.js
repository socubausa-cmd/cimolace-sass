/**
 * Bref signal sonore pour alertes hôte (main levée, salle d'attente, etc.).
 * Réutilise un AudioContext déjà armé (ex. après interaction utilisateur).
 */
export function playLiriHostEventChime(audioContext, variant = 'default') {
  const ctx = audioContext;
  if (!ctx || typeof ctx.createOscillator !== 'function') return;
  try {
    if (ctx.state === 'suspended') {
      ctx.resume?.().catch(() => {});
    }
    const t0 = ctx.currentTime;
    const pairs = {
      hand: [
        [720, 0.06],
        [920, 0.07],
      ],
      waiting: [
        [580, 0.07],
        [700, 0.08],
      ],
      join: [
        [660, 0.05],
        [780, 0.06],
      ],
      leave: [
        [520, 0.06],
        [380, 0.07],
      ],
      promote: [
        [840, 0.05],
        [980, 0.08],
      ],
      default: [
        [640, 0.06],
        [820, 0.07],
      ],
    };
    const seq = pairs[variant] || pairs.default;
    seq.forEach(([freq, dur], i) => {
      const start = t0 + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.022, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  } catch {
    /* best effort */
  }
}
