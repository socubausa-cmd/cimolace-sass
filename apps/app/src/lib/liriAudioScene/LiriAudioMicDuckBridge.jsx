import { useLiriAudioMicDuck } from './useLiriAudioMicDuck';

/**
 * @param {{ active: boolean; muted: boolean }} props
 * `muted` = micro coupé côté UI LiveKit (inverse de « capture active »).
 */
export function LiriAudioMicDuckBridge({ active, muted }) {
  useLiriAudioMicDuck({
    micCapturing: !muted,
    enabled: Boolean(active),
  });
  return null;
}
