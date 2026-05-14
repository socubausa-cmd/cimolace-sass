/**
 * `live_session_chat` + Realtime (INSERT) — même principe que `LiveChatPanel` / `LiveHostPage`.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * @param {string | null} liveSessionId
 * @param {{ userId?: string, enabled?: boolean, limit?: number }} options
 */
export function useLiveSessionChat(liveSessionId, { userId, enabled = true, limit = 500 } = {}) {
  const [messages, setMessages] = useState([]);
  const [authorNames, setAuthorNames] = useState({});
  const [loading, setLoading] = useState(!!(enabled && liveSessionId));
  const [loadError, setLoadError] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!enabled || !liveSessionId) {
      setMessages([]);
      setAuthorNames({});
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setMessages([]);

    (async () => {
      const { data, error: e } = await supabase
        .from('live_session_chat')
        .select('id, user_id, message, created_at')
        .eq('live_session_id', liveSessionId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (cancelled) return;
      if (e) {
        setLoadError(e);
        setLoading(false);
        return;
      }

      const rows = data || [];
      setMessages(rows);
      const ids = [...new Set(rows.map((m) => m.user_id).filter(Boolean))];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
        if (cancelled) return;
        setAuthorNames(
          Object.fromEntries((profs || []).map((p) => [p.id, p.name?.trim() ? p.name : 'Participant'])),
        );
      } else {
        setAuthorNames({});
      }
      setLoading(false);
    })();

    const ch = supabase
      .channel(`eleve-live-chat:${liveSessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_session_chat', filter: `live_session_id=eq.${liveSessionId}` },
        async (payload) => {
          const m = payload.new;
          if (!m?.id) return;
          setMessages((prev) => (prev.some((x) => String(x.id) === String(m.id)) ? prev : [...prev, m]));
          if (m.user_id) {
            const { data: p } = await supabase.from('profiles').select('id, name').eq('id', m.user_id).maybeSingle();
            if (p?.id) {
              setAuthorNames((a) => ({ ...a, [p.id]: p.name?.trim() ? p.name : 'Participant' }));
            }
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [enabled, liveSessionId, limit]);

  const send = useCallback(
    async (text) => {
      const t = String(text || '').trim();
      if (!t || !userId || !liveSessionId) return { ok: false, error: new Error('missing') };
      setSending(true);
      try {
        const { data: row, error } = await supabase
          .from('live_session_chat')
          .insert({ live_session_id: liveSessionId, user_id: userId, message: t })
          .select('id, user_id, message, created_at')
          .single();
        if (error) return { ok: false, error };
        if (row) {
          setMessages((prev) => (prev.some((x) => String(x.id) === String(row.id)) ? prev : [...prev, row]));
        }
        return { ok: true, data: row };
      } catch (e) {
        return { ok: false, error: e };
      } finally {
        setSending(false);
      }
    },
    [userId, liveSessionId],
  );

  return { messages, authorNames, loading, loadError, send, sending };
}
