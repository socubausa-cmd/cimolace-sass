/**
 * Lecture du contexte tenant via Netlify (résolution Host → DB).
 * Cache court pour limiter les appels à chaque création de session live.
 * Invalidation automatique si le hostname du navigateur change (anti-slug obsolète).
 *
 * Priorité de résolution du slug :
 *   1. URL path /t/:slug  (admin web, tenant routes)
 *   2. VITE_TENANT_SLUG   (build LIRI mobile dédié, /m/eleve/* sans préfixe /t/)
 *   3. null               → pas de branding tenant
 */

const CACHE_MS = 5 * 60 * 1000;

function currentHostKey() {
  if (typeof window === 'undefined') return '';
  return String(window.location.hostname || '').toLowerCase();
}

function currentPathTenantSlug() {
  if (typeof window === 'undefined') return null;
  // 1. URL /t/:slug
  const match = String(window.location.pathname || '').match(/^\/t\/([^/?#]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  // 2. ?tenant=<slug> explicite — deep-link inter-tenant hors préfixe /t/ (ex : salle
  //    de téléconsultation MEDOS sur /studio/live-arena/:id?tenant=zahirwellness).
  //    Aligne le branding sur le tenant réel de la salle au lieu du défaut isna.
  try {
    const qp = String(new URLSearchParams(window.location.search).get('tenant') || '')
      .trim()
      .toLowerCase();
    if (qp) return qp;
  } catch {
    /* ignore */
  }
  // 3. Env var (LIRI mobile sur /m/eleve/* ou build dédié)
  const envSlug =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TENANT_SLUG) || '';
  return envSlug.trim() || null;
}

function apiBaseUrl() {
  const raw =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
    (typeof window !== 'undefined' && window.__API_URL__) ||
    '';
  // Si vide ou '/', on utilise des chemins relatifs (proxy local :5200)
  const cleaned = String(raw || '').replace(/\/$/, '');
  return cleaned;
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
  const pathSlug = currentPathTenantSlug();
  const host = pathSlug ? `${currentHostKey()}::${pathSlug}` : currentHostKey();
  const staleHost = Boolean(cache.host && host && cache.host !== host);

  if (!forceRefresh && !staleHost && cache.tenant && now - cache.at < CACHE_MS) {
    return cache.tenant;
  }

  const fetchApiTenant = async () => {
    if (!pathSlug) return null;
    // base peut être vide → URL relative (ex: via proxy local)
    const base = apiBaseUrl();
    // /tenants/by-slug/:slug/branding est public (no auth required) et retourne
    // { data: { slug, name, logo_url, brand_colors } } — wrapped by NestJS interceptor
    const res = await fetch(`${base}/tenants/by-slug/${encodeURIComponent(pathSlug)}/branding`);
    const body = await res.json().catch(() => ({}));
    const tenant = body?.data ?? body;
    return res.ok && tenant?.slug ? tenant : null;
  };

  try {
    const res = await fetch('/.netlify/functions/tenant-context', {
      method: 'GET',
      credentials: 'same-origin',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.ok || !body.tenant) {
      const tenant = await fetchApiTenant();
      cache = { tenant, at: now, host };
      return tenant;
    }
    cache = { tenant: body.tenant, at: now, host };
    return body.tenant;
  } catch {
    try {
      const tenant = await fetchApiTenant();
      cache = { tenant, at: now, host };
      return tenant;
    } catch {
      cache = { tenant: null, at: now, host };
      return null;
    }
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
