import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { getApiBaseUrl } from '@/lib/apiBase';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { offeringCheckoutApi } from '@/lib/api-v2';
import { supabase } from '@/lib/customSupabaseClient';
import { getNgowazuluMentoratOffer } from '@/config/ngowazuluMentoratOffers';
import { NGOWAZULU_CONSULTATION_PLAN_SLUG } from '@/config/ngowazuluConsultation';

// Les opérateurs Mobile Money sont chargés EN DIRECT depuis l'API (config PawaPay réelle
// du compte marchand) — fini la liste figée qui proposait des opérateurs non activés.

export default function PaiementPage() {
  const { tenantSlug } = useParams();
  const [searchParams] = useSearchParams();
  const planSlug = searchParams.get('plan') || '';
  const typeParam = searchParams.get('type') || '';
  const next = searchParams.get('next') || ''; // 'reserver' → après paiement, prise de RDV

  // Nom du tenant (branding) → affiché à la place du « PRORASCIENCE » codé en dur.
  const [brandName, setBrandName] = useState('');
  useEffect(() => {
    const s = tenantSlug || DEFAULT_TENANT_SLUG;
    fetch(`${getApiBaseUrl()}/tenants/by-slug/${encodeURIComponent(s)}/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setBrandName((b?.data ?? b)?.name || ''))
      .catch(() => {});
  }, [tenantSlug]);
  const BRAND = brandName || 'PRORASCIENCE';

  // Détermine la nature de l'offre depuis les query params
  const baseOffer = useMemo(() => {
    if (typeParam === 'don') {
      return { kind: 'donation', title: 'Offrande libre', subtitle: 'Soutenez le temple PRORASCIENCE', amountEditable: true, fixedLabel: null };
    }
    if (planSlug === NGOWAZULU_CONSULTATION_PLAN_SLUG) {
      return { kind: 'consultation', title: 'Consultation Ngowazulu', subtitle: 'Séance individuelle de 90 minutes', amountEditable: true, fixedLabel: null };
    }
    const mentorat = getNgowazuluMentoratOffer(planSlug);
    if (mentorat) {
      return {
        kind: 'subscription',
        title: `Mentorat ${mentorat.commercialName}`,
        subtitle: `${mentorat.subtitle} · ${mentorat.frequencyShort}`,
        amountEditable: false,
        fixedLabel: mentorat.priceLabel,
      };
    }
    // Cycle d'initiation / forfait école (billing_plans) — abonnement mensuel, montant calculé serveur.
    // Reconnu via ?type=subscription ou via la clé de cycle (autonome-/academique-/prive-/privilegie-).
    if (
      typeParam === 'subscription' ||
      /^(autonome|academique|prive|privilegie)-/.test(String(planSlug || '').toLowerCase())
    ) {
      return {
        kind: 'subscription',
        title: searchParams.get('label') || 'Forfait PRORASCIENCE',
        subtitle: 'Cycle d’initiation — abonnement mensuel, accès complet',
        amountEditable: false,
        fixedLabel: searchParams.get('priceLabel') || null,
      };
    }
    return { kind: 'donation', title: 'Paiement PRORASCIENCE', subtitle: 'Choisissez votre contribution', amountEditable: true, fixedLabel: null };
  }, [planSlug, typeParam, searchParams]);

  const [method, setMethod] = useState('card'); // 'card' (Stripe) | 'mobile_money' (PawaPay)
  const [amountEur, setAmountEur] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '', depositId: null });
  const cardReturn = searchParams.get('card'); // 'success' | 'cancel' au retour de Stripe
  const paypalReturn = searchParams.get('paypal'); // 'success' | 'cancel' au retour de PayPal
  const paypalOrderId = searchParams.get('token'); // PayPal renvoie ?token=<orderId>
  // 'idle' | 'capturing' | 'done' | 'error' — capture de l'ordre PayPal au retour.
  const [paypalCapture, setPaypalCapture] = useState('idle');

  // Au retour de PayPal (paypal=success + token), on CAPTURE l'ordre côté serveur
  // (le fulfillment — abonnement + accès — se fait à la capture, jamais avant).
  useEffect(() => {
    if (paypalReturn !== 'success' || !paypalOrderId) return;
    let alive = true;
    setPaypalCapture('capturing');
    offeringCheckoutApi.capturePaypal(paypalOrderId)
      .then((res) => {
        if (!alive) return;
        setPaypalCapture(res?.isCompleted ? 'done' : 'error');
      })
      .catch(() => alive && setPaypalCapture('error'));
    return () => { alive = false; };
  }, [paypalReturn, paypalOrderId]);

  // Service réservable payé (carte/PayPal) + next=reserver → enchaîne vers le choix
  // du créneau (l'access_pass est posé au webhook ; le gate serveur le vérifiera).
  useEffect(() => {
    const paid = cardReturn === 'success' || paypalCapture === 'done';
    if (!paid || next !== 'reserver' || !planSlug) return undefined;
    const t = setTimeout(() => {
      window.location.assign(
        `/t/${tenantSlug || DEFAULT_TENANT_SLUG}/reserver?service=${encodeURIComponent(planSlug)}`,
      );
    }, 1400);
    return () => clearTimeout(t);
  }, [cardReturn, paypalCapture, next, planSlug, tenantSlug]);

  // Modèle d'accès du service (lu depuis billing_plans) : free/community → débloqué SANS paiement.
  const [accessModel, setAccessModel] = useState(null);
  const [planInfo, setPlanInfo] = useState(null);
  const [claiming, setClaiming] = useState(false);
  useEffect(() => {
    if (!planSlug) { setAccessModel('paid'); return undefined; }
    let alive = true;
    supabase
      .from('billing_plans')
      .select('access_model, label, price_cents, currency, category, billing_cycle, metadata')
      .eq('key', planSlug)
      .maybeSingle()
      .then(({ data }) => { if (alive) { setAccessModel(data?.access_model || 'paid'); setPlanInfo(data || null); } })
      .catch(() => { if (alive) setAccessModel('paid'); });
    return () => { alive = false; };
  }, [planSlug]);
  const isFreeAccess = accessModel === 'free' || accessModel === 'community';

  // ── Service marketplace à PRIX FIXE (consultation/coaching/masterclass) ──────
  // Un plan du catalogue avec price_cents>0 = montant NON éditable = le prix du
  // service (pas une offrande libre). Additif : ISNA (don/cycle/mentorat) inchangé.
  const fmtEur = (cents, cur) => {
    const c = Number(cents || 0) / 100;
    const u = String(cur || 'EUR').toUpperCase();
    if (u === 'XAF' || u === 'XOF') return `${Math.round(c * 100 / 100).toLocaleString('fr')} FCFA`;
    return `${c.toLocaleString('fr', { minimumFractionDigits: 0 })} ${u === 'EUR' ? '€' : u === 'USD' ? '$' : u}`;
  };
  const SERVICE_CATS = ['consultation', 'mentorat', 'masterclass', 'custom'];
  const isFixedService =
    !!planInfo && Number(planInfo.price_cents || 0) > 0 &&
    SERVICE_CATS.includes(String(planInfo.category || '')) && !isFreeAccess;
  const fixedAmountCents = isFixedService ? Number(planInfo.price_cents) : null;
  const isMonthly = isFixedService && planInfo.billing_cycle === 'monthly';
  const offer = isFixedService
    ? {
        kind: isMonthly ? 'subscription' : 'consultation',
        title: planInfo.label || baseOffer.title,
        subtitle: isMonthly ? 'Prestation — abonnement mensuel' : 'Prestation — paiement unique',
        amountEditable: false,
        fixedLabel: fmtEur(planInfo.price_cents, planInfo.currency),
      }
    : baseOffer;

  const handleClaimFree = async () => {
    setClaiming(true);
    try {
      await offeringCheckoutApi.claimFree({ planSlug });
      window.location.assign(
        next === 'reserver' && planSlug
          ? `/t/${tenantSlug || DEFAULT_TENANT_SLUG}/reserver?service=${encodeURIComponent(planSlug)}`
          : '/student-school-life/dashboard',
      );
    } catch (err) {
      setStatus({ state: 'error', message: err?.message || "Impossible de débloquer l'accès.", depositId: null });
      setClaiming(false);
    }
  };

  // Opérateurs Mobile Money en direct (config PawaPay réelle) : pays → opérateurs.
  const [mmConfig, setMmConfig] = useState(null); // { countries: [...] } | null
  const [mmLoading, setMmLoading] = useState(false);
  const [mmCountry, setMmCountry] = useState('');
  const [mmOperator, setMmOperator] = useState('');

  // Chargé à la 1re bascule vers Mobile Money (la carte n'en a pas besoin).
  useEffect(() => {
    // ⚠️ NE PAS mettre mmLoading dans les deps : setMmLoading(true) ci-dessous
    // relancerait l'effet, dont le cleanup annulerait (cancelled) la requête en
    // cours → opérateurs jamais chargés + spinner bloqué → paiement MM impossible.
    if (method !== 'mobile_money' || mmConfig) return;
    let cancelled = false;
    setMmLoading(true);
    Promise.race([
      offeringCheckoutApi.getProviders(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ])
      .then((cfg) => {
        if (cancelled) return;
        const countries = cfg?.countries ?? [];
        setMmConfig(cfg ?? { countries: [] });
        const def = countries.find((c) => c.country === 'CMR') ?? countries[0];
        if (def) {
          setMmCountry(def.country);
          setMmOperator(def.providers?.[0]?.provider ?? '');
        }
      })
      .catch(() => !cancelled && setMmConfig({ countries: [] }))
      .finally(() => !cancelled && setMmLoading(false));
    return () => {
      cancelled = true;
    };
  }, [method, mmConfig]);

  const mmCountries = mmConfig?.countries ?? [];
  const mmOperators = mmCountries.find((c) => c.country === mmCountry)?.providers ?? [];

  function onCountryChange(code) {
    setMmCountry(code);
    const entry = mmCountries.find((c) => c.country === code);
    setMmOperator(entry?.providers?.[0]?.provider ?? '');
    if (entry?.prefix && !phone.trim()) setPhone(`+${entry.prefix}`);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ state: 'submitting', message: '', depositId: null });
    try {
      // Montant : calculé serveur pour un abonnement ; fourni pour offrande/consultation.
      let amountCents;
      if (offer.kind !== 'subscription') {
        amountCents = fixedAmountCents != null ? fixedAmountCents : Math.round(parseFloat(amountEur) * 100);
        if (!amountCents || amountCents < 100) {
          setStatus({ state: 'error', message: 'Indiquez un montant valide (min 1,00 €).', depositId: null });
          return;
        }
      }

      // ── Carte bancaire (Stripe Checkout) → redirection ──
      if (method === 'card') {
        const base = `${window.location.origin}/t/${tenantSlug || DEFAULT_TENANT_SLUG}/paiement${planSlug ? `?plan=${encodeURIComponent(planSlug)}` : ''}`;
        const sep = base.includes('?') ? '&' : '?';
        const body = { kind: offer.kind };
        if (offer.kind === 'subscription') body.planSlug = planSlug;
        else { body.amountCents = amountCents; if (planSlug) body.planSlug = planSlug; }
        body.successUrl = `${base}${sep}card=success&session_id={CHECKOUT_SESSION_ID}`;
        body.cancelUrl = `${base}${sep}card=cancel`;
        const res = await offeringCheckoutApi.createCard(body);
        if (res?.checkoutUrl) {
          window.location.href = res.checkoutUrl;
          return;
        }
        setStatus({ state: 'error', message: 'Réponse de paiement carte invalide.', depositId: null });
        return;
      }

      // ── PayPal (Orders v2) → redirection vers l'approbation PayPal ──
      if (method === 'paypal') {
        const base = `${window.location.origin}/t/${tenantSlug || DEFAULT_TENANT_SLUG}/paiement${planSlug ? `?plan=${encodeURIComponent(planSlug)}` : ''}`;
        const sep = base.includes('?') ? '&' : '?';
        const body = { kind: offer.kind };
        if (offer.kind === 'subscription') body.planSlug = planSlug;
        else { body.amountCents = amountCents; if (planSlug) body.planSlug = planSlug; }
        body.successUrl = `${base}${sep}paypal=success`;
        body.cancelUrl = `${base}${sep}paypal=cancel`;
        const res = await offeringCheckoutApi.createPaypal(body);
        if (res?.approveUrl) {
          window.location.href = res.approveUrl;
          return;
        }
        setStatus({ state: 'error', message: 'Réponse PayPal invalide (pas de lien d\'approbation).', depositId: null });
        return;
      }

      // ── Mobile Money (PawaPay) ──
      if (!mmOperator || !mmCountry) {
        setStatus({ state: 'error', message: 'Sélectionnez un pays et un opérateur Mobile Money.', depositId: null });
        return;
      }
      const body = { kind: offer.kind, phoneNumber: phone.trim(), provider: mmOperator, country: mmCountry };
      if (offer.kind === 'subscription') body.planSlug = planSlug;
      else { body.amountCents = amountCents; if (planSlug) body.planSlug = planSlug; }
      const res = await offeringCheckoutApi.createMobileMoney(body);
      setStatus({
        state: 'success',
        message: 'Demande envoyée. Validez le paiement avec votre code PIN Mobile Money sur votre téléphone.',
        depositId: res?.depositId || null,
      });
    } catch (err) {
      setStatus({ state: 'error', message: err?.message || 'Échec du paiement.', depositId: null });
    }
  }

  const inputCls =
    'w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 focus:border-[var(--school-accent)] focus:outline-none';

  // Service gratuit / communauté → pas de paiement : on propose de débloquer l'accès directement.
  if (isFreeAccess) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white">
        <Helmet>
          <title>{`${offer.title} | ${BRAND}`}</title>
        </Helmet>
        <header className="border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <Link to={`/t/${tenantSlug || DEFAULT_TENANT_SLUG}`} className="text-sm text-gray-300 hover:text-white">
              ← Retour
            </Link>
            <span className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">{BRAND}</span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">
            {accessModel === 'community' ? 'Communauté' : 'Accès offert'}
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{offer.title}</h1>
          <p className="mt-3 text-gray-300">
            {accessModel === 'community'
              ? 'Rejoins gratuitement cet espace communautaire — aucun paiement nécessaire.'
              : 'Cet accès est offert — aucun paiement nécessaire.'}
          </p>
          <button
            type="button"
            onClick={handleClaimFree}
            disabled={claiming}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--school-accent)] px-6 py-3 font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {claiming
              ? 'Activation…'
              : accessModel === 'community'
                ? 'Rejoindre la communauté'
                : 'Accéder gratuitement'}
          </button>
          {status.state === 'error' && (
            <p className="mt-4 text-sm text-red-300">{status.message}</p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <Helmet>
        <title>{`Paiement | ${BRAND}`}</title>
      </Helmet>

      <header className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to={`/t/${tenantSlug || DEFAULT_TENANT_SLUG}`} className="text-sm text-gray-300 hover:text-white">
            ← Retour
          </Link>
          <span className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">{BRAND}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Paiement sécurisé</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{offer.title}</h1>
        <p className="mt-2 text-gray-300">{offer.subtitle}</p>

        <div className="mt-6 rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] p-5">
          {offer.fixedLabel ? (
            <p className="text-2xl font-semibold text-white">
              {offer.fixedLabel}
              {offer.kind === 'subscription' && (
                <span className="ml-2 text-sm font-normal text-gray-300">abonnement mensuel renouvelable</span>
              )}
              {isFixedService && offer.kind !== 'subscription' && (
                <span className="ml-2 text-sm font-normal text-gray-300">prix de la prestation</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-gray-200">
              {offer.kind === 'donation'
                ? 'Saisissez librement le montant de votre offrande.'
                : offer.kind === 'consultation'
                  ? 'Saisissez le montant convenu pour la consultation.'
                  : 'Montant calculé automatiquement selon le forfait choisi.'}
            </p>
          )}
        </div>

        {cardReturn === 'success' && (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Paiement par carte confirmé.{' '}
            {offer.kind === 'subscription' ? 'Votre abonnement est actif.' : 'Merci pour votre contribution.'}
          </div>
        )}
        {cardReturn === 'cancel' && (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Paiement par carte annulé. Vous pouvez réessayer ci-dessous.
          </div>
        )}

        {paypalReturn === 'success' && paypalCapture === 'capturing' && (
          <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-gray-200">
            Confirmation du paiement PayPal en cours…
          </div>
        )}
        {paypalReturn === 'success' && paypalCapture === 'done' && (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Paiement PayPal confirmé.{' '}
            {offer.kind === 'subscription' ? 'Votre abonnement est actif.' : 'Merci pour votre contribution.'}
          </div>
        )}
        {paypalReturn === 'success' && paypalCapture === 'error' && (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Le paiement PayPal n'a pas pu être confirmé. Si vous avez été débité, contactez-nous — sinon réessayez ci-dessous.
          </div>
        )}
        {paypalReturn === 'cancel' && (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Paiement PayPal annulé. Vous pouvez réessayer ci-dessous.
          </div>
        )}

        {/* Choix du moyen de paiement */}
        <div className="mt-8 grid grid-cols-3 gap-3" role="tablist" aria-label="Moyen de paiement">
          {[
            { id: 'card', label: 'Carte bancaire', sub: 'Visa · Mastercard' },
            { id: 'paypal', label: 'PayPal', sub: 'Compte PayPal' },
            { id: 'mobile_money', label: 'Mobile Money', sub: 'MTN · Orange' },
          ].map((m) => {
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setMethod(m.id);
                  setStatus({ state: 'idle', message: '', depositId: null });
                }}
                className={`flex cursor-pointer flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors ${
                  active
                    ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_14%,transparent)]'
                    : 'border-white/15 bg-white/5 hover:border-white/30'
                }`}
              >
                <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-200'}`}>{m.label}</span>
                <span className="text-xs text-gray-400">{m.sub}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {offer.amountEditable && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-200">Montant (EUR)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amountEur}
                onChange={(e) => setAmountEur(e.target.value)}
                placeholder="Ex: 50"
                className={inputCls}
                required
              />
            </div>
          )}

          {method === 'mobile_money' && (
            <>
              {mmLoading ? (
                <p className="text-sm text-gray-400">Chargement des opérateurs disponibles…</p>
              ) : mmCountries.length === 0 ? (
                <p className="text-sm text-red-300">
                  Aucun opérateur Mobile Money disponible pour le moment. Essayez le paiement par carte.
                </p>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-200">Pays</label>
                    <select value={mmCountry} onChange={(e) => onCountryChange(e.target.value)} className={inputCls}>
                      {mmCountries.map((c) => (
                        <option key={c.country} value={c.country} className="bg-[#0b1115]">
                          {c.displayName?.fr || c.displayName?.en || c.country}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-200">Opérateur Mobile Money</label>
                    <select value={mmOperator} onChange={(e) => setMmOperator(e.target.value)} className={inputCls}>
                      {mmOperators.map((p) => (
                        <option key={p.provider} value={p.provider} className="bg-[#0b1115]">
                          {p.displayName || p.provider}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-200">Numéro Mobile Money</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+237 6XX XXX XXX"
                      className={inputCls}
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Format international (E.164), ex : +237612345678</p>
                  </div>
                </>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={status.state === 'submitting' || (method === 'mobile_money' && mmOperators.length === 0)}
            className="w-full cursor-pointer rounded-lg bg-[var(--school-accent)] px-5 py-3 font-semibold text-black hover:bg-[#e5c04a] disabled:opacity-60"
          >
            {status.state === 'submitting'
              ? method === 'mobile_money'
                ? 'Envoi en cours…'
                : 'Redirection vers le paiement…'
              : method === 'card'
                ? offer.kind === 'subscription'
                  ? "S'abonner par carte"
                  : 'Payer par carte'
                : method === 'paypal'
                  ? offer.kind === 'subscription'
                    ? "S'abonner avec PayPal"
                    : 'Payer avec PayPal'
                  : 'Payer par Mobile Money'}
          </button>
        </form>

        {status.state === 'success' && (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {status.message}
            {status.depositId && <p className="mt-2 text-xs text-emerald-300/70">Référence : {status.depositId}</p>}
          </div>
        )}
        {status.state === 'error' && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {status.message}
            {/No auth token|UNAUTHORIZED|connect/i.test(status.message) && (
              <p className="mt-2">
                <Link to={`/t/${tenantSlug || DEFAULT_TENANT_SLUG}/login`} className="font-semibold text-[var(--school-accent)] hover:underline">
                  Se connecter pour finaliser →
                </Link>
              </p>
            )}
          </div>
        )}

        <p className="mt-8 text-xs text-gray-500">
          {method === 'card'
            ? `Paiement sécurisé par Stripe (carte). Aucune donnée bancaire n’est stockée par ${BRAND}.`
            : method === 'paypal'
              ? `Paiement sécurisé par PayPal. Aucune donnée bancaire n’est stockée par ${BRAND}.`
              : `Paiement opéré par PawaPay (Mobile Money). Aucune donnée bancaire n’est stockée par ${BRAND}.`}
        </p>
      </main>
    </div>
  );
}
