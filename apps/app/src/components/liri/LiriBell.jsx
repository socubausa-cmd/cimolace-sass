import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Cloche de notifications du portail LIRI — habillage CHAUD (coral/#33322e) conforme
 * à la directive artistique LIRI (bannir navy/violet du NotificationDropdown legacy,
 * qui reste utilisé par les shells secrétariat/admin). Même source de données :
 * table `notifications` filtrée par user_id (RLS), realtime best-effort, marque-lu.
 * Remplace le bouton cloche MORT de LiriPortalShell (aucun onClick, point statique).
 */
export default function LiriBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    if (!user?.id) { setItems([]); return; }
    const { data } = await supabase
      .from('notifications')
      .select('id,title,body,type,is_read,created_at,action_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setItems(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
  }, [user?.id]);

  useEffect(() => {
    void refresh();
    if (!user?.id) return undefined;
    // Realtime best-effort — ne doit JAMAIS faire planter le portail (canal unique/exécution).
    let ch;
    const sub = `${user.id}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      ch = supabase
        .channel(`liri-bell-${sub}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, refresh)
        .subscribe();
    } catch { /* realtime indisponible = non bloquant */ }
    return () => { try { if (ch) supabase.removeChannel(ch); } catch { /* ignore */ } };
  }, [refresh, user?.id]);

  const unread = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const markRead = useCallback(async (id) => {
    if (!id || !user?.id) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }, [user?.id]);

  const markAll = useCallback(async () => {
    if (!user?.id) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [user?.id]);

  const shown = items.slice(0, 12);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative hidden h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr sm:grid"
          aria-label={unread > 0 ? `Notifications (${unread} non lues)` : 'Notifications'}
        >
          <Bell size={17} />
          {unread > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-bold text-[#1c1a18]"
              style={{ background: 'var(--coral, #d97757)' }}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[340px] overflow-hidden p-0"
        style={{ background: '#33322e', border: '1px solid rgba(245,244,238,0.10)', color: '#f5f4ee' }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(245,244,238,0.08)' }}>
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button type="button" onClick={markAll} className="text-[11px] font-medium" style={{ color: 'var(--coral, #d97757)' }}>
              Tout marquer lu
            </button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {shown.length ? (
            shown.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  markRead(n.id);
                  const t = n.action_url;
                  if (t) {
                    if (String(t).startsWith('http')) window.open(t, '_blank', 'noopener,noreferrer');
                    else navigate(String(t));
                  }
                }}
                className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                style={{ background: n.is_read ? 'transparent' : 'color-mix(in srgb, var(--coral, #d97757) 9%, transparent)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] leading-snug ${n.is_read ? 'text-[#f5f4ee]/70' : 'font-semibold text-[#f5f4ee]'}`}>{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-[11px] text-[#f5f4ee]/50">{n.body}</p>}
                  <p className="mt-1 text-[10px] text-[#f5f4ee]/35">
                    {formatDistanceToNow(new Date(n.created_at || Date.now()), { addSuffix: true, locale: fr })}
                  </p>
                </div>
                {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--coral, #d97757)' }} />}
              </button>
            ))
          ) : (
            <div className="px-6 py-10 text-center text-[13px] text-[#f5f4ee]/40">Aucune notification pour l’instant.</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
