/**
 * NOTE (build Vite) : cette route App Router n’est pas servie par `npm run dev/build` Vite.
 * L’écran d’encaissement tenant est exposé côté SPA : `/t/:tenantSlug/admin/settings` → voir `src/App.jsx`
 * et `src/pages/tenant/TenantAdminPayoutSettingsPage.jsx`.
 *
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE TENANT ADMIN SETTINGS PAGE (stub Next / Hostinger)
 * ═══════════════════════════════════════════════════════════════
 */

import { getCurrentTenant, getTenantConfig, getTenantBranding, getTenantLimits } from '../../../../lib/tenant/getCurrentTenant.js';
import { getFeatureGating } from '../../../../lib/tenant/featureGating.js';

export default async function TenantAdminSettingsPage({ params }) {
  const { tenantSlug } = params;
  
  const tenant = await getCurrentTenant(tenantSlug);
  const config = await getTenantConfig(tenantSlug);
  const branding = await getTenantBranding(tenantSlug);
  const limits = await getTenantLimits(tenantSlug);
  const featureGating = getFeatureGating();

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Tenant non trouvé</h1>
        <p>Le tenant "{tenantSlug}" n'existe pas.</p>
      </div>
    );
  }

  const enabledFeatures = await featureGating.getEnabledFeatures(tenantSlug);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Paramètres</h1>
        <p className="text-gray-600">Configurer {config?.branding?.name || tenant.name}</p>
      </div>

      <div className="space-y-6">
        {/* Branding */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Branding</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  defaultValue={branding?.name}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domaine</label>
                <input
                  type="text"
                  defaultValue={branding?.domain}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Couleur primaire</label>
                <input
                  type="color"
                  defaultValue={branding?.primaryColor}
                  className="w-full h-10 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Couleur secondaire</label>
                <input
                  type="color"
                  defaultValue={branding?.secondaryColor}
                  className="w-full h-10 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Couleur accent</label>
                <input
                  type="color"
                  defaultValue={branding?.accentColor}
                  className="w-full h-10 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                  type="text"
                  defaultValue={branding?.logo}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Features activées</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(enabledFeatures).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between border rounded-lg p-4">
                  <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    className="w-5 h-5"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Limits */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Limits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max étudiants</label>
                <input
                  type="number"
                  defaultValue={limits?.maxStudents}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max formations</label>
                <input
                  type="number"
                  defaultValue={limits?.maxCourses}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max sessions live</label>
                <input
                  type="number"
                  defaultValue={limits?.maxLiveSessions}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stockage (GB)</label>
                <input
                  type="number"
                  defaultValue={limits?.storageGB}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
