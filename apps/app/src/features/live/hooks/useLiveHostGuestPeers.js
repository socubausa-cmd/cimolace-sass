import { useCallback, useMemo } from 'react';
import { Track } from 'livekit-client';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { buildSmartboardNavigatorScenes } from '@/lib/smartboardNavigatorScenes';
import { LIRI_MULTILANG_LIVEKIT_IDENTITY_PREFIX } from '@/lib/liriMultilangAudioGuest';

/**
 * Valeurs dérivées côté invité : classmates, grid self, strip dock,
 * notes de scène SmartBoard, capture et saut de scène.
 */
export function useLiveHostGuestPeers({
  isGuestUi,
  phase,
  liveParticipants,
  livekitParticipantsMap,
  liveKitMediaEpoch,
  smartboardSceneFlags,
  sbActiveScene,
  step,
  smartBoardStageRef,
  user,
  rawCameraPipStream,
  micOn,
  cameraOn,
  guestMicLocked,
  guestCamLocked,
  toggleMic,
  toggleCamera,
}) {
  const liveStripDockMembers = useMemo(() => {
    if (!isGuestUi) return liveParticipants;
    const locals = liveParticipants.filter((p) => p.isLocal);
    const others = liveParticipants.filter((p) => !p.isLocal);
    return [...locals, ...others];
  }, [isGuestUi, liveParticipants]);

  const guestNotesSceneLabel = useMemo(() => {
    const scenes = buildSmartboardNavigatorScenes({ flags: smartboardSceneFlags });
    const hit = scenes.find((s) => s.id === sbActiveScene);
    return hit?.label || sbActiveScene || 'SmartBoard';
  }, [smartboardSceneFlags, sbActiveScene]);

  const guestNotesCurrentSceneRef = useMemo(() => ({
    scene_id: String(sbActiveScene || 'smartboard'),
    scene_label: String(guestNotesSceneLabel),
    page: typeof step === 'number' ? step : 0,
  }), [sbActiveScene, guestNotesSceneLabel, step]);

  const onGuestNotesJumpToScene = useCallback((sceneRef) => {
    const id = sceneRef && typeof sceneRef.scene_id === 'string' ? sceneRef.scene_id : '';
    if (id) smartBoardStageRef.current?.changeScene?.(id);
  }, [smartBoardStageRef]);

  const onGuestCaptureSmartboard = useCallback(async () => {
    const cap = smartBoardStageRef.current?.captureForGuestNotes;
    if (typeof cap !== 'function') {
      throw new Error('SmartBoard indisponible (stage non monté)');
    }
    return cap();
  }, [smartBoardStageRef]);

  const guestClassmatesPeers = useMemo(() => {
    if (!isGuestUi || phase !== PHASE.LIVE) return [];
    return liveParticipants
      .filter((m) => {
        if (!m || m.isLocal) return false;
        if (m.isHost) return false;
        if (String(m.id || '').startsWith(LIRI_MULTILANG_LIVEKIT_IDENTITY_PREFIX)) return false;
        return true;
      })
      .map((m) => {
        const lk = livekitParticipantsMap[m.id]
          || livekitParticipantsMap[String(m.id)]
          || livekitParticipantsMap[m.name]
          || null;
        let videoStream = null;
        if (lk) {
          const pubs = Array.from(lk.videoTrackPublications?.values?.() || []);
          const cam = pubs.find((pub) => pub.source === Track.Source.Camera && pub.track?.mediaStreamTrack);
          const t = cam?.track?.mediaStreamTrack;
          if (t && t.readyState !== 'ended') {
            videoStream = new MediaStream([t]);
          }
        }
        const micPub = lk?.getTrackPublication?.(Track.Source.Microphone);
        const camPub = lk?.getTrackPublication?.(Track.Source.Camera);
        const micOnPeer = Boolean(micPub && !micPub.isMuted && micPub.track);
        const camOnPeer = Boolean(camPub && !camPub.isMuted && camPub.track);
        return {
          id: String(m.id),
          displayName: m.name || 'Élève',
          avatarUrl: m.avatar_url || null,
          videoStream,
          micOn: micOnPeer,
          camOn: camOnPeer,
          isSpeaking: Boolean(lk?.isSpeaking),
        };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuestUi, phase, liveParticipants, livekitParticipantsMap, liveKitMediaEpoch]);

  const guestMembersGridSelf = useMemo(() => ({
    displayName: user?.full_name || user?.email || 'Moi',
    avatarUrl: null,
    videoStream: rawCameraPipStream,
    micOn,
    camOn: cameraOn,
    blurOn: false,
    canToggleMic: !guestMicLocked,
    canToggleCam: !guestCamLocked,
    canToggleBlur: false,
    onToggleMic: () => { if (!guestMicLocked) toggleMic(); },
    onToggleCam: () => { if (!guestCamLocked) toggleCamera(); },
    onToggleBlur: null,
    networkQuality: 'unknown',
  }), [
    user?.full_name,
    user?.email,
    rawCameraPipStream,
    micOn,
    cameraOn,
    guestMicLocked,
    guestCamLocked,
    toggleMic,
    toggleCamera,
  ]);

  return {
    liveStripDockMembers,
    guestNotesSceneLabel,
    guestNotesCurrentSceneRef,
    onGuestNotesJumpToScene,
    onGuestCaptureSmartboard,
    guestClassmatesPeers,
    guestMembersGridSelf,
  };
}
