/**
 * TenantOAuthSettings
 *
 * Section "Connexion Google" — credentials Google OAuth custom de l'école, pour
 * que l'écran de consentement Google affiche le nom de l'école (pas "Cimolace").
 *
 * Tout passe par l'edge function `tenant-oauth` (résolution du tenant par SLUG +
 * garde owner/admin). Le composant n'a PAS besoin du tenant_id. Le Client Secret
 * n'est jamais réaffiché (champ vide = inchangé). Le bouton "Tester" appelle
 * l'edge `oauth-initiate` avec le slug résolu.
 *
 * Style aligné sur le design system LIRI (sombre + accent or).
 *
 * Usage: <TenantOAuthSettings /> (slug résolu via useResolvedTenantSlug).
 */
import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Loader2, Save, Check, AlertCircle, Zap, ExternalLink, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';

const FALLBACK_CALLBACK_URI = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-callback`;
const OAUTH_INITIATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-initiate`;

const INPUT =
  'w-full rounded-lg border border-white/10 bg-[#0F1419] px-3 py-2 text-sm font-mono text-white placeholder-gray-500 focus:border-[var(--school-accent,#D4AF37)] focus:outline-none disabled:opacity-50';
const INPUT_PLAIN =
  'w-full rounded-lg border border-white/10 bg-[#0F1419] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[var(--school-accent,#D4AF37)] focus:outline-none disabled:opacity-50';

export default function TenantOAuthSettings() {
  const { slug, loading: slugLoading } = useResolvedTenantSlug();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState(null); // { ok, msg }
  const [exists, setExists] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showCustomSetup, setShowCustomSetup] = useState(false);
  const [callbackUri, setCallbackUri] = useState(FALLBACK_CALLBACK_URI);

  const [form, setForm] = useState({ client_id: '', client_secret: '', app_name: '', is_active: true });

  const call = useCallback(
    async (payload) => {
      const { data, error: err } = await supabase.functions.invoke('tenant-oauth', { body: { ...payload, slug } });
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
      setForm((f) => ({ ...f, client_id: data.clientId || '', client_secret: '', app_name: data.appName || '', is_active: data.isActive ?? true }));
      setExists(data.exists === true);
      setHasSecret(data.hasSecret === true);
      if (data.callbackUri) setCallbackUri(data.callbackUri);
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
    setError(''); setSaved(false); setTestResult(null);
    if (!form.client_id.trim()) { setError('Le Client ID Google est requis.'); return; }
    if (!hasSecret && !form.client_secret.trim()) { setError('Le Client Secret Google est requis.'); return; }
    setSaving(true);
    try {
      await call({
        action: 'save',
        clientId: form.client_id, clientSecret: form.client_secret,
        appName: form.app_name, isActive: form.is_active,
      });
      setExists(true);
      if (form.client_secret.trim()) setHasSecret(true);
      setForm((f) => ({ ...f, client_secret: '' }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null); setError('');
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
        body: JSON.stringify({ tenant_slug: slug }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.redirect_url) {
        setTestResult({ ok: true, msg: 'Configuration valide — Google OAuth est opérationnel pour cette école.' });
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
      <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const blocked = saving;

  return (
    <div className="space-y-5">

      {/* Bannière plateforme : Google marche déjà sans config */}
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-300">
              ✅ Google Sign-In est déjà actif pour vos élèves
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-200/80">
              La plateforme Cimolace gère Google OAuth pour vous — vos élèves peuvent se connecter avec Google
              dès maintenant, sans aucune configuration. L'écran Google affiche <strong>« Cimolace »</strong>.
            </p>
            {!exists && (
              <button
                type="button"
                onClick={() => setShowCustomSetup((v) => !v)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
              >
                {showCustomSetup ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showCustomSetup
                  ? 'Masquer — garder le branding Cimolace par défaut'
                  : 'Afficher mon nom d\'école sur l\'écran Google (optionnel)'}
              </button>
            )}
          </div>
        </div>
      </div>

      {(exists || showCustomSetup) && (
        <div className="space-y-5">
          {exists && (
            <div className="rounded-lg border border-[var(--school-accent,#D4AF37)]/30 bg-[var(--school-accent,#D4AF37)]/10 p-3 text-xs text-[var(--school-accent,#D4AF37)]">
              <strong>Branding personnalisé actif</strong> — L'écran Google affiche le nom de votre école.
              Vos élèves voient votre identité, pas celle de Cimolace.
            </div>
          )}

          {/* Guide */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
            <p className="mb-2 font-medium text-[var(--school-accent,#D4AF37)]">📋 Comment obtenir vos credentials Google</p>
            <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-gray-400">
              <li>Ouvrez{' '}
                <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-[var(--school-accent,#D4AF37)] underline">
                  console.cloud.google.com <ExternalLink className="h-3 w-3" />
                </a></li>
              <li>APIs &amp; Services → Credentials → <strong className="text-gray-200">Create Credentials → OAuth 2.0 Client ID</strong></li>
              <li>Application type : <strong className="text-gray-200">Web application</strong></li>
              <li>
                Authorized redirect URI — copiez exactement :
                <div className="mt-1 select-all break-all rounded border border-white/10 bg-[#0F1419] px-2 py-1 font-mono text-xs text-gray-200">
                  {callbackUri}
                </div>
              </li>
              <li>Copiez le <strong className="text-gray-200">Client ID</strong> et le <strong className="text-gray-200">Client Secret</strong> ci-dessous</li>
            </ol>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Nom affiché sur l'écran Google</label>
              <p className="text-xs text-gray-500">
                Ce que vos élèves liront : « Se connecter à <em>[ce nom]</em> ». Si vide, le nom du projet Google Cloud est utilisé.
              </p>
              <input className={INPUT_PLAIN} value={form.app_name} disabled={blocked}
                onChange={(e) => setForm((p) => ({ ...p, app_name: e.target.value }))}
                placeholder="Ex : École Prorascience" />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Client ID <span className="text-red-400">*</span></label>
              <input className={INPUT} value={form.client_id} disabled={blocked}
                onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
                placeholder="xxxxxxxxxx-xxxx.apps.googleusercontent.com" />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">
                Client Secret {hasSecret ? <span className="text-xs font-normal text-emerald-400">(configuré)</span> : <span className="text-red-400">*</span>}
              </label>
              <div className="relative">
                <input type={showSecret ? 'text' : 'password'} className={`${INPUT} pr-10`} value={form.client_secret} disabled={blocked}
                  onChange={(e) => setForm((p) => ({ ...p, client_secret: e.target.value }))}
                  placeholder={hasSecret ? '•••••••••  (laisser vide pour ne pas changer)' : 'GOCSPX-xxxxxxxxxxxxxxxxxxxx'} autoComplete="off" />
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
              Activer Google OAuth personnalisé pour cette école
            </label>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${testResult.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                {testResult.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {testResult.msg}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={blocked}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--school-accent,#D4AF37)] px-4 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saving ? 'Sauvegarde…' : saved ? 'Sauvegardé !' : exists ? 'Mettre à jour' : 'Sauvegarder'}
              </button>

              {exists && (
                <button type="button" onClick={handleTest} disabled={testing}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {testing ? 'Test…' : 'Tester la config'}
                </button>
              )}
            </div>
          </form>

          {exists && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                URI de redirection enregistrée dans Google Cloud
              </p>
              <p className="break-all font-mono text-xs text-gray-300">{callbackUri}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
