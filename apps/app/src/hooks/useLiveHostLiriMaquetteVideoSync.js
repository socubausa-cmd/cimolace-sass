import { useCallback, useEffect } from 'react';
import { RoomEvent, Track } from 'livekit-client';

/**
 * Attache les pistes caméra LiveKit sur les &lt;video&gt; de la maquette mobile hôte
 * (même logique qu'on Live Arena : entrant = grand cadre, local = miniature).
 * Re-sync sur souscription / publication (sinon l'&lt;video&gt; de la maquette reste détaché = écran noir).
 */
export function useLiveHostLiriMaquetteVideoSync({
  active = false,
  roomRef,
  mainVideoRef,
  miniVideoRef,
  /** Ref mutable vers promotedId (évite rebind des callbacks LiveKit). */
  promotedIdRef,
}) {
  const sync = useCallback(() => {
    const room = roomRef?.current;
    if (!room) return;
    const mainEl = mainVideoRef?.current;
    const miniEl = miniVideoRef?.current;
    if (!mainEl && !miniEl) return;
    const localIdentity = room.localParticipant.identity;
    let mainTargetIdentity = promotedIdRef?.current;

    if (mainTargetIdentity && String(mainTargetIdentity) === String(localIdentity)) {
      mainTargetIdentity = room.remoteParticipants.keys().next().value ?? null;
    }
    if (!mainTargetIdentity) {
      mainTargetIdentity = room.remoteParticipants.keys().next().value ?? null;
    }

    const localCam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (localCam && miniEl) {
      try {
        localCam.detach();
        localCam.attach(miniEl);
      } catch {
        /* ignore */
      }
    }

    for (const participant of room.remoteParticipants.values()) {
      const t = participant.getTrackPublication(Track.Source.Camera)?.track;
      if (!t) continue;
      try {
        t.detach();
      } catch {
        /* ignore */
      }
      if (mainEl && mainTargetIdentity && String(participant.identity) === String(mainTargetIdentity)) {
        try {
          t.attach(mainEl);
        } catch {
          /* ignore */
        }
      }
    }
  }, [roomRef, mainVideoRef, miniVideoRef, promotedIdRef]);

  useEffect(() => {
    if (!active) return undefined;
    const raf1 = requestAnimationFrame(() => sync());
    const t1 = setTimeout(() => {
      try {
        sync();
      } catch {
        /* ignore */
      }
    }, 150);
    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(t1);
    };
  }, [active, sync]);

  useEffect(() => {
    if (!active) return undefined;
    const room = roomRef?.current;
    if (!room) return undefined;

    const run = () => {
      try {
        sync();
      } catch {
        /* ignore */
      }
    };

    room.on(RoomEvent.LocalTrackPublished, run);
    room.on(RoomEvent.LocalTrackUnpublished, run);
    room.on(RoomEvent.TrackSubscribed, run);
    room.on(RoomEvent.TrackUnsubscribed, run);
    room.on(RoomEvent.ParticipantConnected, run);
    room.on(RoomEvent.ParticipantDisconnected, run);

    run();
    const t = setTimeout(run, 150);

    return () => {
      clearTimeout(t);
      room.off(RoomEvent.LocalTrackPublished, run);
      room.off(RoomEvent.LocalTrackUnpublished, run);
      room.off(RoomEvent.TrackSubscribed, run);
      room.off(RoomEvent.TrackUnsubscribed, run);
      room.off(RoomEvent.ParticipantConnected, run);
      room.off(RoomEvent.ParticipantDisconnected, run);
    };
  }, [active, roomRef, sync]);

  return { sync };
}
