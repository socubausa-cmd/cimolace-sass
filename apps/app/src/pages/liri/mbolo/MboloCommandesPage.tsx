import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ReceiptText, RefreshCcw, X, Loader2, Package, User, Mail, Phone,
  CalendarDays, Store, ChevronDown, Inbox,
} from 'lucide-react';
import { mboloApi } from '@/lib/api';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import '../../LiriPortal.css';

/* ─────────────────────────────────────────────────────────────────────────────
 * Page COMMANDES du moteur mbolo (boutique), embarquée dans le portail LIRI.
 * Montants stockés en CENTIMES → affichés /100 avec la devise (défaut XAF).
 * Coquille + charte : LiriPortalShell (thème sombre, accent coral).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Affiche un montant stocké en centimes dans la devise donnée (défaut XAF). */
function money(cents: number | null | undefined, currency?: string | null): string {
  const v = ((cents ?? 0) / 100).toLocaleString('fr-FR');
  return `${v} ${currency || 'XAF'}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type BadgeStyle = { label: string; fg: string; bg: string; bd: string };

const STATUS_STYLES: Record<string, BadgeStyle> = {
  pending:    { label: 'En attente',     fg: '#fbbf24', bg: 'rgba(245,158,11,.12)',  bd: 'rgba(245,158,11,.28)' },
  confirmed:  { label: 'Confirmée',      fg: '#7cc0ff', bg: 'rgba(56,140,255,.12)',  bd: 'rgba(56,140,255,.28)' },
  processing: { label: 'En préparation', fg: '#e2855f', bg: 'rgba(217,119,87,.14)',  bd: 'rgba(217,119,87,.32)' },
  shipped:    { label: 'Expédiée',       fg: '#c4b5fd', bg: 'rgba(139,110,246,.12)', bd: 'rgba(139,110,246,.28)' },
  delivered:  { label: 'Livrée',         fg: '#6ee7b7', bg: 'rgba(16,185,129,.12)',  bd: 'rgba(16,185,129,.28)' },
  cancelled:  { label: 'Annulée',        fg: '#f7a19a', bg: 'rgba(226,85,63,.12)',   bd: 'rgba(226,85,63,.30)' },
  refunded:   { label: 'Remboursée',     fg: '#b0ada3', bg: 'rgba(245,244,238,.06)', bd: 'rgba(245,244,238,.14)' },
};

const PAYMENT_STYLES: Record<string, BadgeStyle> = {
  unpaid:   { label: 'Impayé',     fg: '#f7a19a', bg: 'rgba(226,85,63,.12)',   bd: 'rgba(226,85,63,.30)' },
  paid:     { label: 'Payé',       fg: '#6ee7b7', bg: 'rgba(16,185,129,.12)',  bd: 'rgba(16,185,129,.28)' },
  partial:  { label: 'Partiel',    fg: '#fbbf24', bg: 'rgba(245,158,11,.12)',  bd: 'rgba(245,158,11,.28)' },
  refunded: { label: 'Remboursé',  fg: '#b0ada3', bg: 'rgba(245,244,238,.06)', bd: 'rgba(245,244,238,.14)' },
};

const STATUS_OPTIONS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
const PAYMENT_OPTIONS = ['unpaid', 'paid', 'partial', 'refunded'];

const fallbackStyle = (key: string): BadgeStyle => ({
  label: key || '—', fg: '#b0ada3', bg: 'rgba(245,244,238,.06)', bd: 'rgba(245,244,238,.14)',
});
const statusStyle = (key?: string | null) => STATUS_STYLES[key || ''] ?? fallbackStyle(key || '—');
const paymentStyle = (key?: string | null) => PAYMENT_STYLES[key || ''] ?? fallbackStyle(key || '—');

/** Le statut de paiement peut arriver en snake_case ou camelCase selon la route. */
const paymentKeyOf = (o: any): string => (o?.payment_status ?? o?.paymentStatus ?? 'unpaid') as string;
const orderLabel = (o: any): string => o?.order_number || `#${String(o?.id ?? '').slice(0, 8)}`;

function Badge({ s }: { s: BadgeStyle }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium capitalize"
      style={{ color: s.fg, background: s.bg, border: `1px solid ${s.bd}` }}
    >
      {s.label}
    </span>
  );
}

