import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { authStore } from '@/lib/auth-store';
import { getStoredOAuthTenant, clearStoredOAuthTenant } from '@/lib/googleOAuth';
import { getApiBaseUrl } from '@/lib/apiBase';

/**
 * Callback OAuth Google pour le flux multi-tenant Cimolace.
 *
 * Scénarios :
 *  1. ?tenant=slug présent ET rôle staff/owner      → /t/:slug/admin
 *  2. ?tenant=slug présent ET rôle élève/membre     → /student-school-life/dashboard
 *  3. ?tenant=slug présent MAIS non-membre          → /t/:slug/login?error=not_member
 *  4. Pas de tenant + cimolace_staff                → /cimolace/admin
 *  5. Pas de tenant + non-staff                     → /cimolace/login?error=forbidden
 *
 * Fallback : si ?tenant= est absent, on lit sessionStorage (stocké avant le départ OAuth).
 */

const DEV_CIMOLACE_EMAIL = 'cimolace-admin@prorascience.local';

function normalizeSlug(v) {
  return String(v || '').trim().toLowerCase();
}

function getTenantMembershipSlug(membership) {
  return normalizeSlug(membership?.tenants?.slug);
}

function getMembershipRole(membership) {
  return String(membership?.role || membership?.member_role || '').trim().toLowerCase();
}

async function getTenantMembership(userId, tenantSlug, token) {
  if (!token || !tenantSlug || !userId) return null;
  try {
    const resp = await fetch(`${getApiBaseUrl()}/tenants/mine`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': tenantSlug,
      },
    });
    if (!resp.ok) return null;
    const body = await resp.json().catch(() => ({}));
    const tenants = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    return tenants.find((t) => getTenantMembershipSlug(t) === tenantSlug) || null;
  } catch {
    return null;
  }
}

function isCimolaceOperator(candidate) {
  if (!candidate) return false;
  const role = String(candidate.role || '').toLowerCase();
  const email = String(candidate.email || '').trim().toLowerCase();
  return (
    role === 'owner' ||
    role === 'admin' ||
    candidate.cimolace_staff === true ||
    candidate.metadata?.cimolace_staff === true ||
    (import.meta.env.DEV && email === DEV_CIMOLACE_EMAIL)
  );
}

async function checkCimolaceStaff(token) {
  if (!token) return false;
  try {
    const resp = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return false;
    const apiUser = await resp.json().catch(() => null);
    return isCimolaceOperator(apiUser);
  } catch {
    return false;
  }
}

/** Nettoie les clés PKCE / OAuth Supabase laissées dans le storage après le callback. */
function clearOAuthState() {
  try {
    const storages = [window.sessionStorage, window.localStorage].filter(Boolean);
    storages.forEach((st) => {
      for (let i = st.length - 1; i >= 0; i -= 1) {
        const k = st.key(i);
        if (!k) continue;
        if (k.startsWith('sb-') && k.includes('-auth-token')) st.removeItem(k);
        if (k.includes('supabase') && (k.includes('pkce') || k.includes('code-verifier') || k.includes('oauth'))) st.removeItem(k);
      }
    });
  } catch { /* ignore */ }
}

export default function CimolaceGoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'error'

  useEffect(() => {
    let cancelled = false;

    const handleGoogleCallback = async () => {
      try {
        // 1. Récupérer la session Supabase (le callback OAuth a été traité par Supabase)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[google-callback] session error:', sessionError.message);
          if (!cancelled) {
            clearOAuthState();
            setStatus('error');
            navigate('/cimolace/login?error=google_oauth_error', { replace: true });
          }
          return;
        }

        if (!session?.user) {
          if (!cancelled) {
            clearOAuthState();
            setStatus('error');
            const tenant = searchParams.get('tenant') || getStoredOAuthTenant();
            const base = tenant ? `/t/${tenant}/login` : '/cimolace/login';
            navigate(`${base}?error=no_session`, { replace: true });
          }
          return;
        }

        // 2. Synchroniser authStore avec le token de session
        try {
          authStore.setToken(session.access_token || '');
        } catch { /* ignore */ }

        // 3. Déterminer le tenant (URL d'abord, puis sessionStorage fallback)
        let tenant = normalizeSlug(searchParams.get('tenant'));
        if (!tenant) {
          tenant = getStoredOAuthTenant();
        }

        // 4. Si tenant présent → flux école (owner / élève / prof / membre)
        if (tenant) {
          authStore.setTenantSlug(tenant);

          // Vérifier l'appartenance et le rôle dans le tenant
          const membership = await getTenantMembership(
            session.user.id,
            tenant,
            session.access_token,
          );
          const role = getMembershipRole(membership);
          const adminRoles = new Set(['owner', 'admin', 'teacher', 'secretariat', 'creator']);

          clearStoredOAuthTenant();

          if (!cancelled) {
            if (membership && adminRoles.has(role)) {
              clearOAuthState();
              navigate(`/t/${tenant}/admin`, { replace: true });
            } else if (membership) {
              clearOAuthState();
              navigate('/student-school-life/dashboard', { replace: true });
            } else {
              clearOAuthState();
              navigate(
                `/t/${tenant}/login?error=not_member`,
                { replace: true, state: { error: 'Votre compte Google n\'est pas associé à cette école. Contactez votre administrateur.' } },
              );
            }
          }
          return;
        }

        // 5. Pas de tenant → flux opérateur Cimolace (vérifier cimolace_staff)
        clearStoredOAuthTenant();
        authStore.setTenantSlug('isna');

        const isStaff = await checkCimolaceStaff(session.access_token);

        if (!cancelled) {
          if (isStaff) {
            clearOAuthState();
            navigate('/cimolace/admin', { replace: true });
          } else {
            clearOAuthState();
            navigate('/cimolace/login?error=forbidden', { replace: true });
          }
        }
      } catch (err) {
        console.error('[google-callback] unexpected error:', err?.message || err);
        if (!cancelled) {
          clearOAuthState();
          setStatus('error');
          const tenant = searchParams.get('tenant') || getStoredOAuthTenant();
          const base = tenant ? `/t/${tenant}/login` : '/cimolace/login';
          navigate(`${base}?error=callback_failed`, { replace: true });
        }
      }
    };

    handleGoogleCallback();

    return () => { cancelled = true; };
  }, [searchParams, navigate]);

  return (
    <>
      <Helmet>
        <title>Connexion Google — CIMOLACE</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white text-center">
          {status === 'error' ? (
            <>
              <div className="text-red-400 text-5xl mb-4">!</div>
              <p className="text-lg text-red-300">Erreur de connexion Google</p>
              <p className="text-sm text-gray-400 mt-2">Veuillez réessayer ou contacter le support.</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg">Connexion avec Google...</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
