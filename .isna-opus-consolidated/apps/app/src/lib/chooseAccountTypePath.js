import { Capacitor } from '@capacitor/core';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/**
 * Parcours multi-rôles : page web plein écran sur desktop, écran coque LIRI sur mobile / Capacitor.
 */
export function getChooseAccountTypePath() {
  if (typeof window === 'undefined') return '/choose-account-type';
  const isMobile =
    Capacitor.isNativePlatform() ||
    (window.matchMedia?.('(max-width: 767px)').matches ?? window.innerWidth < 768);
  return isMobile ? ELEVE_MOBILE.chooseAccountType : '/choose-account-type';
}

export const CHOOSE_ACCOUNT_TYPE_PATHS = ['/choose-account-type', ELEVE_MOBILE.chooseAccountType];
