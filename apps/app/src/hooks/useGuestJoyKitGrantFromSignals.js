import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  LIVE_JOYKIT_GRANTED_SIGNAL_TYPE,
  pickActiveJoyKitGrantFromRows,
} from '@/lib/liriLive/joykitRequestSignals';

/**
 * Grant JoyKit effectif depuis les signaux `joykit_granted` (temps réel + expiration).
 */
export function useGuestJoyKitGrantFromSignals(sessionId, userId, { enabled = true } = {}) {
  const [grant, setGrant] = useState(null);
  const rowsRef = useRef([]);

  const recompute = useCallback(() => {
    setGrant(pickActiveJoyKitGrantFromRows(rowsRef.current, Date.now()));
  }, []);

  const fetchRows = useCallback(async () => {
    if (!sessionId || !userId || !enabled) return;
    const { data, error } = await supabase
      .from('live_session_signals')
      .select('id, payload, created_at')
      .eq('live_session_id', sessionId)
      .eq('user_id', userId)
      .eq('type', LIVE_JOYKIT_GRANTED_SIGNAL_TYPE)
      .eq('resolved', true);
    if (error) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[LiriLive joykit_granted] fetch', error);
      }
      return;
    }
    rowsRef.current = data || [];
    recompute();
  }, [sessionId, userId, enabled, recompute]);

  useEffect(() => {
    if (!sessionId || !userId || !enabled) {
      rowsRef.current = [];
      setGrant(null);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      await fetchRows();
      if (cancelled) return;
    })();
    const ch = supabase
      .channel(`guest-joykit-grant:${sessionId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_session_signals',
          filter: `live_session_id=eq.${sessionId}`,
        },
        () => {
          void fetchRows();
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [sessionId, userId, enabled, fetchRows]);

  useEffect(() => {
    if (!enabled) return undefined;
    const id = window.setInterval(() => {
      recompute();
    }, 12_000);
    return () => window.clearInterval(id);
  }, [enabled, recompute]);

  return grant;
}
