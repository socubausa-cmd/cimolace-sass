import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, CheckCircle2, Layers3, ShieldCheck, Wrench } from 'lucide-react';
import { INCLUSION_LEVELS, OS_STABILITY_MATRIX, PRODUCT_LEVEL_DEFINITIONS, TOOL_CATALOGUE } from '@/data/cimolaceProductTaxonomy';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

const levelIcons = [Layers3, ShieldCheck, Boxes, Wrench, CheckCircle2];
const levelColors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

const comparisonRows = [
  {
    type: 'OS prêt à l’emploi',
    question: 'Je veux une infrastructure complète pour mon métier.',
    answer: 'Choisir une configuration déjà assemblée avec les outils critiques inclus.',
    example: 'School OS, Commerce OS, Creator OS',
  },
  {
    type: 'Offre commerciale',
    question: 'J’ai un problème précis à résoudre maintenant.',
    answer: 'Choisir une porte d’entrée ciblée qui peut ensuite grandir vers un OS.',
    example: 'Creator Studio, Live Room Immersive, Virtuel-Mbolo',
  },
  {
    type: 'Outil / moteur',
    question: 'Je veux seulement une capacité spécialisée.',
    answer: 'Ajouter une brique précise à une stack existante ou à un OS.',
    example: 'Payment Link Engine, SmartBoard Designer, VideoPostProduction',
  },
  {
    type: 'Fonctionnalité',
    question: 'Je veux savoir ce que je peux faire concrètement.',
    answer: 'Lire l’action utilisateur produite par un outil ou une combinaison d’outils.',
    example: 'Créer un replay, générer des flashcards, envoyer une relance',
  },
];

const choiceCards = [
  {
    title: 'Vous démarrez de zéro',
    recommendation: 'Prenez un OS',
    body: 'Vous avez besoin d’un système complet, pas d’une liste de briques à assembler.',
  },
  {
    title: 'Vous avez déjà une activité',
    recommendation: 'Prenez une offre',
    body: 'Vous pouvez résoudre un problème précis puis évoluer vers une infrastructure complète.',
  },
  {
    title: 'Vous avez déjà votre stack',
    recommendation: 'Prenez un outil',
    body: 'Vous ajoutez une capacité ciblée sans remplacer toute votre organisation.',
  },
];

const InclusionBadge = ({ level }) => {
  const colors = {
    required: '#ef4444',
    recommended: '#f59e0b',
    optional: '#06b6d4',
  };
  const color = colors[level] || '#8b5cf6';

  return (
    <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ color, backgroundColor: `${color}14`, border: `1px solid ${color}35` }}>
      {INCLUSION_LEVELS[level]?.label || level}
    </span>
  );
};

const LevelCard = ({ item, index }) => {
  const Icon = levelIcons[index] || Boxes;
  const color = levelColors[index] || '#8b5cf6';

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <p className="text-[10px] uppercase tracking-[0.28em] font-bold mb-3" style={{ color }}>{item.label}</p>
      <h3 className="text-xl font-black text-white mb-3">{item.title}</h3>
      <p className="text-sm text-white/45 leading-relaxed mb-4">{item.definition}</p>
      <p className="text-xs text-white/30">Exemple : <span className="text-white/60">{item.example}</span></p>
    </div>
  );
};

