/**
 * TenantPayPalSettings
 *
 * Credentials PayPal de l'école (paiements élèves via le compte du tenant).
 * Tout passe par l'edge function `tenant-payments` (résolution par SLUG + garde
 * owner/admin). Le composant n'a PAS besoin du tenant_id. Le secret n'est jamais
 * réaffiché (champ vide = inchangé). Style aligné LIRI (sombre + accent or).
 *
 * Usage: <TenantPayPalSettings /> (slug résolu via useResolvedTenantSlug).
 */
import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Loader2, Save, Check, AlertCircle, ExternalLink } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';

const INPUT =
  'w-full rounded-lg border border-white/10 bg-[#0F1419] px-3 py-2 text-sm font-mono text-white placeholder-gray-500 focus:border-[var(--school-accent,#D4AF37)] focus:outline-none disabled:opacity-50';

export default function TenantPayPalSettings() {
  const { slug, loading: slugLoading } = useResolvedTenantSlug();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [exists, setExists] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({ public_key: '', secret_key: '', mode: 'sandbox', is_active: true });

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
      const p = data.paypal || {};
      setForm((f) => ({ ...f, public_key: p.publicKey || '', secret_key: '', mode: p.mode || 'sandbox', is_active: p.isActive ?? true }));
      setExists(p.exists === true);
      setHasSecret(p.hasSecret === true);
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
    if (!form.public_key.trim()) { setError('Le Client ID PayPal est requis.'); return; }
    if (!hasSecret && !form.secret_key.trim()) { setError('Le Client Secret PayPal est requis.'); return; }
    setSaving(true);
    try {
      await call({
        action: 'save', provider: 'paypal',
        publicKey: form.public_key, secretKey: form.secret_key,
        mode: form.mode, isActive: form.is_active,
      });
      setExists(true);
      if (form.secret_key.trim()) setHasSecret(true);
      setForm((f) => ({ ...f, secret_key: '' }));
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

  const isProduction = form.mode === 'production';
  const blocked = saving;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
        <p className="mb-2 font-medium text-[var(--school-accent,#D4AF37)]">📋 Comment obtenir vos credentials PayPal</p>
        <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-gray-400">
          <li>Ouvrez{' '}
            <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[var(--school-accent,#D4AF37)] underline">
              developer.paypal.com/dashboard/applications <ExternalLink className="h-3 w-3" />
            </a></li>
          <li>Créez (ou sélectionnez) une application → onglet <strong className="text-gray-200">Sandbox</strong> ou <strong className="text-gray-200">Live</strong></li>
          <li>Copiez le <strong className="text-gray-200">Client ID</strong></li>
          <li>Révélez et copiez le <strong className="text-gray-200">Secret</strong></li>
        </ol>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-300">Mode :</span>
          <div className="flex overflow-hidden rounded-lg border border-white/10">
            <button type="button" onClick={() => setForm((p) => ({ ...p, mode: 'sandbox' }))}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${!isProduction ? 'bg-amber-500 text-black' : 'text-gray-400 hover:bg-white/5'}`}>
              Sandbox
            </button>
            <button type="button" onClick={() => setForm((p) => ({ ...p, mode: 'production' }))}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${isProduction ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
              Production
            </button>
          </div>
          {isProduction && (
            <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
              ⚡ Paiements réels activés
            </span>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">Client ID <span className="text-red-400">*</span></label>
          <input className={INPUT} value={form.public_key} disabled={blocked}
            onChange={(e) => setForm((p) => ({ ...p, public_key: e.target.value }))}
            placeholder="AXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">
            Client Secret {hasSecret ? <span className="text-xs font-normal text-emerald-400">(configuré)</span> : <span className="text-red-400">*</span>}
          </label>
          <div className="relative">
            <input type={showSecret ? 'text' : 'password'} className={`${INPUT} pr-10`} value={form.secret_key} disabled={blocked}
              onChange={(e) => setForm((p) => ({ ...p, secret_key: e.target.value }))}
              placeholder={hasSecret ? '•••••••••  (laisser vide pour ne pas changer)' : 'EHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'} autoComplete="off" />
            <button type="button" onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={form.is_active} disabled={blocked}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            className="h-4 w-4 accent-[var(--school-accent,#D4AF37)]" />
          Activer PayPal pour cette école
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
