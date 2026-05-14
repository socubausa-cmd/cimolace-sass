import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { ensureFreshSession } from '@/lib/supabaseResilience';

/**
 * Compteur côté RPC `live_session_active_participant_count` (participants avec left_at NULL).
 * Réservé aux sessions arène (pas aux immersive_live_sessions).
 *
 * @param {string|null|undefined} liveSessionId — `live_sessions.id`
 * @param {{ enabled?: boolean, pollMs?: number }} [opts]
 */
export function useLiveSessionActiveParticipantCount(liveSessionId, opts = {}) {
  const { enabled = true, pollMs = 12_000 } = opts;
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !liveSessionId) {
      setCount(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await ensureFreshSession(supabase, 60);
      const { data, error } = await supabase.rpc('live_session_active_participant_count', {
        p_session_id: liveSessionId,
      });
      if (error) throw error;
      const n = data == null ? null : Number(data);
      setCount(Number.isFinite(n) ? n : null);
    } catch (e) {
      console.warn('[useLiveSessionActiveParticipantCount]', e?.message || e);
      setCount(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, liveSessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !liveSessionId) return undefined;
    const t = setInterval(() => {
      void load();
    }, pollMs);
    return () => clearInterval(t);
  }, [enabled, liveSessionId, pollMs, load]);

  return { count, loading, refresh: load };
}
