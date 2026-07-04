import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import '@/index.css';
import '@/styles/liri-brand-theme.css';
import App from '@/App';
import { activeTenantConfig } from '@/lib/tenant/activeTenantConfig';
import {
  hydrateHostTenant,
  isPlatformOrDevHost,
  getCachedHostTenant,
} from '@/lib/tenantResolver';

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

/**
 * BOOTSTRAP MULTI-TENANT (gate « host résolu ») :
 * `activeTenantConfig` est une constante évaluée à l'IMPORT de l'app — elle lit le
 * cache localStorage host→tenant de façon SYNCHRONE. Au tout PREMIER visit d'un
 * domaine perso jamais vu (cache vide), un import statique rendrait l'identité
 * NEUTRE (flash « LIRI ») et le routing de repli. On importe donc l'app en
 * DYNAMIQUE, après avoir résolu le host :
 *   • hôte plateforme/dev, ou domaine custom DÉJÀ en cache → rendu immédiat
 *     (hydratation rafraîchie en fond, comportement inchangé) ;
 *   • domaine custom INCONNU → on ATTEND l'hydratation (plafonnée à 2.5 s —
 *     API down = rendu neutre, jamais d'écran blanc), puis on rend : le tenant
 *     affiche SON identité dès le premier paint. Cf. activeTenantConfig.js.
 */
async function boot() {
  const host = String(window.location.hostname || '').toLowerCase();
  if (!isPlatformOrDevHost(host) && !getCachedHostTenant(host)) {
    await Promise.race([
      hydrateHostTenant(),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } else {
    // Multi-tenant : rafraîchit le cache domaine→tenant en fond (réglages frais).
    void hydrateHostTenant();
  }

  // Accent global RÉSOLU PAR L'HÔTE : surcharge le défaut :root `--school-accent`
  // (#d4af37, l'or ISNA, dans index.css) par l'accent du tenant ACTIF résolu —
  //   • domaine fondateur (prorascience.org) → or ISNA #D4AF37 (aucun changement) ;
  //   • plateforme / dev → terracotta LIRI #d97757 ;
  //   • domaine perso d'un tenant → SON accent (brand_colors, cache hydraté).
  try {
    const accent = activeTenantConfig?.branding?.accentColor;
    if (accent && typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--school-accent', accent);
    }
  } catch {
    /* noop */
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </StrictMode>
  );
}

void boot();
