import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { offeringCheckoutApi } from '@/lib/api-v2';
import { getNgowazuluMentoratOffer } from '@/config/ngowazuluMentoratOffers';
import { NGOWAZULU_CONSULTATION_PLAN_SLUG } from '@/config/ngowazuluConsultation';

/** Opérateurs Mobile Money courants (zone CEMAC / Afrique de l'Ouest). */
const PROVIDERS = [
  { code: 'MTN_MOMO_CMR', label: 'MTN MoMo (Cameroun)', country: 'CMR' },
  { code: 'ORANGE_CMR', label: 'Orange Money (Cameroun)', country: 'CMR' },
  { code: 'MTN_MOMO_CIV', label: 'MTN MoMo (Côte d’Ivoire)', country: 'CIV' },
  { code: 'ORANGE_CIV', label: 'Orange Money (Côte d’Ivoire)', country: 'CIV' },
  { code: 'MTN_MOMO_RWA', label: 'MTN MoMo (Rwanda)', country: 'RWA' },
  { code: 'MTN_MOMO_GHA', label: 'MTN MoMo (Ghana)', country: 'GHA' },
];

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

  const [amountEur, setAmountEur] = useState('');
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState(PROVIDERS[0].code);
  const [status, setStatus] = useState({ state: 'idle', message: '', depositId: null });

  const country = useMemo(
    () => PROVIDERS.find((p) => p.code === provider)?.country || 'CMR',
    [provider],
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ state: 'submitting', message: '', depositId: null });
    try {
      const body = {
        kind: offer.kind,
        phoneNumber: phone.trim(),
        provider,
        country,
      };
      if (offer.kind === 'subscription') {
        body.planSlug = planSlug;
      } else {
        const cents = Math.round(parseFloat(amountEur) * 100);
        if (!cents || cents < 100) {
          setStatus({ state: 'error', message: 'Indiquez un montant valide (min 1,00 €).', depositId: null });
          return;
        }
        body.amountCents = cents;
        if (planSlug) body.planSlug = planSlug;
      }
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
    'w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none';

  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <Helmet>
        <title>Paiement | ISNA · PRORASCIENCE</title>
      </Helmet>

      <header className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to={`/t/${tenantSlug || 'isna'}`} className="text-sm text-gray-300 hover:text-white">
            ← Retour
          </Link>
          <span className="text-xs uppercase tracking-[0.24em] text-[#D4AF37]">PRORASCIENCE</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[#D4AF37]">Paiement Mobile Money</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{offer.title}</h1>
        <p className="mt-2 text-gray-300">{offer.subtitle}</p>

        <div className="mt-6 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-5">
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

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-200">Opérateur Mobile Money</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputCls}>
              {PROVIDERS.map((p) => (
                <option key={p.code} value={p.code} className="bg-[#0b1115]">
                  {p.label}
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

          <button
            type="submit"
            disabled={status.state === 'submitting'}
            className="w-full rounded-lg bg-[#D4AF37] px-5 py-3 font-semibold text-black hover:bg-[#e5c04a] disabled:opacity-60"
          >
            {status.state === 'submitting' ? 'Envoi en cours…' : 'Payer par Mobile Money'}
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
                <Link to={`/t/${tenantSlug || 'isna'}/login`} className="font-semibold text-[#D4AF37] hover:underline">
                  Se connecter pour finaliser →
                </Link>
              </p>
            )}
          </div>
        )}

        <p className="mt-8 text-xs text-gray-500">
          Paiement opéré par PawaPay (Mobile Money). Aucune donnée bancaire n'est stockée par PRORASCIENCE.
        </p>
      </main>
    </div>
  );
}
