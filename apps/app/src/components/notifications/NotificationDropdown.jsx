import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

/** Séance terminée / créneau dépassé : ne plus afficher dans le menu (les lignes restent en base). */
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

const NotificationDropdown = ({ externalUnreadCount = 0, externalItems = [] }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications,     setNotifications]     = useState([]);
  const [liveNotifications, setLiveNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) { setNotifications([]); return; }
    const { data } = await supabase
      .from('notifications')
      .select('id,user_id,title,message,type,is_read,created_at,action_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    // Défensif : l'API peut renvoyer une enveloppe { data: [...] } ou null —
    // on garantit toujours un tableau pour éviter notifications.filter/.map/.slice crash.
    setNotifications(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
  }, [user?.id]);

  const fetchLiveNotifications = useCallback(async () => {
    if (!user?.id) { setLiveNotifications([]); return; }
    try {
      const selWithSession =
        'id, title, body, action_url, channel, type, sent_at, read_at, live_session_id, live_sessions ( status, ended_at, scheduled_at, started_at )';
      let { data, error } = await supabase
        .from('live_notifications')
        .select(selWithSession)
        .eq('user_id', user.id)
        .eq('channel', 'dashboard')
        .order('sent_at', { ascending: false })
        .limit(20);
      if (error) {
        const r2 = await supabase
          .from('live_notifications')
          .select('id, title, body, action_url, channel, type, sent_at, read_at, live_session_id')
          .eq('user_id', user.id)
          .eq('channel', 'dashboard')
          .order('sent_at', { ascending: false })
          .limit(10);
        setLiveNotifications(r2.error || !Array.isArray(r2.data) ? [] : r2.data);
        return;
      }
      const raw = Array.isArray(data) ? data : [];
      setLiveNotifications(raw.filter((n) => !isStaleDashboardLiveNotification(n)).slice(0, 10));
    } catch {
      setLiveNotifications([]);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchNotifications();
    void fetchLiveNotifications();
    if (!user?.id) return undefined;

    const ch1 = supabase
      .channel(`notif-dropdown-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}` }, fetchNotifications)
      .subscribe();

    const ch2 = supabase
      .channel(`live-notif-dropdown-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_notifications',
        filter: `user_id=eq.${user.id}` }, fetchLiveNotifications)
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [fetchNotifications, fetchLiveNotifications, user?.id]);

  const markAsRead = useCallback(async (id) => {
    if (!id || !user?.id) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }, [user?.id]);

  const markLiveNotifRead = useCallback(async (id) => {
    if (!id) return;
    await supabase.from('live_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setLiveNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from('live_notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id).is('read_at', null);
    setLiveNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
  }, [user?.id]);

  const liveUnread = liveNotifications.filter((n) => !n.read_at).length;
  const unreadCount = notifications.filter((n) => !n.is_read).length + externalUnreadCount + liveUnread;
  const hasLiveSignal = liveUnread > 0;

  const merged = useMemo(() => {
    const internalItems = notifications.slice(0, 5).map((n) => ({
      id: n.id, title: n.title, body: n.message, isRead: Boolean(n.is_read),
      created_at: n.created_at, action_url: n.action_url, isLive: false, isExternal: false,
    }));
    const liveItems = liveNotifications.slice(0, 5).map((n) => ({
      id: n.id, title: n.title || 'Session live', body: n.body, isRead: Boolean(n.read_at),
      created_at: n.sent_at, action_url: n.action_url || `/live/waiting/${n.live_session_id}`,
      isLive: true, isExternal: false, liveId: n.id, liveType: n.type,
    }));
    return [...externalItems.map((n) => ({ ...n, isExternal: true })), ...liveItems, ...internalItems]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 8);
  }, [externalItems, notifications, liveNotifications]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-[#7B61FF] hover:bg-white/5 rounded-full">
          <Bell
            className={cn(
              'w-5 h-5',
              hasLiveSignal && 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.45)]',
            )}
          />
          {unreadCount > 0 && (
            <Badge
              className={cn(
                'absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-white text-[10px] animate-pulse',
                hasLiveSignal ? 'bg-emerald-500' : 'bg-red-500',
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-[#192734] border-white/10 text-white" align="end">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="xs" onClick={markAllAsRead} className="text-xs text-[#7B61FF] hover:text-white h-auto p-0">
              Tout marquer comme lu
            </Button>
          )}
        </div>
        <div className="max-h-[340px] overflow-y-auto">
          {merged.length > 0 ? (
            merged.map((notif) => (
              <div
                key={notif.id}
                className={`p-3.5 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!notif.isRead ? 'bg-[#7B61FF]/5' : ''}`}
                onClick={() => {
                  if (!notif.isExternal && !notif.isLive) markAsRead(notif.id);
                  if (notif.isLive) markLiveNotifRead(notif.liveId);
                  const target = notif.action_url;
                  if (target) {
                    if (String(target).startsWith('http')) {
                      window.open(target, '_blank', 'noopener,noreferrer');
                    } else {
                      navigate(String(target));
                    }
                  }
                }}
              >
                <div className="flex items-start gap-2.5">
                  {notif.isLive && (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!notif.isRead ? 'font-semibold text-white' : 'text-gray-300'}`}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{notif.body}</p>
                    )}
                    {notif.isLive && notif.liveType === 'live_now' ? (
                      <p className="text-[10px] font-semibold text-emerald-400/90 mt-1">Rejoindre maintenant</p>
                    ) : null}
                    <p className="text-[10px] text-gray-600 mt-1">
                      {formatDistanceToNow(new Date(notif.created_at || Date.now()), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  {!notif.isRead && <div className="w-2 h-2 rounded-full bg-[#7B61FF] mt-1.5 flex-shrink-0" />}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500 text-sm">Aucune notification</div>
          )}
        </div>
        <div className="p-2 border-t border-white/10 text-center">
          <Link to="/notifications">
            <Button variant="ghost" size="sm" className="w-full text-sm text-gray-400 hover:text-white">
              Voir toutes les notifications
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationDropdown;