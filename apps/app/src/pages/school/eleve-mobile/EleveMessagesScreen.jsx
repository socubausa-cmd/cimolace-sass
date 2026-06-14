import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, PenLine, CheckCheck, User, RefreshCw, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useMessaging } from '@/contexts/MessagingContext';
import { EleveMobileShell, EleveEmptyState } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { EV_BG, EV_MUTED, EV_ACCENT, EV_LINE, EV_R, EV_SH, EV_PAGE_AMBIENT } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

const CHAT_HALO = [
  'rgba(99, 102, 241, 0.14)',
  'rgba(59, 130, 246, 0.12)',
  'rgba(124, 58, 237, 0.12)',
  'rgba(16, 185, 129, 0.1)',
];

function chatRowSurface(index) {
  const h = CHAT_HALO[index % CHAT_HALO.length];
  return {
    background: [
      `radial-gradient(ellipse 100% 75% at 20% 0%, ${h} 0%, transparent 58%)`,
      'linear-gradient(195deg, rgba(24, 26, 40, 0.97) 0%, rgba(10, 12, 24, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 12px -4px rgba(0,0,0,0.4)',
  };
}

const TABS = [
  { id: 'tous', label: 'Tous' },
  { id: 'groupes', label: 'Groupes' },
  { id: 'profs', label: 'Professeurs' },
];

function isStaffRole(role) {
  const r = String(role || '').toLowerCase();
  return ['teacher', 'instructor', 'admin', 'owner', 'secretariat', 'creator'].includes(r);
}

function filterConversationsByTab(list, tab) {
  if (!list?.length) return [];
  if (tab === 'tous') return list;
  if (tab === 'profs') return list.filter((c) => isStaffRole(c.role));
  if (tab === 'groupes') return list.filter((c) => !isStaffRole(c.role));
  return list;
}

function formatThreadTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (isToday(d)) return format(d, 'HH:mm', { locale: fr });
  if (isYesterday(d)) return 'Hier';
  return format(d, 'd MMM', { locale: fr });
}

