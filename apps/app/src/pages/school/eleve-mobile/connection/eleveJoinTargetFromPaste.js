import { parseLiveSessionIdFromRouteParam } from '@/lib/liveSessionRouteId';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

/**
 * Extrait l'UUID de session live d'un texte collé (URL complète, chemin, ou extrait).
 */
export function eleveJoinTargetFromPaste(raw) {
  if (raw == null) return '';
  const s0 = String(raw).trim();
  if (!s0) return '';
  const direct = parseLiveSessionIdFromRouteParam(s0);
  if (direct) return direct;
  try {
    const href = /^https?:\/\//i.test(s0) ? s0 : `https://${s0.replace(/^\/+/, '')}`;
    const u = new URL(href);
    const segs = u.pathname.split('/').filter(Boolean);
    for (const seg of segs) {
      const id = parseLiveSessionIdFromRouteParam(seg);
      if (id) return id;
    }
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * Extrait un code d'accès LIRI depuis un texte collé :
 * - URL web `/redeem/:slug`
 * - URL mobile `/m/eleve/connexion/code?join=slug` ou `?code=slug`
 * - code court saisi manuellement.
 */
export function eleveAccessCodeFromPaste(raw) {
  if (raw == null) return '';
  const s0 = String(raw).trim();
  if (!s0) return '';

  try {
    const href = /^https?:\/\//i.test(s0)
      ? s0
      : `${isnaTenantConfig.branding.publicSiteOrigin}/${s0.replace(/^\/+/, '')}`;
    const u = new URL(href);
    const fromQuery = u.searchParams.get('join') || u.searchParams.get('code') || u.searchParams.get('token');
    if (fromQuery) return sanitizeAccessCode(fromQuery);

    const segs = u.pathname.split('/').filter(Boolean);
    const redeemIdx = segs.findIndex((seg) => ['redeem', 'r', 'join'].includes(seg.toLowerCase()));
    if (redeemIdx >= 0 && segs[redeemIdx + 1]) return sanitizeAccessCode(segs[redeemIdx + 1]);
  } catch {
    /* ignore */
  }

  return sanitizeAccessCode(s0);
}

export function sanitizeAccessCode(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 96);
  return cleaned || '';
}
