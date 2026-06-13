/**
 * Route /live-room — salle live (hôte / élève).
 *
 * Résolution du composant :
 *  - build natif (dev/standalone) → LiveRoomNative.tsx (LiveKit réel)
 *  - Expo Go / web                → LiveRoomNative.web.tsx (preview sans LiveKit)
 *
 * Le require est gardé par IS_EXPO_GO : en Expo Go, le module LiveKit n'est
 * jamais évalué (sinon Invariant Violation au chargement de la route).
 */
import { IS_EXPO_GO } from '@/lib/is-expo-go';

/* eslint-disable @typescript-eslint/no-require-imports */
const Screen = (
  IS_EXPO_GO ? require('../components/LiveRoomNative.web') : require('../components/LiveRoomNative')
).default;

export default Screen;
