import { Capacitor } from '@capacitor/core';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/**
 * Parcours multi-rôles : page web plein écran (desktop ET mobile web), écran coque
 * LIRI uniquement dans l'app NATIVE Capacitor. (Avant : ≤767px basculait sur la coque.)
 */
export function getChooseAccountTypePath() {
  if (typeof window === 'undefined') return '/choose-account-type';
  return Capacitor.isNativePlatform() ? ELEVE_MOBILE.chooseAccountType : '/choose-account-type';
}

export const CHOOSE_ACCOUNT_TYPE_PATHS = ['/choose-account-type', ELEVE_MOBILE.chooseAccountType];
