/**
 * Lecture du contexte tenant via Netlify (résolution Host → DB).
 * Cache court pour limiter les appels à chaque création de session live.
 * Invalidation automatique si le hostname du navigateur change (anti-slug obsolète).
 */

const CACHE_MS = 5 * 60 * 1000;

function currentHostKey() {
  if (typeof window === 'undefined') return '';
  return String(window.location.hostname || '').toLowerCase();
}

/** @type {{ tenant: Record<string, unknown> | null, at: number, host: string }} */
let cache = { tenant: null, at: 0, host: '' };

/** Vide le cache (ex. après bascule explicite de contexte). */
export function invalidateTenantContextCache() {
  cache = { tenant: null, at: 0, host: '' };
}

/**
 * @param {{ forceRefresh?: boolean }} [options]
 * @returns {Promise<null | Record<string, unknown>>}
 */
export async function fetchTenantContext(options = {}) {
  const { forceRefresh = false } = options;
  const now = Date.now();
  const host = currentHostKey();
  const staleHost = Boolean(cache.host && host && cache.host !== host);

  if (!forceRefresh && !staleHost && cache.tenant && now - cache.at < CACHE_MS) {
    return cache.tenant;
  }

  try {
    const res = await fetch('/.netlify/functions/tenant-context', {
      method: 'GET',
      credentials: 'same-origin',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.ok || !body.tenant) {
      cache = { tenant: null, at: now, host };
      return null;
    }
    cache = { tenant: body.tenant, at: now, host };
    return body.tenant;
  } catch {
    cache = { tenant: null, at: now, host };
    return null;
  }
}

/** UUID tenant pour insert live_sessions / autres tables métier. */
export async function resolveCimolaceTenantIdForInsert() {
  const t = await fetchTenantContext();
  const id = t?.tenant_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Modules effectifs (DB → fallback metadata) sous forme `{ live: true, … }`. */
export async function fetchTenantActiveModules() {
  const t = await fetchTenantContext();
  const m = t && typeof t.active_modules === 'object' ? t.active_modules : {};
  const out = {};
  for (const [k, v] of Object.entries(m || {})) {
    if (!k) continue;
    out[String(k).trim().toLowerCase()] = Boolean(v);
  }
  return out;
}

/** Vrai si le module donné est activé pour le tenant courant. */
export async function isTenantModuleEnabled(moduleCode) {
  const code = String(moduleCode || '').trim().toLowerCase();
  if (!code) return false;
  const modules = await fetchTenantActiveModules();
  return Boolean(modules[code]);
}
