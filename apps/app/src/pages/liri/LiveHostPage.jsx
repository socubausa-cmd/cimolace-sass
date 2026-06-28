import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDock } from '@/features/live/hooks/useDock';
import { useLiveDuration } from '@/features/live/hooks/useLiveDuration';
import { useLiveRemainingSeconds } from '@/features/live/hooks/useLiveRemainingSeconds';
import { useLiriEntitlements } from '@/hooks/useLiriEntitlements';
import { useLiveHostSessionRoute } from '@/features/live/hooks/useLiveHostSessionRoute';
import { useLiveHostViewportBreakpoints } from '@/features/live/hooks/useLiveHostViewportBreakpoints';
import { useLiveHostLiveMediaCheck } from '@/features/live/hooks/useLiveHostLiveMediaCheck';
import { useLiveHostDocumentTitle } from '@/features/live/hooks/useLiveHostDocumentTitle';
import { useLiveHostEleveAppChatUrl } from '@/features/live/hooks/useLiveHostEleveAppChatUrl';
import { useLiveHostNeuronqQuestions } from '@/features/live/hooks/useLiveHostNeuronqQuestions';
import { useLiveHostGuestNeuronqActions } from '@/features/live/hooks/useLiveHostGuestNeuronqActions';
import { useLiveHostDebateArena } from '@/features/live/hooks/useLiveHostDebateArena';
import { useLiveHostSessionChat } from '@/features/live/hooks/useLiveHostSessionChat';
import { useLiveHostWaitingRoom } from '@/features/live/hooks/useLiveHostWaitingRoom';
import { useLiveHostParticipantModeration } from '@/features/live/hooks/useLiveHostParticipantModeration';
import { useLiveHostRecording } from '@/features/live/hooks/useLiveHostRecording';
import { useLiveHostLiveScenesRealtime } from '@/features/live/hooks/useLiveHostLiveScenesRealtime';
import { useLiveHostLiveSessionMetaRealtime } from '@/features/live/hooks/useLiveHostLiveSessionMetaRealtime';
import { useLiveHostSmartboardBroadcastChannel } from '@/features/live/hooks/useLiveHostSmartboardBroadcastChannel';
import {
  useLiveHostLongiaBusGuestRealtime,
  useLiveHostLongiaBusHostRealtime,
} from '@/features/live/hooks/useLiveHostLongiaBusRealtime';
import { useLiveHostLiveKitParticipantList } from '@/features/live/hooks/useLiveHostLiveKitParticipantList';
import { useLiveHostLiveSessionSignalsRealtime } from '@/features/live/hooks/useLiveHostLiveSessionSignalsRealtime';
import { useLiveHostMediaControls } from '@/features/live/hooks/useLiveHostMediaControls';
import { useLiveHostProctor } from '@/features/live/hooks/useLiveHostProctor';
import { useLiveHostGuestSessionConfigRealtime } from '@/features/live/hooks/useLiveHostGuestSessionConfigRealtime';
import { useLiveHostLiveKitParticipantMaps } from '@/features/live/hooks/useLiveHostLiveKitParticipantMaps';
import { useLiveHostGuestResyncSmartboardFromDb } from '@/features/live/hooks/useLiveHostGuestResyncSmartboardFromDb';
import { useLiveHostLongiaDecisionEngine } from '@/features/live/hooks/useLiveHostLongiaDecisionEngine';
import { useLiveHostControlMesh } from '@/features/live/hooks/useLiveHostControlMesh';
import { useLiveHostStudioSettings } from '@/features/live/hooks/useLiveHostStudioSettings';
import { useLiveHostSessionStop } from '@/features/live/hooks/useLiveHostSessionStop';
import { useLiveHostSignalResolution } from '@/features/live/hooks/useLiveHostSignalResolution';
import { useLiveHostConfigActions } from '@/features/live/hooks/useLiveHostConfigActions';
import { useLiveHostMeshScheduler } from '@/features/live/hooks/useLiveHostMeshScheduler';
import { useLiveHostArenaLayout } from '@/features/live/hooks/useLiveHostArenaLayout';
import { useLiveHostMultilangSettings } from '@/features/live/hooks/useLiveHostMultilangSettings';
import { useLiveHostZone3 } from '@/features/live/hooks/useLiveHostZone3';
import { useLiveHostGuestPeers } from '@/features/live/hooks/useLiveHostGuestPeers';
import { useLiveHostLongiaHubNav } from '@/features/live/hooks/useLiveHostLongiaHubNav';
import { useLiveHostPanelCallbacks } from '@/features/live/hooks/useLiveHostPanelCallbacks';
import { useLiveHostMasterScriptNav } from '@/features/live/hooks/useLiveHostMasterScriptNav';
import { useLiveHostLongiaBusCallbacks } from '@/features/live/hooks/useLiveHostLongiaBusCallbacks';
import { useLiveHostLegacyEffects } from '@/features/live/hooks/useLiveHostLegacyEffects';
import { useLiveHostAudioContextInit } from '@/features/live/hooks/useLiveHostAudioContextInit';
import { useLiveHostAntennaFeed } from '@/features/live/hooks/useLiveHostAntennaFeed';
import { useLiveHostGuestProctorConsent } from '@/features/live/hooks/useLiveHostGuestProctorConsent';
import { useLiveHostMaquetteDisplay } from '@/features/live/hooks/useLiveHostMaquetteDisplay';
import { useLiveHostVideoFrames } from '@/features/live/hooks/useLiveHostVideoFrames';
import { useLiveHostLiriAudioSync } from '@/features/live/hooks/useLiveHostLiriAudioSync';
import { useLiveHostLiveGridLayout } from '@/features/live/hooks/useLiveHostLiveGridLayout';
import { useLiveHostGuestMeshPerms } from '@/features/live/hooks/useLiveHostGuestMeshPerms';
import { useLiveHostGuestCommFlags } from '@/features/live/hooks/useLiveHostGuestCommFlags';
import { useLiveHostSignalPanelPreviews } from '@/features/live/hooks/useLiveHostSignalPanelPreviews';
import { useLiveHostMobileCameraLink } from '@/features/live/hooks/useLiveHostMobileCameraLink';
import { LiveHostLiveGridShell } from '@/features/live/host/components/LiveHostLiveGridShell';
import { LiveHostLiveSessionChrome } from '@/features/live/host/components/LiveHostLiveSessionChrome';
import LiveHostSmartBoardStage from '@/components/liri/live-room/LiveHostSmartBoardStage';
import {
  buildLiveHostGridShellSpreadProps,
  buildLiveHostLiveCenterColumnSpreadProps,
  buildLiveHostLongiaSignalHubSpreadProps,
  buildLiveHostPostGridSlotsSpreadPropsWithoutHub,
  buildLiveHostPreviewOverlaysSpreadProps,
} from '@/features/live/host/liveHostPhaseLiveSpreadProps';
import {
  computeLongiaHubPushesLayout,
} from '@/features/live/host/liveHostLiveLayoutFlags';
import {
  LiveHostEndedScreen,
  LiveHostInvalidSessionScreen,
  LiveHostLoadingScreen,
} from '@/features/live/host/components/LiveHostPhaseScreens';
import { LiveHostPreviewOverlays } from '@/features/live/host/components/LiveHostPreviewOverlays';
import { LiveHostLongiaSignalHub } from '@/features/live/host/components/LiveHostLongiaSignalHub';
import { LiveHostLiveCenterColumn } from '@/features/live/host/components/LiveHostLiveCenterColumn';
import { LiveHostLivePostGridSlots } from '@/features/live/host/components/LiveHostLivePostGridSlots';
import { ETAPES_FALLBACK } from '@/features/live/host/liveSmartboardLegacySlides';
import { LiveHostMobileShell } from '@/features/live/host/mobile/LiveHostMobileShell';
import {
  LH_DESIGN,
  LH_GUEST_OVERRIDES,
  LIRI_LIVE_UI_LABEL,
} from '@/features/live/host/liveHostTheme';
import { useLiveHostGlobalStyles } from '@/features/live/host/hooks/useLiveHostGlobalStyles';
import {
  LH_HOST_RIGHT_VIDEO_FRAME_REST_H_PX,
  LONGIA_HOST_HUB_DRAWER_W_PX,
  PHASE,
} from '@/features/live/host/liveHostConstants';
import { runLiveHostSessionAndLiveKitInit } from '@/features/live/host/liveHostSessionAndLiveKitInit';
import {
  formatTimer,
  nt,
  setLiriLiveKitDomError,
  setLiriLiveKitDomFlag,
} from '@/features/live/host/liveHostUtils';
import { supabase } from '@/lib/customSupabaseClient';
import { useLiveSessionRealtime } from '@/hooks/useLiveSessionRealtime';
import { useLiveSessionWhispers } from '@/hooks/useLiveSessionWhispers';
import { mergeSmartboardSceneFlags } from '@/lib/smartboardNavigatorScenes';
import { ARENA_LAYOUT } from '@/lib/liriArenaLayout';
import { getProfile } from '@/lib/liriControlMesh/profiles';
import { buildGrantFromRequest, DEFAULT_MESH_GRANT_MS, MESH_GRANT_DURATION_PRESETS } from '@/lib/liriControlMesh/meshTransfer';
import {
  serializeGuestPermissions,
  GUEST_CAPABILITIES_DEFAULTS,
  useGuestCapabilities,
} from '@/hooks/useGuestCapabilities';
import { useLiriLivePermissionsContextOptional } from '@/components/liri/liri-live/LiriLivePermissionsContext';
import { useLiveHostLiriMaquetteVideoSync } from '@/hooks/useLiveHostLiriMaquetteVideoSync';
import { useLiveAsideChannel } from '@/hooks/useLiveAsideChannel';
import { useHostAudioMonitorBus } from '@/hooks/useHostAudioMonitorBus';
import { useToast } from '@/components/ui/use-toast';
import { useNotificationSystem } from '@/contexts/NotificationContext';
import { useVideoProcessor } from '@/lib/useVideoProcessor';
import { useMicProcessor } from '@/lib/useMicProcessor';
import { loadLiriAudioSettings, saveLiriAudioSettings } from '@/lib/liriAudioEngine/storage';
import { normalizeLiriAudioScenes } from '@/lib/liriAudioScene';
import {
  DEFAULT_LONGIA_GOVERNOR_MODES,
  LONGIA_GOVERNOR_MODE,
  LONGIA_PANEL_FILTER,
} from '@/lib/longiaLiveCopilot';
import { useLongiaLiveRealtime } from '@/hooks/useLongiaLiveRealtime';

