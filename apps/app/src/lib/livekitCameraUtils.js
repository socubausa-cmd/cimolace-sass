import { Track } from 'livekit-client';

/**
 * Cam 2 / SmartBoard : préfère le partage d'écran du participant s'il est actif, sinon la caméra.
 * (Téléphone QR peut envoyer l'un ou l'autre.)
 */
export function getAuxVideoTrackForSmartboard(room, identity) {
  if (!room || identity == null || identity === '') return null;
  const id = String(identity);
  const participant = id === room.localParticipant.identity ? room.localParticipant : room.remoteParticipants.get(id);
  if (!participant) return null;
  const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);
  if (screenPub?.track && screenPub.track.kind === Track.Kind.Video) return screenPub.track;
  return getCameraTrackByIdentity(room, identity);
}

/** Piste caméra LiveKit pour une identité (local ou distant). */
export function getCameraTrackByIdentity(room, identity) {
  if (!room || identity == null || identity === '') return null;
  const id = String(identity);
  const lp = room.localParticipant;
  const participant = id === lp.identity ? lp : room.remoteParticipants.get(id);
  if (!participant) return null;
  const pub = participant.getTrackPublication(Track.Source.Camera);
  if (pub?.track) return pub.track;
  for (const p of participant.videoTrackPublications?.values() ?? []) {
    if (p.source === Track.Source.Camera && p.track) return p.track;
  }
  return null;
}
