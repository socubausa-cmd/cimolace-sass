/**
 * StudioRouter — Gestion des routes /studio/*
 *
 * ── LE STUDIO VIT DANS LA COQUE DU PORTAIL ────────────────────────────────────
 * Toutes les pages du Studio sont désormais montées DANS `LiriPortalShell`
 * (`active="studio"`) : topbar, rail-moteur 92 px, sélecteur de moteur et nav basse
 * mobile suivent le créateur d'un bout à l'autre de la création.
 * POURQUOI : avant, `/studio/*` était monté nu (un simple `display:contents`) → cliquer
 * « Studio » depuis /liri faisait perdre TOUTE la navigation ; pour revenir à École ou
 * Lives il fallait repasser par /liri (ou le bouton « retour » du navigateur).
 * CHARTE : entrer dans la coque ne suffit PAS à réchauffer les pages. `.lp-shell-main`
 * déclare bien `--school-accent:#d97757` (LiriPortal.css) mais SANS `!important`, alors que
 * 17 racines de page du Studio étalent `...cssVars` (useTenantBranding) en style INLINE —
 * et la cascade se résout PAR ÉLÉMENT : la déclaration inline du descendant gagne pour tout
 * son sous-arbre. Le neutraliseur est donc posé sur CES racines, en `!important`, dans
 * studioWarm.css (bloc « NEUTRALISEUR DE MARQUE », scopé `.studio-en-coque`).
 *
 * POURQUOI LA COQUE EST POSÉE ICI (et pas dans App.jsx autour de `<StudioRouter/>`) :
 * les EXCEPTIONS se décident route par route, et App.jsx ne voit que le splat `/studio/*`.
 * Une coque posée là-haut s'appliquerait aussi aux pages qui montent DÉJÀ la leur
 * (VideoPostProductionPage) → DEUX topbars empilées. Ici, ces routes restent simplement
 * hors de la route de mise en page.
 */
import React from 'react';
import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
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

/**
 * Hauteurs « plein viewport » héritées → plein CONTENEUR.
 * Les pages du Studio ont été écrites en plein écran (`h-[100dvh]`, `min-h-screen`,
 * `h-screen` — StudioDesignerLikeShell en tête, 12 pages en héritent). Dans la coque,
 * « plein écran » ne vaut plus 100 % du viewport mais 100 % du <main> (viewport moins la
 * topbar et le pied de page) : sans ce remap, CHAQUE page traînerait un ascenseur parasite
 * de ~85 px de vide. Règle scopée à `.studio-en-coque > *` (enfant DIRECT = la racine de la
 * page) → aucun effet hors /studio, et aucune ligne à changer dans les 12 pages concernées.
 * Le jour où une page passe en `h-full`, le sélecteur cesse simplement de la matcher.
 */
const CSS_HAUTEURS_EN_COQUE = `
/* Hauteur DURE (h-screen · h-[100dvh] · h-[100vh]) : la page se fige à la taille du
   conteneur — elle gère déjà son propre défilement interne. */
.studio-en-coque > [class*="h-screen"]:not([class*="min-h-screen"]),
.studio-en-coque > [class*="h-[100dvh]"]:not([class*="min-h-[100dvh]"]),
.studio-en-coque > [class*="h-[100vh]"]:not([class*="min-h-[100vh]"]) { height: 100% !important; }
/* Hauteur MINIMALE (min-h-screen …) : on abaisse le plancher, sans jamais poser de
   plafond — une page longue continue de grandir et défile dans le conteneur. */
.studio-en-coque > [class*="min-h-screen"],
.studio-en-coque > [class*="min-h-[100dvh]"],
.studio-en-coque > [class*="min-h-[100vh]"] { min-height: 100% !important; }
`;

/**
 * CoqueStudio — route de MISE EN PAGE (layout route, sans `path`) : pose la coque du
 * portail autour de toutes les routes enfants, qui s'affichent dans l'`<Outlet/>`.
 * Le <main> de la coque est `overflow-hidden` (LiriPortalShell) : le défilement appartient
 * au contenu → on le fournit UNE fois ici, au lieu de l'exiger de chaque page du Studio.
 *
 * `hideDesktopRail` — POURQUOI (même raison que LiriEcolePage) : le rail-moteur 92 px du
 * portail n'aurait ici QU'UN SEUL bouton, « Studio » (liriRail.tsx : le moteur `studio`
 * n'a qu'un item, `/studio/liri`), et ce bouton est TOUJOURS l'actif puisqu'on est déjà
 * dedans → 92 px de largeur pour zéro navigation possible. Or presque toutes les pages du
 * Studio portent DÉJÀ leur propre rail vertical (StudioDesignerLikeShell : 52 px, 11 outils ;
 * StudioEntryPage : ProSideRail, 7 catégories) : sur un portable 13" cela faisait ~144 px
 * mangés par deux navigations empilées, dont une inerte. Ce qui compte reste : le SÉLECTEUR
 * DE MOTEUR en topbar (École / Lives / mbolo…) et la nav basse mobile, tous deux conservés.
 */
