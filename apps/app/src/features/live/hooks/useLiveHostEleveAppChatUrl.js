import { useMemo } from 'react';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/** Invité : URL chat session plein écran (app élève `/m/eleve`). */
export function useLiveHostEleveAppChatUrl(isGuestUi, sessionId) {
  return useMemo(() => {
    if (!isGuestUi || !sessionId) return null;
    const q = new URLSearchParams({ session: String(sessionId) }).toString();
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${ELEVE_MOBILE.liveChat}?${q}`;
    }
    return `${ELEVE_MOBILE.liveChat}?${q}`;
  }, [isGuestUi, sessionId]);
}
