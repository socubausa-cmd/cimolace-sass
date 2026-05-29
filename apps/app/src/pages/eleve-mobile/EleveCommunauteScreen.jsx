import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  MessageCircle,
  Megaphone,
  HeartHandshake,
  ChevronRight,
  Sparkles,
  Hash,
  Bell,
  Loader2,
} from 'lucide-react';
import { EleveMobileShell, EleveSectionTitle, EleveBadge } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useLiriForumFeed } from '@/hooks/useLiriForumFeed';
import { LiriPageFooterLine, LiriWordmark } from '@/components/brand/LiriWordmark';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_BG, EV_MUTED, EV_ACCENT, EV_LINE, EV_R, EV_SH } from '@/pages/eleve-mobile/eleveMobileScreensShared';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';

function listPanelSurface() {
  return {
    background: 'linear-gradient(195deg, rgba(18, 20, 32, 0.97) 0%, rgba(10, 10, 18, 0.99) 100%)',
    border: '1px solid rgba(165, 180, 252, 0.16)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 20px -8px rgba(0,0,0,0.4)',
  };
}

function feedCardSurface() {
  return {
    background: [
      'radial-gradient(ellipse 90% 70% at 10% 0%, rgba(99, 102, 241, 0.12) 0%, transparent 55%)',
      'linear-gradient(190deg, rgba(22, 24, 36, 0.98) 0%, rgba(12, 14, 22, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(165, 180, 252, 0.15)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 14px -4px rgba(0,0,0,0.4)',
  };
}

const HUBS = [
  {
    to: ELEVE_MOBILE.messages,
    title: 'Messagerie',
    sub: 'Conversations privées',
    icon: MessageCircle,
  },
  {
    to: '/community',
    title: 'Forum LIRI',
    sub: 'Discussions générales',
    icon: Users,
  },
  {
    to: `${ELEVE_MOBILE.classe}#membres`,
    title: "Cercles d'études",
    sub: 'Classe & ateliers',
    icon: HeartHandshake,
  },
];

// FEED statique de secours (affiché si le forum est vide)
const FEED_FALLBACK = [
  {
    to: ELEVE_MOBILE.agenda,
    kicker: 'Annonce',
    title: 'Calendrier de la rentrée pédagogique',
    sub: 'Lectures, lives, ateliers',
    icon: Megaphone,
    badge: 'Nouveau',
  },
  {
    to: `${ELEVE_MOBILE.classe}#membres`,
    kicker: 'Cercle',
    title: "Bienvenue dans la communauté LIRI",
    sub: 'Présente-toi et échange avec tes pairs',
    icon: Users,
  },
];

/** Convertit un topic forum en item de FeedCard */
function topicToFeedItem(topic) {
  return {
    to: `/community/topic/${topic.id}`,
    kicker: topic.category || 'Discussion',
    title: topic.title,
    sub: topic.replies_count > 0 ? `${topic.replies_count} réponse${topic.replies_count > 1 ? 's' : ''}` : 'Nouveau sujet',
    icon: Hash,
    badge: null,
  };
}

function HubRow({ to, title, sub, icon: Icon }) {
  return (
    <Link to={to} className="block">
      <motion.div
        whileTap={{ scale: 0.985 }}
        className="flex items-center gap-3.5 border-b border-white/[0.07] py-3.5 last:border-b-0"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center"
          style={{
            borderRadius: EV_R.md,
            background: `linear-gradient(160deg, ${EV_ACCENT}28, ${EV_ACCENT}0d)`,
            border: `1px solid ${EV_ACCENT}44`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: '#C4B5FD' }} strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium tracking-tight text-white/95">{title}</p>
          <p className="truncate text-[11.5px]" style={{ color: EV_MUTED }}>
            {sub}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
      </motion.div>
    </Link>
  );
}

function FeedCard({ to, kicker, title, sub, icon: Icon, badge }) {
  return (
    <Link to={to} className="block">
      <motion.div
        whileTap={{ scale: 0.99 }}
        className="group flex items-start gap-3.5 p-3.5"
        style={{ borderRadius: EV_R.lg, ...feedCardSurface() }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center"
          style={{
            borderRadius: EV_R.md,
            border: `1px solid ${EV_ACCENT}40`,
            background: `linear-gradient(160deg, ${EV_ACCENT}22, transparent)`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: '#C4B5FD' }} strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300/85">{kicker}</p>
            {badge ? <EleveBadge tone="gold">{badge}</EleveBadge> : null}
          </div>
          <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-white/95">
            {title}
          </p>
          <p className="mt-1 truncate text-[11.5px]" style={{ color: EV_MUTED }}>
            {sub}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}

export default function EleveCommunauteScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  // Données forum réelles
  const { topics, loading: forumLoading } = useLiriForumFeed({ limit: 4, userId: user?.id });
  const feedItems = topics.length > 0
    ? topics.map(topicToFeedItem)
    : FEED_FALLBACK;

  return (
    <EleveMobileShell user={user} notificationCount={inboxUnread} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: PAGE_AMBIENT,
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-2 pt-0.5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <LiriWordmark size="kicker" className="text-white/40" />
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">
                Communauté
              </h1>
              <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
                Échanges, entraide et annonces
              </p>
            </div>
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-white/90 transition active:scale-95"
              style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={2.1} />
            </Link>
          </div>
        </div>

        <div className="px-4 pb-4">
          {!user ? (
            <div
              className="mb-5 overflow-hidden p-4"
              style={{ borderRadius: EV_R.lg, ...listPanelSurface() }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300/80">Bienvenue</p>
              <p className="mt-2 text-[18px] font-extrabold leading-tight text-white">Rejoins la conversation</p>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: EV_MUTED }}>
                Connecte-toi pour échanger avec les autres élèves et l'école.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <Link
                  to={ELEVE_MOBILE.login}
                  className="flex h-12 items-center justify-center rounded-2xl text-[14px] font-semibold text-white transition active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${EV_ACCENT} 0%, #5B21B6 100%)`,
                    boxShadow: EV_SH.cta,
                  }}
                >
                  Connexion
                </Link>
                <Link
                  to={ELEVE_MOBILE.signup}
                  className="flex h-12 items-center justify-center rounded-2xl border text-[14px] font-medium text-white/90 transition active:scale-[0.98]"
                  style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.04)' }}
                >
                  Créer un compte
                </Link>
              </div>
            </div>
          ) : null}

          <EleveSectionTitle className="mb-2.5">Espaces</EleveSectionTitle>
          <div
            className="mb-6 overflow-hidden px-3.5"
            style={{ borderRadius: EV_R.lg, ...listPanelSurface() }}
          >
            {HUBS.map((hub) => (
              <HubRow key={hub.to} {...hub} />
            ))}
          </div>

          <EleveSectionTitle
            className="mb-2.5"
            action="Tout voir"
            actionTo="/community"
            actionClassName="!text-violet-400/95"
          >
            {topics.length > 0 ? 'Forum — Récents' : 'À la une'}
          </EleveSectionTitle>
          {forumLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400/60" />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {feedItems.map((item) => (
                <FeedCard key={item.title} {...item} />
              ))}
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-1.5 text-white/25">
            <Sparkles className="h-3 w-3 text-violet-400/50" />
            <span className="text-[10px] uppercase tracking-[0.2em]">Esprit · Respect · Bienveillance</span>
          </div>
          <LiriPageFooterLine marginClass="mt-5" suffix="Communauté" />
        </div>
      </div>
    </EleveMobileShell>
  );
}