export function MboloCommandesPage() {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ['mbolo-orders'], queryFn: () => mboloApi.listOrders() });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['mbolo-order', selectedId],
    queryFn: () => mboloApi.getOrder(selectedId as string),
    enabled: !!selectedId,
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => mboloApi.updateOrder(id, body),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ['mbolo-orders'] });
      qc.invalidateQueries({ queryKey: ['mbolo-order', vars.id] });
    },
  });

  const list = (orders.data ?? []) as any[];
  const selectedRow = selectedId ? list.find((o) => o.id === selectedId) : undefined;
  const order: any = detail.data ?? selectedRow ?? null;

  return (
    <LiriPortalShell active="commandes">
      <div className="lp-root relative flex h-full w-full flex-col items-center overflow-y-auto">
        <div className="lp-glow">
          <span style={{ width: 480, height: 380, left: '24%', top: -150, background: 'rgba(217,119,87,.08)' }} />
        </div>

        <div className="relative z-10 w-full max-w-5xl px-4 py-6 sm:px-6">
          {/* en-tête de section (le chrome LIRI est fourni par LiriPortalShell) */}
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="lp-serif flex items-center gap-2 text-[22px] font-medium leading-tight lp-ink">
                <ReceiptText size={20} className="lp-coral" /> Commandes
              </h1>
              <p className="mt-0.5 text-[12.5px] lp-faint">
                Suivez et faites avancer les commandes de votre boutique mbolo.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {orders.data && (
                <span className="rounded-full border px-3 py-1 text-[12px] font-medium lp-muted" style={{ borderColor: 'rgba(245,244,238,.09)' }}>
                  {list.length} commande{list.length > 1 ? 's' : ''}
                </span>
              )}
              <button
                type="button"
                onClick={() => orders.refetch()}
                disabled={orders.isFetching}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-medium lp-muted lp-railbtn lp-tr disabled:opacity-50"
                style={{ borderColor: 'rgba(245,244,238,.09)' }}
              >
                <RefreshCcw size={14} className={orders.isFetching ? 'animate-spin' : ''} /> Actualiser
              </button>
            </div>
          </div>

          {/* erreur */}
          {orders.isError && (
            <div className="mb-4 rounded-2xl border px-4 py-3 text-[13px]" style={{ borderColor: 'rgba(226,85,63,.30)', background: 'rgba(226,85,63,.06)', color: '#f7a19a' }}>
              {(orders.error as Error)?.message || 'Impossible de charger les commandes.'}
            </div>
          )}

          {/* chargement */}
          {orders.isLoading && (
            <div className="flex items-center gap-2 rounded-2xl border px-5 py-8 text-[13px] lp-muted" style={{ borderColor: 'rgba(245,244,238,.08)' }}>
              <Loader2 size={16} className="animate-spin lp-coral" /> Chargement des commandes…
            </div>
          )}

          {/* vide */}
          {orders.data && list.length === 0 && (
            <div className="grid place-items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center" style={{ borderColor: 'rgba(245,244,238,.14)' }}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: 'rgba(217,119,87,.12)' }}>
                <Inbox size={22} className="lp-coral" />
              </span>
              <p className="text-[15px] font-medium lp-ink">Aucune commande</p>
              <p className="max-w-sm text-[12.5px] lp-faint">
                Les commandes passées sur votre boutique ou via vos liens de paiement apparaîtront ici.
              </p>
            </div>
          )}

          {/* table */}
          {list.length > 0 && (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'rgba(245,244,238,.08)' }}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="border-b lp-line text-[11px] font-semibold uppercase tracking-[0.08em] lp-faint">
                      <th className="px-4 py-3">Commande</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Paiement</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((o) => {
                      const active = o.id === selectedId;
                      return (
                        <tr
                          key={o.id}
                          onClick={() => setSelectedId(o.id)}
                          className="cursor-pointer border-b lp-tr last:border-b-0"
                          style={{
                            borderColor: 'rgba(245,244,238,.06)',
                            background: active ? 'rgba(217,119,87,.07)' : 'transparent',
                          }}
                          onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(245,244,238,.03)'; }}
                          onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-[12.5px] font-medium lp-ink">{orderLabel(o)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <span className="block truncate text-[13px] lp-ink">
                                {o.customer_name || o.customer_email || 'Client invité'}
                              </span>
                              {o.customer_name && o.customer_email && (
                                <span className="block truncate text-[11.5px] lp-faint">{o.customer_email}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="whitespace-nowrap text-[13px] font-medium lp-ink">{money(o.total_cents, o.currency)}</span>
                          </td>
                          <td className="px-4 py-3"><Badge s={statusStyle(o.status)} /></td>
                          <td className="px-4 py-3"><Badge s={paymentStyle(paymentKeyOf(o))} /></td>
                          <td className="px-4 py-3">
                            <span className="whitespace-nowrap text-[12px] lp-muted">{formatDate(o.created_at)}</span>
                          </td>
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

      {/* volet de détail (slide-over) */}
      {selectedId && (
        <div
          className="fixed inset-0 z-[60] flex justify-end"
          style={{ background: 'rgba(0,0,0,.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          <div
            className="lp-root flex h-full w-full max-w-[480px] flex-col overflow-y-auto border-l lp-line"
            style={{ background: '#221f1b', boxShadow: '-40px 0 90px -20px rgba(0,0,0,.8)' }}
          >
            {/* en-tête volet */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b lp-line px-5 py-4" style={{ background: '#221f1b' }}>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] lp-faint">Commande</p>
                <p className="truncate font-mono text-[15px] font-semibold lp-ink">{order ? orderLabel(order) : '…'}</p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg lp-faint lp-railbtn lp-tr"
                aria-label="Fermer"
              >
                <X size={17} />
              </button>
            </div>

            {detail.isLoading && !order && (
              <div className="flex items-center gap-2 px-5 py-8 text-[13px] lp-muted">
                <Loader2 size={16} className="animate-spin lp-coral" /> Chargement du détail…
              </div>
            )}

            {detail.isError && !order && (
              <div className="m-5 rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: 'rgba(226,85,63,.30)', background: 'rgba(226,85,63,.06)', color: '#f7a19a' }}>
                {(detail.error as Error)?.message || 'Impossible de charger cette commande.'}
              </div>
            )}

            {order && (
              <div className="flex flex-col gap-5 px-5 py-5">
                {/* montant + date */}
                <div className="rounded-2xl border px-4 py-4" style={{ borderColor: 'rgba(245,244,238,.08)', background: 'rgba(245,244,238,.02)' }}>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] lp-faint">Total</p>
                      <p className="lp-serif text-[22px] font-semibold lp-ink">{money(order.total_cents, order.currency)}</p>
                    </div>
                    <div className="text-right">
                      <Badge s={statusStyle(order.status)} />
                      <p className="mt-1.5 flex items-center justify-end gap-1 text-[11.5px] lp-faint">
                        <CalendarDays size={12} /> {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                  {order.channel && (
                    <p className="mt-3 flex items-center gap-1.5 text-[12px] lp-muted">
                      <Store size={13} className="lp-faint" /> Canal : <span className="capitalize lp-ink">{order.channel}</span>
                    </p>
                  )}
                </div>

                {/* client */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] lp-faint">Client</p>
                  <div className="space-y-2 rounded-2xl border px-4 py-3.5" style={{ borderColor: 'rgba(245,244,238,.08)' }}>
                    <p className="flex items-center gap-2 text-[13px] lp-ink">
                      <User size={14} className="lp-faint" /> {order.customer_name || 'Client invité'}
                    </p>
                    {order.customer_email && (
                      <p className="flex items-center gap-2 text-[12.5px] lp-muted">
                        <Mail size={14} className="lp-faint" /> <span className="truncate">{order.customer_email}</span>
                      </p>
                    )}
                    {order.customer_phone && (
                      <p className="flex items-center gap-2 text-[12.5px] lp-muted">
                        <Phone size={14} className="lp-faint" /> {order.customer_phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* éditeurs statut + paiement */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatusSelect
                    label="Statut de la commande"
                    value={order.status}
                    options={STATUS_OPTIONS}
                    styleOf={statusStyle}
                    saving={updateOrder.isPending && (updateOrder.variables as any)?.body?.status !== undefined}
                    onChange={(v) => updateOrder.mutate({ id: order.id, body: { status: v } })}
                  />
                  <StatusSelect
                    label="Paiement"
                    value={paymentKeyOf(order)}
                    options={PAYMENT_OPTIONS}
                    styleOf={paymentStyle}
                    saving={updateOrder.isPending && (updateOrder.variables as any)?.body?.paymentStatus !== undefined}
                    onChange={(v) => updateOrder.mutate({ id: order.id, body: { paymentStatus: v } })}
                  />
                </div>

                {updateOrder.isError && (
                  <p className="text-[12px]" style={{ color: '#f7a19a' }}>
                    {(updateOrder.error as Error)?.message || 'La mise à jour a échoué.'}
                  </p>
                )}

                {/* articles */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] lp-faint">
                    <Package size={13} /> Articles ({order.items?.length ?? 0})
                  </p>
                  {detail.isLoading && !order.items && (
                    <p className="flex items-center gap-2 text-[12.5px] lp-muted"><Loader2 size={14} className="animate-spin" /> Chargement…</p>
                  )}
                  {order.items && order.items.length > 0 ? (
                    <div className="divide-y overflow-hidden rounded-2xl border" style={{ borderColor: 'rgba(245,244,238,.08)' }}>
                      {order.items.map((it: any) => (
                        <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] lp-ink">{it.product_name || 'Article'}</p>
                            <p className="text-[11.5px] lp-faint">
                              {it.quantity} × {money(it.price_cents, order.currency)}
                            </p>
                          </div>
                          <span className="whitespace-nowrap text-[13px] font-medium lp-ink">
                            {money((it.price_cents ?? 0) * (it.quantity ?? 0), order.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    order.items && (
                      <p className="rounded-2xl border border-dashed px-4 py-5 text-center text-[12.5px] lp-faint" style={{ borderColor: 'rgba(245,244,238,.14)' }}>
                        Aucun article détaillé pour cette commande.
                      </p>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </LiriPortalShell>
  );
}

/** Sélecteur natif stylé (dark) pour changer un statut, avec badge courant. */
function StatusSelect({
  label, value, options, styleOf, saving, onChange,
}: {
  label: string;
  value: string;
  options: string[];
  styleOf: (key?: string | null) => BadgeStyle;
  saving: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-[0.1em] lp-faint">{label}</label>
        {saving && <Loader2 size={13} className="animate-spin lp-coral" />}
      </div>
      <div className="mb-2"><Badge s={styleOf(value)} /></div>
      <div className="relative">
        <select
          value={value}
          disabled={saving}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border px-3 py-2.5 pr-9 text-[13px] text-white lp-tr focus:outline-none disabled:opacity-60"
          style={{ borderColor: 'rgba(245,244,238,.12)', background: 'rgba(255,255,255,.04)' }}
        >
          {options.map((opt) => (
            <option key={opt} value={opt} style={{ background: '#221f1b', color: '#f5f4ee' }}>
              {styleOf(opt).label}
            </option>
          ))}
        </select>
        <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 lp-faint" />
      </div>
    </div>
  );
}

export default MboloCommandesPage;
