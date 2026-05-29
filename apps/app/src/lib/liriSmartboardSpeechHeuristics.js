/**
 * Heuristiques pédagogiques sur le transcript (sans LLM) — titres, listes, emphase.
 * Brancher plus tard vers mise en page Konva / assistant.
 */

/**
 * @param {string} text
 * @returns {{ id: string; label: string; detail?: string }[]}
 */
export function analyzePedagogyTranscript(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const t = raw.toLowerCase();
  const hints = [];

  if (/\b(titre|titres|sous-titre|intitulé)\b/.test(t)) {
    hints.push({
      id: 'title',
      label: 'Titre détecté',
      detail: 'Pensez à mettre en avant le titre sur la slide (centrage / taille) — automation à brancher.',
    });
  }

  const listM = t.match(/\b(\d{1,2})\s+(points?|choses?|idées?|éléments?|arguments?)\b/);
  if (listM) {
    const count = Math.min(12, Math.max(2, parseInt(listM[1], 10) || 3));
    hints.push({
      id: 'list',
      count,
      label: `Liste ~${listM[1]} points`,
      detail: 'Structure en liste numérotée possible — automation à brancher.',
    });
  }

  if (/\b(retenir|noter que|important|à retenir|surtout)\b/.test(t)) {
    hints.push({
      id: 'emphasis',
      label: 'Emphase',
      detail: 'Idée à encadrer ou surligner — automation à brancher.',
    });
  }

  const enumM = raw.match(/(?:^|\s)(\d+)[.)]\s+/g);
  if (enumM && enumM.length >= 2) {
    hints.push({
      id: 'numbered',
      label: 'Énumération orale',
      detail: 'Les items chiffrés peuvent être convertis en liste au tableau.',
    });
  }

  return hints.slice(0, 4);
}
