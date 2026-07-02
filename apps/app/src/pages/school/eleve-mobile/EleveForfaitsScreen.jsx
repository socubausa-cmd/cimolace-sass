import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Crown, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { getPayerPath } from '@/lib/eleveBillingPath';
import { CANONICAL_CYCLE_KEYS, CYCLE_MARKETING_CONTENT, CYCLE_SELECTOR_LABELS } from '@/data/cycleInitiationProduct';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { EleveMobileShell, EleveSectionTitle, EleveEmptyState } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_MUTED, EV_R, EV_PAGE_AMBIENT } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';
import {
  BILLING_INTERVALS,
  ELEV_MODULES_PAGE_AMBIENT,
  formatInterval,
  formatPrice,
  forfaitCardSurface,
  PlanIntervalSegmented,
  toCycleKeyFromPlan,
  fetchActiveBillingPlans,
} from '@/pages/school/eleve-mobile/eleveModulesForfaitsShared';

const PAGE_AMBIENT = ELEV_MODULES_PAGE_AMBIENT ?? EV_PAGE_AMBIENT;

/**
 * Abonnement par cycle (mois / trimestre / année) — écran distinct du catalogue modules.
 * Route : /m/eleve/forfaits
 */
export default function EleveForfaitsScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const unreadInbox = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const [planInterval, setPlanInterval] = useState('monthly');
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPlansLoading(true);
      const data = await fetchActiveBillingPlans();
      if (alive) {
        setPlans(data);
        setPlansLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const planRows = useMemo(() => {
    return plans.map((p) => ({
      ...p,
      priceLabel: formatPrice(p.price_amount, p.price_currency),
      intervalLabel: formatInterval(p.interval_type),
      cycleKey: toCycleKeyFromPlan(p),
    }));
  }, [plans]);

  const planByCycleForInterval = useMemo(() => {
    const m = new Map();
    for (const p of planRows) {
      if (p.interval_type !== planInterval) continue;
      const k = p.cycleKey;
      if (!m.has(k)) m.set(k, p);
    }
    return m;
  }, [planRows, planInterval]);

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
              Forfaits & abonnement
            </h1>
            <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
              Cycles d'initiation : mois, trimestre, année
            </p>
            <Link
              to={ELEVE_MOBILE.modules}
              className="mt-2 inline-flex items-center text-[12px] font-semibold text-amber-300/90 underline-offset-2 hover:underline"
            >
              ← Catalogue des 21 modules
            </Link>
          </div>
        </div>

        <div className="px-4 pb-4">
          <p className="mb-1 text-[12px] font-medium" style={{ color: EV_MUTED }}>
            Chaque cycle d'initiation en trois rythmes de facturation : mois, trimestre, année.
          </p>
          <PlanIntervalSegmented value={planInterval} onChange={setPlanInterval} />
          <EleveSectionTitle className="!mb-3" dot>
            Offres d'abonnement — {BILLING_INTERVALS.find((x) => x.id === planInterval)?.label}
          </EleveSectionTitle>
          {plansLoading ? (
            <div className="flex items-center justify-center py-12 text-white/50">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          ) : planRows.length === 0 ? (
            <EleveEmptyState
              icon={CreditCard}
              title="Forfaits indisponibles"
              description="Les plans ne sont pas chargés depuis l'espace. Réessaie plus tard ou contacte l'équipe."
              className="py-4"
            />
          ) : (
            <ul className="space-y-3">
              {CANONICAL_CYCLE_KEYS.map((cycleKey) => {
                const p = planByCycleForInterval.get(cycleKey);
                const c = CYCLE_MARKETING_CONTENT[cycleKey];
                const label = CYCLE_SELECTOR_LABELS[cycleKey] || cycleKey;
                const img = c?.heroImage;
                return (
                  <li key={cycleKey}>
                    <div
                      className="overflow-hidden p-3.5"
                      style={{ borderRadius: EV_R.md, ...forfaitCardSurface() }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-amber-500/25 bg-black/30">
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-900/40 to-slate-950/90">
                              <Crown className="h-6 w-6 text-amber-400/90" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-amber-500/80">
                            {label}
                          </p>
                          {p ? (
                            <>
                              <p className="mt-0.5 line-clamp-2 text-[14px] font-bold leading-tight text-white">
                                {c?.headline || p.name}
                              </p>
                              <p className="mt-0.5 text-[11px] text-amber-200/70">{p.intervalLabel}</p>
                            </>
                          ) : (
                            <p className="mt-1 text-[12px] text-white/40">
                              Aucun tarif « {BILLING_INTERVALS.find((x) => x.id === planInterval)?.label} » pour ce
                              cycle.
                            </p>
                          )}
                        </div>
                        {p ? (
                          <div className="shrink-0 text-right">
                            <p className="text-[17px] font-extrabold tabular-nums text-white">{p.priceLabel}</p>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-white/40">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
                          <span className="truncate">Souscrire en ligne (cycle {label})</span>
                        </div>
                        {p ? (
                          <Link
                            to={getPayerPath(
                              `plan=${encodeURIComponent(p.slug || '')}&interval=${encodeURIComponent(
                                p.interval_type || 'monthly',
                              )}`,
                            )}
                            className="inline-flex h-9 min-h-[40px] shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-amber-500/90 to-amber-600/90 px-4 text-[12px] font-bold text-[#0b0b0a] shadow-md transition active:scale-[0.98]"
                          >
                            Choisir
                          </Link>
                        ) : (
                          <span className="text-[10px] font-medium text-white/30">—</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-center text-[11px] text-white/35">
            Détail des cycles sur{' '}
            <a href="/forfaits" className="text-amber-300/90 underline-offset-2 hover:underline">
              prorascience.org/forfaits
            </a>
          </p>
        </div>
      </div>
    </EleveMobileShell>
  );
}
