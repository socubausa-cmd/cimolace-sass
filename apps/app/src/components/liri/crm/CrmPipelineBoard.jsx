import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Building2,
  Users,
  Handshake,
  Wallet,
  Plus,
  X,
  MoreVertical,
  GripVertical,
  Trash2,
  ArrowRight,
  Award,
  Ban,
  RefreshCw,
  Inbox,
  Loader2,
} from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';
import CrmDealDetail from './CrmDealDetail';

/* ── Pipeline commercial — craft premium LIRI (fiche contact = référence).
      Portail chaud : tout coral, jamais vert/rouge. won/lost = tint coral / opacité. ── */

const ORPHAN_ID = '__orphans__';
const CURRENCIES = ['EUR', 'XAF', 'XOF', 'USD'];

const inputCls =
  'w-full rounded-xl border lp-line bg-[rgba(245,244,238,.03)] px-3.5 py-2.5 text-[14px] lp-ink outline-none placeholder:text-[var(--faint)] lp-tr focus:border-[var(--coral)]';

function Field({ label, htmlFor, children }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] lp-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function fmtMoney(amount, currency) {
  const cur = currency || 'EUR';
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `${Number(amount) || 0} ${cur}`.trim();
  }
}

function fmtPipelineValue(pv) {
  const entries = Object.entries(pv || {}).filter(
    ([, v]) => typeof v === 'number' && !Number.isNaN(v),
  );
  if (!entries.length) return '0 €';
  return entries.map(([cur, val]) => fmtMoney(val, cur)).join(' · ');
}

function columnTotalsLabel(deals) {
  const map = {};
  (deals || []).forEach((d) => {
    const c = d.currency || 'EUR';
    map[c] = (map[c] || 0) + (Number(d.amount) || 0);
  });
  const entries = Object.entries(map).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  return entries.map(([c, v]) => fmtMoney(v, c)).join(' · ');
}

function contactName(c) {
  if (!c) return '';
  const n = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return n || c.email || 'Contact';
}

