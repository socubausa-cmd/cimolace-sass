import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, ChevronDown, Loader2, Wallet, Coins, AlertTriangle, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { Badge } from '@/components/ui/badge';
import { getNgowazuluMentoratOffer } from '@/config/ngowazuluMentoratOffers';
import { getBillingCheckoutPath, getPayerPath } from '@/lib/eleveBillingPath';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EV_PAGE_AMBIENT } from '@/pages/eleve-mobile/eleveMobileScreensShared';

const NGOWAZULU_OPENING_PLAN_SLUG = 'ngowazulu-ouverture-recouvrement';
const DEFAULT_OPENING_FEE_EUR = 100;

const PAYMENT_METHODS = [
  {
    id: 'chariow',
    label: 'Chariow',
    description: 'Checkout sécurisé Chariow (carte bancaires)',
    icon: CreditCard,
  },
];

const COUNTRY_OPTIONS = [
  { name: 'Cameroun', code: 'CM' },
  { name: 'Congo (RDC)', code: 'CD' },
  { name: 'Congo (Brazzaville)', code: 'CG' },
  { name: 'Cote d Ivoire', code: 'CI' },
  { name: 'Senegal', code: 'SN' },
  { name: 'Mali', code: 'ML' },
  { name: 'Gabon', code: 'GA' },
  { name: 'France', code: 'FR' },
  { name: 'Belgique', code: 'BE' },
  { name: 'Suisse', code: 'CH' },
  { name: 'Canada', code: 'CA' },
  { name: 'Etats-Unis', code: 'US' },
  { name: 'Royaume-Uni', code: 'GB' },
  { name: 'Allemagne', code: 'DE' },
  { name: 'Italie', code: 'IT' },
  { name: 'Espagne', code: 'ES' },
  { name: 'Portugal', code: 'PT' },
  { name: 'Maroc', code: 'MA' },
  { name: 'Tunisie', code: 'TN' },
  { name: 'Algerie', code: 'DZ' },
  { name: 'Nigeria', code: 'NG' },
  { name: 'Ghana', code: 'GH' },
  { name: 'Kenya', code: 'KE' },
  { name: 'Afrique du Sud', code: 'ZA' },
  { name: 'Emirats Arabes Unis', code: 'AE' },
  { name: 'Arabie Saoudite', code: 'SA' },
  { name: 'Inde', code: 'IN' },
  { name: 'Chine', code: 'CN' },
  { name: 'Japon', code: 'JP' },
  { name: 'Bresil', code: 'BR' },
];

/** Ordre fixe (A→Z) pour le sélecteur Chariow — ne pas compter sur le désordre du <datalist> mobile. */
const COUNTRY_OPTIONS_FR_SORTED = [...COUNTRY_OPTIONS].sort((a, b) =>
  a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
);

