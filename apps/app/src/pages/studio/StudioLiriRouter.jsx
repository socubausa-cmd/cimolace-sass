/**
 * StudioLiriRouter — Sous-routeur de l'écosystème LIRI unifié
 * Préfixe : /studio/liri/*
 *
 * Routes :
 *   /studio/liri              → Hub principal (5 cartes)
 *   /studio/liri/constructeurs      → Hub + assistant de choix + lien guide (catalogue incl. Agent LIRI)
 *   /studio/liri/constructeurs/guide → Guide comparatif (audit, pour qui, pros/cons)
 *   /studio/liri/formation    → Formation Builder
 *   /studio/liri/cours        → Course Builder
 *   /studio/liri/bibliotheque → Bibliothèque communautaire
 *   /studio/liri/import       → Workflow d'import
 *   /studio/liri/embedded-control → Contrôle app intégrée (LIRI_FULL_SYSTEM)
 *   /studio/liri/pedagogie-futur → Pédagogie du futur (parcours · blocs · roadmap)
 *   /studio/liri/multilang → Multilingue live + vidéo (liri_complete_multilang_system)
 *   /studio/liri/studio-image → LIRI Studio Image (canvas Konva + zone IA)
 *
 * Studios partagés (redirigent vers les routes existantes) :
 *   /studio/liri/designer     → /studio/smartboard-designer
 *   /studio/liri/live         → /studio/live
 *   /studio/liri/export       → /studio/export-center
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import StudioLiriHubPage from './StudioLiriHubPage';
import StudioLiriFormationBuilderPage from './StudioLiriFormationBuilderPage';
import StudioLiriCourseBuilderPage from './StudioLiriCourseBuilderPage';
import StudioLiriBibliothequePage from './StudioLiriBibliothequePage';
import StudioLiriImportPage from './StudioLiriImportPage';
import StudioLiriEmbeddedControlPage from './StudioLiriEmbeddedControlPage';
import StudioLiriPedagogieFuturPage from './StudioLiriPedagogieFuturPage';
import StudioLiriConstructeursHubPage from './StudioLiriConstructeursHubPage';
import StudioLiriConstructeursGuidePage from './StudioLiriConstructeursGuidePage';
import StudioLiriMultilangPage from './StudioLiriMultilangPage';
import StudioLiriStudioImagePage from './StudioLiriStudioImagePage';

export default function StudioLiriRouter() {
  return (
    <Routes>
      {/* Hub — porte d'entrée de l'écosystème */}
      <Route index element={<StudioLiriHubPage />} />

      <Route path="constructeurs/guide" element={<Navigate to="/studio/formation-llm-builder" replace />} />
      <Route path="constructeurs" element={<Navigate to="/studio/formation-llm-builder" replace />} />

      {/* Studios spécialisés */}
      <Route path="formation" element={<StudioLiriFormationBuilderPage />} />
      <Route path="cours" element={<StudioLiriCourseBuilderPage />} />
      <Route path="bibliotheque" element={<StudioLiriBibliothequePage />} />
      <Route path="import" element={<StudioLiriImportPage />} />
      <Route path="embedded-control" element={<StudioLiriEmbeddedControlPage />} />
      <Route path="pedagogie-futur" element={<StudioLiriPedagogieFuturPage />} />
      <Route path="multilang" element={<StudioLiriMultilangPage />} />
      <Route path="studio-image" element={<StudioLiriStudioImagePage />} />

      {/* Redirections vers studios existants */}
      <Route path="designer" element={<Navigate to="/studio/smartboard-designer" replace />} />
      <Route path="composite" element={<Navigate to="/studio/smartboard-designer" replace />} />
      <Route path="live" element={<Navigate to="/studio/live" replace />} />
      <Route path="export" element={<Navigate to="/studio/export-center" replace />} />
      <Route path="parametres" element={<Navigate to="/studio/liri" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/studio/liri" replace />} />
    </Routes>
  );
}
