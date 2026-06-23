/**
 * LiriMessagesPage — Messagerie immersive comme APP du portail LIRI (`/liri/messages`).
 *
 * `MessagingPage` en mode `embedded` monté dans le chrome chaud du portail
 * (`LiriPortalShell`, rail « Messages » actif) → fin du « double shell » : la messagerie
 * avait sa propre coque plein écran (top-bar « ✦ Messagerie » + fond froid navy) qui
 * doublonnait/jurait avec le portail. `embedded` = remplit le <main> (h-full), header
 * PLAT (pas de carte-dans-carte), fond transparent (ambiance chaude du portail).
 */
import React, { Suspense, lazy } from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import ErrorBoundary from '@/components/ErrorBoundary';

const MessagingPage = lazy(() => import('@/pages/MessagingPage'));

const Fallback = () => (
  <div style={{ padding: 40, textAlign: 'center', color: 'rgba(245,244,238,0.5)', fontSize: 13 }}>Chargement…</div>
);

export default function LiriMessagesPage() {
  return (
    <LiriPortalShell active="messages">
      <div className="h-full min-h-0">
        <ErrorBoundary logTag="LIRI Messages">
          <Suspense fallback={<Fallback />}>
            <MessagingPage embedded />
          </Suspense>
        </ErrorBoundary>
      </div>
    </LiriPortalShell>
  );
}
