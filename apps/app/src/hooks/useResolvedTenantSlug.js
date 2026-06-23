import { useCallback, useEffect, useState } from 'react';
import { fetchTenantContext } from '@/lib/tenant/fetchTenantContext';
import supabase from '@/lib/customSupabaseClient';

function getSlugFromUrl() {
  try {
    const pathname = window.location.pathname;
    // /t/:slug/* pattern
    const m = pathname.match(/^\/t\/([a-z0-9-]+)/);
    if (m) return m[1];
  } catch {}
  return '';
}

// Cache module-level host→slug : sur une route "propre" (sans /t/:slug) le hook
// peut être monté par plusieurs composants, inutile d'appeler l'edge à chaque fois.
let hostSlugCache = { host: '', slug: '' };

/**
 * Résout le slug depuis le HOSTNAME via l'edge tenant-by-host (lookup
 * tenant_domains en service_role). Fallback ultime quand l'URL ne contient pas
 * /t/:slug et que le contexte tenant (domaine) n'a rien donné — ex: l'écran
 * /admin/settings du tenant primaire sur son propre domaine, rechargé à froid.
 */
async function resolveSlugByHost() {
  try {
    const host = String(window.location.hostname || '').trim().toLowerCase();
    if (!host) return '';
    if (hostSlugCache.host === host && hostSlugCache.slug) return hostSlugCache.slug;
    const { data, error } = await supabase.functions.invoke('tenant-by-host', { body: { host } });
    if (error) return '';
    const slug = data?.slug ? String(data.slug).trim().toLowerCase() : '';
    if (slug) hostSlugCache = { host, slug };
    return slug;
  } catch {
    return '';
  }
}

/**
 * Slug tenant pour liens billing / réglages / encaissement. Cascade de résolution :
 *   1. URL /t/:slug              (synchrone, admin web + routes tenant)
 *   2. contexte domaine          (fetchTenantContext → GET tenant-context)
 *   3. hostname via edge         (tenant-by-host, robuste au rechargement à froid)
 */
export function useResolvedTenantSlug() {
  const fallback = getSlugFromUrl() || '';
  const [slug, setSlug] = useState(fallback);
  const [loading, setLoading] = useState(true);

  const resolve = useCallback(async ({ forceRefresh = false } = {}) => {
    // 1. URL /t/:slug — résolution synchrone, aucun réseau nécessaire.
    const urlSlug = getSlugFromUrl();
    if (urlSlug) {
      setSlug(urlSlug);
      return urlSlug;
    }
    // 2. Contexte tenant par domaine (peut être null sur un hébergement où l'API
    //    n'est pas servie en JSON, ex: Vercel sans la fonction tenant-context).
    let resolved = '';
    try {
      const t = await fetchTenantContext({ forceRefresh });
      resolved = t?.slug != null ? String(t.slug).trim().toLowerCase() : '';
    } catch {
      resolved = '';
    }
    // 3. Fallback hostname → edge tenant-by-host.
    if (!resolved) {
      resolved = await resolveSlugByHost();
    }
    if (resolved) setSlug(resolved);
    return resolved;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    resolve()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolve]);

  useEffect(() => {
    const onPageShow = (e) => {
      if (!e.persisted) return;
      setLoading(true);
      resolve({ forceRefresh: true })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [resolve]);

  const refetch = useCallback(() => {
    setLoading(true);
    return resolve({ forceRefresh: true })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [resolve]);

  return { slug, loading, fallbackSlug: fallback, refetch };
}
