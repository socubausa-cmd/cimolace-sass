import React, { useMemo, useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import CimolacePremiumShell from '@/components/cimolace/CimolacePremiumShell';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';
import { OS_LIST } from '@/data/cimolaceOsData';
import { resolveNetlifyApiUrl } from '@/lib/resolveNetlifyApiUrl';

const INTENTS = [
  { value: 'demo', label: 'Demander une démo' },
  { value: 'activate', label: 'Activer un OS / souscrire' },
  { value: 'virtuel-mbolo', label: 'Virtuel-Mbolo™ — créneau & questions' },
  { value: 'private-hosting', label: 'Installation privée / souveraineté données' },
  { value: 'other', label: 'Autre demande' },
];

export default function CimolaceContactPage() {
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type') || '';
  const intentParam = searchParams.get('intent') || '';
  const osParam = searchParams.get('os') || '';
  const planParam = searchParams.get('plan') || '';

  const fromParam = searchParams.get('from') || '';

  const defaultIntent = useMemo(() => {
    if (fromParam === 'installer') return 'activate';
    if (typeParam === 'rdv-virtuelmbolo') return 'virtuel-mbolo';
    if (intentParam && INTENTS.some(i => i.value === intentParam)) return intentParam;
    return 'demo';
  }, [fromParam, typeParam, intentParam]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [intent, setIntent] = useState(defaultIntent);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (fromParam !== 'installer') return;
    try {
      const raw = sessionStorage.getItem('cimolace_installer_draft');
      if (!raw) return;
      const d = JSON.parse(raw);
      const osLabel = d.selectedOs ? OS_LIST.find((o) => o.id === d.selectedOs)?.name || d.selectedOs : null;
      const lines = [
        '[Brouillon — Installateur CIMOLACE]',
        `Mode: ${d.mode === 'os' ? 'OS complet' : 'Moteurs sur marque existante'}`,
        d.mode === 'engines' && d.engines?.length ? `Moteurs: ${d.engines.join(', ')}` : null,
        d.mode === 'os' && osLabel ? `OS: ${osLabel}` : null,
        d.brand?.name ? `Marque: ${d.brand.name}` : null,
        d.brand?.domain ? `Domaine: ${d.brand.domain}` : null,
        d.plan ? `Plan: ${d.plan}` : null,
        d.addons?.length ? `Add-ons: ${d.addons.join(', ')}` : null,
        `Estimation mensuelle: ${d.monthlyTotal}€/mois + setup ${d.setupFee}€`,
      ].filter(Boolean);
      setMessage((prev) => (prev.trim() ? prev : lines.join('\n')));
      setIntent('activate');
    } catch {
      /* ignore */
    }
  }, [fromParam]);

  useEffect(() => {
    setIntent(defaultIntent);
  }, [defaultIntent]);

  const osMeta = useMemo(() => OS_LIST.find(o => o.id === osParam), [osParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() && !phone.trim()) {
      setError('Indiquez au moins un email ou un téléphone.');
      return;
    }
    setStatus('loading');
    try {
      const url = resolveNetlifyApiUrl('/api/marketing/lead/capture');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          source: 'cimolace_contact',
          score: message.trim().length > 40 ? 60 : 45,
          behavior: {
            intent,
            message: message.trim() || null,
            company: company.trim() || null,
            os_id: osParam || null,
            os_label: osMeta?.name || null,
            plan: planParam || null,
            landing_query: typeParam ? { type: typeParam } : null,
            from_installer: fromParam === 'installer' || undefined,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Envoi impossible pour le moment.');
      }
      setStatus('done');
    } catch (err) {
      setError(String(err.message || err));
      setStatus('idle');
    }
  };

  return (
    <>
      <Helmet>
        <title>Contact & démo | {cimolacePlatformConfig.productName}</title>
        <meta
          name="description"
          content="Demandez une démo, activez un OS CIMOLACE ou parlez installation privée. Réponse sous 24–48h ouvrées."
        />
      </Helmet>
      <CimolacePremiumShell>
        <main className="px-6 pb-20 pt-32">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs uppercase tracking-[0.28em] text-violet-400 mb-4">Passez à l&apos;action</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-6">
              Votre plateforme. Demain.
            </h1>
            <p className="text-lg text-white/55 leading-relaxed mb-10">
              Démarrez par l&apos;assistant d&apos;installation (8 étapes), le configurateur modules, ou envoyez-nous un message.
            </p>

            {fromParam === 'installer' && (
              <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-5 py-4 mb-10 text-sm text-violet-100/90">
                Configuration importée depuis l&apos;<strong className="text-white">installateur</strong>. Vérifiez le récapitulatif
                ci-dessous, complétez vos coordonnées et envoyez — nous vous répondons pour le paiement et le go-live.
              </div>
            )}

            {typeParam === 'rdv-virtuelmbolo' && (
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-4 mb-10 text-sm text-cyan-100/90">
                <span className="font-bold text-cyan-200">Virtuel-Mbolo™</span> — pour réserver un créneau téléphonique directement,
                vous pouvez aussi utiliser{' '}
                <Link to="/cimolace/solutions/virtuel-mbolo/booking" className="underline font-semibold text-white">
                  la page de réservation
                </Link>
                .
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Link
                to={cimolacePlatformConfig.routes.installer}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-[#0a0a0f] hover:bg-white/90 transition-colors"
              >
                Créer ma plateforme
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to={cimolacePlatformConfig.routes.configurateur}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-black text-white hover:bg-white/[0.08] transition-colors"
              >
                Configurateur modules
              </Link>
              <a
                href={`mailto:${cimolacePlatformConfig.contactEmail}?subject=Démo%20CIMOLACE`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-black text-white hover:bg-white/[0.08] transition-colors"
              >
                Email direct
              </a>
            </div>

            {(osMeta || planParam) && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 mb-8 text-sm text-white/70">
                {osMeta ? (
                  <p>
                    <span className="text-white/40">OS concerné :</span>{' '}
                    <span className="font-semibold text-white">{osMeta.name}</span>
                  </p>
                ) : null}
                {planParam ? (
                  <p className={osMeta ? 'mt-1' : ''}>
                    <span className="text-white/40">Plan :</span>{' '}
                    <span className="font-semibold text-white">{planParam}</span>
                  </p>
                ) : null}
              </div>
            )}

            {status === 'done' ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-10 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-xl font-black text-white mb-2">Message bien reçu</h2>
                <p className="text-white/60 text-sm mb-6">Nous revenons vers vous rapidement.</p>
                <Link to="/cimolace" className="text-violet-400 font-semibold hover:text-violet-300">
                  ← Accueil CIMOLACE
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Objet</label>
                  <select
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    {INTENTS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#14141a]">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Nom</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      placeholder="Votre nom"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Organisation</label>
                    <input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      placeholder="Entreprise, école, communauté…"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      placeholder="vous@exemple.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      placeholder="Indicatif pays inclus"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-y min-h-[120px]"
                    placeholder="Contexte, OS envisagé, volume d’utilisateurs, délai souhaité…"
                  />
                </div>
                {error ? <p className="text-sm text-red-400">{error}</p> : null}
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-8 py-4 text-sm font-black text-white hover:opacity-95 disabled:opacity-50 transition-opacity w-full sm:w-auto"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    <>
                      Envoyer
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-16 pt-10 border-t border-white/10">
              <p className="text-lg md:text-xl font-black text-white/90 leading-snug">
                CIMOLACE ne vend pas <span className="line-through text-white/35">des outils</span>.
                <br />
                CIMOLACE déploie{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-300">
                  des plateformes complètes
                </span>
                .
              </p>
            </div>
          </div>
        </main>
      </CimolacePremiumShell>
    </>
  );
}
