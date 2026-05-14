import { useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Zone 3 — mains levées (lower) + sièges privilégiés (grant / revoke).
 */
export function useLiveHostZone3({
  zone3RaisedHands,
  setZone3RaisedHands,
  setZone3PrivilegedSeats,
  setPanels,
}) {
  const zone3LowerHand = useCallback(async (userId) => {
    const entry = zone3RaisedHands.find(h => h.userId === userId);
    if (!entry) return;
    await supabase.from('live_session_signals').update({ resolved: true }).eq('id', entry.signalId);
    setZone3RaisedHands(prev => prev.filter(h => h.userId !== userId));
    setPanels(prev => prev.map((p, i) => i === 0 ? { ...p, events: p.events.filter(e => e.userId !== userId) } : p));
  }, [zone3RaisedHands, setZone3RaisedHands, setPanels]);

  const zone3GrantSeat = useCallback((member, position) => {
    if (!position || !member?.userId) return;
    const userId = String(member.userId);
    const name   = member.name || 'Participant';
    setZone3PrivilegedSeats(prev => {
      const withoutPos  = prev.filter(s => Number(s.position) !== Number(position));
      const withoutUser = withoutPos.filter(s => s.userId !== userId);
      return [...withoutUser, { position: Number(position), userId, name }];
    });
  }, [setZone3PrivilegedSeats]);

  const zone3RevokeSeat = useCallback((userId) => {
    if (!userId) return;
    setZone3PrivilegedSeats(prev => prev.filter(s => s.userId !== String(userId)));
  }, [setZone3PrivilegedSeats]);

  return { zone3LowerHand, zone3GrantSeat, zone3RevokeSeat };
}
