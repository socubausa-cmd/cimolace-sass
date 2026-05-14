/**
 * Tente d'extraire un objet Coach→Architect (action design_update) depuis un texte
 * (réponse Coach, bloc ```json```, ou JSON brut).
 * @param {string} text
 * @returns {object | null}
 */
export function tryParseCoachArchitectHandoffFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.trim();

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fence?.[1]) candidates.push(fence[1].trim());
  candidates.push(s);

  for (const c of candidates) {
    try {
      const o = JSON.parse(c);
      if (o && typeof o === 'object' && !Array.isArray(o) && o.action === 'design_update') {
        return o;
      }
    } catch {
      /* next */
    }
  }

  const idx = s.indexOf('"action"');
  if (idx === -1) return null;
  const sub = s.slice(Math.max(0, s.lastIndexOf('{', idx)));
  let end = -1;
  let depthCount = 0;
  for (let i = 0; i < sub.length; i++) {
    const ch = sub[i];
    if (ch === '{') depthCount++;
    if (ch === '}') {
      depthCount--;
      if (depthCount === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end > 0) {
    try {
      const o = JSON.parse(sub.slice(0, end));
      if (o?.action === 'design_update') return o;
    } catch {
      /* */
    }
  }
  return null;
}
