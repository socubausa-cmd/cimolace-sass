import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { livesApi, tenantsApi, type Live } from '../lib/api';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatPrice(cents: number, currency: string) {
  return cents === 0
    ? 'Gratuit'
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}

function statusClass(status: string) {
  if (status === 'live') return 'bg-green-100 text-green-700';
  if (status === 'ended') return 'bg-gray-100 text-gray-500';
  return 'bg-blue-100 text-blue-700';
}

export function DashboardLives() {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const lives = useQuery({ queryKey: ['lives'], queryFn: livesApi.list });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {tenant.data?.logo_url && (
            <img src={tenant.data.logo_url} alt="logo" className="h-8 w-8 rounded object-cover" />
          )}
          <span className="font-semibold text-gray-900">{tenant.data?.name ?? 'Mon espace'}</span>
        </div>
        <Link
          to="/dashboard/lives/new"
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Créer un live
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Mes lives</h1>

        {lives.isLoading && <p className="text-gray-500 text-sm">Chargement…</p>}
        {lives.isError && <p className="text-red-600 text-sm">{lives.error.message}</p>}

        {lives.data?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">Aucun live pour l'instant.</p>
            <Link
              to="/dashboard/lives/new"
              className="mt-4 inline-block text-indigo-600 text-sm font-medium hover:underline"
            >
              Créer votre premier live →
            </Link>
          </div>
        )}

        {lives.data && lives.data.length > 0 && (
          <div className="space-y-3">
            {lives.data.map((live: Live) => (
              <div
                key={live.id}
                className="flex items-center justify-between border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
              >
                <div>
                  <p className="font-semibold text-gray-900">{live.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatDate(live.scheduledAt)} — {formatPrice(live.priceCents, live.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClass(live.status)}`}>
                    {live.status}
                  </span>
                  <Link to={`/lives/${live.id}/join`} className="text-sm text-indigo-600 hover:underline">
                    Rejoindre →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
