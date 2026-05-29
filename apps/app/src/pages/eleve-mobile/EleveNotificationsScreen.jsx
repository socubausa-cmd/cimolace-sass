import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Megaphone, Radio, BookOpen, Calendar, Info, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { supabase } from '@/lib/customSupabaseClient';
import { EleveMobileShell, EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_BG, EV_MUTED, EV_ACCENT, EV_LINE, EV_R } from '@/pages/eleve-mobile/eleveMobileScreensShared';

const PAGE_AMBIENT =
  'radial-gradient(50% 28% at 50% 0%, rgba(123, 97, 255, 0.13), transparent 70%)';

function notifCardSurface(isRead) {
  return {
    background: isRead
      ? 'linear-gradient(192deg, rgba(18, 20, 32, 0.95) 0%, rgba(10, 10, 18, 0.98) 100%)'
      : [
          'radial-gradient(ellipse 90% 70% at 8% 0%, rgba(99, 102, 241, 0.13) 0%, transparent 55%)',
          'linear-gradient(190deg, rgba(22, 24, 38, 0.97) 0%, rgba(12, 14, 24, 0.99) 100%)',
        ].join(', '),
    border: isRead
      ? '1px solid rgba(165, 180, 252, 0.10)'
      : '1px solid rgba(165, 180, 252, 0.20)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 10px -4px rgba(0,0,0,0.35)',
  };
}

function notifIcon(type) {
  if (type === 'live' || type === 'session') return Radio;
  if (type === 'course' || type === 'formation') return BookOpen;
  if (type === 'announcement') return Megaphone;
  if (type === 'event' || type === 'calendar') return Calendar;
  return Info;
}

function notifIconColor(type) {
  if (type === 'live' || type === 'session') return '#F87171';
  if (type === 'course' || type === 'formation') return '#A78BFA';
  if (type === 'announcement') return '#60A5FA';
  if (type === 'event' || type === 'calendar') return '#34D399';
  return '#94A3B8';
}

function fmtTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Hier';
  if (d < 7) return `Il y a ${d}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function NotifCard({ notif, onMarkRead }) {
  const Icon = notifIcon(notif.type);
  const color = notifIconColor(notif.type);
  const isRead = notif.is_read;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-2 flex gap-3 p-3.5"
      style={{ borderRadius: EV_R.md, ...notifCardSurface(isRead) }}
    >
      {/* Unread dot */}
      {!isRead && (
        <span
          className="absolute left-2 top-4 h-1.5 w-1.5 rounded-full"
          style={{ background: EV_ACCENT }}
        />
      )}

      {/* Icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10"
        style={{ background: `${color}18` }}
      >
        <Icon className="h-5 w-5" style={{ color }} strokeWidth={2.1} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[13px] font-semibold leading-snug ${isRead ? 'text-white/70' : 'text-white/95'}`}>
            {notif.title || 'Notification'}
          </p>
          <span className="shrink-0 text-[10px]" style={{ color: EV_MUTED }}>
            {fmtTime(notif.created_at)}
          </span>
        </div>
        {notif.body ? (
          <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed" style={{ color: EV_MUTED }}>
            {notif.body}
          </p>
        ) : null}
        {!isRead && (
          <button
            type="button"
            onClick={() => onMarkRead(notif.id)}
            className="mt-2 text-[10px] font-medium"
            style={{ color: EV_ACCENT, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            Marquer lu
          </button>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10"
        style={{ background: 'rgba(123,97,255,0.1)' }}
      >
        <Bell className="h-7 w-7 text-violet-400/70" strokeWidth={1.8} />
      </div>
      <p className="text-[15px] font-bold text-white/70">Tout est à jour</p>
      <p className="mt-1.5 max-w-[18rem] text-[12.5px] leading-relaxed" style={{ color: EV_MUTED }}>
        Tes notifications apparaîtront ici — lives, annonces, cours et rappels.
      </p>
    </div>
  );
}

export default function EleveNotificationsScreen() {
  const { user } = useAuth();
  const { notifications: syncNotifs } = useDataSync();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const unread = (Array.isArray(syncNotifs) ? syncNotifs : []).filter((n) => !n.isRead).length;

  useEffect(() => {
    if (!user?.id) {
      setNotifs([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('id, type, title, body, action_url, is_read, created_at, priority')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (alive) setNotifs(data || []);
      } catch {
        if (alive) setNotifs([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const handleMarkRead = async (id) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const handleMarkAllRead = async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    if (user?.id) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    }
  };

  const unreadCount = notifs.filter((n) => !n.is_read).length;
  const todayNotifs = notifs.filter((n) => {
    const diff = Date.now() - new Date(n.created_at).getTime();
    return diff < 86_400_000;
  });
  const olderNotifs = notifs.filter((n) => {
    const diff = Date.now() - new Date(n.created_at).getTime();
    return diff >= 86_400_000;
  });

  return (
    <EleveMobileShell user={user} notificationCount={unread} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{ minHeight: '100dvh', backgroundColor: EV_BG, backgroundImage: PAGE_AMBIENT }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-4">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <LiriWordmark size="kicker" className="text-white/40" />
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">
                Notifications
              </h1>
              <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
                {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout à jour'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-semibold text-white/80 transition active:scale-95"
                style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
              >
                <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
                Tout lire
              </button>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400/60" />
            </div>
          ) : notifs.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {todayNotifs.length > 0 && (
                <>
                  <EleveSectionTitle className="mb-2.5">Aujourd'hui</EleveSectionTitle>
                  {todayNotifs.map((n) => (
                    <NotifCard key={n.id} notif={n} onMarkRead={handleMarkRead} />
                  ))}
                </>
              )}
              {olderNotifs.length > 0 && (
                <>
                  <EleveSectionTitle className="mb-2.5 mt-4">Précédentes</EleveSectionTitle>
                  {olderNotifs.map((n) => (
                    <NotifCard key={n.id} notif={n} onMarkRead={handleMarkRead} />
                  ))}
                </>
              )}
            </>
          )}

          {/* CTA vers accueil si pas connecté */}
          {!user && (
            <div className="mt-6 text-center">
              <p className="mb-3 text-[13px]" style={{ color: EV_MUTED }}>
                Connecte-toi pour voir tes notifications.
              </p>
              <Link
                to={ELEVE_MOBILE.login}
                className="inline-flex h-11 items-center rounded-2xl px-6 text-[14px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${EV_ACCENT} 0%, #5B21B6 100%)` }}
              >
                Se connecter
              </Link>
            </div>
          )}
        </div>
      </div>
    </EleveMobileShell>
  );
}
