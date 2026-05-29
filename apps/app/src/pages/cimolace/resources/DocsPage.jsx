import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Boxes, CheckCircle2, FileText, Layers3, Search, ShieldCheck, Wrench } from 'lucide-react';
import { COMMERCIAL_OFFERS, FEATURE_CATALOGUE, INCLUSION_LEVELS, OS_STABILITY_MATRIX, PRODUCT_LEVEL_DEFINITIONS, TOOL_CATALOGUE } from '@/data/cimolaceProductTaxonomy';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

const docSections = [
  {
    title: 'OS prêts à l\'emploi',
    eyebrow: 'Infrastructures métier',
    icon: ShieldCheck,
    color: '#06b6d4',
    body: 'Comprendre les configurations complètes : School OS, Commerce OS, Creator OS, Business OS, Media OS et Temple en ligne.',
    items: ['Définition', 'Audience', 'Outils inclus', 'Stabilité', 'Fonctionnalités visibles'],
  },
  {
    title: 'Offres commerciales',
    eyebrow: 'Portes d\'entrée',
    icon: Boxes,
    color: '#10b981',
    body: 'Comprendre les solutions vendables séparément : live room, creator studio, school engine, admin booking ou commerce.',
    items: ['Problème résolu', 'Outils utilisés', 'OS compatibles', 'Cas d\'usage', 'Évolution possible'],
  },
  {
    title: 'Outils et moteurs',
    eyebrow: 'Briques spécialisées',
    icon: Wrench,
    color: '#f59e0b',
    body: 'Documenter chaque moteur : live, paiement, SmartBoard, post-production, multilangue, IA, logistique ou calendrier.',
    items: ['Rôle', 'Fonction', 'Entrées/sorties', 'OS où il apparaît', 'Risque si absent'],
  },
  {
    title: 'Fonctionnalités',
    eyebrow: 'Actions utilisateur',
    icon: CheckCircle2,
    color: '#ec4899',
    body: 'Expliquer ce que l\'utilisateur peut faire concrètement dans l\'interface grâce aux outils et offres.',
    items: ['Créer un live', 'Générer un replay', 'Créer un lien de paiement', 'Traduire des captions', 'Générer des flashcards'],
  },
];

const templates = [
  {
    title: 'Template OS',
    fields: ['Définition', 'Pour qui', 'Chaîne de travail', 'Outils indispensables', 'Outils recommandés', 'Outils optionnels', 'Fonctionnalités', 'FAQ'],
  },
  {
    title: 'Template offre',
    fields: ['Problème résolu', 'Promesse', 'Outils inclus', 'OS compatibles', 'Parcours utilisateur', 'Limites', 'Évolution vers OS'],
  },
  {
    title: 'Template outil',
    fields: ['Rôle', 'Fonction', 'Catégorie', 'Entrées', 'Sorties', 'Utilisé dans', 'Risque si absent', 'Fonctionnalités produites'],
  },
  {
    title: 'Template fonctionnalité',
    fields: ['Action utilisateur', 'Outil producteur', 'Où elle apparaît', 'Étapes', 'Résultat', 'Questions fréquentes'],
  },
];

