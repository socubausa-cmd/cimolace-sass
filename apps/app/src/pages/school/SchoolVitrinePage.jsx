import React from 'react';
import SEO from '@/components/SEO';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, Users, HelpCircle, Mail, BookOpen, Target, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const PUBLIC = isnaTenantConfig.branding.publicSiteOrigin;
const SCHOOL = isnaTenantConfig.branding.name;
const SCHOOL_FULL = isnaTenantConfig.branding.fullName;
const SITE_NAME = `${SCHOOL} · LIRI`;

const SchoolVitrinePage = () => {

  return (
    <div className="min-h-screen bg-[#0F1419] text-white font-sans">
      <SEO
        title={`${SCHOOL} — Doctrine, cosmologie & cursus (5ᵉ Manikongo)`}
        description={`${SCHOOL_FULL} : cosmologie et science métaphysique du 5ᵉ Manikongo. École d'initiation aux Sciences Nocturnes Africaines — LIRI. Ontologie, Potentia Prima, formations, coaching et mentorat.`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `${SCHOOL} — Doctrine & cursus (5ᵉ Manikongo)`,
          description: `${SCHOOL_FULL} : école d'initiation aux Sciences Nocturnes Africaines — LIRI.`,
          url: `${PUBLIC}/`,
          isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: PUBLIC },
        }}
      />

      <section className="relative overflow-hidden pt-28 pb-20 border-b border-white/5">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#0F1419]/90 to-[#0F1419]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
              <BookOpen className="w-4 h-4 text-[#D4AF37]" />
              Initiation aux Sciences Nocturnes Africaines
            </div>

            <h1 className="mt-6 text-4xl md:text-6xl font-serif font-bold leading-tight">
              {SCHOOL} <span className="text-[#D4AF37]">· LIRI</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-gray-300 leading-relaxed">
              {`Cosmologie et science métaphysique du 5ᵉ Manikongo : intégrer science et spiritualité pour une transformation authentique — ${SITE_NAME}.`}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link to="/signup">
                <Button className="bg-[#D4AF37] text-black hover:bg-[#bfa345] font-bold h-12 px-8">
                  Devenir membre
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>

              <Link to="/formations">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/5 h-12 px-8">
                  Voir les programmes
                </Button>
              </Link>

              <Link to="/a-propos">
                <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/5 h-12 px-8">
                  Découvrir la vision
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-[#192734] border border-white/5 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center mb-5">
                <Target className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold mb-2">Mission</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Restaurer la dignité intellectuelle et spirituelle par une connaissance rigoureuse.
              </p>
              <div className="mt-6">
                <Link to="/a-propos" className="text-[#D4AF37] text-sm font-medium hover:underline">
                  En savoir plus
                </Link>
              </div>
            </div>

            <div className="bg-[#192734] border border-white/5 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center mb-5">
                <Eye className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold mb-2">Vision</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Unifier la physique et la métaphysique dans une structure cohérente de connaissance.
              </p>
              <div className="mt-6">
                <Link to="/a-propos" className="text-[#D4AF37] text-sm font-medium hover:underline">
                  Lire la vision
                </Link>
              </div>
            </div>

            <div className="bg-[#192734] border border-white/5 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center mb-5">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold mb-2">Programmes</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Des parcours structurés : savoir théorique, pratique opérative, accompagnement.
              </p>
              <div className="mt-6">
                <Link to="/formations" className="text-[#D4AF37] text-sm font-medium hover:underline">
                  Explorer les formations
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#0B0E11] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Link to="/equipe" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3 text-lg font-bold">
                <Users className="w-5 h-5 text-[#D4AF37]" />
                Notre équipe
              </div>
              <p className="mt-3 text-sm text-gray-400">Rencontrez les gardiens du savoir et le corps professoral.</p>
            </Link>

            <Link to="/faq" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3 text-lg font-bold">
                <HelpCircle className="w-5 h-5 text-[#D4AF37]" />
                FAQ
              </div>
              <p className="mt-3 text-sm text-gray-400">Admission, cursus, forfaits, certifications.</p>
            </Link>

            <Link to="/nous-contacter" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3 text-lg font-bold">
                <Mail className="w-5 h-5 text-[#D4AF37]" />
                Contact
              </div>
              <p className="mt-3 text-sm text-gray-400">Posez vos questions et contactez le secrétariat.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-serif font-bold">{`Explorer ${SCHOOL} & la bibliothèque`}</h2>
              <p className="mt-3 text-gray-300">
                Accédez aux ouvrages fondateurs, aux programmes et aux voies d'accompagnement. Ces liens aident aussi Google à découvrir toutes les pages importantes.
              </p>
            </div>
            <Link to="/bibliotheque" className="text-[#D4AF37] font-semibold hover:underline">
              Voir la Bibliothèque
            </Link>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-6">
            <Link to="/bibliotheque" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3 text-lg font-bold">
                <BookOpen className="w-5 h-5 text-[#D4AF37]" />
                {`Bibliothèque — ${SCHOOL}`}
              </div>
              <p className="mt-3 text-sm text-gray-400">Tous les livres, séries, filtres et accès de lecture.</p>
            </Link>

            <Link to="/fond-de-tout" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="text-lg font-bold">Le Fond de Tout</div>
              <p className="mt-3 text-sm text-gray-400">Livre I — concepts fondamentaux, ontologie et principes.</p>
            </Link>

            <Link to="/dialogue-physique" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="text-lg font-bold">Le Dialogue avec la Physique</div>
              <p className="mt-3 text-sm text-gray-400">Livre II — unification, structure et correspondances.</p>
            </Link>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-6">
            <Link to="/ontodynamique" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="text-lg font-bold">Ontodynamique</div>
              <p className="mt-3 text-sm text-gray-400">Partie V — dynamique ontologique et opérativité.</p>
            </Link>

            <Link to="/formations" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="text-lg font-bold">Formations initiatiques</div>
              <p className="mt-3 text-sm text-gray-400">Cycles, programmes, modalités et accès aux parcours.</p>
            </Link>

            <Link to="/ecoles" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="text-lg font-bold">Les 21 Sciences Mystiques Africaines</div>
              <p className="mt-3 text-sm text-gray-400">Curriculum officiel — cycles et sciences par niveaux.</p>
            </Link>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-6">
            <Link to="/accompagnement/coaching" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="text-lg font-bold">Coaching thérapeutique</div>
              <p className="mt-3 text-sm text-gray-400">Formation privée et pratique de l'intervention spirituelle.</p>
            </Link>

            <Link to="/accompagnement/mentorat" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="text-lg font-bold">Mentorat spirituel</div>
              <p className="mt-3 text-sm text-gray-400">Assistance active et personnelle par le Moniteur spirituel.</p>
            </Link>

            <Link to="/a-propos/fondateur" className="bg-[#192734] border border-white/5 rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="text-lg font-bold">Le Fondateur</div>
              <p className="mt-3 text-sm text-gray-400">Parcours, vision et mission du 5ᵉ Manikongo.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-br from-[#192734] to-[#0f1216] rounded-3xl p-10 md:p-16 border border-white/10">
            <h2 className="text-3xl font-serif font-bold">Prêt à rejoindre la communauté ?</h2>
            <p className="text-gray-300 mt-4 max-w-2xl">
              Créez votre compte pour accéder à l'espace élève : formations, vie scolaire, messagerie et accompagnement.
            </p>
            <div className="mt-8">
              <Link to="/signup">
                <Button className="bg-[#D4AF37] text-black hover:bg-[#bfa345] font-bold h-12 px-8">
                  Devenir membre
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SchoolVitrinePage;
