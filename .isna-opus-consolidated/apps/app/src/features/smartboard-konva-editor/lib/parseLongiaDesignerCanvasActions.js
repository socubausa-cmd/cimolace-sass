/**
 * Extrait le bloc optionnel ```longia_canvas_actions ... ``` en fin de réponse COACH SLIDE.
 * @param {string} fullText
 * @returns {{ displayText: string, actions: object[] }}
 */
export function parseLongiaDesignerCanvasActions(fullText) {
  const raw = String(fullText || '');
  const re = /```longia_canvas_actions\s*([\s\S]*?)```/i;
  const m = raw.match(re);
  let displayText = raw.trim();
  let actions = [];

  const tryParseLooseJson = (input) => {
    const src = String(input || '').trim();
    if (!src) return null;
    const attempts = [src];
    // Normalisation minimale (guillemets smart + trailing commas)
    attempts.push(
      src
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, '$1'),
    );
    for (const text of attempts) {
      try {
        return JSON.parse(text);
      } catch {
        // JS-like object fallback (single quotes, keys non stricts)
        try {
          // eslint-disable-next-line no-new-func
          return Function(`"use strict"; return (${text});`)();
        } catch {
          // continue
        }
      }
    }
    return null;
  };

  const normalizeActionsFromParsed = (parsed) => {
    const list = Array.isArray(parsed) ? parsed : parsed?.actions;
    if (!Array.isArray(list)) return [];
    return list.filter((x) => x && typeof x === 'object');
  };

  if (m) {
    displayText = raw.replace(re, '').trim();
    const parsed = tryParseLooseJson(m[1]);
    actions = normalizeActionsFromParsed(parsed);
  }
  // Fallback robuste : certains modèles renvoient du JSON actions sans fence.
  // On tente d'extraire :
  // - {"actions":[...]}
  // - un tableau direct [{...}]
  // - un bloc ```json ... ```
  if (actions.length === 0) {
    const candidates = [];
    const objMatch = raw.match(/\{\s*"actions"\s*:\s*\[[\s\S]*?\]\s*\}/i);
    if (objMatch?.[0]) candidates.push(objMatch[0]);
    const arrMatch = raw.match(/\[\s*\{\s*"type"\s*:[\s\S]*?\}\s*\]/i);
    if (arrMatch?.[0]) candidates.push(arrMatch[0]);
    const jsonFenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
    let fenceMatch;
    while ((fenceMatch = jsonFenceRe.exec(raw)) !== null) {
      if (fenceMatch?.[1]) candidates.push(fenceMatch[1]);
    }

    for (const candidate of candidates) {
      const parsed = tryParseLooseJson(candidate);
      const list = normalizeActionsFromParsed(parsed);
      if (list.length > 0) {
        actions = list;
        displayText = raw.replace(candidate, '').trim();
        break;
      }
    }
  }
  return { displayText, actions };
}
