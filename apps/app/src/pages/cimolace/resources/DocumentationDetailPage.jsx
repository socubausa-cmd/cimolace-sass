import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Boxes, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';
import { COMMERCIAL_OFFERS, FEATURE_CATALOGUE, INCLUSION_LEVELS, OS_STABILITY_MATRIX, TOOL_CATALOGUE } from '@/data/cimolaceProductTaxonomy';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

const typeLabels = {
  os: 'OS prêt à l\'emploi',
  offres: 'Offre commerciale',
  outils: 'Outil / moteur',
  fonctionnalites: 'Fonctionnalité',
};

const typeIcons = {
  os: ShieldCheck,
  offres: Boxes,
  outils: Wrench,
  fonctionnalites: CheckCircle2,
};

const typeColors = {
  os: '#06b6d4',
  offres: '#10b981',
  outils: '#f59e0b',
  fonctionnalites: '#ec4899',
};

const getDocEntry = (type, id) => {
  if (type === 'os') return OS_STABILITY_MATRIX[id];
  if (type === 'offres') return COMMERCIAL_OFFERS[id];
  if (type === 'outils') return TOOL_CATALOGUE[id];
  if (type === 'fonctionnalites') return FEATURE_CATALOGUE[id];
  return null;
};

const Pill = ({ children, color = '#06b6d4' }) => (
  <span className="text-[10px] px-2.5 py-1 rounded-full border" style={{ color, backgroundColor: `${color}12`, borderColor: `${color}25` }}>
    {children}
  </span>
);

const Section = ({ title, children }) => (
  <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 lg:p-8">
    <h2 className="text-2xl font-black text-white mb-5">{title}</h2>
    {children}
  </section>
);

const OsDetail = ({ item }) => (
  <div className="space-y-6">
    <Section title="Chaîne de stabilité">
      <div className="flex flex-wrap gap-2">
        {item.stabilityChain.map((step) => (
          <Pill key={step}>{step}</Pill>
        ))}
      </div>
    </Section>

    <Section title="Outils inclus et rôle de stabilité">
      <div className="space-y-4">
        {item.tools.map((entry) => {
          const tool = TOOL_CATALOGUE[entry.toolId];
          const color = entry.level === 'required' ? '#ef4444' : entry.level === 'recommended' ? '#f59e0b' : '#06b6d4';

          return (
            <div key={entry.toolId} className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
                <div>
                  <Link to={`/cimolace/resources/documentation/outils/${entry.toolId}`} className="text-lg font-black text-white hover:text-cyan-200 transition-colors">
                    {tool?.name || entry.toolId}
                  </Link>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/25 mt-1">{entry.role}</p>
                </div>
                <Pill color={color}>{INCLUSION_LEVELS[entry.level]?.label || entry.level}</Pill>
              </div>
              <p className="text-sm text-white/50 leading-relaxed mb-3">{entry.reason}</p>
              <p className="text-xs text-white/30 leading-relaxed">Risque si absent : {entry.absenceRisk}</p>
            </div>
          );
        })}
      </div>
    </Section>
  </div>
);

const OfferDetail = ({ item }) => (
  <div className="space-y-6">
    <Section title="Promesse et problème résolu">
      <p className="text-lg text-white/65 leading-relaxed mb-4">{item.promise}</p>
      <p className="text-sm text-white/45 leading-relaxed">{item.problemSolved}</p>
    </Section>

    <Section title="Outils utilisés">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {item.tools.map((toolId) => (
          <Link key={toolId} to={`/cimolace/resources/documentation/outils/${toolId}`} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 hover:border-cyan-300/25 transition-colors">
            <p className="font-bold text-white">{TOOL_CATALOGUE[toolId]?.name || toolId}</p>
            <p className="text-xs text-white/35 mt-2 leading-relaxed">{TOOL_CATALOGUE[toolId]?.function}</p>
          </Link>
        ))}
      </div>
    </Section>

    <Section title="Incluse dans ces OS">
      <div className="flex flex-wrap gap-2">
        {item.includedInOs.map((osId) => (
          <Link key={osId} to={`/cimolace/resources/documentation/os/${osId}`}>
            <Pill>{OS_STABILITY_MATRIX[osId]?.name || osId}</Pill>
          </Link>
        ))}
      </div>
    </Section>

    <Section title="Fonctionnalités produites">
      <div className="flex flex-wrap gap-2">
        {item.producedFeatures.map((feature) => (
          <Pill key={feature} color="#ec4899">{feature}</Pill>
        ))}
      </div>
    </Section>
  </div>
);

