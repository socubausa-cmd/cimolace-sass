/**
 * Studio Ad Creator — Créateur de publicités IA multi-plateformes
 * Route: /studio/ad-creator
 *
 * ⚠️ CONTRAT DE VÉRITÉ DE CET ÉCRAN (2026-07) — à lire avant toute évolution.
 * Cet écran a longtemps MENTI sur deux points, désormais corrigés :
 *
 *  1. L'onglet « Canaux » proposait un formulaire (pixel, token, ad_account_id…)
 *     écrit dans la table `channel_integrations`. AUCUN code de publication ne lit
 *     cette table : c'était un réglage sans effet. Le VRAI publieur est le module
 *     NestJS `social-publisher`, qui lit `social_tokens` (OAuth par tenant) et les
 *     identifiants d'app dans `tenants.metadata.social_apps`. L'onglet reflète
 *     maintenant CE système-là, et rien d'autre.
 *
 *  2. Le bouton « Publier » n'envoyait rien : il insérait une ligne dans
 *     `ad_creatives` avec `published_at`. Zéro appel réseau. Les boutons disent
 *     désormais ce qu'ils font (« enregistrer »), et un bouton de DIFFUSION réelle
 *     n'apparaît que si toutes les conditions du publieur sont réunies.
 *
 *  ⚠️ CONTRAINTE PRODUIT DURE : le publieur envoie des VIDÉOS. `publishTo*()` exige
 *  un `social_posts` rattaché à un `short_clips` portant un `storage_key` sur R2
 *  (présigné puis tiré par la plateforme, ou poussé en octets pour LinkedIn). Une
 *  publicité « texte + visuel » n'a AUCUN chemin de diffusion aujourd'hui : on le
 *  dit à l'écran au lieu de le simuler.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
// Imports nettoyés : les icônes des réglages décoratifs supprimés (chevrons du
// formulaire de canaux, éclair du bouton « Publier ») ne sont plus importées.
import {
  Megaphone, Sparkles, ArrowLeft, ArrowRight, Check,
  Facebook, Youtube, Globe, Target, Eye, BarChart3, RefreshCw,
  Loader2, Plus, Edit3, Film, BookOpen,
  Instagram, Share2, TrendingUp, Settings, Link2,
  CheckCircle2, AlertCircle, Clock, Star, ClipboardList,
  Linkedin, ExternalLink, Send, Save, Ban,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
// Rôle de l'utilisateur : /studio/* est ouvert à teacher, secretariat, practitioner
// et clinic_admin en plus d'owner/admin, alors que /liri/reglages et les routes
// social-publisher/oauth/* sont owner/admin STRICT. Sans lire le rôle ici, cet écran
// proposait à un enseignant un lien qui l'éjectait du Studio vers /dashboard.
import { useAuth } from '@/hooks/useAuth';
import { getEffectiveRole } from '@/lib/accountRoleMode';
import { resolveNetlifyApiUrl } from '@/lib/resolveNetlifyApiUrl';
import { getApiBaseUrl } from '@/lib/apiBase';
import { socialApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import useTenantBranding from '@/hooks/useTenantBranding';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * ⚠️ Les couleurs des PLATEFORMES sont des COULEURS DE MARQUE TIERCE : le bleu
 * Facebook et le cyan TikTok IDENTIFIENT le réseau, ils ne décorent pas. On les
 * garde tels quels malgré la charte chaude — les réchauffer rendrait les six
 * cartes indistinctes. Seul « Multi-canal », qui n'appartient à aucune marque,
 * passe sur le corail LIRI.
 */
const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', formats: ['feed', 'story', 'carousel', 'reel'] },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-400', bg: 'bg-pink-500/15', border: 'border-pink-500/30', formats: ['feed', 'story', 'reel', 'carousel'] },
  { id: 'tiktok', label: 'TikTok', icon: Film, color: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', formats: ['short', 'feed'] },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', formats: ['short', 'banner', 'feed'] },
  { id: 'google', label: 'Google Ads', icon: Globe, color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', formats: ['banner', 'search'] },
  { id: 'multi', label: 'Multi-canal', icon: Share2, color: 'text-[#e8a97f]', bg: 'bg-[#d97757]/15', border: 'border-[#d97757]/30', formats: ['feed', 'story', 'short'] },
];

/**
 * Objectifs : ici la couleur porte du SENS (5 intentions distinctes), pas une
 * marque. Elle est donc rejouée sur la rampe chaude en gardant 5 teintes
 * franchement séparables : corail · olive · sable · ambre · rose.
 */
const OBJECTIVES = [
  { id: 'acquisition', label: 'Acquisition', desc: 'Attirer de nouveaux prospects', icon: Target, color: 'text-[#e08a5f]' },
  { id: 'conversion', label: 'Conversion', desc: 'Transformer en clients payants', icon: TrendingUp, color: 'text-[#9cc48a]' },
  { id: 'awareness', label: 'Notoriété', desc: 'Faire connaître votre marque', icon: Eye, color: 'text-[#e6c48f]' },
  { id: 'retargeting', label: 'Relance', desc: 'Relancer les prospects tièdes', icon: RefreshCw, color: 'text-amber-400' },
  { id: 'engagement', label: 'Engagement', desc: 'Générer interactions et partages', icon: Star, color: 'text-pink-400' },
];

// « Story », « Reel » et « Short » sont les noms que les plateformes donnent
// elles-mêmes à ces formats : les traduire embrouillerait plus qu'autre chose.
// Tout le reste est en français.
const FORMAT_LABELS = { feed: 'Fil d\'actualité', story: 'Story (9:16)', reel: 'Reel / Short', short: 'Vidéo courte', banner: 'Bannière', search: 'Annonce de recherche', carousel: 'Carrousel' };

/**
 * CANAUX RÉELS DU PUBLIEUR — la liste vient de `SocialOAuthService.PLATFORMS`
 * (apps/api/src/social-publisher/social-oauth.service.ts) : tiktok, facebook,
 * linkedin. Instagram n'est PAS une entrée OAuth : la connexion Meta (facebook)
 * couvre la Page Facebook ET le compte Instagram Business qui lui est lié —
 * c'est le même `social_tokens.platform = 'facebook'`, avec `metadata.ig_user_id`
 * résolu au retour du callback.
 *
 * ⛔ Ne PAS rajouter ici « Google Ads », « Meta Ads » ou « GA4 » : aucune régie
 * publicitaire n'est branchée côté serveur. Les remettre recréerait le formulaire
 * décoratif qui vient d'être retiré.
 *
 * Idem que PLATFORMS : bleu Meta et cyan TikTok = identité des réseaux, on ne les
 * réchauffe pas, ils servent à distinguer les marques.
 */
const SOCIAL_CHANNELS = [
  {
    key: 'tiktok',
    label: 'TikTok',
    icon: Film,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/25',
    desc: 'Publication de vidéos via la Content Posting API (la vidéo est tirée depuis le stockage de l\'école).',
    publishes: ['tiktok'],
  },
  {
    key: 'facebook',
    label: 'Meta — Facebook & Instagram',
    icon: Facebook,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
    desc: 'Une seule connexion couvre la Page Facebook et le compte Instagram Business qui lui est lié.',
    publishes: ['facebook', 'instagram'],
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    // Bleu LinkedIn éclairci pour le fond sombre : couleur de MARQUE (même exception
    // que Facebook/TikTok). Écrit en hex plutôt qu'en classe froide `sky-`, bannie.
    color: 'text-[#5aa2e8]',
    bg: 'bg-[#0A66C2]/15',
    border: 'border-[#0A66C2]/35',
    desc: 'Publication au nom du membre connecté (la vidéo est envoyée en octets, LinkedIn ne tire pas d\'URL).',
    publishes: ['linkedin'],
  },
];

/**
 * Réseaux que le publieur sait RÉELLEMENT servir, avec la clé de token utilisée.
 * Instagram publie avec le token Meta (`facebook`) — c'est la logique exacte de
 * `publishToInstagram()`, qui appelle `getToken(tenantId, 'facebook')`.
 */
const PUBLISHABLE = {
  tiktok: { label: 'TikTok', tokenKey: 'tiktok' },
  facebook: { label: 'Facebook', tokenKey: 'facebook' },
  instagram: { label: 'Instagram', tokenKey: 'facebook' },
  linkedin: { label: 'LinkedIn', tokenKey: 'linkedin' },
};

