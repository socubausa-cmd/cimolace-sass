import React from 'react';
import { Helmet } from 'react-helmet';
import CimolacePremiumHomepage from '@/components/cimolace/CimolacePremiumHomepage';

/**
 * Vitrine CIMOLACE — page d'accueil premium.
 *
 * Charte alignée sur prorascience.org : fond slate #0f1419, accent or #d8b468,
 * display Fraunces + corps Inter. La page est AUTOPORTANTE : CimolacePremiumHomepage
 * fournit sa propre nav (sticky, transparente → or), le hero, le parcours produit
 * (bento sur OS_LIST), la section infrastructure, le CTA final et le footer.
 *
 * (Historique : rendait auparavant CimolaceHeader + CimolaceLandingV2 (violet, eyebrows
 * all-caps) + CimolaceFooter — refonte 2026-07 « haut de gamme » demandée par le fondateur.)
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
        <meta name="theme-color" content="#0f1419" />
      </Helmet>

      <CimolacePremiumHomepage />
    </>
  );
};

export default CimolaceLanding;
