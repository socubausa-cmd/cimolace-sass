import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { catalogApi, tenantsApi, type InfrastructureType } from '../lib/api';
import { authStore } from '../lib/auth-store';
import { INFRASTRUCTURES } from '../lib/infrastructures';
import { InfrastructureDetailPanel } from '../components/cimolace/InfrastructureDetailPanel';

export function DashboardInfrastructure() {
  const queryClient = useQueryClient();
  const hasDebugAuth =
    typeof window !== 'undefined' && Boolean(authStore.getToken() && authStore.getTenantSlug());
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const services = useQuery({ queryKey: ['tenant-services'], queryFn: catalogApi.tenantServices });
  const [saving, setSaving] = useState<InfrastructureType | null>(null);
  const [error, setError] = useState('');
  const [sessionToken, setSessionToken] = useState(() => authStore.getToken());
  const [sessionSlug, setSessionSlug] = useState(() => authStore.getTenantSlug() || 'medos-e2e-1778432225');

  const activeType = tenant.data?.infrastructure_type ?? null;
  const queryError = tenant.error ?? services.error;
  const authError =
    !hasDebugAuth ||
    (queryError instanceof Error && /unauthorized|401|non authentifié/i.test(queryError.message));
  const displayError = error || (queryError instanceof Error ? queryError.message : '');

  const apply = async (type: InfrastructureType) => {
    setSaving(type);
    setError('');
    try {
      await catalogApi.applyTemplate(type);
      await queryClient.invalidateQueries({ queryKey: ['tenant'] });
      await queryClient.invalidateQueries({ queryKey: ['tenant-services'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(null);
    }
  };

  const saveDemoSession = () => {
    authStore.setToken(sessionToken);
    authStore.setTenantSlug(sessionSlug);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Infrastructure</p>
          <h1 className="font-semibold text-gray-900">{tenant.data?.name ?? 'Mon espace'}</h1>
        </div>
        <Link to="/dashboard" className="text-sm text-indigo-600 hover:underline">
          Retour au dashboard
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Choisir les moteurs du tenant</h2>
          <p className="text-sm text-gray-500 mt-2">
            Appliquer une infrastructure active ses moteurs. Pour le MVP, l'activation est cumulative.
          </p>
        </div>

        {authError && (
          <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-bold text-amber-950">Session requise</h3>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Connecte un token Supabase valide et le tenant slug avant de modifier l'infrastructure. Les templates
              restent visibles pour lecture, mais l'activation est désactivée tant que la session n\'est pas valide.
            </p>
            <p className="mt-3 text-xs font-semibold text-amber-900">
              Tenant attendu pour la démo MedOS : <code>medos-e2e-1778432225</code>
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-semibold text-amber-950">
                Access token Supabase
                <textarea
                  className="min-h-24 rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-gray-800 outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Colle le JWT Supabase ici"
                  value={sessionToken}
                  onChange={(event) => setSessionToken(event.target.value)}
                  spellCheck={false}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-amber-950">
                Tenant slug
                <input
                  className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-amber-400"
                  value={sessionSlug}
                  onChange={(event) => setSessionSlug(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={saveDemoSession}
                disabled={!sessionToken.trim() || !sessionSlug.trim()}
                className="w-full rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50 md:w-fit"
              >
                Connecter cette session
              </button>
            </div>
          </section>
        )}

        {!authError && displayError && (
          <section className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {displayError}
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {INFRASTRUCTURES.map((infra) => {
            const selected = activeType === infra.type;
            return (
              <div
                key={infra.type}
                className={`rounded-lg border bg-white p-5 shadow-sm ${
                  selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{infra.name}</h3>
                      <span className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                        {selected ? 'Actif' : infra.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{infra.description}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {infra.engines.map((engine) => (
                    <span key={engine} className="text-[11px] rounded-full px-2 py-1 bg-gray-100 text-gray-600">
                      {engine}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void apply(infra.type)}
                  disabled={authError || saving !== null || selected}
                  className="mt-5 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {selected
                    ? 'Infrastructure active'
                    : authError
                      ? 'Connexion requise'
                      : saving === infra.type
                        ? 'Activation...'
                        : 'Appliquer ce template'}
                </button>
              </div>
            );
          })}
        </div>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-gray-900">Etat actuel</h3>
          <p className="text-sm text-gray-500 mt-1">
            {authError
              ? 'Connecte une session valide pour charger les moteurs actifs.'
              : `${services.data?.filter((service) => service.active).length ?? 0} moteurs actifs sur ce tenant.`}
          </p>
        </section>

        {!authError && <InfrastructureDetailPanel tenantSlug={(tenant.data as any)?.slug} />}
      </main>
    </div>
  );
}
