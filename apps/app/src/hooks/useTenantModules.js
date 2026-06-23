/**
 * Hooks React basés sur le resolver d'hôte canonique (Netlify /tenant-context).
 * Source unique des modules effectifs : DB → fallback metadata.
 *
 * Usage :
 *   const { tenant, modules, isModuleEnabled } = useTenantContext();
 *   const isLiveOn = useTenantModule('live');
 *
 * NE PAS écrire `if (slug === 'isna') …` dans les composants : utiliser
 * `useTenantModule('xxx')` ou lire `modules['xxx']`.
 */

import { useEffect, useMemo, useState } from 'react';
import { fetchTenantContext } from '@/lib/tenant/fetchTenantContext';
import { normalizeTenantBranding } from '@/lib/tenant/tenantBranding';
import { setActiveTenantBranding } from '@/lib/tenant/activeBranding';

function normalizeModules(active) {
  const src = active && typeof active === 'object' ? active : {};
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (!k) continue;
    out[String(k).trim().toLowerCase()] = Boolean(v);
  }
  return out;
}

export function useTenantContext({ forceRefresh = false } = {}) {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTenantContext({ forceRefresh })
      .then((t) => {
        if (cancelled) return;
        setTenant(t);
        setActiveTenantBranding(t); // sync l'accesseur synchrone (code hors-React)
        setError(t ? null : new Error('tenant_not_resolved'));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setTenant(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [forceRefresh]);

  const modules = useMemo(() => normalizeModules(tenant?.active_modules), [tenant]);
  const branding = useMemo(() => normalizeTenantBranding(tenant), [tenant]);

  const isModuleEnabled = useMemo(
    () => (code) => Boolean(modules[String(code || '').trim().toLowerCase()]),
    [modules],
  );

  return {
    tenant,
    modules,
    isModuleEnabled,
    branding,
    plan: tenant?.plan || 'unknown',
    slug: tenant?.slug || null,
    tenantId: tenant?.tenant_id || null,
    loading,
    error,
  };
}

/** Vrai si le module passé est activé pour le tenant courant. */
export function useTenantModule(code) {
  const { isModuleEnabled, loading } = useTenantContext();
  const enabled = isModuleEnabled(code);
  return { enabled, loading };
}

export default useTenantContext;
