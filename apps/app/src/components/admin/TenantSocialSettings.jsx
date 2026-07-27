/**
 * TenantSocialSettings — écran « Réseaux sociaux » du back-office tenant.
 *
 * RÔLE : déclarer, PAR TENANT, les identifiants d'application (TikTok, Facebook/Instagram,
 * LinkedIn) puis connecter le compte en OAuth, pour que le publieur (`social-publisher`)
 * puisse pousser les shorts vidéo produits après un live.
 *
 * POURQUOI par tenant et pas par variable d'environnement : `SocialOAuthService.creds()`
 * lit EXCLUSIVEMENT `tenants.metadata.social_apps[platform]` — il n'y a AUCUN repli sur
 * l'env (comme Stripe/PayPal : chaque école apporte sa propre app, isolation stricte).
 * Les variables Railway SOCIAL_* ne sont donc lues par personne : cet écran est le SEUL
 * chemin d'écriture de ces clés. S'il est inatteignable, la publication est impossible.
 *
 * CONTRAT API confronté au contrôleur (`apps/api/src/social-publisher/social-oauth.controller.ts`) :
 *   GET  /social-publisher/oauth/status            → [{ platform, configured, connected }]  (owner/admin)
 *   POST /social-publisher/oauth/:platform/config  → body { clientId, clientSecret } → { ok: true }
 *   GET  /social-publisher/oauth/:platform/start   → { url }  (owner/admin) → on redirige le navigateur
 *   GET  /social-publisher/oauth/:platform/callback → PUBLIC, reçu par l'API (pas par le front)
 * Toutes les réponses passent par le `ResponseInterceptor` global qui emballe en `{ data }`.
 * `socialApi` (lib/api-v2) déballe avec `loose = r?.data?.data ?? r?.data`, donc l'écran
 * fonctionne que la réponse soit simple ou DOUBLE-enveloppée : rien à corriger de ce côté.
 *
 * HONNÊTETÉ (assumée dans l'UI) : coller deux clés ne suffit PAS à publier le soir même.
 * Chaque plateforme soumet la publication automatisée à une revue de son côté — voir
 * `approval` dans PLATFORMS. Et le publieur envoie des VIDÉOS (shorts sur R2), pas des
 * visuels image + texte : c'est écrit noir sur blanc en tête d'écran.
 *
 * Charte LIRI : fond/panneau chauds, corail = action, encre SOMBRE sur aplat corail.
 * Aucune classe Tailwind à opacité non multiple de 5 (elles n'émettent aucun CSS).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Eye, EyeOff, Loader2, Save, Check, AlertCircle, Link2, CheckCircle2,
  ExternalLink, ChevronDown, ChevronUp, Copy, RefreshCw, ShieldAlert, Film,
} from 'lucide-react';
import { socialApi } from '@/lib/api-v2';
import { getApiBaseUrl } from '@/lib/apiBase';

/* Tokens de la charte LIRI (valeurs littérales : ce composant est monté aussi bien dans
   la coque du portail que dans une page autonome — on ne dépend d'aucune var héritée). */
const C = {
  panel: '#30302e',
  field: '#2b2a27',
  ink: '#f5f4ee',
  muted: '#b0ada3',
  faint: '#82807a',
  line: 'rgba(245,244,238,.09)',
  lineSoft: 'rgba(245,244,238,.05)',
  coral: '#d97757',
  coralInk: '#1f1e1c', // encre SOMBRE sur aplat corail (5,34:1) — le blanc tomberait à 2,83:1
  gold: '#d99a4e',
  goldSoft: '#e6b878',
  sage: '#9fbf8f',
  danger: '#e2553f',
  mono: "'JetBrains Mono','Fira Code',ui-monospace,monospace",
};

/* L'URI de redirection doit désigner l'**API publique** : c'est elle (pas le front) qui
   reçoit le callback OAuth. En développement `VITE_API_URL` vaut http://localhost:4000 —
   afficher cette valeur ferait échouer l'enregistrement chez la plateforme, qui refuse
   localhost. On retombe donc sur l'hôte public, qui est aussi le défaut serveur de
   `SocialOAuthService.redirectUri()` (`PUBLIC_API_URL || https://api.cimolace.space`). */
