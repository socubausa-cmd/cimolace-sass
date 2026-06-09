/**
 * TenantProtectedRoute — vérifie que l'utilisateur connecté
 * est bien membre du tenant indiqué dans l'URL (:tenantSlug).
 *
 * Utilise GET /tenants/mine pour récupérer la liste des tenants
 * auxquels l'utilisateur appartient, puis compare le slug.
 *
 * Si non-membre → redirige vers /t/:tenantSlug/login
 * Si non-connecté → redirige vers /t/:tenantSlug/login
 */
import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

async function fetchTenantMemberships() {
  let token = authStore.getToken();
  for (let attempt = 0; !token && attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    token = authStore.getToken();
  }
  if (!token) return [];
  const slug = authStore.getTenantSlug();
  const response = await fetch(`${getApiBaseUrl()}/tenants/mine`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(slug ? { 'X-Tenant-Slug': slug } : {}),
    },
  });
  if (!response.ok) return [];
  const body = await response.json().catch(() => ({}));
  // L'API enveloppe la liste : { data: { data: [...] } } (double), ou { data: [...] }, ou [...].
  const payload = body?.data?.data ?? body?.data ?? body;
  return Array.isArray(payload) ? payload : [];
}

export default function TenantProtectedRoute({ children }) {
  const { tenantSlug } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'denied'

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    const expectedSlug = normalizeSlug(tenantSlug);
    const checkMembership = async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const tenants = await fetchTenantMemberships();
        const isMember = Array.isArray(tenants) && tenants.some(
          (t) =>
            normalizeSlug(t.slug) === expectedSlug ||
            normalizeSlug(t.app_slug) === expectedSlug ||
            normalizeSlug(t.tenants?.slug) === expectedSlug ||
            normalizeSlug(t.tenants?.app_slug) === expectedSlug,
        );
        if (cancelled) return;
        if (isMember) {
          setStatus('ok');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!cancelled) setStatus('denied');
    };

    checkMembership().catch(() => {
      if (!cancelled) setStatus('denied');
    });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, tenantSlug]);

  if (authLoading || status === 'checking') {
    return (
      <div style={{
        minHeight: '100vh', background: '#0d1117',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '32px', height: '32px',
          border: '3px solid rgba(124,58,237,0.2)',
          borderTopColor: '#7c3aed',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <Navigate
        to={`/t/${tenantSlug}/login`}
        state={{ error: 'Accès réservé aux membres de cette école.' }}
        replace
      />
    );
  }

  return children;
}
