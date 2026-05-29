import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';

const CHAT_PAGE = 1000;

/**
 * Forum session live (`live_session_chat`) : chargement paginé, realtime INSERT,
 * envoi message (respect `chat_enabled` pour invité).
 */
export function useLiveHostSessionChat({
  sessionId,
  phase,
  user,
  isGuestUi,
  chatEnabled,
  toast,
  onRemoteChatInserted,
}) {
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    if (!sessionId || phase !== PHASE.LIVE) return;

    setChatMessages([]);
    let cancelled = false;

    (async () => {
      const rows = [];
      for (let from = 0; ; from += CHAT_PAGE) {
        const { data, error } = await supabase
          .from('live_session_chat')
          .select('id, user_id, message, created_at')
          .eq('live_session_id', sessionId)
          .order('created_at', { ascending: true })
          .range(from, from + CHAT_PAGE - 1);
        if (cancelled) return;
        if (error) return;
        if (!data?.length) break;
        rows.push(...data);
        if (data.length < CHAT_PAGE) break;
      }
      if (cancelled || !rows.length) {
        if (!cancelled) setChatMessages([]);
        return;
      }
      const ids = [...new Set(rows.map((m) => m.user_id).filter(Boolean))];
      const { data: profs } = ids.length
        ? await supabase.from('profiles').select('id, name').in('id', ids)
        : { data: [] };
      if (cancelled) return;
      const pmap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      setChatMessages(
        rows.map((m) => ({
          id: m.id,
          userId: m.user_id,
          text: m.message,
          name: pmap[m.user_id]?.name || 'Participant',
          time: m.created_at,
        })),
      );
    })();

    const ch = supabase
      .channel(`live-chat-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_session_chat',
          filter: `live_session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const m = payload.new;
          let name = 'Participant';
          const { data: prof } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', m.user_id)
            .maybeSingle();
          if (prof?.name) name = prof.name;
          setChatMessages((prev) => {
            if (prev.some((x) => String(x.id) === String(m.id))) return prev;
            return [
              ...prev,
              { id: m.id, userId: m.user_id, text: m.message, name, time: m.created_at },
            ];
          });
          if (typeof onRemoteChatInserted === 'function') {
            onRemoteChatInserted(name, m.message);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [sessionId, phase, onRemoteChatInserted]);

  const sendChatMessage = useCallback(
    async (text) => {
      const t = text?.trim();
      if (!t || !sessionId || !user?.id) return;
      if (isGuestUi && chatEnabled === false) {
        toast({
          title: 'Chat désactivé',
          description: 'Le formateur a désactivé le chat de session.',
          variant: 'destructive',
        });
        return;
      }
      const { data: row, error } = await supabase
        .from('live_session_chat')
        .insert({ live_session_id: sessionId, user_id: user.id, message: t })
        .select('id, user_id, message, created_at')
        .single();
      if (error) {
        toast({
          title: 'Forum',
          description: String(error.message || error),
          variant: 'destructive',
        });
        return;
      }
      const selfName = user?.full_name || user?.name || 'Vous';
      setChatMessages((prev) => {
        if (prev.some((x) => String(x.id) === String(row.id))) return prev;
        return [
          ...prev,
          {
            id: row.id,
            userId: row.user_id,
            text: row.message,
            name: selfName,
            time: row.created_at,
          },
        ];
      });
    },
    [sessionId, user, isGuestUi, chatEnabled, toast],
  );

  return { chatMessages, sendChatMessage };
}
