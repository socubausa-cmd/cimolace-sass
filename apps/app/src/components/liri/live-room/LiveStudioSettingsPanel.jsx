/**
 * LiveStudioSettingsPanel — Contrôle studio live (aligné UI LiveHost + design system)
 *
 * Onglets : même composant global `PremiumSegmentedSelector` (pilule or animée, layoutId)
 * que Resources, SchoolLife, messagerie, etc. Contenu : `Tabs` Radix + `AnimatePresence`
 * / spring sur le panneau pour chaque changement d'onglet.
 */
import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Video, Image, Volume2, Monitor,
  Sparkles, Scissors, Sun, Droplets,
  Gauge, Waves, Camera, Mic, CheckCircle2, ChevronRight,
  RefreshCw, Upload, Bell, Headphones, Link2, Network, Radio, Languages, History, Cable,
  Minimize2,
  GraduationCap, Users, BookOpen, ShieldCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  designerShellBackdrop,
  designerShellCloseBtn,
  designerShellDrawerClass,
  designerShellHeader,
} from '@/lib/liriDesignerShellClasses';
import { StudioDevicePicker } from '@/components/liri/live-room/StudioDevicePicker';
import { Tabs } from '@/components/ui/tabs';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { LIRI_AUDIO_MODES } from '@/lib/liriAudioEngine/constants';
import { getAllSmartboardNavigatorSceneMetas } from '@/lib/smartboardNavigatorScenes';
import { LIVE_DRAWER_BACKDROP_TRANSITION, LIVE_TAB_SPRING, liveDrawerAsideRight } from '@/lib/liveDrawerMotion';

// ─── Slider générique ─────────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step = 1, onChange, unit = '', color = '#D4AF37' }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/60">{label}</span>
        <span className="text-[11px] font-mono font-bold" style={{ color }}>{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ label, description, checked, onChange, color = '#D4AF37', dataCommKey }) {
  return (
    <button
      type="button"
      data-checked={checked ? '1' : '0'}
      {...(dataCommKey ? { 'data-comm-key': dataCommKey } : {})}
      onClick={() => onChange(!checked)}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
        checked
          ? 'border-[#D4AF37]/30 bg-[#D4AF37]/8'
          : 'border-white/8 bg-white/[0.03] hover:border-white/15'
      )}
    >
      <div
        className={cn('w-9 h-5 rounded-full relative transition-colors flex-shrink-0',
          checked ? 'bg-[#D4AF37]' : 'bg-white/15')}
      >
        <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[12px] font-semibold', checked ? 'text-white' : 'text-white/60')}>{label}</p>
        {description && <p className="text-[10px] text-white/35 mt-0.5">{description}</p>}
      </div>
    </button>
  );
}