const PUBLIC_API_FALLBACK = 'https://api.cimolace.space';
function publicApiBase() {
  const base = getApiBaseUrl();
  const isPublicHttps = /^https:\/\//i.test(base) && !/localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(:|\/|$)/i.test(base);
  return isPublicHttps ? base : PUBLIC_API_FALLBACK;
}

const PLATFORMS = [
  {
    key: 'tiktok',
    label: 'TikTok',
    dev: 'developers.tiktok.com',
    devUrl: 'https://developers.tiktok.com',
    idLabel: 'Client Key',
    secretLabel: 'Client Secret',
    setup: 'Dans ton application TikTok, active les produits « Login Kit » et « Content Posting API ».',
    // Le point dur, dit sans détour : l'accès à la publication N'EST PAS automatique.
    approval:
      "TikTok ne t'ouvre pas la publication automatiquement : ton application doit passer son AUDIT (« Content Posting API »). Tant qu'il n'est pas accordé, les vidéos envoyées par l'API restent en visibilité privée — visibles de toi seul, invisibles du public. Compter de plusieurs jours à plusieurs semaines, et un refus reste possible.",
  },
  {
    key: 'facebook',
    label: 'Facebook / Instagram',
    dev: 'developers.facebook.com',
    devUrl: 'https://developers.facebook.com',
    idLabel: 'App ID',
    secretLabel: 'App Secret',
    setup: "Connecter Facebook publie aussi sur Instagram : ton compte Instagram doit être un compte Professionnel (Business) rattaché à ta Page Facebook.",
    approval:
      "Meta soumet les permissions de publication (pages_manage_posts, instagram_content_publish) à une revue d'application et à la vérification de l'entreprise. Avant validation, seuls les comptes déclarés comme testeurs de ton app peuvent recevoir des publications.",
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    dev: 'linkedin.com/developers',
    devUrl: 'https://www.linkedin.com/developers',
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
    setup: "Demande les produits « Sign In with LinkedIn using OpenID Connect » et « Share on LinkedIn » sur ton application.",
    approval:
      "La permission d'écriture (w_member_social) vient du produit « Share on LinkedIn » : il faut le demander sur l'application et attendre son octroi. Ce n'est pas actif dès la création des clés.",
  },
];

/* Copie presse-papiers avec repli : `navigator.clipboard` n'existe QUE dans un contexte
   sécurisé (https ou localhost). Sur une preview servie en http (IP LAN), sans le repli
   `execCommand` le bouton ne ferait rien du tout — et l'URI de redirection est
   précisément la valeur que l'utilisateur DOIT pouvoir emporter chez la plateforme. */
