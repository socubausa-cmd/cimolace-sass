import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronRight, Users, Zap, ArrowRight, Phone, HelpCircle, ShieldCheck } from 'lucide-react';

/* ─── DATA ─── */
const MODULES = [
  {
    id: 'mbolo',
    name: 'Virtuel Mbolo',
    badge: 'Commerce',
    badgeColor: '#8b5cf6',
    desc: 'Boutique intelligente qui pense et vend pour toi.',
    price: 19,
    popular: false,
    requires: [],
  },
  {
    id: 'payflow',
    name: 'Payflow Africa',
    badge: 'Paiement',
    badgeColor: '#f59e0b',
    desc: 'Mobile Money + cartes + liens unifiés.',
    price: 24,
    popular: false,
    requires: [],
  },
  {
    id: 'logistics',
    name: 'Smart Logistics',
    badge: 'Logistique',
    badgeColor: '#06b6d4',
    desc: 'Calcul colis, optimisation cartons, routage.',
    price: 18,
    popular: false,
    requires: [],
  },
  {
    id: 'live',
    name: 'Liri Live Engine',
    badge: 'Diffusion',
    badgeColor: '#ec4899',
    desc: 'Live vidéo immersif + SmartBoard.',
    price: 22,
    popular: false,
    requires: [],
  },
  {
    id: 'spirit',
    name: 'Liri Spirit',
    badge: 'Ministère',
    badgeColor: '#a78bfa',
    desc: 'Culte, prière, consultation, dons.',
    price: 14,
    popular: false,
    requires: [],
  },
  {
    id: 'ai',
    name: 'Liri AI Core',
    badge: 'Intelligence',
    badgeColor: '#34d399',
    desc: 'Génération, analyse, automatisation contextuelle.',
    price: 39,
    popular: true,
    requires: [],
  },
  {
    id: 'edu',
    name: 'Liri Edu Core',
    badge: 'Formation',
    badgeColor: '#10b981',
    desc: 'Texte → cours, masterclass, exercices.',
    price: 21,
    popular: false,
    requires: [],
  },
  {
    id: 'event',
    name: 'Liri Event Designer',
    badge: 'Création',
    badgeColor: '#f472b6',
    desc: 'Conférences, affiches, vidéos, scènes.',
    price: 17,
    popular: false,
    requires: [],
  },
  {
    id: 'agents',
    name: 'Liri Agents System',
    badge: 'Automatisation',
    badgeColor: '#fb923c',
    desc: 'Agents IA actifs 24/7.',
    price: 34,
    popular: false,
    requires: ['ai'],
    requiresLabel: 'Nécessite Liri AI Core',
  },
  {
    id: 'scheduler',
    name: 'Liri Smart Scheduler',
    badge: 'Temps',
    badgeColor: '#818cf8',
    desc: 'Calendrier, rendez-vous, automatisation.',
    price: 12,
    popular: false,
    requires: [],
  },
];

const PROFILES = [
  {
    id: 'creator',
    label: 'Créateur solo',
    modules: ['mbolo', 'live', 'scheduler'],
  },
  {
    id: 'merchant',
    label: 'Commerçant',
    modules: ['mbolo', 'payflow', 'logistics'],
  },
  {
    id: 'trainer',
    label: 'Formateur',
    modules: ['edu', 'live', 'scheduler'],
  },
  {
    id: 'ministry',
    label: 'Ministère',
    modules: ['spirit', 'live', 'payflow'],
  },
  {
    id: 'event',
    label: 'Studio événementiel',
    modules: ['event', 'live', 'scheduler'],
  },
  {
    id: 'all',
    label: 'Tout activer',
    modules: MODULES.map((m) => m.id),
  },
];

const SCALES = [
  { label: '1 user', multiplier: 1 },
  { label: '5 users', multiplier: 1.8 },
  { label: '20 users', multiplier: 3 },
];

/* ─── Sub-components ─── */

function BadgePill({ label, color }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: `${color}20`, color, border: `1px solid ${color}35` }}
    >
      {label}
    </span>
  );
}

