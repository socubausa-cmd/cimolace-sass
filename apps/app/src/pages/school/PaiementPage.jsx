import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { offeringCheckoutApi } from '@/lib/api-v2';
import { getNgowazuluMentoratOffer } from '@/config/ngowazuluMentoratOffers';
import { NGOWAZULU_CONSULTATION_PLAN_SLUG } from '@/config/ngowazuluConsultation';

// Les opérateurs Mobile Money sont chargés EN DIRECT depuis l'API (config PawaPay réelle
// du compte marchand) — fini la liste figée qui proposait des opérateurs non activés.

export default function PaiementPage() {
  const { tenantSlug } = useParams();
  const [searchParams] = useSearchParams();
  const planSlug = searchParams.get('plan') || '';
  const typeParam = searchParams.get('type') || '';

  // Détermine la nature de l'offre depuis les query params
  const offer = useMemo(() => {
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
    return { kind: 'donation', title: 'Paiement PRORASCIENCE', subtitle: 'Choisissez votre contribution', amountEditable: true, fixedLabel: null };
  }, [planSlug, typeParam]);

  const [method, setMethod] = useState('card'); // 'card' (Stripe) | 'mobile_money' (PawaPay)
  const [amountEur, setAmountEur] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '', depositId: null });
  const cardReturn = searchParams.get('card'); // 'success' | 'cancel' au retour de Stripe

  // Opérateurs Mobile Money en direct (config PawaPay réelle) : pays → opérateurs.
  const [mmConfig, setMmConfig] = useState(null); // { countries: [...] } | null
  const [mmLoading, setMmLoading] = useState(false);
  const [mmCountry, setMmCountry] = useState('');
  const [mmOperator, setMmOperator] = useState('');

  // Chargé à la 1re bascule vers Mobile Money (la carte n'en a pas besoin).
  useEffect(() => {
    if (method !== 'mobile_money' || mmConfig || mmLoading) return;
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
  }, [method, mmConfig, mmLoading]);

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
        amountCents = Math.round(parseFloat(amountEur) * 100);
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

  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <Helmet>
        <title>Paiement | ISNA · PRORASCIENCE</title>
      </Helmet>

      <header className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to={`/t/${tenantSlug || DEFAULT_TENANT_SLUG}`} className="text-sm text-gray-300 hover:text-white">
            ← Retour
          </Link>
          <span className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">PRORASCIENCE</span>
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
              <span className="ml-2 text-sm font-normal text-gray-300">abonnement mensuel renouvelable</span>
            </p>
          ) : (
            <p className="text-sm text-gray-200">
              {offer.kind === 'donation'
                ? 'Saisissez librement le montant de votre offrande.'
                : 'Saisissez le montant convenu pour la consultation.'}
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

        {/* Choix du moyen de paiement */}
        <div className="mt-8 grid grid-cols-2 gap-3" role="tablist" aria-label="Moyen de paiement">
          {[
            { id: 'card', label: 'Carte bancaire', sub: 'Visa · Mastercard' },
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
              ? method === 'card'
                ? 'Redirection vers le paiement…'
                : 'Envoi en cours…'
              : method === 'card'
                ? offer.kind === 'subscription'
                  ? "S'abonner par carte"
                  : 'Payer par carte'
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
            ? 'Paiement sécurisé par Stripe (carte). Aucune donnée bancaire n’est stockée par PRORASCIENCE.'
            : 'Paiement opéré par PawaPay (Mobile Money). Aucune donnée bancaire n’est stockée par PRORASCIENCE.'}
        </p>
      </main>
    </div>
  );
}
