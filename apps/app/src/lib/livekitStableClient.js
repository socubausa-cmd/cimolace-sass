import { DefaultReconnectPolicy } from 'livekit-client';

/**
 * Backoff reconnexion (ms) — plus d'essais et étalement que le défaut LiveKit
 * pour mieux passer les réseaux instables sans abandonner trop tôt.
 */
const STABLE_RETRY_DELAYS_MS = [
  0, 200, 400, 600, 1_000, 1_500, 2_200, 3_000, 4_000, 5_000, 6_000, 7_000,
  7_000, 7_000, 7_000, 7_000, 7_000, 7_000, 7_000, 7_000,
];

/**
 * @param {import('livekit-client').RoomOptions} [overrides]
 * @returns {import('livekit-client').RoomOptions}
 */
export function getStableLiveKitRoomOptions(overrides = {}) {
  return {
    /** Par défaut le SDK appelle disconnect() sur pagehide/beforeunload/freeze — très agressif sur mobile / multi-onglets. */
    disconnectOnPageLeave: false,
    reconnectPolicy: new DefaultReconnectPolicy(STABLE_RETRY_DELAYS_MS),
    ...overrides,
  };
}

/** Timeouts et retries pour le handshake initial (réseau lent). */
export const stableLiveKitConnectOptions = {
  maxRetries: 1,
  peerConnectionTimeout: 20_000,
  websocketTimeout: 20_000,
};