/**
 * Écran où l'on saisit le Client ID / Client Secret de l'application sociale.
 *
 * ⚠️ CHEMIN VÉRIFIÉ DANS LE CODE, PAS DEVINÉ : `TenantAdminSettingsPage` (qui monte
 * `TenantSocialSettings`) est routée dans App.jsx sur `/liri/reglages`, gardée
 * owner/admin, et la section porte l'ancre `#reseaux-sociaux`. Si cette route
 * venait à disparaître, mettre cette constante à `null` suffit : les cartes
 * basculent alors sur une consigne en texte, sans jamais afficher de lien mort.
 *
 * ⚠️ CETTE ROUTE EST GARDÉE owner/admin, alors que /studio/* accepte aussi teacher,
 * secretariat, practitioner et clinic_admin. Le chemin n'est donc PASSÉ aux cartes
 * que si l'utilisateur peut y entrer (cf. `canOpenSocialSettings`) : sinon le clic
 * déclenche `<Navigate to="/dashboard">` et éjecte l'utilisateur du Studio.
 */
const SOCIAL_SETTINGS_PATH = '/liri/reglages#reseaux-sociaux';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPlatform = (id) => PLATFORMS.find((p) => p.id === id) || PLATFORMS[0];

async function authFetch(url, options = {}) {
  const { data: sessData } = await supabase.auth.getSession();
  const token = sessData?.session?.access_token;
  if (!token) throw new Error('Session invalide');
  const resolved = resolveNetlifyApiUrl(url);
  const res = await fetch(resolved, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || 'Erreur API');
  return payload;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDots({ step, total }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all',
            i < step ? 'w-6 h-2 bg-[var(--school-accent,#d99a4e)]' : i === step - 1 ? 'w-8 h-2 bg-[var(--school-accent,#d99a4e)]' : 'w-2 h-2 bg-white/15'
          )}
        />
      ))}
      <span className="text-xs text-gray-400 ml-1">{step}/{total}</span>
    </div>
  );
}

function PlatformCard({ platform, selected, onSelect }) {
  const p = getPlatform(platform.id);
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(platform.id)}
      className={cn(
        'relative p-4 rounded-xl border text-left transition-all',
        selected ? `${platform.border} ${platform.bg}` : 'border-white/10 bg-white/5 hover:bg-white/10'
      )}
    >
      {selected && <div className="absolute top-2 right-2 w-5 h-5 bg-[var(--school-accent,#d99a4e)] rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-black" /></div>}
      <platform.icon className={cn('w-6 h-6 mb-3', platform.color)} />
      <p className="text-sm font-semibold text-white">{platform.label}</p>
      <p className="text-xs text-gray-400 mt-1">{platform.formats.slice(0, 2).map((f) => FORMAT_LABELS[f] || f).join(' · ')}</p>
    </motion.button>
  );
}

