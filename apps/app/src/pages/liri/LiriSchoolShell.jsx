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
      {/* Gouttière horizontale : les pages student-school-life sont conçues pour la coque
          standalone qui les pade (≈28px 24px) ; l'embed LIRI doit fournir la même respiration
          (sinon le contenu est collé au rail). Centré + max-width sur très grand écran. */}
      <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden px-5 py-6 md:px-8">
        <div className="mx-auto w-full max-w-[1180px]">
        <ErrorBoundary logTag={`LIRI école:${active}`}>
          <Suspense fallback={<div style={{ padding: '48px 0', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em', color: 'rgba(245,241,233,0.5)' }}>CHARGEMENT…</div>}>
            {children}
          </Suspense>
        </ErrorBoundary>
        </div>
      </div>
    </LiriPortalShell>
  );
}
