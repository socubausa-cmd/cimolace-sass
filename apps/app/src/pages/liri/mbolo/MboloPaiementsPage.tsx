import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link2,
  Plus,
  X,
  Copy,
  Check,
  Ban,
  Trash2,
  Loader2,
  CreditCard,
  Mail,
  User,
  CalendarDays,
  Inbox,
} from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { mboloApi } from '@/lib/api';

/** Affiche un montant stocké en CENTIMES dans sa devise (défaut XAF). */
function money(cents: unknown, currency = 'XAF') {
  const n = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return `${(n / 100).toLocaleString('fr-FR')} ${currency || 'XAF'}`;
}

function fmtDate(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** URL publique du lien : `pay_path` fourni par l'API, sinon `/pay/<token>`. */
function publicUrl(row: any): string {
  const path: string = row?.pay_path || (row?.token ? `/pay/${row.token}` : '');
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${path}`;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active: { label: 'Actif', color: '#e2855f', bg: 'rgba(217,119,87,.12)', border: 'rgba(217,119,87,.3)' },
  paid: { label: 'Payé', color: '#7fbf7f', bg: 'rgba(109,143,96,.15)', border: 'rgba(109,143,96,.35)' },
  expired: { label: 'Expiré', color: 'var(--faint)', bg: 'rgba(245,244,238,.05)', border: 'rgba(245,244,238,.12)' },
  cancelled: { label: 'Annulé', color: '#ef6a52', bg: 'rgba(226,85,63,.1)', border: 'rgba(226,85,63,.28)' },
};

function StatusPill({ status }: { status?: string }) {
  const meta = STATUS_META[String(status ?? '')] ?? {
    label: status || '—',
    color: 'var(--muted)',
    bg: 'rgba(245,244,238,.05)',
    border: 'rgba(245,244,238,.12)',
  };
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
    >
      {meta.label}
    </span>
  );
}

const EMPTY_FORM = {
  title: '',
  amount: '',
  currency: 'XAF',
  customerEmail: '',
  customerName: '',
  description: '',
};

const inputCls =
  'w-full rounded-lg border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2 text-[13.5px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none lp-tr';
const labelCls = 'mb-1 block text-[12px] font-medium lp-faint';

export function MboloPaiementsPage() {
  const qc = useQueryClient();
  const links = useQuery({ queryKey: ['mbolo-payment-links'], queryFn: () => mboloApi.listPaymentLinks() });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const createLink = useMutation({
    mutationFn: (body: Record<string, unknown>) => mboloApi.createPaymentLink(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mbolo-payment-links'] });
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const cancelLink = useMutation({
    mutationFn: (id: string) => mboloApi.updatePaymentLink(id, { status: 'cancelled' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mbolo-payment-links'] }),
    onError: (e: Error) => setError(e.message),
  });

  const deleteLink = useMutation({
    mutationFn: (id: string) => mboloApi.deletePaymentLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mbolo-payment-links'] }),
    onError: (e: Error) => setError(e.message),
  });

  async function copyUrl(row: any) {
    const url = publicUrl(row);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId((c) => (c === row.id ? null : c)), 1800);
    } catch {
      /* ignore */
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.amount) {
      setError('Le titre et le montant sont obligatoires.');
      return;
    }
    const amountCents = Math.round(parseFloat(form.amount) * 100);
    if (Number.isNaN(amountCents) || amountCents <= 0) {
      setError('Montant invalide.');
      return;
    }
    const body: Record<string, unknown> = {
      title: form.title.trim(),
      amountCents,
      currency: form.currency || 'XAF',
    };
    if (form.customerEmail.trim()) body.customerEmail = form.customerEmail.trim();
    if (form.customerName.trim()) body.customerName = form.customerName.trim();
    if (form.description.trim()) body.description = form.description.trim();
    createLink.mutate(body);
  }

  const list: any[] = Array.isArray(links.data) ? links.data : [];

  return (
    <LiriPortalShell active="paiements">
      <div className="lp-root relative flex h-full w-full flex-col items-center overflow-y-auto">
        <div className="lp-glow">
          <span style={{ width: 480, height: 380, left: '24%', top: -150, background: 'rgba(217,119,87,.08)' }} />
        </div>

        <div className="relative z-10 w-full max-w-4xl px-4 py-6 sm:px-6">
          {/* en-tête de section (le chrome LIRI est fourni par LiriPortalShell) */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="lp-serif text-[22px] font-medium leading-tight lp-ink">Liens de paiement</h1>
              <p className="text-[12.5px] lp-faint">
                Générez un lien à envoyer à un client pour encaisser un montant précis — carte ou mobile money.
              </p>
            </div>
            <button
              onClick={() => {
                setShowForm((v) => !v);
                setError('');
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white lp-tr"
              style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}
            >
              {showForm ? <X size={15} /> : <Plus size={15} />}
              {showForm ? 'Fermer' : 'Nouveau lien'}
            </button>
          </div>

          {error && (
            <div
              className="mb-4 rounded-xl border px-4 py-3 text-[13px]"
              style={{ borderColor: 'rgba(226,85,63,.28)', background: 'rgba(226,85,63,.06)', color: '#ef6a52' }}
            >
              {error}
            </div>
          )}

          {/* Formulaire de création */}
          {showForm && (
            <form
              onSubmit={submit}
              className="mb-6 rounded-2xl border lp-line lp-panel70 p-5"
              style={{ borderColor: 'rgba(255,255,255,.08)' }}
            >
              <h2 className="mb-4 flex items-center gap-2 text-[14.5px] font-semibold lp-ink">
                <Link2 size={16} className="lp-coral" /> Nouveau lien de paiement
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Titre *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Ex. Acompte prestation"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Montant * ({form.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Devise</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className={inputCls}
                  >
                    <option value="XAF">XAF</option>
                    <option value="XOF">XOF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nom du client</label>
                  <input
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    placeholder="Facultatif"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Email du client</label>
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    placeholder="client@exemple.com"
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="Détail de ce que le client règle (facultatif)"
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setError('');
                  }}
                  className="rounded-lg border lp-line px-3.5 py-2 text-[12.5px] font-medium lp-muted lp-railbtn lp-tr"
                  style={{ borderColor: 'rgba(245,244,238,.14)' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createLink.isPending}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white lp-tr disabled:opacity-50"
                  style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}
                >
                  {createLink.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Créer le lien
                </button>
              </div>
            </form>
          )}

          {/* États : chargement / erreur / vide / liste */}
          {links.isLoading && (
            <div className="flex items-center gap-2 rounded-2xl border lp-line lp-panel70 px-5 py-6 text-[13px] lp-muted" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
              <Loader2 size={16} className="animate-spin lp-coral" /> Chargement des liens…
            </div>
          )}

          {links.isError && (
            <div
              className="rounded-2xl border px-5 py-6 text-[13px]"
              style={{ borderColor: 'rgba(226,85,63,.28)', background: 'rgba(226,85,63,.06)', color: '#ef6a52' }}
            >
              {(links.error as Error)?.message ?? 'Impossible de charger les liens de paiement.'}
            </div>
          )}

          {links.isSuccess && list.length === 0 && (
            <div
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center"
              style={{ borderColor: 'rgba(245,244,238,.14)' }}
            >
              <span className="grid h-12 w-12 place-items-center rounded-full lp-coral-tint">
                <Inbox size={22} className="lp-coral" />
              </span>
              <p className="text-[14px] font-medium lp-ink">Aucun lien de paiement</p>
              <p className="max-w-xs text-[12.5px] lp-faint">
                Créez un premier lien pour encaisser un montant précis auprès d'un client.
              </p>
              <button
                onClick={() => {
                  setShowForm(true);
                  setError('');
                }}
                className="mt-1 flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white lp-tr"
                style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}
              >
                <Plus size={15} /> Nouveau lien
              </button>
            </div>
          )}

          {list.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {list.map((row) => {
                const url = publicUrl(row);
                const canCancel = String(row?.status) === 'active';
                const isCopied = copiedId === row.id;
                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border lp-line lp-panel70 p-4 sm:p-5"
                    style={{ borderColor: 'rgba(255,255,255,.08)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl lp-coral-tint">
                          <CreditCard size={17} className="lp-coral" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[14.5px] font-medium lp-ink">{row.title || 'Lien de paiement'}</p>
                          <p className="mt-0.5 text-[13px] lp-coral">{money(row.amount_cents, row.currency)}</p>
                          {(row.customer_name || row.customer_email) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] lp-faint">
                              {row.customer_name && (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <User size={12} /> {row.customer_name}
                                </span>
                              )}
                              {row.customer_email && (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <Mail size={12} /> {row.customer_email}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <StatusPill status={row.status} />
                        <span className="inline-flex items-center gap-1 text-[11.5px] lp-faint">
                          <CalendarDays size={12} /> {fmtDate(row.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* URL publique + copier */}
                    {url && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border lp-line bg-[rgba(255,255,255,.03)] px-3 py-2" style={{ borderColor: 'rgba(245,244,238,.08)' }}>
                        <code className="min-w-0 flex-1 truncate font-mono text-[12px] lp-muted">{url}</code>
                        <button
                          onClick={() => copyUrl(row)}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg border lp-line px-2.5 py-1.5 text-[11.5px] font-medium lp-muted lp-railbtn lp-tr"
                          style={{ borderColor: 'rgba(245,244,238,.14)' }}
                        >
                          {isCopied ? <Check size={13} className="lp-coral" /> : <Copy size={13} />}
                          {isCopied ? 'Copié' : 'Copier'}
                        </button>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex items-center justify-end gap-2 border-t lp-line pt-3" style={{ borderColor: 'rgba(245,244,238,.06)' }}>
                      {canCancel && (
                        <button
                          onClick={() => cancelLink.mutate(row.id)}
                          disabled={cancelLink.isPending}
                          className="flex items-center gap-1.5 rounded-lg border lp-line px-3 py-1.5 text-[12px] font-medium lp-muted lp-railbtn lp-tr disabled:opacity-50"
                          style={{ borderColor: 'rgba(245,244,238,.14)' }}
                        >
                          {cancelLink.isPending && cancelLink.variables === row.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Ban size={13} />
                          )}
                          Annuler
                        </button>
                      )}
                      <button
                        onClick={() => deleteLink.mutate(row.id)}
                        disabled={deleteLink.isPending}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium lp-tr disabled:opacity-50"
                        style={{ borderColor: 'rgba(226,85,63,.22)', color: '#ef6a52' }}
                      >
                        {deleteLink.isPending && deleteLink.variables === row.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </LiriPortalShell>
  );
}

export default MboloPaiementsPage;
