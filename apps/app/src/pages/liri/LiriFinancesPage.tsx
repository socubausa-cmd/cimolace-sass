import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Wallet, ArrowDownToLine } from 'lucide-react';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';
import '../LiriPortal.css';

const ZERO_DECIMAL = new Set(['XAF', 'XOF', 'XPF', 'JPY', 'KMF', 'GNF', 'RWF', 'BIF', 'MGA', 'VND', 'KRW', 'CLP', 'PYG', 'UGX', 'DJF', 'VUV']);
const MNOS = [
  { code: 'AIRTEL_GAB', label: 'Airtel Money — Gabon' },
  { code: 'MOOV_GAB', label: 'Moov Money — Gabon' },
  { code: 'MTN_MOMO_CMR', label: 'MTN MoMo — Cameroun' },
  { code: 'ORANGE_CMR', label: 'Orange Money — Cameroun' },
];
const money = (cents: number, currency = 'XAF') => {
  const v = ZERO_DECIMAL.has((currency || '').toUpperCase()) ? cents : cents / 100;
  return `${(v || 0).toLocaleString('fr-FR')} ${currency}`;
};

interface Balance { collectedCents: number; withdrawnCents: number; availableCents: number; currency: string; }
interface Payout { id: string; recipient_name?: string | null; phone_number: string; mno: string; amount_cents: number; currency: string; status: string; reason?: string | null; failure_message?: string | null; created_at: string; }

