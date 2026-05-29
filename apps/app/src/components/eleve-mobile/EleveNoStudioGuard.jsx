import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ELEVE_MOBILE, isStudioRoute } from '@/lib/eleveMobileRoutes';

/**
 * Garde global rendu en haut de l'arbre `<App />` :
 *   - sur Capacitor natif (Android/iOS) avec build `VITE_APP_VARIANT=eleve`,
 *     toute tentative d'accès à une route Studio/Hôte/Admin est redirigée
 *     vers l'accueil élève.
 *   - en web standard, ne fait rien (compatibilité).
 *
 * Cela permet de générer un APK/IPA strictement « élève » même si la
 * codebase contient encore les pages Studio (réutilisées par le web).
 */
export default function EleveNoStudioGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isEleveBuild =
    typeof import.meta !== 'undefined' &&
    import.meta?.env?.VITE_APP_VARIANT === 'eleve';
  const isNative =
    typeof Capacitor !== 'undefined' && Capacitor?.isNativePlatform?.();

  useEffect(() => {
    if (!isEleveBuild && !isNative) return;
    if (!isEleveBuild) return; // sur web on respecte les routes
    if (isStudioRoute(location.pathname)) {
      navigate(ELEVE_MOBILE.home, { replace: true });
    }
  }, [isEleveBuild, isNative, location.pathname, navigate]);

  // Redirection initiale du natif vers l'app élève (1ère ouverture)
  useEffect(() => {
    if (!isEleveBuild && !isNative) return;
    if (!isEleveBuild) return;
    const onLaunch = location.pathname === '/' || location.pathname === '';
    if (onLaunch) {
      navigate(ELEVE_MOBILE.home, { replace: true });
    }
    // Ne s'exécute qu'au montage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return children;
}
