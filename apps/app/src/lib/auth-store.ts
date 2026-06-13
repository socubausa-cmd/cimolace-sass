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
  // Résolution par DOMAINE custom (tenant_domains via API, en cache) — prioritaire, multi-tenant.
  const byHost = getCachedHostTenant(window.location.hostname);
  if (byHost) return byHost;
  const pathname = normalizeTenantSlug(window.location.pathname);
  const search = normalizeTenantSlug(window.location.search);
  if (pathname.includes('/prorascience') || search.includes('prorascience')) return DEFAULT_TENANT_SLUG;
  if (pathname.startsWith('/m/eleve') || pathname.startsWith('/dev/liri-host-live')) return DEFAULT_TENANT_SLUG;
  if (pathname.startsWith('/student-school-life') || pathname.startsWith('/teacher-space')) return DEFAULT_TENANT_SLUG;
  if (pathname.startsWith('/secretariat-space') || pathname.startsWith('/classroom')) return DEFAULT_TENANT_SLUG;
  if (pathname.startsWith('/live/') || pathname.startsWith('/live-manager')) return DEFAULT_TENANT_SLUG;
  if (pathname.startsWith('/cimolace')) return DEFAULT_TENANT_SLUG;
  const tenantMatch = pathname.match(/^\/t\/([a-z0-9-]+)/);
  if (tenantMatch?.[1]) return tenantMatch[1];
  return '';
}

export const authStore = {
  // Lecture : nouvelle clé puis ancienne (compat) — pas de déconnexion à la bascule.
  getToken: () => localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY) ?? '',
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
