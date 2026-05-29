/**
 * Normalisation des rôles staff (accents, alias) pour aligner client ↔ API Netlify ↔ RLS.
 */
export function normalizeStaffRole(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const HEARTBEAT_ROLES = new Set(['secretariat', 'admin', 'owner', 'secretaire', 'secretary']);

/**
 * Peut appeler appointments-secretariat-heartbeat (même logique que la fonction Netlify).
 */
export function canServeSecretariatHeartbeat(roleRaw) {
  const n = normalizeStaffRole(roleRaw);
  return HEARTBEAT_ROLES.has(n);
}
