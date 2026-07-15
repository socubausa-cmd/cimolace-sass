import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Check, GraduationCap, HeartPulse, Radio, Sparkles, Loader2,
} from 'lucide-react';

/**
 * Page publique d'ACQUISITION Cimolace — « Souscrire une offre ».
 * Un prospect choisit un plan → saisit son organisation → part sur Stripe Checkout.
 * Câblée sur POST /billing/acquisition/checkout (le chaînon crée le tenant au paiement).
 *
 * Charte homepage Cimolace : slate #0f1419, or #d8b468, ink #f4efe6, serif Fraunces.
 * MOTION : contenu VISIBLE au repos (aucun reveal opacity:0 → pas de page fantôme en
 * rendu headless). Transitions CSS au hover uniquement.
 */

const GOLD = '#d8b468';
const GOLD_SOFT = '#e6cc92';
const SERIF = "'Fraunces','Source Serif 4',Georgia,serif";

// Catalogue des offres (plans ACTIFS, prix réels EUR/mois, clés billing_plans).
const PRODUCTS = [
  {
    key: 'ecole', label: 'LIRI École', icon: GraduationCap,
    tagline: 'LMS + live + IA pédagogique',
    tiers: [
      { key: 'cimolace-ecole-starter', name: 'Starter', price: 79 },
      { key: 'cimolace-ecole-pro', name: 'Pro', price: 199, featured: true },
      { key: 'cimolace-ecole-business', name: 'Business', price: 349 },
    ],
  },
  {
    key: 'medos', label: 'MedOS · Santé', icon: HeartPulse,
    tagline: 'Dossiers, notes SOAP, téléconsultation',
    tiers: [
      { key: 'cimolace-medos-solo', name: 'Solo', price: 25 },
      { key: 'cimolace-medos-pro', name: 'Pro', price: 49, featured: true },
      { key: 'cimolace-medos-clinic', name: 'Clinic', price: 99 },
    ],
  },
  {
    key: 'createur', label: 'Créateur · Live', icon: Radio,
    tagline: 'Studio live, VOD, monétisation',
    tiers: [
      { key: 'cimolace-createur-starter', name: 'Starter', price: 49 },
      { key: 'cimolace-createur-pro', name: 'Pro', price: 149, featured: true },
      { key: 'cimolace-createur-business', name: 'Business', price: 299 },
    ],
  },
  {
    key: 'bienetre', label: 'Bien-être', icon: Sparkles,
    tagline: 'Coaching, programmes, suivi',
    tiers: [
      { key: 'cimolace-bienetre-starter', name: 'Starter', price: 29 },
      { key: 'cimolace-bienetre-pro', name: 'Pro', price: 79, featured: true },
    ],
  },
];

const ALL_TIERS = PRODUCTS.flatMap((p) =>
  p.tiers.map((t) => ({ ...t, product: p.label, productKey: p.key })),
);

