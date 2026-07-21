import { useMemo, useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Trash2, Loader2, X, Send, Check, Ban,
  MoreHorizontal, AlertTriangle, ReceiptText,
} from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { mboloApi } from '@/lib/api';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Montant stocké en CENTIMES → affiché dans sa devise (défaut XAF). */
function money(cents: number, currency = 'XAF') {
  const n = Number.isFinite(cents) ? cents : 0;
  return `${(n / 100).toLocaleString('fr-FR')} ${currency || 'XAF'}`;
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Lecture défensive : l'API renvoie des lignes `any` (snake ou camelCase). */
function invNumber(r: any): string {
  return r?.invoice_number ?? r?.number ?? r?.reference ?? (r?.id ? `#${String(r.id).slice(0, 8)}` : '—');
}
function invCustomer(r: any): string {
  return r?.customer_name ?? r?.customerName ?? r?.customer?.name ?? r?.client_name ?? '—';
}
function invTotalCents(r: any): number {
  return Number(r?.total_cents ?? r?.totalCents ?? r?.amount_cents ?? r?.amountCents ?? 0) || 0;
}
function invCurrency(r: any): string {
  return r?.currency ?? r?.customer_currency ?? 'XAF';
}
function invStatus(r: any): string {
  return String(r?.status ?? 'draft').toLowerCase();
}
function invDate(r: any): unknown {
  return r?.created_at ?? r?.createdAt ?? r?.issued_at ?? r?.issuedAt ?? r?.date ?? null;
}

type StatusMeta = { label: string; bg: string; fg: string; border: string };
const STATUS: Record<string, StatusMeta> = {
  draft:   { label: 'Brouillon', bg: 'rgba(245,244,238,.06)', fg: '#b0ada3', border: 'rgba(245,244,238,.12)' },
  sent:    { label: 'Envoyée',   bg: 'rgba(217,119,87,.14)', fg: '#e8b6a3', border: 'rgba(217,119,87,.34)' },
  paid:    { label: 'Payée',     bg: 'rgba(122,155,108,.16)', fg: '#9fbf8f', border: 'rgba(122,155,108,.34)' },
  overdue: { label: 'En retard', bg: 'rgba(226,85,63,.12)',  fg: '#ef6a52', border: 'rgba(226,85,63,.30)' },
  void:    { label: 'Annulée',   bg: 'rgba(245,244,238,.04)', fg: '#82807a', border: 'rgba(245,244,238,.10)' },
};
function statusMeta(s: string): StatusMeta {
  return STATUS[s] ?? { label: s || '—', bg: 'rgba(245,244,238,.06)', fg: '#b0ada3', border: 'rgba(245,244,238,.12)' };
}

const CURRENCIES = ['XAF', 'XOF', 'EUR', 'USD'];

type LineDraft = { description: string; quantity: string; unitPrice: string };
const EMPTY_LINE: LineDraft = { description: '', quantity: '1', unitPrice: '' };
const EMPTY_FORM = {
  customerName: '',
  customerEmail: '',
  currency: 'XAF',
  notes: '',
  lines: [{ ...EMPTY_LINE }] as LineDraft[],
};

/** Centimes d'une ligne (saisie en unités → *100). */
function lineCents(l: LineDraft) {
  const qty = parseFloat(l.quantity);
  const quantity = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const up = parseFloat(l.unitPrice);
  const unitCents = Number.isFinite(up) && up >= 0 ? Math.round(up * 100) : 0;
  return { quantity, unitCents, totalCents: Math.round(quantity * unitCents) };
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export function MboloFacturesPage() {
  const qc = useQueryClient();
  const invoices = useQuery({ queryKey: ['mbolo-invoices'], queryFn: () => mboloApi.listInvoices() });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, lines: [{ ...EMPTY_LINE }] });
  const [error, setError] = useState('');

  const list: any[] = Array.isArray(invoices.data) ? invoices.data : [];

  const summary = useMemo(() => {
    let total = 0, paid = 0, pending = 0, currency = 'XAF';
    for (const r of list) {
      const c = invTotalCents(r);
      const s = invStatus(r);
      if (list.length) currency = invCurrency(r);
      if (s === 'void') continue;
      total += c;
      if (s === 'paid') paid += c;
      else pending += c;
    }
    return { total, paid, pending, currency, count: list.length };
  }, [list]);

  const grandTotalCents = useMemo(
    () => form.lines.reduce((s, l) => s + lineCents(l).totalCents, 0),
    [form.lines],
  );

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => mboloApi.createInvoice(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mbolo-invoices'] });
      setShowForm(false);
      setForm({ ...EMPTY_FORM, lines: [{ ...EMPTY_LINE }] });
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  function setLine(i: number, patch: Partial<LineDraft>) {
    setForm((f) => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  }
  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }));
  }
  function removeLine(i: number) {
    setForm((f) => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((_, idx) => idx !== i) : f.lines }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.customerName.trim()) {
      setError('Le nom du client est obligatoire.');
      return;
    }
    const lines = form.lines
      .map((l) => {
        const c = lineCents(l);
        return { description: l.description.trim(), quantity: c.quantity, unitCents: c.unitCents, totalCents: c.totalCents };
      })
      .filter((l) => l.description || l.unitCents > 0);
    if (!lines.length) {
      setError('Ajoutez au moins une ligne avec un libellé et un prix.');
      return;
    }
    const totalCents = lines.reduce((s, l) => s + l.totalCents, 0);
    const body: Record<string, unknown> = {
      customerName: form.customerName.trim(),
      currency: form.currency || 'XAF',
      lines,
      totalCents,
    };
    if (form.customerEmail.trim()) body.customerEmail = form.customerEmail.trim();
    if (form.notes.trim()) body.notes = form.notes.trim();
    createMut.mutate(body);
  }

  return (
    <LiriPortalShell active="factures">
      <div className="lp-root relative flex h-full w-full flex-col items-center overflow-y-auto">
        <div className="lp-glow"><span style={{ width: 480, height: 360, left: '20%', top: -150, background: 'rgba(217,119,87,.07)' }} /></div>

        <div className="relative z-10 w-full max-w-4xl px-4 py-6 sm:px-6">
          {/* en-tête de section (le chrome LIRI est fourni par LiriPortalShell) */}
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="lp-serif flex items-center gap-2 text-[22px] font-medium leading-tight lp-ink">
                <FileText size={20} className="lp-coral" /> Factures
              </h1>
              <p className="text-[12.5px] lp-faint">Émettez et suivez les factures de votre boutique mbolo — brouillon, envoi, paiement.</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowForm((v) => !v); setError(''); }}
              className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-white lp-ember lp-tr"
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? 'Fermer' : 'Nouvelle facture'}
            </button>
          </div>

          {/* résumé */}
          {summary.count > 0 && (
            <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <StatCard label="Total facturé" value={money(summary.total, summary.currency)} />
              <StatCard label="Encaissé" value={money(summary.paid, summary.currency)} tone="green" />
              <StatCard label="En attente" value={money(summary.pending, summary.currency)} tone="coral" />
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px]" style={{ borderColor: 'rgba(226,85,63,.30)', background: 'rgba(226,85,63,.08)', color: '#ef6a52' }}>
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          {/* Formulaire de création */}
          {showForm && (
            <form onSubmit={submit} className="mb-6 rounded-2xl border p-5 lp-soft" style={{ borderColor: 'rgba(255,255,255,.08)', background: 'var(--panel)' }}>
              <h3 className="mb-4 text-[15px] font-semibold lp-ink">Nouvelle facture</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nom du client *">
                  <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Ex. SARL Kembo" className={inputCls} />
                </Field>
                <Field label="Email du client">
                  <input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} placeholder="client@exemple.com" className={inputCls} />
                </Field>
                <Field label="Devise">
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputCls}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              {/* Lignes dynamiques */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] lp-faint">Lignes</span>
                  <button type="button" onClick={addLine} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium lp-muted lp-railbtn lp-tr" style={{ borderColor: 'rgba(255,255,255,.10)' }}>
                    <Plus size={13} /> Ajouter une ligne
                  </button>
                </div>

                <div className="space-y-2">
                  {/* en-têtes (desktop) */}
                  <div className="hidden grid-cols-[1fr_72px_110px_120px_32px] gap-2 px-1 text-[10.5px] font-semibold uppercase tracking-wide lp-faint sm:grid">
                    <span>Description</span><span className="text-right">Qté</span><span className="text-right">Prix unit.</span><span className="text-right">Total</span><span />
                  </div>
                  {form.lines.map((l, i) => {
                    const c = lineCents(l);
                    return (
                      <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_72px_110px_120px_32px] sm:items-center sm:border-0 sm:p-0" style={{ borderColor: 'rgba(255,255,255,.07)' }}>
                        <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Prestation / produit" className={`${inputCls} col-span-2 sm:col-span-1`} />
                        <input value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} type="number" min="0" step="1" placeholder="Qté" className={`${inputCls} text-right`} />
                        <input value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} type="number" min="0" step="0.01" placeholder="Prix" className={`${inputCls} text-right`} />
                        <div className="flex items-center justify-end px-1 text-[13px] font-medium tabular-nums lp-ink">{money(c.totalCents, form.currency)}</div>
                        <button type="button" onClick={() => removeLine(i)} disabled={form.lines.length <= 1} className="grid h-8 w-8 place-items-center justify-self-end rounded-lg lp-faint lp-railbtn lp-tr disabled:opacity-30" aria-label="Supprimer la ligne">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-end gap-3 border-t pt-3 lp-line">
                  <span className="text-[12.5px] lp-faint">Total</span>
                  <span className="text-[17px] font-semibold tabular-nums lp-ink">{money(grandTotalCents, form.currency)}</span>
                </div>
              </div>

              <div className="mt-4">
                <Field label="Notes (facultatif)">
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Conditions de paiement, remerciements…" className={`${inputCls} resize-none`} />
                </Field>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="h-10 rounded-xl border px-4 text-[13.5px] font-medium lp-muted lp-railbtn lp-tr" style={{ borderColor: 'rgba(255,255,255,.10)' }}>Annuler</button>
                <button type="submit" disabled={createMut.isPending} className="flex h-10 items-center gap-2 rounded-xl px-5 text-[13.5px] font-semibold text-white lp-ember lp-tr disabled:opacity-60">
                  {createMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Création…</> : <>Créer la facture</>}
                </button>
              </div>
            </form>
          )}

          {/* Liste */}
          {invoices.isLoading && (
            <div className="flex items-center gap-2 rounded-2xl border p-6 text-[13px] lp-muted" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
              <Loader2 size={16} className="animate-spin lp-coral" /> Chargement des factures…
            </div>
          )}

          {invoices.isError && (
            <div className="flex items-center gap-2 rounded-2xl border px-4 py-6 text-[13px]" style={{ borderColor: 'rgba(226,85,63,.30)', background: 'rgba(226,85,63,.06)', color: '#ef6a52' }}>
              <AlertTriangle size={16} /> {(invoices.error as Error)?.message || 'Impossible de charger les factures.'}
            </div>
          )}

          {invoices.data && list.length === 0 && !showForm && (
            <div className="rounded-2xl border border-dashed px-6 py-14 text-center" style={{ borderColor: 'rgba(255,255,255,.14)' }}>
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl lp-coral-tint"><ReceiptText size={22} className="lp-coral" /></div>
              <h3 className="text-[15px] font-semibold lp-ink">Aucune facture</h3>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] lp-faint">Créez votre première facture pour la partager avec un client et suivre son paiement.</p>
              <button type="button" onClick={() => { setShowForm(true); setError(''); }} className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-white lp-ember lp-tr">
                <Plus size={16} /> Nouvelle facture
              </button>
            </div>
          )}

          {list.length > 0 && (
            <div className="overflow-hidden rounded-2xl border lp-soft" style={{ borderColor: 'rgba(255,255,255,.08)', background: 'var(--panel)' }}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left">
                  <thead>
                    <tr className="border-b lp-line text-[10.5px] font-semibold uppercase tracking-wide lp-faint">
                      <th className="px-4 py-3 font-semibold">Numéro</th>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 text-right font-semibold">Montant</th>
                      <th className="px-4 py-3 font-semibold">Statut</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => {
                      const meta = statusMeta(invStatus(r));
                      return (
                        <tr key={r.id ?? invNumber(r)} className="border-b lp-line last:border-0 lp-tr hover:bg-[rgba(255,255,255,.02)]">
                          <td className="px-4 py-3 text-[13px] font-medium lp-ink">{invNumber(r)}</td>
                          <td className="px-4 py-3 text-[13px] lp-muted">{invCustomer(r)}</td>
                          <td className="px-4 py-3 text-right text-[13px] font-medium tabular-nums lp-ink">{money(invTotalCents(r), invCurrency(r))}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium" style={{ background: meta.bg, color: meta.fg, borderColor: meta.border }}>{meta.label}</span>
                          </td>
                          <td className="px-4 py-3 text-[12.5px] lp-faint">{fmtDate(invDate(r))}</td>
                          <td className="px-4 py-3 text-right"><RowActions invoice={r} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </LiriPortalShell>
  );
}

/* ── Sous-composants ─────────────────────────────────────────────────────── */

const inputCls =
  'w-full rounded-xl border border-[rgba(255,255,255,.10)] bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(217,119,87,.55)] lp-tr';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium lp-faint">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'coral' }) {
  const color = tone === 'green' ? '#9fbf8f' : tone === 'coral' ? 'var(--coral)' : 'var(--ink)';
  return (
    <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: 'rgba(255,255,255,.08)', background: 'var(--panel)' }}>
      <p className="text-[11px] font-medium uppercase tracking-wide lp-faint">{label}</p>
      <p className="mt-1 text-[17px] font-semibold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

/** Menu d'actions par facture : changement de statut + suppression. */
function RowActions({ invoice }: { invoice: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const status = invStatus(invoice);
  const id = invoice?.id as string | undefined;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setConfirmDel(false); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['mbolo-invoices'] });

  const updateMut = useMutation({
    mutationFn: (next: string) => mboloApi.updateInvoice(id as string, { status: next }),
    onSuccess: () => { invalidate(); setOpen(false); },
  });
  const deleteMut = useMutation({
    mutationFn: () => mboloApi.deleteInvoice(id as string),
    onSuccess: () => { invalidate(); setOpen(false); setConfirmDel(false); },
  });

  const busy = updateMut.isPending || deleteMut.isPending;

  const transitions: { label: string; to: string; icon: typeof Send }[] = [];
  if (status !== 'sent' && status !== 'paid' && status !== 'void') transitions.push({ label: 'Marquer envoyée', to: 'sent', icon: Send });
  if (status !== 'paid' && status !== 'void') transitions.push({ label: 'Marquer payée', to: 'paid', icon: Check });
  if (status !== 'void' && status !== 'paid') transitions.push({ label: 'Annuler la facture', to: 'void', icon: Ban });

  if (!id) return null;

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setConfirmDel(false); }}
        disabled={busy}
        className="grid h-8 w-8 place-items-center rounded-lg lp-muted lp-railbtn lp-tr disabled:opacity-50"
        aria-label="Actions"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <MoreHorizontal size={16} />}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[210px] overflow-hidden rounded-xl border py-1 lp-soft" style={{ borderColor: 'rgba(255,255,255,.10)', background: '#221f1b' }}>
          {transitions.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.to} onClick={() => updateMut.mutate(t.to)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] lp-muted lp-tr hover:bg-[rgba(255,255,255,.05)] hover:text-white">
                <Icon size={15} className="lp-faint" /> {t.label}
              </button>
            );
          })}
          {transitions.length > 0 && <div className="my-1 h-px" style={{ background: 'rgba(255,255,255,.08)' }} />}
          {confirmDel ? (
            <div className="px-3.5 py-2">
              <p className="mb-2 text-[12px] lp-faint">Supprimer cette facture ?</p>
              <div className="flex gap-2">
                <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold text-white lp-tr disabled:opacity-60" style={{ background: 'linear-gradient(90deg,#e2553f,#c2402f)' }}>
                  {deleteMut.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Supprimer'}
                </button>
                <button onClick={() => setConfirmDel(false)} className="h-8 flex-1 rounded-lg border text-[12.5px] font-medium lp-muted lp-railbtn lp-tr" style={{ borderColor: 'rgba(255,255,255,.12)' }}>Non</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] lp-tr hover:bg-[rgba(226,85,63,.10)]" style={{ color: '#ef6a52' }}>
              <Trash2 size={15} /> Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MboloFacturesPage;
