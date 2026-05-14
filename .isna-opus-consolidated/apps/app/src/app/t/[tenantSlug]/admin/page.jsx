/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE TENANT ADMIN PAGE
 * Page d'accueil générique pour l'admin des tenants
 * ═══════════════════════════════════════════════════════════════
 */

import { getCurrentTenant, getTenantConfig } from '../../../lib/tenant/getCurrentTenant.js';
import { getFeatureGating } from '../../../lib/tenant/featureGating.js';

export default async function TenantAdminPage({ params }) {
  const { tenantSlug } = params;
  
  const tenant = await getCurrentTenant(tenantSlug);
  const config = await getTenantConfig(tenantSlug);
  const featureGating = getFeatureGating();

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Tenant non trouvé</h1>
        <p>Le tenant "{tenantSlug}" n'existe pas.</p>
      </div>
    );
  }

  // Vérifier les features activées
  const hasSchoolEngine = await featureGating.hasSchoolEngine(tenantSlug);
  const hasLiveRoom = await featureGating.hasLiveRoom(tenantSlug);
  const hasSmartboard = await featureGating.hasSmartboard(tenantSlug);
  const hasCreatorStudio = await featureGating.hasCreatorStudio(tenantSlug);
  const hasAdminBooking = await featureGating.hasAdminBooking(tenantSlug);
  const hasMarketingCreator = await featureGating.hasMarketingCreator(tenantSlug);
  const hasNeuroRecall = await featureGating.hasNeuroRecall(tenantSlug);
  const hasReplaySystem = await featureGating.hasReplaySystem(tenantSlug);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Tableau de bord - {config?.branding?.name || tenant.name}</h1>
        <p className="text-gray-600">Bienvenue dans votre espace d'administration</p>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Étudiants</h3>
          <p className="text-3xl font-bold">0</p>
          <p className="text-sm text-gray-500">Inscrits</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Formations</h3>
          <p className="text-3xl font-bold">0</p>
          <p className="text-sm text-gray-500">Actives</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Sessions Live</h3>
          <p className="text-3xl font-bold">0</p>
          <p className="text-sm text-gray-500">Ce mois</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Revenus</h3>
          <p className="text-3xl font-bold">0 €</p>
          <p className="text-sm text-gray-500">Ce mois</p>
        </div>
      </div>

      {/* Features activées */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Features activées</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {hasSchoolEngine && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800">Moteur d'école</h3>
              <p className="text-sm text-green-600">Gestion des formations et modules</p>
            </div>
          )}
          {hasLiveRoom && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800">Live Room</h3>
              <p className="text-sm text-green-600">Sessions en direct interactives</p>
            </div>
          )}
          {hasSmartboard && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800">Smartboard</h3>
              <p className="text-sm text-green-600">Tableau intelligent avec IA</p>
            </div>
          )}
          {hasCreatorStudio && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800">Creator Studio</h3>
              <p className="text-sm text-green-600">Studio de création de contenu</p>
            </div>
          )}
          {hasAdminBooking && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800">Admin Booking</h3>
              <p className="text-sm text-green-600">Système de réservation</p>
            </div>
          )}
          {hasMarketingCreator && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800">Marketing Creator</h3>
              <p className="text-sm text-green-600">Outils marketing</p>
            </div>
          )}
          {hasNeuroRecall && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800">Neuro Recall</h3>
              <p className="text-sm text-green-600">Rappel neuro-cognitif</p>
            </div>
          )}
          {hasReplaySystem && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800">Replay System</h3>
              <p className="text-sm text-green-600">Replay des sessions</p>
            </div>
          )}
        </div>
      </div>

      {/* Liens rapides */}
      <div>
        <h2 className="text-xl font-bold mb-4">Liens rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hasSchoolEngine && (
            <a href={`/t/${tenantSlug}/admin/courses`} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
              <h3 className="font-semibold mb-2">Gérer les formations</h3>
              <p className="text-sm text-gray-600">Créer et modifier vos formations</p>
            </a>
          )}
          {hasSchoolEngine && (
            <a href={`/t/${tenantSlug}/admin/students`} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
              <h3 className="font-semibold mb-2">Gérer les étudiants</h3>
              <p className="text-sm text-gray-600">Voir et gérer les inscriptions</p>
            </a>
          )}
          <a href={`/t/${tenantSlug}/admin/settings`} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
            <h3 className="font-semibold mb-2">Paramètres</h3>
            <p className="text-sm text-gray-600">Configurer votre école</p>
          </a>
        </div>
      </div>
    </div>
  );
}
