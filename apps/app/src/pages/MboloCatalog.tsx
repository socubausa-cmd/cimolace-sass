import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  mboloApi,
  tenantsApi,
  type CreateMboloProduct,
  type MboloProduct,
} from '../lib/api';

/** Affiche un montant stocké en centimes dans la devise du produit. */
function money(cents: number, currency: string) {
  return `${(cents / 100).toLocaleString('fr-FR')} ${currency}`;
}

const EMPTY_PRODUCT = {
  name: '',
  slug: '',
  sku: '',
  categoryId: '',
  price: '',
  comparePrice: '',
  currency: 'XAF',
  stock: '',
  tagline: '',
  description: '',
  imageUrl: '',
  benefits: '',
  isFeatured: false,
};

export function MboloCatalog() {
  const qc = useQueryClient();
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const products = useQuery({ queryKey: ['mbolo-products'], queryFn: () => mboloApi.listProducts() });
  const categories = useQuery({ queryKey: ['mbolo-categories'], queryFn: mboloApi.listCategories });

  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_PRODUCT });
  const [cat, setCat] = useState({ slug: '', name: '', description: '' });
  const [error, setError] = useState('');

  const createProduct = useMutation({
    mutationFn: (body: CreateMboloProduct) => mboloApi.createProduct(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mbolo-products'] });
      setShowProductForm(false);
      setForm({ ...EMPTY_PRODUCT });
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const createCategory = useMutation({
    mutationFn: mboloApi.createCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mbolo-categories'] });
      setCat({ slug: '', name: '', description: '' });
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const catName = (id: string | null) =>
    categories.data?.find((c) => c.id === id)?.name ?? null;

  function submitProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      setError('Le nom et le prix sont obligatoires.');
      return;
    }
    const priceCents = Math.round(parseFloat(form.price) * 100);
    if (Number.isNaN(priceCents) || priceCents < 0) {
      setError('Prix invalide.');
      return;
    }
    const body: CreateMboloProduct = {
      name: form.name.trim(),
      priceCents,
      currency: form.currency || 'XAF',
      isFeatured: form.isFeatured,
    };
    if (form.slug.trim()) body.slug = form.slug.trim();
    if (form.sku.trim()) body.sku = form.sku.trim();
    if (form.categoryId) body.categoryId = form.categoryId;
    if (form.comparePrice) body.compareAtPriceCents = Math.round(parseFloat(form.comparePrice) * 100);
    if (form.stock) body.stock = parseInt(form.stock, 10) || 0;
    if (form.tagline.trim()) body.tagline = form.tagline.trim();
    if (form.description.trim()) body.description = form.description.trim();
    if (form.imageUrl.trim()) body.imageUrl = form.imageUrl.trim();
    const benefits = form.benefits.split(',').map((b) => b.trim()).filter(Boolean);
    if (benefits.length) body.benefits = benefits;
    createProduct.mutate(body);
  }

  const list = products.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">{tenant.data?.name ?? 'Cimolace tenant'}</p>
          <h1 className="font-semibold text-gray-900">Catalogue Mbolo</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/mbolo/orders" className="text-sm text-indigo-600 hover:underline">Commandes</Link>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:underline">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {products.data ? `${list.length} produit${list.length > 1 ? 's' : ''}` : 'Produits'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Le catalogue alimente votre boutique et l'API storefront (site client connecté via clé API).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCategoryPanel(!showCategoryPanel)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Catégories ({categories.data?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setShowProductForm(!showProductForm)}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              {showProductForm ? 'Fermer' : 'Nouveau produit'}
            </button>
          </div>
        </div>

        {products.isError && <p className="text-red-600 text-sm mb-4">{(products.error as Error).message}</p>}
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {showCategoryPanel && (
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Catégories</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {(categories.data ?? []).map((c) => (
                <span key={c.id} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 border border-indigo-100">
                  {c.name}
                </span>
              ))}
              {categories.data?.length === 0 && <span className="text-sm text-gray-400">Aucune catégorie.</span>}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!cat.slug.trim() || !cat.name.trim()) { setError('slug et nom de catégorie requis'); return; }
                createCategory.mutate({ slug: cat.slug.trim(), name: cat.name.trim(), description: cat.description.trim() || undefined });
              }}
              className="grid gap-3 md:grid-cols-3"
            >
              <input value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} placeholder="Nom" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input value={cat.slug} onChange={(e) => setCat({ ...cat, slug: e.target.value })} placeholder="slug-url" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" disabled={createCategory.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {createCategory.isPending ? '...' : 'Ajouter'}
              </button>
            </form>
          </section>
        )}

        {showProductForm && (
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Nouveau produit</h3>
            <form onSubmit={submitProduct} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">--</option>
                  {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix * ({form.currency})</label>
                <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix barré (optionnel)</label>
                <input type="number" step="0.01" min="0" value={form.comparePrice} onChange={(e) => setForm({ ...form, comparePrice: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="XAF">XAF</option>
                  <option value="XOF">XOF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto si vide" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Accroche</label>
                <input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Image (URL)</label>
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bénéfices (séparés par des virgules)</label>
                <input value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} placeholder="100% naturel, Sans additif" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="md:col-span-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="rounded" />
                  Produit en vedette
                </label>
                <button type="submit" disabled={createProduct.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  {createProduct.isPending ? 'Création...' : 'Créer le produit'}
                </button>
              </div>
            </form>
          </section>
        )}

        {products.isLoading && <p className="text-gray-500 text-sm">Chargement du catalogue...</p>}

        {products.data && list.length === 0 && !showProductForm && (
          <section className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <h3 className="font-semibold text-gray-900">Catalogue vide</h3>
            <p className="mt-2 text-sm text-gray-500">Ajoutez votre premier produit pour démarrer la boutique.</p>
            <button type="button" onClick={() => setShowProductForm(true)} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Ajouter un produit
            </button>
          </section>
        )}

        {list.length > 0 && (
          <div className="grid gap-3">
            {list.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                categoryName={catName(p.category_id)}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProductCard({
  product: p,
  categoryName,
  expanded,
  onToggle,
}: {
  product: MboloProduct;
  categoryName: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['mbolo-product', p.id],
    queryFn: () => mboloApi.getProduct(p.id),
    enabled: expanded,
  });
  const [img, setImg] = useState({ url: '', alt: '' });
  const [variant, setVariant] = useState({ label: '', priceDelta: '' });

  const addImage = useMutation({
    mutationFn: () => mboloApi.addImage(p.id, { url: img.url.trim(), alt: img.alt.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mbolo-product', p.id] }); qc.invalidateQueries({ queryKey: ['mbolo-products'] }); setImg({ url: '', alt: '' }); },
  });
  const addVariant = useMutation({
    mutationFn: () => mboloApi.addVariant(p.id, { label: variant.label.trim(), priceDeltaCents: variant.priceDelta ? Math.round(parseFloat(variant.priceDelta) * 100) : 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mbolo-product', p.id] }); setVariant({ label: '', priceDelta: '' }); },
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <button type="button" onClick={onToggle} className="w-full p-5 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded-md object-cover bg-gray-100" />
            ) : (
              <div className="h-12 w-12 rounded-md bg-gray-100" />
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
              <p className="text-sm text-gray-500 truncate">
                {money(p.price_cents, p.currency)}
                {p.compare_at_price_cents ? <span className="ml-2 text-gray-400 line-through">{money(p.compare_at_price_cents, p.currency)}</span> : null}
                {categoryName ? <span className="ml-2 text-gray-400">· {categoryName}</span> : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {p.is_featured && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">Vedette</span>}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600'}`}>
              {p.is_active ? 'Actif' : 'Inactif'}
            </span>
            <span className="text-xs text-gray-400">Stock {p.stock}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-5 bg-gray-50/50">
          {detail.isLoading && <p className="text-sm text-gray-500">Chargement...</p>}
          {detail.data && (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Images ({detail.data.images?.length ?? 0})</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(detail.data.images ?? []).map((im, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={im.url} alt={im.alt ?? ''} className="h-14 w-14 rounded-md object-cover bg-gray-100 border border-gray-200" />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={img.url} onChange={(e) => setImg({ ...img, url: e.target.value })} placeholder="URL image" className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button type="button" disabled={!img.url.trim() || addImage.isPending} onClick={() => addImage.mutate()} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50">+ Image</button>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Variantes ({detail.data.variants?.length ?? 0})</h4>
                <div className="space-y-1 mb-3">
                  {(detail.data.variants ?? []).map((v) => (
                    <div key={v.id} className="flex items-center justify-between rounded-md bg-white border border-gray-200 px-3 py-1.5 text-xs">
                      <span className="text-gray-700">{v.label}</span>
                      <span className="text-gray-500">{v.price_delta_cents ? `+${money(v.price_delta_cents, p.currency)}` : '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={variant.label} onChange={(e) => setVariant({ ...variant, label: e.target.value })} placeholder="Libellé" className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input value={variant.priceDelta} onChange={(e) => setVariant({ ...variant, priceDelta: e.target.value })} type="number" step="0.01" placeholder="+prix" className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button type="button" disabled={!variant.label.trim() || addVariant.isPending} onClick={() => addVariant.mutate()} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50">+ Variante</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
