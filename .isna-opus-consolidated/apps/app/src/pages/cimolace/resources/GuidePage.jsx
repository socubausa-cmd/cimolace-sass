import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Compass, Layers3, ShieldCheck, Wrench } from 'lucide-react';
import { INCLUSION_LEVELS, OS_STABILITY_MATRIX, PRODUCT_LEVEL_DEFINITIONS, TOOL_CATALOGUE } from '@/data/cimolaceProductTaxonomy';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';
import CimolacePremiumShell from '@/components/cimolace/CimolacePremiumShell';

const guideSteps = [
  {
    title: 'Identifier votre besoin réel',
    body: 'Avant de choisir un outil, il faut savoir si vous cherchez une infrastructure complète, une offre ciblée ou une simple capacité.',
  },
  {
    title: 'Choisir le bon niveau',
    body: 'OS pour démarrer avec une configuration métier, offre pour résoudre un problème précis, outil pour compléter une stack existante.',
  },
  {
    title: 'Vérifier la stabilité',
    body: 'Un système stable couvre toutes les étapes critiques : produire, vendre, encaisser, diffuser, suivre, automatiser et documenter.',
  },
  {
    title: 'Ajouter les outils au bon moment',
    body: 'Les outils indispensables viennent d’abord, les recommandés renforcent l’usage, les optionnels dépendent de votre modèle économique.',
  },
];

const decisionQuestions = [
  {
    question: 'Je suis une école, un commerce, un média ou un créateur et je veux tout démarrer vite.',
    answer: 'Choisissez un OS prêt à l’emploi.',
  },
  {
    question: 'J’ai déjà une activité mais je veux améliorer le live, les paiements, la production ou le marketing.',
    answer: 'Choisissez une offre commerciale.',
  },
  {
    question: 'J’ai déjà mes logiciels mais il me manque une capacité précise.',
    answer: 'Choisissez un outil du catalogue.',
  },
  {
    question: 'Je ne sais pas ce que chaque outil fait concrètement.',
    answer: 'Commencez par la documentation des fonctionnalités.',
  },
];

const compositionRules = [
  'Un OS ne doit pas être une accumulation arbitraire d’outils.',
  'Chaque outil doit stabiliser une étape critique de l’usage.',
  'Un outil indispensable retire un risque structurel.',
  'Un outil recommandé améliore la robustesse, la conversion ou la qualité.',
  'Un outil optionnel dépend du volume, du modèle économique ou du contexte.',
  'Une fonctionnalité doit toujours être reliée à l’outil qui la produit.',
];

const levelIcons = [Layers3, ShieldCheck, Compass, Wrench, CheckCircle2];
const levelColors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

const LevelMiniCard = ({ item, index }) => {
  const Icon = levelIcons[index] || Layers3;
  const color = levelColors[index] || '#8b5cf6';

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.24em] font-bold" style={{ color }}>{item.label}</p>
      </div>
      <h3 className="text-lg font-black text-white mb-2">{item.title}</h3>
      <p className="text-sm text-white/45 leading-relaxed">{item.definition}</p>
    </div>
  );
};