const OsStabilityCard = ({ os }) => {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-400/70 mb-2">Infrastructure stable</p>
        <h3 className="text-2xl font-black text-white mb-4">{os.name}</h3>
        <div className="flex flex-wrap gap-2">
          {os.stabilityChain.map((step) => (
            <span key={step} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/40 border border-white/[0.06]">
              {step}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {os.tools.slice(0, 4).map((entry) => {
          const tool = TOOL_CATALOGUE[entry.toolId];
          if (!tool) return null;

          return (
            <div key={entry.toolId} className="rounded-2xl bg-black/20 border border-white/[0.06] p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h4 className="text-sm font-bold text-white">{tool.name}</h4>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mt-1">{tool.category} · {entry.role}</p>
                </div>
                <InclusionBadge level={entry.level} />
              </div>
              <p className="text-xs text-white/45 leading-relaxed">{entry.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function CimolaceComparisonPage() {
  const osEntries = Object.values(OS_STABILITY_MATRIX);

  return (
    <div className="min-h-screen bg-[#07070f] text-white overflow-hidden">
      <Helmet>
        <title>Comparaison OS, offres et outils | {cimolacePlatformConfig.productName}</title>
        <meta name="description" content="Comprendre la différence entre infrastructure, OS prêt à l’emploi, offre commerciale, outil et fonctionnalité dans CIMOLACE." />
      </Helmet>

      <section className="relative px-6 py-24 lg:py-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-violet-600/10 blur-[170px]" />
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-cyan-500/8 blur-[140px]" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <Link to={cimolacePlatformConfig.routes.home} className="inline-flex items-center text-sm text-violet-300 hover:text-violet-200 transition-colors mb-10">
            ← Retour à l’accueil
          </Link>

          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-400/70 mb-5">Comparaison produit</p>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-[0.95] mb-8">
              OS, offres, outils : <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">arrêtons de tout mélanger.</span>
            </h1>
            <p className="text-xl text-white/50 leading-relaxed max-w-3xl">
              CIMOLACE se lit comme une architecture. L’infrastructure porte les OS, les OS assemblent des offres, les offres utilisent des outils, et les outils produisent des fonctionnalités visibles par l’utilisateur.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {PRODUCT_LEVEL_DEFINITIONS.map((item, index) => (
            <LevelCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-violet-400/70 mb-3">Tableau de décision</p>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Quel niveau choisir ?</h2>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025]">
            {comparisonRows.map((row, index) => (
              <div key={row.type} className={`grid grid-cols-1 lg:grid-cols-4 gap-4 p-6 ${index !== comparisonRows.length - 1 ? 'border-b border-white/[0.07]' : ''}`}>
                <div>
                  <p className="text-sm font-black text-white">{row.type}</p>
                </div>
                <p className="text-sm text-white/45 leading-relaxed">{row.question}</p>
                <p className="text-sm text-white/60 leading-relaxed">{row.answer}</p>
                <p className="text-sm text-cyan-300/70 leading-relaxed">{row.example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">
          {choiceCards.map((card) => (
            <div key={card.title} className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-7">
              <p className="text-sm text-white/35 mb-3">{card.title}</p>
              <h3 className="text-2xl font-black text-white mb-4">{card.recommendation}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/70 mb-3">Matrice de stabilité</p>
              <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Pourquoi un outil mérite sa place</h2>
            </div>
            <p className="text-sm text-white/40 leading-relaxed max-w-xl">
              Un outil est ajouté à un OS seulement s’il stabilise une étape critique : enseigner, vendre, encaisser, produire, diffuser, traduire, automatiser ou retenir.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {osEntries.map((os) => (
              <OsStabilityCard key={os.name} os={os} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-28">
        <div className="max-w-5xl mx-auto rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-violet-600/15 to-cyan-500/10 p-8 lg:p-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/45 mb-4">Suite logique</p>
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-5">Maintenant, on peut documenter chaque fonctionnalité.</h2>
          <p className="text-white/50 leading-relaxed max-w-2xl mx-auto mb-8">
            La comparaison clarifie les niveaux. La documentation expliquera ensuite chaque outil, chaque rôle, chaque fonctionnalité et chaque raison d’inclusion dans la gamme.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={cimolacePlatformConfig.routes.solutions} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-gray-950 font-bold text-sm hover:bg-white/90 transition-colors">
              Voir le catalogue
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to={cimolacePlatformConfig.routes.resourcesGuide} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white font-bold text-sm hover:bg-white/[0.1] transition-colors">
              Lire le guide
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
