import { useCallback, useEffect, useState } from 'react';
import { fetchTenantContext } from '@/lib/tenant/fetchTenantContext';

function getSlugFromUrl() {
  try {
    const pathname = window.location.pathname;
    // /t/:slug/* pattern
    const m = pathname.match(/^\/t\/([a-z0-9-]+)/);
    if (m) return m[1];
  } catch {}
  return '';
}

/**
 * Slug tenant pour liens billing / encaissement : résolu depuis le domaine (GET tenant-context),
 * avec détection depuis l'URL (/t/:slug/*) en fallback.
 */
export function useResolvedTenantSlug() {
  const fallback = getSlugFromUrl() || '';
  const [slug, setSlug] = useState(fallback);
  const [loading, setLoading] = useState(true);

  const applyResolvedSlug = useCallback((tenant) => {
    const s = tenant?.slug != null ? String(tenant.slug).trim().toLowerCase() : '';
    if (s) setSlug(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTenantContext()
      .then((t) => {
        if (!cancelled) applyResolvedSlug(t);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyResolvedSlug]);

  useEffect(() => {
    const onPageShow = (e) => {
      if (!e.persisted) return;
      setLoading(true);
      fetchTenantContext({ forceRefresh: true })
        .then((t) => applyResolvedSlug(t))
        .finally(() => setLoading(false));
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [applyResolvedSlug]);

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchTenantContext({ forceRefresh: true })
      .then((t) => applyResolvedSlug(t))
      .finally(() => setLoading(false));
  }, [applyResolvedSlug]);

  return { slug, loading, fallbackSlug: fallback, refetch };
}
