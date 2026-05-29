/**
 * TenantOAuthSettings
 *
 * Section "Connexion Google" pour TenantAdminSettingsPage.
 * Permet à un owner/admin de saisir ses credentials Google OAuth custom
 * afin que ses élèves voient le nom de l'école sur l'écran de consentement Google.
 *
 * Adopte le design Tailwind de TenantAdminSettingsPage (Section / Field).
 *
 * Usage:
 *   <TenantOAuthSettings tenantId={tenant.id} tenantSlug={tenantSlug} />
 */

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Loader2, Save, Check, AlertCircle, Zap, ExternalLink, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';

// URI de redirection fixe : l'edge function oauth-callback
const EDGE_CALLBACK_URI = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-callback`;
const OAUTH_INITIATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-initiate`;

const INPUT = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';
const INPUT_PLAIN = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';

export default function TenantOAuthSettings({ tenantId, tenantSlug }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState(null); // { ok: bool, msg: string }
  const [exists, setExists] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showCustomSetup, setShowCustomSetup] = useState(false);

  const [form, setForm] = useState({
    client_id: '',
    client_secret: '',
    app_name: '',
    is_active: true,
  });

  // ── Charger la config existante ───────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tenant_oauth_providers')
        .select('client_id, client_secret, app_name, is_active')
        .eq('tenant_id', tenantId)
        .eq('provider', 'google')
        .maybeSingle();

      if (data) {
        setForm({
          client_id: data.client_id || '',
          client_secret: data.client_secret || '',
          app_name: data.app_name || '',
          is_active: data.is_active ?? true,
        });
        setExists(true);
      }
    } catch (err) {
      console.error('[TenantOAuthSettings] load error:', err);
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
    setTestResult(null);

    if (!form.client_id.trim()) {
      setError('Le Client ID Google est requis.');
      return;
    }
    if (!form.client_secret.trim()) {
      setError('Le Client Secret Google est requis.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        provider: 'google',
        client_id: form.client_id.trim(),
        client_secret: form.client_secret.trim(),
        app_name: form.app_name.trim() || null,
        authorized_redirect_uri: EDGE_CALLBACK_URI,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      let dbError;
      if (exists) {
        ({ error: dbError } = await supabase
          .from('tenant_oauth_providers')
          .update(payload)
          .eq('tenant_id', tenantId)
          .eq('provider', 'google'));
      } else {
        ({ error: dbError } = await supabase
          .from('tenant_oauth_providers')
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

  // ── Tester la configuration ───────────────────────────────────────────────
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const res = await fetch(OAUTH_INITIATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tenant_slug: tenantSlug }),
      });

      const body = await res.json().catch(() => ({}));

      if (res.ok && body.redirect_url) {
        setTestResult({ ok: true, msg: 'Configuration valide — Google OAuth est opérationnel pour ce tenant.' });
      } else if (body?.code === 'oauth_not_configured') {
        setTestResult({ ok: false, msg: 'Configuration non trouvée. Sauvegardez d\'abord.' });
      } else {
        setTestResult({ ok: false, msg: body?.error || `Erreur (HTTP ${res.status})` });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: err?.message || 'Erreur réseau.' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Bannière plateforme : Google fonctionne déjà sans config ─────── */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">
              ✅ Google Sign-In est déjà actif pour vos élèves
            </p>
            <p className="text-xs text-green-700 mt-1 leading-relaxed">
              La plateforme Cimolace gère Google OAuth pour vous — vos élèves peuvent se connecter avec Google
              dès maintenant, sans aucune configuration. L'écran Google affiche <strong>"Cimolace"</strong>.
            </p>
            {!exists && (
              <button
                type="button"
                onClick={() => setShowCustomSetup(v => !v)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900 underline underline-offset-2"
              >
                {showCustomSetup ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showCustomSetup
                  ? 'Masquer — utiliser le branding Cimolace par défaut'
                  : 'Afficher mon nom d\'école sur l\'écran Google (optionnel)'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Configuration custom (collapsible si pas encore configuré) ───── */}
      {(exists || showCustomSetup) && (
      <div className="space-y-5">
        {exists && (
          <div className="rounded-lg border border-purple-100 bg-purple-50 p-3 text-xs text-purple-700">
            <strong>Branding personnalisé actif</strong> — L'écran Google affiche le nom de votre école.
            Vos élèves voient votre identité, pas celle de Cimolace.
          </div>
        )}

      {/* ── Guide rapide ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm">
        <p className="mb-2 font-medium text-blue-800">
          📋 Comment obtenir vos credentials Google
        </p>
        <ol className="space-y-1 text-blue-700 text-xs list-decimal ml-4 leading-relaxed">
          <li>
            Ouvrez{' '}
            <a
              href="https://console.cloud.google.com"
              target="_blank"
              rel="noreferrer"
              className="underline inline-flex items-center gap-0.5"
            >
              console.cloud.google.com <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>APIs &amp; Services → Credentials → <strong>Create Credentials → OAuth 2.0 Client ID</strong></li>
          <li>Application type : <strong>Web application</strong></li>
          <li>
            Authorized redirect URI — copiez exactement :
            <div className="mt-1 rounded bg-white border border-blue-200 px-2 py-1 font-mono text-xs text-blue-900 break-all select-all">
              {EDGE_CALLBACK_URI}
            </div>
          </li>
          <li>Copiez le <strong>Client ID</strong> et le <strong>Client Secret</strong> dans les champs ci-dessous</li>
        </ol>
      </div>

      {/* ── Formulaire ───────────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="space-y-4">
        {/* Nom affiché sur Google */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Nom affiché sur l'écran Google
          </label>
          <p className="text-xs text-gray-400">
            Ce que vos élèves liront : "Se connecter à <em>[ce nom]</em>". Si vide, le nom du projet Google Cloud est utilisé.
          </p>
          <input
            className={INPUT_PLAIN}
            value={form.app_name}
            onChange={(e) => setForm((p) => ({ ...p, app_name: e.target.value }))}
            placeholder="Ex : École Islamique Al-Nour"
          />
        </div>

        {/* Client ID */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Client ID <span className="text-red-500">*</span>
          </label>
          <input
            className={INPUT}
            value={form.client_id}
            onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
            placeholder="xxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
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
              value={form.client_secret}
              onChange={(e) => setForm((p) => ({ ...p, client_secret: e.target.value }))}
              placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxx"
              required
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title={showSecret ? 'Masquer' : 'Afficher'}
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Checkbox actif */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="oauth_active"
            checked={form.is_active}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="oauth_active" className="text-sm text-gray-700 cursor-pointer">
            Activer Google OAuth personnalisé pour ce tenant
          </label>
        </div>

        {/* Feedback erreur / succès */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {testResult && (
          <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            testResult.ok
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {testResult.ok
              ? <Check className="h-4 w-4 shrink-0" />
              : <AlertCircle className="h-4 w-4 shrink-0" />}
            {testResult.msg}
          </div>
        )}

        {/* Boutons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : saved
                ? <Check className="h-4 w-4" />
                : <Save className="h-4 w-4" />}
            {saving ? 'Sauvegarde…' : saved ? 'Sauvegardé !' : exists ? 'Mettre à jour' : 'Sauvegarder'}
          </button>

          {exists && (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {testing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Zap className="h-4 w-4" />}
              {testing ? 'Test…' : 'Tester la config'}
            </button>
          )}
        </div>
      </form>

      {/* ── Rappel URI de redirection ─────────────────────────────────────── */}
      {exists && (
        <div className="rounded-lg border bg-gray-50 p-3">
          <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
            URI de redirection enregistrée dans Google Cloud
          </p>
          <p className="font-mono text-xs text-gray-700 break-all">{EDGE_CALLBACK_URI}</p>
        </div>
      )}
      </div>
      )}

    </div>
  );
}
