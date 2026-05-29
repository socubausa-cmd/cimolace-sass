/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE PROTECTED OWNER ROUTE
 * Protection de route owner pour CIMOLACE
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
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
  return response.json().catch(() => null);
}

const CimolaceProtectedOwnerRoute = ({ children, redirectTo = '/cimolace/admin' }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [fallbackStatus, setFallbackStatus] = useState('checking');

  useEffect(() => {
    if (loading || user) return undefined;
    let cancelled = false;
    setFallbackStatus('checking');

    fetchApiUserFromToken()
      .then((apiUser) => {
        if (!cancelled) setFallbackStatus(isCimolaceOperator(apiUser) ? 'ok' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setFallbackStatus('denied');
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

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
