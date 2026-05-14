import React, { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, BookOpen, Radio, MessageCircle, User, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import {
  EV_MSG_TAB_BADGE,
  EV_BG as EV_MAQUETTE_BG,
  EV_R,
  EV_LINE,
  EV_MUTED,
  EV_ACCENT,
  EV_SH,
} from '@/pages/eleve-mobile/eleveMobileScreensShared';
import { EleveImmersiveHalo } from '@/components/eleve-mobile/EleveImmersiveHalo';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { isNativeRuntime } from '@/lib/nativeCapabilities';

/**
 * Coquille principale de l'app mobile « Élève » LIRI.
 *
 * Style : sombre profond + accents néon (bleu, violet, vert, rouge, orange).
 * En-tête : logo LIRI (L + ampoule + R + I) + tagline LEARN · LIVE · GROW,
 * cloche de notifications + avatar à droite.
 * Tab bar : 5 onglets, dont « Live » centré et surélevé en bouton dégradé.
 */
export function EleveMobileShell({
  user,
  notificationCount = 0,
  onAvatarClick,
  children,
  contentClassName,
  hideTabBar = false,
  hideHeader = false,
  showAvatarOnline = true,
  /** En-tête alternatif (Communauté, Profil…) : remplace le bloc logo LIRI */
  kicker,
  title,
  subtitle,
  rightSlot,
  /**
   * Badge rouge sur l’onglet Messages (maquette : indicateur non lus). `0` = masqué.
   * @default {EV_MSG_TAB_BADGE}
   */
  messagesTabBadge = EV_MSG_TAB_BADGE,
}) {
  const initials = (() => {
    const name = user?.user_metadata?.full_name || user?.email || '';
    if (!name) return '';
    return String(name)
      .split(/[\s@.]+/)
      .map((p) => p[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join('');
  })();

  const isHomeStyleHeader = !hideHeader && kicker == null && title == null;

  useEffect(() => {
    const appName = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_NAME;
    const prevTitle = typeof document !== 'undefined' ? document.title : '';
    if (typeof document !== 'undefined') {
      document.title = appName && String(appName).trim() ? String(appName).trim() : 'LIRI — Élève';
    }
    const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="theme-color"]') : null;
    const prevColor = meta?.getAttribute('content') ?? null;
    if (meta) meta.setAttribute('content', EV_MAQUETTE_BG);
    return () => {
      if (typeof document !== 'undefined') document.title = prevTitle;
      if (meta && prevColor != null) meta.setAttribute('content', prevColor);
    };
  }, []);

  return (
    <div
      className="eleve-mobile-root relative flex h-full w-full min-h-[100dvh] flex-1 flex-col overflow-hidden text-white"
      style={{ backgroundColor: EV_MAQUETTE_BG }}
    >
      {/* Atmosphère halos + grain + bords — type Apple (LIRI mobile) */}
      <EleveImmersiveHalo base={EV_MAQUETTE_BG} />

      {/* Barre d’état maquette (navigateur seulement) — la status bar native suffit sur Capacitor */}
      {isHomeStyleHeader && !isNativeRuntime() ? (
        <div className="shrink-0 pt-[env(safe-area-inset-top)]">
          <MobileStatusBarDeco />
        </div>
      ) : null}

      {/* En-tête : accueil (logo LIRI) ou titre d’écran interne */}
      {!hideHeader && (kicker != null || title != null) ? (
        <header className="relative shrink-0 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {kicker ? (
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{kicker}</p>
              ) : null}
              {title ? (
                <h1 className="mt-1 font-serif text-[22px] font-bold leading-tight tracking-tight text-[#fbf3df]">
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="mt-1 truncate text-[12px] text-[#f5edd9]/55">{subtitle}</p>
              ) : null}
            </div>
            {rightSlot ? <div className="shrink-0 pt-0.5">{rightSlot}</div> : null}
          </div>
        </header>
      ) : !hideHeader ? (
        <header className="relative flex shrink-0 items-center justify-between px-4 pb-3 pt-2.5">
          <div className="min-w-0">
            <LiriWordmark variant="official" officialBaseline={false} size="header" className="drop-shadow-[0_2px_12px_rgba(91,141,239,0.2)]" />
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.4em] text-white/50">
              LEARN • LIVE • GROW
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              aria-label={`Notifications${notificationCount ? ` (${notificationCount})` : ''}`}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-transform active:scale-95"
            >
              <BellIcon />
              {notificationCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E53935] px-1 text-[9px] font-extrabold text-white ring-2 ring-[#0B0B0F]">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              ) : null}
            </Link>

            {onAvatarClick ? (
              <button
                type="button"
                onClick={onAvatarClick}
                className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-white/12 ring-1 ring-white/5 transition-transform active:scale-95"
                aria-label="Mon profil"
              >
                <AvatarContent user={user} initials={initials} />
                {showAvatarOnline && user ? (
                  <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0B0B0F] bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.9)]" />
                ) : null}
              </button>
            ) : (
              <Link
                to={ELEVE_MOBILE.profile}
                className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-white/12 ring-1 ring-white/5 transition-transform active:scale-95"
                aria-label="Mon profil"
              >
                <AvatarContent user={user} initials={initials} />
                {showAvatarOnline && user ? (
                  <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0B0B0F] bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.9)]" />
                ) : null}
              </Link>
            )}
          </div>
        </header>
      ) : null}

      {/* Contenu */}
      <main
        className={cn(
          'relative min-h-0 flex-1 overflow-y-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          hideTabBar
            ? 'pb-0'
            : 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]',
          contentClassName,
        )}
      >
        {children}
      </main>

      {/* Tab bar avec bouton Live élevé */}
      {!hideTabBar ? <EleveBottomTabBar messagesTabBadge={messagesTabBadge} /> : null}
    </div>
  );
}

