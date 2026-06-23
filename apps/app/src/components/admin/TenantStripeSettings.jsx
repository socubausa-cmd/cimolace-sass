/**
 * TenantStripeSettings
 *
 * Clés Stripe de l'école (paiements élèves via le compte Stripe du tenant).
 * Tout passe par l'edge function `tenant-payments` (résolution tenant par SLUG
 * + garde owner/admin). Le composant n'a PAS besoin du tenant_id.
 * Les SECRETS ne sont jamais réaffichés (champ vide = inchangé).
 * Style aligné sur le design system LIRI (sombre + accent or).
 *
 * Usage: <TenantStripeSettings /> (slug résolu via useResolvedTenantSlug).
 */
import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Loader2, Save, Check, AlertCircle, ExternalLink } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';

const INPUT =
  'w-full rounded-lg border border-white/10 bg-[#0F1419] px-3 py-2 text-sm font-mono text-white placeholder-gray-500 focus:border-[var(--school-accent,#D4AF37)] focus:outline-none disabled:opacity-50';

export default function TenantStripeSettings() {
  const { slug, loading: slugLoading } = useResolvedTenantSlug();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [exists, setExists] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);
  const [hasWebhook, setHasWebhook] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [form, setForm] = useState({ public_key: '', secret_key: '', webhook_secret: '', mode: 'test', is_active: true });

  const call = useCallback(
    async (payload) => {
      const { data, error: err } = await supabase.functions.invoke('tenant-payments', { body: { ...payload, slug } });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    [slug],
  );

  const load = useCallback(async () => {
    if (slugLoading) return;
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await call({ action: 'get' });
      const s = data.stripe || {};
      setForm((f) => ({ ...f, public_key: s.publicKey || '', secret_key: '', webhook_secret: '', mode: s.mode || 'test', is_active: s.isActive ?? true }));
      setExists(s.exists === true);
      setHasSecret(s.hasSecret === true);
      setHasWebhook(s.hasWebhook === true);
      setError('');
    } catch (err) {
      setError(err?.message || '');
    } finally {
      setLoading(false);
    }
  }, [slug, slugLoading, call]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSaved(false);
    if (!form.public_key.trim()) { setError('La clé publiable (Publishable Key) est requise.'); return; }
    if (!hasSecret && !form.secret_key.trim()) { setError('La clé secrète (Secret Key) est requise.'); return; }
    setSaving(true);
    try {
      await call({
        action: 'save', provider: 'stripe',
        publicKey: form.public_key, secretKey: form.secret_key, webhookSecret: form.webhook_secret,
        mode: form.mode, isActive: form.is_active,
      });
      setExists(true);
      if (form.secret_key.trim()) setHasSecret(true);
      if (form.webhook_secret.trim()) setHasWebhook(true);
      setForm((f) => ({ ...f, secret_key: '', webhook_secret: '' }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const isLive = form.mode === 'live';
  const blocked = saving;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
        <p className="mb-2 font-medium text-[var(--school-accent,#D4AF37)]">📋 Comment obtenir vos clés Stripe</p>
        <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-gray-400">
          <li>Ouvrez{' '}
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[var(--school-accent,#D4AF37)] underline">
              dashboard.stripe.com/apikeys <ExternalLink className="h-3 w-3" />
            </a></li>
          <li>Copiez la <strong className="text-gray-200">Publishable key</strong> (pk_test_… ou pk_live_…)</li>
          <li>Révélez et copiez la <strong className="text-gray-200">Secret key</strong> (sk_test_… ou sk_live_…)</li>
          <li>Pour les webhooks :{' '}
            <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[var(--school-accent,#D4AF37)] underline">
              dashboard.stripe.com/webhooks <ExternalLink className="h-3 w-3" />
            </a>{' '}→ <strong className="text-gray-200">Signing secret</strong> (whsec_…)</li>
        </ol>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-300">Mode :</span>
          <div className="flex overflow-hidden rounded-lg border border-white/10">
            <button type="button" onClick={() => setForm((p) => ({ ...p, mode: 'test' }))}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${!isLive ? 'bg-amber-500 text-black' : 'text-gray-400 hover:bg-white/5'}`}>
              Test
            </button>
            <button type="button" onClick={() => setForm((p) => ({ ...p, mode: 'live' }))}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${isLive ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
              Live
            </button>
          </div>
          {isLive && (
            <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
              ⚡ Paiements réels activés
            </span>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Publishable Key <span className="text-red-400">*</span></label>
          <input className={INPUT} value={form.public_key} disabled={blocked}
            onChange={(e) => setForm((p) => ({ ...p, public_key: e.target.value }))}
            placeholder={isLive ? 'pk_live_…' : 'pk_test_…'} />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">
            Secret Key {hasSecret ? <span className="text-xs font-normal text-emerald-400">(configurée)</span> : <span className="text-red-400">*</span>}
          </label>
          <div className="relative">
            <input type={showSecret ? 'text' : 'password'} className={`${INPUT} pr-10`} value={form.secret_key} disabled={blocked}
              onChange={(e) => setForm((p) => ({ ...p, secret_key: e.target.value }))}
              placeholder={hasSecret ? '•••••••••  (laisser vide pour ne pas changer)' : (isLive ? 'sk_live_…' : 'sk_test_…')} autoComplete="off" />
            <button type="button" onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">
            Webhook Signing Secret <span className="ml-1.5 text-xs font-normal text-gray-500">(optionnel)</span>
            {hasWebhook ? <span className="ml-1.5 text-xs font-normal text-emerald-400">(configuré)</span> : null}
          </label>
          <div className="relative">
            <input type={showWebhook ? 'text' : 'password'} className={`${INPUT} pr-10`} value={form.webhook_secret} disabled={blocked}
              onChange={(e) => setForm((p) => ({ ...p, webhook_secret: e.target.value }))}
              placeholder={hasWebhook ? '•••••••••  (laisser vide pour ne pas changer)' : 'whsec_…'} autoComplete="off" />
            <button type="button" onClick={() => setShowWebhook((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={form.is_active} disabled={blocked}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            className="h-4 w-4 accent-[var(--school-accent,#D4AF37)]" />
          Activer Stripe pour cette école
        </label>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <button type="submit" disabled={blocked}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--school-accent,#D4AF37)] px-4 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? 'Sauvegarde…' : saved ? 'Sauvegardé !' : exists ? 'Mettre à jour' : 'Sauvegarder'}
        </button>
      </form>
    </div>
  );
}
