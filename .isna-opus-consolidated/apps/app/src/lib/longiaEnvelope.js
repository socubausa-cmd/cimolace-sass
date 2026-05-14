/** Marqueur de fin de message : métadonnées JSON pour l’AI Hub (suggestions, intent, etc.). */
export const LONGIA_ENVELOPE_MARK = '<<<LONGIA_ENVELOPE>>>';

/**
 * Découpe la sortie modèle : texte affichable + JSON optionnel.
 */
export function parseLongiaAssistantRaw(raw) {
  const s = String(raw ?? '');
  const idx = s.lastIndexOf(LONGIA_ENVELOPE_MARK);
  if (idx === -1) {
    return { displayText: s.trim(), envelope: null };
  }
  const displayText = s.slice(0, idx).trim();
  const jsonPart = s.slice(idx + LONGIA_ENVELOPE_MARK.length).trim();
  /** @type {Record<string, unknown> | null} */
  let envelope = null;
  try {
    envelope = JSON.parse(jsonPart);
  } catch {
    envelope = null;
  }
  return { displayText, envelope };
}

/**
 * Ajout au system prompt : impose une enveloppe JSON sans bloquer le texte visible.
 */
export function longiaEnvelopeSystemAddition() {
  return `

## Enveloppe LONGIA (alignée hub v3)
Après le texte visible (français, 2–12 phrases, humain d’abord) : une ligne exactement ${LONGIA_ENVELOPE_MARK} puis un JSON optionnel :
- tone_mode, intent, strategy, message, payload
- actions : [ { label, action, payload? } ] — boutons principaux
- suggestions : [ { label, action, description?, why?, payload? } ] — compléments
Le client fusionne actions puis suggestions en puces cliquables. Pas d’action vide ; sans action explicite sur une suggestion, utiliser "nearest_templates".
Actions UI usuelles : generate_document, start_guided_flow, use_architect_mode, nearest_templates. seedText dans payload si utile.`;
}

/**
 * @param {unknown} envelope
 * @returns {{ label: string, action: string, payload?: Record<string, unknown>}[]}
 */
export function normalizeLongiaSuggestions(envelope) {
  if (!envelope || typeof envelope !== 'object') return [];
  const e = /** @type {Record<string, unknown>} */ (envelope);
  const actions = Array.isArray(e.actions) ? e.actions : [];
  const suggestions = Array.isArray(e.suggestions) ? e.suggestions : [];
  const rows = [...actions, ...suggestions];
  const seen = new Set();
  const out = [];
  for (const x of rows) {
    if (!x || typeof x !== 'object') continue;
    const o = /** @type {{ label?: unknown; action?: unknown; payload?: unknown; description?: unknown; why?: unknown }} */ (x);
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    let action = typeof o.action === 'string' ? o.action.trim() : '';
    if (!label) continue;
    if (!action) action = 'nearest_templates';
    const k = `${label}\0${action}`;
    if (seen.has(k)) continue;
    seen.add(k);
    /** @type {Record<string, unknown>} */
    const payload = {};
    if (o.payload && typeof o.payload === 'object') {
      Object.assign(payload, /** @type {Record<string, unknown>} */ (o.payload));
    }
    if (typeof o.description === 'string' && o.description.trim()) payload.description = o.description.trim();
    if (typeof o.why === 'string' && o.why.trim()) payload.why = o.why.trim();
    if (Object.keys(payload).length) out.push({ label, action, payload });
    else out.push({ label, action });
  }
  return out;
}
