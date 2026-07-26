import { useCallback, useEffect, useMemo, useState } from 'react';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { aiPricingAdminApi } from '@/lib/api-v2';

/**
 * TARIFICATION IA — pilotage de la logique métier SANS repasser par le code.
 *
 * Trois surfaces, toutes éditables ici :
 *   1. GRILLE  — crédits par token, par fournisseur/modèle/sens (entrée/sortie) ;
 *   2. PACKS   — recharges vendues aux tenants (crédits ↔ prix) ;
 *   3. PALIERS — quotas mensuels inclus par plan.
 *
 * ⚠️ POURQUOI CET ÉCRAN EXISTE (incident du 2026-07-26) :
 * `getCreditsPerUnit` renvoie **0** pour un modèle absent de `ai_pricing`. Quand
 * DeepSeek a retiré `deepseek-chat`, le code est passé à `deepseek-v4-*` mais la
 * grille est restée sur l'ancien nom → toute la consommation a été facturée ZÉRO,
 * sans alerte, et le contrôle de solde ne protégeait plus rien. Le bandeau
 * « trous de tarification » en haut de page rend ce cas VISIBLE en permanence.
 */

const C = {
  bg: '#0d1117', panel: '#161b22', panel2: '#1c2128', border: '#21262d', border2: '#30363d',
  green: '#10b981', orange: '#f59e0b', red: '#ef4444', blue: '#3b82f6',
  text: '#f0f6fc', muted: '#8b949e', muted2: '#6e7681',
};

const eur = (cents) => `${(Number(cents || 0) / 100).toFixed(2)} €`;

/** Champ numérique qui ne remonte la valeur qu'à la validation (blur/Entrée). */
function NumField({ value, onCommit, step = 0.001, width = 110, suffix }) {
  const [v, setV] = useState(String(value ?? ''));
  useEffect(() => { setV(String(value ?? '')); }, [value]);
  const commit = () => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) { setV(String(value ?? '')); return; }
    if (n !== Number(value)) onCommit(n);
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <input
        type="number" step={step} min="0" value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        style={{
          width, borderRadius: 7, border: `1px solid ${C.border2}`, background: C.bg,
          color: C.text, padding: '6px 9px', fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
        }}
      />
      {suffix && <span style={{ fontSize: 11.5, color: C.muted2 }}>{suffix}</span>}
    </span>
  );
}

