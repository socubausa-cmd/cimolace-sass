import React from 'react';
import { Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import LiveHostPage from '@/pages/liri/LiveHostPage';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { isNativeRuntime } from '@/lib/nativeCapabilities';

/**
 * La **console hôte** LIRI (`/live/host/:sessionId`) n'est pas prise en charge dans l'app mobile
 * (Capacitor) : le lancement / pilotage se fait sur **web** (ordinateur). Les invités utilisent
 * `/live/:sessionId` (LiveGuestPage) dans l'app.
 *
 * Sur web, la console est enveloppée dans le **shell du portail LIRI** (topbar + rail + footer) :
 * l'arène live vit ainsi dans le même cadre que le reste du portail (Accueil, Lives, Brain…).
 * La host page existante est inchangée — seule sa chrome `100dvh` est forcée à remplir le `<main>`
 * du shell (voir `.lp-shell-main` dans LiriPortal.css).
 */
export default function LiveHostPageNativeGate() {
  if (isNativeRuntime()) {
    return <Navigate to={`${ELEVE_MOBILE.live}?hote=web`} replace />;
  }
  return (
    <LiriPortalShell active="lives" live rail={false}>
      <ErrorBoundary>
        <LiveHostPage />
      </ErrorBoundary>
    </LiriPortalShell>
  );
}
