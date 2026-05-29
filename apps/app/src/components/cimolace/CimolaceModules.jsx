import React from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingCart, Package, CreditCard, Video, Church, Brain,
  GraduationCap, Palette, Bot, Calendar, ArrowRight,
  BarChart2, TrendingUp, ShoppingBag, Truck, Users, Zap,
} from 'lucide-react';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';

const modules = [
  {
    id: 'virtuel-mbolo',
    name: 'Virtuel Mbolo™',
    badge: 'Commerce',
    icon: ShoppingCart,
    color: '#8b5cf6',
    promise: 'Ta boutique qui pense et vend pour toi.',
    features: ['Création boutique', 'Gestion produits', 'Commandes', 'Marketing auto'],
    power: 'Tu vends sans gérer la complexité',
    highlight: false,
  },
  {
    id: 'smart-logistics',
    name: 'Smart Logistics™',
    badge: 'Logistique',
    icon: Package,
    color: '#06b6d4',
    promise: 'Chaque colis devient optimisé automatiquement.',
    features: ['Calcul colis', 'Optimisation cartons', 'Estimation poids', 'Livraison optimisée'],
    power: 'Tu gagnes sur chaque livraison',
    highlight: false,
  },
  {
    id: 'payflow-africa',
    name: 'Payflow Africa™',
    badge: 'Paiement',
    icon: CreditCard,
    color: '#f59e0b',
    promise: 'Recevoir de l\'argent en Afrique devient simple.',
    features: ['Mobile Money', 'Cartes bancaires', 'Paiement lien', 'Relances auto'],
    power: 'Tu encaisses partout',
    highlight: true,
  },
  {
    id: 'liri-live',
    name: 'LIRI Live Engine™',
    badge: 'Streaming',
    icon: Video,
    color: '#ec4899',
    promise: 'Transforme chaque live en expérience immersive.',
    features: ['Live vidéo HD', 'Interaction temps réel', 'SmartBoard', 'Analytics'],
    power: 'Tu captives ton audience',
    highlight: false,
  },
  {
    id: 'liri-spirit',
    name: 'LIRI Spirit™',
    badge: 'Communauté',
    icon: Church,
    color: '#8b5cf6',
    promise: 'Digitalise ton culte sans perdre sa puissance.',
    features: ['Culte en ligne', 'Prière interactive', 'Consultation', 'Dons sécurisés'],
    power: 'Ton ministère dépasse les murs',
    highlight: false,
  },
  {
    id: 'liri-ai-core',
    name: 'LIRI AI Core™',
    badge: 'Intelligence',
    icon: Brain,
    color: '#06b6d4',
    promise: 'Une intelligence qui travaille pour toi.',
    features: ['Génération contenu', 'Analyse données', 'Automatisation', 'Prédictions'],
    power: 'Tu multiplies ton impact',
    highlight: false,
  },
  {
    id: 'liri-edu',
    name: 'LIRI EDU Core™',
    badge: 'Éducation',
    icon: GraduationCap,
    color: '#10b981',
    promise: 'Transforme une idée en formation complète.',
    features: ['Texte → Cours', 'Masterclass', 'Exercices auto', 'Certification'],
    power: 'Tu deviens formateur rapidement',
    highlight: false,
  },
  {
    id: 'liri-event',
    name: 'LIRI Event Designer™',
    badge: 'Création',
    icon: Palette,
    color: '#ec4899',
    promise: 'Conçois des expériences visuelles mémorables.',
    features: ['Conférences', 'Affiches IA', 'Vidéos', 'Événements'],
    power: 'Tu marques les esprits',
    highlight: false,
  },
  {
    id: 'liri-agents',
    name: 'LIRI Agents System™',
    badge: 'Automation',
    icon: Bot,
    color: '#f59e0b',
    promise: 'Des agents qui travaillent pendant que tu dors.',
    features: ['Marketing auto', 'Suivi client', 'Automatisation', 'Rapports'],
    power: 'Ton business tourne seul',
    highlight: true,
  },
  {
    id: 'liri-scheduler',
    name: 'LIRI Smart Scheduler™',
    badge: 'Temps',
    icon: Calendar,
    color: '#8b5cf6',
    promise: 'Ton temps devient intelligent.',
    features: ['Calendrier intelligent', 'Rendez-vous', 'Rappels', 'Optimisation'],
    power: 'Tu ne perds aucune opportunité',
    highlight: false,
  },
];

