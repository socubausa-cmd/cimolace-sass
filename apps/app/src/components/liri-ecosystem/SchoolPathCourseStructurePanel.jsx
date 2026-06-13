/**
 * Éditeur module → semaine → jour → blocs pour un path_course.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Trash2, Pencil, Loader2, Layers, Calendar, Sun, Box, Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import {
  listCourseModules,
  createCourseModule,
  updateCourseModule,
  deleteCourseModule,
  listModuleWeeks,
  createModuleWeek,
  updateModuleWeek,
  deleteModuleWeek,
  listWeekDays,
  createWeekDay,
  updateWeekDay,
  deleteWeekDay,
  listPedagogicalBlocks,
  createPedagogicalBlock,
  updatePedagogicalBlock,
  deletePedagogicalBlock,
  applySortOrderSequence,
} from '@/lib/schoolPathsApi';
import {
  PEDAGOGY_TYPE_OPTIONS,
  BLOCK_TYPE_OPTIONS,
  nextSortOrder,
  nextDayNumber,
  WEEKDAY_GRID_LABELS,
} from '@/lib/schoolPathPedagogyConstants';
import { SchoolPathColumnDnd, SortableSchoolRow } from '@/components/liri-ecosystem/SchoolPathSortable';
import SchoolPathBlockReplayPanel from '@/components/liri-ecosystem/SchoolPathBlockReplayPanel';

function MiniColumn({ title, icon: Icon, accent, children }) {
  return (
    <div className="flex min-h-[200px] flex-col rounded-xl border border-white/[0.08] bg-black/20">
      <div className={cn('flex items-center gap-2 border-b border-white/[0.06] px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider', accent)}>
        {Icon ? <Icon className="h-3.5 w-3.5 opacity-80" /> : null}
        {title}
      </div>
      <div className="max-h-[340px] flex-1 overflow-y-auto p-2">{children}</div>
    </div>
  );
}

export default function SchoolPathCourseStructurePanel({ courseId, courseTitle, busy, setBusy, setError, inputCls, onWeekClick }) {
  const [modules, setModules] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [days, setDays] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loadingM, setLoadingM] = useState(false);

  const [selModuleId, setSelModuleId] = useState(null);
  const [selWeekId, setSelWeekId] = useState(null);
  const [selDayId, setSelDayId] = useState(null);

  const [newModTitle, setNewModTitle] = useState('');
  const [newWeekTitle, setNewWeekTitle] = useState('');
  const [newWeekGrammar, setNewWeekGrammar] = useState('');
  const [newDayTitle, setNewDayTitle] = useState('');
  const [newDayPedagogy, setNewDayPedagogy] = useState('generic');
  const [newBlockType, setNewBlockType] = useState('summary_block');
  const [newBlockTitle, setNewBlockTitle] = useState('');

  const [editModId, setEditModId] = useState(null);
  const [editWeekId, setEditWeekId] = useState(null);
  const [editDayId, setEditDayId] = useState(null);
  const [editBlockId, setEditBlockId] = useState(null);
  const [editScratch, setEditScratch] = useState({});
  const [replayForBlock, setReplayForBlock] = useState(null);

  const loadModules = useCallback(async () => {
    if (!courseId) return;
    setLoadingM(true);
    const { data, error: err } = await listCourseModules(supabase, courseId);
    setLoadingM(false);
    if (err) setError(err.message || 'Modules');
    else setModules(data || []);
  }, [courseId, setError]);

  const loadWeeks = useCallback(async (moduleId) => {
    const { data, error: err } = await listModuleWeeks(supabase, moduleId);
    if (err) setError(err.message || 'Semaines');
    else setWeeks(data || []);
  }, [setError]);

  const loadDays = useCallback(async (weekId) => {
    const { data, error: err } = await listWeekDays(supabase, weekId);
    if (err) setError(err.message || 'Jours');
    else setDays(data || []);
  }, [setError]);

  const loadBlocks = useCallback(async (dayId) => {
    const { data, error: err } = await listPedagogicalBlocks(supabase, dayId);
    if (err) setError(err.message || 'Blocs');
    else setBlocks(data || []);
  }, [setError]);

  useEffect(() => {
    setSelModuleId(null);
    setSelWeekId(null);
    setSelDayId(null);
    setModules([]);
    setWeeks([]);
    setDays([]);
    setBlocks([]);
    if (courseId) loadModules();
  }, [courseId, loadModules]);

  useEffect(() => {
    setSelWeekId(null);
    setSelDayId(null);
    setWeeks([]);
    setDays([]);
    setBlocks([]);
    if (selModuleId) loadWeeks(selModuleId);
  }, [selModuleId, loadWeeks]);

  useEffect(() => {
    setSelDayId(null);
    setDays([]);
    setBlocks([]);
    if (selWeekId) loadDays(selWeekId);
  }, [selWeekId, loadDays]);

  useEffect(() => {
    setReplayForBlock(null);
    setBlocks([]);
    if (selDayId) loadBlocks(selDayId);
  }, [selDayId, loadBlocks]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-white/45">
        Structure du cours <span className="font-medium text-teal-300/90">{courseTitle}</span> — réordonnez par la poignée ⋮⋮, grille semaine lun→dim pour les jours, replay par bloc.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniColumn title="Modules" icon={Layers} accent="text-cyan-400/90">
          {loadingM ? <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-white/25" /> : null}
          {!loadingM && modules.length === 0 ? <p className="py-2 text-center text-[10px] text-white/25">Ajoutez un module</p> : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newModTitle.trim()) return;
              run(async () => {
                setError(null);
                const { error: err } = await createCourseModule(supabase, {
                  courseId,
                  title: newModTitle,
                  sortOrder: nextSortOrder(modules),
                });
                if (err) setError(err.message);
                else {
                  setNewModTitle('');
                  await loadModules();
                }
              });
            }}
            className="mb-2 space-y-1.5"
          >
            <input className={inputCls} placeholder="Nouveau module" value={newModTitle} onChange={(e) => setNewModTitle(e.target.value)} />
            <button type="submit" disabled={busy || !newModTitle.trim()} className="w-full rounded-lg bg-cyan-600/90 py-1.5 text-[11px] font-semibold text-white hover:bg-cyan-500 disabled:opacity-35">
              Ajouter
            </button>
          </form>
          <SchoolPathColumnDnd
            items={modules}
            disabled={busy || !!editModId}
            onReorder={(orderedIds) =>
              run(async () => {
                setError(null);
                const { error: err } = await applySortOrderSequence(supabase, 'course_modules', orderedIds);
                if (err) setError(err.message);
                else await loadModules();
              })
            }
          >
            <ul className="space-y-0">
              {modules.map((m) => (
                <li key={m.id}>
                  {editModId === m.id ? (
                    <div className="mb-1 space-y-1 rounded-lg border border-white/10 p-1.5">
                      <input className={inputCls} value={editScratch.t || ''} onChange={(e) => setEditScratch((s) => ({ ...s, t: e.target.value }))} />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="flex-1 rounded bg-emerald-600 py-1 text-[10px] text-white"
                          onClick={() =>
                            run(async () => {
                              setError(null);
                              const { error: err } = await updateCourseModule(supabase, { id: m.id, title: editScratch.t });
                              if (err) setError(err.message);
                              else {
                                setEditModId(null);
                                await loadModules();
                              }
                            })
                          }
                        >
                          OK
                        </button>
                        <button type="button" className="rounded border border-white/10 px-2 text-[10px] text-white/45" onClick={() => setEditModId(null)}>
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <SortableSchoolRow id={m.id} disabled={busy}>
                      <div
                        className={cn(
                          'flex items-center gap-1 px-1.5 py-1.5 text-[11px]',
                          selModuleId === m.id ? 'bg-cyan-500/12' : '',
                        )}
                      >
                        <button type="button" className="min-w-0 flex-1 truncate text-left text-white/75" onClick={() => setSelModuleId(m.id)}>
                          {m.title}
                        </button>
                        <button
                          type="button"
                          className="p-0.5 text-white/35 hover:text-white/70"
                          onClick={() => {
                            setEditModId(m.id);
                            setEditScratch({ t: m.title });
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="p-0.5 text-white/35 hover:text-red-300"
                          onClick={() => {
                            if (!window.confirm('Supprimer ce module et tout le sous-arbre ?')) return;
                            run(async () => {
                              setError(null);
                              const { error: err } = await deleteCourseModule(supabase, m.id);
                              if (err) setError(err.message);
                              else {
                                if (selModuleId === m.id) setSelModuleId(null);
                                await loadModules();
                              }
                            });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </SortableSchoolRow>
                  )}
                </li>
              ))}
            </ul>
          </SchoolPathColumnDnd>
        </MiniColumn>

        <MiniColumn title="Semaines" icon={Calendar} accent="text-amber-400/90">
          {!selModuleId ? (
            <p className="py-4 text-center text-[10px] text-white/25">Choisissez un module</p>
          ) : (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newWeekTitle.trim()) return;
                  run(async () => {
                    setError(null);
                    const { error: err } = await createModuleWeek(supabase, {
                      moduleId: selModuleId,
                      title: newWeekTitle,
                      grammarKey: newWeekGrammar || null,
                      sortOrder: nextSortOrder(weeks),
                    });
                    if (err) setError(err.message);
                    else {
                      setNewWeekTitle('');
                      setNewWeekGrammar('');
                      await loadWeeks(selModuleId);
                    }
                  });
                }}
                className="mb-2 space-y-1.5"
              >
                <input className={inputCls} placeholder="Semaine (titre)" value={newWeekTitle} onChange={(e) => setNewWeekTitle(e.target.value)} />
                <input className={inputCls} placeholder="grammar_key (optionnel)" value={newWeekGrammar} onChange={(e) => setNewWeekGrammar(e.target.value)} />
                <button type="submit" disabled={busy || !newWeekTitle.trim()} className="w-full rounded-lg bg-amber-600/90 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:opacity-35">
                  Ajouter
                </button>
              </form>
              {weeks.length === 0 ? <p className="py-2 text-center text-[10px] text-white/25">Ajoutez une semaine</p> : null}
              <SchoolPathColumnDnd
                items={weeks}
                disabled={busy || !!editWeekId}
                onReorder={(orderedIds) =>
                  run(async () => {
                    setError(null);
                    const { error: err } = await applySortOrderSequence(supabase, 'module_weeks', orderedIds);
                    if (err) setError(err.message);
                    else await loadWeeks(selModuleId);
                  })
                }
              >
                <ul className="space-y-0">
                  {weeks.map((w) => (
                    <li key={w.id}>
                      {editWeekId === w.id ? (
                        <div className="mb-1 space-y-1 rounded-lg border border-white/10 p-1.5">
                          <input className={inputCls} value={editScratch.t || ''} onChange={(e) => setEditScratch((s) => ({ ...s, t: e.target.value }))} />
                          <input className={inputCls} value={editScratch.g || ''} onChange={(e) => setEditScratch((s) => ({ ...s, g: e.target.value }))} placeholder="grammar_key" />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="flex-1 rounded bg-emerald-600 py-1 text-[10px] text-white"
                              onClick={() =>
                                run(async () => {
                                  setError(null);
                                  const { error: err } = await updateModuleWeek(supabase, { id: w.id, title: editScratch.t, grammarKey: editScratch.g });
                                  if (err) setError(err.message);
                                  else {
                                    setEditWeekId(null);
                                    await loadWeeks(selModuleId);
                                  }
                                })
                              }
                            >
                              OK
                            </button>
                            <button type="button" className="rounded border border-white/10 px-2 text-[10px] text-white/45" onClick={() => setEditWeekId(null)}>
                              ×
                            </button>
                          </div>
                        </div>
                      ) : (
                        <SortableSchoolRow id={w.id} disabled={busy}>
                          <div
                            className={cn(
                              'flex items-center gap-1 px-1.5 py-1.5 text-[11px]',
                              selWeekId === w.id ? 'bg-amber-500/12' : '',
                            )}
                          >
                            <button type="button" className="min-w-0 flex-1 truncate text-left text-white/75" onClick={() => { setSelWeekId(w.id); if (typeof onWeekClick === 'function') onWeekClick(w.id, w); }}>
                              {w.title}
                            </button>
                            <button type="button" className="p-0.5 text-white/35 hover:text-white/70" onClick={() => { setEditWeekId(w.id); setEditScratch({ t: w.title, g: w.grammar_key || '' }); }}>
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="p-0.5 text-white/35 hover:text-red-300"
                              onClick={() => {
                                if (!window.confirm('Supprimer cette semaine et les jours / blocs ?')) return;
                                run(async () => {
                                  setError(null);
                                  const { error: err } = await deleteModuleWeek(supabase, w.id);
                                  if (err) setError(err.message);
                                  else {
                                    if (selWeekId === w.id) setSelWeekId(null);
                                    await loadWeeks(selModuleId);
                                  }
                                });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </SortableSchoolRow>
                      )}
                    </li>
                  ))}
                </ul>
              </SchoolPathColumnDnd>
            </>
          )}
        </MiniColumn>

        <MiniColumn title="Jours" icon={Sun} accent="text-violet-400/90">
          {!selWeekId ? (
            <p className="py-4 text-center text-[10px] text-white/25">Choisissez une semaine</p>
          ) : (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newDayTitle.trim()) return;
                  run(async () => {
                    setError(null);
                    const { error: err } = await createWeekDay(supabase, {
                      weekId: selWeekId,
                      dayNumber: nextDayNumber(days),
                      title: newDayTitle,
                      pedagogyType: newDayPedagogy,
                      sortOrder: nextSortOrder(days),
                    });
                    if (err) setError(err.message);
                    else {
                      setNewDayTitle('');
                      await loadDays(selWeekId);
                    }
                  });
                }}
                className="mb-2 space-y-1.5"
              >
                <input className={inputCls} placeholder="Jour (titre)" value={newDayTitle} onChange={(e) => setNewDayTitle(e.target.value)} />
                <select className={cn(inputCls, 'cursor-pointer')} value={newDayPedagogy} onChange={(e) => setNewDayPedagogy(e.target.value)}>
                  {PEDAGOGY_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={busy || !newDayTitle.trim()} className="w-full rounded-lg bg-violet-600/90 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-35">
                  Ajouter
                </button>
              </form>
              {days.length > 0 ? (
                <div className="mb-2 rounded-lg border border-violet-500/25 bg-violet-950/20 p-2">
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-violet-300/85">Grille semaine (jour 1 = lun … 7 = dim)</p>
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_GRID_LABELS.map(({ n, short }) => {
                      const d = days.find((x) => Number(x.day_number) === n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => d && setSelDayId(d.id)}
                          disabled={!d}
                          className={cn(
                            'min-h-[50px] rounded-md border px-0.5 py-1 text-center transition-all',
                            !d && 'cursor-default border-white/[0.05] bg-white/[0.02] text-white/20',
                            d && selDayId !== d.id && 'border-white/10 bg-white/[0.04] text-white/60 hover:border-violet-400/35',
                            d && selDayId === d.id && 'border-violet-500/45 bg-violet-500/15 text-white/90',
                          )}
                        >
                          <div className="text-[9px] font-semibold text-white/40">{short}</div>
                          {d ? <div className="line-clamp-2 text-[8px] leading-tight text-white/70">{d.title}</div> : <span className="text-[9px] text-white/15">—</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {days.length === 0 ? <p className="py-2 text-center text-[10px] text-white/25">Ajoutez un jour</p> : null}
              <SchoolPathColumnDnd
                items={days}
                disabled={busy || !!editDayId}
                onReorder={(orderedIds) =>
                  run(async () => {
                    setError(null);
                    const { error: err } = await applySortOrderSequence(supabase, 'week_days', orderedIds);
                    if (err) setError(err.message);
                    else await loadDays(selWeekId);
                  })
                }
              >
                <ul className="space-y-0">
                  {days.map((d) => (
                    <li key={d.id}>
                      {editDayId === d.id ? (
                        <div className="mb-1 space-y-1 rounded-lg border border-white/10 p-1.5">
                          <input className={inputCls} type="number" min={1} value={editScratch.n ?? d.day_number} onChange={(e) => setEditScratch((s) => ({ ...s, n: e.target.value }))} />
                          <input className={inputCls} value={editScratch.t || ''} onChange={(e) => setEditScratch((s) => ({ ...s, t: e.target.value }))} />
                          <select className={cn(inputCls, 'cursor-pointer')} value={editScratch.p || d.pedagogy_type} onChange={(e) => setEditScratch((s) => ({ ...s, p: e.target.value }))}>
                            {PEDAGOGY_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="flex-1 rounded bg-emerald-600 py-1 text-[10px] text-white"
                              onClick={() =>
                                run(async () => {
                                  setError(null);
                                  const { error: err } = await updateWeekDay(supabase, {
                                    id: d.id,
                                    dayNumber: editScratch.n,
                                    title: editScratch.t,
                                    pedagogyType: editScratch.p,
                                  });
                                  if (err) setError(err.message);
                                  else {
                                    setEditDayId(null);
                                    await loadDays(selWeekId);
                                  }
                                })
                              }
                            >
                              OK
                            </button>
                            <button type="button" className="rounded border border-white/10 px-2 text-[10px] text-white/45" onClick={() => setEditDayId(null)}>
                              ×
                            </button>
                          </div>
                        </div>
                      ) : (
                        <SortableSchoolRow id={d.id} disabled={busy}>
                          <div
                            className={cn(
                              'flex items-center gap-1 px-1.5 py-1.5 text-[11px]',
                              selDayId === d.id ? 'bg-violet-500/12' : '',
                            )}
                          >
                            <button type="button" className="min-w-0 flex-1 truncate text-left text-white/75" onClick={() => setSelDayId(d.id)}>
                              <span className="text-white/35">#{d.day_number}</span> {d.title}
                            </button>
                            <button type="button" className="p-0.5 text-white/35 hover:text-white/70" onClick={() => { setEditDayId(d.id); setEditScratch({ n: d.day_number, t: d.title, p: d.pedagogy_type }); }}>
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="p-0.5 text-white/35 hover:text-red-300"
                              onClick={() => {
                                if (!window.confirm('Supprimer ce jour et ses blocs ?')) return;
                                run(async () => {
                                  setError(null);
                                  const { error: err } = await deleteWeekDay(supabase, d.id);
                                  if (err) setError(err.message);
                                  else {
                                    if (selDayId === d.id) setSelDayId(null);
                                    await loadDays(selWeekId);
                                  }
                                });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </SortableSchoolRow>
                      )}
                    </li>
                  ))}
                </ul>
              </SchoolPathColumnDnd>
            </>
          )}
        </MiniColumn>

        <MiniColumn title="Blocs" icon={Box} accent="text-emerald-400/90">
          {!selDayId ? (
            <p className="py-4 text-center text-[10px] text-white/25">Choisissez un jour</p>
          ) : (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    setError(null);
                    const { error: err } = await createPedagogicalBlock(supabase, {
                      dayId: selDayId,
                      type: newBlockType,
                      title: newBlockTitle || null,
                      data: {},
                      sortOrder: nextSortOrder(blocks),
                    });
                    if (err) setError(err.message);
                    else {
                      setNewBlockTitle('');
                      await loadBlocks(selDayId);
                    }
                  });
                }}
                className="mb-2 space-y-1.5"
              >
                <select className={cn(inputCls, 'cursor-pointer')} value={newBlockType} onChange={(e) => setNewBlockType(e.target.value)}>
                  {BLOCK_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input className={inputCls} placeholder="Titre (optionnel)" value={newBlockTitle} onChange={(e) => setNewBlockTitle(e.target.value)} />
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-emerald-600/90 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-35">
                  Ajouter
                </button>
              </form>
              {blocks.length === 0 ? <p className="py-2 text-center text-[10px] text-white/25">Ajoutez un bloc</p> : null}
              <SchoolPathColumnDnd
                items={blocks}
                disabled={busy || !!editBlockId}
                onReorder={(orderedIds) =>
                  run(async () => {
                    setError(null);
                    const { error: err } = await applySortOrderSequence(supabase, 'pedagogical_blocks', orderedIds);
                    if (err) setError(err.message);
                    else await loadBlocks(selDayId);
                  })
                }
              >
                <ul className="space-y-0">
                  {blocks.map((b) => (
                    <li key={b.id}>
                      {editBlockId === b.id ? (
                        <div className="mb-1 space-y-1 rounded-lg border border-white/10 p-1.5">
                          <select className={cn(inputCls, 'cursor-pointer')} value={editScratch.ty || b.type} onChange={(e) => setEditScratch((s) => ({ ...s, ty: e.target.value }))}>
                            {BLOCK_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <input className={inputCls} value={editScratch.ti ?? b.title ?? ''} onChange={(e) => setEditScratch((s) => ({ ...s, ti: e.target.value }))} placeholder="Titre" />
                          <textarea className={cn(inputCls, 'min-h-[52px] resize-none font-mono text-[10px]')} value={editScratch.js ?? JSON.stringify(b.data || {}, null, 0)} onChange={(e) => setEditScratch((s) => ({ ...s, js: e.target.value }))} placeholder="{ } JSON data" />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="flex-1 rounded bg-emerald-600 py-1 text-[10px] text-white"
                              onClick={() =>
                                run(async () => {
                                  setError(null);
                                  let dataObj = {};
                                  try {
                                    dataObj = editScratch.js ? JSON.parse(editScratch.js) : {};
                                  } catch {
                                    setError('JSON invalide');
                                    return;
                                  }
                                  const { error: err } = await updatePedagogicalBlock(supabase, {
                                    id: b.id,
                                    type: editScratch.ty || b.type,
                                    title: editScratch.ti,
                                    data: dataObj,
                                  });
                                  if (err) setError(err.message);
                                  else {
                                    setEditBlockId(null);
                                    await loadBlocks(selDayId);
                                  }
                                })
                              }
                            >
                              OK
                            </button>
                            <button type="button" className="rounded border border-white/10 px-2 text-[10px] text-white/45" onClick={() => setEditBlockId(null)}>
                              ×
                            </button>
                          </div>
                        </div>
                      ) : (
                        <SortableSchoolRow id={b.id} disabled={busy}>
                          <div className="flex items-start gap-0.5 px-1.5 py-1.5 text-[11px]">
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-white/78">{BLOCK_TYPE_OPTIONS.find((x) => x.value === b.type)?.label || b.type}</div>
                              {b.title ? <div className="truncate text-[10px] text-white/38">{b.title}</div> : null}
                            </div>
                            <button
                              type="button"
                              className="p-0.5 text-fuchsia-300/60 hover:bg-fuchsia-500/15 hover:text-fuchsia-200"
                              title="Replay / post-prod"
                              onClick={() => setReplayForBlock({ id: b.id, label: b.title || b.type })}
                            >
                              <Film className="h-3 w-3" />
                            </button>
                            <button type="button" className="p-0.5 text-white/35 hover:text-white/70" onClick={() => { setEditBlockId(b.id); setEditScratch({ ty: b.type, ti: b.title || '', js: JSON.stringify(b.data || {}, null, 2) }); }}>
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="p-0.5 text-white/35 hover:text-red-300"
                              onClick={() => {
                                if (!window.confirm('Supprimer ce bloc ?')) return;
                                run(async () => {
                                  setError(null);
                                  const { error: err } = await deletePedagogicalBlock(supabase, b.id);
                                  if (err) setError(err.message);
                                  else await loadBlocks(selDayId);
                                });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </SortableSchoolRow>
                      )}
                    </li>
                  ))}
                </ul>
              </SchoolPathColumnDnd>
            </>
          )}
        </MiniColumn>
      </div>

      {replayForBlock ? (
        <SchoolPathBlockReplayPanel
          blockId={replayForBlock.id}
          blockLabel={replayForBlock.label}
          inputCls={inputCls}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onClose={() => setReplayForBlock(null)}
        />
      ) : null}
    </div>
  );
}
