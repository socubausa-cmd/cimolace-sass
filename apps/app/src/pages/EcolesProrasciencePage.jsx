import React, { useEffect, useState } from 'react';
import SEO from '@/components/SEO';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Ecoles21SciencesScienceCard } from '@/components/prorascience/Ecoles21SciencesScienceCard';
import {
  Atom,
  Crown,
  Eye,
  Flame,
  Scale,
  Sparkles,
  ArrowRight,
  BookOpen,
  MessageCircle,
  ChevronDown,
  GraduationCap,
} from 'lucide-react';
import { ECOLES_SCIENCE_COLOR_PALETTE as colorPalette, ECOLES_SCIENCE_ICONS as iconsList, ECOLES_SCIENCES as sciences, ECOLES_CYCLES_DATA as cyclesData } from '@/data/ecoles21SciencesData';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const EcolesProrasciencePage = () => {
  const [redirectMobile, setRedirectMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setRedirectMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const [activeFilter, setActiveFilter] = useState('all');

  const filteredSciences = activeFilter === 'all'
    ? sciences
    : sciences.filter(s => {
        const cycle = cyclesData.find(c => c.number === parseInt(activeFilter));
        return cycle && cycle.scienceNums.includes(s.number);
      });

  if (redirectMobile) {
    return <Navigate to={ELEVE_MOBILE.prorascienceLes21Sciences} replace />;
  }

  return (
    <div className="min-h-screen bg-[#0F1419] text-white">
      <SEO
        title="Les 21 Sciences Mystiques Africaines"
        description={`Découvrez les 21 sciences mystiques africaines : curriculum officiel ${isnaTenantConfig.branding.name}. 4 cycles initiatiques, de la Nécromancie à la Théurgie, par le 5ᵉ Manikongo.`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: 'Les 21 Sciences Mystiques Africaines',
          provider: {
            '@type': 'EducationalOrganization',
            name: isnaTenantConfig.branding.fullName,
            url: isnaTenantConfig.branding.publicSiteOrigin,
          },
          description: 'Curriculum complet des 21 sciences mystiques africaines réparties en 4 cycles initiatiques.',
          url: `${isnaTenantConfig.branding.publicSiteOrigin}/ecoles`,
          inLanguage: 'fr',
        }}
      />

      {/* HERO */}
      <section className="relative py-28 md:py-36 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/60 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[200px]" />
        <div className="absolute top-20 right-20 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[150px]" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] text-xs font-bold uppercase tracking-widest border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
            <BookOpen className="w-4 h-4" /> Curriculum officiel
          </span>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-tight">
            Les 21 Sciences<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] via-yellow-400 to-[var(--school-accent)]">
              Mystiques Africaines
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            {`La carte complète du savoir initiatique — base officielle de l'université ${isnaTenantConfig.branding.name} (réseau Ngowazulu). Un nganga complet maîtrise ces 21 domaines sacrés.`}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/ecoles/prorascience">
              <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2 h-11 px-6 font-semibold">
                <Sparkles className="w-4 h-4" />
                Voir la page commerciale premium
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/5 h-11 px-6">
                <ArrowRight className="w-4 h-4 mr-2" />
                Commencer maintenant
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 text-sm text-gray-500">
            <span className="text-gray-600">Vitrines :</span>
            <Link to="/ecoles/prorascience-apple-story" className="text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)] hover:text-[var(--school-accent)] underline-offset-2 hover:underline">
              Récit Apple Story
            </Link>
            <span className="text-gray-700">·</span>
            <Link to="/ecoles/prorascience-apple-story-v3" className="text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)] hover:text-[var(--school-accent)] underline-offset-2 hover:underline">
              Variante cinéma (V3)
            </Link>
            <span className="text-gray-700">·</span>
            <Link to="/ecoles/isna-pro" className="text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)] hover:text-[var(--school-accent)] underline-offset-2 hover:underline">
              ISNA Pro
            </Link>
          </div>

          <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent mx-auto" />

          <p className="text-sm text-gray-600 uppercase tracking-widest">
            {`Établi par le 5ème Manikongo — Système MK5 / NGOWAZULU / ${isnaTenantConfig.branding.name}`}
          </p>

          <ChevronDown className="w-6 h-6 text-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] mx-auto animate-bounce" />
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-20 space-y-20">

        {/* 4 CYCLES INITIATIQUES */}
        <section>
          <div className="text-center mb-10">
            <GraduationCap className="w-8 h-8 text-[var(--school-accent)] mx-auto mb-3" />
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-3">
              Les 4 Cycles Initiatiques
            </h2>
            <p className="text-gray-400 text-base max-w-xl mx-auto">
              Le parcours du nganga s'organise en 4 cycles progressifs — de la compréhension à l\'autorité.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {cyclesData.map((cycle) => (
              <div key={cycle.number} className={`relative bg-gradient-to-br from-[#192734] to-[#0f1216] border ${cycle.border} rounded-2xl p-6 hover:shadow-2xl transition-all duration-300`}>
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r ${cycle.accent} text-white text-xs font-bold uppercase tracking-wider`}>
                  Cycle {cycle.number}
                </div>
                <div className="mt-4 text-center">
                  <h3 className="text-xl font-serif font-bold text-white mb-1">{cycle.name}</h3>
                  <span className="inline-block px-3 py-0.5 rounded-full bg-white/5 text-sm text-gray-400 font-medium mb-3">
                    {cycle.verb}
                  </span>
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">{cycle.description}</p>
                  <div className="space-y-1.5">
                    {cycle.scienceNums.map(num => {
                      const sc = sciences.find(s => s.number === num);
                      const palette = colorPalette[num - 1];
                      const Icon = iconsList[num - 1];
                      return (
                        <div key={num} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 text-left">
                          <Icon className={`w-4 h-4 ${palette.accent} shrink-0`} />
                          <span className="text-sm text-gray-300">{sc?.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FILTRE + GRILLE DES 21 SCIENCES */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-3">
              Les 21 Sciences
            </h2>
            <p className="text-gray-400 text-base max-w-xl mx-auto mb-6">
              Chaque science ouvre une porte vers une dimension de la réalité.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeFilter === 'all' ? 'bg-[var(--school-accent)] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                Toutes (21)
              </button>
              {cyclesData.map(c => (
                <button
                  key={c.number}
                  onClick={() => setActiveFilter(String(c.number))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeFilter === String(c.number) ? 'bg-[var(--school-accent)] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  Cycle {c.number} — {c.verb}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-7">
            {filteredSciences.map((science) => (
              <Ecoles21SciencesScienceCard key={science.number} science={science} />
            ))}
          </div>
        </section>

        {/* VISION GLOBALE */}
        <section className="bg-gradient-to-br from-[#192734] to-[#0f1216] rounded-3xl p-8 md:p-12 border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative text-center max-w-3xl mx-auto">
            <Sparkles className="w-8 h-8 text-[var(--school-accent)] mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-4">
              Une Science Complète de la Réalité Africaine
            </h2>
            <p className="text-gray-300 text-lg leading-relaxed mb-8">
              {`L'école ${isnaTenantConfig.branding.name} (réseau Ngowazulu) enseigne les 4 piliers de la maîtrise initiatique :`}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Comprendre le monde", icon: Atom },
                { label: "Voir l'invisible", icon: Eye },
                { label: "Agir sur la réalité", icon: Flame },
                { label: "Guider la société", icon: Scale },
              ].map((item, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <item.icon className="w-6 h-6 text-[var(--school-accent)] mx-auto mb-2" />
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HÉRITAGE */}
        <section className="text-center max-w-3xl mx-auto">
          <Crown className="w-10 h-10 text-[var(--school-accent)] mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-4">
            Un corpus comparable aux grandes traditions
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed mb-6">
            Ce système initiatique est comparable aux écoles antiques — un héritage africain moderne
            structuré en <span className="text-[var(--school-accent)] font-semibold">académie initiatique</span>,{' '}
            <span className="text-[var(--school-accent)] font-semibold">université spirituelle</span> et{' '}
            <span className="text-[var(--school-accent)] font-semibold">doctrine africaine souveraine</span>.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {["Égypte antique", "Grèce antique", "Inde védique", "Tibet sacré"].map((t, i) => (
              <span key={i} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 font-medium">{t}</span>
            ))}
          </div>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent mx-auto mb-8" />
          <p className="text-gray-300 italic text-lg leading-relaxed mb-4">
            « La Prorascience n'est pas une croyance. C\'est une science de la réalité dans sa totalité — visible et invisible. »
          </p>
          <p className="text-sm text-gray-600 uppercase tracking-widest">
            — 5ème Manikongo, Fondateur de l'Académie Prorascience
          </p>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-[#192734] to-[#0f1216] rounded-3xl p-10 md:p-16 text-center border border-white/10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative space-y-6">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
              Prêt à entrer dans l'Académie ?
            </h2>
            <p className="text-gray-400 text-base max-w-lg mx-auto">
              Découvrez nos formations, rejoignez la communauté et commencez votre parcours initiatique.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/formations">
                <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2 h-12 px-8 text-lg font-bold">
                  <BookOpen className="w-5 h-5" /> Voir les formations
                </Button>
              </Link>
              <a href="/appointment/request">
                <Button variant="outline" className="border-white/20 hover:bg-white/5 text-white h-12 px-8 text-lg">
                  <MessageCircle className="w-5 h-5 mr-2" /> Prendre rendez-vous
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">
            {`© ${isnaTenantConfig.branding.name} — Curriculum officiel des 21 sciences mystiques africaines — MK5 / NGOWAZULU`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EcolesProrasciencePage;
