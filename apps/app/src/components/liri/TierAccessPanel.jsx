/**
 * TierAccessPanel — « Vos forfaits & vos accès » pour un MEMBRE connecté (/liri/forfaits).
 *
 * SÉLECTEUR : on choisit un forfait dans un segmenteur → une fiche détaillée s'affiche
 * (à qui c'est destiné · tout l'accès · avantages · limites · réduction boutique) avec un CTA
 * « Payer » (checkout Stripe/Mobile Money) + un lien secondaire « Prendre rendez-vous ».
 * Puis une section « Cours par module » (boutique + événements) avec la grille de réductions.
 *
 * Piloté par useMemberEntitlements (forfait courant) + billing_plans (prix = source de vérité).
 * Contenu éditorial (Temple, parcours initiatique, sacerdoce…) = décision fondateur, ci-dessous.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { useSearchParams } from 'react-router-dom';
import {
  Check, Sparkles, ArrowRight, CalendarClock, PhoneCall, BookOpenText, Video,
  CalendarDays, Users2, HeartHandshake, Crown, GraduationCap, Compass, MinusCircle,
  Flame, Moon, Ticket, ShoppingBag, Star, ShieldCheck, Target, Settings2, X, Loader2,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveTenantSlug } from '@/lib/tenant/activeBranding';
import { useMemberEntitlements } from '@/hooks/useMemberEntitlements';
import { useBilling } from '@/contexts/BillingContext';
import { offeringCheckoutApi } from '@/lib/api-v2';

const CYCLE_LABEL = { autonome: 'Autonome', academique: 'Académique', prive: 'Privé', privilegie: 'Privilégié' };
const CYCLE_ICON = { autonome: Compass, academique: GraduationCap, prive: HeartHandshake, privilegie: Crown };
const CYCLE_KICKER = {
  autonome: 'Le Temple, en autonomie',
  academique: 'Le parcours initiatique',
  prive: 'Accompagnement rapproché',
  privilegie: 'La voie du praticien',
};
// Réduction automatique sur les cours-modules (boutique) + événements, selon le forfait.
const DISCOUNTS = { autonome: 25, academique: 40, prive: 50, privilegie: 60 };
const RECOMMENDED = 'academique';
const ORDER = ['autonome', 'academique', 'prive', 'privilegie'];

// Fiche éditoriale de chaque forfait (à qui · accès · avantages · limites).
const PLAN = {
  autonome: {
    tagline: 'Le socle de la Prorascience, en autonomie — le Temple ouvert.',
    forWhom: "Pour qui veut découvrir le corpus et pratiquer le rituel, seul et à son rythme, sans accompagnement.",
    access: [
      { icon: CalendarDays, text: "Temple Ngowazulu — calendrier d'ouverture & de fermeture, 2 jours par mois" },
      { icon: BookOpenText, text: 'Documentation du culte & des enseignements' },
      { icon: Video, text: 'Vidéothèque du Temple' },
      { icon: Ticket, text: 'Événements du Temple' },
      { icon: Video, text: 'Cours enregistrés — replay illimité' },
      { icon: BookOpenText, text: 'Bibliothèque & livres fondamentaux' },
      { icon: Users2, text: 'Forum & questions' },
    ],
    avantages: ['Rythme totalement libre', 'Temple & cultes en ligne inclus', "Le tarif d'entrée le plus accessible"],
    limites: ['Pas de cours en direct ni de questions au professeur', 'Aucun accompagnement ni séance privée', 'Pas de parcours initiatique'],
  },
  academique: {
    tagline: "Le parcours initiatique — un an, jusqu'à devenir Initié.",
    forWhom: "Réservé à la Prorascience : pour qui veut suivre le cursus complet, encadré, et être initié au terme d'un an.",
    access: [
      { icon: Compass, text: "Parcours initiatique structuré sur 1 an → titre d'Initié" },
      { icon: Video, text: 'Cours EN DIRECT — temps réel, questions au professeur' },
      { icon: GraduationCap, text: "Préparation & validation de l'initiation" },
      { icon: Check, text: "Tout l'accès Autonome (Temple, replay, bibliothèque, forum)" },
    ],
    avantages: ['Encadrement et progression structurée', 'Interaction directe avec les enseignants', 'Aboutit à un statut : Initié'],
    limites: ["Engagement d'un an", 'Pas de séances privées 1:1 (→ Privé)', 'Ne forme pas au métier de praticien (→ Privilégié)'],
  },
  prive: {
    tagline: 'Accompagnement rapproché — pour traverser une période difficile.',
    forWhom: "Pour qui veut être assisté durant une période difficile : un apprentissage et un suivi individuel sur un emploi du temps qu'il définit lui-même.",
    access: [
      { icon: HeartHandshake, text: 'Séances privées 1:1 incluses' },
      { icon: Users2, text: 'Messagerie directe avec un mentor' },
      { icon: CalendarClock, text: 'Emploi du temps personnalisé — défini par vous, à votre rythme' },
      { icon: Compass, text: 'Apprentissage + suivi individuel' },
      { icon: Check, text: "Tout l'accès Académique (direct, initiation, Temple…)" },
    ],
    avantages: ['Attention directe et personnalisée', 'Calendrier à la carte, adapté à votre situation', 'Soutien pendant les moments difficiles'],
    limites: ['Ne forme pas au métier de praticien (→ Privilégié)', 'Tarif plus élevé (accompagnement individuel)'],
  },
  privilegie: {
    tagline: 'Devenir maître — la maîtrise du sacerdoce.',
    forWhom: 'Réservé aux praticiens : pour qui veut apprendre le métier de maître spirituel et maîtriser le sacerdoce.',
    access: [
      { icon: Crown, text: 'Formation au métier de maître spirituel (sacerdoce)' },
      { icon: Flame, text: 'Mentorat souverain & stages pratiques' },
      { icon: Users2, text: 'Cercle des praticiens' },
      { icon: Check, text: "Tout l'accès Privé (séances 1:1, suivi personnalisé…)" },
    ],
    avantages: ['Formation professionnelle complète au métier', 'Mentorat au plus haut niveau + stages', 'Réduction maximale (60 %) sur les modules & événements'],
    limites: ['Réservé aux profils à vocation de praticien', "Le niveau d'engagement et d'exigence le plus élevé"],
  },
};

const MODULE_EXAMPLES = [
  { icon: Flame, text: 'Libation — 3 jours' },
  { icon: Moon, text: 'Interprétation des songes' },
];

const RDV_URL = '/liri/rendez-vous';
const BOUTIQUE_URL = '/liri/marche';
const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
};

export default function TierAccessPanel() {
  const { label, cycle, isStaff, hasForfait } = useMemberEntitlements();
  const billing = useBilling();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const stripeMountRef = useRef(null);
  const stripePaymentElementRef = useRef(null);
  const checkoutRequestRef = useRef(0);
  const [checkoutState, setCheckoutState] = useState({
    open: false,
    planKey: '',
    loading: false,
    ready: false,
    success: false,
    error: '',
    stripe: null,
    elements: null,
    subscriptionId: null,
    paymentIntentId: null,
  });
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let alive = true;
    supabase.from('billing_plans')
      .select('key,price_cents,currency,is_active')
      .eq('is_active', true).order('price_cents', { ascending: true })
      .then(({ data }) => {
        if (!alive) return;
        const m = (data || [])
          .filter((p) => /^(autonome|academique|prive|privilegie)-monthly$/.test(String(p.key || '').toLowerCase()))
          .map((p) => ({ cycle: String(p.key).toLowerCase().replace(/-monthly$/, ''), key: p.key, price: Math.round(Number(p.price_cents || 0) / 100) }));
        setPlans(m);
      });
    return () => { alive = false; };
  }, []);

  // Sélection par défaut = forfait courant, sinon le recommandé.
  useEffect(() => {
    if (!selected) setSelected(cycle && ORDER.includes(cycle) ? cycle : RECOMMENDED);
  }, [cycle, selected]);

  useEffect(() => {
    const plan = String(searchParams.get('plan') || '').toLowerCase();
    const match = plan.match(/^(autonome|academique|prive|privilegie)-monthly$/);
    if (!match) return;
    setSelected(match[1]);
    if (searchParams.get('checkout') === '1') {
      setCheckoutState((s) => ({ ...s, open: true, planKey: plan, success: false, error: '' }));
    }
  }, [searchParams]);

  const promoCode = searchParams.get('promo') || undefined;

  useEffect(() => {
    if (!checkoutState.open || !checkoutState.planKey || checkoutState.success) return undefined;
    let cancelled = false;
    const requestId = checkoutRequestRef.current + 1;
    checkoutRequestRef.current = requestId;
    const timer = window.setTimeout(async () => {
      try {
        setCheckoutState((s) => ({ ...s, loading: true, error: '' }));
        const slug = resolveTenantSlug();
        if (!slug) throw new Error('Espace tenant introuvable.');
        const res = await offeringCheckoutApi.createCardIntent({
          tenantSlug: slug,
          kind: 'subscription',
          planSlug: checkoutState.planKey,
          promoCode,
        });
        const pk = res?.publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
        if (!pk || !/^pk_(test|live)_/.test(pk)) throw new Error('Clé publique Stripe invalide.');
        const stripe = await loadStripe(pk);
        if (!stripe) throw new Error('Stripe.js indisponible.');
        const elements = stripe.elements({
          clientSecret: res.clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#d97757',
              colorBackground: '#221f1c',
              colorText: '#ffffff',
              colorDanger: '#ef4444',
              borderRadius: '12px',
            },
          },
        });
        const mount = stripeMountRef.current;
        if (!mount) throw new Error('Zone carte indisponible.');
        if (stripePaymentElementRef.current) {
          try { stripePaymentElementRef.current.unmount(); } catch { /* noop */ }
        }
        const paymentElement = elements.create('payment', { layout: 'tabs' });
        stripePaymentElementRef.current = paymentElement;
        paymentElement.mount(mount);
        if (!cancelled && checkoutRequestRef.current === requestId) {
          setCheckoutState((s) => ({
            ...s,
            loading: false,
            ready: true,
            stripe,
            elements,
            subscriptionId: res.subscriptionId || null,
            paymentIntentId: res.paymentIntentId || null,
          }));
        }
      } catch (e) {
        if (!cancelled && checkoutRequestRef.current === requestId) {
          setCheckoutState((s) => ({ ...s, loading: false, error: e?.message || 'Paiement indisponible.' }));
        }
      }
    }, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [checkoutState.open, checkoutState.planKey, checkoutState.success, promoCode]);

  const priceOf = useMemo(() => {
    const map = {};
    plans.forEach((p) => { map[p.cycle] = p.price; });
    return map;
  }, [plans]);

  const slug = resolveTenantSlug();
  const closeCheckout = () => {
    if (stripePaymentElementRef.current) {
      try { stripePaymentElementRef.current.unmount(); } catch { /* noop */ }
      stripePaymentElementRef.current = null;
    }
    setCheckoutState({
      open: false,
      planKey: '',
      loading: false,
      ready: false,
      success: false,
      error: '',
      stripe: null,
      elements: null,
      subscriptionId: null,
      paymentIntentId: null,
    });
  };
  const openCheckout = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set('plan', key);
    next.set('checkout', '1');
    setSearchParams(next, { replace: true });
    setCheckoutState((s) => ({ ...s, open: true, planKey: key, success: false, error: '', ready: false }));
  };
  const confirmCheckout = async () => {
    try {
      if (!checkoutState.stripe || !checkoutState.elements) throw new Error('Le formulaire carte n’est pas encore prêt.');
      setCheckoutState((s) => ({ ...s, loading: true, error: '' }));
      const returnUrl = `${window.location.origin}/liri/forfaits?plan=${encodeURIComponent(checkoutState.planKey)}&checkout=success`;
      const { error, paymentIntent } = await checkoutState.stripe.confirmPayment({
        elements: checkoutState.elements,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      });
      if (error) throw new Error(error.message || 'Paiement refusé.');
      const st = String(paymentIntent?.status || '').toLowerCase();
      if (!['succeeded', 'processing', 'requires_capture'].includes(st)) {
        throw new Error('Paiement en attente de confirmation Stripe.');
      }
      if (checkoutState.subscriptionId) {
        await offeringCheckoutApi.finalizeEmbedded({
          tenantSlug: slug,
          subscriptionId: checkoutState.subscriptionId,
          paymentIntentId: paymentIntent?.id || checkoutState.paymentIntentId || null,
        });
      }
      setCheckoutState((s) => ({ ...s, loading: false, success: true, error: '' }));
    } catch (e) {
      setCheckoutState((s) => ({ ...s, loading: false, error: e?.message || 'Paiement impossible.' }));
    }
  };

  const sel = selected && ORDER.includes(selected) ? selected : RECOMMENDED;
  const d = PLAN[sel];
  const SelIcon = CYCLE_ICON[sel] || Sparkles;
  const selPrice = priceOf[sel];
  const selKey = `${sel}-monthly`;
  const isCurrentSel = sel === cycle;
  const accessHighlights = d.access.slice(0, 4);
  const accessRest = d.access.slice(4);
  const billingNotice = useMemo(() => {
    if (isStaff || !hasForfait) return null;
    const days = billing?.daysRemaining;
    const endLabel = formatDate(billing?.expiresAt);
    if (billing?.status === 'past_due') {
      const graceLabel = formatDate(billing?.graceEndsAt);
      return {
        tone: 'danger',
        title: 'Paiement à régulariser',
        text: graceLabel
          ? `Votre accès reste ouvert pendant la période de grâce, jusqu’au ${graceLabel}.`
          : 'Votre accès est en période de grâce. Régularisez le paiement pour éviter la coupure.',
        cta: 'Régulariser',
      };
    }
    if (billing?.status === 'expired') {
      return {
        tone: 'danger',
        title: 'Forfait expiré',
        text: 'Choisissez un forfait pour rouvrir immédiatement votre espace.',
        cta: 'Choisir un forfait',
      };
    }
    if (billing?.status === 'active' && Number.isFinite(Number(days))) {
      const dLeft = Number(days);
      return {
        tone: dLeft <= 7 ? 'soon' : 'ok',
        title: dLeft <= 7 ? `Renouvellement dans ${dLeft} jour${dLeft > 1 ? 's' : ''}` : 'Forfait actif',
        text: endLabel
          ? `Votre forfait ${label || ''} se renouvelle le ${endLabel}. Stripe tentera le prélèvement automatiquement.`
          : `Votre forfait ${label || ''} est actif.`,
        cta: 'Voir mon compte',
      };
    }
    return null;
  }, [billing?.daysRemaining, billing?.expiresAt, billing?.graceEndsAt, billing?.status, hasForfait, isStaff, label]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 lg:py-12">
      {/* En-tête : forfait courant */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#e58a5f]">{isStaff ? 'Gestion des forfaits' : 'Vos forfaits'}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{isStaff ? 'Les voies de votre école' : 'Choisissez votre voie'}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-relaxed text-white/55">
          Comparez les parcours sans quitter Liri. L’essentiel reste visible,
          les informations longues se déploient seulement lorsque vous en avez besoin.
        </p>
        <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-1.5 text-[12px] text-white/65 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.8)]">
          {isStaff
            ? <>Vous · <span className="ml-1 font-semibold text-white">accès équipe</span></>
            : <>Forfait actuel · <span className="ml-1 font-semibold text-white">{label || 'Membre'}</span></>}
        </div>
      </div>

      {billingNotice && (
        <div
          className={`mx-auto mt-7 flex max-w-4xl flex-col gap-3 rounded-[1.5rem] border px-4 py-3.5 text-left shadow-[0_24px_70px_-55px_rgba(0,0,0,0.95)] sm:flex-row sm:items-center sm:justify-between ${
            billingNotice.tone === 'danger'
              ? 'border-rose-400/25 bg-rose-500/[0.08]'
              : billingNotice.tone === 'soon'
                ? 'border-[#d97757]/35 bg-[#d97757]/[0.08]'
                : 'border-emerald-400/18 bg-emerald-500/[0.045]'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${
              billingNotice.tone === 'danger'
                ? 'border-rose-300/25 bg-rose-400/10 text-rose-200'
                : 'border-[#d97757]/25 bg-[#d97757]/10 text-[#e58a5f]'
            }`}>
              <CalendarClock className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-bold text-white">{billingNotice.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/55">{billingNotice.text}</p>
            </div>
          </div>
          <a
            href="/liri/compte?section=facturation"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-white/14 px-3.5 py-2 text-[12px] font-semibold text-white/75 transition-colors hover:bg-white/[0.06]"
          >
            {billingNotice.cta}
          </a>
        </div>
      )}

      {/* SÉLECTEUR — 4 forfaits */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ORDER.map((key) => {
          const Icon = CYCLE_ICON[key];
          const active = key === sel;
          const current = key === cycle;
          const price = priceOf[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              aria-pressed={active}
              className={`group relative min-h-[116px] rounded-[1.35rem] border px-4 py-4 text-left transition-all duration-200 ${
                active
                  ? 'border-[#d97757]/80 bg-[radial-gradient(circle_at_top_left,rgba(217,119,87,0.2),rgba(42,39,36,0.78)_45%,rgba(28,27,25,0.9))] shadow-[0_24px_70px_-42px_rgba(217,119,87,0.9)]'
                  : 'border-white/8 bg-white/[0.035] hover:border-white/18 hover:bg-white/[0.055]'
              }`}
            >
              {key === RECOMMENDED && (
                <span className="absolute -top-2 right-2.5 rounded-full bg-[#e6cc92] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-[#231208]">
                  ★ Conseillé
                </span>
              )}
              <span className={`flex h-9 w-9 items-center justify-center rounded-2xl border ${active ? 'border-[#d97757]/50 bg-[#d97757]/15 text-[#e58a5f]' : 'border-white/10 bg-black/20 text-white/50 group-hover:text-white/80'}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="mt-3 flex w-full items-center gap-1.5 text-[13px] font-bold text-white">
                {CYCLE_LABEL[key]}
                {current && <Check className="h-3.5 w-3.5 text-[#d97757]" aria-label="forfait actuel" />}
              </span>
              <span className="text-[11px] font-medium tabular-nums text-white/55">
                {price != null ? <>{price} €<span className="text-white/35">/mois</span></> : 'Sur demande'}
              </span>
            </button>
          );
        })}
      </div>

      {/* FICHE DÉTAILLÉE du forfait sélectionné */}
      <motion.div
        key={sel}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(39,35,31,0.96),rgba(28,27,25,0.98))] shadow-[0_30px_90px_-55px_rgba(0,0,0,0.9)]"
      >
        {/* bandeau titre */}
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_280px] lg:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#d97757]/10 blur-3xl" />
          <div className="relative min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d97757]/35 bg-[#d97757]/10 text-[#e58a5f]">
                <SelIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e58a5f]">{CYCLE_KICKER[sel]}</p>
                <h2 className="mt-1 text-3xl font-black leading-tight text-white">{CYCLE_LABEL[sel]}</h2>
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-[17px] font-medium leading-relaxed text-white/88">{d.tagline}</p>
            <div className="mt-6 flex items-start gap-3 rounded-3xl border border-white/8 bg-black/15 p-4">
              <Target className="mt-0.5 h-5 w-5 shrink-0 text-[#e58a5f]" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Pour qui</p>
                <p className="mt-1 text-[14px] leading-relaxed text-white/72">{d.forWhom}</p>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {accessHighlights.map((a) => {
                const Ico = a.icon || Check;
                return (
                  <div key={a.text} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#d97757]/10 text-[#e58a5f]">
                      <Ico className="h-4 w-4" />
                    </span>
                    <span className="text-[13px] leading-snug text-white/78">{a.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="relative rounded-[1.75rem] border border-white/10 bg-black/18 p-5 lg:p-6">
            <div className="flex items-start justify-between gap-3 lg:block">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Abonnement</p>
                {selPrice != null ? (
                  <p className="mt-2 text-4xl font-black tabular-nums text-white">
                    {selPrice} €<span className="text-sm font-normal text-white/40">/mois</span>
                  </p>
                ) : (
                  <p className="mt-2 text-lg font-bold text-white/80">Sur demande</p>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d97757]/30 bg-[#d97757]/10 px-3 py-1.5 text-[11px] font-semibold text-[#e58a5f]">
                <Star className="h-3 w-3" /> −{DISCOUNTS[sel]} %
              </span>
            </div>
            <div className="my-5 h-px bg-white/10" />
            <div className="space-y-2.5 text-[13px] text-white/68">
              {d.avantages.slice(0, 2).map((t) => (
                <p key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> {t}
                </p>
              ))}
            </div>

            {isStaff ? (
              <div className="mt-6 grid gap-3">
                <span className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d97757]/35 bg-[#d97757]/[0.07] px-5 py-3 text-sm font-semibold text-[#e58a5f]">
                  <ShieldCheck className="h-4 w-4" /> Accès complet
                </span>
                <a
                  href="/liri/services"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/14 px-5 py-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/[0.06]"
                >
                  <Settings2 className="h-4 w-4 text-[#d97757]" /> Gérer les tarifs
                </a>
              </div>
            ) : (
              <div className="mt-6 grid gap-3">
                {isCurrentSel ? (
                  <span className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d97757]/40 bg-[#d97757]/[0.08] px-5 py-3 text-sm font-bold text-[#e58a5f]">
                    <Check className="h-4 w-4" /> Forfait actif
                  </span>
                ) : selPrice != null ? (
                  <button
                    type="button"
                    onClick={() => openCheckout(selKey)}
                    className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d97757] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#d97757]/20 transition-colors hover:bg-[#c9673f]"
                  >
                    Souscrire <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ) : null}
                <a
                  href={RDV_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/14 px-5 py-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/[0.06]"
                >
                  <PhoneCall className="h-4 w-4 text-[#d97757]" /> Rendez-vous
                </a>
                <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-white/35">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Paiement Stripe intégré dans Liri.
                </p>
              </div>
            )}
          </aside>

          <div className="lg:col-span-2">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-left text-sm font-semibold text-white/72 transition-colors hover:bg-white/[0.05]"
            >
              Voir le détail complet du forfait
              <ChevronDown className={`h-4 w-4 text-[#e58a5f] transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
            </button>

            {detailsOpen && (
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                {accessRest.length > 0 && (
                  <div className="rounded-3xl border border-white/8 bg-black/12 p-4">
                    <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                      <Sparkles className="h-4 w-4 text-[#d97757]" /> Accès complémentaires
                    </p>
                    <div className="space-y-2">
                      {accessRest.map((a) => {
                        const Ico = a.icon || Check;
                        return (
                          <p key={a.text} className="flex items-start gap-2 text-[13px] leading-snug text-white/68">
                            <Ico className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e58a5f]" /> {a.text}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="rounded-3xl border border-white/8 bg-black/12 p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">À retenir</p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <ul className="space-y-2">
                      {d.avantages.map((t) => (
                        <li key={t} className="flex items-start gap-2 text-[13px] leading-snug text-white/70">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />{t}
                        </li>
                      ))}
                    </ul>
                    <ul className="space-y-2 border-t border-white/8 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-4">
                      {d.limites.map((t) => (
                        <li key={t} className="flex items-start gap-2 text-[13px] leading-snug text-white/50">
                          <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300/70" />{t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {checkoutState.open && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md" role="dialog" aria-modal="true">
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/12 bg-[#221f1c] p-5 shadow-2xl shadow-black/50 sm:p-6">
            <button
              type="button"
              onClick={closeCheckout}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white"
              aria-label="Fermer le paiement"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e58a5f]">Liri Portail · Paiement intégré</p>
            <h3 className="mt-2 pr-10 text-xl font-black text-white">Souscrire à {CYCLE_LABEL[String(checkoutState.planKey).replace(/-monthly$/, '')] || 'ce forfait'}</h3>
            <p className="mt-1 text-sm text-white/60">La carte est saisie ici, dans le portail officiel. Aucune donnée bancaire n’est stockée par Prorascience.</p>

            {checkoutState.success ? (
              <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-100">
                <p className="flex items-center gap-2 font-bold"><Check className="h-5 w-5" /> Paiement confirmé</p>
                <p className="mt-2 text-sm text-emerald-100/80">Votre accès est débloqué. Rechargez le portail si votre nouveau forfait n’apparaît pas immédiatement.</p>
              </div>
            ) : (
              <>
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  {checkoutState.loading && !checkoutState.ready && (
                    <div className="flex items-center gap-2 py-8 text-sm text-white/70">
                      <Loader2 className="h-4 w-4 animate-spin text-[#d97757]" /> Initialisation de la carte…
                    </div>
                  )}
                  <div ref={stripeMountRef} className={checkoutState.ready ? 'min-h-[110px]' : 'min-h-[1px]'} />
                </div>
                {checkoutState.error && (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {checkoutState.error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={confirmCheckout}
                  disabled={!checkoutState.ready || checkoutState.loading}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#c9673f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutState.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Confirmer le paiement dans Liri Portail
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* COURS PAR MODULE — boutique + événements + grille de réductions */}
      <div className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#d97757]/25 bg-[#d97757]/10 text-[#d97757]">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Modules à la carte</h3>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-white/52">
                Des compétences précises, en complément du forfait. Votre réduction actuelle :
                <span className="font-bold text-[#e58a5f]"> −{DISCOUNTS[sel]} %</span>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MODULE_EXAMPLES.map((m) => {
                  const Ico = m.icon;
                  return (
                    <span key={m.text} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-[12px] text-white/68">
                      <Ico className="h-3.5 w-3.5 text-[#d97757]" /> {m.text}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <a
            href={isStaff ? '/liri/mbolo/produits' : BOUTIQUE_URL}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/14 px-4 py-2.5 text-sm font-semibold text-white/75 transition-colors hover:bg-white/[0.06]"
          >
            {isStaff ? 'Gérer les modules' : 'Explorer la boutique'}
            <ArrowRight className="h-4 w-4 text-[#d97757]" />
          </a>
        </div>
      </div>
    </div>
  );
}
