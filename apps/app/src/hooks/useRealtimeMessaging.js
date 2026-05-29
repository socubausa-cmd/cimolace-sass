import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { ensureFreshSession, isRetryableMessagingFetchError, sleep } from '@/lib/supabaseResilience';

export function useRealtimeMessaging(userId, profilesMap = {}) {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);

  const profilesRef = useRef(profilesMap);
  const channelRef = useRef(null);
  const notifiedIdsRef = useRef(new Set());
  const audioUnlockedRef = useRef(false);
  const audioCtxRef = useRef(null);
  const lastFetchErrorLogAtRef = useRef(0);
  const consecutiveFetchFailuresRef = useRef(0);
  const pollBackoffUntilRef = useRef(0);

  useEffect(() => { profilesRef.current = profilesMap; }, [profilesMap]);

  /** Audio + optionnellement permission notifications — uniquement après un geste (Safari / Chrome). */
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const unlock = () => {
      if (!audioCtxRef.current) {
        try {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
          return;
        }
      }
      audioUnlockedRef.current = true;
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const playIncomingSound = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!audioUnlockedRef.current) return;
    const audioContext = audioCtxRef.current;
    if (!audioContext) return;
    try {
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, audioContext.currentTime);
      gain.gain.setValueAtTime(0.07, audioContext.currentTime);
      osc.start();
      osc.stop(audioContext.currentTime + 0.12);
    } catch {
      // ignore audio failures
    }
  }, []);

  const notifyIncomingMessage = useCallback((msg) => {
    if (typeof window === 'undefined') return;
    if (!msg || msg.receiver_id !== userId) return;
    if (notifiedIdsRef.current.has(msg.id)) return;
    notifiedIdsRef.current.add(msg.id);
    playIncomingSound();

    if (document.visibilityState === 'visible') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const sender = profilesRef.current[msg.sender_id];
    const senderName = sender?.name || sender?.email || 'Nouveau message';
    const preview = String(msg.content || '').slice(0, 90);
    try {
      const n = new Notification(`Message de ${senderName}`, {
        body: preview || 'Vous avez reçu un nouveau message',
      });
      n.onclick = () => window.focus();
    } catch {
      // ignore notification failures
    }
  }, [playIncomingSound, userId]);

  const deriveConversations = useCallback(
    (msgs, pMap) => {
      if (!userId) return [];
      const convMap = {};

      msgs.forEach((msg) => {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (!convMap[otherId]) {
          const profile = pMap[otherId];
          convMap[otherId] = {
            id: otherId,
            participantId: otherId,
            name: profile?.name || profile?.email || 'Inconnu',
            avatar_url: profile?.avatar_url || null,
            role: profile?.role || 'student',
            status: profile?.status || 'active',
            email: profile?.email || '',
            messages: [],
            lastMessage: null,
            unreadCount: 0,
          };
        }
        convMap[otherId].messages.push(msg);
        if (!msg.is_read && msg.receiver_id === userId) {
          convMap[otherId].unreadCount += 1;
        }
      });

      return Object.values(convMap)
        .map((conv) => {
          conv.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          conv.lastMessage = conv.messages[conv.messages.length - 1] || null;
          return conv;
        })
        .sort((a, b) => {
          const da = a.lastMessage ? new Date(a.lastMessage.created_at) : 0;
          const db = b.lastMessage ? new Date(b.lastMessage.created_at) : 0;
          return db - da;
        });
    },
    [userId]
  );

  const fetchMessages = useCallback(async () => {
    if (!userId) return null;
    const withTimeout = (promise, timeoutMs) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`messages query timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

    const runPair = async (limit, timeoutMs) =>
      Promise.all([
        withTimeout(
          supabase
            .from('messages')
            .select('id, sender_id, receiver_id, content, is_read, created_at')
            .eq('sender_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit),
          timeoutMs
        ).catch((e) => ({ data: null, error: e })),
        withTimeout(
          supabase
            .from('messages')
            .select('id, sender_id, receiver_id, content, is_read, created_at')
            .eq('receiver_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit),
          timeoutMs
        ).catch((e) => ({ data: null, error: e })),
      ]);

    // Deux requêtes indexées en parallèle (sender / receiver) + JWT frais + retries réseau.
    try {
      const limits = [100, 100, 40];
      const timeouts = [22000, 30000, 38000];
      let sentRes;
      let recvRes;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await ensureFreshSession(supabase, 90);
        [sentRes, recvRes] = await runPair(limits[attempt], timeouts[attempt]);
        if (sentRes?.data || recvRes?.data) break;
        const canRetry =
          attempt < 2 &&
          (isRetryableMessagingFetchError(sentRes?.error) ||
            isRetryableMessagingFetchError(recvRes?.error));
        if (!canRetry) break;
        await sleep(450 + attempt * 400);
      }

      const sentErr = sentRes?.error;
      const recvErr = recvRes?.error;

      // Table inexistante
      for (const err of [sentErr, recvErr]) {
        if (err?.code === '42P01' || err?.message?.includes('relation') || err?.message?.includes('schema cache')) {
          setTableExists(false);
          console.warn('[messaging] Table messages non trouvée. Créez-la dans Supabase.');
          return [];
        }
      }

      // Les deux ont échoué (timeout réseau)
      if (!sentRes?.data && !recvRes?.data) {
        const now = Date.now();
        if (now - lastFetchErrorLogAtRef.current > 15000) {
          lastFetchErrorLogAtRef.current = now;
          console.error('[messaging] fetch exception:', sentErr?.message || recvErr?.message);
        }
        return null;
      }

      const mergedMap = new Map();
      for (const row of [...(sentRes?.data || []), ...(recvRes?.data || [])]) {
        if (row?.id) mergedMap.set(row.id, row);
      }
      setTableExists(true);
      // Filtrer les anciens messages système auto-envoyés par l'invite live
      // (ex: "Invitation studio immersive de X.") — ne pas les afficher dans le chat.
      const INVITE_PATTERNS = [
        /^invitation studio immersive/i,
        /^📹.*invitation/i,
        /^\[live_invite\]/i,
        /^🎬.*invite/i,
      ];
      const isSystemInviteMsg = (msg) =>
        INVITE_PATTERNS.some((rx) => rx.test(String(msg?.content || '').trim()));

      return Array.from(mergedMap.values())
        .filter((m) => !isSystemInviteMsg(m))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } catch (err) {
      const now = Date.now();
      if (now - lastFetchErrorLogAtRef.current > 15000) {
        lastFetchErrorLogAtRef.current = now;
        console.error('[messaging] fetch exception:', err?.message || err);
      }
      return null;
    }
  }, [userId]);

  const applyMessages = useCallback((msgs, pMap) => {
    const sorted = [...msgs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    setMessages(sorted);
    setConversations(deriveConversations(sorted, pMap));
  }, [deriveConversations]);

  const refresh = useCallback(async () => {
    const msgs = await fetchMessages();
    if (msgs === null) {
      // Avoid infinite spinner when initial query fails.
      setLoading(false);
      return;
    }
    applyMessages(msgs, profilesRef.current);
    setLoading(false);
  }, [fetchMessages, applyMessages]);

  // Recalcule conversations quand profilesMap se peuple
  useEffect(() => {
    if (Object.keys(profilesMap).length > 0) {
      setConversations(deriveConversations(messages, profilesMap));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesMap]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    refresh();

    const channel = supabase
      .channel(`messages:user:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new;
        if (!msg || (msg.sender_id !== userId && msg.receiver_id !== userId)) return;
        notifyIncomingMessage(msg);
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          const next = [...prev, msg].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          setConversations(deriveConversations(next, profilesRef.current));
          return next;
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new;
        if (!updated) return;
        setMessages((prev) => {
          if (!prev.some((m) => m.id === updated.id)) return prev;
          const next = prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m));
          setConversations(deriveConversations(next, profilesRef.current));
          return next;
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const id = payload.old?.id;
        if (!id) return;
        setMessages((prev) => {
          if (!prev.some((m) => m.id === id)) return prev;
          const next = prev.filter((m) => m.id !== id);
          setConversations(deriveConversations(next, profilesRef.current));
          return next;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Re-fetch dès que le canal est actif pour rattraper les messages manqués
          refresh();
        }
      });

    channelRef.current = channel;

    // Polling safety net (lighter cadence)
    const pollInterval = setInterval(async () => {
      if (Date.now() < pollBackoffUntilRef.current) return;
      const msgs = await fetchMessages();
      if (msgs === null) {
        consecutiveFetchFailuresRef.current += 1;
        // Réseau dégradé: réduire la pression API pendant 2 minutes.
        if (consecutiveFetchFailuresRef.current >= 3) {
          consecutiveFetchFailuresRef.current = 0;
          pollBackoffUntilRef.current = Date.now() + 120000;
        }
        return;
      }
      consecutiveFetchFailuresRef.current = 0;
      setMessages((prev) => {
        const next = [...msgs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        // Comparer les IDs et contenus pour détecter INSERT, UPDATE, DELETE
        const prevIds = new Set(prev.map((m) => m.id));
        const nextIds = new Set(next.map((m) => m.id));
        const hasDiff =
          prev.length !== next.length ||
          next.some((m) => !prevIds.has(m.id)) ||
          prev.some((m) => !nextIds.has(m.id)) ||
          next.some((m) => {
            const old = prev.find((p) => p.id === m.id);
            return old && (old.content !== m.content || old.is_read !== m.is_read);
          });
        if (!hasDiff) return prev;
        setConversations(deriveConversations(next, profilesRef.current));
        return next;
      });
    }, 60000);

    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const sendMessage = useCallback(async (receiverId, content) => {
    if (!userId || !receiverId || !content?.trim()) return null;
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: userId, receiver_id: receiverId, content: content.trim() })
      .select()
      .single();
    if (error) {
      console.error('[messaging] send error:', error.message);
      return null;
    }
    setMessages((prev) => {
      if (prev.some((m) => m.id === data.id)) return prev;
      const next = [...prev, data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setConversations(deriveConversations(next, profilesRef.current));
      return next;
    });
    return data;
  }, [userId, deriveConversations]);

  const markAsRead = useCallback(async (messageIds) => {
    if (!messageIds?.length) return;
    await supabase.from('messages').update({ is_read: true }).in('id', messageIds).eq('receiver_id', userId);
    setMessages((prev) => {
      const next = prev.map((m) => (messageIds.includes(m.id) ? { ...m, is_read: true } : m));
      setConversations(deriveConversations(next, profilesRef.current));
      return next;
    });
  }, [userId, deriveConversations]);

  const deleteMessage = useCallback(async (messageId) => {
    if (!userId || !messageId) return false;
    const { error } = await supabase.from('messages').delete().eq('id', messageId).eq('sender_id', userId);
    if (error) { console.error('[messaging] delete error:', error.message); return false; }
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== messageId);
      setConversations(deriveConversations(next, profilesRef.current));
      return next;
    });
    return true;
  }, [userId, deriveConversations]);

  const editMessage = useCallback(async (messageId, newContent) => {
    if (!userId || !messageId || !newContent?.trim()) return null;
    const { data, error } = await supabase
      .from('messages').update({ content: newContent.trim() })
      .eq('id', messageId).eq('sender_id', userId).select().maybeSingle();
    if (error) { console.error('[messaging] edit error:', error.message); return null; }
    if (data) {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === data.id ? { ...m, ...data } : m));
        setConversations(deriveConversations(next, profilesRef.current));
        return next;
      });
    }
    return data;
  }, [userId, deriveConversations]);

  const getConversationMessages = useCallback((participantId) => {
    if (!userId || !participantId) return [];
    return messages.filter(
      (m) =>
        (m.sender_id === userId && m.receiver_id === participantId) ||
        (m.sender_id === participantId && m.receiver_id === userId)
    );
  }, [messages, userId]);

  // Fetch ciblé pour une conversation spécifique (garantit les données fraîches)
  const fetchAndMergeConversation = useCallback(async (participantId) => {
    if (!userId || !participantId) return;
    try {
      await ensureFreshSession(supabase, 90);
      const q = () =>
        supabase
          .from('messages')
          .select('id, sender_id, receiver_id, content, is_read, created_at')
          .or(
            `and(sender_id.eq.${userId},receiver_id.eq.${participantId}),and(sender_id.eq.${participantId},receiver_id.eq.${userId})`
          )
          .order('created_at', { ascending: false })
          .limit(240);

      let { data, error } = await q();
      if (error && isRetryableMessagingFetchError(error)) {
        await supabase.auth.refreshSession();
        await sleep(400);
        ({ data, error } = await q());
      }
      if (error || !data) return;

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = data.filter((m) => !existingIds.has(m.id));
        const updated = prev.map((m) => {
          const fresh = data.find((d) => d.id === m.id);
          return fresh ? { ...m, ...fresh } : m;
        });
        const merged = [...updated, ...newOnes].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        if (merged.length === prev.length && newOnes.length === 0) return prev;
        setConversations(deriveConversations(merged, profilesRef.current));
        return merged;
      });
    } catch (err) {
      console.error('[messaging] fetchAndMergeConversation error:', err);
    }
  }, [userId, deriveConversations]);

  return {
    messages,
    conversations,
    loading,
    tableExists,
    sendMessage,
    markAsRead,
    deleteMessage,
    editMessage,
    getConversationMessages,
    fetchAndMergeConversation,
    refresh,
  };
}