const DocSectionCard = ({ section }) => {
  const Icon = section.icon;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: `${section.color}18` }}>
        <Icon className="w-6 h-6" style={{ color: section.color }} />
      </div>
      <p className="text-[10px] uppercase tracking-[0.28em] font-bold mb-3" style={{ color: section.color }}>{section.eyebrow}</p>
      <h2 className="text-2xl font-black text-white mb-3">{section.title}</h2>
      <p className="text-sm text-white/45 leading-relaxed mb-5">{section.body}</p>
      <div className="flex flex-wrap gap-2">
        {section.items.map((item) => (
          <span key={item} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/40 border border-white/[0.06]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

const ToolDocCard = ({ toolId, tool }) => {
  return (
    <Link to={`/cimolace/resources/documentation/outils/${toolId}`} className="block rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 hover:border-cyan-300/25 transition-colors">
      <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/70 mb-2">{tool.category}</p>
      <h3 className="text-lg font-black text-white mb-3">{tool.name}</h3>
      <p className="text-sm text-white/45 leading-relaxed mb-4">{tool.function}</p>
      <p className="text-xs text-white/25">ID documentation : <span className="text-white/45">{toolId}</span></p>
    </Link>
  );
};

const OsDocCard = ({ osKey, os }) => {
  return (
    <Link to={`/cimolace/resources/documentation/os/${osKey}`} className="block rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 hover:border-cyan-300/25 transition-colors">
      <p className="text-[10px] uppercase tracking-[0.28em] text-violet-300/70 mb-2">OS prêt à l'emploi</p>
      <h3 className="text-2xl font-black text-white mb-4">{os.name}</h3>
      <div className="flex flex-wrap gap-2 mb-5">
        {os.stabilityChain.map((step) => (
          <span key={step} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/40 border border-white/[0.06]">
            {step}
          </span>
        ))}
      </div>
      <div className="space-y-3">
        {os.tools.slice(0, 4).map((entry) => {
          const tool = TOOL_CATALOGUE[entry.toolId];
          if (!tool) return null;
          const color = entry.level === 'required' ? '#ef4444' : entry.level === 'recommended' ? '#f59e0b' : '#06b6d4';

          return (
            <div key={`${osKey}-${entry.toolId}`} className="flex items-start justify-between gap-3 rounded-xl bg-black/20 border border-white/[0.06] p-3">
              <div>
                <p className="text-sm font-bold text-white">{tool.name}</p>
                <p className="text-xs text-white/30 mt-1">{entry.role}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap" style={{ color, backgroundColor: `${color}14`, border: `1px solid ${color}35` }}>
                {INCLUSION_LEVELS[entry.level]?.label}
              </span>
            </div>
          );
        })}
      </div>
    </Link>
  );
};

const OfferDocCard = ({ offerId, offer }) => {
  return (
    <Link to={`/cimolace/resources/documentation/offres/${offerId}`} className="block rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 hover:border-emerald-300/25 transition-colors">
      <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-300/70 mb-2">{offer.category}</p>
      <h3 className="text-2xl font-black text-white mb-3">{offer.name}</h3>
      <p className="text-sm text-white/55 leading-relaxed mb-3">{offer.promise}</p>
      <p className="text-sm text-white/35 leading-relaxed mb-5">{offer.problemSolved}</p>
      <div className="mb-5">
        <p className="text-xs text-white/25 mb-2">Outils utilisés</p>
        <div className="flex flex-wrap gap-2">
          {offer.tools.map((toolId) => (
            <span key={`${offerId}-${toolId}`} className="text-[10px] px-2.5 py-1 rounded-full bg-cyan-400/10 text-cyan-200/70 border border-cyan-300/15">
              {TOOL_CATALOGUE[toolId]?.name || toolId}
            </span>
          ))}
        </div>
      </div>
      <div className="mb-5">
        <p className="text-xs text-white/25 mb-2">Incluse dans</p>
        <div className="flex flex-wrap gap-2">
          {offer.includedInOs.map((osId) => (
            <span key={`${offerId}-${osId}`} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/45 border border-white/[0.06]">
              {OS_STABILITY_MATRIX[osId]?.name || osId}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-white/25 mb-2">Fonctionnalités produites</p>
        <div className="flex flex-wrap gap-2">
          {offer.producedFeatures.map((feature) => (
            <span key={`${offerId}-${feature}`} className="text-[10px] px-2.5 py-1 rounded-full bg-pink-400/10 text-pink-200/70 border border-pink-300/15">
              {feature}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
};

export default function CimolaceDocsPage() {
  const toolEntries = Object.entries(TOOL_CATALOGUE);
  const osEntries = Object.entries(OS_STABILITY_MATRIX);
  const offerEntries = Object.entries(COMMERCIAL_OFFERS);
  const featureEntries = Object.entries(FEATURE_CATALOGUE);

  return (
    <div className="min-h-screen bg-[#07070f] text-white overflow-hidden">
      <Helmet>
        <title>Documentation CIMOLACE | {cimolacePlatformConfig.productName}</title>
        <meta name="description" content="Centre de documentation CIMOLACE pour comprendre les OS, offres, outils, moteurs et fonctionnalités." />
      </Helmet>

      <section className="relative px-6 py-24 lg:py-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-violet-600/10 blur-[170px]" />
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-cyan-500/8 blur-[140px]" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <Link to={cimolacePlatformConfig.routes.home} className="inline-flex items-center text-sm text-violet-300 hover:text-violet-200 transition-colors mb-10">
            ← Retour à l'accueil
          </Link>

          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-400/70 mb-5">Centre de documentation</p>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-[0.95] mb-8">
              Documenter chaque OS, chaque outil, <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">chaque fonctionnalité.</span>
            </h1>
            <p className="text-xl text-white/50 leading-relaxed max-w-3xl">
              La documentation CIMOLACE sert à expliquer ce que chaque élément fait, pourquoi il existe dans la gamme, où il apparaît et ce qui devient instable sans lui.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {docSections.map((section) => (
            <DocSectionCard key={section.title} section={section} />
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-violet-400/70 mb-3">Glossaire produit</p>
              <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Les mots officiels de la gamme</h2>
            </div>
            <Link to={cimolacePlatformConfig.routes.comparison} className="inline-flex items-center gap-2 text-sm font-bold text-cyan-300 hover:text-cyan-200 transition-colors">
              Voir la comparaison
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {PRODUCT_LEVEL_DEFINITIONS.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/70 mb-3">{item.label}</p>
                <h3 className="text-lg font-black text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{item.definition}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/70 mb-3">Index OS</p>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Infrastructures documentées</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {osEntries.map(([osKey, os]) => (
              <OsDocCard key={osKey} osKey={osKey} os={os} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-400/70 mb-3">Index offres</p>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Portes d'entrée commerciales</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {offerEntries.map(([offerId, offer]) => (
              <OfferDocCard key={offerId} offerId={offerId} offer={offer} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-violet-400/70 mb-3">Index outils</p>
              <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Outils et moteurs du catalogue</h2>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-white/35 text-sm">
              <Search className="w-4 h-4" />
              Recherche visuelle à venir
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {toolEntries.map(([toolId, tool]) => (
              <ToolDocCard key={toolId} toolId={toolId} tool={tool} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/70 mb-3">Index fonctionnalités</p>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Ce que l'utilisateur peut faire</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featureEntries.map(([featureId, feature]) => (
              <Link key={featureId} to={`/cimolace/resources/documentation/fonctionnalites/${featureId}`} className="block rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 hover:border-pink-300/25 transition-colors">
                <p className="text-[10px] uppercase tracking-[0.24em] text-pink-300/70 mb-3">Fonctionnalité</p>
                <h3 className="text-xl font-black text-white mb-4">{feature.name}</h3>
                <p className="text-sm text-white/45 leading-relaxed mb-4">{feature.userGoal}</p>
                <div className="mb-4">
                  <p className="text-xs text-white/25 mb-2">Produite par</p>
                  <div className="flex flex-wrap gap-2">
                    {feature.producedByTools.map((toolId) => (
                      <span key={`${featureId}-${toolId}`} className="text-[10px] px-2.5 py-1 rounded-full bg-cyan-400/10 text-cyan-200/70 border border-cyan-300/15">
                        {TOOL_CATALOGUE[toolId]?.name || toolId}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-white/25 mb-2">Apparaît dans</p>
                  <div className="flex flex-wrap gap-2">
                    {feature.appearsInOs.map((osId) => (
                      <span key={`${featureId}-${osId}`} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/40 border border-white/[0.06]">
                        {OS_STABILITY_MATRIX[osId]?.name || osId}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-white/30 leading-relaxed mt-4">Résultat : {feature.result}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-violet-400/70 mb-3">Templates de documentation</p>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Chaque fiche doit répondre aux mêmes questions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {templates.map((template) => (
              <div key={template.title} className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">
                <div className="w-11 h-11 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-5">
                  <FileText className="w-5 h-5 text-white/60" />
                </div>
                <h3 className="text-xl font-black text-white mb-4">{template.title}</h3>
                <div className="space-y-2">
                  {template.fields.map((field) => (
                    <div key={field} className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-cyan-300/70 flex-shrink-0" />
                      <p className="text-sm text-white/45">{field}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-28">
        <div className="max-w-5xl mx-auto rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-violet-600/15 to-cyan-500/10 p-8 lg:p-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-4">Parcours recommandé</p>
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-5">Lire le guide, comparer, puis choisir.</h2>
          <p className="text-white/50 leading-relaxed max-w-2xl mx-auto mb-8">
            Le guide explique la logique, la comparaison aide à choisir le bon niveau, et le catalogue présente les offres disponibles.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={cimolacePlatformConfig.routes.resourcesGuide} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-gray-950 font-bold text-sm hover:bg-white/90 transition-colors">
              Lire le guide
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to={cimolacePlatformConfig.routes.solutions} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white font-bold text-sm hover:bg-white/[0.1] transition-colors">
              Voir le catalogue
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

