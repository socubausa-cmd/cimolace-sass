/**
 * Live Preparation Studio — wizard premium (phase 1 : données réelles + autosave)
 * N'altère pas le live messagerie (/studio/live-immersive).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clapperboard, Layers, Package, MessageSquare, Shield, Lock,
  Sparkles, Calendar, ChevronRight, Check, Loader2, Music, Upload,
  Trash2, Plus, GripVertical, Video, MonitorUp, PenTool, SlidersHorizontal,
  Users, BookOpen, FileText, Link2, Image, Film, ExternalLink,
  AlignLeft, History, Clock, BarChart2, HelpCircle, Award, ChevronDown, ChevronUp,
  ArrowLeft, LayoutGrid, Disc3, Play, ListOrdered,
  Circle, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/customSupabaseClient';
import {
  createDraftLiveSession, getLiveSession, updateLiveSession,
  getBlueprint, upsertBlueprint,
  listScenes, upsertScene, deleteScene,
  listContents, insertContent,
} from '@/services/liveProduction';
import { useLiveScript } from '@/hooks/useLiveScript';
import { LIVE_STUDIO_DRAFT_STORAGE_KEY } from '@/hooks/useLiveStudioDraft';
import { pushWizardSmartboardToLiveScenes } from '@/lib/pushWizardSmartboardToLiveScenes';
import { useToast } from '@/components/ui/use-toast';
import MasterScriptPanel from '@/components/liri/live-room/MasterScriptPanel';
import {
  buildLiriAudioConfigPatch,
  demoLiriAudioScenes,
  normalizeLiriAudioScenes,
} from '@/lib/liriAudioScene';
import {
  studioCreatorCard,
  studioCreatorInputFocus,
  studioCreatorModal,
} from '@/components/studio-creator/studio/studioCreatorTheme';
import {
  ProShell,
  ProTopBar,
  ProSideRail,
  ProStatusBar,
  ProStatusItem,
  proColors,
  proType,
  proSize,
} from '@/components/studio-creator/studio-pro';
import useTenantBranding from '@/hooks/useTenantBranding';

// ─── Types de scènes ────────────────────────────────────────────────────────
const SCENE_TYPES = [
  { id: 'intro',         label: 'Introduction',    icon: Sparkles,         color: 'text-[#e08a5f]',  bg: 'bg-[#d97757]/10 border-[#d97757]/20' },
  { id: 'presentation',  label: 'Présentation',     icon: Video,            color: 'text-[#e0a458]',    bg: 'bg-[#d4924a]/10 border-[#d4924a]/20' },
  { id: 'smartboard',    label: 'Smartboard',       icon: PenTool,          color: 'text-[#7bb06a]', bg: 'bg-[#5a8f52]/10 border-[#5a8f52]/20' },
  { id: 'discussion',    label: 'Discussion',       icon: Users,            color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  { id: 'demo',          label: 'Démonstration',    icon: MonitorUp,        color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
  { id: 'conclusion',    label: 'Conclusion',       icon: BookOpen,         color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20' },
  { id: 'camera_only',   label: 'Caméra seule',     icon: Video,            color: 'text-white/60',    bg: 'bg-white/5 border-white/10' },
  { id: 'screen',        label: 'Partage écran',    icon: MonitorUp,        color: 'text-[#e0a458]',    bg: 'bg-[#d4924a]/10 border-[#d4924a]/20' },
  { id: 'slides',        label: 'Slides',           icon: SlidersHorizontal,color: 'text-[#e08a5f]',  bg: 'bg-[#d97757]/10 border-[#d97757]/20' },
];

// ─── Types de contenus ───────────────────────────────────────────────────────
const CONTENT_TYPES = [
  { id: 'image', label: 'Image',    icon: Image,    accept: 'image/*' },
  { id: 'pdf',   label: 'PDF',      icon: FileText, accept: 'application/pdf' },
  { id: 'video', label: 'Vidéo',    icon: Film,     accept: 'video/*' },
  { id: 'link',  label: 'Lien',     icon: Link2,    accept: null },
];

// ─── Composant carte scène ────────────────────────────────────────────────────
function SceneCard({ scene, index, total, onEdit, onDelete, onMove }) {
  const type = SCENE_TYPES.find((t) => t.id === scene.scene_type) || SCENE_TYPES[0];
  const Icon = type.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn('flex items-center gap-3 rounded-xl border p-3 group', type.bg)}
    >
      <GripVertical className="w-4 h-4 text-white/20 shrink-0" />
      <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[11px] text-white/50 shrink-0">
        {index + 1}
      </span>
      <Icon className={cn('w-4 h-4 shrink-0', type.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{scene.name}</p>
        <p className={cn('text-[11px]', type.color)}>{type.label}</p>
      </div>
      {scene.content_payload_json?.duration && (
        <span className="text-[11px] text-white/40 shrink-0">{scene.content_payload_json.duration}min</span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0}
          className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20">▲</button>
        <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1}
          className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20">▼</button>
        <button type="button" onClick={() => onEdit(scene)}
          className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-amber-300 hover:bg-amber-500/10">✎</button>
        <button type="button" onClick={() => onDelete(scene.id)}
          className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10">✕</button>
      </div>
    </motion.div>
  );
}

// ─── Modal ajout/édition scène ─────────────────────────────────────────────
function SceneModal({ scene, onSave, onClose }) {
  const [form, setForm] = useState({
    name: scene?.name || '',
    scene_type: scene?.scene_type || 'intro',
    duration: scene?.content_payload_json?.duration || '',
    notes: scene?.content_payload_json?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const handle = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    await onSave({
      id: scene?.id,
      name: form.name.trim(),
      scene_type: form.scene_type,
      order_index: scene?.order_index ?? 999,
      content_payload_json: { duration: Number(form.duration) || null, notes: form.notes },
    });
    setBusy(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }}
        className={cn(studioCreatorModal, 'max-h-[min(90dvh,640px)] max-w-md space-y-4 overflow-y-auto')}
      >
        <h3 className="font-display text-lg font-semibold tracking-tight">
          {scene ? 'Modifier la scène' : 'Nouvelle scène'}
        </h3>
        <div className="space-y-1">
          <label className="text-xs text-white/40 uppercase tracking-wide">Nom</label>
          <input value={form.name} onChange={handle('name')}
            className={cn(
              'w-full rounded-xl border border-white/10 bg-black/35 px-4 py-2.5 text-sm text-white outline-none',
              studioCreatorInputFocus,
            )}
            placeholder="Ex: Introduction au sujet" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/40 uppercase tracking-wide">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {SCENE_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} type="button"
                  onClick={() => setForm((f) => ({ ...f, scene_type: t.id }))}
                  className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all',
                    form.scene_type === t.id ? t.bg + ' ' + t.color : 'border-white/8 bg-white/3 text-white/40 hover:border-white/15'
                  )}>
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-white/40 uppercase tracking-wide">Durée (min)</label>
            <input type="number" min={1} value={form.duration} onChange={handle('duration')}
              className={cn(
                'w-full rounded-xl border border-white/10 bg-black/35 px-4 py-2.5 text-sm text-white outline-none',
                studioCreatorInputFocus,
              )}
              placeholder="10" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/40 uppercase tracking-wide">Notes (hôte)</label>
          <textarea value={form.notes} onChange={handle('notes')} rows={2}
            className={cn(
              'w-full resize-none rounded-xl border border-white/10 bg-black/35 px-4 py-2.5 text-sm text-white outline-none',
              studioCreatorInputFocus,
            )}
            placeholder="Points à aborder..." />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:bg-white/5 transition-colors">
            Annuler
          </button>
          <button type="button" onClick={submit} disabled={busy || !form.name.trim()}
            className="flex-1 rounded-xl border py-2.5 font-display text-sm font-semibold transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            style={{
              background: 'linear-gradient(90deg, color-mix(in srgb, var(--school-accent, #D4AF37) 25%, transparent), rgba(217,119,6,0.2))',
              borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 40%, transparent)',
              color: 'color-mix(in srgb, var(--school-accent, #D4AF37) 65%, white)',
            }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (scene ? 'Enregistrer' : 'Ajouter')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Liens de sortie du wizard (évite d'être « coincé » sans retour dashboard / hub studio). */
