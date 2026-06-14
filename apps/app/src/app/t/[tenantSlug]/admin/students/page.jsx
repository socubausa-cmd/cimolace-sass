/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE TENANT ADMIN STUDENTS PAGE
 * Page de gestion des étudiants pour les tenants
 * ═══════════════════════════════════════════════════════════════
 */

import { getCurrentTenant, getTenantConfig } from '../../../../lib/tenant/getCurrentTenant.js';
import { getFeatureGating } from '../../../../lib/tenant/featureGating.js';
import { createStudentEngine } from '../../../../modules/school/students/studentEngine.js';

export default async function TenantAdminStudentsPage({ params }) {
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

  const studentEngine = createStudentEngine(tenantSlug);
  const students = await studentEngine.getStudents();

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Étudiants</h1>
          <p className="text-gray-600">Gérer les étudiants de {config?.branding?.name || tenant.name}</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Ajouter un étudiant
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Liste des étudiants ({students.length})</h2>
          
          {students.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Aucun étudiant trouvé.</p>
              <button className="mt-4 text-blue-600 hover:underline">
                Ajouter votre premier étudiant
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Nom</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Statut</th>
                    <th className="text-left py-3 px-4">Inscrit le</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{student.name}</td>
                      <td className="py-3 px-4 text-gray-600">{student.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          student.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : student.status === 'inactive'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(student.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3 px-4">
                        <button className="text-blue-600 hover:underline mr-2">
                          Voir
                        </button>
                        <button className="text-gray-600 hover:underline">
                          Modifier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
