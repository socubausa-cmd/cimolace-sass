import { useCallback, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';
import {
  ARENA_LAYOUT,
  ARENA_PANEL_MAX_SLOTS,
  normalizeArenaLayoutMode,
  normalizeArenaPanelUserIds,
} from '@/lib/liriArenaLayout';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';
import { assertGuestLiveAction } from '@/lib/liriLive/assertGuestPermissionServer';

/**
 * SmartBoard dispatch + layout arène : sendSmartboardHostPayload, persistArenaLayoutMode,
 * applyHostArenaLayoutMode, handleMobileLayoutPreviewChange, persistProgressivePlayback,
 * toggleProgressivePlayback, onSmartboardBroadcast, et effets de synchronisation.
 */
export function useLiveHostArenaLayout({
  isGuestUi,
  phase,
  sessionId,
  user,
  permCtxOptional,
  toast,
  promotedId,
  liveParticipants,
  arenaLayoutMode,
  guestMergedMeshPermissions,
  guestMeshGrant,
  setPromotedId,
  setNeuronQActive,
  setArenaPanelUserIds,
  setArenaLayoutMode,
  setProgressivePlayback,
  setPreviewMobileMaquette,
  guestJoyKitDriveRef,
  guestSmartboardBroadcastRef,
  smartboardChRef,
  smartBoardStageRef,
  sharingScreenRef,
  recordingRef,
  progressivePlaybackRef,
  stepRef,
  arenaLayoutModeRef,
  arenaGuestFocusUserIdRef,
  arenaPanelUserIdsRef,
  arenaLayoutPersistTimerRef,
  progressivePersistTimerRef,
  resyncSmartboardRef,
}) {
  const sendSmartboardHostPayload = useCallback(async (overrides = {}) => {
    if (isGuestUi && !guestJoyKitDriveRef.current) return;
    const signalOnlyJoyDb = isGuestUi && Boolean(guestMergedMeshPermissions) && !guestMeshGrant?.permissions;
    if (signalOnlyJoyDb && sessionId && user?.id && permCtxOptional) {
      const ok = await assertGuestLiveAction(supabase, permCtxOptional, {
        liveSessionId: sessionId,
        userId: user.id,
        action: 'canDrawSmartboard',
      });
      if (!ok) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[LiriLive Phase6] SmartBoard invité : diffusion refusée (RPC / permissions)', { sessionId });
        }
        return;
      }
    }
    const ch = isGuestUi ? guestSmartboardBroadcastRef.current : smartboardChRef.current;
    if (!ch) return;
    const fromStage = smartBoardStageRef.current?.getSmartboardPayload?.() ?? {};
    const fallbackScene = sharingScreenRef.current ? 'screen' : 'smartboard';
    const payload = {
      slideIndex: stepRef.current,
      nativeSlideIndex: stepRef.current,
      importSlideIndex: stepRef.current,
      activeScene: fallbackScene,
      recordingActive: recordingRef.current,
      progressivePlayback: progressivePlaybackRef.current,
      annotationStrokes: [],
      ...fromStage,
      recordingActive: recordingRef.current,
      ...overrides,
    };
    if (!isGuestUi) {
      payload.arenaLayoutMode = arenaLayoutModeRef.current;
      if (
        arenaLayoutModeRef.current === ARENA_LAYOUT.GUEST_FOCUS
        && arenaGuestFocusUserIdRef.current
      ) {
        payload.arenaGuestFocusUserId = arenaGuestFocusUserIdRef.current;
      }
      if (
        arenaLayoutModeRef.current === ARENA_LAYOUT.PANEL
        && arenaPanelUserIdsRef.current?.length
      ) {
        payload.arenaPanelUserIds = [...arenaPanelUserIdsRef.current];
      }
    }
    void broadcastRealtime(ch, 'smartboard', payload);
  }, [
    isGuestUi, guestMergedMeshPermissions, guestMeshGrant?.permissions, sessionId, user?.id, permCtxOptional,
    guestJoyKitDriveRef, guestSmartboardBroadcastRef, smartboardChRef, smartBoardStageRef,
    sharingScreenRef, recordingRef, progressivePlaybackRef, stepRef,
    arenaLayoutModeRef, arenaGuestFocusUserIdRef, arenaPanelUserIdsRef,
  ]);

  const persistArenaLayoutMode = useCallback(
    (mode, guestFocusUserId = null, panelUserIds = null) => {
      if (!sessionId || isGuestUi) return;
      clearTimeout(arenaLayoutPersistTimerRef.current);
      arenaLayoutPersistTimerRef.current = setTimeout(async () => {
        try {
          const { data: row } = await supabase.from('live_sessions').select('config').eq('id', sessionId).maybeSingle();
          if (!row) return;
          let c = {};
          try {
            c = typeof row?.config === 'string' ? JSON.parse(row.config) : (row?.config || {});
          } catch { /* ignore */ }
          const gid =
            mode === ARENA_LAYOUT.GUEST_FOCUS && guestFocusUserId
              ? String(guestFocusUserId)
              : null;
          const panelStored =
            mode === ARENA_LAYOUT.PANEL && Array.isArray(panelUserIds) && panelUserIds.length
              ? panelUserIds.map(String).slice(0, ARENA_PANEL_MAX_SLOTS)
              : null;
          await supabase.from('live_sessions').update({
            config: {
              ...c,
              arena_layout_mode: mode,
              arena_guest_focus_user_id: gid,
              arena_panel_user_ids: panelStored,
            },
            updated_at: new Date().toISOString(),
          }).eq('id', sessionId);
        } catch { /* ignore */ }
      }, 500);
    },
    [sessionId, isGuestUi, arenaLayoutPersistTimerRef],
  );

  const applyHostArenaLayoutMode = useCallback(
    (nextRaw, opts = {}) => {
      if (isGuestUi) return;
      const mode = normalizeArenaLayoutMode(nextRaw);
      let guestUid = null;
      let panelIdsForPersist = null;

      if (mode === ARENA_LAYOUT.GUEST_FOCUS) {
        const fromOpt = opts.guestUserId != null ? String(opts.guestUserId) : null;
        const uid = fromOpt || promotedId || liveParticipants[0]?.id;
        if (!uid) {
          toast({
            title: "Aucun participant à l'antenne",
            description: "Ouvrez une fiche membre et choisissez « Mettre à l'antenne », ou attendez qu'un invité rejoigne.",
          });
          return;
        }
        guestUid = String(uid);
        setPromotedId(guestUid);
        setNeuronQActive(false);
        arenaGuestFocusUserIdRef.current = guestUid;
        arenaPanelUserIdsRef.current = [];
        setArenaPanelUserIds([]);
      } else if (mode === ARENA_LAYOUT.PANEL) {
        const fromOpt = Array.isArray(opts.panelUserIds)
          ? normalizeArenaPanelUserIds(opts.panelUserIds)
          : [];
        const fromLive = liveParticipants
          .slice(0, ARENA_PANEL_MAX_SLOTS)
          .map((p) => String(p.id));
        const ids = fromOpt.length ? fromOpt : fromLive;
        if (ids.length === 0) {
          toast({
            title: 'Panel vide',
            description: 'Au moins un participant doit être connecté dans le dock.',
          });
          return;
        }
        arenaGuestFocusUserIdRef.current = null;
        arenaPanelUserIdsRef.current = ids;
        setArenaPanelUserIds(ids);
        panelIdsForPersist = ids;
        setNeuronQActive(false);
      } else {
        arenaGuestFocusUserIdRef.current = null;
        arenaPanelUserIdsRef.current = [];
        setArenaPanelUserIds([]);
        if (mode === ARENA_LAYOUT.HOST_CAMERA || mode === ARENA_LAYOUT.MEMBERS_WALL || mode === ARENA_LAYOUT.CONFERENCE) {
          setNeuronQActive(false);
        }
      }

      arenaLayoutModeRef.current = mode;
      setArenaLayoutMode(mode);
      const ch = smartboardChRef.current;
      if (ch) {
        void broadcastRealtime(ch, 'arena_layout', {
          mode,
          guestUserId: mode === ARENA_LAYOUT.GUEST_FOCUS ? guestUid : null,
          panelUserIds: mode === ARENA_LAYOUT.PANEL ? arenaPanelUserIdsRef.current : null,
          at: Date.now(),
        });
      }
      persistArenaLayoutMode(mode, guestUid, panelIdsForPersist);
      queueMicrotask(() => {
        sendSmartboardHostPayload();
      });
    },
    [
      isGuestUi, sendSmartboardHostPayload, persistArenaLayoutMode,
      promotedId, liveParticipants, toast,
      setPromotedId, setNeuronQActive, setArenaPanelUserIds, setArenaLayoutMode,
      arenaGuestFocusUserIdRef, arenaPanelUserIdsRef, arenaLayoutModeRef, smartboardChRef,
    ],
  );

  const handleMobileLayoutPreviewChange = useCallback(
    (next) => {
      setPreviewMobileMaquette(next);
      if (next && !isGuestUi && phase === PHASE.LIVE) {
        applyHostArenaLayoutMode(ARENA_LAYOUT.SMARTBOARD);
        setNeuronQActive(false);
      }
    },
    [isGuestUi, phase, applyHostArenaLayoutMode, setPreviewMobileMaquette, setNeuronQActive],
  );

  // Auto-reset arène si promotedId disparaît en mode GUEST_FOCUS
  useEffect(() => {
    if (isGuestUi || phase !== PHASE.LIVE) return;
    if (arenaLayoutMode !== ARENA_LAYOUT.GUEST_FOCUS) return;
    if (promotedId) return;
    arenaLayoutModeRef.current = ARENA_LAYOUT.SMARTBOARD;
    arenaGuestFocusUserIdRef.current = null;
    arenaPanelUserIdsRef.current = [];
    setArenaLayoutMode(ARENA_LAYOUT.SMARTBOARD);
    setArenaPanelUserIds([]);
    const ch = smartboardChRef.current;
    if (ch) {
      void broadcastRealtime(ch, 'arena_layout', {
        mode: ARENA_LAYOUT.SMARTBOARD,
        guestUserId: null,
        panelUserIds: null,
        at: Date.now(),
      });
    }
    persistArenaLayoutMode(ARENA_LAYOUT.SMARTBOARD, null, null);
    queueMicrotask(() => {
      sendSmartboardHostPayload();
    });
  }, [
    isGuestUi, phase, arenaLayoutMode, promotedId,
    persistArenaLayoutMode, sendSmartboardHostPayload,
    setArenaLayoutMode, setArenaPanelUserIds,
    arenaLayoutModeRef, arenaGuestFocusUserIdRef, arenaPanelUserIdsRef, smartboardChRef,
  ]);

  const onSmartboardBroadcast = useCallback((partial = {}) => {
    sendSmartboardHostPayload(partial);
  }, [sendSmartboardHostPayload]);

  const persistProgressivePlayback = useCallback((value) => {
    if (!sessionId) return;
    clearTimeout(progressivePersistTimerRef.current);
    progressivePersistTimerRef.current = setTimeout(async () => {
      try {
        const { data: row } = await supabase.from('live_sessions').select('config').eq('id', sessionId).maybeSingle();
        if (!row) return;
        let c = {};
        try {
          c = typeof row?.config === 'string' ? JSON.parse(row.config) : (row?.config || {});
        } catch { /* ignore */ }
        await supabase.from('live_sessions').update({
          config: { ...c, smartboard_progressive_playback: value },
          updated_at: new Date().toISOString(),
        }).eq('id', sessionId);
      } catch { /* ignore */ }
    }, 900);
  }, [sessionId, progressivePersistTimerRef]);

  const toggleProgressivePlayback = useCallback(() => {
    setProgressivePlayback((v) => {
      const next = !v;
      progressivePlaybackRef.current = next;
      queueMicrotask(() => sendSmartboardHostPayload({ progressivePlayback: next }));
      persistProgressivePlayback(next);
      return next;
    });
  }, [sendSmartboardHostPayload, persistProgressivePlayback, setProgressivePlayback, progressivePlaybackRef]);

  useEffect(() => {
    resyncSmartboardRef.current = (o) => { sendSmartboardHostPayload(o); };
  }, [sendSmartboardHostPayload, resyncSmartboardRef]);

  useEffect(() => {
    if (phase !== PHASE.LIVE || isGuestUi) return;
    const id = requestAnimationFrame(() => {
      smartBoardStageRef.current?.syncFromHostStep?.(stepRef.current);
      sendSmartboardHostPayload();
    });
    return () => cancelAnimationFrame(id);
  }, [phase, sendSmartboardHostPayload, isGuestUi, smartBoardStageRef, stepRef]);

  return {
    sendSmartboardHostPayload,
    persistArenaLayoutMode,
    applyHostArenaLayoutMode,
    handleMobileLayoutPreviewChange,
    onSmartboardBroadcast,
    persistProgressivePlayback,
    toggleProgressivePlayback,
  };
}
