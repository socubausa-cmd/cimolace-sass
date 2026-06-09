/**
 * Route /arena/:sessionId — Salle de Débat Arena (vue invitée / viewer).
 *
 * Résolution du composant :
 *  - build natif (dev/standalone) → arena-screen.tsx (LiveKit réel)
 *  - Expo Go / web                → arena-screen.web.tsx (stub sans LiveKit)
 *
 * Le require est gardé par IS_EXPO_GO : en Expo Go, le module LiveKit n'est
 * jamais évalué (sinon Invariant Violation au chargement de la route).
 */
import { IS_EXPO_GO } from '@/lib/is-expo-go';

/* eslint-disable @typescript-eslint/no-require-imports */
const Screen = (
  IS_EXPO_GO
    ? require('../../components/arena/arena-screen.web')
    : require('../../components/arena/arena-screen')
).default;

export default Screen;
