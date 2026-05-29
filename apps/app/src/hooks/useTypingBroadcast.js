import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';

function buildChannelName(userA, userB) {
  const sorted = [userA, userB].sort();
  return `typing:${sorted[0]}:${sorted[1]}`;
}

export function useTypingBroadcast(currentUserId, remoteUserId) {
  const [remoteText, setRemoteText] = useState('');
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);
  const channelRef = useRef(null);
  const timeoutRef = useRef(null);
  const stopTimeoutRef = useRef(null);

  useEffect(() => {
    if (!currentUserId || !remoteUserId) return undefined;

    const channelName = buildChannelName(currentUserId, remoteUserId);
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === currentUserId) return;
        if (payload.isTyping) {
          setRemoteText(payload.text || '');
          setIsRemoteTyping(true);

          if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
          stopTimeoutRef.current = setTimeout(() => {
            setIsRemoteTyping(false);
            setRemoteText('');
          }, 3000);
        } else {
          setIsRemoteTyping(false);
          setRemoteText('');
        }
      })
      .on('broadcast', { event: 'sent' }, ({ payload }) => {
        if (payload.userId === currentUserId) return;
        setIsRemoteTyping(false);
        setRemoteText('');
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUserId, remoteUserId]);

  const broadcastTyping = useCallback(
    (text) => {
      if (!channelRef.current) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      void broadcastRealtime(channelRef.current, 'typing', {
        userId: currentUserId,
        text,
        isTyping: true,
      });

      timeoutRef.current = setTimeout(() => {
        if (!channelRef.current) return;
        void broadcastRealtime(channelRef.current, 'typing', {
          userId: currentUserId,
          text: '',
          isTyping: false,
        });
      }, 2000);
    },
    [currentUserId]
  );

  const broadcastSent = useCallback(() => {
    if (!channelRef.current) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    void broadcastRealtime(channelRef.current, 'sent', { userId: currentUserId });
  }, [currentUserId]);

  return { remoteText, isRemoteTyping, broadcastTyping, broadcastSent };
}
