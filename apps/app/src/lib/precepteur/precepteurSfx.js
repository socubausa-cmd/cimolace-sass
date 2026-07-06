/**
 * precepteurSfx.js — KIT SFX DU PRÉCEPTEUR (brique D), 100 % SYNTHÉTISÉ via Web Audio API.
 *
 * Aucun asset audio à shipper : chaque effet est une petite partition d'oscillateurs / bruit
 * filtré, jouée à bas volume pour NE JAMAIS couvrir la narration. Muteable, débloqué dans le
 * geste utilisateur (comme la voix), FAIL-SAFE en headless (pas d'AudioContext → no-op).
 *
 * Injection de dépendance : `createPrecepteurSfx({ AudioContextImpl })` accepte un AudioContext
 * (défaut = window.AudioContext / webkitAudioContext) → le module reste testable sous `node`
 * (mock d'AudioContext), et se dégrade en NO-OP sûr si aucun contexte n'est disponible.
 *
 * PURE ESM. `SFX_RECIPES` est une donnée pure (testable) ; le graphe audio est construit à la volée.
 */

// ── Recettes (données pures) ─────────────────────────────────────────────────
// Une recette = liste de « voix ». Chaque voix :
//   kind: 'tone' (oscillateur) | 'noise' (bruit blanc bufferisé)
//   wave: forme d'onde ('sine'|'triangle'|'square'|'sawtooth') pour les tones
//   freq / freqTo: fréquence (Hz), glissando optionnel vers freqTo
//   filter: { type, freq, freqTo?, q? } biquad optionnel (indispensable au bruit)
//   gain: pic de gain (BAS — 0.04..0.10) ; attack/decay: enveloppe (s) ; delay: départ relatif (s)
export const SFX_RECIPES = {
  // Lever de rideau : tierce montante chaleureuse, jouée au démarrage du cours (begin).
  start: [
    { kind: 'tone', wave: 'sine', freq: 392, gain: 0.05, attack: 0.012, decay: 0.16, delay: 0, filter: { type: 'lowpass', freq: 2600, q: 0.7 } },
    { kind: 'tone', wave: 'sine', freq: 523.25, gain: 0.05, attack: 0.012, decay: 0.18, delay: 0.06, filter: { type: 'lowpass', freq: 2600, q: 0.7 } },
  ],
  // Apparition de scène : un « thock » bois très doux, discret.
  appear: [
    { kind: 'tone', wave: 'triangle', freq: 196, gain: 0.09, attack: 0.004, decay: 0.15, delay: 0 },
  ],
  // Écriture à la craie : grappe de 3 traits de bruit filtré (bande passante ~ craie).
  write: [
    { kind: 'noise', filter: { type: 'bandpass', freq: 2200, q: 0.8 }, gain: 0.05, attack: 0.004, decay: 0.10, delay: 0 },
    { kind: 'noise', filter: { type: 'bandpass', freq: 2600, q: 0.8 }, gain: 0.045, attack: 0.004, decay: 0.09, delay: 0.13 },
    { kind: 'noise', filter: { type: 'bandpass', freq: 2000, q: 0.8 }, gain: 0.05, attack: 0.004, decay: 0.11, delay: 0.27 },
  ],
  // Révélation (mot-clé surligné / encadré / résumé) : petit carillon à deux notes, clair et doux.
  reveal: [
    { kind: 'tone', wave: 'sine', freq: 880, gain: 0.085, attack: 0.005, decay: 0.20, delay: 0 },
    { kind: 'tone', wave: 'sine', freq: 1318.51, gain: 0.07, attack: 0.005, decay: 0.30, delay: 0.09 },
  ],
  // Balayage (BoardSweep / ouverture du croquis) : whoosh — bruit passe-bas qui monte.
  sweep: [
    { kind: 'noise', filter: { type: 'lowpass', freq: 380, freqTo: 3200, q: 0.7 }, gain: 0.06, attack: 0.07, decay: 0.34, delay: 0 },
  ],
  // Réussite (atelier juste / fin de cours) : triade majeure montante, chaleureuse.
  success: [
    { kind: 'tone', wave: 'triangle', freq: 523.25, gain: 0.075, attack: 0.005, decay: 0.28, delay: 0 },
    { kind: 'tone', wave: 'triangle', freq: 659.25, gain: 0.075, attack: 0.005, decay: 0.28, delay: 0.11 },
    { kind: 'tone', wave: 'triangle', freq: 783.99, gain: 0.085, attack: 0.005, decay: 0.40, delay: 0.22 },
  ],
};

