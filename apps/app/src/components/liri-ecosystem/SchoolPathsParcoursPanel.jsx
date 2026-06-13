/**
 * Gestion des parcours scolaires (school_paths + path_courses) — Pédagogie du futur.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, Pencil, Loader2, RefreshCw, BookOpen, FolderTree, AlertCircle, ChevronDown, ChevronRight,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  listSchoolPaths,
  createSchoolPath,
  updateSchoolPath,
  deleteSchoolPath,
  listPathCourses,
  createPathCourse,
  updatePathCourse,
  deletePathCourse,
} from '@/lib/schoolPathsApi';
import SchoolPathCourseStructurePanel from '@/components/liri-ecosystem/SchoolPathCourseStructurePanel';
import SchoolPathFullCalendarPanel from '@/components/liri-ecosystem/SchoolPathFullCalendarPanel';

function countCourses(row) {
  const pc = row?.path_courses;
  return Array.isArray(pc) ? pc.length : 0;
}

export default function SchoolPathsParcoursPanel({ userId, onWeekClick }) {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newPathTitle, setNewPathTitle] = useState('');
  const [newPathDesc, setNewPathDesc] = useState('');
  const [editPath, setEditPath] = useState({ title: '', description: '', startsOn: '' });
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [newCourse, setNewCourse] = useState({ title: '', description: '', level: '' });
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editCourse, setEditCourse] = useState({ title: '', description: '', level: '' });
  const [structureCourse, setStructureCourse] = useState(null);

  const loadPaths = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setPaths([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await listSchoolPaths(supabase);
    if (err) setError(err.message || 'Impossible de charger les parcours');
    else setPaths(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadPaths();
  }, [loadPaths]);

  const loadCourses = useCallback(async (pathId) => {
    if (!pathId) {
      setCourses([]);
      return;
    }
    setCoursesLoading(true);
    const { data, error: err } = await listPathCourses(supabase, pathId);
    if (err) setError(err.message || 'Erreur cours');
    else setCourses(data || []);
    setCoursesLoading(false);
  }, []);

  useEffect(() => {
    if (selectedPathId) loadCourses(selectedPathId);
    else setCourses([]);
  }, [selectedPathId, loadCourses]);

  const selectPath = (row) => {
    setSelectedPathId(row.id);
    const so = row.starts_on ? String(row.starts_on).slice(0, 10) : '';
    setEditPath({ title: row.title || '', description: row.description || '', startsOn: so });
    setNewCourse({ title: '', description: '', level: '' });
    setEditingCourseId(null);
    setStructureCourse(null);
  };

  const handleCreatePath = async (e) => {
    e.preventDefault();
    if (!userId) return;
    if (!newPathTitle.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await createSchoolPath(supabase, {
      title: newPathTitle,
      description: newPathDesc,
      ownerId: userId,
    });
    setBusy(false);
    if (err) {
      setError(err.message || 'Création impossible');
      return;
    }
    setNewPathTitle('');
    setNewPathDesc('');
    await loadPaths();
    if (data?.id) selectPath(data);
  };

  const handleUpdatePath = async () => {
    if (!selectedPathId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await updateSchoolPath(supabase, {
      id: selectedPathId,
      title: editPath.title,
      description: editPath.description,
      startsOn: editPath.startsOn,
    });
    setBusy(false);
    if (err) setError(err.message || 'Mise à jour impossible');
    else {
      setCalendarRefresh((x) => x + 1);
      await loadPaths();
    }
  };

  const handleDeletePath = async () => {
    if (!selectedPathId) return;
    if (!window.confirm('Supprimer ce parcours et tout son contenu (cours, modules…) ?')) return;
    setBusy(true);
    setError(null);
    const { error: err } = await deleteSchoolPath(supabase, selectedPathId);
    setBusy(false);
    if (err) setError(err.message || 'Suppression impossible');
    else {
      setSelectedPathId(null);
      await loadPaths();
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!selectedPathId || !newCourse.title.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createPathCourse(supabase, {
      pathId: selectedPathId,
      title: newCourse.title,
      description: newCourse.description,
      level: newCourse.level,
    });
    setBusy(false);
    if (err) setError(err.message || 'Création cours impossible');
    else {
      setNewCourse({ title: '', description: '', level: '' });
      await loadCourses(selectedPathId);
      await loadPaths();
    }
  };

  const startEditCourse = (c) => {
    setEditingCourseId(c.id);
    setEditCourse({ title: c.title || '', description: c.description || '', level: c.level || '' });
  };

  const saveCourse = async () => {
    if (!editingCourseId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await updatePathCourse(supabase, {
      id: editingCourseId,
      title: editCourse.title,
      description: editCourse.description,
      level: editCourse.level,
    });
    setBusy(false);
    if (err) setError(err.message || 'Sauvegarde impossible');
    else {
      setEditingCourseId(null);
      await loadCourses(selectedPathId);
    }
  };

  const removeCourse = async (id) => {
    if (!window.confirm('Supprimer ce cours et ses descendants en base ?')) return;
    setBusy(true);
    const { error: err } = await deletePathCourse(supabase, id);
    setBusy(false);
    if (err) setError(err.message || 'Suppression impossible');
    else {
      setStructureCourse((sc) => (sc?.id === id ? null : sc));
      await loadCourses(selectedPathId);
      await loadPaths();
    }
  };

  const inputCls =
    'w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[12px] text-white placeholder-white/25 outline-none focus:border-teal-500/45';

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-200/90">
        Supabase non configuré — impossible de persister les parcours.
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
        <p className="text-[13px] text-white/45 mb-3">Connectez-vous pour créer et synchroniser vos parcours scolaires.</p>
        <Link
          to="/login"
          className="inline-flex rounded-lg bg-teal-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-teal-500"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-white/75">
            <FolderTree className="h-4 w-4 text-teal-400" />
            Mes parcours
          </div>
          <button
            type="button"
            onClick={() => loadPaths()}
            disabled={loading}
            className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40"
            aria-label="Rafraîchir"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        ) : null}

        <form onSubmit={handleCreatePath} className="mb-4 space-y-2 border-b border-white/[0.06] pb-4">
          <input
            className={inputCls}
            placeholder="Titre du nouveau parcours"
            value={newPathTitle}
            onChange={(e) => setNewPathTitle(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Description (optionnel)"
            value={newPathDesc}
            onChange={(e) => setNewPathDesc(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !newPathTitle.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 py-2 text-[12px] font-semibold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Créer le parcours
          </button>
        </form>

        <div className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-8 text-white/30">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : paths.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-white/32">Aucun parcours — créez-en un ci-dessus.</p>
          ) : (
            paths.map((p) => {
              const sel = selectedPathId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPath(p)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all',
                    sel ? 'border-teal-500/40 bg-teal-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/12',
                  )}
                >
                  {sel ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-teal-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/25" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-white/85">{p.title}</div>
                    <div className="text-[10px] text-white/35">{countCourses(p)} cours</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        {!selectedPathId ? (
          <p className="py-12 text-center text-[12px] text-white/32">Sélectionnez un parcours pour éditer le détail et les cours.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">Métadonnées</div>
              <input
                className={cn(inputCls, 'mb-2')}
                value={editPath.title}
                onChange={(e) => setEditPath((x) => ({ ...x, title: e.target.value }))}
              />
              <textarea
                className={cn(inputCls, 'min-h-[64px] resize-none')}
                value={editPath.description}
                onChange={(e) => setEditPath((x) => ({ ...x, description: e.target.value }))}
                placeholder="Description du parcours"
              />
              <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Début calendrier (lun. semaine 1)
              </label>
              <input
                type="date"
                className={cn(inputCls, 'mt-1')}
                value={editPath.startsOn}
                onChange={(e) => setEditPath((x) => ({ ...x, startsOn: e.target.value }))}
              />
              <p className="mt-1 text-[10px] text-white/32">Ancre les <code className="rounded bg-white/[0.06] px-0.5">week_days</code> sur une timeline (tous les cours du parcours, ordre modules → semaines).</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdatePath()}
                  disabled={busy}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePath()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" /> Supprimer le parcours
                </button>
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-4">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-white/75">
                <BookOpen className="h-4 w-4 text-amber-400" />
                Cours du parcours
              </div>

              <form onSubmit={handleCreateCourse} className="mb-3 space-y-2 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">

                <input
                  className={inputCls}
                  placeholder="Titre du cours"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse((x) => ({ ...x, title: e.target.value }))}
                />
                <input
                  className={inputCls}
                  placeholder="Niveau (optionnel)"
                  value={newCourse.level}
                  onChange={(e) => setNewCourse((x) => ({ ...x, level: e.target.value }))}
                />
                <textarea
                  className={cn(inputCls, 'min-h-[48px] resize-none')}
                  placeholder="Description"
                  value={newCourse.description}
                  onChange={(e) => setNewCourse((x) => ({ ...x, description: e.target.value }))}
                />
                <button
                  type="submit"
                  disabled={busy || !newCourse.title.trim()}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/18 disabled:opacity-35"
                >
                  <Plus className="h-3 w-3" /> Ajouter un cours
                </button>
              </form>

              {coursesLoading ? (
                <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-white/25" />
              ) : courses.length === 0 ? (
                <p className="text-[11px] text-white/30">Aucun cours — structure minimale pour la suite (modules / semaines à brancher).</p>
              ) : (
                <ul className="space-y-2">
                  {courses.map((c) => (
                    <li key={c.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
                      {editingCourseId === c.id ? (
                        <div className="space-y-2">
                          <input className={inputCls} value={editCourse.title} onChange={(e) => setEditCourse((x) => ({ ...x, title: e.target.value }))} />
                          <input className={inputCls} value={editCourse.level} onChange={(e) => setEditCourse((x) => ({ ...x, level: e.target.value }))} placeholder="Niveau" />
                          <textarea className={cn(inputCls, 'min-h-[48px] resize-none')} value={editCourse.description} onChange={(e) => setEditCourse((x) => ({ ...x, description: e.target.value }))} />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => saveCourse()} className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white">OK</button>
                            <button type="button" onClick={() => setEditingCourseId(null)} className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/45">Annuler</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] font-medium text-white/82">{c.title}</div>
                              {c.level ? <div className="text-[10px] text-white/35">{c.level}</div> : null}
                              {c.description ? <div className="mt-1 text-[11px] text-white/38">{c.description}</div> : null}
                            </div>
                            <button type="button" onClick={() => startEditCourse(c)} className="rounded p-1 text-white/35 hover:bg-white/[0.06] hover:text-white/70" aria-label="Modifier">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => removeCourse(c.id)} className="rounded p-1 text-white/35 hover:bg-red-500/15 hover:text-red-300" aria-label="Supprimer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setStructureCourse({ id: c.id, title: c.title })}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 py-1.5 text-[11px] font-medium text-teal-200/80 hover:bg-teal-500/18"
                          >
                            <Network className="h-3 w-3" />
                            Modules, semaines, jours, blocs
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {selectedPathId && !structureCourse ? (
      <SchoolPathFullCalendarPanel
        pathId={selectedPathId}
        startsOnDraft={editPath.startsOn}
        refreshKey={calendarRefresh}
      />
    ) : null}

    {structureCourse && selectedPathId ? (
      <div className="rounded-2xl border border-teal-500/25 bg-gradient-to-br from-teal-950/30 via-[#0a0908] to-transparent p-4 md:p-5">
        <button
          type="button"
          onClick={() => setStructureCourse(null)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[11px] font-medium text-white/55 hover:bg-white/[0.06] hover:text-white/85"
        >
          <ChevronRight className="h-3 w-3 rotate-180" />
          Retour aux cours du parcours
        </button>
        <SchoolPathCourseStructurePanel
          courseId={structureCourse.id}
          courseTitle={structureCourse.title}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          inputCls={inputCls}
          onWeekClick={onWeekClick}
        />
      </div>
    ) : null}
    </div>
  );
}
