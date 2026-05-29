import React, { useMemo, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { OS_LIST } from '@/data/cimolaceOsData';
import {
  INSTALLER_ADDONS,
  INSTALLER_COLOR_PRESETS,
  INSTALLER_CONNECTION_MODES,
  INSTALLER_ENGINES,
  INSTALLER_PLANS,
} from '@/data/cimolaceInstallerData';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

const TOTAL_STEPS = 8;
const SETUP_FEE = 500;

function classNames(...xs) {
  return xs.filter(Boolean).join(' ');
}

function ProgressBar({ step, mode }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={classNames(
            'h-1 rounded-full transition-all duration-300',
            i + 1 < step && 'w-7 bg-emerald-500',
            i + 1 === step && 'w-11 bg-[#5b3df5]',
            i + 1 > step && 'w-7 bg-neutral-200'
          )}
        />
      ))}
      <span className="ml-3 text-xs font-medium text-neutral-500 font-mono">
        étape {step} / {TOTAL_STEPS}
        {mode ? ` · ${mode}` : ''}
      </span>
    </div>
  );
}

function ChoiceCard({ selected, onClick, icon, label, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'w-full flex gap-4 p-5 md:p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-0.5',
        selected ? 'border-[#5b3df5] bg-[#5b3df5]/[0.04]' : 'border-neutral-200 bg-white hover:border-neutral-800'
      )}
    >
      <div className="text-2xl shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold tracking-widest text-[#5b3df5] mb-1">{label}</div>
        <div className="text-lg font-bold text-neutral-900 mb-1">{title}</div>
        <div className="text-sm text-neutral-600 leading-snug">{desc}</div>
      </div>
      {selected ? <Check className="w-6 h-6 text-[#5b3df5] shrink-0" strokeWidth={2.5} /> : null}
    </button>
  );
}

