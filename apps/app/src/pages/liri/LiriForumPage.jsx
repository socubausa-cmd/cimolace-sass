/**
 * LiriForumPage — Forum CONNECTÉ + messagerie immersive comme APP du portail LIRI
 * (`/liri/forum`).
 *
 * Réutilise `CommunicationShell` (onglets **Forum + Messagerie**, le MÊME shell immersif
 * que l'espace élève / owner / secrétariat) monté dans le chrome du portail LIRI
 * (`LiriPortalShell`, rail « Forum » actif) au lieu de l'ancien `/dashboard`.
 *
 * `forumBasePath="/liri/forum"` → les sous-pages (nouvelle question, fil de discussion)
 * restent DANS le portail (routes imbriquées ci-dessous).
 *
 * ⚠️ Imports LAZY (et non eager) : empiler CommunicationShell (→ MessagingPage) + les
 * sous-pages forum dans un SEUL chunk dense exposait un import circulaire → TDZ
 * « Cannot access 'Fe' before initialization » sur l'onglet Messagerie. Le reste de
 * l'app charge ces pages en lazy (chunks séparés) ; on fait pareil.
 */
import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import ErrorBoundary from '@/components/ErrorBoundary';

const CommunicationShell = lazy(() => import('@/components/school/CommunicationShell'));
const ForumNewQuestionPage = lazy(() => import('@/pages/school/student-school-life/ForumNewQuestionPage'));
const ForumThreadPage = lazy(() => import('@/pages/school/student-school-life/ForumThreadPage'));

const Fallback = () => (
  <div style={{ padding: 40, textAlign: 'center', color: 'rgba(245,244,238,0.5)', fontSize: 13 }}>Chargement…</div>
);

export default function LiriForumPage() {
  return (
    <LiriPortalShell active="forum">
      <div className="h-full min-h-0 overflow-auto">
        <ErrorBoundary logTag="LIRI Forum">
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route index element={<CommunicationShell forumBasePath="/liri/forum" />} />
              <Route path="new" element={<ForumNewQuestionPage />} />
              <Route path="thread/:threadId" element={<ForumThreadPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </LiriPortalShell>
  );
}
