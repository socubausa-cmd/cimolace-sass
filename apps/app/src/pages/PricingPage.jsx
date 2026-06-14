import React from 'react';
import SEO from '@/components/SEO';
import { formationsData } from '@/lib/mockFormationsData';
import PricingCard from '@/components/pricing/PricingCard';
import PricingDocumentation from '@/components/pricing/PricingDocumentation';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const PricingPage = () => {
  const { toast } = useToast();

  const handleSelect = (pkg) => {
    const fullUrlsById = {
      academique: import.meta?.env?.VITE_PAY_ACADEMIQUE_FULL_URL,
      prive: import.meta?.env?.VITE_PAY_PRIVE_FULL_URL,
      privilegie: import.meta?.env?.VITE_PAY_PRIVILEGIE_FULL_URL,
      autonome: import.meta?.env?.VITE_PAY_AUTONOME_FULL_URL,
    };

    const url = fullUrlsById?.[pkg?.id];
    if (url) {
      window.location.href = url;
      return;
    }

    toast({
      title: "Forfait Sélectionné",
      description: `Vous avez choisi ${pkg?.title}. Redirection vers le paiement... (Simulation)`,
      className: "bg-[var(--school-accent)] text-black border-none font-medium"
    });
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <SEO
        title="Tarifs & Forfaits"
        description={`Tarifs et forfaits ${isnaTenantConfig.branding.name} : cycle académique, privé, privilégié et autonome. Formations initiatiques en Sciences Nocturnes Africaines avec tarification transparente.`}
      />

      {/* Header with Breadcrumb */}
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <div className="flex items-center text-sm text-gray-500 mb-6">
           <Link to="/" className="hover:text-white transition-colors">Accueil</Link>
           <ChevronRight className="w-4 h-4 mx-2" />
           <Link to="/formations" className="hover:text-white transition-colors">Formations</Link>
           <ChevronRight className="w-4 h-4 mx-2" />
           <span className="text-[var(--school-accent)]">Tarifs</span>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
            Tarification <span className="text-[var(--school-accent)]">Transparente</span>
          </h1>
          <p className="text-xl text-gray-400">
            Choisissez l'investissement qui correspond à votre ambition.
            <br className="hidden md:block"/> De la simple curiosité à la maîtrise professionnelle et spirituelle.
          </p>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 space-y-24">
        
        {/* Main Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
           {formationsData.packages.map((pkg) => (
              <PricingCard key={pkg.id} pkg={pkg} onSelect={() => handleSelect(pkg)} />
           ))}
        </div>

        {/* Separator */}
        <div className="flex items-center justify-center opacity-30">
          <div className="h-px bg-white w-full max-w-xs"></div>
          <span className="px-4 text-2xl">═══</span>
          <div className="h-px bg-white w-full max-w-xs"></div>
        </div>

        {/* Pricing Documentation - Integrated Here */}
        <div className="pt-16 border-t border-white/10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-bold text-white">Documentation Officielle</h2>
            <p className="text-gray-400 mt-2">Détails complets de la grille tarifaire et des conditions d'accès</p>
          </div>
          <PricingDocumentation />
        </div>

      </div>
    </div>
  );
};

export default PricingPage;