function LivePrepExitNav({ sessionId }) {
  return (
    <div
      className="border-b backdrop-blur-md"
      style={{
        background: 'color-mix(in srgb, var(--school-background, #0a0908) 90%, transparent)',
        borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 12%, transparent)',
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <nav
          className="flex flex-wrap items-center gap-x-0.5 gap-y-1 text-[11px] sm:text-xs"
          aria-label="Quitter la préparation live"
        >
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-white/60 transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-90" />
            Tableau de bord
          </Link>
          <span className="mx-0.5 hidden h-3 w-px bg-white/15 sm:inline" aria-hidden />
          <Link
            to="/studio"
            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-white/60 transition-colors hover:bg-white/5 hover:text-[var(--school-accent,#D4AF37)]"
          >
            <LayoutGrid className="h-3.5 w-3.5 shrink-0 opacity-80" />
            Studio créateur
          </Link>
          {sessionId ? (
            <>
              <span className="mx-0.5 hidden h-3 w-px bg-white/15 sm:inline" aria-hidden />
              <Link
                to="/studio/live-preparation"
                className="rounded-lg border border-transparent px-2.5 py-1.5 text-white/45 transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white/85"
              >
                Autres brouillons
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </div>
  );
}

const STEPS = [
  { id: 'blueprint',   label: 'Blueprint',   icon: Clapperboard,  desc: 'Plan, objectifs, notes' },
  { id: 'scenes',      label: 'Scènes',      icon: Layers,        desc: 'Composer votre déroulé' },
  { id: 'script',      label: 'Script',      icon: AlignLeft,     desc: 'Prompteur & script IA' },
  { id: 'content',     label: 'Contenus',    icon: Package,       desc: 'Injection médias' },
  { id: 'interaction', label: 'Interactions',icon: MessageSquare, desc: 'Scripts & quiz' },
  { id: 'room',        label: 'Mode salle',  icon: Shield,        desc: 'Secret classroom, etc.' },
  { id: 'access',      label: 'Accès',       icon: Lock,          desc: 'Privé / invitation' },
  { id: 'ai',          label: 'IA prep',     icon: Sparkles,      desc: 'Assist. préparation' },
  { id: 'schedule',    label: 'Planning',    icon: Calendar,      desc: 'Date & rappels' },
  { id: 'historique',  label: 'Historique',  icon: History,       desc: 'Sessions passées & résumés' },
];

/** Sous-écrans par étape (évite un défilement vertical infini dans le wizard) */
const HISTORY_SUBPAGE_SIZE = 3;

function livePrepSubPageCount(step, pastSummariesLength) {
  if (!step) return 1;
  switch (step.id) {
    case 'blueprint':
      return 2;
    case 'scenes':
      return 3;
    case 'content':
      return 2;
    case 'schedule':
      return 2;
    /** Comme l'étape 7 du studio live : IA & outils → ambiance → SmartBoard / LIRI avant le planning */
    case 'ai':
      return 3;
    case 'historique':
      return Math.max(1, Math.ceil(pastSummariesLength / HISTORY_SUBPAGE_SIZE));
    default:
      return 1;
  }
}

const DEFAULT_OUTLINE = {
  title: '',
  description: '',
  chapters: [],
  objectives: [],
  estimatedMinutes: 45,
};

function useDebouncedCallback(fn, delayMs) {
  const tRef = useRef(null);
  return useCallback(
    (...args) => {
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(() => {
        fn(...args);
      }, delayMs);
    },
    [fn, delayMs],
  );
}

export default function LivePreparationStudioPage() {
  const { toast } = useToast();
  const { branding, cssVars } = useTenantBranding();
  const { sessionId: paramSessionId } = useParams();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(paramSessionId || null);
  const [loading, setLoading] = useState(!!paramSessionId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepSubPage, setStepSubPage] = useState(0);
  const [stepsMenuOpen, setStepsMenuOpen] = useState(false);
  const [scriptEditorOpen, setScriptEditorOpen] = useState(false);
  const [sessionRow, setSessionRow] = useState(null);
  const [outline, setOutline] = useState(DEFAULT_OUTLINE);
  const [privateNotes, setPrivateNotes] = useState('');
  const [goalsJson, setGoalsJson] = useState({});
  const [prodAmbientTracks, setProdAmbientTracks] = useState([]);
  const [prodAmbientBusy, setProdAmbientBusy] = useState(false);
  const [prodLiriEnabled, setProdLiriEnabled] = useState(false);
  const [prodLiriScenes, setProdLiriScenes] = useState([]);
  const [prodLiriBusy, setProdLiriBusy] = useState(false);
  const [liriPrepPreview, setLiriPrepPreview] = useState(null);
  const [liriPrepUploading, setLiriPrepUploading] = useState(false);
  const liriPrepFileRef = useRef(null);
  const liriPrepTargetIdxRef = useRef(null);
  const sessionConfigRef = useRef(null);

  // ── Scènes ─────────────────────────────────────────────────────────────────
  const [scenes, setScenes] = useState([]);
  const [sceneModal, setSceneModal] = useState(null); // null | 'new' | scene object
  const [sceneBusy, setSceneBusy] = useState(false);
  /** Brouillon constructeur (/studio/live) — smartboard_element_scenes pour import vers live_scenes */
  const [wizardDraftFromBuilder, setWizardDraftFromBuilder] = useState(null);
  const [draftImportBusy, setDraftImportBusy] = useState(false);
  const [draftImportReplaceExisting, setDraftImportReplaceExisting] = useState(false);

  // ── Contenus ───────────────────────────────────────────────────────────────
  const [contents, setContents] = useState([]);
  const [contentLink, setContentLink] = useState({ title: '', url: '' });
  const [contentBusy, setContentBusy] = useState(false);

  // ── Utilisateur courant (pour script + historique) ─────────────────────────
  const [studioUser, setStudioUser] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setStudioUser({ id: data.user.id });
    });
  }, []);

  // ── Master Script (Phase 6) ────────────────────────────────────────────────
  const {
    sections:       scriptSections,
    currentSection: scriptCurrentSection,
    loading:        scriptLoading,
    improving:      scriptImproving,
    addSection:     scriptAdd,
    updateSection:  scriptUpdate,
    deleteSection:  scriptDelete,
    moveSection:    scriptMove,
    improveSection: scriptImprove,
  } = useLiveScript({
    sessionId,
    currentUser: studioUser,
    enabled: Boolean(sessionId && studioUser),
    currentSlideIndex: 0,
  });

  // ── Historique (résumés sessions passées) ──────────────────────────────────
  const [pastSummaries, setPastSummaries]         = useState([]);
  const [summariesLoading, setSummariesLoading]   = useState(false);
  const [expandedSummaryId, setExpandedSummaryId] = useState(null);

  const prevStepForSubPageRef = useRef(stepIndex);
  useEffect(() => {
    const st = STEPS[stepIndex];
    const n = livePrepSubPageCount(st, pastSummaries.length);
    const stepChanged = prevStepForSubPageRef.current !== stepIndex;
    prevStepForSubPageRef.current = stepIndex;
    if (stepChanged) {
      setStepSubPage(0);
    } else {
      setStepSubPage((p) => Math.min(p, Math.max(0, n - 1)));
    }
  }, [stepIndex, pastSummaries.length]);

  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex]);

  useEffect(() => {
    setSessionId(paramSessionId || null);
  }, [paramSessionId]);

  const load = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data: s, error: e1 } = await getLiveSession(sessionId);
    if (e1 || !s) {
      setError(e1?.message || 'Session introuvable');
      setLoading(false);
      return;
    }
    setSessionRow(s);
    sessionConfigRef.current = s.config ?? null;
    setProdAmbientTracks(Array.isArray(s.ambient_tracks_json) ? s.ambient_tracks_json : []);
    let prepCfg = {};
    try {
      prepCfg = typeof s.config === 'string' ? JSON.parse(s.config) : (s.config && typeof s.config === 'object' ? s.config : {});
    } catch { prepCfg = {}; }
    const liriNorm = normalizeLiriAudioScenes(prepCfg.liri_audio_scenes);
    setProdLiriScenes(liriNorm);
    setProdLiriEnabled(prepCfg.liri_audio_enabled === true || liriNorm.length > 0);
    const { data: bp } = await getBlueprint(sessionId);
    if (bp) {
      const o = bp.outline_json && typeof bp.outline_json === 'object' ? bp.outline_json : {};
      setOutline({ ...DEFAULT_OUTLINE, ...o, title: o.title || s.title || '' });
      setPrivateNotes(bp.private_notes || '');
      setGoalsJson(bp.goals_json && typeof bp.goals_json === 'object' ? bp.goals_json : {});
    } else {
      setOutline((prev) => ({ ...DEFAULT_OUTLINE, ...prev, title: s.title || '' }));
    }
    // Charger scènes + contenus
    const [{ data: scData }, { data: coData }] = await Promise.all([
      listScenes(sessionId),
      listContents(sessionId),
    ]);
    if (scData) setScenes(scData);
    if (coData) setContents(coData);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    sessionConfigRef.current = sessionRow?.config ?? null;
  }, [sessionRow?.config]);

  const flushProdLiri = useCallback(async (enabled, scenes) => {
    if (!sessionId) return;
    setProdLiriBusy(true);
    let cfg = {};
    try {
      const raw = sessionConfigRef.current;
      cfg = typeof raw === 'string' ? JSON.parse(raw) : (raw && typeof raw === 'object' ? { ...raw } : {});
    } catch { cfg = {}; }
    const liri = buildLiriAudioConfigPatch(enabled, scenes);
    const nextConfig = { ...cfg, ...liri };
    const { data, error: e } = await updateLiveSession(sessionId, {
      config: nextConfig,
      updated_at: new Date().toISOString(),
    });
    setProdLiriBusy(false);
    if (e) setError(e.message);
    else if (data) setSessionRow(data);
  }, [sessionId]);

  const debouncedFlushProdLiri = useDebouncedCallback((enabled, scenes) => {
    void flushProdLiri(enabled, scenes);
  }, 850);

  useEffect(() => {
    if (!sessionId || loading) return;
    debouncedFlushProdLiri(prodLiriEnabled, prodLiriScenes);
  }, [prodLiriEnabled, prodLiriScenes, sessionId, loading, debouncedFlushProdLiri]);

  const persistBlueprint = useDebouncedCallback(async (nextOutline, notes, goals) => {
    if (!sessionId) return;
    setSaving(true);
    const title = (nextOutline.title || '').trim() || 'Live sans titre';
    await updateLiveSession(sessionId, {
      title,
      preparation_status: 'blueprint',
    });
    const { error: e } = await upsertBlueprint(sessionId, {
      outline_json: nextOutline,
      private_notes: notes,
      goals_json: goals,
      estimated_duration_minutes: nextOutline.estimatedMinutes ?? null,
    });
    if (e) setError(e.message);
    else setSessionRow((r) => (r ? { ...r, title, preparation_status: 'blueprint' } : r));
    setSaving(false);
  }, 600);

  useEffect(() => {
    if (!sessionId || stepIndex !== 0) return;
    persistBlueprint(outline, privateNotes, goalsJson);
  }, [outline, privateNotes, goalsJson, sessionId, stepIndex, persistBlueprint]);

  // Charger l'historique quand on arrive sur l'onglet
  const currentStepId = STEPS[stepIndex]?.id;

  const readLiveStudioDraftScenes = useCallback(() => {
    if (!studioUser?.id) return null;
    try {
      const raw = localStorage.getItem(LIVE_STUDIO_DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.userId !== studioUser.id) return null;
      const el = parsed.data?.smartboard_element_scenes;
      if (!Array.isArray(el) || !el.length) return null;
      return el;
    } catch {
      return null;
    }
  }, [studioUser?.id]);

  useEffect(() => {
    if (currentStepId !== 'scenes' || !studioUser?.id) {
      setWizardDraftFromBuilder(null);
      return;
    }
    const el = readLiveStudioDraftScenes();
    setWizardDraftFromBuilder(el ? { count: el.length, scenes: el } : null);
  }, [currentStepId, studioUser?.id, readLiveStudioDraftScenes]);

  useEffect(() => {
    if (currentStepId !== 'historique' || !studioUser) return;
    setSummariesLoading(true);
    supabase
      .from('live_session_summaries')
      .select('*')
      .eq('host_id', studioUser.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setPastSummaries(data || []);
        setSummariesLoading(false);
      });
  }, [currentStepId, studioUser]);

  const handleCreate = async () => {
    setError(null);
    setSaving(true);
    const { data, error: e } = await createDraftLiveSession({
      title: 'Live sans titre',
      productionLiveType: 'cours',
    });
    setSaving(false);
    if (e || !data) {
      setError(e?.message || 'Création impossible');
      return;
    }
    navigate(`/studio/live-preparation/${data.id}`, { replace: true });
  };

  const patchSessionMeta = async (patch) => {
    if (!sessionId) return;
    setSaving(true);
    const { data, error: e } = await updateLiveSession(sessionId, patch);
    setSaving(false);
    if (e) setError(e.message);
    else setSessionRow(data);
  };

  // ── Scènes CRUD ────────────────────────────────────────────────────────────
  const handleSaveScene = async (sceneData) => {
    if (!sessionId) return;
    setSceneBusy(true);
    const orderIndex = sceneData.id
      ? (scenes.find((s) => s.id === sceneData.id)?.order_index ?? 0)
      : scenes.length;
    const { data, error: e } = await upsertScene(sessionId, { ...sceneData, order_index: orderIndex });
    setSceneBusy(false);
    if (e || !data) return;
    setScenes((prev) => {
      const idx = prev.findIndex((s) => s.id === data.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = data; return next; }
      return [...prev, data];
    });
  };

  const handleDeleteScene = async (sceneId) => {
    await deleteScene(sceneId);
    setScenes((prev) => prev.filter((s) => s.id !== sceneId));
  };

  const handleMoveScene = async (index, dir) => {
    const next = [...scenes];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((s, i) => { s.order_index = i; });
    setScenes(next);
    // Persist new orders
    await Promise.all(next.map((s) => upsertScene(sessionId, s)));
  };

  const importWizardDraftToLiveScenes = async () => {
    if (!sessionId || !wizardDraftFromBuilder?.scenes?.length) return;
    const replaceExisting = scenes.length > 0 && draftImportReplaceExisting;
    if (scenes.length > 0 && !replaceExisting) return;
    if (replaceExisting) {
      const ok = window.confirm(
        `Les ${scenes.length} scène(s) de cette session seront supprimées, puis remplacées par le brouillon du constructeur (${wizardDraftFromBuilder.count} scène(s)). Confirmer ?`
      );
      if (!ok) return;
    }
    setDraftImportBusy(true);
    const r = await pushWizardSmartboardToLiveScenes(sessionId, wizardDraftFromBuilder.scenes, {
      replaceExisting,
    });
    setDraftImportBusy(false);
    if (r.ok) {
      toast({
        title: r.replaced ? 'Scènes remplacées' : 'Programme importé',
        description: r.replaced
          ? `${r.inserted} scène(s) depuis le constructeur — l'ancien déroulé a été supprimé.`
          : `${r.inserted} scène(s) copiées depuis le constructeur de live (priorité Arena sur la seule config).`,
      });
      const { data } = await listScenes(sessionId);
      if (data) setScenes(data);
      return;
    }
    if (r.reason === 'scenes_exist') {
      toast({
        title: 'Scènes déjà présentes',
        description:
          'Cochez « Remplacer toutes les scènes existantes » pour supprimer le déroulé actuel puis importer le brouillon.',
        variant: 'destructive',
      });
      return;
    }
    if (r.reason === 'no_data') {
      toast({ title: 'Rien à importer', description: 'Brouillon sans programme SmartBoard.', variant: 'destructive' });
      return;
    }
    toast({
      title: 'Import impossible',
      description: r.error?.message || 'Erreur inconnue',
      variant: 'destructive',
    });
  };

  // ── Contenus CRUD ──────────────────────────────────────────────────────────
  const handleUploadContent = async (file, contentType) => {
    if (!sessionId || !file) return;
    setContentBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    const bucket = 'live-recordings';
    const path = `contents/${uid}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (upErr) { setContentBusy(false); return; }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    const { data } = await insertContent(sessionId, {
      content_type: contentType,
      title: file.name,
      asset_url: pub?.publicUrl,
    });
    if (data) setContents((prev) => [...prev, data]);
    setContentBusy(false);
  };

  const handleAddLink = async () => {
    if (!contentLink.url.trim() || !sessionId) return;
    setContentBusy(true);
    const { data } = await insertContent(sessionId, {
      content_type: 'link',
      title: contentLink.title || contentLink.url,
      asset_url: contentLink.url.trim(),
    });
    if (data) setContents((prev) => [...prev, data]);
    setContentLink({ title: '', url: '' });
    setContentBusy(false);
  };

  const persistProdAmbient = async (next) => {
    if (!sessionId) return;
    setProdAmbientBusy(true);
    const { data, error: e } = await updateLiveSession(sessionId, { ambient_tracks_json: next });
    setProdAmbientBusy(false);
    if (e) setError(e.message);
    else {
      setProdAmbientTracks(next);
      if (data) setSessionRow(data);
    }
  };

  const handleProdAmbientUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sessionId) return;
    if (!file.type.startsWith('audio/')) {
      setError('Fichier audio requis (MP3, etc.).');
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;
    const bucket = import.meta.env.VITE_SUPABASE_LIVE_RECORDINGS_BUCKET || 'live-recordings';
    const path = `ambient-prod/${uid}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    setProdAmbientBusy(true);
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || 'audio/mpeg',
      upsert: true,
    });
    if (upErr) {
      setProdAmbientBusy(false);
      setError(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    const url = pub?.publicUrl;
    setProdAmbientBusy(false);
    if (!url) {
      setError('URL publique indisponible.');
      return;
    }
    const label = file.name.replace(/\.[^.]+$/, '');
    await persistProdAmbient([...prodAmbientTracks, { url, label, volume: 0.35 }]);
  };

  const patchProdLiriScene = (idx, patch) => {
    setProdLiriScenes((prev) => prev.map((s, j) => (j === idx ? { ...s, ...patch } : s)));
  };

  const addProdLiriScene = () => {
    setProdLiriEnabled(true);
    setProdLiriScenes((prev) => [
      ...prev,
      {
        id: `liri_${Date.now()}`,
        name: 'Nouvelle scène',
        audioUrl: '',
        volume: 0.35,
        loop: true,
      },
    ]);
  };

  const removeProdLiriScene = (idx) => {
    setProdLiriScenes((prev) => prev.filter((_, j) => j !== idx));
  };

  const moveProdLiriScene = (idx, delta) => {
    setProdLiriScenes((prev) => {
      const j = idx + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const loadDemoProdLiri = () => {
    setProdLiriEnabled(true);
    setProdLiriScenes(demoLiriAudioScenes.map((x) => ({ ...x })));
  };

  const handleLiriPrepFile = async (e) => {
    const file = e.target.files?.[0];
    const idx = liriPrepTargetIdxRef.current;
    liriPrepTargetIdxRef.current = null;
    e.target.value = '';
    if (!file || idx == null || idx < 0) return;
    if (!file.type.startsWith('audio/')) {
      setError('Fichier audio requis (MP3, etc.).');
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;
    const bucket = import.meta.env.VITE_SUPABASE_LIVE_RECORDINGS_BUCKET || 'live-recordings';
    const path = `liri-scenes-prep/${uid}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    setLiriPrepUploading(true);
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || 'audio/mpeg',
      upsert: true,
    });
    setLiriPrepUploading(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    if (pub?.publicUrl) patchProdLiriScene(idx, { audioUrl: pub.publicUrl });
  };

  if (!sessionId && !loading) {
    return (
      <div
        className="min-h-[calc(100dvh-5rem)] text-white"
        data-school-shell="live-preparation"
        data-tenant-brand={branding.slug}
        style={{
          ...cssVars,
          background: 'var(--school-background, #0a0908)',
          fontFamily: 'var(--school-font-family, Inter, sans-serif)',
        }}
      >
        <LivePrepExitNav sessionId={null} />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-[var(--school-accent,#D4AF37)] opacity-90">
              Live Preparation Studio
            </p>
            <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              Scénarisez votre live comme une production
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/55">
              Blueprint, scènes, contenus, modes de salle (Secret Classroom), accès et planning — branché sur{' '}
              <code
                className="rounded border px-1.5 py-0.5"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 10%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
                  color: 'color-mix(in srgb, var(--school-accent, #D4AF37) 55%, white)',
                }}
              >
                live_sessions
              </code>{' '}
              sans toucher au live messagerie.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreate()}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-display text-sm font-semibold text-black shadow-[0_12px_40px_rgba(0,0,0,0.3)] hover:brightness-110 disabled:opacity-60"
                style={{ background: 'linear-gradient(90deg, var(--school-accent, #D4AF37), color-mix(in srgb, var(--school-accent, #D4AF37) 72%, #d97706))' }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                Créer un brouillon
              </button>
              <Link
                to="/studio/live-immersive"
                className="text-sm text-white/50 underline-offset-4 hover:text-white hover:underline"
              >
                Studio slides messagerie (existant)
              </Link>
            </div>
            {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
          </motion.div>
        </div>
      </div>
    );
  }

  if (sessionId && loading) {
    return (
      <div
        className="min-h-[50vh] text-white"
        data-school-shell="live-preparation"
        data-tenant-brand={branding.slug}
        style={{
          ...cssVars,
          background: 'var(--school-background, #0a0908)',
          fontFamily: 'var(--school-font-family, Inter, sans-serif)',
        }}
      >
        <LivePrepExitNav sessionId={sessionId} />
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--school-accent,#D4AF37)]" />
        </div>
      </div>
    );
  }

  if (sessionId && !loading && (error || !sessionRow)) {
    return (
      <div
        className="min-h-[50vh] text-white"
        data-school-shell="live-preparation"
        data-tenant-brand={branding.slug}
        style={{
          ...cssVars,
          background: 'var(--school-background, #0a0908)',
          fontFamily: 'var(--school-font-family, Inter, sans-serif)',
        }}
      >
        <LivePrepExitNav sessionId={sessionId} />
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-sm text-red-400">{error || 'Session introuvable.'}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link to="/studio/live-preparation" className="text-[var(--school-accent,#D4AF37)] underline-offset-4 hover:underline">
              Nouveau brouillon
            </Link>
            <span className="text-white/25">·</span>
            <Link to="/studio" className="text-white/55 underline-offset-4 hover:text-white hover:underline">
              Studio créateur
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const step = STEPS[stepIndex];
  const subCount = livePrepSubPageCount(step, pastSummaries.length);
  const historySliceStart = step.id === 'historique' ? stepSubPage * HISTORY_SUBPAGE_SIZE : 0;

  const sideRailItems = STEPS.map((s, i) => ({
    id: s.id,
    label: `${i + 1}. ${s.label}`,
    icon: s.icon,
    shortLabel: String(i + 1),
  }));

  return (
    <div
      data-school-shell="live-preparation"
      data-tenant-brand={branding.slug}
      style={{
        ...cssVars,
        position: 'absolute',
        inset: 0,
        background: 'var(--school-background, #0a0908)',
        fontFamily: 'var(--school-font-family, Inter, sans-serif)',
      }}
    >
    <ProShell
      topBar={
        <ProTopBar
          logo={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <LiriWordmark size="compact" className="text-[#e8e0d8]" />
              <span
                style={{
                  fontSize: proType.sm,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  color: proColors.textPrimary,
                }}
              >
                · Préparation
              </span>
            </div>
          }
          center={
            <span style={{ fontFamily: proType.ui, fontSize: proType.sm, fontWeight: 600, color: proColors.textPrimary, maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sessionRow?.title || outline.title || 'Nouvelle préparation live'}
            </span>
          }
          right={
            <>
              {saving ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: proType.xxs, color: proColors.warn, padding: '0 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <Loader2 size={10} className="animate-spin" /> Sauvegarde…
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: proType.xxs, color: proColors.ok, padding: '0 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <Save size={10} /> Autosave
                </span>
              )}
              <Link to={`/studio/live-arena/${sessionId}`} style={{ fontSize: proType.xs, color: proColors.accent, padding: '0 8px', textDecoration: 'none', letterSpacing: '0.04em' }}>
                Arène →
              </Link>
              <Link to="/studio" style={{ fontSize: proType.xs, color: proColors.textMuted, padding: '0 8px', textDecoration: 'none' }}>
                Studio
              </Link>
              <Link to="/dashboard" style={{ fontSize: proType.xs, color: proColors.textMuted, padding: '0 8px', textDecoration: 'none' }}>
                Dashboard
              </Link>
            </>
          }
        />
      }
      sideRail={
        <ProSideRail
          items={sideRailItems}
          activeId={step.id}
          onSelect={(id) => {
            const idx = STEPS.findIndex((s) => s.id === id);
            if (idx >= 0) setStepIndex(idx);
          }}
        />
      }
      statusBar={
        <ProStatusBar
          left={
            <>
              <ProStatusItem label="Étape" value={`${stepIndex + 1}/${STEPS.length}`} tone="info" />
              <ProStatusItem label="Scènes" value={scenes.length} />
              <ProStatusItem label="Contenus" value={contents.length} />
            </>
          }
          center={<ProStatusItem value={`Progression ${Math.round(progress)}%`} tone="info" />}
          right={
            <>
              <ProStatusItem label="Mode" value={sessionRow?.room_mode || 'secret_classroom'} />
              <ProStatusItem label="Statut" value={sessionRow?.preparation_status || 'draft'} tone={saving ? 'warn' : 'ok'} />
            </>
          }
        />
      }
    >

      <Dialog open={stepsMenuOpen} onOpenChange={setStepsMenuOpen}>
        <DialogContent
          className="max-h-[88dvh] max-w-md overflow-hidden text-white sm:rounded-2xl"
          style={{
            background: 'var(--school-background, #0a0908)',
            borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 25%, transparent)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-left text-lg text-white">Étapes de préparation</DialogTitle>
          </DialogHeader>
          <nav className="max-h-[min(480px,58dvh)] space-y-1 overflow-y-auto pr-1" aria-label="Étapes du wizard">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === stepIndex;
              const done = i < stepIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStepIndex(i);
                    setStepsMenuOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                    active ? 'text-white ring-1' : 'text-white/60 hover:bg-white/5',
                  )}
                  style={active ? {
                    backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 12%, transparent)',
                    color: 'color-mix(in srgb, var(--school-accent, #D4AF37) 55%, white)',
                    '--tw-ring-color': 'color-mix(in srgb, var(--school-accent, #D4AF37) 35%, transparent)',
                  } : undefined}
                >
                  {done ? <Check className="h-4 w-4 shrink-0 text-[#7bb06a]" /> : <Icon className="h-4 w-4 shrink-0 opacity-80" />}
                  <span>{s.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs text-white/50">
            <Link
              to={`/studio/live-arena/${sessionId}`}
              onClick={() => setStepsMenuOpen(false)}
              className="flex items-center gap-1 text-[var(--school-accent,#D4AF37)] opacity-90 hover:opacity-100"
            >
              Ouvrir l&apos;arène (aperçu) <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              to="/dashboard"
              onClick={() => setStepsMenuOpen(false)}
              className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              Tableau de bord
            </Link>
            <Link
              to="/studio"
              onClick={() => setStepsMenuOpen(false)}
              className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:text-[var(--school-accent,#D4AF37)]"
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              Studio créateur
            </Link>
            <Link
              to="/studio/live-preparation"
              onClick={() => setStepsMenuOpen(false)}
              className="flex items-center gap-2 rounded-lg px-1 py-1 text-white/40 transition-colors hover:text-white/75"
            >
              <Clapperboard className="h-3.5 w-3.5 shrink-0 opacity-70" />
              Autres sessions prod.
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden"
        style={{ padding: 14 }}
      >
          <header
            style={{
              flexShrink: 0,
              background: proColors.surface1,
              border: `1px solid ${proColors.border}`,
              borderRadius: 8,
              padding: 14,
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p style={{
                  fontFamily: proType.ui, fontSize: proType.xxs,
                  letterSpacing: proType.tracking.caps, textTransform: 'uppercase',
                  color: proColors.accent, margin: 0, fontWeight: 600,
                }}>
                  {step.label} — écran {stepSubPage + 1}/{subCount}
                </p>
                <h1 style={{
                  fontFamily: proType.ui, fontSize: proType.lg, fontWeight: 700,
                  color: proColors.textPrimary, margin: '4px 0 2px',
                }}>
                  {sessionRow.title}
                </h1>
                <p style={{ fontSize: proType.xs, color: proColors.textMuted, margin: 0 }}>
                  {sessionRow.production_live_type || '—'} · {sessionRow.room_mode || 'secret_classroom'} ·{' '}
                  {sessionRow.preparation_status || 'draft'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStepsMenuOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: proColors.accentSoft,
                  border: `1px solid ${proColors.borderAccent}`,
                  borderRadius: 4,
                  color: proColors.accent,
                  padding: '6px 10px',
                  fontSize: proType.xs,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                }}
              >
                <ListOrdered size={12} /> Étapes · {stepIndex + 1}/{STEPS.length}
              </button>
            </div>
            <div style={{
              marginTop: 12, height: 4,
              background: proColors.surface2, borderRadius: 2, overflow: 'hidden',
            }}>
              <motion.div
                style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${proColors.accent}, #f3c95b)`,
                  borderRadius: 2,
                }}
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              />
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className={cn(
                studioCreatorCard,
                'flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6',
              )}
            >
              <div className="mb-4 flex shrink-0 items-center gap-3 md:mb-5">
                <step.icon className="h-6 w-6 text-[var(--school-accent,#D4AF37)]" />
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">{step.label}</h2>
                  <p className="text-sm text-white/50">{step.desc}</p>
                </div>
              </div>

              {subCount > 1 && (
                <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Array.from({ length: subCount }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Écran ${i + 1} sur ${subCount}`}
                        aria-current={i === stepSubPage ? 'step' : undefined}
                        onClick={() => setStepSubPage(i)}
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          i === stepSubPage ? 'w-7 bg-[var(--school-accent,#D4AF37)]' : 'w-1.5 bg-white/20 hover:bg-white/35',
                        )}
                      />
                    ))}
                  </div>
                  <span className="font-display text-[10px] text-white/45">
                    Écran {stepSubPage + 1}/{subCount}
                  </span>
                </div>
              )}

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {step.id === 'blueprint' && stepSubPage === 0 && (
                <div className="space-y-4">
                  <label className="block text-xs uppercase tracking-wide text-white/40">Titre du live</label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none focus:border-amber-500/40"
                    value={outline.title}
                    onChange={(e) => setOutline((o) => ({ ...o, title: e.target.value }))}
                  />
                  <label className="block text-xs uppercase tracking-wide text-white/40">Description</label>
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none focus:border-amber-500/40"
                    value={outline.description}
                    onChange={(e) => setOutline((o) => ({ ...o, description: e.target.value }))}
                  />
                </div>
              )}
              {step.id === 'blueprint' && stepSubPage === 1 && (
                <div className="space-y-4">
                  <label className="block text-xs uppercase tracking-wide text-white/40">Durée estimée (min)</label>
                  <input
                    type="number"
                    min={5}
                    className="w-full max-w-xs rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none focus:border-amber-500/40"
                    value={outline.estimatedMinutes}
                    onChange={(e) => setOutline((o) => ({ ...o, estimatedMinutes: Number(e.target.value) || 0 }))}
                  />
                  <label className="block text-xs uppercase tracking-wide text-white/40">Notes privées (hôte)</label>
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none focus:border-amber-500/40"
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                  />
                </div>
              )}

              {step.id === 'scenes' && stepSubPage === 0 && (
                <div className="space-y-4">
                  {sessionId && studioUser && (
                    <div
                      className={cn(
                        'rounded-xl border p-4 space-y-3',
                        wizardDraftFromBuilder
                          ? 'border-[#5a8f52]/30 bg-[#5a8f52]/[0.07]'
                          : 'border-white/10 bg-white/[0.02]',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#9cc48a]/90">
                            Constructeur de live (brouillon)
                          </p>
                          <p className="text-sm text-white/50 mt-1">
                            {wizardDraftFromBuilder
                              ? `Un programme SmartBoard (${wizardDraftFromBuilder.count} scène(s)) est sauvegardé localement depuis /studio/live. Import en « Scènes » si la session est vide, ou remplacement complet si vous cochez l'option ci‑dessous.`
                              : 'Aucun brouillon détecté pour votre compte. Ouvrez le constructeur pour préparer un diaporama ; il est autosauvegardé dans le navigateur.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const el = readLiveStudioDraftScenes();
                            setWizardDraftFromBuilder(el ? { count: el.length, scenes: el } : null);
                          }}
                          className="text-[11px] text-amber-300/90 hover:underline shrink-0"
                        >
                          Actualiser
                        </button>
                      </div>
                      {wizardDraftFromBuilder && scenes.length > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer select-none max-w-xl">
                          <Switch
                            checked={draftImportReplaceExisting}
                            onCheckedChange={setDraftImportReplaceExisting}
                            className="data-[state=checked]:bg-rose-600/80 shrink-0"
                          />
                          <span className="text-[11px] text-rose-200/85 leading-snug">
                            Remplacer toutes les scènes existantes (supprime le déroulé actuel, puis importe le brouillon)
                          </span>
                        </label>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={
                            draftImportBusy ||
                            !wizardDraftFromBuilder ||
                            !sessionId ||
                            (scenes.length > 0 && !draftImportReplaceExisting)
                          }
                          onClick={() => void importWizardDraftToLiveScenes()}
                          className="flex items-center gap-2 h-9 px-4 rounded-full bg-[#5a8f52]/20 border border-[#5a8f52]/35 text-[#d4e6c4] text-xs hover:bg-[#5a8f52]/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        >
                          {draftImportBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          {scenes.length > 0 && draftImportReplaceExisting
                            ? 'Remplacer par le brouillon'
                            : 'Importer le brouillon vers cette session'}
                        </button>
                        <Link
                          to="/studio/live"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-white/45 hover:text-amber-300/90 underline-offset-4 hover:underline"
                        >
                          Ouvrir le constructeur de live
                        </Link>
                        <Link
                          to="/studio/smartboard-designer"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-white/45 hover:text-[#e6b566]/90 underline-offset-4 hover:underline"
                        >
                          SmartBoard Designer
                        </Link>
                        <Link
                          to="/studio/smartboard-aide"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-white/45 hover:text-[var(--school-accent,#D4AF37)] underline-offset-4 hover:underline"
                        >
                          Aide workspace
                        </Link>
                      </div>
                      {scenes.length > 0 && wizardDraftFromBuilder && !draftImportReplaceExisting && (
                        <p className="text-[11px] text-amber-200/80">
                          Cette session a déjà des scènes : activez l'option ci‑dessus pour les supprimer et importer le brouillon, ou supprimez-les manuellement.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {step.id === 'scenes' && stepSubPage === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/50">
                      Composez l'ordre et le type de chaque scène du live.
                    </p>
                    <button type="button" onClick={() => setSceneModal('new')}
                      className="flex items-center gap-1.5 h-8 px-4 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs hover:bg-amber-500/30 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Ajouter une scène
                    </button>
                  </div>

                  {/* Presets rapides */}
                  {scenes.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/15 p-5 text-center space-y-3">
                      <p className="text-sm text-white/40">Aucune scène. Commencez avec un preset :</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {[
                          { label: 'Standard (6 scènes)', types: ['intro','presentation','smartboard','discussion','demo','conclusion'] },
                          { label: 'Court (3 scènes)', types: ['intro','presentation','conclusion'] },
                        ].map((preset) => (
                          <button key={preset.label} type="button"
                            onClick={async () => {
                              for (let i = 0; i < preset.types.length; i++) {
                                const t = SCENE_TYPES.find((x) => x.id === preset.types[i]);
                                await handleSaveScene({ name: t.label, scene_type: t.id, order_index: i, content_payload_json: {} });
                              }
                            }}
                            className="h-8 px-4 rounded-full border border-white/15 bg-white/5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <AnimatePresence mode="popLayout">
                    {scenes.map((sc, i) => (
                      <SceneCard
                        key={sc.id} scene={sc} index={i} total={scenes.length}
                        onEdit={(s) => setSceneModal(s)}
                        onDelete={handleDeleteScene}
                        onMove={handleMoveScene}
                      />
                    ))}
                  </AnimatePresence>

                  {sceneBusy && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    </div>
                  )}
                </div>
              )}

              {((step.id === 'scenes' && stepSubPage === 2) || (step.id === 'ai' && stepSubPage === 2)) && (
                <div className="space-y-4">
                  {step.id === 'ai' && (
                    <p className="text-sm text-white/55">
                      <span className="font-display text-[10px] uppercase tracking-wider text-[var(--school-accent,#D4AF37)] opacity-80">
                        IA prep · écran 3/3
                      </span>
                      {' '}
                      — Liez les pistes audio aux slides SmartBoard (même réglages que dans{' '}
                      <strong className="text-amber-200/80">Scènes</strong>, troisième écran).
                    </p>
                  )}
                  <div
                    className="rounded-xl border p-4 space-y-3"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 6%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 25%, transparent)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Disc3 className="h-5 w-5 text-[var(--school-accent,#D4AF37)] opacity-85 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#f5dd8a]/90">
                            Scènes audio LIRI (Arène)
                          </p>
                          <p className="text-[11px] text-white/45 mt-0.5">
                            Même format que le constructeur /studio/live — stocké dans{' '}
                            <code className="rounded bg-black/30 px-1">config.liri_audio_scenes</code>
                            . Autosauvegarde ~850&nbsp;ms.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {prodLiriBusy ? <Loader2 className="h-4 w-4 animate-spin text-[var(--school-accent,#D4AF37)]" /> : null}
                        <Switch
                          checked={prodLiriEnabled}
                          onCheckedChange={setProdLiriEnabled}
                          className="data-[state=checked]:bg-[var(--school-accent,#D4AF37)]"
                        />
                      </div>
                    </div>

                    {prodLiriEnabled ? (
                      <div className="space-y-3 border-t border-white/10 pt-3">
                        <input
                          ref={liriPrepFileRef}
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(ev) => void handleLiriPrepFile(ev)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={addProdLiriScene}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs hover:bg-white/[0.06]"
                            style={{
                              backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
                              borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 35%, transparent)',
                              color: 'color-mix(in srgb, var(--school-accent, #D4AF37) 60%, white)',
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Ajouter une scène
                          </button>
                          <button
                            type="button"
                            onClick={loadDemoProdLiri}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-white/15 bg-white/5 text-white/60 text-xs hover:bg-white/10"
                          >
                            Exemple (3 pistes)
                          </button>
                        </div>

                        {prodLiriScenes.length === 0 ? (
                          <p className="text-xs text-white/40 text-center py-4 border border-dashed border-white/10 rounded-lg">
                            Aucune scène — ajoutez-en une ou chargez l&apos;exemple.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {prodLiriScenes.map((scene, i) => (
                              <div
                                key={scene.id || i}
                                className="rounded-lg border border-white/10 bg-black/25 p-3 space-y-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-white/30 w-5">{i + 1}</span>
                                  <input
                                    value={scene.name || ''}
                                    onChange={(e) => patchProdLiriScene(i, { name: e.target.value })}
                                    placeholder="Nom"
                                    className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-[color:var(--school-accent,#D4AF37)]"
                                  />
                                  <button
                                    type="button"
                                    title="Monter"
                                    onClick={() => moveProdLiriScene(i, -1)}
                                    disabled={i === 0}
                                    className="p-1 rounded-md text-white/35 hover:bg-white/10 hover:text-white disabled:opacity-20"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Descendre"
                                    onClick={() => moveProdLiriScene(i, 1)}
                                    disabled={i === prodLiriScenes.length - 1}
                                    className="p-1 rounded-md text-white/35 hover:bg-white/10 hover:text-white disabled:opacity-20"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Écouter"
                                    disabled={!scene.audioUrl}
                                    onClick={() =>
                                      scene.audioUrl &&
                                      setLiriPrepPreview({ url: scene.audioUrl, label: scene.name || `Scène ${i + 1}` })
                                    }
                                    className="p-1 rounded-md text-[var(--school-accent,#D4AF37)] opacity-80 hover:bg-white/[0.06] disabled:opacity-25"
                                  >
                                    <Play className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Supprimer"
                                    onClick={() => removeProdLiriScene(i)}
                                    className="p-1 rounded-md text-white/35 hover:text-red-400 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 pl-7">
                                  <input
                                    value={scene.audioUrl || ''}
                                    onChange={(e) => patchProdLiriScene(i, { audioUrl: e.target.value })}
                                    placeholder="https://… (MP3)"
                                    className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] font-mono outline-none focus:border-[color:var(--school-accent,#D4AF37)]"
                                  />
                                  <button
                                    type="button"
                                    disabled={liriPrepUploading}
                                    onClick={() => {
                                      liriPrepTargetIdxRef.current = i;
                                      liriPrepFileRef.current?.click();
                                    }}
                                    className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-lg border border-white/12 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50 shrink-0"
                                  >
                                    {liriPrepUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                    Fichier
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 pl-7">
                                  <label className="flex items-center gap-2 text-[11px] text-white/45">
                                    Vol.
                                    <input
                                      type="range"
                                      min={0}
                                      max={100}
                                      value={Math.round((typeof scene.volume === 'number' ? scene.volume : 0.35) * 100)}
                                      onChange={(e) => patchProdLiriScene(i, { volume: Number(e.target.value) / 100 })}
                                      className="w-20 h-1 accent-[var(--school-accent,#D4AF37)]"
                                    />
                                  </label>
                                  <label className="flex items-center gap-2 text-[11px] text-white/45 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={scene.loop !== false}
                                      onChange={(e) => patchProdLiriScene(i, { loop: e.target.checked })}
                                      className="rounded border-white/20"
                                    />
                                    Boucle
                                  </label>
                                </div>
                                <div className="pl-7 space-y-1">
                                  <label className="text-[10px] text-white/35 uppercase tracking-wide">Texte SmartBoard</label>
                                  <textarea
                                    value={scene.smartboardPayload?.content ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      patchProdLiriScene(i, {
                                        smartboardPayload: v.trim() ? { type: 'text', content: v } : undefined,
                                      });
                                    }}
                                    rows={2}
                                    placeholder="Optionnel — overlay synchro avec la scène"
                                    className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs outline-none focus:border-[color:var(--school-accent,#D4AF37)] resize-none"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {liriPrepPreview?.url ? (
                    <div
                      role="dialog"
                      aria-label="Préécoute LIRI"
                      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
                      onClick={() => setLiriPrepPreview(null)}
                    >
                      <div
                        className={cn(studioCreatorModal, 'max-w-md p-4')}
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <p className="text-sm text-white font-medium truncate">{liriPrepPreview.label}</p>
                        <audio
                          key={liriPrepPreview.url}
                          src={liriPrepPreview.url}
                          controls
                          className="w-full mt-3 accent-[var(--school-accent,#D4AF37)]"
                          autoPlay
                        />
                        <button
                          type="button"
                          onClick={() => setLiriPrepPreview(null)}
                          className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs text-white/60 hover:bg-white/5"
                        >
                          Fermer
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {step.id === 'content' && stepSubPage === 0 && (
                <div className="space-y-5">
                  <div>
                    <p className="mb-3 text-xs uppercase tracking-wide text-white/40">Importer un fichier</p>
                    <div className="grid grid-cols-3 gap-3">
                      {CONTENT_TYPES.filter((c) => c.accept).map((ct) => {
                        const Icon = ct.icon;
                        return (
                          <label key={ct.id}
                            className="group flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 p-4 transition-colors hover:border-amber-500/30 hover:bg-amber-500/5">
                            <Icon className="h-5 w-5 text-white/40 transition-colors group-hover:text-amber-400" />
                            <span className="text-xs text-white/50 group-hover:text-white/70">{ct.label}</span>
                            <input type="file" accept={ct.accept} className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; e.target.value=''; if(f) handleUploadContent(f, ct.id); }} />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs uppercase tracking-wide text-white/40">Ajouter un lien</p>
                    <div className="flex flex-wrap gap-2">
                      <input value={contentLink.title} onChange={(e) => setContentLink((l) => ({ ...l, title: e.target.value }))}
                        placeholder="Titre (optionnel)"
                        className="w-36 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-amber-500/40" />
                      <input value={contentLink.url} onChange={(e) => setContentLink((l) => ({ ...l, url: e.target.value }))}
                        placeholder="https://..."
                        className="min-w-[8rem] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-amber-500/40" />
                      <button type="button" onClick={handleAddLink} disabled={!contentLink.url.trim() || contentBusy}
                        className="h-10 rounded-xl border border-amber-500/30 bg-amber-500/20 px-4 text-sm text-amber-200 transition-colors hover:bg-amber-500/30 disabled:opacity-40">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {contentBusy && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-amber-400" /></div>}
                </div>
              )}

              {step.id === 'content' && stepSubPage === 1 && (
                <div className="space-y-5">
                  {contents.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-white/40">Contenus ajoutés ({contents.length})</p>
                      {contents.map((c) => {
                        const ct = CONTENT_TYPES.find((x) => x.id === c.content_type) || CONTENT_TYPES[3];
                        const Icon = ct.icon;
                        return (
                          <div key={c.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2">
                            <Icon className="w-4 h-4 text-white/40 shrink-0" />
                            <span className="flex-1 text-sm text-white/70 truncate">{c.title || c.asset_url}</span>
                            {c.asset_url && (
                              <a href={c.asset_url} target="_blank" rel="noopener noreferrer"
                                className="text-white/30 hover:text-amber-300 transition-colors shrink-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {contents.length === 0 && (
                    <p className="text-center text-sm text-white/40">Aucun contenu — revenez à l&apos;écran précédent pour importer.</p>
                  )}

                  {contentBusy && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-amber-400" /></div>}
                </div>
              )}

              {step.id === 'interaction' && (
                <div className="space-y-4">
                  <p className="text-sm text-white/50">Préparez des questions et sondages pour animer le live.</p>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                    <p className="text-xs text-white/40 uppercase tracking-wide">Questions préparées</p>
                    <textarea rows={5}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-amber-500/40 resize-none text-white/70"
                      placeholder={'Question 1 : ...\nQuestion 2 : ...\nSondage : ...'}
                      onChange={(e) => {
                        if (!sessionId) return;
                        updateLiveSession(sessionId, { interaction_script_json: { raw: e.target.value } });
                      }}
                      defaultValue={sessionRow?.interaction_script_json?.raw || ''}
                    />
                    <p className="text-xs text-white/30">Ces questions seront disponibles dans la barre de contrôle du live.</p>
                  </div>
                </div>
              )}

              {step.id === 'room' && (
                <div className="space-y-3">
                  <label className="block text-xs uppercase tracking-wide text-white/40">Mode de salle</label>
                  <select
                    className="w-full max-w-md rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none focus:border-amber-500/40"
                    value={sessionRow.room_mode || 'secret_classroom'}
                    onChange={(e) => void patchSessionMeta({ room_mode: e.target.value })}
                  >
                    <option value="secret_classroom">Secret Classroom</option>
                    <option value="public">Public</option>
                    <option value="focus">Focus</option>
                    <option value="guided">Guidé</option>
                    <option value="prayer">Prière</option>
                    <option value="healing">Guérison</option>
                    <option value="ceremony">Cérémonie</option>
                  </select>
                  <p className="text-xs text-white/45">
                    Le <strong>Secret Classroom</strong> s'appuie sur <code>visibility_mode</code>, rôles participants et UI arène
                    (masquage mutuel) — à finaliser dans Live Arena.
                  </p>
                </div>
              )}

              {step.id === 'access' && (
                <div className="space-y-3">
                  <label className="block text-xs uppercase tracking-wide text-white/40">Mode d'accès</label>
                  <select
                    className="w-full max-w-md rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none focus:border-amber-500/40"
                    value={sessionRow.access_mode || 'invite_only'}
                    onChange={(e) => void patchSessionMeta({ access_mode: e.target.value })}
                  >
                    <option value="private">Privé</option>
                    <option value="public">Public</option>
                    <option value="invite_only">Invitation uniquement</option>
                    <option value="password">Mot de passe</option>
                    <option value="manual_gate">Validation manuelle</option>
                  </select>
                </div>
              )}

              {step.id === 'ai' && stepSubPage === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-white/55">
                    <span className="font-display text-[10px] uppercase tracking-wider text-[var(--school-accent,#D4AF37)] opacity-80">
                      IA prep · écran 1/3
                    </span>
                    {' '}
                    — Outils IA pour le live (quiz, sondages, assistances). Les questions préremplies sont dans l&apos;étape{' '}
                    <strong className="text-amber-200/80">Interactions</strong>.
                  </p>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                    <p className="text-xs text-white/40 uppercase tracking-wide">
                      Consignes &amp; préparation (<code className="text-amber-200/80">ai_prep_json</code>)
                    </p>
                    <textarea
                      rows={6}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-amber-500/40 resize-none text-white/70"
                      placeholder="Ex. activer NeuroRecall sur la scène 4, ton formel, mots-clés à surveiller…"
                      onChange={(e) => {
                        if (!sessionId) return;
                        const prev =
                          sessionRow?.ai_prep_json && typeof sessionRow.ai_prep_json === 'object'
                            ? sessionRow.ai_prep_json
                            : {};
                        void updateLiveSession(sessionId, { ai_prep_json: { ...prev, tools_notes: e.target.value } });
                      }}
                      defaultValue={
                        typeof sessionRow?.ai_prep_json === 'object' && sessionRow.ai_prep_json !== null
                          ? (sessionRow.ai_prep_json.tools_notes ?? sessionRow.ai_prep_json.raw ?? '')
                          : ''
                      }
                    />
                    <p className="text-xs text-white/30">
                      Branchement moteur IA (Edge / API) en phase 2 — ces notes restent stockées sur la session.
                    </p>
                  </div>
                </div>
              )}

              {/* ── SCRIPT ── */}
              {step.id === 'script' && (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-white/55">
                    Rédigez le script de votre cours avant le live. Chaque section peut être liée à une scène.
                    Pendant le live, retrouvez votre script dans l&apos;onglet{' '}
                    <strong className="text-amber-200/80">Script</strong> du panel Zone 3.
                  </p>
                  {!sessionId ? (
                    <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
                      <AlignLeft className="mx-auto mb-3 h-8 w-8 text-white/20" />
                      <p className="text-sm text-white/40">Créez d&apos;abord un brouillon de session pour rédiger votre script.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setScriptEditorOpen(true)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-display text-sm font-semibold transition-colors hover:bg-white/[0.06] sm:w-auto sm:px-8"
                        style={{
                          background: 'linear-gradient(90deg, color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent), rgba(217,119,6,0.15))',
                          borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 35%, transparent)',
                          color: 'color-mix(in srgb, var(--school-accent, #D4AF37) 60%, white)',
                        }}
                      >
                        <AlignLeft className="h-4 w-4" />
                        Ouvrir l&apos;éditeur de script (fenêtre)
                      </button>
                      <p className="text-xs text-white/40">
                        {scriptSections?.length ?? 0} section(s) — édition en modal plein écran pour éviter le défilement de la page.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── HISTORIQUE ── */}
              {step.id === 'historique' && (
                <div className="space-y-4">
                  {summariesLoading ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-white/40">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Chargement…</span>
                    </div>
                  ) : pastSummaries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-10 text-center space-y-2">
                      <History className="w-8 h-8 text-white/20 mx-auto" />
                      <p className="text-sm text-white/40">Aucune session passée enregistrée.</p>
                      <p className="text-xs text-white/25">Les résumés apparaîtront ici après vos lives.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pastSummaries.slice(historySliceStart, historySliceStart + HISTORY_SUBPAGE_SIZE).map((s) => {
                        const isExpanded = expandedSummaryId === s.id;
                        const durationMin = Math.round((s.duration_seconds || 0) / 60);
                        const slidesCount = Array.isArray(s.slides_covered) ? s.slides_covered.length : 0;
                        const date = s.created_at
                          ? new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—';
                        return (
                          <div
                            key={s.id}
                            className="rounded-xl border border-white/8 bg-white/[0.025] overflow-hidden"
                          >
                            {/* Header ligne */}
                            <button
                              type="button"
                              onClick={() => setExpandedSummaryId(isExpanded ? null : s.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                            >
                              <div
                                className="w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0"
                                style={{
                                  backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 10%, transparent)',
                                  borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
                                }}
                              >
                                <Award className="w-3.5 h-3.5 text-[var(--school-accent,#D4AF37)]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white/80 truncate">
                                  {s.participant_name ? `Session avec ${s.participant_name}` : 'Session live'}
                                </p>
                                <p className="text-[10px] text-gray-500">{date}</p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0 text-[10px] text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {durationMin > 0 ? `${durationMin} min` : '< 1 min'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  {slidesCount} diapo{slidesCount > 1 ? 's' : ''}
                                </span>
                                <span className="flex items-center gap-1">
                                  <HelpCircle className="w-3 h-3" />
                                  {s.questions_answered}/{s.questions_total}
                                </span>
                              </div>
                              {isExpanded
                                ? <ChevronUp className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                                : <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                              }
                            </button>

                            {/* Détail expandé */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 space-y-3 border-t border-white/6 pt-3">
                                    {/* Résumé IA */}
                                    {s.ai_summary && (
                                      <div
                                        className="rounded-lg border p-3"
                                        style={{
                                          backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 5%, transparent)',
                                          borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 12%, transparent)',
                                        }}
                                      >
                                        <div className="flex items-center gap-1 mb-1.5">
                                          <Sparkles className="w-3 h-3 text-[var(--school-accent,#D4AF37)]" />
                                          <span className="text-[8px] uppercase tracking-wider text-[var(--school-accent,#D4AF37)] opacity-60">Résumé IA</span>
                                        </div>
                                        <p className="text-xs text-white/70 leading-relaxed">{s.ai_summary}</p>
                                      </div>
                                    )}

                                    {/* Points clés */}
                                    {Array.isArray(s.key_points) && s.key_points.length > 0 && (
                                      <div className="space-y-1">
                                        <p className="text-[8px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
                                          <BarChart2 className="w-3 h-3" /> Points clés
                                        </p>
                                        {s.key_points.map((pt, i) => (
                                          <div key={i} className="flex gap-2 items-start">
                                            <span className="w-4 h-4 rounded-full bg-white/8 border border-white/12 text-[7px] text-white/40 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                            <p className="text-[11px] text-white/60">{pt}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="rounded-lg bg-white/[0.03] border border-white/8 p-2 text-center">
                                        <p className="text-[8px] text-gray-500 uppercase tracking-wider">Diapos</p>
                                        <p className="text-sm font-bold text-white/80">{slidesCount}</p>
                                      </div>
                                      <div className="rounded-lg bg-white/[0.03] border border-white/8 p-2 text-center">
                                        <p className="text-[8px] text-gray-500 uppercase tracking-wider">Répondues</p>
                                        <p className="text-sm font-bold text-[#9cc48a]">{s.questions_answered}</p>
                                      </div>
                                      <div className="rounded-lg bg-white/[0.03] border border-white/8 p-2 text-center">
                                        <p className="text-[8px] text-gray-500 uppercase tracking-wider">Script</p>
                                        <p className="text-sm font-bold text-[#e8a97f]">{s.script_sections_total}</p>
                                      </div>
                                    </div>

                                    {/* Reprendre le script */}
                                    {sessionId && s.script_sections_total > 0 && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!studioUser?.id) return;
                                          // Charger les sections de script de cette session passée
                                          const { data: oldSections } = await supabase
                                            .from('live_script_sections')
                                            .select('content, slide_index, order_index, title, master_agent')
                                            .eq('session_id', s.session_id)
                                            .order('order_index', { ascending: true });
                                          if (!oldSections?.length) return;
                                          for (const sec of oldSections) {
                                            await scriptAdd(sec.content, sec.slide_index, {
                                              title: sec.title,
                                              master_agent: sec.master_agent,
                                            });
                                          }
                                          setStepIndex(STEPS.findIndex((x) => x.id === 'script'));
                                        }}
                                        className="w-full h-8 rounded-lg border text-[10px] transition-colors flex items-center justify-center gap-1.5 hover:bg-white/[0.06]"
                                        style={{
                                          backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 6%, transparent)',
                                          borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
                                          color: 'color-mix(in srgb, var(--school-accent, #D4AF37) 70%, white)',
                                        }}
                                      >
                                        <AlignLeft className="w-3 h-3" />
                                        Reprendre ce script dans la session courante
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {step.id === 'schedule' && stepSubPage === 0 && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <label className="block text-xs uppercase tracking-wide text-white/40">Fuseau</label>
                    <input
                      className="w-full max-w-md rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none focus:border-amber-500/40"
                      value={sessionRow.timezone || 'Europe/Paris'}
                      onChange={(e) => void patchSessionMeta({ timezone: e.target.value })}
                    />
                    <p className="text-xs text-white/45">
                      Récurrence & rappels : <code className="text-amber-200/80">scheduling_json</code> (phase 2).
                    </p>
                  </div>
                </div>
              )}

              {((step.id === 'schedule' && stepSubPage === 1) || (step.id === 'ai' && stepSubPage === 1)) && (
                <div className="space-y-5">
                  {step.id === 'ai' && (
                    <p className="text-sm text-white/55">
                      <span className="font-display text-[10px] uppercase tracking-wider text-[var(--school-accent,#D4AF37)] opacity-80">
                        IA prep · écran 2/3
                      </span>
                      {' '}
                      — Musique de fond et pistes d&apos;ambiance pour l&apos;arène (identique à{' '}
                      <strong className="text-amber-200/80">Planning</strong>, deuxième écran).
                    </p>
                  )}
                  <div className="space-y-3 rounded-xl border border-[#d97757]/20 bg-black/25 p-4">
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-[#e8a97f]" />
                      <p className="text-sm font-medium text-white/90">Atmosphère (live production)</p>
                    </div>
                    <p className="text-[11px] text-white/45">
                      MP3 en fond pour l'arène <code className="text-amber-200/70">live_sessions</code> — lecture côté salle en phase 2
                      (même principe que le live messagerie).
                    </p>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10">
                      <Upload className="h-3.5 w-3.5" />
                      Ajouter un MP3
                      <input type="file" accept="audio/*,.mp3" className="hidden" onChange={(ev) => void handleProdAmbientUpload(ev)} />
                    </label>
                    {prodAmbientBusy ? <p className="text-[11px] text-white/50">Envoi…</p> : null}
                    <ul className="space-y-1.5 text-[11px]">
                      {prodAmbientTracks.map((t, i) => (
                        <li key={`${t.url}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2 py-1.5">
                          <span className="truncate text-white/85">{t.label || 'Piste'}</span>
                          <button
                            type="button"
                            onClick={() => void persistProdAmbient(prodAmbientTracks.filter((_, j) => j !== i))}
                            className="text-white/35 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              </div>

              {error && <p className="mt-3 shrink-0 text-sm text-red-400">{error}</p>}

              <div className="mt-auto flex shrink-0 flex-wrap justify-between gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  disabled={stepIndex === 0 && stepSubPage === 0}
                  onClick={() => {
                    if (stepSubPage > 0) setStepSubPage((p) => p - 1);
                    else setStepIndex((i) => Math.max(0, i - 1));
                  }}
                  className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/70 hover:bg-white/5 disabled:opacity-30"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (stepSubPage < subCount - 1) {
                      setStepSubPage((p) => p + 1);
                      return;
                    }
                    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
                    else navigate(`/studio/live-post/${sessionId}`);
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-6 py-2 text-sm font-medium text-black hover:bg-amber-400"
                >
                  {stepSubPage < subCount - 1
                    ? 'Écran suivant'
                    : stepIndex === STEPS.length - 1
                      ? 'Vers Post-Live'
                      : 'Suivant'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
          </div>
      </div>

      {/* ── Modal scène ── */}
      <AnimatePresence>
        {sceneModal && (
          <SceneModal
            scene={sceneModal === 'new' ? null : sceneModal}
            onSave={handleSaveScene}
            onClose={() => setSceneModal(null)}
          />
        )}
      </AnimatePresence>

      <Dialog open={scriptEditorOpen} onOpenChange={setScriptEditorOpen}>
        <DialogContent
          className="max-h-[92dvh] max-w-[min(100vw-1rem,42rem)] overflow-y-auto text-white sm:rounded-2xl"
          style={{
            background: 'var(--school-background, #0a0908)',
            borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 25%, transparent)',
          }}
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-left text-lg text-white">Script &amp; prompteur</DialogTitle>
          </DialogHeader>
          {sessionId ? (
            <MasterScriptPanel
              sections={scriptSections}
              currentSection={scriptCurrentSection}
              loading={scriptLoading}
              improving={scriptImproving}
              onAddSection={scriptAdd}
              onUpdateSection={scriptUpdate}
              onDeleteSection={scriptDelete}
              onMoveSection={scriptMove}
              onImproveSection={scriptImprove}
              totalSlides={Math.max(scenes.length, 1)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </ProShell>
    </div>
  );
}
