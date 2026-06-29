/**
 * SmartBoard « écran intelligent » pour LiveHostPage : compositor + sync broadcast (aligné LiveArena).
 */

import React, {
  useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo,
} from 'react';
import { RoomEvent, Track } from 'livekit-client';
import SmartBoardCompositor from '@/components/liri/live-room/SmartBoardCompositor';
import { mergeSmartboardSceneFlags, navigatorSceneIds } from '@/lib/smartboardNavigatorScenes';
import { getCameraTrackByIdentity } from '@/lib/livekitCameraUtils';
import { sanitizeAnnotationStrokesForBroadcast, ANNOTATION_BROADCAST_MAX_STROKES } from '@/lib/annotationStrokes';
import {
  whiteboardBroadcastPatch,
  mergeWhiteboardFromPayload,
  normalizeWhiteboardPages,
  WHITEBOARD_MAX_PAGES,
} from '@/lib/whiteboardPagesSync';
import { useToast } from '@/components/ui/use-toast';
import { captureSmartboardStageToPngBlob } from '@/lib/captureSmartboardStageSnapshot';
import { uploadSmartboardCanvasImage } from '@/lib/uploadSmartboardCanvasImage';

const LiveHostSmartBoardStage = forwardRef(function LiveHostSmartBoardStage(
  {
    displaySlides,
    sceneFlags,
    sharedImageGallery = [],
    sharedImageLoop: sharedLoopProp = false,
    shopProducts = [],
    spotlight = false,
    sharingScreen = false,
    roomRef,
    phaseLive = false,
    onBroadcast,
    liveKitScreenEpoch = 0,
    camera2FluxParticipants = [],
    onShareScreenRequest,
    /** Lecture progressive SmartBoard (sync invités) — piloté par l'hôte */
    progressivePlayback = true,
    /** Flux vidéo hôte pour PiP dans le compositor (piste caméra LiveKit courante) */
    pipStream = null,
    /** Pour réinitialiser annotations / modale / cam2 lors d'un changement de session */
    sessionId = null,
    /** Invité : pas de navigation locale, sync depuis le broadcast hôte */
    viewerMode = false,
    /**
     * 'right' = dock scènes vertical sur le bord droit du compositor (défaut).
     * 'footer' = dock masqué ici — le parent (LiveHostPage) affiche les boutons dans sa barre footer.
     */
    sceneDockPlacement = 'right',
    /** Appelé quand la scène active change — permet au parent de synchroniser son état. */
    onSceneChange = null,
    /**
     * Hôte LiveHost : masque le rail outils flottant sur le canevas — le parent l'affiche dans la colonne droite.
     */
    hideEmbeddedWhiteboardToolsRail = false,
    /**
     * Sync pagination + traits page active vers le rail parent (ex. `LiveWhiteboardToolsSidebar` hors compositeur).
     */
    onHostWhiteboardToolsRailSync = null,
    /**
     * Scène active au MONTAGE (défaut 'smartboard' = comportement LiveHostPage,
     * inchangé). La consultation passe 'board' pour ouvrir directement sur le
     * tableau (carreaux), au lieu de retomber sur la 1re scène activée (diapo vide).
     */
    initialScene = 'smartboard',
  },
  ref,
) {
  const { toast } = useToast();

  const [activeScene, setActiveScene] = useState(initialScene);
  const [slideIndex, setSlideIndex] = useState(0);
  const [nativeSlideIndex, setNativeSlideIndex] = useState(0);
  const [importSlideIndex, setImportSlideIndex] = useState(0);
  const [sharedImageIdx, setSharedImageIdx] = useState(0);
  const [sharedImageLoop, setSharedImageLoop] = useState(sharedLoopProp);
  const [annotationStrokes, setAnnotationStrokes] = useState([]);
  const [whiteboardPages, setWhiteboardPages] = useState(() => [[]]);
  const [whiteboardPageIndex, setWhiteboardPageIndex] = useState(0);
  const [sbImageModal, setSbImageModal] = useState(null);
  const [sbTacticalSync, setSbTacticalSync] = useState(null);
  /** Scène "app secure" (URL + état iframe) — synchronisée hôte -> invités. */
  const [secureAppShareState, setSecureAppShareState] = useState(null);
  const [camera2Source, setCamera2Source] = useState(null);
  const [camera2Active, setCamera2Active] = useState(false);
  /** Partage d'écran d'un participant distant sur le <video> du compositor (hôte ou invité). */
  const [remoteScreenShareActive, setRemoteScreenShareActive] = useState(false);
  /** Invité : overlay tactique reçu du broadcast hôte (équivalent LiveArena sbTacticalSyncRemote). */
  const [viewerRemoteTacticalSync, setViewerRemoteTacticalSync] = useState(null);

  const mergedFlags = useMemo(() => mergeSmartboardSceneFlags(sceneFlags), [sceneFlags]);

  const nativeSlides = useMemo(
    () => (displaySlides || []).filter((s) => s?.ia_data),
    [displaySlides],
  );
  const importSlides = useMemo(
    () => (displaySlides || []).filter((s) => s && !s.ia_data),
    [displaySlides],
  );

  const screenVideoRef = useRef(null);
  const camera2VideoRef = useRef(null);
  const camera2LocalStreamRef = useRef(null);
  /** Cadre bordé du compositor — capture PNG pour le cahier invité. */
  const stageCaptureSurfaceRef = useRef(null);

  const slideIndexRef = useRef(0);
  const activeSceneRef = useRef(initialScene);
  // Garde : l'auto-projection de la scène active ne s'exécute qu'une fois (issue #3).
  const autoProjectedRef = useRef(false);
  const nativeSlideIndexRef = useRef(0);
  const importSlideIndexRef = useRef(0);
  const sharedImageIdxRef = useRef(0);
  const sharedImageLoopRef = useRef(false);
  const progressivePlaybackRef = useRef(true);
  const annotationStrokesRef = useRef([]);
  const whiteboardPagesRef = useRef([[]]);
  const whiteboardPageIndexRef = useRef(0);
  /** Page active (sync broadcast / refs invité). */
  const whiteboardStrokesRef = useRef([]);
  const sbImageModalRef = useRef(null);
  const sbTacticalSyncRef = useRef(null);
  const secureAppShareStateRef = useRef(null);
  const camera2SourceRef = useRef(null);
  const prevSessionIdRef = useRef(null);
  /** Évite de réécraser la scène (ex. Images) quand sharingScreen reste true mais viewerMode / deps changent. */
  const prevSharingScreenRef = useRef(sharingScreen);
  /** Dernier état « partage local » vu dans les handlers LiveKit (évite stale closure). */
  const sharingScreenPropRef = useRef(sharingScreen);
  useEffect(() => { sharingScreenPropRef.current = sharingScreen; }, [sharingScreen]);

  useEffect(() => { slideIndexRef.current = slideIndex; }, [slideIndex]);
  useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);
  useEffect(() => { nativeSlideIndexRef.current = nativeSlideIndex; }, [nativeSlideIndex]);
  useEffect(() => { importSlideIndexRef.current = importSlideIndex; }, [importSlideIndex]);
  useEffect(() => { sharedImageIdxRef.current = sharedImageIdx; }, [sharedImageIdx]);
  useEffect(() => { sharedImageLoopRef.current = sharedImageLoop; }, [sharedImageLoop]);
  useEffect(() => { progressivePlaybackRef.current = progressivePlayback; }, [progressivePlayback]);

  const scheduleHostToolsRailSync = useCallback(() => {
    if (typeof onHostWhiteboardToolsRailSync !== 'function') return;
    const pages = whiteboardPagesRef.current;
    const idx = whiteboardPageIndexRef.current;
    const strokes = pages[idx] || [];
    queueMicrotask(() => {
      onHostWhiteboardToolsRailSync({
        strokes,
        pageIndex: idx,
        pageCount: Math.max(1, pages.length),
      });
    });
  }, [onHostWhiteboardToolsRailSync]);

  useEffect(() => {
    if (activeScene === 'board' && typeof onHostWhiteboardToolsRailSync === 'function') {
      scheduleHostToolsRailSync();
    }
  }, [activeScene, onHostWhiteboardToolsRailSync, scheduleHostToolsRailSync]);
  useEffect(() => { annotationStrokesRef.current = annotationStrokes; }, [annotationStrokes]);
  useEffect(() => { whiteboardPagesRef.current = whiteboardPages; }, [whiteboardPages]);
  useEffect(() => { whiteboardPageIndexRef.current = whiteboardPageIndex; }, [whiteboardPageIndex]);

  const whiteboardStrokes = whiteboardPages[whiteboardPageIndex] ?? [];
  useEffect(() => {
    const cur = whiteboardPages[whiteboardPageIndex] ?? [];
    whiteboardStrokesRef.current = cur;
  }, [whiteboardPages, whiteboardPageIndex]);
  useEffect(() => { sbImageModalRef.current = sbImageModal; }, [sbImageModal]);
  useEffect(() => { sbTacticalSyncRef.current = sbTacticalSync; }, [sbTacticalSync]);
  useEffect(() => { secureAppShareStateRef.current = secureAppShareState; }, [secureAppShareState]);
  useEffect(() => { camera2SourceRef.current = camera2Source; }, [camera2Source]);

  useEffect(() => {
    setSharedImageLoop(sharedLoopProp);
  }, [sharedLoopProp]);

  useEffect(() => {
    setNativeSlideIndex((i) => Math.min(i, Math.max(0, nativeSlides.length - 1)));
  }, [nativeSlides.length]);
  useEffect(() => {
    setImportSlideIndex((i) => Math.min(i, Math.max(0, importSlides.length - 1)));
  }, [importSlides.length]);

  const safeNativeIdx = Math.min(nativeSlideIndex, Math.max(0, nativeSlides.length - 1));
  const safeImportIdx = Math.min(importSlideIndex, Math.max(0, importSlides.length - 1));

  const parallaxSlide = useMemo(() => {
    if (activeScene === 'smartboard') return nativeSlides[safeNativeIdx] || null;
    if (activeScene === 'diapo') return importSlides[safeImportIdx] || null;
    const combinedIdx = Math.min(slideIndex, Math.max(0, (displaySlides || []).length - 1));
    return (displaySlides || [])[combinedIdx] || null;
  }, [activeScene, nativeSlides, importSlides, safeNativeIdx, safeImportIdx, displaySlides, slideIndex]);

  const slideParallaxKey = `${nativeSlideIndex}-${importSlideIndex}-${slideIndex}`;
  const slideAnnotationKey =
    activeScene === 'smartboard' || activeScene === 'diapo'
      ? `${activeScene}-${slideParallaxKey}`
      : null;
  const slideAnnotationContextRef = useRef(null);

  useEffect(() => {
    if (!phaseLive) return;
    sbTacticalSyncRef.current = null;
    setSbTacticalSync(null);
    queueMicrotask(() => onBroadcast?.({ sbTacticalSync: null }));
  }, [slideParallaxKey, activeScene, phaseLive, onBroadcast]);

  useEffect(() => {
    if (viewerMode) return;
    if (slideAnnotationKey === null) return;
    if (slideAnnotationContextRef.current === null) {
      slideAnnotationContextRef.current = slideAnnotationKey;
      return;
    }
    if (slideAnnotationContextRef.current === slideAnnotationKey) return;
    slideAnnotationContextRef.current = slideAnnotationKey;
    setAnnotationStrokes([]);
    annotationStrokesRef.current = [];
    queueMicrotask(() => onBroadcast?.({ annotationStrokes: [] }));
  }, [slideAnnotationKey, viewerMode, onBroadcast]);

  useEffect(() => {
    setSharedImageIdx((i) => Math.min(i, Math.max(0, Math.max(0, sharedImageGallery.length - 1))));
  }, [sharedImageGallery.length]);

  const sharedImageSrc = useMemo(() => {
    const g = sharedImageGallery;
    if (!g?.length) return '';
    const i = Math.min(sharedImageIdx, g.length - 1);
    return g[i]?.url || '';
  }, [sharedImageGallery, sharedImageIdx]);

  useEffect(() => {
    if (!phaseLive || activeScene !== 'image' || !sharedImageLoop || sharedImageGallery.length < 2) {
      return undefined;
    }
    const t = window.setInterval(() => {
      setSharedImageIdx((i) => {
        const next = (i + 1) % sharedImageGallery.length;
        queueMicrotask(() => onBroadcast?.({ sharedImageIdx: next }));
        return next;
      });
    }, 7000);
    return () => window.clearInterval(t);
  }, [phaseLive, activeScene, sharedImageLoop, sharedImageGallery.length, onBroadcast]);

  useEffect(() => {
    if (viewerMode) return;
    const ids = navigatorSceneIds(mergedFlags);
    if (ids.length > 0 && !ids.includes(activeScene)) {
      setActiveScene(ids[0]);
    }
  }, [mergedFlags, nativeSlides.length, importSlides.length, activeScene, viewerMode]);

  useEffect(() => {
    if (viewerMode) {
      prevSharingScreenRef.current = sharingScreen;
      return;
    }
    const prev = prevSharingScreenRef.current;
    if (sharingScreen === prev) return;
    prevSharingScreenRef.current = sharingScreen;
    if (sharingScreen && !prev) {
      setActiveScene('screen');
      return;
    }
    if (!sharingScreen && prev) {
      setActiveScene((p) => (p === 'screen' ? 'smartboard' : p));
    }
  }, [sharingScreen, viewerMode]);

  /** Attache le flux partage-écran LiveKit au <video> du compositor */
  useEffect(() => {
    if (!phaseLive) return undefined;
    const room = roomRef?.current;
    if (!room) return undefined;

    const attachIfNeeded = (track) => {
      if (track.source !== Track.Source.ScreenShare) return;
      if (screenVideoRef.current) track.attach(screenVideoRef.current);
    };

    const onPublished = (pub) => {
      const track = pub.track;
      if (!track || pub.source !== Track.Source.ScreenShare) return;
      attachIfNeeded(track);
    };

    room.on(RoomEvent.LocalTrackPublished, onPublished);

    const tick = () => {
      const screenPub = room.localParticipant?.getTrackPublication(Track.Source.ScreenShare);
      if (screenPub?.track && screenVideoRef.current) {
        screenPub.track.attach(screenVideoRef.current);
      }
    };
    const t = requestAnimationFrame(() => { tick(); });

    return () => {
      cancelAnimationFrame(t);
      room.off(RoomEvent.LocalTrackPublished, onPublished);
    };
  }, [phaseLive, roomRef, liveKitScreenEpoch]);

  /**
   * Pistes ScreenShare distantes → <video> du compositor (invité : formateur ; hôte : élève qui partage).
   * Priorité au partage local : tant que `sharingScreen` est vrai, on n'accroche pas l'écran d'un remote sur ce ref.
   */
  useEffect(() => {
    if (!phaseLive || !roomRef?.current) return undefined;
    const room = roomRef.current;

    const refreshRemoteScreenActive = () => {
      if (sharingScreenPropRef.current) {
        setRemoteScreenShareActive(false);
        return;
      }
      let any = false;
      room.remoteParticipants.forEach((p) => {
        p.getTrackPublications().forEach((pub) => {
          if (pub.source === Track.Source.ScreenShare && pub.track) any = true;
        });
      });
      setRemoteScreenShareActive(any);
    };

    const onSub = (track, _pub, participant) => {
      if (!track || track.source !== Track.Source.ScreenShare) return;
      if (participant.identity === room.localParticipant.identity) return;
      // (Retiré : `if (sharingScreenPropRef.current) return;` — bloquait TOUT écran distant
      // dès que l'hôte partageait le sien, cassant les modes collaboratif/débat. La garde
      // d'identité ci-dessus suffit déjà à éviter le doublon du partage LOCAL.)
      if (screenVideoRef.current) {
        track.attach(screenVideoRef.current);
        setRemoteScreenShareActive(true);
      }
    };

    const onUnsub = (track, _pub, participant) => {
      if (!track || track.source !== Track.Source.ScreenShare) return;
      try {
        const els = track.detach();
        els.forEach((el) => { try { el.remove(); } catch { /* ignore */ } });
      } catch { /* ignore */ }
      queueMicrotask(() => {
        if (sharingScreenPropRef.current) {
          setRemoteScreenShareActive(false);
          return;
        }
        let attached = false;
        room.remoteParticipants.forEach((p) => {
          p.getTrackPublications().forEach((pub) => {
            if (
              pub.source === Track.Source.ScreenShare
              && pub.track
              && screenVideoRef.current
              && !attached
            ) {
              pub.track.attach(screenVideoRef.current);
              attached = true;
            }
          });
        });
        setRemoteScreenShareActive(attached);
      });
    };

    room.on(RoomEvent.TrackSubscribed, onSub);
    room.on(RoomEvent.TrackUnsubscribed, onUnsub);

    queueMicrotask(() => {
      if (sharingScreenPropRef.current) {
        setRemoteScreenShareActive(false);
        return;
      }
      room.remoteParticipants.forEach((p) => {
        p.getTrackPublications().forEach((pub) => {
          if (pub.source === Track.Source.ScreenShare && pub.track) {
            onSub(pub.track, pub, p);
          }
        });
      });
      refreshRemoteScreenActive();
    });

    return () => {
      room.off(RoomEvent.TrackSubscribed, onSub);
      room.off(RoomEvent.TrackUnsubscribed, onUnsub);
      setRemoteScreenShareActive(false);
    };
  }, [phaseLive, roomRef, liveKitScreenEpoch, sharingScreen]);

  const clearCamera2LocalStream = useCallback(() => {
    if (camera2LocalStreamRef.current) {
      camera2LocalStreamRef.current.getTracks().forEach((tr) => tr.stop());
      camera2LocalStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (prevSessionIdRef.current === null) {
      prevSessionIdRef.current = sessionId;
      return;
    }
    if (prevSessionIdRef.current === sessionId) return;
    prevSessionIdRef.current = sessionId;
    setAnnotationStrokes([]);
    annotationStrokesRef.current = [];
    const blank = [[]];
    setWhiteboardPages(blank);
    setWhiteboardPageIndex(0);
    whiteboardPagesRef.current = blank;
    whiteboardPageIndexRef.current = 0;
    whiteboardStrokesRef.current = [];
    setSbImageModal(null);
    sbImageModalRef.current = null;
    setSbTacticalSync(null);
    sbTacticalSyncRef.current = null;
    setSecureAppShareState(null);
    secureAppShareStateRef.current = null;
    setViewerRemoteTacticalSync(null);
    clearCamera2LocalStream();
    setCamera2Source(null);
    camera2SourceRef.current = null;
    setCamera2Active(false);
    if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
    queueMicrotask(() => onBroadcast?.({
      annotationStrokes: [],
      ...whiteboardBroadcastPatch([[]], 0),
      sbImageModal: null,
      sbTacticalSync: null,
      secureAppShareState: null,
      camera2Source: null,
    }));
  }, [sessionId, onBroadcast, clearCamera2LocalStream]);

  const broadcastCamera2 = useCallback((src) => {
    camera2SourceRef.current = src;
    queueMicrotask(() => onBroadcast?.({ camera2Source: src }));
  }, [onBroadcast]);

  const applyCamera2FromSpec = useCallback(async (spec) => {
    if (!spec || typeof spec !== 'object') return;
    const room = roomRef?.current;

    if (spec.type === 'remote_camera' && spec.identity && room) {
      clearCamera2LocalStream();
      if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
      setCamera2Source(spec);
      const t = getCameraTrackByIdentity(room, spec.identity);
      if (t && camera2VideoRef.current) {
        camera2VideoRef.current.srcObject = new MediaStream([t.mediaStreamTrack]);
        camera2VideoRef.current.play?.().catch(() => {});
        setCamera2Active(true);
      } else {
        setCamera2Active(false);
      }
      setActiveScene('camera2');
      broadcastCamera2(spec);
      return;
    }

    if (spec.type === 'local_display') {
      clearCamera2LocalStream();
      if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return;
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        camera2LocalStreamRef.current = stream;
        if (camera2VideoRef.current) {
          camera2VideoRef.current.srcObject = stream;
          camera2VideoRef.current.play?.().catch(() => {});
        }
        const source = { type: 'local_display' };
        setCamera2Source(source);
        setCamera2Active(true);
        setActiveScene('camera2');
        broadcastCamera2(source);
        const vt = stream.getVideoTracks?.()[0];
        if (vt) {
          vt.onended = () => {
            clearCamera2LocalStream();
            if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
            setCamera2Active(false);
            setCamera2Source(null);
            camera2SourceRef.current = null;
            broadcastCamera2(null);
          };
        }
      } catch (err) {
        console.warn('[LiveHostSmartBoard] Cam2 display:', err?.message);
      }
      return;
    }

    if (spec.type === 'local_aux') {
      clearCamera2LocalStream();
      if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
      try {
        let videoConstraints;
        if (spec.deviceId) {
          videoConstraints = { deviceId: { exact: spec.deviceId } };
        } else if (spec.facingMode === 'user' || spec.facingMode === 'environment') {
          videoConstraints = { facingMode: spec.facingMode };
        } else {
          videoConstraints = { facingMode: 'environment' };
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        camera2LocalStreamRef.current = stream;
        if (camera2VideoRef.current) {
          camera2VideoRef.current.srcObject = stream;
          camera2VideoRef.current.play?.().catch(() => {});
        }
        const source = { type: 'local_aux' };
        if (spec.deviceId) source.deviceId = spec.deviceId;
        else source.facingMode = spec.facingMode === 'user' ? 'user' : 'environment';
        setCamera2Source(source);
        setCamera2Active(true);
        setActiveScene('camera2');
        broadcastCamera2(source);
      } catch (err) {
        console.warn('[LiveHostSmartBoard] Cam2:', err?.message);
      }
    }
  }, [roomRef, clearCamera2LocalStream, broadcastCamera2]);

  const handleCamera2Start = useCallback((arg) => {
    if (typeof arg === 'string') {
      void applyCamera2FromSpec({ type: 'local_aux', deviceId: arg });
      return;
    }
    if (arg && typeof arg === 'object') void applyCamera2FromSpec(arg);
  }, [applyCamera2FromSpec]);

  useEffect(() => {
    if (!phaseLive || !roomRef?.current) return undefined;
    const onLeft = (participant) => {
      const cs = camera2SourceRef.current;
      if (cs?.type === 'remote_camera' && cs.identity === participant.identity) {
        clearCamera2LocalStream();
        if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
        setCamera2Active(false);
        setCamera2Source(null);
        camera2SourceRef.current = null;
        queueMicrotask(() => onBroadcast?.({ camera2Source: null }));
      }
    };
    const room = roomRef.current;
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    return () => { room.off(RoomEvent.ParticipantDisconnected, onLeft); };
  }, [phaseLive, roomRef, clearCamera2LocalStream, onBroadcast]);

  useEffect(() => {
    if (!phaseLive || !roomRef?.current || activeScene !== 'camera2') return undefined;
    const src = camera2Source;
    if (!src || src.type !== 'remote_camera') return undefined;
    const room = roomRef.current;
    const attach = () => {
      const t = getCameraTrackByIdentity(room, src.identity);
      if (t && camera2VideoRef.current) {
        camera2VideoRef.current.srcObject = new MediaStream([t.mediaStreamTrack]);
        camera2VideoRef.current.play?.().catch(() => {});
        setCamera2Active(true);
      } else if (camera2VideoRef.current) {
        camera2VideoRef.current.srcObject = null;
        setCamera2Active(false);
      }
    };
    attach();
    const onSub = (_track, publication, participant) => {
      if (publication.source === Track.Source.Camera && participant.identity === src.identity) {
        attach();
      }
    };
    room.on(RoomEvent.TrackSubscribed, onSub);
    return () => { room.off(RoomEvent.TrackSubscribed, onSub); };
  }, [phaseLive, roomRef, activeScene, camera2Source]);

  useEffect(() => {
    if (activeScene !== 'camera2') return;
    const t = camera2Source?.type;
    if (t !== 'local_aux' && t !== 'local_display') return;
    const stream = camera2LocalStreamRef.current;
    if (!stream || !camera2VideoRef.current) return;
    if (!camera2VideoRef.current.srcObject) {
      camera2VideoRef.current.srcObject = stream;
      camera2VideoRef.current.play?.().catch(() => {});
      setCamera2Active(true);
    }
  }, [activeScene, camera2Source]);

  const changeScene = useCallback((scene) => {
    setActiveScene(scene);
    onSceneChange?.(scene);
    queueMicrotask(() => onBroadcast?.({ activeScene: scene }));
  }, [onBroadcast, onSceneChange]);

  // ── Auto-projection de la scène active à l'ouverture (issue #3) ──────────────
  // Hybride : si une scène `is_active=true` existe, on la projette d'emblée
  // (mode smartboard si elle a `ia_data`, sinon mode diapo) et on diffuse aux
  // invités. Sinon on laisse l'état au repos (projection manuelle par l'hôte).
  // Ne s'exécute qu'une fois (autoProjectedRef) et jamais côté invité (viewerMode).
  useEffect(() => {
    if (viewerMode || autoProjectedRef.current) return;
    const list = displaySlides || [];
    if (list.length === 0) return;
    const activeSlide = list.find((s) => s && s.is_active === true);
    if (!activeSlide) { autoProjectedRef.current = true; return; }
    autoProjectedRef.current = true;
    if (activeSlide.ia_data) {
      const idx = Math.max(0, nativeSlides.findIndex((s) => s.id === activeSlide.id));
      activeSceneRef.current = 'smartboard';
      nativeSlideIndexRef.current = idx;
      setActiveScene('smartboard');
      setNativeSlideIndex(idx);
      queueMicrotask(() => onBroadcast?.({ activeScene: 'smartboard', nativeSlideIndex: idx }));
    } else {
      const idx = Math.max(0, importSlides.findIndex((s) => s.id === activeSlide.id));
      activeSceneRef.current = 'diapo';
      importSlideIndexRef.current = idx;
      setActiveScene('diapo');
      setImportSlideIndex(idx);
      queueMicrotask(() => onBroadcast?.({ activeScene: 'diapo', importSlideIndex: idx }));
    }
  }, [viewerMode, displaySlides, nativeSlides, importSlides, onBroadcast]);

  const handleSbTacticalSync = useCallback((payload) => {
    sbTacticalSyncRef.current = payload;
    setSbTacticalSync(payload);
    queueMicrotask(() => onBroadcast?.({ sbTacticalSync: payload }));
  }, [onBroadcast]);

  const openSmartboardImageModal = useCallback((p) => {
    if (!p?.url) return;
    const next = { url: p.url, label: p.label || '' };
    sbImageModalRef.current = next;
    setSbImageModal(next);
    queueMicrotask(() => onBroadcast?.({ sbImageModal: next }));
  }, [onBroadcast]);

  const closeSbImageModal = useCallback(() => {
    sbImageModalRef.current = null;
    setSbImageModal(null);
    queueMicrotask(() => onBroadcast?.({ sbImageModal: null }));
  }, [onBroadcast]);

  const onSecureAppShareStateChange = useCallback((update) => {
    if (viewerMode) return;
    setSecureAppShareState((prev) => {
      const p = prev && typeof prev === 'object' ? prev : {};
      const next = typeof update === 'function' ? update(p) : update;
      const safe = next && typeof next === 'object' ? { ...next } : null;
      secureAppShareStateRef.current = safe;
      queueMicrotask(() => onBroadcast?.({ secureAppShareState: safe }));
      return safe;
    });
  }, [viewerMode, onBroadcast]);

  const onAnnotationStrokesChange = useCallback((update) => {
    setAnnotationStrokes((prev) => {
      const p = Array.isArray(prev) ? prev : [];
      const next = typeof update === 'function' ? update(p) : update;
      const raw = Array.isArray(next) ? next : [];
      const { strokes, truncated, removed } = sanitizeAnnotationStrokesForBroadcast(raw);
      if (truncated && removed > 0) {
        queueMicrotask(() => {
          toast({
            title: 'Annotations limitées',
            description:
              removed <= 1
                ? `Le trait le plus ancien a été retiré (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}).`
                : `Les ${removed} traits les plus anciens ont été retirés (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}).`,
            duration: 8000,
          });
        });
      }
      annotationStrokesRef.current = strokes;
      queueMicrotask(() => onBroadcast?.({ annotationStrokes: strokes }));
      return strokes;
    });
  }, [onBroadcast, toast]);

  const onWhiteboardStrokesChange = useCallback((update) => {
    setWhiteboardPages((pagesPrev) => {
      const idx = whiteboardPageIndexRef.current;
      const pages = normalizeWhiteboardPages(pagesPrev);
      const cur = [...(pages[idx] || [])];
      const nextCur = typeof update === 'function' ? update(cur) : update;
      const raw = Array.isArray(nextCur) ? nextCur : [];
      const { strokes, truncated, removed } = sanitizeAnnotationStrokesForBroadcast(raw);
      if (truncated && removed > 0) {
        queueMicrotask(() => {
          toast({
            title: 'Tableau blanc limité',
            description:
              removed <= 1
                ? `L'élément le plus ancien a été retiré (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}).`
                : `Les ${removed} éléments les plus anciens ont été retirés (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}).`,
            duration: 8000,
          });
        });
      }
      const nextPages = [...pages];
      nextPages[idx] = strokes;
      whiteboardPagesRef.current = nextPages;
      const patch = whiteboardBroadcastPatch(nextPages, idx);
      whiteboardStrokesRef.current = patch.whiteboardStrokes;
      queueMicrotask(() => onBroadcast?.(patch));
      scheduleHostToolsRailSync();
      return nextPages;
    });
  }, [onBroadcast, toast, scheduleHostToolsRailSync]);

  /** LONGIA / hôte : ajoute un bloc texte « à retenir » sur le tableau blanc (coords normalisées). */
  const appendRetenirHint = useCallback(
    (rawText) => {
      if (viewerMode) return false;
      const line = String(rawText || '').trim().slice(0, 280);
      if (!line) return false;
      const text = /^à\s*retenir/i.test(line) ? line : `À retenir : ${line}`;
      const scene = activeSceneRef.current;
      const y = scene === 'screen' ? 0.82 : 0.06;
      const x = 0.04;
      const fontSize = scene === 'screen' ? 18 : 20;
      setWhiteboardPages((pagesPrev) => {
        const idx = whiteboardPageIndexRef.current;
        const pages = normalizeWhiteboardPages(pagesPrev);
        const p = [...(pages[idx] || [])];
        const stroke = {
          kind: 'text',
          x,
          y,
          text,
          color: '#fbbf24',
          fontSize,
        };
        const raw = [...p, stroke];
        const { strokes, truncated, removed } = sanitizeAnnotationStrokesForBroadcast(raw);
        if (truncated && removed > 0) {
          queueMicrotask(() => {
            toast({
              title: 'Tableau blanc limité',
              description:
                removed <= 1
                  ? `L'élément le plus ancien a été retiré (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}).`
                  : `Les ${removed} éléments les plus anciens ont été retirés (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}).`,
              duration: 8000,
            });
          });
        }
        const nextPages = [...pages];
        nextPages[idx] = strokes;
        whiteboardPagesRef.current = nextPages;
        const patch = whiteboardBroadcastPatch(nextPages, idx);
        whiteboardStrokesRef.current = patch.whiteboardStrokes;
        queueMicrotask(() => onBroadcast?.(patch));
        scheduleHostToolsRailSync();
        return nextPages;
      });
      return true;
    },
    [onBroadcast, toast, viewerMode, scheduleHostToolsRailSync],
  );

  const onSharedImagePrev = useCallback(() => {
    const next = Math.max(0, sharedImageIdx - 1);
    setSharedImageIdx(next);
    queueMicrotask(() => onBroadcast?.({ sharedImageIdx: next }));
  }, [sharedImageIdx, onBroadcast]);

  const onSharedImageNext = useCallback(() => {
    const next = Math.min(Math.max(sharedImageGallery.length, 1) - 1, sharedImageIdx + 1);
    setSharedImageIdx(next);
    queueMicrotask(() => onBroadcast?.({ sharedImageIdx: next }));
  }, [sharedImageIdx, sharedImageGallery.length, onBroadcast]);

  const onToggleSharedImageLoop = useCallback((v) => {
    setSharedImageLoop(v);
    queueMicrotask(() => onBroadcast?.({ sharedImageLoop: v }));
  }, [onBroadcast]);

  const syncFromHostStep = useCallback((i) => {
    const n = Math.floor(Number(i)) || 0;
    const cN = nativeSlides.length <= 0 ? 0 : Math.min(Math.max(0, n), nativeSlides.length - 1);
    const cI = importSlides.length <= 0 ? 0 : Math.min(Math.max(0, n), importSlides.length - 1);
    const cA = (displaySlides || []).length <= 0 ? 0 : Math.min(Math.max(0, n), (displaySlides || []).length - 1);
    nativeSlideIndexRef.current = cN;
    importSlideIndexRef.current = cI;
    slideIndexRef.current = cA;
    setNativeSlideIndex(cN);
    setImportSlideIndex(cI);
    setSlideIndex(cA);
  }, [nativeSlides.length, importSlides.length, displaySlides?.length]);

  /** Sync invité depuis le broadcast hôte (aligné LiveArenaPage — tous les champs du payload). */
  const applyHostSmartboardBroadcast = useCallback(
    (payload) => {
      if (!payload || typeof payload !== 'object') return;

      if (typeof payload.nativeSlideIndex === 'number') {
        const v = Math.floor(payload.nativeSlideIndex);
        const c = nativeSlides.length <= 0 ? 0 : Math.min(Math.max(0, v), nativeSlides.length - 1);
        nativeSlideIndexRef.current = c;
        setNativeSlideIndex(c);
      }
      if (typeof payload.importSlideIndex === 'number') {
        const v = Math.floor(payload.importSlideIndex);
        const c = importSlides.length <= 0 ? 0 : Math.min(Math.max(0, v), importSlides.length - 1);
        importSlideIndexRef.current = c;
        setImportSlideIndex(c);
      }
      if (typeof payload.slideIndex === 'number') {
        const v = Math.floor(payload.slideIndex);
        const c = (displaySlides || []).length <= 0 ? 0 : Math.min(Math.max(0, v), (displaySlides || []).length - 1);
        slideIndexRef.current = c;
        setSlideIndex(c);
      }
      if (typeof payload.sharedImageIdx === 'number') {
        const v = Math.floor(payload.sharedImageIdx);
        const max = Math.max(0, sharedImageGallery.length - 1);
        const c = Math.min(Math.max(0, v), max);
        sharedImageIdxRef.current = c;
        setSharedImageIdx(c);
      }
      if (typeof payload.sharedImageLoop === 'boolean') {
        sharedImageLoopRef.current = payload.sharedImageLoop;
        setSharedImageLoop(payload.sharedImageLoop);
      }
      if (Array.isArray(payload.annotationStrokes)) {
        annotationStrokesRef.current = payload.annotationStrokes;
        setAnnotationStrokes(payload.annotationStrokes);
      }
      if (
        (Array.isArray(payload.whiteboardPages) && payload.whiteboardPages.every(Array.isArray))
        || Array.isArray(payload.whiteboardStrokes)
      ) {
        const { pages, pageIndex } = mergeWhiteboardFromPayload(
          payload,
          whiteboardPagesRef.current,
          whiteboardPageIndexRef.current,
        );
        whiteboardPagesRef.current = pages;
        whiteboardPageIndexRef.current = pageIndex;
        setWhiteboardPages(pages);
        setWhiteboardPageIndex(pageIndex);
        whiteboardStrokesRef.current = pages[pageIndex] ?? [];
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'sbImageModal')) {
        const m = payload.sbImageModal;
        if (m && typeof m === 'object' && m.url) {
          const next = { url: String(m.url), label: String(m.label || '') };
          sbImageModalRef.current = next;
          setSbImageModal(next);
        } else {
          sbImageModalRef.current = null;
          setSbImageModal(null);
        }
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'sbTacticalSync')) {
        setViewerRemoteTacticalSync(payload.sbTacticalSync ?? null);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'secureAppShareState')) {
        const next =
          payload.secureAppShareState && typeof payload.secureAppShareState === 'object'
            ? payload.secureAppShareState
            : null;
        secureAppShareStateRef.current = next;
        setSecureAppShareState(next);
      }

      if (typeof payload.activeScene === 'string') {
        activeSceneRef.current = payload.activeScene;
        setActiveScene(payload.activeScene);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'camera2Source')) {
        const src = payload.camera2Source;
        if (!src) {
          clearCamera2LocalStream();
          if (camera2VideoRef.current) camera2VideoRef.current.srcObject = null;
          setCamera2Active(false);
          setCamera2Source(null);
          camera2SourceRef.current = null;
        } else {
          void applyCamera2FromSpec(src);
        }
      }
    },
    [
      nativeSlides.length,
      importSlides.length,
      displaySlides?.length,
      sharedImageGallery.length,
      clearCamera2LocalStream,
      applyCamera2FromSpec,
    ],
  );

  const goWhiteboardPrevPage = useCallback(() => {
    if (viewerMode) return;
    const pages = whiteboardPagesRef.current;
    const i = whiteboardPageIndexRef.current;
    if (i <= 0) return;
    const next = i - 1;
    whiteboardPageIndexRef.current = next;
    setWhiteboardPageIndex(next);
    const patch = whiteboardBroadcastPatch(pages, next);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => onBroadcast?.(patch));
    scheduleHostToolsRailSync();
  }, [viewerMode, onBroadcast, scheduleHostToolsRailSync]);

  const goWhiteboardNextPage = useCallback(() => {
    if (viewerMode) return;
    const pages = whiteboardPagesRef.current;
    const i = whiteboardPageIndexRef.current;
    if (i >= pages.length - 1) return;
    const next = i + 1;
    whiteboardPageIndexRef.current = next;
    setWhiteboardPageIndex(next);
    const patch = whiteboardBroadcastPatch(pages, next);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => onBroadcast?.(patch));
    scheduleHostToolsRailSync();
  }, [viewerMode, onBroadcast, scheduleHostToolsRailSync]);

  const addWhiteboardPage = useCallback(() => {
    if (viewerMode) return;
    const prev = whiteboardPagesRef.current;
    if (prev.length >= WHITEBOARD_MAX_PAGES) return;
    const next = [...prev, []];
    const newIdx = next.length - 1;
    whiteboardPagesRef.current = next;
    whiteboardPageIndexRef.current = newIdx;
    setWhiteboardPages(next);
    setWhiteboardPageIndex(newIdx);
    const patch = whiteboardBroadcastPatch(next, newIdx);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => onBroadcast?.(patch));
    scheduleHostToolsRailSync();
  }, [viewerMode, onBroadcast, scheduleHostToolsRailSync]);

  const removeWhiteboardPage = useCallback(() => {
    if (viewerMode) return;
    const prev = whiteboardPagesRef.current;
    if (prev.length <= 1) return;
    const idx = whiteboardPageIndexRef.current;
    const next = prev.filter((_, j) => j !== idx);
    const newIdx = Math.min(idx, next.length - 1);
    whiteboardPagesRef.current = next;
    whiteboardPageIndexRef.current = newIdx;
    setWhiteboardPages(next);
    setWhiteboardPageIndex(newIdx);
    const patch = whiteboardBroadcastPatch(next, newIdx);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => onBroadcast?.(patch));
    scheduleHostToolsRailSync();
  }, [viewerMode, onBroadcast, scheduleHostToolsRailSync]);

  const captureForGuestNotes = useCallback(async () => {
    const el = stageCaptureSurfaceRef.current;
    if (!el) throw new Error('Cadre SmartBoard indisponible');
    const blob = await captureSmartboardStageToPngBlob(el);
    if (!blob || blob.size < 80) throw new Error('Capture vide ou trop faible');
    const { url } = await uploadSmartboardCanvasImage(blob);
    if (!url) throw new Error('Téléversement impossible');
    return { url, thumb_url: url };
  }, []);

  useImperativeHandle(ref, () => ({
    /** Changer la scène active depuis le parent (footer dock). */
    changeScene,
    /** Scène active courante. */
    getActiveScene: () => activeScene,
    getSmartboardPayload: (overrides = {}) => ({
      slideIndex: slideIndexRef.current,
      nativeSlideIndex: nativeSlideIndexRef.current,
      importSlideIndex: importSlideIndexRef.current,
      sharedImageIdx: sharedImageIdxRef.current,
      sharedImageLoop: sharedImageLoopRef.current,
      activeScene: activeSceneRef.current,
      progressivePlayback: progressivePlaybackRef.current,
      annotationStrokes: annotationStrokesRef.current,
      whiteboardPages: whiteboardPagesRef.current,
      whiteboardPageIndex: whiteboardPageIndexRef.current,
      whiteboardStrokes: whiteboardStrokesRef.current,
      sbImageModal: sbImageModalRef.current,
      sbTacticalSync: sbTacticalSyncRef.current,
      secureAppShareState: secureAppShareStateRef.current,
      camera2Source: camera2SourceRef.current,
      ...overrides,
    }),
    syncFromHostStep,
    closeSbImageModal,
    applyHostSmartboardBroadcast,
    appendRetenirHint,
    goWhiteboardPrevPage,
    goWhiteboardNextPage,
    addWhiteboardPage,
    removeWhiteboardPage,
    /** Invité / hôte : PNG du cadre → bucket smartboard-canvas → URL publique. */
    captureForGuestNotes,
  }), [
    syncFromHostStep,
    closeSbImageModal,
    applyHostSmartboardBroadcast,
    appendRetenirHint,
    goWhiteboardPrevPage,
    goWhiteboardNextPage,
    addWhiteboardPage,
    removeWhiteboardPage,
    captureForGuestNotes,
  ]);

  useEffect(() => {
    queueMicrotask(() => onBroadcast?.());
  }, [sharingScreen, onBroadcast]);

  useEffect(() => () => {
    clearCamera2LocalStream();
  }, [clearCamera2LocalStream]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none bg-transparent">
      <SmartBoardCompositor
        stageCaptureSurfaceRef={stageCaptureSurfaceRef}
        expandStageToViewport
        slide={parallaxSlide}
        spotlight={spotlight}
        progressivePlayback={progressivePlayback}
        onSmartboardImageExpand={openSmartboardImageModal}
        screenVideoRef={screenVideoRef}
        screenActive={sharingScreen || remoteScreenShareActive}
        sharedImageSrc={sharedImageSrc}
        sharedGalleryLength={sharedImageGallery.length}
        sharedImageIndex={sharedImageIdx}
        onSharedImagePrev={onSharedImagePrev}
        onSharedImageNext={onSharedImageNext}
        sharedImageLoop={sharedImageLoop}
        onToggleSharedImageLoop={onToggleSharedImageLoop}
        camera2VideoRef={camera2VideoRef}
        camera2Active={camera2Active}
        onStartCamera2={handleCamera2Start}
        camera2FluxParticipants={camera2FluxParticipants}
        activeScene={activeScene}
        onChangeScene={changeScene}
        sceneFlags={mergedFlags}
        onSaveStroke={() => {}}
        onShareScreen={onShareScreenRequest}
        shopProducts={shopProducts}
        onShopProductClick={(product) => {
          const url = product.payUrl || product.url;
          if (url) window.open(url.startsWith('/') ? window.location.origin + url : url, '_blank', 'noopener');
        }}
        premiumArenaHostTray
        sceneDockPlacement={sceneDockPlacement}
        readOnlySceneNavigator={viewerMode}
        annotationStrokes={annotationStrokes}
        onAnnotationStrokesChange={viewerMode ? undefined : onAnnotationStrokesChange}
        whiteboardStrokes={whiteboardStrokes}
        onWhiteboardStrokesChange={viewerMode ? undefined : onWhiteboardStrokesChange}
        tacticalSyncRole={phaseLive ? (viewerMode ? 'viewer' : 'host') : undefined}
        remoteTacticalSync={viewerMode ? viewerRemoteTacticalSync : null}
        onTacticalSyncChange={handleSbTacticalSync}
        pipStream={pipStream}
        whiteboardPageIndex={whiteboardPageIndex}
        whiteboardPageCount={whiteboardPages.length}
        onWhiteboardPrevPage={viewerMode ? undefined : goWhiteboardPrevPage}
        onWhiteboardNextPage={viewerMode ? undefined : goWhiteboardNextPage}
        onWhiteboardAddPage={viewerMode ? undefined : addWhiteboardPage}
        onWhiteboardRemovePage={viewerMode ? undefined : removeWhiteboardPage}
        secureAppShareState={secureAppShareState}
        onSecureAppShareStateChange={viewerMode ? undefined : onSecureAppShareStateChange}
        hideSceneIndexChip={sceneDockPlacement === 'footer'}
        hideEmbeddedWhiteboardToolsRail={hideEmbeddedWhiteboardToolsRail}
      />
    </div>
  );
});

LiveHostSmartBoardStage.displayName = 'LiveHostSmartBoardStage';

export default LiveHostSmartBoardStage;
