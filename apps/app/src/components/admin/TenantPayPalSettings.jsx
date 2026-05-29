/**
 * TenantPayPalSettings
 *
 * Section "PayPal" pour TenantAdminSettingsPage.
 * Permet à un owner/admin de saisir ses credentials PayPal (sandbox ou production)
 * afin que les paiements des élèves transitent par le compte PayPal du tenant.
 *
 * Usage:
 *   <TenantPayPalSettings tenantId={tenant.id} />
 */

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Loader2, Save, Check, AlertCircle, ExternalLink } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';

const INPUT = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';

export default function TenantPayPalSettings({ tenantId }) {
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');
  const [exists, setExists]         = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [form, setForm] = useState({
    public_key:  '',          // Client ID PayPal
    secret_key:  '',          // Client Secret PayPal
    mode:        'sandbox',   // sandbox | production
    is_active:   true,
  });

  // ── Charger la config existante ───────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tenant_payment_providers')
        .select('public_key, secret_key, mode, is_active')
        .eq('tenant_id', tenantId)
        .eq('provider', 'paypal')
        .maybeSingle();

      if (data) {
        setForm({
          public_key: data.public_key || '',
          secret_key: data.secret_key || '',
          mode:       data.mode       || 'sandbox',
          is_active:  data.is_active  ?? true,
        });
        setExists(true);
      }
    } catch (err) {
      console.error('[TenantPayPalSettings] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ── Sauvegarder ───────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);

    if (!form.public_key.trim()) {
      setError('Le Client ID PayPal est requis.');
      return;
    }
    if (!form.secret_key.trim()) {
      setError('Le Client Secret PayPal est requis.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tenant_id:  tenantId,
        provider:   'paypal',
        public_key: form.public_key.trim(),
        secret_key: form.secret_key.trim(),
        mode:       form.mode,
        is_active:  form.is_active,
        updated_at: new Date().toISOString(),
      };

      let dbError;
      if (exists) {
        ({ error: dbError } = await supabase
          .from('tenant_payment_providers')
          .update(payload)
          .eq('tenant_id', tenantId)
          .eq('provider', 'paypal'));
      } else {
        ({ error: dbError } = await supabase
          .from('tenant_payment_providers')
          .insert(payload));
      }

      if (dbError) {
        setError(dbError.message || 'Erreur lors de la sauvegarde.');
      } else {
        setExists(true);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      setError(err?.message || 'Erreur inattendue.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const isProduction = form.mode === 'production';

  return (
    <div className="space-y-5">
      {/* ── Guide rapide ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm">
        <p className="mb-2 font-medium text-blue-800">📋 Comment obtenir vos credentials PayPal</p>
        <ol className="space-y-1 text-blue-700 text-xs list-decimal ml-4 leading-relaxed">
          <li>
            Ouvrez{' '}
            <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noreferrer"
              className="underline inline-flex items-center gap-0.5">
              developer.paypal.com/dashboard/applications <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>Créez (ou sélectionnez) une application → onglet <strong>Sandbox</strong> ou <strong>Live</strong></li>
          <li>Copiez le <strong>Client ID</strong></li>
          <li>Révélez et copiez le <strong>Secret</strong></li>
          <li>Sélectionnez le mode ci-dessous correspondant à vos credentials</li>
        </ol>
      </div>

      {/* ── Formulaire ───────────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="space-y-4">

        {/* Mode sandbox / production */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Mode :</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, mode: 'sandbox' }))}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                !isProduction ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Sandbox
            </button>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, mode: 'production' }))}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                isProduction ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Production
            </button>
          </div>
          {isProduction && (
            <span className="text-xs text-green-700 font-medium bg-green-50 border border-green-200 rounded px-2 py-0.5">
              ⚡ Paiements réels activés
            </span>
          )}
        </div>

        {/* Client ID */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Client ID <span className="text-red-500">*</span>
          </label>
          <input
            className={INPUT}
            value={form.public_key}
            onChange={e => setForm(p => ({ ...p, public_key: e.target.value }))}
            placeholder="AXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            required
          />
        </div>

        {/* Client Secret */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Client Secret <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              className={INPUT + ' pr-10'}
              value={form.secret_key}
              onChange={e => setForm(p => ({ ...p, secret_key: e.target.value }))}
              placeholder="EHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
            />
            <button type="button" onClick={() => setShowSecret(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title={showSecret ? 'Masquer' : 'Afficher'}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Checkbox actif */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="paypal_active"
            checked={form.is_active}
            onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="paypal_active" className="text-sm text-gray-700 cursor-pointer">
            Activer PayPal pour ce tenant
          </label>
        </div>

        {/* Feedback */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Bouton */}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : saved
                ? <Check className="h-4 w-4" />
                : <Save className="h-4 w-4" />}
            {saving ? 'Sauvegarde…' : saved ? 'Sauvegardé !' : exists ? 'Mettre à jour' : 'Sauvegarder'}
          </button>
        </div>
      </form>

      {/* Rappel mode actif */}
      {exists && (
        <div className={`rounded-lg border p-3 text-xs ${
          isProduction
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}>
          <span className="font-medium">Mode actuel :</span>{' '}
          {isProduction ? '⚡ Production — les paiements sont réels' : '🧪 Sandbox — aucun paiement réel'}
        </div>
      )}
    </div>
  );
}
