import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { catalogApi, tenantsApi } from '../lib/api';
import { formatServiceKey } from '../lib/infrastructures';

const INFRA_LABELS: Record<string, { label: string; action: string; href: string; status: string }> = {
  school: {
    label: 'École', // CLOISON : nom du PRODUIT (moteur), pas d'un tenant précis (ex-« ISNA »)
    action: 'Ouvrir le dashboard école',
    href: '/dashboard/school',
    status: 'MVP actif',
  },
  medos: {
    label: 'MedOS',
    action: 'Ouvrir MedOS',
    href: '/dashboard/medos',
    status: 'Phase 1A — Patients & Notes',
  },
  mbolo: {
    label: 'Mbolo / VirtuelMbolo',
    action: 'Ouvrir Mbolo',
    href: '/dashboard/mbolo',
    status: 'Moteur à construire depuis ZahirWellness',
  },
  wellness: {
    label: 'Wellness',
    action: 'Ouvrir Wellness',
    href: '/dashboard/wellness',
    status: 'Beta',
  },
  creator: {
    label: 'Creator',
    action: 'Ouvrir Creator',
    href: '/dashboard/creator',
    status: 'Beta',
  },
  temple: {
    label: 'Temple',
    action: 'Ouvrir Temple',
    href: '/dashboard/temple',
    status: 'Plus tard',
  },
  community: {
    label: 'Communauté',
    action: 'Ouvrir Communauté',
    href: '/dashboard/community',
    status: 'Plus tard',
  },
};

export function DashboardHome() {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const services = useQuery({ queryKey: ['tenant-services'], queryFn: catalogApi.tenantServices });

  const infraKey = tenant.data?.infrastructure_type ?? 'school';
  const infra = INFRA_LABELS[infraKey] ?? {
    label: infraKey,
    action: 'Continuer',
    href: '/dashboard/lives',
    status: 'Infrastructure personnalisée',
  };
  const activeServices = services.data?.filter((service) => service.active) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Cimolace tenant</p>
          <h1 className="font-semibold text-gray-900">{tenant.data?.name ?? 'Mon espace'}</h1>
        </div>
        {infraKey === 'school' && (
          <Link
            to="/dashboard/lives"
            className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Voir les lives
          </Link>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tenant.isError && <p className="text-red-600 text-sm">{tenant.error.message}</p>}
        {services.isError && <p className="text-red-600 text-sm">{services.error.message}</p>}

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">Infrastructure active</p>
              <h2 className="text-2xl font-bold text-gray-900">{infra.label}</h2>
              <p className="text-sm text-gray-500 mt-2">{infra.status}</p>
            </div>
            <Link
              to={infra.href}
              className="inline-flex justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              {infra.action}
            </Link>
          </div>
        </section>

        <section className="mt-6 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Moteurs activés</h2>
              <p className="text-sm text-gray-500">
                Ce tenant possède {activeServices.length} moteur{activeServices.length > 1 ? 's' : ''} actif{activeServices.length > 1 ? 's' : ''}.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Link to="/dashboard/infrastructures" className="text-sm font-medium text-indigo-600 hover:underline">
                Mes infrastructures
              </Link>
              <Link to="/dashboard/infrastructure" className="text-sm text-indigo-600 hover:underline">
                Changer l'infrastructure
              </Link>
            </div>
          </div>

          {services.isLoading && <p className="text-gray-500 text-sm">Chargement des moteurs...</p>}

          {!services.isLoading && activeServices.length === 0 && (
            <p className="text-gray-500 text-sm">Aucun moteur actif pour l'instant.</p>
          )}

          {activeServices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeServices.map((service) => (
                <span
                  key={service.service_key}
                  className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 border border-indigo-100"
                >
                  {formatServiceKey(service.service_key)}
                </span>
              ))}
            </div>
          )}
        </section>

        {infraKey !== 'school' && infraKey !== 'medos' && (
          <section className="mt-6 border border-amber-200 bg-amber-50 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-amber-950">Produit à raccorder</h2>
            <p className="text-sm text-amber-800 mt-2">
              Le moteur est activé dans le catalogue. Le dashboard métier complet sera migré dans une prochaine étape,
              sans toucher aux projets existants en production.
            </p>
          </section>
        )}

        {/* LIRI Brain — accès rapide */}
        <section className="mt-6 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d0a1e, #150d2e)', border: '1px solid rgba(124,58,237,0.3)' }}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, boxShadow: '0 0 24px -6px rgba(124,58,237,0.7)',
              }}>✦</div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#e5e7eb' }}>Copilote IA</h2>
                <p className="text-sm" style={{ color: '#9ca3af' }}>
                  Assistant IA multi-modèles · DeepSeek · Claude · GPT-4o
                </p>
              </div>
            </div>
            <Link
              to="/dashboard/liri"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: 'white', textDecoration: 'none',
                boxShadow: '0 4px 20px -4px rgba(124,58,237,0.5)',
              }}
            >
              ✦ Ouvrir LIRI
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
