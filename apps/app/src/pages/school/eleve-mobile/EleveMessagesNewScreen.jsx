import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Search, User } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useMessaging } from '@/contexts/MessagingContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_BG, EV_MUTED, EV_LINE, EV_R } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(217, 119, 87, 0.14), transparent 70%)';

function rowStyle(i) {
  const h = ['rgba(217, 119, 87, 0.12)', 'rgba(226, 133, 79, 0.1)'][i % 2];
  return {
    background: [
      `radial-gradient(ellipse 100% 70% at 0% 0%, ${h} 0%, transparent 50%)`,
      'linear-gradient(195deg, rgba(22,18,13,0.97) 0%, rgba(13,10,8,0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(240, 200, 175, 0.16)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  };
}

/**
 * Choisir un membre LIRI pour démarrer un fil 1:1 (table `messages` Supabase).
 */
export default function EleveMessagesNewScreen() {
  const { user } = useAuth();
  const { users, currentUser, loading } = useMessaging();
  const [q, setQ] = useState('');

  const otherUsers = useMemo(() => {
    if (!Array.isArray(users) || !currentUser?.id) return [];
    const needle = String(q).trim().toLowerCase();
    return users
      .filter((u) => u.id !== currentUser.id)
      .filter((u) => {
        if (!needle) return true;
        const n = String(u.name || '').toLowerCase();
        const e = String(u.email || '').toLowerCase();
        return n.includes(needle) || e.includes(needle);
      })
      .slice(0, 200);
  }, [users, currentUser?.id, q]);

  return (
    <EleveMobileShell user={user} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{ minHeight: '100dvh', backgroundColor: EV_BG, backgroundImage: PAGE_AMBIENT }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-3">
          <div className="mb-3 flex items-center gap-1">
            <Link
              to={ELEVE_MOBILE.messages}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/95 active:bg-white/10"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <LiriWordmark size="kicker" className="text-white/40" />
              <h1 className="text-[20px] font-extrabold text-white">Nouveau message</h1>
            </div>
          </div>

          <div
            className="mb-3 flex items-center gap-2 rounded-2xl border px-3 py-2"
            style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.04)' }}
          >
            <Search className="h-4 w-4 shrink-0 text-white/45" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un membre…"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/35"
            />
          </div>

          {loading && !otherUsers.length ? (
            <p className="py-6 text-center text-[13px]" style={{ color: EV_MUTED }}>
              Chargement des membres…
            </p>
          ) : null}

          <div className="space-y-2">
            {otherUsers.map((u, i) => (
              <Link
                key={u.id}
                to={ELEVE_MOBILE.messageThread(u.id)}
                className="flex items-center gap-3 p-3 transition active:scale-[0.99]"
                style={{ borderRadius: EV_R.md, ...rowStyle(i) }}
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-orange-700 text-white">
                    <User className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{u.name || 'Membre'}</p>
                  <p className="truncate text-[12px]" style={{ color: EV_MUTED }}>
                    {u.email}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {!loading && otherUsers.length === 0 ? (
            <p className="py-8 text-center text-[13px]" style={{ color: EV_MUTED }}>
              Aucun autre membre ne correspond. Essaie un autre terme.
            </p>
          ) : null}
        </div>
      </div>
    </EleveMobileShell>
  );
}
