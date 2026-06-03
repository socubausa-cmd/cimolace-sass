import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { billingApi, tenantsApi, type BillingInvoice } from '../lib/api';

const ZERO_DECIMAL = new Set(['XAF', 'XOF', 'XPF', 'JPY', 'KMF', 'GNF', 'RWF', 'BIF', 'MGA', 'VND', 'KRW', 'CLP', 'PYG', 'UGX', 'DJF', 'VUV']);
function money(cents: number, currency: string) {
  const v = ZERO_DECIMAL.has((currency || '').toUpperCase()) ? cents : cents / 100;
  return `${v.toLocaleString('fr-FR')} ${currency}`;
}

const STATUS: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  past_due: 'bg-red-50 text-red-700 border-red-200',
};

// Codes opérateurs PawaPay (Afrique centrale — exemples)
const PROVIDERS = [
  { code: 'MTN_MOMO_CMR', label: 'MTN MoMo — Cameroun' },
  { code: 'ORANGE_CMR', label: 'Orange Money — Cameroun' },
  { code: 'AIRTEL_GAB', label: 'Airtel Money — Gabon' },
  { code: 'MOOV_GAB', label: 'Moov Money — Gabon' },
];

export function TenantBillingPage() {
  const qc = useQueryClient();
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const plan = useQuery({ queryKey: ['billing-plan'], queryFn: billingApi.getPlan });

  const [payFor, setPayFor] = useState<BillingInvoice | null>(null);
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState('MTN_MOMO_CMR');
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ deposit_id: string; status: string } | null>(null);

  const collect = useMutation({
    mutationFn: (sub: string) => billingApi.collect(sub, { phoneNumber: phone.trim(), provider }),
    onSuccess: (r) => {
      setDone({ deposit_id: r.deposit_id, status: r.status });
      setError('');
      qc.invalidateQueries({ queryKey: ['billing-plan'] });
    },
    onError: (e: Error) => { setError(e.message); setDone(null); },
  });

  // Carte bancaire (Stripe — Europe / international) : ouvre la page de paiement Stripe
  const card = useMutation({
    mutationFn: (sub: string) => billingApi.cardCheckout(sub),
    onSuccess: (r) => { setError(''); if (r.url) window.open(r.url, '_blank', 'noopener'); },
    onError: (e: Error) => setError(e.message),
  });

  const subs = plan.data?.subscriptions ?? [];
  const invoices = plan.data?.invoices ?? [];
  const subById = (id: string | null) => subs.find((s) => s.id === id);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">{tenant.data?.name ?? 'Cimolace tenant'}</p>
          <h1 className="font-semibold text-gray-900">Abonnement & facturation</h1>
        </div>
        <Link to="/dashboard" className="text-sm text-gray-500 hover:underline">Dashboard</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {plan.isLoading && <p className="text-gray-500 text-sm">Chargement…</p>}
        {plan.isError && <p className="text-red-600 text-sm">{(plan.error as Error).message}</p>}

        {subs.length === 0 && plan.data && (
          <section className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <h3 className="font-semibold text-gray-900">Aucun abonnement</h3>
            <p className="mt-2 text-sm text-gray-500">Aucun abonnement plateforme actif pour ce compte.</p>
          </section>
        )}

        {/* Abonnements */}
        {subs.map((s) => (
          <section key={s.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{(s.metadata as any)?.engine === 'medos' ? 'MEDOS — Standard' : s.plan_id}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {money(s.amount_cents, s.currency)} / mois
                  {(s.metadata as any)?.amount_xaf ? <span className="text-gray-400"> · soit {Number((s.metadata as any).amount_xaf).toLocaleString('fr-FR')} XAF</span> : null}
                </p>
                {s.current_period_end && (
                  <p className="mt-1 text-xs text-gray-400">Période en cours jusqu'au {new Date(s.current_period_end).toLocaleDateString('fr-FR')}</p>
                )}
              </div>
              <div className="text-right">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${STATUS[s.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{s.status}</span>
                <p className="mt-1 text-xs text-gray-400 uppercase">{s.provider}</p>
              </div>
            </div>
          </section>
        ))}

        {/* Factures */}
        {invoices.length > 0 && (
          <section className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Factures</h3></div>
            <ul className="divide-y divide-gray-100">
              {invoices.map((inv) => {
                const payable = ['pending', 'processing', 'failed'].includes(inv.status);
                return (
                  <li key={inv.id} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 font-mono text-sm">{inv.invoice_number ?? inv.id.slice(0, 8)}</p>
                        <p className="text-sm text-gray-500 truncate">{inv.description ?? '—'}</p>
                        {inv.due_date && <p className="text-xs text-gray-400">Échéance {new Date(inv.due_date).toLocaleDateString('fr-FR')}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-gray-900">{money(inv.amount_cents, inv.currency)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${STATUS[inv.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{inv.status}</span>
                      </div>
                    </div>
                    {payable && (
                      <div className="mt-3">
                        {payFor?.id === inv.id ? (
                          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                            <p className="text-sm font-medium text-indigo-900 mb-3">Payer par mobile money — {money(inv.amount_cents, inv.currency)}</p>
                            {done ? (
                              <div className="text-sm text-indigo-900">
                                ✓ Demande envoyée (dépôt <span className="font-mono">{done.deposit_id.slice(0, 8)}…</span>, statut <strong>{done.status}</strong>).
                                <p className="mt-1 text-indigo-700">Validez la demande sur votre téléphone. La facture passera « payée » à la confirmation.</p>
                              </div>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Numéro (ex: 237670000000)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                  {PROVIDERS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                                </select>
                                <button
                                  type="button"
                                  disabled={!phone.trim() || collect.isPending}
                                  onClick={() => { if (inv.subscription_id) collect.mutate(inv.subscription_id); }}
                                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  {collect.isPending ? 'Envoi…' : 'Payer'}
                                </button>
                              </div>
                            )}
                            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                            <button type="button" onClick={() => { setPayFor(null); setDone(null); setError(''); }} className="mt-2 text-xs text-indigo-500 hover:underline">Fermer</button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => { setPayFor(inv); setDone(null); setError(''); }} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                              📱 Mobile money <span className="opacity-70">(Afrique)</span>
                            </button>
                            <button
                              type="button"
                              disabled={!inv.subscription_id || card.isPending}
                              onClick={() => { if (inv.subscription_id) card.mutate(inv.subscription_id); }}
                              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {card.isPending ? 'Redirection…' : '💳 Carte bancaire'} <span className="opacity-60">(Europe)</span>
                            </button>
                            {error && <span className="text-sm text-red-600 w-full">{error}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="text-xs text-gray-400">
          Paiement opéré par PawaPay (mobile money). Le montant est défini par votre abonnement, jamais saisi ici.
        </p>
      </main>
    </div>
  );
}
