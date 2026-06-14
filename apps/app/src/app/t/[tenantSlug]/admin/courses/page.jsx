/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE TENANT ADMIN COURSES PAGE
 * Page de gestion des formations pour les tenants
 * ═══════════════════════════════════════════════════════════════
 */

import { getCurrentTenant, getTenantConfig } from '../../../../lib/tenant/getCurrentTenant.js';
import { getFeatureGating } from '../../../../lib/tenant/featureGating.js';
import { createCourseEngine } from '../../../../modules/school/courses/courseEngine.js';

export default async function TenantAdminCoursesPage({ params }) {
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

  const hasSchoolEngine = await featureGating.hasSchoolEngine(tenantSlug);

  if (!hasSchoolEngine) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Feature non activée</h1>
        <p>Le moteur d'école n\'est pas activé pour ce tenant.</p>
      </div>
    );
  }

  const courseEngine = createCourseEngine(tenantSlug);
  const courses = await courseEngine.getCourses();

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Formations</h1>
          <p className="text-gray-600">Gérer les formations de {config?.branding?.name || tenant.name}</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Créer une formation
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Liste des formations ({courses.length})</h2>
          
          {courses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Aucune formation trouvée.</p>
              <button className="mt-4 text-blue-600 hover:underline">
                Créer votre première formation
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {courses.map((course) => (
                <div key={course.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{course.title}</h3>
                      <p className="text-gray-600 text-sm">{course.description}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {course.cycle}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                          {course.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {course.price && (
                        <p className="font-semibold">{course.price} €</p>
                      )}
                      {course.duration_weeks && (
                        <p className="text-sm text-gray-500">{course.duration_weeks} semaines</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
