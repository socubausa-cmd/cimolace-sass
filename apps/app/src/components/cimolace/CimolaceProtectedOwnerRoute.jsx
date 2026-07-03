/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE PROTECTED OWNER ROUTE
 * Protection de route owner pour CIMOLACE
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';
import { Loader2 } from 'lucide-react';

const DEV_CIMOLACE_EMAIL = 'cimolace-admin@prorascience.local';

function isCimolaceOperator(candidate) {
  const role = String(candidate?.role || '').toLowerCase();
  const email = String(candidate?.email || '').trim().toLowerCase();
  return (
    role === 'owner' ||
    role === 'admin' ||
    candidate?.cimolace_staff === true ||
    candidate?.metadata?.cimolace_staff === true ||
    (import.meta.env.DEV && email === DEV_CIMOLACE_EMAIL)
  );
}

/**
 * Staff Cimolace décidé directement d'après la SESSION Supabase : le JWT porte
 * `user_metadata.cimolace_staff`. C'est la SOURCE DE VÉRITÉ du fallback — elle ne
 * dépend d'aucun appel réseau. (Même helper que CimolaceGoogleCallback.)
 */
function isCimolaceStaffFromSession(session) {
  return session?.user?.user_metadata?.cimolace_staff === true;
}

async function fetchApiUserFromToken() {
  let token = authStore.getToken();
  for (let attempt = 0; !token && attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    token = authStore.getToken();
  }
  if (!token) return null;
  const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  // L'API enveloppe la réponse dans { data: ... } (ResponseInterceptor). On déballe
  // pour exposer role/cimolace_staff/metadata à isCimolaceOperator (sinon on lisait
  // l'enveloppe → tous les champs undefined → owner refusé en `?error=forbidden`).
  if (json && typeof json === 'object' && 'data' in json) return json.data;
  return json;
}

/**
 * Repli quand `useAuth().user` est momentanément null alors que la session existe.
 * 1) La session Supabase persistée (localStorage) porte `user_metadata.cimolace_staff` :
 *    décision locale, sans réseau, robuste même si l'API est lente/en erreur.
 * 2) À défaut, /auth/me enrichi (role + cimolace_staff), déballé.
 */
async function resolveFallbackOperator() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (isCimolaceStaffFromSession(session)) return true;
  } catch {
    // ignore — repli sur /auth/me
  }
  return isCimolaceOperator(await fetchApiUserFromToken());
}

const CimolaceProtectedOwnerRoute = ({ children, redirectTo = '/cimolace/admin' }) => {
  const { user, session, loading } = useAuth();
  const location = useLocation();
  const [fallbackStatus, setFallbackStatus] = useState('checking');

  useEffect(() => {
    if (loading || user) return undefined;
    let cancelled = false;
    setFallbackStatus('checking');

    // Chemin rapide : la session déjà hydratée dans le contexte porte le flag staff
    // (JWT user_metadata.cimolace_staff). Décision synchrone, sans réseau.
    if (isCimolaceStaffFromSession(session)) {
      setFallbackStatus('ok');
      return undefined;
    }

    // Repli async : session persistée (getSession) puis /auth/me enrichi.
    resolveFallbackOperator()
      .then((ok) => {
        if (!cancelled) setFallbackStatus(ok ? 'ok' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setFallbackStatus('denied');
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user, session]);

  if (loading || (!user && fallbackStatus === 'checking')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!user && fallbackStatus !== 'ok') {
    return <Navigate to="/cimolace/login" state={{ from: location }} replace />;
  }

  // Check if user is owner/admin or explicitly flagged as CIMOLACE staff.
  const isOwner = user ? isCimolaceOperator(user) : fallbackStatus === 'ok';
  
  if (!isOwner) {
    return <Navigate to="/cimolace/login?error=forbidden" replace />;
  }

  return children;
};

export default CimolaceProtectedOwnerRoute;
