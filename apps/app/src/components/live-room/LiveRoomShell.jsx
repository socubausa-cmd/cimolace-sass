import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus, X, Search, PanelRight,
  Bell, GripVertical, BookOpen, Maximize2, Users, Trash2,
} from 'lucide-react';
import { NeuronQButton, NeuronQStudentModal, QAModeOverlay } from './NeuronQPanel';
import ImmersiveLiveStageBackdrop from './ImmersiveLiveStageBackdrop';
import SmartBoardCompositor from './SmartBoardCompositor';
import { LiveWhiteboardGuestPageIndicator } from './LiveWhiteboardToolsSidebar';
import LiveMessageDrawer from './LiveMessageDrawer';
import SpotlightLayer from './SpotlightLayer';
import ParticipantFluxCard from './ParticipantFluxCard';
import AmbientAudioLayer from './AmbientAudioLayer';
import { AudioScenePanel, LiriAudioMicDuckBridge, LiriAudioSceneOverlay } from '@/lib/liriAudioScene';
import Zone3Panel from './Zone3Panel';
import ParticipantStripChip from './ParticipantStripChip';
import { ArenaStripEmptySlot, ArenaStripOverflowTile } from './ArenaStripShellTiles';
import LivePrimaryVideoStage from './LivePrimaryVideoStage';
import HostMiniPreview from './HostMiniPreview';
import LiriMobileMaquetteLayout from './LiriMobileMaquetteLayout';
import { MemberVideoModal } from './MemberVideoModal';
import { useLiveSessionWhispers } from '@/hooks/useLiveSessionWhispers';
import { usePreferNarrowLiveViewport } from '@/hooks/usePreferNarrowLiveViewport';
import { MembersOverviewPanel } from './MembersOverviewPanel';
import { LiveEventsSidebar } from './liri-host/LiveEventsSidebar';
import { LiriHostGuidanceColumn } from './liri-host/LiriHostGuidanceColumn';
import { LiriHostMembersColumn } from './liri-host/LiriHostMembersColumn';
import { LiriHostCenterSeatStrip } from './liri-host/LiriHostCenterSeatStrip';
import {
  LIRI_HOST_MEMBERS_DOCK,
  LIRI_HOST_SHELL_PAD,
  LIRI_HOST_STAGE_CANVAS_GRADIENT,
  LIRI_HOST_STAGE_FRAME,
} from './liri-host/liriHostUiTheme';
import { IMMERSIVE_STAGE } from './layout/immersiveStageLayout';
import { cn } from '@/lib/utils';
import { LIRI_PANEL_ACTIF, LIRI_PANEL_PASSIF } from '@/lib/liriPanelLayout';
import { LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT } from '@/lib/longiaLiveCopilot';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  LIVE_DRAWER_BACKDROP_TRANSITION,
  liveDrawerFloatPanel,
  liveDrawerSheetBottom,
} from '@/lib/liveDrawerMotion';

/** Filtres du journal Notifications (Arena hôte) — alignés sur `item.kind` côté parent */
const ARENA_NOTIF_FILTER_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'longia_content', label: 'Contenu' },
  { id: 'longia_pedagogy', label: 'Pédagogie' },
  { id: 'longia_audience', label: 'Audience' },
  { id: 'longia_chat', label: 'Chat' },
  { id: 'longia_production', label: 'Production' },
  { id: 'hand', label: 'Mains' },
  { id: 'waiting', label: 'Attente' },
  { id: 'join', label: 'Entrées' },
  { id: 'leave', label: 'Sorties' },
  { id: 'promote', label: 'Antenne' },
  { id: 'default', label: 'Q&R' },
];

