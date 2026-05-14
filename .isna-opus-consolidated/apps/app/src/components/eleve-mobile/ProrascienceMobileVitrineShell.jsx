import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, Menu, UserCircle } from 'lucide-react';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { EleveImmersiveHalo } from '@/components/eleve-mobile/EleveImmersiveHalo';
import { ProrascienceVitrineBottomTabBar } from '@/components/eleve-mobile/ProrascienceVitrineBottomTabBar';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ProrascienceVitrineNavMenuContent } from '@/components/eleve-mobile/ProrascienceVitrineNavMenuContent';
import { getProrascienceVitrineMenuSections } from '@/lib/prorascienceVitrineMenu';
import { cn } from '@/lib/utils';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { getLiriMemberLoginPath } from '@/lib/liriVitrineModel';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { EV_BG } from '@/pages/eleve-mobile/eleveMobileScreensShared';

/** Même fond que l’accueil connexion LIRI (branding unifié). */
export const PRORASCIENCE_VITRINE_PAGE_BG = EV_BG;

const PREMIUM_EASE = [0.22, 1, 0.36, 1];

/**
 * Coque **immersive** Prorascience (LIRI) : halos + grain, header verre, menu, colonne de lecture centrée.
 * @param {{ title: string, children: import('react').ReactNode, showBack?: boolean, contentClassName?: string, lead?: string }} props
 */