export default function LiriFinancesPage() {
  const nav = useNavigate();
  const base = getApiBaseUrl();
  const token = authStore.getToken();
  const slug = authStore.getTenantSlug();
  const H = useMemo(() => ({ Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>), [token, slug]);

  const [bal, setBal] = useState<Balance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [mno, setMno] = useState('AIRTEL_GAB');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const amountCents = () => { const n = parseFloat(amount); if (Number.isNaN(n)) return 0; return ZERO_DECIMAL.has('XAF') ? Math.round(n) : Math.round(n * 100); };

  const load = () => {
    fetch(`${base}/billing/balance`, { headers: H }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { let t: any = d; while (t && typeof t === 'object' && 'data' in t && !('availableCents' in t)) t = t.data; if (t && typeof t.availableCents === 'number') setBal(t as Balance); }).catch(() => {});
    fetch(`${base}/billing/payouts`, { headers: H }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { let a: any = d; while (a && typeof a === 'object' && !Array.isArray(a) && 'data' in a) a = a.data; setPayouts(Array.isArray(a) ? a : []); setLoaded(true); }).catch(() => setLoaded(true));
  };
  useEffect(() => { if (token) load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (sending || amountCents() <= 0 || !phone.trim()) return;
    setSending(true); setMsg(null);
    try {
      const res = await fetch(`${base}/billing/payouts`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ amountCents: amountCents(), currency: 'XAF', phoneNumber: phone.trim(), mno, reason: reason.trim() || undefined }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as any)?.error?.message || (j as any)?.message || 'Retrait impossible.');
      let r: any = j; while (r && typeof r === 'object' && 'data' in r && !('status' in r)) r = r.data;
      setMsg({ ok: true, text: `Retrait initié (${r?.status || 'pending'}) — ${money(amountCents(), 'XAF')}.` });
      setAmount(''); setPhone(''); setReason(''); setConfirm(false);
      load();
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'Retrait impossible.' }); setConfirm(false); }
    finally { setSending(false); }
  };

  const statusColor = (s: string) => { const x = String(s).toLowerCase(); if (['completed', 'accepted'].includes(x)) return '#7bbf6a'; if (['failed', 'rejected'].includes(x)) return '#ef6a52'; return '#e2a07f'; };

  const cards = [
    { label: 'Encaissé', v: bal?.collectedCents, big: false, accent: '#f5f4ee' },
    { label: 'Retiré', v: bal?.withdrawnCents, big: false, accent: '#f5f4ee' },
    { label: 'Disponible', v: bal?.availableCents, big: true, accent: '#e2855f' },
  ];

  return (
    <div className="lp-root relative min-h-[100dvh] w-full overflow-y-auto">
      <div className="lp-glow"><span style={{ width: 480, height: 380, left: '24%', top: -150, background: 'rgba(217,119,87,.08)' }} /></div>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => nav('/liri')} className="grid h-9 w-9 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Retour au portail"><ChevronLeft size={18} /></button>
          <h1 className="lp-serif text-[22px] font-medium">Mes finances</h1>
        </div>

        {/* Solde */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border lp-line lp-panel70 p-4">
              <p className="text-[12px] lp-faint">{c.label}</p>
              <p className="mt-1 lp-serif text-[22px] font-medium lp-ink" style={c.big ? { color: c.accent } : undefined}>{bal ? money(c.v || 0, 'XAF') : '—'}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] lp-faint">Solde estimé d’après vos encaissements mobile money enregistrés. Le disponible réel pour un retrait dépend de votre wallet pawaPay.</p>

        {/* Retrait */}
        <div className="mt-5 rounded-2xl border lp-line lp-panel70 p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: 'rgba(217,119,87,.14)' }}><ArrowDownToLine size={17} className="lp-coral" /></span>
            <div><p className="text-[14px] font-medium lp-ink">Retirer vers mobile money</p><p className="text-[12px] lp-faint">Airtel / Moov Money — versé via pawaPay.</p></div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[12px] font-medium lp-faint">Montant (XAF)</label>
              <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" className="mt-1.5 w-full rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[12px] font-medium lp-faint">Numéro mobile money</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="24177000000" autoComplete="off" className="mt-1.5 w-full rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[12px] font-medium lp-faint">Opérateur</label>
              <select value={mno} onChange={(e) => setMno(e.target.value)} className="mt-1.5 w-full rounded-xl border lp-line bg-[rgba(34,31,27,.95)] px-3 py-2.5 text-[13px] text-white focus:border-[rgba(217,119,87,.5)] focus:outline-none">
                {MNOS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium lp-faint">Motif (facultatif)</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reversement ventes" className="mt-1.5 w-full rounded-xl border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(217,119,87,.5)] focus:outline-none" />
            </div>
          </div>

          {msg && <p className="mt-3 text-[12.5px]" style={{ color: msg.ok ? '#7bbf6a' : '#ef6a52' }}>{msg.text}</p>}

          {confirm ? (
            <div className="mt-4 rounded-xl border p-3.5" style={{ borderColor: 'rgba(226,85,63,.35)', background: 'rgba(226,85,63,.06)' }}>
              <p className="text-[12.5px] lp-ink">⚠️ Confirmer l’envoi de <strong>{money(amountCents(), 'XAF')}</strong> vers <strong>{phone}</strong> ({mno}) ? C’est un mouvement d’argent réel.</p>
              <div className="mt-3 flex gap-2.5">
                <button onClick={submit} disabled={sending} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white lp-tr disabled:opacity-60" style={{ background: 'linear-gradient(90deg,#e2553f,#c2402f)' }}>{sending ? <><Loader2 size={15} className="animate-spin" /> Envoi…</> : 'Confirmer le retrait'}</button>
                <button onClick={() => setConfirm(false)} className="rounded-xl border px-4 py-2.5 text-[13px] font-medium lp-muted lp-tr" style={{ borderColor: 'rgba(245,244,238,.14)' }}>Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setMsg(null); setConfirm(true); }} disabled={amountCents() <= 0 || !phone.trim()} className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white lp-tr disabled:opacity-50" style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}><Wallet size={15} /> Retirer</button>
          )}
        </div>

        {/* Historique */}
        <div className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] lp-faint">Historique des retraits</p>
          {!loaded ? (
            <div className="mt-3 flex items-center gap-2 text-[13px] lp-faint"><Loader2 size={15} className="animate-spin" /> Chargement…</div>
          ) : payouts.length === 0 ? (
            <p className="mt-3 text-[13px] lp-faint">Aucun retrait pour le moment.</p>
          ) : (
            <div className="mt-2.5 space-y-1.5">
              {payouts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: 'rgba(245,244,238,.08)' }}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium lp-ink">{p.recipient_name || p.phone_number} <span className="lp-faint">· {p.mno}</span></span>
                    <span className="block truncate text-[11.5px] lp-faint">{p.reason || '—'} · {new Date(p.created_at).toLocaleString('fr-FR')}</span>
                    {p.failure_message && <span className="block truncate text-[11px]" style={{ color: '#ef6a52' }}>{p.failure_message}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-semibold lp-ink">{money(p.amount_cents, p.currency)}</span>
                    <span className="text-[11px] font-medium capitalize" style={{ color: statusColor(p.status) }}>{p.status}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
