/**
 * TenantAdminStudentsPage — /t/:tenantSlug/admin/students
 * Liste des étudiants inscrits dans le tenant école.
 * Connecté au NestJS /secretariat/enrollments + /courses API.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users, Search, GraduationCap, CheckCircle, Clock, XCircle, Loader2, ChevronDown } from 'lucide-react';
import { secretariatApi, coursesApi } from '@/lib/api-v2';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

const STATUS_LABEL = {
  pending: 'En attente',
  active: 'Actif',
  enrolled: 'Inscrit',
  completed: 'Terminé',
  dropped: 'Abandonné',
};
const STATUS_ICON = {
  active: <CheckCircle className="h-3.5 w-3.5" style={{ color: T.success }} />,
  enrolled: <Clock className="h-3.5 w-3.5" style={{ color: T.info }} />,
  pending: <Clock className="h-3.5 w-3.5" style={{ color: T.warning }} />,
  completed: <CheckCircle className="h-3.5 w-3.5" style={{ color: T.success }} />,
  dropped: <XCircle className="h-3.5 w-3.5" style={{ color: T.danger }} />,
};

function StatusBadge({ status }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.t2 }}
    >
      {STATUS_ICON[status]}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const selectStyle = {
  appearance: 'none',
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  color: T.t1,
  fontSize: 12,
  padding: '7px 26px 7px 12px',
  cursor: 'pointer',
  outline: 'none',
};

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
    <TenantAdminShell>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" style={{ color: T.gold }} />
          <h1 className="text-lg font-bold" style={{ color: T.t1 }}>Étudiants</h1>
        </div>
        <p className="mt-0.5 text-sm" style={{ color: T.t2 }}>
          {enrollments.length} inscription(s) · {totalActive} actif(s) · {totalCompleted} terminé(s)
        </p>
      </div>

      {/* Filtres */}
      <div
        className="flex flex-wrap items-center gap-3"
        style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 20 }}
      >
        {/* Recherche */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: T.t3 }} />
          <input
            className="w-full py-1.5 pl-8 pr-3 text-sm"
            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.t1, outline: 'none' }}
            placeholder="Rechercher un étudiant…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => (e.currentTarget.style.borderColor = T.gold)}
            onBlur={e => (e.currentTarget.style.borderColor = T.border)}
          />
        </div>

        {/* Filtre cours */}
        {courses.length > 0 && (
          <div className="relative">
            <select
              style={selectStyle}
              value={filterCourse}
              onChange={e => setFilterCourse(e.target.value)}
            >
              <option value="all">Tous les cours</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: T.t3 }} />
          </div>
        )}

        {/* Filtre statut */}
        <div className="relative">
          <select
            style={selectStyle}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: T.t3 }} />
        </div>
      </div>

      {/* Table */}
      <div>
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: T.t3 }} />
          </div>
        )}
        {error && (
          <p className="rounded-lg p-4 text-sm" style={{ background: 'rgba(239,68,68,0.10)', border: `1px solid ${T.border}`, color: T.danger }}>{error}</p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-20 text-center"
            style={{ border: `2px dashed ${T.borderMid}`, borderRadius: 14, background: T.surfaceCard }}
          >
            <GraduationCap className="mb-4 h-10 w-10" style={{ color: T.t4 }} />
            <h2 className="text-base font-semibold" style={{ color: T.t1 }}>
              {enrollments.length === 0 ? 'Aucun étudiant inscrit' : 'Aucun résultat'}
            </h2>
            <p className="mt-1 text-sm" style={{ color: T.t3 }}>
              {enrollments.length === 0
                ? 'Les inscriptions apparaîtront ici une fois que des étudiants rejoindront vos cours.'
                : 'Modifiez vos critères de recherche.'}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="overflow-hidden" style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wide" style={{ color: T.t3 }}>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  <th className="px-4 py-3">Étudiant</th>
                  <th className="px-4 py-3">Cours</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Inscrit le</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const courseTitle = courses.find(c => c.id === (e.course_id || e.formation_id))?.title
                    ?? e.formations?.title
                    ?? e.course_id
                    ?? '—';
                  const studentName = e.student?.full_name || e.student?.email || e.student_id || '—';
                  const studentEmail = e.student?.email || '';
                  const enrolledAt = e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString('fr-FR') : '—';

                  return (
                    <tr
                      key={e.id}
                      style={{ borderTop: `1px solid ${T.border}`, transition: 'background 0.15s' }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = T.surfaceSoft)}
                      onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: T.t1 }}>{studentName}</div>
                        {studentEmail && studentEmail !== studentName && (
                          <div className="text-xs" style={{ color: T.t3 }}>{studentEmail}</div>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ color: T.t2 }}>{courseTitle}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-4 py-3" style={{ color: T.t3 }}>{enrolledAt}</td>
                      <td className="px-4 py-3">
                        {updating === e.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: T.t3 }} />
                        ) : (
                          <div className="relative">
                            <select
                              style={{ ...selectStyle, fontSize: 11, padding: '3px 22px 3px 8px' }}
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
    </TenantAdminShell>
  );
}