function buildColumns(board) {
  if (!board) return [];
  const stages = [...(board.stages || [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const cols = stages.map((s) => ({
    id: s.id,
    stageId: s.id,
    name: s.name,
    isWon: !!s.is_won,
    isLost: !!s.is_lost,
    deals: [...(s.deals || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  }));
  if ((board.orphans || []).length) {
    cols.unshift({
      id: ORPHAN_ID,
      stageId: null,
      name: 'Sans étape',
      isWon: false,
      isLost: false,
      deals: [...board.orphans],
    });
  }
  return cols;
}

/* ── Menu contextuel de carte — rendu en PORTAIL (fixed) pour échapper au clipping
      des colonnes overflow-y-auto ; ferme sur Échap / clic extérieur / scroll ──────── */

function CardMenu({ anchorRect, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [onClose]);

  if (!anchorRect) return null;
  // Ancrage : sous le bouton, aligné à droite ; on borne pour ne pas sortir de l'écran.
  const width = 224;
  const left = Math.max(8, Math.min(anchorRect.right - width, window.innerWidth - width - 8));
  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 16);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        className="fixed z-[61] w-56 overflow-hidden rounded-xl border lp-line py-1 shadow-xl"
        style={{ top, left, background: '#221f1b' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

/* ── Carte deal ───────────────────────────────────────────────────────────── */

function DealCard({ deal, stages, onAction, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id });
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const btnRef = useRef(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const isWon = deal.status === 'won';
  const isLost = deal.status === 'lost';
  const otherStages = (stages || []).filter((s) => s.id !== deal.stage_id);

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    setAnchorRect(r ? { right: r.right, bottom: r.bottom } : null);
    setMenuOpen(true);
  };
  const close = () => setMenuOpen(false);
  const act = (action, payload) => {
    close();
    onAction(deal.id, action, payload);
  };

  const itemCls =
    'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[13px] lp-railbtn lp-tr';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-2xl border lp-line lp-panel70 p-3.5 lp-tr hover:bg-[rgba(245,244,238,.04)] ${
        isWon || isLost ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Déplacer le deal"
          className="mt-0.5 shrink-0 cursor-grab touch-none rounded-md p-0.5 lp-faint lp-tr active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>

        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpen?.(deal)}>
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-[13.5px] font-semibold leading-snug lp-ink">
              {deal.title || 'Sans titre'}
            </p>
            <button
              ref={btnRef}
              type="button"
              aria-label="Actions du deal"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => { e.stopPropagation(); menuOpen ? close() : openMenu(); }}
              className={`grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn lp-tr ${
                menuOpen ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'
              }`}
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && (
              <CardMenu anchorRect={anchorRect} onClose={close}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => act('won')}
                  className={`${itemCls} lp-ink`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md lp-coral-tint">
                    <Award size={13} className="lp-coral" />
                  </span>
                  Marquer gagné
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => act('lost')}
                  className={`${itemCls} lp-muted`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md lp-tint-muted">
                    <Ban size={13} className="lp-muted" />
                  </span>
                  Marquer perdu
                </button>

                {otherStages.length > 0 && (
                  <div className="my-1 border-t lp-line pt-1">
                    <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[.08em] lp-faint">
                      Déplacer vers
                    </p>
                    <div className="max-h-40 overflow-y-auto">
                      {otherStages.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          role="menuitem"
                          onClick={() => act('move', { stage_id: s.id })}
                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] lp-muted lp-railbtn lp-tr"
                        >
                          <ArrowRight size={13} className="shrink-0 lp-faint" />
                          <span className="truncate">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="my-1 border-t lp-line pt-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => act('delete')}
                    className={itemCls}
                    style={{ color: '#e0a48f' }}
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                </div>
              </CardMenu>
            )}
          </div>

          <div className="mt-1.5 text-[15px] font-semibold lp-coral tabular-nums">
            {fmtMoney(deal.amount, deal.currency)}
          </div>

          {(deal.company?.name || deal.contact) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] lp-muted">
              {deal.company?.name && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Building2 size={12} className="shrink-0 lp-faint" />
                  <span className="truncate">{deal.company.name}</span>
                </span>
              )}
              {deal.contact && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Users size={12} className="shrink-0 lp-faint" />
                  <span className="truncate">{contactName(deal.contact)}</span>
                </span>
              )}
            </div>
          )}

          {(isWon || isLost) && (
            <div className="mt-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  isWon ? 'lp-coral-tint lp-coral' : 'lp-tint-muted lp-muted'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: 'currentColor', opacity: isWon ? 1 : 0.55 }}
                />
                {isWon ? 'Gagné' : 'Perdu'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Colonne (stage) ──────────────────────────────────────────────────────── */

function BoardColumn({ column, stages, onAction, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const total = columnTotalsLabel(column.deals);
  const dealIds = column.deals.map((d) => d.id);

  return (
    <div className="flex min-w-[280px] max-w-[300px] flex-shrink-0 flex-col rounded-2xl lp-panel lp-line border">
      <div className="border-b lp-line px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {(column.isWon || column.isLost) && (
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md lp-coral-tint">
                {column.isWon ? (
                  <Award size={12} className="lp-coral" />
                ) : (
                  <Ban size={12} className="lp-muted" />
                )}
              </span>
            )}
            <h3 className="truncate text-[12px] font-semibold uppercase tracking-[.08em] lp-muted">
              {column.name}
            </h3>
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
            style={{ background: 'rgba(217,119,87,.13)', color: '#e08a63' }}
          >
            {column.deals.length}
          </span>
        </div>
        {total && <div className="mt-1.5 text-[12px] lp-faint tabular-nums">{total}</div>}
      </div>

      <div
        ref={setNodeRef}
        className={`lp-scroll flex-1 space-y-2.5 overflow-y-auto p-2.5 lp-tr ${
          isOver ? 'lp-coral-tint' : ''
        }`}
        style={{ minHeight: 120 }}
      >
        <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
          {column.deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} stages={stages} onAction={onAction} onOpen={onOpen} />
          ))}
        </SortableContext>
        {column.deals.length === 0 && (
          <div className="grid place-items-center gap-2 rounded-xl border border-dashed lp-line py-8 text-center">
            <span className="grid h-8 w-8 place-items-center rounded-xl lp-coral-tint">
              <Inbox size={15} className="lp-coral" />
            </span>
            <span className="text-[12px] lp-faint">Déposez un deal ici</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Modale nouveau deal ──────────────────────────────────────────────────── */

function NewDealModal({ stages, onClose, onCreated }) {
  const { toast } = useToast();
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    amount: '',
    currency: 'EUR',
    stage_id: stages[0]?.id || '',
    company_id: '',
    contact_id: '',
    expected_close_date: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cs, ct] = await Promise.all([
          crmApi.listCompanies({ limit: 200 }),
          crmApi.listContacts({ limit: '200' }),
        ]);
        if (!alive) return;
        setCompanies(Array.isArray(cs) ? cs : []);
        setContacts(Array.isArray(ct) ? ct : []);
      } catch (e) {
        if (alive) toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [toast]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: 'CRM', description: 'Le titre est requis.', variant: 'destructive' });
      return;
    }
    if (!form.stage_id) {
      toast({ title: 'CRM', description: 'Choisissez une étape.', variant: 'destructive' });
      return;
    }
    const body = {
      title: form.title.trim(),
      currency: form.currency,
      stage_id: form.stage_id,
    };
    if (form.amount !== '') body.amount = Number(form.amount);
    if (form.company_id) body.company_id = form.company_id;
    if (form.contact_id) body.contact_id = form.contact_id;
    if (form.expected_close_date) body.expected_close_date = form.expected_close_date;

    setSubmitting(true);
    try {
      await crmApi.createDeal(body);
      toast({ title: 'CRM', description: 'Deal créé.' });
      onCreated();
    } catch (err) {
      toast({ title: 'CRM', description: String(err?.message || err), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(15,12,10,.55)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nouveau deal"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border lp-line p-5 shadow-2xl sm:rounded-3xl"
        style={{ background: '#221f1b' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white"
              style={{ background: 'linear-gradient(140deg,#d97757,#c2683f)' }}
            >
              <Handshake size={18} />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold leading-tight lp-ink">Nouveau deal</h2>
              <p className="text-[12.5px] lp-muted">Ajoutez une opportunité au pipeline.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn lp-tr"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3.5">
          <Field label="Titre" htmlFor="deal-title">
            <input
              id="deal-title"
              autoFocus
              className={inputCls}
              value={form.title}
              onChange={set('title')}
              placeholder="Ex. Abonnement START — Zahir Wellness"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant" htmlFor="deal-amount">
              <input
                id="deal-amount"
                type="number"
                min="0"
                step="1"
                className={`${inputCls} tabular-nums`}
                value={form.amount}
                onChange={set('amount')}
                placeholder="0"
              />
            </Field>
            <Field label="Devise" htmlFor="deal-currency">
              <select
                id="deal-currency"
                className={`${inputCls} cursor-pointer`}
                value={form.currency}
                onChange={set('currency')}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} style={{ background: '#221f1b' }}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Étape" htmlFor="deal-stage">
            <select
              id="deal-stage"
              className={`${inputCls} cursor-pointer`}
              value={form.stage_id}
              onChange={set('stage_id')}
              required
            >
              {stages.length === 0 && (
                <option value="" style={{ background: '#221f1b' }}>
                  Aucune étape disponible
                </option>
              )}
              {stages.map((s) => (
                <option key={s.id} value={s.id} style={{ background: '#221f1b' }}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Société" htmlFor="deal-company">
              <select
                id="deal-company"
                className={`${inputCls} cursor-pointer`}
                value={form.company_id}
                onChange={set('company_id')}
              >
                <option value="" style={{ background: '#221f1b' }}>
                  — Aucune —
                </option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: '#221f1b' }}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contact" htmlFor="deal-contact">
              <select
                id="deal-contact"
                className={`${inputCls} cursor-pointer`}
                value={form.contact_id}
                onChange={set('contact_id')}
              >
                <option value="" style={{ background: '#221f1b' }}>
                  — Aucun —
                </option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: '#221f1b' }}>
                    {contactName(c)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Clôture prévue" htmlFor="deal-close">
            <input
              id="deal-close"
              type="date"
              className={inputCls}
              value={form.expected_close_date}
              onChange={set('expected_close_date')}
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl px-4 py-2 text-[13.5px] font-medium lp-muted lp-railbtn lp-tr"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember disabled:opacity-60"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Créer le deal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Modale de confirmation de suppression (thématisée, cohérente Contacts/Sociétés) ── */

function ConfirmDeleteModal({ title, message, busy, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(15,12,10,.55)' }}
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-t-3xl border lp-line p-5 shadow-2xl sm:rounded-3xl"
        style={{ background: '#221f1b' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl lp-coral-tint">
            <Trash2 size={17} className="lp-coral" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold lp-ink">{title}</h2>
            <p className="mt-1 text-[13.5px] lp-muted">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="cursor-pointer rounded-xl px-4 py-2 text-[13.5px] font-medium lp-muted lp-railbtn lp-tr disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr disabled:opacity-60"
            style={{ background: '#c2683f' }}
          >
            {busy && <Loader2 size={15} className="animate-spin" />} Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Cartes résumé ────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border lp-line lp-panel70 p-4 lp-tr hover:bg-[rgba(245,244,238,.04)]">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl lp-coral-tint">
          <Icon size={15} className="lp-coral" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[.09em] lp-muted">
          {label}
        </span>
      </div>
      <div className="mt-3 truncate text-[21px] font-semibold leading-none lp-ink tabular-nums">
        {value}
      </div>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

function BoardSkeleton() {
  return (
    <div className="lp-rise space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[92px] rounded-2xl lp-panel animate-pulse" />
        ))}
      </div>
      <div className="flex gap-4 overflow-x-auto">
        {[0, 1, 2].map((i) => (
          <div key={i} className="min-w-[280px] flex-shrink-0 space-y-2.5">
            <div className="h-11 rounded-2xl lp-panel animate-pulse" />
            <div className="h-24 rounded-2xl lp-panel animate-pulse" />
            <div className="h-24 rounded-2xl lp-panel animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Composant principal ──────────────────────────────────────────────────── */

export default function CrmPipelineBoard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detailDeal, setDetailDeal] = useState(null);
  const reqRef = useRef(0);
  const columnsRef = useRef(columns);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    const rid = ++reqRef.current;
    try {
      const [sum, brd] = await Promise.all([crmApi.summary(), crmApi.dealsBoard()]);
      if (rid !== reqRef.current) return;
      setSummary(sum || null);
      setBoard(brd || null);
      setColumns(buildColumns(brd));
      setError(null);
    } catch (e) {
      if (rid !== reqRef.current) return;
      setError(e?.message || String(e));
      toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      if (rid === reqRef.current) setLoading(false);
    }
  }, [toast]);

  const refetchBoard = useCallback(async () => {
    try {
      const [sum, brd] = await Promise.all([crmApi.summary(), crmApi.dealsBoard()]);
      setSummary(sum || null);
      setBoard(brd || null);
      setColumns(buildColumns(brd));
    } catch (e) {
      toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const stagesForModal = useMemo(
    () => [...(board?.stages || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [board],
  );
  const wonStage = useMemo(() => (board?.stages || []).find((s) => s.is_won), [board]);
  const lostStage = useMemo(() => (board?.stages || []).find((s) => s.is_lost), [board]);

  // Persistance des positions/mutations hors de l'updater setState (pureté React).
  const persistDrag = useCallback(
    async (patches) => {
      try {
        await Promise.all(patches.map((p) => crmApi.updateDeal(p.id, p.patch)));
      } catch (e) {
        toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });
        refetchBoard();
      }
    },
    [toast, refetchBoard],
  );

  const onDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over) return;
      const activeId = active.id;
      const overId = over.id;

      const prev = columnsRef.current;
      const sourceColIdx = prev.findIndex((c) => c.deals.some((d) => d.id === activeId));
      if (sourceColIdx === -1) return;

      let targetColIdx = prev.findIndex((c) => c.id === overId);
      let overIsCard = false;
      if (targetColIdx === -1) {
        targetColIdx = prev.findIndex((c) => c.deals.some((d) => d.id === overId));
        overIsCard = true;
      }
      if (targetColIdx === -1) return;

      const next = prev.map((c) => ({ ...c, deals: [...c.deals] }));
      const patches = [];

      if (sourceColIdx === targetColIdx) {
        // ── Réordonnancement intra-colonne : sémantique arrayMove (fix off-by-one) ──
        const arr = next[sourceColIdx].deals;
        const oldIndex = arr.findIndex((d) => d.id === activeId);
        let newIndex = overIsCard ? arr.findIndex((d) => d.id === overId) : arr.length - 1;
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const reordered = arrayMove(arr, oldIndex, newIndex);
        next[sourceColIdx].deals = reordered;
        reordered.forEach((d, i) => patches.push({ id: d.id, patch: { position: i } }));
      } else {
        // ── Déplacement inter-colonnes : stage_id + status dérivé de la colonne cible ──
        if (activeId === overId) return;
        const fromDeals = next[sourceColIdx].deals;
        const movedIdx = fromDeals.findIndex((d) => d.id === activeId);
        if (movedIdx === -1) return;
        const [moved] = fromDeals.splice(movedIdx, 1);

        const targetCol = next[targetColIdx];
        const toDeals = targetCol.deals;
        let insertIdx = overIsCard ? toDeals.findIndex((d) => d.id === overId) : toDeals.length;
        if (insertIdx === -1) insertIdx = toDeals.length;

        // HIGH FIX : le statut suit la colonne (Gagné→won, Perdu→lost, sinon open).
        const newStatus = targetCol.isWon ? 'won' : targetCol.isLost ? 'lost' : 'open';
        const movedUpdated = { ...moved, stage_id: targetCol.stageId, status: newStatus };
        toDeals.splice(insertIdx, 0, movedUpdated);

        fromDeals.forEach((d, i) => patches.push({ id: d.id, patch: { position: i } }));
        toDeals.forEach((d, i) => {
          if (d.id === activeId) {
            patches.push({
              id: d.id,
              patch: { stage_id: targetCol.stageId, status: newStatus, position: i },
            });
          } else {
            patches.push({ id: d.id, patch: { position: i } });
          }
        });
      }

      setColumns(next);
      if (patches.length) persistDrag(patches);
    },
    [persistDrag],
  );

  const findDeal = useCallback((dealId) => {
    for (const c of columnsRef.current) {
      const d = c.deals.find((x) => x.id === dealId);
      if (d) return d;
    }
    return null;
  }, []);

  const handleAction = useCallback(
    async (dealId, action, payload) => {
      if (action === 'delete') {
        setPendingDelete(findDeal(dealId) || { id: dealId, title: '' });
        return;
      }
      try {
        if (action === 'won') {
          // HIGH FIX : « Marquer gagné » déplace aussi vers l'étape Gagné (statut ↔ étape).
          await crmApi.updateDeal(dealId, {
            status: 'won',
            ...(wonStage ? { stage_id: wonStage.id } : {}),
          });
        } else if (action === 'lost') {
          await crmApi.updateDeal(dealId, {
            status: 'lost',
            ...(lostStage ? { stage_id: lostStage.id } : {}),
          });
        } else if (action === 'move') {
          await crmApi.updateDeal(dealId, { stage_id: payload.stage_id });
        }
        toast({ title: 'CRM', description: 'Deal mis à jour.' });
        await refetchBoard();
      } catch (e) {
        toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });
      }
    },
    [toast, refetchBoard, findDeal, wonStage, lostStage],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await crmApi.deleteDeal(pendingDelete.id);
      toast({ title: 'CRM', description: 'Deal supprimé.' });
      await refetchBoard();
      setPendingDelete(null);
    } catch (e) {
      toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, toast, refetchBoard]);

  const pipelineValue = fmtPipelineValue(summary?.pipelineValue);
  const isEmpty = !loading && !error && columns.length === 0;

  if (loading) return <BoardSkeleton />;

  return (
    <div className="lp-rise space-y-5">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
            style={{ background: 'linear-gradient(140deg,#d97757,#c2683f)' }}
          >
            <Handshake size={19} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold leading-tight lp-ink">Pipeline commercial</h2>
            <p className="truncate text-[13px] lp-muted">
              {board?.pipeline?.name
                ? board.pipeline.name
                : 'Suivez vos opportunités du premier contact à la signature.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Rafraîchir"
            onClick={load}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl lp-muted lp-railbtn lp-tr"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember disabled:opacity-60"
          >
            <Plus size={16} /> Nouveau deal
          </button>
        </div>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Building2} label="Sociétés" value={summary?.companies ?? 0} />
        <StatCard icon={Users} label="Contacts" value={summary?.contacts ?? 0} />
        <StatCard icon={Handshake} label="Deals ouverts" value={summary?.openDeals ?? 0} />
        <StatCard icon={Wallet} label="Valeur du pipeline" value={pipelineValue} />
      </div>

      {/* Erreur */}
      {error && (
        <div className="rounded-2xl border lp-line lp-panel70 px-6 py-10 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl lp-coral-tint">
            <RefreshCw size={19} className="lp-coral" />
          </div>
          <p className="mx-auto mt-3 max-w-sm text-[13.5px] lp-muted">
            Impossible de charger le pipeline pour le moment.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember"
          >
            <RefreshCw size={15} /> Réessayer
          </button>
        </div>
      )}

      {/* État vide */}
      {isEmpty && (
        <div className="rounded-2xl border border-dashed lp-line lp-panel70 px-6 py-14 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl lp-coral-tint">
            <Inbox size={22} className="lp-coral" />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold lp-ink">Aucune étape pour l’instant</h3>
          <p className="mx-auto mt-1 max-w-sm text-[13px] lp-muted">
            Votre pipeline est prêt. Créez votre premier deal pour commencer à suivre vos
            opportunités.
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember"
          >
            <Plus size={16} /> Nouveau deal
          </button>
        </div>
      )}

      {/* Board Kanban */}
      {!error && !isEmpty && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="lp-scroll flex gap-4 overflow-x-auto pb-2">
            {columns.map((col) => (
              <BoardColumn key={col.id} column={col} stages={stagesForModal} onAction={handleAction} onOpen={setDetailDeal} />
            ))}
          </div>
        </DndContext>
      )}

      {showCreate && (
        <NewDealModal
          stages={stagesForModal}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await load();
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          title="Supprimer le deal"
          message={`Supprimer définitivement « ${pendingDelete.title || 'ce deal'} » ? Cette action est irréversible.`}
          busy={deleting}
          onCancel={() => (deleting ? null : setPendingDelete(null))}
          onConfirm={confirmDelete}
        />
      )}

      {detailDeal && (
        <CrmDealDetail
          deal={detailDeal}
          stages={stagesForModal}
          onClose={() => setDetailDeal(null)}
          onChanged={refetchBoard}
        />
      )}
    </div>
  );
}
