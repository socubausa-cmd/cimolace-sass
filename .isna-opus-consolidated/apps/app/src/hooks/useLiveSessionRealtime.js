/**
 * Supabase Realtime pour une session live
 * Channels: presence, events (hand_raise, visibility_mode), chat
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';

const CHANNEL_PREFIX = 'live';

export function useLiveSessionRealtime(liveSessionId, { initialVisibilityMode, onHandRaise, onVisibilityChange, onChatMessage } = {}) {
  const [presence, setPresence] = useState([]);
  const [handRaises, setHandRaises] = useState([]);
  const [visibilityMode, setVisibilityMode] = useState(initialVisibilityMode || 'secret');
  const channelRef = useRef(null);

  useEffect(() => {
    if (initialVisibilityMode) setVisibilityMode(initialVisibilityMode);
  }, [initialVisibilityMode]);

  useEffect(() => {
    if (!liveSessionId) return;

    const channelName = `${CHANNEL_PREFIX}:${liveSessionId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: liveSessionId },
        broadcast: { self: true },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresence(Object.values(state).flat());
      })
      .on('broadcast', { event: 'hand_raise' }, ({ payload }) => {
        setHandRaises((prev) => {
          const next = prev.filter((p) => p.userId !== payload.userId);
          if (payload.raised) next.push({ userId: payload.userId, userName: payload.userName, raisedAt: Date.now() });
          return next;
        });
        onHandRaise?.(payload);
      })
      .on('broadcast', { event: 'visibility_mode' }, ({ payload }) => {
        setVisibilityMode(payload.mode || 'secret');
        onVisibilityChange?.(payload.mode);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        onChatMessage?.(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ joinedAt: Date.now() });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [liveSessionId, onHandRaise, onVisibilityChange, onChatMessage]);

  const broadcastHandRaise = useCallback(
    (raised, { userId, userName } = {}) => {
      if (!channelRef.current) return;
      void broadcastRealtime(channelRef.current, 'hand_raise', { raised, userId, userName });
    },
    []
  );

  const broadcastVisibilityMode = useCallback(
    (mode) => {
      if (!channelRef.current) return;
      void broadcastRealtime(channelRef.current, 'visibility_mode', { mode });
    },
    []
  );

  const broadcastChat = useCallback(
    (message) => {
      if (!channelRef.current) return;
      void broadcastRealtime(channelRef.current, 'chat', message);
    },
    []
  );

  return {
    presence,
    handRaises,
    visibilityMode,
    broadcastHandRaise,
    broadcastVisibilityMode,
    broadcastChat,
  };
}
