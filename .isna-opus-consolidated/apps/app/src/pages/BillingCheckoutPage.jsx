import React from 'react';
import { Helmet } from 'react-helmet';
import BillingCheckoutView from '@/components/billing/BillingCheckoutView';

/**
 * Page web classique (header site) — le contenu partagé est `BillingCheckoutView`.
 * Parcours mobile shell : `/m/eleve/billing/checkout/:id` → `EleveBillingCheckoutScreen`.
 */
export default function BillingCheckoutPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0F1419] px-4 pb-16 pt-24 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-24 h-[260px] w-[min(100vw,520px)] -translate-x-1/2 rounded-full bg-[#D4AF37]/10 blur-[120px]" />
        <div className="absolute -bottom-16 right-0 h-[280px] w-[280px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>
      <Helmet>
        <title>Paiement | Abonnement</title>
      </Helmet>
      <div className="relative z-10 mx-auto max-w-3xl space-y-6">
        <BillingCheckoutView variant="web" />
      </div>
    </div>
  );
}
