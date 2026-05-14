import { useEffect, useMemo, useState } from 'react';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * `?liveMediaCheck=1` : tick périodique pour rafraîchir le panneau diagnostic LiveKit en LIVE.
 */
export function useLiveHostLiveMediaCheck(phase, locationSearch) {
  const liveMediaCheck = useMemo(
    () => new URLSearchParams(locationSearch).get('liveMediaCheck') === '1',
    [locationSearch],
  );
  const [liveMediaDiagTick, setLiveMediaDiagTick] = useState(0);
  useEffect(() => {
    if (!liveMediaCheck || phase !== PHASE.LIVE) return;
    const id = window.setInterval(() => setLiveMediaDiagTick((t) => t + 1), 1200);
    return () => window.clearInterval(id);
  }, [liveMediaCheck, phase]);
  return { liveMediaCheck, liveMediaDiagTick };
}
