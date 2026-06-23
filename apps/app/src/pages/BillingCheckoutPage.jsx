import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import BillingCheckoutView from '@/components/billing/BillingCheckoutView';

/**
 * Page web classique (header site) — le contenu partagé est `BillingCheckoutView`.
 * Parcours mobile shell : `/m/eleve/billing/checkout/:id` → `EleveBillingCheckoutScreen`.
 */
export default function BillingCheckoutPage() {
  const navigate = useNavigate();
  // Retour intuitif : écran précédent si possible, sinon repli sur les forfaits.
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) navigate(-1);
    else navigate('/forfaits');
  };
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0F1419] px-4 pb-16 pt-24 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-24 h-[260px] w-[min(100vw,520px)] -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] blur-[120px]" />
        <div className="absolute -bottom-16 right-0 h-[280px] w-[280px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>
      <Helmet>
        <title>Paiement | Abonnement</title>
      </Helmet>
      <div className="relative z-10 mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:border-white/20 hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        <BillingCheckoutView variant="web" />
      </div>
    </div>
  );
}
