/**
 * Extrait des puces « suggestion design » depuis une réponse texte du Copilot.
 * @param {string} text
 * @returns {{ id: string; title: string; detail: string }[]}
 */
export function parseCopilotReplyToSuggestions(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const lines = raw
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•\-\*\d.)]+/u, '').trim())
    .filter((l) => l.length > 12);

  const out = [];
  for (let i = 0; i < Math.min(lines.length, 8); i += 1) {
    const line = lines[i];
    const title = line.length > 72 ? `${line.slice(0, 69)}…` : line;
    out.push({
      id: `copilot_${i}_${title.slice(0, 24).replace(/\s/g, '_')}`,
      title: title.slice(0, 120),
      detail: 'Proposition issue du Copilot designer — à adapter sur le canvas.',
    });
  }

  if (out.length === 0 && raw.length > 20) {
    out.push({
      id: 'copilot_block',
      title: 'Réponse Copilot',
      detail: raw.length > 280 ? `${raw.slice(0, 277)}…` : raw,
    });
  }

  return out;
}

/**
 * @param {string} assistantText
 * @param {string} centralIdea
 */
export function buildGuideIaSummaryBlock(assistantText, centralIdea) {
  const a = String(assistantText || '').trim();
  const c = String(centralIdea || '').trim();
  const parts = [];
  if (c) parts.push(`Idée centrale chargée : ${c.slice(0, 500)}${c.length > 500 ? '…' : ''}`);
  if (a) {
    const excerpt = a.length > 1200 ? `${a.slice(0, 1197)}…` : a;
    parts.push(`Dernier échange Copilot :\n${excerpt}`);
  }
  return parts.join('\n\n');
}
