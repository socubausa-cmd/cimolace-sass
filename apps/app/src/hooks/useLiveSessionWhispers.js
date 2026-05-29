import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const MAX_THREAD = 120;

function mergeIncomingMessage(userId, row) {
  const peer =
    String(row.sender_id) === String(userId) ? String(row.recipient_id) : String(row.sender_id);
  const msg = {
    id: row.id,
    fromId: String(row.sender_id),
    toId: String(row.recipient_id),
    text: row.body,
    at: new Date(row.created_at).getTime(),
  };
  return { peer, msg };
}

/**
 * Aparté texte formateur ↔ membre — persistance `live_session_private_messages` + Realtime.
 * (Anciennement broadcast éphémère : l'historique survit au rechargement.)
 *
 * @param {import('react').MutableRefObject<((p: { fromId: string, text: string, at: number }) => void) | null> | null} [incomingRef]
 */
export function useLiveSessionWhispers(sessionKey, userId, incomingRef = null) {
  const [threads, setThreads] = useState({});
  const seenIdsRef = useRef(new Set());

  useEffect(() => {
    seenIdsRef.current = new Set();
    setThreads({});
    if (!sessionKey || !userId) return undefined;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('live_session_private_messages')
        .select('id, sender_id, recipient_id, body, created_at')
        .eq('live_session_id', sessionKey)
        .order('created_at', { ascending: true })
        .limit(800);
      if (cancelled || error) return;
      const byPeer = {};
      for (const row of data || []) {
        if (String(row.sender_id) !== String(userId) && String(row.recipient_id) !== String(userId)) {
          continue;
        }
        const { peer, msg } = mergeIncomingMessage(userId, row);
        if (!byPeer[peer]) byPeer[peer] = [];
        byPeer[peer].push(msg);
        seenIdsRef.current.add(String(row.id));
      }
      if (!cancelled) setThreads(byPeer);
    })();

    const ch = supabase
      .channel(`lspm-${sessionKey}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_session_private_messages',
          filter: `live_session_id=eq.${sessionKey}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row?.id) return;
          if (String(row.sender_id) !== String(userId) && String(row.recipient_id) !== String(userId)) {
            return;
          }
          const idStr = String(row.id);
          if (seenIdsRef.current.has(idStr)) return;
          seenIdsRef.current.add(idStr);

          const { peer, msg } = mergeIncomingMessage(userId, row);
          const incoming =
            String(row.recipient_id) === String(userId) && String(row.sender_id) !== String(userId);
          if (incoming && incomingRef?.current) {
            const cb = incomingRef.current;
            queueMicrotask(() => {
              try {
                cb({ fromId: String(row.sender_id), text: String(row.body || ''), at: msg.at });
              } catch {
                /* ignore */
              }
            });
          }
          setThreads((prev) => {
            const cur = prev[peer] || [];
            if (cur.some((m) => m.id === msg.id)) return prev;
            const next = [...cur, msg].slice(-MAX_THREAD);
            return { ...prev, [peer]: next };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [sessionKey, userId]);

  const sendWhisper = useCallback(
    async (toId, text) => {
      const t = String(text || '').trim();
      if (!t || !userId || !sessionKey || !toId || String(toId) === String(userId)) {
        return { ok: false, error: null };
      }
      const { data: row, error } = await supabase
        .from('live_session_private_messages')
        .insert({
          live_session_id: sessionKey,
          sender_id: userId,
          recipient_id: toId,
          body: t,
        })
        .select('id, sender_id, recipient_id, body, created_at')
        .single();
      if (error || !row) {
        return { ok: false, error: error || new Error('insert_failed') };
      }
      const idStr = String(row.id);
      if (seenIdsRef.current.has(idStr)) return { ok: true };
      seenIdsRef.current.add(idStr);
      const { peer, msg } = mergeIncomingMessage(userId, row);
      setThreads((prev) => {
        const cur = prev[peer] || [];
        if (cur.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [peer]: [...cur, msg].slice(-MAX_THREAD) };
      });
      return { ok: true };
    },
    [userId, sessionKey],
  );

  return { threads, sendWhisper };
}
