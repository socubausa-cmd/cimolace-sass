import React, { Suspense } from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Monte une page ISNA Academy (student-school-life) DANS le shell chaud du portail LIRI.
 * LIRI embarque les fonctionnalités école : l'élève garde agenda/notes/cours/vie scolaire
 * sans quitter le portail. `active` = clé du rail (surlignage). Le contenu défile ;
 * l'ErrorBoundary isole une page école cassée du reste du portail.
 */
export default function LiriSchoolShell({ active, children }) {
  return (
    <LiriPortalShell active={active}>
      <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden">
        <ErrorBoundary logTag={`LIRI école:${active}`}>
          <Suspense fallback={<div style={{ padding: '48px 0', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em', color: 'rgba(245,241,233,0.5)' }}>CHARGEMENT…</div>}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </div>
    </LiriPortalShell>
  );
}
