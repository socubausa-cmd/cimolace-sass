import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Loader2,
  Lock,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useBilling } from '@/contexts/BillingContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { EleveMobileShell, EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_MUTED, EV_R, EV_PAGE_AMBIENT } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';
import {
  CYCLE_FILTERS,
  ELEV_MODULES_PAGE_AMBIENT,
  findFormationForModule,
  MODULE_ICONS,
  moduleCatalogSurface,
  PRORASCIENCE_MODULES,
  fetchPublishedFormationsForModules,
} from '@/pages/school/eleve-mobile/eleveModulesForfaitsShared';
import { cn } from '@/lib/utils';

const PAGE_AMBIENT = ELEV_MODULES_PAGE_AMBIENT ?? EV_PAGE_AMBIENT;

/**
 * Catalogue des 21 modules (sans onglet Forfaits).
 * Route : /m/eleve/modules
 */
export default function EleveModulesScreen() {
  const { user } = useAuth();
  const { status: billingStatus, inGrace } = useBilling();
  const { notifications: sync } = useDataSync();
  const unreadInbox = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const [cycleFilter, setCycleFilter] = useState('all');
  const [formations, setFormations] = useState([]);
  const [formationsLoading, setFormationsLoading] = useState(true);

  const hasSubscriptionAccess =
    billingStatus === 'active' || (billingStatus === 'past_due' && inGrace);

  useEffect(() => {
    let alive = true;
    (async () => {
      setFormationsLoading(true);
      const rows = await fetchPublishedFormationsForModules();
      if (alive) {
        setFormations(rows);
        setFormationsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const moduleRows = useMemo(() => {
    return PRORASCIENCE_MODULES.map((mod) => {
      const formation = findFormationForModule(formations, mod);
      const exists = Boolean(formation);
      // Accès réel : un cours payant sans abonnement actif n'est PAS "ouvert".
      // Si l'info de prix est inconnue, on reste fail-open (cohérent avec la fiche).
      const locked = exists && formation?.isPaid === true && !hasSubscriptionAccess;
      return {
        ...mod,
        formation,
        // `available` = il existe un cours rattaché (navigable vers la fiche)
        available: exists,
        // `accessState` = ce qu'on AFFICHE réellement
        accessState: !exists ? 'soon' : locked ? 'locked' : 'open',
      };
    });
  }, [formations, hasSubscriptionAccess]);

  const displayedModules = useMemo(() => {
    if (cycleFilter === 'all') return moduleRows;
    const cycle = CYCLE_FILTERS.find((c) => c.id === cycleFilter);
    return moduleRows.filter((m) => cycle?.modules?.includes(m.number));
  }, [cycleFilter, moduleRows]);

  // "Ouverts" = modules réellement accessibles (pas seulement existants).
  const availableCount = moduleRows.filter((m) => m.accessState === 'open').length;

  return (
    <EleveMobileShell user={user} notificationCount={unreadInbox} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: '#0b0b0a',
          backgroundImage: PAGE_AMBIENT,
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-2 pt-0.5">
          <div className="mb-1 min-w-0">
            <LiriWordmark size="kicker" className="text-white/40" />
            <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">
              21 modules Prorascience
            </h1>
            <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
              Catalogue mobile natif et coaching privé
            </p>
            <Link
              to={ELEVE_MOBILE.forfaits}
              className="mt-2 inline-flex items-center text-[12px] font-semibold text-amber-300/90 underline-offset-2 hover:underline"
            >
              Forfaits & abonnement →
            </Link>
          </div>
        </div>

        <div className="px-4 pb-4">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 90% 75% at 0% 0%, rgba(212,175,55,0.12), transparent 55%), linear-gradient(188deg, rgba(18,15,11,0.94), rgba(11,9,8,0.98))',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[var(--school-accent)]">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Prorascience
                </div>
                <h2 className="mt-3 text-[22px] font-extrabold leading-[1.08] tracking-[-0.04em] text-white">
                  Modules initiatiques
                  <span className="block text-[var(--school-accent)]">en coaching privé</span>
                </h2>
                <p className="mt-2 max-w-[260px] text-[12.5px] leading-relaxed text-white/45">
                  Une progression mobile, cycle par cycle, pour choisir ton module et entrer dans le parcours.
                </p>
              </div>
              <div className="flex h-[74px] w-[74px] shrink-0 flex-col items-center justify-center rounded-3xl border border-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-center shadow-[0_12px_26px_-18px_rgba(212,175,55,0.9)]">
                <span className="text-[26px] font-black leading-none text-[var(--school-accent)]">21</span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">modules</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/8 bg-black/20 px-2 py-2 text-center">
                <p className="text-[15px] font-extrabold text-white">4</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/35">cycles</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 px-2 py-2 text-center">
                <p className="text-[15px] font-extrabold text-[var(--school-accent)]">1</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/35">mois</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 px-2 py-2 text-center">
                <p className="text-[15px] font-extrabold text-emerald-300">
                  {formationsLoading ? '...' : availableCount}
                </p>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/35">ouverts</p>
              </div>
            </div>
          </motion.section>

          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CYCLE_FILTERS.map((cycle) => {
              const active = cycleFilter === cycle.id;
              return (
                <button
                  key={cycle.id}
                  type="button"
                  onClick={() => setCycleFilter(cycle.id)}
                  className={cn(
                    'shrink-0 rounded-2xl border px-3 py-2 text-[11px] font-semibold transition',
                    active
                      ? 'border-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] bg-[var(--school-accent)] text-black shadow-[0_10px_22px_-14px_rgba(212,175,55,0.9)]'
                      : 'border-white/10 bg-white/[0.04] text-white/50',
                  )}
                >
                  <span className="mr-1 opacity-70">{cycle.short}</span>
                  <span>{cycle.id === 'all' ? 'Modules' : cycle.label}</span>
                </button>
              );
            })}
          </div>

          <EleveSectionTitle className="!mb-3" dot>
            Catalogue des modules
          </EleveSectionTitle>
          {formationsLoading ? (
            <div className="flex items-center justify-center py-12 text-white/50">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          ) : (
            <ul className="space-y-3">
              {displayedModules.map((mod, i) => {
                const Icon = MODULE_ICONS[mod.number - 1] || BookOpen;
                const isOpen = mod.accessState === 'open';
                const isLocked = mod.accessState === 'locked';
                // Un module rattaché à un cours reste navigable (vers la fiche),
                // qu'il soit ouvert ou premium ; seul "à venir" ne l'est pas.
                const navigable = mod.available;
                const to = mod.formation?.id
                  ? ELEVE_MOBILE.course(mod.formation.id)
                  : ELEVE_MOBILE.forfaits;
                const content = (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.025 * i }}
                    className={cn('overflow-hidden p-3.5', !navigable && 'opacity-58')}
                    style={{ borderRadius: EV_R.md, ...moduleCatalogSurface(navigable) }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]">
                        <Icon className="h-5 w-5 text-[var(--school-accent)]" strokeWidth={1.9} />
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--school-accent)] px-1 text-[9px] font-black text-black">
                          {mod.number}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-[14px] font-extrabold leading-tight text-white">
                              {mod.title}
                            </p>
                            <p className="mt-0.5 text-[11.5px] font-semibold text-[color-mix(in_srgb,var(--school-accent)_85%,transparent)]">
                              {mod.subtitle}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]',
                              isOpen
                                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                                : isLocked
                                  ? 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]'
                                  : 'border-white/10 bg-white/[0.04] text-white/35',
                            )}
                          >
                            {isLocked ? <Lock className="h-2.5 w-2.5" /> : null}
                            {isOpen ? 'Ouvert' : isLocked ? 'Premium' : 'À venir'}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-white/45">
                          {mod.formation?.description || mod.description}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 text-[10.5px] text-white/35">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" /> 1 mois
                            </span>
                            <span className="flex items-center gap-1">
                              <UserCheck className="h-3.5 w-3.5" /> Privé
                            </span>
                          </div>
                          <span
                            className={cn(
                              'inline-flex items-center text-[12px] font-semibold',
                              navigable ? 'text-[var(--school-accent)]' : 'text-white/30',
                            )}
                          >
                            {isOpen ? 'Ouvrir' : isLocked ? 'Débloquer' : 'Bientôt'}
                            <ChevronRight className="ml-0.5 h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
                return (
                  <li key={mod.number}>
                    {navigable ? <Link to={to} className="block">{content}</Link> : content}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-center text-[11px] text-white/35">
            Besoin du parcours complet ?{' '}
            <Link to="/appointment/request" className="text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)] underline-offset-2 hover:underline">
              Parler à un conseiller
            </Link>
            {' · '}
            <Link to={ELEVE_MOBILE.forfaits} className="text-amber-300/90 underline-offset-2 hover:underline">
              Voir les forfaits
            </Link>
          </p>
        </div>
      </div>
    </EleveMobileShell>
  );
}
