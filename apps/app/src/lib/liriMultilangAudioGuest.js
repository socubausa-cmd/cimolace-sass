/**
 * Audio invité multilingue — TTS navigateur (file) pour segments traduits finaux.
 * La piste LiveKit « interprète » est gérée par `GuestLivekitInterpreterAudios.jsx` (participant identity `liri-ml-{lang}`).
 */

/** @type {{ text: string; lang: string }[]} */
let ttsQueue = [];
let ttsProcessing = false;

/** @param {string} code */
export function multilangLangToBcp47(code) {
  const c = String(code || 'en').toLowerCase().slice(0, 12);
  const map = {
    en: 'en-US',
    fr: 'fr-FR',
    es: 'es-ES',
    de: 'de-DE',
    pt: 'pt-BR',
    it: 'it-IT',
    nl: 'nl-NL',
    pl: 'pl-PL',
    ru: 'ru-RU',
    ja: 'ja-JP',
    zh: 'zh-CN',
    ko: 'ko-KR',
    ar: 'ar-SA',
  };
  return map[c] || (c.length === 2 ? `${c}-${c.toUpperCase()}` : 'en-US');
}

function runNextTts() {
  if (ttsProcessing || ttsQueue.length === 0) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    ttsQueue = [];
    return;
  }
  ttsProcessing = true;
  const { text, lang } = ttsQueue.shift();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = multilangLangToBcp47(lang);
  u.rate = 1;
  const end = () => {
    ttsProcessing = false;
    runNextTts();
  };
  u.onend = end;
  u.onerror = end;
  try {
    window.speechSynthesis.speak(u);
  } catch {
    ttsProcessing = false;
    runNextTts();
  }
}

/**
 * Enfile un segment final à lire (uniquement si l'invité a activé l'écoute).
 * @param {string} text
 * @param {string} lang
 */
export function enqueueMultilangBrowserTts(text, lang) {
  const t = String(text || '').trim();
  if (t.length < 2) return;
  ttsQueue.push({ text: t.slice(0, 900), lang: String(lang || 'en').slice(0, 12) });
  if (ttsQueue.length > 16) ttsQueue = ttsQueue.slice(-16);
  runNextTts();
}

export function stopMultilangBrowserTts() {
  ttsQueue = [];
  ttsProcessing = false;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/** Préfixe d'identity LiveKit pour les agents interprètes (audio dans la salle). */
export const LIRI_MULTILANG_LIVEKIT_IDENTITY_PREFIX = 'liri-ml-';
