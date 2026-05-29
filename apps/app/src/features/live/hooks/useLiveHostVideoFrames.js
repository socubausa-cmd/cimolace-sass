import { useMemo } from 'react';
import { Track } from 'livekit-client';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Flux caméra brut PiP + participant distant principal (antenne) + flags d'affichage
 * des cadres vidéo hôte / rail droit.
 */
export function useLiveHostVideoFrames({
  phase,
  cameraOn,
  isGuestUi,
  antennaSoloMode,
  promotedId,
  liveParticipants,
  liveKitMediaEpoch,
  roomRef,
  arenaHostCameraCenter,
  hostRightRailLocalVideoOpen,
  liveRightRailOpen,
}) {
  const rawCameraPipStream = useMemo(() => {
    if (phase !== PHASE.LIVE || !cameraOn) return null;
    const room = roomRef.current;
    const pub = room?.localParticipant?.getTrackPublication(Track.Source.Camera);
    const t = pub?.track?.mediaStreamTrack;
    if (!t || t.readyState === 'ended') return null;
    return new MediaStream([t]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cameraOn, liveKitMediaEpoch]);

  const lhMainRemoteParticipant = useMemo(() => {
    if (isGuestUi || phase !== PHASE.LIVE || antennaSoloMode) return null;
    const room = roomRef.current;
    if (!room?.localParticipant) return null;
    const remotes = Array.from(room.remoteParticipants.values());
    if (remotes.length === 0) return null;
    const localId = room.localParticipant.identity;
    let targetId = promotedId;
    if (targetId && String(targetId) === String(localId)) {
      targetId = remotes[0]?.identity ?? null;
    }
    if (!targetId) {
      targetId = remotes[0]?.identity ?? null;
    }
    if (!targetId) return null;
    return remotes.find((p) => String(p.identity) === String(targetId)) ?? remotes[0];
  }, [promotedId, liveParticipants, liveKitMediaEpoch, phase, isGuestUi, antennaSoloMode]);

  const lhHostShowsRemoteMain = Boolean(
    !isGuestUi
    && phase === PHASE.LIVE
    && !antennaSoloMode
    && lhMainRemoteParticipant
    && liveParticipants.length > 0,
  );

  const rightRailShowsLocalHost = Boolean(
    !isGuestUi
    && phase === PHASE.LIVE
    && hostRightRailLocalVideoOpen
    && liveRightRailOpen
    && !arenaHostCameraCenter
    && !lhHostShowsRemoteMain,
  );

  const showStripLocalHost = Boolean(
    !isGuestUi
    && phase === PHASE.LIVE
    && !arenaHostCameraCenter
    && !rightRailShowsLocalHost,
  );

  const showHostRightRailVideoFrame = lhHostShowsRemoteMain || rightRailShowsLocalHost;

  const hostRightRailVideoIsCenterCameraOnly = Boolean(
    !isGuestUi
    && phase === PHASE.LIVE
    && arenaHostCameraCenter
    && !lhHostShowsRemoteMain,
  );

  return {
    rawCameraPipStream,
    lhMainRemoteParticipant,
    lhHostShowsRemoteMain,
    rightRailShowsLocalHost,
    showStripLocalHost,
    showHostRightRailVideoFrame,
    hostRightRailVideoIsCenterCameraOnly,
  };
}