function ModuleCard({ module, selected, onToggle, disabled }) {
  const isSelected = selected;
  return (
    <motion.button
      type="button"
      layout
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={() => !disabled && onToggle(module.id)}
      className="relative w-full text-left rounded-2xl p-4 transition-all"
      style={{
        background: isSelected
          ? `linear-gradient(135deg, ${module.badgeColor}12, ${module.badgeColor}06)`
          : 'rgba(255,255,255,0.03)',
        border: isSelected
          ? `1px solid ${module.badgeColor}50`
          : '1px solid rgba(255,255,255,0.07)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: isSelected ? `0 0 20px ${module.badgeColor}15` : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <BadgePill label={module.badge} color={module.badgeColor} />
          {module.popular && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
              Populaire
            </span>
          )}
        </div>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
          style={{
            background: isSelected ? module.badgeColor : 'rgba(255,255,255,0.06)',
            border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
        </div>
      </div>

      <div className="font-bold text-white text-sm mb-1">{module.name}</div>
      <div className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {module.desc}
      </div>

      <div className="flex items-center justify-between">
        <span>
          <span className="text-white font-black text-base">+€{module.price}</span>
          <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>/mois</span>
        </span>
        {module.requiresLabel && (
          <span className="text-[10px]" style={{ color: 'rgba(251,146,60,0.7)' }}>
            {module.requiresLabel}
          </span>
        )}
      </div>
    </motion.button>
  );
}

/* ─── Main Configurator ─── */
export default function CimolaceConfigurator() {
  const [selected,   setSelected]   = useState(new Set(['mbolo', 'payflow', 'scheduler']));
  const [scaleIdx,   setScaleIdx]   = useState(0);
  const [yearly,     setYearly]     = useState(false);
  const [activeProf, setActiveProf] = useState('creator');

  const scale = SCALES[scaleIdx];

  /* Calcul prix */
  const { subtotal, total, lineItems } = useMemo(() => {
    const items = MODULES.filter((m) => selected.has(m.id));
    const sub   = items.reduce((s, m) => s + m.price, 0);
    const raw   = sub * scale.multiplier;
    const final = yearly ? raw * 12 * 0.8 : raw;
    return {
      subtotal:  sub,
      total:     Math.round(final),
      lineItems: items,
    };
  }, [selected, scaleIdx, yearly]);

  const toggle = (id) => {
    const mod = MODULES.find((m) => m.id === id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        /* Désélectionner — retirer aussi les modules qui en dépendent */
        next.delete(id);
        MODULES.forEach((m) => {
          if (m.requires.includes(id)) next.delete(m.id);
        });
      } else {
        /* Sélectionner — activer les prérequis automatiquement */
        mod.requires.forEach((r) => next.add(r));
        next.add(id);
      }
      return next;
    });
  };

  const applyProfile = (profileId) => {
    setActiveProf(profileId);
    const profile = PROFILES.find((p) => p.id === profileId);
    if (profile) setSelected(new Set(profile.modules));
  };

  const selectAll  = () => setSelected(new Set(MODULES.map((m) => m.id)));
  const clearAll   = () => setSelected(new Set());

  return (
    <div className="min-h-screen w-full" style={{ background: '#07060f', color: '#fff' }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 sticky top-0 z-50"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(7,6,15,0.92)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>C</div>
          <span className="font-black text-white text-base">CIMOLACE</span>
          <span className="text-white/30 mx-1">/</span>
          <span className="text-xs text-violet-400 font-semibold tracking-wider">Configurateur</span>
        </div>
        <button className="text-xs flex items-center gap-1.5 transition-colors"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseOver={(e) => e.currentTarget.style.color = '#a78bfa'}
          onMouseOut={(e)  => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
        >
          <HelpCircle size={14} /> Comment ça marche
        </button>
      </header>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-violet-600/8 rounded-full blur-[160px]" />
        </div>
        <div className="relative z-10 text-center pt-16 pb-10 px-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-6"
            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            v1.0 · Configurateur en direct
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl md:text-6xl font-black leading-[1.08] tracking-tight mb-5"
          >
            Compose ton<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #34d399)' }}>
              infrastructure
            </span>
            {' '}en 2 minutes.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm max-w-md mx-auto leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Choisis tes modules, ajuste l'échelle, vois le prix se calculer en direct.
            Pas de plan figé — tu ne paies que ce qui fonctionne pour toi.
          </motion.p>
        </div>
      </div>

      {/* ── Profile presets ── */}
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <p className="text-center text-[10px] uppercase tracking-[0.25em] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Démarre avec un profil
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => applyProfile(p.id)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={
                activeProf === p.id
                  ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)', color: '#a78bfa' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="max-w-6xl mx-auto px-4 pb-24 grid lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* Left — module grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.25em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                01 · Choisis tes intelligences
              </span>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}>
              {selected.size}/{MODULES.length}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {MODULES.map((mod) => {
              const missingReq = mod.requires.some((r) => !selected.has(r));
              return (
                <ModuleCard
                  key={mod.id}
                  module={mod}
                  selected={selected.has(mod.id)}
                  onToggle={toggle}
                  disabled={missingReq && !selected.has(mod.id)}
                />
              );
            })}
          </div>

          {/* Bulk actions */}
          <div className="flex gap-3 mt-5">
            <button onClick={clearAll}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
              Tout désélectionner
            </button>
            <button onClick={selectAll}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
              Activer les {MODULES.length}
            </button>
          </div>
        </div>

        {/* Right — summary panel */}
        <div className="sticky top-20">
          <motion.div
            layout
            className="rounded-2xl p-5 space-y-5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Ton infrastructure
              </p>
              <p className="text-3xl font-black text-white">
                {selected.size} <span className="text-base font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>modules</span>
              </p>
            </div>

            {/* Scale */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Échelle
              </p>
              <div className="flex gap-2">
                {SCALES.map((s, i) => (
                  <button key={i} onClick={() => setScaleIdx(i)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={
                      scaleIdx === i
                        ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)', color: '#a78bfa' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Billing toggle */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Facturation
              </p>
              <div className="flex gap-2">
                {[false, true].map((y) => (
                  <button key={String(y)} onClick={() => setYearly(y)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    style={
                      yearly === y
                        ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)', color: '#a78bfa' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
                    }
                  >
                    {y ? 'Annuel' : 'Mensuel'}
                    {y && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                        style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>-20%</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Line items */}
            <AnimatePresence mode="popLayout">
              {lineItems.length > 0 ? (
                <div className="space-y-1.5">
                  {lineItems.map((m) => (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.badgeColor }} />
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{m.name}</span>
                      </div>
                      <span className="text-xs font-bold text-white">€{m.price}</span>
                    </motion.div>
                  ))}
                  <div className="pt-2 mt-2 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      <span>Sous-total modules</span>
                      <span>€{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      <span>Multiplicateur ×{scale.multiplier} ({scale.label})</span>
                      <span>€{Math.round(subtotal * scale.multiplier)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-center py-3"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  Sélectionne au moins un module
                </motion.p>
              )}
            </AnimatePresence>

            {/* Total */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Par {yearly ? 'an' : 'mois'}
              </p>
              <motion.p
                key={total}
                initial={{ scale: 0.95, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black text-white"
              >
                €<span>{total}</span>
                <span className="text-lg font-normal ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  /{yearly ? 'an' : 'mois'}
                </span>
              </motion.p>
            </div>

            {/* CTA */}
            <button
              disabled={selected.size === 0}
              className="w-full py-4 rounded-xl font-black text-white text-base flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{
                background: selected.size > 0
                  ? 'linear-gradient(135deg, #7c3aed, #06b6d4)'
                  : 'rgba(255,255,255,0.05)',
                boxShadow: selected.size > 0 ? '0 8px 30px rgba(124,58,237,0.35)' : 'none',
              }}
            >
              Activer cette infrastructure <ArrowRight size={18} />
            </button>

            {/* Trust */}
            <div className="space-y-1.5 pt-1">
              {['30 jours d\'essai sans carte', 'Migration accompagnée', 'Activation en 5 clics'].map((t) => (
                <div key={t} className="flex items-center gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <ShieldCheck size={11} className="text-green-500/60 flex-shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Info cards */}
          <div className="mt-4 space-y-3">
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-bold text-white mb-1">Et après ?</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                4 minutes pour activer. Tes données restent les tiennes. Tu peux ajouter ou retirer des modules à tout moment.
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <p className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
                <Phone size={12} className="text-violet-400" /> Besoin d'aide ?
              </p>
              <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Un architecte Cimolace t'accompagne gratuitement pour designer ton infrastructure.
              </p>
              <button className="text-[11px] font-bold text-violet-400 flex items-center gap-1 hover:text-violet-300 transition-colors">
                Réserver un appel <ChevronRight size={11} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