export default function AiPricingAdminPage() {
  const [rows, setRows] = useState([]);
  const [gaps, setGaps] = useState([]);
  const [packs, setPacks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const [r, g, p, q] = await Promise.all([
        aiPricingAdminApi.list().catch(() => []),
        aiPricingAdminApi.gaps().catch(() => []),
        aiPricingAdminApi.listPackages().catch(() => []),
        aiPricingAdminApi.listPlans().catch(() => []),
      ]);
      setRows(Array.isArray(r) ? r : []);
      setGaps(Array.isArray(g) ? g : []);
      setPacks(Array.isArray(p) ? p : []);
      setPlans(Array.isArray(q) ? q : []);
    } catch (e) {
      setErr(e?.message || 'Chargement impossible.');
    }
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2600); };

  const patchRow = async (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try { await aiPricingAdminApi.update(id, patch); flash('Tarif enregistré.'); }
    catch (e) { setErr(e?.message || 'Enregistrement impossible.'); load(); }
  };

  const fillGap = async (provider, model, unit_type) => {
    try {
      await aiPricingAdminApi.upsert({ provider, model, unit_type, credits_per_unit: 0.001 });
      flash(`${model} · ${unit_type} créé à 0,001 — ajuste la valeur.`);
      load();
    } catch (e) { setErr(e?.message || 'Création impossible.'); }
  };

  /** Groupé par fournisseur → modèle, pour que « entrée » et « sortie » soient côte à côte. */
  const grouped = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const k = `${r.provider}/${r.model}`;
      if (!m.has(k)) m.set(k, { provider: r.provider, model: r.model, units: {} });
      m.get(k).units[r.unit_type] = r;
    }
    return [...m.values()].sort((a, b) => (a.provider + a.model).localeCompare(b.provider + b.model));
  }, [rows]);

  const card = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 18 };
  const h2 = { margin: '0 0 4px', fontSize: 15.5, fontWeight: 700, color: C.text };
  const sub = { margin: '0 0 14px', fontSize: 12.5, color: C.muted, lineHeight: 1.5 };
  const th = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: C.muted2, padding: '0 10px 8px 0', fontWeight: 600 };
  const td = { padding: '9px 10px 9px 0', borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.text };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <CimolaceHeader />
      <div style={{ display: 'flex' }}>
        <CimolaceSidebar />
        <main style={{ flex: 1, padding: '26px 28px 60px', maxWidth: 1180 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700 }}>Tarification IA</h1>
          <p style={{ margin: '0 0 22px', fontSize: 13, color: C.muted, maxWidth: 760, lineHeight: 1.6 }}>
            La logique métier de facturation IA, pilotable sans toucher au code : combien coûte
            un jeton, ce que vaut un pack de recharge, ce qu'un palier inclut chaque mois.
          </p>

          {err && (
            <div style={{ ...card, borderColor: C.red, background: 'rgba(239,68,68,.08)', color: '#fca5a5' }}>{err}</div>
          )}
          {msg && (
            <div style={{ ...card, borderColor: C.green, background: 'rgba(16,185,129,.08)', color: '#6ee7b7' }}>{msg}</div>
          )}

          {/* ── Trous de tarification : le garde-fou anti-facturation-muette ── */}
          {gaps.length > 0 && (
            <div style={{ ...card, borderColor: C.orange, background: 'rgba(245,158,11,.07)' }}>
              <h2 style={{ ...h2, color: C.orange }}>⚠️ {gaps.length} modèle(s) consommé(s) sans tarif</h2>
              <p style={sub}>
                Ces modèles sont réellement appelés mais n'ont pas de tarif actif : leur
                consommation est comptée <strong>0 crédit</strong> et le contrôle de solde ne les
                arrête pas. C'est ce qui arrive après un changement de modèle chez un fournisseur.
              </p>
              {gaps.map((g) => (
                <div key={`${g.provider}/${g.model}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
                  <code style={{ fontSize: 12.5, color: C.text }}>{g.provider} / {g.model}</code>
                  <span style={{ fontSize: 11.5, color: C.muted2 }}>{g.calls} appel(s)</span>
                  <span style={{ flex: 1 }} />
                  {g.missing.map((u) => (
                    <button key={u} type="button" onClick={() => fillGap(g.provider, g.model, u)}
                      style={{ borderRadius: 7, border: 'none', background: C.orange, color: '#111', padding: '5px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + définir {u === 'tokens_in' ? 'entrée' : 'sortie'}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ── 1. Grille par modèle ── */}
          <section style={card}>
            <h2 style={h2}>Grille — crédits par jeton</h2>
            <p style={sub}>
              Un modèle sans ligne active est facturé zéro. Décocher « actif » revient donc à
              rendre le modèle gratuit, pas à l'interdire.
            </p>
            {busy ? <p style={{ color: C.muted }}>Chargement…</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                  <thead><tr>
                    <th style={th}>Fournisseur</th><th style={th}>Modèle</th>
                    <th style={th}>Entrée</th><th style={th}>Sortie</th><th style={th}>Actif</th>
                  </tr></thead>
                  <tbody>
                    {grouped.map((g) => {
                      const ri = g.units.tokens_in, ro = g.units.tokens_out;
                      const on = (ri?.is_active ?? false) || (ro?.is_active ?? false);
                      return (
                        <tr key={`${g.provider}/${g.model}`} style={{ opacity: on ? 1 : 0.45 }}>
                          <td style={td}>{g.provider}</td>
                          <td style={{ ...td, fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5 }}>{g.model}</td>
                          <td style={td}>
                            {ri ? <NumField value={ri.credits_per_unit} onCommit={(v) => patchRow(ri.id, { credits_per_unit: v })} />
                                : <button type="button" onClick={() => fillGap(g.provider, g.model, 'tokens_in')} style={{ background: 'none', border: `1px dashed ${C.border2}`, color: C.muted, borderRadius: 7, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>+ définir</button>}
                          </td>
                          <td style={td}>
                            {ro ? <NumField value={ro.credits_per_unit} onCommit={(v) => patchRow(ro.id, { credits_per_unit: v })} />
                                : <button type="button" onClick={() => fillGap(g.provider, g.model, 'tokens_out')} style={{ background: 'none', border: `1px dashed ${C.border2}`, color: C.muted, borderRadius: 7, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>+ définir</button>}
                          </td>
                          <td style={td}>
                            <input type="checkbox" checked={on}
                              onChange={(e) => { const v = e.target.checked; [ri, ro].filter(Boolean).forEach((r) => patchRow(r.id, { is_active: v })); }}
                              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.green }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── 2. Packs de recharge ── */}
          <section style={card}>
            <h2 style={h2}>Packs de recharge</h2>
            <p style={sub}>Ce que le tenant achète. Le prix Stripe reste géré côté Stripe ; ici on règle crédits, prix affiché et disponibilité.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                <thead><tr>
                  <th style={th}>Pack</th><th style={th}>Crédits</th><th style={th}>Prix</th>
                  <th style={th}>€ / 1 000 cr.</th><th style={th}>Actif</th>
                </tr></thead>
                <tbody>
                  {packs.map((p) => {
                    const ratio = p.credits_amount ? (p.price_cents / 100) / (p.credits_amount / 1000) : 0;
                    return (
                      <tr key={p.id}>
                        <td style={td}>{p.label}</td>
                        <td style={td}><NumField value={p.credits_amount} step={100} width={120}
                          onCommit={async (v) => { try { await aiPricingAdminApi.updatePackage(p.id, { credits_amount: v }); flash('Pack mis à jour.'); load(); } catch (e) { setErr(e?.message || 'Échec.'); } }} /></td>
                        <td style={td}><NumField value={p.price_cents} step={100} width={120} suffix={eur(p.price_cents)}
                          onCommit={async (v) => { try { await aiPricingAdminApi.updatePackage(p.id, { price_cents: v }); flash('Pack mis à jour.'); load(); } catch (e) { setErr(e?.message || 'Échec.'); } }} /></td>
                        <td style={{ ...td, color: C.muted }}>{ratio ? `${ratio.toFixed(2)} €` : '—'}</td>
                        <td style={td}>
                          <input type="checkbox" checked={!!p.is_active}
                            onChange={async (e) => { try { await aiPricingAdminApi.updatePackage(p.id, { is_active: e.target.checked }); load(); } catch (er) { setErr(er?.message || 'Échec.'); } }}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.green }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 3. Paliers ── */}
          {plans.length > 0 && (
            <section style={card}>
              <h2 style={h2}>Paliers — crédits inclus par mois</h2>
              <p style={sub}>Ce que chaque plan offre avant facturation au dépassement.</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead><tr><th style={th}>Palier</th><th style={th}>Crédits / mois</th></tr></thead>
                  <tbody>
                    {plans.map((pl) => (
                      <tr key={pl.id}>
                        <td style={td}>{pl.plan_tier || pl.tier || pl.key || '—'}</td>
                        <td style={td}><NumField value={pl.monthly_credits} step={100} width={130}
                          onCommit={async (v) => { try { await aiPricingAdminApi.updatePlan(pl.id, { monthly_credits: v }); flash('Palier mis à jour.'); load(); } catch (e) { setErr(e?.message || 'Échec.'); } }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
