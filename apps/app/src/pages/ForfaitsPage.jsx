import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Crown,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Layers,
  Loader2,
  PhoneCall,
  Quote,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { Ban, iconForExcludeLine, iconForOfferLine } from '@/components/prorascience/forfaitsCycleIcons';
import {
  MarketingAmbientLayers,
  PremiumPressable,
  PRORASCIENCE_MARKETING_HERO_CSS,
  WordBlurReveal,
  easePremium,
} from '@/components/prorascience/prorascienceMarketingHeroBits';
import { ForfaitsHeroVoices } from '@/components/prorascience/ForfaitsHeroVoices';
import { supabase } from '@/lib/customSupabaseClient';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { cn } from '@/lib/utils';
import { useBilling } from '@/contexts/BillingContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import {
  CYCLE_SELECTOR_LABELS,
  INITIATION_PRODUCT_NAME,
  TIER_ORDER,
  cycleContent,
} from '@/data/cycleInitiationProduct';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const CYCLE_SELECTOR_ICONS = {
  autonome: BookOpen,
  academique: GraduationCap,
  prive: HeartHandshake,
  privilegie: Crown,
};

const stripParens = (s) =>
  String(s || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const COUNSELLOR_URL = '/appointment/request';
const INTERVAL_ORDER = ['monthly', 'quarterly', 'yearly'];

/** Image produit par défaut si le slug ne mappe pas un cycle connu */
const FORFAITS_HERO_FALLBACK = '/image-pro/forfaits-hero-liri-immersion.png';

const fallbackPlans = [
  {
    id: 'fallback-monthly',
    slug: 'academique-monthly',
    name: 'Forfait Academique Mensuel',
    interval_type: 'monthly',
    price_amount: 15000,
    price_currency: 'XAF',
  },
  {
    id: 'fallback-quarterly',
    slug: 'academique-quarterly',
    name: 'Forfait Academique Trimestriel',
    interval_type: 'quarterly',
    price_amount: 40000,
    price_currency: 'XAF',
  },
  {
    id: 'fallback-yearly',
    slug: 'academique-yearly',
    name: 'Forfait Academique Annuel',
    interval_type: 'yearly',
    price_amount: 150000,
    price_currency: 'XAF',
  },
];

const formatInterval = (intervalType) => {
  const v = String(intervalType || '').toLowerCase();
  if (v === 'monthly') return 'Mensuel';
  if (v === 'quarterly') return 'Trimestriel';
  if (v === 'yearly') return 'Annuel';
  return 'Forfait';
};

const formatPrice = (amount, currency) => {
  const n = Number(amount || 0);
  const c = String(currency || 'XAF').toUpperCase();
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} ${c}`;
  }
};

const toCycleKey = (plan) => {
  const slug = String(plan?.slug || '').toLowerCase().trim();
  const fromSlug = slug
    .replace(/-(monthly|quarterly|yearly|mensuel|trimestriel|annuel)$/i, '')
    .replace(/[^a-z0-9-]/g, '');
  if (fromSlug) return fromSlug;
  return 'academique';
};

const toCycleLabel = (plan, key) => {
  const name = String(plan?.name || '').trim();
  const cleaned = name
    .replace(/\b(Forfait|Plan)\b/gi, '')
    .replace(/\b(Mensuel|Trimestriel|Annuel|Monthly|Quarterly|Yearly)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return stripParens(cleaned);
  return stripParens(
    String(key || 'Cycle')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase())
  );
};

const planTierFromSlug = (slugLike) => {
  const slug = String(slugLike || '').toLowerCase();
  if (slug.startsWith('autonome-')) return 1;
  if (slug.startsWith('academique-')) return 2;
  if (slug.startsWith('prive-')) return 3;
  if (slug.startsWith('privilegie-')) return 4;
  return 0;
};

const ForfaitsPage = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { subscription, status: billingStatus } = useBilling();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCycleKey, setActiveCycleKey] = useState('');
  const [paymentCycleKey, setPaymentCycleKey] = useState(null);
  const [selectedInterval, setSelectedInterval] = useState('monthly');

  useEffect(() => {
    let alive = true;
    const loadPlans = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('billing_plans')
        .select('id,slug,name,interval_type,price_amount,price_currency,active')
        .eq('active', true)
        .order('price_amount', { ascending: true });

      if (!alive) return;
      if (error || !Array.isArray(data) || data.length === 0) {
        setPlans(fallbackPlans);
      } else {
        setPlans(data.filter((plan) => !String(plan?.slug || '').toLowerCase().startsWith('ngowazulu-')));
      }
      setLoading(false);
    };
    loadPlans();
    return () => {
      alive = false;
    };
  }, []);

  const cycles = useMemo(() => {
    const groups = new Map();
    for (const p of plans) {
      const intervalType = String(p.interval_type || '').toLowerCase();
      if (!INTERVAL_ORDER.includes(intervalType)) continue;
      const key = toCycleKey(p);
      const label = toCycleLabel(p, key);
      if (!groups.has(key)) groups.set(key, { key, label, plansByInterval: {} });
      groups.get(key).plansByInterval[intervalType] = p;
    }
    return [...groups.values()].sort((a, b) => {
      const ta = TIER_ORDER[a.key] ?? 99;
      const tb = TIER_ORDER[b.key] ?? 99;
      if (ta !== tb) return ta - tb;
      const aPrice = Math.min(
        ...INTERVAL_ORDER.map((interval) => Number(a.plansByInterval?.[interval]?.price_amount || Number.MAX_SAFE_INTEGER))
      );
      const bPrice = Math.min(
        ...INTERVAL_ORDER.map((interval) => Number(b.plansByInterval?.[interval]?.price_amount || Number.MAX_SAFE_INTEGER))
      );
      return aPrice - bPrice;
    });
  }, [plans]);

  useEffect(() => {
    if (!activeCycleKey && cycles.length > 0) setActiveCycleKey(cycles[0].key);
  }, [activeCycleKey, cycles]);

  const activeCycle = useMemo(
    () => cycles.find((cycle) => cycle.key === activeCycleKey) || cycles[0] || null,
    [cycles, activeCycleKey]
  );
  const heroContent = useMemo(() => cycleContent(activeCycle), [activeCycle]);
  const heroPriceLabel = useMemo(() => {
    if (!activeCycle) return null;
    const minPrice = Math.min(
      ...INTERVAL_ORDER.map((interval) =>
        Number(activeCycle.plansByInterval?.[interval]?.price_amount || Number.MAX_SAFE_INTEGER)
      )
    );
    if (!Number.isFinite(minPrice) || minPrice >= Number.MAX_SAFE_INTEGER) return null;
    const currency =
      activeCycle.plansByInterval?.monthly?.price_currency ||
      activeCycle.plansByInterval?.quarterly?.price_currency ||
      activeCycle.plansByInterval?.yearly?.price_currency ||
      'XAF';
    return formatPrice(minPrice, currency);
  }, [activeCycle]);
  const paymentCycle = useMemo(
    () => cycles.find((cycle) => cycle.key === paymentCycleKey) || null,
    [cycles, paymentCycleKey]
  );
  const currentPlanId = String(subscription?.plan_id || '').trim();
  const currentPlan = useMemo(() => {
    if (!currentPlanId) return null;
    return plans.find((p) => String(p.id) === currentPlanId) || null;
  }, [plans, currentPlanId]);
  const currentTier = planTierFromSlug(currentPlan?.slug);
  const hasActiveLikeBilling = billingStatus === 'active' || billingStatus === 'past_due';
  const isPlanSelectable = (plan) => {
    if (!plan) return false;
    if (!hasActiveLikeBilling || !currentPlan) return true;
    if (String(plan.id || '') === String(currentPlan.id || '')) return false;
    const targetTier = planTierFromSlug(plan.slug);
    if (targetTier > 0 && currentTier > 0 && targetTier <= currentTier) return false;
    return true;
  };

  const modalRows = useMemo(() => {
    if (!paymentCycle) return [];
    const monthlyRef = Number(paymentCycle.plansByInterval?.monthly?.price_amount || 0);
    return INTERVAL_ORDER.map((intervalType) => {
      const plan = paymentCycle.plansByInterval?.[intervalType] || null;
      const available = Boolean(plan);
      const total = Number(plan?.price_amount || 0);
      const months = intervalType === 'monthly' ? 1 : intervalType === 'quarterly' ? 3 : 12;
      const monthlyEq = available ? total / months : 0;
      const savingsPct = available && monthlyRef > 0 ? Math.max(0, Math.round((1 - monthlyEq / monthlyRef) * 100)) : 0;
      const savingsAmount = available && monthlyRef > 0 ? Math.max(0, monthlyRef * months - total) : 0;
      return { intervalType, plan, available, monthlyEq, savingsPct, savingsAmount };
    });
  }, [paymentCycle]);

  const recommendedInterval = useMemo(() => {
    const available = modalRows.filter((row) => row.available);
    if (available.length === 0) return null;
    return [...available].sort((a, b) => a.monthlyEq - b.monthlyEq)[0].intervalType;
  }, [modalRows]);

  useEffect(() => {
    if (!paymentCycle) return;
    const best = recommendedInterval || INTERVAL_ORDER.find((interval) => {
      const row = modalRows.find((item) => item.intervalType === interval);
      return row?.available;
    });
    if (best) setSelectedInterval(best);
  }, [paymentCycle, recommendedInterval, modalRows]);

  const reserveCycle = (cycleKey) => {
    const cycle = cycles.find((c) => c.key === cycleKey);
    const hasEligiblePlan = INTERVAL_ORDER.some((intervalType) => isPlanSelectable(cycle?.plansByInterval?.[intervalType]));
    if (!hasEligiblePlan) return;
    setPaymentCycleKey(cycleKey);
  };
  const closePaymentDialog = () => setPaymentCycleKey(null);
  const chooseInterval = (planId, intervalType) => {
    const paymentPath = `/paiements/payer?plan=${encodeURIComponent(planId)}&interval=${encodeURIComponent(intervalType)}`;
    if (!authUser) {
      // Visiteur non connecté → inscription avec redirect direct vers paiement
      // On passe aussi le nom lisible du cycle pour l'affichage sur la page d'inscription
      const cycleLabel = CYCLE_SELECTOR_LABELS[paymentCycleKey] || '';
      const signupUrl = `/signup?redirect=${encodeURIComponent(paymentPath)}${cycleLabel ? `&planLabel=${encodeURIComponent(cycleLabel)}` : ''}`;
      navigate(signupUrl);
    } else {
      navigate(paymentPath);
    }
    closePaymentDialog();
  };

  const prefersReducedMotion = useReducedMotion();

  const scrollToCycleDetail = () => {
    document.getElementById('forfaits-fiche')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="prs-forfaits-site relative min-h-screen overflow-x-hidden bg-[#070b12] text-white pb-16">
      <style>{PRORASCIENCE_MARKETING_HERO_CSS}</style>
      <Helmet>
        <title>{`${INITIATION_PRODUCT_NAME} | ${isnaTenantConfig.branding.name}`}</title>
      </Helmet>
      <MarketingAmbientLayers />

      <div className="relative z-[2] mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 border-b border-white/10 bg-[#070b12]/90 py-5 pt-20 text-gray-300 backdrop-blur-md md:pt-24">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement des cycles...
          </div>
        ) : (
          <Tabs value={activeCycle?.key || ''} onValueChange={setActiveCycleKey} className="space-y-0">
            <div
              id="forfaits-cycles"
              className="sticky top-0 z-40 -mx-4 border-b border-white/10 bg-[#070b12]/92 px-4 pb-4 pt-16 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md sm:-mx-6 sm:px-6 md:pt-20 lg:-mx-8 lg:px-8"
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
                {INITIATION_PRODUCT_NAME}
              </p>
              <p className="mb-3 text-[10px] text-white/45 md:text-[11px]">
                Quatre niveaux d&apos;accès — choisissez votre profondeur d&apos;initiation
              </p>
              <PremiumSegmentedSelector
                value={activeCycle?.key || ''}
                onChange={setActiveCycleKey}
                options={cycles.map((cycle) => {
                  const c = cycleContent(cycle);
                  const Icon = CYCLE_SELECTOR_ICONS[cycle.key] || Sparkles;
                  return {
                    value: cycle.key,
                    label: CYCLE_SELECTOR_LABELS[cycle.key] || stripParens(cycle.label) || c.headline,
                    badge: `Niv. ${c.tier}`,
                    icon: Icon,
                  };
                })}
                layoutId="forfaits-cycle-segment-pill"
                className="w-full max-w-none"
              />
            </div>

        <motion.section
          className="relative px-2 pb-12 pt-8 md:pb-16 md:pt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid items-start gap-10 lg:grid-cols-[1.02fr_1.08fr] lg:gap-12">
              <motion.div
                key={activeCycle?.key || 'hero'}
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.04 } },
                }}
                initial="hidden"
                animate="visible"
              >
                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easePremium } },
                  }}
                  className="max-w-xl text-[11px] font-bold uppercase leading-snug tracking-[0.22em] text-[#D4AF37] md:text-xs"
                >
                  {heroContent.heroGoldLine}
                </motion.p>
                <motion.p
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { duration: 0.45, delay: 0.08 } },
                  }}
                  className="mt-3 text-[13px] text-white/55 md:text-sm"
                >
                  {INITIATION_PRODUCT_NAME}
                </motion.p>
                <motion.h1
                  variants={{
                    hidden: { opacity: 0, y: 32 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.72, ease: easePremium } },
                  }}
                  className="mt-4 text-4xl font-bold leading-[1.1] md:text-5xl lg:text-6xl"
                >
                  <span className="block text-white">
                    <WordBlurReveal
                      text={heroContent.headline}
                      baseDelay={0.06}
                      delayStep={0.05}
                    />
                  </span>
                </motion.h1>
                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.12 } },
                  }}
                  className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#D4AF37]/95 md:text-[13px]"
                >
                  {heroContent.tierBadge}
                </motion.p>
                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.16 } },
                  }}
                  className="mt-4 max-w-xl border-l-2 border-[#D4AF37]/55 pl-4 text-lg font-medium leading-snug text-white md:text-xl"
                >
                  {heroContent.tagline}
                </motion.p>
                <motion.p
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { duration: 0.45, delay: 0.2 } },
                  }}
                  className="mt-2 text-sm text-white/60"
                >
                  {heroContent.positioning}
                </motion.p>
                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 18, filter: 'blur(10px)' },
                    visible: {
                      opacity: 1,
                      y: 0,
                      filter: 'blur(0px)',
                      transition: { duration: 0.75, delay: 0.2, ease: easePremium },
                    },
                  }}
                  className="mt-6 max-w-xl text-base leading-relaxed text-white/78 md:text-lg"
                >
                  {heroContent.pitch.split('LIRI').map((part, i, arr) => (
                    <React.Fragment key={`${activeCycle?.key}-p-${i}`}>
                      {part}
                      {i < arr.length - 1 ? (
                        <LiriWordmark
                          size="kicker"
                          className="mx-0.5 inline-flex align-baseline text-[#ebca5e]"
                        />
                      ) : null}
                    </React.Fragment>
                  ))}
                </motion.p>
                <motion.ul
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.28, ease: easePremium } },
                  }}
                  className="mt-6 max-w-xl space-y-2.5 text-sm text-white/82 md:text-[15px]"
                >
                  {(heroContent.includes || []).slice(0, 4).map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </motion.ul>
                {heroPriceLabel ? (
                  <motion.p
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1, transition: { duration: 0.45, delay: 0.32 } },
                    }}
                    className="mt-5 text-sm font-medium text-[#D4AF37] md:text-base"
                  >
                    À partir de {heroPriceLabel} · contrat au choix
                  </motion.p>
                ) : null}

                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 22 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.12, ease: easePremium } },
                  }}
                  className="mt-9 flex flex-wrap gap-3"
                >
                  <PremiumPressable>
                    <Button
                      className="group prs-cta-primary h-12 bg-[#D4AF37] px-7 font-bold text-black hover:bg-[#ebca5e]"
                      asChild
                    >
                      <Link to={COUNSELLOR_URL} className="inline-flex items-center">
                        <CalendarClock className="mr-2 h-5 w-5" />
                        Rendez-vous conseiller
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5" />
                      </Link>
                    </Button>
                  </PremiumPressable>
                  <PremiumPressable>
                    <Button
                      type="button"
                      variant="outline"
                      className="prs-cta-ghost group h-12 border-white/25 px-7 text-white hover:bg-white/10"
                      onClick={scrollToCycleDetail}
                    >
                      Fiche &amp; réserver
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </Button>
                  </PremiumPressable>
                </motion.div>

                <motion.div
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.45 } } }}
                  className="mt-8 flex flex-wrap items-center gap-2 text-xs text-white/55"
                >
                  <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
                  {`Système MK5 / Ngowazulu / ${isnaTenantConfig.branding.name}`}
                  <span className="mx-1 text-white/30">•</span>
                  Contrats flexibles
                  <span className="mx-1 text-white/30">•</span>
                  Secrétariat &amp; paiements sécurisés
                </motion.div>
              </motion.div>

              <motion.div
                key={`hero-visual-${activeCycle?.key || 'default'}`}
                className="relative prs-hero-chassis"
                initial={{ opacity: 0, scale: 0.96, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.25, ease: easePremium }}
              >
                <div
                  className="prs-hero-frame prs-glass-sweep relative overflow-hidden rounded-3xl border border-white/15 shadow-[0_30px_90px_rgba(0,0,0,.55)]"
                  data-hero-contain={activeCycle?.key === 'privilegie' ? 'true' : undefined}
                >
                  <div
                    className={cn(
                      'relative w-full overflow-hidden',
                      activeCycle?.key === 'privilegie'
                        ? 'min-h-[min(58vh,440px)] bg-[#0a0f18] md:min-h-[min(66vh,560px)] lg:min-h-[min(74vh,720px)]'
                        : 'min-h-[min(52vh,380px)] md:min-h-[min(62vh,480px)] lg:min-h-[min(70vh,620px)]'
                    )}
                  >
                    <img
                      src={heroContent.heroImage || FORFAITS_HERO_FALLBACK}
                      alt={heroContent.heroImageAlt || "Visuel du niveau d'initiation Prorascience"}
                      className={cn(
                        'prs-hero-img absolute inset-0 h-full w-full object-center',
                        activeCycle?.key === 'privilegie' ? 'object-contain' : 'object-cover'
                      )}
                      loading="eager"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-[#070b12]/15 to-[#070b12]/30" />
                    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-xs text-white/88 backdrop-blur-md">
                      <Globe2 className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                      <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                        <LiriWordmark size="kicker" className="inline-flex text-[#ebca5e]" />
                        <span>
                          · immersion directe — cycle « {activeCycle?.label || heroContent.headline} » · accessible
                          depuis n&apos;importe quel pays
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative z-[1] -mt-8 mx-3 rounded-2xl border border-white/12 bg-[#0c111d]/90 p-4 shadow-xl backdrop-blur-lg md:mx-6 md:p-5">
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/55">
                      <span className="relative flex h-2 w-2 shrink-0">
                        {!prefersReducedMotion ? (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
                        ) : null}
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 prs-live-dot" />
                      </span>
                      En direct
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex h-4 items-end gap-0.5" aria-hidden>
                        {[14, 10, 16, 12].map((h, i) => (
                          <span
                            key={i}
                            className="w-0.5 rounded-full bg-[#D4AF37]/75 prs-wave-bar"
                            style={{ height: h }}
                          />
                        ))}
                      </span>
                      <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                        LIVE + REPLAY
                      </span>
                    </span>
                  </div>
                  <ForfaitsHeroVoices
                    profiles={heroContent.heroProfiles || []}
                    cycleKey={activeCycle?.key || 'default'}
                    prefersReducedMotion={prefersReducedMotion}
                    easePremium={easePremium}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

            <div id="forfaits-fiche" className="space-y-8 pt-2">
            {cycles.map((cycle) => {
              const content = cycleContent(cycle);
              const minPrice = Math.min(
                ...INTERVAL_ORDER.map((interval) =>
                  Number(cycle?.plansByInterval?.[interval]?.price_amount || Number.MAX_SAFE_INTEGER)
                )
              );
              const cyclePrice = Number.isFinite(minPrice) && minPrice < Number.MAX_SAFE_INTEGER ? minPrice : 0;
              const currency =
                cycle?.plansByInterval?.monthly?.price_currency ||
                cycle?.plansByInterval?.quarterly?.price_currency ||
                cycle?.plansByInterval?.yearly?.price_currency ||
                'XAF';

              const nextCycle =
                content.nextTierKey && cycles.find((c) => c.key === content.nextTierKey);
              const nextContent = nextCycle ? cycleContent(nextCycle) : null;

              const TierIcon = CYCLE_SELECTOR_ICONS[cycle.key] || Sparkles;
              const NextTierIcon = content.nextTierKey
                ? CYCLE_SELECTOR_ICONS[content.nextTierKey] || Sparkles
                : Sparkles;
              const idealDecorIcons = [Target, Sparkles, Users, HeartHandshake];

              return (
                <TabsContent
                  key={cycle.key}
                  value={cycle.key}
                  className="mt-0 space-y-6 animate-in fade-in duration-300 md:space-y-8"
                >
                  {/* 01 · Bento : illustration + synthèse */}
                  <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
                    <div
                      className={cn(
                        'relative overflow-hidden rounded-3xl border border-[#D4AF37]/30 bg-[#0a0f18] lg:col-span-4',
                        cycle.key === 'privilegie'
                          ? 'min-h-[min(260px,55vw)] sm:min-h-[280px] lg:min-h-[min(320px,32vw)]'
                          : 'min-h-[220px]'
                      )}
                    >
                      <img
                        src={content.heroImage}
                        alt=""
                        className={cn(
                          'absolute inset-0 h-full w-full opacity-[0.28]',
                          cycle.key === 'privilegie' ? 'object-contain object-center p-3 sm:p-4' : 'object-cover'
                        )}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-[#070b12]/75 to-[#070b12]/20" />
                      <div className="relative z-10 flex h-full flex-col items-center justify-center p-6 text-center">
                        <div className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-2xl border border-[#D4AF37]/45 bg-[#D4AF37]/12 shadow-[0_0_48px_rgba(212,175,55,0.18)]">
                          <TierIcon className="h-10 w-10 text-[#D4AF37]" aria-hidden />
                        </div>
                        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
                          Palier {content.tier}
                        </p>
                        <p className="mt-2 max-w-[14rem] text-[11px] leading-snug text-white/55">{content.tierBadge}</p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-[#121a28]/95 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.35)] md:p-8 lg:col-span-8">
                      <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/55">
                          <Layers className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                          Synthèse du niveau
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl lg:text-[2rem]">
                          {content.headline}
                        </h2>
                        <p className="mt-2 text-base font-semibold leading-snug text-[#ebca5e] md:text-lg">
                          {content.tagline}
                        </p>
                        <p className="mt-2 text-sm text-[#D4AF37]/85">{content.positioning}</p>
                        <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-white/68">{content.pitch}</p>
                      </div>
                      <div className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                            <Wallet className="h-6 w-6 text-[#D4AF37]" aria-hidden />
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                              À partir de
                            </p>
                            <p className="text-xl font-bold tabular-nums text-[#D4AF37] md:text-2xl">
                              {formatPrice(cyclePrice, currency)}
                            </p>
                            <p className="text-[11px] text-white/40">Puis mensuel, trimestriel ou annuel</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => reserveCycle(cycle.key)}
                          disabled={
                            !INTERVAL_ORDER.some((intervalType) =>
                              isPlanSelectable(cycle?.plansByInterval?.[intervalType])
                            )
                          }
                          className="h-12 w-full bg-[#D4AF37] font-bold text-black shadow-xl shadow-[#D4AF37]/25 hover:bg-[#ebca5e] disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
                        >
                          <CreditCard className="mr-2 h-4 w-4" />
                          {INTERVAL_ORDER.some((intervalType) =>
                            isPlanSelectable(cycle?.plansByInterval?.[intervalType])
                          )
                            ? 'Réserver ce niveau'
                            : 'Niveau actif'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Montée en gamme — bande illustrée */}
                  {nextCycle && nextContent ? (
                    <div className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-r from-[#2a1f0c]/95 via-[#151a21] to-[#101824] p-5 md:flex md:items-center md:justify-between md:pr-6">
                      <div className="pointer-events-none absolute -right-6 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-[#D4AF37]/12 blur-3xl" />
                      <div className="relative flex flex-1 items-start gap-4 md:items-center">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/15 shadow-[0_0_32px_rgba(212,175,55,0.12)]">
                          <NextTierIcon className="h-7 w-7 text-[#D4AF37]" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-[#D4AF37]" aria-hidden />
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
                              Montée en gamme
                            </p>
                          </div>
                          <p className="mt-1 text-lg font-semibold text-white md:text-xl">{nextContent.headline}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-white/60">{nextContent.tagline}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="relative mt-4 h-11 shrink-0 border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 md:mt-0"
                        onClick={() => setActiveCycleKey(content.nextTierKey)}
                      >
                        Niveau supérieur
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}

                  {/* 02 · Grille visuelle inclus / limites */}
                  <div className="rounded-3xl border border-white/10 bg-[#0f141f]/95 p-5 md:p-8">
                    <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex items-start gap-4">
                        <span className="text-4xl font-black leading-none text-[#D4AF37]/20 tabular-nums">02</span>
                        <div>
                          <div className="flex items-center gap-2 text-white">
                            <Sparkles className="h-5 w-5 text-[#D4AF37]" aria-hidden />
                            <h3 className="text-lg font-bold md:text-xl">Ce que vous activez</h3>
                          </div>
                          <p className="mt-1 text-sm text-white/50">
                            Chaque carte résume un livrable — icônes indicatives
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`grid gap-6 lg:gap-8 ${content.excludes?.length || content.experience?.length ? 'lg:grid-cols-2' : ''}`}
                    >
                      <div>
                        <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300/95">
                          <CheckCircle2 className="h-4 w-4" aria-hidden />
                          Inclus
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {content.includes.map((item) => {
                            const IncIcon = iconForOfferLine(item);
                            return (
                              <div
                                key={item}
                                className="flex gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] to-transparent p-4"
                              >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10">
                                  <IncIcon className="h-6 w-6 text-emerald-400" aria-hidden />
                                </div>
                                <p className="text-sm leading-snug text-white/90">{item}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {content.excludes?.length ? (
                        <div>
                          <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-200/90">
                            <Ban className="h-4 w-4" aria-hidden />
                            Pas à ce palier
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {content.excludes.map((item) => {
                              const ExcIcon = iconForExcludeLine(item);
                              return (
                                <div
                                  key={item}
                                  className="flex gap-3 rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.07] to-transparent p-4"
                                >
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-500/10">
                                    <ExcIcon className="h-6 w-6 text-rose-300/90" aria-hidden />
                                  </div>
                                  <p className="text-sm leading-snug text-white/80">{item}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : content.experience?.length ? (
                        <div>
                          <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">
                            <Zap className="h-4 w-4" aria-hidden />
                            Expérience
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {content.experience.map((item) => {
                              const ExpIcon = iconForOfferLine(item);
                              return (
                                <div
                                  key={item}
                                  className="flex gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-4"
                                >
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10">
                                    <ExpIcon className="h-6 w-6 text-[#D4AF37]" aria-hidden />
                                  </div>
                                  <p className="text-sm leading-snug text-white/88">{item}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {content.objective?.length ? (
                      <div className="mt-8 rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-r from-[#D4AF37]/[0.08] to-transparent p-5 md:p-6">
                        <div className="mb-3 flex items-center gap-2">
                          <Crown className="h-5 w-5 text-[#D4AF37]" aria-hidden />
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">
                            Trajectoire visée
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {content.objective.map((item) => (
                            <div
                              key={item}
                              className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white/90"
                            >
                              <span className="text-[#D4AF37]" aria-hidden>
                                ◆
                              </span>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* 03 · Profil + contrats */}
                  <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
                    <div className="rounded-3xl border border-white/10 bg-[#121a28]/92 p-6 lg:col-span-3">
                      <div className="mb-5 flex items-start gap-4 border-b border-white/10 pb-4">
                        <span className="text-4xl font-black leading-none text-[#D4AF37]/20 tabular-nums">03</span>
                        <div>
                          <div className="flex items-center gap-2 text-white">
                            <Target className="h-5 w-5 text-[#D4AF37]" aria-hidden />
                            <h3 className="text-lg font-bold">Profil recommandé</h3>
                          </div>
                          <p className="mt-1 text-sm text-white/50">Qui tire le meilleur parti de ce palier</p>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {content.idealFor.map((item, idx) => {
                          const Deco = idealDecorIcons[idx % idealDecorIcons.length];
                          return (
                            <div
                              key={item}
                              className="flex gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4"
                            >
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/12">
                                <Deco className="h-5 w-5 text-[#D4AF37]" aria-hidden />
                              </div>
                              <p className="text-sm leading-snug text-white/88">{item}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-b from-[#1a1610]/95 to-[#121a28]/95 p-6 lg:col-span-2">
                      <div className="mb-4 flex items-start gap-3 border-b border-[#D4AF37]/20 pb-4">
                        <CalendarDays className="mt-0.5 h-6 w-6 text-[#D4AF37]" aria-hidden />
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">
                            Rythme de facturation
                          </p>
                          <p className="mt-1 text-sm text-white/55">Montant indicatif par période</p>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        {INTERVAL_ORDER.map((intervalType) => {
                          const plan = cycle.plansByInterval?.[intervalType];
                          const available = Boolean(plan);
                          return (
                            <div
                              key={intervalType}
                              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${
                                available
                                  ? 'border-[#D4AF37]/30 bg-[#D4AF37]/[0.07]'
                                  : 'border-white/10 bg-white/[0.02] opacity-55'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <CalendarClock className="h-4 w-4 shrink-0 text-[#D4AF37]/90" aria-hidden />
                                <span className="text-sm font-medium text-white">{formatInterval(intervalType)}</span>
                              </div>
                              {available ? (
                                <span className="text-sm font-bold tabular-nums text-[#D4AF37]">
                                  {formatPrice(plan.price_amount, plan.price_currency)}
                                </span>
                              ) : (
                                <span className="text-xs text-white/40">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-4 text-[11px] leading-relaxed text-white/40">
                        Validation finale au paiement selon le plan actif en base.
                      </p>
                    </div>
                  </div>

                  {/* Témoignages — cartes illustrées */}
                  <div className="rounded-3xl border border-white/10 bg-[#121a28]/90 p-6 md:p-8">
                    <div className="mb-5 flex items-center gap-3">
                      <Quote className="h-6 w-6 text-[#D4AF37]" aria-hidden />
                      <div>
                        <h3 className="text-lg font-bold text-white">Voix des parcours</h3>
                        <p className="text-sm text-white/50">Retours sur ce type de niveau</p>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {content.testimonials.map((t) => (
                        <motion.div
                          key={`${cycle.key}-${t.name}`}
                          whileHover={{ y: -2 }}
                          transition={{ duration: 0.2 }}
                          className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-5"
                        >
                          <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/15 text-sm font-bold text-[#D4AF37]">
                              {t.name
                                .split(/\s+/)
                                .map((w) => w[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <p className="text-sm font-semibold text-[#D4AF37]">{t.name}</p>
                          </div>
                          <p className="text-sm italic leading-relaxed text-white/80">&ldquo;{t.text}&rdquo;</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a2234]/80 to-[#121a28] p-6 md:flex md:items-center md:justify-between md:p-8">
                    <div className="max-w-xl">
                      <h3 className="text-lg font-bold text-white md:text-xl">Encore un doute sur le palier ?</h3>
                      <p className="mt-2 text-sm text-white/55">
                        Le secrétariat vous aide à choisir entre initiation, transformation, intimité ou transmission.
                      </p>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3 md:mt-0">
                      <Button className="bg-[#D4AF37] font-bold text-black hover:bg-[#ebca5e]" asChild>
                        <Link to={COUNSELLOR_URL}>
                          Conseiller
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" className="border-white/20 text-white hover:bg-white/5" asChild>
                        <Link to={`/faq?cycle=${encodeURIComponent(cycle.key)}`}>
                          FAQ —{' '}
                          {CYCLE_SELECTOR_LABELS[cycle.key] || stripParens(cycle.label) || content.headline}
                        </Link>
                      </Button>
                    </div>
                  </section>
                </TabsContent>
              );
            })}
            </div>
          </Tabs>
        )}
      </div>

      <Dialog open={Boolean(paymentCycle)} onOpenChange={(open) => !open && closePaymentDialog()}>
        <DialogContent className="premium-panel overflow-hidden bg-gradient-to-br from-[#111a2a] via-[#0d1420] to-[#0a1019] border-white/15 text-white max-w-3xl">
          <div className="pointer-events-none absolute -top-16 right-12 h-36 w-36 rounded-full bg-[#D4AF37]/20 blur-3xl" />
          <DialogHeader>
            <DialogTitle>Choisir le type de contrat</DialogTitle>
            <DialogDescription>
              {paymentCycle ? `Cycle ${paymentCycle.label}: selectionne Mensuel, Trimestriel ou Annuel.` : ''}
            </DialogDescription>
          </DialogHeader>
          <PremiumSegmentedSelector
            value={selectedInterval}
            onChange={setSelectedInterval}
            layoutId="forfaits-interval-segment-pill"
            className="mt-2"
            options={modalRows.map((row) => ({
              value: row.intervalType,
              label: formatInterval(row.intervalType),
              badge: row.available && row.plan ? formatPrice(row.plan.price_amount, row.plan.price_currency) : 'Indisponible',
              icon: CreditCard,
              disabled: !row.available,
            }))}
          />
          {(() => {
            const row = modalRows.find((item) => item.intervalType === selectedInterval) || null;
            if (!row) return null;
            const isRecommended = recommendedInterval === row.intervalType && row.available;
            return (
              <motion.div
                key={row.intervalType}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24 }}
                className="mt-3"
              >
                <Card className={`premium-panel h-full border ${row.available ? 'border-white/15 bg-white/[0.045]' : 'border-white/10 bg-white/5 opacity-60'} ${isRecommended ? 'ring-1 ring-[#D4AF37]/45' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{formatInterval(row.intervalType)}</CardTitle>
                      {!isPlanSelectable(row.plan) && row.available ? (
                        <Badge className="bg-white/10 text-gray-300 border border-white/20">Actuel / Non upgradable</Badge>
                      ) : isRecommended ? (
                        <Badge className="bg-[#D4AF37] text-black border-none">Recommande</Badge>
                      ) : null}
                    </div>
                    <CardDescription className="text-lg font-semibold text-white">
                      {row.available ? formatPrice(row.plan.price_amount, row.plan.price_currency) : 'Non disponible'}
                    </CardDescription>
                    {row.available ? (
                      <p className="text-xs text-gray-400">
                        ~ {formatPrice(row.monthlyEq, row.plan.price_currency)} / mois
                        {row.savingsPct > 0 ? ` • economie ${row.savingsPct}%` : ''}
                        {row.savingsAmount > 0 ? ` • gain ${formatPrice(row.savingsAmount, row.plan.price_currency)}` : ''}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <Button
                      disabled={!row.available || !isPlanSelectable(row.plan)}
                      onClick={() => row.available && isPlanSelectable(row.plan) && chooseInterval(row.plan.id, row.intervalType)}
                      className="w-full bg-[#D4AF37] text-black hover:bg-[#c4a030] font-bold disabled:opacity-50 shadow-lg shadow-[#D4AF37]/20"
                    >
                      {!row.available ? 'Indisponible' : isPlanSelectable(row.plan) ? 'Continuer' : 'Forfait actif'}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Link
        to={COUNSELLOR_URL}
        className="fixed bottom-5 right-5 z-[120] md:bottom-8 md:right-8"
      >
        <Button className="bg-[#D4AF37] text-black hover:bg-[#c4a030] font-bold gap-2 shadow-xl shadow-[#D4AF37]/20">
          <PhoneCall className="w-4 h-4" />
          Conseiller
        </Button>
      </Link>
    </div>
  );
};

export default ForfaitsPage;
