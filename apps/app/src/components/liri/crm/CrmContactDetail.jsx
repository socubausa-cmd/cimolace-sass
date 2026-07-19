import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, StickyNote, CheckSquare, Square, Tag as TagIcon, Plus, Trash2, Clock,
  Building2, Mail, Phone, Briefcase, Loader2, Activity,
} from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';

/* ── Fiche détail contact (drawer) : notes · tâches · tags · timeline de l'entité ── */

const inputCls =
  'w-full rounded-xl border lp-line bg-transparent px-3 py-2.5 text-[14px] lp-ink outline-none placeholder:text-[var(--faint)] focus:border-[var(--coral)]';

function contactName(c) {
  const n = `${c?.first_name || ''} ${c?.last_name || ''}`.trim();
  return n || c?.email || 'Contact';
}
function initials(c) {
  const n = contactName(c);
  return n.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('') || '?';
}
const TIME_FMT = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function Section({ icon: Icon, title, count, children }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon size={15} className="lp-coral" />
        <h3 className="text-[13.5px] font-semibold lp-ink">{title}</h3>
        {count != null && (
          <span className="rounded-md px-1.5 py-0.5 text-[11px] lp-coral-tint lp-coral">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

export default function CrmContactDetail({ contact, onClose, onChanged }) {
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
    if (!body) return;
    setBusy(true);
    try {
      await crmApi.createNote({ entity_type: 'contact', entity_id: id, body });
      setNoteText('');
      await load();
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const delNote = async (nid) => { try { await crmApi.deleteNote(nid); await load(); } catch (e) { err(e); } };

  const addTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      await crmApi.createTask({ entity_type: 'contact', entity_id: id, title });
      setTaskTitle('');
      await load();
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const toggleTask = async (task) => {
    try { await crmApi.updateTask(task.id, { status: task.status === 'done' ? 'open' : 'done' }); await load(); }
    catch (e) { err(e); }
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.5)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Fiche ${contactName(contact)}`}
        className="lp-rise relative h-full w-full max-w-md overflow-y-auto border-l lp-line"
        style={{ background: '#211f1b' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b lp-line px-5 py-4" style={{ background: '#211f1b' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full lp-coral-tint text-[15px] font-semibold lp-coral">
                {initials(contact)}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-semibold lp-ink">{contactName(contact)}</h2>
                {contact.title && <p className="truncate text-[12.5px] lp-muted">{contact.title}</p>}
              </div>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn"
            >
              <X size={17} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] lp-muted">
            {contact.email && <span className="inline-flex items-center gap-1.5"><Mail size={12} className="lp-faint" />{contact.email}</span>}
            {contact.phone && <span className="inline-flex items-center gap-1.5"><Phone size={12} className="lp-faint" />{contact.phone}</span>}
            {contact.company?.name && <span className="inline-flex items-center gap-1.5"><Building2 size={12} className="lp-faint" />{contact.company.name}</span>}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl lp-panel animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-7 p-5">
            {/* Tags */}
            <Section icon={TagIcon} title="Étiquettes" count={entityTags.length}>
              <div className="flex flex-wrap items-center gap-2">
                {entityTags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className="group inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12px] lp-coral-tint lp-coral lp-tr"
                    title="Retirer"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: t.color || 'var(--coral)' }} />
                    {t.name}
                    <X size={11} className="opacity-50 group-hover:opacity-100" />
                  </button>
                ))}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTagOpen((v) => !v)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed lp-line px-2 py-1 text-[12px] lp-muted lp-railbtn lp-tr"
                  >
                    <Plus size={12} /> Ajouter
                  </button>
                  {tagOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setTagOpen(false)} />
                      <div className="absolute left-0 z-50 mt-1 max-h-52 w-52 overflow-y-auto rounded-xl border lp-line py-1 shadow-xl" style={{ background: '#2a2723' }}>
                        {allTags.length === 0 && <p className="px-3 py-2 text-[12px] lp-faint">Aucune étiquette. Créez-en dans « Tags ».</p>}
                        {allTags.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTag(t)}
                            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] lp-ink lp-railbtn lp-tr"
                          >
                            {attachedIds.has(t.id) ? <CheckSquare size={13} className="lp-coral" /> : <Square size={13} className="lp-faint" />}
                            <span className="h-2 w-2 rounded-full" style={{ background: t.color || 'var(--coral)' }} />
                            <span className="truncate">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Section>

            {/* Notes */}
            <Section icon={StickyNote} title="Notes" count={notes.length}>
              <div className="flex items-start gap-2">
                <textarea
                  rows={2}
                  className={inputCls}
                  placeholder="Ajouter une note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <button
                  type="button"
                  onClick={addNote}
                  disabled={busy || !noteText.trim()}
                  aria-label="Ajouter la note"
                  className="mt-0.5 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-white lp-tr lp-ember disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="group flex items-start justify-between gap-2 rounded-xl border lp-line lp-panel70 p-3">
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap break-words text-[13px] lp-ink">{n.body}</p>
                      <p className="mt-1 text-[11px] lp-faint">{TIME_FMT.format(new Date(n.created_at))}</p>
                    </div>
                    <button type="button" aria-label="Supprimer" onClick={() => delNote(n.id)} className="shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 lp-faint lp-tr" style={{ color: '#e0a48f' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {notes.length === 0 && <p className="text-[12.5px] lp-faint">Aucune note pour l'instant.</p>}
              </div>
            </Section>

            {/* Tâches */}
            <Section icon={CheckSquare} title="Tâches" count={tasks.length}>
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  placeholder="Nouvelle tâche…"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                />
                <button
                  type="button"
                  onClick={addTask}
                  disabled={busy || !taskTitle.trim()}
                  aria-label="Ajouter la tâche"
                  className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-white lp-tr lp-ember disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-1.5">
                {tasks.map((t) => (
                  <div key={t.id} className="group flex items-center gap-2.5 rounded-xl border lp-line lp-panel70 px-3 py-2.5">
                    <button type="button" aria-label="Basculer" onClick={() => toggleTask(t)} className="shrink-0 cursor-pointer lp-tr" style={{ color: t.status === 'done' ? 'var(--coral)' : 'var(--faint)' }}>
                      {t.status === 'done' ? <CheckSquare size={17} /> : <Square size={17} />}
                    </button>
                    <span className={`min-w-0 flex-1 truncate text-[13px] ${t.status === 'done' ? 'lp-faint line-through' : 'lp-ink'}`}>{t.title}</span>
                    <button type="button" aria-label="Supprimer" onClick={() => delTask(t.id)} className="shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 lp-tr" style={{ color: '#e0a48f' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {tasks.length === 0 && <p className="text-[12.5px] lp-faint">Aucune tâche.</p>}
              </div>
            </Section>

            {/* Timeline de l'entité */}
            <Section icon={Activity} title="Activité du contact">
              <div className="space-y-2.5">
                {acts.map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full lp-coral-tint">
                      <Clock size={12} className="lp-coral" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12.5px] lp-ink">{a.title || a.type}</p>
                      <p className="text-[11px] lp-faint">{TIME_FMT.format(new Date(a.created_at))}</p>
                    </div>
                  </div>
                ))}
                {acts.length === 0 && <p className="text-[12.5px] lp-faint">Aucune activité liée.</p>}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
