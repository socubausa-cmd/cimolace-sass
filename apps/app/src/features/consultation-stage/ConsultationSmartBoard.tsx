// ─────────────────────────────────────────────────────────────────────────────
// ConsultationSmartBoard — Tableau intelligent (SmartBoard Konva) montable dans
// la SALLE DE TÉLÉCONSULTATION MEDOS.
//
// POURQUOI CE WRAPPER ?
//   Le moteur réel = `SmartBoardCompositor` (≈6000 lignes, surface de props
//   énorme : sources écran/caméra2, navigateur de scènes, sync tactique, presse-
//   papiers, pagination, NeuroInk IA…). On NE le monte PAS directement : on
//   réutilise `LiveHostSmartBoardStage`, le wrapper CANONIQUE déjà utilisé par
//   LiveHostPage, qui :
//     • initialise tout l'état interne (pages tableau, annotations, scène active,
//       caméra2, partage-écran) AVANT le rendu du compositeur ;
//     • fournit des valeurs par défaut SÛRES pour CHAQUE prop requis du
//       compositeur (displaySlides=[], sceneFlags fusionnés, onBroadcast no-op-
//       safe, viewerMode, hideEmbeddedWhiteboardToolsRail…) ;
//     • garde TOUS les effets dépendants d'une salle LiveKit derrière
//       `if (!phaseLive || !roomRef?.current) return;` → ils NO-OP proprement
//       hors live. Le tableau blanc Konva fonctionne 100 % côté client, sans
//       salle. C'est exactement ce dont la consultation a besoin.
//
// CONTRAT D'INTÉGRATION (props du wrapper) :
//   { sessionId, isHost, viewerMode?, onBroadcast? }
//     - sessionId  → réinitialise le tableau au changement de session.
//     - isHost     → praticien : navigation + dessin actifs. Patient : lecture.
//     - viewerMode → optionnel ; par défaut dérivé de `!isHost`. Si fourni, prime.
//     - onBroadcast→ optionnel ; relais des patchs SmartBoard (pages, scène…)
//                    vers le parent (qui peut les pousser sur le canal med-cockpit
//                    pour synchroniser le patient). Sûr si absent.
//
// Le compositeur Konva est lourd : on le charge en `React.lazy` pour ne pas
// alourdir le bundle de la salle quand le tableau n'est pas ouvert. Konva est
// déjà une dépendance du repo (utilisée par le compositeur).
// ─────────────────────────────────────────────────────────────────────────────
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Presentation } from 'lucide-react';
import { mergeSmartboardSceneFlags } from '@/lib/smartboardNavigatorScenes';
import { useLiveWhiteboardStore } from '@/components/liri/live-room/useLiveWhiteboardStore';
import ConsultationToolCockpit from './ConsultationToolCockpit';

// Le moteur réel est un module .jsx — import dynamique (lazy) : le wrapper reste
// léger et `LiveHostSmartBoardStage` (+ Konva) n'est tiré qu'à l'ouverture.
const LiveHostSmartBoardStage = React.lazy(
  () => import('@/components/liri/live-room/LiveHostSmartBoardStage'),
);

// Aligné sur le shell chaud LIRI (cf. ConsultationRoom / liveHostTheme) — n'est
// qu'un fallback (le SmartBoard repeint la scène en #1f1e1c + carreaux ambre).
const BG = '#1f1e1c'; // --lh-stage-bg (chaud, plus le #0b0b0c plat)
const GOLD = '#d4a36a'; // ambre LIRI (plus le gold/or banni)

// Références stables (évitent de recréer un tableau à chaque rendu → les effets
// du stage qui dépendent de `.length` restent stables).
const EMPTY_SLIDES: never[] = [];
const EMPTY_LIST: never[] = [];

/**
 * Scènes par défaut de la consultation : le tableau blanc Konva (« Crayon ») est
 * la scène utile, sans salle LiveKit. On DÉSACTIVE les scènes qui exigent un flux
 * (écran/caméra2) ou un deck importé (diapo/smartboard natif) — sinon le
 * praticien tomberait sur des scènes vides/inertes. Le parent peut élargir via
 * `sceneFlags`.
 */
const CONSULT_DEFAULT_SCENE_FLAGS = {
  smartboard: false, // SmartBoard natif (deck IA) : hors-périmètre consult
  diapo: true, // diapositives importées (PPT/PDF/images)
  screen: true, // partage d'écran
  browser: false, // navigateur embarqué : non
  embed: false,
  quiz: false,
  secure_app_share: false,
  board: true, // tableau blanc Konva (scène par défaut)
  image: true, // galerie d'images (« partager une image »)
  camera2: false,
  shop: true, // boutique / liens (« partager une boutique »)
  medos: true, // Dossier MEDOS : jumeau/roue/labs/SOAP partagés (scène du tableau, comme en Formation)
} as const;

