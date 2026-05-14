/**
 * Côté navigateur : normalisation du host uniquement.
 * La résolution DB (tenant_id, plan, modules) se fait sur les fonctions Netlify / Edge.
 */

export function normalizeBrowserHostname() {
  if (typeof window === 'undefined' || !window.location?.hostname) return null;
  return String(window.location.hostname).toLowerCase();
}
