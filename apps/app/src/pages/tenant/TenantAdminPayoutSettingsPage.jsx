import React from 'react';
import { Link, useParams } from 'react-router-dom';
import TenantPayoutProvidersForm from '@/components/settings/TenantPayoutProvidersForm';

export default function TenantAdminPayoutSettingsPage() {
  const { tenantSlug } = useParams();
  const slug = String(tenantSlug || '').trim().toLowerCase();

  return (
    <div className="min-h-screen premium-dashboard-shell p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">Encaissement · tenant</h1>
            <p className="mt-1 text-sm text-gray-400">
              Slug :{' '}
              <code className="rounded bg-[#0F1419] px-1.5 py-0.5 text-amber-200/90">{slug || '—'}</code>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-end">
            <Link to={`/settings?tab=payments`} className="text-sm text-gray-400 hover:text-white hover:underline shrink-0">
              Paramètres → Paiements
            </Link>
            <Link to="/owner-dashboard?tab=payments&finance=payout-setup" className="text-sm text-[var(--school-accent)] hover:underline shrink-0">
              Tableau de bord propriétaire (vue équivalente)
            </Link>
          </div>
        </div>
        <TenantPayoutProvidersForm initialTenantSlug={slug || undefined} lockTenantSlug />
      </div>
    </div>
  );
}
