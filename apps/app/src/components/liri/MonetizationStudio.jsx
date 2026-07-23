import React, { useEffect, useState } from 'react';
import { BadgePercent, Ticket, Plus, Trash2, Power, Check } from 'lucide-react';
import { apiV2, tenantsApi, promoCodesApi } from '@/lib/api-v2';

/**
 * STUDIO MONÉTISATION (back-office propriétaire, rendu dans /liri/services) :
 *  1. Réductions boutique/événements par PALIER de forfait — configurables (avant : 25/40/50/60 en
 *     dur). Stockées dans tenants.metadata.settings.memberDiscounts, lues par TierAccessPanel.
 *  2. Codes promo — créer / activer / supprimer ; appliqués CÔTÉ SERVEUR au checkout forfait
 *     (offering-checkout), suivi des utilisations.
 */

const CYCLE_LABELS = { autonome: 'Autonome', academique: 'Académique', prive: 'Privé', privilegie: 'Privilégié' };
const DEFAULT_DISCOUNTS = { autonome: 25, academique: 40, prive: 50, privilegie: 60 };

const card = {
  borderRadius: 16, border: '1px solid rgba(245,244,238,.12)',
  background: 'rgba(255,255,255,.03)', padding: 18, color: 'var(--lp-ink, #f5f1e9)',
};
const h = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, fontWeight: 700, fontSize: 15 };
const iconBox = (c) => ({ display: 'grid', placeItems: 'center', height: 34, width: 34, borderRadius: 10, background: `${c}1f`, color: c });
const inputS = {
  borderRadius: 10, border: '1px solid rgba(245,244,238,.16)', background: 'rgba(0,0,0,.25)',
  color: 'inherit', padding: '8px 10px', fontSize: 13,
};
const btnS = (bg = '#d97757') => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, border: 'none',
  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: bg, color: '#fff',
});

