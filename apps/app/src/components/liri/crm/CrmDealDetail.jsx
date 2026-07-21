import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X, Plus, Trash2, Check, Building2, Users, CalendarDays, Layers,
  StickyNote, ListChecks, Activity, Award, Ban, Loader2,
  MessageSquare, Send, ShoppingBag, CalendarCheck, MessagesSquare,
} from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';

/* ── Fiche deal 360° (drawer) — infos · actions gagné/perdu · notes · tâches · timeline ──
   Même langage de craft que la fiche contact. */

const TIME = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const ACT_LABEL = {
  deal_created: 'Deal créé', deal_stage_moved: 'Deal déplacé', deal_won: 'Deal gagné',
  deal_lost: 'Deal perdu', deal_updated: 'Deal modifié', note_added: 'Note ajoutée',
};

function money(amount, currency) {
  const cur = currency || 'EUR';
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Number(amount) || 0); }
  catch { return `${Number(amount) || 0} ${cur}`.trim(); }
}
function contactName(c) {
  if (!c) return '';
  const n = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return n || c.email || 'Contact';
}

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

export default function CrmDealDetail({ deal, stages = [], onClose, onChanged }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [acts, setActs] = useState([]);
  const [platform, setPlatform] = useState(null); // reliure du contact lié
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [cur, setCur] = useState(deal); // deal courant (maj optimiste sur statut/étape)
  const reqRef = useRef(0);
  const id = deal?.id;
  const err = (e) => toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });

  const load = useCallback(async () => {
    if (!id) return;
    const rid = ++reqRef.current;
    setLoading(true);
    try {
      const contactId = deal?.contact?.id;
      const [n, t, ac, pf] = await Promise.all([
        crmApi.listNotes('deal', id),
        crmApi.listTasks({ entity_type: 'deal', entity_id: id }),
        crmApi.listActivities({ entity_type: 'deal', entity_id: id }).catch(() => []),
        contactId ? crmApi.getContactPlatform(contactId).catch(() => null) : Promise.resolve(null),
      ]);
      if (rid !== reqRef.current) return;
      setNotes(Array.isArray(n) ? n : n?.notes ?? []);
      setTasks(Array.isArray(t) ? t : t?.tasks ?? []);
      setActs(Array.isArray(ac) ? ac : ac?.activities ?? []);
      setPlatform(pf || null);
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

  const setStatus = async (status) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await crmApi.updateDeal(id, { status });
      setCur((c) => ({ ...c, ...updated, status }));
      onChanged?.();
      await load();
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const moveStage = async (stageId) => {
    setBusy(true);
    try {
      const updated = await crmApi.updateDeal(id, { stage_id: stageId });
      setCur((c) => ({ ...c, ...updated, stage_id: stageId }));
      onChanged?.();
      await load();
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const addNote = async () => {
    const body = noteText.trim();
    if (!body || busy) return;
    setBusy(true);
    try { await crmApi.createNote({ entity_type: 'deal', entity_id: id, body }); setNoteText(''); await load(); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const delNote = async (nid) => { try { await crmApi.deleteNote(nid); await load(); } catch (e) { err(e); } };
  const addTask = async () => {
    const title = taskTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try { await crmApi.createTask({ entity_type: 'deal', entity_id: id, title }); setTaskTitle(''); await load(); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const toggleTask = async (t) => { try { await crmApi.updateTask(t.id, { status: t.status === 'done' ? 'open' : 'done' }); await load(); } catch (e) { err(e); } };
  const delTask = async (tid) => { try { await crmApi.deleteTask(tid); await load(); } catch (e) { err(e); } };

  if (!deal) return null;
  const stageName = stages.find((s) => s.id === cur.stage_id)?.name;
  const isWon = cur.status === 'won';
  const isLost = cur.status === 'lost';

  // ── Reliure : contact lié ──
  const cName = (cur.contact ? contactName(cur.contact) : '') || platform?.contact?.name || 'Contact';
  const cEmail = platform?.contact?.email || null;
  const cCounts = platform?.counts || {};
  const cBadge = !platform ? null
    : platform.isPlatformUser ? { text: platform.role ? `Membre · ${platform.role}` : 'Membre', bg: 'color-mix(in srgb, var(--crm-accent) 15%, transparent)', fg: 'var(--crm-accent-soft, #e08a63)' }
    : platform.hasAccount ? { text: 'Compte détecté', bg: 'rgba(220,180,120,.12)', fg: 'var(--crm-gold, #cba36b)' }
    : { text: cEmail ? 'Prospect' : 'Sans compte', bg: 'rgba(245,244,238,.06)', fg: 'var(--muted)' };
  const openMessage = () => {
    if (!platform?.userId || !platform?.isPlatformUser) return;
    onClose();
    navigate(`/liri/messages?to=${encodeURIComponent(platform.userId)}&name=${encodeURIComponent(platform.contact?.name || cName)}`);
  };
  const sendEmail = () => { if (cEmail) window.location.href = `mailto:${cEmail}`; };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: 'rgba(15,12,10,.55)' }} />
      <aside
        role="dialog" aria-modal="true" aria-label={`Deal ${cur.title || ''}`}
        className="relative flex h-[100dvh] w-full max-w-[420px] flex-col border-l lp-line shadow-2xl"
        style={{ background: 'var(--crm-sunken, #211f1b)', animation: 'crmSlideIn .22s cubic-bezier(.2,.8,.2,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes crmSlideIn{from{transform:translateX(18px);opacity:.4}to{transform:none;opacity:1}}`}</style>

        {/* En-tête */}
        <header className={`shrink-0 border-b lp-line px-5 pb-4 pt-5 ${isWon || isLost ? 'opacity-90' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-[17px] font-semibold leading-tight lp-ink">{cur.title || 'Sans titre'}</h2>
              <div className="mt-1 text-[22px] font-semibold lp-coral" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {money(cur.amount, cur.currency)}
              </div>
            </div>
            <button type="button" aria-label="Fermer" onClick={onClose} className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn lp-tr">
              <X size={18} />
            </button>
          </div>

          {(isWon || isLost) && (
            <div className="mt-2">
              <span className={`rounded-md px-2 py-0.5 text-[11px] ${isWon ? 'lp-coral-tint lp-coral' : 'lp-tint-muted'}`}>
                {isWon ? 'Gagné' : 'Perdu'}
              </span>
            </div>
          )}

          <div className="mt-3.5 space-y-1.5">
            <Meta icon={Layers}>{stageName}</Meta>
            <Meta icon={Building2}>{cur.company?.name}</Meta>
            <Meta icon={Users}>{cur.contact ? contactName(cur.contact) : null}</Meta>
            <Meta icon={CalendarDays}>{cur.expected_close_date ? `Clôture prévue : ${DATE.format(new Date(cur.expected_close_date))}` : null}</Meta>
          </div>

          {/* Actions rapides */}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button" onClick={() => setStatus(isWon ? 'open' : 'won')} disabled={busy}
              className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium lp-tr disabled:opacity-50 ${isWon ? 'lp-ember text-white' : 'lp-railbtn lp-ink'}`}
            >
              <Award size={14} className={isWon ? '' : 'lp-coral'} /> {isWon ? 'Gagné ✓' : 'Marquer gagné'}
            </button>
            <button
              type="button" onClick={() => setStatus(isLost ? 'open' : 'lost')} disabled={busy}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium lp-railbtn lp-muted lp-tr disabled:opacity-50"
            >
              <Ban size={14} /> {isLost ? 'Perdu ✓' : 'Marquer perdu'}
            </button>
          </div>
          {stages.length > 0 && (
            <div className="mt-2">
              <select
                aria-label="Étape"
                value={cur.stage_id || ''}
                onChange={(e) => moveStage(e.target.value)}
                disabled={busy}
                className="w-full cursor-pointer rounded-xl border lp-line bg-[rgba(245,244,238,.03)] px-3 py-2 text-[13px] lp-ink outline-none lp-tr focus:border-[var(--coral)]"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id} style={{ background: 'var(--crm-sunken, #221f1b)' }}>Étape : {s.name}</option>
                ))}
              </select>
            </div>
          )}
        </header>

        {/* Corps */}
        <div className="lp-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl lp-panel animate-pulse" />)}</div>
          ) : (
            <div className="space-y-7">
              {/* Contact lié — statut plateforme + Contacter (reliure écosystème) */}
              {cur.contact && (
                <section>
                  <SectionHead icon={Users} title="Contact lié" />
                  <div className="rounded-xl border lp-line lp-panel70 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium lp-ink">{cName}</span>
                      {cBadge && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ background: cBadge.bg, color: cBadge.fg }}>
                          {cBadge.text}
                        </span>
                      )}
                    </div>
                    {cEmail && (
                      <div className="mt-1.5 truncate text-[12.5px] lp-muted">{cEmail}</div>
                    )}
                    {(cCounts.orders || cCounts.appointments || cCounts.messaging) ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12px] lp-faint">
                        {cCounts.orders > 0 && <span className="inline-flex items-center gap-1"><ShoppingBag size={12.5} className="lp-coral" />{cCounts.orders} cmd</span>}
                        {cCounts.appointments > 0 && <span className="inline-flex items-center gap-1"><CalendarCheck size={12.5} className="lp-coral" />{cCounts.appointments} RDV</span>}
                        {cCounts.messaging > 0 && <span className="inline-flex items-center gap-1"><MessagesSquare size={12.5} className="lp-coral" />{cCounts.messaging} fil{cCounts.messaging > 1 ? 's' : ''}</span>}
                      </div>
                    ) : null}
                    <div className="mt-3 flex items-center gap-2">
                      {platform?.isPlatformUser ? (
                        <button type="button" onClick={openMessage} className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-white lp-ember lp-tr">
                          <MessageSquare size={14} /> Contacter
                        </button>
                      ) : cEmail ? (
                        <button type="button" onClick={sendEmail} className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border lp-line px-3 py-2 text-[12.5px] font-medium lp-ink lp-railbtn lp-tr">
                          <Send size={14} /> Envoyer un email
                        </button>
                      ) : (
                        <span className="text-[12px] lp-faint">Contact non joignable (sans compte ni email).</span>
                      )}
                    </div>
                  </div>
                </section>
              )}

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
                    <button type="button" onClick={addNote} disabled={busy || !noteText.trim()} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-white lp-tr lp-ember disabled:opacity-45">
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
                        <button type="button" aria-label="Supprimer" onClick={() => delNote(n.id)} className="cursor-pointer opacity-0 lp-tr group-hover:opacity-100" style={{ color: 'var(--crm-accent-2, #e0a48f)' }}>
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
                    <button type="button" onClick={addTask} disabled={busy} className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] font-medium text-white lp-ember lp-tr disabled:opacity-45">OK</button>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  {tasks.map((t) => {
                    const done = t.status === 'done';
                    return (
                      <div key={t.id} className="group flex items-center gap-3 rounded-lg px-2 py-2 lp-tr hover:bg-[rgba(245,244,238,.04)]">
                        <button type="button" aria-label={done ? 'Rouvrir' : 'Terminer'} onClick={() => toggleTask(t)} className="grid h-[18px] w-[18px] shrink-0 cursor-pointer place-items-center rounded-md border lp-tr" style={done ? { background: 'var(--crm-accent, #d97757)', borderColor: 'var(--crm-accent, #d97757)' } : { borderColor: 'var(--line)' }}>
                          {done && <Check size={12} className="text-white" />}
                        </button>
                        <span className={`min-w-0 flex-1 truncate text-[13.5px] ${done ? 'lp-faint line-through' : 'lp-ink'}`}>{t.title}</span>
                        <button type="button" aria-label="Supprimer" onClick={() => delTask(t.id)} className="shrink-0 cursor-pointer opacity-0 lp-tr group-hover:opacity-100" style={{ color: 'var(--crm-accent-2, #e0a48f)' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                  {tasks.length === 0 && <p className="px-1 text-[12.5px] lp-faint">Aucune tâche.</p>}
                </div>
              </section>

              {/* Activité */}
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
                          <span className="relative z-10 mt-0.5 grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full" style={{ background: 'color-mix(in srgb, var(--crm-accent) 16%, transparent)' }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--crm-accent, #d97757)' }} />
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
