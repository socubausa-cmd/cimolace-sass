/**
 * Assistance vocale live (expérimental) — Web Speech API.
 * Étapes futures : titres, listes, complétion — branchées sur `onFinalText`.
 */

function getRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isBrowserSpeechRecognitionSupported() {
  return typeof getRecognitionCtor() === 'function';
}

/**
 * @param {object} opts
 * @param {string} [opts.lang]
 * @param {(text: string, isFinal: boolean) => void} [opts.onResult]
 * @param {(err: Error | Event) => void} [opts.onError]
 */
export function createLiriSpeechAssistSession(opts = {}) {
  const {
    lang = 'fr-FR',
    onResult,
    onError,
  } = opts;

  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    return {
      supported: false,
      start: () => {},
      stop: () => {},
      abort: () => {},
    };
  }

  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (ev) => {
    let interim = '';
    let finalChunk = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      const t = r[0]?.transcript ?? '';
      if (r.isFinal) finalChunk += t;
      else interim += t;
    }
    const text = (finalChunk + interim).trim();
    if (text) onResult?.(text, Boolean(finalChunk));
  };

  rec.onerror = (e) => {
    onError?.(e);
  };

  let started = false;

  return {
    supported: true,
    start: () => {
      if (started) return;
      try {
        rec.start();
        started = true;
      } catch {
        started = false;
      }
    },
    stop: () => {
      if (!started) return;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      started = false;
    },
    abort: () => {
      if (!started) return;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      started = false;
    },
  };
}