// Type de scène → effet joué à son apparition (piloté par le lecteur).
export const SCENE_SFX = {
  lecon: 'write',
  amorce_croquis: 'appear',
  croquis: 'sweep',
  atelier: 'appear',
  image_analogie: 'appear',
  surlignage: 'reveal',
  encadre: 'reveal',
  resume_encadre: 'reveal',
  transition: 'appear',
};

const MASTER_DEFAULT = 0.6; // volume maître (les gains de voix restent bas → discret sous la voix)

/** Buffer de bruit blanc (1 s), mémoïsé par contexte. */
function noiseBuffer(ctx) {
  if (ctx.__precepteurNoise) return ctx.__precepteurNoise;
  const sr = ctx.sampleRate || 44100;
  const buf = ctx.createBuffer(1, sr, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  ctx.__precepteurNoise = buf;
  return buf;
}

/** Programme une voix (enveloppe ADSR simplifiée attack→decay) sur le graphe. Jamais throw. */
function scheduleVoice(ctx, master, v, t0) {
  const start = t0 + (v.delay || 0);
  const peak = Math.max(0.0001, v.gain || 0.05);
  const attack = v.attack || 0.005;
  const decay = v.decay || 0.15;
  const end = start + attack + decay;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);

  let src;
  if (v.kind === 'noise') {
    src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
  } else {
    src = ctx.createOscillator();
    src.type = v.wave || 'sine';
    src.frequency.setValueAtTime(v.freq || 440, start);
    if (v.freqTo) src.frequency.exponentialRampToValueAtTime(Math.max(1, v.freqTo), end);
  }

  let out = src;
  if (v.filter) {
    const f = ctx.createBiquadFilter();
    f.type = v.filter.type || 'lowpass';
    f.frequency.setValueAtTime(v.filter.freq || 1000, start);
    if (v.filter.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, v.filter.freqTo), end);
    if (v.filter.q != null && f.Q) f.Q.value = v.filter.q;
    src.connect(f);
    out = f;
  }
  out.connect(g);
  g.connect(master);
  src.start(start);
  src.stop(end + 0.02);
}

// Kit NO-OP (headless / pas d'AudioContext / disposé) — toutes les méthodes sûres.
const NOOP = {
  available: false,
  unlock() {},
  play() {},
  startWriting() {},
  stopWriting() {},
  setMuted() {},
  isMuted() { return true; },
  dispose() {},
};

/**
 * Crée un kit SFX. @param {object} [opts] { AudioContextImpl?, volume?, muted? }
 * @returns kit { available, unlock(), play(name), setMuted(bool), isMuted(), dispose() }
 */
export function createPrecepteurSfx(opts = {}) {
  const AC = opts.AudioContextImpl
    || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
    || null;
  if (!AC) return NOOP; // headless / navigateur sans Web Audio → no-op sûr

  const volume = typeof opts.volume === 'number' ? opts.volume : MASTER_DEFAULT;
  let muted = !!opts.muted;
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
    } catch { ctx = null; master = null; }
    return ctx;
  }

  function play(name) {
    if (muted || !ensure()) return;
    const recipe = SFX_RECIPES[name];
    if (!recipe || !recipe.length) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + 0.001;
      recipe.forEach((v) => scheduleVoice(ctx, master, v, t0));
    } catch { /* fail-safe : un SFX ne casse jamais le cours */ }
  }

  return {
    available: true,
    // À appeler DANS le geste utilisateur (comme l'unlock de la voix) : crée/reprend le contexte.
    unlock() { if (!ensure()) return; try { if (ctx.state === 'suspended') ctx.resume(); } catch { /* */ } },
    play,
    setMuted(m) {
      muted = !!m;
      if (master) { try { master.gain.value = muted ? 0 : volume; } catch { /* */ } }
    },
    isMuted() { return muted; },
    dispose() { try { if (ctx) ctx.close(); } catch { /* */ } ctx = null; master = null; },
  };
}

export default createPrecepteurSfx;
