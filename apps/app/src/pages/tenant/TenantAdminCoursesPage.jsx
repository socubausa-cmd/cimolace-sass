/**
 * TenantAdminCoursesPage — /t/:tenantSlug/admin/courses
 * Gestion des cours pour les owners/admins/teachers d'un tenant école.
 * Connecté au NestJS /courses API via coursesApi (api-v2.ts).
 */
import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { Plus, BookOpen, ChevronRight, Trash2, Edit3, Users, Layers, X, Loader2, GraduationCap, ArrowLeft, Settings } from 'lucide-react';
import { coursesApi } from '@/lib/api-v2';

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_LABEL = { draft: 'Brouillon', published: 'Publié', archived: 'Archivé' };
const STATUS_COLOR = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-amber-100 text-amber-700',
};

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

const INPUT = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';
const BTN_GHOST = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50';

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
      <form onSubmit={submit} className="space-y-4">
        <Field label="Titre *">
          <input className={INPUT} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex : Cycle Disciple — Module 1" />
        </Field>
        <Field label="Description">
          <textarea className={INPUT} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description du cours…" />
        </Field>
        <Field label="Catégorie">
          <input className={INPUT} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex : Fondamentaux, Pratique…" />
        </Field>
        <Field label="Prix (centimes, 0 = gratuit)">
          <input className={INPUT} type="number" min="0" value={form.priceCents} onChange={e => setForm(f => ({ ...f, priceCents: e.target.value }))} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className={BTN_GHOST} onClick={onClose}>Annuler</button>
          <button type="submit" className={BTN_PRIMARY} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-start justify-between border-b px-5 py-4">
        <div>
          <h2 className="font-semibold text-gray-900">{course.title}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{course.description || 'Aucune description'}</p>
        </div>
        <button onClick={onClose} className="ml-4 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Modules ({modules.length})</h3>
          <button className={BTN_GHOST + ' !py-1 !px-2 text-xs'} onClick={() => setShowAddModule(!showAddModule)}>
            <Plus className="h-3 w-3" /> Ajouter
          </button>
        </div>

        {showAddModule && (
          <form onSubmit={addModule} className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
            <input className={INPUT} placeholder="Titre du module *" value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} />
            <input className={INPUT} placeholder="Description (optionnel)" value={moduleForm.description} onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))} />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className={BTN_PRIMARY + ' !py-1 !px-3 text-xs'} disabled={busy}>
                {busy && <Loader2 className="h-3 w-3 animate-spin" />} Créer
              </button>
              <button type="button" className={BTN_GHOST + ' !py-1 !px-3 text-xs'} onClick={() => setShowAddModule(false)}>Annuler</button>
            </div>
          </form>
        )}

        {loadingModules ? (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
        ) : modules.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun module. Ajoutez-en un ci-dessus.</p>
        ) : (
          <div className="space-y-2">
            {modules.map((mod, i) => (
              <div key={mod.id} className="rounded-lg border">
                <button
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50"
                  onClick={() => toggleModule(mod.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-[10px] font-bold text-gray-600">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-800">{mod.title}</span>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expandedModule === mod.id ? 'rotate-90' : ''}`} />
                </button>

                {expandedModule === mod.id && (
                  <div className="border-t bg-gray-50 px-3 py-3 space-y-2">
                    {(lessons[mod.id] ?? []).map((lesson, j) => (
                      <div key={lesson.id} className="flex items-center gap-2 rounded bg-white px-3 py-2 text-sm shadow-sm">
                        <span className="text-gray-400">{j + 1}.</span>
                        <span className="flex-1 text-gray-800">{lesson.title}</span>
                        {lesson.video_url && <span className="text-xs text-blue-500">Vidéo</span>}
                      </div>
                    ))}

                    {showAddLesson === mod.id ? (
                      <form onSubmit={(e) => addLesson(mod.id, e)} className="space-y-2 rounded border border-blue-100 bg-blue-50 p-2">
                        <input className={INPUT} placeholder="Titre de la leçon *" value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} />
                        <input className={INPUT} placeholder="URL vidéo (optionnel)" value={lessonForm.videoUrl} onChange={e => setLessonForm(f => ({ ...f, videoUrl: e.target.value }))} />
                        <textarea className={INPUT} rows={2} placeholder="Contenu HTML/Markdown (optionnel)" value={lessonForm.content} onChange={e => setLessonForm(f => ({ ...f, content: e.target.value }))} />
                        {error && <p className="text-xs text-red-600">{error}</p>}
                        <div className="flex gap-2">
                          <button type="submit" className={BTN_PRIMARY + ' !py-1 !px-3 text-xs'} disabled={busy}>
                            {busy && <Loader2 className="h-3 w-3 animate-spin" />} Ajouter
                          </button>
                          <button type="button" className={BTN_GHOST + ' !py-1 !px-3 text-xs'} onClick={() => setShowAddLesson(null)}>Annuler</button>
                        </div>
                      </form>
                    ) : (
                      <button className="flex items-center gap-1 text-xs text-blue-600 hover:underline" onClick={() => setShowAddLesson(mod.id)}>
                        <Plus className="h-3 w-3" /> Ajouter une leçon
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t px-5 py-3">
        <button
          className={BTN_GHOST + ' w-full justify-center text-xs'}
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
              <GraduationCap className="h-5 w-5 text-blue-600" />
              <h1 className="text-lg font-bold text-gray-900">Formations</h1>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">Gérez les cours, modules et leçons de votre école</p>
          </div>
          <button className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Nouveau cours
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {!loading && !error && courses.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
            <BookOpen className="mb-4 h-10 w-10 text-gray-300" />
            <h2 className="text-base font-semibold text-gray-700">Aucun cours pour l'instant</h2>
            <p className="mt-1 text-sm text-gray-400">Créez votre premier cours pour commencer.</p>
            <button className={BTN_PRIMARY + ' mt-5'} onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Créer un cours
            </button>
          </div>
        )}

        {!loading && courses.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map(course => (
              <div
                key={course.id}
                className="group cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md relative"
                onClick={() => setSelectedCourse(course)}
              >
                {/* Spinner overlay si action en cours */}
                {actionLoading === course.id && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  </div>
                )}
                <div className="mb-3 flex items-start justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[course.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[course.status] ?? course.status}
                  </span>
                  {course.price_cents > 0 && (
                    <span className="text-xs font-semibold text-gray-600">{(course.price_cents / 100).toFixed(0)} XAF</span>
                  )}
                </div>
                <h3 className="mb-1 font-semibold text-gray-900 group-hover:text-blue-700 line-clamp-2">{course.title}</h3>
                {course.description && <p className="text-xs text-gray-500 line-clamp-2">{course.description}</p>}
                {course.category && (
                  <span className="mt-3 inline-block rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">{course.category}</span>
                )}
                <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> Modules</span>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {/* Bouton Publier / Dépublier */}
                    <button
                      className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                        course.status === 'published'
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                      onClick={e => handleToggleStatus(e, course)}
                      title={course.status === 'published' ? 'Dépublier' : 'Publier'}
                    >
                      {course.status === 'published' ? 'Dépublier' : 'Publier'}
                    </button>
                    {/* Bouton Supprimer */}
                    <button
                      className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                      onClick={e => handleDelete(e, course.id)}
                      title="Supprimer le cours"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="flex items-center gap-1 text-blue-600 group-hover:underline">
                      Gérer <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals / Panels */}
      {showCreate && (
        <CreateCourseModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => setCourses(prev => [c, ...prev])}
        />
      )}
      {selectedCourse && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setSelectedCourse(null)} />
          <CourseDetailPanel
            course={selectedCourse}
            onClose={() => setSelectedCourse(null)}
            tenantSlug={tenantSlug}
          />
        </>
      )}
    </div>
  );
}
