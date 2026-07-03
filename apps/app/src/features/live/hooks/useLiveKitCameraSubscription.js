import { useEffect, useRef } from 'react';
import { RoomEvent, Track } from 'livekit-client';

/**
 * Applique le mode « basse conso / audio-first » à la RÉCEPTION d'une Room LiveKit.
 *
 * Quand `dataSaver` est vrai : désabonne (`setSubscribed(false)`) toutes les pistes
 * `Source.Camera` distantes — et rien d'autre (l'audio Microphone et le partage
 * d'écran/slides ScreenShare restent souscrits). `setSubscribed(false)` fait
 * réellement cesser le SFU d'envoyer les octets vidéo (vrai gain downlink),
 * contrairement à masquer un `<video>`. Cf. [[livekit-lowbandwidth-uplink]].
 *
 * Quand `dataSaver` est faux (défaut) : le hook NE FAIT RIEN, SAUF au moment précis
 * où l'on repasse de ON à OFF — il ré-abonne alors UNE fois les caméras qu'il avait
 * coupées, puis laisse `adaptiveStream`/`dynacast` gérer librement (pas de forçage
 * `setSubscribed(true)` en boucle qui contrarierait l'optimisation auto de LiveKit).
 *
 * @param {{ current: import('livekit-client').Room | null }} roomRef
 * @param {boolean} dataSaver
 * @param {*} [epoch]  Signal qui change quand les tracks évoluent (ex. liveKitMediaEpoch) —
 *   sert de dépendance pour ré-appliquer la coupure aux caméras arrivées après le montage.
 */
export function useLiveKitCameraSubscription(roomRef, dataSaver, epoch) {
  const didCutRef = useRef(false);

  useEffect(() => {
    const room = roomRef?.current;
    if (!room || !room.remoteParticipants) return undefined;

    const forEachRemoteCamera = (fn) => {
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications?.forEach((pub) => {
          if (pub?.source === Track.Source.Camera && typeof pub.setSubscribed === 'function') {
            try { fn(pub); } catch { /* ignore */ }
          }
        });
      });
    };

    if (dataSaver) {
      didCutRef.current = true;
      const cut = () => forEachRemoteCamera((pub) => pub.setSubscribed(false));
      cut();
      // Ré-applique aux caméras allumées / ré-souscrites APRÈS l'activation.
      const reapply = () => cut();
      room.on(RoomEvent.TrackPublished, reapply);
      room.on(RoomEvent.ParticipantConnected, reapply);
      room.on(RoomEvent.TrackSubscribed, reapply);
      return () => {
        room.off(RoomEvent.TrackPublished, reapply);
        room.off(RoomEvent.ParticipantConnected, reapply);
        room.off(RoomEvent.TrackSubscribed, reapply);
      };
    }

    // OFF : restaurer une seule fois ce qu'on avait coupé, puis laisser LiveKit gérer.
    if (didCutRef.current) {
      didCutRef.current = false;
      forEachRemoteCamera((pub) => { if (pub.isSubscribed === false) pub.setSubscribed(true); });
    }
    return undefined;
  }, [roomRef, dataSaver, epoch]);
}
