import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Vrai quand l'app tourne dans **Expo Go** (client de l'App Store), qui
 * n'embarque PAS les modules natifs custom (LiveKit/WebRTC, Skia…). Les écrans
 * qui en dépendent doivent alors basculer sur une variante preview sans les
 * importer. En build dev/standalone → false (les natifs sont présents).
 */
export const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
