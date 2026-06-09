/**
 * TenantAdminCoursesPage — /t/:tenantSlug/admin/courses
 * Gestion des cours pour les owners/admins/teachers d'un tenant école.
 * Connecté au NestJS /courses API via coursesApi (api-v2.ts).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, BookOpen, ChevronRight, Trash2, Layers, X, Loader2, GraduationCap } from 'lucide-react';
import { coursesApi } from '@/lib/api-v2';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_LABEL = { draft: 'Brouillon', published: 'Publié', archived: 'Archivé' };
const STATUS_STYLE = {
  draft:     { background: T.surface2, color: T.t2 },
  published: { background: 'rgba(34,197,94,0.14)', color: T.success },
  archived:  { background: 'rgba(245,158,11,0.14)', color: T.warning },
};

const inputStyle = {
  width: '100%', borderRadius: 8, border: `1px solid ${T.border}`,
  background: T.surface, color: T.t1, padding: '8px 12px', fontSize: 13, outline: 'none',
};
const onInputFocus = (e) => { e.target.style.borderColor = T.goldMid; };
const onInputBlur = (e) => { e.target.style.borderColor = T.border; };

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8,
  background: T.gold, color: '#000', padding: '8px 16px', fontSize: 13, fontWeight: 600,
  border: 'none', cursor: 'pointer',
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8,
  background: 'transparent', color: T.t2, padding: '8px 16px', fontSize: 13,
  border: `1px solid ${T.border}`, cursor: 'pointer',
};
const btnPrimarySm = { ...btnPrimary, padding: '4px 12px', fontSize: 11 };
const btnGhostSm = { ...btnGhost, padding: '4px 8px', fontSize: 11 };

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 512, borderRadius: 16, background: T.surface, border: `1px solid ${T.borderMid}`, boxShadow: '0 24px 64px -16px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, padding: '16px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: T.t1, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ borderRadius: 6, padding: 4, color: T.t3, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 500, color: T.t2 }}>{label}</label>
      {children}
    </div>
  );
}

// ── Modal création cours ──────────────────────────────────────────────────────
function CreateCourseModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', category: '', priceCents: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Le titre est requis.'); return; }
    setBusy(true);
    setError(null);
    try {
      const created = await coursesApi.create({ ...form, priceCents: Number(form.priceCents) });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err?.message ?? 'Erreur lors de la création');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nouveau cours" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Titre *">
          <input style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex : Cycle Disciple — Module 1" />
        </Field>
        <Field label="Description">
          <textarea style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description du cours…" />
        </Field>
        <Field label="Catégorie">
          <input style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex : Fondamentaux, Pratique…" />
        </Field>
        <Field label="Prix (centimes, 0 = gratuit)">
          <input style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} type="number" min="0" value={form.priceCents} onChange={e => setForm(f => ({ ...f, priceCents: e.target.value }))} />
        </Field>
        {error && <p style={{ fontSize: 13, color: T.danger, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
          <button type="button" style={btnGhost} onClick={onClose}>Annuler</button>
          <button type="submit" style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }} disabled={busy}>
            {busy && <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />}
            Créer le cours
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Panel modules + leçons d'un cours ────────────────────────────────────────
function CourseDetailPanel({ course, onClose, tenantSlug }) {
  const navigate = useNavigate();
  const [modules, setModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [expandedModule, setExpandedModule] = useState(null);
  const [lessons, setLessons] = useState({});
  const [showAddModule, setShowAddModule] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', orderIndex: 0 });
  const [showAddLesson, setShowAddLesson] = useState(null); // moduleId
  const [lessonForm, setLessonForm] = useState({ title: '', content: '', videoUrl: '', orderIndex: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { loadModules(); }, [course.id]);

  async function loadModules() {
    setLoadingModules(true);
    try {
      const data = await coursesApi.listModules(course.id);
      setModules(data ?? []);
    } catch { setModules([]); }
    finally { setLoadingModules(false); }
  }

  async function loadLessons(moduleId) {
    if (lessons[moduleId]) return;
    try {
      const data = await coursesApi.listLessons(moduleId);
      setLessons(l => ({ ...l, [moduleId]: data ?? [] }));
    } catch { setLessons(l => ({ ...l, [moduleId]: [] })); }
  }

  async function addModule(e) {
    e.preventDefault();
    if (!moduleForm.title.trim()) return;
    setBusy(true); setError(null);
    try {
      await coursesApi.createModule(course.id, { ...moduleForm, orderIndex: modules.length });
      setShowAddModule(false);
      setModuleForm({ title: '', description: '', orderIndex: 0 });
      await loadModules();
    } catch (err) { setError(err?.message ?? 'Erreur'); }
    finally { setBusy(false); }
  }

  async function addLesson(moduleId, e) {
    e.preventDefault();
    if (!lessonForm.title.trim()) return;
    setBusy(true); setError(null);
    try {
      await coursesApi.createLesson(moduleId, { ...lessonForm, orderIndex: (lessons[moduleId]?.length ?? 0) });
      setShowAddLesson(null);
      setLessonForm({ title: '', content: '', videoUrl: '', orderIndex: 0 });
      setLessons(l => ({ ...l, [moduleId]: undefined }));
      await loadLessons(moduleId);
    } catch (err) { setError(err?.message ?? 'Erreur'); }
    finally { setBusy(false); }
  }

  function toggleModule(moduleId) {
    if (expandedModule === moduleId) { setExpandedModule(null); return; }
    setExpandedModule(moduleId);
    loadLessons(moduleId);
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 40, display: 'flex',
      width: '100%', maxWidth: 512, flexDirection: 'column',
      background: T.surface, borderLeft: `1px solid ${T.borderMid}`, boxShadow: '0 0 64px -8px rgba(0,0,0,0.6)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, padding: '16px 20px' }}>
        <div>
          <h2 style={{ fontWeight: 600, color: T.t1, margin: 0 }}>{course.title}</h2>
          <p style={{ marginTop: 2, fontSize: 11, color: T.t3 }}>{course.description || 'Aucune description'}</p>
        </div>
        <button onClick={onClose} style={{ marginLeft: 16, flexShrink: 0, borderRadius: 6, padding: 4, color: T.t3, background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: 16, height: 16 }} /></button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.t2, margin: 0 }}>Modules ({modules.length})</h3>
          <button style={btnGhostSm} onClick={() => setShowAddModule(!showAddModule)}>
            <Plus style={{ width: 12, height: 12 }} /> Ajouter
          </button>
        </div>

        {showAddModule && (
          <form onSubmit={addModule} style={{ borderRadius: 10, border: `1px solid ${T.goldMid}`, background: T.goldDim, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="Titre du module *" value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} />
            <input style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="Description (optionnel)" value={moduleForm.description} onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))} />
            {error && <p style={{ fontSize: 11, color: T.danger, margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ ...btnPrimarySm, opacity: busy ? 0.5 : 1 }} disabled={busy}>
                {busy && <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} />} Créer
              </button>
              <button type="button" style={btnGhostSm} onClick={() => setShowAddModule(false)}>Annuler</button>
            </div>
          </form>
        )}

        {loadingModules ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.t3 }}><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Chargement…</div>
        ) : modules.length === 0 ? (
          <p style={{ fontSize: 13, color: T.t3 }}>Aucun module. Ajoutez-en un ci-dessus.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {modules.map((mod, i) => (
              <div key={mod.id} style={{ borderRadius: 10, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                <button
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => toggleModule(mod.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = T.surface2)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'flex', height: 20, width: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: T.surface2, fontSize: 10, fontWeight: 700, color: T.t2 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{mod.title}</span>
                  </div>
                  <ChevronRight style={{ width: 16, height: 16, color: T.t3, transition: 'transform 150ms', transform: expandedModule === mod.id ? 'rotate(90deg)' : 'none' }} />
                </button>

                {expandedModule === mod.id && (
                  <div style={{ borderTop: `1px solid ${T.border}`, background: T.surfaceSoft, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(lessons[mod.id] ?? []).map((lesson, j) => (
                      <div key={lesson.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, background: T.surface, border: `1px solid ${T.border}`, padding: '8px 12px', fontSize: 13 }}>
                        <span style={{ color: T.t3 }}>{j + 1}.</span>
                        <span style={{ flex: 1, color: T.t1 }}>{lesson.title}</span>
                        {lesson.video_url && <span style={{ fontSize: 11, color: T.info }}>Vidéo</span>}
                      </div>
                    ))}

                    {showAddLesson === mod.id ? (
                      <form onSubmit={(e) => addLesson(mod.id, e)} style={{ display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 6, border: `1px solid ${T.goldMid}`, background: T.goldDim, padding: 8 }}>
                        <input style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="Titre de la leçon *" value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} />
                        <input style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="URL vidéo (optionnel)" value={lessonForm.videoUrl} onChange={e => setLessonForm(f => ({ ...f, videoUrl: e.target.value }))} />
                        <textarea style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} rows={2} placeholder="Contenu HTML/Markdown (optionnel)" value={lessonForm.content} onChange={e => setLessonForm(f => ({ ...f, content: e.target.value }))} />
                        {error && <p style={{ fontSize: 11, color: T.danger, margin: 0 }}>{error}</p>}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="submit" style={{ ...btnPrimarySm, opacity: busy ? 0.5 : 1 }} disabled={busy}>
                            {busy && <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} />} Ajouter
                          </button>
                          <button type="button" style={btnGhostSm} onClick={() => setShowAddLesson(null)}>Annuler</button>
                        </div>
                      </form>
                    ) : (
                      <button style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.gold, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setShowAddLesson(mod.id)}>
                        <Plus style={{ width: 12, height: 12 }} /> Ajouter une leçon
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, padding: '12px 20px' }}>
        <button
          style={{ ...btnGhost, width: '100%', justifyContent: 'center', fontSize: 11 }}
          onClick={() => navigate(`/student-school-life/formations`)}
        >
          Voir depuis l'espace étudiant →
        </button>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function TenantAdminCoursesPage() {
  const { tenantSlug } = useParams();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // courseId en cours

  useEffect(() => { loadCourses(); }, []);

  async function loadCourses() {
    setLoading(true); setError(null);
    try {
      const data = await coursesApi.list();
      setCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message ?? 'Impossible de charger les cours');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(e, courseId) {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce cours ? Cette action est irréversible.')) return;
    setActionLoading(courseId);
    try {
      await coursesApi.delete(courseId);
      setCourses(prev => prev.filter(c => c.id !== courseId));
      if (selectedCourse?.id === courseId) setSelectedCourse(null);
    } catch (err) {
      alert(err?.message ?? 'Erreur lors de la suppression');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleStatus(e, course) {
    e.stopPropagation();
    const nextStatus = course.status === 'published' ? 'draft' : 'published';
    setActionLoading(course.id);
    try {
      const updated = await coursesApi.update(course.id, { status: nextStatus });
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, status: updated.status ?? nextStatus } : c));
      if (selectedCourse?.id === course.id) setSelectedCourse(s => ({ ...s, status: updated.status ?? nextStatus }));
    } catch (err) {
      alert(err?.message ?? 'Erreur lors de la mise à jour du statut');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <TenantAdminShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GraduationCap style={{ width: 20, height: 20, color: T.gold }} />
            <h1 style={{ fontSize: 19, fontWeight: 700, color: T.t1, margin: 0 }}>Formations</h1>
          </div>
          <p style={{ marginTop: 2, fontSize: 13, color: T.t2 }}>Gérez les cours, modules et leçons de votre école</p>
        </div>
        <button style={btnPrimary} onClick={() => setShowCreate(true)}>
          <Plus style={{ width: 16, height: 16 }} /> Nouveau cours
        </button>
      </div>

      {/* Body */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <Loader2 className="animate-spin" style={{ width: 24, height: 24, color: T.t3 }} />
        </div>
      )}
      {error && <p style={{ borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: `1px solid rgba(239,68,68,0.28)`, padding: 16, fontSize: 13, color: T.danger }}>{error}</p>}

      {!loading && !error && courses.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 16, border: `2px dashed ${T.borderMid}`, background: T.surfaceCard, padding: '80px 0', textAlign: 'center' }}>
          <BookOpen style={{ marginBottom: 16, width: 40, height: 40, color: T.t3 }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: T.t1, margin: 0 }}>Aucun cours pour l'instant</h2>
          <p style={{ marginTop: 4, fontSize: 13, color: T.t3 }}>Créez votre premier cours pour commencer.</p>
          <button style={{ ...btnPrimary, marginTop: 20 }} onClick={() => setShowCreate(true)}>
            <Plus style={{ width: 16, height: 16 }} /> Créer un cours
          </button>
        </div>
      )}

      {!loading && courses.length > 0 && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {courses.map(course => (
            <div
              key={course.id}
              className="group"
              style={{ position: 'relative', cursor: 'pointer', borderRadius: 16, border: `1px solid ${T.border}`, background: T.surfaceCard, padding: 20, transition: 'border-color 150ms' }}
              onClick={() => setSelectedCourse(course)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = T.goldMid)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
            >
              {/* Spinner overlay si action en cours */}
              {actionLoading === course.id && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: 'rgba(11,11,15,0.7)' }}>
                  <Loader2 className="animate-spin" style={{ width: 20, height: 20, color: T.gold }} />
                </div>
              )}
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <span style={{ borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, ...(STATUS_STYLE[course.status] ?? { background: T.surface2, color: T.t2 }) }}>
                  {STATUS_LABEL[course.status] ?? course.status}
                </span>
                {course.price_cents > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.t2 }}>{(course.price_cents / 100).toFixed(0)} XAF</span>
                )}
              </div>
              <h3 className="line-clamp-2" style={{ marginBottom: 4, fontWeight: 600, color: T.t1 }}>{course.title}</h3>
              {course.description && <p className="line-clamp-2" style={{ fontSize: 11, color: T.t2 }}>{course.description}</p>}
              {course.category && (
                <span style={{ marginTop: 12, display: 'inline-block', borderRadius: 4, background: T.goldDim, padding: '2px 8px', fontSize: 10, fontWeight: 500, color: T.gold }}>{course.category}</span>
              )}
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: T.t3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Layers style={{ width: 12, height: 12 }} /> Modules</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                  {/* Bouton Publier / Dépublier */}
                  <button
                    style={{
                      borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer',
                      ...(course.status === 'published'
                        ? { background: 'rgba(245,158,11,0.14)', color: T.warning }
                        : { background: 'rgba(34,197,94,0.14)', color: T.success }),
                    }}
                    onClick={e => handleToggleStatus(e, course)}
                    title={course.status === 'published' ? 'Dépublier' : 'Publier'}
                  >
                    {course.status === 'published' ? 'Dépublier' : 'Publier'}
                  </button>
                  {/* Bouton Supprimer */}
                  <button
                    style={{ borderRadius: 6, padding: 4, color: T.danger, background: 'rgba(239,68,68,0.10)', border: 'none', cursor: 'pointer', display: 'inline-flex' }}
                    onClick={e => handleDelete(e, course.id)}
                    title="Supprimer le cours"
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.gold }}>
                    Gérer <ChevronRight style={{ width: 12, height: 12 }} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals / Panels */}
      {showCreate && (
        <CreateCourseModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => setCourses(prev => [c, ...prev])}
        />
      )}
      {selectedCourse && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.6)' }} onClick={() => setSelectedCourse(null)} />
          <CourseDetailPanel
            course={selectedCourse}
            onClose={() => setSelectedCourse(null)}
            tenantSlug={tenantSlug}
          />
        </>
      )}
    </TenantAdminShell>
  );
}
