import { Navigate, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { isCapacitorNative } from '@/lib/studentWebPlatform';

// La coque LIRI /m/eleve est l'UI de l'app NATIVE Capacitor. Dans un navigateur
// (prod), on ne l'affiche JAMAIS → on renvoie vers l'équivalent web responsive.
function webEquivalentForCoque(pathname, search) {
  const q = search || '';
  if (
    pathname === ELEVE_MOBILE.login ||
    pathname === ELEVE_MOBILE.signup ||
    pathname === ELEVE_MOBILE.connexion ||
    pathname.startsWith(`${ELEVE_MOBILE.connexion}/`)
  ) {
    return `/login${q}`;
  }
  const cours = pathname.match(/^\/m\/eleve\/cours\/([^/?#]+)/);
  if (cours) return `/student-school-life/cours/${cours[1]}`;
  if (pathname.startsWith('/m/eleve/agenda')) return '/student-school-life/agenda';
  if (pathname.startsWith('/m/eleve/profil')) return '/student-school-life/profile';
  return '/student-school-life/dashboard';
}

function isPublicEleveMobilePath(pathname) {
  return (
    pathname === ELEVE_MOBILE.connexion ||
    pathname.startsWith(`${ELEVE_MOBILE.connexion}/`) ||
    pathname === ELEVE_MOBILE.login ||
    pathname === ELEVE_MOBILE.signup ||
    // Maquettes live publiques = DEV uniquement. En prod, ces routes ne sont pas montées
    // (App.jsx <Route path="live/maquette"> gardé par import.meta.env.DEV) et ne doivent
    // jamais bénéficier d'un bypass d'auth (sinon vue hôte LIRI exposée sans session).
    (import.meta.env.DEV && pathname.startsWith(`${ELEVE_MOBILE.liveRoomMaquette}`))
  );
}

function EleveAuthGate() {
  const location = useLocation();
  const { user, loading } = useAuth();

  // Verrou « coque = app native Capacitor uniquement » : en PROD, hors WebView
  // native, AUCUNE route /m/eleve ne s'affiche dans un navigateur (= plus jamais
  // le « menu capacitore »). On redirige vers le web responsive. (En dev, la coque
  // reste accessible pour le preview.)
  if (import.meta.env.PROD && !isCapacitorNative()) {
    return <Navigate to={webEquivalentForCoque(location.pathname, location.search)} replace />;
  }

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
