import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { tenantMembersApi } from '../lib/api';
import { INFRASTRUCTURES } from '../lib/infrastructures';

/**
 * « Mes infrastructures » — vue multi-infrastructure du compte (modèle Stripe/Zoom).
 * Liste toutes les infrastructures (tenants) du compte via GET /tenants/mine,
 * avec leur statut de cycle de vie, et un point d'entrée pour en créer une nouvelle.
 * 100 % front : ne consomme que des endpoints existants.
 */

type MineRow = {
  slug: string | null;
  name: string | null;
  infrastructure_type: string | null;
  status: string | null;
  logo_url: string | null;
  role: string | null;
};

/** Mappe le statut tenant vers le vocabulaire de cycle de vie produit. */
function lifecycle(status: string | null): { label: string; cls: string } {
  switch ((status || '').toLowerCase()) {
    case 'draft':
    case 'pending':
      return { label: 'Brouillon', cls: 'bg-gray-100 text-gray-600' };
    case 'provisioning':
    case 'configuring':
    case 'onboarding':
      return { label: 'En cours de création', cls: 'bg-amber-100 text-amber-700' };
    case 'active':
      return { label: 'Projet fini · en service', cls: 'bg-emerald-100 text-emerald-700' };
    case 'archived':
    case 'suspended':
    case 'cancelled':
      return { label: 'Archivé', cls: 'bg-red-100 text-red-600' };
    default:
      return { label: status || '—', cls: 'bg-gray-100 text-gray-600' };
  }
}

export function DashboardInfrastructures() {
  const mine = useQuery({ queryKey: ['my-tenants'], queryFn: tenantMembersApi.getMyTenants });
  const rows: MineRow[] = Array.isArray(mine.data) ? (mine.data as MineRow[]) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Compte Cimolace</p>
          <h1 className="font-semibold text-gray-900">Mes infrastructures</h1>
        </div>
        <Link
          to="/onboarding"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Créer une nouvelle infrastructure
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <p className="mb-6 text-sm text-gray-500">
          Chaque infrastructure est un espace indépendant (école, MedOS, boutique…) avec ses
          moteurs, son abonnement et sa clé API. Crée-en autant que nécessaire, comme une
          application Stripe ou Zoom.
        </p>

        {mine.isLoading && <p className="text-gray-500">Chargement…</p>}

        {mine.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger tes infrastructures.{' '}
            {mine.error instanceof Error ? mine.error.message : ''}
          </div>
        )}

        {!mine.isLoading && !mine.isError && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <p className="text-gray-600">Tu n'as pas encore d'infrastructure.</p>
            <Link
              to="/onboarding"
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Créer ma première infrastructure
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((t) => {
            const meta = INFRASTRUCTURES.find((i) => i.type === t.infrastructure_type);
            const life = lifecycle(t.status);
            return (
              <div
                key={t.slug ?? Math.random()}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {t.logo_url ? (
                      <img src={t.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-semibold">
                        {(t.name ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{t.name ?? t.slug}</p>
                      <p className="text-xs text-gray-500">{meta?.name ?? t.infrastructure_type ?? '—'}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${life.cls}`}>
                    {life.label}
                  </span>
                </div>

                {meta?.engines && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {meta.engines.slice(0, 5).map((e) => (
                      <span key={e} className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                        {e}
                      </span>
                    ))}
                    {meta.engines.length > 5 && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                        +{meta.engines.length - 5}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3 text-sm">
                  <Link to="/dashboard/infrastructure" className="text-indigo-600 hover:underline">
                    Configurer les moteurs
                  </Link>
                  <span className="text-gray-300">·</span>
                  <Link to="/dashboard" className="text-indigo-600 hover:underline">
                    Ouvrir
                  </Link>
                  {t.role && (
                    <span className="ml-auto rounded bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400">
                      {t.role}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default DashboardInfrastructures;
