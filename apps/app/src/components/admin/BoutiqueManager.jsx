/**
 * BoutiqueManager — back-office « Boutique » du tenant (moteur mbolo de l'API Cimolace).
 *
 * Le tenant owner/admin :
 *  - active la boutique (POST /mbolo/install → clé storefront + catégorie + produit exemple),
 *  - gère ses PRODUITS (liste / créer / éditer / supprimer) via mboloApi,
 *  - gère ses CODES PROMO (liste / créer / supprimer) via marketingApi.
 *
 * Tout est tenant-scoped côté API (clé mbk_ / JWT + TenantGuard). Style LIRI sombre + or.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Store, Plus, Loader2, Trash2, Pencil, Check, X, AlertCircle, Tag, Package, Power,
} from 'lucide-react';
import { mboloApi, marketingApi } from '@/lib/api-v2';

const INPUT =
  'w-full rounded-lg border border-white/10 bg-[#0F1419] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[var(--school-accent,#D4AF37)] focus:outline-none disabled:opacity-50';
const BTN_GOLD =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--school-accent,#D4AF37)] px-4 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50';

// Le marketing controller renvoie { data: X } puis l'intercepteur global ré-enveloppe →
// listPromos() peut donner X ou { data: X }. On normalise.
const asArray = (r) => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []);
const fmtPrice = (cents, currency) =>
  `${(Number(cents || 0) / 100).toLocaleString('fr-FR')} ${currency || 'EUR'}`;

const EMPTY_PRODUCT = { name: '', priceEur: '', currency: 'EUR', stock: '', imageUrl: '', description: '' };
const EMPTY_PROMO = { code: '', discount_type: 'percent', discount_value: '', max_uses: '', expires_at: '', is_active: true };

export default function BoutiqueManager() {
  const [tab, setTab] = useState('products'); // 'products' | 'promos'
  const [installed, setInstalled] = useState(null); // null = inconnu, true/false
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');

  // ── Produits ──
  const [products, setProducts] = useState([]);
  const [loadingP, setLoadingP] = useState(true);
  const [pForm, setPForm] = useState(EMPTY_PRODUCT);
  const [editId, setEditId] = useState(null);
  const [savingP, setSavingP] = useState(false);

  // ── Promos ──
  const [promos, setPromos] = useState([]);
  const [loadingC, setLoadingC] = useState(true);
  const [cForm, setCForm] = useState(EMPTY_PROMO);
  const [savingC, setSavingC] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoadingP(true);
    try {
      const data = await mboloApi.listProducts();
      const arr = asArray(data);
      setProducts(arr);
      setInstalled(true);
      setError('');
    } catch (err) {
      // Boutique non installée → l'API renvoie une erreur ; on propose l'activation.
      const msg = err?.message || '';
      if (/install|introuvable|not found|storefront/i.test(msg)) setInstalled(false);
      else { setInstalled(false); }
      setProducts([]);
    } finally {
      setLoadingP(false);
    }
  }, []);

  const loadPromos = useCallback(async () => {
    setLoadingC(true);
    try {
      setPromos(asArray(await marketingApi.listPromos()));
    } catch {
      setPromos([]);
    } finally {
      setLoadingC(false);
    }
  }, []);

  useEffect(() => { loadProducts(); loadPromos(); }, [loadProducts, loadPromos]);

  const handleInstall = async () => {
    setInstalling(true);
    setError('');
    try {
      await mboloApi.install({ withSample: true });
      await loadProducts();
    } catch (err) {
      setError(err?.message || "Impossible d'activer la boutique.");
    } finally {
      setInstalling(false);
    }
  };

  // ── Produits : créer / éditer / supprimer ──
  const submitProduct = async (e) => {
    e.preventDefault();
    setError('');
    if (!pForm.name.trim() || pForm.priceEur === '') {
      setError('Nom et prix requis.');
      return;
    }
    const body = {
      name: pForm.name.trim(),
      priceCents: Math.round(Number(pForm.priceEur) * 100),
      currency: pForm.currency || 'EUR',
      stock: pForm.stock === '' ? 0 : Number(pForm.stock),
      imageUrl: pForm.imageUrl.trim() || undefined,
      description: pForm.description.trim() || undefined,
    };
    setSavingP(true);
    try {
      if (editId) await mboloApi.updateProduct(editId, body);
      else await mboloApi.createProduct(body);
      setPForm(EMPTY_PRODUCT);
      setEditId(null);
      await loadProducts();
    } catch (err) {
      setError(err?.message || "Échec de l'enregistrement du produit.");
    } finally {
      setSavingP(false);
    }
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setPForm({
      name: p.name || '',
      priceEur: p.price_cents != null ? String(p.price_cents / 100) : '',
      currency: p.currency || 'EUR',
      stock: p.stock != null ? String(p.stock) : '',
      imageUrl: p.image_url || '',
      description: p.description || '',
    });
    setTab('products');
  };

  const removeProduct = async (id) => {
    if (!window.confirm('Supprimer ce produit ?')) return;
    try { await mboloApi.deleteProduct(id); await loadProducts(); }
    catch (err) { setError(err?.message || 'Suppression impossible.'); }
  };

  // ── Promos : créer / supprimer ──
  const submitPromo = async (e) => {
    e.preventDefault();
    setError('');
    if (!cForm.code.trim() || cForm.discount_value === '') {
      setError('Code et valeur requis.');
      return;
    }
    const body = {
      code: cForm.code.trim().toUpperCase(),
      discount_type: cForm.discount_type,
      discount_value: Number(cForm.discount_value),
      max_uses: cForm.max_uses === '' ? null : Number(cForm.max_uses),
      expires_at: cForm.expires_at || null,
      is_active: cForm.is_active,
    };
    setSavingC(true);
    try {
      await marketingApi.createPromo(body);
      setCForm(EMPTY_PROMO);
      await loadPromos();
    } catch (err) {
      setError(err?.message || 'Échec de la création du code promo.');
    } finally {
      setSavingC(false);
    }
  };

  const removePromo = async (id) => {
    if (!window.confirm('Supprimer ce code promo ?')) return;
    try { await marketingApi.deletePromo(id); await loadPromos(); }
    catch (err) { setError(err?.message || 'Suppression impossible.'); }
  };

  // ── Rendu ──
  if (installed === false && products.length === 0) {
    return (
      <div className="space-y-4">
        {error && <ErrorBox msg={error} />}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <Store className="mx-auto h-10 w-10 text-[var(--school-accent,#D4AF37)]" />
          <h3 className="mt-3 text-lg font-semibold text-white">Activez votre boutique</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
            Votre boutique en ligne (moteur mbolo) n'est pas encore activée. L'activation crée
            votre catalogue, une catégorie de départ et un produit exemple — vous pourrez tout
            modifier ensuite.
          </p>
          <button type="button" onClick={handleInstall} disabled={installing} className={`${BTN_GOLD} mx-auto mt-5`}>
            {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            {installing ? 'Activation…' : 'Activer la boutique'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex gap-2">
        <TabBtn active={tab === 'products'} onClick={() => setTab('products')} icon={Package}>
          Produits {products.length ? `(${products.length})` : ''}
        </TabBtn>
        <TabBtn active={tab === 'promos'} onClick={() => setTab('promos')} icon={Tag}>
          Codes promo {promos.length ? `(${promos.length})` : ''}
        </TabBtn>
      </div>

      {error && <ErrorBox msg={error} />}

      {tab === 'products' ? (
        <div className="space-y-4">
          {/* Formulaire produit */}
          <form onSubmit={submitProduct} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{editId ? 'Modifier le produit' : 'Ajouter un produit'}</p>
              {editId && (
                <button type="button" onClick={() => { setEditId(null); setPForm(EMPTY_PRODUCT); }} className="text-xs text-gray-400 hover:text-white">
                  Annuler l'édition
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nom"><input className={INPUT} value={pForm.name} onChange={(e) => setPForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nom du produit" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prix"><input type="number" step="0.01" min="0" className={INPUT} value={pForm.priceEur} onChange={(e) => setPForm((f) => ({ ...f, priceEur: e.target.value }))} placeholder="Ex : 49.90" /></Field>
                <Field label="Devise"><input className={INPUT} value={pForm.currency} onChange={(e) => setPForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} placeholder="EUR" maxLength={3} /></Field>
              </div>
              <Field label="Stock"><input type="number" min="0" className={INPUT} value={pForm.stock} onChange={(e) => setPForm((f) => ({ ...f, stock: e.target.value }))} placeholder="0" /></Field>
              <Field label="Image (URL)"><input className={INPUT} value={pForm.imageUrl} onChange={(e) => setPForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" /></Field>
              <Field label="Description" className="sm:col-span-2"><textarea rows={2} className={INPUT} value={pForm.description} onChange={(e) => setPForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description courte…" /></Field>
            </div>
            <button type="submit" disabled={savingP} className={`${BTN_GOLD} mt-3`}>
              {savingP ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editId ? 'Enregistrer' : 'Ajouter le produit'}
            </button>
          </form>

          {/* Liste produits */}
          {loadingP ? (
            <Loading />
          ) : products.length === 0 ? (
            <Empty msg="Aucun produit pour l'instant." />
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} /> : <Package className="m-3 h-6 w-6 text-gray-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                    <p className="text-xs text-gray-400">{fmtPrice(p.price_cents, p.currency)} · stock {p.stock ?? 0}{p.is_active === false ? ' · inactif' : ''}</p>
                  </div>
                  <button type="button" onClick={() => startEdit(p)} className="rounded-lg border border-white/10 p-2 text-gray-300 hover:bg-white/5" title="Modifier"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => removeProduct(p.id)} className="rounded-lg border border-white/10 p-2 text-red-400 hover:bg-red-500/10" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Formulaire promo */}
          <form onSubmit={submitPromo} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-3 text-sm font-semibold text-white">Créer un code promo</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Code"><input className={`${INPUT} font-mono uppercase`} value={cForm.code} onChange={(e) => setCForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="BIENVENUE10" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select className={INPUT} value={cForm.discount_type} onChange={(e) => setCForm((f) => ({ ...f, discount_type: e.target.value }))}>
                    <option value="percent">% (pourcentage)</option>
                    <option value="fixed">Montant fixe</option>
                  </select>
                </Field>
                <Field label={cForm.discount_type === 'percent' ? 'Valeur (%)' : 'Valeur'}><input type="number" min="0" step="0.01" className={INPUT} value={cForm.discount_value} onChange={(e) => setCForm((f) => ({ ...f, discount_value: e.target.value }))} placeholder={cForm.discount_type === 'percent' ? '10' : '5'} /></Field>
              </div>
              <Field label="Max utilisations (optionnel)"><input type="number" min="0" className={INPUT} value={cForm.max_uses} onChange={(e) => setCForm((f) => ({ ...f, max_uses: e.target.value }))} placeholder="illimité" /></Field>
              <Field label="Expire le (optionnel)"><input type="date" className={INPUT} value={cForm.expires_at} onChange={(e) => setCForm((f) => ({ ...f, expires_at: e.target.value }))} /></Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={cForm.is_active} onChange={(e) => setCForm((f) => ({ ...f, is_active: e.target.checked }))} /> Actif
            </label>
            <button type="submit" disabled={savingC} className={`${BTN_GOLD} mt-3`}>
              {savingC ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Créer le code
            </button>
          </form>

          {/* Liste promos */}
          {loadingC ? (
            <Loading />
          ) : promos.length === 0 ? (
            <Empty msg="Aucun code promo pour l'instant." />
          ) : (
            <div className="space-y-2">
              {promos.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <Tag className="h-4 w-4 shrink-0 text-[var(--school-accent,#D4AF37)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-bold text-white">{c.code}</p>
                    <p className="text-xs text-gray-400">
                      {c.discount_type === 'percent' ? `−${c.discount_value}%` : `−${c.discount_value}`}
                      {c.max_uses ? ` · ${c.uses_count ?? 0}/${c.max_uses} utilisés` : ''}
                      {c.expires_at ? ` · exp. ${String(c.expires_at).slice(0, 10)}` : ''}
                      {c.is_active === false ? ' · inactif' : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => removePromo(c.id)} className="rounded-lg border border-white/10 p-2 text-red-400 hover:bg-red-500/10" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-[var(--school-accent,#D4AF37)] text-black' : 'border border-white/10 text-gray-300 hover:bg-white/5'}`}>
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}
function Field({ label, children, className = '' }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-medium text-gray-300">{label}</label>
      {children}
    </div>
  );
}
function ErrorBox({ msg }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
      <AlertCircle className="h-4 w-4 shrink-0" /> {msg}
    </div>
  );
}
function Loading() {
  return <div className="flex items-center gap-2 py-4 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>;
}
function Empty({ msg }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-6 text-center text-sm text-gray-500">{msg}</div>;
}