export interface ConsultationSmartBoardProps {
  /** Session de téléconsultation — réinitialise le tableau au changement. */
  sessionId: string | null;
  /** Praticien (true) = navigation + dessin ; patient (false) = lecture seule. */
  isHost: boolean;
  /**
   * Mode lecture seule explicite (invité). Par défaut dérivé de `!isHost`.
   * Si fourni, prime sur la déduction.
   */
  viewerMode?: boolean;
  /**
   * Relais optionnel des patchs SmartBoard (pages tableau, scène active,
   * annotations…) émis par l'hôte. Le parent peut les pousser sur le canal
   * med-cockpit pour synchroniser le patient. Sûr si absent (no-op).
   */
  onBroadcast?: (payload?: Record<string, unknown>) => void;
  /**
   * Patchs SmartBoard REÇUS de l'hôte (côté patient/viewer), état accumulé
   * (merge) → ré-appliqués au stage via applyHostSmartboardBroadcast pour que le
   * patient VOIE le dessin/la scène du praticien. Sûr si absent.
   */
  incomingBroadcast?: Record<string, unknown> | null;
  /**
   * Surcharge fine des scènes disponibles (fusionnée avec les défauts
   * « tableau seul »). Laisser vide en consultation standard.
   */
  sceneFlags?: Record<string, boolean>;
  /**
   * Affiche/masque le rail d'outils intégré au canevas. Défaut = false (outils
   * VISIBLES) : en consultation, AUCUN rail externe ne fournit les outils de
   * dessin, donc on doit garder le rail embarqué pour que le praticien puisse
   * écrire. Mettre à true UNIQUEMENT si un parent affiche déjà les outils.
   */
  hideEmbeddedWhiteboardToolsRail?: boolean;
  /** Mobile spectateur : masque le navigateur de scènes vertical (dock droit). */
  hideSceneDock?: boolean;
  /** Notifie le parent quand la scène active change (ex. board → image). */
  onSceneChange?: (scene: string) => void;
  /** Produits de la boutique tenant (scène « boutique »). Fournis par l'hôte ;
   *  diffusés à l'invité via le smartboard. Vide = « Aucun produit configuré ». */
  shopProducts?: any[];
}

/**
 * Tableau intelligent (SmartBoard Konva) prêt à monter dans la salle de
 * téléconsultation. Encadré plein conteneur, fond sombre cohérent avec
 * ConsultationRoom.
 */
