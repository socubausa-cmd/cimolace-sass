import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { billingApi, tenantsApi } from '../lib/api';

const ZERO_DECIMAL = new Set(['XAF', 'XOF', 'XPF', 'JPY', 'KMF', 'GNF', 'RWF', 'BIF', 'MGA', 'VND', 'KRW', 'CLP', 'PYG', 'UGX', 'DJF', 'VUV']);
function money(cents: number, currency: string) {
  const v = ZERO_DECIMAL.has((currency || '').toUpperCase()) ? cents : cents / 100;
  return `${v.toLocaleString('fr-FR')} ${currency}`;
}
const STATUS: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 border-green-200',
  accepted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};
const MNOS = [
  { code: 'MTN_MOMO_CMR', label: 'MTN MoMo — Cameroun' },
  { code: 'ORANGE_CMR', label: 'Orange Money — Cameroun' },
  { code: 'AIRTEL_GAB', label: 'Airtel Money — Gabon' },
  { code: 'MOOV_GAB', label: 'Moov Money — Gabon' },
];
const EMPTY = { recipientName: '', phoneNumber: '', mno: 'MTN_MOMO_CMR', amount: '', currency: 'XAF', reason: '' };

export function TenantPayoutsPage() {
  const qc = useQueryClient();
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const payouts = useQuery({ queryKey: ['billing-payouts'], queryFn: billingApi.listPayouts });

  const [form, setForm] = useState({ ...EMPTY });
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const amountCents = () => {
    const n = parseFloat(form.amount);
    if (Number.isNaN(n)) return 0;
    return ZERO_DECIMAL.has(form.currency) ? Math.round(n) : Math.round(n * 100);
  };

  const create = useMutation({
    mutationFn: () => billingApi.createPayout({
      amountCents: amountCents(), currency: form.currency, phoneNumber: form.phoneNumber.trim(),
      mno: form.mno, recipientName: form.recipientName.trim() || undefined, reason: form.reason.trim() || undefined,
    }),
    onSuccess: (r) => {
      setOk(`Versement initié (${r.status}) — ${money(r.amount_cents, r.currency)}.`);
      setError(''); setConfirm(false); setForm({ ...EMPTY });
      qc.invalidateQueries({ queryKey: ['billing-payouts'] });
    },
    onError: (e: Error) => { setError(e.message); setConfirm(false); },
  });

  const list = payouts.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">{tenant.data?.name ?? 'Cimolace tenant'}</p>
          <h1 className="font-semibold text-gray-900">Retraits — versements mobile money</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/billing" className="text-sm text-indigo-600 hover:underline">Facturation</Link>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:underline">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Formulaire */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Nouveau versement</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bénéficiaire</label>
              <input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} placeholder="Nom (optionnel)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro mobile money</label>
              <input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} placeholder="237670000000" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opérateur</label>
              <select value={form.mno} onChange={(e) => setForm({ ...form, mno: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {MNOS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                <input type="number" min="1" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="XAF">XAF</option><option value="XOF">XOF</option><option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reversement ventes, remboursement…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {ok && <p className="mt-3 text-sm text-green-700">{ok}</p>}

          {confirm ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                ⚠️ Confirmer l'envoi de <strong>{money(amountCents(), form.currency)}</strong> vers <strong>{form.phoneNumber}</strong> ({form.mno}) ? C'est un mouvement d'argent réel.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={create.isPending} onClick={() => create.mutate()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  {create.isPending ? 'Envoi…' : 'Confirmer le versement'}
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={!form.phoneNumber.trim() || amountCents() <= 0}
              onClick={() => { setError(''); setOk(''); setConfirm(true); }}
              className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Verser
            </button>
          )}
        </section>

        {/* Historique */}
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Historique des versements</h3></div>
          {payouts.isLoading && <p className="px-6 py-4 text-sm text-gray-500">Chargement…</p>}
          {payouts.data && list.length === 0 && <p className="px-6 py-6 text-sm text-gray-400 italic">Aucun versement pour le moment.</p>}
          <ul className="divide-y divide-gray-100">
            {list.map((p) => (
              <li key={p.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{p.recipient_name || p.phone_number} <span className="text-gray-400 text-sm">· {p.mno}</span></p>
                  <p className="text-sm text-gray-500 truncate">{p.reason || '—'} · {new Date(p.created_at).toLocaleString('fr-FR')}</p>
                  {p.failure_message && <p className="text-xs text-red-500 truncate">{p.failure_message}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-900">{money(p.amount_cents, p.currency)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${STATUS[p.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{p.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-gray-400">Versements opérés par PawaPay (mobile money). Réservé aux propriétaires/admins.</p>
      </main>
    </div>
  );
}