export default function CimolaceInstallerPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [diagnostic, setDiagnostic] = useState(null);
  const [mode, setMode] = useState(null);
  const [engines, setEngines] = useState(() => new Set());
  const [connectionMode, setConnectionMode] = useState(null);
  const [selectedOs, setSelectedOs] = useState(null);
  const [brand, setBrand] = useState({
    name: '',
    color: '#5b3df5',
    domain: '',
    emailDomain: '',
  });
  const [plan, setPlan] = useState('pro');
  const [addons, setAddons] = useState(() => new Set());

  const osMeta = useMemo(() => OS_LIST.find((o) => o.id === selectedOs), [selectedOs]);

  const planRows = mode ? INSTALLER_PLANS[mode] : INSTALLER_PLANS.engines;
  const selectedPlan = planRows.find((p) => p.id === plan) || planRows[1];

  const addonTotal = useMemo(() => {
    let s = 0;
    INSTALLER_ADDONS.forEach((a) => {
      if (addons.has(a.id)) s += a.price;
    });
    return s;
  }, [addons]);

  const monthlyTotal = (selectedPlan?.price || 0) + addonTotal;

  const setDiag = (d) => {
    setDiagnostic(d);
    setMode(d === 'C' ? 'os' : 'engines');
  };

  const toggleEngine = (id) => {
    setEngines((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleAddon = (id) => {
    setAddons((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const canNext = useMemo(() => {
    if (step === 1) return diagnostic != null;
    if (step === 2) return mode === 'engines' ? engines.size > 0 : selectedOs != null;
    if (step === 3) {
      return mode === 'engines' ? connectionMode != null : brand.name.trim().length > 0;
    }
    if (step === 4) return brand.name.trim().length > 0 && !!brand.color;
    if (step === 5) return true;
    if (step === 6) return !!plan;
    if (step === 7) return true;
    if (step === 8) return true;
    return false;
  }, [step, diagnostic, mode, engines, selectedOs, connectionMode, brand, plan]);

  const goNext = () => {
    if (step === 8) {
      const payload = {
        v: 1,
        mode,
        diagnostic,
        engines: mode === 'engines' ? [...engines] : null,
        selectedOs,
        connectionMode,
        brand,
        plan,
        addons: [...addons],
        monthlyTotal,
        setupFee: SETUP_FEE,
        createdAt: new Date().toISOString(),
      };
      try {
        sessionStorage.setItem('cimolace_installer_draft', JSON.stringify(payload));
      } catch {
        /* ignore */
      }
      navigate(`${cimolacePlatformConfig.routes.contact}?from=installer`);
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goPrev = () => setStep((s) => Math.max(1, s - 1));

  const renderPreview = () => {
    if (step === 1) {
      return (
        <>
          <p className="text-[11px] font-mono text-[#5b3df5] font-bold mb-3">// CIMOLACE — DEUX VOIES</p>
          <h3 className="text-xl font-bold text-neutral-900 mb-2">Deux manières de démarrer.</h3>
          <p className="text-sm text-neutral-600 mb-6">Selon votre point de départ, le parcours diffère.</p>
          <div className="space-y-2">
            <div
              className={classNames(
                'flex gap-3 p-3 rounded-xl border',
                mode === 'engines' ? 'border-blue-400 bg-blue-50' : 'border-neutral-200 bg-white'
              )}
            >
              <span className="text-lg">🌐</span>
              <div>
                <p className="font-semibold text-sm">Mode engines</p>
                <p className="text-xs text-neutral-500">Cas A et B — vous gardez votre marque</p>
              </div>
            </div>
            <div
              className={classNames(
                'flex gap-3 p-3 rounded-xl border',
                mode === 'os' ? 'border-orange-400 bg-orange-50' : 'border-neutral-200 bg-white'
              )}
            >
              <span className="text-lg">✨</span>
              <div>
                <p className="font-semibold text-sm">Mode OS</p>
                <p className="text-xs text-neutral-500">Cas C — plateforme complète</p>
              </div>
            </div>
          </div>
          <p className="mt-8 text-sm text-neutral-700 leading-relaxed border-l-4 border-[#5b3df5] pl-4">
            CIMOLACE installe les <strong>moteurs</strong> qui font fonctionner votre marque.
          </p>
        </>
      );
    }

    if (step === 2 && mode === 'engines') {
      return (
        <>
          <p className="text-[11px] font-mono text-cyan-600 font-bold mb-3">// MOTEURS</p>
          <h3 className="text-xl font-bold text-neutral-900 mb-2">{engines.size} moteur(s)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {[...engines].map((eid) => {
              const e = INSTALLER_ENGINES.find((x) => x.id === eid);
              if (!e) return null;
              return (
                <div key={eid} className="flex gap-2 p-2 rounded-lg bg-white border border-neutral-200 text-sm">
                  <span>{e.icon}</span>
                  <span className="font-medium text-neutral-800">{e.name}</span>
                </div>
              );
            })}
          </div>
          {engines.size > 3 ? (
            <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Plus de 3 moteurs → plan Elite recommandé.
            </p>
          ) : null}
        </>
      );
    }

    if (step === 2 && mode === 'os' && !osMeta) {
      return (
        <>
          <p className="text-[11px] font-mono text-orange-600 font-bold mb-3">// OS</p>
          <h3 className="text-xl font-bold text-neutral-900 mb-2">Choisissez un OS</h3>
          <p className="text-sm text-neutral-600">Sélectionnez une plateforme à l&apos;étape précédente.</p>
        </>
      );
    }

    if (step === 2 && mode === 'os' && osMeta) {
      return (
        <>
          <p className="text-[11px] font-mono text-orange-600 font-bold mb-3">// OS</p>
          <h3 className="text-xl font-bold text-neutral-900 mb-1">{osMeta.icon} {osMeta.name}</h3>
          <p className="text-sm text-neutral-600 mb-4">{osMeta.tagline}</p>
          <div className="space-y-2">
            {(osMeta.engines || []).slice(0, 8).map((en) => (
              <div key={en} className="text-xs text-neutral-700 py-1 border-b border-neutral-100">
                {en}
              </div>
            ))}
          </div>
        </>
      );
    }

    const domainPreview = brand.domain?.replace(/^https?:\/\//, '').replace(/^www\./, '') || 'votre-marque.cimolace.app';

    return (
      <>
        <p className="text-[11px] font-mono text-neutral-500 font-bold mb-3">// APERÇU</p>
        <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm">
          <div className="flex gap-2 px-3 py-2 bg-neutral-100 border-b border-neutral-200">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="flex-1 text-center text-[10px] font-mono text-neutral-500 truncate">{domainPreview}</span>
          </div>
          <div className="p-6 text-center" style={{ borderTop: `3px solid ${brand.color}` }}>
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-xl font-black text-white"
              style={{ background: brand.color }}
            >
              {(brand.name || '?').charAt(0).toUpperCase()}
            </div>
            <p className="font-bold text-neutral-900">{brand.name || 'Votre marque'}</p>
            <p className="text-xs text-neutral-500 mt-1">Propulsé par CIMOLACE</p>
          </div>
        </div>
        {step >= 6 ? (
          <div className="mt-4 text-sm">
            <p className="font-bold text-neutral-800">{selectedPlan.name}</p>
            <p className="text-neutral-600">{selectedPlan.price}€/mois + {addonTotal > 0 ? `${addonTotal}€ add-ons` : 'sans add-on'}</p>
            <p className="text-neutral-500 text-xs mt-1">Setup unique {SETUP_FEE}€</p>
          </div>
        ) : null}
      </>
    );
  };

  const stepContent = useCallback(() => {
    if (step === 1) {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-violet-100 text-[11px] font-bold font-mono text-[#5b3df5] mb-4">
            DIAGNOSTIC · POINT DE DÉPART
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3 max-w-xl">
            Vous démarrez de quel point ?
          </h1>
          <p className="text-neutral-600 text-base max-w-xl mb-8 leading-relaxed">
            CIMOLACE installe les moteurs derrière votre marque, ou crée votre plateforme complète si vous partez de zéro.
          </p>
          <div className="space-y-3 max-w-2xl">
            <ChoiceCard
              selected={diagnostic === 'A'}
              onClick={() => setDiag('A')}
              icon="🌐"
              label="CAS A · MODE ENGINES"
              title="J'ai déjà mon site / boutique"
              desc="Vous gardez votre stack. CIMOLACE branche live, école, commerce, etc. via sous-domaine, route ou widget."
            />
            <ChoiceCard
              selected={diagnostic === 'B'}
              onClick={() => setDiag('B')}
              icon="📄"
              label="CAS B · MODE ENGINES"
              title="J'ai juste une landing page"
              desc="CIMOLACE connecte les moteurs derrière votre page existante."
            />
            <ChoiceCard
              selected={diagnostic === 'C'}
              onClick={() => setDiag('C')}
              icon="✨"
              label="CAS C · MODE OS"
              title="Je n'ai rien encore"
              desc="Landing + plateforme complète (OS prêt à l'emploi : Temple, School, Commerce…)."
            />
          </div>
        </>
      );
    }

    if (step === 2 && mode === 'engines') {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-cyan-100 text-[11px] font-bold font-mono text-cyan-700 mb-4">
            MODE ENGINES · CHOIX DES MOTEURS
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">
            Quel(s) moteur(s) installer ?
          </h1>
          <p className="text-neutral-600 mb-8 max-w-xl leading-relaxed">
            Sélectionnez un ou plusieurs moteurs. Chacun est autonome ; vous pourrez ajuster après déploiement.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
            {INSTALLER_ENGINES.map((e) => {
              const on = engines.has(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggleEngine(e.id)}
                  className={classNames(
                    'text-left p-4 rounded-2xl border-2 transition-all',
                    on ? 'border-[#5b3df5] bg-violet-50' : 'border-neutral-200 bg-white hover:border-neutral-400'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xl">{e.icon}</span>
                    {on ? <Check className="w-5 h-5 text-[#5b3df5]" /> : null}
                  </div>
                  <p className="font-bold text-sm text-neutral-900">{e.name}</p>
                  <p className="text-xs text-neutral-500 mt-1">{e.fn}</p>
                </button>
              );
            })}
          </div>
        </>
      );
    }

    if (step === 2 && mode === 'os') {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-orange-100 text-[11px] font-bold font-mono text-orange-700 mb-4">
            MODE OS · PLATEFORME CLÉ EN MAIN
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">
            Quelle plateforme prête à l'emploi ?
          </h1>
          <p className="text-neutral-600 mb-8 max-w-xl leading-relaxed">
            Chaque OS assemble des moteurs pour un métier précis.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
            {OS_LIST.map((os) => {
              const on = selectedOs === os.id;
              return (
                <button
                  key={os.id}
                  type="button"
                  onClick={() => setSelectedOs(os.id)}
                  className={classNames(
                    'text-left p-4 rounded-2xl border-2 transition-all',
                    on ? 'border-[#5b3df5] bg-violet-50' : 'border-neutral-200 bg-white hover:border-neutral-400'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black"
                      style={{ backgroundColor: os.colorHex }}
                    >
                      {os.icon}
                    </span>
                    {on ? <Check className="w-5 h-5 text-[#5b3df5] ml-auto" /> : null}
                  </div>
                  <p className="font-bold text-neutral-900">{os.name}</p>
                  <p className="text-xs text-neutral-600 mt-1">{os.tagline}</p>
                </button>
              );
            })}
          </div>
        </>
      );
    }

    if (step === 3 && mode === 'engines') {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-cyan-100 text-[11px] font-bold font-mono text-cyan-700 mb-4">
            MODE ENGINES · CONNEXION
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">
            Comment connecter à votre marque ?
          </h1>
          <p className="text-neutral-600 mb-8 max-w-xl leading-relaxed">
            Choisissez le mode d'intégration principal. Vous pourrez combiner plusieurs modes par moteur.
          </p>
          <div className="space-y-3 max-w-2xl">
            {INSTALLER_CONNECTION_MODES.map((m) => (
              <ChoiceCard
                key={m.id}
                selected={connectionMode === m.id}
                onClick={() => setConnectionMode(m.id)}
                icon={m.icon}
                label="CONNEXION"
                title={m.title}
                desc={`${m.example} — ${m.desc}`}
              />
            ))}
          </div>
        </>
      );
    }

    if (step === 3 && mode === 'os') {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-orange-100 text-[11px] font-bold font-mono text-orange-700 mb-4">
            MODE OS · IDENTITÉ
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">Donnez son visage à votre plateforme.</h1>
          <p className="text-neutral-600 mb-8 max-w-xl leading-relaxed">Nom, couleur, domaine — affinables après déploiement.</p>
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="text-sm font-medium text-neutral-700">Nom de la marque</label>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-neutral-900"
                value={brand.name}
                onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
                placeholder="Ex. Académie Lumière"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Couleur principale</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {INSTALLER_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={classNames(
                      'w-9 h-9 rounded-lg border-2',
                      brand.color === c ? 'border-neutral-900 scale-110' : 'border-transparent'
                    )}
                    style={{ background: c }}
                    onClick={() => setBrand((b) => ({ ...b, color: c }))}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Domaine souhaité</label>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-neutral-900"
                value={brand.domain}
                onChange={(e) => setBrand((b) => ({ ...b, domain: e.target.value }))}
                placeholder="votre-marque.cimolace.app ou votre-domaine.com"
              />
            </div>
          </div>
        </>
      );
    }

    if (step === 4 && mode === 'engines') {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-cyan-100 text-[11px] font-bold font-mono text-cyan-700 mb-4">
            MODE ENGINES · MARQUE DANS LES MOTEURS
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">Votre marque dans l'interface.</h1>
          <p className="text-neutral-600 mb-8 max-w-xl leading-relaxed">Logo-texte, couleur, emails — vos utilisateurs vous voient d'abord.</p>
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="text-sm font-medium text-neutral-700">Nom affiché</label>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5"
                value={brand.name}
                onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Couleur</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {INSTALLER_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={classNames('w-9 h-9 rounded-lg border-2', brand.color === c ? 'border-neutral-900' : 'border-transparent')}
                    style={{ background: c }}
                    onClick={() => setBrand((b) => ({ ...b, color: c }))}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Email expéditeur (domaine)</label>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5"
                value={brand.emailDomain}
                onChange={(e) => setBrand((b) => ({ ...b, emailDomain: e.target.value }))}
                placeholder="hello@votre-marque.com"
              />
            </div>
          </div>
        </>
      );
    }

    if (step === 4 && mode === 'os') {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-orange-100 text-[11px] font-bold font-mono text-orange-700 mb-4">
            MODE OS · DOMAINE & HÉBERGEMENT
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">Où votre plateforme va vivre ?</h1>
          <p className="text-neutral-600 mb-8 max-w-xl leading-relaxed">
            Sous-domaine CIMOLACE pour démarrer vite, ou votre domaine — bascule sans coupure plus tard.
          </p>
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="text-sm font-medium text-neutral-700">Domaine</label>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5"
                value={brand.domain}
                onChange={(e) => setBrand((b) => ({ ...b, domain: e.target.value }))}
                placeholder="votre-marque.cimolace.app"
              />
            </div>
            {brand.name.trim() ? null : (
              <div>
                <label className="text-sm font-medium text-neutral-700">Nom marque (si pas renseigné à l'étape précédente)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5"
                  value={brand.name}
                  onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
                />
              </div>
            )}
          </div>
        </>
      );
    }

    if (step === 5 && mode === 'engines') {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-cyan-100 text-[11px] font-bold font-mono text-cyan-700 mb-4">
            CONFIGURATION TECHNIQUE
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">Branchement marque ↔ moteurs</h1>
          <p className="text-neutral-600 mb-6 max-w-xl leading-relaxed">
            DNS (CNAME), webhooks sécurisés, clés API — le setup 500€ inclut l'accompagnement. Vous validez, nous exécutons ou vous
            guide pas à pas.
          </p>
          <ul className="list-disc pl-5 text-sm text-neutral-700 space-y-2 max-w-xl">
            <li>Enregistrements DNS sur votre domaine</li>
            <li>Endpoints HTTPS signés pour les événements (paiement, live, école)</li>
            <li>Rotation des secrets côté CIMOLACE</li>
          </ul>
        </>
      );
    }

    if (step === 5 && mode === 'os' && !osMeta) {
      return (
        <>
          <p className="text-sm text-neutral-600">Sélectionnez un OS (étape 2) pour afficher les modules.</p>
        </>
      );
    }

    if (step === 5 && mode === 'os' && osMeta) {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-orange-100 text-[11px] font-bold font-mono text-orange-700 mb-4">
            MODULES ACTIVÉS
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">Capacités de {osMeta.name}</h1>
          <p className="text-neutral-600 mb-6 max-w-xl leading-relaxed">
            Moteurs inclus par défaut. Ajustements possibles depuis le dashboard après livraison.
          </p>
          <div className="grid gap-2 max-w-xl">
            {(osMeta.enginesDetail || []).map((row) => (
              <div key={row.name} className="flex justify-between gap-4 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm">
                <span className="font-semibold text-neutral-900">{row.name}</span>
                <span className="text-neutral-600 text-right text-xs max-w-[55%]">{row.function}</span>
              </div>
            ))}
          </div>
        </>
      );
    }

    if (step === 6) {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-violet-100 text-[11px] font-bold font-mono text-[#5b3df5] mb-4">
            PLAN
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">Choisissez votre plan</h1>
          <p className="text-neutral-600 mb-8 max-w-xl leading-relaxed">
            Mensuel sans engagement au-delà du mois en cours. Setup unique {SETUP_FEE}€ pour le déploiement initial (tous les plans).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
            {planRows.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className={classNames(
                  'text-left p-5 rounded-2xl border-2 transition-all',
                  plan === p.id ? 'border-[#5b3df5] bg-violet-50 shadow-md' : 'border-neutral-200 bg-white',
                  p.recommended && 'ring-2 ring-emerald-400/40'
                )}
              >
                {p.recommended ? (
                  <span className="text-[10px] font-bold uppercase text-emerald-600 mb-2 inline-block">Recommandé</span>
                ) : null}
                <p className="font-bold text-lg text-neutral-900">{p.name}</p>
                <p className="text-3xl font-black text-neutral-900 mt-2">
                  {p.price}€<span className="text-sm font-normal text-neutral-500">/mois</span>
                </p>
                <p className="text-xs text-neutral-600 mt-3 leading-relaxed">{p.limit}</p>
              </button>
            ))}
          </div>
        </>
      );
    }

    if (step === 7) {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-neutral-200 text-[11px] font-bold font-mono text-neutral-700 mb-4">
            ADD-ONS · OPTIONNEL
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">Activer des add-ons ?</h1>
          <p className="text-neutral-600 mb-8 max-w-xl leading-relaxed">Facturés au mois, désactivables quand vous voulez.</p>
          <div className="space-y-2 max-w-xl">
            {INSTALLER_ADDONS.map((a) => {
              const on = addons.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAddon(a.id)}
                  className={classNames(
                    'w-full flex items-center justify-between p-4 rounded-xl border-2 text-left',
                    on ? 'border-[#5b3df5] bg-violet-50' : 'border-neutral-200 bg-white'
                  )}
                >
                  <div>
                    <p className="font-semibold text-neutral-900 text-sm">{a.name}</p>
                    <p className="text-xs text-neutral-600 mt-0.5">{a.desc}</p>
                  </div>
                  <span className="font-black text-neutral-900">+{a.price}€</span>
                </button>
              );
            })}
          </div>
        </>
      );
    }

    if (step === 8) {
      return (
        <>
          <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-100 text-[11px] font-bold font-mono text-emerald-800 mb-4">
            RÉCAPITULATIF
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-3">Valider et lancer</h1>
          <p className="text-neutral-600 mb-8 max-w-xl leading-relaxed">
            Un membre de l'équipe confirmera le paiement (Stripe) et déclenchera l\'installation. Vous recevrez l\'accès dashboard.
          </p>
          <div className="max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">Mode</span>
              <span className="font-semibold">{mode === 'os' ? 'OS complet' : 'Moteurs sur marque existante'}</span>
            </div>
            {mode === 'engines' ? (
              <div className="flex justify-between gap-4">
                <span className="text-neutral-600">Moteurs</span>
                <span className="font-medium text-right">{[...engines].join(', ') || '—'}</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-neutral-600">OS</span>
                <span className="font-semibold">{osMeta?.name || '—'}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-600">Marque</span>
              <span className="font-semibold">{brand.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Plan</span>
              <span className="font-semibold">{selectedPlan.name} — {selectedPlan.price}€/mois</span>
            </div>
            {addonTotal > 0 ? (
              <div className="flex justify-between">
                <span className="text-neutral-600">Add-ons</span>
                <span className="font-semibold">+{addonTotal}€/mois</span>
              </div>
            ) : null}
            <div className="border-t border-neutral-200 pt-3 flex justify-between font-black text-base">
              <span>Mensuel estimé</span>
              <span>{monthlyTotal}€/mois</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Setup (unique)</span>
              <span>{SETUP_FEE}€</span>
            </div>
          </div>
          <p className="mt-6 text-xs text-neutral-500 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Paiement sécurisé par Stripe — nous vous envoyons le lien de paiement après validation de ce formulaire.
          </p>
        </>
      );
    }

    return null;
  }, [
    step,
    mode,
    diagnostic,
    engines,
    selectedOs,
    osMeta,
    connectionMode,
    brand,
    plan,
    addons,
    addonTotal,
    monthlyTotal,
    selectedPlan,
    planRows,
  ]);

  return (
    <>
      <Helmet>
        <title>Installateur | {cimolacePlatformConfig.productName}</title>
        <meta name="description" content="Assistant de déploiement CIMOLACE — 8 étapes. Mode moteurs ou OS complet." />
      </Helmet>
      <div className="min-h-screen grid grid-rows-[auto_1fr_auto] bg-[#fafafe] text-neutral-900">
        <header className="h-[68px] border-b border-neutral-200 bg-white px-4 md:px-7 flex items-center justify-between z-10">
          <Link to={cimolacePlatformConfig.routes.home} className="text-lg font-bold tracking-tight">
            CIMOLACE<span className="text-[#5b3df5]">.</span>
          </Link>
          <ProgressBar step={step} mode={mode || ''} />
          <Link
            to={cimolacePlatformConfig.routes.home}
            className="w-9 h-9 rounded-full bg-violet-50 flex items-center justify-center text-neutral-500 hover:bg-neutral-100 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </Link>
        </header>

        <div className="grid lg:grid-cols-[1fr_380px] min-h-0 overflow-hidden">
          <div className="overflow-y-auto px-5 md:px-14 py-10 md:py-14">{stepContent()}</div>
          <aside className="hidden lg:block border-l border-neutral-200 bg-gradient-to-b from-violet-50/80 to-neutral-50 overflow-y-auto px-8 py-14">
            {renderPreview()}
          </aside>
        </div>

        <footer className="h-20 border-t border-neutral-200 bg-white px-4 md:px-7 flex items-center justify-between gap-4">
          <span className="text-xs font-mono text-neutral-500 hidden sm:inline">
            étape {step} / {TOTAL_STEPS}
            {mode ? ` · ${mode}` : ''}
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={goPrev}
              disabled={step === 1}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ArrowLeft className="w-4 h-4" />
              Précédent
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className={classNames(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all',
                step === 8 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-neutral-900 hover:bg-[#5b3df5]',
                !canNext && 'opacity-40 pointer-events-none'
              )}
            >
              {step === 8 ? "Lancer l'installation" : 'Suivant'}
              {step === 8 ? null : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