/** Initiales pour avatar type maquette studio immersif */
function immersiveInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0][0] || ''}${p[p.length - 1][0] || ''}`.toUpperCase() || '?';
  return name.slice(0, 2).toUpperCase();
}

/** Panneau « arène » bordure or / halo (mockup premium) */
const immersiveArenaPanelClass =
  'rounded-2xl border border-[#D4AF37]/40 bg-[#070a10]/92 shadow-[0_0_42px_-14px_rgba(212,175,55,0.28),inset_0_1px_0_0_rgba(212,175,55,0.12)] backdrop-blur-md';

// ─── Inline member panel (top-right) ou feuille basse (mobile étroit) ─────────
function MembersPanel({ open, participants, activeId, onPromote, onClose, readOnly, sheetLayout = false }) {
  const [query, setQuery] = useState('');
  const filtered = query
    ? participants.filter((p) => (p?.name || '').toLowerCase().includes(query.toLowerCase()))
    : participants;

  const inner = (
    <>
      <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
        <p className="text-xs font-semibold text-white/90">Membres live</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le panneau membres"
          className="h-9 w-9 sm:h-7 sm:w-7 rounded-full hover:bg-white/10 text-gray-300 flex items-center justify-center"
        >
          <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>
      <div className="h-9 sm:h-8 rounded-xl border border-white/10 bg-black/20 px-2.5 flex items-center gap-2 mb-2.5 flex-shrink-0">
        <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className="bg-transparent text-xs text-white w-full outline-none placeholder:text-gray-500"
        />
      </div>
      <div
        className={cn(
          'grid gap-2 overflow-y-auto min-h-0 flex-1',
          sheetLayout ? 'grid-cols-3 max-h-none' : 'grid-cols-3 max-h-[36vh]',
        )}
      >
        {filtered.map((p) => (
          <div key={p.id} className="space-y-1">
            <ParticipantFluxCard
              participant={p}
              active={p.id === activeId}
              depth={0.9}
              onClick={readOnly ? undefined : () => { onPromote?.(p.id); onClose?.(); }}
            />
            {!readOnly && (
              <button
                type="button"
                onClick={() => { onPromote?.(p.id); onClose?.(); }}
                className="min-h-8 sm:h-5 w-full rounded-lg bg-white/[0.04] border border-white/10 hover:border-[#D4AF37]/35 hover:text-[#D4AF37] text-[9px] text-gray-300"
              >
                Monter
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <AnimatePresence>
      {open && (
        sheetLayout ? (
          <>
            <motion.button
              type="button"
              aria-label="Fermer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={LIVE_DRAWER_BACKDROP_TRANSITION}
              className="fixed inset-0 z-[44] bg-black/55 backdrop-blur-[2px] border-0 p-0 cursor-default"
              onClick={onClose}
            />
            <motion.div
              {...liveDrawerSheetBottom}
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-x-0 bottom-0 top-[14vh] z-[45] flex flex-col rounded-t-[22px] border border-white/[0.12] bg-[#0c1425]/96 backdrop-blur-xl p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-24px_60px_-20px_rgba(0,0,0,0.85)]"
            >
              <div className="flex-shrink-0 flex justify-center pb-2" aria-hidden>
                <div className="h-1 w-9 rounded-full bg-white/20" />
              </div>
              {inner}
            </motion.div>
          </>
        ) : (
          <motion.div
            {...liveDrawerFloatPanel}
            style={{ ...liveDrawerFloatPanel.style, transformOrigin: '100% 0%' }}
            className="absolute top-[132px] right-4 z-40 w-[min(92vw,320px)] rounded-[22px] border border-white/[0.07] bg-[#0c1425]/88 p-3 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.75)]"
          >
            {inner}
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
}

// ActionsMenu is now rendered externally in MessagingPage's bottom bar

/** Sous-liste du plan cours : SmartBoard IA vs diapo importé (zone 3). */
function CoursePlanRailBlock({
  title,
  subtitle,
  slides,
  activeScene,
  highlightScene,
  activeIndex,
  isHost,
  onPick,
  pickKind,
  railTitleClass,
}) {
  const listClass =
    'space-y-1 max-h-[14vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-0.5';
  return (
    <div className="space-y-1.5">
      <div>
        <p className={cn(railTitleClass, 'uppercase tracking-wide text-white/70 text-[11px]')}>{title}</p>
        {subtitle ? <p className="text-[10px] text-white/40 mt-0.5 leading-snug">{subtitle}</p> : null}
      </div>
      <div className={listClass}>
        {slides.length === 0 ? (
          <p className="font-serif text-xs text-white/45">—</p>
        ) : (
          slides.map((s, idx) => {
            const active = activeScene === highlightScene && idx === activeIndex;
            const row = (
              <>
                <div className="text-[10px] font-medium text-white/50">
                  {highlightScene === 'smartboard' ? 'Slide IA' : 'Diapo'} {idx + 1}
                </div>
                <div className="font-serif text-sm text-white/92 truncate leading-snug">
                  {s?.title || s?.label || s?.name || `Point ${idx + 1}`}
                </div>
              </>
            );
            const boxClass = cn(
              'w-full rounded-lg border px-2 py-1.5 text-left transition-colors',
              active ? 'border-[#D4AF37]/45 bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.03]',
              isHost && 'hover:bg-white/[0.05]',
            );
            if (!isHost) {
              return (
                <div key={`${pickKind}-${idx}-${s?.id || 's'}`} className={cn(boxClass, 'opacity-95')}>
                  {row}
                </div>
              );
            }
            return (
              <button
                key={`${pickKind}-${idx}-${s?.id || 's'}`}
                type="button"
                onClick={() => onPick?.(pickKind, idx)}
                className={boxClass}
              >
                {row}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Slide affichée sur la scène SmartBoard natif ou diapo importé quand le plan est scindé (évite tout mélange). */
function pickSlideFromCoursePlanSplit(activeScene, split) {
  if (!split?.native || !split?.import) return null;
  if (activeScene === 'smartboard') {
    const arr = Array.isArray(split.native.slides) ? split.native.slides : [];
    if (arr.length === 0) return null;
    const i = Math.min(Math.max(0, Number(split.native.index) || 0), arr.length - 1);
    return arr[i] ?? null;
  }
  if (activeScene === 'diapo') {
    const arr = Array.isArray(split.import.slides) ? split.import.slides : [];
    if (arr.length === 0) return null;
    const i = Math.min(Math.max(0, Number(split.import.index) || 0), arr.length - 1);
    return arr[i] ?? null;
  }
  return null;
}

// ─── Main shell ───────────────────────────────────────────────────────────────
export default function LiveRoomShell({
  active,
  mainVideoRef,
  miniVideoRef,
  mainDisplayParticipant,
  miniDisplayParticipant,
  participants = [],
  hostParticipant,
  promotedParticipantId,
  onPromoteParticipant,
  onSwapVideoLayout,
  slides = [],
  slideIndex = 0,
  /** Si défini, borne la navigation diapo (SmartBoard natif vs import) */
  slideRailCount = null,
  /**
   * Plan zone 3 en deux sections : { native: { slides, index }, import: { slides, index } }.
   * Si absent, une seule liste `slides` (rétrocompat).
   */
  coursePlanSplit = null,
  /** (kind: 'native' | 'import', index: number) — choix depuis le plan (hôte) */
  onPickCoursePlanSlide = null,
  onPrevSlide,
  onNextSlide,
  onSetSlideIndex,
  spotlight = false,
  onToggleSpotlight,
  /** Lecture progressive SmartBoard (révélation pas à pas) — synchronisé côté Arena */
  progressivePlayback = true,
  /** Live Arena : sync mode tactique SmartBoard (host / viewer) */
  tacticalSyncRole = undefined,
  remoteTacticalSync = null,
  onTacticalSyncChange = null,
  /** Hôte : image SmartBoard agrandie pour toute la salle (broadcast parent) */
  onSmartboardImageExpand,
  /** Hôte : cliquer une section du script → aller à la slide SmartBoard native correspondante */
  onMasterScriptNavigateToSlide,
  drawerOpen = false,
  unreadCount = 0,
  onToggleDrawer,
  drawerMessages = [],
  /** Forum public : envoi (optionnel si lecture seule) */
  onSendForumMessage = null,
  forumSending = false,
  currentUserId,
  muted,
  cameraOff,
  sharingScreen,
  screenShareVideoRef,
  camera2VideoRef,
  camera2Active = false,
  onStartCamera2,
  camera2FluxParticipants = [],
  camera2Placeholder = null,
  camera2WaitingRemote = false,
  activeScene = 'diapo',
  onChangeScene,
  sharedImageSrc = '',
  sharedGalleryLength = 0,
  sharedImageIndex = 0,
  onSharedImagePrev,
  onSharedImageNext,
  sharedImageLoop = false,
  onToggleSharedImageLoop,
  /** Clé d'animation quand SmartBoard natif / diaporama importé ont des indices distincts */
  slideParallaxKey,
  /** Objet slide pour SlideParallaxStage (SmartBoard natif ou import selon la scène) */
  parallaxSlide = null,
  sceneFlags = null,
  uxState = 'focus-video',
  onToggleMuted,
  onToggleCamera,
  onToggleShare,
  onStopLive,
  /** Arena hôte : ouvrir le panneau réglages studio (cam / micro / effets) */
  onOpenLiveSettings,
  actionsOpen = false,
  onToggleActions,
  // Video effects
  videoBlur = false,
  videoBeauty = false,
  videoVbg = 'none',
  /** CSS filter string complet (brightness/contrast/saturation/hue) */
  videoFilterCSS = '',
  /** Chroma key activé (fond vert supprimé côté canvas) */
  videoChromaKey = false,
  videoChromaColor = '#00B140',
  videoChromaSens = 80,
  /** [{ url, label?, volume? }] — MP3 ambiance salle (studio préparatoire) */
  ambientTracks = [],
  /** false = couper la lecture ambiance (réglage mobile LIRI Arena). */
  ambientAudioEnabled = true,
  /** false = désactiver les bips de transition slide / scène. */
  sceneTransitionSoundEnabled = true,
  /** MediaStream du participant local (canvas sans fond ou flux brut) pour PiP SmartBoard */
  pipStream = null,
  /** Callback appelé quand le canvas segmenté monte/démonte — pour captureStream() */
  onPipCanvasRef,
  /**
   * Messagerie 1:1 : la caméra locale est en miniature — ne pas laisser le grand panneau (interlocuteur)
   * appeler onPipCanvasRef(null), ce qui cassait le canvas segmenté local + SmartBoard PiP.
   * Arena / hôte en grand : laisser false (enregistrement PiP sur le panneau principal).
   */
  pipRegisterOnMiniPreview = false,
  /** true = tentative de reconnexion LiveKit en cours */
  isReconnecting = false,
  /** 'excellent'|'good'|'poor'|'lost'|null — qualité de connexion locale */
  connectionQuality = null,
  /** true = interlocuteur pas encore connecté (pas de flux distant) */
  remoteWaiting = false,
  // ─── Zone 3 — présence + salle privilégiée ────────────────────────────────
  /** Membres connectés (Supabase Presence) */
  zone3Members = [],
  /** Mains levées [{userId, name, at}] */
  zone3RaisedHands = [],
  /** Sièges privilégiés [{position, userId, name, …}] */
  zone3PrivilegedSeats = [],
  /** true si la main du currentUser est levée */
  zone3MyHandRaised = false,
  /** Callbacks Zone 3 */
  onZone3RaiseHand,
  onZone3LowerHand,
  onZone3GrantSeat,
  onZone3RevokeSeat,
  /** true = currentUser est l'hôte (peut attribuer des sièges) */
  isHost = false,
  // ─── NEURON-Q ─────────────────────────────────────────────────────────────
  /** false = masque file Q&R (ex. débat avec neuronq_enabled désactivé côté config) */
  neuronqFeatureEnabled = true,
  neuronqQuestions = [],
  neuronqPendingCount = 0,
  neuronqQaMode = false,
  onNeuronqToggleQa,
  onNeuronqMarkAnswered,
  onNeuronqMarkSkipped,
  onNeuronqReformulate,
  onNeuronqSubmit,
  neuronqReformulating = false,
  neuronqSubmitting = false,
  /**
   * Messagerie desktop : le parent affiche le déclencheur dans le dock (LiveActionDock).
   * Passer `neuronqStudentModalOpen` + `onNeuronqStudentModalOpenChange` pour piloter l'ouverture ;
   * le bouton flottant centré est alors masqué.
   */
  neuronqStudentModalOpen,
  onNeuronqStudentModalOpenChange,
  // ─── Master Script ────────────────────────────────────────────────────────
  scriptSections = [],
  scriptCurrentSection = null,
  scriptLoading = false,
  scriptImproving = null,
  onScriptAdd,
  onScriptUpdate,
  onScriptDelete,
  onScriptMove,
  onScriptImprove,
  // ─── Shop / Boutique ─────────────────────────────────────────────────────
  shopProducts = [],
  onShopProductClick,
  // ─── Mode Cinéma ─────────────────────────────────────────────────────────
  cinemaMode = false,
  onToggleCinema,
  /** Référence Room LiveKit — active les vignettes caméra dans le bandeau au-dessus du SmartBoard */
  liveKitRoomRef = null,
  /**
   * Clé session pour messages privés temps réel (Arena: id live_sessions, messagerie: id immersive_live_sessions).
   * Si absent, le modal membre n'affiche pas le fil privé.
   */
  liveWhisperSessionKey = null,
  /**
   * Si défini, remplace le hook interne `useLiveSessionWhispers` (ex. mobile LIRI : un seul canal côté page).
   * @type {{ threads: Record<string, Array>, sendWhisper: (toId: string, text: string) => void } | null}
   */
  liveSessionWhisperBridge = null,
  /** true = vignettes bandeau → modal uniquement (pas de promote direct sur le panneau actif). */
  stripOpensMemberPreview = true,
  /** Traits d'annotation SmartBoard/diapo (synchro broadcast côté parent). */
  annotationStrokes = [],
  /** (updater) => void — hôte uniquement */
  onAnnotationStrokesChange = undefined,
  /** Traits scène « tableau blanc » — séparés des annotations slide. */
  whiteboardStrokes = [],
  onWhiteboardStrokesChange = undefined,
  whiteboardPageIndex = 0,
  whiteboardPageCount = 1,
  onWhiteboardPrevPage = undefined,
  onWhiteboardNextPage = undefined,
  onWhiteboardAddPage = undefined,
  onWhiteboardRemovePage = undefined,
  /** Scène app secure : état iframe synchronisable depuis la page hôte. */
  secureAppShareState = null,
  onSecureAppShareStateChange = undefined,
  /**
   * Messagerie 1:1 immersive : colonnes vidéo symétriques + centre = écran intelligent (SmartBoard)
   * + messagerie forum en bandeau sous le SmartBoard.
   */
  messagingImmersiveFaceToFace = false,
  /**
   * Messagerie live sur mobile : disposition verticale type maquette premium (parchemin, cours, scènes, SmartBoard).
   * Remplace la grille 3 colonnes web dès que le parent l'active (breakpoint mobile + live).
   */
  liriMobileMaquette = false,
  /**
   * Messagerie mobile maquette : geste « plein écran » — ne garde que l'écran intelligent (SmartBoard).
   * N'a d'effet qu'avec `liriMobileMaquette`.
   */
  liriMobileSmartboardFull = false,
  /**
   * Live Arena (desktop) : la colonne centrale est une carte « écran intelligent » (bordure or / halo)
   * avec en-tête Martoaberd autour du SmartBoard.
   */
  liveArenaMotherboardFrame = false,
  /** Variante décor `ImmersiveLiveStageBackdrop` (`arena` = fond #0a0908 type maquette LIRI). */
  immersiveBackdropVariant = 'default',
  /** Cadre vidéo type « verre » (messagerie FTF le force déjà ; Arena LIRI peut l'activer ici). */
  immersiveVideoGlass = false,
  /**
   * LIRI Audio Scene Engine — scènes rituel / cours (Web Audio API, crossfade).
   * @see src/lib/liriAudioScene
   */
  liriAudioScenes = [],
  showLiriAudioScenePanel = false,
  /** Overlay texte / image issu de `smartboardPayload` (désactiver si sync manuelle via useLiriAudioSmartboardSync). */
  liriAudioVisualOverlay = true,
  /**
   * Micro ouvert → ducking automatique sur la piste scène (si scènes LIRI actives).
   * Désactiver si le parent gère déjà le mix (ex. OBS).
   */
  liriAudioMicAutoDuck = true,
  /** Reprise playlist (`config.liri_audio_state.current_index`). */
  liriAudioInitialSceneIndex = 0,
  /** Ex. `sessionId` — réinitialise la reprise d'index si la salle change. */
  liriAudioSessionKey = null,
  /** Hôte : persistance index (debounce côté parent). */
  onLiriAudioSceneIndexChange = undefined,
  /**
   * Invité Arena : payload Liri reçu du broadcast hôte (`liriAudioSmartboard`).
   * `undefined` = hôte (sceneBus). `null` ou objet = invité.
   */
  liriAudioRemoteSmartboardPayload = undefined,
  liriAudioRemoteSceneName = undefined,
  /** Arena desktop — file d'attente (lignes enrichies `profiles` côté parent). */
  arenaWaitingEntries = [],
  onArenaApproveWaiting,
  onArenaRejectWaiting,
  /** Arena — journal hôte [{ id, at, text, kind? }] */
  arenaHostActivityFeed = [],
  /** Vider le journal notifications (hôte) */
  onArenaHostActivityFeedClear,
  /**
   * Vue hôte verrouillée : la colonne droite affiche les membres / sièges à la place du plan cours + script.
   */
  lockedHostMembersColumn = false,
  onLockedHostMembersColumnChange,
  /** Arena hôte desktop : 'footer' = navigateur scènes dans LiveControlsBar ; NeuroInk sur le compositeur. */
  smartboardSceneDockPlacement = 'right',
}) {
  const narrowLiveViewport = usePreferNarrowLiveViewport();
  const COL_SIZES_KEY = 'liri_host_col_sizes_v1';
  const [membersOpen, setMembersOpen] = useState(false);
  const [zone3Open, setZone3Open] = useState(false);
  /** { id, name, isLocal } — fiche vidéo membre (bandeau / zone 3) */
  const [memberPreview, setMemberPreview] = useState(null);
  /** Expéditeurs avec message privé non « vus » dans le modal courant (autre interlocuteur ou modal fermé). */
  const [whisperUnreadPeers, setWhisperUnreadPeers] = useState({});
  const [membersOverviewOpen, setMembersOverviewOpen] = useState(false);
  const [neuronqModalOpenInternal, setNeuronqModalOpenInternal] = useState(false);
  const neuronqStudentModalControlled =
    neuronqStudentModalOpen !== undefined && typeof onNeuronqStudentModalOpenChange === 'function';
  const neuronqModalOpen = neuronqStudentModalControlled
    ? Boolean(neuronqStudentModalOpen)
    : neuronqModalOpenInternal;
  const setNeuronqModalOpen = neuronqStudentModalControlled
    ? (next) => {
        const v = typeof next === 'function' ? next(Boolean(neuronqStudentModalOpen)) : next;
        onNeuronqStudentModalOpenChange(v);
      }
    : setNeuronqModalOpenInternal;
  const [arenaNotifFilter, setArenaNotifFilter] = useState('all');
  const [zoneSlots, setZoneSlots] = useState({
    left: 'zone1',
    center: 'zone2',
    right: 'zone3',
  });
  const [colSizes, setColSizes] = useState({ left: 20, center: 60, right: 20 });
  const [resizing, setResizing] = useState(null);

  useEffect(() => {
    if (!messagingImmersiveFaceToFace) return;
    setColSizes({ left: 26, center: 48, right: 26 });
  }, [messagingImmersiveFaceToFace]);

  useEffect(() => {
    let highlightTimer;
    const onExpand = () => {
      arenaNotificationsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setArenaNotifScrollHighlight(true);
      clearTimeout(highlightTimer);
      highlightTimer = setTimeout(() => setArenaNotifScrollHighlight(false), 1600);
    };
    window.addEventListener(LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT, onExpand);
    return () => {
      window.removeEventListener(LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT, onExpand);
      clearTimeout(highlightTimer);
    };
  }, []);

  const [dragSlot, setDragSlot] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [devModal, setDevModal] = useState({ open: false, key: null });
  const railRef = useRef(null);
  const slideAreaRef = useRef(null);
  const layoutRef = useRef(null);
  /** Bloc « Notifications » zone 1 (motherboard) — scroll LONGIA live. */
  const arenaNotificationsSectionRef = useRef(null);
  const [arenaNotifScrollHighlight, setArenaNotifScrollHighlight] = useState(false);
  const transitionedOnceRef = useRef(false);
  const liriLockedHostColsAppliedRef = useRef(false);
  const prevSceneRef = useRef(activeScene);
  const prevSlideRef = useRef(slideIndex);
  const transitionAudioCtxRef = useRef(null);
  const transitionAudioArmedRef = useRef(false);

  const showNeuronq = neuronqFeatureEnabled !== false;
  useEffect(() => {
    if (!showNeuronq) {
      if (neuronqStudentModalControlled) onNeuronqStudentModalOpenChange(false);
      else setNeuronqModalOpenInternal(false);
    }
  }, [showNeuronq, neuronqStudentModalControlled, onNeuronqStudentModalOpenChange]);
  const promoted = promotedParticipantId
    ? participants.find((p) => String(p.id) === String(promotedParticipantId)) || null
    : null;
  const totalSlides = Math.max(1, slideRailCount != null ? slideRailCount : slides.length);
  const currentSlide = slides[Math.min(Math.max(slideIndex, 0), totalSlides - 1)] || null;
  // Deux scènes distinctes : avec coursePlanSplit, la slide vient toujours de la branche native ou import (jamais du rail mélangé).
  const compositorSlide = useMemo(() => {
    if (activeScene === 'smartboard' || activeScene === 'diapo') {
      if (coursePlanSplit?.native && coursePlanSplit?.import) {
        return pickSlideFromCoursePlanSplit(activeScene, coursePlanSplit);
      }
      return parallaxSlide ?? null;
    }
    return parallaxSlide != null ? parallaxSlide : currentSlide;
  }, [activeScene, coursePlanSplit, parallaxSlide, currentSlide]);
  const connectedMembers = (participants && participants.length > 0)
    ? participants
    : [
      { id: 'mock-m1', name: 'Aminata', role: 'connecte' },
      { id: 'mock-m2', name: 'Thomas', role: 'actif' },
      { id: 'mock-m3', name: 'Lea', role: 'invite' },
      { id: 'mock-m4', name: 'Yassine', role: 'connecte' },
      { id: 'mock-m5', name: 'Nora', role: 'actif' },
    ];

  const memberPreviewRef = useRef(null);
  memberPreviewRef.current = memberPreview;
  const connectedMembersRef = useRef([]);
  connectedMembersRef.current = connectedMembers;
  const { toast } = useToast();
  const handleWhisperIncoming = useCallback(
    ({ fromId, text }) => {
      const viewingId = memberPreviewRef.current?.id != null ? String(memberPreviewRef.current.id) : null;
      if (viewingId === String(fromId)) return;

      setWhisperUnreadPeers((prev) => ({ ...prev, [String(fromId)]: true }));

      const list = connectedMembersRef.current || [];
      const row = list.find((p) => String(p.id) === String(fromId));
      const name = row?.name || 'Un membre';
      const raw = String(text || '');
      const snippet = raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;

      toast({
        title: `Message privé — ${name}`,
        description: snippet,
        duration: 8500,
        action: (
          <ToastAction
            altText="Ouvrir la conversation dans le lecteur membre"
            onClick={() => {
              const members = connectedMembersRef.current || [];
              const p = members.find((x) => String(x.id) === String(fromId));
              setMemberPreview(p || { id: fromId, name });
              setWhisperUnreadPeers((prev) => {
                const next = { ...prev };
                delete next[String(fromId)];
                return next;
              });
            }}
          >
            Ouvrir
          </ToastAction>
        ),
      });
    },
    [toast],
  );
  const whisperIncomingCbRef = useRef(handleWhisperIncoming);
  whisperIncomingCbRef.current = handleWhisperIncoming;

  const internalWhisper = useLiveSessionWhispers(
    liveSessionWhisperBridge ? null : liveWhisperSessionKey,
    liveSessionWhisperBridge ? null : currentUserId,
    liveSessionWhisperBridge ? null : whisperIncomingCbRef,
  );
  const whisperThreads = liveSessionWhisperBridge?.threads ?? internalWhisper.threads;
  const sendWhisper = liveSessionWhisperBridge?.sendWhisper ?? internalWhisper.sendWhisper;

  useEffect(() => {
    if (!memberPreview?.id) return;
    const k = String(memberPreview.id);
    setWhisperUnreadPeers((prev) => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, [memberPreview?.id]);

  const raisedHandsOnly = Array.isArray(zone3RaisedHands) ? zone3RaisedHands : [];
  const privilegedSeatsDisplay = [1, 2, 3, 4].map((position, idx) => {
    const existing = zone3PrivilegedSeats.find((s) => Number(s.position) === position);
    if (existing) return existing;
    const fallbackMember = connectedMembers[idx];
    if (!fallbackMember) return null;
    return {
      position,
      userId: fallbackMember.userId || fallbackMember.id || `mock-seat-${position}`,
      name: fallbackMember.name || `Membre ${position}`,
      status: idx % 2 === 0 ? 'connecte' : 'actif',
    };
  }).filter(Boolean);

  const presentationMode = uxState === 'focus-presentation';
  const chatMode = uxState === 'focus-chat' || uxState === 'message-drawer-open';

  /** Zone SmartBoard : plein espace central disponible (width 100%, height flex-1). */
  const smartBoardClass = 'w-full flex-1 min-h-0';

  const playTransitionTick = (kind = 'slide') => {
    try {
      if (!sceneTransitionSoundEnabled) return;
      if (typeof window === 'undefined' || !transitionAudioArmedRef.current) return;
      const ctx = transitionAudioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume?.().catch(() => {});
        return;
      }
      if (ctx.state !== 'running') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const sceneFreq = {
        diapo: 880,
        screen: 760,
        browser: 820,
        embed: 700,
        quiz: 640,
        board: 740,
        image: 720,
        camera2: 780,
        iframe: 680,
        shop: 560,
      };
      const baseFreq = kind === 'scene' ? (sceneFreq[activeScene] || 820) : 960;
      osc.type = kind === 'scene' ? 'triangle' : 'sine';
      osc.frequency.value = baseFreq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.014, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // no-op: audio feedback is best effort only
    }
  };

  // Débloquer l'audio Web (SFX transitions) après le premier clic / touche clavier sur la page
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;
    const arm = () => {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!transitionAudioCtxRef.current) {
        try {
          transitionAudioCtxRef.current = new Ctx();
        } catch {
          return;
        }
      }
      transitionAudioArmedRef.current = true;
      transitionAudioCtxRef.current?.resume?.().catch(() => {});
    };
    window.addEventListener('pointerdown', arm, { passive: true });
    window.addEventListener('keydown', arm, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      transitionAudioArmedRef.current = false;
      try {
        transitionAudioCtxRef.current?.close?.();
      } catch { /* ignore */ }
      transitionAudioCtxRef.current = null;
    }
  }, [active]);

  // close actions menu when drawer opens
  useEffect(() => {
    if (drawerOpen && actionsOpen) onToggleActions?.();
  }, [drawerOpen]);

  // Restore persisted user sizing preferences
  useEffect(() => {
    try {
      const rawCols = window.localStorage.getItem(COL_SIZES_KEY);
      if (rawCols) setColSizes((prev) => ({ ...prev, ...JSON.parse(rawCols) }));
    } catch {
      // ignore persisted layout errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(COL_SIZES_KEY, JSON.stringify(colSizes));
    } catch {}
  }, [colSizes]);

  const liriHostLockedDesktop =
    Boolean(liveArenaMotherboardFrame && isHost && !liriMobileMaquette && !messagingImmersiveFaceToFace);
  /** Cadre central SmartBoard (Arena desktop) — bandeau branding retiré pour maximiser la zone utile. */
  const liriArenaDesktopChrome = Boolean(
    liveArenaMotherboardFrame && !liriMobileMaquette && !messagingImmersiveFaceToFace,
  );
  const liriHostSeatStripCanPromote = Boolean(isHost && onPromoteParticipant && !stripOpensMemberPreview);

  useEffect(() => {
    if (!liriHostLockedDesktop) {
      liriLockedHostColsAppliedRef.current = false;
      return;
    }
    if (liriLockedHostColsAppliedRef.current) return;
    liriLockedHostColsAppliedRef.current = true;
    setColSizes({ left: 18, center: 64, right: 18 });
  }, [liriHostLockedDesktop]);

  useEffect(() => {
    if (liriHostLockedDesktop) setZone3Open(false);
  }, [liriHostLockedDesktop]);

  // Light parallax for immersive background halos
  useEffect(() => {
    const handleMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 16;
      const y = (e.clientY / window.innerHeight - 0.5) * 14;
      setParallax({ x, y });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  // close members + zone3 when drawer opens to avoid collision
  useEffect(() => {
    if (drawerOpen) {
      setMembersOpen(false);
      setZone3Open(false);
      setMembersOverviewOpen(false);
    }
  }, [drawerOpen]);

  // slide wheel navigation (hôte — les invités suivent la synchro realtime)
  useEffect(() => {
    if (!active) return undefined;
    if (!isHost) return undefined;
    if (activeScene !== 'diapo') return undefined;
    const node = slideAreaRef.current;
    if (!node) return undefined;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 20) return;
      e.preventDefault();
      if (e.deltaY > 0) onNextSlide?.();
      else onPrevSlide?.();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [onNextSlide, onPrevSlide, active, activeScene, isHost]);

  // keyboard slide navigation + fullscreen shortcut
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      // Touche F : mode cinéma (ou fullscreen natif en fallback)
      if (e.key === 'f' || e.key === 'F') {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          if (onToggleCinema) {
            onToggleCinema();
          } else {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }
          return;
        }
      }
      if (!isHost) return;
      if (activeScene !== 'diapo') return;
      if (e.key === 'ArrowRight') onNextSlide?.();
      if (e.key === 'ArrowLeft') onPrevSlide?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNextSlide, onPrevSlide, active, activeScene, isHost, onToggleCinema]);

  // Light SFX on scene/slide transition (scene-specific pitch)
  useEffect(() => {
    if (!active || !sceneTransitionSoundEnabled) return;
    if (!transitionedOnceRef.current) {
      transitionedOnceRef.current = true;
      prevSceneRef.current = activeScene;
      prevSlideRef.current = slideIndex;
      return;
    }
    const sceneChanged = prevSceneRef.current !== activeScene;
    const slideChanged = prevSlideRef.current !== slideIndex;
    if (sceneChanged) playTransitionTick('scene');
    else if (slideChanged) playTransitionTick('slide');
    prevSceneRef.current = activeScene;
    prevSlideRef.current = slideIndex;
  }, [active, activeScene, slideIndex, sceneTransitionSoundEnabled]);

  // Column resize handlers (left|center and center|right splitters)
  useEffect(() => {
    if (!resizing) return undefined;
    const onMove = (e) => {
      const root = layoutRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const min = 14;
      if (resizing === 'left') {
        const left = Math.max(min, Math.min(30, xPct));
        const right = colSizes.right;
        const center = Math.max(40, 100 - left - right);
        setColSizes({ left, center, right });
      } else if (resizing === 'right') {
        const right = Math.max(min, Math.min(30, 100 - xPct));
        const left = colSizes.left;
        const center = Math.max(40, 100 - left - right);
        setColSizes({ left, center, right });
      }
    };
    const onUp = () => {
      setResizing(null);
      // Snap to common presets when user releases near them
      const presets = [
        { left: 16, center: 68, right: 16 },
        { left: 22, center: 56, right: 22 },
        { left: 18, center: 50, right: 32 },
      ];
      const nearest = presets.reduce((acc, p) => {
        const d = Math.abs(p.left - colSizes.left) + Math.abs(p.center - colSizes.center) + Math.abs(p.right - colSizes.right);
        if (!acc || d < acc.d) return { p, d };
        return acc;
      }, null);
      if (nearest && nearest.d <= 5) setColSizes(nearest.p);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, colSizes.left, colSizes.center, colSizes.right]);

  const swapZoneSlots = (from, to) => {
    if (!from || !to || from === to) return;
    setZoneSlots((prev) => ({
      ...prev,
      [from]: prev[to],
      [to]: prev[from],
    }));
  };

  const promoteHandToPrivileged = (handUserId) => {
    const seat = [1, 2, 3, 4].find((pos) => !zone3PrivilegedSeats.some((s) => Number(s.position) === pos)) || 1;
    onZone3GrantSeat?.(seat, handUserId);
    onZone3LowerHand?.(handUserId);
  };

  const goToSlide = (targetIndex) => {
    if (!isHost) return;
    if (typeof targetIndex !== 'number') return;
    const bounded = Math.max(0, Math.min(totalSlides - 1, targetIndex));
    if (typeof onSetSlideIndex === 'function') {
      onSetSlideIndex(bounded);
      return;
    }
    if (bounded > slideIndex) onNextSlide?.();
    else if (bounded < slideIndex) onPrevSlide?.();
  };

  if (!active) return null;

  const promotedName = promotedParticipantId
    ? (promoted?.name || mainDisplayParticipant?.name || 'Intervenant principal')
    : '—';
  const firstScript = scriptSections?.[0];
  const activeScriptBlock = scriptCurrentSection || firstScript;
  const scriptObjective = activeScriptBlock?.objective
    || activeScriptBlock?.master_agent?.message_central
    || activeScriptBlock?.goal
    || activeScriptBlock?.description
    || (typeof activeScriptBlock?.script === 'string' ? activeScriptBlock.script.split('\n').filter(Boolean)[0] : '')
    || '';
  const retentionHints = scriptSections?.filter((s) => (s?.retention || s?.memorization_tip)).slice(0, 3) || [];
  /** Plein écran immersif : un seul fond, pas de flou ni cadres visibles (studio créateur) */
  const glassPanel = 'rounded-2xl border border-transparent bg-transparent shadow-none';
  const glassSub =
    'rounded-xl border border-white/[0.09] bg-black/22 backdrop-blur-xl shadow-[0_22px_56px_-32px_rgba(0,0,0,0.88),inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(212,175,55,0.05)]';
  const railColumn = 'h-full pt-9 px-1 sm:px-1.5 pb-2 flex flex-col gap-1.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-[15px] leading-relaxed text-white/88 antialiased';
  const railTitle = 'font-serif text-[13px] font-semibold text-white/92 tracking-tight';
  /** Maquette LIRI invité : repères colorés zone 1 / 2 / 3 (hôte inchangé). */
  const liriGuestLayout = !isHost;
  const zone1Shell = liriGuestLayout
    ? 'rounded-2xl border border-red-500/25 bg-black/[0.07] shadow-[inset_0_1px_0_0_rgba(248,113,113,0.14)]'
    : glassPanel;
  const zone2Shell = liriGuestLayout
    ? 'rounded-2xl border border-sky-400/22 bg-black/[0.05] shadow-[inset_0_1px_0_0_rgba(56,189,248,0.12)]'
    : glassPanel;
  const zone3Shell = liriGuestLayout
    ? 'rounded-2xl border border-[#D4AF37]/28 bg-black/[0.06] shadow-[inset_0_1px_0_0_rgba(212,175,55,0.12)]'
    : glassPanel;
  const guestMainVideoPanelLabel = (() => {
    const pl = mainDisplayParticipant?.panelLabel || 'Flux entrant';
    if (pl === 'Flux entrant') return 'Notes entrant';
    return pl;
  })();

  const openDevModal = (key) => setDevModal({ open: true, key });
  const closeDevModal = () => setDevModal({ open: false, key: null });

  const pipCanvasRefMain = pipRegisterOnMiniPreview ? undefined : onPipCanvasRef;
  const pipCanvasRefMini = pipRegisterOnMiniPreview ? onPipCanvasRef : undefined;

  const whiteboardPagingForSidebar = useMemo(() => {
    if (typeof onWhiteboardNextPage !== 'function' && typeof onWhiteboardAddPage !== 'function') {
      return null;
    }
    return {
      pageIndex: whiteboardPageIndex,
      pageCount: Math.max(1, whiteboardPageCount),
      onPrev: onWhiteboardPrevPage,
      onNext: onWhiteboardNextPage,
      onAdd: onWhiteboardAddPage,
      onRemove: onWhiteboardRemovePage,
    };
  }, [
    whiteboardPageIndex,
    whiteboardPageCount,
    onWhiteboardPrevPage,
    onWhiteboardNextPage,
    onWhiteboardAddPage,
    onWhiteboardRemovePage,
  ]);

  const DEV_CONFIG = {
    brand:   { title: 'LiriBrandCard',     desc: 'Identite Studio + statut host.' },
    host:    { title: 'PanelActif',        desc: 'Video priorite entrante (zone 1).' },
    priv:    { title: 'PrivilegedPanel',   desc: '4 membres prets a intervenir.' },
    hands:   { title: 'RaisedHandsList',   desc: 'File d attente interactions live.' },
    strip:   { title: 'ConnectedMembersStrip', desc: 'Rail presence temps reel.' },
    screen:  { title: 'IntelligentScreen', desc: 'SmartBoard principal multi-scenes.' },
    joker:   { title: 'SceneJoker',        desc: 'Switch de scene immersif.' },
    action:  { title: 'ActionBar',         desc: 'Commandes live synchronisees.' },
    input:   { title: 'GlobalInputBar',    desc: 'Commandes slash et orchestration.' },
    control: { title: 'CourseControlPanel',desc: 'Pilotage cours + QA + waiting room.' },
    plan:    { title: 'CoursePlanPanel',   desc: 'Navigation chapitres/slides.' },
    script:  { title: 'MasterScriptPanel', desc: 'Script, objectifs, retention.' },
  };

  const renderFtfSmartBoardCompositor = () => (
    <SmartBoardCompositor
      slide={compositorSlide}
      spotlight={spotlight}
      progressivePlayback={progressivePlayback}
      onSmartboardImageExpand={onSmartboardImageExpand}
      tacticalSyncRole={tacticalSyncRole}
      remoteTacticalSync={remoteTacticalSync}
      onTacticalSyncChange={onTacticalSyncChange}
      screenVideoRef={screenShareVideoRef}
      screenActive={sharingScreen}
      sharedImageSrc={sharedImageSrc}
      sharedGalleryLength={sharedGalleryLength}
      sharedImageIndex={sharedImageIndex}
      onSharedImagePrev={onSharedImagePrev}
      onSharedImageNext={onSharedImageNext}
      sharedImageLoop={sharedImageLoop}
      onToggleSharedImageLoop={onToggleSharedImageLoop}
      camera2VideoRef={camera2VideoRef}
      camera2Active={camera2Active}
      onStartCamera2={onStartCamera2}
      camera2FluxParticipants={camera2FluxParticipants}
      camera2Placeholder={camera2Placeholder}
      camera2WaitingRemote={camera2WaitingRemote}
      activeScene={activeScene}
      onChangeScene={onChangeScene}
      sceneFlags={sceneFlags}
      readOnlySceneNavigator={!isHost}
      pipStream={pipStream}
      onShareScreen={onToggleShare}
      shopProducts={shopProducts}
      onShopProductClick={onShopProductClick}
      annotationStrokes={annotationStrokes}
      onAnnotationStrokesChange={onAnnotationStrokesChange}
      whiteboardStrokes={whiteboardStrokes}
      onWhiteboardStrokesChange={onWhiteboardStrokesChange}
      sceneDockPlacement={smartboardSceneDockPlacement}
      hideEmbeddedWhiteboardToolsRail={false}
      whiteboardPageIndex={whiteboardPageIndex}
      whiteboardPageCount={whiteboardPageCount}
      onWhiteboardPrevPage={onWhiteboardPrevPage}
      onWhiteboardNextPage={onWhiteboardNextPage}
      onWhiteboardAddPage={onWhiteboardAddPage}
      onWhiteboardRemovePage={onWhiteboardRemovePage}
      secureAppShareState={secureAppShareState}
      onSecureAppShareStateChange={onSecureAppShareStateChange}
    />
  );

  const arenaNotifFiltered = useMemo(() => {
    const list = Array.isArray(arenaHostActivityFeed) ? arenaHostActivityFeed : [];
    if (arenaNotifFilter === 'all') return list;
    return list.filter((item) => {
      const k = item.kind || 'default';
      if (arenaNotifFilter === 'urgent') return typeof k === 'string' && k.startsWith('longia_') && item.longiaUrgent;
      if (typeof arenaNotifFilter === 'string' && arenaNotifFilter.startsWith('longia_')) return k === arenaNotifFilter;
      return k === arenaNotifFilter;
    });
  }, [arenaHostActivityFeed, arenaNotifFilter]);

  const renderArenaNotificationsRail = useCallback(() => {
    return (
      <div
        ref={arenaNotificationsSectionRef}
        className={cn(
          'p-1.5',
          glassSub,
          arenaNotifScrollHighlight &&
            'ring-2 ring-violet-400/50 ring-offset-2 ring-offset-[#070a10] transition-shadow duration-300',
        )}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 text-[11px]')}>Notifications</p>
            {isHost && arenaHostActivityFeed.length > 0 ? (
              <p className="mt-0.5 text-[8px] text-white/35">
                {arenaNotifFilter === 'all'
                  ? `${arenaHostActivityFeed.length} événement${arenaHostActivityFeed.length > 1 ? 's' : ''}`
                  : `${arenaNotifFiltered.length} / ${arenaHostActivityFeed.length} affiché${arenaNotifFiltered.length !== 1 ? 's' : ''}`}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-[9px] font-semibold tabular-nums text-[#D4AF37]/85">
              {isHost ? arenaHostActivityFeed.length : 0}
            </span>
            {isHost && arenaHostActivityFeed.length > 0 && onArenaHostActivityFeedClear ? (
              <button
                type="button"
                onClick={() => {
                  onArenaHostActivityFeedClear();
                  setArenaNotifFilter('all');
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-white/55 transition-colors hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-300"
                title="Vider le journal"
                aria-label="Vider le journal des notifications"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            ) : null}
          </div>
        </div>
        {isHost && arenaHostActivityFeed.length > 0 ? (
          <div className="mb-1.5 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ARENA_NOTIF_FILTER_OPTIONS.map((opt) => {
              const active = arenaNotifFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setArenaNotifFilter(opt.id)}
                  className={cn(
                    'shrink-0 rounded-lg border px-2 py-0.5 text-[8px] font-medium transition-colors',
                    active
                      ? 'border-[#D4AF37]/45 bg-[#D4AF37]/12 text-[#f5dd8a]'
                      : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/18 hover:text-white/75',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="max-h-[min(28vh,240px)] min-h-[5rem] space-y-1.5 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-width:thin]">
          {!isHost ? (
            <div className="rounded-lg border border-dashed border-white/12 bg-black/20 px-2 py-5 text-center">
              <p className="text-[10px] text-white/40">Fil d&apos;événements réservé à l&apos;hôte</p>
              <p className="mt-1 text-[9px] text-white/28">0 notification</p>
            </div>
          ) : arenaHostActivityFeed.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#D4AF37]/22 bg-black/25 px-2 py-5 text-center">
              <p className="text-[10px] text-[#D4AF37]/55">0 notification</p>
              <p className="mt-1 text-[9px] text-white/35">Aucun événement récent</p>
            </div>
          ) : arenaNotifFiltered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/14 bg-black/20 px-2 py-5 text-center">
              <p className="text-[10px] text-white/50">Aucun événement pour ce filtre</p>
              <button
                type="button"
                onClick={() => setArenaNotifFilter('all')}
                className="mt-2 text-[9px] font-medium text-[#D4AF37]/85 underline decoration-[#D4AF37]/40 underline-offset-2 hover:text-[#f5dd8a]"
              >
                Afficher tout
              </button>
            </div>
          ) : (
            arenaNotifFiltered.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
              >
                <p className="text-[10px] leading-snug text-white/88">{item.text}</p>
                <p className="mt-0.5 text-[8px] tabular-nums text-white/35">
                  {typeof item.at === 'number'
                    ? new Date(item.at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : ''}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }, [
    arenaHostActivityFeed,
    arenaNotifFiltered,
    arenaNotifFilter,
    arenaNotifScrollHighlight,
    glassSub,
    isHost,
    onArenaHostActivityFeedClear,
    railTitle,
  ]);

  const renderZone1 = () => {
    if (liriHostLockedDesktop) {
      const antenneBlock = (
        <>
          <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 mb-1.5 text-[11px]')}>
            Antenne & Q&R
          </p>
          <div className="space-y-1.5">
            <div className="flex h-9 items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2">
              <span className="text-[10px] text-white/80">À l&apos;antenne</span>
              <span className="max-w-[120px] truncate text-[10px] text-white">{promotedName}</span>
            </div>
            {showNeuronq && isHost ? (
              <button
                type="button"
                onClick={() => onNeuronqToggleQa?.(!neuronqQaMode)}
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] text-[10px] text-white/85 hover:bg-[#D4AF37]/10"
              >
                {neuronqQaMode ? 'Fermer le mode Q&R' : 'Activer le mode Q&R'}
              </button>
            ) : null}
          </div>
        </>
      );
      return (
        <LiveEventsSidebar
          raisedHands={raisedHandsOnly}
          waitingEntries={arenaWaitingEntries}
          activityFeed={arenaHostActivityFeed}
          notifFilter={arenaNotifFilter}
          onNotifFilterChange={setArenaNotifFilter}
          onClearActivityFeed={onArenaHostActivityFeedClear}
          onGrantSpeech={promoteHandToPrivileged}
          onIgnoreHand={onZone3LowerHand}
          onApproveWaiting={onArenaApproveWaiting}
          onRejectWaiting={onArenaRejectWaiting}
          antenneBlock={antenneBlock}
        />
      );
    }
    if (messagingImmersiveFaceToFace) {
      const remoteName = mainDisplayParticipant?.name || 'Interlocuteur';
      return (
        <div className={cn(railColumn, zone1Shell, '!pt-3 min-h-0 flex flex-col overflow-hidden')}>
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-2 sm:p-2.5 [scrollbar-width:thin]',
              immersiveArenaPanelClass,
            )}
          >
            <div className="flex shrink-0 items-center gap-3 px-0.5 pt-0.5">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37]/35 via-[#1a1510] to-black text-base font-semibold tracking-tight text-[#fdf6dd] shadow-[0_0_24px_-4px_rgba(212,175,55,0.55)] ring-2 ring-[#D4AF37]/55 ring-offset-2 ring-offset-[#070a10] font-serif">
                {immersiveInitials(remoteName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-base font-semibold text-[#D4AF37] md:text-lg">{remoteName}</p>
                <p className="text-[10px] leading-snug text-[#D4AF37]/65">
                  {remoteWaiting ? 'Connexion en cours…' : (mainDisplayParticipant?.panelSubtitle || 'Flux vidéo actif')}
                </p>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
              <div className="w-full max-w-[min(100%,300px)] shrink-0">
                <LivePrimaryVideoStage
                  videoRef={mainVideoRef}
                  title={remoteName}
                  subtitle={mainDisplayParticipant?.panelSubtitle || ''}
                  panelLabel={mainDisplayParticipant?.panelLabel || 'Flux entrant'}
                  blur={videoBlur}
                  beauty={videoBeauty}
                  vbg={videoVbg}
                  chromaKey={videoChromaKey}
                  chromaColor={videoChromaColor}
                  chromaSens={videoChromaSens}
                  immersiveGlass
                  onPipCanvasRef={pipCanvasRefMain}
                  waiting={remoteWaiting}
                  waitingName={remoteName}
                  privileged={Boolean(
                    promotedParticipantId
                    && zone3PrivilegedSeats?.some((s) => String(s.userId) === String(promotedParticipantId)),
                  )}
                />
              </div>
            </div>
            <div className="shrink-0 rounded-xl border border-[#D4AF37]/20 bg-black/35 p-2">
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]/80">
                Membres privilégiés
              </p>
              <div className="grid grid-cols-2 gap-1">
                {[1, 2, 3, 4].map((pos) => {
                  const seat = privilegedSeatsDisplay.find((s) => Number(s.position) === pos);
                  const initial = (seat?.name || '?').slice(0, 1).toUpperCase();
                  return (
                    <div
                      key={pos}
                      className={cn(
                        'flex h-11 items-center gap-1.5 rounded-lg border px-1.5',
                        seat ? 'border-[#D4AF37]/35 bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.04]',
                      )}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-black/40 text-[9px] font-medium text-[#D4AF37]/90">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[9px] font-medium text-white/85">{seat?.name || '—'}</p>
                        <p className="truncate text-[8px] text-white/40">{seat ? (seat.status || 'connecté') : 'libre'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {isHost ? renderArenaNotificationsRail() : null}
          </div>
        </div>
      );
    }
    return (
    <div className={cn(railColumn, zone1Shell)}>
      {liriGuestLayout ? (
        <div className="px-1 -mt-1 mb-0.5 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-300/85">
            Zone 1 — Panel actif
          </p>
        </div>
      ) : null}
      {/* PanelActif — priorité entrante (hôte côté invité, invité promu côté hôte) */}
      <div
        className={cn('p-1.5', glassSub)}
        onDoubleClick={() => openDevModal('host')}
        data-liri-panel={LIRI_PANEL_ACTIF}
      >
        <div className="cursor-move" draggable onDragStart={() => setDragSlot('left')}>
          <LivePrimaryVideoStage
            videoRef={mainVideoRef}
            title={mainDisplayParticipant?.name || 'Interlocuteur'}
            subtitle={mainDisplayParticipant?.panelSubtitle || ''}
            panelLabel={liriGuestLayout ? guestMainVideoPanelLabel : (mainDisplayParticipant?.panelLabel || 'Flux entrant')}
            blur={videoBlur}
            beauty={videoBeauty}
            vbg={videoVbg}
            chromaKey={videoChromaKey}
            chromaColor={videoChromaColor}
            chromaSens={videoChromaSens}
            immersiveGlass={immersiveVideoGlass}
            waiting={remoteWaiting}
            waitingName={mainDisplayParticipant?.name || 'votre interlocuteur'}
            onClick={onSwapVideoLayout}
            clickable={Boolean(onSwapVideoLayout)}
            privileged={Boolean(
              promotedParticipantId
              && zone3PrivilegedSeats?.some((s) => String(s.userId) === String(promotedParticipantId)),
            )}
            onPipCanvasRef={pipCanvasRefMain}
          />
        </div>
      </div>

      <div className={cn('p-1.5', glassSub)} onDoubleClick={() => openDevModal('priv')}>
        <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 mb-1.5 text-[11px]')}>Membres privilégiés</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[1, 2, 3, 4].map((pos, idx) => {
            const seat = privilegedSeatsDisplay.find((s) => Number(s.position) === pos);
            const initial = (seat?.name || '?').slice(0, 1).toUpperCase();
            const seatState = seat?.status || (idx % 2 === 0 ? 'actif' : 'connecte');
            return (
              <button
                key={pos}
                type="button"
                disabled={!isHost}
                onClick={() => isHost && seat?.userId && onZone3RevokeSeat?.(pos)}
                className={cn(
                  'h-14 rounded-lg border text-left px-1.5 transition-all flex items-center gap-1.5',
                  seat ? 'border-[#D4AF37]/45 bg-[#D4AF37]/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/45',
                  !isHost && 'opacity-80 cursor-default',
                )}
              >
                <div className="h-7 w-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[10px] font-semibold">
                  {initial}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium truncate">{seat?.name || 'Disponible'}</div>
                  <div className="text-[9px] text-white/55">{seat ? seatState : 'invite'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMembersOpen((v) => !v)}
        className="h-9 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center gap-1.5 text-[11px] text-white/90"
      >
        <Plus className="w-3.5 h-3.5" />
        {isHost ? 'Inviter / voir les membres' : 'Voir les membres'}
      </button>

      {liveArenaMotherboardFrame ? (
        <>
          <div className={cn('p-1.5', glassSub)} onDoubleClick={() => openDevModal('hands')}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 text-[11px]')}>Mains levées</p>
              <span className="text-[9px] font-semibold tabular-nums text-[#D4AF37]/85">{raisedHandsOnly.length}</span>
            </div>
            <div className="max-h-[min(28vh,240px)] min-h-[5rem] space-y-1.5 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-width:thin]">
              {raisedHandsOnly.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#D4AF37]/22 bg-black/25 px-2 py-5 text-center">
                  <p className="text-[10px] text-[#D4AF37]/55">Aucune main levée</p>
                  <p className="mt-1 text-[9px] text-white/35">0 main levée</p>
                </div>
              ) : (
                raisedHandsOnly.map((h) => (
                  isHost ? (
                    <button
                      key={String(h.userId)}
                      type="button"
                      onClick={() => promoteHandToPrivileged(h.userId)}
                      className="flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-1.5 text-left hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/12"
                    >
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[9px] text-white/85">
                        {(h.name || 'Membre').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[10px] text-white/85">{h.name || 'Membre'}</span>
                      <span className="flex-shrink-0 text-[9px] text-[#D4AF37]">Monter</span>
                    </button>
                  ) : (
                    <div
                      key={String(h.userId)}
                      className="flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-1.5 opacity-90"
                    >
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[9px] text-white/85">
                        {(h.name || 'Membre').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[10px] text-white/85">{h.name || 'Membre'}</span>
                      <span className="flex-shrink-0 text-[9px] text-white/45">En attente</span>
                    </div>
                  )
                ))
              )}
            </div>
          </div>

          <div className={cn('p-1.5', glassSub)}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 text-[11px]')}>Salle d&apos;attente</p>
              <span className="text-[9px] font-semibold tabular-nums text-[#D4AF37]/85">
                {isHost ? arenaWaitingEntries.length : 0}
              </span>
            </div>
            <div className="max-h-[min(28vh,240px)] min-h-[5rem] space-y-1.5 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-width:thin]">
              {!isHost ? (
                <div className="rounded-lg border border-dashed border-white/12 bg-black/20 px-2 py-5 text-center">
                  <p className="text-[10px] text-white/40">Réservé à l&apos;hôte</p>
                  <p className="mt-1 text-[9px] text-white/28">0 personne en attente</p>
                </div>
              ) : arenaWaitingEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#D4AF37]/22 bg-black/25 px-2 py-5 text-center">
                  <p className="text-[10px] text-[#D4AF37]/55">Aucune personne en attente</p>
                  <p className="mt-1 text-[9px] text-white/35">0 en salle d&apos;attente</p>
                </div>
              ) : (
                arenaWaitingEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="space-y-1.5 rounded-lg border border-amber-400/18 bg-amber-500/[0.06] p-2"
                  >
                    <div className="flex items-center gap-2">
                      {entry.profiles?.avatar_url ? (
                        <img
                          src={entry.profiles.avatar_url}
                          alt=""
                          className="h-7 w-7 flex-shrink-0 rounded-full border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/15 text-[10px] font-bold text-[#D4AF37]">
                          {(entry.profiles?.name || '?').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-medium text-white/90">
                          {entry.profiles?.name || 'Participant'}
                        </p>
                        <p className="truncate text-[8px] capitalize text-white/40">
                          {entry.invitation_type || 'individuel'}
                        </p>
                      </div>
                    </div>
                    {onArenaApproveWaiting && onArenaRejectWaiting ? (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => onArenaApproveWaiting(entry.id)}
                          className="h-7 min-w-0 flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-[9px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                        >
                          Accepter
                        </button>
                        <button
                          type="button"
                          onClick={() => onArenaApproveWaiting(entry.id, { videoOff: true })}
                          className="h-7 rounded-lg border border-white/10 bg-white/[0.05] px-1.5 text-[9px] text-white/55 hover:text-white"
                          title="Sans caméra"
                        >
                          📷✗
                        </button>
                        <button
                          type="button"
                          onClick={() => onArenaApproveWaiting(entry.id, { audioOnly: true })}
                          className="h-7 rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-1.5 text-[9px] text-[#D4AF37] hover:bg-[#D4AF37]/18"
                          title="Auditeur"
                        >
                          🎧
                        </button>
                        <button
                          type="button"
                          onClick={() => onArenaRejectWaiting(entry.id)}
                          className="h-7 rounded-lg border border-red-500/25 bg-red-500/10 px-2 text-[9px] text-red-400 hover:bg-red-500/18"
                        >
                          Refuser
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          {renderArenaNotificationsRail()}

          {activeScene === 'board' && !isHost && whiteboardPageCount > 1 ? (
            <LiveWhiteboardGuestPageIndicator
              className={cn('p-1.5', glassSub)}
              pageIndex={whiteboardPageIndex}
              pageCount={whiteboardPageCount}
            />
          ) : null}

          <div className={cn('p-1.5 flex-shrink-0', glassSub)} onDoubleClick={() => openDevModal('control')}>
            <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 mb-1.5 text-[11px]')}>
              {liriGuestLayout ? 'Pilotage antenne' : 'Antenne & Q&R'}
            </p>
            <div className="space-y-1.5">
              <div className="flex h-9 items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2">
                <span className="text-[10px] text-white/80">À l&apos;antenne</span>
                <span className="max-w-[120px] truncate text-[10px] text-white">{promotedName}</span>
              </div>
              {showNeuronq && isHost ? (
                <button
                  type="button"
                  onClick={() => onNeuronqToggleQa?.(!neuronqQaMode)}
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] text-[10px] text-white/85 hover:bg-[#D4AF37]/10"
                >
                  {neuronqQaMode ? 'Fermer le mode Q&R' : 'Activer le mode Q&R'}
                </button>
              ) : showNeuronq && !isHost && neuronqQaMode ? (
                <div className="flex h-9 w-full items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-2 text-[10px] text-[#D4AF37]/95">
                  Mode Q&R (hôte)
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={cn('p-1.5 flex-shrink-0', glassSub)} onDoubleClick={() => openDevModal('control')}>
            <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 mb-1.5 text-[11px]')}>
              {liriGuestLayout ? 'Pilotage file d&apos;attente & antenne' : 'Pilotage antenne & Q&R'}
            </p>
            <div className="space-y-1.5">
              <div className="flex h-9 items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2">
                <span className="text-[10px] text-white/80 flex items-center gap-1.5">
                  <Bell className="h-3 w-3" />
                  Mains levées
                </span>
                <span className="text-[10px] font-semibold tabular-nums text-[#D4AF37]">{raisedHandsOnly.length}</span>
              </div>
              {showNeuronq ? (
                <div className="flex h-9 items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2">
                  <span className="text-[10px] text-white/80">Q&R en attente</span>
                  <span className="text-[10px] font-semibold tabular-nums text-[#D4AF37]">{neuronqPendingCount}</span>
                </div>
              ) : null}
              <div className="flex h-9 items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2">
                <span className="text-[10px] text-white/80">À l&apos;antenne</span>
                <span className="max-w-[120px] truncate text-[10px] text-white">{promotedName}</span>
              </div>
              {showNeuronq && isHost ? (
                <button
                  type="button"
                  onClick={() => onNeuronqToggleQa?.(!neuronqQaMode)}
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] text-[10px] text-white/85 hover:bg-[#D4AF37]/10"
                >
                  {neuronqQaMode ? 'Fermer le mode Q&R' : 'Activer le mode Q&R'}
                </button>
              ) : showNeuronq && !isHost && neuronqQaMode ? (
                <div className="flex h-9 w-full items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-2 text-[10px] text-[#D4AF37]/95">
                  Mode Q&R (hôte)
                </div>
              ) : null}
            </div>
          </div>

          <div className={cn('p-1.5', glassSub)} onDoubleClick={() => openDevModal('hands')}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 text-[11px]')}>Mains levées</p>
              <span className="text-[9px] font-semibold tabular-nums text-[#D4AF37]/85">{raisedHandsOnly.length}</span>
            </div>
            <div className="max-h-[min(24vh,200px)] min-h-[4rem] space-y-1.5 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-width:thin]">
              {raisedHandsOnly.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/12 bg-black/20 px-2 py-4 text-center">
                  <p className="text-[10px] text-white/45">Aucune main levée</p>
                  <p className="mt-1 text-[9px] text-white/30">0 main levée</p>
                </div>
              ) : (
                raisedHandsOnly.map((h) => (
                  isHost ? (
                    <button
                      key={String(h.userId)}
                      type="button"
                      onClick={() => promoteHandToPrivileged(h.userId)}
                      className="flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-1.5 text-left hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/12"
                    >
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[9px] text-white/85">
                        {(h.name || 'Membre').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[10px] text-white/85">{h.name || 'Membre'}</span>
                      <span className="flex-shrink-0 text-[9px] text-[#D4AF37]">Monter</span>
                    </button>
                  ) : (
                    <div
                      key={String(h.userId)}
                      className="flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-1.5 opacity-90"
                    >
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[9px] text-white/85">
                        {(h.name || 'Membre').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[10px] text-white/85">{h.name || 'Membre'}</span>
                      <span className="flex-shrink-0 text-[9px] text-white/45">En attente</span>
                    </div>
                  )
                ))
              )}
            </div>
          </div>

          {renderArenaNotificationsRail()}

          {activeScene === 'board' && !isHost && whiteboardPageCount > 1 ? (
            <LiveWhiteboardGuestPageIndicator
              className={cn('p-1.5', glassSub)}
              pageIndex={whiteboardPageIndex}
              pageCount={whiteboardPageCount}
            />
          ) : null}
        </>
      )}
    </div>
    );
  };

  const renderZone2 = () => {
    if (messagingImmersiveFaceToFace) {
      return (
        <div className={cn('flex h-full min-h-0 flex-col gap-1.5 overflow-hidden p-0.5 sm:p-1', zone2Shell)}>
          <div
            className={cn(
              'flex min-h-[min(200px,42%)] flex-1 flex-col overflow-hidden',
              immersiveArenaPanelClass,
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#D4AF37]/25 bg-black/35 px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="font-serif text-xs font-semibold text-[#D4AF37] sm:text-sm">Écran intelligent</p>
                <p className="truncate text-[9px] text-[#D4AF37]/55">
                  Diaporama, partage d'écran, Web, images — bandeau de scènes ci-dessous
                </p>
              </div>
            </div>
            <motion.div
              key={`ftf-${activeScene}-${slideParallaxKey ?? slideIndex}`}
              initial={{ opacity: 0.88, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              ref={slideAreaRef}
              className={cn('relative min-h-0 flex-1 overflow-hidden rounded-b-xl', smartBoardClass)}
              onDoubleClick={() => openDevModal('screen')}
            >
              {renderFtfSmartBoardCompositor()}
            </motion.div>
          </div>
          <div className="flex h-[min(13rem,32vh)] min-h-[7.5rem] max-h-[38vh] shrink-0 flex-col sm:h-[min(15rem,34vh)]">
            <LiveMessageDrawer
              variant="inline"
              immersiveArena
              open
              messages={drawerMessages}
              currentUserId={currentUserId}
              onClose={onToggleDrawer}
              onSendForumMessage={onSendForumMessage}
              forumSending={forumSending}
            />
          </div>
        </div>
      );
    }
    const hasRealMembers = participants.length > 0;
    const stripVideo = Boolean(liveKitRoomRef);
    const arenaVideoStrip = liveArenaMotherboardFrame && stripVideo;
    const stripParticipantsForArena = arenaVideoStrip
      ? (isHost ? participants.filter((p) => !p.isLocal) : participants)
      : participants;
    const showMemberStrip = !liriHostLockedDesktop && (arenaVideoStrip || hasRealMembers);
    const ARENA_STRIP_SLOTS = 8;
    const canPromoteStrip = Boolean(isHost && onPromoteParticipant && !stripOpensMemberPreview);
    const motherboardPresenterName = promoted?.name || hostParticipant?.name || 'LIRI';
    const renderCentralSmartBoardMotion = (surfaceClass) => (
      <motion.div
        key={`${activeScene}-${slideParallaxKey ?? slideIndex}`}
        initial={activeScene === 'smartboard' || activeScene === 'diapo' ? { opacity: 0.56, scale: 0.985, y: 8 } : { opacity: 0.62, x: 18, scale: 0.992 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: activeScene === 'smartboard' || activeScene === 'diapo' ? 0.28 : 0.34, ease: [0.22, 1, 0.36, 1] }}
        ref={slideAreaRef}
        className={cn(
          surfaceClass,
          smartBoardClass,
          !showMemberStrip && !cinemaMode && !liriHostLockedDesktop && 'pt-9',
        )}
        onDoubleClick={() => openDevModal('screen')}
      >
        <SmartBoardCompositor
          slide={compositorSlide}
          spotlight={spotlight}
          progressivePlayback={progressivePlayback}
          onSmartboardImageExpand={onSmartboardImageExpand}
          tacticalSyncRole={tacticalSyncRole}
          remoteTacticalSync={remoteTacticalSync}
          onTacticalSyncChange={onTacticalSyncChange}
          screenVideoRef={screenShareVideoRef}
          screenActive={sharingScreen}
          sharedImageSrc={sharedImageSrc}
          sharedGalleryLength={sharedGalleryLength}
          sharedImageIndex={sharedImageIndex}
          onSharedImagePrev={onSharedImagePrev}
          onSharedImageNext={onSharedImageNext}
          sharedImageLoop={sharedImageLoop}
          onToggleSharedImageLoop={onToggleSharedImageLoop}
          camera2VideoRef={camera2VideoRef}
          camera2Active={camera2Active}
          onStartCamera2={onStartCamera2}
          camera2FluxParticipants={camera2FluxParticipants}
          camera2Placeholder={camera2Placeholder}
          camera2WaitingRemote={camera2WaitingRemote}
          activeScene={activeScene}
          onChangeScene={onChangeScene}
          sceneFlags={sceneFlags}
          readOnlySceneNavigator={!isHost}
          pipStream={pipStream}
          onShareScreen={onToggleShare}
          shopProducts={shopProducts}
          onShopProductClick={onShopProductClick}
          annotationStrokes={annotationStrokes}
          onAnnotationStrokesChange={onAnnotationStrokesChange}
          whiteboardStrokes={whiteboardStrokes}
          onWhiteboardStrokesChange={onWhiteboardStrokesChange}
          premiumArenaHostTray={liriHostLockedDesktop}
          sceneDockPlacement={smartboardSceneDockPlacement}
          hideEmbeddedWhiteboardToolsRail={false}
          whiteboardPageIndex={whiteboardPageIndex}
          whiteboardPageCount={whiteboardPageCount}
          onWhiteboardPrevPage={onWhiteboardPrevPage}
          onWhiteboardNextPage={onWhiteboardNextPage}
          onWhiteboardAddPage={onWhiteboardAddPage}
          onWhiteboardRemovePage={onWhiteboardRemovePage}
          secureAppShareState={secureAppShareState}
          onSecureAppShareStateChange={onSecureAppShareStateChange}
        />
      </motion.div>
    );
    return (
      <div
        className={cn(
          'flex h-full flex-col overflow-hidden',
          zone2Shell,
          liriHostLockedDesktop && 'pt-[6.75rem]',
        )}
      >

        {/* ── Bande membres connectés — vignettes caméra (LiveKit) ou pastilles initiales ── */}
        <AnimatePresence initial={false}>
          {showMemberStrip && (
            <motion.div
              key="member-strip"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex-shrink-0 overflow-hidden"
            >
              {liriGuestLayout ? (
                <div
                  className={cn(
                    'flex items-center justify-between gap-2 border-b px-3 pb-0 pt-2',
                    liriArenaDesktopChrome
                      ? 'border-amber-400/15 bg-black/15'
                      : 'border-sky-400/10',
                  )}
                >
                  <p
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-[0.14em]',
                      liriArenaDesktopChrome ? 'text-amber-200/75' : 'text-white/55',
                    )}
                  >
                    Entête — membre(s) connecté(s)
                  </p>
                  <span
                    className={cn(
                      'tabular-nums text-[9px]',
                      liriArenaDesktopChrome ? 'text-amber-200/60' : 'text-sky-300/70',
                    )}
                  >
                    {participants.length}
                  </span>
                </div>
              ) : null}
              <div
                ref={railRef}
                className={cn(
                  'px-2 pb-1 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]',
                  'pt-9',
                  stripVideo && 'items-end min-h-[68px]',
                  liriGuestLayout && 'pt-2',
                )}
                onDoubleClick={() => openDevModal('strip')}
              >
                {arenaVideoStrip ? (
                  <>
                    {Array.from({ length: ARENA_STRIP_SLOTS }, (_, i) => {
                      const p = stripParticipantsForArena[i];
                      if (p) {
                        const activeP = p.id === promoted?.id;
                        return (
                          <ParticipantStripChip
                            key={p.id}
                            roomRef={liveKitRoomRef}
                            participant={{ id: p.id, name: p.name, isLocal: !!p.isLocal }}
                            isPromoted={activeP}
                            canPromote={canPromoteStrip}
                            onPromote={onPromoteParticipant}
                            onOpenPreview={
                              stripOpensMemberPreview ? (mp) => setMemberPreview(mp) : undefined
                            }
                          />
                        );
                      }
                      return <ArenaStripEmptySlot key={`arena-empty-${i}`} />;
                    })}
                    {stripParticipantsForArena.length > ARENA_STRIP_SLOTS ? (
                      <button
                        type="button"
                        onClick={() => setMembersOpen(true)}
                        className="shrink-0 border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/50 rounded-xl"
                        title="Voir tous les membres"
                      >
                        <ArenaStripOverflowTile
                          extraCount={stripParticipantsForArena.length - ARENA_STRIP_SLOTS}
                        />
                      </button>
                    ) : null}
                  </>
                ) : (
                  participants.map((p) => {
                    const activeP = p.id === promoted?.id;
                    if (stripVideo) {
                      return (
                        <ParticipantStripChip
                          key={p.id}
                          roomRef={liveKitRoomRef}
                          participant={{ id: p.id, name: p.name, isLocal: !!p.isLocal }}
                          isPromoted={activeP}
                          canPromote={canPromoteStrip}
                          onPromote={onPromoteParticipant}
                          onOpenPreview={
                            stripOpensMemberPreview ? (mp) => setMemberPreview(mp) : undefined
                          }
                        />
                      );
                    }
                    const initial = (p.name || 'M').slice(0, 1).toUpperCase();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setMemberPreview({ id: p.id, name: p.name, isLocal: !!p.isLocal })}
                        className={cn(
                          'h-8 px-2 rounded-xl text-[11px] border whitespace-nowrap inline-flex items-center gap-1.5 flex-shrink-0',
                          activeP ? 'border-[#D4AF37]/45 bg-[#D4AF37]/14 text-[#f5dd8a]' : 'border-white/10 bg-white/[0.03] text-white/70'
                        )}
                      >
                        <span className="h-5 w-5 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[9px]">
                          {initial}
                        </span>
                        <span className="max-w-[72px] truncate">{p.name || 'Membre'}</span>
                      </button>
                    );
                  })
                )}
                {!liriHostLockedDesktop ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMembersOpen(true)}
                      className="h-8 w-8 flex-shrink-0 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-white/70 flex items-center justify-center"
                      title="Voir plus de membres"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <div
                      className="ml-auto flex-shrink-0 cursor-move opacity-30 hover:opacity-60 px-1"
                      draggable
                      onDragStart={() => setDragSlot('center')}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-white/60" />
                    </div>
                  </>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {liriGuestLayout ? (
          <div
            className={cn(
              'flex-shrink-0 border-b px-3 py-1.5',
              liriArenaDesktopChrome
                ? 'border-amber-400/12 bg-[#0a0612]/40'
                : 'border-sky-400/10 bg-sky-500/[0.04]',
            )}
          >
            <p
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.14em]',
                liriArenaDesktopChrome ? 'text-amber-200/80' : 'text-sky-300/80',
              )}
            >
              Zone 2 — Écran intelligent
            </p>
          </div>
        ) : null}

        {/* ── Écran intelligent / Martoaberd (Arena desktop) ou SmartBoard plein cadre ── */}
        {liveArenaMotherboardFrame ? (
          <div
            className={cn(
              'mb-0 flex min-h-0 flex-1 flex-col overflow-hidden',
              liriArenaDesktopChrome
                ? LIRI_HOST_STAGE_FRAME
                : cn('mx-0.5 mb-0.5 sm:mx-1', immersiveArenaPanelClass),
            )}
          >
            {liriArenaDesktopChrome ? (
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px]">
                <div className={LIRI_HOST_STAGE_CANVAS_GRADIENT} />
                <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.14] mix-blend-overlay bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.03)_2px,rgba(255,255,255,0.03)_3px)]" />
                <div className="relative z-[1] flex h-full min-h-0 flex-col">
                  {renderCentralSmartBoardMotion(
                    'relative min-h-0 flex-1 overflow-hidden rounded-[18px] bg-transparent',
                  )}
                </div>
              </div>
            ) : (
              renderCentralSmartBoardMotion('relative min-h-0 flex-1 overflow-hidden rounded-xl')
            )}
          </div>
        ) : (
          renderCentralSmartBoardMotion('relative overflow-hidden')
        )}
      </div>
    );
  };

  const stripMembers = (zone3Members && zone3Members.length > 0)
    ? zone3Members
    : connectedMembers.map((m) => ({
      userId: String(m.userId || m.id || ''),
      name: m.name || 'Membre',
      avatar_url: m.avatar_url || null,
      role: m.role,
    }));

  const renderZone3 = () => {
    if (liriHostLockedDesktop) {
      if (lockedHostMembersColumn) {
        return (
          <LiriHostMembersColumn
            railTitleClass={railTitle}
            privilegedSeatsDisplay={privilegedSeatsDisplay}
            isHost={isHost}
            onZone3RevokeSeat={onZone3RevokeSeat}
            stripMembers={stripMembers}
            currentUserId={currentUserId}
            promotedParticipantId={promotedParticipantId}
            onPromoteParticipant={onPromoteParticipant}
            onSelectMember={(p) => setMemberPreview(p)}
            memberCount={stripMembers.length}
            onOpenMembersOverview={() => setMembersOverviewOpen(true)}
            onBackToCourse={
              typeof onLockedHostMembersColumnChange === 'function'
                ? () => onLockedHostMembersColumnChange(false)
                : undefined
            }
          />
        );
      }
      return (
        <LiriHostGuidanceColumn
          miniVideoRef={miniVideoRef}
          miniDisplayParticipant={miniDisplayParticipant}
          hostParticipant={hostParticipant}
          videoBlur={videoBlur}
          videoBeauty={videoBeauty}
          videoVbg={videoVbg}
          videoFilterCSS={videoFilterCSS}
          videoChromaKey={videoChromaKey}
          videoChromaColor={videoChromaColor}
          videoChromaSens={videoChromaSens}
          onPipCanvasRef={pipCanvasRefMini}
          currentUserId={currentUserId}
          zone3PrivilegedSeats={zone3PrivilegedSeats}
          immersiveVideoGlass={immersiveVideoGlass}
          coursePlanSplit={coursePlanSplit}
          slides={slides}
          slideIndex={slideIndex}
          activeScene={activeScene}
          onPickCoursePlanSlide={onPickCoursePlanSlide}
          onGoToSlide={goToSlide}
          scriptSections={scriptSections}
          scriptCurrentSection={scriptCurrentSection}
          scriptObjective={scriptObjective}
          railTitleClass={railTitle}
          muted={muted}
          cameraOff={cameraOff}
          onToggleMuted={onToggleMuted}
          onToggleCamera={onToggleCamera}
          onOpenLiveSettings={onOpenLiveSettings}
          onToggleCinema={onToggleCinema}
          cinemaMode={cinemaMode}
        />
      );
    }
    if (messagingImmersiveFaceToFace) {
      const selfName = miniDisplayParticipant?.name || hostParticipant?.name || 'Vous';
      return (
        <div className={cn(railColumn, zone3Shell, '!pt-3 !overflow-hidden')}>
          <div className={cn('flex min-h-0 flex-1 flex-col gap-2 p-2 sm:p-2.5', immersiveArenaPanelClass)}>
            <div className="flex shrink-0 items-center gap-3 px-0.5 pt-0.5">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37]/35 via-[#1a1510] to-black text-base font-semibold tracking-tight text-[#fdf6dd] shadow-[0_0_24px_-4px_rgba(212,175,55,0.55)] ring-2 ring-[#D4AF37]/55 ring-offset-2 ring-offset-[#070a10] font-serif">
                {immersiveInitials(selfName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-base font-semibold text-[#D4AF37] md:text-lg">{selfName}</p>
                <p className="text-[10px] leading-snug text-[#D4AF37]/65">
                  {miniDisplayParticipant?.panelSubtitle || 'Votre retour caméra'}
                </p>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
              <div className="w-full max-w-[min(100%,300px)] shrink-0">
                <HostMiniPreview
                  videoRef={miniVideoRef}
                  name={selfName}
                  subtitle={miniDisplayParticipant?.panelSubtitle || ''}
                  panelLabel={miniDisplayParticipant?.panelLabel || 'Caméra locale'}
                  blur={videoBlur}
                  beauty={videoBeauty}
                  vbg={videoVbg}
                  extraFilter={videoFilterCSS}
                  chromaKey={videoChromaKey}
                  chromaColor={videoChromaColor}
                  chromaSens={videoChromaSens}
                  embedded
                  symmetricStage
                  immersiveGlass
                  onPipCanvasRef={pipCanvasRefMini}
                  privileged={Boolean(
                    currentUserId
                    && zone3PrivilegedSeats?.some((s) => String(s.userId) === String(currentUserId)),
                  )}
                />
              </div>
            </div>
            <div className="shrink-0 rounded-xl border border-[#D4AF37]/20 bg-black/35 px-2 py-2 text-center">
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#D4AF37]/80">
                Prévisualisation locale
              </p>
              <p className="mt-0.5 text-[10px] text-white/35">Même format que l'interlocuteur</p>
            </div>
          </div>
        </div>
      );
    }
    return (
    <div className={cn('relative h-full pt-9 px-1 sm:px-1.5 pb-2 flex flex-col gap-1.5 overflow-hidden min-h-0', zone3Shell)}>
      <div
        className={cn('px-2.5 py-1.5 flex items-center justify-between cursor-move', glassSub)}
        draggable
        onDragStart={() => setDragSlot('right')}
      >
        <div>
          <p className={cn(railTitle, 'text-sm')}>Zone 3 — Passif & cours</p>
          <p className={cn('text-[13px]', liriGuestLayout ? 'text-[#D4AF37]/50' : 'text-white/55')}>
            {liriGuestLayout
              ? 'Prévisualisation locale, plan du cours, script & membres'
              : 'Prévisualisation locale, plan, script, membres'}
          </p>
        </div>
        <GripVertical className="w-3.5 h-3.5 text-white/35" />
      </div>

      {/* PanelPassif — retour caméra local (invité ou hôte) */}
      <div
        className={cn('p-1.5 flex-shrink-0', glassSub)}
        onDoubleClick={() => openDevModal('host')}
        data-liri-panel={LIRI_PANEL_PASSIF}
      >
        <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 mb-1.5 text-[11px]')}>Prévisualisation locale</p>
        <div className="cursor-move" draggable onDragStart={() => setDragSlot('right')}>
          <HostMiniPreview
            videoRef={miniVideoRef}
            name={miniDisplayParticipant?.name || (hostParticipant?.name || 'Vous')}
            subtitle={miniDisplayParticipant?.panelSubtitle || ''}
            panelLabel={liriGuestLayout ? 'Notes sortant' : (miniDisplayParticipant?.panelLabel || LIRI_PANEL_PASSIF)}
            blur={videoBlur}
            beauty={videoBeauty}
            vbg={videoVbg}
            extraFilter={videoFilterCSS}
            chromaKey={videoChromaKey}
            chromaColor={videoChromaColor}
            chromaSens={videoChromaSens}
            embedded
            immersiveGlass={immersiveVideoGlass}
            onPipCanvasRef={pipCanvasRefMini}
            showLiveBadge={liveArenaMotherboardFrame && isHost}
            arenaHostGoldFrame={liveArenaMotherboardFrame && isHost}
            privileged={Boolean(
              currentUserId
              && zone3PrivilegedSeats?.some((s) => String(s.userId) === String(currentUserId)),
            )}
          />
        </div>
      </div>

      {/* Plan du cours — invité : ReadonlyCoursePlan (consultatif uniquement) */}
      <div
        className={cn('p-1.5 flex-shrink-0', glassSub)}
        onDoubleClick={() => openDevModal('plan')}
        data-readonly-course-plan={!isHost ? 'true' : undefined}
      >
        <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 mb-1.5 text-[11px]')}>Plan du cours</p>
        <div className="space-y-3 max-h-[22vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-0.5">
          {coursePlanSplit?.native && coursePlanSplit?.import ? (
            <>
              <CoursePlanRailBlock
                title="SmartBoard"
                subtitle="Slides générées / scènes IA — pas les PDF ou PowerPoint."
                slides={coursePlanSplit.native.slides}
                activeScene={activeScene}
                highlightScene="smartboard"
                activeIndex={coursePlanSplit.native.index}
                isHost={isHost}
                onPick={onPickCoursePlanSlide}
                pickKind="native"
                railTitleClass={railTitle}
              />
              <div className="h-px bg-white/[0.06] my-0.5" aria-hidden />
              <CoursePlanRailBlock
                title="Diapo importé"
                subtitle="PDF, PowerPoint ou images téléversés."
                slides={coursePlanSplit.import.slides}
                activeScene={activeScene}
                highlightScene="diapo"
                activeIndex={coursePlanSplit.import.index}
                isHost={isHost}
                onPick={onPickCoursePlanSlide}
                pickKind="import"
                railTitleClass={railTitle}
              />
            </>
          ) : (
            <>
              {slides.length === 0 && <p className="font-serif text-sm text-white/55">Aucune slide.</p>}
              {slides.map((s, idx) => {
                const active = idx === slideIndex;
                const row = (
                  <>
                    <div className="text-[10px] font-medium text-white/50">Diapositive {idx + 1}</div>
                    <div className="font-serif text-sm text-white/92 truncate leading-snug">{s?.title || s?.label || `Chapitre ${idx + 1}`}</div>
                  </>
                );
                if (!isHost) {
                  return (
                    <div
                      key={`${idx}-${s?.id || s?.title || 'slide'}`}
                      className={cn(
                        'w-full rounded-lg border px-2 py-1.5 text-left transition-colors opacity-95',
                        active ? 'border-[#D4AF37]/45 bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.03]',
                      )}
                    >
                      {row}
                    </div>
                  );
                }
                return (
                  <button
                    key={`${idx}-${s?.id || s?.title || 'slide'}`}
                    type="button"
                    onClick={() => goToSlide(idx)}
                    className={cn(
                      'w-full rounded-lg border px-2 py-1.5 text-left transition-colors',
                      active ? 'border-[#D4AF37]/45 bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]',
                    )}
                  >
                    {row}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Script & objectifs — hôte (édition) ; invité (lecture seule, aligné maquette zone 3) */}
      {(isHost || liriGuestLayout) ? (
        <div
          className={cn(
            'p-1.5 flex flex-col overflow-hidden',
            glassSub,
            isHost ? 'flex-1 min-h-0' : 'max-h-[min(34vh,340px)] shrink-0 min-h-0',
          )}
          onDoubleClick={isHost ? () => openDevModal('script') : undefined}
          data-host-only-master-script={isHost ? 'true' : undefined}
          data-liri-guest-readonly-script={liriGuestLayout && !isHost ? 'true' : undefined}
        >
          <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 mb-1.5 text-[11px]')}>Script & objectifs</p>
          <div className="space-y-2 overflow-y-auto flex-1 min-h-0 [scrollbar-width:thin] pr-0.5">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
              <p className="text-[10px] font-medium text-white/50 mb-1">Objectif principal</p>
              <p className="font-serif text-sm leading-relaxed text-white/90">
                {scriptObjective
                  || (liriGuestLayout
                    ? 'L\u2019objectif sera affiché ici lorsque l\u2019hôte l\u2019aura défini.'
                    : 'Définir un objectif clair pour cette session.')}
              </p>
            </div>
            {scriptSections?.slice(0, 8).map((sec, i) => {
              const canNav =
                Boolean(isHost && onMasterScriptNavigateToSlide && sec.slide_index != null && Number(sec.slide_index) >= 0);
              const inner = (
                <>
                  <p className="text-[10px] font-medium text-white/50 mb-1 flex items-center gap-1.5 flex-wrap">
                    <span>
                      Section {i + 1} — {sec.title || sec.name || 'Bloc'}
                    </span>
                    {sec.slide_index != null ? (
                      <span className="rounded bg-[#D4AF37]/15 px-1 py-0.5 text-[8px] font-bold text-[#D4AF37] tabular-nums">
                        Slide {Number(sec.slide_index) + 1}
                      </span>
                    ) : null}
                    {canNav ? (
                      <span className="text-[8px] font-normal text-sky-300/80">· ouvrir sur l&apos;écran</span>
                    ) : null}
                  </p>
                  <p className="font-serif text-sm leading-relaxed text-white/88 whitespace-pre-wrap line-clamp-[10]">
                    {sec.content || sec.script || sec.objective || sec.description || sec.title || sec.name || '—'}
                  </p>
                </>
              );
              if (canNav) {
                return (
                  <button
                    key={sec.id || i}
                    type="button"
                    onClick={() => onMasterScriptNavigateToSlide(Number(sec.slide_index))}
                    className={cn(
                      'w-full rounded-lg border p-2.5 transition-colors text-left',
                      scriptCurrentSection?.id === sec.id
                        ? 'border-[#D4AF37]/40 bg-[#D4AF37]/8 hover:bg-[#D4AF37]/12'
                        : 'border-white/10 bg-white/[0.03] hover:border-sky-500/30 hover:bg-sky-500/08',
                    )}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <div
                  key={sec.id || i}
                  className={cn(
                    'rounded-lg border p-2.5 transition-colors',
                    scriptCurrentSection?.id === sec.id
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/8'
                      : 'border-white/10 bg-white/[0.03]',
                  )}
                >
                  {inner}
                </div>
              );
            })}
            <div className="rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/8 p-2.5">
              <p className="text-[10px] text-[#f5dd8a] mb-1 flex items-center gap-1 font-medium"><BookOpen className="w-3 h-3" />Rétention</p>
              {retentionHints.length > 0 ? (
                <ul className="space-y-1.5">
                  {retentionHints.map((h, i) => (
                    <li key={h.id || i} className="font-serif text-sm text-white/90 leading-relaxed">
                      {h.retention || h.memorization_tip}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-serif text-sm text-white/80 leading-relaxed">
                  {isHost
                    ? 'Ajoutez des rappels et points d&apos;ancrage dans le script.'
                    : 'Les points de rétention partagés par l\u2019hôte apparaîtront ici.'}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Membres connectés — cartes → modal ; vue grille séparée */}
      <div className={cn('p-1.5 flex flex-col', glassSub, isHost ? 'flex-shrink-0' : 'flex-1 min-h-0')}>
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <p className={cn(railTitle, 'uppercase tracking-wide text-white/70 text-[11px]')}>Membres connectés</p>
          <button
            type="button"
            onClick={() => setMembersOverviewOpen(true)}
            className="h-7 px-2 rounded-lg border border-white/12 bg-white/[0.04] hover:bg-[#D4AF37]/12 hover:border-[#D4AF37]/30 text-[9px] text-white/75 flex items-center gap-1 flex-shrink-0"
            title="Vue grille des membres"
          >
            <Users className="w-3 h-3 text-[#D4AF37]/90" />
            <span className="tabular-nums">{stripMembers.length}</span>
          </button>
        </div>
        <div className={cn('grid grid-cols-2 gap-1.5 overflow-y-auto [scrollbar-width:thin]', isHost ? 'max-h-[28vh]' : 'flex-1 min-h-0')}>
          {stripMembers.map((m) => {
            const initials = (m.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
            const uid = String(m.userId || '');
            return (
              <button
                key={uid || m.name}
                type="button"
                onClick={() => setMemberPreview({
                  id: uid,
                  name: m.name,
                  isLocal: Boolean(currentUserId && uid === String(currentUserId)),
                })}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-1.5 min-w-0 text-left hover:border-[#D4AF37]/35 hover:bg-[#D4AF37]/8 transition-colors"
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="h-9 w-9 rounded-lg object-cover flex-shrink-0 border border-white/10" />
                ) : (
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#D4AF37]/28 to-[#1a2540] flex items-center justify-center text-[10px] font-bold text-[#D4AF37] flex-shrink-0 border border-white/10">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-white/90 truncate leading-tight">{m.name}</p>
                  <p className="text-[9px] text-emerald-400/80 truncate">{m.role || 'connecté'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {liriGuestLayout ? (
        <button
          type="button"
          onClick={() => setMembersOverviewOpen(true)}
          className="h-11 w-full shrink-0 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/12 hover:bg-[#D4AF37]/18 text-[11px] font-semibold uppercase tracking-wide text-[#f5dd8a] transition-colors"
        >
          Membre(s) connecté(s)
        </button>
      ) : null}

      <MembersOverviewPanel
        open={membersOverviewOpen}
        onClose={() => setMembersOverviewOpen(false)}
        members={stripMembers}
        onSelectMember={(m) => {
          setMembersOverviewOpen(false);
          setMemberPreview({
            id: String(m.userId || m.id || ''),
            name: m.name,
            isLocal: Boolean(currentUserId && String(m.userId || m.id) === String(currentUserId)),
          });
        }}
      />
    </div>
    );
  };

  const renderByZone = {
    zone1: renderZone1,
    zone2: renderZone2,
    zone3: renderZone3,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 z-30"
    >
      <ImmersiveLiveStageBackdrop
        parallax={parallax}
        variant={liriArenaDesktopChrome ? 'liriHost' : immersiveBackdropVariant}
      />

      <div className={cn('relative h-full w-full overflow-hidden', IMMERSIVE_STAGE.maxTheatreWidthClass)}>
        {/* ── Top overlay — auto-masqué, visible au survol ou si reconnexion ── */}
        <div className={cn(
          'absolute top-0 left-0 right-0 z-50 flex items-center gap-2 px-2 py-1.5 pointer-events-none',
          'opacity-0 hover:opacity-100 transition-opacity duration-300',
          isReconnecting && 'opacity-100',
        )}>
          <div className="pointer-events-auto flex items-center gap-1.5">
            {/* Statut live */}
            <div className={cn(
              'h-6 px-2.5 rounded-full border text-[10px] font-semibold flex items-center gap-1.5',
              isReconnecting
                ? 'bg-amber-500/30 border-amber-400/45 text-amber-200'
                : 'bg-black/60 border-white/12 text-white/70'
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', isReconnecting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse')} />
              {isReconnecting ? 'Reconnexion…' : 'LIRI Live'}
            </div>

            {!liriHostLockedDesktop ? (
              <button
                type="button"
                onClick={() => setZone3Open((v) => !v)}
                className={cn(
                  'h-6 w-6 rounded-full border flex items-center justify-center transition-colors',
                  zone3Open ? 'border-[#D4AF37]/45 bg-[#D4AF37]/14 text-[#f5dd8a]' : 'border-white/12 bg-black/55 text-white/60 hover:text-white'
                )}
                title="Panneau interactif"
              >
                <PanelRight className="w-3 h-3" />
              </button>
            ) : null}

          </div>
        </div>

        <AnimatePresence>
          {devModal.open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] bg-black/70"
              onClick={closeDevModal}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 18 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(94vw,900px)] max-h-[82vh] rounded-3xl border border-white/[0.12] bg-[#0c1018]/95 shadow-[0_40px_120px_-36px_rgba(0,0,0,0.9)] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-14 px-5 border-b border-white/14 bg-white/[0.05] flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/92 font-semibold">
                      {DEV_CONFIG[devModal.key]?.title || 'Component'}
                    </p>
                    <p className="text-[11px] text-white/55">{DEV_CONFIG[devModal.key]?.desc || 'Preview etat developpement'}</p>
                  </div>
                  <button type="button" onClick={closeDevModal} className="h-9 w-9 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-white/70 flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[calc(82vh-56px)]">
                  <div className="rounded-2xl border border-white/15 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-wide text-white/55 mb-3">Miniature developpee</p>
                    <div className="rounded-xl border border-white/15 bg-black/20 p-3 min-h-[180px]">
                      <p className="text-[12px] text-white/90 mb-2">Etat live</p>
                      <div className="space-y-1.5 text-[11px] text-white/70">
                        <p>Scene: <span className="text-[#D4AF37]">{activeScene}</span></p>
                        <p>Slides: <span className="text-[#D4AF37]">{slideIndex + 1}/{totalSlides}</span></p>
                        <p>Membres: <span className="text-[#D4AF37]">{participants.length}</span></p>
                        <p>Mains levees: <span className="text-[#D4AF37]">{zone3RaisedHands.length}</span></p>
                        <p>QA pending: <span className="text-[#D4AF37]">{neuronqPendingCount}</span></p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-wide text-white/55 mb-3">Contenu et ergonomie</p>
                    <div className="space-y-2">
                      <div className="rounded-xl border border-white/12 bg-white/[0.04] p-3">
                        <p className="text-[12px] text-white/85 mb-1">Objectif UX</p>
                        <p className="text-[11px] text-white/65">Lecture immediate, controle premium, interaction fluide.</p>
                      </div>
                      <div className="rounded-xl border border-white/12 bg-white/[0.04] p-3">
                        <p className="text-[12px] text-white/85 mb-1">Animation</p>
                        <p className="text-[11px] text-white/65">Transition scene/slide spring + fade, feedback audio subtil.</p>
                      </div>
                      <div className="rounded-xl border border-white/12 bg-white/[0.04] p-3">
                        <p className="text-[12px] text-white/85 mb-1">Actions dev</p>
                        <p className="text-[11px] text-white/65">Double-clic panneaux, presets layout, resize, drag & swap.</p>
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2 rounded-2xl border border-[#D4AF37]/28 bg-[#D4AF37]/10 p-4 flex items-center justify-between">
                    <div className="text-[11px] text-white/82">
                      Mode immersion: composant isole en modal avec arriere-plan floute, pour revue detaillee en developpement.
                    </div>
                    <button type="button" onClick={closeDevModal} className="h-9 px-3 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/16 text-[#f5dd8a] text-[11px] flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5" />
                      Fermer preview
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {liriMobileMaquette ? (
          <LiriMobileMaquetteLayout
            mainVideoRef={mainVideoRef}
            mainDisplayParticipant={mainDisplayParticipant}
            remoteWaiting={remoteWaiting}
            videoBlur={videoBlur}
            videoBeauty={videoBeauty}
            videoVbg={videoVbg}
            videoChromaKey={videoChromaKey}
            videoChromaColor={videoChromaColor}
            videoChromaSens={videoChromaSens}
            pipCanvasRefMain={pipCanvasRefMain}
            miniVideoRef={miniVideoRef}
            miniDisplayParticipant={miniDisplayParticipant}
            hostParticipant={hostParticipant}
            pipCanvasRefMini={pipCanvasRefMini}
            videoFilterCSS={videoFilterCSS}
            compositorSlide={compositorSlide}
            slideIndex={slideIndex}
            totalSlides={totalSlides}
            coursePlanSplit={coursePlanSplit}
            activeScene={activeScene}
            scriptSections={scriptSections}
            scriptCurrentSection={scriptCurrentSection}
            promotedParticipantId={promotedParticipantId}
            zone3PrivilegedSeats={zone3PrivilegedSeats}
            currentUserId={currentUserId}
            connectionQuality={connectionQuality}
            isReconnecting={isReconnecting}
            onSwapVideoLayout={onSwapVideoLayout}
            slideAreaRef={slideAreaRef}
            smartboardFull={liriMobileSmartboardFull}
            smartBoardChildren={renderFtfSmartBoardCompositor()}
            hostNotificationsRail={isHost ? renderArenaNotificationsRail() : null}
            messageDrawer={(
              <div className="flex h-[min(11rem,30vh)] min-h-[6rem] max-h-[34vh] shrink-0 flex-col overflow-hidden">
                <LiveMessageDrawer
                  variant="inline"
                  immersiveArena
                  open
                  messages={drawerMessages}
                  currentUserId={currentUserId}
                  onClose={onToggleDrawer}
                  onSendForumMessage={onSendForumMessage}
                  forumSending={forumSending}
                />
              </div>
            )}
          />
        ) : (
        <div
          ref={layoutRef}
          className={cn(
            'absolute inset-x-0 top-0 flex items-stretch',
            messagingImmersiveFaceToFace
              ? 'gap-2 px-2 sm:gap-3 sm:px-3 md:px-4'
              : liriArenaDesktopChrome
                ? cn(LIRI_HOST_SHELL_PAD)
                : 'gap-0',
            cinemaMode ? 'bottom-0' : messagingImmersiveFaceToFace ? 'bottom-[52px]' : 'bottom-[64px]',
          )}
        >
          {liriHostLockedDesktop ? (
            <div
              className="pointer-events-auto absolute z-[34] pt-9"
              style={{
                left: `calc(${colSizes.left}% + 4px)`,
                width: `calc(${colSizes.center + colSizes.right}% - 8px)`,
              }}
            >
              <div className="shadow-[0_0_40px_-14px_rgba(124,58,237,0.35),0_0_28px_-12px_rgba(251,191,36,0.15)]">
                <div className={cn(LIRI_HOST_MEMBERS_DOCK, 'backdrop-blur-xl')}>
                  <LiriHostCenterSeatStrip
                    embedded
                    participants={participants}
                    remoteParticipants={participants.filter((p) => !p.isLocal)}
                    liveKitRoomRef={liveKitRoomRef}
                    promoted={promoted}
                    canPromoteStrip={liriHostSeatStripCanPromote}
                    onPromoteParticipant={onPromoteParticipant}
                    onOpenMemberPreview={
                      stripOpensMemberPreview ? (mp) => setMemberPreview(mp) : undefined
                    }
                    onOpenMembersOverflow={() => setMembersOpen(true)}
                  />
                </div>
              </div>
            </div>
          ) : null}
          {(['left', 'center', 'right']).map((slot) => (
            <div
              key={slot}
              style={{
                width: cinemaMode
                  ? (slot === 'center' ? '100%' : '0%')
                  : `${colSizes[slot]}%`,
              }}
              className="h-full min-h-0 transition-[width] duration-300 overflow-hidden"
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => setDragOverSlot(slot)}
              onDragLeave={() => setDragOverSlot((prev) => (prev === slot ? null : prev))}
              onDrop={() => {
                if (!dragSlot) return;
                swapZoneSlots(dragSlot, slot);
                setDragSlot(null);
                setDragOverSlot(null);
              }}
            >
              {dragOverSlot === slot && dragSlot && dragSlot !== slot && (
                <div className="absolute inset-0 rounded-2xl border border-dashed border-[#D4AF37]/35 bg-[#D4AF37]/5 pointer-events-none z-20" />
              )}
              {renderByZone[zoneSlots[slot]]?.()}
            </div>
          ))}

          <button
            type="button"
            onMouseDown={() => setResizing('left')}
            className={cn(
              'absolute left-[22%] top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-1 rounded-full transition-all opacity-0 hover:opacity-100',
              resizing === 'left'
                ? 'bg-[#D4AF37]/70 opacity-100'
                : 'bg-white/20'
            )}
            style={{ left: `${colSizes.left}%` }}
            aria-label="Resize left and center zones"
          />
          <button
            type="button"
            onMouseDown={() => setResizing('right')}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-1 rounded-full transition-all opacity-0 hover:opacity-100',
              resizing === 'right'
                ? 'bg-[#D4AF37]/70 opacity-100'
                : 'bg-white/20'
            )}
            style={{ left: `${colSizes.left + colSizes.center}%` }}
            aria-label="Resize center and right zones"
          />
        </div>
        )}

        {/* ── MEMBERS PANEL — anchored below top bar, right side ── */}
        <MembersPanel
          open={membersOpen}
          participants={participants}
          activeId={promoted?.id}
          onPromote={onPromoteParticipant}
          onClose={() => setMembersOpen(false)}
          readOnly={!isHost}
          sheetLayout={narrowLiveViewport && !liriMobileMaquette}
        />

        {/* ── ZONE 3 PANEL — masqué en vue hôte verrouillée (membres via barre d'actions) ── */}
        {!liriHostLockedDesktop ? (
          <Zone3Panel
            open={zone3Open}
            onClose={() => setZone3Open(false)}
            mobileLayout={Boolean(liriMobileMaquette)}
            members={zone3Members}
            raisedHands={zone3RaisedHands}
            onLowerHand={onZone3LowerHand}
            privilegedSeats={zone3PrivilegedSeats}
            onGrantSeat={onZone3GrantSeat}
            onRevokeSeat={onZone3RevokeSeat}
            currentUserId={currentUserId}
            isHost={isHost}
            onRaiseHand={onZone3RaiseHand}
            myHandRaised={zone3MyHandRaised}
            neuronqEnabled={showNeuronq}
            questions={neuronqQuestions}
            onMarkAnswered={onNeuronqMarkAnswered}
            onMarkSkipped={onNeuronqMarkSkipped}
            qaMode={neuronqQaMode}
            onToggleQaMode={onNeuronqToggleQa}
            scriptSections={scriptSections}
            scriptCurrentSection={scriptCurrentSection}
            scriptLoading={scriptLoading}
            scriptImproving={scriptImproving}
            onScriptAdd={onScriptAdd}
            onScriptUpdate={onScriptUpdate}
            onScriptDelete={onScriptDelete}
            onScriptMove={onScriptMove}
            onScriptImprove={onScriptImprove}
            totalSlides={totalSlides}
          />
        ) : null}

        {/* ── NEURON-Q modal (élève) ── */}
        {showNeuronq ? (
          <NeuronQStudentModal
            open={neuronqModalOpen}
            onClose={() => setNeuronqModalOpen(false)}
            onSubmit={onNeuronqSubmit}
            onReformulate={onNeuronqReformulate}
            reformulating={neuronqReformulating}
            submitting={neuronqSubmitting}
            variant={liriMobileMaquette ? 'sheet' : 'floating'}
          />
        ) : null}

        {/* ── Q&A overlay plein écran (hôte) ── */}
        <AnimatePresence>
          {showNeuronq && neuronqQaMode && (
            <QAModeOverlay
              questions={neuronqQuestions}
              onMarkAnswered={onNeuronqMarkAnswered}
              onMarkSkipped={onNeuronqMarkSkipped}
              onClose={onNeuronqToggleQa}
            />
          )}
        </AnimatePresence>

        <MemberVideoModal
          open={Boolean(memberPreview)}
          onClose={() => setMemberPreview(null)}
          roomRef={liveKitRoomRef}
          participant={memberPreview}
          presenceMeta={memberPreview
            ? zone3Members.find((m) => String(m.userId) === String(memberPreview.id))
            : null}
          isHost={isHost}
          onPromoteToStage={isHost ? onPromoteParticipant : undefined}
          isPromoted={Boolean(
            memberPreview && promotedParticipantId && String(promotedParticipantId) === String(memberPreview.id),
          )}
          whisperSessionKey={liveWhisperSessionKey}
          currentUserId={currentUserId}
          whisperMessages={
            memberPreview?.id
              ? (whisperThreads[String(memberPreview.id)] || [])
              : []
          }
          onSendWhisper={(text) => {
            if (!memberPreview?.id) return;
            void (async () => {
              const r = await sendWhisper(String(memberPreview.id), text);
              if (r && !r.ok && r.error) {
                toast({
                  title: 'Message privé',
                  description: String(r.error.message || r.error),
                  variant: 'destructive',
                });
              }
            })();
          }}
          whisperPickableMembers={connectedMembers}
          onPickWhisperMember={(p) => setMemberPreview(p)}
          whisperHasBackgroundUnread={
            Boolean(memberPreview)
            && Object.keys(whisperUnreadPeers).some((k) => String(k) !== String(memberPreview.id))
          }
          viewport={liriMobileMaquette ? 'viewport' : 'embedded'}
        />

        {/* ── NEURON-Q bouton flottant (invité) — masqué si le parent fournit le dock messagerie ── */}
        {showNeuronq && !isHost && !neuronqStudentModalControlled ? (
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 z-40 px-2 max-w-[96vw]',
              liriMobileMaquette
                ? 'bottom-[max(6.25rem,calc(env(safe-area-inset-bottom)+5.25rem))]'
                : 'bottom-[108px]',
            )}
          >
            <NeuronQButton
              onClick={() => setNeuronqModalOpen(true)}
              pendingOwnCount={0}
              className="w-full sm:w-auto"
            />
          </div>
        ) : null}

        <SpotlightLayer active={spotlight} />

        <AmbientAudioLayer tracks={ambientTracks} enabled={active && ambientAudioEnabled} />

        {active &&
        liriAudioMicAutoDuck &&
        Array.isArray(liriAudioScenes) &&
        liriAudioScenes.length > 0 ? (
          <LiriAudioMicDuckBridge active={active} muted={muted} />
        ) : null}

        {active &&
        liriAudioVisualOverlay &&
        (Array.isArray(liriAudioScenes) && liriAudioScenes.length > 0
          || liriAudioRemoteSmartboardPayload !== undefined) ? (
          <LiriAudioSceneOverlay
            enabled
            remotePayload={liriAudioRemoteSmartboardPayload}
            remoteSceneName={liriAudioRemoteSceneName}
          />
        ) : null}

        {active && showLiriAudioScenePanel && Array.isArray(liriAudioScenes) && liriAudioScenes.length > 0 ? (
          <div className="pointer-events-auto absolute bottom-[200px] right-4 z-[26] w-[min(92vw,360px)] max-h-[min(52vh,420px)] overflow-y-auto">
            <AudioScenePanel
              scenes={liriAudioScenes}
              defaultCollapsed
              initialSceneIndex={liriAudioInitialSceneIndex}
              sessionKey={liriAudioSessionKey}
              onSceneIndexChange={onLiriAudioSceneIndexChange}
            />
          </div>
        ) : null}

        {/* ── CHAT DRAWER — latéral sauf FTF web ou maquette mobile (chat inline dans LiriMobileMaquetteLayout) ── */}
        {!messagingImmersiveFaceToFace && !liriMobileMaquette ? (
          <LiveMessageDrawer
            open={drawerOpen}
            messages={drawerMessages}
            currentUserId={currentUserId}
            onClose={onToggleDrawer}
            onSendForumMessage={onSendForumMessage}
            forumSending={forumSending}
            drawerLayout={narrowLiveViewport ? 'sheet' : 'side'}
          />
        ) : null}

        {/* Halo bas — lumière douce type studio (ne capte pas les clics) */}
        {!liriMobileMaquette ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-[min(38vh,320px)]"
          aria-hidden
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#D4AF37]/[0.14] via-indigo-500/[0.06] to-transparent" />
          <div className="absolute left-1/2 bottom-0 h-[min(28vh,240px)] w-[min(120%,720px)] -translate-x-1/2 translate-y-1/3 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14)_0%,rgba(212,175,55,0.12)_40%,transparent_68%)] blur-[1px]" />
        </div>
        ) : null}

        {/* ActionsMenu is rendered in MessagingPage's bottom bar area */}

      </div>
    </motion.div>
  );
}