export default function ConsultationSmartBoard({
  sessionId,
  isHost,
  viewerMode,
  onBroadcast,
  incomingBroadcast,
  sceneFlags,
  hideEmbeddedWhiteboardToolsRail = false,
  hideSceneDock = false,
  onSceneChange,
  shopProducts = EMPTY_LIST,
}: ConsultationSmartBoardProps) {
  // Ref impératif du stage : côté patient (viewer), on lui ré-applique les patchs
  // reçus du canal via applyHostSmartboardBroadcast (cf. LiveHostSmartBoardStage).
  const stageRef = useRef<{ applyHostSmartboardBroadcast?: (p: Record<string, unknown>) => void } | null>(null);
  // Pas de salle LiveKit ici : la sync vidéo/écran passe ailleurs (LiveKit dans
  // ConsultationRoom) et le tableau Konva est purement client. `roomRef` reste
  // null → tous les effets « room » du stage no-op (cf. en-tête). `phaseLive`
  // reste false en conséquence.
  const roomRef = useRef<unknown>(null);

  // Surface du tableau = CARREAUX immersifs (fond sombre chaud + quadrillage
  // ambre), au lieu de l'aplat sombre VIDE par défaut (la demande « tableau
  // immersif avec les carreaux »). Restaurée à la sortie pour ne pas imposer ce
  // choix à une éventuelle session Formation ultérieure (même store global).
  useEffect(() => {
    const prev = useLiveWhiteboardStore.getState().boardSurface;
    useLiveWhiteboardStore.getState().setBoardSurface('carreaux');
    return () => { useLiveWhiteboardStore.getState().setBoardSurface(prev); };
  }, []);

  // viewerMode explicite > déduction depuis isHost. Le patient ne navigue/dessine
  // pas ; il suit l'état diffusé par le praticien.
  const readOnly = typeof viewerMode === 'boolean' ? viewerMode : !isHost;
  // Mode APERÇU (C) : le praticien replie le cockpit + le cadre pour voir le
  // tableau propre, comme le patient. Local (n'affecte pas le patient).
  const [preview, setPreview] = useState(false);
  // « Avancé » : révèle le grand rail d'origine (tous les outils niche + NeuroInk).
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Réserve HAUTE pour la barre d'outils en en-tête (partie B) : le tableau utile
  // côté hôte = tout SAUF cette bande haute (où vit la barre, non-dessinable).
  const TOOLBAR_RESERVED_TOP = 56;

  // Patient (viewer) : à chaque nouvel état SmartBoard reçu du canal, on le
  // rejoue dans le stage (setActiveScene/setAnnotationStrokes/… en interne).
  useEffect(() => {
    if (!readOnly || !incomingBroadcast) return;
    stageRef.current?.applyHostSmartboardBroadcast?.(incomingBroadcast);
  }, [readOnly, incomingBroadcast]);

  // Scènes : défauts « tableau seul » fusionnés avec une éventuelle surcharge,
  // puis re-normalisés par le helper officiel (mêmes clés que le wizard).
  const mergedSceneFlags = useMemo(
    () => mergeSmartboardSceneFlags({ ...CONSULT_DEFAULT_SCENE_FLAGS, ...(sceneFlags || {}) }),
    [sceneFlags],
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: BG,
      }}
    >
      <Suspense fallback={<SmartBoardLoading />}>
        <LiveHostSmartBoardStage
          ref={stageRef}
          // displaySlides DOIT être un tableau : aucune diapo en consultation.
          displaySlides={EMPTY_SLIDES}
          sceneFlags={mergedSceneFlags}
          // Aucune galerie / boutique / produit en téléconsult.
          sharedImageGallery={EMPTY_LIST}
          sharedImageLoop={false}
          shopProducts={shopProducts}
          spotlight={false}
          // Pas de partage-écran piloté ici (la vidéo vit dans ConsultationRoom).
          sharingScreen={false}
          // Pas de salle LiveKit → effets « room » du stage no-op (sûr).
          roomRef={roomRef}
          phaseLive={false}
          // Relais optionnel : sûr si absent (le stage fait `onBroadcast?.(…)`).
          onBroadcast={onBroadcast}
          liveKitScreenEpoch={0}
          camera2FluxParticipants={EMPTY_LIST}
          progressivePlayback
          pipStream={null}
          // Ouvre DIRECTEMENT sur le tableau (carreaux) — pas la diapo vide.
          initialScene="board"
          // Réinitialise tableau/annotations au changement de consultation.
          sessionId={sessionId}
          // Praticien = pilote ; patient = lecture (suit le broadcast).
          viewerMode={readOnly}
          // Outils & PiP en overlay sur le bord droit du canevas (pas de footer
          // parent à câbler ici).
          sceneDockPlacement="right"
          // Par défaut : rail outils VISIBLE (sinon le praticien n'aurait aucun
          // outil de dessin — cf. doc du prop).
          // Le grand rail d'outils est REMPLACÉ par le cockpit compact groupé
          // (ci-dessous) côté praticien → masqué par défaut ; RÉVÉLÉ quand le
          // praticien active « Avancé » (accès à TOUS les outils niche + NeuroInk).
          hideEmbeddedWhiteboardToolsRail={hideEmbeddedWhiteboardToolsRail || (!readOnly && !advancedOpen)}
          hideSceneDock={hideSceneDock}
          onSceneChange={onSceneChange}
        />
      </Suspense>
      {/* B — Cadre « zone vue par le patient » : l'aire de travail utile côté
          hôte = tout SAUF la bande basse des outils. Purement visuel (n'intercepte
          pas le dessin) ; masqué en aperçu. Le patient voit ce contenu recadré
          plein écran (auto-fit déjà en place). */}
      {!readOnly && !preview ? (
        <div
          aria-hidden
          style={{
            position: 'absolute', top: TOOLBAR_RESERVED_TOP, left: 10, right: 10,
            bottom: 10, zIndex: 12, pointerEvents: 'none',
            border: '1.5px dashed rgba(212,163,106,0.35)', borderRadius: 12,
          }}
        >
          <span style={{
            position: 'absolute', top: -9, right: 14, padding: '1px 8px', borderRadius: 999,
            background: '#1f1e1c', color: 'rgba(212,163,106,0.9)', fontSize: 9, fontWeight: 700,
            letterSpacing: 0.3, textTransform: 'uppercase',
          }}>Zone vue par le patient</span>
        </div>
      ) : null}
      {/* A + C — Cockpit d'outils groupés (praticien) : familles → rail overlay
          compact + bouton Aperçu. Remplace le grand rail surchargé. */}
      {!readOnly ? (
        <ConsultationToolCockpit
          preview={preview}
          onPreviewChange={setPreview}
          advancedOpen={advancedOpen}
          onAdvancedChange={setAdvancedOpen}
        />
      ) : null}
    </div>
  );
}

function SmartBoardLoading() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: BG,
        color: '#9ca3af',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <Presentation size={28} color={GOLD} style={{ margin: '0 auto 10px', opacity: 0.8 }} aria-hidden="true" />
        <p style={{ fontSize: 13.5, fontWeight: 600 }}>Préparation du tableau…</p>
      </div>
    </div>
  );
}
