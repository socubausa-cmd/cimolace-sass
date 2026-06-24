/**
 * TenantSocialSettings
 *
 * Section « Réseaux sociaux » du back-office tenant : configurer les identifiants
 * d'app (TikTok, Facebook/Instagram, LinkedIn) PAR ÉCOLE puis connecter les comptes
 * en OAuth, pour publier automatiquement les shorts générés après un live.
 *
 * Tout passe par l'API NestJS social-publisher/oauth/* (apiV2 injecte Bearer +
 * X-Tenant-Slug). Le secret n'est jamais réaffiché ; le statut n'expose que des
 * booléens (configured / connected). Style aligné sur le design LIRI (sombre + or).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Eye, EyeOff, Loader2, Save, Check, AlertCircle, Link2,
  CheckCircle2, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import { socialApi } from '@/lib/api-v2';
import { getApiBaseUrl } from '@/lib/apiBase';

const INPUT =
  'w-full rounded-lg border border-white/10 bg-[#0F1419] px-3 py-2 text-sm font-mono text-white placeholder-gray-500 focus:border-[var(--school-accent,#D4AF37)] focus:outline-none disabled:opacity-50';

const PLATFORMS = [
  { key: 'tiktok', label: 'TikTok', dev: 'developers.tiktok.com', devUrl: 'https://developers.tiktok.com', idLabel: 'Client Key', secretLabel: 'Client Secret', color: '#69C9D0', note: 'Active « Login Kit » + « Content Posting API » dans ton app.' },
  { key: 'facebook', label: 'Facebook / Instagram', dev: 'developers.facebook.com', devUrl: 'https://developers.facebook.com', idLabel: 'App ID', secretLabel: 'App Secret', color: '#1877F2', note: 'Connecter Facebook publie aussi sur Instagram — ton compte IG doit être un compte Business lié à ta Page Facebook.' },
  { key: 'linkedin', label: 'LinkedIn', dev: 'linkedin.com/developers', devUrl: 'https://www.linkedin.com/developers', idLabel: 'Client ID', secretLabel: 'Client Secret', color: '#0A66C2', note: 'Active les produits « Sign In with LinkedIn using OpenID Connect » et « Share on LinkedIn ».' },
];

function PlatformCard({ def, status, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', clientSecret: '' });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const redirectUri = `${getApiBaseUrl()}/social-publisher/oauth/${def.key}/callback`;

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (!form.clientId.trim() || !form.clientSecret.trim()) {
      setError('Renseignez le Client ID et le Client Secret.');
      return;
    }
    setSaving(true);
    try {
      await socialApi.saveConfig(def.key, form.clientId.trim(), form.clientSecret.trim());
      setForm({ clientId: '', clientSecret: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch (err) {
      setError(err?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const { url } = await socialApi.authorizeUrl(def.key);
      if (!url) throw new Error('URL de connexion vide.');
      window.location.href = url;
    } catch (err) {
      setError(err?.message || 'Impossible de démarrer la connexion.');
      setConnecting(false);
    }
  };

  const badge = status?.connected
    ? { txt: 'Connecté', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', icon: CheckCircle2 }
    : status?.configured
      ? { txt: 'Configuré — à connecter', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', icon: AlertCircle }
      : { txt: 'Non configuré', cls: 'border-white/10 bg-white/5 text-gray-400', icon: AlertCircle };
  const BadgeIcon = badge.icon;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-black"
            style={{ background: def.color }}
            aria-hidden="true"
          >
            {def.label.slice(0, 1)}
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{def.label}</p>
            <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${badge.cls}`}>
              <BadgeIcon className="h-3 w-3" /> {badge.txt}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status?.configured && (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--school-accent,#D4AF37)] px-3 py-1.5 text-xs font-bold text-black hover:brightness-110 disabled:opacity-50"
            >
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status?.connected ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {status?.connected ? 'Reconnecter' : 'Connecter'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5"
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Identifiants
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={handleSave} className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <p className="text-xs leading-relaxed text-gray-400">
            Créez une app sur{' '}
            <a href={def.devUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[var(--school-accent,#D4AF37)] underline">
              {def.dev} <ExternalLink className="h-3 w-3" />
            </a>{' '}
            puis collez ce <strong className="text-gray-200">Redirect URI</strong> dans sa configuration :
          </p>
          {def.note && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-200/80">
              {def.note}
            </p>
          )}
          <div className="rounded-lg border border-white/10 bg-[#0F1419] px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Redirect URI</p>
            <p className="select-all break-all font-mono text-xs text-gray-200">{redirectUri}</p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">{def.idLabel}</label>
            <input
              className={INPUT}
              value={form.clientId}
              disabled={saving}
              onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}
              placeholder={`${def.idLabel}…`}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">{def.secretLabel}</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                className={`${INPUT} pr-10`}
                value={form.clientSecret}
                disabled={saving}
                onChange={(e) => setForm((p) => ({ ...p, clientSecret: e.target.value }))}
                placeholder="••••••••"
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--school-accent,#D4AF37)] px-4 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? 'Sauvegarde…' : saved ? 'Enregistré !' : 'Enregistrer les identifiants'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function TenantSocialSettings() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await socialApi.status();
      setStatuses(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Retour OAuth : la plateforme renvoie ?social_connected=… ou ?social_error=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('social_connected');
    const err = params.get('social_error');
    if (ok || err) {
      if (ok) setFlash(`Compte ${ok} connecté.`);
      if (err) setError(`Connexion échouée : ${err}`);
      params.delete('social_connected');
      params.delete('social_error');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
      load();
    }
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const byKey = Object.fromEntries(statuses.map((s) => [s.platform, s]));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-sm leading-relaxed text-gray-300">
          Connectez vos comptes pour <strong className="text-white">publier automatiquement</strong> les
          shorts générés après chaque live (toujours en <strong className="text-white">brouillon à valider</strong>,
          jamais publié sans vous). Chaque réseau se configure une fois, puis se connecte en un clic.
        </p>
      </div>

      {flash && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {flash}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {PLATFORMS.map((def) => (
        <PlatformCard key={def.key} def={def} status={byKey[def.key]} onSaved={load} />
      ))}
    </div>
  );
}
