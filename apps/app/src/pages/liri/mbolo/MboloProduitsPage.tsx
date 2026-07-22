import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Star,
  X,
  Loader2,
  AlertCircle,
  ImageOff,
  Check,
} from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { mboloApi, type CreateMboloProduct } from '@/lib/api';

const CORAL = 'var(--coral, #d97757)';
const LINE = 'rgba(255,255,255,.08)';

/** Affiche un montant stocké en CENTIMES dans sa devise (défaut XAF). */
function money(cents: number, currency?: string) {
  return `${(cents / 100).toLocaleString('fr-FR')} ${currency || 'XAF'}`;
}

const CURRENCIES = ['XAF', 'XOF', 'EUR', 'USD'];

interface FormState {
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  price: string;
  comparePrice: string;
  currency: string;
  stock: string;
  tagline: string;
  description: string;
  imageUrl: string;
  benefits: string;
  isFeatured: boolean;
}

const EMPTY_FORM: FormState = {
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

/** Pré-remplit le formulaire depuis une ligne produit (centimes → unités). */
function formFromProduct(p: any): FormState {
  return {
    name: p.name ?? '',
    slug: p.slug ?? '',
    sku: p.sku ?? '',
    categoryId: p.category_id ?? '',
    price: p.price_cents != null ? String(p.price_cents / 100) : '',
    comparePrice: p.compare_at_price_cents != null ? String(p.compare_at_price_cents / 100) : '',
    currency: p.currency ?? 'XAF',
    stock: p.stock != null ? String(p.stock) : '',
    tagline: p.tagline ?? '',
    description: p.description ?? '',
    imageUrl: p.image_url ?? '',
    benefits: Array.isArray(p.benefits) ? p.benefits.join('\n') : '',
    isFeatured: !!p.is_featured,
  };
}

export function MboloProduitsPage() {
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ['mbolo-products'], queryFn: () => mboloApi.listProducts() });
  const categories = useQuery({ queryKey: ['mbolo-categories'], queryFn: mboloApi.listCategories });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const catName = useMemo(
    () => (id: string | null) => categories.data?.find((c) => c.id === id)?.name ?? null,
    [categories.data],
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setOpen(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setForm(formFromProduct(p));
    setError('');
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError('');
  }

  const saveMut = useMutation({
    mutationFn: (payload: { id?: string; body: any }) =>
      payload.id ? mboloApi.updateProduct(payload.id, payload.body) : mboloApi.createProduct(payload.body as CreateMboloProduct),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mbolo-products'] });
      closeForm();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => mboloApi.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mbolo-products'] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.price) {
      setError('Le nom et le prix sont obligatoires.');
      return;
    }
    const priceCents = Math.round(parseFloat(form.price) * 100);
    if (Number.isNaN(priceCents) || priceCents < 0) {
      setError('Prix invalide.');
      return;
    }
    const body: any = {
      name: form.name.trim(),
      priceCents,
      currency: form.currency || 'XAF',
      isFeatured: form.isFeatured,
    };
    if (form.slug.trim()) body.slug = form.slug.trim();
    if (form.sku.trim()) body.sku = form.sku.trim();
    if (form.categoryId) body.categoryId = form.categoryId;
    if (form.comparePrice) {
      const c = Math.round(parseFloat(form.comparePrice) * 100);
      if (!Number.isNaN(c)) body.compareAtPriceCents = c;
    }
    if (form.stock) body.stock = parseInt(form.stock, 10) || 0;
    if (form.tagline.trim()) body.tagline = form.tagline.trim();
    if (form.description.trim()) body.description = form.description.trim();
    if (form.imageUrl.trim()) body.imageUrl = form.imageUrl.trim();
    const benefits = form.benefits.split('\n').map((b) => b.trim()).filter(Boolean);
    body.benefits = benefits;
    saveMut.mutate({ id: editing?.id, body });
  }

  const list: any[] = products.data ?? [];
  const inputCls =
    'w-full rounded-xl border bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none';

  return (
    <LiriPortalShell active="produits">
      <div className="relative flex h-full w-full flex-col items-center overflow-y-auto text-white">
        <div className="relative z-10 w-full max-w-5xl px-4 py-6 sm:px-6">
          {/* en-tête de section */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[22px] font-medium leading-tight" style={{ fontFamily: 'var(--lp-serif, Georgia, serif)' }}>
                Produits
              </h1>
              <p className="mt-0.5 text-[12.5px] text-white/45">
                {products.data
                  ? `${list.length} produit${list.length > 1 ? 's' : ''} au catalogue mbolo`
                  : 'Catalogue de votre boutique mbolo'}
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: CORAL }}
            >
              <Plus size={16} /> Nouveau produit
            </button>
          </div>

          {products.isError && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-[13px] text-red-300" style={{ borderColor: 'rgba(239,106,82,.3)', background: 'rgba(239,106,82,.06)' }}>
              <AlertCircle size={16} /> {(products.error as Error).message}
            </div>
          )}

          {/* Chargement */}
          {products.isLoading && (
            <div className="flex items-center gap-2 rounded-2xl border px-5 py-8 text-[13px] text-white/50" style={{ borderColor: LINE }}>
              <Loader2 size={16} className="animate-spin" /> Chargement du catalogue…
            </div>
          )}

          {/* Vide */}
          {products.data && list.length === 0 && (
            <div className="rounded-2xl border px-6 py-14 text-center" style={{ borderColor: LINE, background: 'rgba(255,255,255,.02)' }}>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl" style={{ background: 'rgba(217,119,87,.12)' }}>
                <Package size={22} style={{ color: CORAL }} />
              </div>
              <h3 className="mt-4 text-[15px] font-medium text-white">Aucun produit</h3>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-white/45">Créez le premier produit de votre boutique mbolo pour démarrer votre catalogue.</p>
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: CORAL }}
              >
                <Plus size={16} /> Créer le premier produit
              </button>
            </div>
          )}

          {/* Table */}
          {list.length > 0 && (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: LINE }}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.12em] text-white/35">
                      <th className="px-4 py-3 font-medium">Produit</th>
                      <th className="px-4 py-3 font-medium">Prix</th>
                      <th className="px-4 py-3 font-medium">Stock</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id} className="border-t" style={{ borderColor: LINE }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt={p.name} className="h-11 w-11 shrink-0 rounded-lg object-cover" style={{ background: 'rgba(255,255,255,.06)' }} />
                            ) : (
                              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" style={{ background: 'rgba(255,255,255,.05)' }}>
                                <ImageOff size={16} className="text-white/25" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] font-medium text-white">{p.name}</p>
                              <p className="truncate text-[11.5px] text-white/40">
                                {catName(p.category_id) ?? (p.slug ? `/${p.slug}` : 'Sans catégorie')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="text-[13px] text-white">{money(p.price_cents, p.currency)}</div>
                          {p.compare_at_price_cents ? (
                            <div className="text-[11.5px] text-white/35 line-through">{money(p.compare_at_price_cents, p.currency)}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-middle text-[13px] text-white/70">{p.stock ?? 0}</td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {p.is_featured && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'rgba(217,119,87,.14)', color: CORAL }}>
                                <Star size={11} /> Vedette
                              </span>
                            )}
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={
                                p.is_active
                                  ? { background: 'rgba(109,143,96,.18)', color: '#9ec089' }
                                  : { background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.45)' }
                              }
                            >
                              {p.is_active ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-white"
                              aria-label="Modifier"
                              title="Modifier"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(p)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-[rgba(239,106,82,.12)] hover:text-[#ef6a52]"
                              aria-label="Supprimer"
                              title="Supprimer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Panneau formulaire (création / édition) */}
        {open && (
          <div
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4"
            style={{ background: 'rgba(0,0,0,.6)' }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !saveMut.isPending) closeForm();
            }}
          >
            <div
              className="my-8 w-full max-w-[560px] overflow-hidden rounded-2xl border"
              style={{ borderColor: LINE, background: '#221f1b', boxShadow: '0 40px 90px -20px rgba(0,0,0,.8)' }}
            >
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: LINE }}>
                <span className="flex items-center gap-2 text-[15px] font-semibold text-white">
                  <Package size={17} style={{ color: CORAL }} />
                  {editing ? 'Modifier le produit' : 'Nouveau produit'}
                </span>
                <button
                  type="button"
                  onClick={closeForm}
                  className="grid h-7 w-7 place-items-center rounded-lg text-white/40 transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-white"
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={submit} className="max-h-[70vh] overflow-y-auto px-5 py-5">
                {error && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] text-red-300" style={{ borderColor: 'rgba(239,106,82,.3)', background: 'rgba(239,106,82,.06)' }}>
                    <AlertCircle size={15} /> {error}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Nom *</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} style={{ borderColor: LINE }} required />
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Catégorie</label>
                    <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inputCls} style={{ borderColor: LINE }}>
                      <option value="" className="bg-[#221f1b]">— Aucune —</option>
                      {(categories.data ?? []).map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#221f1b]">{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Devise</label>
                    <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputCls} style={{ borderColor: LINE }}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c} className="bg-[#221f1b]">{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Prix * ({form.currency})</label>
                    <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} style={{ borderColor: LINE }} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Prix barré</label>
                    <input type="number" step="0.01" min="0" value={form.comparePrice} onChange={(e) => setForm({ ...form, comparePrice: e.target.value })} placeholder="optionnel" className={inputCls} style={{ borderColor: LINE }} />
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Stock</label>
                    <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={inputCls} style={{ borderColor: LINE }} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-white/55">SKU</label>
                    <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={inputCls} style={{ borderColor: LINE }} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Slug</label>
                    <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto si vide" className={inputCls} style={{ borderColor: LINE }} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Accroche</label>
                    <input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className={inputCls} style={{ borderColor: LINE }} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Description</label>
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={`${inputCls} resize-none`} style={{ borderColor: LINE }} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Image (URL)</label>
                    <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" className={inputCls} style={{ borderColor: LINE }} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[12px] font-medium text-white/55">Bénéfices (une ligne par bénéfice)</label>
                    <textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} rows={3} placeholder={'100% naturel\nSans additif\nFabriqué localement'} className={`${inputCls} resize-none`} style={{ borderColor: LINE }} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-white/70">
                      <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="h-4 w-4 rounded accent-[#d97757]" />
                      <span className="inline-flex items-center gap-1.5"><Star size={14} style={{ color: CORAL }} /> Mettre en vedette</span>
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex gap-2.5">
                  <button type="button" onClick={closeForm} disabled={saveMut.isPending} className="h-10 flex-1 rounded-xl border text-[13.5px] font-medium text-white/70 transition-colors hover:bg-[rgba(255,255,255,.04)] disabled:opacity-50" style={{ borderColor: LINE }}>
                    Annuler
                  </button>
                  <button type="submit" disabled={saveMut.isPending} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60" style={{ background: CORAL }}>
                    {saveMut.isPending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> {editing ? 'Enregistrement…' : 'Création…'}
                      </>
                    ) : editing ? (
                      <>
                        <Check size={15} /> Enregistrer
                      </>
                    ) : (
                      'Créer le produit'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmation de suppression */}
        {confirmDelete && (
          <div
            className="fixed inset-0 z-[70] grid place-items-center p-4"
            style={{ background: 'rgba(0,0,0,.6)' }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !deleteMut.isPending) setConfirmDelete(null);
            }}
          >
            <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border" style={{ borderColor: LINE, background: '#221f1b', boxShadow: '0 40px 90px -20px rgba(0,0,0,.8)' }}>
              <div className="flex items-center gap-2 border-b px-5 py-4 text-[15px] font-semibold text-white" style={{ borderColor: LINE }}>
                <Trash2 size={17} style={{ color: '#ef6a52' }} /> Supprimer le produit
              </div>
              <div className="px-5 py-5">
                <p className="text-[13.5px] text-white/70">
                  Voulez-vous vraiment supprimer <span className="font-medium text-white">{confirmDelete.name}</span> ? Cette action est définitive.
                </p>
                <div className="mt-5 flex gap-2.5">
                  <button type="button" onClick={() => setConfirmDelete(null)} disabled={deleteMut.isPending} className="h-10 flex-1 rounded-xl border text-[13.5px] font-medium text-white/70 transition-colors hover:bg-[rgba(255,255,255,.04)] disabled:opacity-50" style={{ borderColor: LINE }}>
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate(confirmDelete.id)}
                    disabled={deleteMut.isPending}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ background: 'linear-gradient(90deg,#e2553f,#c2402f)' }}
                  >
                    {deleteMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Suppression…</> : 'Supprimer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </LiriPortalShell>
  );
}

export default MboloProduitsPage;
