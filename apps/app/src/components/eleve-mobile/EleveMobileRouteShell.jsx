import { Navigate, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

function isPublicEleveMobilePath(pathname) {
  return (
    pathname === ELEVE_MOBILE.connexion ||
    pathname.startsWith(`${ELEVE_MOBILE.connexion}/`) ||
    pathname === ELEVE_MOBILE.login ||
    pathname === ELEVE_MOBILE.signup ||
    pathname.startsWith(`${ELEVE_MOBILE.liveRoomMaquette}`)
  );
}

function EleveAuthGate() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const publicPath = isPublicEleveMobilePath(location.pathname);

  if (publicPath) return <Outlet />;

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0F1419]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    const fullPath = `${location.pathname}${location.search || ''}${location.hash || ''}`.trim() || ELEVE_MOBILE.home;
    return (
      <Navigate
        to={`${ELEVE_MOBILE.login}?${new URLSearchParams({ redirect: fullPath }).toString()}`}
        replace
      />
    );
  }

  return <Outlet />;
}

/**
 * Enveloppe toutes les routes `/m/eleve/*` : erreurs React = écran de repli
 * (au lieu d'un arbre blanc) + log console préfixé « LIRI élève ».
 * Sert aussi de verrou global : hors écrans de connexion / maquettes publiques,
 * aucune route LIRI mobile ne s'affiche sans session authentifiée.
 */
export default function EleveMobileRouteShell() {
  return (
    <ErrorBoundary logTag="LIRI élève" showDetailsInDev>
      <EleveAuthGate />
    </ErrorBoundary>
  );
}
