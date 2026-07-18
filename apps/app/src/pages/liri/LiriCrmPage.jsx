import React from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import AdminMarketingPage from '@/pages/admin/AdminMarketingPage';

/**
 * CRM / Growth Engine DANS le portail LIRI (rail « CRM », créateur owner/admin).
 * Le moteur marketing (leads, campagnes, funnels, automation, analytics) rendu sous
 * le chrome unifié LIRI — remplace l'ancienne coque `/admin/marketing` (header vitrine).
 */
export default function LiriCrmPage() {
  return (
    <LiriPortalShell active="crm" rail>
      <AdminMarketingPage />
    </LiriPortalShell>
  );
}
