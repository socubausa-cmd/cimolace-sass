import React from 'react';
import { Helmet } from 'react-helmet';
import InvoicePanel from '@/components/billing/InvoicePanel';
import { CreditCard } from 'lucide-react';

const BillingPage = () => (
  <div className="min-h-screen bg-[#0F1419] text-white pt-24">
    <Helmet><title>Facturation — LIRI</title></Helmet>
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-[var(--school-accent)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Facturation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Historique de vos paiements et factures</p>
        </div>
      </div>
      <InvoicePanel />
    </div>
  </div>
);

export default BillingPage;
