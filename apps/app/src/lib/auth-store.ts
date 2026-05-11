const TOKEN_KEY = 'isna-v2-debug-api-bearer';
const TENANT_KEY = 'isna-v2-tenant-slug';

export const authStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY) ?? '',
  setToken: (v: string) => {
    if (v.trim()) localStorage.setItem(TOKEN_KEY, v.trim());
    else localStorage.removeItem(TOKEN_KEY);
  },
  getTenantSlug: () => localStorage.getItem(TENANT_KEY) ?? '',
  setTenantSlug: (v: string) => {
    if (v.trim()) localStorage.setItem(TENANT_KEY, v.trim());
    else localStorage.removeItem(TENANT_KEY);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_KEY);
  },
};
