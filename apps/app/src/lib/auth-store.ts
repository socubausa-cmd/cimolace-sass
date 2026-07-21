import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { getCachedHostTenant } from './tenantResolver';

// Clés de stockage NEUTRES (plateforme Cimolace, pas un tenant).
// Les anciennes clés `isna-v2-*` sont lues en REPLI (rétro-compat : aucune
// déconnexion des sessions existantes) puis migrées à la prochaine écriture.
const TOKEN_KEY = 'cimolace-v2-api-bearer';
const TENANT_KEY = 'cimolace-v2-tenant-slug';
const LEGACY_TOKEN_KEY = 'isna-v2-debug-api-bearer';
const LEGACY_TENANT_KEY_ISNA = 'isna-v2-tenant-slug';
const LEGACY_TENANT_KEY = 'tenantSlug'; // clé partagée avec d'autres lecteurs directs — conservée

function normalizeTenantSlug(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function inferTenantSlugFromLocation() {
  if (typeof window === 'undefined') return '';
  const host = String(window.location.hostname || '').toLowerCase();
  // Résolution par DOMAINE custom (tenant_domains via API, en cache) — prioritaire, multi-tenant.
  const byHost = getCachedHostTenant(host);
  if (byHost) return byHost;
  const pathname = normalizeTenantSlug(window.location.pathname);
  const search = normalizeTenantSlug(window.location.search);
  // `/t/:slug` EXPLICITE nomme un tenant : légitime sur N'IMPORTE quel host (deep-link inter-tenant).
  const tenantMatch = pathname.match(/^\/t\/([a-z0-9-]+)/);
  if (tenantMatch?.[1]) return tenantMatch[1];
  // HOST NEUTRE DE PRODUCTION (*.cimolace.space = liri./app.cimolace.space) = realm NEUTRE : on ne
  // DEVINE JAMAIS un tenant depuis un chemin PARTAGÉ (/student-school-life, /live/, /cimolace…). Ces
  // chemins sont montés dans PLUSIEURS realms ; inférer le tenant par défaut y ferait FUITER le host
  // neutre vers ISNA (cf. audit cloison 3-realms, fuite « realm décidé par le chemin/compte », #①).
  // Sur ce host, seul un domaine custom (ci-dessus) ou un /t/:slug explicite nomme un tenant.
  // NB : le dev local (localhost/.local) est VOLONTAIREMENT exclu — il conserve le tenant par défaut
  // comme commodité de test (aucun realm de production n'est en jeu).
  const isProdPlatformHost = host === 'cimolace.space' || host.endsWith('.cimolace.space');
  if (isProdPlatformHost) return '';
  // HOST TENANT (ex. prorascience.org) OU dev local : l'inférence par chemin reste légitime (mono-realm).
  if (pathname.includes('/prorascience') || search.includes('prorascience')) return DEFAULT_TENANT_SLUG;
  if (pathname.startsWith('/m/eleve') || pathname.startsWith('/dev/liri-host-live')) return DEFAULT_TENANT_SLUG;
  if (pathname.startsWith('/student-school-life') || pathname.startsWith('/teacher-space')) return DEFAULT_TENANT_SLUG;
  if (pathname.startsWith('/secretariat-space') || pathname.startsWith('/classroom')) return DEFAULT_TENANT_SLUG;
  if (pathname.startsWith('/live/') || pathname.startsWith('/live-manager')) return DEFAULT_TENANT_SLUG;
  if (pathname.startsWith('/cimolace')) return DEFAULT_TENANT_SLUG;
  return '';
}

/**
 * `?tenant=<slug>` explicite dans l'URL courante. Sert aux deep-links inter-tenant
 * (ex : salle de téléconsultation MEDOS ouverte depuis un AUTRE tenant que celui en
 * cache). Lu à chaud — JAMAIS persisté, pour ne pas « coller » le studio sur ce
 * tenant après coup (ce qui pourrait régresser isna dans le même navigateur).
 */
function queryTenantSlug() {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeTenantSlug(new URLSearchParams(window.location.search).get('tenant'));
  } catch {
    return '';
  }
}

