/**
 * TenantAdminSchoolPathsPage — /t/:tenantSlug/admin/parcours-scolaires
 * Gestion des parcours scolaires : CRUD parcours, assignation élèves, progression.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookOpen, Users, BarChart3, Loader2, ChevronDown } from 'lucide-react';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';
import SchoolPathsParcoursPanel from '@/components/liri-ecosystem/SchoolPathsParcoursPanel';
import { supabase } from '@/lib/supabase';
import { getApiBaseUrl } from '@/lib/apiBase';

const TABS = [
  { id: 'parcours',    label: 'Parcours',           icon: BookOpen },
  { id: 'assignation', label: 'Assignation élèves',  icon: Users },
  { id: 'progression', label: 'Progression',         icon: BarChart3 },
];

/* ─── Onglet Assignation ─────────────────────────────────────────────────── */
function AssignationTab({ tenantSlug }) {
  const [students, setStudents]   = useState([]);
  const [paths, setPaths]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState({}); // { [studentId]: bool }
  const [error, setError]         = useState(null);

  useEffect(() => {
    if (!tenantSlug) return;
    setLoading(true);

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const [studentsRes, pathsRes] = await Promise.all([
        // Élèves du tenant via API
        fetch(getApiBaseUrl() + '/school-paths/students?tenantId=' + tenantSlug, {
          headers: { Authorization: 'Bearer ' + token },
        }),
        // Parcours du tenant (Supabase direct — lecture simple)
        supabase
          .from('school_paths')
          .select('id, title')
          .eq('tenant_slug', tenantSlug)
          .order('title'),
      ]);

      if (!studentsRes.ok) throw new Error('Erreur chargement élèves : ' + studentsRes.status);
      if (pathsRes.error) throw pathsRes.error;

      const studentsData = await studentsRes.json();
      setStudents(
        (studentsData ?? []).map((m) => ({
          id:             m.profiles?.id ?? m.user_id ?? m.id,
          full_name:      m.profiles?.full_name ?? m.full_name ?? '—',
          email:          m.profiles?.email ?? m.email ?? '—',
          school_path_id: m.profiles?.metadata?.school_path_id ?? m.school_path_id ?? '',
          metadata:       m.profiles?.metadata ?? m.metadata ?? {},
        }))
      );
      setPaths(pathsRes.data ?? []);
    }

    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  async function handleAssign(student, selectedPathId) {
    setSaving((s) => ({ ...s, [student.id]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(getApiBaseUrl() + '/school-paths/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ studentId: student.id, pathId: selectedPathId || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? 'Erreur ' + res.status);
      }
      setStudents((prev) =>
        prev.map((st) =>
          st.id === student.id
            ? { ...st, school_path_id: selectedPathId, metadata: { ...st.metadata, school_path_id: selectedPathId || null } }
            : st
        )
      );
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setSaving((s) => ({ ...s, [student.id]: false }));
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.t3, padding: 40 }}>
      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Chargement…
    </div>
  );
  if (error) return <p style={{ color: T.danger, padding: 16 }}>{error}</p>;

  const selectStyle = {
    appearance: 'none',
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    color: T.t1,
    fontSize: 12,
    padding: '7px 28px 7px 10px',
    cursor: 'pointer',
    outline: 'none',
    minWidth: 180,
  };

  return (
    <div>
      <p style={{ color: T.t2, fontSize: 13, marginBottom: 20 }}>
        {students.length} élève{students.length !== 1 ? 's' : ''} — assignez un parcours à chacun.
      </p>

      {students.length === 0 ? (
        <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <p style={{ color: T.t3, fontSize: 13 }}>Aucun élève trouvé pour ce tenant.</p>
        </div>
      ) : (
        <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {['Élève', 'Email', 'Parcours assigné', 'Action'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: T.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((st, i) => {
                const currentPath = paths.find((p) => p.id === st.school_path_id);
                return (
                  <tr
                    key={st.id}
                    style={{ borderBottom: i < students.length - 1 ? `1px solid ${T.border}` : 'none' }}
                  >
                    <td style={{ padding: '12px 16px', color: T.t1, fontSize: 13, fontWeight: 600 }}>{st.full_name}</td>
                    <td style={{ padding: '12px 16px', color: T.t2, fontSize: 12 }}>{st.email}</td>
                    <td style={{ padding: '12px 16px', color: currentPath ? T.gold : T.t3, fontSize: 12 }}>
                      {currentPath ? currentPath.title : 'Non assigné'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <select
                          value={st.school_path_id ?? ''}
                          disabled={saving[st.id]}
                          onChange={(e) => handleAssign(st, e.target.value)}
                          style={selectStyle}
                        >
                          <option value="">— Aucun parcours —</option>
                          {paths.map((p) => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                          ))}
                        </select>
                        {saving[st.id]
                          ? <Loader2 size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: T.gold, animation: 'spin 1s linear infinite' }} />
                          : <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: T.t3, pointerEvents: 'none' }} />
                        }
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Onglet Progression ─────────────────────────────────────────────────── */
function ProgressionTab({ tenantSlug }) {
  const [paths, setPaths]         = useState([]);
  const [students, setStudents]   = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [selectedPath, setSelectedPath] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    if (!tenantSlug) return;
    setLoading(true);

    Promise.all([
      supabase.from('school_paths').select('id, title').eq('tenant_slug', tenantSlug).order('title'),
      supabase
        .from('tenant_memberships')
        .select('user_id, profiles:user_id(id, full_name, email, metadata)')
        .eq('tenant_slug', tenantSlug)
        .eq('role', 'student'),
      supabase.from('learning_analytics').select('*').eq('tenant_slug', tenantSlug).maybeSingle()
        .then(() => supabase.from('learning_analytics').select('*').eq('tenant_slug', tenantSlug))
        .catch(() => ({ data: [], error: null })),
    ])
      .then(([pathsRes, membersRes, analyticsRes]) => {
        if (pathsRes.error)  throw pathsRes.error;
        if (membersRes.error) throw membersRes.error;

        setPaths(pathsRes.data ?? []);
        setStudents(
          (membersRes.data ?? []).map((m) => ({
            id:             m.profiles?.id ?? m.user_id,
            full_name:      m.profiles?.full_name ?? '—',
            email:          m.profiles?.email ?? '—',
            school_path_id: m.profiles?.metadata?.school_path_id ?? null,
          }))
        );
        setAnalytics(analyticsRes?.data ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.t3, padding: 40 }}>
      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Chargement…
    </div>
  );
  if (error) return <p style={{ color: T.danger, padding: 16 }}>{error}</p>;

  const studentsInPath = selectedPath
    ? students.filter((s) => s.school_path_id === selectedPath.id)
    : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Liste des parcours */}
      <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ color: T.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Parcours</span>
        </div>
        {paths.length === 0 ? (
          <p style={{ color: T.t3, fontSize: 13, padding: 16 }}>Aucun parcours.</p>
        ) : (
          paths.map((p) => {
            const count = students.filter((s) => s.school_path_id === p.id).length;
            const isSelected = selectedPath?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPath(isSelected ? null : p)}
                style={{
                  width: '100%', textAlign: 'left', background: isSelected ? T.goldDim : 'transparent',
                  border: 'none', borderBottom: `1px solid ${T.border}`, padding: '12px 16px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ color: isSelected ? T.gold : T.t1, fontSize: 13, fontWeight: isSelected ? 700 : 400 }}>{p.title}</span>
                <span style={{ color: T.t3, fontSize: 11 }}>{count} élève{count !== 1 ? 's' : ''}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Détail du parcours sélectionné */}
      <div>
        {!selectedPath ? (
          <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
            <BarChart3 size={32} style={{ color: T.t4, marginBottom: 12 }} />
            <p style={{ color: T.t3, fontSize: 13 }}>Sélectionnez un parcours pour voir la progression des élèves.</p>
          </div>
        ) : (
          <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={16} style={{ color: T.gold }} />
              <span style={{ color: T.t1, fontSize: 14, fontWeight: 700 }}>{selectedPath.title}</span>
              <span style={{ color: T.t3, fontSize: 12, marginLeft: 4 }}>— {studentsInPath.length} élève{studentsInPath.length !== 1 ? 's' : ''}</span>
            </div>
            {studentsInPath.length === 0 ? (
              <p style={{ color: T.t3, fontSize: 13, padding: 20 }}>Aucun élève assigné à ce parcours.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {['Élève', 'Email', 'Statut'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: T.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {studentsInPath.map((st, i) => {
                    const analytic = analytics.find((a) => a.user_id === st.id && a.path_id === selectedPath.id);
                    return (
                      <tr key={st.id} style={{ borderBottom: i < studentsInPath.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                        <td style={{ padding: '10px 16px', color: T.t1, fontSize: 13, fontWeight: 600 }}>{st.full_name}</td>
                        <td style={{ padding: '10px 16px', color: T.t2, fontSize: 12 }}>{st.email}</td>
                        <td style={{ padding: '10px 16px' }}>
                          {analytic ? (
                            <span style={{ color: T.success, fontSize: 12 }}>
                              {analytic.progress_pct != null ? `${analytic.progress_pct}% complété` : 'En cours'}
                            </span>
                          ) : (
                            <span style={{ color: T.t3, fontSize: 12 }}>Assigné</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────────────────────── */
export default function TenantAdminSchoolPathsPage() {
  const { tenantSlug } = useParams();
  const [activeTab, setActiveTab] = useState('parcours');

  return (
    <TenantAdminShell>
      <Link to={`/t/${tenantSlug}/admin`} style={{ color: T.t3, textDecoration: 'none', fontSize: 13 }}>
        ← Tableau de bord
      </Link>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 8px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: T.goldDim, border: `1px solid ${T.goldMid}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BookOpen size={20} style={{ color: T.gold }} />
        </div>
        <h1 style={{ color: T.t1, fontSize: 22, fontWeight: 800, margin: 0 }}>Parcours scolaires</h1>
      </div>
      <p style={{ color: T.t2, fontSize: 14, marginBottom: 24 }}>
        Gérez les parcours pédagogiques, assignez vos élèves et suivez leur progression.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: `1px solid ${T.border}`, paddingBottom: 0 }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: 'transparent',
                color: isActive ? T.gold : T.t2,
                borderBottom: isActive ? `2px solid ${T.gold}` : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Contenu par onglet */}
      {activeTab === 'parcours' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ color: T.t1, fontSize: 16, fontWeight: 700, margin: 0 }}>Parcours pédagogiques</h2>
              <p style={{ color: T.t2, fontSize: 13, margin: '4px 0 0' }}>Créez et organisez les parcours de votre école.</p>
            </div>
          </div>
          <SchoolPathsParcoursPanel tenantSlug={tenantSlug} />
        </div>
      )}

      {activeTab === 'assignation' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ color: T.t1, fontSize: 16, fontWeight: 700, margin: 0 }}>Assignation des élèves</h2>
            <p style={{ color: T.t2, fontSize: 13, margin: '4px 0 0' }}>Associez chaque élève à un parcours pédagogique.</p>
          </div>
          <AssignationTab tenantSlug={tenantSlug} />
        </div>
      )}

      {activeTab === 'progression' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ color: T.t1, fontSize: 16, fontWeight: 700, margin: 0 }}>Progression par parcours</h2>
            <p style={{ color: T.t2, fontSize: 13, margin: '4px 0 0' }}>Vue d'ensemble de l'avancement des élèves par parcours.</p>
          </div>
          <ProgressionTab tenantSlug={tenantSlug} />
        </div>
      )}
    </TenantAdminShell>
  );
}
