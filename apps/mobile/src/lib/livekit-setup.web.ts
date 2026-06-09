/**
 * Variante WEB : LiveKit natif (WebRTC) n'existe pas côté web/Expo Go.
 * No-op — Metro choisit ce fichier pour le bundle web, évitant l'import de
 * @livekit/react-native qui casserait le bundle (requireNativeComponent).
 */
export function setupLiveKit() {
  /* no-op sur web */
}
