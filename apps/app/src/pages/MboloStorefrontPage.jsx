/**
 * MboloStorefrontPage — vitrine e-commerce du tenant (moteur mbolo), côté CLIENT.
 *
 * Catalogue lu via mboloApi (/mbolo/products, JWT membre) → panier serveur
 * (mbolo_cart_items) → commande → session Stripe Checkout → retour + confirmation.
 * Le catalogue mbolo exige un membre connecté ; sinon on invite à se connecter.
 * Style LIRI sombre + or.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ShoppingBag, Plus, Minus, Trash2, Loader2, Check, AlertCircle, Store, ArrowRight } from 'lucide-react';
import { mboloApi } from '@/lib/api-v2';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const asArray = (r) => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []);
const fmtPrice = (cents, currency) =>
  `${(Number(cents || 0) / 100).toLocaleString('fr-FR')} ${currency || 'EUR'}`;

export default function MboloStorefrontPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [prods, c] = await Promise.all([mboloApi.listProducts(), mboloApi.getCart()]);
      setProducts(asArray(prods).filter((p) => p.is_active !== false));
      setCart(asArray(c));
      setError('');
    } catch (err) {
      setError(err?.message || 'Impossible de charger la boutique.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Retour de Stripe : ?paid=<orderId> → confirme la commande.
  useEffect(() => {
    const orderId = searchParams.get('paid');
    if (!orderId || !user?.id) return;
    (async () => {
      try {
        const res = await mboloApi.confirmOrder(orderId);
        const paid = res?.paid ?? res?.data?.paid;
        setFlash(paid ? 'Paiement confirmé — merci pour votre commande ! 🎉' : 'Commande enregistrée. Le paiement sera confirmé sous peu.');
      } catch {
        setFlash('Commande enregistrée.');
      } finally {
        searchParams.delete('paid'); searchParams.delete('session_id');
        setSearchParams(searchParams, { replace: true });
        load();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const cartCount = cart.reduce((s, i) => s + (i.quantity || 0), 0);
  const cartTotal = cart.reduce((s, i) => s + (i.product?.price_cents ?? 0) * (i.quantity || 0), 0);
  const cartCurrency = cart[0]?.product?.currency || products[0]?.currency || 'EUR';

  const addToCart = async (p) => {
    setBusy(p.id); setError('');
    try { setCart(asArray(await mboloApi.addToCart(p.id, 1))); }
    catch (err) { setError(err?.message || 'Ajout impossible.'); }
    finally { setBusy(''); }
  };
  const changeQty = async (item, delta) => {
    const next = (item.quantity || 1) + delta;
    setBusy(item.product_id);
    try {
      if (next <= 0) { await mboloApi.removeFromCart(item.product_id); }
      else { await mboloApi.addToCart(item.product_id, next); }
      setCart(asArray(await mboloApi.getCart()));
    } catch (err) { setError(err?.message || 'Mise à jour impossible.'); }
    finally { setBusy(''); }
  };
  const removeItem = async (item) => {
    setBusy(item.product_id);
    try { await mboloApi.removeFromCart(item.product_id); setCart(asArray(await mboloApi.getCart())); }
    catch (err) { setError(err?.message || 'Retrait impossible.'); }
    finally { setBusy(''); }
  };

  const checkout = async () => {
    if (!cart.length) return;
    setBusy('checkout'); setError('');
    try {
      const created = await mboloApi.createOrder();
      const order = created?.order ?? created?.data?.order ?? created;
      const orderId = order?.id;
      if (!orderId) throw new Error('Commande non créée.');
      const origin = window.location.origin;
      const sess = await mboloApi.checkoutSession(orderId, {
        successUrl: `${origin}/boutique?paid=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/boutique`,
      });
      const url = sess?.url ?? sess?.data?.url;
      if (!url) throw new Error('Lien de paiement indisponible.');
      window.location.href = url;
    } catch (err) {
      setError(err?.message || 'Échec du passage en caisse.');
      setBusy('');
    }
  };

  if (!user?.id) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Store className="mx-auto h-12 w-12 text-[var(--school-accent,#D4AF37)]" />
        <h1 className="mt-4 text-2xl font-bold text-white">Boutique</h1>
        <p className="mt-2 text-sm text-gray-400">Connectez-vous pour découvrir la boutique et passer commande.</p>
        <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--school-accent,#D4AF37)] px-5 py-2.5 font-bold text-black hover:brightness-110">
          Se connecter <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <Helmet><title>Boutique</title></Helmet>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-[var(--school-accent,#D4AF37)]" />
            <h1 className="text-2xl font-bold">Boutique</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
            <ShoppingBag className="h-4 w-4 text-[var(--school-accent,#D4AF37)]" />
            {cartCount} article{cartCount > 1 ? 's' : ''}
          </div>
        </header>

        {flash && <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"><Check className="h-4 w-4 shrink-0" /> {flash}</div>}
        {error && <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0" /> {error}</div>}

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /> Chargement de la boutique…</div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] py-16 text-center text-gray-500">La boutique ne contient pas encore de produit.</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Catalogue */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="aspect-square bg-white/5">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} /> : <div className="flex h-full items-center justify-center"><Store className="h-10 w-10 text-gray-600" /></div>}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="text-sm font-semibold">{p.name}</p>
                    {p.description && <p className="mt-1 line-clamp-2 text-xs text-gray-400">{p.description}</p>}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-bold text-[var(--school-accent,#D4AF37)]">{fmtPrice(p.price_cents, p.currency)}</span>
                      <button type="button" onClick={() => addToCart(p)} disabled={busy === p.id || (p.stock != null && p.stock <= 0)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--school-accent,#D4AF37)] px-3 py-1.5 text-xs font-bold text-black hover:brightness-110 disabled:opacity-50">
                        {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        {p.stock != null && p.stock <= 0 ? 'Épuisé' : 'Ajouter'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Panier */}
            <aside className="h-fit rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:sticky lg:top-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-4 w-4" /> Votre panier</p>
              {cart.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">Panier vide.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.product_id} className="flex items-center gap-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{item.product?.name || 'Article'}</p>
                          <p className="text-xs text-gray-400">{fmtPrice(item.product?.price_cents, item.product?.currency)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => changeQty(item, -1)} disabled={busy === item.product_id} className="rounded border border-white/10 p-1 hover:bg-white/5"><Minus className="h-3 w-3" /></button>
                          <span className="w-6 text-center">{item.quantity}</span>
                          <button type="button" onClick={() => changeQty(item, 1)} disabled={busy === item.product_id} className="rounded border border-white/10 p-1 hover:bg-white/5"><Plus className="h-3 w-3" /></button>
                          <button type="button" onClick={() => removeItem(item)} disabled={busy === item.product_id} className="ml-1 rounded border border-white/10 p-1 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                    <span className="text-gray-300">Total</span>
                    <span className="text-lg font-bold">{fmtPrice(cartTotal, cartCurrency)}</span>
                  </div>
                  <button type="button" onClick={checkout} disabled={busy === 'checkout'}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--school-accent,#D4AF37)] px-4 py-2.5 font-bold text-black hover:brightness-110 disabled:opacity-50">
                    {busy === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                    Commander
                  </button>
                  <p className="mt-2 text-center text-[11px] text-gray-500">Paiement sécurisé par Stripe.</p>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