const ToolDetail = ({ id, item }) => {
  const relatedOs = Object.entries(OS_STABILITY_MATRIX).filter(([, os]) => os.tools.some((entry) => entry.toolId === id));
  const relatedOffers = Object.entries(COMMERCIAL_OFFERS).filter(([, offer]) => offer.tools.includes(id));
  const relatedFeatures = Object.entries(FEATURE_CATALOGUE).filter(([, feature]) => feature.producedByTools.includes(id));

  return (
    <div className="space-y-6">
      <Section title="Fonction de l'outil">
        <p className="text-lg text-white/60 leading-relaxed">{item.function}</p>
      </Section>

      <Section title="Utilisé dans les OS">
        <div className="flex flex-wrap gap-2">
          {relatedOs.map(([osId, os]) => (
            <Link key={osId} to={`/cimolace/resources/documentation/os/${osId}`}>
              <Pill>{os.name}</Pill>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Utilisé par les offres">
        <div className="flex flex-wrap gap-2">
          {relatedOffers.map(([offerId, offer]) => (
            <Link key={offerId} to={`/cimolace/resources/documentation/offres/${offerId}`}>
              <Pill color="#10b981">{offer.name}</Pill>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Fonctionnalités produites">
        <div className="flex flex-wrap gap-2">
          {relatedFeatures.map(([featureId, feature]) => (
            <Link key={featureId} to={`/cimolace/resources/documentation/fonctionnalites/${featureId}`}>
              <Pill color="#ec4899">{feature.name}</Pill>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
};

const FeatureDetail = ({ item }) => (
  <div className="space-y-6">
    <Section title="Objectif utilisateur">
      <p className="text-lg text-white/60 leading-relaxed mb-4">{item.userGoal}</p>
      <p className="text-sm text-white/40 leading-relaxed">Résultat : {item.result}</p>
    </Section>

    <Section title="Outils producteurs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {item.producedByTools.map((toolId) => (
          <Link key={toolId} to={`/cimolace/resources/documentation/outils/${toolId}`} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 hover:border-cyan-300/25 transition-colors">
            <p className="font-bold text-white">{TOOL_CATALOGUE[toolId]?.name || toolId}</p>
            <p className="text-xs text-white/35 mt-2 leading-relaxed">{TOOL_CATALOGUE[toolId]?.function}</p>
          </Link>
        ))}
      </div>
    </Section>

    <Section title="Offres liées">
      <div className="flex flex-wrap gap-2">
        {item.relatedOffers.map((offerId) => (
          <Link key={offerId} to={`/cimolace/resources/documentation/offres/${offerId}`}>
            <Pill color="#10b981">{COMMERCIAL_OFFERS[offerId]?.name || offerId}</Pill>
          </Link>
        ))}
      </div>
    </Section>

    <Section title="Présente dans ces OS">
      <div className="flex flex-wrap gap-2">
        {item.appearsInOs.map((osId) => (
          <Link key={osId} to={`/cimolace/resources/documentation/os/${osId}`}>
            <Pill>{OS_STABILITY_MATRIX[osId]?.name || osId}</Pill>
          </Link>
        ))}
      </div>
    </Section>
  </div>
);

export default function DocumentationDetailPage() {
  const { type, id } = useParams();
  const item = getDocEntry(type, id);
  const Icon = typeIcons[type] || BookOpen;
  const color = typeColors[type] || '#8b5cf6';
  const label = typeLabels[type] || 'Documentation';

  if (!item) {
    return (
      <div className="min-h-screen bg-[#07070f] text-white px-6 py-24">
        <Helmet>
          <title>Documentation introuvable | {cimolacePlatformConfig.productName}</title>
        </Helmet>
        <div className="max-w-3xl mx-auto">
          <Link to={cimolacePlatformConfig.routes.resourcesDocs} className="text-sm text-violet-300 hover:text-violet-200 transition-colors">← Retour à la documentation</Link>
          <h1 className="mt-8 text-4xl font-black">Fiche introuvable</h1>
          <p className="mt-4 text-white/50">Cette entrée de documentation n'existe pas encore.</p>
        </div>
      </div>
    );
  }

  const title = item.name;
  const subtitle = item.promise || item.function || item.userGoal || 'Fiche documentation CIMOLACE.';

  return (
    <div className="min-h-screen bg-[#07070f] text-white overflow-hidden">
      <Helmet>
        <title>{title} | Documentation {cimolacePlatformConfig.productName}</title>
        <meta name="description" content={subtitle} />
      </Helmet>

      <section className="relative px-6 py-24 lg:py-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[850px] h-[850px] rounded-full blur-[170px]" style={{ backgroundColor: `${color}18` }} />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <Link to={cimolacePlatformConfig.routes.resourcesDocs} className="inline-flex items-center text-sm text-violet-300 hover:text-violet-200 transition-colors mb-10">
            ← Retour à la documentation
          </Link>
          <div className="max-w-4xl">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: `${color}18` }}>
              <Icon className="w-7 h-7" style={{ color }} />
            </div>
            <p className="text-xs uppercase tracking-[0.35em] mb-5" style={{ color }}>{label}</p>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-[0.95] mb-8">{title}</h1>
            <p className="text-xl text-white/50 leading-relaxed max-w-3xl">{subtitle}</p>
          </div>
        </div>
      </section>

      <main className="px-6 pb-28">
        <div className="max-w-7xl mx-auto">
          {type === 'os' && <OsDetail item={item} />}
          {type === 'offres' && <OfferDetail item={item} />}
          {type === 'outils' && <ToolDetail id={id} item={item} />}
          {type === 'fonctionnalites' && <FeatureDetail item={item} />}

          <div className="mt-10 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-violet-600/15 to-cyan-500/10 p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/35 mb-3">Continuer</p>
              <h2 className="text-2xl font-black text-white">Explorer l'architecture complète</h2>
            </div>
            <Link to={cimolacePlatformConfig.routes.comparison} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-gray-950 font-bold text-sm hover:bg-white/90 transition-colors">
              Voir la comparaison
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
