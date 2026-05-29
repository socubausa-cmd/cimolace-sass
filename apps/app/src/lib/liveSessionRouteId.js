/**
 * Normalise `:sessionId` des routes live (`/live/host/…`, `/studio/live-arena/…`, etc.).
 * Ignore les suffixes collés par erreur (titre, texte copié depuis de la doc).
 *
 * @param {string | undefined} raw
 * @returns {string} UUID en minuscules, ou chaîne vide
 */
export function parseLiveSessionIdFromRouteParam(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (!s) return '';
  try {
    s = decodeURIComponent(s);
  } catch {
    /* ignore */
  }
  s = s.trim();
  const full = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (full.test(s)) return s.toLowerCase();
  const embedded = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.exec(s);
  return embedded ? embedded[0].toLowerCase() : '';
}

/**
 * Remplace le dernier segment du chemin par l'UUID normalisé (ex. `/live/host/dirty…` → `/live/host/<uuid>`).
 */
export function replaceRouteLastSegmentWithSessionId(pathname, sessionId) {
  if (!pathname || !sessionId) return null;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  parts[parts.length - 1] = sessionId;
  return `/${parts.join('/')}`;
}
