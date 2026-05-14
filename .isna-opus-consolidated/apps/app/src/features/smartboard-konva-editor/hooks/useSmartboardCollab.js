import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';

const CURSOR_COLORS = [
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899',
  '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16',
];

function colorForUser(userId) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return CURSOR_COLORS[h % CURSOR_COLORS.length];
}

/**
 * Collaboration temps reel sur le SmartBoard Designer.
 * - Canal Supabase Realtime Broadcast : `smartboard-collab-{roomId}`
 * - Presence : liste des utilisateurs connectes
 * - Curseurs : positions relayees entre participants
 *
 * @param {{ roomId: string; enabled: boolean }} options
 */
export function useSmartboardCollab({ roomId, enabled = false }) {
  const [peers, setPeers] = useState({});   // { userId: { name, color, x, y, sceneId, at } }
  const [members, setMembers] = useState([]); // liste presence
  const channelRef = useRef(null);
  const meRef = useRef(null);

  // Charger l'utilisateur courant une seule fois
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        meRef.current = {
          id: data.user.id,
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Moi',
          color: colorForUser(data.user.id),
        };
      }
    });
  }, []);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const ch = supabase.channel('smartboard-collab-' + roomId, {
      config: { broadcast: { self: false }, presence: { key: '' } },
    });

    // Presence : arrivee / depart
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const list = Object.values(state).flat().map((p) => ({
        userId: p.userId,
        name: p.name,
        color: p.color,
      }));
      setMembers(list);
    });

    // Curseur distant
    ch.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      if (!payload?.userId) return;
      setPeers((prev) => ({
        ...prev,
        [payload.userId]: {
          name: payload.name || '?',
          color: payload.color || '#f59e0b',
          x: payload.x ?? 0,
          y: payload.y ?? 0,
          sceneId: payload.sceneId || '',
          at: Date.now(),
        },
      }));
    });

    // Depart d'un pair
    ch.on('broadcast', { event: 'leave' }, ({ payload }) => {
      if (!payload?.userId) return;
      setPeers((prev) => {
        const n = { ...prev };
        delete n[payload.userId];
        return n;
      });
    });

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && meRef.current) {
        await ch.track({
          userId: meRef.current.id,
          name: meRef.current.name,
          color: meRef.current.color,
        });
      }
    });

    channelRef.current = ch;

    // Nettoyer les curseurs inactifs (>8s)
    const stalePurge = setInterval(() => {
      const now = Date.now();
      setPeers((prev) => {
        const n = { ...prev };
        let changed = false;
        for (const uid of Object.keys(n)) {
          if (now - n[uid].at > 8000) { delete n[uid]; changed = true; }
        }
        return changed ? n : prev;
      });
    }, 4000);

    return () => {
      clearInterval(stalePurge);
      if (meRef.current) {
        void broadcastRealtime(ch, 'leave', { userId: meRef.current.id });
      }
      void ch.unsubscribe();
      channelRef.current = null;
      setPeers({});
      setMembers([]);
    };
  }, [enabled, roomId]);

  /** Emettre la position du curseur local (appeler sur mousemove du canvas) */
  const sendCursor = useCallback((x, y, sceneId) => {
    const me = meRef.current;
    if (!me || !channelRef.current) return;
    void broadcastRealtime(channelRef.current, 'cursor', {
      userId: me.id,
      name: me.name,
      color: me.color,
      x, y, sceneId,
    });
  }, []);

  return { peers, members, sendCursor, me: meRef.current };
}