/** Carte de section — même esprit que les blocs « plateau » LiveHost (bordure or, fond sombre). */
function StudioPanelSection({ title, subtitle, icon: Icon, children, className }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/[0.09] bg-[#14131c]/90 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]',
        className,
      )}
    >
      <div className="mb-3">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-[#e9bf72]" /> : null}
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#e9bf72]">{title}</span>
        </div>
        {subtitle ? <p className="mt-1.5 text-[10px] leading-relaxed text-white/38">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

// ─── Virtual BG images ────────────────────────────────────────────────────────
const VBG_PRESETS = [
  { id: 'none',    label: 'Aucun',     thumb: null, color: '#111827' },
  {
    id: 'immersive',
    label: 'Verre IA',
    thumb: null,
    color: 'linear-gradient(135deg,rgba(212,175,55,0.14),rgba(9,13,20,0.5))',
  },
  { id: 'blur',    label: 'Flou',      thumb: null, isBlur: true },
  { id: 'space',   label: 'Cosmos',    thumb: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=200&q=60' },
  { id: 'office',  label: 'Bureau',    thumb: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&q=60' },
  { id: 'nature',  label: 'Nature',    thumb: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=200&q=60' },
  { id: 'library', label: 'Bibliothèque', thumb: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=200&q=60' },
  { id: 'temple',  label: 'Temple',    thumb: 'https://images.unsplash.com/photo-1568377210220-5b5c25a3a0f4?w=200&q=60' },
  { id: 'stage',   label: 'Scène',     thumb: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=200&q=60' },
];

// ─── Tabs principaux (sous-onglets anciens fusionnés : Vidéo + fond + étalonnage + choix caméra) ─
const MAIN_STUDIO_TABS = [
  { id: 'video', icon: Video, label: 'Vidéo & salle', badge: 'Flux, fond, étalonnage' },
  { id: 'audio', icon: Volume2, label: 'Audio & ambiance', badge: 'Micro, LIRI, ambiance' },
];
const SALLE_IA_TAB = { id: 'salle', icon: Network, label: 'Salle & IA', badge: 'Lien, canaux, IA' };
const GUEST_PERMISSIONS_TAB = {
  id: 'permissions',
  icon: GraduationCap,
  label: 'Permissions élèves',
  badge: 'Ce que les invités peuvent faire',
};

/**
 * Matrice invité (cahier : classe virtuelle).
 * Les clés correspondent au shape snake_case stocké dans
 * live_sessions.config.guest_permissions (cf. migration 202604221400).
 * Regroupées par zone UX pour que le prof s'y retrouve d'un coup d'œil.
 */
const GUEST_PERMISSIONS_SECTIONS = [
  {
    id: 'interactions',
    title: 'Interactions en classe',
    subtitle: 'Comment les élèves participent en direct.',
    icon: Users,
    rows: [
      { key: 'can_raise_hand', label: 'Lever la main', desc: 'L\u2019élève peut demander la parole en silence' },
      { key: 'can_react_emoji', label: 'Réactions emoji', desc: 'Bursts 👏 ❤️ 🔥 pour engager sans couper' },
      { key: 'can_request_speak', label: 'Demander à prendre la parole', desc: 'Demande caméra/micro à l\u2019antenne' },
      { key: 'can_request_screenshare', label: 'Demander le partage d\u2019écran', desc: 'Sur accord du prof — montrer son travail' },
      { key: 'can_annotate_whiteboard', label: 'Annoter le tableau blanc', desc: 'Écrire/dessiner sur le tableau du prof' },
      { key: 'can_chat_public', label: 'Chat général de la classe', desc: 'Messages visibles de tous' },
      { key: 'can_whisper_teacher', label: 'Messages privés au prof', desc: 'Questions discrètes à l\u2019enseignant' },
      { key: 'can_chat_peer', label: 'Messages entre élèves', desc: 'Discussions privées entre élèves — attention distraction' },
    ],
  },
  {
    id: 'tools',
    title: 'Outils élève',
    subtitle: 'Ce que l\u2019élève peut utiliser de son côté.',
    icon: BookOpen,
    rows: [
      { key: 'can_use_ai_coach', label: 'Coach IA pédagogique', desc: 'Assistant léger (reformulation, exemples) — pas le hub LONGIA complet' },
      { key: 'can_use_neuronq', label: 'NeuronQ', desc: 'Questions de compréhension générées par le prof' },
      { key: 'can_use_video_blur', label: 'Flou d\u2019arrière-plan', desc: 'L\u2019élève peut flouter sa pièce (vie privée)' },
      { key: 'show_members_grid', label: 'Afficher les autres élèves', desc: 'Grille classe visible — à couper pour concentration' },
    ],
  },
  {
    id: 'notes',
    title: 'Cahier de notes & sécurité',
    subtitle: 'Notes personnelles de l\u2019élève, export et surveillance.',
    icon: ShieldCheck,
    rows: [
      { key: 'can_use_personal_notes', label: 'Cahier de notes personnel', desc: 'Affiche le panneau cahier (saisie, capture tableau, export si autorisé)' },
      { key: 'can_export_notes', label: 'Exporter son cahier (PDF / Markdown)', desc: 'L\u2019élève télécharge ses notes en fin de cours' },
      { key: 'can_send_notes_to_teacher', label: 'Envoyer son cahier au prof', desc: 'L\u2019élève partage explicitement ses notes (vous les retrouvez en fin de session)' },
      { key: 'require_proctor_consent', label: 'Exiger le consentement proctoring caméra', desc: 'Type examen surveillé — consentement obligatoire avant vidéo' },
    ],
  },
];

const IA_QUICK_ROWS = [
  { key: 'quiz_enabled', label: 'Quiz live', desc: 'QCM en direct' },
  { key: 'polls_enabled', label: 'Sondages', desc: 'Sondages rapides' },
  { key: 'ai_summary_enabled', label: 'Résumé IA', desc: 'Après la session' },
  { key: 'ai_mindmap_enabled', label: 'Mindmap IA', desc: 'Points clés auto' },
  { key: 'neuronq_enabled', label: 'Neuron-Q', desc: 'Q&R intelligent' },
  { key: 'neuro_recall_enabled', label: 'NeuroRecall', desc: 'Post-live replay / fiche' },
];

const COMM_QUICK_ROWS = [
  { key: 'chat_enabled', label: 'Chat de session', desc: 'Messages collectifs' },
  { key: 'hand_raise_enabled', label: 'Mains levées', desc: 'Signal côté élèves' },
  { key: 'screen_share_enabled', label: 'Partage d\'écran', desc: 'Autorisé aux participants' },
  { key: 'student_audio_enabled', label: 'Micro participants', desc: 'Audio invités' },
  { key: 'student_video_enabled', label: 'Caméra participants', desc: 'Vidéo invités' },
  {
    key: 'guest_member_inspect_enabled',
    label: 'Vue membre étendue (invités)',
    desc: 'Clic sur une carte : vidéo agrandie + aperçu vie scolaire. Sinon : flux + messages privés seulement',
  },
  {
    key: 'proctoring_camera_consent_required',
    label: 'Consentement caméra (type examen surveillé)',
    desc: 'Avant la connexion vidéo, l\'invité accepte le principe du contrôle par le formateur. Les commandes ultérieures sont journalisées côté serveur.',
  },
  {
    key: 'host_remote_camera_enabled',
    label: 'Contrôle distant de la caméra par le formateur',
    desc: 'Si le consentement ci-dessus est exigé : depuis la fiche membre, le formateur envoie allumer / couper ; chaque action est enregistrée pour audit.',
  },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LiveStudioSettingsPanel({
  open,
  onClose,

  /** Aperçu caméra hôte (ReactNode) — Vidéo + Arrière-plan : maquillage / détourage en temps réel */
  videoPreview = null,

  // Vidéo
  beauty, onBeautyChange,
  chromaKey, onChromaKeyChange,
  chromaColor, onChromaColorChange,
  chromaSensitivity, onChromaSensitivityChange,

  // Arrière-plan (MediaPipe)
  videoBlur, onVideoBlurChange,
  videoVbg, onVideoVbgChange,
  customBgUrl, onCustomBgChange,

  // Étalonnage
  brightness, onBrightnessChange,
  contrast, onContrastChange,
  saturation, onSaturationChange,
  hue, onHueChange,

  // Audio
  micGain, onMicGainChange,
  noiseReduction, onNoiseReductionChange,
  /** LIRI Audio Engine (optionnel — ex. LiveHostPage) */
  liriAudioMode,
  onLiriAudioModeChange,
  liriClarity,
  onLiriClarityChange,
  liriReverb,
  onLiriReverbChange,
  liriCompression,
  onLiriCompressionChange,
  liriGate,
  onLiriGateChange,
  liriLimiter,
  onLiriLimiterChange,
  liriAudioLevels,
  /** Arena desktop hôte : bips événements (mains, attente, antenne, Q&R) */
  arenaHostAlertSoundsEnabled,
  onArenaHostAlertSoundsChange,

  /** Ambiance salle (MP3) — pistes session + volume maître 0–1 */
  ambientTracks = [],
  ambientMasterVolume = 0.22,
  onAmbientMasterVolumeChange,

  // Périphériques
  videoDevices = [], audioDevices = [],
  activeVideoId, activeAudioId,
  onSwitchVideo, onSwitchAudio,

  /**
   * Live hôte : raccourcis config « étapes 6–7 » (salle, canaux, IA, lien invité, JoyKit).
   * Null = onglet masqué (ex. invité ou hors live).
   * `proctorCameraHistory` : journal serveur des commandes caméra (allumer / couper).
   */
  sessionQuickSettings = null,

  /** Hôte en direct : aparté WebRTC + préécoute casque (même bloc que le raccourci plateau) */
  hostMediaRoutingSlot = null,

  /** Invité : libellés et sections réservés hôte masqués (alertes plateau, etc.) */
  participantMode = false,

  /**
   * Permissions élèves — contrôle par session de ce que les invités peuvent
   * faire dans la salle de classe virtuelle. Shape snake_case aligné sur
   * live_sessions.config.guest_permissions (cf. useGuestCapabilities).
   * Null ou participantMode=true → onglet masqué.
   */
  guestPermissions = null,
  onGuestPermissionsChange = null,
}) {
  const [tab, setTab] = useState('video');
  /** Aperçu « gros plan » : uniquement au clic sur « Agrandir l'aperçu » */
  const [videoPreviewExpanded, setVideoPreviewExpanded] = useState(false);
  const showPermissionsTab = Boolean(!participantMode && guestPermissions && onGuestPermissionsChange);
  const tabs = [
    ...MAIN_STUDIO_TABS,
    ...(sessionQuickSettings ? [SALLE_IA_TAB] : []),
    ...(showPermissionsTab ? [GUEST_PERMISSIONS_TAB] : []),
  ];
  const customBgRef = useRef(null);

  const handleTabChange = (next) => {
    setTab(next);
    if (next !== 'video') setVideoPreviewExpanded(false);
  };

  useEffect(() => {
    if (!sessionQuickSettings && tab === 'salle') setTab('video');
    if (!showPermissionsTab && tab === 'permissions') setTab('video');
  }, [sessionQuickSettings, showPermissionsTab, tab]);

  useEffect(() => {
    if (!open) setVideoPreviewExpanded(false);
  }, [open]);

  const handleResetGrading = () => {
    onBrightnessChange(100); onContrastChange(100);
    onSaturationChange(100); onHueChange(0);
  };

  const chromaColors = [
    { hex: '#00B140', label: 'Vert' },
    { hex: '#0047AB', label: 'Bleu' },
    { hex: '#FF0000', label: 'Rouge' },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={LIVE_DRAWER_BACKDROP_TRANSITION}
            className={designerShellBackdrop}
            onClick={onClose}
          />

          {/* Aperçu vidéo gros plan — temps réel (même nœud que le petit aperçu) ; à gauche du tiroir sur grands écrans, plein écran sur mobile */}
          <AnimatePresence>
            {tab === 'video' && videoPreviewExpanded && videoPreview ? (
              <motion.div
                key="live-studio-video-stage"
                role="dialog"
                aria-modal="true"
                aria-label="Aperçu vidéo en direct"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'fixed z-[205] flex flex-col bg-[#06060a]/94 backdrop-blur-[18px]',
                  'inset-0 min-[920px]:inset-y-0 min-[920px]:left-0 min-[920px]:right-[min(460px,100vw)] min-[920px]:w-auto min-[920px]:h-full',
                )}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.09] bg-[#0a0b0f]/90 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-white/95">Aperçu vidéo en direct</p>
                    <p className="mt-0.5 text-[10px] text-white/40">
                      Maquillage, fond virtuel et étalonnage — identique au flux du plateau.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVideoPreviewExpanded(false)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/[0.1]"
                  >
                    <Minimize2 className="h-3.5 w-3.5 opacity-80" />
                    Réduire
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center p-4 min-[920px]:p-6">
                  <div className="relative h-full w-full max-h-[min(72vh,920px)] max-w-[min(96vw,1280px)] overflow-hidden rounded-2xl border border-[#C8960C]/25 shadow-[0_0_60px_-12px_rgba(200,150,12,0.35)]">
                    <div className="absolute inset-0 [&>div]:!min-h-0 [&>div]:h-full [&>div]:rounded-2xl">
                      {videoPreview}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Panel — shell Smartboard Designer */}
          <motion.aside
            key="panel"
            {...liveDrawerAsideRight}
            className={designerShellDrawerClass('w-[min(100vw,460px)]')}
          >
            <div className={designerShellHeader}>
              <div>
                <p className="text-[12px] font-semibold tracking-wide text-white/95">
                  {participantMode ? 'Votre audio & vidéo' : 'LONGIA — Contrôle studio'}
                </p>
                <p className="mt-1 max-w-[280px] text-[10px] leading-relaxed text-white/38">
                  {participantMode
                    ? 'Micro, caméra, périphériques et réglages audio — les options de salle restent gérées par le formateur.'
                    : 'Vidéo & salle virtuelle, moteur audio, ambiance — aligné sur le designer Smartboard.'}
                </p>
              </div>
              <button type="button" onClick={onClose} className={designerShellCloseBtn} aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Onglets — même sélecteur segmenté premium que le reste de l'app (pilule animée layoutId) */}
            <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-[rgba(255,255,255,.08)] px-3 py-3 sm:px-4">
                <PremiumSegmentedSelector
                  value={tab}
                  onChange={handleTabChange}
                  layoutId="live-studio-settings-tab-pill"
                  compact
                  className="w-full"
                  railClassName="premium-panel border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,.22)]"
                  options={tabs.map((t) => ({
                    value: t.id,
                    label: t.label,
                    badge: t.badge,
                    icon: t.icon,
                  }))}
                />
              </div>

              <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#0a0b0f] bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:44px_44px] px-5 py-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    role="tabpanel"
                    initial={{ opacity: 0, y: 12, scaleY: 0.982 }}
                    animate={{ opacity: 1, y: 0, scaleY: 1 }}
                    exit={{ opacity: 0, y: -10, scaleY: 0.99 }}
                    transition={LIVE_TAB_SPRING}
                    style={{ transformOrigin: '50% 0%' }}
                    className="space-y-4"
                  >
                    {/* ── VIDÉO & SALLE ── */}
                    {tab === 'video' ? (
                      <>
                  <StudioPanelSection
                    title="Aperçu flux"
                    subtitle="Rendu après effets — activez la caméra sur le plateau pour voir le maquillage et le détourage."
                    icon={Video}
                  >
                    {videoPreview ? (
                      <div className="space-y-2">
                        {videoPreviewExpanded ? (
                          <p className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 py-4 text-center text-[10px] leading-relaxed text-white/45">
                            Aperçu affiché en grand. Ajustez les réglages dans ce panneau — le rendu se met à jour en direct. Utilisez « Réduire » sur l'aperçu pour le revoir ici.
                          </p>
                        ) : (
                          <>
                            <div className="aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black/40">
                              {videoPreview}
                            </div>
                            <button
                              type="button"
                              onClick={() => setVideoPreviewExpanded(true)}
                              className="w-full rounded-xl border border-[#C8960C]/35 bg-[#C8960C]/10 py-2.5 text-[11px] font-semibold text-[#e9bf72] transition-colors hover:bg-[#C8960C]/18"
                            >
                              Agrandir l'aperçu (plein écran)
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-white/35">Aucun aperçu disponible.</p>
                    )}
                  </StudioPanelSection>

                  <StudioPanelSection
                    title="Caméra"
                    subtitle="Une pression applique la source sur le live. Deux caméras : interrupteur segmenté."
                    icon={Camera}
                  >
                    <StudioDevicePicker
                      devices={videoDevices}
                      activeId={activeVideoId}
                      onPick={onSwitchVideo}
                      icon={Camera}
                      kindFr="Caméra"
                      emptyMessage="Aucune caméra détectée. Autorisez l'accès caméra dans le navigateur."
                      switchHintTwo="Basculer entre les deux caméras"
                      switchHintMany="Choisir une caméra"
                    />
                  </StudioPanelSection>

                  <StudioPanelSection
                    title="Maquillage & détourage"
                    subtitle="Beauté logicielle et chroma (fond vert / bleu) pour isoler votre silhouette."
                    icon={Sparkles}
                  >
                    <Toggle
                      label="Mode Beauté"
                      description="Teint lissé, saturation douce, éclat naturel"
                      checked={beauty}
                      onChange={onBeautyChange}
                    />
                    <div className="my-3 h-px bg-white/8" />
                    <div className="mb-2 flex items-center gap-2">
                      <Scissors className="h-3.5 w-3.5 text-white/45" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Chroma Key</span>
                    </div>
                    <Toggle
                      label="Chroma Key actif"
                      description="Supprime le fond coloré de votre caméra"
                      checked={chromaKey}
                      onChange={onChromaKeyChange}
                    />
                    {chromaKey ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-3 overflow-hidden"
                      >
                        <div>
                          <p className="mb-2 text-[10px] text-white/50">Couleur à supprimer</p>
                          <div className="flex gap-2">
                            {chromaColors.map((c) => (
                              <button
                                key={c.hex}
                                type="button"
                                onClick={() => onChromaColorChange(c.hex)}
                                className={cn(
                                  'h-9 flex-1 rounded-xl border-2 text-[10px] font-semibold transition-all',
                                  chromaColor === c.hex ? 'scale-105 border-white/80' : 'border-transparent opacity-70 hover:opacity-100',
                                )}
                                style={{ backgroundColor: c.hex, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
                              >
                                {c.label}
                              </button>
                            ))}
                            <label
                              className="flex h-9 flex-1 cursor-pointer items-center justify-center rounded-xl border-2 border-white/20 transition-all hover:border-white/40"
                              style={{
                                background:
                                  chromaColor && !chromaColors.find((c) => c.hex === chromaColor) ? chromaColor : '#1a1a2e',
                              }}
                            >
                              <input
                                type="color"
                                value={chromaColor}
                                onChange={(e) => onChromaColorChange(e.target.value)}
                                className="sr-only"
                              />
                              <span className="text-[10px] text-white/50">Custom</span>
                            </label>
                          </div>
                        </div>
                        <SliderRow
                          label="Sensibilité"
                          value={chromaSensitivity}
                          min={40}
                          max={200}
                          step={5}
                          onChange={onChromaSensitivityChange}
                          unit=""
                        />
                      </motion.div>
                    ) : null}
                  </StudioPanelSection>

                  <StudioPanelSection title="Arrière-plan virtuel" subtitle="Fonds, flou immersif et image importée." icon={Image}>
                    <div className="grid grid-cols-4 gap-2">
                      {VBG_PRESETS.map((preset) => {
                        const isSelected = preset.isBlur ? videoBlur : videoVbg === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              if (preset.isBlur) {
                                onVideoBlurChange(!videoBlur);
                                if (videoVbg !== 'none') onVideoVbgChange('none');
                              } else {
                                onVideoVbgChange(preset.id);
                                onVideoBlurChange(false);
                              }
                            }}
                            className={cn(
                              'relative h-16 overflow-hidden rounded-xl border-2 transition-all',
                              isSelected
                                ? 'scale-[1.02] border-[#C8960C] shadow-[0_0_12px_rgba(200,150,12,0.35)]'
                                : 'border-white/10 hover:border-white/28',
                            )}
                            style={{ background: preset.color || '#111' }}
                          >
                            {preset.thumb ? (
                              <img src={preset.thumb} alt={preset.label} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                            ) : null}
                            {preset.isBlur ? (
                              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-blue-900/60 to-purple-900/60 backdrop-blur-sm">
                                <Droplets className="h-5 w-5 text-white/70" />
                              </div>
                            ) : null}
                            {preset.id === 'none' ? (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <X className="h-5 w-5 text-white/30" />
                              </div>
                            ) : null}
                            {isSelected ? (
                              <div className="absolute right-1 top-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#e9bf72] drop-shadow" />
                              </div>
                            ) : null}
                            <div className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5">
                              <p className="text-center text-[8px] text-white/70">{preset.label}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div
                      className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/18 bg-white/[0.03] p-4 transition-all hover:border-[#C8960C]/35 hover:bg-[#C8960C]/5"
                      onClick={() => customBgRef.current?.click()}
                    >
                      <Upload className="h-5 w-5 text-white/30" />
                      <p className="text-xs text-white/40">Importer une image personnalisée</p>
                      <input
                        ref={customBgRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = URL.createObjectURL(file);
                          onCustomBgChange(url);
                          onVideoVbgChange(url);
                          onVideoBlurChange(false);
                        }}
                      />
                    </div>
                    {customBgUrl ? (
                      <div className="relative mt-2 h-20 overflow-hidden rounded-xl border border-white/10">
                        <img src={customBgUrl} alt="Custom BG" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="text-[10px] text-white/70">Fond personnalisé actif</span>
                        </div>
                      </div>
                    ) : null}
                  </StudioPanelSection>

                  <StudioPanelSection title="Étalonnage couleur" subtitle="Filtre appliqué au flux (comme sur le plateau)." icon={Sun}>
                    <div className="mb-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleResetGrading}
                        className="flex items-center gap-1 text-[10px] text-white/38 transition-colors hover:text-white/65"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reset
                      </button>
                    </div>
                    <div className="space-y-4">
                      <SliderRow label="Luminosité" value={brightness} min={50} max={150} onChange={onBrightnessChange} unit="%" color="#facc15" />
                      <SliderRow label="Contraste" value={contrast} min={50} max={150} onChange={onContrastChange} unit="%" color="#60a5fa" />
                      <SliderRow label="Saturation" value={saturation} min={0} max={200} onChange={onSaturationChange} unit="%" color="#a78bfa" />
                      <SliderRow label="Teinte" value={hue} min={-180} max={180} onChange={onHueChange} unit="°" color="#34d399" />
                    </div>
                    <div className="mt-3 rounded-lg border border-white/10 p-3">
                      <p className="mb-2 text-[10px] text-white/40">Aperçu filtre</p>
                      <div
                        className="h-20 rounded-lg bg-gradient-to-br from-amber-400 via-rose-400 to-violet-500"
                        style={{
                          filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`,
                        }}
                      />
                    </div>
                  </StudioPanelSection>
                      </>
                    ) : null}

                    {/* ── AUDIO & AMBIANCE ── */}
                    {tab === 'audio' ? (
                      <>
                  <StudioPanelSection
                    title="Micro"
                    subtitle="Une pression change l'entrée audio LiveKit. Deux micros : interrupteur segmenté."
                    icon={Mic}
                  >
                    <StudioDevicePicker
                      devices={audioDevices}
                      activeId={activeAudioId}
                      onPick={onSwitchAudio}
                      icon={Mic}
                      kindFr="Micro"
                      emptyMessage="Aucun micro détecté. Vérifiez les permissions du navigateur."
                      switchHintTwo="Basculer entre les deux micros"
                      switchHintMany="Choisir un micro"
                    />
                  </StudioPanelSection>

                  <StudioPanelSection title="Contrôle micro (live)" subtitle="Gain et réduction de bruit sur votre voix." icon={Gauge}>
                    <SliderRow
                      label="Gain micro"
                      value={micGain}
                      min={0}
                      max={200}
                      step={5}
                      onChange={onMicGainChange}
                      unit="%"
                      color="#34d399"
                    />
                    <div className="my-3 h-px bg-white/8" />
                    <div className="mb-2 flex items-center gap-2">
                      <Waves className="h-3.5 w-3.5 text-sky-400/85" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Réduction du bruit</span>
                    </div>
                    <Toggle
                      label="Filtre bruit de fond"
                      description="Supprime les bruits ambiants (PC, ventilateur…)"
                      checked={noiseReduction}
                      onChange={onNoiseReductionChange}
                    />
                  </StudioPanelSection>

                  {hostMediaRoutingSlot && !participantMode ? (
                    <StudioPanelSection
                      title="Routage média"
                      subtitle="Aparté privé avec un membre (messagerie / recherche) et préécoute casque hors flux salle — aussi disponible via le bouton « Routage média » en bas à gauche sur le plateau."
                      icon={Cable}
                    >
                      {hostMediaRoutingSlot}
                    </StudioPanelSection>
                  ) : null}

                  {typeof onAmbientMasterVolumeChange === 'function' ? (
                    <StudioPanelSection
                      title="Ambiance sonore"
                      subtitle="Fond musical ou atmosphère de salle (MP3 définis sur la session). Réglage aussi disponible sur le plateau (widget bas-gauche)."
                      icon={Radio}
                    >
                      {Array.isArray(ambientTracks) && ambientTracks.filter((t) => t?.url).length > 0 ? (
                        <>
                          <SliderRow
                            label="Volume ambiance"
                            value={Math.round(Number(ambientMasterVolume) * 100)}
                            min={0}
                            max={100}
                            step={1}
                            onChange={(v) => onAmbientMasterVolumeChange(v / 100)}
                            unit="%"
                            color="#a78bfa"
                          />
                          <ul className="mt-2 space-y-1 border-t border-white/8 pt-2">
                            {ambientTracks
                              .filter((t) => t?.url)
                              .map((t, i) => (
                                <li key={i} className="truncate text-[10px] text-white/45">
                                  • {t.label || 'Piste'}
                                </li>
                              ))}
                          </ul>
                        </>
                      ) : (
                        <p className="text-[10px] leading-relaxed text-white/38">
                          Aucune piste d'ambiance configurée pour cette session. Ajoutez des MP3 dans la configuration studio (étapes
                          création) ou le bandeau d'ambiance hôte.
                        </p>
                      )}
                    </StudioPanelSection>
                  ) : null}

                  {typeof onLiriAudioModeChange === 'function' ? (
                    <StudioPanelSection
                      title="Moteur LIRI"
                      subtitle="Pipeline Web Audio : limiteur, compression, modes voix / chant / musique."
                      icon={Headphones}
                    >
                      <div className="grid grid-cols-2 gap-1.5 mb-3">
                        {LIRI_AUDIO_MODES.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onLiriAudioModeChange(m.id)}
                            className={cn(
                              'rounded-lg border px-2 py-2 text-left transition-all',
                              liriAudioMode === m.id
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                                : 'border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20',
                            )}
                          >
                            <span className="block text-[11px] font-semibold">{m.labelFr}</span>
                            <span className="block text-[9px] text-white/35 mt-0.5 leading-snug">{m.desc}</span>
                          </button>
                        ))}
                      </div>

                      {liriAudioMode && liriAudioMode !== 'off' && liriAudioLevels ? (
                        <div className="rounded-xl border border-white/10 bg-black/25 p-3 mb-3">
                          <p className="text-[10px] text-white/40 mb-2">Niveaux (temps réel)</p>
                          <div className="flex gap-3 items-end h-14">
                            <div className="flex-1 flex flex-col gap-1">
                              <span className="text-[9px] text-white/35">Entrée</span>
                              <div className="h-10 rounded bg-white/5 overflow-hidden flex items-end">
                                <div
                                  className="w-full bg-sky-500/80 transition-[height] duration-75"
                                  style={{ height: `${Math.min(100, (liriAudioLevels.in || 0) * 100)}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex-1 flex flex-col gap-1">
                              <span className="text-[9px] text-white/35">Sortie</span>
                              <div className="h-10 rounded bg-white/5 overflow-hidden flex items-end relative">
                                <div
                                  className={cn(
                                    'w-full transition-[height] duration-75',
                                    liriAudioLevels.clip ? 'bg-red-500/85' : 'bg-emerald-500/75',
                                  )}
                                  style={{ height: `${Math.min(100, (liriAudioLevels.out || 0) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          {liriAudioLevels.clip ? (
                            <p className="text-[10px] text-red-400/90 mt-2">Clip — baissez le gain ou montez le limiteur.</p>
                          ) : null}
                        </div>
                      ) : null}

                      {liriAudioMode && liriAudioMode !== 'off' && liriAudioMode !== 'music' ? (
                        <SliderRow
                          label="Clarté (présence)"
                          value={liriClarity ?? 55}
                          min={0}
                          max={100}
                          onChange={onLiriClarityChange}
                          unit="%"
                          color="#34d399"
                        />
                      ) : null}
                      {liriAudioMode === 'sing' ? (
                        <SliderRow
                          label="Réverbération"
                          value={liriReverb ?? 12}
                          min={0}
                          max={100}
                          onChange={onLiriReverbChange}
                          unit="%"
                          color="#a78bfa"
                        />
                      ) : null}
                      {liriAudioMode && liriAudioMode !== 'off' && liriAudioMode !== 'music' ? (
                        <>
                          <SliderRow
                            label="Compression"
                            value={liriCompression ?? 58}
                            min={0}
                            max={100}
                            onChange={onLiriCompressionChange}
                            unit="%"
                            color="#fbbf24"
                          />
                          <SliderRow
                            label="Fond (HPF / gate)"
                            value={liriGate ?? 35}
                            min={0}
                            max={100}
                            onChange={onLiriGateChange}
                            unit="%"
                            color="#94a3b8"
                          />
                        </>
                      ) : null}
                      {liriAudioMode && liriAudioMode !== 'off' ? (
                        <SliderRow
                          label="Limiteur (plafond)"
                          value={liriLimiter ?? 72}
                          min={0}
                          max={100}
                          onChange={onLiriLimiterChange}
                          unit="%"
                          color="#f87171"
                        />
                      ) : null}
                    </StudioPanelSection>
                  ) : null}

                  {!participantMode && typeof arenaHostAlertSoundsEnabled === 'boolean' && onArenaHostAlertSoundsChange ? (
                    <StudioPanelSection title="Alertes plateau" subtitle="Sons courts côté hôte (mains levées, salle d'attente, antenne, Q&R)." icon={Bell}>
                      <Toggle
                        label="Sons d'alerte Arena"
                        description="Bips lors d'une main levée, de la salle d'attente, d'un changement d'antenne ou d'une question Q&R."
                        checked={arenaHostAlertSoundsEnabled}
                        onChange={onArenaHostAlertSoundsChange}
                      />
                    </StudioPanelSection>
                  ) : null}
                  <div className="rounded-[4px] border border-[rgba(255,255,255,.08)] bg-white/[0.03] p-3">
                    <p className="text-[10px] leading-relaxed text-white/35">
                      Astuce : la réduction du bruit repose sur un filtre Web Audio. Pour un rendu optimal, privilégiez un micro cardioïde
                      ou une interface dédiée.
                    </p>
                  </div>
                      </>
                    ) : null}

                    {/* ── SALLE & IA ── */}
                    {tab === 'salle' && sessionQuickSettings ? (
                      <>
                  <StudioPanelSection title="Lien & invitations" subtitle="Accès public à la session (aligné étape studio)." icon={Link2}>
                    <div className="flex gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-[10px] text-[#e9bf72]/95">
                        {sessionQuickSettings.inviteUrl}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            navigator.clipboard?.writeText(sessionQuickSettings.inviteUrl);
                          } catch {
                            /* ignore */
                          }
                        }}
                        className="shrink-0 rounded-lg border border-[#C8960C]/40 bg-[#C8960C]/12 px-3 py-2 text-[10px] font-bold text-[#e9bf72] transition-colors hover:bg-[#C8960C]/20"
                      >
                        Copier
                      </button>
                    </div>
                  </StudioPanelSection>

                  <StudioPanelSection title="Outils pédagogiques & IA" subtitle="Raccourcis étape 7 — quiz, sondages, Neuron-Q, etc." icon={Sparkles}>
                    <div className="space-y-2">
                      {IA_QUICK_ROWS.map((row) => (
                        <Toggle
                          key={row.key}
                          label={row.label}
                          description={row.desc}
                          checked={Boolean(sessionQuickSettings.iaFlags?.[row.key])}
                          onChange={(v) => sessionQuickSettings.onToggleIa?.(row.key, v)}
                        />
                      ))}
                    </div>
                  </StudioPanelSection>

                  <StudioPanelSection title="Canaux & salle" subtitle="Chat, mains levées, micro/cam invités, partage écran (étape 6)." icon={Monitor}>
                    <div className="space-y-2">
                      {COMM_QUICK_ROWS.map((row) => (
                        <Toggle
                          key={row.key}
                          dataCommKey={row.key}
                          label={row.label}
                          description={row.desc}
                          checked={sessionQuickSettings.commFlags?.[row.key] !== false}
                          onChange={(v) => sessionQuickSettings.onToggleComm?.(row.key, v)}
                        />
                      ))}
                    </div>
                  </StudioPanelSection>

                  {sessionQuickSettings.proctorCameraHistory ? (
                    <StudioPanelSection
                      title="Historique contrôle caméra"
                      subtitle="Lignes enregistrées côté serveur lorsque vous allumez ou coupez la caméra d'un élève (fiche membre)."
                      icon={History}
                    >
                      <div className="mb-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => sessionQuickSettings.proctorCameraHistory.onRefresh?.()}
                          disabled={sessionQuickSettings.proctorCameraHistory.loading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-white/70 transition-colors hover:bg-white/[0.08] disabled:opacity-45"
                        >
                          <RefreshCw
                            className={cn(
                              'h-3 w-3',
                              sessionQuickSettings.proctorCameraHistory.loading ? 'animate-spin' : '',
                            )}
                          />
                          Actualiser
                        </button>
                      </div>
                      <div className="max-h-[min(40vh,280px)] space-y-1.5 overflow-y-auto pr-1">
                        {sessionQuickSettings.proctorCameraHistory.loading &&
                        !(sessionQuickSettings.proctorCameraHistory.rows?.length > 0) ? (
                          <p className="text-[10px] text-white/35">Chargement…</p>
                        ) : null}
                        {sessionQuickSettings.proctorCameraHistory.rows?.length === 0 &&
                        !sessionQuickSettings.proctorCameraHistory.loading ? (
                          <p className="text-[10px] text-white/35">
                            Aucune entrée pour l'instant. Les commandes depuis la fiche membre apparaissent ici.
                          </p>
                        ) : null}
                        {(sessionQuickSettings.proctorCameraHistory.rows || []).map((ev) => {
                          const t = ev.created_at ? new Date(ev.created_at) : null;
                          const rel = t && !Number.isNaN(t.getTime())
                            ? formatDistanceToNow(t, { addSuffix: true, locale: fr })
                            : '—';
                          const label = ev.camera_enabled ? 'Caméra allumée' : 'Caméra coupée';
                          const who =
                            typeof ev.targetName === 'string' && ev.targetName.trim()
                              ? ev.targetName.trim()
                              : String(ev.target_user_id || '').slice(0, 8) || '—';
                          return (
                            <div
                              key={ev.id}
                              className="rounded-lg border border-white/[0.07] bg-black/35 px-2.5 py-2 text-[10px] leading-snug"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-1">
                                <span className="font-semibold text-[#e9bf72]/95">{label}</span>
                                <span className="text-white/38">{rel}</span>
                              </div>
                              <p className="mt-0.5 text-white/55">
                                Élève : <span className="text-white/80">{who}</span>
                              </p>
                              {ev.guest_ack_success === true ? (
                                <p className="mt-1 text-[9px] text-emerald-400/90">
                                  Accusé appareil : appliqué (vu par l'élève)
                                </p>
                              ) : ev.guest_ack_success === false ? (
                                <p className="mt-1 text-[9px] text-rose-300/90">
                                  Accusé appareil : échec
                                  {ev.guest_ack_error ? ` — ${String(ev.guest_ack_error).slice(0, 120)}` : ''}
                                </p>
                              ) : (
                                <p className="mt-1 text-[9px] text-white/30">
                                  Accusé appareil : en attente ou client ancien
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </StudioPanelSection>
                  ) : null}

                  <StudioPanelSection title="Scènes SmartBoard" subtitle="Bandeau joker — sources visibles dans le navigateur de scènes." icon={Image}>
                    <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                      {getAllSmartboardNavigatorSceneMetas().map((scene) => (
                        <Toggle
                          key={scene.id}
                          label={scene.label}
                          description={scene.hint || scene.id}
                          checked={sessionQuickSettings.smartboardSceneFlags?.[scene.id] !== false}
                          onChange={(v) => sessionQuickSettings.onToggleSmartboardScene?.(scene.id, v)}
                        />
                      ))}
                    </div>
                  </StudioPanelSection>

                  <StudioPanelSection title="Control Mesh / JoyKit" subtitle="Passation SmartBoard vers un participant." icon={Network}>
                    <p className="mb-3 text-[10px] leading-relaxed text-white/40">
                      Le moteur audio LIRI et l'ambiance se règlent dans l\'onglet <span className="text-[#e9bf72]/90">Audio & ambiance</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => sessionQuickSettings.onOpenJoyKit?.()}
                      className="flex w-full items-center justify-between rounded-lg border border-[#C8960C]/38 bg-[#C8960C]/10 px-3 py-3 text-left text-[12px] font-semibold text-[#e9bf72] transition-colors hover:bg-[#C8960C]/18"
                    >
                      Ouvrir le panneau JoyKit
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    </button>
                  </StudioPanelSection>

                  {sessionQuickSettings.multilang ? (
                    <StudioPanelSection
                      title="Sous-titres multilingues"
                      subtitle="Traduit la voix du formateur (STT → Edge) et diffuse les légendes sur le bus LONGIA pour les invités."
                      icon={Languages}
                    >
                      <div className="space-y-3">
                        <Toggle
                          label="Activer les traductions live"
                          description="Consomme l'API de traduction (secret serveur). Les invités choisissent une langue d'affichage dans LONGIA."
                          checked={Boolean(sessionQuickSettings.multilang.enabled)}
                          onChange={(v) => sessionQuickSettings.multilang.onChange?.({ enabled: v })}
                        />
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
                            Langue source (STT)
                          </label>
                          <input
                            type="text"
                            value={sessionQuickSettings.multilang.sourceLang ?? ''}
                            onChange={(e) => sessionQuickSettings.multilang.onChange?.({ sourceLang: e.target.value })}
                            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:border-[#C8960C]/40 focus:outline-none"
                            placeholder="fr"
                            maxLength={12}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
                            Langues cibles (codes, séparés par virgule)
                          </label>
                          <input
                            type="text"
                            value={sessionQuickSettings.multilang.targetsStr ?? ''}
                            onChange={(e) => sessionQuickSettings.multilang.onChange?.({ targetsStr: e.target.value })}
                            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:border-[#C8960C]/40 focus:outline-none"
                            placeholder="en, es, de"
                          />
                        </div>
                        <Toggle
                          label="Audio invité : synthèse navigateur"
                          description="Les invités peuvent activer la lecture vocale (Web Speech) des segments traduits, alignée sur la langue affichée."
                          checked={sessionQuickSettings.multilang.guestBrowserTtsOffered !== false}
                          onChange={(v) => sessionQuickSettings.multilang.onChange?.({ guestBrowserTtsOffered: v })}
                        />
                        <Toggle
                          label="Audio invité : ElevenLabs Flash (Edge)"
                          description="Active l'option « serveur » côté invité : Edge `liri-tts` (Flash v2.5, fallback Google). Requiert ELEVENLABS_API_KEY et/ou GOOGLE_CLOUD_TTS_API_KEY."
                          checked={Boolean(sessionQuickSettings.multilang.guestEdgeTtsOffered)}
                          onChange={(v) => sessionQuickSettings.multilang.onChange?.({ guestEdgeTtsOffered: v })}
                        />
                        <Toggle
                          label="Piste interprète LiveKit (agent)"
                          description="À combiner avec un worker qui rejoint la salle avec identity liri-ml-{lang} et publie du micro TTS. Les invités entendent la piste dans la room."
                          checked={Boolean(sessionQuickSettings.multilang.livekitInterpreterEnabled)}
                          onChange={(v) => sessionQuickSettings.multilang.onChange?.({ livekitInterpreterEnabled: v })}
                        />
                      </div>
                    </StudioPanelSection>
                  ) : null}
                      </>
                    ) : null}

                    {/* ── PERMISSIONS ÉLÈVES ── (salle de classe virtuelle) */}
                    {tab === 'permissions' && showPermissionsTab ? (
                      <>
                        <StudioPanelSection
                          title="Salle de classe virtuelle"
                          subtitle="Choisissez ce que les élèves peuvent faire, dire, voir pendant ce cours. Les changements sont appliqués en temps réel — pas besoin de recharger."
                          icon={GraduationCap}
                        >
                          <p className="text-[10px] leading-relaxed text-white/45">
                            Interface identique à la vôtre pour tous les élèves — seules les fonctions cochées ci-dessous sont actives. Les commandes de diffusion (scènes, enregistrement, terminer la session, gestion participants) restent réservées à vous, jamais exposées aux élèves.
                          </p>
                        </StudioPanelSection>

                        {GUEST_PERMISSIONS_SECTIONS.map((section) => (
                          <StudioPanelSection
                            key={section.id}
                            title={section.title}
                            subtitle={section.subtitle}
                            icon={section.icon}
                          >
                            <div className="space-y-2">
                              {section.rows.map((row) => (
                                <Toggle
                                  key={row.key}
                                  label={row.label}
                                  description={row.desc}
                                  checked={Boolean(guestPermissions?.[row.key])}
                                  onChange={(v) => {
                                    try {
                                      onGuestPermissionsChange?.({ ...(guestPermissions || {}), [row.key]: Boolean(v) });
                                    } catch (e) {
                                      console.warn('[LiveStudioSettingsPanel] guest perm update failed', e?.message || e);
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          </StudioPanelSection>
                        ))}
                      </>
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>
            </Tabs>

            {/* Footer */}
            <div className="border-t border-white/[0.08] bg-[#12111a]/95 px-5 py-3">
              <p className="text-center text-[10px] text-white/25">
                Effets vidéo et traitement audio appliqués en temps réel sur votre flux — décor aligné sur le plateau LIRI.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
