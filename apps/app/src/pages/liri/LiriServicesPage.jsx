import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Check, Tag, PackageOpen, Euro } from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { billingCatalogApi } from '@/lib/api-v2';

/**
 * LiriServicesPage — catalogue de SERVICES du tenant, DANS le portail LIRI (remplace le
 * « Catalogue & tarifs » de l'ancien Academy/OwnerDashboard). Chaque tenant déclare SES
 * services vendables (formations, masterclass, RDV, abonnements…) sur son propre portail.
 * Backend réutilisé tel quel : billingCatalogApi (/billing/catalog, CRUD sur billing_plans,
 * tenant résolu par X-Tenant-Slug). Style 100 % chaud LIRI (aucune fuite violet/bleu).
 */

// Catégories GÉNÉRIQUES (libellés neutres) mappées sur les valeurs backend imposées.
const CATEGORIES = [
  { value: 'cycle', label: 'Formation / cycle' },
  { value: 'masterclass', label: 'Masterclass' },
  { value: 'consultation', label: 'Consultation / RDV' },
  { value: 'mentorat', label: 'Accompagnement' },
  { value: 'temple', label: 'Abonnement / communauté' },
  { value: 'custom', label: 'Autre service' },
];
const CYCLES = [
  { value: 'monthly', label: 'par mois' },
  { value: 'yearly', label: 'par an' },
  { value: 'quarterly', label: 'par trimestre' },
  { value: 'weekly', label: 'par semaine' },
  { value: 'one_time', label: 'paiement unique' },
];
const catLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || 'Service';
const cycleLabel = (v) => CYCLES.find((c) => c.value === v)?.label || '';
const EMPTY = { key: null, label: '', category: 'custom', tagline: '', description: '', price: '', currency: 'EUR', billingCycle: 'monthly', isActive: true };

function fmtPrice(cents, currency) {
  if (cents == null) return '—';
  const v = (Number(cents) || 0) / 100;
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 2 }).format(v); }
  catch { return `${v.toFixed(2)} ${currency || 'EUR'}`; }
}

