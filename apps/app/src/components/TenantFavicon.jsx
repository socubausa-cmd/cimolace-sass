import { useEffect } from 'react';
import { useTenantBranding } from '@/hooks/useTenantBranding';

/**
 * TenantFavicon — marque du <head> RÉSOLUE PAR TENANT : **favicon + titre d'onglet**.
 *
 * Modèle : **Cimolace** = la société SaaS ; **LIRI** = son produit (le portail) ;
 * un **tenant** (Prorascience/ISNA, zahirwellness…) ne fait qu'*utiliser* LIRI.
 * Donc sur le domaine d'un TENANT, c'est SA marque qui doit apparaître dans l'onglet
 * (favicon + titre) — le produit reste invisible, façon Stripe/Zoom.
 *
 * Défaut (index.html / pas de tenant / domaines Cimolace) = LIRI/Cimolace, le PRODUIT.
 * Dès qu'un vrai tenant est résolu (`slug` présent), on bascule favicon → `branding.favicon`
 * et titre → nom du tenant. Aucun hardcode : tout vient de `useTenantBranding`.
 */
const LIRI_DEFAULT_FAVICON = '/lirilogo.png';
const LIRI_DEFAULT_TITLE = 'LIRI';

function applyFavicon(href) {
  if (typeof document === 'undefined' || !href) return;
  const type = href.toLowerCase().endsWith('.ico') ? 'image/x-icon' : 'image/png';
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.type = type;
  icon.href = href;
  const apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (apple) apple.href = href;
}

export default function TenantFavicon() {
  const { slug, branding } = useTenantBranding();
  useEffect(() => {
    // Tenant résolu → sa marque ; sinon → défaut LIRI/Cimolace (le produit).
    applyFavicon(slug ? (branding?.favicon || LIRI_DEFAULT_FAVICON) : LIRI_DEFAULT_FAVICON);
    const tenantTitle = slug ? (branding?.fullName || branding?.name) : null;
    document.title = tenantTitle || LIRI_DEFAULT_TITLE;
  }, [slug, branding?.favicon, branding?.fullName, branding?.name]);
  return null;
}
