import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import '@/index.css';
import '@/styles/liri-brand-theme.css';
import App from '@/App';
import { hydrateHostTenant } from '@/lib/tenantResolver';
import { activeTenantConfig } from '@/lib/tenant/activeTenantConfig';

// Multi-tenant : résout le tenant depuis le domaine custom (tenant_domains) et le
// met en cache pour les chargements suivants — un nouveau domaine perso fonctionne
// sans modifier le code. Non bloquant. Cf. docs/CIMOLACE_ARCHITECTURE.md §7.
void hydrateHostTenant();

// Accent global RÉSOLU PAR L'HÔTE : surcharge le défaut :root `--school-accent`
// (#d4af37, l'or ISNA, dans index.css) par l'accent du tenant ACTIF résolu —
//   • domaine fondateur (prorascience.org) → or ISNA #D4AF37 (réécrit la même valeur,
//     donc AUCUN changement visuel sur le site live) ;
//   • plateforme / dev (cimolace.space, localhost) → terracotta LIRI #d97757.
// Le produit LIRI ne « porte » donc plus l'or d'ISNA. (Le branding tenant chargé en
// async pourra re-surcharger ensuite via son propre accentColor.)
try {
  const accent = activeTenantConfig?.branding?.accentColor;
  if (accent && typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--school-accent', accent);
  }
} catch {
  /* noop */
}

// Garde-fou anti-chunk périmé : après un (re)déploiement, les imports dynamiques
// (pages lazy) pointent vers d'anciens fichiers JS supprimés → « Failed to fetch
// dynamically imported module ». Vite émet `vite:preloadError` → on recharge UNE
// fois (verrou par timestamp pour éviter toute boucle si le souci persiste).
const CHUNK_RELOAD_KEY = 'chunkReloadAt';
const reloadOnceForChunk = () => {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last < 10000) return false; // déjà rechargé récemment → on n'insiste pas
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
};
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadOnceForChunk();
});
// Exposé pour l'ErrorBoundary (erreur de chunk qui remonte jusqu'à React).
(window as unknown as { __reloadOnceForChunk?: () => boolean }).__reloadOnceForChunk = reloadOnceForChunk;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);
