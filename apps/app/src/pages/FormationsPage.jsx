import React, { useEffect } from 'react';
import SEO from '@/components/SEO';
import { formationsData } from '@/lib/mockFormationsData';
import PricingCard from '@/components/pricing/PricingCard';
import ComparisonTable from '@/components/pricing/ComparisonTable';
import FormationGuideSection from '@/components/pricing/FormationGuideSection';
import PricingDocumentation from '@/components/pricing/PricingDocumentation';
import FinalitySection from '@/components/formations/FinalitySection';
import { Button } from '@/components/ui/button';
import { MessageCircle, ArrowDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const FormationsPage = () => {

  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-20 pb-20">
      <SEO
        title="École & Formations"
        description={`Formations ${isnaTenantConfig.branding.fullName} : cycle académique, coaching thérapeutique, mentorat spirituel. 21 sciences mystiques africaines, 4 cycles initiatiques.`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `Formations ${isnaTenantConfig.branding.name}`,
          description: 'Catalogue des formations initiatiques en Sciences Nocturnes Africaines.',
          url: `${isnaTenantConfig.branding.publicSiteOrigin}/formations`,
          numberOfItems: 4,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Cycle Académique' },
            { '@type': 'ListItem', position: 2, name: 'Cycle Privé' },
            { '@type': 'ListItem', position: 3, name: 'Cycle Privilégié' },
            { '@type': 'ListItem', position: 4, name: 'Cycle Autonome' }
          ]
        }}
      />

      {/* Hero Section */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 blur-sm"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#0F1419]/90 to-[#0F1419]"></div>
        
        <div className="relative max-w-7xl mx-auto text-center space-y-8 animate-in fade-in-up duration-1000">
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-white tracking-tight leading-tight">
            École de <span className="text-[#D4AF37] relative inline-block">
              {isnaTenantConfig.branding.name}
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-[#D4AF37] opacity-60" viewBox="0 0 100 10" preserveAspectRatio="none">
                 <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto font-light leading-relaxed">
            Une structure d'enseignement complète, du savoir théorique à la maîtrise opérative.
            <br/>
            <span className="text-base text-gray-500 mt-4 block">Choisissez la voie qui résonne avec votre quête intérieure.</span>
          </p>
          
          <div className="pt-8 flex justify-center">
             <Button variant="ghost" className="animate-bounce text-gray-500" onClick={() => window.scrollTo({ top: 800, behavior: 'smooth' })}>
                <ArrowDown className="w-6 h-6" />
             </Button>
          </div>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 space-y-32">
        
        {/* NEW Finality Section */}
        <section className="relative z-10">
           <FinalitySection />
        </section>

        {/* Guide d'orientation */}
        <section>
           <div className="text-center mb-12">
            <h2 className="text-3xl font-bold font-serif mb-4 flex items-center justify-center gap-3">
              <span className="text-[#D4AF37]">✦</span> Guide d'Orientation <span className="text-[#D4AF37]">✦</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Avant de choisir un forfait, comprenez la philosophie qui structure notre école. Chaque niveau correspond à un degré d'engagement différent.</p>
          </div>
          <FormationGuideSection />
        </section>

        {/* Packages Cards */}
        <section id="pricing-cards">
          <div className="text-center mb-12">
             <h2 className="text-3xl font-bold font-serif mb-4">Nos Forfaits</h2>
             <p className="text-gray-400">Cliquez sur "Voir les détails" pour explorer chaque option en profondeur.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
            {formationsData.packages.map((pkg) => (
              <PricingCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </section>

        <section id="tarifs" className="pt-16 border-t border-white/10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-bold text-white">Documentation Officielle</h2>
            <p className="text-gray-400 mt-2">Détails complets de la grille tarifaire et des conditions d'accès</p>
          </div>
          <PricingDocumentation />
        </section>

        {/* Separator */}
        <div className="flex items-center justify-center opacity-30">
          <div className="h-px bg-white w-full max-w-xs"></div>
          <span className="px-4 text-2xl text-[#D4AF37]">═══</span>
          <div className="h-px bg-white w-full max-w-xs"></div>
        </div>

        {/* Comparison Table */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold font-serif mb-4">Tableau Comparatif Complet</h2>
            <p className="text-gray-400">Une vue synoptique pour valider votre choix.</p>
          </div>
          <ComparisonTable />
        </section>

        {/* CTA Footer */}
        <section className="bg-gradient-to-br from-[#192734] to-[#0f1216] rounded-3xl p-10 md:p-16 text-center border border-white/10 relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
           
           <div className="relative z-10 max-w-2xl mx-auto space-y-8">
             <h2 className="text-3xl font-bold font-serif text-white">Encore indécis ?</h2>
             <p className="text-gray-300 text-lg">
               Choisir sa voie est un acte important. Si vous hésitez entre deux forfaits, ou si vous avez des questions spécifiques sur votre situation, notre équipe pédagogique est disponible pour un échange bienveillant.
             </p>
             <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <a href="/appointment/request">
                 <Button className="bg-white text-black hover:bg-gray-200 gap-2 h-12 px-8 text-lg font-medium">
                   <MessageCircle className="w-5 h-5" /> Contacter un conseiller
                 </Button>
               </a>
               <Button variant="outline" className="border-white/20 hover:bg-white/5 text-white h-12 px-8 text-lg">
                 Consulter la FAQ
               </Button>
             </div>
           </div>
        </section>

        <section className="mt-10 border-t border-white/10 pt-10">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold font-serif text-white">Liens rapides</h3>
            <p className="text-gray-400 mt-2">Accédez directement aux sections clés et pages associées</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/ecoles" className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-5">
              <div className="font-semibold text-white">21 Sciences Mystiques</div>
              <div className="text-sm text-gray-400 mt-1">Découvrir les sciences et l'école</div>
            </Link>
            <Link to="/formations/catalogue" className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-5">
              <div className="font-semibold text-white">Catalogue des Formations</div>
              <div className="text-sm text-gray-400 mt-1">Voir toutes les formations disponibles</div>
            </Link>
            <Link to="/doctrine-pedagogique" className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-5">
              <div className="font-semibold text-white">Doctrine Pédagogique</div>
              <div className="text-sm text-gray-400 mt-1">Comprendre l'approche d\'apprentissage</div>
            </Link>
            <Link to="/bibliotheque" className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-5">
              <div className="font-semibold text-white">{`Bibliothèque ${isnaTenantConfig.branding.name}`}</div>
              <div className="text-sm text-gray-400 mt-1">Explorer les contenus et ressources</div>
            </Link>
            <Link to="/curriculum/first-year" className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-5">
              <div className="font-semibold text-white">Cycle des Fondements</div>
              <div className="text-sm text-gray-400 mt-1">Voir le programme de la première année</div>
            </Link>
            <a href="#tarifs" className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-5">
              <div className="font-semibold text-white">Documentation des tarifs</div>
              <div className="text-sm text-gray-400 mt-1">Accéder à la grille tarifaire complète</div>
            </a>
          </div>
        </section>

      </div>
    </div>
  );
};

export default FormationsPage;