import { useMemo } from 'react';
import { Track } from 'livekit-client';
import { parseLiveKitMetadata } from '@/features/live/host/liveHostUtils';
import { LIRI_MULTILANG_LIVEKIT_IDENTITY_PREFIX } from '@/lib/liriMultilangAudioGuest';

/**
 * Cartes dérivées depuis `roomRef` pour vignettes / dock (epoch + liste dock pour rerender).
 */
export function useLiveHostLiveKitParticipantMaps({
  roomRef,
  liveParticipants,
  liveKitMediaEpoch,
  isGuestUi,
  teacherId,
}) {
  const livekitParticipantsMap = useMemo(() => {
    const room = roomRef.current;
    if (!room) return {};
    const map = {};
    room.remoteParticipants.forEach((p) => {
      map[p.sid || p.identity] = p;
      if (p.identity) map[p.identity] = p;
      const m = parseLiveKitMetadata(p.metadata);
      if (m.userId) map[String(m.userId)] = p;
    });
    if (room.localParticipant) {
      const lp = room.localParticipant;
      map.local = lp;
      if (lp.sid) map[lp.sid] = lp;
      if (lp.identity) map[lp.identity] = lp;
      const lm = parseLiveKitMetadata(lp.metadata);
      if (lm.userId) map[String(lm.userId)] = lp;
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- roomRef ; epoch: nouvelles pistes caméra sans join/leave
  }, [liveParticipants, liveKitMediaEpoch]);

  const guestLivekitInterpreterParticipants = useMemo(() => {
    const room = roomRef.current;
    if (!room || !isGuestUi) return [];
    return Array.from(room.remoteParticipants.values()).filter((p) =>
      String(p.identity || '').startsWith(LIRI_MULTILANG_LIVEKIT_IDENTITY_PREFIX),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- roomRef
  }, [isGuestUi, liveKitMediaEpoch, liveParticipants]);

  const hostLiveKitParticipant = useMemo(() => {
    const room = roomRef.current;
    if (!room) return null;

    const metaRole = (p) => parseLiveKitMetadata(p?.metadata).role;
    const locals = room.localParticipant ? [room.localParticipant] : [];
    const remotes = Array.from(room.remoteParticipants.values());

    for (const p of [...locals, ...remotes]) {
      if (metaRole(p) === 'host') return p;
    }

    if (teacherId != null) {
      const tid = String(teacherId);
      if (String(room.localParticipant?.identity) === tid) return room.localParticipant;
      for (const p of remotes) {
        if (String(p.identity) === tid) return p;
      }
    }

    if (isGuestUi) {
      for (const p of remotes) {
        const hasCam = Array.from(p.videoTrackPublications?.values?.() || []).some(
          (pub) => pub.source === Track.Source.Camera && !pub.isMuted && pub.track,
        );
        if (hasCam) return p;
      }
      return remotes[0] ?? null;
    }

    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- roomRef
  }, [teacherId, liveKitMediaEpoch, liveParticipants, isGuestUi]);

  return {
    livekitParticipantsMap,
    guestLivekitInterpreterParticipants,
    hostLiveKitParticipant,
  };
}
