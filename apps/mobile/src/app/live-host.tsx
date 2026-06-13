/**
 * Route /live-host — régie live de l'hôte (diffuseur).
 *
 * Résolution du composant :
 *  - build natif (dev/standalone) → live-host-screen.tsx (LiveKit réel)
 *  - Expo Go / web                → live-host-screen.web.tsx (preview HostShell,
 *                                   AUCUN import LiveKit → pas de crash natif)
 *
 * Le require est gardé par IS_EXPO_GO : en Expo Go, le module LiveKit n'est
 * jamais évalué (sinon Invariant Violation au chargement de la route).
 *
 * Navigation attendue : /live-host?id=<sessionId>&deck=<deckId>&title=<titre>.
 */
import { IS_EXPO_GO } from '@/lib/is-expo-go';

/* eslint-disable @typescript-eslint/no-require-imports */
const Screen = (
  IS_EXPO_GO
    ? require('../components/live-host/live-host-screen.web')
    : require('../components/live-host/live-host-screen')
).default;

export default Screen;
