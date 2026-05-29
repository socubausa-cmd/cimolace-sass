import React from 'react';
import { Helmet } from 'react-helmet';
import CimolaceHeader from '@/components/cimolace/CimolaceHeader';
import CimolaceFooter from '@/components/cimolace/CimolaceFooter';
import CimolaceLandingV2 from '@/components/cimolace/CimolaceLandingV2';

/**
 * Vitrine CIMOLACE V2.
 * Presentation premium du SaaS multi-tenant, des moteurs et des OS metier.
 */
const CimolaceLanding = () => {
  return (
    <>
      <Helmet>
        <title>CIMOLACE | Infrastructure multi-tenant, moteurs et OS metier</title>
        <meta
          name="description"
          content="CIMOLACE deploie des infrastructures numeriques completes pour creer une ecole, un commerce, un studio ou une plateforme metier avec moteurs IA, live, paiement et backoffice."
        />
        <meta name="theme-color" content="#0a0a0f" />
      </Helmet>

      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <CimolaceHeader variant="light" />
        <CimolaceLandingV2 />
        <CimolaceFooter />
      </div>
    </>
  );
};

export default CimolaceLanding;
