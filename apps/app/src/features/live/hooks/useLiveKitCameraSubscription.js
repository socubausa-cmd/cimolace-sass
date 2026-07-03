import { useEffect } from 'react';
import { RoomEvent, Track } from 'livekit-client';

/**
 * Applique le mode « basse conso / audio-first » à la RÉCEPTION d'une Room LiveKit :
 * quand `dataSaver` est vrai, désabonne (`setSubscribed(false)`) toutes les pistes
 * `Source.Camera` distantes — et rien d'autre (l'audio Microphone et le partage
 * d'écran/slides ScreenShare restent souscrits). Quand `dataSaver` repasse faux,
 * ré-abonne les caméras.
 *
 * `setSubscribed(false)` fait réellement cesser le SFU d'envoyer les octets vidéo
 * (vrai gain downlink) — contrairement à masquer un `<video>`, qui continue de
 * télécharger. Cf. [[livekit-lowbandwidth-uplink]].
 *
 * @param {{ current: import('livekit-client').Room | null }} roomRef
 * @param {boolean} dataSaver
 * @param {*} [epoch]  Signal qui change quand les tracks évoluent (ex. liveKitMediaEpoch).
 *   Sert de dépendance pour ré-appliquer quand la Room devient prête / que des caméras
 *   arrivent après le montage du hook (un ref ne re-déclenche pas l'effet à lui seul).
 */
export function useLiveKitCameraSubscription(roomRef, dataSaver, epoch) {
  useEffect(() => {
    const room = roomRef?.current;
    if (!room || !room.remoteParticipants) return undefined;

    const apply = () => {
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications?.forEach((pub) => {
          if (pub?.source === Track.Source.Camera && typeof pub.setSubscribed === 'function') {
            try { pub.setSubscribed(!dataSaver); } catch { /* ignore */ }
          }
        });
      });
    };

    apply();

    // Ré-applique pour les caméras qui s'allument APRÈS l'activation du mode.
    const reapply = () => apply();
    room.on(RoomEvent.TrackPublished, reapply);
    room.on(RoomEvent.ParticipantConnected, reapply);
    return () => {
      room.off(RoomEvent.TrackPublished, reapply);
      room.off(RoomEvent.ParticipantConnected, reapply);
    };
  }, [roomRef, dataSaver, epoch]);
}
