/**
 * TenantAdminStudentsPage — /t/:tenantSlug/admin/students
 * Liste des étudiants inscrits dans le tenant école.
 * Connecté au NestJS /secretariat/enrollments + /courses API.
 */
import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Users, Search, GraduationCap, CheckCircle, Clock, XCircle, Loader2, ChevronDown, Settings } from 'lucide-react';
import { secretariatApi, coursesApi } from '@/lib/api-v2';

const STATUS_LABEL = {
  pending: 'En attente',
  active: 'Actif',
  enrolled: 'Inscrit',
  completed: 'Terminé',
  dropped: 'Abandonné',
};
const STATUS_ICON = {
  active: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
  enrolled: <Clock className="h-3.5 w-3.5 text-blue-500" />,
  pending: <Clock className="h-3.5 w-3.5 text-amber-500" />,
  completed: <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />,
  dropped: <XCircle className="h-3.5 w-3.5 text-red-400" />,
};

const BTN_GHOST = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50';

function StatusBadge({ status }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      {STATUS_ICON[status]}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function TenantAdminStudentsPage() {
  const { tenantSlug } = useParams();
  const [enrollments, setEnrollments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [updating, setUpdating] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [enr, crs] = await Promise.all([
        secretariatApi.listEnrollments().catch(() => []),
        coursesApi.list().catch(() => []),
      ]);
      setEnrollments(Array.isArray(enr) ? enr : []);
      setCourses(Array.isArray(crs) ? crs : []);
    } catch (err) {
      setError(err?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(enrollmentId, newStatus) {
    setUpdating(enrollmentId);
    try {
      await secretariatApi.updateEnrollment(enrollmentId, { status: newStatus });
      setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, status: newStatus } : e));
    } catch (err) {
      alert(err?.message ?? 'Erreur lors de la mise à jour');
    } finally {
      setUpdating(null);
    }
  }

  // Fusionner les enrollments venant de la table enrollments (legacy) avec les inscriptions API
  const filtered = enrollments.filter(e => {
    const name = `${e.student?.email ?? ''} ${e.student?.full_name ?? ''}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchCourse = filterCourse === 'all' || e.course_id === filterCourse || e.formation_id === filterCourse;
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    return matchSearch && matchCourse && matchStatus;
  });

  const totalActive = enrollments.filter(e => ['active', 'enrolled'].includes(e.status)).length;
  const totalCompleted = enrollments.filter(e => e.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <div className="border-b bg-white px-6 py-2">
        <div className="mx-auto flex max-w-5xl items-center gap-1">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{tenantSlug}</span>
          <NavLink
            to={`/t/${tenantSlug}/admin/courses`}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Formations</span>
          </NavLink>
          <NavLink
            to={`/t/${tenantSlug}/admin/students`}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Étudiants</span>
          </NavLink>
          <NavLink
            to={`/t/${tenantSlug}/admin/members`}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Équipe</span>
          </NavLink>
          <NavLink
            to={`/t/${tenantSlug}/admin/settings`}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            <span className="flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" /> Paramètres</span>
          </NavLink>
        </div>
      </div>

      {/* Header */}
      <div className="border-b bg-white px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h1 className="text-lg font-bold text-gray-900">Étudiants</h1>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {enrollments.length} inscription(s) · {totalActive} actif(s) · {totalCompleted} terminé(s)
            </p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="border-b bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          {/* Recherche */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Rechercher un étudiant…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filtre cours */}
          {courses.length > 0 && (
            <div className="relative">
              <select
                className={BTN_GHOST + ' appearance-none pr-6'}
                value={filterCourse}
                onChange={e => setFilterCourse(e.target.value)}
              >
                <option value="all">Tous les cours</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            </div>
          )}

          {/* Filtre statut */}
          <div className="relative">
            <select
              className={BTN_GHOST + ' appearance-none pr-6'}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mx-auto max-w-5xl px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
            <GraduationCap className="mb-4 h-10 w-10 text-gray-300" />
            <h2 className="text-base font-semibold text-gray-700">
              {enrollments.length === 0 ? 'Aucun étudiant inscrit' : 'Aucun résultat'}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {enrollments.length === 0
                ? 'Les inscriptions apparaîtront ici une fois que des étudiants rejoindront vos cours.'
                : 'Modifiez vos critères de recherche.'}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Étudiant</th>
                  <th className="px-4 py-3">Cours</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Inscrit le</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(e => {
                  const courseTitle = courses.find(c => c.id === (e.course_id || e.formation_id))?.title
                    ?? e.formations?.title
                    ?? e.course_id
                    ?? '—';
                  const studentName = e.student?.full_name || e.student?.email || e.student_id || '—';
                  const studentEmail = e.student?.email || '';
                  const enrolledAt = e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString('fr-FR') : '—';

                  return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{studentName}</div>
                        {studentEmail && studentEmail !== studentName && (
                          <div className="text-xs text-gray-400">{studentEmail}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{courseTitle}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-400">{enrolledAt}</td>
                      <td className="px-4 py-3">
                        {updating === e.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                        ) : (
                          <div className="relative">
                            <select
                              className="rounded border border-gray-200 py-0.5 pl-2 pr-6 text-xs text-gray-700 hover:border-gray-300"
                              value={e.status}
                              onChange={ev => updateStatus(e.id, ev.target.value)}
                            >
                              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