/** Carte 1 — Réductions par palier. */
function DiscountsCard() {
  const [vals, setVals] = useState(DEFAULT_DISCOUNTS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    apiV2.get('/tenants/current').then((res) => {
      let d = res?.data; while (d && typeof d === 'object' && 'data' in d) d = d.data;
      const conf = d?.metadata?.settings?.memberDiscounts;
      if (alive && conf && typeof conf === 'object') setVals({ ...DEFAULT_DISCOUNTS, ...conf });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const save = async () => {
    setSaving(true); setErr(''); setSaved(false);
    try {
      await tenantsApi.updateSettings({ memberDiscounts: vals });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { setErr(e?.message || 'Échec de la sauvegarde.'); }
    setSaving(false);
  };

  return (
    <div style={card}>
      <div style={h}><span style={iconBox('#e6cc92')}><BadgePercent size={18} /></span> Réductions par forfait</div>
      <p style={{ fontSize: 12.5, opacity: 0.7, margin: '0 0 12px' }}>
        % de réduction sur la boutique &amp; les événements selon le forfait du membre (affiché sur la page Forfaits).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {Object.keys(CYCLE_LABELS).map((k) => (
          <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <span style={{ opacity: 0.75 }}>{CYCLE_LABELS[k]}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number" min={0} max={90} value={vals[k] ?? 0}
                onChange={(e) => setVals((v) => ({ ...v, [k]: Math.min(90, Math.max(0, Math.round(Number(e.target.value) || 0))) }))}
                style={{ ...inputS, width: 72 }}
              />
              <span style={{ opacity: 0.6 }}>%</span>
            </div>
          </label>
        ))}
      </div>
      {err && <p style={{ color: '#e58a5f', fontSize: 12, margin: '10px 0 0' }}>{err}</p>}
      <div style={{ marginTop: 14 }}>
        <button type="button" onClick={save} disabled={saving} style={btnS(saved ? 'rgba(91,122,82,.85)' : '#d97757')}>
          {saved ? <><Check size={15} /> Enregistré</> : (saving ? 'Enregistrement…' : 'Enregistrer les réductions')}
        </button>
      </div>
    </div>
  );
}

/** Carte 2 — Codes promo. */
function PromoCodesCard() {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', kind: 'percent', value: '', maxRedemptions: '', expiresAt: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => promoCodesApi.list().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr('');
    const v = parseFloat(String(form.value).replace(',', '.'));
    if (!form.code.trim() || !Number.isFinite(v) || v <= 0) { setErr('Code et valeur obligatoires.'); return; }
    setBusy(true);
    try {
      await promoCodesApi.create({
        code: form.code.trim().toUpperCase(),
        ...(form.kind === 'percent' ? { percentOff: Math.round(v) } : { amountOffCents: Math.round(v * 100) }),
        ...(form.maxRedemptions ? { maxRedemptions: Math.round(Number(form.maxRedemptions)) } : {}),
        ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt + 'T23:59:59').toISOString() } : {}),
      });
      setForm({ code: '', kind: 'percent', value: '', maxRedemptions: '', expiresAt: '' });
      setShowForm(false);
      await load();
    } catch (e) { setErr(e?.message || 'Échec de la création.'); }
    setBusy(false);
  };

  const fmtOff = (r) => (r.percent_off != null ? `−${r.percent_off} %` : `−${(r.amount_off_cents / 100).toFixed(2)} €`);

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={h}><span style={iconBox('#d97757')}><Ticket size={18} /></span> Codes promo</div>
        <button type="button" onClick={() => setShowForm((s) => !s)} style={btnS()}>
          <Plus size={15} /> {showForm ? 'Fermer' : 'Nouveau code'}
        </button>
      </div>
      <p style={{ fontSize: 12.5, opacity: 0.7, margin: '2px 0 12px' }}>
        Réduction appliquée au paiement d'un forfait quand le membre saisit le code (suivi des utilisations inclus).
      </p>

      {showForm && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginBottom: 14, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,.18)' }}>
          <label style={{ fontSize: 11.5, opacity: 0.8 }}>Code<br />
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="BIENVENUE10" style={{ ...inputS, width: 140, fontFamily: "'JetBrains Mono',monospace" }} />
          </label>
          <label style={{ fontSize: 11.5, opacity: 0.8 }}>Type<br />
            <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} style={{ ...inputS, width: 110 }}>
              <option value="percent">% </option>
              <option value="amount">€ fixes</option>
            </select>
          </label>
          <label style={{ fontSize: 11.5, opacity: 0.8 }}>Valeur<br />
            <input type="number" min={1} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder={form.kind === 'percent' ? '10' : '5'} style={{ ...inputS, width: 84 }} />
          </label>
          <label style={{ fontSize: 11.5, opacity: 0.8 }}>Utilisations max (opt.)<br />
            <input type="number" min={1} value={form.maxRedemptions} onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))} placeholder="∞" style={{ ...inputS, width: 100 }} />
          </label>
          <label style={{ fontSize: 11.5, opacity: 0.8 }}>Expire le (opt.)<br />
            <input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} style={{ ...inputS, width: 140 }} />
          </label>
          <button type="button" onClick={create} disabled={busy} style={btnS()}>{busy ? 'Création…' : 'Créer'}</button>
        </div>
      )}
      {err && <p style={{ color: '#e58a5f', fontSize: 12, margin: '0 0 10px' }}>{err}</p>}

      {rows.length === 0 ? (
        <p style={{ fontSize: 12.5, opacity: 0.55 }}>Aucun code promo pour l'instant.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,.16)', opacity: r.is_active ? 1 : 0.5 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 13 }}>{r.code}</span>
              <span style={{ fontSize: 12.5, color: '#e6cc92' }}>{fmtOff(r)}</span>
              <span style={{ fontSize: 11.5, opacity: 0.6 }}>
                {r.redeemed_count || 0} utilisation{(r.redeemed_count || 0) > 1 ? 's' : ''}
                {r.max_redemptions != null ? ` / ${r.max_redemptions}` : ''}
                {r.expires_at ? ` · expire ${new Date(r.expires_at).toLocaleDateString('fr-FR')}` : ''}
                {!r.is_active ? ' · désactivé' : ''}
              </span>
              <span style={{ flex: 1 }} />
              <button type="button" title={r.is_active ? 'Désactiver' : 'Réactiver'}
                onClick={() => promoCodesApi.update(r.id, { isActive: !r.is_active }).then(load).catch(() => {})}
                style={{ ...btnS(r.is_active ? 'rgba(245,244,238,.14)' : 'rgba(91,122,82,.75)'), padding: '6px 9px' }}>
                <Power size={14} />
              </button>
              <button type="button" title="Supprimer"
                onClick={() => promoCodesApi.remove(r.id).then(load).catch(() => {})}
                style={{ ...btnS('rgba(180,60,40,.6)'), padding: '6px 9px' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MonetizationStudio() {
  return (
    <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
      <DiscountsCard />
      <PromoCodesCard />
    </div>
  );
}
