import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';

/**
 * Zone 3 — Présence en temps réel, levée de main, salle privilégiée.
 *
 * Présence  : Supabase Realtime Presence (channel `live-zone3-{sessionId}`)
 * Main levée: Supabase Broadcast (même channel)
 * Sièges    : table `privileged_seats` + Postgres Changes Realtime
 */
export function useLiveRoomPresence({ sessionId, currentUser, enabled = false }) {
  const [members, setMembers] = useState([]);            // participants connectés
  const [raisedHands, setRaisedHands] = useState([]);    // [{ userId, name, at }]
  const [privilegedSeats, setPrivilegedSeats] = useState([]); // [{ position, userId, name, … }]

  const channelRef = useRef(null);
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // ─── Broadcast: lever / baisser la main ─────────────────────────────────────
  const raiseHand = useCallback(() => {
    const u = currentUserRef.current;
    if (!u?.id) return;
    void broadcastRealtime(channelRef.current, 'raise_hand', {
      userId: String(u.id),
      name: u.full_name || u.name || 'Membre',
    });
  }, []);

  const lowerHand = useCallback((targetUserId) => {
    const uid = targetUserId || currentUserRef.current?.id;
    if (!uid) return;
    setRaisedHands((prev) => prev.filter((h) => h.userId !== String(uid)));
    void broadcastRealtime(channelRef.current, 'lower_hand', { userId: String(uid) });
  }, []);

  // ─── Sièges privilégiés (persistés en DB) ────────────────────────────────────
  const fetchSeats = useCallback(async (sid) => {
    try {
      const { data, error } = await supabase
        .from('privileged_seats')
        .select('position, user_id, invited_by')
        .eq('session_id', sid)
        .order('position');
      if (error) throw error;

      const userIds = [...new Set((data || []).map((s) => s.user_id).filter(Boolean))];
      let profilesById = new Map();

      if (userIds.length > 0) {
        const { data: profilesRows, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, name, legal_full_name, avatar_url, role')
          .in('id', userIds);
        if (profilesErr) throw profilesErr;
        profilesById = new Map((profilesRows || []).map((p) => [p.id, p]));
      }

      setPrivilegedSeats(
        (data || []).map((s) => {
          const profile = profilesById.get(s.user_id) || null;
          const profileName = profile?.name || profile?.legal_full_name || 'Membre';
          return {
            position: s.position,
            userId: s.user_id,
            name: profileName,
            avatar_url: profile?.avatar_url || null,
            role: profile?.role || 'student',
            invitedBy: s.invited_by,
          };
        })
      );
    } catch (err) {
      // Table may not exist yet — silently ignore
      if (!String(err?.message || '').includes('does not exist')) {
        console.warn('[zone3] fetchSeats:', err?.message);
      }
    }
  }, []);

  const grantSeat = useCallback(async (member, position) => {
    const sid = sessionId;
    const hostId = currentUserRef.current?.id;
    if (!sid || !hostId || !member?.userId) return;
    const { error } = await supabase
      .from('privileged_seats')
      .upsert(
        { session_id: sid, user_id: member.userId, position, invited_by: hostId },
        { onConflict: 'session_id,position' }
      );
    if (error) console.warn('[zone3] grantSeat:', error.message);
    else await fetchSeats(sid);
  }, [sessionId, fetchSeats]);

  const revokeSeat = useCallback(async (userId) => {
    const sid = sessionId;
    if (!sid || !userId) return;
    const { error } = await supabase
      .from('privileged_seats')
      .delete()
      .eq('session_id', sid)
      .eq('user_id', userId);
    if (error) console.warn('[zone3] revokeSeat:', error.message);
    else await fetchSeats(sid);
  }, [sessionId, fetchSeats]);

  // ─── Supabase Realtime: Presence + Broadcast ─────────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId || !currentUser?.id) return undefined;

    const channelName = `live-zone3-${sessionId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: String(currentUser.id) } },
    });
    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState();
      const list = Object.entries(state).map(([userId, presences]) => {
        const p = Array.isArray(presences) ? presences[0] : presences;
        return {
          userId,
          name:       p?.name       || 'Membre',
          role:       p?.role       || 'student',
          avatar_url: p?.avatar_url || null,
          joinedAt:   p?.joinedAt   || Date.now(),
        };
      });
      setMembers(list);
    };

    channel.on('presence', { event: 'sync' },  syncPresence);
    channel.on('presence', { event: 'join' },  syncPresence);
    channel.on('presence', { event: 'leave' }, syncPresence);

    channel.on('broadcast', { event: 'raise_hand' }, ({ payload }) => {
      if (!payload?.userId) return;
      setRaisedHands((prev) => {
        if (prev.find((h) => h.userId === payload.userId)) return prev;
        return [...prev, { userId: payload.userId, name: payload.name || 'Membre', at: Date.now() }];
      });
    });

    channel.on('broadcast', { event: 'lower_hand' }, ({ payload }) => {
      if (!payload?.userId) return;
      setRaisedHands((prev) => prev.filter((h) => h.userId !== payload.userId));
    });

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await channel.track({
        name:       currentUser.full_name || currentUser.name || 'Membre',
        role:       currentUser.role       || 'student',
        avatar_url: currentUser.avatar_url || null,
        joinedAt:   Date.now(),
      });
    });

    // ─── Postgres Changes: privileged_seats ──────────────────────────────────
    const seatsChannel = supabase
      .channel(`priv-seats-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'privileged_seats', filter: `session_id=eq.${sessionId}` },
        () => fetchSeats(sessionId)
      )
      .subscribe();

    void fetchSeats(sessionId);

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel).catch(() => {});
      supabase.removeChannel(seatsChannel).catch(() => {});
      channelRef.current = null;
    };
  }, [enabled, sessionId, currentUser?.id, fetchSeats]);

  const myHandRaised = raisedHands.some((h) => h.userId === String(currentUser?.id || ''));

  return {
    members,
    raisedHands,
    privilegedSeats,
    myHandRaised,
    raiseHand,
    lowerHand,
    grantSeat,
    revokeSeat,
  };
}

export default useLiveRoomPresence;
