import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  LIVE_PERMISSION_REQUEST_SIGNAL_TYPE,
  computeGuestGrantsFromSignalRows,
} from '@/lib/liriLive/permissionRequestSignals';

/**
 * Phase 5 : grants effectifs depuis les signaux `permission_request` résolus et approuvés (temps réel + expiration 5 min).
 */
export function useGuestPermissionGrantsFromSignals(sessionId, userId, { enabled = true } = {}) {
  const [snapshot, setSnapshot] = useState(() => ({ sessionGrants: [], temporaryGrants: [] }));
  const rowsRef = useRef([]);

  const recompute = useCallback(() => {
    setSnapshot(computeGuestGrantsFromSignalRows(rowsRef.current, Date.now()));
  }, []);

  const fetchRows = useCallback(async () => {
    if (!sessionId || !userId || !enabled) return;
    const { data, error } = await supabase
      .from('live_session_signals')
      .select('id, payload, resolved')
      .eq('live_session_id', sessionId)
      .eq('user_id', userId)
      .eq('type', LIVE_PERMISSION_REQUEST_SIGNAL_TYPE)
      .eq('resolved', true);
    if (error) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[LiriLive grants] fetch', error);
      }
      return;
    }
    rowsRef.current = data || [];
    recompute();
  }, [sessionId, userId, enabled, recompute]);

  useEffect(() => {
    if (!sessionId || !userId || !enabled) {
      rowsRef.current = [];
      setSnapshot({ sessionGrants: [], temporaryGrants: [] });
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      await fetchRows();
      if (cancelled) return;
    })();
    const ch = supabase
      .channel(`guest-perm-grants:${sessionId}:${userId}`)
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

  return snapshot;
}
