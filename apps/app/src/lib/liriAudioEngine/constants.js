/**
 * LIRI Audio Engine — modes et valeurs par défaut (pipeline Web Audio côté client).
 */

/** @typedef {'off' | 'speech' | 'multi' | 'music' | 'sing'} LiriAudioMode */

export const LIRI_AUDIO_MODES = /** @type {const} */ ([
  { id: 'off', labelFr: 'Direct', desc: 'Micro navigateur / LiveKit sans chaîne LIRI' },
  { id: 'speech', labelFr: 'Parole', desc: 'Voix nette — gate léger, comp, EQ, limiteur' },
  { id: 'multi', labelFr: 'Multi-voix', desc: 'Discussion — compression équilibrée, limiteur master' },
  { id: 'music', labelFr: 'Musique', desc: 'Qualité préservée — pas de NR/AGC, limiteur fin' },
  { id: 'sing', labelFr: 'Chant', desc: 'Comp doux, clarté, réverb contrôlable' },
]);

export const DEFAULT_LIRI_AUDIO_SETTINGS = {
  /** `off` = micro direct (comportement historique) ; activer Parole / autres dans Studio */
  mode: /** @type {LiriAudioMode} */ ('off'),
  /** 0–100 : accentuation présence / clarté (EQ peaking ~3 kHz) */
  clarity: 55,
  /** 0–100 : réduction bruit navigateur (si mode l'autorise) */
  noiseReduction: false,
  /** 0–100 wet */
  reverb: 12,
  /** 0–100 intensité compresseur (seuil / ratio implicites) */
  compression: 58,
  /** 0–100 « gate » perceptif (coupe bas niveau via seuil comp + HPF) */
  gate: 35,
  /** 0–100 plafond limiteur (-6 à 0 dBFS approximatif) */
  limiter: 72,
  /** ducking auto réservé V2 — side-chain distant */
  ducking: 0,
};

export const LIRI_AUDIO_STORAGE_KEY = 'liri_audio_engine_v1';