async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* on tombe sur le repli */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ value, title = 'Copier' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={async () => {
        if (await copyText(value)) {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium"
      style={{ border: `1px solid ${C.line}`, background: C.lineSoft, color: done ? C.sage : C.ink }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copié' : 'Copier'}
    </button>
  );
}

/** Bloc « URI de redirection » — visible SANS ouvrir le formulaire : sans cette valeur,
 *  l'utilisateur ne peut même pas terminer l'enregistrement de son app chez la plateforme. */
function RedirectUriBlock({ uri }) {
  return (
    <div className="rounded-xl p-3" style={{ border: `1px solid ${C.line}`, background: C.field }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
          URI de redirection à déclarer chez la plateforme
        </p>
        <CopyButton value={uri} title="Copier l'URI de redirection" />
      </div>
      <p className="mt-1.5 select-all break-all text-[12px]" style={{ fontFamily: C.mono, color: C.goldSoft }}>
        {uri}
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: C.muted }}>
        À coller telle quelle (au caractère près) dans les « Redirect URI » autorisés de ton application.
        C'est l'API qui reçoit la réponse de la plateforme, pas ce site.
      </p>
    </div>
  );
}

function PlatformCard({ def, status, onSaved }) {
  // Ouvert d'office tant que l'app n'est pas configurée : c'est l'action attendue.
  const [open, setOpen] = useState(() => !status?.configured);
  const [form, setForm] = useState({ clientId: '', clientSecret: '' });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const redirectUri = `${publicApiBase()}/social-publisher/oauth/${def.key}/callback`;
  const configured = Boolean(status?.configured);
  const connected = Boolean(status?.connected);

  const handleSave = async (e) => {
    e.preventDefault();
    // `preventDefault` bloque la soumission NATIVE, pas la remontée de l'événement :
    // si ce composant est monté dans un `<form>` parent (c'était le cas de
    // TenantAdminSettingsPage avant sa correction), le `onSubmit` du parent partait
    // AUSSI — une clé enregistrée déclenchait un PATCH branding parasite. La page a
    // été corrigée ; on garde la ceinture ici pour que le composant reste sûr partout
    // où on le montera ensuite.
    e.stopPropagation();
    setError('');
    setSaved(false);
    if (!form.clientId.trim() || !form.clientSecret.trim()) {
      setError('Renseignez les deux champs : identifiant et secret.');
      return;
    }
    setSaving(true);
    try {
      // POST :platform/config attend { clientId, clientSecret } et renvoie { ok: true }.
      // Le secret n'est JAMAIS relu : on vide le formulaire et on se fie au statut.
      await socialApi.saveConfig(def.key, form.clientId.trim(), form.clientSecret.trim());
      setForm({ clientId: '', clientSecret: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await onSaved();
    } catch (err) {
      setError(err?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const res = await socialApi.authorizeUrl(def.key);
      const url = res?.url;
      if (!url) throw new Error("L'API n'a pas renvoyé d'URL d'autorisation.");
      window.location.href = url; // on QUITTE l'application : la suite se joue chez la plateforme
    } catch (err) {
      setError(err?.message || 'Impossible de démarrer la connexion.');
      setConnecting(false);
    }
  };

  const StateLine = ({ ok, okText, koText }) => (
    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: ok ? C.sage : C.muted }}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
      {ok ? okText : koText}
    </span>
  );

  return (
    <div className="rounded-2xl p-4" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold"
            style={{ background: C.lineSoft, border: `1px solid ${C.line}`, color: C.goldSoft }}
            aria-hidden="true"
          >
            {def.label.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold" style={{ color: C.ink }}>{def.label}</p>
            {/* ÉTAT DIT EN TOUTES LETTRES sur deux lignes — un simple badge laissait
                l'utilisateur deviner ce qui bloquait (clés manquantes ? compte non lié ?). */}
            <div className="mt-1 flex flex-col gap-0.5">
              <StateLine ok={configured} okText="Application configurée" koText="Application non configurée" />
              <StateLine ok={connected} okText="Compte connecté" koText="Compte non connecté" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting || !configured}
            title={configured ? undefined : "Enregistrez d'abord l'identifiant et le secret de l'application."}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold"
            style={
              configured
                ? { background: C.coral, color: C.coralInk, opacity: connecting ? 0.6 : 1 }
                : { background: 'transparent', border: `1px solid ${C.line}`, color: C.faint, cursor: 'not-allowed' }
            }
          >
            {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            {connected ? 'Reconnecter le compte' : 'Connecter le compte'}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[12.5px]"
            style={{ border: `1px solid ${C.line}`, color: C.ink }}
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {configured ? 'Remplacer les clés' : 'Renseigner les clés'}
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={handleSave} className="mt-4 space-y-3 pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
          <p className="text-[12.5px] leading-relaxed" style={{ color: C.muted }}>
            Créez une application sur{' '}
            <a
              href={def.devUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 underline"
              style={{ color: C.goldSoft }}
            >
              {def.dev} <ExternalLink className="h-3 w-3" />
            </a>
            , déclarez-y l'URI de redirection ci-dessous, puis recopiez ici ses identifiants.
          </p>

          {def.setup && (
            <p className="rounded-xl px-3 py-2 text-[11.5px] leading-relaxed"
               style={{ border: `1px solid ${C.line}`, background: C.field, color: C.muted }}>
              {def.setup}
            </p>
          )}

          <RedirectUriBlock uri={redirectUri} />

          {/* Le mur réel entre « j'ai mes clés » et « je publie » — dit avant la saisie. */}
          <div className="flex gap-2 rounded-xl px-3 py-2.5"
               style={{ border: `1px solid rgba(217,154,78,.30)`, background: 'rgba(217,154,78,.10)' }}>
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.gold }} />
            <p className="text-[11.5px] leading-relaxed" style={{ color: C.goldSoft }}>
              {def.approval}
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-medium" style={{ color: C.ink }}>{def.idLabel}</label>
            <input
              className="w-full rounded-xl px-3 py-2 text-[13px] outline-none"
              style={{ border: `1px solid ${C.line}`, background: C.field, color: C.ink, fontFamily: C.mono }}
              value={form.clientId}
              disabled={saving}
              onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}
              placeholder={`${def.idLabel}…`}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-medium" style={{ color: C.ink }}>{def.secretLabel}</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                className="w-full rounded-xl px-3 py-2 pr-10 text-[13px] outline-none"
                style={{ border: `1px solid ${C.line}`, background: C.field, color: C.ink, fontFamily: C.mono }}
                value={form.clientSecret}
                disabled={saving}
                onChange={(e) => setForm((p) => ({ ...p, clientSecret: e.target.value }))}
                placeholder="••••••••"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                aria-label={showSecret ? 'Masquer le secret' : 'Afficher le secret'}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: C.faint }}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px]" style={{ color: C.faint }}>
              Le secret n'est jamais réaffiché après enregistrement. Pour le changer, ressaisissez les deux champs.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[12.5px]" style={{ color: C.danger }}>
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold"
            style={{ background: C.coral, color: C.coralInk, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? 'Enregistrement…' : saved ? 'Enregistré' : 'Enregistrer les identifiants'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function TenantSocialSettings() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      // GET /oauth/status → tableau [{ platform, configured, connected }] (RolesGuard owner/admin).
      const data = await socialApi.status();
      setStatuses(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err?.message || "Impossible de lire l'état des réseaux sociaux.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Retour d'OAuth. ⚠️ Aujourd'hui l'API redirige vers `${APP_PUBLIC_URL}/?social_connected=…`
     — c'est-à-dire la RACINE du front, pas cet écran : ces paramètres n'arrivent donc
     quasiment jamais ici. On les traite quand même (le jour où l'API redirigera vers
     /liri/reglages, tout marche sans retoucher le front), et surtout on offre le bouton
     « Actualiser l'état » ci-dessous, qui rend la vérification possible dès maintenant. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('social_connected');
    const err = params.get('social_error');
    if (!ok && !err) return;
    if (ok) setFlash(`Compte ${ok} connecté.`);
    if (err) setError(`Connexion refusée par la plateforme : ${err}`);
    params.delete('social_connected');
    params.delete('social_error');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    load(true);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-[13px]" style={{ color: C.muted }}>
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement de l'état des réseaux…
      </div>
    );
  }

  const byKey = Object.fromEntries(statuses.map((s) => [s.platform, s]));

  return (
    <div className="space-y-4">
      {/* CE QUE FAIT RÉELLEMENT LE PUBLIEUR — dit avant toute promesse. Le publieur
          présigne un fichier vidéo stocké sur R2 (short_clips.storage_key) et l'envoie
          en PULL_FROM_URL : il n'existe aujourd'hui aucun chemin « image + texte ». */}
      <div className="flex gap-3 rounded-xl p-4" style={{ border: `1px solid ${C.line}`, background: C.field }}>
        <Film className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.coral }} />
        <div className="space-y-1.5">
          <p className="text-[13px] leading-relaxed" style={{ color: C.ink }}>
            Ces connexions servent à publier les <strong>shorts vidéo</strong> produits après un live.
          </p>
          <p className="text-[12px] leading-relaxed" style={{ color: C.muted }}>
            Le publieur envoie un fichier vidéo hébergé par la plateforme d'origine. Il ne sait pas
            encore publier un visuel « image + texte » : les publicités créées dans le Studio ne
            partent donc pas par ce canal.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px]" style={{ color: C.muted }}>
          Après avoir autorisé l'accès chez la plateforme, revenez ici et actualisez pour vérifier l'état.
        </p>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-medium"
          style={{ border: `1px solid ${C.line}`, color: C.ink, opacity: refreshing ? 0.6 : 1 }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser l'état
        </button>
      </div>

      {flash && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px]"
             style={{ border: '1px solid rgba(159,191,143,.30)', background: 'rgba(159,191,143,.10)', color: C.sage }}>
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {flash}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px]"
             style={{ border: '1px solid rgba(226,85,63,.30)', background: 'rgba(226,85,63,.10)', color: C.danger }}>
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {PLATFORMS.map((def) => (
        <PlatformCard key={def.key} def={def} status={byKey[def.key]} onSaved={() => load(true)} />
      ))}
    </div>
  );
}
