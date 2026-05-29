import React from 'react';
import { Helmet } from 'react-helmet';
import { CheckoutSuccessContent } from '@/components/ecommerce/CheckoutSuccessContent';

/**
 * Confirmation commande boutique (web). Shell élève : `/m/eleve/checkout-success`.
 */
const CheckoutSuccessPage = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0F1419] p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-20 h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-[#D4AF37]/10 blur-[120px]" />
      </div>
      <Helmet>
        <title>Commande confirmée | PRORASCIENCE</title>
      </Helmet>
      <CheckoutSuccessContent variant="web" />
    </div>
  );
};

export default CheckoutSuccessPage;
