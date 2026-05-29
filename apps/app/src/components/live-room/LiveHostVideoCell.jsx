import React, { useEffect, useRef } from 'react';
import { pickCameraPublicationForPreview } from '@/lib/liveKitParticipantVideo';

/**
 * Attache la piste caméra LiveKit à un &lt;video&gt; (aperçu hôte / invité).
 * Composant de module — évite des hooks imbriqués dans useCallback sur LiveHostPage.
 */
export default function LiveHostVideoCell({ participant, mediaEpoch, style }) {
  const vRef = useRef(null);
  useEffect(() => {
    if (!participant || !vRef.current) return;
    const pub = pickCameraPublicationForPreview(participant);
    if (!pub?.track) return;
    pub.track.attach(vRef.current);
    return () => {
      try {
        pub.track?.detach(vRef.current);
      } catch {
        /* ignore */
      }
    };
  }, [participant, mediaEpoch]);
  return (
    <video
      ref={vRef}
      autoPlay
      playsInline
      muted
      style={{
        objectFit: 'cover',
        maxWidth: '100%',
        maxHeight: '100%',
        ...style,
      }}
    />
  );
}
