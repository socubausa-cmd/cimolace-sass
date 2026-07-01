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
 * ⚠️ Imports EAGER (et NON lazy) : c'est le pattern PROUVÉ partout ailleurs
 * (StudentSchoolLifePage / OwnerDashboard / SecretariatDashboard montent les MÊMES
 * composants en import direct et ça marche). Le chargement LAZY de CommunicationShell
 * ici résolvait son module avec `default` undefined (cycle d'import dynamique) →
 * « Cannot read properties of undefined (reading 'default') », forum cassé. On revient
 * donc au pattern eager identique au reste de l'app.
 */
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import ErrorBoundary from '@/components/ErrorBoundary';
import CommunicationShell from '@/components/school/CommunicationShell';
import ForumNewQuestionPage from '@/pages/school/student-school-life/ForumNewQuestionPage';
import ForumThreadPage from '@/pages/school/student-school-life/ForumThreadPage';
import TopicThreadPage from '@/pages/school/student-school-life/TopicThreadPage';

export default function LiriForumPage() {
  return (
    <LiriPortalShell active="forum">
      {/* Respiration : le contenu est rentré (px) tandis que le fond immersif du forum
          (inset négatif -24px) continue de toucher le rail → immersif mais pas collé. */}
      <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden px-5 pt-3">
        <ErrorBoundary logTag="LIRI Forum">
          <Routes>
            <Route index element={<CommunicationShell forumBasePath="/liri/forum" />} />
            <Route path="new" element={<ForumNewQuestionPage />} />
            <Route path="thread/:threadId" element={<ForumThreadPage />} />
            <Route path="topic/:topicId" element={<TopicThreadPage />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </LiriPortalShell>
  );
}