function AdPreviewCard({ platform, headline, description, cta, hashtags, format }) {
  const p = getPlatform(platform);
  const isVertical = ['story', 'reel', 'short'].includes(format);
  return (
    <div className={cn('rounded-2xl border overflow-hidden', p.border, p.bg)}>
      <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10">
        <p.icon className={cn('w-4 h-4', p.color)} />
        <span className="text-xs text-gray-300">{p.label}</span>
        <span className="ml-auto text-[10px] text-gray-500">{FORMAT_LABELS[format] || format}</span>
      </div>
      {/* Fenêtre d'aperçu média : surface la plus sombre de la charte (#1f1e1c, cf. --rail),
          qui fait « scène » sous le visuel — le navy #0B1017 jurait avec les panneaux chauds.
          ⚠️ Le libellé disait « Aperçu visuel », ce qui laissait croire qu'un visuel serait
          produit. Cet écran ne génère QUE du texte : on nomme le vide au lieu de le suggérer. */}
      <div className={cn('bg-[#1f1e1c] flex items-center justify-center px-3', isVertical ? 'h-40' : 'h-28')}>
        <div className="text-center">
          {/* L'icône reste sombre (décor) ; les DEUX phrases passent à l'encre
              secondaire de la charte #b0ada3 (7,4:1 sur #1f1e1c). En gray-500/600
              elles tombaient à 3,43:1 et 2,18:1 — illisibles en plein jour, alors
              qu'elles portent l'aveu « cet écran ne fabrique aucun visuel ». */}
          <Film className="w-8 h-8 text-gray-600 mx-auto mb-1" />
          <p className="text-xs text-[#b0ada3]">Aucun visuel généré</p>
          <p className="text-[10px] text-[#b0ada3]">Cet écran rédige le texte</p>
        </div>
      </div>
      <div className="p-3 space-y-1">
        {headline && <p className="text-sm font-semibold text-white line-clamp-2">{headline}</p>}
        {description && <p className="text-xs text-gray-300 line-clamp-3">{description}</p>}
        {/* Hashtags : teinte « lien » générique, commune à tous les réseaux — ce
            n'est PAS une couleur de marque, elle passe donc sur l'or de la charte. */}
        {hashtags?.length > 0 && (
          <p className="text-xs text-[#e6b878]">{hashtags.slice(0, 4).map((h) => `#${h.replace('#', '')}`).join(' ')}</p>
        )}
        {cta && (
          <button type="button" className={cn('mt-2 w-full py-1.5 rounded-lg text-xs font-semibold', p.bg, p.color, 'border', p.border)}>
            {cta}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Carte d'un canal RÉEL du publieur. QUATRE états, quatre discours différents :
 *
 *  · état INCONNU (`statusUnknown`) → GET /social-publisher/oauth/status a échoué
 *    (403 pour un enseignant : la route est @Roles('owner','admin')). On ne SAIT
 *    donc rien de ce canal. On ne dit surtout pas « non configurée » : l'application
 *    peut être parfaitement en place. Aucun bouton, aucune affirmation.
 *  · non configurée → l'école n'a pas encore déposé son Client ID/Secret. On
 *    n'affiche AUCUN bouton « Connecter » : il partirait en 400
 *    (« App {platform} non configurée ») côté `getAuthorizeUrl`. On explique et
 *    on renvoie vers l'écran de saisie des clés — mais SEULEMENT si l'utilisateur
 *    a le droit d'y entrer (cf. `settingsPath`, mis à null sinon).
 *  · configurée, pas connectée → bouton « Connecter » qui ouvre l'URL
 *    d'autorisation renvoyée par GET /social-publisher/oauth/:platform/start.
 *  · connectée → badge + nom du compte résolu (Page Meta / membre LinkedIn),
 *    et « Reconnecter » pour renouveler le token expiré.
 */
function SocialChannelCard({ channel, status, token, onConnect, connecting, settingsPath, statusUnknown = false }) {
  // `statusUnknown` PRIME sur tout : sans réponse du serveur, `status` vaut
  // undefined et les deux booléens ci-dessous seraient FAUX par accident — c'est
  // exactement ce qui faisait affirmer « aucune application enregistrée » à tort.
  const configured = !statusUnknown && Boolean(status?.configured);
  const connected = !statusUnknown && Boolean(status?.connected);

  if (statusUnknown) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', channel.bg, 'border', channel.border)}>
              <channel.icon className={cn('h-5 w-5', channel.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{channel.label}</p>
              <p className="mt-0.5 text-xs text-[#b0ada3]">{channel.desc}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d99a4e]/35 bg-[#d99a4e]/15 px-2 py-0.5 text-[10px] font-medium text-[#e6b878]">
            <AlertCircle className="h-3 w-3" /> État inconnu
          </span>
        </div>
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-xs text-[#b0ada3]">
            L'état de ce canal n'a pas pu être lu : cette information est réservée aux
            responsables de l'école. Impossible de dire depuis cet écran si l'application
            est enregistrée ou si un compte est connecté.
          </p>
        </div>
      </div>
    );
  }

  const badge = connected
    ? { txt: 'Compte connecté', cls: 'bg-[#5a8f52]/20 text-[#9cc48a] border-[#5a8f52]/35', Icon: CheckCircle2 }
    : configured
      ? { txt: 'Application prête — compte à connecter', cls: 'bg-[#d99a4e]/15 text-[#e6b878] border-[#d99a4e]/35', Icon: AlertCircle }
      : { txt: 'Application non configurée', cls: 'bg-white/5 text-gray-400 border-white/10', Icon: AlertCircle };

  return (
    <div className={cn('rounded-xl border p-4 transition-all', connected ? `${channel.border} ${channel.bg}` : 'border-white/10 bg-white/5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', channel.bg, 'border', channel.border)}>
            <channel.icon className={cn('w-5 h-5', channel.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{channel.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{channel.desc}</p>
          </div>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 inline-flex items-center gap-1', badge.cls)}>
          <badge.Icon className="w-3 h-3" /> {badge.txt}
        </span>
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        {!configured && (
          <div className="space-y-2">
            <p className="text-xs text-gray-300">
              Aucune application {channel.label} n'est enregistrée pour votre école. Déposez d'abord
              le Client ID et le Client Secret obtenus chez la plateforme : sans eux, la connexion
              d'un compte est impossible.
            </p>
            {settingsPath ? (
              <Link
                to={settingsPath}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/10"
              >
                <Settings className="w-3.5 h-3.5" />
                Réglages de l'école › Réseaux sociaux
              </Link>
            ) : (
              /* Repli : pas le droit d'entrer dans /liri/reglages (ou tenant non
                 résolu) → pas de lien qui éjecterait, une consigne exacte. */
              <p className="text-[11px] text-[#b0ada3]">
                Ces clés se déposent dans les réglages de l'école, section « Réseaux sociaux »,
                par le propriétaire ou un administrateur. Rapprochez-vous d'un responsable.
              </p>
            )}
          </div>
        )}

        {configured && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 text-xs text-gray-400">
              {connected ? (
                <>
                  Compte : <span className="text-white">{token?.page_name || 'compte connecté'}</span>
                  {!token?.page_id && channel.key !== 'tiktok' && (
                    /* page_id = Page Meta ou URN LinkedIn. Le serveur refuse de publier sans. */
                    <span className="ml-1 text-[#e6b878]">
                      — identifiant de page/auteur non résolu, la publication échouera.
                    </span>
                  )}
                </>
              ) : (
                'Application enregistrée. Il reste à autoriser le compte sur la plateforme.'
              )}
            </div>
            <button
              type="button"
              onClick={() => onConnect(channel.key)}
              disabled={connecting}
              /* Corail = LES ACTIONS. Encre sombre obligatoire sur aplat corail (5,34:1). */
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#d97757] px-3 py-1.5 text-xs font-semibold text-[#1f1e1c] transition-all hover:brightness-110 disabled:opacity-50"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              {connected ? 'Reconnecter' : 'Connecter'}
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudioAdCreatorPage() {
  const { toast } = useToast();
  const { user, tenantRole } = useAuth();
  const { branding, cssVars } = useTenantBranding();
  const [activeTab, setActiveTab] = useState('create');
  const [step, setStep] = useState(1);
  /** Sous-écrans étape 1 : 0 = plateformes, 1 = format + objectifs */
  const [adStep1Pane, setAdStep1Pane] = useState(0);
  const [recapOpen, setRecapOpen] = useState(false);

  // Step 1 — Platform + Objective
  const [selectedPlatform, setSelectedPlatform] = useState('facebook');
  const [selectedFormat, setSelectedFormat] = useState('feed');
  const [selectedObjective, setSelectedObjective] = useState('acquisition');

  // Step 2 — Source
  const [sourceType, setSourceType] = useState('manual');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceDescription, setSourceDescription] = useState('');
  // (plus d'état clipStart/clipEnd : le découpeur décoratif a été retiré)
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [loadingModules, setLoadingModules] = useState(false);

  // Step 3 — Generated content
  const [generating, setGenerating] = useState(false);
  const [adContent, setAdContent] = useState({ headline: '', description: '', cta: 'Commencer maintenant', hashtags: [], hook: '', variations: [] });
  const [activeVariation, setActiveVariation] = useState(null);
  const [saving, setSaving] = useState(false);

  // History
  const [creatives, setCreatives] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ─── Canaux sociaux RÉELS (social-publisher) ───────────────────────────────
  // `status` = par plateforme { configured, connected } ; `tokens` = comptes
  // effectivement stockés (page_id/page_name). Les deux viennent de l'API NestJS,
  // jamais d'une table front. `channelsError` porte le message exact de l'API
  // (403 si l'utilisateur n'est ni owner ni admin — les routes sont gardées).
  const [socialStatus, setSocialStatus] = useState([]);
  const [socialTokens, setSocialTokens] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelsError, setChannelsError] = useState('');
  const [connectingPlatform, setConnectingPlatform] = useState('');

  // ─── Diffusion réelle (étape 3) ────────────────────────────────────────────
  // Clips vidéo prêts : SEULE matière que le publieur sait envoyer.
  const [shorts, setShorts] = useState([]);
  const [loadingShorts, setLoadingShorts] = useState(false);
  const [selectedShortId, setSelectedShortId] = useState('');
  const [publishTarget, setPublishTarget] = useState('');
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (step !== 1) setAdStep1Pane(0);
  }, [step]);

  useEffect(() => {
    if (activeTab === 'sources' || sourceType === 'module') fetchModules();
  }, [activeTab, sourceType]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  // L'état des canaux est nécessaire à l'onglet « Canaux » ET à l'étape 3 (le
  // bouton de diffusion ne s'affiche que si un compte est connecté) : on le
  // charge aussi quand on entre dans l'étape 3.
  useEffect(() => {
    if (activeTab === 'channels' || (activeTab === 'create' && step === 3)) fetchChannels();
  }, [activeTab, step]);

  useEffect(() => {
    if (activeTab === 'create' && step === 3) fetchShorts();
  }, [activeTab, step]);

  const fetchModules = async () => {
    setLoadingModules(true);
    try {
      const { data } = await supabase
        .from('modules')
        .select('id, title, description, video_url')
        .order('created_at', { ascending: false })
        .limit(20);
      setModules(data || []);
    } catch (e) {
      console.error('fetchModules', e);
    } finally {
      setLoadingModules(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('ad_creatives')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setCreatives(data || []);
    } catch (e) {
      console.error('fetchHistory', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  /**
   * État RÉEL des canaux : GET /social-publisher/oauth/status (configured/connected)
   * + GET /social-publisher/tokens (page_id/page_name des comptes connectés).
   * ⚠️ Les deux routes sont gardées owner/admin — un enseignant reçoit 403, et on
   * affiche le message plutôt qu'un écran vide qui laisserait croire à « rien à
   * configurer ». `socialApi` déballe déjà l'enveloppe NestJS { data: … }.
   */
  const fetchChannels = async () => {
    setLoadingChannels(true);
    setChannelsError('');
    try {
      const status = await socialApi.status();
      setSocialStatus(Array.isArray(status) ? status : []);
      // Les tokens sont un CONFORT (nom du compte) : leur échec ne doit pas
      // masquer le statut, qui est l'information structurante.
      try {
        setSocialTokens(await socialApi.tokens());
      } catch {
        setSocialTokens([]);
      }
    } catch (e) {
      setSocialStatus([]);
      setChannelsError(String(e?.message || e));
    } finally {
      setLoadingChannels(false);
    }
  };

  /** Clips vidéo prêts (short_clips status=ready). Seuls ceux qui ont un storage_key sont diffusables. */
  const fetchShorts = async () => {
    setLoadingShorts(true);
    try {
      setShorts(await socialApi.shorts());
    } catch (e) {
      console.error('fetchShorts', e);
      setShorts([]);
    } finally {
      setLoadingShorts(false);
    }
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleSelectModule = useCallback((mod) => {
    setSelectedModuleId(mod.id);
    setSourceTitle(mod.title || '');
    setSourceDescription(mod.description || '');
    setSourceType('module');
  }, []);

  const generateAdCopy = async () => {
    if (!sourceTitle.trim() && !sourceDescription.trim()) {
      toast({ title: 'Source requise', description: 'Ajoutez un titre ou une description.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      // Endpoint RÉEL = NestJS POST /ai-utils/ad-copy/generate. L'ancien '/api/ad/copy-generate'
      // pointait sur une fonction Netlily morte → 404. URL absolue → passthrough resolveNetlifyApiUrl.
      const payload = await authFetch(`${getApiBaseUrl()}/ai-utils/ad-copy/generate`, {
        method: 'POST',
        body: JSON.stringify({
          platform: selectedPlatform,
          objective: selectedObjective,
          sourceTitle,
          sourceDescription,
          language: 'fr',
          tone: 'professional',
        }),
      });
      const ad = payload?.data ?? payload ?? {}; // enveloppe NestJS { data: ... }
      setAdContent({
        headline: ad.headline || '',
        description: ad.description || '',
        cta: ad.cta || 'Commencer maintenant',
        hashtags: ad.hashtags || [],
        hook: ad.hook || '',
        variations: ad.variations || [],
      });
      setActiveVariation(null);
      toast({ title: 'Publicité générée', description: 'Contenu IA créé avec succès.' });
    } catch (e) {
      toast({ title: 'Erreur IA', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  /**
   * ENREGISTREMENT LOCAL, RIEN D'AUTRE. Écrit une ligne dans `ad_creatives`.
   * ⚠️ Aucun réseau social n'est contacté ici — c'est précisément le mensonge
   * qu'on a retiré : l'ancien statut `published` (+ published_at) était posé sans
   * le moindre appel réseau. Ce statut n'est plus jamais écrit depuis cet écran ;
   * seule une diffusion réelle (publishNow) doit pouvoir prétendre à ce mot.
   */
  const saveCreative = async (status = 'draft') => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');
      const active = activeVariation !== null ? adContent.variations[activeVariation] : null;
      const content = active || adContent;
      await supabase.from('ad_creatives').insert({
        created_by: user.id,
        title: sourceTitle || 'Publicité sans titre',
        status,
        platform: selectedPlatform,
        format: selectedFormat,
        objective: selectedObjective,
        source_type: sourceType,
        source_id: selectedModuleId || null,
        source_title: sourceTitle,
        // Plus de faux bornage : le découpeur décoratif ayant disparu, on n'écrit
        // plus deux secondes qu'aucun encodeur n'a jamais utilisées.
        clip_start_seconds: null,
        clip_end_seconds: null,
        headline: content.headline,
        description: content.description,
        cta: content.cta,
        hashtags: content.hashtags || [],
        published_at: null,
      });
      toast({
        title: status === 'ready' ? 'Publicité marquée comme prête' : 'Brouillon enregistré',
        description: 'Enregistrée dans « Mes publicités ». Aucune diffusion n\'a été envoyée.',
      });
      if (activeTab === 'history') fetchHistory();
    } catch (e) {
      toast({ title: 'Enregistrement impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Connexion d'un compte : on demande à l'API l'URL d'autorisation de la
   * plateforme puis on y envoie l'utilisateur. Le retour se fait sur le callback
   * PUBLIC de l'API, qui stocke le token et redirige vers le front avec
   * `?social_connected=` ou `?social_error=`.
   */
  const connectChannel = async (platform) => {
    setConnectingPlatform(platform);
    try {
      const res = await socialApi.authorizeUrl(platform);
      const url = res?.url;
      if (!url) throw new Error('URL d\'autorisation vide.');
      window.location.href = url;
    } catch (e) {
      toast({ title: 'Connexion impossible', description: String(e?.message || e), variant: 'destructive' });
      setConnectingPlatform('');
    }
  };

  // Au retour du callback OAuth, l'API redirige avec ?social_connected / ?social_error.
  // ⚠️ LIMITE CONNUE, non masquée : le callback serveur redirige vers la RACINE du
  // front (`APP_PUBLIC_URL`), pas vers cet écran — l'utilisateur revient donc sur
  // l'accueil. Ce gestionnaire est un filet : il affiche le résultat si les
  // paramètres arrivent jusqu'ici, et nettoie l'URL pour ne pas coller le message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('social_connected');
    const err = params.get('social_error');
    if (!ok && !err) return;
    if (ok) {
      toast({ title: 'Compte connecté', description: `${PUBLISHABLE[ok]?.label || ok} est maintenant relié à votre école.` });
      setActiveTab('channels');
    } else {
      toast({ title: 'Connexion refusée', description: decodeURIComponent(err), variant: 'destructive' });
    }
    params.delete('social_connected');
    params.delete('social_error');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [toast]);

  /**
   * L'utilisateur peut-il RÉELLEMENT ouvrir /liri/reglages ?
   *
   * MIROIR EXACT du garde de la route (ProtectedRoleRoute avec
   * allowedRoles=['owner','admin'] + allowTenantRole) : rôle global effectif OU
   * `tenant_role` du JWT. POURQUOI c'est indispensable ici : /studio/* accepte aussi
   * teacher, secretariat, practitioner et clinic_admin. Pour eux, le lien « Réglages
   * de l'école » était un piège — ProtectedRoleRoute renvoie `<Navigate to="/dashboard">`,
   * donc un clic les éjectait du Studio, sans message, tout travail en cours perdu.
   * Quand c'est faux, la carte affiche le repli textuel (« voyez avec un responsable »).
   */
  const canOpenSocialSettings = useMemo(() => {
    const allowed = ['owner', 'admin'];
    return (
      allowed.includes(String(getEffectiveRole(user) || '').toLowerCase()) ||
      allowed.includes(String(tenantRole || '').toLowerCase())
    );
  }, [user, tenantRole]);

  const currentPlatform = getPlatform(selectedPlatform);
  const displayContent = activeVariation !== null && adContent.variations[activeVariation]
    ? { ...adContent, ...adContent.variations[activeVariation] }
    : adContent;

  // ─── Diffusion réelle : dérivations ─────────────────────────────────────────

  const statusOf = useCallback(
    (tokenKey) => socialStatus.find((s) => s.platform === tokenKey) || null,
    [socialStatus],
  );

  /** Réseaux à la fois PRIS EN CHARGE par le publieur ET dont le compte est connecté. */
  const connectedTargets = useMemo(
    () => Object.keys(PUBLISHABLE).filter((k) => statusOf(PUBLISHABLE[k].tokenKey)?.connected),
    [statusOf],
  );

  /**
   * Cible par défaut : la plateforme choisie pour la publicité si le publieur sait
   * la servir ET qu'elle est connectée. Sinon, le premier réseau connecté — on ne
   * présélectionne JAMAIS un réseau qui ferait échouer l'envoi.
   */
  useEffect(() => {
    if (publishTarget && connectedTargets.includes(publishTarget)) return;
    setPublishTarget(
      connectedTargets.includes(selectedPlatform) ? selectedPlatform : (connectedTargets[0] || ''),
    );
  }, [connectedTargets, selectedPlatform, publishTarget]);

  // Le publieur PRÉSIGNE `storage_key` (R2) : un clip sans clé de stockage n'est pas envoyable.
  const publishableShorts = useMemo(() => shorts.filter((s) => s?.storage_key), [shorts]);
  const selectedShort = useMemo(
    () => publishableShorts.find((s) => s.id === selectedShortId) || null,
    [publishableShorts, selectedShortId],
  );

  /**
   * CONDITIONS DURES d'une vraie diffusion, dans l'ordre où le serveur les vérifie.
   * Chacune correspond à un `throw` réel de social-publisher.service.ts — aucune
   * n'est décorative, et le bouton d'envoi n'apparaît que si toutes sont vertes.
   */
  const publishChecks = useMemo(() => {
    const target = publishTarget ? PUBLISHABLE[publishTarget] : null;
    const tokenKey = target?.tokenKey;
    const st = tokenKey ? statusOf(tokenKey) : null;
    const tok = tokenKey ? socialTokens.find((t) => t.platform === tokenKey) : null;
    return [
      {
        id: 'target',
        ok: Boolean(target),
        label: 'Réseau pris en charge par le publieur',
        ko: 'Le publieur ne sait envoyer que vers TikTok, Facebook, Instagram et LinkedIn. Google Ads, YouTube et « Multi-canal » n\'ont aucun chemin de diffusion automatique.',
      },
      {
        id: 'connected',
        ok: Boolean(st?.connected),
        label: 'Compte connecté pour ce réseau',
        ko: 'Aucun compte connecté. Ouvrez l\'onglet « Canaux » pour autoriser le réseau.',
      },
      {
        id: 'account',
        // Meta exige `page_id` (Page), LinkedIn exige l'URN auteur ; TikTok non.
        ok: !st?.connected || tokenKey === 'tiktok' || Boolean(tok?.page_id),
        label:
          publishTarget === 'instagram'
            ? 'Page Facebook résolue (support du compte Instagram)'
            : 'Page / auteur résolu sur le compte',
        ko: 'Le compte est connecté mais la Page Facebook (ou l\'URN LinkedIn) n\'a pas été résolue. Reconnectez le compte depuis l\'onglet « Canaux ».',
      },
      {
        id: 'video',
        ok: Boolean(selectedShort),
        label: 'Vidéo prête sélectionnée (obligatoire)',
        ko: 'Le publieur envoie des VIDÉOS : il lui faut un clip déjà déposé sur le stockage de l\'école. Une publicité en texte + visuel n\'est pas diffusable en l\'état.',
      },
      {
        id: 'copy',
        ok: Boolean(displayContent.headline?.trim()),
        label: 'Texte de la publicité rédigé',
        ko: 'Rédigez au moins un titre : il devient la légende de la publication.',
      },
    ];
  }, [publishTarget, statusOf, socialTokens, selectedShort, displayContent.headline]);

  const canPublish = publishChecks.every((c) => c.ok);

  /**
   * RÉSERVES — ce que cet écran ne PEUT PAS vérifier, dit au lieu d'être tu.
   *
   * Instagram : le serveur (`publishToInstagram`) exige `token.metadata.ig_user_id`,
   * résolu à la connexion Meta depuis `page.instagram_business_account`. Or
   * `getTokens()` ne sélectionne QUE `platform, page_name, page_id, created_at` :
   * l'information n'arrive JAMAIS jusqu'ici. Toutes les conditions peuvent donc être
   * vertes pendant que le serveur refusera — cas nominal d'une Page sans compte
   * Instagram Business rattaché. On refuse de laisser croire au succès : la réserve
   * est affichée avec les conditions ET répétée dans la confirmation.
   * (Le vrai correctif est côté API : exposer un booléen `instagram_ready` dans
   * `getTokens()`. Tant qu'il n'existe pas, on avertit.)
   */
  const publishCaveats = useMemo(() => {
    if (publishTarget !== 'instagram') return [];
    return [
      'Instagram : cet écran ne peut pas vérifier qu\'un compte Instagram Business est bien rattaché à la Page Facebook connectée — le publieur, lui, l\'exige. S\'il manque, la plateforme refusera l\'envoi et un brouillon de publication restera enregistré.',
    ];
  }, [publishTarget]);

  /**
   * DIFFUSION RÉELLE — deux appels serveur, exactement le chemin du publieur :
   *   1. POST /social-publisher/draft  → crée la ligne social_posts (exige short_clip_id)
   *   2. POST /social-publisher/publish/:postId/:platform → envoi effectif
   * ⚠️ IRRÉVERSIBLE : publie sur le compte réel de l'école. D'où la confirmation
   * explicite en deux temps avant d'arriver ici.
   */
  const publishNow = async () => {
    if (!canPublish || publishing) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const hashtags = (displayContent.hashtags || []).map((h) => String(h).replace(/^#/, '')).filter(Boolean);
      const draft = await socialApi.createDraft({
        short_clip_id: selectedShort.id,
        platform: publishTarget,
        title: displayContent.headline || undefined,
        description: displayContent.description || undefined,
        hashtags,
      });
      const postId = draft?.id;
      if (!postId) throw new Error('Brouillon créé sans identifiant : diffusion interrompue.');
      const res = await socialApi.publish(postId, publishTarget);
      if (res?.success) {
        setPublishResult({ ok: true, message: res.message || `Publié sur ${PUBLISHABLE[publishTarget].label}.` });
        toast({ title: `Diffusé sur ${PUBLISHABLE[publishTarget].label}`, description: res.message || 'La plateforme a accepté la vidéo.' });
      } else {
        // Le contrôleur renvoie success:false sans lever : on ne l'affiche PAS comme un succès.
        setPublishResult({ ok: false, message: res?.message || 'La plateforme a refusé la publication.' });
        toast({ title: 'Diffusion refusée', description: res?.message || 'La plateforme a refusé la publication.', variant: 'destructive' });
      }
    } catch (e) {
      setPublishResult({ ok: false, message: String(e?.message || e) });
      toast({ title: 'Diffusion échouée', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setPublishing(false);
      setConfirmingPublish(false);
    }
  };

  // ─── Step renderers ─────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      {adStep1Pane === 0 && (
        <div>
          <h3 className="mb-1 text-base font-semibold text-white">Plateforme de diffusion</h3>
          <p className="mb-3 text-xs text-gray-400">Où sera diffusée votre publicité ?</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PLATFORMS.map((p) => (
              <PlatformCard
                key={p.id}
                platform={p}
                selected={selectedPlatform === p.id}
                onSelect={(id) => {
                  setSelectedPlatform(id);
                  setSelectedFormat(getPlatform(id).formats[0]);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {adStep1Pane === 1 && (
        <>
          {currentPlatform.formats.length > 1 && (
            <div>
              <h3 className="mb-3 text-base font-semibold text-white">Format</h3>
              <div className="flex flex-wrap gap-2">
                {currentPlatform.formats.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedFormat(f)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                      selectedFormat === f
                        ? `${currentPlatform.bg} ${currentPlatform.color} ${currentPlatform.border}`
                        : 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {FORMAT_LABELS[f] || f}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-base font-semibold text-white">Objectif</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => setSelectedObjective(obj.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                    selectedObjective === obj.id
                      ? 'border-[color:var(--school-accent,#d99a4e)] bg-[color-mix(in_srgb,var(--school-accent,#d99a4e)_10%,transparent)]'
                      : 'border-white/10 bg-white/5 hover:bg-white/10',
                  )}
                >
                  <obj.icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      selectedObjective === obj.id ? 'text-[var(--school-accent,#d99a4e)]' : obj.color,
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{obj.label}</p>
                    <p className="truncate text-xs text-gray-400">{obj.desc}</p>
                  </div>
                  {selectedObjective === obj.id && (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-[var(--school-accent,#d99a4e)]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-white mb-1">Source du contenu</h3>
        <p className="text-xs text-gray-400 mb-3">D'où vient le contenu de votre publicité ?</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { id: 'manual', label: 'Texte libre', icon: Edit3 },
            { id: 'module', label: 'Module de cours', icon: BookOpen },
            { id: 'clip', label: 'Extrait vidéo', icon: Film },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSourceType(s.id)}
              className={cn(
                'p-3 rounded-xl border text-center transition-all',
                sourceType === s.id
                  ? 'border-[color:var(--school-accent,#d99a4e)] bg-[color-mix(in_srgb,var(--school-accent,#d99a4e)_10%,transparent)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              )}
            >
              <s.icon className={cn('w-5 h-5 mx-auto mb-1.5', sourceType === s.id ? 'text-[var(--school-accent,#d99a4e)]' : 'text-gray-400')} />
              <p className="text-xs font-medium text-white">{s.label}</p>
            </button>
          ))}
        </div>
      </div>

      {sourceType === 'module' && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Sélectionner un module</p>
          {loadingModules ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {modules.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => handleSelectModule(mod)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border transition-all',
                    selectedModuleId === mod.id
                      ? 'border-[color:var(--school-accent,#d99a4e)] bg-[color-mix(in_srgb,var(--school-accent,#d99a4e)_8%,transparent)]'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  )}
                >
                  <p className="text-sm font-medium text-white line-clamp-1">{mod.title}</p>
                  {mod.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{mod.description}</p>}
                </button>
              ))}
              {!modules.length && <p className="text-xs text-[#b0ada3] text-center py-4">Aucun module disponible.</p>}
            </div>
          )}
        </div>
      )}

      {/* ⚠️ RÉGLAGE SANS EFFET SUPPRIMÉ : ce bloc affichait un « découpeur » (vignette
          + curseurs début/fin + durée sélectionnée) qui ne découpait rien. Aucune
          vidéo n'était lue, aucun encodage déclenché ; les secondes n'étaient que
          deux colonnes écrites dans `ad_creatives`. Il ne reste que ce qui agit
          vraiment : l'URL, utilisée comme contexte pour l'IA rédactionnelle. */}
      {sourceType === 'clip' && (
        <div className="space-y-2">
          <label className="block text-xs text-gray-400">URL de la vidéo ou de l'enregistrement</label>
          <input
            type="url"
            placeholder="https://... (URL vidéo, enregistrement live)"
            value={sourceDescription}
            onChange={(e) => setSourceDescription(e.target.value)}
            className="w-full bg-[#2b2a27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color:var(--school-accent,#d99a4e)]"
          />
          <p className="text-[11px] text-[#b0ada3]">
            Cette URL sert uniquement de contexte à l'IA pour rédiger le texte. Cet écran ne lit pas la
            vidéo et n'en découpe aucun extrait : pour obtenir un clip diffusable, passez par le studio
            vidéo ou par un live.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Titre / Sujet de la publicité *</label>
          <input
            type="text"
            placeholder="Ex : Maîtrisez la symbolique du cycle Initié"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            className="w-full bg-[#2b2a27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color:var(--school-accent,#d99a4e)]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Description (contexte pour l'IA)</label>
          <textarea
            rows={3}
            placeholder="Décrivez le contenu, la valeur apportée, le public cible..."
            value={sourceDescription}
            onChange={(e) => setSourceDescription(e.target.value)}
            className="w-full bg-[#2b2a27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color:var(--school-accent,#d99a4e)] resize-none"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-white">Contenu généré</h3>
          <p className="text-xs text-gray-400">Éditez, puis enregistrez. La diffusion réelle est décrite plus bas.</p>
        </div>
        <button
          type="button"
          onClick={generateAdCopy}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-[var(--school-accent,#d99a4e)] text-sm hover:bg-white/[0.06] transition-all disabled:opacity-50"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 15%, transparent)',
            borderColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 30%, transparent)',
          }}
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {adContent.headline ? 'Regénérer' : 'Générer avec l\'IA'}
        </button>
      </div>

      {adContent.hook && (
        <div
          className="rounded-xl border px-4 py-3"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 8%, transparent)',
            borderColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 20%, transparent)',
          }}
        >
          <p className="text-xs text-[var(--school-accent,#d99a4e)] uppercase tracking-wider mb-1">Accroche</p>
          <p className="text-sm text-white font-medium italic">"{adContent.hook}"</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Titre de la publicité</label>
            <input
              type="text"
              value={displayContent.headline}
              onChange={(e) => setAdContent((p) => ({ ...p, headline: e.target.value }))}
              placeholder="Titre de la publicité"
              className="w-full bg-[#2b2a27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color:var(--school-accent,#d99a4e)]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Description</label>
            <textarea
              rows={4}
              value={displayContent.description}
              onChange={(e) => setAdContent((p) => ({ ...p, description: e.target.value }))}
              placeholder="Description de la publicité"
              className="w-full bg-[#2b2a27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color:var(--school-accent,#d99a4e)] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Bouton d'action</label>
              <input
                type="text"
                value={displayContent.cta}
                onChange={(e) => setAdContent((p) => ({ ...p, cta: e.target.value }))}
                placeholder="Commencer maintenant"
                className="w-full bg-[#2b2a27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color:var(--school-accent,#d99a4e)]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Hashtags (séparés par des virgules)</label>
              <input
                type="text"
                value={(displayContent.hashtags || []).join(', ')}
                onChange={(e) => setAdContent((p) => ({ ...p, hashtags: e.target.value.split(',').map((h) => h.trim()).filter(Boolean) }))}
                placeholder="#prorascience, #formation"
                className="w-full bg-[#2b2a27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color:var(--school-accent,#d99a4e)]"
              />
            </div>
          </div>

          {adContent.variations?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Variantes A/B</p>
              <div className="space-y-1">
                {adContent.variations.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveVariation(activeVariation === i ? null : i)}
                    className={cn('w-full text-left p-2 rounded-lg border text-xs transition-all', activeVariation === i ? 'border-[color:var(--school-accent,#d99a4e)] bg-[color-mix(in_srgb,var(--school-accent,#d99a4e)_8%,transparent)] text-white' : 'border-white/10 bg-white/5 text-gray-400 hover:text-white')}
                  >
                    <span className="font-medium">Variante {String.fromCharCode(65 + i)}</span> — {v.headline?.slice(0, 40)}...
                  </button>
                ))}
                {activeVariation !== null && (
                  <button type="button" onClick={() => setActiveVariation(null)} className="text-xs text-gray-500 hover:text-white transition-colors">
                    ← Version principale
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Aperçu</p>
          <AdPreviewCard
            platform={selectedPlatform}
            headline={displayContent.headline}
            description={displayContent.description}
            cta={displayContent.cta}
            hashtags={displayContent.hashtags}
            format={selectedFormat}
          />
        </div>
      </div>

      {/* ── Enregistrement LOCAL ────────────────────────────────────────────
          Ces deux boutons n'écrivent QUE dans `ad_creatives`. Le libellé le dit,
          l'icône aussi (disquette / coche, jamais une flèche d'envoi), et le toast
          le répète. L'ancien bouton vert « Publier » — qui posait le statut
          `published` sans le moindre appel réseau — a été retiré. */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={() => saveCreative('draft')}
          disabled={saving || !adContent.headline}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white hover:bg-white/10 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer le brouillon
        </button>
        <button
          type="button"
          onClick={() => saveCreative('ready')}
          disabled={saving || !adContent.headline}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--school-accent,#d99a4e)] text-black text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Enregistrer comme prête à diffuser
        </button>
      </div>
      {/* Phrase capitale (« aucun réseau social n'est contacté ») : encre secondaire
          de la charte, pas un gris à 4,1:1 sur le fond sombre. */}
      <p className="text-xs text-[#b0ada3]">
        Ces deux actions écrivent uniquement dans « Mes publicités ». Aucun réseau social n'est contacté.
      </p>

      {renderDiffusionPanel()}
    </div>
  );

  /**
   * PANNEAU DE DIFFUSION RÉELLE — la seule partie de l'écran qui parle à un réseau
   * social. Il affiche d'abord la contrainte produit (le publieur envoie des
   * vidéos), puis la liste des conditions avec leur état, puis — seulement si tout
   * est réuni — le bouton d'envoi, protégé par une confirmation explicite.
   */
  const renderDiffusionPanel = () => {
    const targetLabel = publishTarget ? PUBLISHABLE[publishTarget].label : null;
    return (
      <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Send className="mt-0.5 h-4 w-4 shrink-0 text-[#e6b878]" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-white">Diffusion réelle vers un réseau social</h4>
            <p className="mt-1 text-xs text-gray-400">
              Le publieur de l'école envoie des <span className="text-white">vidéos</span> : il transmet un clip
              déposé sur le stockage de l'école, accompagné de votre texte en légende. Une publicité
              composée d'un texte et d'un visuel fixe n'est <span className="text-white">pas diffusable</span> en
              l'état — il n'existe aujourd'hui aucun chemin « image + texte ».
            </p>
          </div>
        </div>

        {/* Réseau cible : uniquement les comptes réellement connectés. */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Réseau de destination</p>
          {connectedTargets.length === 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Ban className="h-3.5 w-3.5 shrink-0 text-gray-500" />
              {/* Trois états, jamais deux : en cours · illisible (403) · réellement vide.
                  Sans le cas « illisible », un enseignant lisait « Aucun compte connecté »
                  alors que l'école en a peut-être plusieurs — la même affirmation fausse
                  que celle corrigée sur les cartes de l'onglet « Canaux ». */}
              <span className="text-xs text-gray-400">
                {loadingChannels
                  ? 'Vérification des comptes connectés…'
                  : channelsError
                    ? 'Comptes connectés illisibles depuis ce compte (information réservée aux responsables de l\'école).'
                    : 'Aucun compte connecté.'}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('channels')}
                className="text-xs text-[#e6b878] underline underline-offset-2 hover:text-[#f0c4b3]"
              >
                Ouvrir l'onglet « Canaux »
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connectedTargets.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setPublishTarget(k); setConfirmingPublish(false); }}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                    publishTarget === k
                      ? 'border-[#d97757]/40 bg-[#d97757]/15 text-[#f0c4b3]'
                      : 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-white',
                  )}
                >
                  {PUBLISHABLE[k].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Vidéo à envoyer : uniquement les clips qui portent réellement un fichier. */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Vidéo à envoyer</p>
          {loadingShorts ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des clips…
            </div>
          ) : publishableShorts.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400">
              Aucun clip vidéo disponible. Les clips proviennent des lives et du studio vidéo ; ils
              n'apparaissent ici qu'une fois le fichier déposé sur le stockage de l'école.
            </p>
          ) : (
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {publishableShorts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSelectedShortId(s.id === selectedShortId ? '' : s.id); setConfirmingPublish(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all',
                    selectedShortId === s.id
                      ? 'border-[#d97757]/40 bg-[#d97757]/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10',
                  )}
                >
                  <Film className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1 truncate text-xs text-white">{s.title || 'Clip sans titre'}</span>
                  {s.duration_sec ? <span className="shrink-0 text-[10px] text-gray-500">{Math.round(s.duration_sec)}s</span> : null}
                  {selectedShortId === s.id && <Check className="h-3.5 w-3.5 shrink-0 text-[#f0c4b3]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conditions : chacune reflète un contrôle réel du serveur. */}
        <div className="space-y-1.5 border-t border-white/10 pt-3">
          {/* Encre secondaire de la charte (#b0ada3 = 5,9:1 sur #30302e). Le
              `text-gray-500` d'origine tombait à 2,75:1 : la phrase qui porte toute
              la vérité produit était celle qu'on lisait le moins bien. */}
          <p className="text-xs uppercase tracking-wider text-[#b0ada3]">Conditions requises</p>
          {publishChecks.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              {c.ok
                ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9cc48a]" />
                : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e6b878]" />}
              <div className="min-w-0">
                <p className={cn('text-xs', c.ok ? 'text-gray-300' : 'text-white')}>{c.label}</p>
                {!c.ok && <p className="text-[11px] text-[#b0ada3]">{c.ko}</p>}
              </div>
            </div>
          ))}

          {/* Réserves : conditions que cet écran ne peut PAS vérifier (cf. publishCaveats).
              Ton d'avertissement (or), jamais de coche verte — une coche promettrait. */}
          {publishCaveats.map((txt) => (
            <div key={txt} className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e6b878]" />
              <p className="min-w-0 text-[11px] leading-relaxed text-[#e6b878]">{txt}</p>
            </div>
          ))}
        </div>

        {/* Bouton d'envoi : affiché UNIQUEMENT quand tout est réuni, et en deux temps. */}
        {canPublish && (
          <div className="space-y-2 border-t border-white/10 pt-3">
            {!confirmingPublish ? (
              <button
                type="button"
                onClick={() => setConfirmingPublish(true)}
                /* Corail = LES ACTIONS ; encre sombre #1f1e1c obligatoire sur l'aplat. */
                className="inline-flex items-center gap-2 rounded-xl bg-[#d97757] px-5 py-2.5 text-sm font-semibold text-[#1f1e1c] transition-all hover:brightness-110"
              >
                <Send className="h-4 w-4" />
                Diffuser sur {targetLabel}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-white">
                  Confirmez : la vidéo « {selectedShort?.title || 'clip sélectionné'} » va être publiée
                  publiquement sur le compte {targetLabel} de l'école. Cette action est irréversible.
                </p>
                {/* La réserve est REPÉTÉE au moment de l'engagement : c'est là qu'elle
                    compte, pas seulement dans la liste des conditions plus haut. */}
                {publishCaveats.map((txt) => (
                  <p key={txt} className="text-[11px] leading-relaxed text-[#e6b878]">{txt}</p>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={publishNow}
                    disabled={publishing}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#d97757] px-5 py-2.5 text-sm font-semibold text-[#1f1e1c] transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Confirmer la diffusion sur {targetLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingPublish(false)}
                    disabled={publishing}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-gray-300 transition-all hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {publishResult && (
          <p className={cn('text-xs', publishResult.ok ? 'text-[#9cc48a]' : 'text-[#f0c4b3]')}>
            {publishResult.message}
          </p>
        )}
      </div>
    );
  };

  const recapAside = (
    <>
      <div className="premium-panel space-y-2 p-4">
        <p className="text-xs uppercase tracking-wider text-gray-400">Récapitulatif</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Plateforme</span>
            <span className={cn('text-xs font-medium', currentPlatform.color)}>{currentPlatform.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Format</span>
            <span className="text-xs text-white">{FORMAT_LABELS[selectedFormat] || selectedFormat}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Objectif</span>
            <span className="text-xs text-white">{OBJECTIVES.find((o) => o.id === selectedObjective)?.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Source</span>
            <span className="text-xs text-white">
              {sourceType === 'manual' ? 'Texte libre' : sourceType === 'module' ? 'Module' : 'Clip'}
            </span>
          </div>
        </div>
      </div>

      <div className="premium-panel p-4">
        <p className="mb-3 text-xs uppercase tracking-wider text-gray-400">Conseils IA</p>
        <ul className="space-y-2">
          {[
            'Incluez un chiffre ou une statistique dans le titre',
            'Utilisez une accroche émotionnelle en première phrase',
            `Pour ${currentPlatform.label}, gardez le texte sous ${selectedPlatform === 'google' ? '90' : '125'} caractères`,
            'Testez 2-3 variantes pour identifier la plus performante',
          ].map((tip, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-400">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[var(--school-accent,#d99a4e)]" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  const goPrevCreate = () => {
    if (step === 1 && adStep1Pane === 1) {
      setAdStep1Pane(0);
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  };

  const goNextCreate = () => {
    if (step === 1 && adStep1Pane === 0) {
      setAdStep1Pane(1);
      return;
    }
    if (step === 2 && sourceTitle) void generateAdCopy();
    setStep((s) => Math.min(3, s + 1));
  };

  // ─── Tabs ───────────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'create', label: 'Créer', icon: Sparkles },
    { id: 'channels', label: 'Canaux', icon: Link2 },
    { id: 'history', label: 'Mes pubs', icon: Film, badge: creatives.length || null },
  ];

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden text-white"
      data-school-shell="marketing-creator"
      data-tenant-brand={branding.slug}
      style={{
        ...cssVars,
        background: 'var(--school-background, #0a0908)',
        fontFamily: 'var(--school-font-family, Inter, sans-serif)',
      }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-4 backdrop-blur-xl sm:px-6"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--school-background, #0a0908) 95%, transparent)',
          borderColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 12%, transparent)',
        }}
      >
        <div className="flex items-center gap-3">
          <Link to="/studio" className="p-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
              <Megaphone className="h-5 w-5 shrink-0 text-[var(--school-accent,#d99a4e)]" />
              <span className="truncate">Créateur de publicités</span>
            </h1>
            <p className="text-xs text-gray-400">
              Rédigez vos publicités avec l'IA, enregistrez-les, et diffusez vos vidéos vers les comptes connectés
            </p>
          </div>
        </div>
        {/* ⚠️ `?tab=analytics` était mort : LiriCrmPage lit `?view=` (VALID_VIEWS), et
            supprime `?tab=` dès que la vue n'est pas « growth ». Le lien retombait donc
            sur le pipeline. La vue analytique réelle est `view=dashboard` → CrmAnalytics. */}
        <Link
          to="/liri/crm?view=dashboard"
          className="text-xs text-[var(--school-accent,#d99a4e)] border rounded-lg px-3 py-1.5 hover:bg-white/[0.06] transition-colors flex items-center gap-1.5"
          style={{ borderColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 25%, transparent)' }}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Statistiques
        </Link>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-white/10 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                activeTab === t.id
                  ? 'border-[var(--school-accent,#d99a4e)] text-[var(--school-accent,#d99a4e)]'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-white/20'
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.badge ? (
                <span
                  className="ml-1 text-[10px] text-[var(--school-accent,#d99a4e)] rounded-full px-1.5 py-0.5"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 20%, transparent)' }}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <Dialog open={recapOpen} onOpenChange={setRecapOpen}>
        <DialogContent
          className="max-h-[88dvh] max-w-md overflow-y-auto border bg-[#0a0908] text-white sm:rounded-2xl"
          style={{ borderColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 25%, transparent)' }}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-left text-lg text-white">Récap &amp; conseils</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">{recapAside}</div>
        </DialogContent>
      </Dialog>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6">

        {/* ── TAB: Create ──────────────────────────────────────────────────────── */}
        {activeTab === 'create' && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden xl:grid xl:grid-cols-3 xl:gap-6">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <StepDots step={step} total={3} />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRecapOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-display text-[11px] font-semibold transition-colors hover:bg-white/[0.06] xl:hidden"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 10%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--school-accent, #d99a4e) 30%, transparent)',
                      color: 'color-mix(in srgb, var(--school-accent, #d99a4e) 35%, #ffffff)',
                    }}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Récap
                  </button>
                  <div className="text-xs text-gray-400">
                    {step === 1 && 'Plateforme & objectif'}
                    {step === 2 && 'Source du contenu'}
                    {step === 3 && 'Contenu & diffusion'}
                  </div>
                </div>
              </div>

              {step === 1 && (
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {[0, 1].map((i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Écran ${i + 1} sur 2`}
                        aria-current={adStep1Pane === i ? 'step' : undefined}
                        onClick={() => setAdStep1Pane(i)}
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          adStep1Pane === i ? 'w-6 bg-[var(--school-accent,#d99a4e)]' : 'w-1.5 bg-white/20 hover:bg-white/35',
                        )}
                      />
                    ))}
                  </div>
                  <span className="font-display text-[10px] text-gray-500">
                    Écran {adStep1Pane + 1}/2
                  </span>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${step}-${step === 1 ? adStep1Pane : 'x'}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                  >
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={goPrevCreate}
                  disabled={step === 1 && adStep1Pane === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 transition-all hover:bg-white/5 hover:text-white disabled:opacity-30"
                >
                  <ArrowLeft className="h-4 w-4" /> Précédent
                </button>
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={goNextCreate}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--school-accent,#d99a4e)] px-5 py-2 text-sm font-semibold text-black transition-all hover:opacity-90"
                  >
                    {step === 1 && adStep1Pane === 0 ? 'Écran suivant' : 'Suivant'}{' '}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="hidden min-h-0 space-y-4 overflow-y-auto overscroll-contain xl:block">
              {recapAside}
            </div>
          </div>
        )}

        {/* ── TAB: Canaux ──────────────────────────────────────────────────────
            Miroir EXACT du publieur : GET /social-publisher/oauth/status. Plus
            aucun formulaire local — l'ancien écrivait dans `channel_integrations`,
            table qu'aucun publieur ne lit. */}
        {activeTab === 'channels' && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4 pr-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white">Canaux de diffusion</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Comptes que votre école a réellement reliés au publieur. Chaque école apporte sa
                  propre application (Client ID / Client Secret), puis connecte son compte.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchChannels}
                disabled={loadingChannels}
                className="shrink-0 rounded-xl border border-white/10 p-2 text-gray-400 transition-colors hover:text-white disabled:opacity-50"
                aria-label="Rafraîchir l'état des canaux"
              >
                {loadingChannels
                  ? <Loader2 className="h-4 w-4 animate-spin text-[var(--school-accent,#d99a4e)]" />
                  : <RefreshCw className="h-4 w-4" />}
              </button>
            </div>

            {channelsError && (
              <div className="flex items-start gap-2 rounded-xl border border-[#d99a4e]/35 bg-[#d99a4e]/10 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#e6b878]" />
                <div className="min-w-0">
                  <p className="text-sm text-white">État des canaux indisponible</p>
                  <p className="mt-0.5 text-xs text-gray-300">{channelsError}</p>
                  <p className="mt-1 text-[11px] text-[#b0ada3]">
                    Ces réglages sont réservés aux responsables de l'école (propriétaire ou administrateur).
                    Les cartes ci-dessous ne peuvent donc rien affirmer sur l'état des canaux.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {SOCIAL_CHANNELS.map((channel) => (
                <SocialChannelCard
                  key={channel.key}
                  channel={channel}
                  status={socialStatus.find((s) => s.platform === channel.key)}
                  token={socialTokens.find((t) => t.platform === channel.key)}
                  onConnect={connectChannel}
                  connecting={connectingPlatform === channel.key}
                  /* Lien vers /liri/reglages UNIQUEMENT pour qui peut y entrer :
                     sinon la route rebondit vers /dashboard et éjecte du Studio. */
                  settingsPath={canOpenSocialSettings ? SOCIAL_SETTINGS_PATH : null}
                  /* Statut illisible (403 pour un non-responsable) → on n'affirme
                     RIEN sur ce canal au lieu de le déclarer « non configuré ». */
                  statusUnknown={Boolean(channelsError)}
                />
              ))}
            </div>

            {/* Ce que le publieur envoie réellement — dit avant que quiconque essaie. */}
            <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Film className="h-4 w-4 text-[#e6b878]" />
                Ce que ces canaux savent envoyer
              </h3>
              <p className="text-xs text-gray-400">
                Uniquement des <span className="text-white">vidéos</span> déjà déposées sur le stockage de
                l'école (clips issus des lives ou du studio). Le texte que vous rédigez ici devient la
                légende de la publication. Il n'existe pas de chemin « image fixe + texte » : une
                publicité de ce type peut être enregistrée, pas diffusée.
              </p>
            </div>

            {/* Honnêteté : ce qui N'EXISTE PAS, annoncé plutôt que maquetté. */}
            <div className="rounded-2xl border border-dashed border-white/15 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Ban className="h-4 w-4 text-gray-500" />
                Non disponible aujourd'hui
              </h3>
              <p className="text-xs text-gray-400">
                Les <span className="text-white">régies publicitaires</span> — Meta Ads, TikTok Ads,
                Google Ads — et le suivi <span className="text-white">Google Analytics&nbsp;4</span> ne
                sont branchés à aucun code. Le formulaire qui demandait ici un Pixel ID, un Advertiser ID
                ou une clé de mesure enregistrait ces valeurs sans que rien ne les lise&nbsp;: il a été
                retiré plutôt que laissé en décor. Aucune campagne payante n'est créée depuis cet écran.
              </p>
            </div>
          </div>
        )}

        {/* ── TAB: History ─────────────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4 pr-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Mes publicités</h2>
                <p className="text-sm text-gray-400 mt-1">{creatives.length} publicité{creatives.length !== 1 ? 's' : ''} sauvegardée{creatives.length !== 1 ? 's' : ''}.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={fetchHistory} className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setActiveTab('create')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--school-accent,#d99a4e)] text-black text-sm font-semibold hover:opacity-90 transition-all">
                  <Plus className="w-4 h-4" /> Nouvelle pub
                </button>
              </div>
            </div>

            {loadingHistory ? (
              <div className="flex items-center gap-3 text-gray-400 py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--school-accent,#d99a4e)]" /> Chargement...</div>
            ) : creatives.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/15 rounded-2xl">
                <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Aucune publicité créée pour l'instant.</p>
                <button type="button" onClick={() => setActiveTab('create')} className="mt-4 px-5 py-2 rounded-xl bg-[var(--school-accent,#d99a4e)] text-black text-sm font-semibold hover:opacity-90 transition-all">
                  Créer ma première pub
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {creatives.map((c) => {
                  const p = getPlatform(c.platform);
                  /* 5 statuts, 5 teintes toujours séparables mais toutes chaudes :
                     brouillon (gris) · prête (corail) · marquée publiée (olive) · en pause (ambre) · archivée (gris pâle). */
                  const statusColors = { draft: 'text-gray-400 bg-white/5 border-white/10', ready: 'text-[#f0c4b3] bg-[#d97757]/10 border-[#d97757]/30', published: 'text-[#9cc48a] bg-[#5a8f52]/10 border-[#5a8f52]/30', paused: 'text-amber-300 bg-amber-500/10 border-amber-500/25', archived: 'text-gray-500 bg-white/5 border-white/10' };
                  /* ⚠️ « Marquée publiée », pas « Publiée » : ce statut a toujours été un simple
                     drapeau posé en base par l'ancien bouton, sans le moindre envoi vers un réseau.
                     Les lignes existantes n'ont donc JAMAIS été diffusées — le libellé le dit. */
                  const statusLabel = { draft: 'Brouillon', ready: 'Prête', published: 'Marquée publiée', paused: 'En pause', archived: 'Archivée' };
                  return (
                    <div key={c.id} className="premium-panel p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p.icon className={cn('w-4 h-4 shrink-0', p.color)} />
                          <p className="text-sm font-semibold text-white line-clamp-1">{c.title}</p>
                        </div>
                        <span
                          className={cn('text-[10px] px-2 py-0.5 rounded-full border shrink-0', statusColors[c.status] || statusColors.draft)}
                          title={c.status === 'published' ? 'Statut interne : aucune diffusion vers un réseau social n\'a été envoyée depuis cet écran.' : undefined}
                        >
                          {statusLabel[c.status] || statusLabel.draft}
                        </span>
                      </div>
                      {c.headline && <p className="text-xs text-gray-300 line-clamp-2">{c.headline}</p>}
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] bg-white/5 text-gray-400 rounded px-1.5 py-0.5">{p.label}</span>
                        <span className="text-[10px] bg-white/5 text-gray-400 rounded px-1.5 py-0.5">{FORMAT_LABELS[c.format] || c.format}</span>
                        <span className="text-[10px] bg-white/5 text-gray-400 rounded px-1.5 py-0.5">{OBJECTIVES.find((o) => o.id === c.objective)?.label}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                        {c.published_at && <span className="text-[#9cc48a]">Marquée le {new Date(c.published_at).toLocaleDateString('fr-FR')}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
