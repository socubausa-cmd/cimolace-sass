import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { mboloApi, tenantsApi, type MboloOrder } from '../lib/api';

function money(cents: number, currency: string) {
  return `${(cents / 100).toLocaleString('fr-FR')} ${currency}`;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  shipped: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function MboloOrders() {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const orders = useQuery({ queryKey: ['mbolo-orders'], queryFn: mboloApi.listOrders });
  const [openId, setOpenId] = useState<string | null>(null);

  const list = orders.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">{tenant.data?.name ?? 'Cimolace tenant'}</p>
          <h1 className="font-semibold text-gray-900">Commandes Mbolo</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/mbolo" className="text-sm text-indigo-600 hover:underline">Catalogue</Link>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:underline">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {orders.data ? `${list.length} commande${list.length > 1 ? 's' : ''}` : 'Commandes'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">Commandes boutique + storefront (site client connecté via clé API).</p>
        </div>

        {orders.isError && <p className="text-red-600 text-sm mb-4">{(orders.error as Error).message}</p>}
        {orders.isLoading && <p className="text-gray-500 text-sm">Chargement des commandes...</p>}

        {orders.data && list.length === 0 && (
          <section className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <h3 className="font-semibold text-gray-900">Aucune commande</h3>
            <p className="mt-2 text-sm text-gray-500">Les commandes passées via la boutique ou le storefront apparaîtront ici.</p>
          </section>
        )}

        {list.length > 0 && (
          <div className="grid gap-3">
            {list.map((o) => (
              <OrderCard key={o.id} order={o} open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function OrderCard({ order: o, open, onToggle }: { order: MboloOrder; open: boolean; onToggle: () => void }) {
  const detail = useQuery({ queryKey: ['mbolo-order', o.id], queryFn: () => mboloApi.getOrder(o.id), enabled: open });
  const statusCls = STATUS_STYLE[o.status] ?? 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <button type="button" onClick={onToggle} className="w-full p-5 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 font-mono text-sm">{o.order_number ?? o.id.slice(0, 8)}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${statusCls}`}>{o.status}</span>
              {o.channel === 'storefront' && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">storefront</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1 truncate">
              {o.customer_name ?? 'Client'}{o.customer_email ? ` · ${o.customer_email}` : ''}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{new Date(o.created_at).toLocaleString('fr-FR')}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-gray-900">{money(o.total_cents, o.currency)}</p>
            <p className="text-xs text-gray-400">{open ? 'Masquer' : 'Détails'}</p>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-5 bg-gray-50/50">
          {detail.isLoading && <p className="text-sm text-gray-500">Chargement...</p>}
          {detail.data && (
            <div className="space-y-3">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                {o.customer_phone && <p className="text-gray-600"><span className="text-gray-400">Tél :</span> {o.customer_phone}</p>}
                <p className="text-gray-600"><span className="text-gray-400">Canal :</span> {o.channel}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Produit</th>
                      <th className="text-right font-medium px-3 py-2">Qté</th>
                      <th className="text-right font-medium px-3 py-2">Prix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(detail.data.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 text-gray-800">{it.product_name ?? it.product_id ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{it.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{money(it.price_cents, o.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-3 py-2 font-medium text-gray-700" colSpan={2}>Total</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">{money(o.total_cents, o.currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
