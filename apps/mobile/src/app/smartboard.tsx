/**
 * Route /smartboard — éditeur SmartBoard.
 *
 * Résolution du composant :
 *  - build natif (dev/standalone) → smartboard-screen.tsx (Skia réel)
 *  - Expo Go / web                → smartboard-screen.web.tsx (stub sans Skia)
 *
 * Le require est gardé par IS_EXPO_GO : en Expo Go, @shopify/react-native-skia
 * (module natif absent) n'est jamais évalué → pas de crash au chargement.
 *
 * Paramètres optionnels : ?id=<workspaceId>&title=<titre>.
 */
import { IS_EXPO_GO } from '@/lib/is-expo-go';

/* eslint-disable @typescript-eslint/no-require-imports */
const Screen = (
  IS_EXPO_GO
    ? require('../components/smartboard/smartboard-screen.web')
    : require('../components/smartboard/smartboard-screen')
).default;

export default Screen;
