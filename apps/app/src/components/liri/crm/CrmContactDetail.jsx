import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Plus, Trash2, Check, Mail, Phone, Building2, Tag as TagIcon,
  StickyNote, ListChecks, Activity, Loader2, ChevronDown,
} from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';

/* ── Fiche contact 360° (drawer) — notes · tâches · tags · timeline ──
   Design : en-tête dense, sections rythmées, composeurs discrets, timeline à rail. */

function fullName(c) {
  const n = `${c?.first_name || ''} ${c?.last_name || ''}`.trim();
  return n || c?.email || 'Contact';
}
function initials(c) {
  return fullName(c).split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('') || '?';
}
const TIME = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const ACT_LABEL = {
  deal_created: 'Deal créé', deal_stage_moved: 'Deal déplacé', deal_won: 'Deal gagné',
  deal_lost: 'Deal perdu', deal_deleted: 'Deal supprimé', deal_updated: 'Deal modifié',
  note_added: 'Note ajoutée', contact_created: 'Contact créé', lead_converted: 'Lead converti',
};

function Meta({ icon: Icon, children }) {
  if (!children) return null;
  return (
    <div className="flex items-center gap-2 text-[13px] lp-muted">
      <Icon size={13.5} className="shrink-0 lp-faint" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function SectionHead({ icon: Icon, title, count }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={14} className="lp-coral" />
      <span className="text-[11px] font-semibold uppercase tracking-[.09em] lp-muted">{title}</span>
      {count > 0 && <span className="text-[11px] font-medium lp-faint">· {count}</span>}
    </div>
  );
}

export default function CrmContactDetail({ contact, onClose }) {
  const { toast } = useToast();
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [entityTags, setEntityTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const reqRef = useRef(0);
  const id = contact?.id;
  const err = (e) => toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });

  const load = useCallback(async () => {
    if (!id) return;
    const rid = ++reqRef.current;
    setLoading(true);
    try {
      const [n, t, et, at, ac] = await Promise.all([
        crmApi.listNotes('contact', id),
        crmApi.listTasks({ entity_type: 'contact', entity_id: id }),
        crmApi.listEntityTags('contact', id).catch(() => []),
        crmApi.listTags().catch(() => []),
        crmApi.listActivities({ entity_type: 'contact', entity_id: id }).catch(() => []),
      ]);
      if (rid !== reqRef.current) return;
      setNotes(Array.isArray(n) ? n : n?.notes ?? []);
      setTasks(Array.isArray(t) ? t : t?.tasks ?? []);
      setEntityTags(Array.isArray(et) ? et : et?.tags ?? []);
      setAllTags(Array.isArray(at) ? at : at?.tags ?? []);
      setActs(Array.isArray(ac) ? ac : ac?.activities ?? []);
    } catch (e) {
      if (rid === reqRef.current) err(e);
    } finally {
      if (rid === reqRef.current) setLoading(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [load, onClose]);

  const addNote = async () => {
    const body = noteText.trim();
    if (!body || busy) return;
    setBusy(true);
    try { await crmApi.createNote({ entity_type: 'contact', entity_id: id, body }); setNoteText(''); await load(); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const delNote = async (nid) => { try { await crmApi.deleteNote(nid); await load(); } catch (e) { err(e); } };
  const addTask = async () => {
    const title = taskTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try { await crmApi.createTask({ entity_type: 'contact', entity_id: id, title }); setTaskTitle(''); await load(); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const toggleTask = async (t) => {
    try { await crmApi.updateTask(t.id, { status: t.status === 'done' ? 'open' : 'done' }); await load(); } catch (e) { err(e); }
  };
  const delTask = async (tid) => { try { await crmApi.deleteTask(tid); await load(); } catch (e) { err(e); } };

  const attachedIds = new Set(entityTags.map((t) => t.id));
  const toggleTag = async (tag) => {
    try {
      if (attachedIds.has(tag.id)) await crmApi.detachTag({ tag_id: tag.id, entity_type: 'contact', entity_id: id });
      else await crmApi.attachTag({ tag_id: tag.id, entity_type: 'contact', entity_id: id });
      await load();
    } catch (e) { err(e); }
  };

  if (!contact) return null;
  const co = contact.company?.name;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: 'rgba(15,12,10,.55)' }} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Fiche ${fullName(contact)}`}
        className="relative flex h-[100dvh] w-full max-w-[420px] flex-col border-l lp-line shadow-2xl"
        style={{ background: '#211f1b', animation: 'crmSlideIn .22s cubic-bezier(.2,.8,.2,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes crmSlideIn{from{transform:translateX(18px);opacity:.4}to{transform:none;opacity:1}}`}</style>

        {/* ── En-tête ── */}
        <header className="shrink-0 border-b lp-line px-5 pb-4 pt-5">
          <div className="flex items-start gap-3.5">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[15px] font-semibold text-white"
              style={{ background: 'linear-gradient(140deg,#d97757,#c2683f)' }}
            >
              {initials(contact)}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="truncate text-[17px] font-semibold leading-tight lp-ink">{fullName(contact)}</h2>
              {contact.title && <p className="truncate text-[13px] lp-muted">{contact.title}</p>}
            </div>
            <button
              type="button" aria-label="Fermer" onClick={onClose}
              className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn lp-tr"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-3.5 space-y-1.5">
            <Meta icon={Mail}>{contact.email}</Meta>
            <Meta icon={Phone}>{contact.phone}</Meta>
            <Meta icon={Building2}>{co}</Meta>
          </div>
        </header>

        {/* ── Corps scrollable ── */}
        <div className="lp-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl lp-panel animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-7">
              {/* Étiquettes */}
              <section>
                <SectionHead icon={TagIcon} title="Étiquettes" count={entityTags.length} />
                <div className="flex flex-wrap items-center gap-1.5">
                  {entityTags.map((t) => (
                    <button
                      key={t.id} type="button" onClick={() => toggleTag(t)} title="Retirer"
                      className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 text-[12px] font-medium lp-tr"
                      style={{ background: 'rgba(217,119,87,.13)', color: '#e08a63' }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color || '#d97757' }} />
                      {t.name}
                      <X size={11} className="opacity-40 lp-tr group-hover:opacity-90" />
                    </button>
                  ))}
                  <div className="relative">
                    <button
                      type="button" onClick={() => setTagOpen((v) => !v)} aria-expanded={tagOpen}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed lp-line px-2.5 py-1 text-[12px] lp-muted lp-railbtn lp-tr"
                    >
                      <Plus size={12} /> Étiquette <ChevronDown size={11} className="opacity-60" />
                    </button>
                    {tagOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setTagOpen(false)} />
                        <div className="absolute left-0 z-50 mt-1.5 max-h-56 w-56 overflow-y-auto rounded-xl border lp-line py-1 shadow-xl" style={{ background: '#2a2723' }}>
                          {allTags.length === 0 ? (
                            <p className="px-3 py-2.5 text-[12px] lp-faint">Aucune étiquette encore.</p>
                          ) : allTags.map((t) => (
                            <button
                              key={t.id} type="button" onClick={() => toggleTag(t)}
                              className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] lp-ink lp-railbtn lp-tr"
                            >
                              <span className={`grid h-4 w-4 place-items-center rounded-[5px] border ${attachedIds.has(t.id) ? 'lp-line' : 'lp-line'}`} style={attachedIds.has(t.id) ? { background: '#d97757', borderColor: '#d97757' } : {}}>
                                {attachedIds.has(t.id) && <Check size={11} className="text-white" />}
                              </span>
                              <span className="h-2 w-2 rounded-full" style={{ background: t.color || '#d97757' }} />
                              <span className="truncate">{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* Notes */}
              <section>
                <SectionHead icon={StickyNote} title="Notes" count={notes.length} />
                <div className="rounded-xl border lp-line" style={{ background: 'rgba(245,244,238,.03)' }}>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-t-xl bg-transparent px-3.5 py-3 text-[13.5px] lp-ink outline-none placeholder:text-[var(--faint)]"
                    placeholder="Écrire une note…"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addNote(); }}
                  />
                  <div className="flex items-center justify-between border-t lp-line px-3 py-2">
                    <span className="text-[11px] lp-faint">⌘↵ pour ajouter</span>
                    <button
                      type="button" onClick={addNote} disabled={busy || !noteText.trim()}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-white lp-tr lp-ember disabled:opacity-45"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Ajouter
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 space-y-2">
                  {notes.map((n) => (
                    <div key={n.id} className="group rounded-xl border lp-line lp-panel70 px-3.5 py-3">
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed lp-ink">{n.body}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[11px] lp-faint">{TIME.format(new Date(n.created_at))}</span>
                        <button type="button" aria-label="Supprimer la note" onClick={() => delNote(n.id)} className="cursor-pointer opacity-0 lp-tr group-hover:opacity-100" style={{ color: '#e0a48f' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && <p className="px-1 text-[12.5px] lp-faint">Aucune note pour l'instant.</p>}
                </div>
              </section>

              {/* Tâches */}
              <section>
                <SectionHead icon={ListChecks} title="Tâches" count={tasks.length} />
                <div className="flex items-center gap-2 rounded-xl border lp-line px-3 py-1.5" style={{ background: 'rgba(245,244,238,.03)' }}>
                  <Plus size={15} className="shrink-0 lp-faint" />
                  <input
                    className="min-w-0 flex-1 bg-transparent py-1.5 text-[13.5px] lp-ink outline-none placeholder:text-[var(--faint)]"
                    placeholder="Ajouter une tâche…"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  />
                  {taskTitle.trim() && (
                    <button type="button" onClick={addTask} disabled={busy} className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] font-medium text-white lp-ember lp-tr disabled:opacity-45">
                      OK
                    </button>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  {tasks.map((t) => {
                    const done = t.status === 'done';
                    return (
                      <div key={t.id} className="group flex items-center gap-3 rounded-lg px-2 py-2 lp-tr hover:bg-[rgba(245,244,238,.04)]">
                        <button
                          type="button" aria-label={done ? 'Rouvrir' : 'Terminer'} onClick={() => toggleTask(t)}
                          className="grid h-[18px] w-[18px] shrink-0 cursor-pointer place-items-center rounded-md border lp-tr"
                          style={done ? { background: '#d97757', borderColor: '#d97757' } : { borderColor: 'var(--line)' }}
                        >
                          {done && <Check size={12} className="text-white" />}
                        </button>
                        <span className={`min-w-0 flex-1 truncate text-[13.5px] ${done ? 'lp-faint line-through' : 'lp-ink'}`}>{t.title}</span>
                        <button type="button" aria-label="Supprimer la tâche" onClick={() => delTask(t.id)} className="shrink-0 cursor-pointer opacity-0 lp-tr group-hover:opacity-100" style={{ color: '#e0a48f' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                  {tasks.length === 0 && <p className="px-1 text-[12.5px] lp-faint">Aucune tâche.</p>}
                </div>
              </section>

              {/* Activité — timeline à rail */}
              <section>
                <SectionHead icon={Activity} title="Activité" count={acts.length} />
                {acts.length === 0 ? (
                  <p className="px-1 text-[12.5px] lp-faint">Aucune activité liée.</p>
                ) : (
                  <div className="relative pl-1">
                    <span className="absolute left-[10px] top-1.5 bottom-1.5 w-px" style={{ background: 'var(--line)' }} />
                    <div className="space-y-4">
                      {acts.map((a) => (
                        <div key={a.id} className="relative flex items-start gap-3">
                          <span className="relative z-10 mt-0.5 grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full" style={{ background: 'rgba(217,119,87,.16)' }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#d97757' }} />
                          </span>
                          <div className="min-w-0 pb-0.5">
                            <p className="text-[13px] lp-ink">{a.title || ACT_LABEL[a.type] || a.type}</p>
                            <p className="text-[11px] lp-faint">{TIME.format(new Date(a.created_at))}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
