const TOKEN_KEY = 'isna-v2-debug-api-bearer';
const TENANT_KEY = 'isna-v2-tenant-slug';
const LEGACY_TENANT_KEY = 'tenantSlug';

function normalizeTenantSlug(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function inferTenantSlugFromLocation() {
  if (typeof window === 'undefined') return '';
  const pathname = normalizeTenantSlug(window.location.pathname);
  const search = normalizeTenantSlug(window.location.search);
  if (pathname.includes('/prorascience') || search.includes('prorascience')) return 'isna';
  if (pathname.startsWith('/m/eleve') || pathname.startsWith('/dev/liri-host-live')) return 'isna';
  if (pathname.startsWith('/student-school-life') || pathname.startsWith('/teacher-space')) return 'isna';
  if (pathname.startsWith('/secretariat-space') || pathname.startsWith('/classroom')) return 'isna';
  if (pathname.startsWith('/live/') || pathname.startsWith('/live-manager')) return 'isna';
  if (pathname.startsWith('/cimolace')) return 'isna';
  const tenantMatch = pathname.match(/^\/t\/([a-z0-9-]+)/);
  if (tenantMatch?.[1]) return tenantMatch[1];
  return '';
}

export const authStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY) ?? '',
  setToken: (v: string) => {
    if (v.trim()) localStorage.setItem(TOKEN_KEY, v.trim());
    else localStorage.removeItem(TOKEN_KEY);
  },
  getTenantSlug: () => {
    const stored = normalizeTenantSlug(localStorage.getItem(TENANT_KEY));
    if (stored) return stored;
    const legacy = normalizeTenantSlug(localStorage.getItem(LEGACY_TENANT_KEY));
    if (legacy) return legacy;
    return inferTenantSlugFromLocation();
  },
  setTenantSlug: (v: string) => {
    const normalized = normalizeTenantSlug(v);
    if (normalized) {
      localStorage.setItem(TENANT_KEY, normalized);
      localStorage.setItem(LEGACY_TENANT_KEY, normalized);
    } else {
      localStorage.removeItem(TENANT_KEY);
      localStorage.removeItem(LEGACY_TENANT_KEY);
    }
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(LEGACY_TENANT_KEY);
  },
};
