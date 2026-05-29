import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  ChevronRight,
  History,
  Loader2,
  Mail,
  Monitor,
  PlayCircle,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ProrascienceMobileVitrineShell,
  ProrascienceVitrineImmersiveCard,
  ProrascienceVitrineImmersiveProse,
  ProrascienceVitrineMobileSectionTitle,
} from '@/components/eleve-mobile/ProrascienceMobileVitrineShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { getPayerPath } from '@/lib/eleveBillingPath';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_MUTED } from '@/pages/eleve-mobile/eleveMobileScreensShared';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';
import { getWebContact } from '@/data/prorascienceVitrineFromWebContent';
import {
  FORMATION_CATALOG_MODULES,
  FORMATION_CATALOG_MODULE_ICONS,
} from '@/pages/FormationCatalogPage';
import {
  CANONICAL_CYCLE_KEYS,
  CYCLE_MARKETING_CONTENT,
  CYCLE_SELECTOR_LABELS,
  INITIATION_GENERAL_FAQ,
} from '@/data/cycleInitiationProduct';
import {
  VITRINE_ISNA_PRO,
  WEB_COACHING,
  WEB_COACHING_VS_MENTORAT,
  WEB_COMMUNAUTE,
  WEB_FONDATEUR,
  WEB_ISNA_PRO,
  WEB_MENTORAT,
  WEB_TEAM,
} from '@/data/prorascienceVitrineFromWebContent';
import { VitrineAboutFromWebView } from '@/pages/eleve-mobile/vitrine/VitrineAboutFromWebView';

/** Piliers pédagogiques (21 sciences) — même regroupement que le portail « Les 21 sciences ». */
const FORMATION_CATALOG_CYCLE_FILTERS = [
  { id: 'all', label: 'Tous', test: () => true },
  { id: 'c1', label: 'Fondements', test: (n) => [1, 2, 3, 5].includes(n) },
  { id: 'c2', label: 'Sc. invisibles', test: (n) => [6, 7, 8, 9].includes(n) },
  { id: 'c3', label: 'Maîtrise', test: (n) => [10, 11, 12, 13, 14, 15, 18, 19, 20].includes(n) },
  { id: 'c4', label: 'Haute init.', test: (n) => [4, 16, 17, 21].includes(n) },
];

const VITRINE_MODULE_THUMB_PRESETS = [
  { g: 'from-violet-500/45 to-slate-950/75', b: 'border-violet-500/35', i: 'text-violet-100' },
  { g: 'from-sky-500/45 to-slate-950/75', b: 'border-sky-500/35', i: 'text-sky-100' },
  { g: 'from-emerald-500/40 to-slate-950/75', b: 'border-emerald-500/30', i: 'text-emerald-100' },
  { g: 'from-sky-500/45 to-slate-950/75', b: 'border-sky-500/35', i: 'text-sky-100' },
  { g: 'from-rose-500/40 to-slate-950/75', b: 'border-rose-500/30', i: 'text-rose-100' },
  { g: 'from-indigo-500/45 to-slate-950/75', b: 'border-indigo-500/35', i: 'text-indigo-100' },
  { g: 'from-fuchsia-500/40 to-slate-950/75', b: 'border-fuchsia-500/30', i: 'text-fuchsia-100' },
];