export function ProrascienceMobileVitrineShell({ title, children, showBack = true, contentClassName, lead }) {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const loginPath = getLiriMemberLoginPath();
  const profileTo = user ? ELEVE_MOBILE.profile : loginPath;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuSections = useMemo(() => getProrascienceVitrineMenuSections(), []);

  return (
    <EleveMobileShell
      user={user}
      notificationCount={0}
      hideHeader
      hideTabBar
      contentClassName="!px-0 !bg-[#0B0B0F] !pb-0"
    >
      <div
        className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: PRORASCIENCE_VITRINE_PAGE_BG }}
      >
        <EleveImmersiveHalo base={PRORASCIENCE_VITRINE_PAGE_BG} />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background: [
              'radial-gradient(ellipse 100% 45% at 50% 0%, rgba(56, 189, 248, 0.14), transparent 55%)',
              'radial-gradient(ellipse 70% 40% at 0% 50%, rgba(59, 130, 246, 0.14), transparent 50%)',
              'radial-gradient(ellipse 60% 50% at 100% 60%, rgba(124, 58, 247, 0.12), transparent 52%)',
            ].join(',\n'),
            zIndex: 0,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-slate-900/20 via-transparent to-slate-950/80"
          aria-hidden
        />

        <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col">
          <div className="shrink-0 px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
            <LiriStatusBar />
          </div>

          <motion.header
            className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0B0B0F]/80 px-2 pb-3 pt-2 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(123,97,255,0.04)] backdrop-blur-xl sm:px-4"
            initial={reduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: PREMIUM_EASE }}
          >
            {/*
              Colonnes auto / 1fr / auto : la gauche prend la largeur réelle des boutons (sinis 1fr
              n’offrait pas assez de place et le texte central chevauchait le menu).
            */}
            <div className="mx-auto grid w-full max-w-lg grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 sm:gap-x-2">
              <div className="flex shrink-0 items-center justify-self-start gap-0.5 sm:gap-1">
                {showBack && (
                  <Link
                    to={ELEVE_MOBILE.prorascience}
                    className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] active:scale-95"
                    aria-label="Retour à l’accueil Prorascience"
                  >
                    <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-500/25 bg-sky-500/10 text-sky-100 shadow-[0_0_24px_-6px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] active:scale-95"
                  aria-label="Ouvrir le menu de navigation"
                >
                  <Menu className="h-5 w-5" strokeWidth={2} />
                </button>
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetContent
                    side="left"
                    className="w-[min(92vw,15.5rem)] border-white/10 bg-black p-0 pt-10 shadow-2xl shadow-black/50 backdrop-blur-sm sm:w-[15.5rem] sm:max-w-[15.5rem] [&>button]:text-white/85 [&>button]:hover:bg-white/10 [&>button]:hover:text-white"
                  >
                    <ProrascienceVitrineNavMenuContent menuSections={menuSections} onItemNavigate={() => setMenuOpen(false)} />
                  </SheetContent>
                </Sheet>
              </div>

              <div className="min-w-0 max-w-full justify-self-stretch self-center text-center [overflow-wrap:anywhere]">
                <h1
                  className="line-clamp-2 break-words font-serif text-[0.7rem] font-bold uppercase leading-tight tracking-[0.14em] text-sky-100/95 [text-wrap:balance] sm:text-xs sm:tracking-[0.16em]"
                  title={title}
                >
                  {title}
                </h1>
                {lead && (
                  <p
                    className="mt-0.5 line-clamp-2 w-full min-w-0 break-words text-[9px] font-medium leading-snug text-slate-500 [text-wrap:pretty] sm:line-clamp-3"
                    title={lead}
                  >
                    {lead}
                  </p>
                )}
                <p className="mt-0.5 text-[6px] font-semibold uppercase tracking-[0.2em] text-sky-400/50 sm:text-[7px]">
                  Immersion LIRI
                </p>
              </div>

              <div className="flex shrink-0 justify-self-end">
                <Link
                  to={profileTo}
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-400/30 bg-gradient-to-br from-sky-600/50 via-indigo-600/40 to-violet-700/50 text-white shadow-[0_0_28px_2px_rgba(99,102,241,0.45),inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-95"
                  aria-label={user ? 'Mon profil' : 'Connexion'}
                >
                  {user ? (
                    <span className="text-[11px] font-bold">{(user.email || 'U').slice(0, 1).toUpperCase()}</span>
                  ) : (
                    <UserCircle className="h-6 w-6 opacity-90" />
                  )}
                </Link>
              </div>
            </div>
            <motion.div
              className="mx-auto mt-2 h-px max-w-xs origin-center bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"
              initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.12, duration: reduceMotion ? 0 : 0.5, ease: PREMIUM_EASE }}
            />
          </motion.header>

          <motion.div
            key={title}
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pt-3',
              'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]',
              'max-w-lg mx-auto w-full',
              contentClassName,
            )}
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.52, ease: PREMIUM_EASE, delay: reduceMotion ? 0 : 0.04 }}
          >
            {children}
            <LiriPageFooterLine marginClass="mt-3 pt-1" suffix="Prorascience" className="px-0" />
          </motion.div>
          <ProrascienceVitrineBottomTabBar />
        </div>
      </div>
    </EleveMobileShell>
  );
}

/** Carte profondeur — bord sky (aligné coque mobile), verre sombre. */
export function ProrascienceVitrineImmersiveCard({ className, children, variant = 'default', ...rest }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4 shadow-lg',
        variant === 'sky' &&
          'border-sky-500/30 bg-gradient-to-b from-sky-950/30 to-slate-950/80 shadow-sky-900/15',
        variant === 'default' &&
          'border-sky-500/20 bg-gradient-to-b from-slate-900/90 to-slate-950/95 shadow-sky-900/5',
        variant === 'violet' &&
          'border-violet-500/25 bg-gradient-to-b from-violet-950/30 to-slate-950/90 shadow-violet-900/10',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function ProrascienceVitrineImmersiveProse({ className, children, ...rest }) {
  return (
    <p
      className={cn('text-[13px] font-normal leading-relaxed text-slate-300/95', className)}
      style={{ textWrap: 'pretty' }}
      {...rest}
    >
      {children}
    </p>
  );
}

export function ProrascienceVitrineMobileSectionTitle({ children, hint }) {
  return (
    <div className="mb-2.5 mt-5 first:mt-0">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-sky-400/90">{children}</h2>
      {hint && <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function ProrascienceVitrineMobileCard({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-sky-500/20 bg-slate-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
