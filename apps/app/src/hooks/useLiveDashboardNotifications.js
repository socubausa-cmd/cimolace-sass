import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/** Aligné sur NotificationDropdown : masquer les lignes obsolètes quand la séance est finie / trop ancienne. */
function isStaleDashboardLiveNotification(row) {
  const ls = row?.live_sessions;
  if (!ls || typeof ls !== 'object') return false;
  const st = String(ls.status || '').toLowerCase();
  if (st === 'ended' || st === 'cancelled') return true;
  if (ls.ended_at) return true;
  if (st === 'scheduled' && ls.scheduled_at) {
    const t = new Date(ls.scheduled_at).getTime();
    if (!Number.isNaN(t) && Date.now() > t + 2 * 60 * 60 * 1000) return true;
  }
  if (st === 'live' && ls.started_at) {
    const t = new Date(ls.started_at).getTime();
    if (!Number.isNaN(t) && Date.now() > t + 36 * 60 * 60 * 1000) return true;
  }
  return false;
}

/**
 * Notifications live « dashboard » pour l'utilisateur (invitations, live démarré, etc.)
 * — même source que la cloche du header, avec abonnement temps réel.
 */
export function useLiveDashboardNotifications(userId) {
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    try {
      const selWithSession =
        'id, title, body, action_url, channel, type, sent_at, read_at, created_at, live_session_id, live_sessions ( status, ended_at, scheduled_at, started_at )';
      let { data, error } = await supabase
        .from('live_notifications')
        .select(selWithSession)
        .eq('user_id', userId)
        .eq('channel', 'dashboard')
        .order('sent_at', { ascending: false })
        .limit(24);
      if (error) {
        const r2 = await supabase
          .from('live_notifications')
          .select('id, title, body, action_url, channel, type, sent_at, read_at, created_at, live_session_id')
          .eq('user_id', userId)
          .eq('channel', 'dashboard')
          .order('sent_at', { ascending: false })
          .limit(16);
        setItems(r2.error ? [] : (r2.data || []));
        return;
      }
      const raw = data || [];
      setItems(raw.filter((n) => !isStaleDashboardLiveNotification(n)).slice(0, 16));
    } catch {
      setItems([]);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return undefined;
    const ch = supabase
      .channel(`messaging-live-notif-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  const markRead = useCallback(async (id) => {
    if (!id) return;
    await supabase.from('live_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  return { items, unreadCount, markRead, refresh: load };
}