// ─── IMPERSONATION ENCADRÉE (§15) ───────────────────────────────────────────
// Contexte PER-ONGLET (sessionStorage) : l'opérateur ouvre l'espace tenant dans un
// NOUVEL onglet — sa session staff (localStorage) des autres onglets n'est jamais
// touchée. Quand une impersonation active existe, le token + le slug tenant sont
// surchargés pour CET onglet uniquement. Expiration = sortie automatique.
const IMP_KEY = 'cimolace-impersonation';

export interface ImpersonationContext {
  token: string;
  tenantSlug: string;
  tenantName?: string | null;
  reason: string;
  operator?: string | null;
  clientId?: string | null;
  expiresAt: string; // ISO
}

function readImpersonation(): ImpersonationContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(IMP_KEY);
    if (!raw) return null;
    const ctx = JSON.parse(raw) as ImpersonationContext;
    if (!ctx?.token || !ctx?.expiresAt) return null;
    if (Date.parse(ctx.expiresAt) <= Date.now()) {
      // Expiré → sortie automatique (nettoyage silencieux).
      sessionStorage.removeItem(IMP_KEY);
      return null;
    }
    return ctx;
  } catch {
    return null;
  }
}

export const impersonationStore = {
  get: readImpersonation,
  set: (ctx: ImpersonationContext) => {
    try { sessionStorage.setItem(IMP_KEY, JSON.stringify(ctx)); } catch { /* noop */ }
  },
  clear: () => {
    try { sessionStorage.removeItem(IMP_KEY); } catch { /* noop */ }
  },
  isActive: () => readImpersonation() !== null,
};

export const authStore = {
  // Lecture : impersonation active (per-onglet) PRIORITAIRE, sinon nouvelle clé puis ancienne.
  getToken: () => {
    const imp = readImpersonation();
    if (imp) return imp.token;
    return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY) ?? '';
  },
  setToken: (v: string) => {
    if (v.trim()) {
      localStorage.setItem(TOKEN_KEY, v.trim());
      localStorage.removeItem(LEGACY_TOKEN_KEY); // migration de l'ancienne clé
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
  },
  getTenantSlug: () => {
    // 0a. Impersonation active (per-onglet) : le tenant cible prime sur tout.
    const imp = readImpersonation();
    if (imp?.tenantSlug) return imp.tenantSlug;
    // 0b. `?tenant=` explicite = deep-link inter-tenant : priorité absolue, écrase un
    //    localStorage périmé (sinon le studio retombe sur le tenant précédent / isna).
    //    C'est le cas de la salle de téléconsultation MEDOS ouverte depuis Zahir.
    const fromQuery = queryTenantSlug();
    if (fromQuery) return fromQuery;
    const stored =
      normalizeTenantSlug(localStorage.getItem(TENANT_KEY)) ||
      normalizeTenantSlug(localStorage.getItem(LEGACY_TENANT_KEY_ISNA)) ||
      normalizeTenantSlug(localStorage.getItem(LEGACY_TENANT_KEY));
    if (stored) return stored;
    return inferTenantSlugFromLocation();
  },
  setTenantSlug: (v: string) => {
    const normalized = normalizeTenantSlug(v);
    if (normalized) {
      localStorage.setItem(TENANT_KEY, normalized);
      localStorage.setItem(LEGACY_TENANT_KEY, normalized); // compat des lecteurs directs ('tenantSlug')
      localStorage.removeItem(LEGACY_TENANT_KEY_ISNA); // migration de l'ancienne clé isna
    } else {
      localStorage.removeItem(TENANT_KEY);
      localStorage.removeItem(LEGACY_TENANT_KEY);
      localStorage.removeItem(LEGACY_TENANT_KEY_ISNA);
    }
  },
  clear: () => {
    [TOKEN_KEY, LEGACY_TOKEN_KEY, TENANT_KEY, LEGACY_TENANT_KEY_ISNA, LEGACY_TENANT_KEY].forEach(
      (k) => localStorage.removeItem(k),
    );
  },
};