/* ── Mini dashboard rendered inside the Card ── */
const DashboardPreview = () => {
  const stats = [
    { label: 'Ventes totales', value: '125 340 €', delta: '+12%', icon: TrendingUp, color: '#8b5cf6' },
    { label: 'Commandes', value: '1 482', delta: '+8%', icon: ShoppingBag, color: '#06b6d4' },
    { label: 'Panier moyen', value: '84,63 €', delta: '+3%', icon: BarChart2, color: '#f59e0b' },
    { label: 'Taux conversion', value: '3,42 %', delta: '+1%', icon: Zap, color: '#10b981' },
  ];
  const modules_preview = [
    { name: 'Virtuel Mbolo', status: 'Actif', color: '#8b5cf6', icon: ShoppingCart },
    { name: 'Smart Logistics', status: 'Actif', color: '#06b6d4', icon: Truck },
    { name: 'Payflow Africa', status: 'Actif', color: '#f59e0b', icon: CreditCard },
    { name: 'LIRI AI Core', status: 'Actif', color: '#10b981', icon: Brain },
    { name: 'LIRI Agents', status: 'Actif', color: '#ec4899', icon: Bot },
    { name: 'LIRI EDU', status: 'En pause', color: '#6b7280', icon: GraduationCap },
  ];
  return (
    <div className="w-full h-full bg-[#07070f] flex overflow-hidden select-none">
      {/* Sidebar */}
      <div className="w-44 flex-shrink-0 border-r border-white/[0.06] flex flex-col p-3 gap-1">
        <div className="flex items-center gap-2 px-2 py-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-black text-white tracking-tight">CIMOLACE</span>
        </div>
        {['Tableau de bord','Produits','Commandes','Clients','Marketing','Livraisons','Analyses','Paramètres'].map((item, i) => (
          <div key={i} className={`px-2 py-1.5 rounded-lg text-[10px] cursor-pointer transition-colors ${i === 0 ? 'bg-violet-500/20 text-violet-300' : 'text-gray-500 hover:text-gray-300'}`}>
            {item}
          </div>
        ))}
      </div>
      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Virtuel Mbolo™</p>
            <h3 className="text-sm font-bold text-white">Tableau de bord</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 text-[8px] font-bold text-white flex items-center justify-center">N</div>
            <span className="text-[10px] text-gray-400 hidden sm:block">Cimolace</span>
          </div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s, i) => (
            <div key={i} className="rounded-xl p-3 border border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] text-gray-500 truncate">{s.label}</p>
                <s.icon className="w-2.5 h-2.5 flex-shrink-0" style={{ color: s.color }} />
              </div>
              <p className="text-xs font-bold text-white">{s.value}</p>
              <p className="text-[9px] mt-0.5" style={{ color: s.color }}>{s.delta}</p>
            </div>
          ))}
        </div>
        {/* Bottom row */}
        <div className="flex-1 grid grid-cols-5 gap-2 min-h-0">
          {/* Chart placeholder */}
          <div className="col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col">
            <p className="text-[9px] text-gray-500 mb-2">Évolution des ventes</p>
            <div className="flex-1 flex items-end gap-1 pb-1">
              {[35,55,40,70,60,80,65,90,75,95,85,100].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm transition-all" style={{ height: `${h}%`, background: `linear-gradient(to top, #8b5cf6, #06b6d4)`, opacity: 0.6 + i * 0.03 }} />
              ))}
            </div>
          </div>
          {/* Modules list */}
          <div className="col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col gap-1.5 overflow-hidden">
            <p className="text-[9px] text-gray-500 mb-1">Modules actifs</p>
            {modules_preview.map((m, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <m.icon className="w-2.5 h-2.5 flex-shrink-0" style={{ color: m.color }} />
                <span className="text-[9px] text-gray-300 flex-1 truncate">{m.name}</span>
                <span className="text-[8px] px-1 rounded" style={{ color: m.color, backgroundColor: `${m.color}15` }}>{m.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CimolaceModules = () => {
  return (
    <section id="modules" className="relative bg-[#0a0a0f]">
      {/* Background lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      </div>

      {/* ── ContainerScroll: header + dashboard preview ── */}
      <ContainerScroll
        titleComponent={
          <div className="mb-4">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block text-sm text-violet-400 tracking-[0.2em] uppercase mb-4"
            >
              NOS TECHNOLOGIES
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl lg:text-6xl font-black text-white mb-4 tracking-tight"
            >
              Un écosystème.{' '}
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Des possibilités infinies.
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-gray-400 max-w-2xl mx-auto"
            >
              Chaque module résout un problème réel du business africain.
              Ensemble, ils forment une infrastructure IA unifiée.
            </motion.p>
          </div>
        }
      >
        <DashboardPreview />
      </ContainerScroll>

      {/* ── Modules Grid (below the scroll card) ── */}
      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pb-32">
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-2xl font-bold text-white mb-12"
        >
          Dix modules. Une intelligence.
        </motion.h3>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {modules.map((module, index) => (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -8 }}
              className={`group relative p-6 rounded-2xl border backdrop-blur-xl transition-all duration-500 ${
                module.highlight
                  ? 'bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border-violet-500/30 hover:border-violet-500/60'
                  : 'bg-white/[0.02] border-white/[0.08] hover:border-white/20'
              }`}
            >
              {/* Glow Effect on Hover */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"
                style={{
                  background: `radial-gradient(circle at center, ${module.color}10 0%, transparent 70%)`,
                }}
              />

              {/* Badge */}
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
                style={{
                  backgroundColor: `${module.color}15`,
                  color: module.color,
                  border: `1px solid ${module.color}30`,
                }}
              >
                {module.badge}
              </span>

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${module.color}20, ${module.color}40)`,
                }}
              >
                <module.icon className="w-6 h-6" style={{ color: module.color }} />
              </div>

              {/* Name */}
              <h3 className="text-lg font-bold text-white mb-2">{module.name}</h3>

              {/* Promise */}
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">{module.promise}</p>

              {/* Features */}
              <div className="flex flex-wrap gap-2 mb-4">
                {module.features.slice(0, 2).map((feature) => (
                  <span
                    key={feature}
                    className="text-xs text-gray-500 px-2 py-1 rounded-md bg-white/5"
                  >
                    {feature}
                  </span>
                ))}
                {module.features.length > 2 && (
                  <span className="text-xs text-gray-500 px-2 py-1">+{module.features.length - 2}</span>
                )}
              </div>

              {/* Power Statement */}
              <div
                className="pt-4 border-t border-white/5"
                style={{ borderColor: `${module.color}20` }}
              >
                <p className="text-sm italic" style={{ color: module.color }}>
                  &ldquo;{module.power}&rdquo;
                </p>
              </div>

              {/* Arrow Link */}
              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-5 h-5 text-white/50" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <p className="text-gray-400 mb-6">Tous les modules s'intègrent nativement entre eux.</p>
          <motion.a
            href="#pricing"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-all"
          >
            Voir les offres incluant ces modules
            <ArrowRight className="w-5 h-5" />
          </motion.a>
        </motion.div>
      </div>  {/* end modules grid wrapper */}
    </section>
  );
};

export default CimolaceModules;
