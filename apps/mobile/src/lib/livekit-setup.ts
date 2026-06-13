/**
 * Enregistre les globals WebRTC du SDK LiveKit natif — UNIQUEMENT si le module
 * natif est réellement présent (vrai build dev/standalone). Dans Expo Go ou en
 * web, `@livekit/react-native` n'a pas de binaire natif : le require échoue et
 * on devient un no-op silencieux (sinon l'app entière crasherait au démarrage).
 */
import { IS_EXPO_GO } from '@/lib/is-expo-go';

export function setupLiveKit() {
  // Expo Go : ne JAMAIS toucher le module natif (l'accès TurboModule lève une
  // Invariant Violation surfacée par RN même dans un try/catch).
  if (IS_EXPO_GO) return;
  try {
    // require runtime → l'échec d'import est capturé (web sans natif).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lk = require('@livekit/react-native') as { registerGlobals?: () => void };
    lk.registerGlobals?.();
  } catch {
    /* web : pas de LiveKit natif — on ignore. */
  }
}
