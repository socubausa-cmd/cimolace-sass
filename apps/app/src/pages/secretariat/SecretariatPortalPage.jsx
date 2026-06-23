import React from 'react';
import { Helmet } from 'react-helmet';
import SecretariatDashboard from './SecretariatDashboard';
import { getActiveTenantBranding } from '@/lib/tenant/activeBranding';

const SecretariatPortalPage = () => {
  return (
    <>
      <Helmet>
        <title>{`Espace Secrétariat | ${getActiveTenantBranding().name}`}</title>
      </Helmet>
      <SecretariatDashboard />
    </>
  );
};

export default SecretariatPortalPage;
