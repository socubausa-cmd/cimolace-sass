import React from 'react';
import { Helmet } from 'react-helmet';
import SecretariatDashboard from './SecretariatDashboard';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

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
