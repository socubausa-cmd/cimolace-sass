import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Atom,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Eye,
  GraduationCap,
  Globe2,
  Menu,
  Play,
  Pyramid,
  Sparkles,
  Target,
  UserCircle,
  Users,
} from 'lucide-react';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { ProrascienceVitrineNavMenuContent } from '@/components/eleve-mobile/ProrascienceVitrineNavMenuContent';
import { ProrascienceVitrineBottomTabBar } from '@/components/eleve-mobile/ProrascienceVitrineBottomTabBar';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import {
  PRORASCIENCE_HERO_CAROUSEL_SLIDES,
  ProrascienceHomeHeroCarousel,
} from '@/components/prorascience/ProrascienceHomeHeroCarousel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { getProrascienceVitrineMenuSections } from '@/lib/prorascienceVitrineMenu';
import { cn } from '@/lib/utils';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { getLiriMemberLoginPath } from '@/lib/liriVitrineModel';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { EV_BG, EV_MUTED } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const SCHOOL = isnaTenantConfig.branding.name;

const PAGE_BG = EV_BG;

/** Visuel hero : premier slide du même carrousel que la vitrine web. */
const HERO_POSTER = PRORASCIENCE_HERO_CAROUSEL_SLIDES[0]?.src ?? '/image-pro/hero-vitrine-prorascience-accueil.png';

const HERO_STATS = [
  { Icon: Users, value: '+2500', caption: 'Étudiants accompagnés' },
  { Icon: BookOpen, value: '+120', caption: 'Formations disponibles' },
  { Icon: Globe2, value: '+15', caption: 'Pays représentés' },
];

const ACTIONS = [
  {
    to: `${ELEVE_MOBILE.prorascience}/forfaits`,
    label: 'Forfaits & offres',
    sub: 'Tarifs',
    icon: GraduationCap,
    tone: 'blue',
  },
  {
    to: ELEVE_MOBILE.modules,
    label: '21 modules',
    sub: 'Catalogue',
    icon: BookOpen,
    tone: 'blue',
  },
  {
    to: ELEVE_MOBILE.appointmentRequest,
    label: 'Rendez-vous',
    sub: 'Secrétariat',
    icon: CalendarDays,
    tone: 'violet',
  },
  {
    to: ELEVE_MOBILE.prorascienceLes21Sciences,
    label: 'Les 21 sciences',
    sub: 'Curriculum',
    icon: Sparkles,
    tone: 'violet',
  },
];

/** Section « Une voie unique » — alignée maquette premium Prorascience. */
const UNE_VOIE_UNIQUE = [
  {
    key: 'reel',
    title: 'Science du réel',
    text: "Des connaissances fondées sur l'observation, la logique et l'expérience.",
    icon: Atom,
    tone: 'sky',
  },
  {
    key: 'meta',
    title: 'Métaphysique africaine',
    text: "Les lois invisibles de l'univers révélées par nos ancêtres.",
    icon: Pyramid,
    tone: 'violet',
  },
  {
    key: 'potentiel',
    title: 'Activation du potentiel',
    text: 'Transforme ton esprit, ta vie et ton impact sur le monde.',
    icon: Sparkles,
    tone: 'sky',
  },
];

/** Aligné sur `ProrascienceCommercialPage` (section fondateur, esprit pôle école). */
const VISION_MISSION_FONDATEUR = [
  {
    key: 'vision',
    title: 'Vision',
    text:
      'Faire de la connaissance africaine une science articulée de la réalité, du visible à l\'invisible — pas seulement la répétition de rites, mais la compréhension structurée du sensible et du suprasensible.',
    icon: Eye,
  },
  {
    key: 'mission',
    title: 'Mission',
    text:
      `Rigueur, initiation structurée et transmission vivante : ancrer le pôle école ${SCHOOL} et l'enseignement du 5e Manikongo, fil conducteur entre l'Ordre mystique des Manikongo et la communauté des élèves en ligne.`,
    icon: Target,
  },
  {
    key: 'auteur',
    title: 'À propos de l\'auteur',
    text:
      'Le 5e Manikongo — Badika Jel David, connu dans le réseau sous le nom de Ngowazulu — porte la charge spirituelle et doctrinale de l\'école : responsabilité de garde du savoir et de transmission pour cette génération.',
    icon: UserCircle,
  },
];

