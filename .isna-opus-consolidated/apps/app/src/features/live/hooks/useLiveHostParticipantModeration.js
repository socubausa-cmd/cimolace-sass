import { useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';

/**
 * Modération participants côté hôte : kick (broadcast + DB), mute audio local LiveKit,
 * résolution signal main levée + retrait du panneau mains levées.
 */
export function useLiveHostParticipantModeration({
  sessionId,
  roomRef,
  setLiveParticipants,
  setModal,
  setPanels,
}) {
  const kickParticipant = useCallback(
    async (member) => {
      if (!sessionId) return;
      const ch = supabase.channel(`liri-host-kick-${sessionId}`);
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await broadcastRealtime(ch, 'kick', { userId: member.id, identity: member.name });
          supabase.removeChannel(ch);
        }
      });
      if (member.id && String(member.id) !== 'local') {
        await supabase
          .from('live_session_participants')
          .update({ left_at: new Date().toISOString(), kick_reason: 'removed_by_host' })
          .eq('live_session_id', sessionId)
          .eq('user_id', member.id)
          .catch(() => {});
      }
      setLiveParticipants((prev) => prev.filter((p) => p.id !== member.id));
      setModal(null);
    },
    [sessionId, setLiveParticipants, setModal],
  );

  const muteParticipant = useCallback(
    (member) => {
      const room = roomRef.current;
      if (!room) return;
      let remote = room.remoteParticipants.get(String(member.id));
      if (!remote) {
        for (const p of room.remoteParticipants.values()) {
          if (String(p.sid) === String(member.id) || String(p.identity) === String(member.id)) {
            remote = p;
            break;
          }
        }
      }
      if (!remote) return;
      remote.audioTrackPublications.forEach((pub) => {
        if (pub.track) pub.track.setMuted(true);
      });
      setModal(null);
    },
    [roomRef, setModal],
  );

  const resolveHandRaise = useCallback(
    async (userId) => {
      if (!sessionId) return;
      await supabase
        .from('live_session_signals')
        .update({ resolved: true })
        .eq('live_session_id', sessionId)
        .eq('user_id', userId)
        .eq('type', 'hand_raise')
        .eq('resolved', false)
        .catch(() => {});
      setPanels((prev) =>
        prev.map((p, i) =>
          i === 0 ? { ...p, events: p.events.filter((e) => e.userId !== userId) } : p,
        ),
      );
    },
    [sessionId, setPanels],
  );

  return { kickParticipant, muteParticipant, resolveHandRaise };
}
