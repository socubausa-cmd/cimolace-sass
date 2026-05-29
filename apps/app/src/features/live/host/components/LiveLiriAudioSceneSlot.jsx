import React from 'react';
import { LiriAudioMicDuckBridge, LiriAudioSceneOverlay } from '@/lib/liriAudioScene';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Couche audio LIRI — bridge ducking micro côté hôte + overlay scène
 * audio. Rendu différent côté invité (réception remote scene).
 */
export const LiveLiriAudioSceneSlot = ({
  phase,
  isGuestUi,
  micOn,
  liriAudioScenesLength,
  guestLiriAudioSmartboard,
  guestLiriAudioSceneName,
}) => {
  if (phase !== PHASE.LIVE) return null;
  if (!isGuestUi) {
    if (liriAudioScenesLength <= 0) return null;
    return (
      <>
        <LiriAudioMicDuckBridge active={phase === PHASE.LIVE} muted={!micOn} />
        <LiriAudioSceneOverlay enabled />
      </>
    );
  }
  return (
    <div className="pointer-events-none fixed inset-0 z-[43]">
      <LiriAudioSceneOverlay
        enabled
        remotePayload={guestLiriAudioSmartboard}
        remoteSceneName={guestLiriAudioSceneName || null}
      />
    </div>
  );
};

export default LiveLiriAudioSceneSlot;
