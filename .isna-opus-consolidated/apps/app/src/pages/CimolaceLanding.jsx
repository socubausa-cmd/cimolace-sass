import React from 'react';
import { Helmet } from 'react-helmet';
import CimolaceHeader from '@/components/cimolace/CimolaceHeader';
import CimolaceModules from '@/components/cimolace/CimolaceModules';
import CimolacePricing from '@/components/cimolace/CimolacePricing';
import CimolaceTestimonials from '@/components/cimolace/CimolaceTestimonials';
import CimolaceProductGallery from '@/components/cimolace/CimolaceProductGallery';
import CimolaceFooter from '@/components/cimolace/CimolaceFooter';
import CimolacePremiumHomepage from '@/components/cimolace/CimolacePremiumHomepage';

/**
 * Vitrine CIMOLACE « modules » (version historique avant la landing OS dédiée).
 * Shell : header Tailwind + sections marketing existantes.
 */
const CimolaceLanding = () => {
  return (
    <>
      <Helmet>
        <title>CIMOLACE | Infrastructure intelligente pour l&apos;Afrique</title>
        <meta
          name="description"
          content="CIMOLACE - Une plateforme. Plusieurs intelligences. Construis, automatise et fais évoluer ton business avec une seule infrastructure IA."
        />
        <meta name="theme-color" content="#0a0a0f" />
      </Helmet>

      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <CimolaceHeader />
        <CimolacePremiumHomepage />
        <CimolaceModules />
        <CimolacePricing />
        <CimolaceTestimonials />
        <CimolaceProductGallery />
        <CimolaceFooter />
      </div>
    </>
  );
};

export default CimolaceLanding;
