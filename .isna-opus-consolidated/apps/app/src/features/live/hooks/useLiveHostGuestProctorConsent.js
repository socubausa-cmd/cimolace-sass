import { useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Gestion du consentement caméra surveillée côté invité :
 * persiste localStorage + DB et avance le compteur de version.
 */
export function useLiveHostGuestProctorConsent({
  sessionId,
  userId,
  toast,
  setGuestProctorModalOpen,
  setGuestProctorConsentVersion,
}) {
  const acceptGuestProctorConsent = useCallback(async () => {
    if (!sessionId || !userId) return;
    try {
      localStorage.setItem(`liri-proctor-cam-${sessionId}-${userId}`, '1');
    } catch {
      /* ignore */
    }
    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent).slice(0, 400) : null;
    const { error } = await supabase.from('live_session_proctor_consents').upsert(
      {
        live_session_id: sessionId,
        user_id: userId,
        accepted_at: new Date().toISOString(),
        user_agent: ua,
      },
      { onConflict: 'live_session_id,user_id' },
    );
    if (error) {
      toast({
        title: 'Enregistrement du consentement',
        description: error.message || 'Réessayez ou vérifiez la connexion.',
        variant: 'destructive',
      });
      return;
    }
    setGuestProctorModalOpen(false);
    setGuestProctorConsentVersion((n) => n + 1);
  }, [sessionId, userId, toast, setGuestProctorModalOpen, setGuestProctorConsentVersion]);

  return { acceptGuestProctorConsent };
}