// ── Composant principal ────────────────────────────────────────────────────────
export default function LiveHostPage({ forceGuestRoute = false, joyKitSignalGrant = null }) {
  const { sessionId, sessionIdParam, coachScopeSessionId } = useLiveHostSessionRoute();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const permCtxOptional = useLiriLivePermissionsContextOptional();
  const { playSound } = useNotificationSystem();
  const {
    lhCompactViewportRaw,
    lhCompactByWidthOnly,
    lhNarrowDesktop,
    lhWebTooNarrowForThreeCols,
  } = useLiveHostViewportBreakpoints();

  // ── Mobile phone detection (< 640 px) — TikTok shell ─────────────────────
  const [isMobilePhone, setIsMobilePhone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  useEffect(() => {
    const onResize = () => setIsMobilePhone(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** Professeur (session) — pour distinguer hôte / invité sur `/live/:sessionId`. */
  const [teacherId, setTeacherId] = useState(null);
  /** Invité : overlay Liri depuis le broadcast hôte. */
  const [guestLiriAudioSmartboard, setGuestLiriAudioSmartboard] = useState(null);
  const [guestLiriAudioSceneName, setGuestLiriAudioSceneName] = useState('');

  const isInviteGuestRoute = useMemo(
    () => Boolean(
      forceGuestRoute
      || (sessionId && location.pathname === `/live/${sessionId}`)
      || (sessionId && location.pathname === `/live/invit/${sessionId}`),
    ),
    [forceGuestRoute, sessionId, location.pathname],
  );
  const isHostUser = Boolean(user?.id && teacherId != null && String(user.id) === String(teacherId));
  /** Lien d'invitation `/live/:id` et utilisateur ≠ professeur (ou chargement). */
  const isGuestUi = useMemo(() => {
    if (forceGuestRoute) return true;
    if (!isInviteGuestRoute) return false;
    if (teacherId == null) return true;
    return !isHostUser;
  }, [forceGuestRoute, isInviteGuestRoute, teacherId, isHostUser]);
  /** Host desktop: ignore forced compact preference, keep compact only by real width. */
  const lhCompactViewport = isGuestUi ? lhCompactViewportRaw : lhCompactByWidthOnly;
  const isGuestUiRef = useRef(false);
  useEffect(() => { isGuestUiRef.current = isGuestUi; }, [isGuestUi]);

  /** Shell couleur / textures : invité ≠ hôte */
  const liveShell = useMemo(
    () => (isGuestUi ? { ...LH_DESIGN, ...LH_GUEST_OVERRIDES } : LH_DESIGN),
    [isGuestUi],
  );

  const liriLiveUiLabel = useMemo(
    () => (isGuestUi ? LIRI_LIVE_UI_LABEL.guest : LIRI_LIVE_UI_LABEL.host),
    [isGuestUi],
  );

  const eleveAppChatUrl = useLiveHostEleveAppChatUrl(isGuestUi, sessionId);

  const { caps: guestCapabilityCaps } = useGuestCapabilities(sessionId, {
    enabled: Boolean(isGuestUi && sessionId),
  });

  // ── Phase & données réelles (session Supabase + LiveKit) ─────────────────
  const [phase, setPhase] = useState(PHASE.LOADING);
  const [phaseError, setPhaseError] = useState('');
  /** Vrai seulement après connexion LiveKit réussie (token + room.connect). */
  const [liveKitMediaAvailable, setLiveKitMediaAvailable] = useState(false);
  /** Invité : consentement « examen surveillé » avant connexion LiveKit ; incrémenté après acceptation pour relancer l'init. */
  const [guestProctorModalOpen, setGuestProctorModalOpen] = useState(false);
  const [guestProctorConsentVersion, setGuestProctorConsentVersion] = useState(0);

  const { liveMediaCheck, liveMediaDiagTick } = useLiveHostLiveMediaCheck(phase, location.search);
  const [sessionTitle, setSessionTitle] = useState('');
  useLiveHostDocumentTitle(liriLiveUiLabel, sessionTitle);
  /** Lien « forum formation » quand la session `live_sessions` est rattachée à une formation. */
  const [sessionFormationId, setSessionFormationId] = useState(null);
  /** Type de session live ('classe' | 'conference' | 'entretien'). 'classe' = cours/formation → mode épuré auto (smartboard dominant). */
  const [sessionType, setSessionType] = useState(null);
  const [liveEtapes, setLiveEtapes] = useState([]);
  const [liveScenes, setLiveScenes] = useState([]); // scènes SmartBoard normalisées
  const [smartboardSceneFlags, setSmartboardSceneFlags] = useState(() => mergeSmartboardSceneFlags());
  const [sbActiveScene, setSbActiveScene] = useState('smartboard');
  const [hostWbToolsRail, setHostWbToolsRail] = useState(() => ({
    strokes: [],
    pageIndex: 0,
    pageCount: 1,
  }));
  const [sharedImageGallery, setSharedImageGallery] = useState([]);
  const [sharedImageLoop, setSharedImageLoop] = useState(false);
  const [shopProducts, setShopProducts] = useState([]);
  const [liveParticipants, setLiveParticipants] = useState([]); // participants LiveKit
  /** Participant distant « à l'antenne » (identité LiveKit) — aligné LiveArenaPage / shell OBS. */
  const [promotedId, setPromotedId] = useState(null);
  /** true = grand cadre sur l'hôte uniquement (antenne « libérée »), sans auto-assigner le premier distant. */
  const [antennaSoloMode, setAntennaSoloMode] = useState(false);
  const antennaSoloModeRef = useRef(false);
  useEffect(() => { antennaSoloModeRef.current = antennaSoloMode; }, [antennaSoloMode]);
  const [startedAt, setStartedAt] = useState(null);
  const liveDuration = useLiveDuration(startedAt);
  // Palier gratuit : compte à rebours 3 min (le serveur cape déjà le token LiveKit ;
  // ceci le rend visible + termine proprement à 0). null si payant/essai (illimité).
  const { isFree: isFreeTier, limits: liriLimits } = useLiriEntitlements();
  const freeTierRemainingSeconds = useLiveRemainingSeconds(startedAt, isFreeTier ? liriLimits?.maxLiveMinutes : null);
  const freeTierEndedRef = useRef(false);
  const roomRef = useRef(null);
  /** Invité : la caméra a été forcée par le formateur (contourne la coupure « vidéo participants » le temps du contrôle). */
  const guestHostCameraUnlockRef = useRef(false);
  /** Invité : rafraîchir le journal perso des commandes caméra (assigné après définition du fetch). */
  const guestProctorOwnRefreshRef = useRef(() => {});
  const smartboardChRef = useRef(null);  // canal SmartBoard sync
  /** @type {React.MutableRefObject<'smartboard'|'host_camera'|'guest_focus'>} */
  const arenaLayoutModeRef = useRef(ARENA_LAYOUT.SMARTBOARD);
  /** Hôte : identité LiveKit de l'invité en focus (payload smartboard / arena_layout). */
  const arenaGuestFocusUserIdRef = useRef(null);
  /** Hôte : jusqu'à 4 identités pour le mode Panel. */
  const arenaPanelUserIdsRef = useRef(/** @type {string[]} */ ([]));
  const smartBoardStageRef = useRef(null);
  const onHostWhiteboardToolsRailSync = useCallback((payload) => {
    if (!payload || typeof payload !== 'object') return;
    setHostWbToolsRail({
      strokes: Array.isArray(payload.strokes) ? payload.strokes : [],
      pageIndex: typeof payload.pageIndex === 'number' ? payload.pageIndex : 0,
      pageCount: typeof payload.pageCount === 'number' ? Math.max(1, payload.pageCount) : 1,
    });
  }, []);
  const hostBoardRightRailTools = phase === PHASE.LIVE && !isGuestUi && sbActiveScene === 'board';
  const hostWhiteboardPagingForRail = useMemo(
    () => ({
      pageIndex: hostWbToolsRail.pageIndex,
      pageCount: Math.max(1, hostWbToolsRail.pageCount),
      onPrev: () => smartBoardStageRef.current?.goWhiteboardPrevPage?.(),
      onNext: () => smartBoardStageRef.current?.goWhiteboardNextPage?.(),
      onAdd: () => smartBoardStageRef.current?.addWhiteboardPage?.(),
      onRemove: () => smartBoardStageRef.current?.removeWhiteboardPage?.(),
    }),
    [hostWbToolsRail.pageIndex, hostWbToolsRail.pageCount],
  );
  /** Invité : canal `live-smartboard-${sessionId}` pour émettre des demandes Control Mesh. */
  const guestSmartboardBroadcastRef = useRef(null);
  /** Invité avec JoyKit actif : ignore la synchro diapo hôte pour permettre la passation. */
  const guestJoyKitDriveRef = useRef(false);
  /** Hôte : timeouts d'expiration par userId. */
  const meshHostExpiryTimersRef = useRef(new Map());
  /** Hôte : grants restaurés depuis config — planifier les expirations après mount. */
  const pendingMeshRestoreRef = useRef(null);
  const sharingScreenRef = useRef(false);
  const resyncSmartboardRef = useRef(() => {});
  /** Invité spectateur : resync diapo depuis live_sessions.config (équivalent « état courant » LiveArena). */
  const guestResyncSmartboardFromDbRef = useRef(() => {});
  const [liveKitScreenEpoch, setLiveKitScreenEpoch] = useState(0);
  const stepRef = useRef(0);             // step courant (ref pour callbacks)
  const hostSfxCtxRef = useRef(null);
  const hostSfxArmedRef = useRef(false);
  const prevWaitingIdsRef = useRef(new Set());
  const stepPersistTimerRef = useRef(null);
  const progressivePersistTimerRef = useRef(null);
  const arenaLayoutPersistTimerRef = useRef(null);
  const liveDisconnectTimerRef = useRef(null);
  const phaseRef = useRef(PHASE.LOADING);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (phase !== PHASE.LIVE) {
      arenaLayoutModeRef.current = ARENA_LAYOUT.SMARTBOARD;
      arenaGuestFocusUserIdRef.current = null;
      arenaPanelUserIdsRef.current = [];
      setArenaLayoutMode(ARENA_LAYOUT.SMARTBOARD);
      setArenaGuestFocusUserId(null);
      setArenaPanelUserIds([]);
    }
  }, [phase]);
  const hostWhisperIncomingRef = useRef(null);
  const vbgBeforeChromaRef = useRef(null);
  const arenaHostAlertSoundRef = useRef(true);
  const liriPersistTimeoutRef = useRef(null);
  const longiaSeenRealtimeIdsRef = useRef(new Set());
  const longiaChatAnalyzeTimerRef = useRef(null);
  const longiaLastChatLenRef = useRef(0);
  /** Bus LONGIA temps réel (`longia-bus-${sessionId}`) — transcript, actions élèves, etc. */
  const longiaBusHostChRef = useRef(null);
  /** Dédup / anti-spam pour `LONGIA_SESSION_DIGEST` sur le bus invité. */
  const longiaSessionDigestBroadcastRef = useRef({ key: '', keyAt: 0, lastEmit: 0 });
  const guestLongiaBusChRef = useRef(null);
  /** Debounce partiels multilingue (Edge translate-transcript). */
  const multilangPartialTsRef = useRef(0);
  /** Throttle des toasts d'erreur LIRI (max 1 / 60 s). */
  const liriErrorLastToastAtRef = useRef(0);
  const hostMultilangPendingRef = useRef({
    enabled: false,
    sourceLang: 'fr',
    targetsStr: 'en',
    guestBrowserTtsOffered: true,
    guestEdgeTtsOffered: false,
    livekitInterpreterEnabled: false,
  });
  const hostMultilangDebounceRef = useRef(null);
  const hostMultilangRef = useRef({
    enabled: false,
    sourceLang: 'fr',
    targetsStr: 'en',
    guestBrowserTtsOffered: true,
    guestEdgeTtsOffered: false,
    livekitInterpreterEnabled: false,
  });
  const flushBusStudentSignalsRef = useRef(() => {});
  const applyLongiaEngineDecisionsRef = useRef((/** @type {unknown[]} */ _d) => {});
  const transcriptEngineCooldownRef = useRef(0);
  const chatHeuristicCooldownRef = useRef(0);
  const visibilitySignalCooldownRef = useRef(0);
  const [guestTeacherTranscript, setGuestTeacherTranscript] = useState('');
  const [guestTeacherTranscriptPartial, setGuestTeacherTranscriptPartial] = useState('');
  /** Sous-titres multilingues (config salle + cumul par langue). */
  const [guestMultilangConfig, setGuestMultilangConfig] = useState({
    enabled: false,
    sourceLang: 'fr',
    targetLangs: /** @type {string[]} */ ([]),
    guest_browser_tts_offered: true,
    guest_edge_tts_offered: false,
    livekit_interpreter_enabled: false,
  });
  const [guestMultilangViewLang, setGuestMultilangViewLang] = useState('source');
  const [guestMultilangRolling, setGuestMultilangRolling] = useState(() => ({}));
  /** Invité : lecture TTS navigateur des segments traduits (sessionStorage par session). */
  const [guestMultilangBrowserTtsOn, setGuestMultilangBrowserTtsOn] = useState(false);
  /** Invité : TTS ElevenLabs Flash (Edge `liri-tts`, tier live) — mutuellement exclusif avec le navigateur dans l'UI. */
  const [guestMultilangEdgeTtsOn, setGuestMultilangEdgeTtsOn] = useState(false);
  const [guestLivekitInterpreterVolume, setGuestLivekitInterpreterVolume] = useState(0.85);
  const guestMultilangAudioPrefsRef = useRef({
    browserTtsOffered: true,
    browserTtsOn: false,
    edgeTtsOffered: false,
    edgeTtsOn: false,
    viewLang: 'source',
  });
  /** Fil lecture seule : alertes LONGIA hôte reçues via le bus temps réel. */
  const [guestLongiaSessionDigests, setGuestLongiaSessionDigests] = useState([]);

  // State UI
  const [step, setStep] = useState(0);
  const [msMode, setMsMode] = useState('guide');
  const [spotlightOn, setSpotlightOn] = useState(false);
  /** Lecture progressive des blocs SmartBoard — diffusée sur le canal smartboard (comme LiveArena). */
  const [progressivePlayback, setProgressivePlayback] = useState(true);
  const [mmView, setMmView] = useState('list');
  const [neuronQActive, setNeuronQActive] = useState(false);
  const [neuronQResponses, setNeuronQResponses] = useState([]);
  const [forumTarget, setForumTarget] = useState(null);
  /** Incrémenté quand une piste LiveKit caméra (locale ou distante) change — pour ré-attacher la vignette vidéo. */
  const [liveKitMediaEpoch, setLiveKitMediaEpoch] = useState(0);
  const [timerSec, setTimerSec] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [msTyped, setMsTyped] = useState('');
  const [msBody, setMsBody] = useState('');
  const [nqAnalysis, setNqAnalysis] = useState('');
  const [panels, setPanels] = useState([
    {id:"hands",title:"MAINS LEVEES",emptyMsg:"Aucune main levee",emptyDesc:"Les eleves qui leveront la main apparaitront ici.",iconColor:"#fbbf24",events:[],mode:"feed"},
    {id:"waiting",title:"SALLE D ATTENTE",emptyMsg:"Aucun membre en attente.",emptyDesc:"Les demandes pour rejoindre apparaitront ici.",iconColor:"#38bdf8",events:[],mode:"feed"},
    {id:"notifs",title:"NOTIFICATIONS",emptyMsg:"Pas de notification.",emptyDesc:"Les activites temps reel s afficheront ici.",iconColor:"#fde68a",events:[],mode:"feed"},
  ]);

  const { kickParticipant, muteParticipant, resolveHandRaise } = useLiveHostParticipantModeration({
    sessionId, roomRef, setLiveParticipants, setModal, setPanels,
  });

  const [hostNotifFilter, setHostNotifFilter] = useState(LONGIA_PANEL_FILTER.ALL);
  const [longiaGovernorModes, setLongiaGovernorModes] = useState(() => {
    try {
      const raw = localStorage.getItem('liri-longia-governor-modes-v1');
      if (raw) return { ...DEFAULT_LONGIA_GOVERNOR_MODES, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_LONGIA_GOVERNOR_MODES };
  });
  useEffect(() => {
    try {
      localStorage.setItem('liri-longia-governor-modes-v1', JSON.stringify(longiaGovernorModes));
    } catch {
      /* ignore */
    }
  }, [longiaGovernorModes]);
  const longiaModesRef = useRef(longiaGovernorModes);
  useEffect(() => {
    longiaModesRef.current = longiaGovernorModes;
  }, [longiaGovernorModes]);

  const { analyzeLiveContext } = useLongiaLiveRealtime(supabase);

  useEffect(() => {
    longiaSeenRealtimeIdsRef.current = new Set();
    longiaLastChatLenRef.current = 0;
    longiaSessionDigestBroadcastRef.current = { key: '', keyAt: 0, lastEmit: 0 };
  }, [sessionId]);

  /** Hauteur du cadre vidéo hôte (colonne droite) — au repos ; rétrécit au scroll colonne droite. */
  const [hostVidHeight, setHostVidHeight] = useState(LH_HOST_RIGHT_VIDEO_FRAME_REST_H_PX);
  const [mmCardVisible, setMmCardVisible] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  /** Aperçu hôte : maquette mobile (sans redimensionner la fenêtre). */
  const [previewMobileMaquette, setPreviewMobileMaquette] = useState(false);
  /** Aperçu hôte : zone centrale seule (type projecteur). */
  const [previewProjectorLayout, setPreviewProjectorLayout] = useState(false);
  /** Rails latéraux repliables (live) — largeur 0 / masqués en compact ; indépendants du mode focus ⊞. */
  const [liveLeftRailOpen, setLiveLeftRailOpen] = useState(true);
  const [liveRightRailOpen, setLiveRightRailOpen] = useState(true);
  /** Hôte : caméra locale dans le panneau droit (grand cadre). Si false, la vignette locale n'est que dans le bandeau — jamais les deux à la fois. */
  const [hostRightRailLocalVideoOpen, setHostRightRailLocalVideoOpen] = useState(true);
  /** Zone centrale : SmartBoard ou caméra formateur plein écran (P1 Arena — sync broadcast). */
  const [arenaLayoutMode, setArenaLayoutMode] = useState(() => ARENA_LAYOUT.SMARTBOARD);
  /** Invité : identité LiveKit de l'invité mis au centre (sync hôte). */
  const [arenaGuestFocusUserId, setArenaGuestFocusUserId] = useState(null);
  /** Identités Panel (hôte + invités, sync broadcast / DB). */
  const [arenaPanelUserIds, setArenaPanelUserIds] = useState(() => []);
  const arenaHostCameraCenter = phase === PHASE.LIVE && arenaLayoutMode === ARENA_LAYOUT.HOST_CAMERA;
  const arenaGuestFocusCenter =
    phase === PHASE.LIVE
    && arenaLayoutMode === ARENA_LAYOUT.GUEST_FOCUS
    && Boolean(isGuestUi ? arenaGuestFocusUserId : promotedId);
  const arenaPanelCenter =
    phase === PHASE.LIVE && arenaLayoutMode === ARENA_LAYOUT.PANEL && arenaPanelUserIds.length > 0;
  const arenaMembersWallCenter = phase === PHASE.LIVE
    && (arenaLayoutMode === ARENA_LAYOUT.MEMBERS_WALL || arenaLayoutMode === ARENA_LAYOUT.CONFERENCE);
  const lhLayoutCompact = useMemo(
    () =>
      lhCompactViewport
      || lhWebTooNarrowForThreeCols
      || (!isGuestUi && previewMobileMaquette),
    [lhCompactViewport, lhWebTooNarrowForThreeCols, isGuestUi, previewMobileMaquette],
  );
  /** Invité sur téléphone : coque 9:16 (canevas Architect mobile) + zone prof verrouillée. */
  const guestMobileAuthorityUi = useMemo(
    () => Boolean(isGuestUi && lhLayoutCompact && phase === PHASE.LIVE),
    [isGuestUi, lhLayoutCompact, phase],
  );
  const lhStageFocusLayout = useMemo(
    () => focusMode || (!isGuestUi && previewProjectorLayout),
    [focusMode, isGuestUi, previewProjectorLayout],
  );
  useEffect(() => {
    if (phase !== PHASE.LIVE) {
      setPreviewMobileMaquette(false);
      setPreviewProjectorLayout(false);
      setLiveLeftRailOpen(true);
      setLiveRightRailOpen(true);
    }
  }, [phase]);
  /**
   * Mode formation auto-épuré (desktop hôte) : un cours (session_type === 'classe')
   * qui passe en LIVE met le SmartBoard au centre et replie le secondaire UNE SEULE
   * FOIS — focus ⊞ + hub LONGIA fermé + rails repliés. L'hôte reprend ensuite la main
   * (bouton ⊞ / strips) sans qu'on re-force (garde formationFocusAppliedRef).
   */
  const formationFocusAppliedRef = useRef(false);
  useEffect(() => {
    if (phase !== PHASE.LIVE) {
      formationFocusAppliedRef.current = false;
      return;
    }
    // Hôte web/desktop. On exclut seulement le VRAI mobile (lhCompactViewport),
    // pas le web étroit (<3 colonnes) : un laptop ~1440 doit bénéficier du focus.
    if (isGuestUi || lhCompactViewport) return; // hôte web/desktop ; pas le vrai mobile
    if (formationFocusAppliedRef.current) return; // une seule fois
    formationFocusAppliedRef.current = true;
    // Arrivée par défaut (maquette) : smartboard dominant + panneaux repliés en
    // poignées sur les bords + hub fermé, MAIS on garde la barre du haut et la
    // bande membres (pas de focusMode, qui lui masque tout).
    setLongiaHubOpen(false);
    setLiveLeftRailOpen(false);
    setLiveRightRailOpen(false);
  }, [phase, isGuestUi, lhCompactViewport]);
  const guestInvitePreviewUrl = useMemo(() => {
    if (!sessionId || typeof window === 'undefined') return '';
    return `${window.location.origin}/live/${sessionId}`;
  }, [sessionId]);
  const [forumInput, setForumInput] = useState('');
  /** Invité : main levée (aligné LiveArena — `live_session_signals`). */
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const {
    mobileCameraLinkOpen, setMobileCameraLinkOpen, mobileCameraJoinUrl, mobileCameraLinkExpires, mobileCameraLinkLoading,
    mobileCameraLinkErr,
  } = useLiveHostMobileCameraLink({ sessionId, phase, isGuestUi });
  /** LIRI Control Mesh — file locale (brancher temps réel + Transfer Engine). */
  const [meshPanelOpen, setMeshPanelOpen] = useState(false);
  /** Ouvert par défaut en live hôte pour afficher la barre LONGIA flottante (sinon rien n'apparaît sans clic). */
  const [longiaHubOpen, setLongiaHubOpen] = useState(true);
  /** Sous-tiroir détail (tuile rapport temps réel) — referme à la fermeture du hub. */
  const [longiaSignalSubDrawer, setLongiaSignalSubDrawer] = useState(null);
  const [meshRequests, setMeshRequests] = useState([]);
  /** Demandes d'accès invité (Signaux — `live_session_signals` type permission_request), hôte uniquement. */
  const [hostPermissionRequests, setHostPermissionRequests] = useState([]);
  /** Demandes JoyKit (`joykit_request`), hôte uniquement. */
  const [hostJoyKitRequests, setHostJoyKitRequests] = useState([]);
  /** Hôte : userId → profil JoyKit accordé (Transfer Engine). */
  const [meshGrantsByUserId, setMeshGrantsByUserId] = useState(() => ({}));
  const meshGrantsByUserIdRef = useRef({});
  useEffect(() => {
    meshGrantsByUserIdRef.current = meshGrantsByUserId;
  }, [meshGrantsByUserId]);
  /** Invité : grant courant (reçu par mesh_grant). */
  const [guestMeshGrant, setGuestMeshGrant] = useState(null);
  /** Rafraîchit le compte à rebours JoyKit (invité). */
  const [meshGrantClock, setMeshGrantClock] = useState(0);

  const {
    guestMergedMeshPermissions,
    guestMeshStatusLine,
    guestJoyKitDrive,
  } = useLiveHostGuestMeshPerms({
    isGuestUi,
    guestMeshGrant,
    joyKitSignalGrant,
    guestJoyKitDriveRef,
  });

  /**
   * Hub fermé → pas de sous-vue. Hub ouvert → on conserve la sous-vue courante ; par défaut
   * l'ACCUEIL Signaux (vue d'ensemble : Coach, Mains, Demandes, Salle d'attente, Zone 3, NeuronQ,
   * Journal). Le Coach formateur reste accessible explicitement (bouton IA + 1ʳᵉ carte de la liste).
   * (Avant : le hub se forçait sur « Coach » à l'ouverture, ce qui détournait le bouton « Signaux ».)
   */
  useEffect(() => {
    if (!longiaHubOpen) setLongiaSignalSubDrawer(null);
  }, [longiaHubOpen]);

  const {
    expandLongiaHubUi, openLongiaHubSignauxHome, openLongiaHubControlMesh, openLongiaHubCoachPanel, openLayoutPreviewInHub,
    toggleLayoutPreviewHubPanel, openLongiaHubWaitingRoom,
  } = useLiveHostLongiaHubNav({
    phase, isGuestUi, lhLayoutCompact, setLongiaHubOpen, setLongiaSignalSubDrawer,
    setMeshPanelOpen, setLiveLeftRailOpen, guestPreviewUrl: guestInvitePreviewUrl,
  });


  /** Raccourcis étape 7 / 6 — persistance `live_sessions.config` (mise à jour rapide pendant le live). */
  const [sessionQuickIaFlags, setSessionQuickIaFlags] = useState({
    quiz_enabled: false,
    polls_enabled: false,
    ai_summary_enabled: false,
    ai_mindmap_enabled: false,
    neuronq_enabled: true,
    neuro_recall_enabled: false,
  });
  const [sessionCommFlags, setSessionCommFlags] = useState({
    chat_enabled: true,
    hand_raise_enabled: true,
    screen_share_enabled: true,
    student_audio_enabled: true,
    student_video_enabled: true,
    /** Invités : modal « vue membre » avec vie scolaire ; sinon vidéo + messages privés uniquement */
    guest_member_inspect_enabled: false,
    /** Invité doit accepter (avant le live) que le formateur puisse piloter la caméra si activé. */
    proctoring_camera_consent_required: false,
    /** Formateur : commande caméra à distance (fiche membre), si consentement exigé. */
    host_remote_camera_enabled: false,
  });

  /**
   * Permissions invité (salle de classe virtuelle) — persisté dans
   * `live_sessions.config.guest_permissions`. Clé snake_case côté DB.
   * Le formateur peut ajuster chacune via l'onglet "Permissions invités"
   * du panneau paramètres. Côté invité, ce bloc ne s'affiche jamais.
   */
  const [sessionGuestPermissions, setSessionGuestPermissions] = useState(
    () => serializeGuestPermissions(GUEST_CAPABILITIES_DEFAULTS),
  );

  /** Multilingue live — persisté dans `live_sessions.config.liri_multilang`. */
  const [hostMultilang, setHostMultilang] = useState({
    enabled: false,
    sourceLang: 'fr',
    targetsStr: 'en',
    guestBrowserTtsOffered: true,
    guestEdgeTtsOffered: false,
    livekitInterpreterEnabled: false,
  });

  useEffect(() => {
    hostMultilangRef.current = hostMultilang;
    hostMultilangPendingRef.current = hostMultilang;
  }, [hostMultilang]);

  useEffect(() => {
    return () => {
      if (hostMultilangDebounceRef.current) clearTimeout(hostMultilangDebounceRef.current);
    };
  }, []);

  const {
    persistControlMeshToConfig, persistSessionConfigPatch, handleQuickIaToggle, handleQuickCommToggle, handleGuestPermissionsChange,
    handleQuickSmartboardSceneToggle,
  } = useLiveHostConfigActions({
    sessionId, isGuestUi, toast, setSessionQuickIaFlags, setSessionCommFlags,
    setSessionGuestPermissions, setSmartboardSceneFlags,
  });

  const sessionCommFlagsRef = useRef(sessionCommFlags);
  useEffect(() => {
    sessionCommFlagsRef.current = sessionCommFlags;
  }, [sessionCommFlags]);

  const {
    appendLiveChatToNotificationsPanel, syncWaitingRoomPanelAndChime, onHandRaise, onChatMessage, onNeuronqQuestionInsert,
  } = useLiveHostPanelCallbacks({
    setPanels,
    prevWaitingIdsRef,
    arenaHostAlertSoundRef,
    hostSfxCtxRef,
  });

  const { chatMessages, sendChatMessage } = useLiveHostSessionChat({
    sessionId,
    phase,
    user,
    isGuestUi,
    chatEnabled: sessionCommFlags.chat_enabled !== false,
    toast,
    onRemoteChatInserted: appendLiveChatToNotificationsPanel,
  });

  const { waitingEntries, approveWaiting, rejectWaiting } = useLiveHostWaitingRoom({
    sessionId,
    onWaitingEntriesHydrated: syncWaitingRoomPanelAndChime,
  });

  const { acceptGuestProctorConsent } = useLiveHostGuestProctorConsent({
    sessionId,
    userId: user?.id,
    toast,
    setGuestProctorModalOpen,
    setGuestProctorConsentVersion,
  });

  const {
    persistFullMultilang, flushHostMultilangToDb, setHostMultilangField, setGuestMultilangBrowserTtsOnPersist, setGuestMultilangEdgeTtsOnPersist,
  } = useLiveHostMultilangSettings({
    sessionId, isGuestUi, persistSessionConfigPatch, setHostMultilang, hostMultilangPendingRef,
    hostMultilangDebounceRef, setGuestMultilangBrowserTtsOn, setGuestMultilangEdgeTtsOn, guestMultilangBrowserTtsOn, guestMultilangEdgeTtsOn,
    guestMultilangViewLang, guestMultilangConfig, guestMultilangAudioPrefsRef,
  });

  const { scheduleMeshHostExpiry } = useLiveHostMeshScheduler({
    phase, isGuestUi, persistControlMeshToConfig, setMeshGrantsByUserId, meshHostExpiryTimersRef,
    smartboardChRef, pendingMeshRestoreRef,
  });

  // ── DebateCore state ───────────────────────────────────────────────────────
  const {
    debateArena, setDebateArena, debateModBusy, debateNeuronqEnabled, debateLiveVoteCounts,
    debateAiJudgeBusy, debateAiReportPreview, refreshDebateRounds, debatePatch, debateAiWeightPctDisplay,
    onDebateAiWeightRangeChange, debateOpenVoting, debateCloseVoting, debateCurrentRoundStatus, debateRunAiJudge,
  } = useLiveHostDebateArena({ phase, sessionId, toast });

  const [debateVoteBusy, setDebateVoteBusy] = useState(false);
  /** NeuronQ invité — volets (Ctrl+Entrée ajoute un volet) ; texte combiné pour envoi / reformulation */
  const [guestNeuronqVolets, setGuestNeuronqVolets] = useState(['']);
  const guestNeuronqCombinedRaw = useMemo(
    () =>
      guestNeuronqVolets
        .map((s) => String(s).trim())
        .filter(Boolean)
        .join('\n\n—\n\n'),
    [guestNeuronqVolets],
  );
  const [guestNeuronqReformulated, setGuestNeuronqReformulated] = useState('');
  const [neuronqReformulating, setNeuronqReformulating] = useState(false);
  const [neuronqGuestSubmitting, setNeuronqGuestSubmitting] = useState(false);
  /** Invité : panneau NeuronQ (formulaire) — raccourci barre d'actions */
  const [guestNeuronqPanelOpen, setGuestNeuronqPanelOpen] = useState(false);

  // ── Zone 3 — mains levées + sièges privilégiés ────────────────────────────
  const [zone3RaisedHands, setZone3RaisedHands] = useState([]);
  const [zone3PrivilegedSeats, setZone3PrivilegedSeats] = useState([]);

  // ── Paramètres Studio (LiveStudioSettingsPanel) ────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [guestProctorHistoryOpen, setGuestProctorHistoryOpen] = useState(false);

  const {
    proctorCamHistoryRows, proctorCamHistoryLoading, guestProctorOwnRows, guestProctorOwnLoading, fetchProctorCamHistory,
    fetchGuestProctorOwnHistory, broadcastHostCameraCommand,
  } = useLiveHostProctor({
    sessionId,
    userId: user?.id,
    isGuestUi, phase, teacherId, sessionCommFlags, showSettings,
    guestProctorOwnRefreshRef, toast,
  });
  /** Panneau messagerie — même tiroir droit que les paramètres */
  const [showMessagingPanel, setShowMessagingPanel] = useState(false);
  /** Aperçu vidéo membre plein écran — dock plateau ou messagerie (même modal) */
  const [memberVideoPreview, setMemberVideoPreview] = useState(null);
  const [videoBeauty, setVideoBeauty] = useState(false);
  const [videoChromaKey, setVideoChromaKey] = useState(false);
  const [videoChromaColor, setVideoChromaColor] = useState('#00B140');
  const [videoChromaSens, setVideoChromaSens] = useState(80);
  const [videoBlur, setVideoBlur] = useState(false);
  const [videoVbg, setVideoVbg] = useState('none');
  const [videoCustomBgUrl, setVideoCustomBgUrl] = useState('');
  const [videoBrightness, setVideoBrightness] = useState(100);
  const [videoContrast, setVideoContrast] = useState(100);
  const [videoSaturation, setVideoSaturation] = useState(100);
  const [videoHue, setVideoHue] = useState(0);
  const [micGain, setMicGain] = useState(100);
  const [liriSnap] = useState(() => loadLiriAudioSettings());
  const [noiseReduction, setNoiseReduction] = useState(() => liriSnap.noiseReduction ?? false);
  /** Moteur LIRI (Web Audio) — modes + FX ; `off` = micro direct */
  const [liriAudioMode, setLiriAudioMode] = useState(() => liriSnap.mode ?? 'off');
  const [liriClarity, setLiriClarity] = useState(() => liriSnap.clarity ?? 55);
  const [liriReverb, setLiriReverb] = useState(() => liriSnap.reverb ?? 12);
  const [liriCompression, setLiriCompression] = useState(() => liriSnap.compression ?? 58);
  const [liriGate, setLiriGate] = useState(() => liriSnap.gate ?? 35);
  const [liriLimiter, setLiriLimiter] = useState(() => liriSnap.limiter ?? 72);
  const [liriAudioLevels, setLiriAudioLevels] = useState(() => ({ in: 0, out: 0, clip: false }));
  const liriMeterThrottleRef = useRef(0);
  const [ambientTracks, setAmbientTracks] = useState([]);
  /** Volume maître ambiance salle (0–1), piloté aussi depuis le panneau Paramètres */
  const [ambientMasterVolume, setAmbientMasterVolume] = useState(0.22);
  /** Scènes rituel / cours (Web Audio) — `config.liri_audio_scenes`, aligné LiveArena / LiveRoomShell */
  const [liriAudioScenes, setLiriAudioScenes] = useState([]);
  const [liriAudioInitialSceneIndex, setLiriAudioInitialSceneIndex] = useState(0);
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [activeVideoId, setActiveVideoId] = useState('');
  const [activeAudioId, setActiveAudioId] = useState('');
  const [arenaHostAlertSoundOn, setArenaHostAlertSoundOn] = useState(() => {
    try { return localStorage.getItem('liri_lhp_host_alerts') !== '0'; } catch { return true; }
  });
  useEffect(() => { arenaHostAlertSoundRef.current = arenaHostAlertSoundOn; }, [arenaHostAlertSoundOn]);
  useEffect(() => {
    try { localStorage.setItem('liri_lhp_host_alerts', arenaHostAlertSoundOn ? '1' : '0'); } catch {}
  }, [arenaHostAlertSoundOn]);

  useLiveHostGuestSessionConfigRealtime({
    sessionId, isGuestUi, teacherId, toast, phaseRef,
    roomRef, setAmbientTracks, setPhase, setSessionQuickIaFlags, setSessionCommFlags,
    setSessionGuestPermissions, setSmartboardSceneFlags, setGuestMultilangConfig, setGuestMultilangRolling, setGuestMultilangViewLang,
  });

  useEffect(() => {
    saveLiriAudioSettings({
      mode: liriAudioMode,
      clarity: liriClarity,
      reverb: liriReverb,
      compression: liriCompression,
      gate: liriGate,
      limiter: liriLimiter,
      noiseReduction,
    });
  }, [liriAudioMode, liriClarity, liriReverb, liriCompression, liriGate, liriLimiter, noiseReduction]);

  // Refs
  const timerRef = useRef(null);
  const msTypedIvRef = useRef(null);
  const msBodyIvRef = useRef(null);
  const rightColRef = useRef(null);
  const memberCardsRef = useRef(null);
  const leftColRef = useRef(null);
  const hostLiveGridRef = useRef(null);
  /** Miroir DOM (aperçu mobile) : zone centrale seule = SmartBoard / maquette lisibles. */
  const hostCenterStageMirrorRef = useRef(null);
  const lhMaquetteMainVideoRef = useRef(null);
  const lhMaquetteMiniVideoRef = useRef(null);
  const lhMaquettePipCanvasMainRef = useRef(null);
  const lhMaquettePipCanvasMiniRef = useRef(null);
  const lhMaquetteSlideAreaRef = useRef(null);
  const lhMaquettePromotedIdRef = useRef(null);
  useEffect(() => {
    lhMaquettePromotedIdRef.current = promotedId;
  }, [promotedId]);

  // ── Données dérivées (réelles ou fallback) ────────────────────────────────
  const activeEtapes = useMemo(() => liveEtapes.length > 0 ? liveEtapes : ETAPES_FALLBACK, [liveEtapes]);
  /** Membres réels uniquement (plus de liste fictive quand la salle est vide). */
  const activeMembers = liveParticipants;
  const {
    displaySlidesHost, lhMaquetteLocalRow, lhMaquetteIncomingRow, lhMaquetteMainDisplay, lhMaquetteMiniDisplay,
    lhMaquetteRemoteWaiting, lhMaquetteCompositorSlide, camera2FluxParticipants,
  } = useLiveHostMaquetteDisplay({
    liveParticipants, promotedId, step, liveScenes, liveKitMediaEpoch,
    roomRef,
    userFullName: user?.full_name,
  });

  // Si des scènes SmartBoard réelles existent, le nombre de slides est piloté par elles
  const stepCount = liveScenes.length > 0 ? Math.max(liveScenes.length, activeEtapes.length) : activeEtapes.length;

  const buildParticipantList = useLiveHostLiveKitParticipantList({
    user,
    antennaSoloModeRef,
    setLiveParticipants,
    setPromotedId,
  });

  // ── Init session + LiveKit ────────────────────────────────────────────────
  useEffect(() => {
    const rawTrimmed = sessionIdParam == null ? '' : String(sessionIdParam).trim();
    if (!sessionId) {
      if (rawTrimmed) {
        setPhase(PHASE.ERROR);
        setPhaseError(
          'L\'URL ne contient pas d\'UUID de séance valide. Utilisez un lien du type /live/host/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx sans texte en plus (évitez « <SESSION_ID> » ou un titre collé à l\'identifiant).',
        );
      } else {
        // [APERÇU DEV /dev/liri-host-live] Membres de démonstration pour prévisualiser
        // la bande de membres peuplée (aucun participant réel sur cette route mock).
        setLiveParticipants([
          { id: 'demo-1', name: 'Aicha Karim', status: 'online', color: '#d98a5a' },
          { id: 'demo-2', name: 'Sara Benali', status: 'online', color: '#d4a36a' },
          { id: 'demo-3', name: 'Karim Touré', status: 'online', color: '#c98a4e' },
          { id: 'demo-4', name: 'Lina Cissé', status: 'online', color: '#fbbf24' },
          { id: 'demo-5', name: 'Yacine Mansouri', status: 'online', color: '#e0b878' },
          { id: 'demo-6', name: 'Nabil Bensalem', status: 'online', color: '#b8794a' },
          { id: 'demo-7', name: 'Fatoumata Sow', status: 'online', color: '#cf7a52' },
        ]);
        setPhase(PHASE.LIVE);
      }
      return;
    }
    let cancelled = false;
    const isCancelled = () => cancelled;
    void runLiveHostSessionAndLiveKitInit({
      isCancelled, sessionId, user, startedAt, stepRef,
      roomRef, liveDisconnectTimerRef, pendingMeshRestoreRef, sharingScreenRef, isGuestUiRef,
      guestJoyKitDriveRef, guestResyncSmartboardFromDbRef, resyncSmartboardRef, arenaHostAlertSoundRef, hostSfxCtxRef,
      setPhase, setPhaseError, setLiveKitMediaAvailable, setLiriLiveKitDomFlag, setLiriLiveKitDomError, setSessionTitle,
      setStartedAt, setTeacherId, setSessionFormationId, setSessionType, setLiveEtapes, setStep,
      setSmartboardSceneFlags, setSessionQuickIaFlags, setSessionCommFlags, setSessionGuestPermissions, setHostMultilang,
      setGuestMultilangConfig, setSharedImageGallery, setSharedImageLoop, setShopProducts, setProgressivePlayback,
      setAmbientTracks, applyLiriAudioFromConfig, setMeshGrantsByUserId, setLiveScenes, setPanels,
      setDebateArena, setGuestProctorModalOpen, setLiveKitMediaEpoch, setLiveKitScreenEpoch, setSharingScreen,
      setMicOn, setCameraOn, setArenaLayoutMode, arenaLayoutModeRef, toast, buildParticipantList,
    });
    return () => {
      cancelled = true;
      setLiveKitMediaAvailable(false);
      setLiriLiveKitDomFlag('off');
      setLiriLiveKitDomError('');
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {});
        roomRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- aligné historique : relance sur session / consentement invité uniquement
  }, [sessionId, sessionIdParam, guestProctorConsentVersion, user?.id]);

  // ── Realtime : présence + mains levées ───────────────────────────────────
  const { presence, broadcastHandRaise } = useLiveSessionRealtime(sessionId, { onHandRaise, onChatMessage });

  const { floatingReactions } = useLiveHostLiveSessionSignalsRealtime({
    sessionId,
    phase,
    isGuestUi,
    userId: user?.id,
    setPanels, setMyHandRaised, setZone3RaisedHands, setHostPermissionRequests, setHostJoyKitRequests,
    arenaHostAlertSoundRef, hostSfxCtxRef,
  });

  // ── Whispers (messages privés) — toast + son comme Live Arena ─────────────
  const { threads: whisperThreads, sendWhisper } = useLiveSessionWhispers(
    phase === PHASE.LIVE ? sessionId : null,
    user?.id,
    hostWhisperIncomingRef,
  );

  useEffect(() => {
    hostWhisperIncomingRef.current = ({ fromId, text }) => {
      playSound();
      const row = liveParticipants.find((x) => String(x.id) === String(fromId));
      const name = row?.name || 'Participant';
      const raw = String(text || '');
      const snippet = raw.length > 100 ? `${raw.slice(0, 97)}…` : raw;
      toast({
        title: `Message privé — ${name}`,
        description: snippet,
        duration: 8500,
      });
    };
  }, [playSound, toast, liveParticipants]);

  const asideChannelEnabled = phase === PHASE.LIVE && Boolean(sessionId && user?.id);
  const asideMedia = useLiveAsideChannel({
    sessionId: sessionId ?? null,
    userId: user?.id ?? null,
    teacherId,
    isHost: isHostUser,
    roomRef,
    enabled: asideChannelEnabled,
    onToast: (o) =>
      toast({
        title: o.title,
        description: o.description,
        variant: o.variant === 'destructive' ? 'destructive' : 'default',
      }),
  });
  const hostMonitorBus = useHostAudioMonitorBus();

  const {
    recording, recStarting, recError, setRecError, recordingRef,
    recFinalizeResolveRef, mediaRecRef, startRecording, stopRecording,
  } = useLiveHostRecording({ sessionId, roomRef, toast });

  /** Évite double clic STOP / quitter (async + overlays). */
  const [stopLiveBusy, setStopLiveBusy] = useState(false);
  const stopLiveInProgressRef = useRef(false);
  const progressivePlaybackRef = useRef(progressivePlayback);
  useEffect(() => { progressivePlaybackRef.current = progressivePlayback; }, [progressivePlayback]);

  const {
    sendSmartboardHostPayload, persistArenaLayoutMode, applyHostArenaLayoutMode, handleMobileLayoutPreviewChange, onSmartboardBroadcast,
    persistProgressivePlayback, toggleProgressivePlayback,
  } = useLiveHostArenaLayout({
    isGuestUi, phase, sessionId, user, permCtxOptional,
    toast, promotedId, liveParticipants, arenaLayoutMode, guestMergedMeshPermissions,
    guestMeshGrant, setPromotedId, setNeuronQActive, setArenaPanelUserIds, setArenaLayoutMode,
    setProgressivePlayback, setPreviewMobileMaquette, guestJoyKitDriveRef, guestSmartboardBroadcastRef, smartboardChRef,
    smartBoardStageRef, sharingScreenRef, recordingRef, progressivePlaybackRef, stepRef,
    arenaLayoutModeRef, arenaGuestFocusUserIdRef, arenaPanelUserIdsRef, arenaLayoutPersistTimerRef, progressivePersistTimerRef,
    resyncSmartboardRef,
  });

  const {
    micOn, setMicOn, cameraOn, setCameraOn, sharingScreen,
    setSharingScreen, pipStreamFromCanvas, setPipStreamFromCanvas, guestCommAllowed, toggleMic,
    toggleCamera, toggleScreenShare, raiseHand, lowerHand, tryStartLiveKitPlayback,
  } = useLiveHostMediaControls({
    sessionId,
    userId: user?.id,
    userFullName: user?.full_name,
    isGuestUi, phase, roomRef, sharingScreenRef, guestHostCameraUnlockRef,
    liveKitMediaAvailable,
    liveKitConnectHint: phaseError,
    myHandRaised, setMyHandRaised, broadcastHandRaise, sendSmartboardHostPayload,
    debateArenaMyRole: debateArena?.myRole,
    guestJoyKitDrive, sessionCommFlags, guestCapabilityCaps, permCtxOptional, toast,
  });

  useLiveHostSmartboardBroadcastChannel({
    sessionId,
    phase,
    isGuestUi,
    userId: user?.id,
    teacherId, toast, sendSmartboardHostPayload, smartBoardStageRef, stepRef,
    progressivePlaybackRef, guestJoyKitDriveRef, guestSmartboardBroadcastRef, smartboardChRef, roomRef,
    sessionCommFlagsRef, guestHostCameraUnlockRef, guestProctorOwnRefreshRef, guestResyncSmartboardFromDbRef, arenaLayoutModeRef,
    arenaGuestFocusUserIdRef, arenaPanelUserIdsRef, meshGrantsByUserIdRef, setGuestMeshGrant, setArenaLayoutMode,
    setArenaGuestFocusUserId, setArenaPanelUserIds, setGuestLiriAudioSmartboard, setGuestLiriAudioSceneName, setStep,
    setProgressivePlayback, setMeshRequests, setCameraOn, setLiveKitMediaEpoch,
  });

  useLiveHostLongiaBusHostRealtime({
    isGuestUi, sessionId, phase, longiaBusHostChRef, flushBusStudentSignalsRef,
    applyLongiaEngineDecisionsRef,
  });

  useLiveHostLongiaBusGuestRealtime({
    isGuestUi, sessionId, phase, toast, guestLongiaBusChRef,
    guestMultilangAudioPrefsRef, setGuestTeacherTranscript, setGuestTeacherTranscriptPartial, setGuestLongiaSessionDigests, setGuestMultilangRolling,
    setGuestMultilangViewLang,
  });

  const { broadcastTeacherTranscriptChunk, publishGuestLongiaBusEvent } = useLiveHostLongiaBusCallbacks({
    isGuestUi,
    phase,
    sessionId,
    userId: user?.id,
    toast, longiaBusHostChRef, guestLongiaBusChRef, hostMultilangRef, multilangPartialTsRef,
    liriErrorLastToastAtRef,
  });

  useLiveHostGuestResyncSmartboardFromDb({
    sessionId, guestResyncSmartboardFromDbRef, smartBoardStageRef, setArenaLayoutMode, setArenaGuestFocusUserId,
    setArenaPanelUserIds,
  });

  useEffect(() => {
    if (phase !== PHASE.LIVE || isGuestUi) return;
    sendSmartboardHostPayload();
  }, [recording, phase, sendSmartboardHostPayload, isGuestUi]);

  useEffect(() => {
    if (phase === PHASE.LIVE) return;
    setGuestLiriAudioSmartboard(null);
    setGuestLiriAudioSceneName('');
  }, [phase]);


  // ── 3. Vidéo participants — LiveHostVideoCell (track LiveKit) ─────────────
  const {
    livekitParticipantsMap,
    guestLivekitInterpreterParticipants,
    hostLiveKitParticipant,
  } = useLiveHostLiveKitParticipantMaps({
    roomRef, liveParticipants, liveKitMediaEpoch, isGuestUi, teacherId,
  });

  // ── 4. NeuronQ depuis DB ──────────────────────────────────────────────────
  const { neuronqQuestions, markNeuronqAnswered, markNeuronqSkipped } = useLiveHostNeuronqQuestions({
    sessionId,
    phase,
    debateNeuronqEnabled,
    onQuestionInsert: onNeuronqQuestionInsert,
  });

  const { neuronqReformulateGuest, submitGuestNeuronq } = useLiveHostGuestNeuronqActions({
    sessionId,
    userId: user?.id,
    debateNeuronqEnabled, isGuestUi, permCtxOptional, guestNeuronqCombinedRaw, guestNeuronqReformulated,
    toast, setNeuronqReformulating, setGuestNeuronqReformulated, setNeuronqGuestSubmitting, setGuestNeuronqVolets,
    setGuestNeuronqPanelOpen, setPanels,
  });

  // ── 5. Partage d'écran — déjà dans toggleScreenShare ci-dessus ────────────

  useLiveHostAudioContextInit({ phase, hostSfxCtxRef, hostSfxArmedRef, roomRef });

  const {
    resolveHostPermissionSignal,
    resolveHostJoyKitSignal,
    assertGuestLongiaSignal,
  } = useLiveHostSignalResolution({
    sessionId,
    isGuestUi,
    userId: user?.id,
    permCtxOptional,
    toast,
    setHostPermissionRequests,
    setHostJoyKitRequests,
  });

  // ── Paramètres Studio — handlers ──────────────────────────────────────────
  const {
    handleArenaVbgChange, handleArenaChromaKeyChange, applyLiriAudioFromConfig, persistLiriSceneIndex, openSettings,
    openMessagingPanel, switchVideoDevice, switchAudioDevice, onVpCanvasReady,
  } = useLiveHostStudioSettings({
    sessionId, roomRef, vbgBeforeChromaRef, liriPersistTimeoutRef, setVideoVbg,
    setVideoChromaKey, setLiriAudioScenes, setLiriAudioInitialSceneIndex, setVideoDevices, setAudioDevices,
    setActiveVideoId, setActiveAudioId, setShowMessagingPanel, setShowSettings, setForumTarget,
    setPipStreamFromCanvas,
  });

  useLiveHostLiveScenesRealtime({
    sessionId,
    phase,
    sendSmartboardHostPayload,
    setLiveScenes,
  });

  useLiveHostLiveSessionMetaRealtime({
    sessionId, phase, isGuestUi, setSessionTitle, setStartedAt,
    setLiveEtapes, setSmartboardSceneFlags, setSharedImageGallery, setSharedImageLoop, setShopProducts,
    setProgressivePlayback, setHostMultilang, applyLiriAudioFromConfig,
  });

  // ── Video processor (chroma key, fond virtuel, flou) — invités : flux brut ─
  useVideoProcessor(roomRef, {
    chromaKey:   isGuestUi ? false : videoChromaKey,
    chromaColor: videoChromaColor,
    chromaSens:  videoChromaSens,
    videoVbg:    isGuestUi ? 'none' : videoVbg,
    videoBlur:   isGuestUi ? false : videoBlur,
    customBgUrl: isGuestUi ? '' : videoCustomBgUrl,
    onCanvasReady: onVpCanvasReady,
  });

  const {
    rawCameraPipStream, lhMainRemoteParticipant, lhHostShowsRemoteMain, rightRailShowsLocalHost, showStripLocalHost,
    showHostRightRailVideoFrame, hostRightRailVideoIsCenterCameraOnly,
  } = useLiveHostVideoFrames({
    phase, cameraOn, isGuestUi, antennaSoloMode, promotedId,
    liveParticipants, liveKitMediaEpoch, roomRef, arenaHostCameraCenter, hostRightRailLocalVideoOpen,
    liveRightRailOpen,
  });

  const hostSmartboardPipStream = pipStreamFromCanvas ?? rawCameraPipStream;

  useEffect(() => {
    if (liveParticipants.length === 0 && antennaSoloMode) setAntennaSoloMode(false);
  }, [liveParticipants.length, antennaSoloMode]);

  useLiveHostAntennaFeed({
    isGuestUi, phase, promotedId, liveParticipants, setPanels,
    arenaHostAlertSoundRef, hostSfxCtxRef,
  });

  // ── Mic processor — LIRI Audio Engine (surface principale live ; pas sur l'ancienne Live Arena) ──
  const onLiriLevels = useCallback((lv) => {
    const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (t - liriMeterThrottleRef.current < 70) return;
    liriMeterThrottleRef.current = t;
    setLiriAudioLevels(lv);
  }, []);
  useMicProcessor(roomRef, {
    micGain,
    noiseReduction,
    activeAudioId,
    liriMode: liriAudioMode,
    liriClarity, liriReverb, liriCompression, liriGate, liriLimiter,
    onLevels: onLiriLevels,
  });

  // ── Zone3 callbacks ───────────────────────────────────────────────────────
  const { zone3LowerHand, zone3GrantSeat, zone3RevokeSeat } = useLiveHostZone3({
    zone3RaisedHands,
    setZone3RaisedHands,
    setZone3PrivilegedSeats,
    setPanels,
  });

  // ── Nombre de participants en ligne ──────────────────────────────────────
  const onlineMemberCount = presence.length > 0 ? presence.length : activeMembers.filter(m => m.status === 'online').length;

  // ── Effets vidéo — aligné Arena : canvas (useVideoProcessor) pour flou / VBG / chroma ; CSS pour étalonnage + beauté
  const hostPipNeedsCanvas = videoBlur || videoVbg !== 'none' || videoChromaKey;
  const videoFxActive =
    videoBeauty
    || videoBrightness !== 100
    || videoContrast !== 100
    || videoSaturation !== 100
    || videoHue !== 0
    || hostPipNeedsCanvas;
  const videoFilterCSS = [
    `brightness(${videoBrightness}%)`,
    `contrast(${videoContrast}%)`,
    `saturate(${videoSaturation}%)`,
    `hue-rotate(${videoHue}deg)`,
    videoBeauty ? 'blur(0.3px)' : '',
  ].filter(Boolean).join(' ');

  useLiveHostGlobalStyles(spotlightOn);

  useLiveHostLegacyEffects({
    micOn, neuronQActive, step, activeEtapes, activeMembers,
    timerRef, msBodyIvRef, setTimerSec, setMsBody, setPanels,
    setNeuronQResponses, setNqAnalysis,
  });

  // Apple Dock — membres
  useDock(memberCardsRef, '[data-dock-item]', 'x', 1.35, 120);
  // Scroll animation colonne droite
  const onRightScroll = useCallback((e) => {
    const s = e.currentTarget.scrollTop;
    setHostVidHeight(Math.max(100, LH_HOST_RIGHT_VIDEO_FRAME_REST_H_PX - s * 1.15));
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const { gotoStep, typeScript, toggleNeuronQ } = useLiveHostMasterScriptNav({
    phase, isGuestUi, sessionId, stepCount, step,
    activeEtapes, msMode, neuronQActive, sendSmartboardHostPayload, setStep,
    setNeuronQActive, setNeuronQResponses, setShowMessagingPanel, setModal, setSpotlightOn,
    setMsTyped, stepRef, smartBoardStageRef, stepPersistTimerRef, msTypedIvRef,
  });

  useLiveHostLiriAudioSync({
    isGuestUi, phase, liriAudioScenes, liveScenes, gotoStep,
    sendSmartboardHostPayload,
  });

  const copyInviteLink = useCallback(() => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = sessionId ? `${origin}/live/${sessionId}` : window.location.href;
      navigator.clipboard?.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [sessionId]);

  // ── STOP — finalise l'enregistrement, termine la session en DB, déconnecte, post-prod
  const { handleStop, handleGuestLeave } = useLiveHostSessionStop({
    sessionId, navigate, toast, stopRecording, roomRef,
    setPhase, setStopLiveBusy, stopLiveInProgressRef, liveDisconnectTimerRef, recordingRef,
    mediaRecRef, recFinalizeResolveRef,
  });

  const {
    pushLongiaHostNotif, handleTranscriptFinalForDecisionEngine, toggleLongiaGovernorMode, handleLongiaDecisionAction, mergeLongiaHostSignalActions,
    pushCoachRendersToSmartboard,
  } = useLiveHostLongiaDecisionEngine({
    isGuestUi, phase, sessionId, toast, setPanels,
    sendSmartboardHostPayload, openLongiaHubSignauxHome, setNeuronQActive, setLongiaGovernorModes, chatMessages,
    analyzeLiveContext, smartBoardStageRef, longiaModesRef, arenaHostAlertSoundRef, hostSfxCtxRef,
    longiaBusHostChRef, longiaSessionDigestBroadcastRef, transcriptEngineCooldownRef, visibilitySignalCooldownRef, longiaChatAnalyzeTimerRef,
    longiaLastChatLenRef, longiaSeenRealtimeIdsRef, chatHeuristicCooldownRef, applyLongiaEngineDecisionsRef, flushBusStudentSignalsRef,
  });

  // ── Recherche membres ─────────────────────────────────────────────────────
  const searchResults = searchQuery.trim() ? activeMembers.filter(m=>m.name.toLowerCase().includes(searchQuery.toLowerCase())) : [];

  const {
    meshParticipantsList, addMeshRequest, acceptMeshRequest, revokeMeshParticipant, rejectMeshRequest,
    applyMeshProfile, guestMediaDrive, guestMeshRemainSec,
  } = useLiveHostControlMesh({
    user, isGuestUi, sessionId, phase, permCtxOptional,
    activeMembers, setPanels, setMeshRequests, setMeshGrantsByUserId, setMeshGrantClock,
    setGuestMeshGrant, guestMeshGrant, meshGrantClock, persistControlMeshToConfig, scheduleMeshHostExpiry,
    guestSmartboardBroadcastRef, smartboardChRef, meshHostExpiryTimersRef,
  });

  const {
    journalVisiblePreview, lastJournalPreviewEv, lastHandEv, nqPendingN, nqFirstQ,
    meshPreviewLine, lastPermReq, lastJoyReq, permReqPreviewLine, hostAccessRequestCount,
    curEtape,
  } = useLiveHostSignalPanelPreviews({
    panels, hostNotifFilter, debateNeuronqEnabled, neuronqQuestions, meshRequests,
    hostPermissionRequests, hostJoyKitRequests, activeEtapes, step,
  });

  /** Grille principale : en vue ≤1023px, une colonne — zone centrale (SmartBoard) en premier, puis latéraux. */
  const longiaHubPushesLayout = computeLongiaHubPushesLayout({
    phase, isGuestUi, longiaHubOpen, lhStageFocusLayout, lhLayoutCompact,
  });

  const longiaHubDrawerWidthPx = LONGIA_HOST_HUB_DRAWER_W_PX;

  const {
    hostLiriMobileHostBranch, liveLeftRailCollapsedStrip, liveRightRailCollapsedStrip, liveLeftGuestCollapsedStrip, liveRightGuestCollapsedStrip,
    hostLiveGridStyle, hostCompactColOrder,
  } = useLiveHostLiveGridLayout({
    phase, isGuestUi, lhLayoutCompact, previewProjectorLayout, lhStageFocusLayout,
    longiaHubPushesLayout, arenaHostCameraCenter, arenaGuestFocusCenter, arenaPanelCenter, arenaMembersWallCenter,
    liveLeftRailOpen, liveRightRailOpen, lhNarrowDesktop,
    liveShellGap: liveShell.gap,
    longiaHubDrawerWidthPx,
  });

  const { sync: syncLhMaquetteVideo } = useLiveHostLiriMaquetteVideoSync({
    active: hostLiriMobileHostBranch,
    roomRef,
    mainVideoRef: lhMaquetteMainVideoRef,
    miniVideoRef: lhMaquetteMiniVideoRef,
    promotedIdRef: lhMaquettePromotedIdRef,
  });
  useEffect(() => {
    if (!hostLiriMobileHostBranch) return;
    const id = requestAnimationFrame(() => syncLhMaquetteVideo());
    return () => cancelAnimationFrame(id);
  }, [hostLiriMobileHostBranch, promotedId, liveKitMediaEpoch, syncLhMaquetteVideo]);

  const guestFooterBarBg = 'linear-gradient(170deg,#1a1816,#090a18)';

  const {
    footerWhisperTargets, guestFooterMessagingAllowed, memberModalWhisperPickable, memberModalAllowSchoolLife, guestMicLocked,
    guestCamLocked, guestHandRaiseLocked, guestScreenShareLocked,
  } = useLiveHostGuestCommFlags({
    liveParticipants, user, isGuestUi, sessionCommFlags, guestCapabilityCaps,
    guestCommAllowed, debateArena,
  });

  // Palier gratuit : à 0 s, on termine le live proprement (anti-gel + bascule post-live).
  // Garde ref → ne se déclenche qu'UNE fois. Jamais pour un invité ni en payant (remaining=null).
  useEffect(() => {
    if (phase === PHASE.LIVE && isFreeTier && !isGuestUi && freeTierRemainingSeconds === 0 && !freeTierEndedRef.current) {
      freeTierEndedRef.current = true;
      try {
        toast?.({ title: 'Live gratuit terminé', description: 'Limite de 3 minutes atteinte — passez à un forfait LIRI pour des lives illimités.' });
      } catch { /* noop */ }
      handleStop?.();
    }
  }, [phase, isFreeTier, isGuestUi, freeTierRemainingSeconds, handleStop]);

  const hostArenaLiveBarProps = {
    isGuestUi, phase, guestMicLocked, toggleMic, micOn,
    freeTierRemainingSeconds,
    guestCamLocked, toggleCamera, cameraOn, guestHandRaiseLocked, myHandRaised,
    lowerHand, raiseHand, guestScreenShareLocked, toggleScreenShare, sharingScreen,
    debateViewerRole: debateArena?.myRole,
    applyHostArenaLayoutMode,
    arenaLayoutMode,
    onOpenMobileCameraQr: () => setMobileCameraLinkOpen(true),
    openSettings,
    videoFxActive,
    recording,
    onStopRecording: stopRecording,
    onStartRecording: startRecording,
    recStarting,
    sessionId,
    joyKitGrant: joyKitSignalGrant,
    user,
    addMeshRequest,
    debateNeuronqEnabled,
    neuronqSessionOn: sessionQuickIaFlags.neuronq_enabled !== false,
    guestNeuronqPanelOpen,
    setGuestNeuronqPanelOpen,
    smartboardSceneFlags,
    sbActiveScene,
    smartboardStageRef: smartBoardStageRef,
    onOpenMessagingPanel: openMessagingPanel,
    guestFooterMessagingAllowed,
    step,
    stepCount,
    gotoStep,
    formatTimer: () => formatTimer(timerSec),
    liveDuration, toggleProgressivePlayback, progressivePlayback, spotlightOn, setSpotlightOn,
    focusMode, setFocusMode, sessionFormationId, copyInviteLink, inviteCopied,
  };


  const {
    liveStripDockMembers, guestNotesSceneLabel, guestNotesCurrentSceneRef, onGuestNotesJumpToScene, onGuestCaptureSmartboard,
    guestClassmatesPeers, guestMembersGridSelf,
  } = useLiveHostGuestPeers({
    isGuestUi, phase, liveParticipants, livekitParticipantsMap, liveKitMediaEpoch,
    smartboardSceneFlags, sbActiveScene, step, smartBoardStageRef, user,
    rawCameraPipStream, micOn, cameraOn, guestMicLocked, guestCamLocked,
    toggleMic, toggleCamera,
  });

  // Compteurs des badges de la barre d'activité (rail gauche hôte) — signaux ambiants à
  // traiter : Modération = mains/permissions (panels[0]), Coach = suggestions Longia fraîches
  // (panels[2] filtré COACH, respecte le gouverneur), Interactions = mains levées Zone 3.
  const liveHostActivityBadges = useMemo(() => {
    const moderation = panels?.[0]?.events?.length || 0;
    const interactions = Array.isArray(zone3RaisedHands) ? zone3RaisedHands.length : 0;
    const coach =
      longiaGovernorModes?.[LONGIA_GOVERNOR_MODE.COACH] === false
        ? 0
        : (panels?.[2]?.events || []).filter(
            (ev) =>
              ev?.longiaSourceMode === LONGIA_GOVERNOR_MODE.COACH &&
              String(ev?.msg || '')
                .replace(/^[^:]+ : /, '')
                .trim(),
          ).length;
    return { moderation, coach, interactions };
  }, [panels, zone3RaisedHands, longiaGovernorModes]);

  const phaseLiveSpreadInput = {
    acceptGuestProctorConsent, acceptMeshRequest, activeAudioId, activeEtapes, activeMembers,
    activeVideoId, addMeshRequest, ambientMasterVolume, ambientTracks, antennaSoloMode,
    applyHostArenaLayoutMode, applyMeshProfile, approveWaiting, arenaGuestFocusCenter, arenaGuestFocusUserId,
    arenaHostAlertSoundOn, arenaHostCameraCenter, arenaLayoutMode, hostId: teacherId, arenaMembersWallCenter, arenaPanelCenter,
    arenaPanelUserIds, asideMedia, assertGuestLongiaSignal, audioDevices, broadcastHostCameraCommand,
    camera2FluxParticipants, cameraOn, chatMessages, coachScopeSessionId, curEtape,
    debateAiJudgeBusy, debateAiReportPreview, debateAiWeightPctDisplay, debateArena, debateCloseVoting,
    debateCurrentRoundStatus, debateLiveVoteCounts, debateModBusy, debateNeuronqEnabled, debateOpenVoting,
    debatePatch, debateRunAiJudge, debateVoteBusy, displaySlidesHost, eleveAppChatUrl,
    fetchGuestProctorOwnHistory, fetchProctorCamHistory, floatingReactions, focusMode, forumInput,
    forumTarget, gotoStep, guestCamLocked, guestCapabilityCaps, guestClassmatesPeers,
    guestCommAllowed, guestFooterBarBg, guestInvitePreviewUrl, guestJoyKitDrive, guestLiriAudioSceneName,
    guestLiriAudioSmartboard, guestLivekitInterpreterParticipants, guestLivekitInterpreterVolume, guestLongiaSessionDigests, guestMediaDrive,
    guestMembersGridSelf, guestMeshGrant, guestMeshRemainSec, guestMeshStatusLine, guestMicLocked,
    guestMobileAuthorityUi, guestMultilangBrowserTtsOn, guestMultilangConfig, guestMultilangEdgeTtsOn, guestMultilangRolling,
    guestMultilangViewLang, guestNeuronqCombinedRaw, guestNeuronqPanelOpen, guestNeuronqReformulated, guestNeuronqVolets,
    guestNotesCurrentSceneRef, guestProctorHistoryOpen, guestProctorModalOpen, guestProctorOwnLoading, guestProctorOwnRows,
    guestScreenShareLocked, guestTeacherTranscript, guestTeacherTranscriptPartial, handleArenaChromaKeyChange, handleArenaVbgChange,
    handleGuestLeave, handleGuestPermissionsChange, handleLongiaDecisionAction, handleMobileLayoutPreviewChange, handleQuickCommToggle,
    handleQuickIaToggle, handleQuickSmartboardSceneToggle, handleStop, hostAccessRequestCount, hostArenaLiveBarProps,
    hostBoardRightRailTools, hostCenterStageMirrorRef, hostCompactColOrder, hostJoyKitRequests, hostLiriMobileHostBranch,
    hostLiveGridStyle, hostLiveKitParticipant, hostMonitorBus, hostMultilang, hostNotifFilter,
    hostPermissionRequests, hostRightRailVideoIsCenterCameraOnly, hostSmartboardPipStream, hostVidHeight, hostWbToolsRail,
    hostWhiteboardPagingForRail, isGuestUi, isHostUser, journalVisiblePreview, joyKitSignalGrant,
    kickParticipant, lastHandEv, lastJournalPreviewEv, leftColRef, lhCompactByWidthOnly,
    lhHostShowsRemoteMain, lhLayoutCompact, lhMainRemoteParticipant, lhMaquetteCompositorSlide, lhMaquetteMainDisplay,
    lhMaquetteMainVideoRef, lhMaquetteMiniDisplay, lhMaquetteMiniVideoRef, lhMaquettePipCanvasMainRef, lhMaquettePipCanvasMiniRef,
    lhMaquetteRemoteWaiting, lhMaquetteSlideAreaRef, lhStageFocusLayout, liriAudioInitialSceneIndex, liriAudioLevels,
    liriAudioMode, liriAudioScenes, liriClarity, liriCompression, liriGate,
    liriLimiter, liriReverb, liveDuration, liveKitMediaEpoch, liveKitScreenEpoch,
    liveLeftGuestCollapsedStrip, liveLeftRailCollapsedStrip, liveLeftRailOpen, liveMediaCheck, liveMediaDiagTick,
    liveParticipants, liveRightGuestCollapsedStrip, liveRightRailCollapsedStrip, liveRightRailOpen, liveScenes,
    liveShell, liveStripDockMembers, livekitParticipantsMap, longiaGovernorModes, longiaHubDrawerWidthPx,
    longiaHubOpen, longiaHubPushesLayout, longiaSignalSubDrawer, markNeuronqAnswered, markNeuronqSkipped,
    memberCardsRef, memberModalAllowSchoolLife, memberModalWhisperPickable, memberVideoPreview, mergeLongiaHostSignalActions,
    meshGrantsByUserId, meshPanelOpen, meshParticipantsList, meshPreviewLine, meshRequests,
    micGain, micOn, mmCardVisible, mmView, mobileCameraJoinUrl,
    mobileCameraLinkErr, mobileCameraLinkExpires, mobileCameraLinkLoading, mobileCameraLinkOpen, modal,
    msBody, msMode, msTyped, muteParticipant, navigate,
    neuronQActive, neuronQResponses, neuronqGuestSubmitting, neuronqQuestions, neuronqReformulateGuest,
    neuronqReformulating, noiseReduction, nqAnalysis, nqFirstQ, nqPendingN,
    onDebateAiWeightRangeChange, onGuestCaptureSmartboard, onGuestNotesJumpToScene, onHostWhiteboardToolsRailSync, onRightScroll,
    onSmartboardBroadcast, onlineMemberCount, openLayoutPreviewInHub, openLongiaHubCoachPanel, openLongiaHubControlMesh,
    openLongiaHubWaitingRoom, panels, permReqPreviewLine, persistLiriSceneIndex, phase,
    previewMobileMaquette, previewProjectorLayout, proctorCamHistoryLoading, proctorCamHistoryRows, progressivePlayback,
    promotedId, publishGuestLongiaBusEvent, pushCoachRendersToSmartboard, recError, recording,
    refreshDebateRounds, rejectMeshRequest, rejectWaiting, resolveHandRaise, resolveHostJoyKitSignal,
    resolveHostPermissionSignal, revokeMeshParticipant, rightColRef, rightRailShowsLocalHost, roomRef,
    sbActiveScene, searchQuery, searchResults, sendChatMessage, sendWhisper,
    sessionCommFlags, sessionFormationId, sessionGuestPermissions, sessionId, sessionQuickIaFlags,
    sessionTitle, setAmbientMasterVolume, setAntennaSoloMode, setArenaHostAlertSoundOn, setDebateVoteBusy,
    setForumInput, setForumTarget, setGuestLivekitInterpreterVolume, setGuestMultilangBrowserTtsOnPersist, setGuestMultilangEdgeTtsOnPersist,
    setGuestMultilangViewLang, setGuestNeuronqPanelOpen, setGuestNeuronqReformulated, setGuestNeuronqVolets, setGuestProctorHistoryOpen,
    setGuestProctorModalOpen, setHostMultilangField, setHostNotifFilter, setHostRightRailLocalVideoOpen, setLiriAudioMode,
    setLiriClarity, setLiriCompression, setLiriGate, setLiriLimiter, setLiriReverb,
    setLiveLeftRailOpen, setLiveRightRailOpen, setLongiaHubOpen, setLongiaSignalSubDrawer, setMemberVideoPreview,
    setMeshPanelOpen, setMicGain, setMmCardVisible, setMmView, setMobileCameraLinkOpen,
    setModal, setMsMode, setNoiseReduction, setPreviewMobileMaquette, setPreviewProjectorLayout,
    setPromotedId, setRecError, setSbActiveScene, setSearchQuery, setShowMessagingPanel,
    setShowSettings, setVideoBeauty, setVideoBlur, setVideoBrightness, setVideoChromaColor,
    setVideoChromaSens, setVideoContrast, setVideoCustomBgUrl, setVideoHue, setVideoSaturation,
    sharedImageGallery, sharedImageLoop, sharingScreen, shopProducts, showHostRightRailVideoFrame,
    showMessagingPanel, showSettings, showStripLocalHost, smartBoardStageRef, smartboardSceneFlags,
    spotlightOn, step, stepCount, stopLiveBusy, stopRecording,
    submitGuestNeuronq, supabase, switchAudioDevice, switchVideoDevice, teacherId,
    toast, toggleCamera, toggleLayoutPreviewHubPanel, toggleLongiaGovernorMode, toggleMic,
    toggleNeuronQ, toggleScreenShare, tryStartLiveKitPlayback, user, videoBeauty,
    videoBlur, videoBrightness, videoChromaColor, videoChromaKey, videoChromaSens,
    videoContrast, videoCustomBgUrl, videoDevices, videoFilterCSS, videoFxActive,
    videoHue, videoSaturation, videoVbg, waitingEntries, whisperThreads,
    zone3GrantSeat, zone3LowerHand, zone3PrivilegedSeats, zone3RaisedHands, zone3RevokeSeat,
    liveHostActivityBadges,
  };

  const liveHostLongiaSignalHubSpreadProps = buildLiveHostLongiaSignalHubSpreadProps(phaseLiveSpreadInput);
  const liveHostLongiaSignalHub = (
    <LiveHostLongiaSignalHub {...liveHostLongiaSignalHubSpreadProps} />
  );

  const liveHostPreviewOverlaysSpreadProps = buildLiveHostPreviewOverlaysSpreadProps(phaseLiveSpreadInput);
  const liveHostGridShellSpreadProps = buildLiveHostGridShellSpreadProps(phaseLiveSpreadInput);
  const liveHostLiveCenterColumnSpreadProps = buildLiveHostLiveCenterColumnSpreadProps(phaseLiveSpreadInput);
  const liveHostPostGridSlotsSpreadProps = {
    ...buildLiveHostPostGridSlotsSpreadPropsWithoutHub(phaseLiveSpreadInput),
    liveHostLongiaSignalHub,
  };


  // ── Écrans de phase ───────────────────────────────────────────────────────
  if (phase === PHASE.LOADING || phase === PHASE.CONNECTING) {
    const msg = phase === PHASE.LOADING ? 'Chargement de la session…' : 'Connexion à la salle vidéo…';
    return (
      <LiveHostLoadingScreen
        message={msg}
        phaseError={phaseError}
        liveShell={liveShell}
        liriLiveUiLabel={liriLiveUiLabel}
      />
    );
  }

  if (phase === PHASE.ERROR) {
    return (
      <LiveHostInvalidSessionScreen
        phaseError={phaseError}
        liveShell={liveShell}
        liriLiveUiLabel={liriLiveUiLabel}
        onOpenStudio={() => navigate('/studio/live')}
      />
    );
  }

  if (phase === PHASE.ENDED) {
    return (
      <LiveHostEndedScreen
        isGuestUi={isGuestUi}
        liveShell={liveShell}
        liriLiveUiLabel={liriLiveUiLabel}
        onContinue={() => (isGuestUi ? navigate('/app') : sessionId ? navigate(`/studio/live-post/${sessionId}`) : navigate(-1))}
      />
    );
  }

  // ── Mobile phone render — TikTok style (< 640 px) ────────────────────────
  if (isMobilePhone) {
    // SmartBoard réel injecté comme slot fond plein écran
    const mobileSmartboardSlot = (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <LiveHostSmartBoardStage
          ref={smartBoardStageRef}
          displaySlides={displaySlidesHost}
          sceneFlags={smartboardSceneFlags}
          sharedImageGallery={sharedImageGallery}
          sharedImageLoop={sharedImageLoop}
          shopProducts={shopProducts}
          spotlight={spotlightOn}
          sharingScreen={sharingScreen}
          roomRef={roomRef}
          phaseLive={phase === PHASE.LIVE}
          onBroadcast={onSmartboardBroadcast}
          liveKitScreenEpoch={liveKitScreenEpoch}
          camera2FluxParticipants={camera2FluxParticipants}
          progressivePlayback={progressivePlayback}
          pipStream={hostSmartboardPipStream}
          sessionId={sessionId}
          viewerMode={false}
          sceneDockPlacement="footer"
          hideEmbeddedWhiteboardToolsRail
        />
      </div>
    );

    return (
      <LiveHostMobileShell
        isGuestUi={isGuestUi}
        sessionTitle={sessionTitle}
        phase={phase}
        liveDuration={liveDuration}
        onlineMemberCount={onlineMemberCount}
        step={step}
        stepCount={stepCount}
        gotoStep={gotoStep}
        handleStop={handleStop}
        stopLiveBusy={stopLiveBusy}
        micOn={micOn}
        toggleMic={toggleMic}
        cameraOn={cameraOn}
        toggleCamera={toggleCamera}
        isRecording={recording}
        startRecording={startRecording}
        stopRecording={stopRecording}
        recStarting={recStarting}
        liveParticipants={liveParticipants}
        livekitParticipantsMap={livekitParticipantsMap}
        user={user}
        hostLiveKitParticipant={hostLiveKitParticipant}
        liveKitMediaEpoch={liveKitMediaEpoch}
        muteParticipant={muteParticipant}
        kickParticipant={kickParticipant}
        smartBoardStageRef={smartBoardStageRef}
        hostSmartboardPipStream={hostSmartboardPipStream}
        chatMessages={chatMessages}
        sendChatMessage={sendChatMessage}
        copyInviteLink={copyInviteLink}
        inviteCopied={inviteCopied}
        neuronqQuestions={neuronqQuestions}
        activeEtapes={activeEtapes}
        curEtape={curEtape}
        liveShell={liveShell}
        smartboardSlot={mobileSmartboardSlot}
        ambientTracks={ambientTracks}
        ambientMasterVolume={ambientMasterVolume}
        lastHandEv={lastHandEv}
        hostAccessRequestCount={hostAccessRequestCount}
        resolveHandRaise={resolveHandRaise}
        zone3RaisedHands={zone3RaisedHands}
        waitingEntries={waitingEntries}
        approveWaiting={approveWaiting}
        rejectWaiting={rejectWaiting}
        hostPermissionRequests={hostPermissionRequests}
        resolveHostPermissionSignal={resolveHostPermissionSignal}
        hostJoyKitRequests={hostJoyKitRequests}
        resolveHostJoyKitSignal={resolveHostJoyKitSignal}
        floatingReactions={floatingReactions}
        markNeuronqAnswered={markNeuronqAnswered}
        markNeuronqSkipped={markNeuronqSkipped}
        guestProctorModalOpen={guestProctorModalOpen}
        acceptGuestProctorConsent={acceptGuestProctorConsent}
        whisperThreads={whisperThreads}
        sendWhisper={sendWhisper}
        smartboardSceneFlags={smartboardSceneFlags}
        sbActiveScene={sbActiveScene}
        setSbActiveScene={setSbActiveScene}
        spotlightOn={spotlightOn}
        toggleSpotlight={() => setSpotlightOn((v) => !v)}
        neuronQActive={neuronQActive}
        toggleNeuronQ={toggleNeuronQ}
        setAmbientMasterVolume={setAmbientMasterVolume}
      />
    );
  }

  // ── Render desktop/tablet ─────────────────────────────────────────────────
  return (
    <LiveHostLiveSessionChrome
      isGuestUi={isGuestUi}
      previewMobileMaquette={previewMobileMaquette}
      liveShell={liveShell}
      lhLayoutCompact={lhLayoutCompact}
    >

      <LiveHostPreviewOverlays {...liveHostPreviewOverlaysSpreadProps} />

      {/* Grille live : gauche | centre (bandeau + SmartBoard + pied) | droite — ref miroir DOM emulateur mobile */}
      <LiveHostLiveGridShell ref={hostLiveGridRef} {...liveHostGridShellSpreadProps}>
        <LiveHostLiveCenterColumn
          ref={hostCenterStageMirrorRef}
          {...liveHostLiveCenterColumnSpreadProps}
        />
      </LiveHostLiveGridShell>

      <LiveHostLivePostGridSlots {...liveHostPostGridSlotsSpreadProps} />
    </LiveHostLiveSessionChrome>
  );
}
