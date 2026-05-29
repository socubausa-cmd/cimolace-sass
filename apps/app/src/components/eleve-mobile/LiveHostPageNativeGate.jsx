import React from 'react';
import { Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import LiveHostPage from '@/pages/LiveHostPage';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { isNativeRuntime } from '@/lib/nativeCapabilities';

/**
 * La **console hôte** LIRI (`/live/host/:sessionId`) n'est pas prise en charge dans l'app mobile
 * (Capacitor) : le lancement / pilotage se fait sur **web** (ordinateur). Les invités utilisent
 * `/live/:sessionId` (LiveGuestPage) dans l'app.
 */
export default function LiveHostPageNativeGate() {
  if (isNativeRuntime()) {
    return <Navigate to={`${ELEVE_MOBILE.live}?hote=web`} replace />;
  }
  return (
    <ErrorBoundary>
      <LiveHostPage />
    </ErrorBoundary>
  );
}