function MessagesFilterTabs({ value, onChange }) {
  return (
    <div
      className="mb-4 flex gap-1.5 rounded-[14px] border p-1"
      style={{
        borderColor: 'rgba(165, 180, 252, 0.18)',
        background: 'linear-gradient(180deg, rgba(22, 24, 40, 0.85) 0%, rgba(10, 10, 20, 0.92) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 14px -6px rgba(0,0,0,0.45)',
      }}
    >
      {TABS.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'min-w-0 flex-1 rounded-[10px] py-2.5 text-center text-[12.5px] font-semibold transition',
              on ? 'text-white' : 'text-white/50',
            )}
            style={
              on
                ? {
                    background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #5E4BFF 50%, #4F46E5 100%)`,
                    boxShadow: [
                      '0 0 0 1px rgba(255,255,255,0.12)',
                      '0 4px 18px -4px rgba(99, 102, 241, 0.45)',
                      EV_SH.tab,
                    ].join(', '),
                  }
                : { background: 'rgba(0,0,0,0.2)' }
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function EleveMessagesScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const {
    conversations,
    loading,
    messagesTableExists,
    refresh,
    currentUser,
  } = useMessaging();

  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const [tab, setTab] = useState('tous');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const byTab = filterConversationsByTab(conversations, tab);
    const q = search.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((c) => {
      const n = String(c.name || '').toLowerCase();
      const e = String(c.email || '').toLowerCase();
      return n.includes(q) || e.includes(q);
    });
  }, [conversations, tab, search]);

  return (
    <EleveMobileShell user={user} notificationCount={inboxUnread} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: EV_PAGE_AMBIENT,
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <LiriWordmark size="kicker" className="text-white/40" />
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">Messages</h1>
              <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
                Tes échanges, groupes et professeurs
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => refresh()}
                className="flex h-10 w-10 items-center justify-center rounded-full border text-white/90 active:scale-95"
                style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
                aria-label="Actualiser"
                disabled={loading}
              >
                <RefreshCw className={cn('h-[18px] w-[18px]', loading && 'animate-spin')} strokeWidth={2.1} />
              </button>
              <Link
                to={ELEVE_MOBILE.messagesNew}
                className="flex h-10 w-10 items-center justify-center rounded-full border text-white/90 active:scale-95"
                style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
                aria-label="Nouveau message"
              >
                <PenLine className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </Link>
            </div>
          </div>

          <div
            className="mb-3 flex items-center gap-2 rounded-2xl border px-3 py-2"
            style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.04)' }}
          >
            <Search className="h-4 w-4 shrink-0 text-white/45" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une conversation…"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/35"
            />
          </div>

          <MessagesFilterTabs value={tab} onChange={setTab} />

          {messagesTableExists === false ? (
            <p className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12.5px] text-amber-100/90">
              La table <code className="rounded bg-black/20 px-1">messages</code> n'existe pas sur ce projet Supabase. Crée la table ou lance les migrations
              pour activer la messagerie 1:1.
            </p>
          ) : null}

          {loading && !conversations.length ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[76px] animate-pulse rounded-2xl bg-white/[0.06]"
                  style={{ borderRadius: EV_R.md }}
                />
              ))}
            </div>
          ) : null}

          <div className="space-y-2.5">
            {!loading && filtered.length === 0 && messagesTableExists !== false ? (
              conversations.length === 0 ? (
                <EleveEmptyState
                  icon={MessageCircle}
                  title="Aucune conversation"
                  description="Envoie un message à un membre LIRI pour lancer un échange, ou explore le forum communautaire."
                  className="py-1"
                  primary={{ to: ELEVE_MOBILE.messagesNew, label: 'Nouveau message' }}
                  secondary={{ to: ELEVE_MOBILE.communaute, label: 'Communauté' }}
                />
              ) : (
                <EleveEmptyState
                  icon={Search}
                  title="Aucun résultat"
                  description="Essaie un autre onglet ou modifie ta recherche."
                  className="py-1"
                  primary={{
                    onClick: () => {
                      setSearch('');
                      setTab('tous');
                    },
                    label: 'Réinitialiser filtres et recherche',
                  }}
                />
              )
            ) : null}

            {filtered.map((c, i) => {
              const last = c.lastMessage;
              const t = last ? formatThreadTime(last.created_at) : '';
              const showReadReceipt =
                last &&
                currentUser?.id &&
                last.sender_id === currentUser.id &&
                last.is_read &&
                (c.unreadCount || 0) === 0;
              return (
                <Link
                  key={c.participantId}
                  to={ELEVE_MOBILE.messageThread(c.participantId)}
                  className="block overflow-hidden p-3.5 transition active:scale-[0.99]"
                  style={{ borderRadius: EV_R.md, ...chatRowSurface(i) }}
                >
                  <div className="flex items-start gap-3">
                    {c.avatar_url ? (
                      <img
                        src={c.avatar_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-700 ring-1 ring-white/12">
                        <User className="h-5 w-5 text-white/90" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-[14.5px] font-semibold leading-tight text-white">{c.name}</p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {t ? (
                            <span className="text-[10.5px] tabular-nums" style={{ color: EV_MUTED }}>
                              {t}
                            </span>
                          ) : null}
                          {c.unreadCount > 0 ? (
                            <span
                              className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white"
                              style={{ background: EV_ACCENT, boxShadow: `0 0 0 2px ${EV_BG}` }}
                            >
                              {c.unreadCount > 9 ? '9+' : c.unreadCount}
                            </span>
                          ) : showReadReceipt ? (
                            <CheckCheck className="h-4 w-4 shrink-0 text-violet-300/90" strokeWidth={2.2} />
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug" style={{ color: EV_MUTED }}>
                        {last?.content || 'Aucun message.'}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </EleveMobileShell>
  );
}