export default function CimolaceSubscribePage() {
  const [selected, setSelected] = useState(null); // planKey
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const chosen = ALL_TIERS.find((t) => t.key === selected) || null;
  const canSubmit = !!chosen && org.trim().length >= 2 && /.+@.+\..+/.test(email) && !loading;

  async function subscribe(e) {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const apiBase = import.meta.env.VITE_API_BASE ?? '/api';
      const res = await fetch(`${apiBase}/billing/acquisition/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          planKey: chosen.key,
          orgName: org.trim(),
          intent: 'new_tenant',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `Erreur ${res.status}`);
      const url = data?.data?.url ?? data?.url;
      if (!url) throw new Error('Session de paiement indisponible.');
      window.location.href = url;
    } catch (err) {
      setError(err.message || 'Souscription impossible pour le moment.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-[#f4efe6]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur-md bg-[#0f1419]/75 border-b border-[#f4efe6]/[0.055]">
        <div className="max-w-[1160px] mx-auto px-6 h-[70px] flex items-center justify-between">
          <Link to="/cimolace" className="flex items-center gap-2.5">
            <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center text-[#20160f] font-semibold"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`, fontFamily: SERIF }}>C</span>
            <span className="text-sm font-semibold tracking-[0.14em]">CIMOLACE</span>
          </Link>
          <a href="https://cimolace.space" className="inline-flex items-center gap-1 text-sm text-[#aeb6bf] hover:text-[#f4efe6] transition-colors">
            Découvrir <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="max-w-[1160px] mx-auto px-6 pt-16 pb-10 text-center">
        <span className="inline-block text-[11px] font-semibold tracking-[0.22em] uppercase text-[#d8b468]/90 mb-4">
          Souscrire
        </span>
        <h1 className="text-[clamp(2rem,5vw,3.4rem)] leading-[1.05] font-semibold" style={{ fontFamily: SERIF, letterSpacing: '-0.02em' }}>
          Lancez votre espace<br className="hidden sm:block" /> en quelques minutes.
        </h1>
        <p className="mt-5 text-[#aeb6bf] text-[15px] leading-relaxed max-w-[560px] mx-auto">
          Choisissez votre produit, créez votre organisation, et votre infrastructure est
          provisionnée automatiquement dès le paiement. Essai possible, sans engagement.
        </p>
      </header>

      {/* Catalogue */}
      <main className="max-w-[1160px] mx-auto px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-2">
          {PRODUCTS.map((p) => {
            const Icon = p.icon;
            return (
              <section key={p.key} className="rounded-2xl border border-[#f4efe6]/[0.08] bg-[#f4efe6]/[0.02] p-6">
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-10 h-10 rounded-xl grid place-items-center border border-[#d8b468]/30 bg-[#d8b468]/[0.08]">
                    <Icon className="w-5 h-5 text-[#d8b468]" />
                  </span>
                  <div>
                    <h2 className="text-[17px] font-semibold" style={{ fontFamily: SERIF }}>{p.label}</h2>
                    <p className="text-[13px] text-[#8b93a0]">{p.tagline}</p>
                  </div>
                </div>
                <div className="grid gap-2.5">
                  {p.tiers.map((t) => {
                    const active = selected === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => { setSelected(t.key); setError(''); }}
                        className={[
                          'w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-all cursor-pointer border',
                          active
                            ? 'border-[#d8b468] bg-[#d8b468]/[0.10]'
                            : 'border-[#f4efe6]/[0.08] hover:border-[#f4efe6]/20 bg-[#f4efe6]/[0.015]',
                        ].join(' ')}
                        aria-pressed={active}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className={['w-4 h-4 rounded-full grid place-items-center border', active ? 'border-[#d8b468] bg-[#d8b468]' : 'border-[#f4efe6]/25'].join(' ')}>
                            {active && <Check className="w-3 h-3 text-[#20160f]" strokeWidth={3} />}
                          </span>
                          <span className="text-sm font-medium">{t.name}</span>
                          {t.featured && (
                            <span className="text-[10px] font-semibold tracking-wide uppercase text-[#d8b468] border border-[#d8b468]/30 rounded-full px-2 py-0.5">Populaire</span>
                          )}
                        </span>
                        <span className="text-sm">
                          <span className="font-semibold">{t.price} €</span>
                          <span className="text-[#8b93a0] text-[12px]">/mois</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Souscription (formulaire org) */}
        <form onSubmit={subscribe} className="mt-10 rounded-2xl border border-[#f4efe6]/[0.08] bg-[#f4efe6]/[0.02] p-6 md:p-8 max-w-[720px] mx-auto">
          <h3 className="text-[19px] font-semibold mb-1" style={{ fontFamily: SERIF }}>Votre organisation</h3>
          <p className="text-[13px] text-[#8b93a0] mb-5">
            {chosen
              ? <>Offre sélectionnée : <span className="text-[#f4efe6] font-medium">{chosen.product} · {chosen.name}</span> — <span className="text-[#d8b468] font-semibold">{chosen.price} €/mois</span></>
              : 'Sélectionnez un plan ci-dessus pour continuer.'}
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-[12px] text-[#aeb6bf] mb-1.5">Nom de l'organisation</span>
              <input
                value={org} onChange={(e) => setOrg(e.target.value)}
                placeholder="Cabinet Lumière"
                className="w-full rounded-xl bg-[#0f1419] border border-[#f4efe6]/15 px-4 py-3 text-sm text-[#f4efe6] placeholder-[#5b636e] focus:border-[#d8b468] focus:outline-none transition-colors"
              />
            </label>
            <label className="block">
              <span className="block text-[12px] text-[#aeb6bf] mb-1.5">Email</span>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@organisation.com"
                className="w-full rounded-xl bg-[#0f1419] border border-[#f4efe6]/15 px-4 py-3 text-sm text-[#f4efe6] placeholder-[#5b636e] focus:border-[#d8b468] focus:outline-none transition-colors"
              />
            </label>
          </div>

          {error && (
            <p className="mt-4 text-[13px] text-[#e6a2a2] bg-[#e6a2a2]/[0.08] border border-[#e6a2a2]/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit" disabled={!canSubmit}
            className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-[#20160f] transition-all hover:-translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer"
            style={{ background: GOLD }}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirection…</> : <>Souscrire et payer <ArrowRight className="w-4 h-4" /></>}
          </button>
          <p className="mt-3 text-[11px] text-[#5b636e]">
            Paiement sécurisé par Stripe. Votre espace est créé automatiquement après le paiement.
          </p>
        </form>
      </main>
    </div>
  );
}
