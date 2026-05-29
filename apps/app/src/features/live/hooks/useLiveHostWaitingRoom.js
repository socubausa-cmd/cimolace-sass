import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Salle d'attente live (`live_waiting_room_entries`) : chargement, realtime,
 * acceptation / refus. Le parent synchronise UI (chime, panneau « salle d'attente »)
 * via `onWaitingEntriesHydrated` quand la liste non vide est (re)chargée.
 */
export function useLiveHostWaitingRoom({ sessionId, onWaitingEntriesHydrated }) {
  const [waitingEntries, setWaitingEntries] = useState([]);

  useEffect(() => {
    if (!sessionId) return;

    const loadWaiting = async () => {
      const { data: rows, error } = await supabase
        .from('live_waiting_room_entries')
        .select('id, user_id, status, invitation_type, joined_waiting_at')
        .eq('live_session_id', sessionId)
        .eq('status', 'waiting')
        .order('joined_waiting_at', { ascending: true });
      if (error || !rows?.length) {
        setWaitingEntries([]);
        return;
      }
      const uids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const { data: profs } = uids.length
        ? await supabase.from('profiles').select('id, name, avatar_url').in('id', uids)
        : { data: [] };
      const pmap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      const entries = rows.map((r) => ({ ...r, profile: pmap[r.user_id] || null }));
      setWaitingEntries(entries);
      if (typeof onWaitingEntriesHydrated === 'function') {
        onWaitingEntriesHydrated(entries);
      }
    };

    loadWaiting();

    const ch = supabase
      .channel(`waiting-host-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_waiting_room_entries',
          filter: `live_session_id=eq.${sessionId}`,
        },
        () => {
          void loadWaiting();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, onWaitingEntriesHydrated]);

  const approveWaiting = useCallback(
    async (entryId, { videoOff = false, audioOff = false, audioOnly = false } = {}) => {
      await supabase
        .from('live_waiting_room_entries')
        .update({
          status: audioOnly ? 'audio_only' : 'accepted',
          accepted_at: new Date().toISOString(),
          granted_publish_video: !videoOff && !audioOnly,
          granted_publish_audio: !audioOff,
        })
        .eq('id', entryId);
      setWaitingEntries((prev) => prev.filter((e) => e.id !== entryId));
    },
    [],
  );

  const rejectWaiting = useCallback(async (entryId) => {
    await supabase
      .from('live_waiting_room_entries')
      .update({ status: 'rejected', rejected_at: new Date().toISOString() })
      .eq('id', entryId);
    setWaitingEntries((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  return { waitingEntries, approveWaiting, rejectWaiting };
}