const StabilityExample = ({ os }) => {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">
      <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-400/70 mb-2">Exemple de stabilité</p>
      <h3 className="text-2xl font-black text-white mb-4">{os.name}</h3>
      <div className="flex flex-wrap gap-2 mb-6">
        {os.stabilityChain.map((step) => (
          <span key={step} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/40 border border-white/[0.06]">
            {step}
          </span>
        ))}
      </div>
      <div className="space-y-3">
        {os.tools.slice(0, 5).map((entry) => {
          const tool = TOOL_CATALOGUE[entry.toolId];
          if (!tool) return null;

          const color = entry.level === 'required' ? '#ef4444' : entry.level === 'recommended' ? '#f59e0b' : '#06b6d4';

          return (
            <div key={entry.toolId} className="rounded-2xl bg-black/20 border border-white/[0.06] p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h4 className="text-sm font-bold text-white">{tool.name}</h4>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mt-1">{entry.role}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ color, backgroundColor: `${color}14`, border: `1px solid ${color}35` }}>
                  {INCLUSION_LEVELS[entry.level]?.label}
                </span>
              </div>
              <p className="text-xs text-white/45 leading-relaxed">{entry.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function CimolaceGuidePage() {
  const schoolOs = OS_STABILITY_MATRIX['school-os'];
  const creatorOs = OS_STABILITY_MATRIX['creator-os'];

  return (
    <CimolacePremiumShell>
      <Helmet>
        <title>Guide CIMOLACE | {cimolacePlatformConfig.productName}</title>
        <meta name="description" content="Guide pour comprendre comment choisir un OS, une offre ou un outil CIMOLACE, et composer une infrastructure stable." />
      </Helmet>

      <section className="relative px-6 pb-24 pt-36 lg:pb-32 lg:pt-44">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[850px] h-[850px] rounded-full bg-violet-600/10 blur-[170px]" />
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-cyan-500/8 blur-[140px]" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <Link to={cimolacePlatformConfig.routes.home} className="inline-flex items-center text-sm text-violet-300 hover:text-violet-200 transition-colors mb-10">
            ← Retour à l’accueil
          </Link>

          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-400/70 mb-5">Guide produit</p>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-[0.95] mb-8">
              Composer une infrastructure stable, <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">pas empiler des outils.</span>
            </h1>
            <p className="text-xl text-white/50 leading-relaxed max-w-3xl">
              Ce guide explique comment lire la gamme CIMOLACE : quand choisir un OS, quand choisir une offre, quand ajouter un outil, et pourquoi chaque fonctionnalité doit avoir une place claire.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {guideSteps.map((step, index) => (
            <div key={step.title} className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">
              <span className="text-xs text-cyan-300/70 font-bold">0{index + 1}</span>
              <h2 className="text-xl font-black text-white mt-4 mb-3">{step.title}</h2>
              <p className="text-sm text-white/45 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-violet-400/70 mb-3">Les cinq niveaux</p>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Le vocabulaire à ne plus mélanger</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {PRODUCT_LEVEL_DEFINITIONS.map((item, index) => (
              <LevelMiniCard key={item.id} item={item} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/70 mb-3">Choisir vite</p>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-6">La question qui donne la bonne direction</h2>
            <div className="space-y-4">
              {decisionQuestions.map((item) => (
                <div key={item.question} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                  <p className="text-sm text-white/45 leading-relaxed mb-2">{item.question}</p>
                  <p className="text-sm font-bold text-white">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-violet-600/12 to-cyan-500/8 p-7">
            <p className="text-xs uppercase tracking-[0.3em] text-violet-300/80 mb-3">Règles de composition</p>
            <h3 className="text-2xl lg:text-3xl font-black text-white mb-6">Pourquoi un outil entre dans la gamme</h3>
            <div className="space-y-3">
              {compositionRules.map((rule) => (
                <div key={rule} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-300 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-white/55 leading-relaxed">{rule}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/70 mb-3">Exemples pratiques</p>
              <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Lire la stabilité d’un OS</h2>
            </div>
            <p className="text-sm text-white/40 leading-relaxed max-w-xl">
              La stabilité vient de la chaîne complète. Si une étape critique manque, l’utilisateur doit retourner vers un outil externe.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <StabilityExample os={schoolOs} />
            <StabilityExample os={creatorOs} />
          </div>
        </div>
      </section>

      <section className="px-6 pb-28">
        <div className="max-w-5xl mx-auto rounded-[2rem] border border-white/[0.08] bg-white/[0.025] p-8 lg:p-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/35 mb-4">Prochaine lecture</p>
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-5">Comparer, puis explorer le catalogue.</h2>
          <p className="text-white/50 leading-relaxed max-w-2xl mx-auto mb-8">
            Utilisez la comparaison pour choisir le bon niveau, puis le catalogue pour voir les offres et outils disponibles.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={cimolacePlatformConfig.routes.comparison} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-gray-950 font-bold text-sm hover:bg-white/90 transition-colors">
              Voir la comparaison
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to={cimolacePlatformConfig.routes.solutions} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white font-bold text-sm hover:bg-white/[0.1] transition-colors">
              Explorer le catalogue
            </Link>
          </div>
        </div>
      </section>
    </CimolacePremiumShell>
  );
}

