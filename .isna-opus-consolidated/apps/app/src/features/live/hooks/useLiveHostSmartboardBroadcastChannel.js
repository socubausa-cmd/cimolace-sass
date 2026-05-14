import { useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';
import {
  ARENA_LAYOUT,
  normalizeArenaLayoutMode,
  normalizeArenaPanelUserIds,
} from '@/lib/liriArenaLayout';
import { getProfile, permissionsForProfile } from '@/lib/liriControlMesh/profiles';
import { DEFAULT_MESH_GRANT_MS } from '@/lib/liriControlMesh/meshTransfer';
import { describeLiveKitMediaError } from '@/lib/liveKitParticipantVideo';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Canal `live-smartboard-${sessionId}` : invité (mesh_grant/revoke, caméra hôte,
 * arena_layout, smartboard) ; hôte (mesh_request, resync arena + mesh grants).
 */
export function useLiveHostSmartboardBroadcastChannel({
  sessionId,
  phase,
  isGuestUi,
  userId,
  teacherId,
  toast,
  sendSmartboardHostPayload,
  smartBoardStageRef,
  stepRef,
  progressivePlaybackRef,
  guestJoyKitDriveRef,
  guestSmartboardBroadcastRef,
  smartboardChRef,
  roomRef,
  sessionCommFlagsRef,
  guestHostCameraUnlockRef,
  guestProctorOwnRefreshRef,
  guestResyncSmartboardFromDbRef,
  arenaLayoutModeRef,
  arenaGuestFocusUserIdRef,
  arenaPanelUserIdsRef,
  meshGrantsByUserIdRef,
  setGuestMeshGrant,
  setArenaLayoutMode,
  setArenaGuestFocusUserId,
  setArenaPanelUserIds,
  setGuestLiriAudioSmartboard,
  setGuestLiriAudioSceneName,
  setStep,
  setProgressivePlayback,
  setMeshRequests,
  setCameraOn,
  setLiveKitMediaEpoch,
}) {
  useEffect(() => {
    if (!sessionId || phase !== PHASE.LIVE) return;
    if (isGuestUi) {
      const ch = supabase.channel(`live-smartboard-${sessionId}`, { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'mesh_grant' }, ({ payload }) => {
        if (!payload || typeof payload !== 'object' || !userId) return;
        if (String(payload.userId) !== String(userId)) return;
        if (!payload.permissions || typeof payload.permissions !== 'object') return;
        const expiresAt =
          typeof payload.expiresAt === 'number' && Number.isFinite(payload.expiresAt)
            ? payload.expiresAt
            : Date.now() + DEFAULT_MESH_GRANT_MS;
        setGuestMeshGrant({
          profileId: typeof payload.profileId === 'string' ? payload.profileId : 'guest_speaker',
          permissions: payload.permissions,
          expiresAt,
        });
      });
      ch.on('broadcast', { event: 'mesh_revoke' }, ({ payload }) => {
        if (!payload || typeof payload !== 'object' || !userId) return;
        if (String(payload.userId) !== String(userId)) return;
        setGuestMeshGrant(null);
      });
      ch.on('broadcast', { event: 'host_camera_command' }, ({ payload }) => {
        void (async () => {
          if (!payload || typeof payload !== 'object' || !userId) return;
          if (String(payload.targetUserId) !== String(userId)) return;
          if (teacherId == null || String(payload.teacherId) !== String(teacherId)) return;
          const sf = sessionCommFlagsRef.current;
          if (!sf.host_remote_camera_enabled || !sf.proctoring_camera_consent_required) return;
          let consented = false;
          const { data: consentDb } = await supabase
            .from('live_session_proctor_consents')
            .select('id')
            .eq('live_session_id', sessionId)
            .eq('user_id', userId)
            .maybeSingle();
          if (consentDb) consented = true;
          if (!consented) {
            try {
              consented = localStorage.getItem(`liri-proctor-cam-${sessionId}-${userId}`) === '1';
            } catch {
              /* ignore */
            }
          }
          if (!consented) return;
          const room = roomRef.current;
          if (!room?.localParticipant) return;
          const on = Boolean(payload.enabled);
          const correlationId = typeof payload.correlationId === 'string' ? payload.correlationId : null;
          guestHostCameraUnlockRef.current = on;
          toast({
            title: on ? 'Caméra (formateur)' : 'Caméra coupée',
            description: on
              ? 'Le formateur demande d’allumer votre caméra. Autorisez l’accès si le navigateur le demande.'
              : 'Le formateur a demandé d’éteindre votre caméra sur cet appareil.',
          });
          try {
            await room.localParticipant.setCameraEnabled(on);
            setCameraOn(on);
            setLiveKitMediaEpoch((e) => e + 1);
            if (correlationId) {
              const { error: rpcErr } = await supabase.rpc('proctor_ack_camera_event', {
                p_correlation_id: correlationId,
                p_success: true,
                p_error: null,
              });
              if (rpcErr) console.warn('[LiveHost] proctor_ack', rpcErr.message);
            }
            guestProctorOwnRefreshRef.current?.();
          } catch (err) {
            if (correlationId) {
              await supabase
                .rpc('proctor_ack_camera_event', {
                  p_correlation_id: correlationId,
                  p_success: false,
                  p_error: String(err?.message || err || 'Erreur caméra'),
                })
                .catch(() => {});
            }
            toast({
              title: 'Caméra',
              description: describeLiveKitMediaError(err),
              variant: 'destructive',
            });
          }
        })();
      });
      ch.on('broadcast', { event: 'arena_layout' }, ({ payload }) => {
        if (!payload || typeof payload !== 'object') return;
        if (typeof payload.mode === 'string') {
          setArenaLayoutMode(normalizeArenaLayoutMode(payload.mode));
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'guestUserId')) {
          const g = payload.guestUserId;
          setArenaGuestFocusUserId(g != null && g !== '' ? String(g) : null);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'panelUserIds')) {
          setArenaPanelUserIds(normalizeArenaPanelUserIds(payload.panelUserIds));
        }
      });
      ch.on('broadcast', { event: 'smartboard' }, ({ payload }) => {
        if (!payload || typeof payload !== 'object') return;
        if (typeof payload.arenaLayoutMode === 'string') {
          setArenaLayoutMode(normalizeArenaLayoutMode(payload.arenaLayoutMode));
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'arenaGuestFocusUserId')) {
          const g = payload.arenaGuestFocusUserId;
          setArenaGuestFocusUserId(g != null && g !== '' ? String(g) : null);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'arenaPanelUserIds')) {
          setArenaPanelUserIds(normalizeArenaPanelUserIds(payload.arenaPanelUserIds));
        }
        if (guestJoyKitDriveRef.current) {
          if (Object.prototype.hasOwnProperty.call(payload, 'liriAudioSmartboard')) {
            setGuestLiriAudioSmartboard(payload.liriAudioSmartboard ?? null);
          }
          if (Object.prototype.hasOwnProperty.call(payload, 'liriAudioSceneName')) {
            setGuestLiriAudioSceneName(
              typeof payload.liriAudioSceneName === 'string' ? payload.liriAudioSceneName : '',
            );
          }
          return;
        }
        queueMicrotask(() => {
          smartBoardStageRef.current?.applyHostSmartboardBroadcast?.(payload);
        });
        if (typeof payload.slideIndex === 'number') {
          const si = payload.slideIndex;
          stepRef.current = si;
          setStep(si);
        }
        if (typeof payload.progressivePlayback === 'boolean') {
          progressivePlaybackRef.current = payload.progressivePlayback;
          setProgressivePlayback(payload.progressivePlayback);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'liriAudioSmartboard')) {
          setGuestLiriAudioSmartboard(payload.liriAudioSmartboard ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'liriAudioSceneName')) {
          setGuestLiriAudioSceneName(
            typeof payload.liriAudioSceneName === 'string' ? payload.liriAudioSceneName : '',
          );
        }
      });
      guestSmartboardBroadcastRef.current = ch;
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          queueMicrotask(() => guestResyncSmartboardFromDbRef.current?.());
        }
      });
      return () => {
        guestSmartboardBroadcastRef.current = null;
        supabase.removeChannel(ch);
      };
    }
    const ch = supabase.channel(`live-smartboard-${sessionId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'mesh_request' }, ({ payload }) => {
      if (!payload || typeof payload !== 'object') return;
      const id = payload.id != null ? String(payload.id) : '';
      const name = typeof payload.name === 'string' ? payload.name : 'Participant';
      const kind = typeof payload.kind === 'string' ? payload.kind : 'control';
      const uid = payload.userId != null ? String(payload.userId) : null;
      if (!id) return;
      setMeshRequests((prev) =>
        prev.some((x) => x.id === id)
          ? prev
          : [...prev, { id, name, kind, userId: uid, at: Number(payload.at) || Date.now() }],
      );
    });
    smartboardChRef.current = ch;
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        sendSmartboardHostPayload();
        void broadcastRealtime(ch, 'arena_layout', {
          mode: arenaLayoutModeRef.current,
          guestUserId:
            arenaLayoutModeRef.current === ARENA_LAYOUT.GUEST_FOCUS
              ? arenaGuestFocusUserIdRef.current
              : null,
          panelUserIds:
            arenaLayoutModeRef.current === ARENA_LAYOUT.PANEL
              ? (arenaPanelUserIdsRef.current?.length ? [...arenaPanelUserIdsRef.current] : null)
              : null,
          at: Date.now(),
        });
        queueMicrotask(() => {
          const chNow = smartboardChRef.current;
          if (!chNow) return;
          const grants = meshGrantsByUserIdRef.current || {};
          const now = Date.now();
          Object.entries(grants).forEach(([uid, v]) => {
            const exp = typeof v?.expiresAt === 'number' ? v.expiresAt : 0;
            if (!uid || exp <= now) return;
            let profileId = typeof v?.profileId === 'string' && v.profileId ? v.profileId : 'guest_speaker';
            if (!getProfile(profileId)) profileId = 'guest_speaker';
            const permissions = permissionsForProfile(profileId);
            void broadcastRealtime(chNow, 'mesh_grant', {
              userId: uid,
              profileId,
              permissions,
              requestId: 'host-channel-resync',
              at: Date.now(),
              expiresAt: exp,
              durationMs: Math.max(0, exp - now),
            });
          });
        });
      }
    });
    return () => {
      supabase.removeChannel(ch);
      smartboardChRef.current = null;
    };
  }, [
    sessionId,
    phase,
    sendSmartboardHostPayload,
    isGuestUi,
    userId,
    teacherId,
    toast,
    smartBoardStageRef,
    stepRef,
    progressivePlaybackRef,
    guestJoyKitDriveRef,
    guestSmartboardBroadcastRef,
    smartboardChRef,
    roomRef,
    sessionCommFlagsRef,
    guestHostCameraUnlockRef,
    guestProctorOwnRefreshRef,
    guestResyncSmartboardFromDbRef,
    arenaLayoutModeRef,
    arenaGuestFocusUserIdRef,
    arenaPanelUserIdsRef,
    meshGrantsByUserIdRef,
    setGuestMeshGrant,
    setArenaLayoutMode,
    setArenaGuestFocusUserId,
    setArenaPanelUserIds,
    setGuestLiriAudioSmartboard,
    setGuestLiriAudioSceneName,
    setStep,
    setProgressivePlayback,
    setMeshRequests,
    setCameraOn,
    setLiveKitMediaEpoch,
  ]);
}
