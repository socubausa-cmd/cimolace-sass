/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE TENANT ADMIN LAYOUT
 * Layout générique pour l'admin des tenants
 * ═══════════════════════════════════════════════════════════════
 */

import { getCurrentTenant, getTenantBranding } from '../../../lib/tenant/getCurrentTenant.js';

export default async function TenantAdminLayout({ children, params }) {
  const { tenantSlug } = params;
  
  const tenant = await getCurrentTenant(tenantSlug);
  const branding = await getTenantBranding(tenantSlug);

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Tenant non trouvé</h1>
          <p>Le tenant "{tenantSlug}" n'existe pas.</p>
        </div>
      </div>
    );
  }

  if (tenant.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Tenant inactif</h1>
          <p>Le tenant "{tenant.name}" est actuellement inactif.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{
        '--primary-color': branding?.primaryColor || '#1a5f7a',
        '--secondary-color': branding?.secondaryColor || '#2c3e50',
        '--accent-color': branding?.accentColor || '#e74c3c',
      }}
    >
      {/* Header avec branding tenant */}
      <header className="border-b" style={{ backgroundColor: branding?.primaryColor || '#1a5f7a' }}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding?.logo && (
              <img 
                src={branding.logo} 
                alt={branding.name} 
                className="h-10 w-auto"
              />
            )}
            <h1 className="text-xl font-bold text-white">{branding?.name || tenant.name}</h1>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 justify-end text-sm">
            <a href={`/t/${tenantSlug}/admin/courses`} className="text-white hover:underline">
              Formations
            </a>
            <a href={`/t/${tenantSlug}/admin/parcours-scolaires`} className="text-white hover:underline">
              Parcours scolaires
            </a>
            <a href={`/t/${tenantSlug}/admin/students`} className="text-white hover:underline">
              Étudiants
            </a>
            <a href={`/settings?tab=payments`} className="text-white hover:underline">
              Paramètres boutique
            </a>
            <a href={`/t/${tenantSlug}/admin/members`} className="text-white hover:underline">
              Membres
            </a>
            <a href={`/t/${tenantSlug}/admin/settings`} className="text-white font-semibold hover:underline">
              Encaissement
            </a>
          </nav>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
