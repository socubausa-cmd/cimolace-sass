import { useEffect, useState } from 'react';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { apiV2 } from '@/lib/api-v2';

const C = { bg: '#0d1117', panel: '#161b22', panel2: '#1c2128', border: '#21262d', border2: '#30363d', violet: '#7c3aed', green: '#10b981', orange: '#f59e0b', red: '#ef4444', text: '#f0f6fc', muted: '#8b949e' };
const ZERO_DECIMAL = new Set(['XAF', 'XOF', 'XPF', 'JPY', 'KMF', 'GNF', 'RWF', 'BIF', 'MGA', 'VND', 'KRW', 'CLP', 'PYG', 'UGX', 'DJF', 'VUV']);
const MNOS = [
  { code: 'AIRTEL_GAB', label: 'Airtel Money — Gabon' },
  { code: 'MOOV_GAB', label: 'Moov Money — Gabon' },
  { code: 'MTN_MOMO_CMR', label: 'MTN MoMo — Cameroun' },
  { code: 'ORANGE_CMR', label: 'Orange Money — Cameroun' },
];
const money = (cents, cur = 'XAF') => `${(ZERO_DECIMAL.has((cur || '').toUpperCase()) ? cents : cents / 100).toLocaleString('fr-FR')} ${cur}`;
const unwrap = (r) => { let d = r?.data; while (d && typeof d === 'object' && 'data' in d) d = d.data; return d; };
const eur = (n) => `${(Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const num = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
const th = { padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
const td = { padding: '10px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' };
function Badge({ c, children }) {
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: c, background: `${c}22` }}>{children}</span>;
}

export default function CimolaceAdminFinances() {
  const [fin, setFin] = useState(null);
  const [cost, setCost] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [mno, setMno] = useState('AIRTEL_GAB');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [walletKey, setWalletKey] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [allocFor, setAllocFor] = useState(null);
  const [allocAmt, setAllocAmt] = useState('');
  const [wMsg, setWMsg] = useState(null);

  const amountCents = () => { const n = parseFloat(amount); if (Number.isNaN(n)) return 0; return ZERO_DECIMAL.has('XAF') ? Math.round(n) : Math.round(n * 100); };

  const load = () => {
    apiV2.get('/cimolace-backoffice/finances').then((r) => setFin(unwrap(r))).catch(() => {});
    apiV2.get('/cimolace-backoffice/finances/payouts').then((r) => { const d = unwrap(r); setPayouts(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
    // Cockpit de coût : ce que chaque tenant CONSOMME (IA + live + dépassement)
    apiV2.get('/admin/ai-billing/cost-overview').then((r) => setCost(unwrap(r))).catch(() => {});
  };
  useEffect(load, []);

  const submit = async () => {
    if (sending || amountCents() <= 0 || !phone.trim()) return;
    setSending(true); setMsg(null);
    try {
      const r = await apiV2.post('/cimolace-backoffice/finances/payout', { amountCents: amountCents(), currency: 'XAF', phoneNumber: phone.trim(), mno, wallet: walletKey || undefined, reason: reason.trim() || undefined });
      const d = unwrap(r);
      setMsg({ ok: true, text: `Retrait initié (${d?.status || 'pending'}) — ${money(amountCents(), 'XAF')}.` });
      setAmount(''); setPhone(''); setReason(''); setConfirm(false); load();
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || 'Retrait impossible.' });
      setConfirm(false);
    } finally { setSending(false); }
  };

  const createWallet = async () => {
    if (creating || !newKey.trim() || !newLabel.trim()) return;
    setCreating(true); setWMsg(null);
    try { await apiV2.post('/cimolace-backoffice/finances/wallets', { key: newKey.trim(), label: newLabel.trim() }); setNewKey(''); setNewLabel(''); load(); }
    catch (e) { setWMsg({ ok: false, text: e?.response?.data?.error?.message || e?.response?.data?.message || 'Création impossible.' }); }
    finally { setCreating(false); }
  };
  const allocate = async () => {
    const c = Math.round(parseFloat(allocAmt) || 0);
    if (!allocFor || !c) return;
    try { await apiV2.post(`/cimolace-backoffice/finances/wallets/${allocFor}/allocate`, { amountCents: c, note: 'Attribution manuelle' }); setAllocFor(null); setAllocAmt(''); load(); }
    catch (e) { setWMsg({ ok: false, text: e?.response?.data?.message || 'Attribution impossible.' }); }
  };

  const balances = (fin?.walletBalances || []).filter((b) => Number(b.balance) > 0);
  const input = { width: '100%', boxSizing: 'border-box', background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 14, outline: 'none' };
  const card = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <CimolaceHeader />
      <div style={{ display: 'flex' }}>
        <CimolaceSidebar />
        <main style={{ flex: 1, padding: '28px 32px', maxWidth: 920 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>Finances</h1>
          <p style={{ color: C.muted, margin: '0 0 24px', fontSize: 14 }}>Vos revenus (ce que chaque tenant vous paie pour vos services) — soldes réels + retrait vers mobile money, sans passer par pawaPay.</p>

          {/* ─── Cockpit de coût : ce que chaque tenant vous COÛTE en infra ─── */}
          <div style={{ marginBottom: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: C.muted }}>Coût & consommation par tenant</div>
          {cost && (
            <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 13, color: C.muted, flexWrap: 'wrap' }}>
              <span>Tenants suivis : <b style={{ color: C.text }}>{cost.totals?.tenants ?? 0}</b></span>
              <span>Dépassement en cours : <b style={{ color: (cost.totals?.overage_accruing_eur || 0) > 0 ? C.orange : C.text }}>{eur(cost.totals?.overage_accruing_eur)}</b></span>
              <span>À facturer : <b style={{ color: (cost.totals?.overage_pending_eur || 0) > 0 ? C.green : C.text }}>{eur(cost.totals?.overage_pending_eur)}</b></span>
              <span>À risque (IA ≥80 %) : <b style={{ color: (cost.totals?.ai_at_risk || 0) > 0 ? C.orange : C.text }}>{cost.totals?.ai_at_risk ?? 0}</b></span>
            </div>
          )}
          <div style={{ ...card, marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            {!cost ? (
              <div style={{ padding: 16, color: C.muted, fontSize: 14 }}>Chargement…</div>
            ) : (cost.tenants || []).length === 0 ? (
              <div style={{ padding: 16, color: C.muted, fontSize: 14 }}>Aucun tenant suivi.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.panel2, color: C.muted }}>
                      <th style={{ ...th, textAlign: 'left' }}>Tenant</th>
                      <th style={{ ...th, textAlign: 'left' }}>Plan</th>
                      <th style={{ ...th, textAlign: 'left' }}>IA (mois)</th>
                      <th style={{ ...th, textAlign: 'left' }}>Dépassement</th>
                      <th style={{ ...th, textAlign: 'left' }}>Live (min)</th>
                      <th style={{ ...th, textAlign: 'left' }}>État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cost.tenants || []).map((t) => {
                      const aiPct = Number(t.ai_pct_used) || 0;
                      const acc = Number(t.overage_accruing_eur) || 0;
                      const pend = Number(t.overage_pending_eur) || 0;
                      return (
                        <tr key={t.tenant_id} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={td}><b style={{ color: C.text }}>{t.tenant_slug}</b></td>
                          <td style={{ ...td, color: C.muted }}>{t.plan_name || t.plan_key || t.ai_plan_tier || '—'}</td>
                          <td style={td}>
                            {num(t.ai_consumed)} / {num(t.ai_included)}
                            <span style={{ color: aiPct >= 80 ? C.orange : C.muted, marginLeft: 6 }}>({aiPct} %)</span>
                          </td>
                          <td style={td}>
                            {acc > 0 ? <span style={{ color: C.orange }}>{eur(acc)} en cours</span> : <span style={{ color: C.muted }}>—</span>}
                            {pend > 0 && <span style={{ color: C.green, marginLeft: 6 }}>· {eur(pend)} à facturer</span>}
                          </td>
                          <td style={{ ...td, color: C.muted }}>{num(t.live_used)} / {num(t.live_included)}</td>
                          <td style={td}>
                            {t.ai_blocked ? <Badge c={C.red}>Bloqué</Badge>
                              : t.overage_active ? <Badge c={C.orange}>Dépassement</Badge>
                              : t.ai_at_risk ? <Badge c={C.orange}>IA ≥80 %</Badge>
                              : <Badge c={C.green}>OK</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Porte-monnaie par produit (couche logique) */}
          <div style={{ marginBottom: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: C.muted }}>Porte-monnaie (par produit)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 10 }}>
            {(fin?.wallets || []).map((w) => (
              <div key={w.key} style={{ ...card, borderLeft: `3px solid ${w.color || C.violet}` }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{w.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{money(w.balanceCents || 0, w.currency || 'XAF')}</div>
                <button onClick={() => { setAllocFor(w.key); setAllocAmt(''); }} style={{ marginTop: 8, background: 'transparent', color: C.muted, border: `1px solid ${C.border2}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Attribuer</button>
              </div>
            ))}
          </div>
          {allocFor && (
            <div style={{ ...card, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13 }}>Attribuer à <b>{allocFor}</b> :</span>
              <input type="number" value={allocAmt} onChange={(e) => setAllocAmt(e.target.value)} placeholder="montant XAF (négatif pour retirer)" style={{ ...input, width: 240 }} />
              <button onClick={allocate} style={{ background: C.violet, color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>OK</button>
              <button onClick={() => setAllocFor(null)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border2}`, borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 22, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="clé (ex: ecole)" style={{ ...input, width: 140 }} />
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Nom affiché" style={{ ...input, width: 180 }} />
            <button onClick={createWallet} disabled={creating || !newKey.trim() || !newLabel.trim()} style={{ background: C.green, color: 'white', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (creating || !newKey.trim() || !newLabel.trim()) ? 0.5 : 1 }}>+ Créer un porte-monnaie</button>
            {wMsg && <span style={{ fontSize: 12, color: wMsg.ok ? C.green : C.red }}>{wMsg.text}</span>}
          </div>

          <div style={{ marginBottom: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: C.muted }}>Solde réel (wallet pawaPay physique)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 8 }}>
            {balances.length === 0 ? (
              <div style={{ ...card, color: C.muted, fontSize: 14 }}>{fin ? 'Aucun solde disponible.' : 'Chargement…'}</div>
            ) : balances.map((b) => (
              <div key={b.country + b.currency} style={card}>
                <div style={{ fontSize: 12, color: C.muted }}>{b.country}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.green, marginTop: 4 }}>{money(Number(b.balance), b.currency)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 24, fontSize: 13, color: C.muted }}>
            <span>Revenus tenants payés : <b style={{ color: C.text }}>{fin ? money(fin.revenuePaidCents || 0, 'XAF') : '—'}</b></span>
            <span>Total retiré : <b style={{ color: C.text }}>{fin ? money(fin.withdrawnCents || 0, 'XAF') : '—'}</b></span>
          </div>

          <div style={{ ...card, marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Retirer vers mobile money</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: C.muted }}>Depuis quel porte-monnaie ?</label>
              <select value={walletKey} onChange={(e) => setWalletKey(e.target.value)} style={{ ...input, marginTop: 6 }}>
                <option value="">— (non attribué)</option>
                {(fin?.wallets || []).map((w) => <option key={w.key} value={w.key}>{w.label} · {money(w.balanceCents || 0, w.currency || 'XAF')}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={{ fontSize: 12, color: C.muted }}>Montant (XAF)</label><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2000" style={{ ...input, marginTop: 6 }} /></div>
              <div><label style={{ fontSize: 12, color: C.muted }}>Numéro mobile money</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="24177000000" style={{ ...input, marginTop: 6 }} /></div>
              <div><label style={{ fontSize: 12, color: C.muted }}>Opérateur</label><select value={mno} onChange={(e) => setMno(e.target.value)} style={{ ...input, marginTop: 6 }}>{MNOS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: C.muted }}>Motif</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reversement" style={{ ...input, marginTop: 6 }} /></div>
            </div>
            {msg && <p style={{ marginTop: 12, fontSize: 13, color: msg.ok ? C.green : C.red }}>{msg.text}</p>}
            {confirm ? (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 8, border: `1px solid ${C.red}`, background: 'rgba(239,68,68,.08)' }}>
                <p style={{ fontSize: 13, margin: 0 }}>⚠️ Envoyer <b>{money(amountCents(), 'XAF')}</b> vers <b>{phone}</b> ({mno}) ? Mouvement d&apos;argent réel.</p>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button onClick={submit} disabled={sending} style={{ background: C.red, color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{sending ? 'Envoi…' : 'Confirmer le retrait'}</button>
                  <button onClick={() => setConfirm(false)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setMsg(null); setConfirm(true); }} disabled={amountCents() <= 0 || !phone.trim()} style={{ marginTop: 14, background: C.violet, color: 'white', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (amountCents() <= 0 || !phone.trim()) ? 0.5 : 1 }}>Retirer</button>
            )}
          </div>

          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: C.muted, marginBottom: 8 }}>Historique des retraits</div>
          {loading ? <div style={{ color: C.muted, fontSize: 14 }}>Chargement…</div> : payouts.length === 0 ? <div style={{ color: C.muted, fontSize: 14 }}>Aucun retrait.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payouts.map((p) => (
                <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                  <div><div style={{ fontSize: 14, fontWeight: 500 }}>{p.recipient_name || p.phone_number} <span style={{ color: C.muted, fontSize: 12 }}>· {p.mno}</span></div><div style={{ fontSize: 12, color: C.muted }}>{p.reason || '—'} · {new Date(p.created_at).toLocaleString('fr-FR')}</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontSize: 14, fontWeight: 600 }}>{money(p.amount_cents, p.currency)}</div><div style={{ fontSize: 11, color: ['completed', 'accepted'].includes(String(p.status).toLowerCase()) ? C.green : ['failed', 'rejected'].includes(String(p.status).toLowerCase()) ? C.red : C.orange }}>{p.status}</div></div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
