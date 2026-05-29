/**
 * Libellé UX « régularité live » à partir des compteurs profil (sessions immersives terminées).
 * Aligné sur la spec LIRI (très régulier → rare).
 */

const LABELS = {
  tres_regulier: 'Très régulier',
  regulier: 'Régulier',
  occasionnel: 'Occasionnel',
  rare: 'Rare',
  nouveau: 'Nouveau sur les lives',
};

/**
 * @param {{ count?: number | null, lastAt?: string | null }} stats
 * @returns {{ key: string, label: string, count: number }}
 */
export function liveRegulariteFromStats(stats) {
  const count = Math.max(0, Number(stats?.count) || 0);
  let key = 'rare';
  if (count === 0) key = 'nouveau';
  else if (count >= 15) key = 'tres_regulier';
  else if (count >= 5) key = 'regulier';
  else if (count >= 2) key = 'occasionnel';
  else key = 'rare';

  return {
    key,
    label: LABELS[key] || LABELS.rare,
    count,
    lastAt: stats?.lastAt || null,
  };
}
