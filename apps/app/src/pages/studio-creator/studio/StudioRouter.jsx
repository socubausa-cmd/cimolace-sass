/**
 * StudioRouter — Gestion des routes /studio/*
 */
import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import StudioEntryPage from './StudioEntryPage';
import LiveStudioPage from '@/pages/studio-creator/LiveStudioPage';
import StudioFormationPage from './StudioFormationPage';
import StudioAppointmentPage from './StudioAppointmentPage';
import StudioEventPage from './StudioEventPage';
import StudioCoachingPage from './StudioCoachingPage';
import StudioLiveImmersivePage from './StudioLiveImmersivePage';
import LivePreparationStudioPage from './LivePreparationStudioPage';
import LiveHostPage from '@/pages/liri/LiveHostPage';

/** Rétro-compat : ancienne URL shell OBS → même moteur que `/studio/live-arena/:sessionId` (LiveHostPage). */
function LiveArenaObsToHostRedirect() {
  const { sessionId } = useParams();
  return <Navigate to={`/studio/live-arena/${sessionId}`} replace />;
}
import LivePostIntelligencePage from './LivePostIntelligencePage';
import StudioCourseBuilderPage from './StudioCourseBuilderPage';
import StudioCourseLabPage from './StudioCourseLabPage';
import StudioLiveLabPage from './StudioLiveLabPage';
import VideoPostProductionPage from '@/pages/VideoPostProductionPage';
import StudioAdCreatorPage from './StudioAdCreatorPage';
import StudioDebateBuilderPage from './StudioDebateBuilderPage';
import StudioDebateDetailPage from './StudioDebateDetailPage';
import StudioDebateInvitePage from './StudioDebateInvitePage';
import StudioDebatePrepPage from './StudioDebatePrepPage';
import StudioLiriAgentPage from './StudioLiriAgentPage';
import StudioLiriRouter from './StudioLiriRouter';
import StudioSmartboardKonvaPage from './StudioSmartboardKonvaPage';
import StudioSmartboardHelpPage from './StudioSmartboardHelpPage';
import StudioCourseBuilderProPage from './StudioCourseBuilderProPage';
import StudioLivePreviewPage from './StudioLivePreviewPage';
import StudioExportCenterPage from './StudioExportCenterPage';
import StudioFormationLlmBuilderPage from './StudioFormationLlmBuilderPage';
import './studioWarm.css';

export default function StudioRouter() {
  return (
    // .studio-warm-scope (+ display:contents) → remap froid→chaud de TOUT /studio/* (studioWarm.css)
    <div className="studio-warm-scope contents">
    <Routes>
      <Route index element={<StudioEntryPage />} />
      <Route path="ad-creator" element={<StudioAdCreatorPage />} />
      <Route path="course-lab" element={<StudioCourseLabPage />} />
      <Route path="live-lab" element={<StudioLiveLabPage />} />
      <Route path="live" element={<LiveStudioPage />} />
      <Route path="live-immersive" element={<StudioLiveImmersivePage />} />
      <Route path="live-preparation" element={<LivePreparationStudioPage />} />
      <Route path="live-preparation/:sessionId" element={<LivePreparationStudioPage />} />
      <Route path="debate-builder" element={<StudioDebateBuilderPage />} />
      <Route path="debate-builder/:debateId" element={<StudioDebateDetailPage />} />
      <Route path="debate-invite" element={<StudioDebateInvitePage />} />
      <Route path="debate-prep/:debateId" element={<StudioDebatePrepPage />} />
      <Route path="live-arena/:sessionId" element={<LiveHostPage />} />
      <Route path="live-arena-obs/:sessionId" element={<LiveArenaObsToHostRedirect />} />
      <Route path="live-post/:sessionId" element={<LivePostIntelligencePage />} />
      {/* ── Écosystème LIRI unifié ─────────────────────────────────── */}
      <Route path="liri/*" element={<StudioLiriRouter />} />
      {/* Agent LIRI standalone (rétro-compat) */}
      <Route path="liri-agent" element={<StudioLiriAgentPage />} />
      <Route path="smartboard-konva" element={<StudioSmartboardKonvaPage />} />
      <Route path="smartboard-designer" element={<StudioSmartboardKonvaPage />} />
      <Route path="smartboard-cinema" element={<StudioSmartboardKonvaPage />} />
      <Route path="smartboard-konva-parite" element={<Navigate to="/studio/smartboard-designer" replace />} />
      <Route path="smartboard-aide" element={<StudioSmartboardHelpPage />} />
      <Route path="course-builder" element={<Navigate to="/studio/formation-llm-builder" replace />} />
      <Route path="course-builder-pro" element={<Navigate to="/studio/formation-llm-builder" replace />} />
      <Route path="formation-llm-builder" element={<StudioFormationLlmBuilderPage />} />
      {/* Point d'entrée métier unifié pour le pipeline ISNA */}
      <Route path="constructeur-isna" element={<Navigate to="/studio/formation-llm-builder" replace />} />
      <Route path="isna-course-constructor" element={<Navigate to="/studio/constructeur-isna" replace />} />
      <Route path="live-preview" element={<StudioLivePreviewPage />} />
      <Route path="export-center" element={<StudioExportCenterPage />} />
      <Route path="post-production/:contentId" element={<VideoPostProductionPage />} />
      <Route path="formation" element={<StudioFormationPage />} />
      <Route path="appointment" element={<StudioAppointmentPage />} />
      <Route path="event" element={<StudioEventPage />} />
      <Route path="coaching" element={<StudioCoachingPage />} />
      <Route path="*" element={<Navigate to="/studio" replace />} />
    </Routes>
    </div>
  );
}
