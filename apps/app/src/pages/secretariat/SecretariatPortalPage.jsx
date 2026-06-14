import React from 'react';
import { Helmet } from 'react-helmet';
import SecretariatDashboard from './SecretariatDashboard';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const SecretariatPortalPage = () => {
  return (
    <>
      <Helmet>
        <title>{`Espace Secrétariat | ${isnaTenantConfig.branding.name}`}</title>
      </Helmet>
      <SecretariatDashboard />
    </>
  );
};

export default SecretariatPortalPage;
