import { useRef } from 'react';
import { useRoomContext, useConnectionState } from '@livekit/components-react';
import { useLiveDataSaver } from '@/hooks/useLiveDataSaver';
import { useLiveKitCameraSubscription } from '@/features/live/hooks/useLiveKitCameraSubscription';

/**
 * Effet « basse conso / audio-first » pour la voie `@livekit/components-react`
 * (`<LiveKitRoom>` : ConsultationRoom MEDOS, LiveEmbedPage…). À rendre comme
 * enfant d'un `<LiveKitRoom>`, façon `<RoomAudioRenderer />`. Ne rend rien.
 *
 * Récupère la Room via le contexte et applique le même hook que la voie
 * bas-niveau : quand le mode est actif, désabonne les caméras distantes
 * (audio + partage d'écran préservés). L'état de connexion sert de signal
 * « room prête » pour ré-appliquer une fois connecté.
 */
export default function LiveDataSaverEffect() {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { dataSaver } = useLiveDataSaver();
  const roomRef = useRef(null);
  roomRef.current = room || null;
  useLiveKitCameraSubscription(roomRef, dataSaver, connectionState);
  return null;
}
