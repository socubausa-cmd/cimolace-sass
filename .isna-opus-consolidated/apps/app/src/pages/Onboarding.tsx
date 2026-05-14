import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { catalogApi, tenantsApi, type InfrastructureType, type Tenant } from '../lib/api';
import { authStore } from '../lib/auth-store';
import { INFRASTRUCTURES } from '../lib/infrastructures';

function toSlug(v: string) {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [infrastructureType, setInfrastructureType] = useState<InfrastructureType>('school');
  const [createdTenant, setCreatedTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState(() => authStore.getToken());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugEdited) setSlug(toSlug(v));
  };

  const handleSlugChange = (v: string) => {
    setSlugEdited(true);
    setSlug(toSlug(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    setError('');
    try {
      authStore.setToken(token);
      const tenant =
        createdTenant ?? (await tenantsApi.create({ name: name.trim(), slug: slug.trim() }));
      setCreatedTenant(tenant);
      authStore.setTenantSlug(tenant.slug);
      await catalogApi.applyTemplate(infrastructureType);
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(
        message === 'Unauthorized'
          ? 'Non autorisé : colle un access token Supabase valide avant de créer l’espace.'
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Créer votre espace Cimolace</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Choisissez l'infrastructure principale du tenant. Les moteurs correspondants seront activés automatiquement.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <label className="block text-sm font-medium text-amber-900 mb-1">
              Access token Supabase
            </label>
            <textarea
              className="w-full border border-amber-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              rows={3}
              placeholder="Collez ici le access_token Supabase du owner en dev"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'espace
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Mon Académie"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={!!createdTenant}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                <span className="bg-gray-100 text-gray-500 text-sm px-3 py-2 border-r border-gray-300 select-none">
                  cimolace/
                </span>
                <input
                  className="flex-1 px-3 py-2 text-sm focus:outline-none"
                  placeholder="mon-espace"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  disabled={!!createdTenant}
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Infrastructure</p>
            <div className="grid gap-3 md:grid-cols-2">
              {INFRASTRUCTURES.map((infra) => {
                const selected = infrastructureType === infra.type;
                return (
                  <label
                    key={infra.type}
                    className={`block rounded-xl border p-4 cursor-pointer transition-colors ${
                      selected
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="infrastructure"
                        value={infra.type}
                        checked={selected}
                        onChange={() => setInfrastructureType(infra.type)}
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{infra.name}</span>
                          <span className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                            {infra.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{infra.description}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {infra.engines.map((engine) => (
                            <span
                              key={engine}
                              className={`text-[11px] rounded-full px-2 py-1 ${
                                selected
                                  ? 'bg-white text-indigo-700 border border-indigo-100'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {engine}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {createdTenant && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
              Espace créé. Relancez l'activation si le template n'a pas pu être appliqué.
            </p>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !name.trim() || !slug.trim() || !token.trim()}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? 'Configuration...'
              : createdTenant
                ? 'Réessayer l’activation'
                : 'Créer et activer mon espace'}
          </button>
        </form>
      </div>
    </div>
  );
}