const PREMIUM_CARD =
  'linear-gradient(168deg, rgba(52, 88, 138, 0.95) 0%, rgba(28, 58, 98, 0.96) 40%, rgba(16, 36, 72, 0.99) 100%)';

const TONE_HALO = {
  gold: {
    spread: 'from-sky-300/30 via-blue-500/24 to-transparent',
    border: 'border-sky-400/38',
    iconBg: 'bg-gradient-to-br from-sky-500/20 to-blue-800/18 ring-1 ring-sky-400/25',
  },
  blue: {
    spread: 'from-sky-300/30 via-blue-500/25 to-transparent',
    border: 'border-sky-400/40',
    iconBg: 'bg-gradient-to-br from-sky-500/20 to-blue-800/20 ring-1 ring-sky-400/25',
  },
  violet: {
    spread: 'from-violet-300/25 via-fuchsia-500/22 to-transparent',
    border: 'border-violet-400/38',
    iconBg: 'bg-gradient-to-br from-violet-500/20 to-fuchsia-900/15 ring-1 ring-violet-400/22',
  },
  amber: {
    spread: 'from-indigo-300/25 via-violet-500/22 to-transparent',
    border: 'border-indigo-400/35',
    iconBg: 'bg-gradient-to-br from-indigo-500/18 to-violet-800/15 ring-1 ring-indigo-400/22',
  },
};

const EASE_PREMIUM = [0.22, 1, 0.36, 1];

const staggerContainer = (reduce, stagger = 0.09) => ({
  hidden: {},
  show: { transition: { staggerChildren: reduce ? 0 : stagger, delayChildren: reduce ? 0 : 0.03 } },
});

const fadeUpItem = (reduce) => ({
  hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: reduce ? 0 : 0.44, ease: EASE_PREMIUM },
  },
});

const VOIE_TONE = {
  sky: { border: 'border-sky-500/30', iconWrap: 'from-sky-500/30 to-blue-600/20 text-sky-200' },
  violet: { border: 'border-violet-500/30', iconWrap: 'from-violet-500/30 to-fuchsia-700/20 text-violet-200' },
  gold: { border: 'border-sky-500/30', iconWrap: 'from-sky-500/30 to-blue-800/20 text-sky-200' },
};

function ActionCard({ to, label, sub, icon: Icon, tone, itemVariants }) {
  const t = TONE_HALO[tone] ?? TONE_HALO.blue;
  const reduce = useReducedMotion();
  return (
    <Link to={to} className="relative block min-w-0">
      <div
        className={cn('pointer-events-none absolute -inset-1 rounded-[20px] bg-gradient-to-b opacity-100 blur-3xl', t.spread)}
        aria-hidden
      />
      <motion.div
        variants={itemVariants}
        whileTap={{ scale: 0.98 }}
        whileHover={
          reduce ? undefined : { y: -2, scale: 1.015, transition: { duration: 0.22, ease: EASE_PREMIUM } }
        }
        className={cn('relative flex items-center gap-3 rounded-2xl border p-3.5', t.border)}
        style={{
          background: PREMIUM_CARD,
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.12)',
            'inset 0 0 0 1px rgba(255,255,255,0.05)',
            '0 14px 40px -10px rgba(15, 50, 100, 0.7)',
            '0 0 56px -12px rgba(59, 130, 246, 0.28)',
          ].join(', '),
        }}
      >
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/95 shadow-inner',
            t.iconBg,
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-white drop-shadow-sm">{label}</p>
          <p className="text-[11px] font-medium text-slate-300/90">{sub}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-sky-300/60" />
      </motion.div>
    </Link>
  );
}

/**
 * Vitrine Prorascience — accueil mobile (fond LIRI `EV_BG`, hero, CTA, stats, « Une voie unique »).
 */
export default function EleveProrascienceVitrineScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const loginPath = getLiriMemberLoginPath();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const profileTo = user ? ELEVE_MOBILE.profile : loginPath;
  const [menuOpen, setMenuOpen] = useState(false);

  const menuSections = useMemo(() => getProrascienceVitrineMenuSections(), []);
  const itemV = useMemo(() => fadeUpItem(!!prefersReducedMotion), [prefersReducedMotion]);
  const stStatsV = useMemo(() => staggerContainer(!!prefersReducedMotion, 0.12), [prefersReducedMotion]);
  const stListV = useMemo(() => staggerContainer(!!prefersReducedMotion, 0.1), [prefersReducedMotion]);

  const openVitrineVideo = () => {
    navigate('/ecoles/prorascience?vitrine=web#video-ecole');
  };

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      hideHeader
      hideTabBar
      contentClassName="!px-0 !bg-[#0B0B0F] !pb-0"
    >
      <div
        className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: PAGE_BG }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(ellipse_60%_40%_at_100%_20%,rgba(124,58,237,0.1),transparent_45%)]" />

        <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col">
          <div className="shrink-0 px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
            <LiriStatusBar />
          </div>

          {/* Barre type maquette : menu (navigation) | marque école | profil */}
          <motion.header
            className="relative z-10 flex items-center justify-between gap-2 px-4 pb-3 pt-1"
            initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: EASE_PREMIUM }}
          >
            <motion.button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-500/25 bg-sky-500/10 text-sky-100 shadow-[0_0_24px_-6px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] active:scale-95"
              aria-label="Ouvrir le menu de navigation"
              whileTap={{ scale: 0.94 }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.05, transition: { duration: 0.2 } }}
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </motion.button>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetContent
                side="left"
                className="w-[min(92vw,15.5rem)] border-white/10 bg-black p-0 pt-10 shadow-2xl shadow-black/50 backdrop-blur-sm sm:w-[15.5rem] sm:max-w-[15.5rem] [&>button]:text-white/85 [&>button]:hover:bg-white/10 [&>button]:hover:text-white"
              >
                <ProrascienceVitrineNavMenuContent menuSections={menuSections} onItemNavigate={() => setMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <motion.div
              className="min-w-0 flex-1 text-center"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.05, duration: 0.45, ease: EASE_PREMIUM }}
            >
              <p
                className="bg-gradient-to-r from-sky-200 via-white to-cyan-200/90 bg-clip-text text-[11px] font-black uppercase tracking-[0.28em] text-transparent sm:text-xs"
                style={{ fontSize: '0.7rem' }}
              >
                {SCHOOL}
              </p>
              <p className="mt-1 text-[7px] font-semibold uppercase leading-tight tracking-[0.2em] text-white/50">
                De la prophétie à la raison
              </p>
            </motion.div>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.08, duration: 0.45, ease: EASE_PREMIUM }}
            >
              <Link
                to={profileTo}
                className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-gradient-to-br from-sky-600/40 to-violet-600/50 text-white shadow-[0_0_22px_2px_rgba(99,102,241,0.55)] active:scale-95"
                aria-label={user ? 'Mon profil' : 'Connexion'}
              >
                {user ? (
                  <span className="text-[11px] font-bold">{(user.email || 'U').slice(0, 1).toUpperCase()}</span>
                ) : (
                  <UserCircle className="h-6 w-6 opacity-90" />
                )}
              </Link>
            </motion.div>
          </motion.header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
            {/* HERO : visuel + accroche + CTA + stats */}
            <motion.section
              className="relative"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.65, ease: EASE_PREMIUM, delay: prefersReducedMotion ? 0 : 0.06 }}
            >
              <div
                className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-[#0B0B0F] shadow-[0_20px_60px_-20px_rgba(123,97,255,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <div className="relative aspect-[4/3] w-full sm:max-h-[240px]">
                  <motion.img
                    src={HERO_POSTER}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain"
                    loading="eager"
                    style={{ objectPosition: '50% 50%' }}
                    initial={prefersReducedMotion ? false : { scale: 1.01 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.75, ease: EASE_PREMIUM }}
                  />
                  {/*
                    Dégradé léger : lisibilité texte en bas sans voiler tout le visuel (évite l'effet “flou de bouillie”).
                  */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0F] via-[#0B0B0F]/25 to-transparent" />
                  <div
                    className="absolute inset-0 opacity-40"
                    style={{
                      background:
                        'radial-gradient(ellipse 70% 45% at 50% 32%, rgba(56, 189, 248, 0.06), transparent 58%), conic-gradient(from 180deg at 50% 50%, rgba(99,102,241,0.08), transparent 30%, rgba(59,130,246,0.05), transparent 55%)',
                    }}
                    aria-hidden
                  />
                  <div className="absolute inset-0 flex items-start justify-center pt-12 sm:pt-14">
                    <motion.div
                      className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-sky-400/40 bg-black/18 ring-1 ring-sky-400/25 will-change-transform"
                      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.88 }}
                      animate={
                        prefersReducedMotion
                          ? { opacity: 1, scale: 1, y: 0 }
                          : {
                              opacity: 1,
                              scale: 1,
                              y: [0, 7, 0],
                              boxShadow: [
                                '0 0 22px 5px rgba(56, 189, 248, 0.18)',
                                '0 0 38px 12px rgba(56, 189, 248, 0.38)',
                                '0 0 22px 5px rgba(56, 189, 248, 0.18)',
                              ],
                            }
                      }
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : {
                              opacity: { delay: 0.15, duration: 0.5, ease: EASE_PREMIUM },
                              scale: { delay: 0.15, duration: 0.5, ease: EASE_PREMIUM },
                              y: { delay: 0.7, duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
                              boxShadow: { delay: 0.7, duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
                            }
                      }
                    >
                      {prefersReducedMotion ? (
                        <img
                          src="/liri-logo-mark.png"
                          alt="LIRI"
                          className="h-[72px] w-[72px] object-contain p-1.5"
                          loading="eager"
                          decoding="async"
                        />
                      ) : (
                        <motion.img
                          src="/liri-logo-mark.png"
                          alt="LIRI"
                          className="h-[72px] w-[72px] object-contain p-1.5"
                          loading="eager"
                          decoding="async"
                          animate={{ scale: [1, 1.04, 1] }}
                          transition={{
                            duration: 3.2,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: 'easeInOut',
                            delay: 0.7,
                          }}
                        />
                      )}
                    </motion.div>
                  </div>
                </div>
                <div className="space-y-4 px-4 pb-5 pt-2">
                  <h1 className="text-center text-[22px] font-black leading-tight tracking-[-0.03em] text-white sm:text-2xl">
                    La science du <span className="text-sky-300">réel</span>
                    <br />
                    au service de <span className="text-cyan-200/95">l'humain</span>.
                  </h1>
                  <p className="text-center text-[13px] font-medium leading-relaxed text-slate-300/95">
                    Une école initiatique, scientifique et spirituelle pour comprendre l'univers, maîtriser la
                    connaissance et révéler ton potentiel.
                  </p>
                  <div className="flex flex-col gap-2.5">
                    <Button
                      type="button"
                      className="h-12 w-full gap-2 rounded-2xl border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-[12px] font-extrabold uppercase tracking-wide text-white shadow-[0_8px_32px_-4px_rgba(59,130,246,0.55),0_0_40px_-8px_rgba(124,58,237,0.4)]"
                      onClick={() => navigate(ELEVE_MOBILE.connexion)}
                    >
                      <GraduationCap className="h-5 w-5" />
                      Rejoindre l'école
                      <ChevronRight className="h-4 w-4 opacity-80" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full gap-2 rounded-2xl border-sky-400/40 bg-white/[0.03] text-[12px] font-bold uppercase tracking-wide text-slate-100 shadow-[0_0_24px_-6px_rgba(56,189,248,0.35)] hover:bg-white/[0.08]"
                      onClick={openVitrineVideo}
                    >
                      <Play className="h-5 w-5 text-sky-300" />
                      {`Découvrir ${SCHOOL}`}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Stats — ligne type maquette */}
              <motion.div
                className="mt-4 flex border-y border-white/10 py-4"
                variants={stStatsV}
                initial="hidden"
                animate="show"
              >
                {HERO_STATS.map((s, i) => (
                  <motion.div
                    key={s.caption}
                    variants={itemV}
                    className={cn('flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 text-center', i > 0 && 'border-l border-white/10')}
                  >
                    <s.Icon className="h-5 w-5 text-sky-300/80 shadow-[0_0_12px_rgba(56,189,248,0.35)]" strokeWidth={1.5} />
                    <span className="text-lg font-black tabular-nums text-white">{s.value}</span>
                    <span className="px-0.5 text-[7px] font-bold uppercase leading-tight tracking-wide text-slate-400">
                      {s.caption}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.section>

            {/* Une voie unique */}
            <motion.section
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: EASE_PREMIUM }}
            >
              <motion.div
                className="mb-4 flex items-center justify-center gap-2"
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
              >
                <span className="h-1.5 w-1.5 rotate-45 bg-sky-400/90 shadow-[0_0_10px_rgba(56,189,248,0.65)]" />
                <h2 className="bg-gradient-to-r from-sky-200 to-white/95 bg-clip-text text-center text-[12px] font-extrabold uppercase tracking-[0.2em] text-transparent">
                  Une voie unique
                </h2>
                <span className="h-1.5 w-1.5 rotate-45 bg-sky-400/90 shadow-[0_0_10px_rgba(56,189,248,0.65)]" />
              </motion.div>
              <motion.div
                className="space-y-3"
                variants={stListV}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-20px' }}
              >
                {UNE_VOIE_UNIQUE.map((b) => {
                  const cardTone = VOIE_TONE[b.tone] ?? VOIE_TONE.sky;
                  const Ic = b.icon;
                  return (
                    <motion.div
                      key={b.key}
                      variants={itemV}
                      className={cn(
                        'rounded-2xl border bg-slate-950/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                        cardTone.border,
                      )}
                    >
                      <div className="flex gap-3">
                        <div
                          className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-[0_0_20px_-4px_rgba(56,189,248,0.3)]',
                            cardTone.iconWrap,
                          )}
                        >
                          <Ic className="h-6 w-6" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-[11px] font-extrabold uppercase tracking-wider text-white">{b.title}</p>
                          <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
                            {b.text}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.section>

            {/* Vision / mission / auteur — détail institutionnel */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-32px' }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: EASE_PREMIUM }}
            >
              <div className="mb-2.5 flex items-center gap-2 pl-0.5">
                <div className="h-2 w-2 rounded-full bg-gradient-to-br from-sky-400 to-violet-500" />
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">Institution</p>
              </div>
              <motion.div
                className="space-y-3"
                variants={stListV}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
              >
                {VISION_MISSION_FONDATEUR.map((b, idx) => {
                  const IconB = b.icon;
                  const halos = [
                    'from-sky-400/18 via-blue-500/12 to-slate-900/0',
                    'from-sky-400/20 via-blue-500/12 to-violet-500/8',
                    'from-violet-400/18 via-sky-500/10 to-blue-500/5',
                  ];
                  return (
                    <motion.div key={b.key} className="relative" variants={itemV}>
                      <div
                        className={cn(
                          'pointer-events-none absolute -inset-px rounded-[18px] bg-gradient-to-b opacity-80 blur-2xl',
                          halos[idx % halos.length],
                        )}
                        aria-hidden
                      />
                      <div
                        className="relative rounded-2xl border border-sky-400/30 p-3.5"
                        style={{
                          background: PREMIUM_CARD,
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 10px 32px -10px rgba(30, 70, 130, 0.5)',
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/25 to-indigo-900/35 ring-1 ring-sky-400/30">
                            <IconB className="h-4 w-4 text-sky-100/95" strokeWidth={2} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-sky-300/95">{b.title}</p>
                            <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
                              {b.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`${ELEVE_MOBILE.prorascience}/fondateur`}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-white/90"
                >
                  Biographie &amp; mandat
                  <ArrowRight className="h-3.5 w-3.5 text-sky-400/90" />
                </Link>
                <Link
                  to={`${ELEVE_MOBILE.prorascience}/a-propos`}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-[12px] font-medium text-slate-300/95"
                >
                  À propos
                </Link>
              </div>
            </motion.div>

            {/* Carrousel (mêmes visuels que le site) */}
            <motion.div
              className="relative"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: EASE_PREMIUM }}
            >
              <div
                className="pointer-events-none absolute -inset-1 rounded-[24px] bg-gradient-to-b from-sky-500/20 via-cyan-500/12 to-indigo-600/10 opacity-80 blur-3xl"
                aria-hidden
              />
              <div className="relative overflow-hidden rounded-[22px] border border-sky-400/25">
                <p className="sr-only">{`Visuels vitrine (mêmes que le site) — ${SCHOOL} · LIRI`}</p>
                <ProrascienceHomeHeroCarousel
                  prefersReducedMotion={!!prefersReducedMotion}
                  onOpenVideo={openVitrineVideo}
                  easePremium={EASE_PREMIUM}
                />
              </div>
            </motion.div>

            <div>
              <div className="mb-2.5 flex items-center gap-2 pl-0.5">
                <div className="h-2 w-2 rounded-full bg-gradient-to-br from-sky-400 to-violet-500" />
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">Accès rapides</p>
              </div>
              <motion.div
                className="space-y-3.5"
                variants={stListV}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.15 }}
              >
                {ACTIONS.map((a) => (
                  <ActionCard key={a.to} itemVariants={itemV} {...a} />
                ))}
              </motion.div>
            </div>

            <LiriPageFooterLine marginClass="mt-0 pt-2" suffix={SCHOOL} />
          </div>
          <ProrascienceVitrineBottomTabBar />
        </div>
      </div>
    </EleveMobileShell>
  );
}