export default function LiriServicesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null); // objet form ou null
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null); // service à supprimer

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      // Défense-en-profondeur : `items` DOIT rester un tableau, sinon le useMemo
      // `items.filter` (activeCount) fait tomber tout le shell. `billingCatalogApi.list()`
      // coerce déjà, mais on reblinde ici au cas où l'endpoint changerait de forme.
      const r = await billingCatalogApi.list();
      setItems(Array.isArray(r) ? r : (r?.services ?? []));
    }
    catch (e) { setErr(e?.message || 'Impossible de charger les services.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => setEditing({ ...EMPTY });
  const openEdit = (s) => setEditing({
    key: s.key, label: s.label || '', category: s.category || 'custom', tagline: s.tagline || '',
    description: s.description || '', price: s.priceCents != null ? String((s.priceCents / 100)) : '',
    currency: s.currency || 'EUR', billingCycle: s.billingCycle || 'monthly', isActive: s.isActive !== false,
  });

  const save = async () => {
    if (!editing?.label.trim()) { setErr('Le nom du service est requis.'); return; }
    setSaving(true); setErr('');
    const priceCents = editing.price === '' ? 0 : Math.round(parseFloat(String(editing.price).replace(',', '.')) * 100);
    const body = {
      category: editing.category, label: editing.label.trim(), tagline: editing.tagline.trim() || null,
      description: editing.description.trim() || null, priceCents: Number.isFinite(priceCents) ? priceCents : 0,
      currency: editing.currency, billingCycle: editing.billingCycle, isActive: !!editing.isActive,
    };
    try {
      if (editing.key) await billingCatalogApi.update(editing.key, body);
      else await billingCatalogApi.create(body);
      setEditing(null); await load();
    } catch (e) { setErr(e?.message || 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (s) => {
    try { await billingCatalogApi.update(s.key, { isActive: !s.isActive }); await load(); }
    catch (e) { setErr(e?.message || 'Mise à jour impossible.'); }
  };
  const doDelete = async () => {
    if (!confirmDel) return;
    try { await billingCatalogApi.remove(confirmDel.key); setConfirmDel(null); await load(); }
    catch (e) { setErr(e?.message || 'Suppression impossible.'); setConfirmDel(null); }
  };

  const activeCount = useMemo(() => items.filter((s) => s.isActive !== false).length, [items]);

  return (
    <LiriPortalShell active="services" rail>
      <div className="lp-scroll relative min-h-0 overflow-y-auto" style={{ background: 'var(--base)', color: 'var(--ink)' }}>
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {/* En-tête */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight lp-ink">Services</h1>
              <p className="mt-1 text-[13.5px] lp-muted">Ce que ton organisation propose et vend — formations, RDV, abonnements. Visible dans ta vitrine, payable dans ton portail.</p>
            </div>
            <button onClick={openNew}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember">
              <Plus size={16} /> Nouveau service
            </button>
          </div>

          {items.length > 0 && (
            <p className="mt-3 text-[12px] lp-faint">{items.length} service{items.length > 1 ? 's' : ''} · {activeCount} actif{activeCount > 1 ? 's' : ''}</p>
          )}
          {err && <div className="mt-4 rounded-xl border px-3.5 py-2.5 text-[13px]" style={{ borderColor: 'rgba(226,85,63,.3)', background: 'rgba(226,85,63,.08)', color: '#e7a07f' }}>{err}</div>}

          {/* Contenu */}
          {loading ? (
            <div className="mt-16 flex items-center justify-center lp-muted"><Loader2 className="animate-spin" size={22} /></div>
          ) : items.length === 0 ? (
            <div className="mt-10 flex flex-col items-center rounded-2xl border lp-line px-6 py-14 text-center" style={{ background: 'var(--panel)' }}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl lp-coral" style={{ background: 'rgba(217,119,87,.12)' }}><PackageOpen size={24} /></span>
              <p className="mt-4 text-[15px] font-medium lp-ink">Aucun service pour le moment</p>
              <p className="mt-1 max-w-sm text-[13px] lp-muted">Crée ton premier service : un cycle de formation, une masterclass, un rendez-vous, un abonnement…</p>
              <button onClick={openNew} className="mt-5 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember"><Plus size={16} /> Créer un service</button>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((s) => (
                <div key={s.key} className="flex flex-col rounded-2xl border lp-line p-4 lp-tr" style={{ background: 'var(--panel)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium lp-coral" style={{ background: 'rgba(217,119,87,.12)' }}><Tag size={12} /> {catLabel(s.category)}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(s)} aria-label="Modifier" className="grid h-8 w-8 place-items-center rounded-lg lp-muted lp-railbtn lp-tr"><Pencil size={15} /></button>
                      <button onClick={() => setConfirmDel(s)} aria-label="Supprimer" className="grid h-8 w-8 place-items-center rounded-lg lp-muted lp-railbtn lp-tr"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <p className="mt-2.5 text-[15px] font-semibold lp-ink">{s.label}</p>
                  {s.tagline && <p className="mt-0.5 text-[12.5px] lp-muted">{s.tagline}</p>}
                  <div className="mt-auto flex items-center justify-between pt-3.5">
                    <span className="text-[15px] font-semibold lp-ink">{fmtPrice(s.priceCents, s.currency)}<span className="text-[12px] font-normal lp-faint"> {cycleLabel(s.billingCycle)}</span></span>
                    <button onClick={() => toggleActive(s)} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium lp-tr" style={s.isActive !== false ? { background: 'rgba(91,122,82,.2)', color: '#9ec08f' } : { background: 'rgba(245,244,238,.06)', color: 'var(--faint)' }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.isActive !== false ? '#7bbf6a' : 'var(--faint)' }} />
                      {s.isActive !== false ? 'Actif' : 'Masqué'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal création / édition */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: 'rgba(0,0,0,.55)' }} onClick={() => !saving && setEditing(null)}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border lp-line p-5 sm:rounded-3xl" style={{ background: '#221f1b' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold lp-ink">{editing.key ? 'Modifier le service' : 'Nouveau service'}</h2>
              <button onClick={() => !saving && setEditing(null)} className="grid h-8 w-8 place-items-center rounded-lg lp-muted lp-railbtn"><X size={17} /></button>
            </div>
            <div className="mt-4 space-y-3.5">
              <Field label="Nom du service">
                <input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="ex. Cycle fondamental" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Catégorie">
                  <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={inputCls}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value} style={{ background: '#221f1b' }}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Facturation">
                  <select value={editing.billingCycle} onChange={(e) => setEditing({ ...editing, billingCycle: e.target.value })} className={inputCls}>
                    {CYCLES.map((c) => <option key={c.value} value={c.value} style={{ background: '#221f1b' }}>{c.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Accroche (courte)">
                <input value={editing.tagline} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} placeholder="ex. 8 semaines pour maîtriser les bases" className={inputCls} />
              </Field>
              <Field label="Description">
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} placeholder="Ce que le service inclut…" className={inputCls} style={{ resize: 'vertical' }} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prix">
                  <div className="relative">
                    <Euro size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 lp-faint" />
                    <input value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} inputMode="decimal" placeholder="0" className={inputCls} style={{ paddingLeft: 30 }} />
                  </div>
                </Field>
                <Field label="Visibilité">
                  <button type="button" onClick={() => setEditing({ ...editing, isActive: !editing.isActive })}
                    className="flex h-[42px] w-full items-center justify-between rounded-xl border lp-line px-3 text-[13.5px] lp-tr" style={{ background: 'rgba(245,244,238,.03)' }}>
                    <span className="lp-ink">{editing.isActive ? 'Actif (visible)' : 'Masqué'}</span>
                    <span className="relative inline-flex h-5 w-9 items-center rounded-full lp-tr" style={{ background: editing.isActive ? 'var(--coral)' : 'rgba(245,244,238,.15)' }}>
                      <span className="absolute h-4 w-4 rounded-full bg-white lp-tr" style={{ left: editing.isActive ? 18 : 2 }} />
                    </span>
                  </button>
                </Field>
              </div>
            </div>
            {err && <p className="mt-3 text-[12.5px]" style={{ color: '#e7a07f' }}>{err}</p>}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => !saving && setEditing(null)} className="rounded-xl px-4 py-2 text-[13.5px] font-medium lp-muted lp-railbtn lp-tr">Annuler</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,.55)' }} onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl border lp-line p-5 text-center" style={{ background: '#221f1b' }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-medium lp-ink">Supprimer « {confirmDel.label} » ?</p>
            <p className="mt-1 text-[13px] lp-muted">Cette action est définitive.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={() => setConfirmDel(null)} className="rounded-xl px-4 py-2 text-[13.5px] font-medium lp-muted lp-railbtn">Annuler</button>
              <button onClick={doDelete} className="rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr" style={{ background: '#c2683f' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </LiriPortalShell>
  );
}

const inputCls = 'w-full rounded-xl border lp-line bg-transparent px-3 py-2.5 text-[14px] lp-ink outline-none placeholder:lp-faint focus:border-[var(--coral)]';
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium lp-muted">{label}</span>
      {children}
    </label>
  );
}