function stripDiacritics(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matchesCountryQuery(name, code, qRaw) {
  const q = stripDiacritics(String(qRaw || '').toLowerCase().trim());
  if (!q) return true;
  return (
    stripDiacritics(name)
      .toLowerCase()
      .includes(q) || code.toLowerCase().includes(q)
  );
}

/**
 * Liste filtrable + triée : clic pour ouvrir, saisie pour filtrer, choix explicite du nom affiché.
 */
function ChariowCountryPicker({ optionsSorted, countryNameByCode, value, onSelect }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const filterInputRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const id = window.requestAnimationFrame(() => {
      filterInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return optionsSorted;
    return optionsSorted.filter((c) => matchesCountryQuery(c.name, c.code, query));
  }, [query, optionsSorted]);

  const label = countryNameByCode.get(value) || value;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery('');
      }}
    >
      <div>
        <label className="text-xs text-gray-400">Pays (liste triée, recherche possible)</label>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="mt-1 flex h-10 w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-[#0F1419] px-3 text-left text-sm text-white"
          >
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{label}</span>
              <span className="text-white/50"> {value ? `· ${value}` : ''}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="w-[min(100vw-2rem,22rem)] max-h-[min(24rem,70dvh)] overflow-hidden border-white/10 bg-[#0F1419] p-0"
        align="start"
        sideOffset={4}
      >
        <div className="border-b border-white/10 p-2">
          <input
            ref={filterInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par nom ou code (ex. fr, sénégal)…"
            className="h-9 w-full rounded-md border border-white/10 bg-black/35 px-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Filtrer les pays"
          />
        </div>
        <ul className="max-h-[min(18rem,50dvh)] overflow-y-auto py-1" role="listbox" aria-label="Pays Chariow">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-white/50">Aucun pays ne correspond</li>
          ) : (
            filtered.map((c) => {
              const selected = c.code === value;
              return (
                <li key={c.code} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={cn(
                      'w-full px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/10',
                      selected && 'bg-[#D4AF37]/20 text-[#f0e6d0]',
                    )}
                    onClick={() => {
                      onSelect(c.code);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    {c.name}
                    <span className="ml-1.5 text-[11px] text-white/45">({c.code})</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

const WEB_BG = '#0F1419';
const GOLD = '#D4AF37';

export default function PaymentActionPage({ layout = 'web' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const isElevePayer = layout === 'eleve';

  const [selectedMethod, setSelectedMethod] = useState('chariow');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPhoneCountryCode, setCustomerPhoneCountryCode] = useState('CM');
  const [countryNameInput, setCountryNameInput] = useState('Cameroun');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const planId = useMemo(() => String(params.get('plan') || '').trim(), [params]);
  const interval = useMemo(() => String(params.get('interval') || '').trim(), [params]);
  const subscriptionId = useMemo(() => String(params.get('renew') || params.get('subscriptionId') || '').trim(), [params]);
  const nextPlan = useMemo(() => String(params.get('nextPlan') || '').trim(), [params]);
  const nextInterval = useMemo(() => String(params.get('nextInterval') || 'monthly').trim(), [params]);
  const nextPath = useMemo(() => String(params.get('next') || '').trim(), [params]);
  const isRenewal = Boolean(subscriptionId);
  const [planPreview, setPlanPreview] = useState(null);
  const [openingPlanPreview, setOpeningPlanPreview] = useState(null);
  const [hasPaidNgowazuluOpening, setHasPaidNgowazuluOpening] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [paymentFlow, setPaymentFlow] = useState('single'); // single | split
  const canSubmit = Boolean(planId && interval);
  const isChariowMethod = selectedMethod === 'chariow';
  const isNgowazuluMentoratPlan = /^ngowazulu-mentorat-/.test(planId);
  const isNgowazuluMentoratMonthly = isNgowazuluMentoratPlan && interval === 'monthly';
  const ngowazuluOffer = useMemo(() => getNgowazuluMentoratOffer(planId), [planId]);
  const countryCodeByName = useMemo(() => {
    const map = new Map();
    for (const item of COUNTRY_OPTIONS) {
      map.set(item.name.toLowerCase(), item.code);
    }
    return map;
  }, []);
  const countryNameByCode = useMemo(() => {
    const map = new Map();
    for (const item of COUNTRY_OPTIONS) {
      map.set(item.code, item.name);
    }
    return map;
  }, []);
  const quickCountryOptions = useMemo(
    () =>
      ['CM', 'GA', 'CG', 'CD', 'CI', 'SN', 'FR', 'BE', 'CA'].map((code) => ({
        value: code,
        label: countryNameByCode.get(code) || code,
        badge: code,
        icon: Wallet,
      })),
    [countryNameByCode]
  );
  const openingFeeAmount = Number(openingPlanPreview?.price_amount || DEFAULT_OPENING_FEE_EUR);
  const monthlyAmount = Number(planPreview?.price_amount || ngowazuluOffer?.priceAmount || 0);
  const showFlowSelector = isNgowazuluMentoratMonthly && !hasPaidNgowazuluOpening && !isChariowMethod;
  const forceTwoSteps = isNgowazuluMentoratMonthly && !hasPaidNgowazuluOpening && (isChariowMethod || paymentFlow === 'split');
  const estimatedMentoratTotal = Number(monthlyAmount + (hasPaidNgowazuluOpening ? 0 : openingFeeAmount));

  React.useEffect(() => {
    let alive = true;
    const loadProfilePhone = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id || !alive) return;
      const { data } = await supabase
        .from('profiles')
        .select('phone,phone_country_code')
        .eq('id', user.id)
        .maybeSingle();
      if (!alive) return;
      setCustomerPhone(String(data?.phone || user?.phone || '').replace(/\D+/g, ''));
      const code = String(data?.phone_country_code || user?.user_metadata?.phone_country_code || 'CM').toUpperCase();
      setCustomerPhoneCountryCode(code);
      setCountryNameInput(countryNameByCode.get(code) || 'Cameroun');
    };
    loadProfilePhone();
    return () => {
      alive = false;
    };
  }, [countryNameByCode]);

  React.useEffect(() => {
    let alive = true;
    const loadPlan = async () => {
      if (!planId || !/^ngowazulu-mentorat-/.test(planId)) {
        setPlanPreview(null);
        return;
      }
      const { data } = await supabase
        .from('billing_plans')
        .select('slug,name,price_amount,price_currency,interval_type')
        .eq('slug', planId)
        .maybeSingle();
      if (!alive) return;
      setPlanPreview(data || null);
    };
    loadPlan();
    return () => {
      alive = false;
    };
  }, [planId]);

  React.useEffect(() => {
    let alive = true;
    const loadNgowazuluCartContext = async () => {
      if (!isNgowazuluMentoratMonthly) {
        if (!alive) return;
        setOpeningPlanPreview(null);
        setHasPaidNgowazuluOpening(false);
        setCartLoading(false);
        return;
      }
      setCartLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: openingPlan } = await supabase
          .from('billing_plans')
          .select('id,slug,name,price_amount,price_currency,interval_type')
          .eq('slug', NGOWAZULU_OPENING_PLAN_SLUG)
          .maybeSingle();

        let hasOpening = false;
        if (user?.id && openingPlan?.id) {
          const { count } = await supabase
            .from('billing_invoices')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', user.id)
            .eq('subscription_id', openingPlan.id)
            .eq('status', 'paid');
          hasOpening = (count || 0) > 0;
        }

        if (!alive) return;
        setOpeningPlanPreview(openingPlan || null);
        setHasPaidNgowazuluOpening(hasOpening);
        if (hasOpening) setPaymentFlow('single');
      } finally {
        if (alive) setCartLoading(false);
      }
    };
    loadNgowazuluCartContext();
    return () => {
      alive = false;
    };
  }, [isNgowazuluMentoratMonthly, session?.user?.id]);

  React.useEffect(() => {
    const normalizedCountryName = String(countryNameInput || '').trim().toLowerCase();
    const codeFromName = countryCodeByName.get(normalizedCountryName) || '';
    if (codeFromName && codeFromName !== customerPhoneCountryCode) {
      setCustomerPhoneCountryCode(codeFromName);
    }
  }, [countryNameInput, countryCodeByName, customerPhoneCountryCode]);

  const getFreshAccessToken = async () => {
    const { data: current } = await supabase.auth.getSession();
    let liveSession = current?.session || null;
    if (!liveSession?.access_token) return null;

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = Number(liveSession.expires_at || 0);
    const isExpiringSoon = !expiresAt || expiresAt - now < 45;
    if (isExpiringSoon) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshed?.session?.access_token) {
        liveSession = refreshed.session;
      }
    }
    return liveSession?.access_token || null;
  };

  const doCreatePaymentRequest = ({
    token,
    targetPlanId,
    targetInterval,
    targetNextPlan,
    targetNextInterval,
  }) =>
    fetch(isRenewal ? '/.netlify/functions/billing-create-renewal-checkout' : '/.netlify/functions/billing-create-initial-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        planId: targetPlanId,
        interval: targetInterval,
        paymentMethod: selectedMethod,
        subscriptionId: isRenewal ? subscriptionId : undefined,
        customerPhone: customerPhone || undefined,
        customerPhoneCountryCode: customerPhoneCountryCode || undefined,
        nextPlan: targetNextPlan || undefined,
        nextInterval: targetNextInterval || undefined,
      }),
    });

  const handleCreatePayment = async () => {
    if (!canSubmit) return;
    if (isChariowMethod) {
      const cleanPhone = String(customerPhone || '').replace(/\D+/g, '');
      const normalizedCountryName = String(countryNameInput || '').trim().toLowerCase();
      const codeFromName = countryCodeByName.get(normalizedCountryName) || '';
      const cleanIso = String(codeFromName || customerPhoneCountryCode || '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(cleanIso)) {
        setError('Pays invalide. Choisis un pays dans la liste (ex: Cameroun, France, Etats-Unis).');
        return;
      }
      if (!/^\d{8,15}$/.test(cleanPhone)) {
        setError('Numero invalide. Entre 8 a 15 chiffres sans espace (ex: 670000000).');
        return;
      }
      setCountryNameInput(countryNameByCode.get(cleanIso) || countryNameInput);
      setCustomerPhone(cleanPhone);
      setCustomerPhoneCountryCode(cleanIso);
    }
    setSubmitting(true);
    setError('');
    try {
      const shouldStartWithOpening = forceTwoSteps && !isRenewal;
      const targetPlanId = shouldStartWithOpening ? NGOWAZULU_OPENING_PLAN_SLUG : planId;
      const targetInterval = shouldStartWithOpening ? 'one_time' : interval;
      const targetNextPlan = shouldStartWithOpening ? planId : nextPlan;
      const targetNextInterval = shouldStartWithOpening ? 'monthly' : nextInterval;

      let accessToken = await getFreshAccessToken();
      if (!accessToken) {
        throw new Error('Session expirée. Connecte-toi de nouveau puis réessaie.');
      }

      let res = await doCreatePaymentRequest({
        token: accessToken,
        targetPlanId,
        targetInterval,
        targetNextPlan,
        targetNextInterval,
      });
      if (res.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        accessToken = refreshed?.session?.access_token || accessToken;
        res = await doCreatePaymentRequest({
          token: accessToken,
          targetPlanId,
          targetInterval,
          targetNextPlan,
          targetNextInterval,
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur de creation du paiement');
      if (data?.ngowazuluRequiresOpeningFirst && data?.continueUrl) {
        const safeNext = nextPath.startsWith('/') ? nextPath : '';
        let go = data.continueUrl;
        if (isElevePayer && typeof go === 'string' && go.startsWith('/paiements/payer')) {
          const i = go.indexOf('?');
          go = getPayerPath(i >= 0 ? go.slice(i + 1) : '');
        }
        const carryNext = safeNext ? `${go}${go.includes('?') ? '&' : '?'}next=${encodeURIComponent(safeNext)}` : go;
        navigate(carryNext);
        return;
      }
      const paymentId = data?.payment?.id;
      if (!paymentId) throw new Error('Paiement cree mais identifiant manquant');
      const chainParts = [];
      if (targetNextPlan && !isRenewal) {
        chainParts.push(`nextPlan=${encodeURIComponent(targetNextPlan)}`);
        chainParts.push(`nextInterval=${encodeURIComponent(targetNextInterval || 'monthly')}`);
      }
      if (nextPath.startsWith('/')) {
        chainParts.push(`next=${encodeURIComponent(nextPath)}`);
      }
      const chainQs = chainParts.length ? `?${chainParts.join('&')}` : '';
      navigate(`${getBillingCheckoutPath(paymentId)}${chainQs}`);
    } catch (e) {
      const msg = String(e?.message || 'Erreur de paiement');
      if (msg.toLowerCase().includes('invalid token')) {
        setError('Session invalide. Déconnecte-toi, reconnecte-toi, puis relance le paiement.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!isElevePayer || typeof document === 'undefined') return;
    const p = document.title;
    document.title = 'Paiement · LIRI';
    return () => {
      document.title = p;
    };
  }, [isElevePayer]);

  const formColumn = (
    <>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-panel rounded-2xl border border-white/10 p-4 md:p-5"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 mb-2">Paiement sécurisé</Badge>
              <h1 className="text-2xl md:text-3xl font-bold">Effectuer un Paiement</h1>
              <p className="text-gray-400 text-sm mt-1">
                Choisis le moyen de paiement puis confirme tes informations.
              </p>
            </div>
            <Link to={isElevePayer ? ELEVE_MOBILE.home : '/forfaits'}>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/5">
                {isElevePayer ? 'Accueil' : 'Retour aux forfaits'}
              </Button>
            </Link>
          </div>
        </motion.div>

        <Card className="premium-panel bg-[#192734] border-white/10">
          <CardHeader>
            <CardTitle className="text-2xl">Choix du moyen de paiement</CardTitle>
            <CardDescription className="text-gray-400">
              {isRenewal
                ? 'Choisis le moyen de paiement pour renouveler ton abonnement.'
                : 'Choisis le moyen de paiement pour continuer ton abonnement.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!planId || !interval ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                <div>
                  Lien de paiement incomplet (plan ou interval manquant). Retourne a la page Forfaits.
                </div>
              </div>
            ) : null}

            {nextPlan && planId === NGOWAZULU_OPENING_PLAN_SLUG ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100 text-sm">
                Après confirmation de cette étape (frais de configuration), vous pourrez enchaîner vers le contrat mentorat choisi depuis l&apos;écran de confirmation.
              </div>
            ) : null}

            {isNgowazuluMentoratMonthly ? (
              <div className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-4 text-sm text-amber-100 space-y-3">
                <p className="font-semibold text-white mb-1">Panier automatique mentorat — {ngowazuluOffer?.commercialName || 'contrat mensuel'}</p>
                {cartLoading ? (
                  <p className="text-amber-100/80">Calcul du panier en cours…</p>
                ) : (
                  <>
                    <div className="rounded-lg border border-white/15 bg-black/20 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-300">Contrat {ngowazuluOffer?.commercialName || 'Mentorat'} ({ngowazuluOffer?.frequencyShort || 'mensuel'})</span>
                        <span className="text-white font-semibold">{monthlyAmount || 0} EUR</span>
                      </div>
                      {!hasPaidNgowazuluOpening ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-300">Frais de configuration (unique)</span>
                          <span className="text-white font-semibold">{openingFeeAmount || DEFAULT_OPENING_FEE_EUR} EUR</span>
                        </div>
                      ) : null}
                      <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-white font-semibold">Total estimé de cette phase</span>
                        <span className="text-[#D4AF37] font-bold text-base">
                          {forceTwoSteps ? (openingFeeAmount || DEFAULT_OPENING_FEE_EUR) : estimatedMentoratTotal} EUR
                        </span>
                      </div>
                    </div>
                    {showFlowSelector ? (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wider text-amber-100/75">Mode de paiement du premier mois</p>
                        <PremiumSegmentedSelector
                          value={paymentFlow}
                          onChange={setPaymentFlow}
                          options={[
                            { value: 'single', label: 'Paiement unique', badge: 'Configuration + mois dans la même transaction', icon: Wallet },
                            { value: 'split', label: '2 étapes', badge: "D'abord configuration, puis page de paiement du mois", icon: CreditCard },
                          ]}
                          layoutId="ngowazulu-payment-flow-selector"
                          compact
                        />
                      </div>
                    ) : null}
                    {isChariowMethod && !hasPaidNgowazuluOpening ? (
                      <p className="text-xs text-amber-100/85">
                        Chariow applique automatiquement le parcours en 2 étapes : inscription/configuration puis contrat mensuel.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {!session?.access_token ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                <div>Connecte-toi pour lancer le paiement.</div>
              </div>
            ) : null}

            <PremiumSegmentedSelector
              value={selectedMethod}
              onChange={setSelectedMethod}
              options={PAYMENT_METHODS.map((method) => ({
                value: method.id,
                label: method.label,
                badge: method.description,
                icon: method.icon,
              }))}
              layoutId="payment-action-method-segment-pill"
            />

            {isChariowMethod ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
                <p className="text-sm text-gray-300">
                  Chariow requiert un numero valide pour tous les pays (meme paiement carte). 
                  Choisis le pays dans la liste, puis entre le numero (chiffres uniquement).
                </p>
                <PremiumSegmentedSelector
                  value={customerPhoneCountryCode}
                  onChange={(code) => {
                    setCustomerPhoneCountryCode(code);
                    setCountryNameInput(countryNameByCode.get(code) || code);
                  }}
                  options={quickCountryOptions}
                  layoutId="payment-action-country-segment-pill"
                  compact
                  showChevron={false}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <ChariowCountryPicker
                      optionsSorted={COUNTRY_OPTIONS_FR_SORTED}
                      countryNameByCode={countryNameByCode}
                      value={customerPhoneCountryCode}
                      onSelect={(code) => {
                        setCustomerPhoneCountryCode(String(code).toUpperCase());
                        setCountryNameInput(countryNameByCode.get(String(code).toUpperCase()) || String(code).toUpperCase());
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-400">
                      Telephone (Code: {customerPhoneCountryCode || '--'})
                    </label>
                    <input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(String(e.target.value || '').replace(/\D+/g, ''))}
                      className="mt-1 w-full h-10 rounded-md bg-[#0F1419] border border-white/10 px-3 text-white"
                      placeholder="670000000"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-gray-300">
              <div className="flex items-center justify-between gap-2">
                <span>Plan</span>
                <span className="font-mono text-xs text-gray-400">{planId}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span>Fréquence</span>
                <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">{interval}</Badge>
              </div>
              {isNgowazuluMentoratMonthly && !hasPaidNgowazuluOpening ? (
                <div className="mt-2 text-xs text-gray-400">
                  Parcours choisi: {forceTwoSteps ? '2 étapes (inscription puis mois)' : 'paiement unique (inscription + mois)'}.
                </div>
              ) : null}
              {isRenewal ? <div>Renouvellement abonnement: {subscriptionId}</div> : null}
            </div>

            {isNgowazuluMentoratMonthly ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                <p className="font-semibold text-emerald-50 mb-1">Ce qui va se passer</p>
                {hasPaidNgowazuluOpening ? (
                  <p>
                    Vos frais de configuration sont déjà réglés. Cette page lance directement le paiement du contrat mensuel.
                  </p>
                ) : forceTwoSteps ? (
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Vous payez d&apos;abord les frais d&apos;inscription/configuration.</li>
                    <li>Après confirmation, un bouton vous emmène sur la page pour payer le mois de contrat.</li>
                    <li>La facture est séparée en 2 étapes pour une lecture claire.</li>
                  </ol>
                ) : (
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Le système calcule le contrat {ngowazuluOffer?.commercialName || 'mentorat'}.</li>
                    <li>Il ajoute automatiquement les frais de configuration (premier achat seulement).</li>
                    <li>Vous payez le total en une transaction avec détail visible sur la facture.</li>
                  </ol>
                )}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                onClick={handleCreatePayment}
                disabled={!canSubmit || submitting}
                className="bg-[#D4AF37] text-black hover:bg-[#c4a030] font-bold shadow-lg shadow-[#D4AF37]/20"
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Continuer vers le paiement
              </Button>
              {isElevePayer ? (
                <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5">
                  <Link to="/forfaits">Forfaits (site web)</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5">
                  <Link to="/forfaits">Retour aux forfaits</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
    </>
  );

  if (isElevePayer) {
    return (
      <EleveMobileShell
        user={user}
        notificationCount={inboxUnread}
        hideHeader
        hideTabBar
        contentClassName="!px-0"
      >
        <div
          className="flex w-full flex-1 flex-col"
          style={{ minHeight: '100dvh', backgroundColor: WEB_BG, backgroundImage: EV_PAGE_AMBIENT }}
        >
          <div className="pointer-events-none fixed inset-0 -z-10">
            <div
              className="absolute left-1/2 top-0 h-[200px] w-[min(100vw,520px)] -translate-x-1/2 rounded-full opacity-90"
              style={{ background: `${GOLD}10`, filter: 'blur(80px)' }}
            />
          </div>
          <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
            <LiriStatusBar />
          </div>
          <header
            className="sticky top-0 z-20 grid grid-cols-3 items-center border-b border-white/10 px-2 py-3 sm:px-4"
            style={{ background: 'rgba(21, 26, 33, 0.88)', backdropFilter: 'blur(16px)' }}
          >
            <div className="flex min-w-0 justify-start">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex min-w-0 items-center gap-0.5 py-1.5 pl-1 pr-1 text-sm text-white/50 transition hover:text-white"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Retour</span>
              </button>
            </div>
            <div className="flex justify-center">
              <div className="flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                <span className="truncate text-[10px] text-white/50">Paiement</span>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate(ELEVE_MOBILE.home)}
                className="pr-1 text-[11px] font-semibold text-violet-300/90 transition hover:text-white"
              >
                Accueil
              </button>
            </div>
          </header>
          <div className="relative z-10 mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
            {formColumn}
          </div>
        </div>
      </EleveMobileShell>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0F1419] px-4 pb-16 pt-24 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-24 left-1/2 h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-[#D4AF37]/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[280px] w-[280px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>
      <Helmet>
        <title>Effectuer un Paiement | PRORASCIENCE</title>
      </Helmet>
      <div className="relative z-10 mx-auto max-w-3xl space-y-6">
        {formColumn}
      </div>
    </div>
  );
}