function AvatarContent({ user, initials }) {
  return user?.user_metadata?.avatar_url ? (
    <img src={user.user_metadata.avatar_url} alt="" className="h-full w-full object-cover" />
  ) : (
    <div
      className="flex h-full w-full items-center justify-center text-[12px] font-bold text-white"
      style={{
        background: 'linear-gradient(145deg, #4a6cff 0%, #7c5cff 55%, #a855f7 100%)',
      }}
    >
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/** Fausse status bar (maquette) : heure + signaux — le shell site Prorascience est déjà retiré sur /m/eleve. */
function MobileStatusBarDeco() {
  return (
    <div
      className="flex h-[26px] items-center justify-between px-4 text-[14px] font-semibold leading-none tracking-tight text-white"
      aria-hidden
    >
      <span className="pl-0.5">9:41</span>
      <div className="flex items-center gap-1.5 pr-0.5">
        <svg width="19" height="12" viewBox="0 0 19 12" className="text-white" fill="currentColor" aria-hidden>
          <rect x="1" y="8" width="3" height="3" rx="0.6" />
          <rect x="5.5" y="6" width="3" height="5" rx="0.6" />
          <rect x="10" y="3.5" width="3" height="7.5" rx="0.6" />
          <rect x="14.5" y="0.5" width="3" height="10" rx="0.6" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" className="text-white" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
          <path d="M8 9.5v.5" />
          <path d="M3.5 6.5a6.5 6.5 0 0 1 9 0" />
          <path d="M1 4a9.5 9.5 0 0 1 14 0" />
        </svg>
        <svg width="27" height="12" viewBox="0 0 27 12" className="text-white" fill="currentColor" aria-hidden>
          <rect x="1" y="1" width="21" height="10" rx="2.2" fill="none" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.9" />
          <rect x="2.2" y="2.1" width="16" height="7.7" rx="1.2" fill="currentColor" fillOpacity="0.98" />
          <path d="M23.5 3.2h1.1c0.4 0 0.7 0.3 0.7 0.5v3.3c0 0.2-0.3 0.5-0.7 0.5h-1.1" fill="currentColor" fillOpacity="0.55" />
        </svg>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab bar : 5 onglets, le Live au centre est élevé (FAB-style)      */
/* ------------------------------------------------------------------ */

function EleveBottomTabBar({ messagesTabBadge = 0 }) {
  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 border-t border-white/[0.1] shadow-[0_-8px_32px_rgba(0,0,0,0.5),0_-20px_48px_-12px_rgba(99,102,241,0.12),0_-1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl backdrop-saturate-150"
          style={{
            background:
              'linear-gradient(180deg, rgba(24,24,36,0.78) 0%, rgba(14,14,22,0.94) 40%, rgba(11, 11, 15, 0.96) 100%)',
          }}
        />
        <div className="relative mx-auto grid max-w-lg grid-cols-6 items-end gap-0 px-0.5 pb-1.5 pt-2 sm:px-1">
          <SideTab to={ELEVE_MOBILE.home} label="Accueil" icon={Home} end />
          <SideTab to={ELEVE_MOBILE.bibliotheque} label="Cours" icon={BookOpen} />
          <CenterLiveTab />
          <SideTab to={ELEVE_MOBILE.enLigne} label="En ligne" icon={Network} end />
          <SideTab
            to={ELEVE_MOBILE.messages}
            label="Messages"
            icon={MessageCircle}
            badge={messagesTabBadge > 0 ? messagesTabBadge : 0}
          />
          <SideTab to={ELEVE_MOBILE.profile} label="Profil" icon={User} />
        </div>
        <div
          className="mx-auto mt-0.5 h-1 w-[28%] min-w-[96px] max-w-[130px] rounded-full bg-white/30 opacity-80"
          style={{ marginBottom: 'max(4px, env(safe-area-inset-bottom, 0px))' }}
          aria-hidden
        />
      </div>
    </nav>
  );
}

function SideTab({ to, label, icon: Icon, end, badge = 0 }) {
  return (
    <NavLink
      to={to}
      end={Boolean(end)}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center justify-end gap-1 py-1.5 rounded-xl transition-colors',
          isActive ? 'text-[#5b8def]' : 'text-white/50 hover:text-white/85',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative inline-flex">
            <Icon
              className="h-[22px] w-[22px]"
              strokeWidth={isActive ? 2.4 : 1.9}
            />
            {badge > 0 ? (
              <span
                className="absolute -right-1.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E53935] px-0.5 text-[9px] font-extrabold text-white"
                style={{ boxShadow: `0 0 0 2px ${EV_MAQUETTE_BG}` }}
              >
                {badge > 9 ? '9+' : badge}
              </span>
            ) : null}
          </span>
          <span
            className={cn('px-0.5 text-center text-[9px] font-medium leading-tight sm:text-[10px]', isActive && 'font-semibold')}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function CenterLiveTab() {
  const { pathname } = useLocation();
  const isLive =
    pathname === ELEVE_MOBILE.live || pathname.startsWith(`${ELEVE_MOBILE.live}/`);
  return (
    <div className="relative flex flex-col items-center justify-end -mt-8">
      <NavLink
        to={ELEVE_MOBILE.live}
        className="group relative flex flex-col items-center"
      >
        {() => (
          <>
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute -inset-3 rounded-full blur-2xl transition-opacity',
                isLive ? 'opacity-100' : 'opacity-75 group-hover:opacity-100',
              )}
              style={{
                background:
                  'radial-gradient(circle, rgba(91,141,239,0.9) 0%, rgba(124,92,255,0.6) 38%, rgba(123,97,255,0.2) 55%, transparent 72%)',
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-full opacity-60 blur-md transition-opacity"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(200,220,255,0.12) 45%, transparent 70%)',
              }}
            />
            <span
              className="relative flex h-[58px] w-[58px] items-center justify-center rounded-full shadow-[0_12px_40px_-6px_rgba(91,141,239,0.8),0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(0,0,0,0.2),0_0_0_0.5px_rgba(123,97,255,0.4)] transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(165deg, #5b8def 0%, #5c6cff 35%, #7c5cff 65%, #8b4dff 100%)',
              }}
            >
              <Radio className="h-7 w-7 text-white" strokeWidth={2.2} />
            </span>
            <span
              className={cn(
                'mt-1.5 text-[10px] font-semibold',
                isLive ? 'text-[#7c5cff]' : 'text-white/50',
              )}
            >
              Live
            </span>
          </>
        )}
      </NavLink>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                       Briques UI réutilisables                     */
/* ------------------------------------------------------------------ */

/** Tuile d'accès rapide — icône colorée 3D dans un carré arrondi. */
export function QuickTile({ to, icon: Icon, label, accent = 'blue', live = false, soon = false }) {
  const palettes = {
    blue: { from: '#4A6CFF', to: '#5B8DEF', glow: 'rgba(74,108,255,0.5)', icon: '#5B8DEF' },
    purple: { from: '#7C5CFF', to: '#A855F7', glow: 'rgba(168,85,247,0.45)', icon: '#A855F7' },
    green: { from: '#10B981', to: '#34D399', glow: 'rgba(16,185,129,0.45)', icon: '#22C55E' },
    red: { from: '#EF4444', to: '#F87171', glow: 'rgba(239,68,68,0.55)', icon: '#EF4444' },
    orange: { from: '#F59E0B', to: '#FBBF24', glow: 'rgba(245,158,11,0.45)', icon: '#F59E0B' },
    teal: { from: '#0EA5E9', to: '#22D3EE', glow: 'rgba(14,165,233,0.4)', icon: '#0EA5E9' },
  };
  const palette = palettes[accent] || palettes.blue;
  return (
    <Link to={to} className="block min-w-0">
      <motion.div whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-1">
        <div
          className={cn(
            'relative flex aspect-square w-full max-w-[68px] items-center justify-center rounded-[18px] border',
            live
              ? 'border-[#E53935]/70 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
              : soon
                ? 'border-amber-400/55'
                : 'border-white/[0.12]',
          )}
          style={{
            background: `linear-gradient(165deg, ${palette.from}40 0%, ${palette.to}18 100%)`,
            boxShadow: live
              ? `0 6px 20px -6px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`
              : `0 6px 20px -8px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
          }}
        >
          {live || soon ? (
            <span
              className={cn(
                'absolute right-0.5 top-0.5 z-[1] scale-[0.88] rounded px-1.5 py-[1px] text-[7px] font-extrabold leading-none tracking-wider',
                live
                  ? 'bg-[#E53935] text-white shadow-[0_0_10px_rgba(239,68,68,0.85)]'
                  : 'bg-amber-400/95 text-[10px] text-black',
              )}
            >
              {live ? 'LIVE' : 'Bientôt'}
            </span>
          ) : null}
          <Icon className="h-6 w-6" strokeWidth={2.1} style={{ color: palette.icon }} />
        </div>
        <span className="w-full text-center text-[10px] font-medium leading-tight text-white/90">{label}</span>
      </motion.div>
    </Link>
  );
}

/** Carte de section avec bord léger + dégradé subtil. */
export function EleveCard({ children, className, glow, ...rest }) {
  return (
    <div
      className={cn(
        'relative rounded-3xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-md',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
      {...rest}
    >
      {glow ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            boxShadow: `0 0 0 1px ${glow}, 0 18px 40px -22px ${glow}`,
          }}
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

/** Titre de section (avec lien « Voir tout » optionnel). Maquette : lien violet #7B61FF. */
export function EleveSectionTitle({ children, action, actionTo, className, dot, actionClassName }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-3', className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="truncate text-[17px] font-bold tracking-tight text-white">{children}</h2>
        {dot ? (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E53935] shadow-[0_0_6px_rgba(229,57,53,0.9)]" />
        ) : null}
      </div>
      {action ? (
        actionTo ? (
          <Link
            to={actionTo}
            className={cn(
              'flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-violet-400/95 active:opacity-80',
              actionClassName,
            )}
          >
            {action}
            <span className="text-[14px] font-light leading-none text-white/90">&gt;</span>
          </Link>
        ) : (
          <span className={cn('text-[12px] font-semibold text-violet-400/95', actionClassName)}>{action}</span>
        )
      ) : null}
    </div>
  );
}

/** Bandeau d'information (style « Accès élève uniquement ») — bandeau fin + chevron. */
export function EleveInfoBanner({ icon: Icon, title, description, accent = 'green', to }) {
  const accents = {
    green: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', icon: '#22C55E' },
    blue: { bg: 'rgba(74,108,255,0.12)', border: 'rgba(74,108,255,0.25)', icon: '#5B8DEF' },
    purple: { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)', icon: '#a855f7' },
  };
  const c = accents[accent] || accents.green;
  const inner = (
    <div
      className="flex items-center gap-3 rounded-[20px] border px-3.5 py-3"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${c.icon}18`, boxShadow: `0 0 0 1px ${c.icon}30` }}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} style={{ color: c.icon }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold leading-tight text-white">{title}</p>
        <p className="mt-0.5 text-[10.5px] leading-snug text-white/60">{description}</p>
      </div>
      <span className="shrink-0 pr-0.5 text-lg font-light text-white/40" aria-hidden>
        &gt;
      </span>
    </div>
  );
  return to ? (
    <Link to={to} className="block active:scale-[0.99]">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/**
 * État vide — cartes LIRI (halos, CTA dégradé ou discret).
 * @param {{ to?: string; label: string; variant?: 'gradient' | 'ghost'; onClick?: () => void }} [primary]
 * @param {{ to: string; label: string }} [secondary]
 */
export function EleveEmptyState({ icon: Icon, title, description, primary, secondary, className, children }) {
  const hasActions = Boolean(
    (primary && (primary.to || primary.onClick)) || (secondary && secondary.to),
  );
  const primaryClass =
    'inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl text-[13px] font-bold transition active:scale-[0.99]';
  const primaryIsGhost = primary?.variant === 'ghost';

  return (
    <div
      className={cn('relative overflow-hidden p-5 text-center', className)}
      style={{
        borderRadius: EV_R.lg,
        background: [
          'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(99, 102, 241, 0.1) 0%, transparent 55%)',
          'linear-gradient(188deg, rgba(22, 24, 36, 0.96) 0%, rgba(12, 14, 22, 0.99) 100%)',
        ].join(', '),
        border: '1px solid rgba(165, 180, 252, 0.14)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {Icon ? (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-gradient-to-br from-indigo-500/20 to-violet-600/18 shadow-[0_4px_16px_-4px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <Icon className="h-6 w-6 text-violet-200" strokeWidth={2} />
        </div>
      ) : null}
      <p className="text-[15px] font-bold leading-tight text-white/95">{title}</p>
      {description ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: EV_MUTED }}>
          {description}
        </p>
      ) : null}
      {children}
      {hasActions ? (
        <div className="mt-4 flex flex-col items-stretch gap-2">
          {primary && (primary.to || primary.onClick) ? (
            primary.to ? (
              <Link
                to={primary.to}
                className={cn(primaryClass, 'text-white')}
                style={
                  primaryIsGhost
                    ? { border: `1px solid ${EV_LINE}`, background: 'rgba(255,255,255,0.06)' }
                    : { background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #5B21B6 100%)`, boxShadow: EV_SH.cta }
                }
              >
                {primary.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={primary.onClick}
                className={cn(primaryClass, 'text-white')}
                style={{
                  background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #5B21B6 100%)`,
                  boxShadow: EV_SH.cta,
                }}
              >
                {primary.label}
              </button>
            )
          ) : null}
          {secondary && secondary.to ? (
            <Link
              to={secondary.to}
              className="inline-flex h-10 w-full items-center justify-center rounded-2xl text-[13px] font-semibold text-white/90 transition active:scale-[0.99]"
              style={{ border: `1px solid ${EV_LINE}`, background: 'rgba(255,255,255,0.06)' }}
            >
              {secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Petit label majuscule style « Membre » / or */
export function EleveKicker({ children, className }) {
  return (
    <p
      className={cn('text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/80', className)}
    >
      {children}
    </p>
  );
}

const ELEVE_SURFACE_STYLES = {
  wallet:
    'rounded-3xl border border-[#D4AF37]/20 bg-[linear-gradient(160deg,rgba(31,24,18,0.9),rgba(12,10,8,0.95))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_-8px_rgba(0,0,0,0.5)] backdrop-blur-md',
  plate:
    'rounded-3xl border border-white/[0.08] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md',
};

export function EleveSurface({ variant = 'plate', className, children, ...rest }) {
  return (
    <div className={cn(ELEVE_SURFACE_STYLES[variant] || ELEVE_SURFACE_STYLES.plate, className)} {...rest}>
      {children}
    </div>
  );
}

export function ElevePrimaryButton({ to, children, className, ...rest }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex h-12 items-center justify-center rounded-2xl border border-[#D4AF37]/50',
        'bg-gradient-to-b from-[#D4AF37]/28 to-[#8b6914]/22 text-[14px] font-semibold text-[#fbf3df]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_16px_rgba(212,175,55,0.15)] transition-transform active:scale-[0.98]',
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function EleveGhostButton({ to, children, className, ...rest }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex h-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] text-[14px] font-medium',
        'text-[#f5edd9]/90 backdrop-blur-sm transition-transform active:scale-[0.98]',
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function EleveBadge({ children, tone = 'gold', className }) {
  const tones = {
    gold: 'border-[#D4AF37]/35 bg-[#D4AF37]/12 text-[#D4AF37] shadow-[0_0_0_1px_rgba(212,175,55,0.2)]',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
        tones[tone] || tones.gold,
        className,
      )}
    >
      {children}
    </span>
  );
}
