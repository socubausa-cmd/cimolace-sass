/**
 * Pipeline **Input** — intention captée (texte, voix, vision) pour le hub LONGIA.
 * Fusionner dans `context.longia_captured_intent` ; reste dans le JSON prompt (léger).
 */

/** @typedef {'text'|'voice'|'vision'|'mixed'} LongiaCaptureModality */

export const LONGIA_CAPTURE_MODALITY = {
  TEXT: 'text',
  VOICE: 'voice',
  VISION: 'vision',
  MIXED: 'mixed',
};

/**
 * @param {{
 *   modality?: LongiaCaptureModality | string;
 *   confidence?: number;
 *   summary?: string;
 *   entities?: Record<string, unknown>;
 * }} p
 */
export function buildLongiaCapturedIntentV1(p) {
  const modality = String(p?.modality || LONGIA_CAPTURE_MODALITY.TEXT).trim() || LONGIA_CAPTURE_MODALITY.TEXT;
  let confidence;
  if (typeof p?.confidence === 'number' && Number.isFinite(p.confidence)) {
    confidence = Math.max(0, Math.min(1, p.confidence));
  }
  const summary =
    typeof p?.summary === 'string' ? p.summary.replace(/\s+/g, ' ').trim().slice(0, 500) : undefined;
  const entities =
    p?.entities && typeof p.entities === 'object' && !Array.isArray(p.entities) ? { ...p.entities } : {};
  return {
    v: 1,
    modality,
    ...(confidence !== undefined ? { confidence } : {}),
    ...(summary ? { summary } : {}),
    ...(Object.keys(entities).length ? { entities } : {}),
  };
}

/**
 * @param {Record<string, unknown>} context
 * @param {ReturnType<typeof buildLongiaCapturedIntentV1>} intent
 */
export function attachLongiaCapturedIntentToContext(context, intent) {
  return {
    ...context,
    longia_captured_intent: intent,
  };
}
