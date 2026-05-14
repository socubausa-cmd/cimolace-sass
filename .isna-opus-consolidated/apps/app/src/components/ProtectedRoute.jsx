import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';
import { getSelectedAccountRole, hasMultiRoleAccess } from '@/lib/accountRoleMode';
import { CHOOSE_ACCOUNT_TYPE_PATHS, getChooseAccountTypePath } from '@/lib/chooseAccountTypePath';
import { getLoginEntryPath } from '@/lib/loginEntryPath';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // DESIGN PREVIEW — bypass auth en dev avec ?preview=1
  const isPreview = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1';
  const [slowLoad, setSlowLoad] = useState(false);
  // Hard timeout: after 20s, stop waiting regardless of loading state
  const [timedOut, setTimedOut] = useState(false);

  const effectiveLoading = Boolean(loading) && !timedOut;
  const effectiveUser = user;

  useEffect(() => {
    if (!effectiveLoading) return;
    const slow = window.setTimeout(() => setSlowLoad(true), 8000);
    const hard = window.setTimeout(() => setTimedOut(true), 20000);
    return () => { window.clearTimeout(slow); window.clearTimeout(hard); };
  }, [effectiveLoading]);

  useEffect(() => {
    if (!effectiveLoading) { setSlowLoad(false); setTimedOut(false); }
  }, [effectiveLoading]);

  if (isPreview) return children;

  if (effectiveLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#0F1419] p-6">
        <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" />
        <p className="text-center text-sm text-gray-400">Vérification de la session…</p>
        {slowLoad && (
          <div className="max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center space-y-3">
            <p className="text-sm text-amber-200 font-medium">
              La connexion prend plus de temps que prévu.
            </p>
            <ul className="text-xs text-amber-300/80 text-left space-y-1 list-disc list-inside">
              <li>Vérifiez votre connexion internet</li>
              <li>Le projet Supabase est peut-être en pause (plan gratuit)</li>
              <li>Videz le cache du navigateur et réessayez</li>
            </ul>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
              >
                Réessayer
              </button>
              <button
                type="button"
                onClick={() => { window.localStorage.clear(); window.location.replace(getLoginEntryPath()); }}
                className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/10"
              >
                Déconnexion forcée
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!effectiveUser) {
    return <Navigate to={getLoginEntryPath()} state={{ from: location }} replace />;
  }

  const pathname = String(location.pathname || '');
  const choosePath = getChooseAccountTypePath();
  if (
    hasMultiRoleAccess(effectiveUser) &&
    !getSelectedAccountRole() &&
    !CHOOSE_ACCOUNT_TYPE_PATHS.includes(pathname)
  ) {
    return <Navigate to={choosePath} replace />;
  }

  return children;
};

export default ProtectedRoute;