import { DefaultReconnectPolicy, VideoPresets, ScreenSharePresets } from 'livekit-client';

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
  const { publishDefaults: overridePublishDefaults, ...restOverrides } = overrides;
  return {
    /** Par défaut le SDK appelle disconnect() sur pagehide/beforeunload/freeze — très agressif sur mobile / multi-onglets. */
    disconnectOnPageLeave: false,
    reconnectPolicy: new DefaultReconnectPolicy(STABLE_RETRY_DELAYS_MS),
    /**
     * Plafond d'émission (uplink) pour tenir en connexion faible (3G Afrique) :
     * caméra bornée à ~500 kbps@20fps, avec une couche basse h180 (~150 kbps)
     * toujours disponible quand le lien s'effondre ; audio protégé (RED anti-perte
     * de paquets + DTX). Sans ça, l'émetteur part au défaut SDK 720p/1,7 Mbps et
     * sature son lien montant. Priorité au débit fluide (maintain-framerate) pour
     * une caméra parlante. Surchargeable par tenant/écran via overrides.publishDefaults.
     */
    publishDefaults: {
      simulcast: true,
      dtx: true,
      red: true,
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
      videoEncoding: { maxBitrate: 500_000, maxFramerate: 20 },
      screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
      degradationPreference: 'maintain-framerate',
      ...(overridePublishDefaults || {}),
    },
    ...restOverrides,
  };
}

/** Timeouts et retries pour le handshake initial (réseau lent). */
export const stableLiveKitConnectOptions = {
  maxRetries: 1,
  peerConnectionTimeout: 20_000,
  websocketTimeout: 20_000,
};
