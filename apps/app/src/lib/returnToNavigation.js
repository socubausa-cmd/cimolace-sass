/**
 * Normalisation des cibles de navigation « retour » (query `returnTo`, state, etc.).
 *
 * Configurateur (`/studio/course-builder`) :
 * - `location.state.returnToDesigner` — navigation in-app depuis le dock ;
 * - query `designerReturn` — mêmes cibles, pour onglets / liens externes (consommé au chargement).
 */

export function normalizeReturnTo(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  if (v.startsWith('/owner-dashboard')) {
    if (v.includes('tab=formations')) return v;
    if (v.includes('?')) return `${v}&tab=formations`;
    return `${v}?tab=formations`;
  }
  return v;
}

/**
 * Valeur brute de `searchParams.get('returnTo')` → chemin interne sûr ou null.
 * Refuse les URLs absolues et les schémas suspects.
 *
 * @param {string | null | undefined} encodedFromQuery
 * @returns {string | null}
 */
export function safeReturnToFromQuery(encodedFromQuery) {
  if (!encodedFromQuery || typeof encodedFromQuery !== 'string') return null;
  let decoded;
  try {
    decoded = decodeURIComponent(encodedFromQuery);
  } catch {
    return null;
  }
  const t = String(decoded).trim();
  if (!t.startsWith('/') || t.startsWith('//')) return null;
  if (/[\s\r\n]/.test(t)) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith('javascript:') || lower.includes('://')) return null;
  return normalizeReturnTo(t);
}

/**
 * Cible « retour au designer » passée en `location.state` (non encodée).
 * Limite aux chemins sous `/studio/`.
 *
 * @param {string | null | undefined} path
 * @returns {string | null}
 */
export function safeDesignerReturnPathForState(path) {
  const t = String(path || '').trim();
  if (!t.startsWith('/') || t.startsWith('//')) return null;
  if (t.length > 1024 || /[\r\n]/.test(t)) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith('javascript:') || lower.includes('://')) return null;
  if (!t.startsWith('/studio/')) return null;
  return t;
}
