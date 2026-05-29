import React, { useEffect, useRef } from 'react';
import { Track } from 'livekit-client';

/**
 * Attache la piste caméra LiveKit à un <video> (réutilisable hors LiveHostPage).
 */
export default function LiveKitVideoCell({ participant, mediaEpoch = 0, className, style }) {
  const vRef = useRef(null);
  useEffect(() => {
    if (!participant || !vRef.current) return;
    const camPub =
      typeof participant.getTrackPublication === 'function'
        ? participant.getTrackPublication(Track.Source.Camera)
        : null;
    const fromIter =
      camPub ||
      Array.from(participant.videoTrackPublications?.values?.() || []).find(
        (p) => p.source === Track.Source.Camera && !p.isMuted && p.track,
      );
    if (!fromIter?.track) return;
    fromIter.track.attach(vRef.current);
    return () => {
      fromIter.track?.detach(vRef.current);
    };
  }, [participant, mediaEpoch]);
  return (
    <video
      ref={vRef}
      autoPlay
      playsInline
      muted
      className={className}
      style={{ objectFit: 'cover', maxWidth: '100%', maxHeight: '100%', ...style }}
    />
  );
}
