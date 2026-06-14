import React, { useEffect, useRef } from 'react';
import { LIRI_MULTILANG_LIVEKIT_IDENTITY_PREFIX } from '@/lib/liriMultilangAudioGuest';

/**
 * Attache les pistes micro LiveKit des participants `liri-ml-{lang}` (agent / worker hors navigateur).
 */
function SingleInterpreterTrack({ participant, volume, mediaEpoch }) {
  const ref = useRef(null);
  const attachedRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !participant) return;
    const prev = attachedRef.current;
    if (prev) {
      try {
        prev.detach(el);
      } catch {
        /* ignore */
      }
      attachedRef.current = null;
    }
    const pub = Array.from(participant.audioTrackPublications?.values?.() || []).find(
      (x) => x.track && !x.isMuted,
    );
    if (!pub?.track) return;
    pub.track.attach(el);
    attachedRef.current = pub.track;
    el.volume = typeof volume === 'number' ? Math.min(1, Math.max(0, volume)) : 0.85;
    return () => {
      if (attachedRef.current && el) {
        try {
          attachedRef.current.detach(el);
        } catch {
          /* ignore */
        }
      }
      attachedRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volume via effet dédié
  }, [participant, mediaEpoch]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = typeof volume === 'number' ? Math.min(1, Math.max(0, volume)) : 0.85;
  }, [volume]);

  return <audio ref={ref} autoPlay style={{ display: 'none' }} />;
}

/**
 * @param {{ participants: import('livekit-client').Participant[]; volume?: number; mediaEpoch?: number }} p
 */
export default function GuestLivekitInterpreterAudios({ participants = [], volume = 0.85, mediaEpoch = 0 }) {
  const list = (participants || []).filter((p) =>
    String(p?.identity || '').startsWith(LIRI_MULTILANG_LIVEKIT_IDENTITY_PREFIX),
  );
  if (!list.length) return null;
  return (
    <>
      {list.map((p) => (
        <SingleInterpreterTrack key={p.sid || p.identity} participant={p} volume={volume} mediaEpoch={mediaEpoch} />
      ))}
    </>
  );
}