function vitrineModuleSearchHaystack(m) {
  return [m.title, m.subtitle, m.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function VitrineModuleThumbBox({ mod, icon: Icon, preset: th }) {
  const [imgErr, setImgErr] = useState(false);
  const src = mod.thumbnail;
  const showImg = Boolean(src) && !imgErr;
  return (
    <div
      className={cn(
        'relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-br shadow-inner',
        !showImg && th.b,
        !showImg && th.g,
      )}
    >
      {showImg ? (
        <>
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" aria-hidden />
        </>
      ) : (
        <Icon className={cn('relative z-[1] h-6 w-6', th.i)} strokeWidth={1.6} />
      )}
      <span className="absolute bottom-0.5 right-0.5 z-[2] rounded bg-black/55 px-1 text-[8px] font-mono font-bold text-white/95">
        {mod.number.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

// —— Forfaits (données live + cycles marketing) ——
const INTERVAL_ORDER = ['monthly', 'quarterly', 'yearly'];
const fallbackPlans = [
  { slug: 'academique-monthly', interval_type: 'monthly', price_amount: 15000, price_currency: 'XAF' },
  { slug: 'academique-quarterly', interval_type: 'quarterly', price_amount: 40000, price_currency: 'XAF' },
  { slug: 'academique-yearly', interval_type: 'yearly', price_amount: 150000, price_currency: 'XAF' },
];
const toCycleKey = (plan) => {
  const slug = String(plan?.slug || '').toLowerCase().trim();
  const fromSlug = slug.replace(/-(monthly|quarterly|yearly|mensuel|trimestriel|annuel)$/i, '').replace(/[^a-z0-9-]/g, '');
  return fromSlug || 'academique';
};
const formatPrice = (amount, currency) => {
  const n = Number(amount || 0);
  const c = String(currency || 'XAF').toUpperCase();
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} ${c}`;
  }
};
const formatInterval = (t) => {
  const v = String(t || '').toLowerCase();
  if (v === 'monthly') return 'Mensuel';
  if (v === 'quarterly') return 'Trimestriel';
  if (v === 'yearly') return 'Annuel';
  return v;
};

const INTERVAL_LABELS_SHORT = { monthly: 'Mois', quarterly: 'Trimestre', yearly: 'Année' };

/** Icône Lucide par mot-clé (lignes « includes » des cycles). */
function VitrineForfaitIncludeIcon({ label, index = 0 }) {
  const x = String(label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  let Comp = CheckCircle;
  if (/replay|repl|redif/.test(x)) Comp = History;
  else if (/cours|preenreg|video/.test(x)) Comp = PlayCircle;
  else if (/smart|board|interactif|tableau|ecran/.test(x)) Comp = Monitor;
  else if (
    /progression|libre|cadence|tout le|cohorte|mentor|prive|privileg|accompagn|diagnostic|calendrier|immersion|groupe/.test(x)
  )
    Comp = Sparkles;
  else {
    const fallbacks = [PlayCircle, Monitor, History, Sparkles];
    Comp = fallbacks[index % 4];
  }
  return <Comp className="h-4 w-4 shrink-0 text-sky-400/95" strokeWidth={2} aria-hidden />;
}

function VitrineForfaitCyclePremiumCard({ children, className }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-sky-500/35 bg-slate-950/90 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.09)]',
        'ring-1 ring-sky-500/20',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(56,189,248,0.14),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-500/12 blur-3xl"
        aria-hidden
      />
      <div className="h-0.5 w-full bg-gradient-to-r from-sky-600/80 via-sky-400/50 to-sky-700/30" aria-hidden />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

export function VitrineForfaitsMobileScreen() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cycleKey, setCycleKey] = useState(CANONICAL_CYCLE_KEYS[0]);
  const [interval, setInterval] = useState('monthly');
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('billing_plans')
        .select('id,slug,name,interval_type,price_amount,price_currency,active')
        .eq('active', true)
        .order('price_amount', { ascending: true });
      if (!alive) return;
      if (error || !Array.isArray(data) || data.length === 0) setPlans(fallbackPlans);
      else setPlans(data.filter((p) => !String(p?.slug || '').toLowerCase().startsWith('ngowazulu-')));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);
  const pricesByCycle = useMemo(() => {
    const m = new Map();
    for (const p of plans) {
      const it = String(p.interval_type || '').toLowerCase();
      if (!INTERVAL_ORDER.includes(it)) continue;
      const key = toCycleKey(p);
      if (!m.has(key)) m.set(key, {});
      m.get(key)[it] = p;
    }
    return m;
  }, [plans]);

  const c = CYCLE_MARKETING_CONTENT[cycleKey];
  const row = pricesByCycle.get(cycleKey) || {};
  const selectedPlan = row[interval] || null;

  return (
    <ProrascienceMobileVitrineShell
      title="Forfaits & tarifs"
      lead="Choisis un cycle, puis un rythme de facturation — un tarif par écran"
    >
      <div className="mb-3 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-950/20 via-slate-950/50 to-slate-950/90 p-4 shadow-inner">
        <p className="text-center font-serif text-base font-bold tracking-wide text-sky-50/95 sm:text-lg">
          Cycles d'initiation
        </p>
        <p
          className="mt-2.5 text-center text-[12.5px] font-medium leading-[1.6] text-slate-300/95 [text-rendering:optimizeLegibility] sm:text-[13px]"
          style={{ textWrap: 'balance' }}
        >
          Même offre que le portail forfaits — présentation dans l'immersion LIRI.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400/80" />
        </div>
      )}

      {!loading && (
        <>
          <div className="mb-3 space-y-3">
            <div>
              <p className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-sky-500/80">Cycle</p>
              <div
                className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Choisir le cycle d'initiation"
              >
                {CANONICAL_CYCLE_KEYS.map((k) => {
                  const on = cycleKey === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setCycleKey(k)}
                      className={cn(
                        'shrink-0 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                        on
                          ? 'border-sky-400/55 bg-sky-500/18 text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.28)]'
                          : 'border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/18 hover:text-slate-200',
                      )}
                    >
                      <span className="block text-[12px] font-bold leading-tight">
                        {CYCLE_SELECTOR_LABELS[k]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-sky-500/80">
                Mode de paiement
              </p>
              <div
                className="flex rounded-[14px] border border-sky-500/20 p-1"
                style={{
                  background: 'linear-gradient(180deg, rgba(26, 22, 16, 0.9) 0%, rgba(8, 8, 12, 0.95) 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 12px -4px rgba(0,0,0,0.4)',
                }}
                role="tablist"
                aria-label="Rythme de facturation"
              >
                {INTERVAL_ORDER.map((it) => {
                  const on = interval === it;
                  return (
                    <button
                      key={it}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setInterval(it)}
                      className={cn(
                        'flex-1 rounded-[10px] py-2.5 text-center text-[11px] font-bold transition-all duration-200',
                        on ? 'text-white' : 'text-white/40',
                      )}
                      style={
                        on
                          ? {
                              background: 'linear-gradient(180deg, #0ea5e9 0%, #2563eb 100%)',
                              boxShadow:
                                '0 0 0 1px rgba(255,255,255,0.2), 0 4px 14px -4px rgba(14, 165, 233, 0.5)',
                            }
                          : undefined
                      }
                    >
                      {INTERVAL_LABELS_SHORT[it] || formatInterval(it)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {c && (
            <VitrineForfaitCyclePremiumCard>
              <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-sky-400/95">
                  {c.tierBadge}
                </p>
                <h2 className="mt-2.5 font-serif text-xl font-bold leading-[1.2] tracking-tight text-white sm:text-2xl">
                  {c.headline}
                </h2>
                {c.tagline ? (
                  <p className="mt-2 text-[11px] font-semibold leading-snug text-sky-200/85 sm:text-xs">{c.tagline}</p>
                ) : null}
                <p
                  className="mt-3 text-[13px] font-medium leading-[1.7] text-slate-200/95 antialiased [text-rendering:optimizeLegibility] sm:text-[14px] sm:leading-[1.65]"
                  style={{ textWrap: 'pretty' }}
                >
                  {c.pitch}
                </p>

                <p className="mb-2 mt-5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-400/90">
                  Inclus
                </p>
                <ul className="space-y-0" role="list" aria-label="Avantages du cycle">
                  {(c.includes || []).slice(0, 4).map((x, i) => (
                    <li
                      key={x}
                      className="flex items-start gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0 first:pt-0"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                        <VitrineForfaitIncludeIcon label={x} index={i} />
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5 text-[13px] font-medium leading-[1.55] text-slate-100/95 sm:text-[13.5px] sm:leading-[1.5]">
                        {x}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-2xl border border-sky-500/25 bg-gradient-to-b from-sky-950/30 to-slate-950/80 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
                  {selectedPlan ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-500/90">
                            Tarif {formatInterval(interval)}
                          </p>
                          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-sky-50 sm:text-4xl">
                            {formatPrice(selectedPlan.price_amount, selectedPlan.price_currency)}
                          </p>
                        </div>
                        <Link
                          to={getPayerPath(
                            `plan=${encodeURIComponent(selectedPlan.slug || '')}&interval=${encodeURIComponent(
                              selectedPlan.interval_type || 'monthly',
                            )}`,
                          )}
                          className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-indigo-600 px-5 text-[13px] font-extrabold text-white shadow-[0_4px_24px_-4px_rgba(14,165,233,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:brightness-105 active:scale-[0.98] sm:px-6"
                        >
                          Choisir ce forfait
                        </Link>
                      </div>
                      <p className="text-[10px] leading-relaxed text-slate-400/95 sm:text-[11px]">
                        Souscription en ligne (LIRI) — {CYCLE_SELECTOR_LABELS[cycleKey]},{' '}
                        {formatInterval(interval).toLowerCase()}.
                      </p>
                    </div>
                  ) : (
                    <p className="text-center text-[12px] font-medium leading-relaxed text-slate-500 [text-wrap:pretty] sm:text-[13px]">
                      Aucun tarif actif pour {CYCLE_SELECTOR_LABELS[cycleKey]} en {formatInterval(interval).toLowerCase()}
                      . Essaie un autre rythme ou un autre cycle, ou contacte le secrétariat.
                    </p>
                  )}
                </div>
              </div>
            </VitrineForfaitCyclePremiumCard>
          )}
        </>
      )}
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineFormationsMobileScreen() {
  const [q, setQ] = useState('');
  const [cycleId, setCycleId] = useState('all');
  const [detail, setDetail] = useState(null);

  const filtered = useMemo(() => {
    const f = FORMATION_CATALOG_CYCLE_FILTERS.find((c) => c.id === cycleId) || FORMATION_CATALOG_CYCLE_FILTERS[0];
    const qn = q.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    return FORMATION_CATALOG_MODULES.filter((m) => {
      if (!f.test(m.number)) return false;
      if (!qn) return true;
      return vitrineModuleSearchHaystack(m).includes(qn);
    });
  }, [q, cycleId]);

  return (
    <ProrascienceMobileVitrineShell title="Formations" lead="Les 21 modules — catalogue structuré">
      <p className="mb-2 text-center text-[12px]" style={{ color: EV_MUTED }}>
        {FORMATION_CATALOG_MODULES.length} piliers — liste filtrable, alignée sur le catalogue public.
      </p>

      <div className="mb-3 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un module…"
            className="h-11 border-white/10 bg-slate-950/80 pl-9 pr-9 text-[13px] text-white placeholder:text-slate-500"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div
          className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filtrer par pilier pédagogique"
        >
          {FORMATION_CATALOG_CYCLE_FILTERS.map((c) => {
            const active = cycleId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCycleId(c.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                  active
                    ? 'border-sky-400/50 bg-sky-500/15 text-sky-100'
                    : 'border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/20 hover:text-slate-200',
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-slate-500">Aucun module ne correspond à ta recherche.</p>
      ) : (
        <ul className="space-y-2" aria-label="Liste des modules">
          {filtered.map((m) => {
            const idx = m.number - 1;
            const Icon = FORMATION_CATALOG_MODULE_ICONS[idx] || FORMATION_CATALOG_MODULE_ICONS[0];
            const th = VITRINE_MODULE_THUMB_PRESETS[idx % VITRINE_MODULE_THUMB_PRESETS.length];
            return (
              <li key={m.number}>
                <ProrascienceVitrineImmersiveCard variant="violet" className="!p-0">
                  <button
                    type="button"
                    onClick={() => setDetail(m)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-white/[0.04]"
                  >
                    <VitrineModuleThumbBox mod={m} icon={Icon} preset={th} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white">{m.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-violet-200/70">{m.subtitle}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-violet-400/50" aria-hidden />
                  </button>
                </ProrascienceVitrineImmersiveCard>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={detail != null} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent
          side="bottom"
          className={cn(
            'flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden gap-0 rounded-none border-0 p-0',
            'bg-[#05080f] shadow-none',
            /* Fiche produit plein écran : le panneau occupe tout l'écran, plus de bande noire “vide” au-dessus */
            '[&>button]:right-3 [&>button]:top-[max(0.6rem,env(safe-area-inset-top,0.6rem))] [&>button]:z-[60] [&>button]:rounded-full [&>button]:border [&>button]:border-white/15 [&>button]:bg-black/40 [&>button]:p-2 [&>button]:backdrop-blur-sm [&>button]:hover:bg-black/60',
          )}
        >
          {detail ? (
            <div className="flex h-full min-h-0 w-full flex-col">
              {detail.thumbnail ? (
                <div className="relative w-full shrink-0 [height:min(42vh,320px)] min-h-[200px]">
                  <img src={detail.thumbnail} alt="" className="h-full w-full object-cover" />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-[#05080f] via-[#05080f]/55 to-black/30"
                    aria-hidden
                  />
                  <div className="absolute left-0 right-0 top-0 flex items-start justify-between gap-2 pt-[max(0.5rem,env(safe-area-inset-top,0.5rem))] pl-3 pr-14">
                    <div className="mt-0.5 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 backdrop-blur-md">
                      <Sparkles className="h-3 w-3 text-sky-300/95" strokeWidth={2} aria-hidden />
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/90">Prorascience</span>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 space-y-1 px-4 pb-4 text-left">
                    <p className="font-mono text-[10px] font-bold text-sky-200/90">
                      MODULE {detail.number.toString().padStart(2, '0')}
                    </p>
                    <SheetTitle className="font-serif text-2xl font-bold leading-tight text-white [text-wrap:balance]">
                      {detail.title}
                    </SheetTitle>
                    <p className="text-[14px] font-medium leading-snug text-sky-100/90">{detail.subtitle}</p>
                  </div>
                </div>
              ) : (
                <div
                  className="relative w-full shrink-0 border-b border-white/10 bg-gradient-to-b from-[#121a2e] to-[#05080f] px-4 pb-5 pr-14 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))]"
                >
                  <div className="mb-3 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-sky-400/90" strokeWidth={2} />
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-sky-200/85">Catalogue Prorascience</p>
                  </div>
                  <p className="font-mono text-[10px] font-bold text-violet-300/90">MODULE {detail.number.toString().padStart(2, '0')}</p>
                  <SheetTitle className="mt-1 font-serif text-2xl font-bold leading-tight text-white [text-wrap:balance]">
                    {detail.title}
                  </SheetTitle>
                  <p className="mt-1.5 text-[14px] font-medium text-sky-200/90">{detail.subtitle}</p>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
                <div className="mx-auto w-full max-w-md px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,1rem))] pt-4">
                  {detail.thumbnail ? (
                    <p className="mb-3 text-left text-[11px] text-slate-500">Contenu issu du catalogue public des 21 sciences.</p>
                  ) : null}
                  <div
                    className="rounded-2xl border border-sky-500/20 bg-slate-950/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    style={{ textWrap: 'pretty' }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">À retenir</p>
                    <p className="mt-2 text-[14px] leading-[1.65] text-slate-200/95">{detail.description}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineIsnaProMobileScreen() {
  return (
    <ProrascienceMobileVitrineShell title="ISNA Pro" lead="Pédagogie, LIRI, immersion">
      <div className="mb-3 flex justify-center">
        <div className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200/90">
          Expérience pro
        </div>
      </div>
      <div className="space-y-3">
        {VITRINE_ISNA_PRO.pillars.map((x) => (
          <ProrascienceVitrineImmersiveCard key={x.t} variant="sky">
            <h3 className="font-serif text-base font-bold text-sky-50/95">{x.t}</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
              {x.b}
            </p>
          </ProrascienceVitrineImmersiveCard>
        ))}
      </div>
      <ProrascienceVitrineMobileSectionTitle>Demain, déjà en ligne</ProrascienceVitrineMobileSectionTitle>
      <div className="mt-2 space-y-2.5">
        {VITRINE_ISNA_PRO.future.map((x) => (
          <ProrascienceVitrineImmersiveCard key={x.t} variant="violet" className="!py-3">
            <p className="text-[13px] font-semibold text-violet-100/95">{x.t}</p>
            <p className="mt-1 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
              {x.d}
            </p>
          </ProrascienceVitrineImmersiveCard>
        ))}
      </div>
      <ProrascienceVitrineMobileSectionTitle>Maîtrises</ProrascienceVitrineMobileSectionTitle>
      <ul className="mt-1 space-y-1.5 text-[12px] text-slate-300/90">
        {VITRINE_ISNA_PRO.mastery.map((x) => (
          <li key={x} className="flex gap-2">
            <span className="text-sky-400/90">·</span>
            {x}
          </li>
        ))}
      </ul>
      <ProrascienceVitrineMobileSectionTitle hint="Lecture alignée site">Témoignages</ProrascienceVitrineMobileSectionTitle>
      <div className="mt-2 space-y-2.5">
        {WEB_ISNA_PRO.voices.map((v) => (
          <ProrascienceVitrineImmersiveCard key={v.name} variant="default" className="!py-3">
            <p className="text-[12px] font-semibold text-white">« {v.quote} »</p>
            <p className="mt-1.5 text-[10px] text-slate-500">
              {v.name} — {v.role}
            </p>
          </ProrascienceVitrineImmersiveCard>
        ))}
      </div>
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineAboutMobileScreen() {
  return (
    <ProrascienceMobileVitrineShell title="À propos" lead="Contenu aligné sur la page web institutionnelle">
      <VitrineAboutFromWebView />
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineMentoratMobileScreen() {
  const m = WEB_MENTORAT;
  const h = m.hero;
  return (
    <ProrascienceMobileVitrineShell title="Mentorat" lead={h.lead}>
      <div className="mb-2 flex flex-col items-center gap-1">
        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300/90">
          {h.kicker}
        </span>
        <h2 className="text-center font-serif text-lg font-bold text-white">{h.title}</h2>
        <p className="text-center text-[11px] text-sky-200/80">{h.also}</p>
        <p className="text-center text-[9px] text-slate-500">{h.line}</p>
      </div>
      <ProrascienceVitrineImmersiveProse className="mb-3 text-center text-[12px]">{m.preambleObjective}</ProrascienceVitrineImmersiveProse>
      <ProrascienceVitrineImmersiveCard variant="violet" className="!border-red-500/20">
        <ProrascienceVitrineImmersiveProse className="!text-slate-300/90">{m.distinction}</ProrascienceVitrineImmersiveProse>
      </ProrascienceVitrineImmersiveCard>
      <ProrascienceVitrineMobileSectionTitle>Le moniteur</ProrascienceVitrineMobileSectionTitle>
      <p className="mb-1 text-[11px] text-slate-500">{m.defineIntro}</p>
      <ul className="mb-3 space-y-2">
        {m.defineBullets.map((x) => (
          <li key={x} className="flex gap-2 text-[12px] leading-relaxed text-slate-300/95">
            <span className="shrink-0 text-red-400/80">▸</span>
            {x}
          </li>
        ))}
      </ul>
      <ProrascienceVitrineMobileSectionTitle hint="Cas fréquents">{m.whenTitle}</ProrascienceVitrineMobileSectionTitle>
      <p className="mb-1 text-[11px] text-slate-500">{m.whenIntro}</p>
      <ul className="mb-3 space-y-1.5 text-[12px] text-slate-300/90">
        {m.whenCases.map((x) => (
          <li key={x} className="flex gap-1.5">
            <span className="text-sky-500/80">·</span>
            {x}
          </li>
        ))}
      </ul>
      <p className="mb-1 text-[11px] font-semibold text-white">Formes de mentorat</p>
      <div className="mb-3 space-y-2">
        {m.typesMentorat.map((t) => (
          <ProrascienceVitrineImmersiveCard key={t.title} className="!py-2.5">
            <p className="text-[12px] font-bold text-sky-100/90">{t.title}</p>
            <p className="text-[11px] text-slate-400">{t.desc}</p>
          </ProrascienceVitrineImmersiveCard>
        ))}
      </div>
      <p className="mb-1 text-[11px] font-semibold text-white">Éléments contractuels (référence)</p>
      <ol className="list-decimal space-y-1 pl-4 text-[11px] text-slate-400">
        {m.contractNumbered.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ol>
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineCoachingMobileScreen() {
  const c = WEB_COACHING;
  return (
    <ProrascienceMobileVitrineShell title="Coaching" lead={c.lead}>
      <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-widest text-sky-500/80">{c.kicker}</p>
      <h2 className="text-center font-serif text-xl font-bold text-white">{c.title}</h2>
      <p className="mb-2 text-center text-[9px] text-slate-500">{c.line}</p>
      <p className="mb-1 text-[11px] text-slate-500">{c.metierIntro}</p>
      <ul className="mb-3 space-y-1.5 text-[12px] text-slate-300/90">
        {c.metierItems.map((x) => (
          <li key={x} className="flex gap-1.5">
            <span className="text-sky-500/80">·</span>
            {x}
          </li>
        ))}
      </ul>
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineCoachingVsMentoratMobileScreen() {
  const v = WEB_COACHING_VS_MENTORAT;
  return (
    <ProrascienceMobileVitrineShell title="Coaching vs mentorat" lead="Contenu long aligné sur la page web">
      {v.intro.map((p) => (
        <ProrascienceVitrineImmersiveProse key={p.slice(0, 40)} className="mb-3 !text-[12px] leading-relaxed">
          {p}
        </ProrascienceVitrineImmersiveProse>
      ))}
      <ProrascienceVitrineMobileSectionTitle>Coaching</ProrascienceVitrineMobileSectionTitle>
      <ProrascienceVitrineImmersiveCard variant="sky" className="mb-4">
        <p className="text-[12px] font-bold text-sky-100/90">{v.partCoaching.title}</p>
        {v.partCoaching.paras.map((p) => (
          <ProrascienceVitrineImmersiveProse key={p.slice(0, 48)} className="!mt-2 !text-[12px] leading-relaxed">
            {p}
          </ProrascienceVitrineImmersiveProse>
        ))}
      </ProrascienceVitrineImmersiveCard>
      <ProrascienceVitrineMobileSectionTitle>Mentorat</ProrascienceVitrineMobileSectionTitle>
      <ProrascienceVitrineImmersiveCard variant="violet">
        <p className="text-[12px] font-bold text-violet-100/90">{v.partMentorat.title}</p>
        {v.partMentorat.paras.map((p) => (
          <ProrascienceVitrineImmersiveProse key={p.slice(0, 48)} className="!mt-2 !text-[12px] leading-relaxed">
            {p}
          </ProrascienceVitrineImmersiveProse>
        ))}
      </ProrascienceVitrineImmersiveCard>
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineFondateurMobileScreen() {
  const f = WEB_FONDATEUR;
  const h = f.hero;
  return (
    <ProrascienceMobileVitrineShell title="Le fondateur" lead={h.subtitle}>
      <div className="mb-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500/80">{h.kicker}</p>
        <h2 className="whitespace-pre-line font-serif text-lg font-bold leading-tight text-white">{h.title}</h2>
        <p className="mt-2 text-[12px] italic text-slate-300/90">« {h.quote} »</p>
      </div>
      <ProrascienceVitrineImmersiveCard className="mb-2">
        <p className="text-[10px] text-slate-500">{f.portraitCaption}</p>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
          {f.portraitContext}
        </p>
      </ProrascienceVitrineImmersiveCard>
      <div className="space-y-2.5">
        {f.identity.map((row) => (
          <ProrascienceVitrineImmersiveCard key={row.title} variant="sky" className="!py-2.5">
            <p className="text-[10px] font-bold uppercase text-sky-500/70">{row.title}</p>
            <p className="text-[14px] font-semibold text-white">{row.value}</p>
            <p className="mt-1 text-[11px] text-slate-400">{row.detail}</p>
          </ProrascienceVitrineImmersiveCard>
        ))}
      </div>
      <ProrascienceVitrineImmersiveCard variant="violet" className="mt-3">
        <p className="text-[12px] font-bold text-violet-100/90">{f.manikongoExplainer.title}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
          {f.manikongoExplainer.text}
        </p>
      </ProrascienceVitrineImmersiveCard>
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineEquipeMobileScreen() {
  const t = WEB_TEAM;
  const hero = t.hero;
  return (
    <ProrascienceMobileVitrineShell title="L'équipe" lead={hero.lead}>
      <h2 className="mb-3 text-center font-serif text-lg font-bold text-white">{hero.title}</h2>
      {t.founders.map((f) => (
        <ProrascienceVitrineImmersiveCard key={f.name} variant="default" className="mb-3">
          <h3 className="font-serif text-lg font-bold text-white">{f.name}</h3>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">{f.role}</p>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
            {f.bio}
          </p>
        </ProrascienceVitrineImmersiveCard>
      ))}
      <ProrascienceVitrineMobileSectionTitle>Corps professoral</ProrascienceVitrineMobileSectionTitle>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {t.professors.map((p) => (
          <ProrascienceVitrineImmersiveCard key={p.name} className="!p-2.5 text-center">
            <p className="text-[12px] font-bold text-white">{p.name}</p>
            <p className="text-[10px] text-slate-500">{p.module}</p>
            <p className="text-[9px] text-sky-500/60">{p.spec}</p>
          </ProrascienceVitrineImmersiveCard>
        ))}
      </div>
      <ProrascienceVitrineImmersiveCard variant="violet" className="mt-3">
        <p className="text-[13px] font-bold text-violet-100/95">{t.cta.title}</p>
        <p className="mt-1 text-[12px] text-slate-400">{t.cta.text}</p>
      </ProrascienceVitrineImmersiveCard>
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineFaqMobileScreen() {
  const [q, setQ] = useState('');
  const [openQ, setOpenQ] = useState(null);
  const list = useMemo(
    () =>
      INITIATION_GENERAL_FAQ.filter(
        (i) => !q || i.q.toLowerCase().includes(q.toLowerCase()) || i.a.toLowerCase().includes(q.toLowerCase()),
      ),
    [q],
  );
  return (
    <ProrascienceMobileVitrineShell title="FAQ" lead="Initiation & contrats">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 py-2.5 pl-10 pr-3 text-[13px] text-white placeholder:text-slate-500 focus:border-sky-500/30 focus:outline-none"
        />
      </div>
      <p className="mb-2 text-[11px] text-slate-500">Questions transverses — mêmes réponses source que l'espace public.</p>
      <div className="space-y-2">
        {list.map((item) => (
          <ProrascienceVitrineImmersiveCard key={item.q} variant="violet" className="!p-0">
            <button
              type="button"
              onClick={() => setOpenQ((v) => (v === item.q ? null : item.q))}
              className="flex w-full items-start justify-between gap-2 px-3.5 py-3 text-left"
            >
              <span className="text-[12.5px] font-semibold leading-snug text-white">{item.q}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-sky-400/50', openQ === item.q && 'rotate-180')} />
            </button>
            {openQ === item.q && (
              <p className="border-t border-violet-500/15 bg-slate-950/50 px-3.5 py-2.5 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
                {item.a}
              </p>
            )}
          </ProrascienceVitrineImmersiveCard>
        ))}
      </div>
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineContactMobileScreen() {
  const vitrineEmail = useVitrineContactEmail();
  const wc = useMemo(() => getWebContact(vitrineEmail), [vitrineEmail]);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('contact_requests').insert([
        { ...form, status: 'new', created_at: new Date().toISOString() },
      ]);
      if (error) throw error;
      setSuccess(true);
      toast({ title: 'Message envoyé' });
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      toast({
        title: 'Erreur',
        description: `Réessayez ou écrivez à ${vitrineEmail}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <ProrascienceMobileVitrineShell title="Contact" lead={wc.hero.lead}>
      <ProrascienceVitrineImmersiveProse className="mb-3 text-center !text-[12px]">{wc.hero.title}</ProrascienceVitrineImmersiveProse>
      {wc.info.map((block) => (
        <ProrascienceVitrineImmersiveCard key={block.title} variant="default" className="mb-2 !py-2.5">
          <p className="text-[10px] font-bold uppercase text-sky-500/70">{block.title}</p>
          {block.lines.map((line, idx) => (
            <p key={`${block.title}-${idx}`} className="text-[12px] text-slate-300/90">
              {line}
            </p>
          ))}
        </ProrascienceVitrineImmersiveCard>
      ))}
      <ProrascienceVitrineImmersiveCard variant="sky" className="mb-4 flex items-center gap-2">
        <Mail className="h-5 w-5 shrink-0 text-sky-400/90" />
        <div>
          <p className="text-[13px] font-semibold text-white">
            {wc.info.find((i) => i.email)?.email || vitrineEmail}
          </p>
          <p className="text-[11px] text-slate-500">Délai indicatif : 48 h</p>
        </div>
      </ProrascienceVitrineImmersiveCard>
      {success ? (
        <ProrascienceVitrineImmersiveCard>
          <div className="flex items-center gap-2 text-emerald-300/95">
            <CheckCircle className="h-5 w-5" />
            <span className="text-[15px] font-semibold">Message reçu</span>
          </div>
          <Button type="button" variant="outline" className="mt-3 w-full border-white/10" onClick={() => setSuccess(false)}>
            Écrire un autre message
          </Button>
        </ProrascienceVitrineImmersiveCard>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            required
            name="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nom"
            className="rounded-xl border-white/10 bg-slate-950/90"
          />
          <Input
            required
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Email"
            className="rounded-xl border-white/10 bg-slate-950/90"
          />
          <select
            name="subject"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            className="flex h-10 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 text-[13px] text-white"
          >
            <option value="">Sujet (optionnel)</option>
            {wc.subjects.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Textarea
            required
            name="message"
            rows={5}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Votre message"
            className="rounded-xl border-white/10 bg-slate-950/90"
          />
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-2xl bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 font-semibold shadow-lg shadow-indigo-900/30"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <span className="inline-flex items-center gap-2">
                <Send className="h-4 w-4" /> Envoyer
              </span>
            )}
          </Button>
        </form>
      )}
    </ProrascienceMobileVitrineShell>
  );
}

export function VitrineCommunauteMobileScreen() {
  return (
    <ProrascienceMobileVitrineShell title="Communauté" lead="LIRI & réseau">
      <ProrascienceVitrineImmersiveCard variant="violet" className="mb-4">
        <ProrascienceVitrineImmersiveProse>
          {WEB_COMMUNAUTE.note} L'espace vivant (échanges, annonces) se pratique dans l\'app{' '}
          <span className="text-white/95">LIRI</span> une fois inscrit.
        </ProrascienceVitrineImmersiveProse>
      </ProrascienceVitrineImmersiveCard>
      <div className="space-y-2.5">
        <Link to="/signup" className="block">
          <Button className="h-12 w-full rounded-2xl bg-gradient-to-r from-sky-600 to-sky-800 font-semibold text-white shadow-lg shadow-sky-900/20">
            Créer un compte
          </Button>
        </Link>
        <Link to={ELEVE_MOBILE.communaute} className="block">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-2xl border-sky-400/40 bg-slate-950/50 text-sky-100"
          >
            Ouvrir la communauté LIRI
          </Button>
        </Link>
      </div>
    </ProrascienceMobileVitrineShell>
  );
}
