import { useEffect } from 'react';
import { useTenantBranding } from '@/hooks/useTenantBranding';

/**
 * TenantFavicon — favicon RÉSOLU PAR TENANT.
 *
 * Modèle : **Cimolace** = la société SaaS ; **LIRI** = son produit (le portail) ;
 * un **tenant** (Prorascience/ISNA, zahirwellness…) ne fait qu'*utiliser* LIRI.
 * Donc sur le domaine d'un TENANT, c'est SA marque qui doit apparaître dans l'onglet
 * (le produit reste invisible, façon Stripe/Zoom) — pas le logo LIRI.
 *
 * Défaut (index.html) = `/lirilogo.png` = LIRI/Cimolace, le PRODUIT (et les domaines
 * Cimolace sans tenant). Dès qu'un vrai tenant est résolu (`slug` présent), on bascule
 * le favicon sur le sien (`branding.favicon`). Aucun hardcode : tout vient du branding.
 */
const LIRI_DEFAULT_FAVICON = '/lirilogo.png';

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
    // Tenant résolu → son favicon ; sinon → défaut LIRI/Cimolace (le produit).
    applyFavicon(slug ? (branding?.favicon || LIRI_DEFAULT_FAVICON) : LIRI_DEFAULT_FAVICON);
  }, [slug, branding?.favicon]);
  return null;
}