function CoqueStudio() {
  return (
    <LiriPortalShell active="studio" hideDesktopRail>
      <div className="studio-en-coque h-full overflow-y-auto">
        {/* <style> = display:none → ne compte pas comme contenu, ne décale rien. */}
        <style>{CSS_HAUTEURS_EN_COQUE}</style>
        <Outlet />
      </div>
    </LiriPortalShell>
  );
}

export default function StudioRouter() {
  return (
    // .studio-warm-scope (+ display:contents) → remap froid→chaud de TOUT /studio/* (studioWarm.css),
    // y compris les routes PLEIN ÉCRAN ci-dessous qui, elles, ne passent pas par la coque
    // (le <main> de LiriPortalShell porte déjà `studio-warm-scope` de son côté).
    <div className="studio-warm-scope contents">
    <Routes>
      {/* ══ PLEIN ÉCRAN — HORS COQUE ═══════════════════════════════════════════
          1. live-arena = LA DIFFUSION (arène live / téléconsultation). Cadre immersif
             total : ni topbar ni rail. NB : App.jsx déclare `/studio/live-arena/:sessionId`
             AVANT `/studio/*` et React Router classe une route statique+dynamique au-dessus
             d'un splat → c'est celle-là qui gagne. La route ci-dessous n'est qu'un filet.
          2. post-production = VideoPostProductionPage monte DÉJÀ `LiriPortalShell active="studio"`
             elle-même (l. 1576 et 2865). L'envelopper une 2e fois = DEUX topbars, DEUX rails.
             Maillon critique du pipeline vidéo → on ne le touche pas. */}
      <Route path="live-arena/:sessionId" element={<LiveHostPage />} />
      <Route path="live-arena-obs/:sessionId" element={<LiveArenaObsToHostRedirect />} />
      <Route path="post-production/:contentId" element={<VideoPostProductionPage />} />
      {/* Fallback hors coque : pure redirection, inutile de monter la coque pour rien. */}
      <Route path="*" element={<Navigate to="/studio" replace />} />

      {/* ══ DANS LA COQUE DU PORTAIL ═══════════════════════════════════════════ */}
      <Route element={<CoqueStudio />}>
        <Route index element={<StudioEntryPage />} />
        <Route path="ad-creator" element={<StudioAdCreatorPage />} />
        <Route path="course-lab" element={<StudioCourseLabPage />} />
        <Route path="live-lab" element={<StudioLiveLabPage />} />
        {/* `live` = le WIZARD de préparation du direct (LiveStudioPage), PAS le direct :
            le direct, c'est live-arena. Il reste donc dans la coque — d'ailleurs
            LiriPortal.css re-thème déjà `.lp-shell-main .live-studio-pane-*` (l. 108+),
            preuve que cette console a été pensée pour vivre dans le portail. */}
        <Route path="live" element={<LiveStudioPage />} />
        {/* `live-immersive` = ÉDITEUR de scènes immersives (slides, ambiances sonores) :
            un outil de création, pas une diffusion → dans la coque comme les autres
            constructeurs. Rien n'y est joué en direct. */}
        <Route path="live-immersive" element={<StudioLiveImmersivePage />} />
        <Route path="live-preparation" element={<LivePreparationStudioPage />} />
        <Route path="live-preparation/:sessionId" element={<LivePreparationStudioPage />} />
        <Route path="debate-builder" element={<StudioDebateBuilderPage />} />
        <Route path="debate-builder/:debateId" element={<StudioDebateDetailPage />} />
        <Route path="debate-invite" element={<StudioDebateInvitePage />} />
        <Route path="debate-prep/:debateId" element={<StudioDebatePrepPage />} />
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
        <Route path="formation" element={<StudioFormationPage />} />
        <Route path="appointment" element={<StudioAppointmentPage />} />
        <Route path="event" element={<StudioEventPage />} />
        <Route path="coaching" element={<StudioCoachingPage />} />
      </Route>
    </Routes>
    </div>
  );
}
