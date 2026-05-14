/**
 * StudioSmartboardKonvaPage — LIRI SmartBoard Designer v2
 * Shell entièrement redesigné selon le cahier de charge LIRI.
 *
 * Layout : top bar, rail outils, canvas plein flex, LONGIA en barre flottante (overlay),
 * bande membres collab horizontale en bas à droite, bottom bar.
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Type, Square, Circle, Image as ImageIcon, LayoutGrid, Layers, Cpu,
  UploadCloud, Sparkles, Box, Zap, FileImage, ChevronRight, Radio, FileOutput,
  Bell, LogOut, Undo2, Redo2, Monitor, Smartphone, Projector, GraduationCap,
  Bot, Eye, Mic, MessageSquare, Wand2, GitBranch, BookOpen, ScrollText,
  Map, SlidersHorizontal, Plus, Star, Palette, ArrowLeft, ArrowRight,
  CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp, X, Maximize2, Minimize2,
  HelpCircle, Settings2, Play, Pause, SkipForward, Search, Timer, PenLine,
  AlignLeft, AlignCenter, AlignRight, Lock, Unlock, Trash2, Minus, Disc,
  FlipHorizontal2, FlipVertical2, ScanLine, Camera, Send,
  Film, Tablet, Printer, Tv, Code, Clapperboard,
  PenTool, Pencil, MousePointer2, Scissors, RefreshCw, Hexagon, Eraser,
  History, Cloud, Loader2, PanelRightOpen, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import SmartboardKonvaEditorV1 from '@/features/smartboard-konva-editor/SmartboardKonvaEditorV1';
import CinemaPedagogyBar from '@/features/smartboard-konva-editor/components/CinemaPedagogyBar';
import KonvaParityFeatureRoot from '@/features/smartboard-konva-editor/konva-parity/KonvaParityFeatureRoot';
import { supabase } from '@/lib/customSupabaseClient';
import {
  redeemWorkspaceInvite,
  fetchLiriCourseWorkspaceById,
  saveLiriCourseWorkspace,
} from '@/features/smartboard-konva-editor/lib/liriCourseWorkspaceSupabase';
import { normalizeLifecycleStatus } from '@/features/smartboard-konva-editor/lib/liriWorkspaceLifecycle';
import {
  assertWorkspacePayload,
  LIRI_COURSE_WORKSPACE_LOCAL_KEY,
} from '@/features/smartboard-konva-editor/lib/courseWorkspaceBundle';
import {
  buildWorkspacePayloadFromStores,
  hydrateWorkspaceIntoKonvaEditor,
  inferWorkspaceTitleFromStores,
} from '@/features/smartboard-konva-editor/store/smartboardWorkspaceApi';
import { useDesignerShellStore } from '@/features/smartboard-konva-editor/store/useDesignerShellStore';
import { useCourseCopilotStore } from '@/features/smartboard-konva-editor/store/useCourseCopilotStore';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import {
  buildKonvaProjectFromLiriAgentCours,
  buildLiriCourseCopilotCourseFromAgent,
  buildLiriCourseTextForLiveStudio,
  consumeLiriAgentCoursForKonvaDesigner,
  LIRI_AGENT_TO_KONVA_STORAGE_KEY,
} from '@/lib/liriAgentToKonvaDesigner';
import { safeDesignerReturnPathForState, safeReturnToFromQuery } from '@/lib/returnToNavigation';
import { getSmartboardMobileReadabilitySummary } from '@/lib/smartboardDesignCanvas';
import { useDocumentCoachStore } from '@/features/smartboard-konva-editor/store/useDocumentCoachStore';
import DocumentCoachPanel from '@/pages/studio/DocumentCoachPanel';
import AiHubSuggestionCard from '@/features/smartboard-konva-editor/components/AiHubSuggestionCard';
import { useAiHubStore } from '@/features/smartboard-konva-editor/store/useAiHubStore';
import { buildAiHubSuggestions } from '@/features/smartboard-konva-editor/lib/buildAiHubSuggestions';
import { executeAiHubAction, AI_HUB_EXPLAIN } from '@/features/smartboard-konva-editor/lib/aiHubActions';
import {
  invokeLongiaHub,
  buildLongiaHubV1,
  LONGIA_SURFACE,
  LONGIA_CAPABILITY,
  LONGIA_ENGINE_ROLE,
} from '@/lib/longiaHub';
import { buildLocalLongiaRichReply } from '@/lib/longiaLocalFallback';
import { LongiaUnifiedReply } from '@/features/smartboard-konva-editor/components/LongiaUnifiedReply';
import { enrichLocalLongiaForStore, mergeApiLongiaForStore } from '@/features/smartboard-konva-editor/lib/longiaCoreUnified';
import { runLongiaHubChipAction } from '@/features/smartboard-konva-editor/lib/longiaHubChipActions';
import { mkTextObject, mkRectObject, mkImageObject } from '@/features/smartboard-konva-editor/model/sceneModel';
import {
  clearDesignerImageGallery,
  deleteDesignerImageEntry,
  DESIGNER_IA_IMAGE_SIZES,
  fetchDesignerImageGallery,
  invokeGenerateVisualImage,
  insertDesignerUploadMetadata,
  pushLegacyLocalDesignerImage,
} from '@/features/smartboard-konva-editor/lib/designerIaImageHistory';
import { uploadSmartboardCanvasImage } from '@/lib/uploadSmartboardCanvasImage';
import {
  buildLongiaContextLine,
  getBottomBarHeightPx,
  getBottomBarPlaceholder,
  getLongiaActionStripMaxPrimary,
  getLongiaAnalyzingLabel,
  getLongiaHubPanelWidthPx,
  getLongiaHubTabsForRender,
  getLongiaMessageEmptyState,
  resolveLongiaHeaderStatus,
} from '@/features/smartboard-konva-editor/lib/aiHubLongiaUi';
import {
  buildLongiaHubCoachFeed,
  buildLongiaStudioContext,
  computeLongiaClarityScore,
} from '@/features/smartboard-konva-editor/lib/buildLongiaStudioContext';
import { getEmbeddedAppContextForLongia } from '@/lib/liriEmbeddedControl/nativeShell.js';
import { proColors, proRadii, proType, proSize } from '@/components/studio-pro';

/* ─── Constantes ─────────────────────────────────────────────────── */
const LOCAL_AUTOSAVE_MS = 45_000;
const LEGACY_POLOTNO_NOTICE =
  'Ancien workspace Polotno : le plan Copilot est chargé. Réimportez un export JSON Konva ou reconstruisez les slides.';
const ISNA_PHASE3_HANDOFF_KEY = 'isna_phase3_handoff_v1';

const DesignerPostProductionDock = lazy(() => import('@/pages/studio/DesignerPostProductionDock'));
const DocumentStudioLauncher     = lazy(() => import('@/pages/studio/DocumentStudioLauncher'));

function isFormationContentUuid(value) {
  if (!value) return false;
  const s = String(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function isWorkspaceUuid(value) {
  if (!value) return false;
  const s = String(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function consumeIsnaPhase3Handoff() {
  try {
    const raw = localStorage.getItem(ISNA_PHASE3_HANDOFF_KEY);
    if (!raw) return null;
    localStorage.removeItem(ISNA_PHASE3_HANDOFF_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ─── Outils gauche ──────────────────────────────────────────────── */
const TOOLS = [
  { id: 'selection', icon: MousePointer2, label: 'Sélection', accent: 'teal' },
  { id: 'texte',    icon: Type,       label: 'Texte',         accent: 'cyan' },
  { id: 'formes',   icon: Square,     label: 'Formes',        accent: 'violet' },
  { id: 'icones',   icon: Star,       label: 'Icônes',        accent: 'amber' },
  { id: 'images',   icon: ImageIcon,  label: 'Images',        accent: 'emerald' },
  { id: 'fond',     icon: Palette,    label: 'Fond',          accent: 'pink' },
  { id: '3d',       icon: Box,        label: '3D',            accent: 'blue' },
  { id: 'animes',   icon: Zap,        label: 'Animés',        accent: 'orange' },
  { id: 'modeles',  icon: FileImage,  label: 'Modèles',       accent: 'teal' },
];

const ACCENT = {
  cyan:    { text: 'text-cyan-400',    bg: 'bg-cyan-500/15',    border: 'border-cyan-500/30',    glow: 'shadow-[0_0_14px_rgba(34,211,238,0.3)]'    },
  violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/15',  border: 'border-violet-500/30',  glow: 'shadow-[0_0_14px_rgba(167,139,250,0.3)]'   },
  amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   glow: 'shadow-[0_0_14px_rgba(251,191,36,0.3)]'    },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', glow: 'shadow-[0_0_14px_rgba(52,211,153,0.3)]'    },
  pink:    { text: 'text-pink-400',    bg: 'bg-pink-500/15',    border: 'border-pink-500/30',    glow: 'shadow-[0_0_14px_rgba(244,114,182,0.3)]'   },
  blue:    { text: 'text-blue-400',    bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    glow: 'shadow-[0_0_14px_rgba(96,165,250,0.3)]'    },
  orange:  { text: 'text-orange-400',  bg: 'bg-orange-500/15',  border: 'border-orange-500/30',  glow: 'shadow-[0_0_14px_rgba(251,146,60,0.3)]'    },
  teal:    { text: 'text-teal-400',    bg: 'bg-teal-500/15',    border: 'border-teal-500/30',    glow: 'shadow-[0_0_14px_rgba(45,212,191,0.3)]'    },
  red:     { text: 'text-red-400',     bg: 'bg-red-500/15',     border: 'border-red-500/30',     glow: 'shadow-[0_0_14px_rgba(239,68,68,0.3)]'     },
};

/* ─── Modes vue ──────────────────────────────────────────────────── */
const VIEW_MODES = [
  { id: 'desktop',   icon: Monitor,       label: 'Bureau' },
  { id: 'mobile',    icon: Smartphone,    label: 'Mobile' },
  { id: 'projector', icon: Projector,     label: 'Projecteur' },
  { id: 'student',   icon: GraduationCap, label: 'Élève' },
];

/* ─── Modes principaux du Designer ──────────────────────────────── */
const DESIGNER_MODES = [
  { id: 'design',  icon: Palette,  label: 'Design',  color: 'cyan',   desc: 'Créer et mettre en scène' },
  { id: 'live',    icon: Radio,    label: 'Live',     color: 'red',    desc: 'Diffuser en classe' },
  { id: 'video',   icon: Film,     label: 'Vidéo',    color: 'amber',  desc: 'Analyser une vidéo' },
  { id: 'cinema',  icon: Camera,   label: 'Cinéma',   color: 'violet', desc: 'Enregistrer un cours' },
];

/* ─── AI Hub — mode rapide (icône seulement, pas d'onglets) ─────── */
const AI_QUICK_MODES = [
  { id: 'analyse',    icon: Sparkles,        label: 'Analyse',      color: 'text-amber-400',   dot: 'bg-amber-400'   },
  { id: 'vision',     icon: Eye,             label: 'Vision',       color: 'text-cyan-400',    dot: 'bg-cyan-400'    },
  { id: 'audio',      icon: Mic,             label: 'Audio',        color: 'text-blue-400',    dot: 'bg-blue-400'    },
  { id: 'architect',  icon: Cpu,             label: 'Architect',    color: 'text-violet-400',  dot: 'bg-violet-400'  },
];

/* ─── Outils pédagogiques ────────────────────────────────────────── */
const PEDAGOGIC_TOOLS = [
  { id: 'progression', icon: LayoutGrid,    label: 'Progression\nA/B/C', color: 'amber'   },
  { id: 'eleve',       icon: GraduationCap, label: 'Vue Élève',           color: 'cyan'    },
  { id: 'script-prof', icon: ScrollText,    label: 'Script Prof',         color: 'violet'  },
  { id: 'minuteur',    icon: Timer,         label: 'Minuteur',            color: 'orange'  },
  { id: 'annotation',  icon: PenLine,       label: 'Annotation',          color: 'emerald' },
  { id: 'export-pdf',  icon: FileOutput,    label: 'Export PDF',          color: 'blue'    },
];

/* ─── Types de document (Studio Unifié) ─────────────────────────── */
const DOC_TYPES = [
  {
    id: 'smartboard', icon: Projector, label: 'SmartBoard',
    sub: '1920 × 1080  ·  16/9', color: 'cyan',
    desc: 'Présentation interactive pour vidéoprojecteur et écran de classe',
  },
  {
    id: 'presentation', icon: Monitor, label: 'Présentation',
    sub: '16 : 9  ·  Diapositives', color: 'blue',
    desc: 'Diapositives professionnelles pour réunions, rapports et formations',
  },
  {
    id: 'document', icon: BookOpen, label: 'Document',
    sub: 'A4  ·  Multi-pages', color: 'emerald',
    desc: 'Document de travail avec paragraphes, styles et mise en page riche',
  },
  {
    id: 'affiche', icon: FileImage, label: 'Affiche',
    sub: 'A3 · A4 · personnalisé', color: 'violet',
    desc: 'Création graphique pour impression ou diffusion numérique',
  },
  {
    id: 'video', icon: Film, label: 'Vidéo',
    sub: '1920 × 1080  ·  60fps', color: 'amber',
    desc: 'Découpage et montage avec post-production intégrée, export MP4',
  },
];

/* ─── Dimensions canvas par type de document ─────────────────────── */
const CANVAS_DIMS = {
  smartboard:   { w: 1920, h: 1080 },
  presentation: { w: 1920, h: 1080 },
  affiche:      { w: 2480, h: 3508 }, // A4 portrait @300dpi
  document:     { w:  794, h: 1123 }, // A4 @96dpi écran
  video:        { w: 1920, h: 1080 },
};

/* ─── Outils métier Document ─────────────────────────────────────── */
const DOCUMENT_TOOLS = [
  { id: 'doc-titre',   icon: Type,       label: 'Titre',        accent: 'cyan'    },
  { id: 'doc-para',    icon: AlignLeft,  label: 'Paragraphe',   accent: 'teal'    },
  { id: 'doc-liste',   icon: Layers,     label: 'Liste',        accent: 'emerald' },
  { id: 'doc-image',   icon: ImageIcon,  label: 'Image',        accent: 'violet'  },
  { id: 'doc-tableau', icon: LayoutGrid, label: 'Tableau',      accent: 'amber'   },
  { id: 'doc-entete',  icon: BookOpen,   label: 'En-tête',      accent: 'blue'    },
  { id: 'doc-hr',      icon: Minus,      label: 'Séparateur',   accent: 'pink'    },
  { id: 'doc-page',    icon: Plus,       label: 'Nouvelle page', accent: 'orange'  },
];

/* ─── Outils métier Présentation ─────────────────────────────────── */
const PRESENTATION_TOOLS = [
  { id: 'slide-titre',   icon: Type,       label: 'Titre',       accent: 'cyan'    },
  { id: 'slide-texte',   icon: AlignLeft,  label: 'Texte',       accent: 'teal'    },
  { id: 'slide-media',   icon: ImageIcon,  label: 'Média',       accent: 'violet'  },
  { id: 'slide-forme',   icon: Square,     label: 'Forme',       accent: 'blue'    },
  { id: 'slide-layout',  icon: LayoutGrid, label: 'Disposition', accent: 'amber'   },
  { id: 'slide-anim',    icon: Zap,        label: 'Animation',   accent: 'orange'  },
  { id: 'slide-modele',  icon: FileImage,  label: 'Modèle',      accent: 'pink'    },
];

/* ─── Cibles de sortie ───────────────────────────────────────────── */
const OUTPUT_TARGETS = [
  { id: 'screen',  icon: Tv,         label: 'Smartboard / Écran', w: 1920, h: 1080 },
  { id: 'desktop', icon: Monitor,    label: 'Ordinateur',          w: 1440, h: 900  },
  { id: 'tablet',  icon: Tablet,     label: 'Tablette',            w: 1024, h: 768  },
  { id: 'mobile',  icon: Smartphone, label: 'Smartphone',          w: 390,  h: 844  },
  { id: 'print',   icon: Printer,    label: '+ Impression',        w: 2480, h: 3508, optional: true },
];

/* ════════════════════════════════════════════════════════════════════
   QUICK LAUNCHER PANEL
════════════════════════════════════════════════════════════════════ */
function QuickLauncherPanel({ isOpen, onClose, onCreate, onImportFile }) {
  const fileInputRef = useRef(null);
  const [activeSection, setActiveSection] = useState('creer');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay transparent pour fermeture au clic exterieur */}
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.aside
            key="quick-launcher"
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="fixed left-3 top-[44px] z-50 w-[480px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_12px_60px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)]"
            style={{ background: '#12111a' }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/15 text-cyan-400">
                <Plus className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-white/85">Démarrer un projet</p>
                <p className="text-[10px] text-white/30">Créer, importer ou reprendre un document</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Onglets de section */}
            <div className="flex items-center gap-0.5 border-b border-white/[0.05] px-3 pt-2 pb-1">
              {[
                { id: 'creer',    label: 'Créer' },
                { id: 'importer', label: 'Importer' },
                { id: 'recents',  label: 'Récents' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all',
                    activeSection === tab.id
                      ? 'bg-white/[0.08] text-white/85'
                      : 'text-white/30 hover:text-white/55',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Contenu */}
            <div className="p-3">

              {/* ── Créer ── */}
              {activeSection === 'creer' && (
                <div className="grid grid-cols-3 gap-2">
                  {DOC_TYPES.map(dt => {
                    const Icon = dt.icon;
                    const a = ACCENT[dt.color] ?? ACCENT.cyan;
                    return (
                      <button
                        key={dt.id}
                        type="button"
                        onClick={() => {
                          const defaults = dt.id === 'affiche' ? ['screen', 'print'] : ['screen'];
                          onCreate(dt.id, defaults);
                          onClose();
                        }}
                        className={cn(
                          'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all hover:brightness-110',
                          a.bg, a.border,
                        )}
                      >
                        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', a.bg, a.border)}>
                          <Icon className={cn('h-4 w-4', a.text)} />
                        </span>
                        <div>
                          <p className={cn('text-[11px] font-semibold', a.text)}>{dt.label}</p>
                          <p className="mt-0.5 text-[9px] text-white/35">{dt.sub}</p>
                        </div>
                        <p className="line-clamp-2 text-[9px] leading-snug text-white/25">{dt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Importer ── */}
              {activeSection === 'importer' && (
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-8 text-center transition-all hover:border-cyan-500/30 hover:bg-cyan-500/[0.04]"
                  >
                    <UploadCloud className="h-9 w-9 text-white/15" />
                    <div>
                      <p className="text-[11px] font-medium text-white/45">Glisser un fichier ici</p>
                      <p className="mt-0.5 text-[9px] text-white/25">ou cliquer pour sélectionner</p>
                    </div>
                    <p className="text-[9px] text-white/20">JSON Konva · Image · PDF · Vidéo</p>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,image/*,.pdf,video/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { onImportFile(file); onClose(); }
                      e.target.value = '';
                    }}
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'JSON Konva', accept: '.json',   color: 'cyan',    icon: Code      },
                      { label: 'Image',      accept: 'image/*', color: 'emerald', icon: ImageIcon },
                      { label: 'PDF',        accept: '.pdf',    color: 'pink',    icon: FileImage },
                      { label: 'Vidéo',      accept: 'video/*', color: 'amber',   icon: Film      },
                    ].map(ft => {
                      const FtIcon = ft.icon;
                      const a = ACCENT[ft.color] ?? ACCENT.cyan;
                      return (
                        <button
                          key={ft.label}
                          type="button"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = ft.accept;
                            input.onchange = ev => {
                              const file = ev.target.files?.[0];
                              if (file) { onImportFile(file); onClose(); }
                            };
                            input.click();
                          }}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-xl border py-3 transition-all hover:brightness-110',
                            a.bg, a.border,
                          )}
                        >
                          <FtIcon className={cn('h-4 w-4', a.text)} />
                          <span className={cn('text-[9px] font-medium', a.text)}>{ft.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Récents ── */}
              {activeSection === 'recents' && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] text-white/10">
                    <LayoutGrid className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-white/35">Aucun document récent</p>
                    <p className="mt-0.5 text-[9px] text-white/20">Les projets ouverts apparaîtront ici</p>
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Cloud — enregistrement lié à liri_course_workspaces (shell hideChrome)
════════════════════════════════════════════════════════════════════ */
function DesignerCloudToolbar() {
  const [, setSearchParams] = useSearchParams();
  const cloudId = useDesignerShellStore((s) => s.cloudWorkspaceId);
  const title = useDesignerShellStore((s) => s.cloudWorkspaceTitle);
  const setCloudTitleDraft = useDesignerShellStore((s) => s.setCloudTitleDraft);
  const setCloudMeta = useDesignerShellStore((s) => s.setCloudMeta);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const onSave = async () => {
    setBusy(true);
    setHint('');
    try {
      const payload = buildWorkspacePayloadFromStores();
      const t = (title || '').trim() || inferWorkspaceTitleFromStores();
      const { id, error } = await saveLiriCourseWorkspace({
        id: cloudId,
        title: t.slice(0, 200),
        payload,
        lifecycleStatus: normalizeLifecycleStatus('draft'),
      });
      if (error) {
        setHint(error.message);
        return;
      }
      const nextId = id ?? cloudId;
      if (nextId) {
        setCloudMeta({ id: nextId, title: t });
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev);
            n.set('workspace', nextId);
            return n;
          },
          { replace: true },
        );
      }
      setHint('Enregistré.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hidden lg:flex items-center gap-1.5 shrink-0 max-w-[min(100%,440px)]">
      <Cloud className="h-3.5 w-3.5 text-cyan-400/70 shrink-0" title="Workspace cloud" />
      <input
        value={title}
        onChange={(e) => setCloudTitleDraft(e.target.value)}
        placeholder={inferWorkspaceTitleFromStores()}
        className="min-w-0 w-28 xl:w-40 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/70 outline-none placeholder:text-white/25"
        title="Titre du workspace (Supabase)"
      />
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={busy}
        className="flex shrink-0 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40"
        title="Enregistrer sur le cloud"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sauver'}
      </button>
      {hint ? (
        <span className="text-[9px] text-white/40 truncate max-w-[88px] xl:max-w-[120px]" title={hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   TOP BAR
════════════════════════════════════════════════════════════════════ */
function DesignerTopBar({
  viewMode, setViewMode,
  fullscreen, onToggleFullscreen,
  inviteBanner, formatNotice,
  isnaImportSummary = null,
  onClearIsnaImport = null,
  docType, outputFormats, onNewDoc,
  designerMode, setDesignerMode,
  cinemaPedagogy = false,
  postProdOpen = false,
  onTogglePostProd,
  quickLauncherOpen = false,
  onQuickLaunch,
  cloudToolbar = null,
}) {
  const undo = useSmartboardKonvaStore(s => s.undo);
  const redo = useSmartboardKonvaStore(s => s.redo);
  const scenes = useSmartboardKonvaStore(s => s.project?.scenes ?? []);
  const activeSceneId = useSmartboardKonvaStore(s => s.project?.activeSceneId);
  const activeIdx = scenes.findIndex(s => s.id === activeSceneId);
  const totalScenes = scenes.length;

  const modeColors = {
    design: { active: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/35 shadow-[0_0_12px_rgba(34,211,238,0.2)]',   dot: 'bg-cyan-400'   },
    live:   { active: 'bg-red-500/20 text-red-300 border-red-500/35 shadow-[0_0_12px_rgba(239,68,68,0.2)]',       dot: 'bg-red-400 animate-pulse' },
    video:  { active: 'bg-amber-500/20 text-amber-300 border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.2)]',dot: 'bg-amber-400'  },
    cinema: { active: 'bg-violet-500/20 text-violet-300 border-violet-500/35 shadow-[0_0_12px_rgba(139,92,246,0.2)]', dot: 'bg-violet-400' },
  };

  return (
    <div className="flex-shrink-0">
      <header
        className="flex items-center gap-2 px-3"
        style={{
          height: proSize.topBarHeight,
          minHeight: proSize.topBarHeight,
          background: proColors.surface1,
          borderBottom: `1px solid ${proColors.border}`,
          backdropFilter: 'blur(20px)',
          color: proColors.textPrimary,
        }}
      >
        {/* Logo + breadcrumb */}
        <Link to="/studio/liri" className="flex shrink-0 select-none items-center" aria-label="LIRI">
          <LiriWordmark size="compact" className="text-white/75" />
        </Link>
        <span className="h-4 w-px bg-white/10 shrink-0" />
        <nav className="flex items-center gap-1 text-[11px] text-white/35 shrink-0">
          <Link to="/studio/liri" className="hover:text-white/60 transition-colors">Écosystème</Link>
          <ChevronRight className="h-3 w-3 text-white/20" />
          {cinemaPedagogy ? (
            <>
              <Link to="/studio/smartboard-designer" className="hover:text-white/60 transition-colors">Designer</Link>
              <ChevronRight className="h-3 w-3 text-white/20" />
              <span className="font-medium text-[#D4AF37]">Cinéma pédagogique</span>
            </>
          ) : (
            <span className="text-cyan-400 font-medium">Designer</span>
          )}
        </nav>

        {/* Titre projet */}
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <div
            className={cn(
              'h-6 w-6 flex items-center justify-center rounded-lg border shrink-0',
              cinemaPedagogy
                ? 'bg-[#D4AF37]/15 border-[#D4AF37]/25'
                : 'bg-cyan-500/15 border-cyan-500/20',
            )}
          >
            {cinemaPedagogy ? (
              <Film className="h-3 w-3 text-[#D4AF37]" />
            ) : (
              <LayoutGrid className="h-3 w-3 text-cyan-400" />
            )}
          </div>
          <span className="text-[12px] font-semibold text-white/70 hidden lg:block">
            {cinemaPedagogy ? 'Enregistrement guidé (bêta)' : 'SmartBoard Designer'}
          </span>
        </div>

        <span className="h-4 w-px bg-white/10 mx-1 shrink-0" />

        {/* ── MODE TABS ── centre de gravité du top bar */}
        <div className="flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 shrink-0">
          {DESIGNER_MODES.map(m => {
            const Icon = m.icon;
            const isActive = designerMode === m.id;
            const mc = modeColors[m.id];
            return (
              <button
                key={m.id}
                onClick={() => setDesignerMode(m.id)}
                title={m.desc}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all',
                  isActive
                    ? mc.active
                    : 'border-transparent text-white/30 hover:text-white/60 hover:bg-white/[0.05]',
                )}
              >
                {isActive && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', mc.dot)} />}
                <Icon className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>

        {typeof onTogglePostProd === 'function' ? (
          <>
            <span className="h-4 w-px bg-white/10 mx-0.5 shrink-0" />
            <button
              type="button"
              onClick={onTogglePostProd}
              title="Post-production vidéo (dock)"
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all shrink-0',
                postProdOpen
                  ? 'border-amber-500/35 bg-amber-500/15 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'border-transparent text-white/30 hover:text-amber-200/80 hover:bg-white/[0.05]',
              )}
            >
              <Clapperboard className="h-3 w-3 shrink-0" />
              <span className="hidden lg:inline">Post-prod</span>
            </button>
          </>
        ) : null}

        {cloudToolbar}

        {/* Doc type + sorties pills — visibles quand un doc est actif */}
        {docType && (
          <>
            <span className="h-4 w-px bg-white/10 mx-1 shrink-0" />
            <div className="hidden items-center gap-1.5 md:flex shrink-0">
              {(() => {
                const dt = DOC_TYPES.find(d => d.id === docType);
                const a = ACCENT[dt?.color ?? 'cyan'];
                const Icon = dt?.icon ?? FileImage;
                return (
                  <span className={cn('flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold', a.bg, a.border, a.text)}>
                    <Icon className="h-3 w-3" />{dt?.label}
                  </span>
                );
              })()}
              {(outputFormats || []).slice(0, 3).map(fid => {
                const t = OUTPUT_TARGETS.find(o => o.id === fid);
                if (!t) return null;
                const Icon = t.icon;
                return (
                  <span key={fid} className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] text-white/40">
                    <Icon className="h-3 w-3" />{t.label.split(' ')[0]}
                  </span>
                );
              })}
              {outputFormats?.length > 3 && (
                <span className="text-[10px] text-white/25">+{outputFormats.length - 3}</span>
              )}
            </div>
          </>
        )}

        {/* Bouton + Quick Launcher — toujours visible */}
        <span className="h-4 w-px bg-white/10 mx-1 shrink-0" />
        <button
          type="button"
          onClick={onQuickLaunch}
          title="Créer · Importer · Récents"
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all shrink-0',
            quickLauncherOpen
              ? 'border-cyan-500/35 bg-cyan-500/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
              : 'border-white/[0.07] bg-white/[0.03] text-white/40 hover:bg-white/[0.07] hover:text-white/70',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Nouveau</span>
        </button>

        {/* Séparateur */}
        <span className="h-4 w-px bg-white/10 mx-1 shrink-0" />

        {/* Mode switch */}
        <div className="hidden items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5 md:flex">
          {VIEW_MODES.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                title={m.label}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-md transition-all',
                  viewMode === m.id
                    ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.25)]'
                    : 'text-white/30 hover:text-white/60'
                )}
              >
                <Icon className="h-3 w-3" />
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button onClick={undo} title="Annuler (⌘Z)" className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/8 hover:text-white/70 transition-all">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={redo} title="Rétablir (⌘⇧Z)" className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/8 hover:text-white/70 transition-all">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="h-4 w-px bg-white/10 shrink-0" />

        {/* Scènes compteur */}
        <span className="hidden text-[11px] text-white/30 sm:block shrink-0">
          {activeIdx + 1} / {totalScenes} scène{totalScenes > 1 ? 's' : ''}
        </span>

        <span className="h-4 w-px bg-white/10 shrink-0" />

        {/* Plein écran */}
        <button
          onClick={onToggleFullscreen}
          title={fullscreen ? 'Quitter plein écran' : 'Plein écran'}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/8 hover:text-white/70 transition-all"
        >
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>

        {/* Aide */}
        <Link to="/studio/smartboard-aide" title="Aide" className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/8 hover:text-white/70 transition-all">
          <HelpCircle className="h-3.5 w-3.5" />
        </Link>

        <span className="h-4 w-px bg-white/10 shrink-0" />

        {/* Live */}
        <Link to="/studio/live" className="flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition-all hover:bg-red-500/20 shrink-0">
          <Radio className="h-3 w-3" />
          <span className="hidden sm:inline">Live</span>
        </Link>

        {/* Exporter */}
        <Link to="/studio/export-center" className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/40 transition-all hover:border-white/20 hover:text-white/70 shrink-0">
          <FileOutput className="h-3 w-3" />
          <span className="hidden sm:inline">Exporter</span>
        </Link>

        <Bell className="h-4 w-4 text-white/25 cursor-pointer hover:text-white/50 transition-colors shrink-0" />

        <Link to="/studio/liri" title="Hub" className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/8 hover:text-white/60 transition-all shrink-0">
          <LogOut className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Bandeaux notification */}
      <AnimatePresence>
        {inviteBanner && (
          <motion.div key="invite" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-cyan-500/20 bg-cyan-950/25 px-4 py-1.5 text-[11px] text-cyan-200/90">
              <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />{inviteBanner}
            </div>
          </motion.div>
        )}
        {formatNotice && (
          <motion.div key="format" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-amber-500/25 bg-amber-950/30 px-4 py-1.5 text-[11px] text-amber-100/90">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />{formatNotice}
            </div>
          </motion.div>
        )}
        {isnaImportSummary && (
          <motion.div key="isna-handoff" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-fuchsia-500/25 bg-fuchsia-950/30 px-4 py-1.5 text-[11px] text-fuchsia-100/90">
              <div className="flex min-w-0 items-center gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 text-fuchsia-300" />
                <span className="truncate">
                  Résumé import : {isnaImportSummary.stepsCount} étape(s) · source {isnaImportSummary.source || '—'} · {isnaImportSummary.savedAtLabel || 'date inconnue'}
                </span>
              </div>
              {typeof onClearIsnaImport === 'function' ? (
                <button
                  type="button"
                  onClick={onClearIsnaImport}
                  className="rounded-md border border-fuchsia-400/35 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25"
                >
                  Vider l&apos;import
                </button>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   LEFT TOOL SIDEBAR (icon strip)
════════════════════════════════════════════════════════════════════ */
/* Tools per designer mode */
const MODE_TOOLS = {
  design: TOOLS,
  live: [
    { id: 'pointer',    icon: ScanLine,   label: 'Pointeur',     accent: 'cyan'    },
    { id: 'annotation', icon: PenLine,    label: 'Annotation',   accent: 'amber'   },
    { id: 'timer',      icon: Timer,      label: 'Minuteur',     accent: 'orange'  },
    { id: 'spotlight',  icon: Zap,        label: 'Spotlight',    accent: 'violet'  },
    { id: 'drawing',    icon: AlignLeft,  label: 'Dessin libre', accent: 'emerald' },
  ],
  video: [
    { id: 'segment',    icon: ScanLine,   label: 'Segment',       accent: 'amber'   },
    { id: 'marker',     icon: AlignCenter,label: 'Marqueur',      accent: 'cyan'    },
    { id: 'transcribe', icon: ScrollText, label: 'Transcription', accent: 'violet'  },
    { id: 'capture',    icon: Camera,     label: 'Capture frame', accent: 'emerald' },
  ],
  cinema: [
    { id: 'record',     icon: Disc,       label: 'Enregistrer',  accent: 'red'     },
    { id: 'take',       icon: Film,       label: 'Prise',         accent: 'amber'   },
    { id: 'script',     icon: ScrollText, label: 'Script',        accent: 'violet'  },
    { id: 'teleprompter',icon: AlignRight,label: 'Prompteur',    accent: 'cyan'    },
  ],
};

function ToolSidebar({ activeTool, onTool, designerMode = 'design', docType = null }) {
  // Context Engine : le type de projet prime sur le mode designer
  let tools;
  if (docType === 'document')     tools = DOCUMENT_TOOLS;
  else if (docType === 'presentation') tools = PRESENTATION_TOOLS;
  else tools = MODE_TOOLS[designerMode] ?? TOOLS;

  return (
    <aside
      className="flex flex-col gap-0.5 w-12 flex-shrink-0 border-r border-white/[0.07] py-3 px-1.5"
      style={{ background: '#12111a' }}
    >
      {tools.map(tool => {
        const Icon = tool.icon;
        const a = ACCENT[tool.accent] ?? ACCENT.cyan;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onTool(isActive ? null : tool.id)}
            title={tool.label}
            className={cn(
              'group flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150',
              isActive
                ? [a.bg, 'border', a.border, a.glow]
                : 'border border-transparent text-white/30 hover:bg-white/[0.06] hover:text-white/60'
            )}
          >
            <Icon className={cn('h-4 w-4 transition-colors', isActive ? a.text : '')} />
          </button>
        );
      })}

      <div className="flex-1" />

      {/* Layers */}
      <button title="Calques" className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-white/25 hover:bg-white/[0.06] hover:text-white/50 transition-all">
        <Layers className="h-4 w-4" />
      </button>
      {/* Settings */}
      <button title="Paramètres canvas" className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-white/25 hover:bg-white/[0.06] hover:text-white/50 transition-all">
        <Settings2 className="h-4 w-4" />
      </button>
    </aside>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CONTEXTUAL PANEL (slides in next to left sidebar)
════════════════════════════════════════════════════════════════════ */
/* Flat lookup: tool id → accent color (tous modes + tous types de projet) */
const ALL_TOOLS_FLAT = [
  ...Object.values(MODE_TOOLS).flat(),
  ...DOCUMENT_TOOLS,
  ...PRESENTATION_TOOLS,
];
function getToolAccent(toolId) {
  const found = ALL_TOOLS_FLAT.find(t => t.id === toolId);
  return ACCENT[found?.accent ?? 'cyan'] ?? ACCENT.cyan;
}

/** Raccourcis droite (mode Design) : miroir léger de la barre gauche + LONGIA. */
function DesignerQuickRail({
  docType,
  designerMode,
  fullscreen,
  activeTool,
  onTool,
  onOpenLongia,
  onSelectAll,
}) {
  if (!docType || fullscreen || designerMode !== 'design') return null;
  return (
    <aside
      className="flex w-11 flex-shrink-0 flex-col items-center gap-1 border-l border-white/[0.06] bg-[#12111a] py-2"
      aria-label="Raccourcis studio"
    >
      {[
        { tid: 'texte', Icon: Type, title: 'Texte — titres et paragraphes' },
        { tid: 'formes', Icon: Square, title: 'Formes et vecteur' },
        { tid: 'selection', Icon: MousePointer2, title: 'Sélection multiple' },
        { tid: 'modeles', Icon: FileImage, title: 'Modèles de mise en page' },
      ].map(({ tid, Icon, title }) => {
        const isActive = activeTool === tid;
        const a = getToolAccent(tid);
        return (
          <button
            key={tid}
            type="button"
            title={title}
            onClick={() => onTool(isActive ? null : tid)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150',
              isActive
                ? [a.bg, 'border', a.border, a.glow]
                : 'border border-transparent text-white/30 hover:bg-white/[0.06] hover:text-white/55',
            )}
          >
            <Icon className={cn('h-4 w-4 transition-colors', isActive ? a.text : '')} />
          </button>
        );
      })}
      <div className="my-0.5 h-px w-6 bg-white/[0.08]" />
      <button
        type="button"
        title="Tout sélectionner sur la scène"
        onClick={onSelectAll}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/55"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Ouvrir LONGIA (suggestions)"
        onClick={onOpenLongia}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/[0.08] text-amber-300/90 transition-all hover:bg-amber-500/15"
      >
        <Sparkles className="h-4 w-4" />
      </button>
    </aside>
  );
}

/* Background presets */
const BG_PRESETS = [
  { id: 'dark',        label: 'Nuit',         value: '#07080c',                              swatch: '#07080c'   },
  { id: 'midnight',    label: 'Minuit',        value: '#0b0d1a',                              swatch: '#0b0d1a'   },
  { id: 'transparent', label: 'Transparent',   value: 'transparent',                          swatch: null        },
  { id: 'white',       label: 'Blanc',         value: '#ffffff',                              swatch: '#ffffff'   },
  { id: 'slate',       label: 'Ardoise',       value: '#1e293b',                              swatch: '#1e293b'   },
  { id: 'royal',       label: 'Royal',         value: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', swatch: '#302b63' },
  { id: 'forest',      label: 'Forêt',         value: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', swatch: '#203a43' },
  { id: 'gold',        label: 'Or',            value: 'linear-gradient(135deg,#1a1207,#2d1f0a,#D4AF37)', swatch: '#D4AF37' },
];

/* Polices proposées dans le picker — chargement Google Fonts à la demande */
const TEXT_FONTS = [
  { value: 'Inter',            label: 'Inter',            category: 'Sans-serif'  },
  { value: 'Roboto',           label: 'Roboto',           category: 'Sans-serif'  },
  { value: 'Montserrat',       label: 'Montserrat',       category: 'Géométrique' },
  { value: 'DM Sans',          label: 'DM Sans',          category: 'Moderne'     },
  { value: 'Space Grotesk',    label: 'Space Grotesk',    category: 'Tech'        },
  { value: 'Raleway',          label: 'Raleway',          category: 'Élégant'     },
  { value: 'Playfair Display', label: 'Playfair Display', category: 'Serif'       },
  { value: 'Merriweather',     label: 'Merriweather',     category: 'Serif'       },
  { value: 'Georgia',          label: 'Georgia',          category: 'Classique'   },
  { value: 'Courier New',      label: 'Courier New',      category: 'Mono'        },
];

const TOOL_CONTENT = {
  selection: {
    label: 'Sélection',
    items: [],
    tabs: ['Multi-sélection'],
  },
  texte: {
    label: 'Texte',
    items: [
      { id: 'h1',      label: 'Titre 1',      sub: '48px · Gras',         shape: 'H1',
        textPreset: { w: 700, h: 72, text: 'Titre principal',
          style: { fontSize: 48, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.5, fill: '#F7F2E8' } } },
      { id: 'h2',      label: 'Titre 2',      sub: '36px · Gras',         shape: 'H2',
        textPreset: { w: 600, h: 56, text: 'Titre de section',
          style: { fontSize: 36, fontWeight: 700, lineHeight: 1.2,  letterSpacing: -0.3, fill: '#F7F2E8' } } },
      { id: 'h3',      label: 'Titre 3',      sub: '28px · Semibold',     shape: 'H3',
        textPreset: { w: 520, h: 46, text: 'Sous-section',
          style: { fontSize: 28, fontWeight: 600, lineHeight: 1.25, letterSpacing: 0,    fill: '#F7F2E8' } } },
      { id: 'h4',      label: 'Titre 4',      sub: '22px · Semibold',     shape: 'H4',
        textPreset: { w: 460, h: 40, text: 'Titre 4',
          style: { fontSize: 22, fontWeight: 600, lineHeight: 1.3,  letterSpacing: 0,    fill: '#F7F2E8' } } },
      { id: 'subtitle',label: 'Sous-titre',   sub: '20px · Regular',      shape: 'S',
        textPreset: { w: 540, h: 38, text: 'Sous-titre de la présentation',
          style: { fontSize: 20, fontWeight: 400, lineHeight: 1.4,  letterSpacing: 0,    fill: '#c4bfd4' } } },
      { id: 'lead',    label: 'Introduction', sub: '18px · Léger',        shape: '⁋',
        textPreset: { w: 580, h: 58, text: "Texte d'introduction pour accrocher le lecteur dès la première ligne.",
          style: { fontSize: 18, fontWeight: 300, lineHeight: 1.6,  letterSpacing: 0.2,  fill: '#d4d0e0' } } },
      { id: 'body',    label: 'Corps',        sub: '16px · Regular',      shape: 'ΒΤ',
        textPreset: { w: 520, h: 80, text: 'Votre texte principal va ici. Cliquez deux fois pour éditer directement sur le canvas.',
          style: { fontSize: 16, fontWeight: 400, lineHeight: 1.65, letterSpacing: 0.1,  fill: '#F7F2E8' } } },
      { id: 'caption', label: 'Légende',      sub: '12px · Gris',         shape: 'ab',
        textPreset: { w: 340, h: 32, text: 'Légende ou note de bas de page',
          style: { fontSize: 12, fontWeight: 400, lineHeight: 1.5,  letterSpacing: 0.2,  fill: '#8892aa' } } },
      { id: 'quote',   label: 'Citation',     sub: '16px · Italique',     shape: '❝',
        textPreset: { w: 480, h: 64, text: '« Une pensée inspirante que vous souhaitez mettre en valeur »',
          style: { fontSize: 16, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.7, fill: '#c4bfd4' } } },
      { id: 'label',   label: 'Étiquette',    sub: '10px · Majuscules',   shape: 'TT',
        textPreset: { w: 220, h: 28, text: 'ÉTIQUETTE',
          style: { fontSize: 10, fontWeight: 700, lineHeight: 1.4,  letterSpacing: 3,    fill: '#F7F2E8' } } },
      { id: 'code',    label: 'Code',         sub: 'Monospace · 13px',    shape: '</>',
        textPreset: { w: 380, h: 44, text: 'console.log("Hello, world!")',
          style: { fontSize: 13, fontWeight: 400, fontFamily: 'Courier New, monospace', lineHeight: 1.6, fill: '#7dd3fc' } } },
      { id: 'ai',      label: 'IA Texte',     sub: 'Générer avec LONGIA', icon: Sparkles, ai: true },
    ],
    tabs: ['Styles', 'Police', 'IA'],
  },
  formes: {
    label: 'Formes',
    items: [
      { id: 'rect',      label: 'Rectangle',   sub: 'Carré plein',  shape: '□' },
      { id: 'circle',    label: 'Cercle',       sub: 'Rond plein',   shape: '○' },
      { id: 'ellipse',   label: 'Ellipse',      sub: 'Ovale',        shape: '⬭' },
      { id: 'triangle',  label: 'Triangle',     sub: 'Polygone',     shape: '△' },
      { id: 'diamond',   label: 'Losange',      sub: 'Diamant',      shape: '◇' },
      { id: 'starshape', label: 'Étoile',       sub: '5 branches',   shape: '★' },
      { id: 'line',      label: 'Ligne',        sub: 'Trait libre',  shape: '—' },
      { id: 'arrow',     label: 'Flèche',       sub: 'Direction',    shape: '→' },
      { id: 'ai',        label: 'IA Forme',     sub: 'Suggérer',     icon: Sparkles, ai: true },
    ],
    tabs: ['Formes', 'Suggestions IA', 'Mes formes'],
  },
  images: {
    label: 'Images',
    items: [
      { id: 'upload',   label: 'Importer',     sub: 'Vers le stockage cloud', icon: UploadCloud },
      { id: 'library',  label: 'Bibliothèque', sub: 'Mes visuels sync',   icon: ImageIcon   },
      { id: 'ai',       label: 'IA Image',     sub: 'Génération',         icon: Sparkles, ai: true },
      { id: 'tpl-liri', label: 'Visuel LIRI',  sub: 'Preset immersion',   icon: FileImage  },
      { id: 'tpl-mk5',  label: 'Infographie',  sub: 'Preset MK5',         icon: FileImage  },
      { id: 'tpl-iso',  label: 'À distance',   sub: 'Preset parcours',    icon: FileImage  },
    ],
    tabs: ['Images', 'IA Generate', 'Mes images'],
  },
  icones: {
    label: 'Icônes',
    items: [
      { id: 'lucide',  label: 'Lucide',    sub: '1200+ icônes',  icon: Star       },
      { id: 'emoji',   label: 'Emoji',     sub: 'Unicode 15',    icon: Sparkles   },
      { id: 'custom',  label: 'Customs',   sub: 'Upload SVG',    icon: UploadCloud },
    ],
    tabs: ['Icônes', 'Suggestions IA', 'Mes icônes'],
  },
  fond: {
    label: 'Fond',
    items: [],  // rendered as custom swatches below
    tabs: ['Couleurs', 'Dégradés', 'Motifs'],
    custom: 'background',
  },
  animes: {
    label: 'Animés',
    items: [
      { id: 'fade-in',    label: 'Fondu',        sub: 'Apparition lente',  shape: '◎' },
      { id: 'slide-left', label: 'Glisser ←',    sub: 'Depuis la droite',  shape: '←' },
      { id: 'zoom-in',    label: 'Zoom avant',   sub: 'Agrandissement',    shape: '⊕' },
      { id: 'bounce',     label: 'Rebond',       sub: 'Entrée dynamique',  shape: '⬇' },
      { id: 'spin',       label: 'Rotation',     sub: 'Tour complet',      shape: '↻' },
      { id: 'html',       label: 'HTML custom',  sub: 'Animations CSS',    icon: Code, ai: false },
      { id: 'ai',         label: 'IA Animation', sub: 'Générer',           icon: Sparkles, ai: true },
    ],
    tabs: ['Presets', 'CSS/HTML', 'Mes animations'],
  },
  modeles: {
    label: 'Modèles',
    items: [
      { id: 'intro',     label: 'Intro de cours',    sub: 'Titre + objectifs',  shape: '📋' },
      { id: 'timeline',  label: 'Timeline',          sub: 'Progression 3 étapes', shape: '→' },
      { id: 'compare',   label: 'Comparaison',       sub: 'Tableau 2 colonnes',  shape: '⚖' },
      { id: 'mindmap',   label: 'Mind map',          sub: 'Carte mentale basique', shape: '🕸' },
      { id: 'quiz',      label: 'Quiz',              sub: 'QCM 4 choix',         shape: '?' },
      { id: 'ai',        label: 'IA Modèle',         sub: 'Générer selon cours',  icon: Sparkles, ai: true },
    ],
    tabs: ['Modèles LIRI', 'Mes modèles', 'Communauté'],
  },
  /* ── Live mode tools ── */
  pointer: {
    label: 'Pointeur',
    items: [
      { id: 'laser',    label: 'Laser',       sub: 'Point rouge',      shape: '●' },
      { id: 'spotlight',label: 'Spotlight',   sub: 'Zone éclairée',    shape: '◎' },
      { id: 'magnify',  label: 'Loupe',       sub: 'Zoom zone',        shape: '🔍' },
    ],
    tabs: ['Pointeur'],
  },
  annotation: {
    label: 'Annotation',
    items: [
      { id: 'pen',      label: 'Stylo',       sub: 'Dessin libre',     shape: '✏' },
      { id: 'marker',   label: 'Marqueur',    sub: 'Surligneur',       shape: '⬛' },
      { id: 'arrow',    label: 'Flèche',      sub: 'Pointer un élément', shape: '→' },
      { id: 'text-ann', label: 'Note rapide', sub: 'Texte temporaire', shape: 'T' },
      { id: 'erase',    label: 'Effacer',     sub: 'Supprimer annotation', icon: Trash2 },
    ],
    tabs: ['Outils', 'Historique'],
  },
  timer: {
    label: 'Minuteur',
    items: [
      { id: '1min',   label: '1 minute',    sub: 'Court',             shape: '①' },
      { id: '3min',   label: '3 minutes',   sub: 'Activité',          shape: '③' },
      { id: '5min',   label: '5 minutes',   sub: 'Exercice',          shape: '⑤' },
      { id: '10min',  label: '10 minutes',  sub: 'Examen court',      shape: '⑩' },
      { id: 'custom', label: 'Personnalisé',sub: 'Choisir durée',     icon: Timer },
    ],
    tabs: ['Minuteur', 'Compte à rebours'],
  },
  /* ── Cinema mode tools ── */
  record: {
    label: 'Enregistrement',
    items: [
      { id: 'start',   label: 'Démarrer',    sub: 'Nouvelle prise',   icon: Disc },
      { id: 'stop',    label: 'Arrêter',     sub: 'Terminer la prise', icon: Pause },
      { id: 'preview', label: 'Prévisualiser', sub: 'Écouter la prise', icon: Play },
    ],
    tabs: ['Enregistrement', 'Prises'],
  },
  script: {
    label: 'Script',
    items: [
      { id: 'import',  label: 'Importer',    sub: 'Texte / DOCX',     icon: UploadCloud },
      { id: 'ai-gen',  label: 'IA Script',   sub: 'Depuis le cours',  icon: Sparkles, ai: true },
      { id: 'timing',  label: 'Minutage',    sub: 'Sync scènes',      icon: Timer },
    ],
    tabs: ['Script', 'Segments IA'],
  },
  /* ── Video mode tools ── */
  segment: {
    label: 'Segment',
    items: [
      { id: 'cut',     label: 'Couper',      sub: 'Diviser ici',      shape: '✂' },
      { id: 'merge',   label: 'Fusionner',   sub: 'Joindre segments', shape: '⊕' },
      { id: 'trim',    label: 'Rogner',      sub: 'Entrée / Sortie',  shape: '◄►' },
    ],
    tabs: ['Segments', 'Timeline'],
  },

  /* ── Document tools ─────────────────────────────────────────────── */
  'doc-titre': {
    label: 'Titre',
    items: [
      { id: 'h1',      label: 'Titre 1',      sub: 'H1 · 36px · Gras',     shape: 'H1' },
      { id: 'h2',      label: 'Titre 2',      sub: 'H2 · 28px',            shape: 'H2' },
      { id: 'h3',      label: 'Titre 3',      sub: 'H3 · 22px',            shape: 'H3' },
      { id: 'h4',      label: 'Titre 4',      sub: 'H4 · 18px · Italique', shape: 'H4' },
      { id: 'ai',      label: 'IA Titre',     sub: 'Suggérer un titre',     icon: Sparkles, ai: true },
    ],
    tabs: ['Styles', 'Suggestions IA'],
  },
  'doc-para': {
    label: 'Paragraphe',
    items: [
      { id: 'corps',   label: 'Corps de texte', sub: '14px · Regular',  shape: 'ΒΤ' },
      { id: 'intro',   label: 'Introduction',   sub: '16px · Semi-bold', shape: '⁋' },
      { id: 'cite',    label: 'Citation',        sub: 'Italic · indenté', shape: '❝' },
      { id: 'note',    label: 'Note de bas',     sub: 'Petit · 10px',     shape: '†' },
      { id: 'ai',      label: 'IA Rédiger',      sub: 'Générer un texte', icon: Sparkles, ai: true },
    ],
    tabs: ['Styles', 'Suggestions IA'],
  },
  'doc-liste': {
    label: 'Liste',
    items: [
      { id: 'bullet',    label: 'À puces',        sub: 'Bullets ronds',   shape: '•' },
      { id: 'numbered',  label: 'Numérotée',      sub: '1. 2. 3.',        shape: '1.' },
      { id: 'checklist', label: 'Cases à cocher', sub: 'Tâches / Todo',   shape: '☑' },
      { id: 'glossary',  label: 'Définitions',    sub: 'Terme · Définition', shape: '◦' },
    ],
    tabs: ['Listes', 'Imbriquées'],
  },
  'doc-image': {
    label: 'Image',
    items: [
      { id: 'upload',   label: 'Importer',       sub: 'PNG / JPG / SVG', icon: UploadCloud },
      { id: 'float-l',  label: 'Flottante gauche', sub: 'Texte entoure', shape: '⬱' },
      { id: 'float-r',  label: 'Flottante droite', sub: 'Texte entoure', shape: '⬲' },
      { id: 'full',     label: 'Pleine largeur',  sub: 'Bannière',       shape: '⬛' },
      { id: 'ai',       label: 'IA Image',        sub: 'Générer',        icon: Sparkles, ai: true },
    ],
    tabs: ['Insertion', 'Habillage'],
  },
  'doc-tableau': {
    label: 'Tableau',
    items: [
      { id: '2x2',   label: '2 × 2',    sub: 'Simple',       shape: '⊞' },
      { id: '3x3',   label: '3 × 3',    sub: 'Standard',     shape: '⊞' },
      { id: '4x4',   label: '4 × 4',    sub: 'Large',        shape: '⊞' },
      { id: 'custom',label: 'Personnalisé', sub: 'Choisir les colonnes', icon: LayoutGrid },
    ],
    tabs: ['Tableaux', 'Styles'],
  },
  'doc-entete': {
    label: 'En-tête / Pied',
    items: [
      { id: 'header',      label: 'En-tête',      sub: 'Haut de page',   shape: '⬆' },
      { id: 'footer',      label: 'Pied de page', sub: 'Bas de page',    shape: '⬇' },
      { id: 'page-num',    label: 'Numéro page',  sub: 'Auto · centré',  shape: '#' },
      { id: 'date',        label: 'Date auto',    sub: 'Mise à jour auto', icon: Timer },
    ],
    tabs: ['En-têtes', 'Pied de page'],
  },
  'doc-hr': {
    label: 'Séparateur',
    items: [
      { id: 'hr-thin',  label: 'Fin',       sub: '1px · centré',    shape: '─' },
      { id: 'hr-thick', label: 'Épais',     sub: '3px · plein',     shape: '━' },
      { id: 'hr-dot',   label: 'Pointillé', sub: 'Dashes',           shape: '···' },
      { id: 'hr-deco',  label: 'Décoratif', sub: 'Avec ornement',   shape: '⸻' },
    ],
    tabs: ['Séparateurs'],
  },
  'doc-page': {
    label: 'Page',
    items: [
      { id: 'add',       label: 'Nouvelle page',    sub: 'Vierge',           icon: Plus   },
      { id: 'break',     label: 'Saut de page',     sub: 'Forcé ici',        shape: '↵'   },
      { id: 'section',   label: 'Nouvelle section', sub: 'Avec titre',       icon: BookOpen },
      { id: 'duplicate', label: 'Dupliquer',        sub: 'Copier la page',   icon: Layers },
    ],
    tabs: ['Pages', 'Structure'],
  },

  /* ── Presentation tools ──────────────────────────────────────────── */
  'slide-titre': {
    label: 'Titre diapo',
    items: [
      { id: 'title',    label: 'Titre principal',  sub: 'Grande taille',  shape: 'T'  },
      { id: 'subtitle', label: 'Sous-titre',       sub: 'Ligne de texte', shape: 'T₂' },
      { id: 'section',  label: 'Titre de section', sub: 'Séparateur',     shape: 'S'  },
      { id: 'ai',       label: 'IA Titre',         sub: 'Suggérer',       icon: Sparkles, ai: true },
    ],
    tabs: ['Styles'],
  },
  'slide-texte': {
    label: 'Zone de texte',
    items: [
      { id: 'body',   label: 'Corps',       sub: 'Texte principal',  shape: 'ΒΤ' },
      { id: 'bullet', label: 'Liste',       sub: 'Points / puces',   shape: '•'  },
      { id: 'quote',  label: 'Citation',    sub: 'Mise en avant',    shape: '❝'  },
      { id: 'note',   label: 'Note',        sub: 'Commentaire',      shape: '†'  },
    ],
    tabs: ['Styles'],
  },
  'slide-media': {
    label: 'Média',
    items: [
      { id: 'image',  label: 'Image',   sub: 'PNG / JPG / SVG',   icon: ImageIcon   },
      { id: 'video',  label: 'Vidéo',   sub: 'MP4 / embed',       icon: Film        },
      { id: 'icone',  label: 'Icône',   sub: 'Bibliothèque LIRI', icon: Star        },
      { id: 'chart',  label: 'Graphe',  sub: 'Bar / Pie / Line',  icon: LayoutGrid  },
      { id: 'ai',     label: 'IA Image',sub: 'Générer',           icon: Sparkles, ai: true },
    ],
    tabs: ['Médias', 'Bibliothèque'],
  },
  'slide-forme': {
    label: 'Forme',
    items: [
      { id: 'rect',      label: 'Rectangle', sub: '', shape: '□' },
      { id: 'circle',    label: 'Cercle',    sub: '', shape: '○' },
      { id: 'triangle',  label: 'Triangle',  sub: '', shape: '△' },
      { id: 'arrow',     label: 'Flèche',    sub: '', shape: '→' },
      { id: 'callout',   label: 'Bulle',     sub: 'Dialogue', shape: '💬' },
    ],
    tabs: ['Formes'],
  },
  'slide-layout': {
    label: 'Disposition',
    items: [
      { id: 'blank',     label: 'Vierge',           sub: '', shape: '□'  },
      { id: 'title-only',label: 'Titre seul',       sub: '', shape: 'T'  },
      { id: 'two-col',   label: '2 colonnes',       sub: '', shape: '⬲'  },
      { id: 'media-txt', label: 'Média + texte',    sub: '', shape: '⊞'  },
      { id: 'full-img',  label: 'Image plein écran',sub: '', shape: '⬛'  },
    ],
    tabs: ['Dispositions'],
  },
  'slide-anim': {
    label: 'Animation',
    items: [
      { id: 'fade',   label: 'Fondu',    sub: 'Entrée douce',      shape: '◌' },
      { id: 'slide',  label: 'Glisser',  sub: 'Depuis la gauche',  shape: '→' },
      { id: 'zoom',   label: 'Zoom',     sub: 'Agrandir à l\'entrée', shape: '⊕' },
      { id: 'bounce', label: 'Rebond',   sub: 'Effet dynamique',   shape: '↕' },
    ],
    tabs: ['Transitions', 'Animations'],
  },
  'slide-modele': {
    label: 'Modèle',
    items: [
      { id: 'pro',       label: 'Professionnel', sub: 'Sobre et élégant', shape: '◼' },
      { id: 'edu',       label: 'Pédagogique',   sub: 'Pour la classe',   shape: '📚' },
      { id: 'creative',  label: 'Créatif',       sub: 'Coloré et moderne',shape: '✦' },
      { id: 'dark',      label: 'Dark',          sub: 'Fond sombre',      shape: '◾' },
    ],
    tabs: ['Modèles', 'Mes modèles'],
  },
};
const FALLBACK_CONTENT = { label: 'Outil', items: [], tabs: ['Éléments'] };

/* ════════════════════════════════════════════════════════════════════
   ELEMENT CONTEXT PANEL — s'affiche quand un élément est sélectionné
   Remplace le panneau outil tant qu'une sélection est active.
════════════════════════════════════════════════════════════════════ */
const ELEMENT_META = {
  text:      { label: 'Texte',           accent: 'cyan',    icon: Type        },
  rect:      { label: 'Rectangle',       accent: 'violet',  icon: Square      },
  circle:    { label: 'Cercle',          accent: 'violet',  icon: Circle      },
  ellipse:   { label: 'Ellipse',         accent: 'violet',  icon: Circle      },
  triangle:  { label: 'Triangle',        accent: 'violet',  icon: Square      },
  diamond:   { label: 'Losange',         accent: 'violet',  icon: Square      },
  starshape: { label: 'Étoile',          accent: 'amber',   icon: Star        },
  image:     { label: 'Image',           accent: 'emerald', icon: ImageIcon   },
  icon:      { label: 'Icône',           accent: 'amber',   icon: Star        },
  line:      { label: 'Ligne',           accent: 'teal',    icon: Minus       },
  arrow:     { label: 'Flèche',          accent: 'teal',    icon: ArrowRight  },
  html:      { label: 'HTML interactif', accent: 'blue',    icon: Code        },
  video:     { label: 'Vidéo',           accent: 'amber',   icon: Film        },
};

function ElementPanel({ obj, onClose }) {
  const updateObject  = useSmartboardKonvaStore(s => s.updateObject);
  const selectOnly    = useSmartboardKonvaStore(s => s.selectOnly);
  const meta          = ELEMENT_META[obj.type] ?? { label: 'Élément', accent: 'cyan', icon: Square };
  const a             = ACCENT[meta.accent] ?? ACCENT.cyan;
  const MetaIcon      = meta.icon;

  const updateStyle   = (sp) => updateObject(obj.id, { style: sp });
  /* Fermer = désélectionner le canvas + fermer le panneau */
  const handleClose   = () => { selectOnly(null); onClose(); };

  const isText  = obj.type === 'text';
  const isShape = ['rect','circle','ellipse','triangle','diamond','starshape'].includes(obj.type);
  const isImage = obj.type === 'image';
  const isLine  = ['line','arrow'].includes(obj.type);

  /* ── micro-composants internes ── */
  const SecTitle = ({ children }) => (
    <p className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-white/22">{children}</p>
  );
  const AiBtn = ({ label, sub }) => (
    <button type="button" className="flex w-full items-center gap-2.5 rounded-xl border border-violet-500/15 bg-violet-500/[0.06] px-2.5 py-2 text-left transition-all hover:border-violet-500/25">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-violet-300">{label}</p>
        {sub && <p className="truncate text-[9px] text-white/30">{sub}</p>}
      </div>
    </button>
  );
  const ColorSwatch = ({ value, onChange, title }) => (
    <label title={title} className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/15 transition-colors hover:border-white/30">
      <div className="absolute inset-0" style={{ background: toHex(String(value || '#888')) }} />
      <input type="color" value={toHex(String(value || '#888'))} onChange={e => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
  );
  const NumInput = ({ value, onChange, min, max, step = 1, suffix = 'px', w = 'w-8' }) => (
    <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1">
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={cn(w, 'bg-transparent text-center text-[11px] text-white/70 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none')} />
      <span className="text-[9px] text-white/25">{suffix}</span>
    </div>
  );

  return (
    <motion.aside
      key={'el-' + obj.id + '-' + obj.type}
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: isText ? 230 : 210, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex flex-shrink-0 flex-col overflow-hidden border-r border-white/[0.07]"
      style={{ background: '#13121e' }}
    >
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-lg border', a.bg, a.border)}>
          <MetaIcon className={cn('h-3.5 w-3.5', a.text)} />
        </span>
        <span className={cn('text-[12px] font-semibold', a.text)}>{meta.label}</span>
        <div className="flex-1" />
        <button type="button" onClick={handleClose}
          title="Désélectionner et fermer"
          className="flex h-5 w-5 items-center justify-center rounded-md text-white/30 transition-colors hover:text-white/60">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Contenu scrollable ── */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none]">

        {/* ════════ TEXTE — Panneau complet ════════ */}
        {isText && (
          <>
            {/* ── Styles rapides ─────────────────── */}
            <SecTitle>Styles rapides</SecTitle>
            <div className="flex flex-wrap gap-1 px-3 pb-1">
              {[
                { lbl: 'H1',  style: { fontSize: 48, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.5 } },
                { lbl: 'H2',  style: { fontSize: 36, fontWeight: 700, lineHeight: 1.2  } },
                { lbl: 'H3',  style: { fontSize: 28, fontWeight: 600, lineHeight: 1.25 } },
                { lbl: 'H4',  style: { fontSize: 22, fontWeight: 600, lineHeight: 1.3  } },
                { lbl: 'S',   style: { fontSize: 20, fontWeight: 400, lineHeight: 1.4,  fill: '#c4bfd4' } },
                { lbl: 'ΒΤ',  style: { fontSize: 16, fontWeight: 400, lineHeight: 1.65 } },
                { lbl: 'ab',  style: { fontSize: 12, fontWeight: 400, lineHeight: 1.5,  fill: '#8892aa' } },
                { lbl: '❝',   style: { fontSize: 16, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.7, fill: '#c4bfd4' } },
              ].map(p => (
                <button key={p.lbl} type="button" onClick={() => updateStyle(p.style)}
                  className="flex h-7 min-w-[30px] items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[10px] font-bold text-white/45 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300">
                  {p.lbl}
                </button>
              ))}
            </div>

            {/* ── Police ──────────────────────────── */}
            <SecTitle>Police</SecTitle>
            <div className="px-3">
              <div className="relative">
                <select
                  value={obj.style?.fontFamily?.split(',')[0]?.trim() ?? 'Inter'}
                  onChange={e => {
                    const fam = e.target.value;
                    if (!['Inter', 'Georgia', 'Courier New'].includes(fam)) {
                      const lid = `gfont-${fam.replace(/\s+/g, '')}`;
                      if (!document.getElementById(lid)) {
                        const lk = document.createElement('link');
                        lk.id = lid; lk.rel = 'stylesheet';
                        lk.href = `https://fonts.googleapis.com/css2?family=${fam.replace(/ /g, '+')}:wght@300;400;500;600;700;800&display=swap`;
                        document.head.appendChild(lk);
                      }
                    }
                    updateStyle({ fontFamily: `${fam}, system-ui, sans-serif` });
                  }}
                  className="w-full appearance-none rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-2.5 pr-7 text-[11px] text-white/70 focus:border-cyan-500/30 focus:outline-none"
                >
                  {TEXT_FONTS.map(f => (
                    <option key={f.value} value={f.value}>{f.label} — {f.category}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
              </div>
            </div>

            {/* ── Taille + Graisse ─────────────────── */}
            <SecTitle>Taille &amp; Graisse</SecTitle>
            <div className="flex items-center gap-2 px-3">
              <NumInput value={obj.style?.fontSize ?? 16} onChange={v => updateStyle({ fontSize: Math.max(6, v) })} min={6} max={300} w="w-10" />
              <div className="relative flex-1">
                <select
                  value={obj.style?.fontWeight ?? 400}
                  onChange={e => updateStyle({ fontWeight: Number(e.target.value) })}
                  className="w-full appearance-none rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-2 pr-6 text-[10px] text-white/70 focus:border-cyan-500/30 focus:outline-none"
                >
                  {[
                    [100, '100 · Fin'],
                    [300, '300 · Léger'],
                    [400, '400 · Normal'],
                    [500, '500 · Medium'],
                    [600, '600 · Semi'],
                    [700, '700 · Gras'],
                    [800, '800 · Extra'],
                    [900, '900 · Black'],
                  ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
              </div>
            </div>

            {/* ── Formatage + Couleur ───────────────── */}
            <SecTitle>Formatage</SecTitle>
            <div className="flex flex-col gap-1.5 px-3">
              <div className="flex items-center gap-1">
                {/* B — toggle 400↔700 */}
                <button type="button" title="Gras"
                  onClick={() => updateStyle({ fontWeight: (obj.style?.fontWeight ?? 400) >= 700 ? 400 : 700 })}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg border text-[13px] font-black transition-all',
                    (obj.style?.fontWeight ?? 400) >= 700
                      ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300')}>
                  B
                </button>
                {/* I */}
                <button type="button" title="Italique"
                  onClick={() => updateStyle({ fontStyle: obj.style?.fontStyle === 'italic' ? 'normal' : 'italic' })}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg border text-[12px] font-bold italic transition-all',
                    obj.style?.fontStyle === 'italic'
                      ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300')}>
                  I
                </button>
                {/* U */}
                <button type="button" title="Souligné"
                  onClick={() => updateStyle({ textDecoration: obj.style?.textDecoration === 'underline' ? '' : 'underline' })}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg border text-[12px] font-bold underline transition-all',
                    obj.style?.textDecoration === 'underline'
                      ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300')}>
                  U
                </button>
                {/* S */}
                <button type="button" title="Barré"
                  onClick={() => updateStyle({ textDecoration: obj.style?.textDecoration === 'line-through' ? '' : 'line-through' })}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg border text-[12px] font-bold line-through transition-all',
                    obj.style?.textDecoration === 'line-through'
                      ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300')}>
                  S
                </button>
                <div className="flex-1" />
                <ColorSwatch value={obj.style?.fill ?? '#F7F2E8'} onChange={v => updateStyle({ fill: v })} title="Couleur du texte" />
              </div>

              {/* Alignement */}
              <div className="flex items-center gap-1">
                {[
                  { id: 'left',    Icon: AlignLeft,          title: 'Gauche'   },
                  { id: 'center',  Icon: AlignCenter,        title: 'Centre'   },
                  { id: 'right',   Icon: AlignRight,         title: 'Droite'   },
                  { id: 'justify', Icon: SlidersHorizontal,  title: 'Justifié' },
                ].map(al => (
                  <button key={al.id} type="button" title={al.title}
                    onClick={() => updateStyle({ align: al.id })}
                    className={cn('flex h-8 w-8 items-center justify-center rounded-lg border transition-all',
                      obj.style?.align === al.id
                        ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
                        : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70')}>
                    <al.Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* ── Espacement ───────────────────────── */}
            <SecTitle>Espacement</SecTitle>
            <div className="flex flex-col gap-3 px-3">
              {[
                { key: 'lineHeight',    label: 'Interligne',       min: 0.8, max: 3.0, step: 0.05, val: obj.style?.lineHeight    ?? 1.25, fmt: v => v.toFixed(2) },
                { key: 'letterSpacing', label: 'Espacement lettres', min: -4,  max: 20,  step: 0.5,  val: obj.style?.letterSpacing ?? 0,    fmt: v => v.toFixed(1) },
              ].map(sp => (
                <div key={sp.key}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-white/45">{sp.label}</span>
                    <span className="text-[10px] font-mono text-white/35">{sp.fmt(sp.val)}</span>
                  </div>
                  <input type="range" min={sp.min} max={sp.max} step={sp.step}
                    value={sp.val}
                    onChange={e => updateStyle({ [sp.key]: Number(e.target.value) })}
                    className="h-1 w-full appearance-none rounded-full bg-white/10 accent-cyan-400" />
                </div>
              ))}
            </div>

            {/* ── Ombre texte ──────────────────────── */}
            <SecTitle>Ombre</SecTitle>
            <div className="flex flex-col gap-2 px-3">
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => updateStyle(obj.style?.shadowColor
                    ? { shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, shadowOpacity: 0 }
                    : { shadowColor: '#000000', shadowBlur: 8, shadowOffsetX: 2, shadowOffsetY: 3, shadowOpacity: 0.45 })}
                  className={cn('flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[10px] font-medium transition-all',
                    obj.style?.shadowColor
                      ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70')}>
                  {obj.style?.shadowColor ? '● Activée' : '○ Activer'}
                </button>
                {obj.style?.shadowColor && (
                  <ColorSwatch value={obj.style.shadowColor} onChange={v => updateStyle({ shadowColor: v })} title="Couleur de l'ombre" />
                )}
              </div>
              {obj.style?.shadowColor && (
                <div className="space-y-2.5">
                  {[
                    { key: 'shadowBlur',    label: 'Flou',     min: 0,   max: 40, step: 1, val: obj.style?.shadowBlur    ?? 8 },
                    { key: 'shadowOffsetX', label: 'Décal. X', min: -20, max: 20, step: 1, val: obj.style?.shadowOffsetX ?? 2 },
                    { key: 'shadowOffsetY', label: 'Décal. Y', min: -20, max: 20, step: 1, val: obj.style?.shadowOffsetY ?? 3 },
                  ].map(s => (
                    <div key={s.key}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] text-white/45">{s.label}</span>
                        <span className="text-[10px] font-mono text-white/35">{s.val}</span>
                      </div>
                      <input type="range" min={s.min} max={s.max} step={s.step} value={s.val}
                        onChange={e => updateStyle({ [s.key]: Number(e.target.value) })}
                        className="h-1 w-full appearance-none rounded-full bg-white/10 accent-cyan-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Contour texte ────────────────────── */}
            <SecTitle>Contour texte</SecTitle>
            <div className="flex items-center gap-2 px-3">
              <ColorSwatch value={obj.style?.textStroke ?? '#000000'} onChange={v => updateStyle({ textStroke: v })} title="Couleur du contour" />
              <span className="text-[10px] text-white/35">Épaisseur</span>
              <div className="flex-1" />
              <NumInput value={obj.style?.textStrokeWidth ?? 0} onChange={v => updateStyle({ textStrokeWidth: v })} min={0} max={20} />
            </div>

            {/* ── IA LONGIA ────────────────────────── */}
            <SecTitle>IA LONGIA</SecTitle>
            <div className="flex flex-col gap-1.5 px-3 pb-3">
              <AiBtn label="Reformuler" sub="Réécriture naturelle" />
              <AiBtn label="Améliorer" sub="Style et clarté" />
              <AiBtn label="Résumer" sub="Version plus courte" />
              <AiBtn label="Développer" sub="Enrichir le contenu" />
              <AiBtn label="Simplifier" sub="Langage accessible" />
              <AiBtn label="Traduire" sub="Multilingue — FR · EN · AR…" />
            </div>
          </>
        )}

        {/* ────── FORMES ────── */}
        {isShape && (
          <>
            <SecTitle>Remplissage</SecTitle>
            <div className="flex items-center gap-2 px-3">
              <ColorSwatch value={obj.style?.fill} onChange={v => updateStyle({ fill: v })} title="Couleur de fond" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-white/50">Couleur</p>
                <p className="truncate font-mono text-[10px] text-white/30">{toHex(String(obj.style?.fill || '#7c3aed'))}</p>
              </div>
              <button type="button" title="Aucun remplissage" onClick={() => updateStyle({ fill: 'transparent' })}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-[10px] text-white/30 transition-all hover:border-white/20 hover:text-white/60">
                ∅
              </button>
            </div>

            <SecTitle>Contour</SecTitle>
            <div className="flex items-center gap-2 px-3">
              <ColorSwatch value={obj.style?.stroke} onChange={v => updateStyle({ stroke: v })} title="Couleur du contour" />
              <div className="flex-1" />
              <NumInput value={obj.style?.strokeWidth ?? 0} onChange={v => updateStyle({ strokeWidth: v })} min={0} max={40} />
            </div>

            {obj.type === 'rect' && (
              <>
                <SecTitle>Coins arrondis</SecTitle>
                <div className="flex items-center gap-2 px-3">
                  <input type="range" min={0} max={80} step={1}
                    value={obj.style?.cornerRadius ?? 0}
                    onChange={e => updateStyle({ cornerRadius: Number(e.target.value) })}
                    className="h-1 flex-1 appearance-none rounded-full bg-white/10 accent-violet-400" />
                  <span className="w-9 text-right text-[10px] text-white/40">{obj.style?.cornerRadius ?? 0}px</span>
                </div>
              </>
            )}

            <SecTitle>IA LONGIA</SecTitle>
            <div className="flex flex-col gap-1.5 px-3 pb-3">
              <AiBtn label="Palette harmonieuse" sub="Couleurs recommandées" />
              <AiBtn label="Style graphique" sub="Appliquer un thème" />
            </div>
          </>
        )}

        {/* ────── IMAGE ────── */}
        {isImage && (
          <>
            <SecTitle>Ajustements</SecTitle>
            <div className="flex flex-col gap-2.5 px-3">
              {[
                { key: 'brightness', label: 'Luminosité', val: obj.style?.brightness ?? 1 },
                { key: 'contrast',   label: 'Contraste',  val: obj.style?.contrast   ?? 1 },
                { key: 'saturation', label: 'Saturation', val: obj.style?.saturation ?? 1 },
              ].map(adj => (
                <div key={adj.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] text-white/45">{adj.label}</span>
                    <span className="text-[10px] text-white/30">{Math.round(adj.val * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={2} step={0.05} value={adj.val}
                    onChange={e => updateStyle({ [adj.key]: Number(e.target.value) })}
                    className="h-1 w-full appearance-none rounded-full bg-white/10 accent-emerald-400" />
                </div>
              ))}
            </div>

            <SecTitle>Transformation</SecTitle>
            <div className="flex items-center gap-2 px-3">
              <button type="button" onClick={() => updateStyle({ flipX: !obj.style?.flipX })}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/45 transition-all hover:text-white/70">
                <FlipHorizontal2 className="h-3.5 w-3.5" />Miroir H
              </button>
              <button type="button" onClick={() => updateStyle({ flipY: !obj.style?.flipY })}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/45 transition-all hover:text-white/70">
                <FlipVertical2 className="h-3.5 w-3.5" />Miroir V
              </button>
            </div>

            <SecTitle>IA LONGIA</SecTitle>
            <div className="flex flex-col gap-1.5 px-3 pb-3">
              <AiBtn label="Supprimer le fond" sub="Détourage automatique" />
              <AiBtn label="Améliorer l'image" sub="Qualité IA" />
              <AiBtn label="Générer variante" sub="Variation créative" />
            </div>
          </>
        )}

        {/* ────── LIGNE / FLÈCHE ────── */}
        {isLine && (
          <>
            <SecTitle>Trait</SecTitle>
            <div className="flex items-center gap-2 px-3">
              <ColorSwatch value={obj.style?.stroke} onChange={v => updateStyle({ stroke: v })} title="Couleur du trait" />
              <div className="flex-1" />
              <NumInput value={obj.style?.strokeWidth ?? 2} onChange={v => updateStyle({ strokeWidth: v })} min={1} max={40} />
            </div>
            {obj.type === 'arrow' && (
              <>
                <SecTitle>Tête de flèche</SecTitle>
                <div className="flex items-center gap-2 px-3">
                  <NumInput value={obj.style?.pointerLength ?? 10} onChange={v => updateStyle({ pointerLength: v })} min={4} max={40} suffix="L" />
                  <NumInput value={obj.style?.pointerWidth  ?? 10} onChange={v => updateStyle({ pointerWidth:  v })} min={4} max={40} suffix="W" />
                </div>
              </>
            )}
          </>
        )}

        {/* ────── GÉNÉRIQUE (icon, html, etc.) ────── */}
        {!isText && !isShape && !isImage && !isLine && (
          <>
            <SecTitle>Propriétés</SecTitle>
            <p className="px-3 pb-2 text-[10px] text-white/30">
              Utilisez la barre de propriétés en haut pour modifier cet élément.
            </p>
            <SecTitle>IA LONGIA</SecTitle>
            <div className="flex flex-col gap-1.5 px-3 pb-3">
              <AiBtn label="Optimiser" sub="Suggestions LONGIA" />
              <AiBtn label="Variante créative" sub="Générer une alternative" />
            </div>
          </>
        )}

        {/* ────── OPACITÉ (tous types) ────── */}
        <div className="px-3 pb-4 pt-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/22">Opacité</span>
            <span className="text-[10px] text-white/30">{Math.round((obj.style?.opacity ?? 1) * 100)}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.01}
            value={obj.style?.opacity ?? 1}
            onChange={e => updateStyle({ opacity: Number(e.target.value) })}
            className="h-1 w-full appearance-none rounded-full bg-white/10 accent-white" />
        </div>
      </div>
    </motion.aside>
  );
}

/* ══════════════════════════════════════════════════════════════
   FORMES VECTOR PANEL — Suite complète type Illustrator
══════════════════════════════════════════════════════════════ */

/* ── Formes de base ── */
const FV_SHAPES = [
  { id: 'rect',      label: 'Rectangle',    shortcut: 'R', shape: '□' },
  { id: 'roundrect', label: 'Rect. arrondi', shortcut: '',  shape: '▢' },
  { id: 'circle',    label: 'Cercle',        shortcut: 'C', shape: '○' },
  { id: 'ellipse',   label: 'Ellipse',       shortcut: '',  shape: '⬭' },
  { id: 'triangle',  label: 'Triangle',      shortcut: '',  shape: '△' },
  { id: 'diamond',   label: 'Losange',       shortcut: '',  shape: '◇' },
  { id: 'pentagon',  label: 'Pentagone',     shortcut: '',  shape: '⬠' },
  { id: 'hexagon',   label: 'Hexagone',      shortcut: '',  shape: '⬡' },
  { id: 'starshape', label: 'Étoile 5br.',   shortcut: '',  shape: '★' },
  { id: 'star6',     label: 'Étoile 6br.',   shortcut: '',  shape: '✦' },
  { id: 'line',      label: 'Ligne',         shortcut: 'L', shape: '─' },
  { id: 'arrow',     label: 'Flèche',        shortcut: '',  shape: '→' },
];

/* ── Outils de tracé / plume ── */
const FV_PEN = [
  { id: 'pen',        label: 'Plume',           sub: 'Tracé Bézier', icon: PenTool,       shortcut: 'P' },
  { id: 'penAdd',     label: 'Ajouter ancre',    sub: 'Nouvel ancrage', icon: Plus,        shortcut: '+' },
  { id: 'penRemove',  label: 'Suppr. ancre',     sub: 'Ôter un point', icon: Minus,        shortcut: '−' },
  { id: 'penConvert', label: 'Convertir point',  sub: 'Coin ↔ Courbe', icon: RefreshCw,    shortcut: 'A' },
  { id: 'pencil',     label: 'Crayon',           sub: 'Tracé libre',   icon: Pencil,       shortcut: 'N' },
  { id: 'eraser',     label: 'Gomme',            sub: 'Effacer tracé', icon: Eraser,       shortcut: 'E' },
];

/* ── Sélection directe ── */
const FV_SELECT = [
  { id: 'directSelect', label: 'Sélection directe', sub: 'Modifier les nœuds', icon: MousePointer2, shortcut: 'A' },
];

/* ── Opérations booléennes ── */
const FV_BOOLEAN = [
  { id: 'unite',     label: 'Unir',         sub: 'Fusionner',           glyph: '⊕', color: 'emerald', needs: 2 },
  { id: 'subtract',  label: 'Soustraire',   sub: 'Retrancher le dessus', glyph: '⊖', color: 'rose',    needs: 2 },
  { id: 'intersect', label: 'Intersecter',  sub: 'Zone commune',         glyph: '⊗', color: 'blue',    needs: 2 },
  { id: 'exclude',   label: 'Exclure',      sub: 'XOR — zone non comm.', glyph: '⊞', color: 'violet',  needs: 2 },
  { id: 'divide',    label: 'Diviser',      sub: 'Couper aux intersect.', glyph: '⊟', color: 'amber',   needs: 1 },
];

/* ── Organisation ── */
const FV_ORGANIZE = [
  { id: 'group',       label: 'Grouper',          sub: 'Ctrl+G',       icon: Layers,        needs: 2 },
  { id: 'ungroup',     label: 'Dégrouper',        sub: 'Ctrl+Shift+G', icon: Layers,        needs: 1 },
  { id: 'subdivide',   label: 'Subdiviser',       sub: 'Couper en 4',  icon: LayoutGrid,    needs: 1 },
  { id: 'decompose',   label: 'Décomposer',       sub: 'Séparer chemins', icon: GitBranch,  needs: 1 },
  { id: 'clipMask',    label: 'Masque découp.',   sub: 'Ctrl+7',       icon: Scissors,      needs: 2 },
  { id: 'releaseClip', label: 'Libérer masque',   sub: 'Ôter le masque', icon: Unlock,     needs: 1 },
];

const FV_BOOL_COLORS = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
  rose:    'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
  blue:    'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20',
  violet:  'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20',
  amber:   'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
};
const FV_BOOL_COLORS_DISABLED = 'border-white/[0.06] bg-white/[0.02] text-white/20 cursor-not-allowed';

function FormesVectorPanel({ onClose }) {
  const addObject        = useSmartboardKonvaStore(s => s.addObject);
  const activeVectorTool = useSmartboardKonvaStore(s => s.activeVectorTool);
  const setVectorTool    = useSmartboardKonvaStore(s => s.setVectorTool);
  const clearVectorTool  = useSmartboardKonvaStore(s => s.clearVectorTool);
  const selectedIds      = useSmartboardKonvaStore(s => s.selectedIds);
  const scenes           = useSmartboardKonvaStore(s => s.project?.scenes ?? []);
  const activeSceneId    = useSmartboardKonvaStore(s => s.project?.activeSceneId);
  const groupSelected    = useSmartboardKonvaStore(s => s.groupSelected);
  const ungroupSelected  = useSmartboardKonvaStore(s => s.ungroupSelected);
  const uniteSelected    = useSmartboardKonvaStore(s => s.uniteSelected);
  const subtractSelected = useSmartboardKonvaStore(s => s.subtractSelected);
  const intersectSelected = useSmartboardKonvaStore(s => s.intersectSelected);
  const subdivideSelected = useSmartboardKonvaStore(s => s.subdivideSelected);
  const addLongiaMessage = useSmartboardKonvaStore(s => s.addLongiaMessage);

  const selCount = selectedIds.length;
  const activeSceneObjs = scenes.find(s => s.id === activeSceneId)?.objects ?? [];
  const selObj = activeSceneObjs.find(o => o.id === selectedIds[0]) ?? null;

  /* ── Ajout d'une forme ── */
  const handleShape = (id) => {
    const base = { x: 100 + Math.random() * 80, y: 100 + Math.random() * 60, style: { fill: 'rgba(139,92,246,0.28)', stroke: '#7c3aed', strokeWidth: 2 } };
    switch (id) {
      case 'roundrect': addObject({ ...base, type: 'rect', width: 160, height: 120, style: { ...base.style, cornerRadius: 20 } }); break;
      case 'circle':    addObject({ ...base, type: 'circle', width: 120, height: 120 }); break;
      case 'ellipse':   addObject({ ...base, type: 'ellipse', width: 180, height: 110 }); break;
      case 'triangle':  addObject({ ...base, type: 'triangle', width: 140, height: 140 }); break;
      case 'diamond':   addObject({ ...base, type: 'diamond', width: 130, height: 150 }); break;
      case 'pentagon':  addObject({ ...base, type: 'starshape', width: 130, height: 130, content: { numPoints: 5, innerRadius: 52, outerRadius: 64 } }); break;
      case 'hexagon':   addObject({ ...base, type: 'starshape', width: 130, height: 130, content: { numPoints: 6, innerRadius: 56, outerRadius: 64 } }); break;
      case 'starshape': addObject({ ...base, type: 'starshape', width: 130, height: 130, content: { numPoints: 5, innerRadius: 28, outerRadius: 64 } }); break;
      case 'star6':     addObject({ ...base, type: 'starshape', width: 130, height: 130, content: { numPoints: 6, innerRadius: 32, outerRadius: 64 } }); break;
      case 'line':      addObject({ type: 'line', x: 80, y: 200, width: 200, height: 4, content: { points: [0,0,200,0] }, style: { stroke: '#94a3b8', strokeWidth: 3 } }); break;
      case 'arrow':     addObject({ type: 'arrow', x: 80, y: 200, width: 200, height: 4, content: { points: [0,0,200,0] }, style: { stroke: '#94a3b8', fill: '#94a3b8', strokeWidth: 3, pointerLength: 10, pointerWidth: 10 } }); break;
      default:          addObject({ ...base, type: 'rect', width: 160, height: 130, style: { ...base.style, cornerRadius: 0 } });
    }
  };

  /* ── Activation d'un outil de tracé ── */
  const handlePen = (id) => {
    if (activeVectorTool === id) { clearVectorTool(); return; }
    setVectorTool(id);
    const labels = { pen: 'Plume (Bézier)', penAdd: 'Ajout d\'ancre', penRemove: 'Suppression d\'ancre', penConvert: 'Conversion de point', pencil: 'Crayon libre', eraser: 'Gomme' };
    addLongiaMessage({ role: 'ai', text: `✦ Outil ${labels[id] ?? id} activé — cliquez sur le canvas pour tracer. (Support complet en cours d'intégration canvas)` });
  };

  /* ── Opérations booléennes ── */
  const handleBoolean = (id) => {
    if (id === 'unite')    { if (selCount >= 2) { uniteSelected(); addLongiaMessage({ role: 'ai', text: '✦ Formes unies en une seule bounding-box.' }); } return; }
    if (id === 'subtract') { if (selCount >= 2) { subtractSelected(); addLongiaMessage({ role: 'ai', text: '✦ Forme supérieure soustraite.' }); } return; }
    if (id === 'intersect'){ if (selCount >= 2) { intersectSelected(); addLongiaMessage({ role: 'ai', text: '✦ Intersection créée à la zone commune.' }); } return; }
    if (id === 'exclude')  { addLongiaMessage({ role: 'ai', text: 'Opération Exclure (XOR) — à venir : nécessite un moteur de clip vectoriel.' }); return; }
    if (id === 'divide')   { if (selCount >= 1) { subdivideSelected(); addLongiaMessage({ role: 'ai', text: '✦ Forme divisée en 4 quadrants.' }); } return; }
  };

  /* ── Organisation ── */
  const handleOrganize = (id) => {
    if (id === 'group')       { if (selCount >= 2) { groupSelected(); addLongiaMessage({ role: 'ai', text: `✦ ${selCount} éléments groupés.` }); } return; }
    if (id === 'ungroup')     { if (selCount >= 1) { ungroupSelected(); addLongiaMessage({ role: 'ai', text: '✦ Groupe dissous.' }); } return; }
    if (id === 'subdivide')   { if (selCount >= 1) { subdivideSelected(); addLongiaMessage({ role: 'ai', text: '✦ Forme subdivisée en 4 parties égales.' }); } return; }
    if (id === 'decompose')   { addLongiaMessage({ role: 'ai', text: 'Décomposer : convertit un objet groupé en sous-chemins indépendants. (À venir)' }); return; }
    if (id === 'clipMask')    { addLongiaMessage({ role: 'ai', text: 'Masque de découpage : la forme du dessus masque celle du dessous. (À venir — nécessite moteur de clipping)' }); return; }
    if (id === 'releaseClip') { addLongiaMessage({ role: 'ai', text: 'Libérer le masque : restaure les formes d\'origine. (À venir)' }); return; }
  };

  /* ── Micro-composant : titre de section ── */
  const SecHead = ({ icon: Icon, label, color = 'text-white/30' }) => (
    <div className={cn('mx-3 mt-3 mb-1.5 flex items-center gap-1.5', color)}>
      {Icon && <Icon className="h-2.5 w-2.5" />}
      <span className="text-[8.5px] font-bold uppercase tracking-widest">{label}</span>
    </div>
  );

  return (
    <motion.aside
      key="formes-vector"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 244, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex flex-shrink-0 flex-col border-r border-white/[0.07] overflow-hidden"
      style={{ background: '#13121e' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5 shrink-0">
        <Hexagon className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-[12px] font-semibold text-violet-300">Formes & Vecteur</span>
        {activeVectorTool && (
          <span className="ml-1 rounded-md border border-violet-500/25 bg-violet-500/15 px-1.5 py-0.5 text-[8px] font-bold text-violet-300 uppercase tracking-wide">
            {activeVectorTool}
          </span>
        )}
        <div className="flex-1" />
        <button onClick={() => { clearVectorTool(); onClose(); }} title="Fermer"
          className="h-5 w-5 flex items-center justify-center rounded-md text-white/30 hover:text-white/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Sélection active — badge ── */}
      {selCount > 0 && (
        <div className="mx-3 mt-2 flex items-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-2.5 py-1.5 shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_5px_rgba(167,139,250,0.8)]" />
          <span className="text-[10px] text-violet-300/80 font-medium">{selCount} sélectionné{selCount > 1 ? 's' : ''}</span>
          {selObj && <span className="ml-1 text-[9px] text-violet-400/60">· {ELEMENT_META[selObj.type]?.label}</span>}
        </div>
      )}
      <p className="mx-3 mt-2 text-[9px] leading-snug text-white/35 shrink-0">
        Astuce : <kbd className="rounded border border-white/10 bg-white/[0.05] px-1 font-mono text-[8px]">⇧</kbd> ou{' '}
        <kbd className="rounded border border-white/10 bg-white/[0.05] px-1 font-mono text-[8px]">⌘</kbd> /{' '}
        <kbd className="rounded border border-white/10 bg-white/[0.05] px-1 font-mono text-[8px]">Ctrl</kbd> + clic pour ajouter ou retirer un objet de la sélection.
      </p>

      {/* ── Corps scrollable ── */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.07)_transparent] min-h-0">

        {/* ──────── FORMES DE BASE ──────── */}
        <SecHead label="Formes de base" color="text-violet-400/70" />
        <div className="mx-3 grid grid-cols-3 gap-1 mb-1">
          {FV_SHAPES.map(sh => (
            <button key={sh.id} onClick={() => handleShape(sh.id)}
              title={sh.label + (sh.shortcut ? ` (${sh.shortcut})` : '')}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 px-1 hover:border-violet-500/30 hover:bg-violet-500/10 transition-all active:scale-95">
              <span className="text-[16px] leading-none text-white/60">{sh.shape}</span>
              <span className="text-[8px] text-white/35 truncate w-full text-center leading-tight">{sh.label}</span>
            </button>
          ))}
        </div>

        <div className="mx-3 my-2.5 h-px bg-white/[0.05]" />

        {/* ──────── OUTILS DE TRACÉ ──────── */}
        <SecHead icon={PenTool} label="Tracé & Plume" color="text-cyan-400/70" />
        <div className="mx-3 space-y-0.5 mb-1">
          {FV_PEN.map(t => {
            const Icon = t.icon;
            const isActive = activeVectorTool === t.id;
            return (
              <button key={t.id} onClick={() => handlePen(t.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all',
                  isActive
                    ? 'border-cyan-500/35 bg-cyan-500/15 text-cyan-300'
                    : 'border-transparent hover:border-white/10 hover:bg-white/[0.04] text-white/55',
                )}>
                <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-cyan-400' : 'text-white/35')} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium truncate">{t.label}</p>
                  <p className="text-[9px] text-white/25 truncate">{t.sub}</p>
                </div>
                {t.shortcut && (
                  <span className="text-[8px] font-mono text-white/20 shrink-0 border border-white/[0.08] rounded px-1">{t.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Sélection directe ── */}
        <SecHead icon={MousePointer2} label="Sélection directe" color="text-teal-400/70" />
        <div className="mx-3 mb-1">
          {FV_SELECT.map(t => {
            const Icon = t.icon;
            const isActive = activeVectorTool === t.id;
            return (
              <button key={t.id} onClick={() => handlePen(t.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 transition-all',
                  isActive
                    ? 'border-teal-500/35 bg-teal-500/15 text-teal-300'
                    : 'border-white/[0.07] bg-white/[0.02] text-white/55 hover:bg-white/[0.05] hover:border-white/12',
                )}>
                <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-teal-400' : 'text-white/35')} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium">{t.label}</p>
                  <p className="text-[9px] text-white/25">{t.sub}</p>
                </div>
                <span className="text-[8px] font-mono text-white/20 border border-white/[0.08] rounded px-1">{t.shortcut}</span>
              </button>
            );
          })}
        </div>

        <div className="mx-3 my-2.5 h-px bg-white/[0.05]" />

        {/* ──────── OPÉRATIONS BOOLÉENNES ──────── */}
        <SecHead label="Opérations booléennes" color="text-amber-400/70" />
        <div className="mx-3 grid grid-cols-5 gap-1 mb-1">
          {FV_BOOLEAN.map(op => {
            const enabled = selCount >= op.needs;
            return (
              <button key={op.id} onClick={() => enabled && handleBoolean(op.id)}
                title={op.label + ' — ' + op.sub + (enabled ? '' : ` (sélectionnez ${op.needs}+ éléments)`)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 px-1 transition-all',
                  enabled ? [FV_BOOL_COLORS[op.color], 'hover:scale-[1.04] active:scale-[0.96]'] : FV_BOOL_COLORS_DISABLED,
                )}>
                <span className="text-[17px] leading-none font-light">{op.glyph}</span>
                <span className="text-[7px] font-medium text-center leading-tight truncate w-full">{op.label}</span>
              </button>
            );
          })}
        </div>
        {/* Légende booléenne */}
        <p className="mx-3 mb-2 text-[8.5px] text-white/20 leading-relaxed">
          {selCount < 2 ? 'Sélectionnez 2 formes sur le canvas pour activer les opérations.' : `${selCount} formes sélectionnées — opérations disponibles.`}
        </p>

        <div className="mx-3 my-2 h-px bg-white/[0.05]" />

        {/* ──────── ORGANISATION ──────── */}
        <SecHead icon={Layers} label="Organisation & Découpage" color="text-emerald-400/70" />
        <div className="mx-3 grid grid-cols-2 gap-1 mb-3">
          {FV_ORGANIZE.map(t => {
            const Icon = t.icon;
            const enabled = selCount >= t.needs;
            return (
              <button key={t.id} onClick={() => handleOrganize(t.id)}
                title={t.label + ' · ' + t.sub}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-all',
                  enabled
                    ? 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-emerald-500/10 hover:border-emerald-500/25 hover:text-emerald-300 active:scale-95'
                    : 'border-white/[0.04] bg-white/[0.01] text-white/20 cursor-not-allowed',
                )}>
                <Icon className={cn('h-3.5 w-3.5 shrink-0', enabled ? '' : 'opacity-30')} />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium truncate">{t.label}</p>
                  <p className="text-[8px] text-white/25 truncate">{t.sub}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── IA Forme ── */}
        <div className="mx-3 mb-4">
          <button
            onClick={() => addLongiaMessage({ role: 'ai', text: 'Décrivez la forme ou le vecteur que vous souhaitez créer. Ex : "un hexagone avec dégradé bleu", "une flèche courbée pointant vers le haut"…' })}
            className="flex w-full items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-3 py-2.5 hover:bg-violet-500/12 transition-colors">
            <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-violet-300">IA Forme — LONGIA</p>
              <p className="text-[9px] text-violet-400/60">Décrire ou générer une forme</p>
            </div>
          </button>
        </div>

      </div>
    </motion.aside>
  );
}

const DESIGNER_STOCK_IMAGE_URL = {
  'tpl-liri': '/image-pro/forfaits-hero-liri-immersion.png',
  'tpl-mk5': '/image-pro/isna-pro-rituel-compris-cinematic.png',
  'tpl-iso': '/image-pro/aprendre-a-distance.png',
};

const DESIGNER_IA_IMAGE_PRESETS = [
  {
    label: 'LIRI',
    prompt:
      'Illustration pédagogique : immersion LIRI, écran montrant un transmetteur digne, élève concentré, palette sombre bleu nuit et or, cinématique, aucun texte lisible dans l’image.',
  },
  {
    label: 'MK5',
    prompt:
      'Infographie pédagogique sombre : schéma clair or et bleu sur fond #0b0f1a, flux ou cycles, style académique premium, pas de texte dans l’image.',
  },
  {
    label: 'Symbole',
    prompt:
      'Symbole spirituel abstrait et sobre, géométrie dorée douce, fond noir profond, peinture digitale élégante, aucun texte.',
  },
];

function ContextualPanel({ tool, onClose }) {
  /* ── TOUS les hooks en premier (règle React — jamais après un return conditionnel) ── */
  const [activeTab, setActiveTab] = useState(0);
  const [iaImagePrompt, setIaImagePrompt] = useState('');
  const [iaImageSize, setIaImageSize] = useState('1792x1024');
  const [iaImageBusy, setIaImageBusy] = useState(false);
  const [iaImageErr, setIaImageErr] = useState('');
  const [iaImageGallery, setIaImageGallery] = useState([]);
  const [iaGalleryLoading, setIaGalleryLoading] = useState(false);
  const designerImagesFileRef = useRef(null);
  const addObject           = useSmartboardKonvaStore(s => s.addObject);
  const addObjects          = useSmartboardKonvaStore(s => s.addObjects);
  const selectAllInActiveScene = useSmartboardKonvaStore(s => s.selectAllInActiveScene);
  const setCanvasBackground = useSmartboardKonvaStore(s => s.setCanvasBackground);
  const canvasBg            = useSmartboardKonvaStore(s => s.project?.canvas?.background ?? 'transparent');

  /* Détection de la sélection canvas */
  const selectedIds     = useSmartboardKonvaStore(s => s.selectedIds);
  const scenes          = useSmartboardKonvaStore(s => s.project?.scenes ?? []);
  const activeSceneId   = useSmartboardKonvaStore(s => s.project?.activeSceneId);
  const activeSceneObjs = scenes.find(s => s.id === activeSceneId)?.objects ?? [];
  const selectedObj     = activeSceneObjs.find(o => o.id === selectedIds[0]) ?? null;

  const content = TOOL_CONTENT[tool] ?? FALLBACK_CONTENT;
  const a = getToolAccent(tool);

  const refreshIaGallery = useCallback(async () => {
    setIaGalleryLoading(true);
    try {
      const rows = await fetchDesignerImageGallery(supabase);
      setIaImageGallery(rows);
    } finally {
      setIaGalleryLoading(false);
    }
  }, []);

  const placeDesignerIaImageOnCanvas = useCallback(
    (url) => {
      const u = String(url || '').trim();
      if (!u) return;
      addObject(mkImageObject(u, { x: 100, y: 120, width: 620, height: 354, layer: 2 }));
    },
    [addObject],
  );

  const runDesignerIaImage = useCallback(async () => {
    const prompt = iaImagePrompt.trim();
    if (!prompt) return;
    setIaImageBusy(true);
    setIaImageErr('');
    try {
      const { data, error } = await invokeGenerateVisualImage(supabase, { prompt, size: iaImageSize });
      if (error) throw new Error(error.message || 'Appel impossible');
      const url = data?.imageUrl || data?.url;
      if (!url) throw new Error(typeof data?.error === 'string' ? data.error : 'Réponse sans image');
      if (!data?.persisted) {
        pushLegacyLocalDesignerImage({ url, prompt, size: data?.size || iaImageSize });
      }
      void refreshIaGallery();
      placeDesignerIaImageOnCanvas(url);
    } catch (e) {
      setIaImageErr(e?.message ? String(e.message) : String(e));
    } finally {
      setIaImageBusy(false);
    }
  }, [iaImagePrompt, iaImageSize, refreshIaGallery, placeDesignerIaImageOnCanvas]);

  useEffect(() => {
    if (tool === 'images' && activeTab === 2) void refreshIaGallery();
  }, [tool, activeTab, refreshIaGallery]);

  /* Panneau Formes → déléguer à FormesVectorPanel (garde le panel même avec sélection) */
  if (tool === 'formes') {
    return <FormesVectorPanel onClose={onClose} />;
  }

  /** Catalogues d’insertion (texte, modèles, fond…) : restent visibles même avec une sélection — sinon les presets semblent « cassés ». */
  const catalogToolActive = tool && new Set([
    'texte', 'icones', 'images', 'fond', 'animes', 'modeles', 'selection', '3d',
  ]).has(tool);

  /* Propriétés d’élément seulement hors catalogue actif (ou sans outil catalogue ouvert). */
  if (selectedObj && !catalogToolActive) {
    return <ElementPanel obj={selectedObj} onClose={onClose} />;
  }

  const handleAdd = (item) => {
    if (tool === 'images' && item.id === 'upload') {
      designerImagesFileRef.current?.click();
      return;
    }
    if (tool === 'images' && item.id === 'library') {
      setActiveTab(2);
      void refreshIaGallery();
      return;
    }
    const stockUrl = DESIGNER_STOCK_IMAGE_URL[item.id];
    if (tool === 'images' && stockUrl) {
      addObject(mkImageObject(stockUrl, { x: 72, y: 120, width: 560, height: 320, layer: 2 }));
      return;
    }
    if (item.id === 'ai') return; // IA items non-fonctionnels pour l'instant
    if (tool === 'texte') {
      // Utiliser le preset enrichi (textPreset) ou fallback minimal
      const preset = item.textPreset;
      if (preset) {
        addObject({
          type: 'text',
          x: 80, y: 80,
          width: preset.w,
          height: preset.h,
          content: { text: preset.text },
          style: {
            fontFamily: preset.style?.fontFamily ?? 'Inter, system-ui, sans-serif',
            fill: '#F7F2E8',
            ...preset.style,
          },
        });
      } else {
        addObject({ type: 'text', x: 80, y: 80, width: 400, height: 40,
          content: { text: item.label ?? 'Texte' },
          style: { fontSize: 24, fill: '#F7F2E8', fontFamily: 'Inter, system-ui, sans-serif' } });
      }
    }
    if (tool === 'formes') {
      const typeMap = { rect: 'rect', circle: 'circle', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', starshape: 'starshape', line: 'line', arrow: 'arrow' };
      const t = typeMap[item.id] ?? 'rect';
      if (t === 'line') addObject({ type: 'line', x: 80, y: 200, width: 200, height: 4, content: { points: [0,0,200,0] }, style: { stroke: '#94a3b8', strokeWidth: 3 } });
      else if (t === 'arrow') addObject({ type: 'arrow', x: 80, y: 200, width: 200, height: 4, content: { points: [0,0,200,0] }, style: { stroke: '#94a3b8', fill: '#94a3b8', strokeWidth: 3, pointerLength: 10, pointerWidth: 10 } });
      else addObject({ type: t, x: 100, y: 100, width: 160, height: 140, style: { fill: 'rgba(139,92,246,0.25)', stroke: '#7c3aed', strokeWidth: 2, cornerRadius: t === 'rect' ? 6 : 0 } });
    }
    if (tool === 'animes' && item.id === 'html') {
      addObject({ type: 'html', x: 120, y: 180, width: 360, height: 200, content: { html: '<!DOCTYPE html><html><body style="margin:0;background:#0b0f1a;display:flex;align-items:center;justify-content:center;height:100vh"><div style="width:60px;height:60px;border:3px solid rgba(212,175,55,.2);border-top-color:#D4AF37;border-radius:50%;animation:s 1s linear infinite"></div><style>@keyframes s{to{transform:rotate(360deg)}}</style></body></html>' } });
    }
    if (tool === 'modeles' && item.id !== 'ai') {
      if (item.id === 'intro') {
        addObjects([
          mkTextObject({
            x: 72, y: 52, width: 880, height: 64,
            content: { text: 'Titre du cours' },
            style: { fontSize: 40, fontWeight: 700, lineHeight: 1.15, fill: '#F7F2E8' },
          }),
          mkTextObject({
            x: 72, y: 128, width: 720, height: 120,
            content: { text: 'Objectifs pédagogiques\n• …\n• …' },
            style: { fontSize: 17, fontWeight: 400, lineHeight: 1.55, fill: '#c4bfd4' },
          }),
        ]);
        return;
      }
      if (item.id === 'timeline') {
        addObjects([
          mkRectObject({ x: 64, y: 204, width: 820, height: 6, style: { fill: 'rgba(212,175,55,0.35)', stroke: 'none', cornerRadius: 3 } }),
          mkRectObject({ x: 118, y: 178, width: 16, height: 16, style: { fill: '#D4AF37', cornerRadius: 8 } }),
          mkRectObject({ x: 398, y: 178, width: 16, height: 16, style: { fill: '#D4AF37', cornerRadius: 8 } }),
          mkRectObject({ x: 678, y: 178, width: 16, height: 16, style: { fill: '#D4AF37', cornerRadius: 8 } }),
          mkTextObject({ x: 90, y: 222, width: 200, height: 28, content: { text: 'Étape 1' }, style: { fontSize: 14, fill: '#8892aa' } }),
          mkTextObject({ x: 370, y: 222, width: 200, height: 28, content: { text: 'Étape 2' }, style: { fontSize: 14, fill: '#8892aa' } }),
          mkTextObject({ x: 650, y: 222, width: 200, height: 28, content: { text: 'Étape 3' }, style: { fontSize: 14, fill: '#8892aa' } }),
        ]);
        return;
      }
      if (item.id === 'compare') {
        addObjects([
          mkRectObject({ x: 72, y: 100, width: 380, height: 220, style: { fill: 'rgba(96,165,250,0.12)', stroke: '#3b82f6', strokeWidth: 2 } }),
          mkRectObject({ x: 480, y: 100, width: 380, height: 220, style: { fill: 'rgba(167,139,250,0.12)', stroke: '#7c3aed', strokeWidth: 2 } }),
          mkTextObject({ x: 92, y: 118, width: 320, height: 36, content: { text: 'Colonne A' }, style: { fontSize: 22, fontWeight: 600, fill: '#F7F2E8' } }),
          mkTextObject({ x: 500, y: 118, width: 320, height: 36, content: { text: 'Colonne B' }, style: { fontSize: 22, fontWeight: 600, fill: '#F7F2E8' } }),
          mkTextObject({ x: 92, y: 160, width: 340, height: 140, content: { text: 'Arguments, exemples…' }, style: { fontSize: 15, fill: '#c4bfd4', lineHeight: 1.5 } }),
          mkTextObject({ x: 500, y: 160, width: 340, height: 140, content: { text: 'Arguments, exemples…' }, style: { fontSize: 15, fill: '#c4bfd4', lineHeight: 1.5 } }),
        ]);
        return;
      }
      if (item.id === 'mindmap') {
        addObjects([
          mkRectObject({ x: 380, y: 160, width: 200, height: 72, style: { fill: 'rgba(212,175,55,0.2)', stroke: '#D4AF37', strokeWidth: 2, cornerRadius: 12 } }),
          mkTextObject({ x: 400, y: 178, width: 160, height: 40, content: { text: 'Idée centrale' }, style: { fontSize: 18, fontWeight: 700, fill: '#F7F2E8', align: 'center' } }),
          mkTextObject({ x: 120, y: 80, width: 160, height: 36, content: { text: 'Branche 1' }, style: { fontSize: 15, fill: '#c4bfd4' } }),
          mkTextObject({ x: 640, y: 80, width: 160, height: 36, content: { text: 'Branche 2' }, style: { fontSize: 15, fill: '#c4bfd4' } }),
          mkTextObject({ x: 120, y: 300, width: 160, height: 36, content: { text: 'Branche 3' }, style: { fontSize: 15, fill: '#c4bfd4' } }),
        ]);
        return;
      }
      if (item.id === 'quiz') {
        addObjects([
          mkTextObject({ x: 72, y: 72, width: 760, height: 48, content: { text: 'Question QCM ?' }, style: { fontSize: 26, fontWeight: 600, fill: '#F7F2E8' } }),
          mkTextObject({ x: 92, y: 130, width: 700, height: 120, content: { text: 'A) …\nB) …\nC) …\nD) …' }, style: { fontSize: 16, fill: '#c4bfd4', lineHeight: 1.65 } }),
        ]);
        return;
      }
    }
    // ── Document — ajouter un objet texte avec style typographique adapté ──
    if (tool === 'doc-titre' || tool === 'doc-para') {
      const sizeMap = { h1: 36, h2: 28, h3: 22, h4: 18, corps: 14, intro: 16, cite: 14, note: 10 };
      const boldIds = new Set(['h1', 'h2', 'intro']);
      const italicIds = new Set(['h4', 'cite']);
      const sz = sizeMap[item.id] ?? 16;
      addObject({ type: 'text', x: 40, y: 60, width: 700, height: sz + 20,
        content: { text: item.label },
        style: { fontSize: sz, fill: item.id === 'note' ? '#8892aa' : '#F7F2E8',
          fontStyle: italicIds.has(item.id) ? 'italic' : 'normal',
          fontVariant: boldIds.has(item.id) ? 'bold' : 'normal',
          fontFamily: 'Inter, system-ui, sans-serif' } });
    }
    // ── Document — liste → texte multi-lignes avec préfixe ──
    if (tool === 'doc-liste') {
      const bulletMap = { bullet: '• Item\n• Item\n• Item', numbered: '1. Item\n2. Item\n3. Item', checklist: '☐ Tâche 1\n☐ Tâche 2\n☐ Tâche 3', glossary: 'Terme : définition du terme' };
      addObject({ type: 'text', x: 40, y: 100, width: 500, height: 80,
        content: { text: bulletMap[item.id] ?? '• Item' },
        style: { fontSize: 14, fill: '#F7F2E8', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.7 } });
    }
    // ── Présentation — mêmes types que design ──
    if (tool === 'slide-titre') {
      const sizes = { title: 48, subtitle: 28, section: 32 };
      addObject({ type: 'text', x: 80, y: 120, width: 800, height: (sizes[item.id] ?? 36) + 20,
        content: { text: item.label }, style: { fontSize: sizes[item.id] ?? 36, fill: '#F7F2E8', fontFamily: 'Inter, system-ui, sans-serif' } });
    }
    if (tool === 'slide-forme') {
      const typeMap2 = { rect: 'rect', circle: 'circle', triangle: 'triangle', arrow: 'arrow' };
      const t2 = typeMap2[item.id] ?? 'rect';
      if (t2 === 'arrow') addObject({ type: 'arrow', x: 80, y: 200, width: 200, height: 4, content: { points: [0,0,200,0] }, style: { stroke: '#94a3b8', fill: '#94a3b8', strokeWidth: 3, pointerLength: 10, pointerWidth: 10 } });
      else addObject({ type: t2, x: 200, y: 200, width: 160, height: 140, style: { fill: 'rgba(96,165,250,0.2)', stroke: '#3b82f6', strokeWidth: 2 } });
    }
  };

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 210, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex flex-shrink-0 flex-col border-r border-white/[0.07] overflow-hidden"
      style={{ background: '#13121e' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5 shrink-0">
        <span className={cn('text-[12px] font-semibold', a.text)}>{content.label}</span>
        <div className="flex-1" />
        <button onClick={onClose} className="h-5 w-5 flex items-center justify-center rounded-md text-white/30 hover:text-white/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {tool === 'images' ? (
        <input
          ref={designerImagesFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={async (ev) => {
            const file = ev.target.files?.[0];
            ev.target.value = '';
            if (!file) return;
            try {
              const { url, path } = await uploadSmartboardCanvasImage(file);
              await insertDesignerUploadMetadata(supabase, { storagePath: path, prompt: file.name, publicUrl: url });
              addObject(mkImageObject(url, { x: 100, y: 120, width: 560, height: 320, layer: 2 }));
              void refreshIaGallery();
            } catch (e) {
              console.error(e);
            }
          }}
        />
      ) : null}

      {/* Tabs */}
      {content.tabs.length > 1 && (
        <div className="flex border-b border-white/[0.07] overflow-x-auto shrink-0">
          {content.tabs.map((tab, i) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={cn('shrink-0 px-3 py-1.5 text-[10px] font-medium whitespace-nowrap transition-colors',
                activeTab === i ? [a.text, 'border-b-2', a.border] : 'text-white/30 hover:text-white/60'
              )}>
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* ── FOND — background picker special ── */}
      {tool === 'selection' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <p className="text-[10px] leading-relaxed text-white/50">
            <span className="font-semibold text-teal-300/90">Multi-sélection :</span>{' '}
            maintenez <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[9px]">⇧</kbd>{' '}
            ou <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[9px]">⌘</kbd>
            / <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[9px]">Ctrl</kbd> puis cliquez sur plusieurs objets.
          </p>
          <button
            type="button"
            onClick={() => selectAllInActiveScene()}
            className="w-full rounded-xl border border-teal-500/25 bg-teal-500/10 px-3 py-2.5 text-left transition-colors hover:bg-teal-500/15"
          >
            <span className="text-[11px] font-semibold text-teal-200">Tout sélectionner</span>
            <span className="mt-0.5 block text-[9px] text-white/40">Tous les objets de la scène active</span>
          </button>
        </div>
      )}

      {tool === 'fond' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/22">Fond actuel</p>
          <div className="h-10 w-full rounded-xl border border-white/10 overflow-hidden"
            style={{ background: canvasBg === 'transparent' ? 'repeating-conic-gradient(#444 0% 25%, #222 0% 50%) 0 0/10px 10px' : canvasBg }} />
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/22 pt-1">Presets</p>
          <div className="grid grid-cols-4 gap-2">
            {BG_PRESETS.map(p => (
              <button key={p.id} onClick={() => setCanvasBackground(p.value)} title={p.label}
                className={cn('flex flex-col items-center gap-1 rounded-lg p-1 transition-all hover:bg-white/[0.07]',
                  canvasBg === p.value && 'ring-1 ring-white/30')}>
                <div className="h-8 w-full rounded-md border border-white/10 overflow-hidden"
                  style={{ background: p.swatch ? p.swatch : 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0/8px 8px' }} />
                <span className="text-[8px] text-white/35 truncate w-full text-center">{p.label}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 cursor-pointer hover:border-white/20 transition-colors">
            <span className="text-[11px] text-white/50 flex-1">Couleur personnalisée</span>
            <div className="h-6 w-6 rounded-md border border-white/15 overflow-hidden">
              <input type="color" className="opacity-0 absolute" onChange={e => setCanvasBackground(e.target.value)} />
            </div>
          </label>
        </div>
      )}

      {/* ── Items standard ── */}
      {tool !== 'fond' && tool !== 'selection' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {tool === 'images' && activeTab === 1 ? (
            <div className="space-y-2 px-0.5 pb-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-300/80">
                Génération intégrée
              </p>
              <p className="text-[9px] leading-snug text-white/40">
                DALL·E 3 via Supabase. Connecté : images enregistrées dans votre espace (URL publique stable). Invité : cache partagé.
              </p>
              <div className="flex flex-wrap gap-1">
                {DESIGNER_IA_IMAGE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setIaImagePrompt(p.prompt)}
                    className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[9px] font-medium text-violet-200/90 hover:bg-violet-500/20"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <label className="block text-[9px] font-medium text-white/45">
                Format DALL·E 3
                <select
                  value={iaImageSize}
                  onChange={(e) => setIaImageSize(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/12 bg-black/50 py-1.5 pl-2 pr-6 text-[10px] text-white/85"
                >
                  {DESIGNER_IA_IMAGE_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                value={iaImagePrompt}
                onChange={(e) => setIaImagePrompt(e.target.value)}
                placeholder="Décrivez l’illustration…"
                rows={4}
                className="w-full resize-y rounded-xl border border-white/12 bg-black/45 px-2.5 py-2 text-[11px] text-white/85 placeholder:text-white/25 focus:border-violet-500/35 focus:outline-none"
              />
              {iaImageErr ? (
                <p className="text-[9px] leading-snug text-rose-400/90">{iaImageErr}</p>
              ) : null}
              <button
                type="button"
                disabled={iaImageBusy || !iaImagePrompt.trim()}
                onClick={() => void runDesignerIaImage()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet-400/35 bg-violet-900/35 py-2 text-[11px] font-semibold text-violet-100 disabled:opacity-45"
              >
                {iaImageBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Générer &amp; placer
              </button>
            </div>
          ) : tool === 'images' && activeTab === 2 ? (
            <div className="space-y-2 px-0.5 pb-2">
              <p className="text-[9px] leading-snug text-white/40">
                Compte connecté : galerie complète synchronisée (bucket public, pas d’expiration). Sans compte : liste locale sur cet appareil (quota navigateur).
              </p>
              {iaGalleryLoading ? (
                <p className="flex items-center justify-center gap-2 py-6 text-[10px] text-white/40">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </p>
              ) : iaImageGallery.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-white/30">
                  Aucune image. <span className="text-white/55">IA Generate</span>, <span className="text-white/55">Importer</span> ou presets.
                </p>
              ) : (
                <ul className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto pr-0.5">
                  {iaImageGallery.map((h) => (
                    <li
                      key={h.id || h.url}
                      className="flex gap-2 rounded-lg border border-white/[0.08] bg-black/30 p-1.5"
                    >
                      <img
                        src={h.url}
                        alt=""
                        className="h-14 w-20 shrink-0 rounded-md object-cover"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[9px] leading-snug text-white/55" title={h.prompt}>
                          {h.prompt || 'Sans description'}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1 text-[8px] text-white/25">
                          {h.size ? <span>{h.size}</span> : null}
                          {h.source ? <span>· {h.source}</span> : null}
                          {!h.persisted ? <span>· local</span> : null}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => placeDesignerIaImageOnCanvas(h.url)}
                            className="rounded border border-[#D4AF37]/35 bg-[#D4AF37]/12 px-2 py-0.5 text-[9px] font-medium text-[#ebca5e] hover:bg-[#D4AF37]/20"
                          >
                            Placer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void (async () => {
                                await deleteDesignerImageEntry(supabase, h);
                                void refreshIaGallery();
                              })();
                            }}
                            className="rounded border border-white/12 px-2 py-0.5 text-[9px] text-white/45 hover:bg-white/10"
                          >
                            Retirer
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {iaImageGallery.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      await clearDesignerImageGallery(supabase);
                      void refreshIaGallery();
                    })();
                  }}
                  className="w-full rounded-lg border border-rose-500/25 py-1.5 text-[9px] font-medium text-rose-300/80 hover:bg-rose-500/10"
                >
                  Effacer toute la galerie
                </button>
              ) : null}
            </div>
          ) : (
            <>
          {content.items
            .filter((item) => !(tool === 'images' && activeTab === 0 && item.id === 'ai'))
            .map(item => {
            const Icon = item.icon;

            /* ── Texte : aperçu de style visuel ── */
            if (tool === 'texte' && item.textPreset && !item.ai) {
              const ps = item.textPreset.style;
              const clampPx = Math.min(ps.fontSize ?? 16, 26);
              const isItalic   = ps.fontStyle === 'italic';
              const isBold     = (ps.fontWeight ?? 400) >= 600;
              const isCode     = (ps.fontFamily ?? '').includes('Courier');
              return (
                <button key={item.id} onClick={() => handleAdd(item)}
                  className="group flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all hover:bg-white/[0.05] hover:border-white/[0.1]">
                  {/* Pastille type */}
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] font-bold"
                    style={{ fontSize: 10, color: ps.fill ?? '#F7F2E8', opacity: 0.9 }}>
                    {item.shape}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    {/* Nom du style + dimensions */}
                    <p className="text-[11px] font-semibold text-white/75 truncate">{item.label}</p>
                    {/* Aperçu visuel de la typographie */}
                    <p
                      className="mt-0.5 truncate leading-tight"
                      style={{
                        fontSize:      clampPx,
                        fontWeight:    ps.fontWeight ?? 400,
                        fontStyle:     isItalic ? 'italic' : 'normal',
                        letterSpacing: ps.letterSpacing ?? 0,
                        color:         ps.fill ?? '#F7F2E8',
                        opacity:       0.7,
                        fontFamily:    isCode ? 'Courier New, monospace' : 'Inter, system-ui, sans-serif',
                        lineHeight:    1.1,
                      }}>
                      {item.textPreset.text?.split('.')[0] ?? item.label}
                    </p>
                    <p className="text-[9px] text-white/25 truncate">{item.sub}</p>
                  </div>
                </button>
              );
            }

            return (
              <button key={item.id} onClick={() => handleAdd(item)}
                className={cn(
                  'group flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all hover:bg-white/[0.05] hover:border-white/10',
                  item.ai && 'bg-violet-500/[0.06] border-violet-500/15 hover:border-violet-500/25',
                )}>
                {item.shape && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-base text-white/70">
                    {item.shape}
                  </span>
                )}
                {Icon && !item.shape && (
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', item.ai ? 'bg-violet-500/15' : 'bg-white/[0.06]')}>
                    <Icon className={cn('h-4 w-4', item.ai ? 'text-violet-400' : 'text-white/50')} />
                  </span>
                )}
                {!item.shape && !item.icon && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                    <Plus className="h-3.5 w-3.5 text-white/40" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[12px] font-medium truncate', item.ai ? 'text-violet-300' : 'text-white/75')}>{item.label}</p>
                  {item.sub && <p className="text-[10px] text-white/30 truncate">{item.sub}</p>}
                </div>
              </button>
            );
          })}

          {content.items.length === 0 && !(tool === 'images' && activeTab === 1) && (
            <p className="py-6 text-center text-[11px] text-white/25">Bientôt disponible</p>
          )}

          {/* Search — only for large lists */}
          {content.items.length > 3 && !(tool === 'images' && (activeTab === 1 || activeTab === 2)) && (
            <div className="pt-2 pb-1">
              <input placeholder={`Rechercher…`}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/60 placeholder:text-white/20 focus:border-white/20 focus:outline-none" />
            </div>
          )}
            </>
          )}
        </div>
      )}
    </motion.aside>
  );
}

/* ════════════════════════════════════════════════════════════════════
   RIGHT AI HUB — Hub unifié LONGIA (Hub / Plan / Script)
════════════════════════════════════════════════════════════════════ */
/* ── AI Hub : onglets + suggestions actionnables + registre d’exécution ── */
function AIHub({ docType = null, designerMode = 'design', onClose = () => {} }) {
  const navigate = useNavigate();
  const course = useCourseCopilotStore(s => s.course);
  const activeSlideIndex = useCourseCopilotStore(s => s.activeSlideIndex);
  const lastLongiaRouting = useAiHubStore(s => s.lastLongiaRouting);
  const scenes = useSmartboardKonvaStore(s => s.project?.scenes ?? []);
  const activeSceneId = useSmartboardKonvaStore(s => s.project?.activeSceneId);
  const setActiveScene = useSmartboardKonvaStore(s => s.setActiveScene);
  const longiaMessages = useSmartboardKonvaStore(s => s.longiaMessages);
  const clearLongiaMessages = useSmartboardKonvaStore(s => s.clearLongiaMessages);
  const selectedIds = useSmartboardKonvaStore(s => s.selectedIds);
  const addLongiaMessage = useSmartboardKonvaStore(s => s.addLongiaMessage);
  const isDocumentMode = useDocumentCoachStore(s => s.isDocumentMode);
  const [activePedaTool, setActivePedaTool] = useState(/** @type {string|null} */ (null));
  const [activeQuickMode, setActiveQuickMode] = useState('analyse');
  const [aiHubTab, setAiHubTab] = useState(/** @type {string} */ ('suggest'));
  const [hubPanelOpen, setHubPanelOpen] = useState(true);
  const unifiedHubScrollRef = useRef(null);

  const pendingHubTab = useAiHubStore((s) => s.pendingHubTab);
  useEffect(() => {
    if (!pendingHubTab) return;
    setAiHubTab(pendingHubTab);
    useAiHubStore.setState({ pendingHubTab: null });
  }, [pendingHubTab]);

  const pushActionHistory = useAiHubStore((s) => s.pushActionHistory);
  const actionHistory = useAiHubStore((s) => s.actionHistory);
  const clearActionHistory = useAiHubStore((s) => s.clearActionHistory);

  const suggestionList = useMemo(() => {
    const scene = scenes.find((s) => s.id === activeSceneId);
    const objectTypes = selectedIds
      .map((id) => scene?.objects?.find((o) => o.id === id)?.type)
      .filter(Boolean);
    const sceneObjectCount = scene?.objects?.length ?? 0;
    const courseTitle =
      course?.title && String(course.title).trim() ? String(course.title).trim() : null;
    const slides = Array.isArray(course?.slides) ? course.slides : [];
    const idx = Math.max(0, Math.min(slides.length - 1, Number(activeSlideIndex) || 0));
    const activeSlide = slides[idx];
    return buildAiHubSuggestions({
      selectedIds,
      objectTypes,
      courseTitle,
      sceneObjectCount,
      sceneObjects: scene?.objects,
      slideCount: slides.length,
      activeSlideIndex: idx,
      activeSlideTitle: activeSlide?.title ?? null,
      activeSlideObjective: activeSlide?.objective ?? null,
      lastRouting: lastLongiaRouting,
      complexity: course?.analysis?.complexity ?? null,
    });
  }, [
    scenes,
    activeSceneId,
    selectedIds,
    course,
    activeSlideIndex,
    lastLongiaRouting,
  ]);

  const handleAiHubApply = useCallback(
    (actionId, label) => {
      const r = executeAiHubAction(actionId);
      addLongiaMessage({ role: 'ai', text: `✦ ${r.message}` });
      pushActionHistory({
        kind: 'apply',
        actionId,
        label: label || actionId,
        detail: r.message,
      });
    },
    [addLongiaMessage, pushActionHistory],
  );

  const handleAiHubExplain = useCallback(
    (actionId) => {
      const text = AI_HUB_EXPLAIN[actionId];
      if (!text) return;
      addLongiaMessage({ role: 'ai', text });
      pushActionHistory({
        kind: 'explain',
        actionId,
        label: 'Explication',
        detail: text.length > 100 ? `${text.slice(0, 100)}…` : text,
      });
    },
    [addLongiaMessage, pushActionHistory],
  );

  const handleLongiaChip = useCallback(
    (chip, msg) => {
      void runLongiaHubChipAction(chip, msg, { addLongiaMessage, pushActionHistory, navigate });
    },
    [addLongiaMessage, pushActionHistory, navigate],
  );

  const studioQuickModeStore = useAiHubStore((s) => s.studioQuickMode);
  const longiaChatSending = useAiHubStore((s) => s.longiaChatSending);
  useEffect(() => {
    setActiveQuickMode(studioQuickModeStore || 'analyse');
  }, [studioQuickModeStore]);

  useEffect(() => {
    const el = unifiedHubScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [longiaMessages]);

  const activeSceneIdx = scenes.findIndex(s => s.id === activeSceneId);
  const activeScene = scenes[activeSceneIdx];

  const hubTabs = useMemo(() => getLongiaHubTabsForRender(), []);
  const selectedTypes = useMemo(
    () =>
      selectedIds
        .map((id) => activeScene?.objects?.find((o) => o.id === id)?.type)
        .filter(Boolean),
    [selectedIds, activeScene],
  );
  const contextLine = useMemo(
    () =>
      buildLongiaContextLine({
        docType,
        designerMode,
        quickModeId: activeQuickMode,
        selectionCount: selectedIds.length,
        selectedTypes,
      }),
    [docType, designerMode, activeQuickMode, selectedIds.length, selectedTypes],
  );
  const headerStatus = useMemo(
    () => resolveLongiaHeaderStatus({ quickModeId: activeQuickMode, isSending: longiaChatSending }),
    [activeQuickMode, longiaChatSending],
  );
  const emptyState = useMemo(() => getLongiaMessageEmptyState(), []);
  const maxPrimaryActions = useMemo(() => getLongiaActionStripMaxPrimary(), []);
  const showLongiaEmptyState = longiaMessages.length === 1 && longiaMessages[0]?.id === 'init';

  /** Scène & cours : masqué sur Architect / Historique pour laisser place au flux dédié. */
  const showHubSceneCoursePanel =
    aiHubTab === 'suggest' || aiHubTab === 'action' || aiHubTab === 'tutoriel';
  /** Conversation : uniquement Suggestion + Action (barre du bas reste active partout). */
  const showHubConversation = aiHubTab === 'suggest' || aiHubTab === 'action';

  const coachFeed = useMemo(
    () =>
      buildLongiaHubCoachFeed({
        scene: activeScene,
        course,
        activeSceneIndex: activeSceneIdx >= 0 ? activeSceneIdx : 0,
        selectedIds,
        getTypeLabel: (t) => ELEMENT_META[t]?.label ?? 'élément',
      }),
    [activeScene, course, activeSceneIdx, selectedIds],
  );

  const clarityScore = useMemo(
    () =>
      computeLongiaClarityScore({
        scene: activeScene,
        course,
        activeSceneIndex: activeSceneIdx >= 0 ? activeSceneIdx : 0,
      }),
    [activeScene, course, activeSceneIdx],
  );

  const activityFeed = useMemo(() => {
    const rows = [];
    for (const h of actionHistory) {
      rows.push({
        kind: 'hub',
        ts: h.ts,
        label: h.label,
        detail: h.detail,
        id: `h_${h.id}`,
      });
    }
    for (const m of longiaMessages) {
      if (m.id === 'init') continue;
      const t = typeof m.text === 'string' ? m.text : '';
      rows.push({
        kind: 'longia',
        ts: m.ts || 0,
        label: m.role === 'user' ? 'Vous' : 'LONGIA',
        detail: t.slice(0, 220),
        id: `m_${m.id}`,
      });
    }
    return rows.sort((a, b) => b.ts - a.ts).slice(0, 48);
  }, [actionHistory, longiaMessages]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[36]">
      <div className="pointer-events-auto absolute right-3 top-3 flex max-w-[min(96vw,calc(100%-1.5rem))] flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-1 rounded-2xl border border-white/10 bg-[#12111a]/95 px-1.5 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <div className="flex max-w-[min(100%,280px)] items-center gap-1.5 border-r border-white/[0.08] pr-2">
            <div className="relative h-7 w-7 shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/90 to-orange-600/80 shadow-[0_0_14px_rgba(245,158,11,0.35)]">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#12111a] bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] font-bold text-white/90">LONGIA</span>
                <span className="shrink-0 rounded-full border border-white/[0.12] bg-white/[0.06] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wide text-amber-200/90">
                  {headerStatus}
                </span>
              </div>
              {longiaChatSending ? (
                <span className="block text-[8px] text-amber-300/80">{getLongiaAnalyzingLabel()}</span>
              ) : null}
              {contextLine ? (
                <p className="max-w-[220px] truncate text-[8px] text-white/30" title={contextLine}>
                  {contextLine}
                </p>
              ) : null}
            </div>
          </div>
          {AI_QUICK_MODES.map((m) => {
            const Icon = m.icon;
            const isActive = activeQuickMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setActiveQuickMode(m.id);
                  useAiHubStore.getState().setStudioQuickMode(m.id);
                  setHubPanelOpen(true);
                }}
                title={m.label}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl border transition-all',
                  isActive
                    ? 'border-white/25 bg-white/[0.08] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.15)]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive ? m.color : 'text-white/30')} />
              </button>
            );
          })}
          <div className="mx-0.5 h-6 w-px shrink-0 bg-white/[0.08]" />
          {hubTabs.map((t) => (
            <button
              key={t.stateTabId}
              type="button"
              onClick={() => {
                setAiHubTab(t.stateTabId);
                setHubPanelOpen(true);
              }}
              className={cn(
                'shrink-0 rounded-lg border px-2 py-1 text-[7px] font-bold uppercase tracking-wide transition-colors',
                aiHubTab === t.stateTabId
                  ? 'border-amber-500/45 bg-amber-500/15 text-amber-100'
                  : 'border-transparent text-white/40 hover:border-white/10 hover:text-white/60',
              )}
            >
              {t.label}
            </button>
          ))}
          <div className="mx-0.5 h-6 w-px shrink-0 bg-white/[0.08]" />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Œil sur l’activité — notifications temps réel (hub + LONGIA)"
                className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-200/90 hover:bg-cyan-500/20"
              >
                <Eye className="h-3.5 w-3.5" />
                {actionHistory.length > 0 || longiaMessages.length > 1 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-0.5 text-[7px] font-bold text-black">
                    {Math.min(99, actionHistory.length + Math.max(0, longiaMessages.length - 1))}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" sideOffset={8} className="z-[5000] w-[min(100vw-2rem,340px)] border-white/[0.1] bg-[#14131c] p-0">
              <div className="border-b border-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-bold text-white/85">Activité en direct</p>
                <p className="text-[9px] leading-snug text-white/40">
                  Fil des actions de l’hub et des échanges LONGIA — comme un flux de notifications temps réel.
                </p>
              </div>
              <ul className="max-h-[min(52vh,320px)] space-y-1.5 overflow-y-auto p-2 [scrollbar-width:thin]">
                {activityFeed.length === 0 ? (
                  <li className="py-4 text-center text-[9px] text-white/30">Aucune activité récente.</li>
                ) : (
                  activityFeed.map((row) => (
                    <li key={row.id} className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5 text-[9px] text-white/55">
                      <div className="flex items-center justify-between gap-2 text-[8px] text-white/25">
                        <span>{row.kind === 'hub' ? 'Hub' : 'LONGIA'}</span>
                        <span className="font-mono tabular-nums">
                          {new Date(row.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="mt-0.5 font-semibold text-white/70">{row.label}</p>
                      {row.detail ? <p className="mt-0.5 line-clamp-3 text-white/40">{row.detail}</p> : null}
                    </li>
                  ))
                )}
              </ul>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={onClose}
            title="Fermer le hub"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] text-white/35 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {hubPanelOpen ? (
          <>
            <div className="fixed inset-0 z-[198] bg-black/30" onClick={() => setHubPanelOpen(false)} aria-hidden />
            <div className="relative z-[199] w-[min(420px,calc(100vw-1.5rem))] max-w-full">
              <div
                ref={unifiedHubScrollRef}
                className="max-h-[min(68vh,560px)] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#14131c]/95 px-3 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-sm [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.2)_transparent]"
              >

        {aiHubTab === 'suggest' && (
          <>
            {isDocumentMode ? (
              <button
                type="button"
                onClick={() => setAiHubTab('architect')}
                className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-[9px] font-semibold text-amber-100/95 transition-colors hover:bg-amber-500/16"
              >
                <Wand2 className="h-3 w-3 shrink-0" />
                Coach documentaire (Architect) — ouvrir l’onglet
              </button>
            ) : null}

            {/* Lecture instantanée : clarté + fil coach (un seul bloc) */}
            <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 border-b border-amber-500/15 pb-2">
                <span className="text-[10px] font-semibold text-amber-100/90">Lecture instantanée</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-amber-300">{clarityScore}%</span>
                  <div className="h-1 w-16 rounded-full bg-black/30">
                    <div
                      className="h-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
                      style={{ width: `${clarityScore}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {coachFeed.map((m, i) => (
                  <p
                    key={i}
                    className={cn(
                      'text-[10px] leading-relaxed text-white/55',
                      i > 0 && 'border-t border-white/[0.06] pt-2',
                    )}
                  >
                    {m.text}
                  </p>
                ))}
              </div>
            </div>

            <div className="mb-3 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Actions rapides (canvas)</p>
              {suggestionList.map((sug) => (
                <AiHubSuggestionCard
                  key={sug.id}
                  label={sug.label}
                  description={sug.description}
                  why={sug.why}
                  applyDisabled={Boolean(sug.disabled) || !sug.apply_action}
                  onApply={sug.apply_action ? () => handleAiHubApply(sug.apply_action, sug.label) : undefined}
                  onExplain={sug.apply_action ? () => handleAiHubExplain(sug.apply_action) : undefined}
                />
              ))}
            </div>

            {lastLongiaRouting &&
            typeof lastLongiaRouting === 'object' &&
            (lastLongiaRouting.effectiveMode || lastLongiaRouting.requestedMode) ? (
              <details className="mb-3 rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-[8px] text-white/35">
                <summary className="cursor-pointer font-semibold uppercase tracking-wide">Routage (debug)</summary>
                <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[7px] text-white/40">
                  {JSON.stringify(lastLongiaRouting, null, 2)}
                </pre>
              </details>
            ) : null}
          </>
        )}

        {aiHubTab === 'action' && (
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Actions sur la sélection</p>
            <p className="text-[9px] leading-relaxed text-white/40">
              {selectedIds.length ? `${selectedIds.length} élément(s) sélectionné(s).` : 'Sélectionnez des objets sur le canvas.'}
            </p>
            <button
              type="button"
              disabled={selectedIds.length < 2}
              onClick={() => handleAiHubApply('group_selection', 'Grouper')}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[10px] font-semibold transition-colors',
                selectedIds.length >= 2
                  ? 'border-violet-500/35 bg-violet-500/12 text-violet-200 hover:bg-violet-500/18'
                  : 'cursor-not-allowed border-white/10 text-white/25',
              )}
            >
              Grouper la sélection
            </button>
            <button
              type="button"
              disabled={!selectedIds.length}
              onClick={() => handleAiHubApply('duplicate_selection', 'Dupliquer')}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[10px] font-semibold transition-colors',
                selectedIds.length
                  ? 'border-cyan-500/35 bg-cyan-500/12 text-cyan-200 hover:bg-cyan-500/18'
                  : 'cursor-not-allowed border-white/10 text-white/25',
              )}
            >
              Dupliquer
            </button>
            <button
              type="button"
              disabled={!selectedIds.length}
              onClick={() => handleAiHubApply('align_center_canvas', 'Centrer')}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[10px] font-semibold transition-colors',
                selectedIds.length
                  ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/18'
                  : 'cursor-not-allowed border-white/10 text-white/25',
              )}
            >
              Centrer sur le canvas
            </button>
          </div>
        )}

        {aiHubTab === 'tutoriel' && (
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Prise en main</p>
            <ul className="space-y-2 text-[9.5px] leading-relaxed text-white/45">
              <li className="flex gap-2"><span className="text-amber-400/80">1.</span> Choisissez un outil à gauche, puis cliquez sur le canvas pour créer.</li>
              <li className="flex gap-2"><span className="text-amber-400/80">2.</span> <strong className="text-white/50">Suggestion</strong> et <strong className="text-white/50">Action</strong> affichent le même corps : lecture instantanée, raccourcis canvas et <strong className="text-white/50">conversation</strong> LONGIA.</li>
              <li className="flex gap-2"><span className="text-amber-400/80">3.</span> <strong className="text-white/50">Appliquer</strong> exécute tout de suite ; <strong className="text-white/50">Expliquer</strong> envoie le détail dans le flux.</li>
              <li className="flex gap-2"><span className="text-amber-400/80">4.</span> <strong className="text-white/50">Scène & cours</strong> est replié sous Suggestion / Action / Tutoriel ; masqué sur Architect et Historique.</li>
              <li className="flex gap-2"><span className="text-amber-400/80">5.</span> En mode Document, l’onglet <strong className="text-white/50">Architect</strong> occupe le panneau pour le flux guidé.</li>
              <li className="flex gap-2"><span className="text-amber-400/80">6.</span> Écrivez dans la barre du bas : la réponse apparaît dans <strong className="text-white/50">Suggestion</strong> ou <strong className="text-white/50">Action</strong>.</li>
            </ul>
          </div>
        )}

        {aiHubTab === 'architect' && (
          <div>
            {isDocumentMode ? (
              <DocumentCoachPanel />
            ) : (
              <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[10px] leading-relaxed text-white/40">
                L’agent <strong className="text-white/55">Architect</strong> est disponible pour les projets de type{' '}
                <strong className="text-white/55">Document</strong>. Créez un document depuis le lanceur pour activer le flux
                guidé (intention, plan, reformulation).
              </p>
            )}
          </div>
        )}

        {aiHubTab === 'history' && (
          <div className="space-y-2 pb-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <History className="h-3 w-3 text-white/30" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Historique</span>
              </div>
              {actionHistory.length > 0 ? (
                <button
                  type="button"
                  onClick={() => clearActionHistory()}
                  className="text-[8px] text-white/25 hover:text-white/50"
                >
                  Effacer
                </button>
              ) : null}
            </div>
            {actionHistory.length === 0 ? (
              <p className="text-[9px] text-white/30">Aucune action depuis l’AI Hub pour l’instant.</p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto [scrollbar-width:thin]">
                {actionHistory.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5 text-[9px] text-white/50"
                  >
                    <span className="font-semibold text-white/65">{h.label}</span>
                    <span className="text-white/25"> · </span>
                    <span className="text-violet-300/70">{h.actionId}</span>
                    {h.detail ? <p className="mt-0.5 line-clamp-2 text-white/35">{h.detail}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Atelier : temps réel, navigation, plan, script, outils — masqué Architect / Historique */}
        {showHubSceneCoursePanel ? (
        <details className="mb-3 rounded-xl border border-white/[0.07] bg-black/20">
          <summary className="cursor-pointer list-none px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-white/35 [&::-webkit-details-marker]:hidden">
            <span className="text-white/45">Scène & cours</span>
            <span className="ml-1 font-normal normal-case text-white/25"> — ouvrir si besoin</span>
          </summary>
          <div className="space-y-3 border-t border-white/[0.06] px-3 pb-3 pt-2">
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <Radio className="h-3 w-3 text-white/25" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">Temps réel</span>
              </div>
              <div className="flex gap-1.5">
                {[
                  { id: 'student', label: 'Élève', icon: GraduationCap },
                  { id: 'projector', label: 'Projecteur', icon: Projector },
                  { id: 'teacher', label: 'Prof', icon: Bot },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1 rounded-xl border py-1.5 text-[10px] font-medium transition-all',
                      id === 'projector'
                        ? 'border-cyan-500/35 bg-cyan-500/15 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.12)]'
                        : 'border-white/[0.07] bg-white/[0.02] text-white/40 hover:bg-white/[0.05] hover:text-white/65',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5">
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-amber-500/15">
                <span className="text-[8px] font-bold text-amber-400">G</span>
              </div>
              <span className="min-w-0 flex-1 truncate text-[11px] text-white/55">{activeScene?.name ?? 'Scène 1'}</span>
              <button
                type="button"
                onClick={() => activeSceneIdx > 0 && setActiveScene(scenes[activeSceneIdx - 1]?.id)}
                className="text-white/25 transition-colors hover:text-white/65"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => activeSceneIdx < scenes.length - 1 && setActiveScene(scenes[activeSceneIdx + 1]?.id)}
                className="text-white/25 transition-colors hover:text-white/65"
              >
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <GitBranch className="h-3 w-3 text-emerald-400/70" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">Plan · {scenes.length} scènes</span>
              </div>
              <div className="space-y-1">
                {scenes.slice(0, 5).map((scene, i) => (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setActiveScene(scene.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors',
                      scene.id === activeSceneId
                        ? 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/45 hover:bg-white/[0.05]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold',
                        scene.id === activeSceneId ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.06] text-white/30',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px]">{scene.name || `Scène ${i + 1}`}</span>
                    <span className="text-[9px] text-white/20">{scene.objects?.length ?? 0}</span>
                  </button>
                ))}
                {scenes.length > 5 ? (
                  <p className="py-1 text-center text-[10px] text-white/20">+ {scenes.length - 5} scènes</p>
                ) : null}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <ScrollText className="h-3 w-3 text-blue-400/70" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">Script · scène active</span>
              </div>
              {course && (course.slides || [])[activeSceneIdx] ? (
                <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.05] p-2.5">
                  <p className="mb-1 truncate text-[10px] font-semibold text-blue-300/80">
                    {course.slides[activeSceneIdx]?.title || `Étape ${activeSceneIdx + 1}`}
                  </p>
                  <p className="line-clamp-3 text-[10px] leading-relaxed text-white/40">
                    {course.slides[activeSceneIdx]?.script_mot_a_mot || course.slides[activeSceneIdx]?.masterscript || '—'}
                  </p>
                </div>
              ) : (
                <p className="py-2 text-center text-[10px] text-white/20">Aucun script — Course Builder.</p>
              )}
            </div>
            <div>
              <div className="mb-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">Outils pédagogiques</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PEDAGOGIC_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = activePedaTool === tool.id;
                  const aColor = ACCENT[tool.color];
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setActivePedaTool(isActive ? null : tool.id)}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1.5 rounded-xl border py-2.5 px-1 transition-all hover:scale-[1.02] active:scale-[0.98]',
                        isActive
                          ? [aColor.border, aColor.bg, aColor.glow]
                          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.05]',
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', isActive ? aColor.text : 'text-white/35')} />
                      <span
                        className={cn(
                          'whitespace-pre-line text-center text-[9px] font-medium leading-tight',
                          isActive ? aColor.text : 'text-white/40',
                        )}
                      >
                        {tool.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </details>
        ) : null}

        {/* Conversation LONGIA : visible seulement Suggestion + Action */}
        {showHubConversation ? (
        <div className="border-t border-amber-500/20 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-amber-400/90" />
              <div>
                <span className="text-[10px] font-bold text-white/80">Conversation</span>
                <p className="text-[8px] text-white/30">Même fil — barre du bas pour écrire</p>
              </div>
            </div>
            {longiaMessages.length > 1 ? (
              <button
                type="button"
                onClick={clearLongiaMessages}
                className="shrink-0 rounded-md border border-white/[0.08] px-2 py-1 text-[8px] font-medium text-white/40 transition-colors hover:border-white/15 hover:text-white/65"
              >
                Effacer
              </button>
            ) : null}
          </div>
          <div className="space-y-2.5">
            {showLongiaEmptyState ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5">
                <p className="text-[11px] font-semibold text-white/85">{emptyState.title}</p>
                <p className="mt-1 text-[9px] leading-relaxed text-white/50">{emptyState.message}</p>
                {emptyState.actions?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {emptyState.actions.map((label) => (
                      <span
                        key={label}
                        className="rounded-md border border-white/[0.1] bg-white/[0.05] px-2 py-0.5 text-[8px] font-medium text-white/45"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {longiaMessages
              .filter((msg) => !(showLongiaEmptyState && msg.id === 'init'))
              .map((msg) => (
                <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'ai' && (
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 ring-1 ring-amber-500/15">
                      <Sparkles className="h-3 w-3 text-amber-400" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[92%] rounded-xl px-3 py-2 text-[11px] leading-relaxed',
                      msg.role === 'ai'
                        ? 'border border-white/[0.07] bg-white/[0.06] text-white/70'
                        : 'border border-amber-500/20 bg-amber-500/12 text-amber-50/90',
                    )}
                  >
                    {msg.role === 'ai' ? (
                      <LongiaUnifiedReply
                        msg={msg}
                        onChip={handleLongiaChip}
                        maxPrimary={maxPrimaryActions}
                        variant="full"
                        hideResponseMeta
                      />
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
        ) : null}
      </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Console LONGIA visible lorsque le panneau AI Hub est replié : fil + actions + ouverture du hub.
 */
function LongiaCompactDock({ rightOffsetPx = 0, onExpandHub }) {
  const navigate = useNavigate();
  const longiaMessages = useSmartboardKonvaStore((s) => s.longiaMessages);
  const clearLongiaMessages = useSmartboardKonvaStore((s) => s.clearLongiaMessages);
  const addLongiaMessage = useSmartboardKonvaStore((s) => s.addLongiaMessage);
  const pushActionHistory = useAiHubStore((s) => s.pushActionHistory);
  const fluxRef = useRef(null);

  const handleLongiaChip = useCallback(
    (chip, msg) => {
      void runLongiaHubChipAction(chip, msg, { addLongiaMessage, pushActionHistory, navigate });
    },
    [addLongiaMessage, pushActionHistory, navigate],
  );

  useEffect(() => {
    const el = fluxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [longiaMessages]);

  const lastAi = useMemo(
    () => [...longiaMessages].reverse().find((m) => m.role === 'ai'),
    [longiaMessages],
  );
  const compactMaxActions = getLongiaActionStripMaxPrimary();
  const chips =
    lastAi && Array.isArray(lastAi.suggestions)
      ? lastAi.suggestions.slice(0, compactMaxActions)
      : [];
  const compactW = getLongiaHubPanelWidthPx();

  return (
    <div
      className="pointer-events-auto absolute z-[25] flex max-w-[100vw] flex-col overflow-hidden rounded-l-2xl border border-amber-500/30 border-r-0 bg-gradient-to-b from-[#16151f] to-[#0a0a0f] shadow-[0_4px_40px_rgba(0,0,0,0.5)]"
      style={{
        bottom: '3.5rem',
        right: rightOffsetPx,
        height: 'min(320px, 40vh)',
        width: `min(100vw, ${compactW}px)`,
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="truncate text-[10px] font-bold text-white/85">LONGIA</span>
          <span className="text-[8px] font-semibold uppercase text-white/35">compact</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {longiaMessages.length > 1 ? (
            <button
              type="button"
              onClick={clearLongiaMessages}
              className="rounded-md px-1.5 py-0.5 text-[8px] text-white/35 hover:bg-white/[0.06] hover:text-white/55"
            >
              Effacer
            </button>
          ) : null}
          <button
            type="button"
            onClick={onExpandHub}
            title="Ouvrir le hub complet"
            className="flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold text-amber-100/95 hover:bg-amber-500/25"
          >
            <PanelRightOpen className="h-3 w-3" />
            Hub
          </button>
        </div>
      </div>
      <div
        ref={fluxRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2 [scrollbar-width:thin]"
      >
        {longiaMessages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-1.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'ai' && (
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/80" />
            )}
            <div
              className={cn(
                'max-w-[94%] rounded-lg px-2 py-1.5 text-[10px] leading-relaxed',
                msg.role === 'ai'
                  ? 'border border-white/[0.06] bg-white/[0.05] text-white/65'
                  : 'border border-amber-500/18 bg-amber-500/10 text-amber-50/85',
              )}
            >
              {msg.role === 'ai' ? (
                <LongiaUnifiedReply
                  msg={msg}
                  onChip={handleLongiaChip}
                  maxPrimary={compactMaxActions}
                  variant="compact"
                />
              ) : (
                <p className="line-clamp-6 whitespace-pre-wrap break-words">{msg.text}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {chips.length > 0 ? (
        <div className="shrink-0 border-t border-cyan-500/20 bg-black/25 px-2.5 py-1.5">
          <p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-cyan-400/75">Dernière réponse</p>
          <div className="flex flex-wrap gap-1">
            {chips.map((s, i) => (
              <button
                key={`short_${lastAi.id}_${i}`}
                type="button"
                onClick={() => handleLongiaChip(s, lastAi)}
                className="rounded-md border border-cyan-500/35 bg-cyan-500/12 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-100/90 hover:bg-cyan-500/20"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PROPERTIES BAR — panneau contextuel attaché à la sélection
════════════════════════════════════════════════════════════════════ */

/** Convertit n'importe quelle couleur CSS en hex #rrggbb pour <input type="color"> */
function toHex(color) {
  if (!color || typeof color !== 'string') return '#888888';
  if (/^#[0-9a-fA-F]{3,6}$/.test(color)) return color.length === 4
    ? '#' + color.slice(1).split('').map(c => c + c).join('')
    : color;
  const m = color.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  return '#888888';
}

const TYPE_META = {
  text:    { label: 'Texte',    icon: Type,     color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20'    },
  rect:    { label: 'Rectangle',icon: Square,   color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20'  },
  circle:  { label: 'Cercle',   icon: Circle,   color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
  ellipse: { label: 'Ellipse',  icon: Disc,     color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
  line:    { label: 'Ligne',    icon: Minus,    color: 'text-white/60',    bg: 'bg-white/[0.06]',   border: 'border-white/15'       },
  arrow:   { label: 'Flèche',   icon: ArrowRight,color:'text-white/60',   bg: 'bg-white/[0.06]',   border: 'border-white/15'       },
  image:   { label: 'Image',    icon: ImageIcon,color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  html:    { label: 'Animé',    icon: Zap,      color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
};

const GOOGLE_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Roboto', 'Playfair Display', 'Roboto Mono', 'Oswald', 'Lato', 'Raleway', 'Georgia'];
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96, 120];
const IMAGE_LUTS = [
  { id: 'none',   label: 'Normal',  css: 'none' },
  { id: 'vivid',  label: 'Vivid',   css: 'saturate(1.8) contrast(1.1)' },
  { id: 'cold',   label: 'Froid',   css: 'saturate(0.8) hue-rotate(20deg) brightness(0.95)' },
  { id: 'warm',   label: 'Chaud',   css: 'sepia(0.3) saturate(1.4) brightness(1.05)' },
  { id: 'mono',   label: 'Mono',    css: 'grayscale(1) contrast(1.1)' },
  { id: 'fade',   label: 'Fade',    css: 'opacity(0.7) saturate(0.6) brightness(1.2)' },
  { id: 'cinema', label: 'Cinéma',  css: 'contrast(1.2) saturate(0.9) sepia(0.15)' },
  { id: 'neon',   label: 'Néon',    css: 'saturate(2) brightness(1.1) contrast(1.3)' },
];

function PropertiesBar() {
  const selectedIds   = useSmartboardKonvaStore(s => s.selectedIds);
  const activeSceneId = useSmartboardKonvaStore(s => s.project?.activeSceneId);
  const scenes        = useSmartboardKonvaStore(s => s.project?.scenes ?? []);
  const updateObject       = useSmartboardKonvaStore(s => s.updateObject);
  const deleteSelected     = useSmartboardKonvaStore(s => s.deleteSelected);
  const setObjectOpacity   = useSmartboardKonvaStore(s => s.setObjectOpacity);
  const toggleObjectLock   = useSmartboardKonvaStore(s => s.toggleObjectLock);
  const bringForward       = useSmartboardKonvaStore(s => s.bringForward);
  const sendBackward       = useSmartboardKonvaStore(s => s.sendBackward);

  const activeScene = scenes.find(s => s.id === activeSceneId);
  const obj = activeScene?.objects?.find(o => o.id === selectedIds[0]);

  if (!obj) return null;

  const type     = obj.type;
  const meta     = TYPE_META[type] ?? TYPE_META.rect;
  const MetaIcon = meta.icon;

  const update      = (partial)      => updateObject(obj.id, partial);
  const updateStyle = (stylePartial) => update({ style: stylePartial });

  const isText  = type === 'text';
  const isImage = type === 'image';
  const isShape = ['rect', 'circle', 'ellipse'].includes(type);
  const isLine  = ['line', 'arrow'].includes(type);
  const isHtml  = type === 'html';

  /* helpers */
  const Divider = () => <div className="mx-2 h-5 w-px bg-white/[0.07] shrink-0" />;
  const Lbl = ({ children }) => (
    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-white/22">{children}</span>
  );
  const IconBtn = ({ active, onClick, children, title, danger }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] transition-all',
        danger  ? 'border-white/[0.07] text-white/30 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400'
        : active ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
                 : 'border-white/[0.07] text-white/40 hover:border-white/20 hover:text-white/70',
      )}
    >
      {children}
    </button>
  );
  const NumInput = ({ value, onChange, min, max, step, width = 'w-12' }) => (
    <input
      type="number"
      min={min} max={max} step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className={cn(
        'h-7 rounded-lg border border-white/[0.08] bg-white/[0.04] px-1.5 text-center text-[11px] text-white/70 focus:border-cyan-500/40 focus:outline-none shrink-0',
        width,
        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
      )}
    />
  );
  const ColorSwatch = ({ value, onChange, title }) => (
    <label title={title} className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/15 hover:border-white/30 transition-colors">
      <div className="absolute inset-0" style={{ background: value || '#888' }} />
      <input type="color" value={toHex(value)} onChange={e => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
  );

  return (
    <motion.div
      key={obj.id}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 44, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden border-b border-white/[0.06] px-3 [scrollbar-width:none]"
      style={{ background: 'rgba(11,10,18,0.98)', backdropFilter: 'blur(14px)' }}
    >

      {/* ── TYPE BADGE ── */}
      <div className={cn('flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1', meta.bg, meta.border)}>
        <MetaIcon className={cn('h-3 w-3', meta.color)} />
        <span className={cn('text-[10px] font-semibold', meta.color)}>{meta.label}</span>
      </div>

      <Divider />

      {/* ══════════════════════════════════ TEXT ══════════════════════════════════ */}
      {isText && <>
        {/* Police */}
        <Lbl>Police</Lbl>
        <select
          value={obj.style?.fontFamily?.split(',')[0].trim().replace(/^['"]|['"]$/g, '') ?? 'Inter'}
          onChange={e => updateStyle({ fontFamily: `${e.target.value}, system-ui, sans-serif` })}
          className="h-7 shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 text-[11px] text-white/70 focus:outline-none"
        >
          {GOOGLE_FONTS.map(f => <option key={f} value={f} style={{ background: '#12111a' }}>{f}</option>)}
        </select>

        {/* Taille */}
        <select
          value={obj.style?.fontSize ?? 32}
          onChange={e => updateStyle({ fontSize: Number(e.target.value) })}
          className="h-7 w-14 shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-1.5 text-[11px] text-white/70 focus:outline-none"
        >
          {FONT_SIZES.map(s => <option key={s} value={s} style={{ background: '#12111a' }}>{s}</option>)}
        </select>

        {/* Gras */}
        <IconBtn active={(obj.style?.fontWeight ?? 400) >= 700} onClick={() => updateStyle({ fontWeight: (obj.style?.fontWeight ?? 400) >= 700 ? 400 : 700 })} title="Gras">
          <span className="font-bold">B</span>
        </IconBtn>

        {/* Italique */}
        <IconBtn active={obj.style?.fontStyle === 'italic'} onClick={() => updateStyle({ fontStyle: obj.style?.fontStyle === 'italic' ? 'normal' : 'italic' })} title="Italique">
          <span className="italic">I</span>
        </IconBtn>

        <Divider />

        {/* Alignement */}
        <Lbl>Align</Lbl>
        {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, Icon]) => (
          <IconBtn key={a} active={obj.style?.align === a} onClick={() => updateStyle({ align: a })} title={`Aligner ${a}`}>
            <Icon className="h-3.5 w-3.5" />
          </IconBtn>
        ))}

        <Divider />

        {/* Couleur texte */}
        <Lbl>Couleur</Lbl>
        <ColorSwatch value={obj.style?.fill ?? '#ffffff'} onChange={v => updateStyle({ fill: v })} title="Couleur du texte" />

        <Divider />

        {/* Interligne */}
        <Lbl>Ligne</Lbl>
        <NumInput value={obj.style?.lineHeight ?? 1.25} onChange={v => updateStyle({ lineHeight: v })} min={0.8} max={3} step={0.05} width="w-14" />

        {/* Espacement */}
        <Lbl>Espac.</Lbl>
        <NumInput value={obj.style?.letterSpacing ?? 0} onChange={v => updateStyle({ letterSpacing: v })} min={-5} max={20} step={0.5} width="w-14" />
      </>}

      {/* ══════════════════════════════════ IMAGE ══════════════════════════════════ */}
      {isImage && <>
        <Lbl>LUT</Lbl>
        {IMAGE_LUTS.map(lut => (
          <button key={lut.id} type="button"
            onClick={() => updateStyle({ filter: lut.css })}
            className={cn(
              'shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all',
              (obj.style?.filter ?? 'none') === lut.css
                ? 'border-cyan-500/35 bg-cyan-500/15 text-cyan-300'
                : 'border-white/[0.07] text-white/40 hover:border-white/18 hover:bg-white/[0.05] hover:text-white/70',
            )}>
            {lut.label}
          </button>
        ))}

        <Divider />

        <Lbl>Studio</Lbl>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/[0.08] px-2.5 py-1 text-[10px] text-violet-300 hover:bg-violet-500/15 transition-colors">
          <Wand2 className="h-3 w-3" /> Détourage
        </button>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-pink-500/25 bg-pink-500/[0.08] px-2.5 py-1 text-[10px] text-pink-300 hover:bg-pink-500/15 transition-colors">
          <Sparkles className="h-3 w-3" /> Supp. fond
        </button>

        <Divider />

        <Lbl>Flip</Lbl>
        <IconBtn onClick={() => updateStyle({ flipX: !(obj.style?.flipX) })} active={obj.style?.flipX} title="Miroir horizontal">
          <FlipHorizontal2 className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={() => updateStyle({ flipY: !(obj.style?.flipY) })} active={obj.style?.flipY} title="Miroir vertical">
          <FlipVertical2 className="h-3.5 w-3.5" />
        </IconBtn>

        <Divider />

        <Lbl>Rayon</Lbl>
        <NumInput value={obj.style?.cornerRadius ?? 0} onChange={v => updateStyle({ cornerRadius: v })} min={0} max={200} step={2} />
      </>}

      {/* ══════════════════════════════════ SHAPE ══════════════════════════════════ */}
      {isShape && <>
        <Lbl>Fond</Lbl>
        <ColorSwatch value={obj.style?.fill} onChange={v => updateStyle({ fill: v })} title="Couleur de remplissage" />

        <Divider />

        <Lbl>Contour</Lbl>
        <ColorSwatch value={obj.style?.stroke} onChange={v => updateStyle({ stroke: v })} title="Couleur du contour" />
        <NumInput value={obj.style?.strokeWidth ?? 0} onChange={v => updateStyle({ strokeWidth: v })} min={0} max={20} step={1} width="w-10" />

        {type === 'rect' && <>
          <Divider />
          <Lbl>Rayon</Lbl>
          <NumInput value={obj.style?.cornerRadius ?? 0} onChange={v => updateStyle({ cornerRadius: v })} min={0} max={200} step={2} />
        </>}

        <Divider />

        <Lbl>Flip</Lbl>
        <IconBtn onClick={() => updateStyle({ flipX: !(obj.style?.flipX) })} active={obj.style?.flipX} title="Miroir horizontal">
          <FlipHorizontal2 className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={() => updateStyle({ flipY: !(obj.style?.flipY) })} active={obj.style?.flipY} title="Miroir vertical">
          <FlipVertical2 className="h-3.5 w-3.5" />
        </IconBtn>

        <Divider />

        <Lbl>Décomposer</Lbl>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/45 hover:text-white/70 hover:bg-white/[0.07] transition-colors">
          <ScanLine className="h-3 w-3" /> Tracé
        </button>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/[0.07] px-2.5 py-1 text-[10px] text-violet-300 hover:bg-violet-500/12 transition-colors">
          <SlidersHorizontal className="h-3 w-3" /> Déformer
        </button>
      </>}

      {/* ══════════════════════════════════ LINE / ARROW ══════════════════════════════════ */}
      {isLine && <>
        <Lbl>Trait</Lbl>
        <ColorSwatch value={obj.style?.stroke ?? '#94a3b8'} onChange={v => updateStyle({ stroke: v, fill: v })} title="Couleur" />
        <NumInput value={obj.style?.strokeWidth ?? 3} onChange={v => updateStyle({ strokeWidth: v })} min={1} max={20} step={1} width="w-10" />

        <Divider />

        <Lbl>Style</Lbl>
        {[
          { id: 'solid',  label: '——',   dash: [] },
          { id: 'dashed', label: '- -',  dash: [12, 8] },
          { id: 'dotted', label: '· · ·',dash: [3, 8] },
        ].map(s => {
          const isCurrent = JSON.stringify(obj.style?.dash ?? []) === JSON.stringify(s.dash);
          return (
            <button key={s.id} type="button"
              onClick={() => updateStyle({ dash: s.dash })}
              className={cn(
                'shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-mono transition-all',
                isCurrent ? 'border-cyan-500/35 bg-cyan-500/15 text-cyan-300' : 'border-white/[0.07] text-white/40 hover:text-white/70',
              )}>
              {s.label}
            </button>
          );
        })}

        {type === 'arrow' && <>
          <Divider />
          <Lbl>Pointe</Lbl>
          <NumInput value={obj.style?.pointerLength ?? 10} onChange={v => updateStyle({ pointerLength: v, pointerWidth: v })} min={4} max={30} step={1} />
        </>}
      </>}

      {/* ══════════════════════════════════ HTML / ANIMATED ══════════════════════════════════ */}
      {isHtml && <>
        <Lbl>Animation</Lbl>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-1 text-[10px] text-amber-300 hover:bg-amber-500/15 transition-colors">
          <Zap className="h-3 w-3" /> Courbe
        </button>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/[0.08] px-2.5 py-1 text-[10px] text-violet-300 hover:bg-violet-500/15 transition-colors">
          <Box className="h-3 w-3" /> Keyframes
        </button>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/50 hover:text-white/70 transition-colors">
          <MessageSquare className="h-3 w-3" /> Éditer HTML
        </button>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] px-2.5 py-1 text-[10px] text-cyan-300 hover:bg-cyan-500/12 transition-colors">
          <Sparkles className="h-3 w-3" /> IA → anim
        </button>

        <Divider />

        <Lbl>Bord</Lbl>
        <NumInput value={obj.style?.borderRadius ?? 0} onChange={v => updateStyle({ borderRadius: v })} min={0} max={60} step={2} />
      </>}

      {/* ══════════════════════════════════ COMMUN ══════════════════════════════════ */}
      <Divider />

      {/* Opacité */}
      <Lbl>Opacité</Lbl>
      <input
        type="range" min={0} max={1} step={0.01}
        value={obj.opacity ?? 1}
        onChange={e => setObjectOpacity(obj.id, Number(e.target.value))}
        className="h-1 w-16 shrink-0 cursor-pointer accent-cyan-400"
      />
      <span className="w-7 shrink-0 text-[10px] text-white/35">{Math.round((obj.opacity ?? 1) * 100)}%</span>

      <Divider />

      {/* Calque */}
      <Lbl>Calque</Lbl>
      <IconBtn onClick={() => bringForward(obj.id)} title="Monter d'un calque">
        <ChevronUp className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn onClick={() => sendBackward(obj.id)} title="Descendre d'un calque">
        <ChevronDown className="h-3.5 w-3.5" />
      </IconBtn>

      <Divider />

      {/* Verrouiller */}
      <IconBtn
        active={obj.locked}
        onClick={() => toggleObjectLock(obj.id)}
        title={obj.locked ? 'Déverrouiller' : 'Verrouiller'}
      >
        {obj.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
      </IconBtn>

      {/* Supprimer */}
      <IconBtn danger onClick={() => deleteSelected()} title="Supprimer">
        <Trash2 className="h-3 w-3" />
      </IconBtn>

    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   NEW DOCUMENT SCREEN — sélecteur type + sorties
════════════════════════════════════════════════════════════════════ */
function NewDocumentScreen({ onCreate }) {
  const [selectedType, setSelectedType] = useState('smartboard');
  const [selectedOutputs, setSelectedOutputs] = useState(['screen']);
  const mobileRead = useMemo(() => getSmartboardMobileReadabilitySummary(), []);
  const tabletRead = useMemo(() => getSmartboardMobileReadabilitySummary({ tablet: true }), []);

  const toggleOutput = (id) => {
    setSelectedOutputs(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]
    );
  };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">

      {/* Grille de fond */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      {/* Rectangle animé */}
      <motion.div
        className="pointer-events-none absolute inset-10 rounded-3xl"
        animate={{
          borderColor: [
            'rgba(34,211,238,0.05)',
            'rgba(34,211,238,0.18)',
            'rgba(139,92,246,0.15)',
            'rgba(34,211,238,0.05)',
          ],
          boxShadow: [
            '0 0 0px rgba(34,211,238,0)',
            '0 0 40px rgba(34,211,238,0.07)',
            '0 0 40px rgba(139,92,246,0.05)',
            '0 0 0px rgba(34,211,238,0)',
          ],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ border: '1px solid' }}
      />

      {/* Contenu */}
      <div className="relative z-10 flex w-full max-w-[640px] flex-col items-center gap-8 px-6">

        {/* Titre */}
        <div className="text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/40 to-violet-500/40 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
              <Sparkles className="h-4 w-4 text-white/80" />
            </div>
          </div>
          <h2 className="text-[22px] font-bold tracking-tight text-white/88">Nouveau document</h2>
          <p className="mt-1 text-[13px] text-white/35">Choisissez le type et les sorties de votre création</p>
        </div>

        {/* Sélecteur de type — 5 types en 2 rangées (3 + 2) */}
        <div className="w-full space-y-2.5">
          {/* Rangée 1 — Smartboard · Présentation · Document */}
          <div className="grid grid-cols-3 gap-3">
            {DOC_TYPES.slice(0, 3).map(dt => {
              const Icon = dt.icon;
              const a = ACCENT[dt.color];
              const selected = selectedType === dt.id;
              return (
                <button
                  key={dt.id}
                  onClick={() => setSelectedType(dt.id)}
                  className={cn(
                    'group flex flex-col items-center gap-2.5 rounded-2xl border px-3 py-4 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]',
                    selected
                      ? [a.bg, a.border, a.glow]
                      : 'border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/14',
                  )}
                >
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl transition-all',
                    selected ? [a.bg, 'shadow-lg'] : 'bg-white/[0.05]',
                  )}>
                    <Icon className={cn('h-5 w-5 transition-colors', selected ? a.text : 'text-white/30 group-hover:text-white/50')} />
                  </div>
                  <div>
                    <p className={cn('text-[12px] font-semibold transition-colors', selected ? a.text : 'text-white/70')}>{dt.label}</p>
                    <p className="mt-0.5 text-[9px] text-white/28">{dt.sub}</p>
                  </div>
                  <p className="line-clamp-2 text-[9.5px] leading-relaxed text-white/38">{dt.desc}</p>
                </button>
              );
            })}
          </div>
          {/* Rangée 2 — Affiche · Vidéo (centrés) */}
          <div className="grid grid-cols-2 gap-3">
            {DOC_TYPES.slice(3).map(dt => {
              const Icon = dt.icon;
              const a = ACCENT[dt.color];
              const selected = selectedType === dt.id;
              return (
                <button
                  key={dt.id}
                  onClick={() => setSelectedType(dt.id)}
                  className={cn(
                    'group flex flex-col items-center gap-2.5 rounded-2xl border px-3 py-4 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]',
                    selected
                      ? [a.bg, a.border, a.glow]
                      : 'border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/14',
                  )}
                >
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl transition-all',
                    selected ? [a.bg, 'shadow-lg'] : 'bg-white/[0.05]',
                  )}>
                    <Icon className={cn('h-5 w-5 transition-colors', selected ? a.text : 'text-white/30 group-hover:text-white/50')} />
                  </div>
                  <div>
                    <p className={cn('text-[12px] font-semibold transition-colors', selected ? a.text : 'text-white/70')}>{dt.label}</p>
                    <p className="mt-0.5 text-[9px] text-white/28">{dt.sub}</p>
                  </div>
                  <p className="line-clamp-2 text-[9.5px] leading-relaxed text-white/38">{dt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sorties */}
        <div className="w-full">
          <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-white/22">Sorties du document</p>
          <div className="flex flex-wrap gap-2">
            {OUTPUT_TARGETS.map(t => {
              const Icon = t.icon;
              const active = selectedOutputs.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleOutput(t.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium transition-all',
                    active
                      ? 'border-cyan-500/35 bg-cyan-500/15 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.12)]'
                      : t.optional
                        ? 'border-dashed border-white/12 text-white/28 hover:border-white/28 hover:text-white/55'
                        : 'border-white/[0.07] bg-white/[0.03] text-white/42 hover:bg-white/[0.07] hover:text-white/70',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.label}</span>
                  <span className="text-white/22 text-[9px]">{t.w}×{t.h}</span>
                </button>
              );
            })}
          </div>
          {selectedOutputs.includes('mobile') && (
            <p className="mt-2.5 rounded-lg border border-cyan-500/15 bg-cyan-500/[0.04] px-2.5 py-2 text-[9px] leading-relaxed text-white/50">
              <span className="font-semibold text-cyan-200/90">Aperçu invité (vertical)</span>
              {' '}
              — {mobileRead.hint} Zone scène ≈ {mobileRead.availableStage.width}×{mobileRead.availableStage.height} px, échelle
              ≈ {mobileRead.scaleContainPercent} % (canevas 1037×750 inchangé, mis à l’échelle en contain).
            </p>
          )}
          {selectedOutputs.includes('tablet') && (
            <p className="mt-2.5 rounded-lg border border-violet-500/15 bg-violet-500/[0.04] px-2.5 py-2 text-[9px] leading-relaxed text-white/50">
              <span className="font-semibold text-violet-200/90">Tablette</span>
              {' '}
              — {tabletRead.hint} Zone scène ≈ {tabletRead.availableStage.width}×{tabletRead.availableStage.height} px, échelle
              ≈ {tabletRead.scaleContainPercent} %.
            </p>
          )}
        </div>

        {/* Bouton créer */}
        <button
          onClick={() => onCreate(selectedType, selectedOutputs)}
          className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500/75 to-violet-500/75 px-10 py-3.5 text-[14px] font-bold text-white shadow-[0_0_28px_rgba(34,211,238,0.2)] transition-all hover:shadow-[0_0_38px_rgba(34,211,238,0.35)] hover:scale-[1.03] active:scale-[0.99]"
        >
          <Sparkles className="h-4.5 w-4.5" />
          Créer le document
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   BOTTOM BAR — timeline + AI input
════════════════════════════════════════════════════════════════════ */
function BottomBar({
  designerMode = 'design',
  docType = null,
  workspaceCloudId = null,
  workspaceCloudTitle = '',
  outputFormats = [],
}) {
  const scenes = useSmartboardKonvaStore(s => s.project?.scenes ?? []);
  const activeSceneId = useSmartboardKonvaStore(s => s.project?.activeSceneId);
  const setActiveScene = useSmartboardKonvaStore(s => s.setActiveScene);
  const addScene = useSmartboardKonvaStore(s => s.addScene);
  const addLongiaMessage = useSmartboardKonvaStore(s => s.addLongiaMessage);
  const selectedIds = useSmartboardKonvaStore(s => s.selectedIds);
  const studioQuickMode = useAiHubStore(s => s.studioQuickMode);
  const setLongiaChatSending = useAiHubStore((s) => s.setLongiaChatSending);
  const courseTitle = useCourseCopilotStore((s) => {
    const t = s.course?.title;
    return t && String(t).trim() ? String(t).trim() : undefined;
  });
  const [chatInput, setChatInput] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [chatSending, setChatSending] = useState(false);

  const handleSend = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatSending) return;
    setChatInput('');

    const docCoach = useDocumentCoachStore.getState();
    if (docCoach.isDocumentMode) {
      const { phase } = docCoach;
      if (phase === 'questioning') {
        docCoach.answerQuestion(msg);
        return;
      }
      if (phase === 'idle' || phase === 'detecting') {
        docCoach.detectIntent(msg);
        return;
      }
      if (phase === 'editing') {
        docCoach.requestRewrite(msg, 'formalize');
        return;
      }
    }

    addLongiaMessage({ role: 'user', text: msg });

    const scene = scenes.find((s) => s.id === activeSceneId);
    const llmMode = studioQuickMode === 'architect' ? 'architect' : 'coach';

    const copilotState = useCourseCopilotStore.getState();
    const konvaState = useSmartboardKonvaStore.getState();
    const hubState = useAiHubStore.getState();
    const coachSnap = useDocumentCoachStore.getState();

    const embedLongia = getEmbeddedAppContextForLongia();
    const context = buildLongiaStudioContext({
      designerMode,
      docType,
      studioQuickMode,
      llmMode,
      workspaceCloudId,
      workspaceCloudTitle,
      outputFormats,
      course: copilotState.course,
      courseTitleFallback: courseTitle,
      activeSlideIndex: copilotState.activeSlideIndex,
      scenes: konvaState.project?.scenes,
      activeSceneId: konvaState.project?.activeSceneId,
      canvas: konvaState.project?.canvas,
      selectedIds,
      documentCoach: coachSnap.isDocumentMode
        ? { isDocumentMode: true, phase: coachSnap.phase }
        : null,
      lastRouting: hubState.lastLongiaRouting,
      appContext: embedLongia.embeddedControlActive
        ? { embeddedControlActive: true, appName: embedLongia.appName }
        : undefined,
    });

    setChatSending(true);
    setLongiaChatSending(true);
    try {
      const history = useSmartboardKonvaStore
        .getState()
        .longiaMessages.filter((m) => m.role === 'user' || m.role === 'ai')
        .slice(-14)
        .map((m) => ({
          role: m.role === 'user' ? /** @type {'user'} */ ('user') : /** @type {'assistant'} */ ('assistant'),
          content: m.text,
        }));

      const data = await invokeLongiaHub(supabase, {
        mode: llmMode,
        messages: history,
        context,
        longiaHub: buildLongiaHubV1({
          surface: LONGIA_SURFACE.STUDIO_KONVA,
          mode: llmMode === 'architect' ? 'architect' : 'coach',
          engines: [llmMode === 'architect' ? LONGIA_ENGINE_ROLE.ARCHITECT : LONGIA_ENGINE_ROLE.COACH],
          capabilities: [LONGIA_CAPABILITY.CANVAS_ACTIONS_KONVA],
        }),
      });
      const display = String(data?.text ?? '').trim();
      const localRich = buildLocalLongiaRichReply(msg, scene, selectedIds, {
        getLabel: (t) => ELEMENT_META[t]?.label ?? 'élément',
      });
      const textFinal = display || localRich.text;
      const hasCloud = Boolean(display);
      const payload = hasCloud
        ? mergeApiLongiaForStore(data, textFinal)
        : enrichLocalLongiaForStore(localRich);
      addLongiaMessage({
        role: 'ai',
        text: payload.text,
        suggestions: payload.suggestions,
        longiaUnified: payload.longiaUnified,
        longiaComposed: payload.longiaComposed,
        intent: payload.intent,
        strategy: payload.strategy,
        payload: payload.payload,
        tone_mode: payload.tone_mode,
      });
      if (hasCloud && data?.routing && typeof data.routing === 'object') {
        useAiHubStore.getState().setLastLongiaRouting(data.routing);
      }
    } catch {
      const localRich = buildLocalLongiaRichReply(msg, scene, selectedIds, {
        getLabel: (t) => ELEMENT_META[t]?.label ?? 'élément',
      });
      const payload = enrichLocalLongiaForStore(localRich);
      addLongiaMessage({
        role: 'ai',
        text: payload.text,
        suggestions: payload.suggestions,
        longiaUnified: payload.longiaUnified,
        longiaComposed: payload.longiaComposed,
        intent: payload.intent,
        strategy: payload.strategy,
        payload: payload.payload,
        tone_mode: payload.tone_mode,
      });
    } finally {
      setChatSending(false);
      setLongiaChatSending(false);
    }
  }, [
    chatInput,
    chatSending,
    setLongiaChatSending,
    designerMode,
    docType,
    workspaceCloudId,
    workspaceCloudTitle,
    scenes,
    activeSceneId,
    selectedIds,
    studioQuickMode,
    courseTitle,
    outputFormats,
    addLongiaMessage,
  ]);

  const modeAccent = {
    design: { border: 'border-cyan-500/30', bg: 'bg-cyan-500/15', text: 'text-cyan-400', glow: 'shadow-[0_0_8px_rgba(34,211,238,0.2)]' },
    live:   { border: 'border-red-500/30',  bg: 'bg-red-500/15',  text: 'text-red-400',  glow: 'shadow-[0_0_8px_rgba(239,68,68,0.2)]' },
    video:  { border: 'border-amber-500/30',bg: 'bg-amber-500/15',text: 'text-amber-400',glow: 'shadow-[0_0_8px_rgba(245,158,11,0.2)]' },
    cinema: { border: 'border-violet-500/30',bg: 'bg-violet-500/15',text: 'text-violet-400',glow: 'shadow-[0_0_8px_rgba(139,92,246,0.2)]' },
  };
  const accent = modeAccent[designerMode] ?? modeAccent.design;

  const bottomBarH = getBottomBarHeightPx();

  return (
    <div
      className="flex min-h-0 flex-shrink-0 items-center gap-2 border-t border-white/[0.06] px-3 py-1.5"
      style={{ minHeight: bottomBarH, background: 'rgba(11,10,18,0.98)', backdropFilter: 'blur(16px)' }}
    >
      {/* ── Timeline contrôles ── */}
      <div className="flex items-center gap-1 shrink-0">
        <button className="flex h-6 w-6 items-center justify-center rounded-md text-white/25 hover:text-white/60 transition-all">
          <SkipForward className="h-3 w-3 rotate-180" />
        </button>
        <button className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
          accent.border, accent.bg, accent.text, 'hover:opacity-80',
        )}>
          <Play className="h-3 w-3 ml-0.5" />
        </button>
        <button className="flex h-6 w-6 items-center justify-center rounded-md text-white/25 hover:text-white/60 transition-all">
          <SkipForward className="h-3 w-3" />
        </button>
      </div>

      <div className="mx-1 h-5 w-px bg-white/[0.07] shrink-0" />

      {/* ── Scènes filmstrip ── */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {scenes.map((scene, i) => {
          const isActive = scene.id === activeSceneId;
          return (
            <button
              key={scene.id}
              onClick={() => setActiveScene(scene.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition-all',
                isActive
                  ? cn(accent.border, accent.bg, accent.text, accent.glow)
                  : 'border-white/[0.07] bg-white/[0.02] text-white/30 hover:border-white/15 hover:text-white/55',
              )}
            >
              <span className={cn(
                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-[8px] font-bold',
                isActive ? cn('bg-white/15', accent.text) : 'bg-white/[0.05] text-white/30',
              )}>
                {i + 1}
              </span>
              <span className="max-w-[60px] truncate">{scene.name || `Scène ${i + 1}`}</span>
            </button>
          );
        })}
        <button
          onClick={() => addScene()}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-white/20 transition-all hover:border-white/30 hover:text-white/45"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="mx-1 h-5 w-px bg-white/[0.07] shrink-0" />

      {/* ── LONGIA input ── */}
      <div className="flex w-56 shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5">
        <span className="shrink-0 text-[9px] font-bold text-amber-400">✦</span>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(); }}
          placeholder={getBottomBarPlaceholder()}
          disabled={chatSending}
          className="min-w-0 flex-1 bg-transparent text-[10px] text-white/70 outline-none placeholder:text-white/20 disabled:opacity-45"
        />
        <button
          type="button"
          onClick={() => setMicActive(v => !v)}
          className={cn('shrink-0 transition-colors', micActive ? 'text-blue-400' : 'text-white/20 hover:text-white/50')}
        >
          <Mic className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={chatSending}
          className="shrink-0 text-white/20 transition-colors hover:text-amber-400 disabled:pointer-events-none disabled:opacity-35"
          title={chatSending ? 'Envoi…' : 'Envoyer'}
        >
          {chatSending ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
        </button>
      </div>

      <div className="mx-1 h-5 w-px bg-white/[0.07] shrink-0" />

      {/* ── Compteur scènes + label mode ── */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[10px] text-white/20">
          {scenes.findIndex(s => s.id === activeSceneId) + 1} / {scenes.length}
        </span>
        <span className={cn('hidden rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider sm:inline', accent.border, accent.bg, accent.text)}>
          {designerMode}
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════════════════════ */
export default function StudioSmartboardKonvaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteToken = searchParams.get('cw_invite');
  const ppQuery = searchParams.get('pp');
  const returnToHref = useMemo(
    () => safeReturnToFromQuery(searchParams.get('returnTo')),
    [searchParams],
  );
  const isCinemaPedagogy =
    location.pathname.includes('smartboard-cinema') || searchParams.get('mode') === 'cinema';

  const [postProdOpen, setPostProdOpen] = useState(
    () => Boolean(ppQuery && isFormationContentUuid(ppQuery)),
  );
  const [postProdContentId, setPostProdContentId] = useState(() =>
    ppQuery && isFormationContentUuid(ppQuery) ? ppQuery : '',
  );

  const designerBackHref = useMemo(() => {
    if (postProdContentId && isFormationContentUuid(postProdContentId)) {
      return safeDesignerReturnPathForState(
        `/studio/smartboard-designer?pp=${encodeURIComponent(postProdContentId)}`,
      );
    }
    return safeDesignerReturnPathForState('/studio/smartboard-designer');
  }, [postProdContentId]);

  /* Shell state */
  const [activeTool, setActiveTool] = useState(null);
  /** Surlignage outil « Enregistrer » quand une prise est en cours (barre ou sidebar). */
  const [cinemaRecording, setCinemaRecording] = useState(false);
  const [aiHubOpen, setAiHubOpen] = useState(true);
  const [collabPresence, setCollabPresence] = useState(() => ({
    enabled: false,
    members: [],
    roomId: '',
  }));
  const [viewMode, setViewMode] = useState('desktop');
  const [fullscreen, setFullscreen] = useState(false);
  const docType = useDesignerShellStore((s) => s.docType);
  const setDocType = useDesignerShellStore((s) => s.setDocType);
  const outputFormats = useDesignerShellStore((s) => s.outputFormats);
  const setOutputFormats = useDesignerShellStore((s) => s.setOutputFormats);
  const designerMode = useDesignerShellStore((s) => s.designerMode);
  const setDesignerMode = useDesignerShellStore((s) => s.setDesignerMode);
  const cloudWorkspaceId = useDesignerShellStore((s) => s.cloudWorkspaceId);
  const cloudWorkspaceTitle = useDesignerShellStore((s) => s.cloudWorkspaceTitle);
  const [quickLauncherOpen, setQuickLauncherOpen] = useState(false);
  const [documentLauncherOpen, setDocumentLauncherOpen] = useState(false);

  /* ── Context Engine : adapte le canvas + LONGIA au type de document ── */
  const setCanvasDimensions  = useSmartboardKonvaStore(s => s.setCanvasDimensions);
  const addObjects           = useSmartboardKonvaStore(s => s.addObjects);
  const setCanvasBackground  = useSmartboardKonvaStore(s => s.setCanvasBackground);
  const _addLongiaMsgCtx    = useSmartboardKonvaStore(s => s.addLongiaMessage);
  useEffect(() => {
    if (!docType) return;
    const dims = CANVAS_DIMS[docType];
    if (dims) setCanvasDimensions(dims.w, dims.h);
    // Ouvre le launcher administratif quand on sélectionne le type document
    if (docType === 'document') {
      setCanvasBackground('#ffffff');
      setDocumentLauncherOpen(true);
      // Active le Coach Documentaire (après le launcher)
      setTimeout(() => useDocumentCoachStore.getState().activateDocumentMode(), 300);
    } else {
      // Désactiver le coach si on quitte le mode document
      useDocumentCoachStore.getState().deactivateDocumentMode();
    }
    // LONGIA context switch message
    const dtMeta = DOC_TYPES.find(d => d.id === docType);
    const ctxMsgs = {
      smartboard:   `✦ Studio SmartBoard activé — canvas 1920×1080, outils de présentation interactive chargés.`,
      presentation: `✦ Studio Présentation activé — outils diapositives disponibles : titres, médias, dispositions, animations.`,
      document:     `✦ Studio Document activé — canvas A4 (${dims?.w}×${dims?.h}px). Choisissez un mode de démarrage dans le lanceur.`,
      affiche:      `✦ Studio Affiche activé — format A4 impression (${dims?.w}×${dims?.h}px @300dpi). Idéal pour l'impression ou la diffusion numérique.`,
      video:        `✦ Studio Vidéo activé — 1920×1080. Post-production et montage disponibles via l'outil Capture (barre gauche).`,
    };
    const ctxMsg = ctxMsgs[docType] ?? `✦ Type "${dtMeta?.label ?? docType}" activé.`;
    _addLongiaMsgCtx({ role: 'ai', text: ctxMsg });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType]);

  /* Observe la sélection canvas pour ouvrir le panneau contextuel automatiquement */
  const canvasHasSelection = useSmartboardKonvaStore(s => s.selectedIds.length > 0);
  const selectAllInActiveScene = useSmartboardKonvaStore((s) => s.selectAllInActiveScene);

  /* ── LONGIA Observer : réagit aux changements de sélection ── */
  const _longiaSel = useSmartboardKonvaStore(s => s.selectedIds);
  const _longiaScenes = useSmartboardKonvaStore(s => s.project?.scenes ?? []);
  const _longiaActiveId = useSmartboardKonvaStore(s => s.project?.activeSceneId);
  const _addLongiaMsg = useSmartboardKonvaStore(s => s.addLongiaMessage);
  const _prevSelRef = useRef([]);
  const _seenTypesRef = useRef(new Set());

  useEffect(() => {
    const prev = _prevSelRef.current;
    const curr = _longiaSel;
    /* Nouvelle sélection (0 → 1 élément) */
    if (curr.length === 1 && prev.length === 0) {
      const scene = _longiaScenes.find(s => s.id === _longiaActiveId);
      const obj = scene?.objects?.find(o => o.id === curr[0]);
      if (obj) {
        const typeName = ELEMENT_META[obj.type]?.label ?? 'élément';
        const isFirstTimeType = !_seenTypesRef.current.has(obj.type);
        _seenTypesRef.current.add(obj.type);
        /* Premier contact avec ce type → message d'aide, sinon message court */
        const text = isFirstTimeType
          ? `✦ ${typeName} sélectionné — ses propriétés apparaissent dans le panneau de gauche.`
          : `✦ ${typeName} sélectionné.`;
        _addLongiaMsg({ role: 'ai', text });
      }
    }
    _prevSelRef.current = curr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_longiaSel]);

  const handleImportFile = useCallback(async (file) => {
    if (!file) return;
    const t = (file.type || '').toLowerCase();
    const name = file.name || '';
    const isImage = t.startsWith('image/');
    const isJson = t.includes('json') || /\.json$/i.test(name);
    try {
      if (isImage) {
        const { url, path } = await uploadSmartboardCanvasImage(file);
        try {
          await insertDesignerUploadMetadata(supabase, { storagePath: path, prompt: name, publicUrl: url });
        } catch (e) { /* non-bloquant : métadonnée optionnelle */ void e; }
        addObjects([mkImageObject(url, { x: 120, y: 120, width: 560, height: 320, layer: 2 })]);
        _addLongiaMsgCtx({
          role: 'ai',
          text: `✦ Image « ${name} » importée sur le canvas.`,
        });
      } else if (isJson) {
        const text = await file.text();
        const payload = JSON.parse(text);
        /* Payload reconnu comme workspace LIRI ou comme projet Konva simple */
        const asWorkspace = payload?.scenes || payload?.project?.scenes;
        if (asWorkspace) {
          hydrateWorkspaceIntoKonvaEditor(payload);
          _addLongiaMsgCtx({
            role: 'ai',
            text: `✦ Projet « ${name} » chargé dans l'éditeur.`,
          });
        } else {
          setFormatNotice(`Le fichier JSON « ${name} » n'a pas la structure attendue (scenes/projet).`);
        }
      } else {
        setFormatNotice(
          `Format « ${t || name.split('.').pop() || 'inconnu'} » non encore pris en charge par l'import rapide. Utilisez le panneau Import pour PDF / .docx / .pptx.`,
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[QuickLauncher] import fichier échoué', e);
      setFormatNotice(`Import impossible : ${e?.message || 'erreur inconnue'}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addObjects]);

  /** Appelé par DocumentStudioLauncher quand l'utilisateur choisit un mode/template */
  const handleDocumentLaunch = useCallback((mode, templateId, objects, bg, answers) => {
    if (bg) setCanvasBackground(bg);
    if (objects?.length) addObjects(objects);
    setDocumentLauncherOpen(false);
    // Feedback LONGIA
    const modeLabel = { template: 'modèle', canvas: 'Canvas Intelligent', assistant: 'Assistant guidé', libre: 'Mode Libre' }[mode] ?? mode;
    _addLongiaMsgCtx({
      role: 'ai',
      text: `✦ Document initialisé en ${modeLabel}${templateId ? ` — ${templateId}` : ''}. Vos blocs sont prêts à être édités.`,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addObjects, setCanvasBackground]);

  /* Konva state */
  const [inviteBanner, setInviteBanner] = useState('');
  const [cloudBootstrap, setCloudBootstrap] = useState(null);
  const [initialKonvaProject, setInitialKonvaProject] = useState(null);
  const [formatNotice, setFormatNotice] = useState('');
  const [isnaImportSummary, setIsnaImportSummary] = useState(null);

  const konvaEditorRef = useRef(null);
  const cinemaBarRef = useRef(
    /** @type {{ toggleRecording: () => void; stopRecording: () => void } | null} */ (null),
  );
  const postProdDockRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const didCollapseHubForPpRef = useRef(false);
  const [postProdDockWidth, setPostProdDockWidth] = useState(0);

  /* ── Import LIRI Agent ── */
  useEffect(() => {
    const isnaHandoff = consumeIsnaPhase3Handoff();
    const handoffCours = isnaHandoff?.courseJson;
    if (handoffCours && typeof handoffCours === 'object' && Array.isArray(handoffCours.etapes) && handoffCours.etapes.length) {
      const transcriptLines = Array.isArray(isnaHandoff.transcript) ? isnaHandoff.transcript : [];
      const transcriptText = transcriptLines
        .map((line) => String(line?.text || '').trim())
        .filter(Boolean)
        .join('\n');
      const sourceText = transcriptText || buildLiriCourseTextForLiveStudio(handoffCours);
      const course = buildLiriCourseCopilotCourseFromAgent(handoffCours);
      useCourseCopilotStore.getState().hydrateFromExport({
        sourceText,
        course,
        activeSlideIndex: 0,
        globalSuggestions: null,
      });
      const kp = buildKonvaProjectFromLiriAgentCours(handoffCours);
      setInitialKonvaProject(kp?.scenes?.length ? kp : null);
      setFormatNotice('Import phase 3 chargé dans le Designer.');
      setIsnaImportSummary({
        source: String(isnaHandoff?.source || 'isna-pipeline'),
        runId: isnaHandoff?.runId ? String(isnaHandoff.runId) : '',
        stepsCount: handoffCours.etapes.length,
        savedAtLabel: isnaHandoff?.savedAt ? new Date(isnaHandoff.savedAt).toLocaleString() : '',
      });
      setDocType('smartboard');
      setOutputFormats(['screen']);
      navigate(`${location.pathname}${location.search || ''}`, { replace: true, state: {} });
      return;
    }

    const fromState = location.state?.liriToKonva?.cours;
    let cours = null;
    if (fromState && typeof fromState === 'object') {
      cours = fromState;
      try { localStorage.removeItem(LIRI_AGENT_TO_KONVA_STORAGE_KEY); } catch { /* ok */ }
    } else {
      cours = consumeLiriAgentCoursForKonvaDesigner();
    }
    if (!cours || typeof cours !== 'object') return;
    setIsnaImportSummary(null);
    const sourceText = buildLiriCourseTextForLiveStudio(cours);
    const course = buildLiriCourseCopilotCourseFromAgent(cours);
    useCourseCopilotStore.getState().hydrateFromExport({ sourceText, course, activeSlideIndex: 0, globalSuggestions: null });
    const kp = buildKonvaProjectFromLiriAgentCours(cours);
    setInitialKonvaProject(kp?.scenes?.length ? kp : null);
    setFormatNotice('');
    /* Éviter l’overlay « Nouveau document » qui masquait tout l’éditeur après import Agent LIRI */
    setDocType('smartboard');
    setOutputFormats(['screen']);
    navigate(`${location.pathname}${location.search || ''}`, { replace: true, state: {} });
  }, [location.pathname, location.search, location.state, navigate, setDocType, setOutputFormats]);

  /* ── Clear invite query ── */
  const clearInviteQuery = useCallback(() => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('cw_invite'); return n; }, { replace: true });
  }, [setSearchParams]);

  const onCloudBootstrapConsumed = useCallback(() => setCloudBootstrap(null), []);

  useEffect(() => {
    const p = searchParams.get('pp');
    if (p && isFormationContentUuid(p)) {
      setPostProdContentId(p);
      setPostProdOpen(true);
    }
  }, [searchParams]);

  /** À l’ouverture avec `?pp=`, refermer LONGIA une fois pour éviter canvas + dock + hub trop étroit. */
  useEffect(() => {
    const p = searchParams.get('pp');
    if (!p || !isFormationContentUuid(p) || didCollapseHubForPpRef.current) return;
    didCollapseHubForPpRef.current = true;
    setAiHubOpen(false);
  }, [searchParams]);

  useEffect(() => {
    if (!postProdOpen) {
      setPostProdDockWidth(0);
      return undefined;
    }
    const el = postProdDockRef.current;
    if (!el) return undefined;
    const apply = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setPostProdDockWidth(Math.round(w));
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => apply()) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [postProdOpen, postProdContentId]);

  const onPostProdContentIdChange = useCallback(
    (id) => {
      const next = String(id || '').trim();
      setPostProdContentId(next);
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (next && isFormationContentUuid(next)) n.set('pp', next);
          else n.delete('pp');
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const closePostProdDock = useCallback(() => {
    setPostProdOpen(false);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete('pp');
        n.delete('returnTo');
        return n;
      },
      { replace: true },
    );
    setPostProdContentId('');
  }, [setSearchParams]);

  const togglePostProdDock = useCallback(() => {
    if (postProdOpen) {
      closePostProdDock();
    } else {
      setPostProdOpen(true);
      // Ferme le Hub IA pour laisser de la place au dock post-prod
      setAiHubOpen(false);
    }
  }, [postProdOpen, closePostProdDock]);

  const openLongiaHubToSuggest = useCallback(() => {
    useAiHubStore.getState().requestAiHubTab('suggest');
    setAiHubOpen(true);
  }, []);

  useEffect(() => {
    if (isCinemaPedagogy) setDesignerMode('cinema');
  }, [isCinemaPedagogy, setDesignerMode]);

  const toolSidebarActive =
    designerMode === 'cinema' && cinemaRecording ? 'record' : activeTool;

  const handleTool = useCallback(
    (toolId) => {
      if (designerMode === 'cinema') {
        if (cinemaRecording && toolId != null && toolId !== 'record') {
          cinemaBarRef.current?.stopRecording();
        }
        if (toolId === 'record') {
          cinemaBarRef.current?.toggleRecording();
          return;
        }
        if (toolId === null && toolSidebarActive === 'record') {
          cinemaBarRef.current?.stopRecording();
          return;
        }
      }
      setActiveTool(toolId);
    },
    [designerMode, cinemaRecording, toolSidebarActive],
  );

  useEffect(() => {
    if (designerMode !== 'cinema') {
      cinemaBarRef.current?.stopRecording?.();
      setCinemaRecording(false);
    }
  }, [designerMode]);

  /* ── Auto-save ── */
  useEffect(() => {
    const persist = () => {
      try {
        const payload = buildWorkspacePayloadFromStores();
        localStorage.setItem(LIRI_COURSE_WORKSPACE_LOCAL_KEY, JSON.stringify(payload));
      } catch { /* quota */ }
    };
    const id = window.setInterval(persist, LOCAL_AUTOSAVE_MS);
    window.addEventListener('beforeunload', persist);
    return () => { clearInterval(id); window.removeEventListener('beforeunload', persist); };
  }, []);

  const workspaceUrlId = searchParams.get('workspace') || searchParams.get('cw');
  const workspaceUrlLoadedRef = useRef(null);

  /* ── Ouvrir un workspace cloud depuis ?workspace= / ?cw= (données réelles Supabase) ── */
  useEffect(() => {
    if (!workspaceUrlId || !isWorkspaceUuid(workspaceUrlId)) {
      workspaceUrlLoadedRef.current = null;
      return undefined;
    }
    if (workspaceUrlLoadedRef.current === workspaceUrlId) return undefined;
    let cancelled = false;
    (async () => {
      setFormatNotice('');
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { row, error } = await fetchLiriCourseWorkspaceById(workspaceUrlId);
      if (cancelled) return;
      if (error || !row) {
        setFormatNotice(error?.message || 'Workspace introuvable.');
        return;
      }
      let payload;
      try {
        payload = assertWorkspacePayload(row.payload);
      } catch (e) {
        setFormatNotice(e instanceof Error ? e.message : 'Payload invalide');
        return;
      }
      hydrateWorkspaceIntoKonvaEditor(payload);
      workspaceUrlLoadedRef.current = workspaceUrlId;
      const owner = row.user_id === data.session.user.id;
      setCloudBootstrap({
        workspaceId: row.id,
        title: row.title || '',
        accessRole: owner ? 'editor' : 'viewer',
      });
      useDesignerShellStore.getState().setCloudMeta({ id: row.id, title: row.title || '' });
      setInitialKonvaProject(null);
      const pp = payload.polotnoProject;
      if (!payload.konvaProject?.scenes?.length && pp?.pages?.length) {
        setFormatNotice(LEGACY_POLOTNO_NOTICE);
      } else {
        setFormatNotice('');
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceUrlId]);

  /* ── Workspace invite ── */
  useEffect(() => {
    if (!inviteToken?.trim()) return undefined;
    let cancelled = false;
    (async () => {
      setInviteBanner(''); setFormatNotice('');
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setInviteBanner("Connectez-vous d'abord — le paramètre URL est conservé.");
        return;
      }
      const { result, error } = await redeemWorkspaceInvite(inviteToken);
      if (cancelled) return;
      if (error) { setInviteBanner(error.message); clearInviteQuery(); return; }
      if (!result?.ok) {
        setInviteBanner(result?.error === 'invalid_or_expired' ? 'Lien invalide ou expiré.' : String(result?.error || 'Invitation refusée.'));
        clearInviteQuery(); return;
      }
      const wid = result.workspace_id;
      const { row, error: fe } = await fetchLiriCourseWorkspaceById(String(wid));
      if (cancelled) return;
      if (fe || !row) { setInviteBanner(fe?.message || 'Workspace introuvable.'); clearInviteQuery(); return; }
      let payload;
      try { payload = assertWorkspacePayload(row.payload); }
      catch (e) { setInviteBanner(e instanceof Error ? e.message : 'Données workspace invalides.'); clearInviteQuery(); return; }
      hydrateWorkspaceIntoKonvaEditor(payload);
      setInitialKonvaProject(null);
      const kp = payload.konvaProject;
      const pp = payload.polotnoProject;
      if (!kp?.scenes?.length && pp?.pages?.length) setFormatNotice(LEGACY_POLOTNO_NOTICE);
      else setFormatNotice('');
      useDesignerShellStore.getState().setCloudMeta({ id: row.id, title: row.title || '' });
      setCloudBootstrap({ workspaceId: row.id, title: row.title || '', accessRole: result.role === 'editor' ? 'editor' : 'viewer' });
      setInviteBanner('Invitation acceptée — workspace chargé.');
      clearInviteQuery();
    })();
    return () => { cancelled = true; };
  }, [inviteToken, clearInviteQuery]);

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden"
      style={{ background: proColors.surface0, color: proColors.textPrimary, fontFamily: proType.ui }}
    >
      {/* Keyframes + scrollbar pro globale */}
      <style>{`
        @keyframes proPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .pro-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .pro-scroll::-webkit-scrollbar-track { background: transparent; }
        .pro-scroll::-webkit-scrollbar-thumb { background: ${proColors.surface4}; border-radius: 4px; }
        .pro-scroll::-webkit-scrollbar-thumb:hover { background: ${proColors.surface5}; }
      `}</style>
      {/* TOP BAR */}
      <AnimatePresence>
        {!fullscreen && (
          <motion.div key="topbar" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="flex-shrink-0">
            <DesignerTopBar
              viewMode={viewMode}
              setViewMode={setViewMode}
              fullscreen={fullscreen}
              onToggleFullscreen={() => setFullscreen(v => !v)}
              inviteBanner={inviteBanner}
              formatNotice={formatNotice}
              isnaImportSummary={isnaImportSummary}
              onClearIsnaImport={() => setIsnaImportSummary(null)}
              docType={docType}
              outputFormats={outputFormats}
              onNewDoc={() => {
                useDesignerShellStore.getState().resetForNewDocument();
                useDocumentCoachStore.getState().deactivateDocumentMode();
              }}
              designerMode={designerMode}
              setDesignerMode={setDesignerMode}
              cinemaPedagogy={isCinemaPedagogy}
              postProdOpen={postProdOpen}
              onTogglePostProd={togglePostProdDock}
              quickLauncherOpen={quickLauncherOpen}
              onQuickLaunch={() => setQuickLauncherOpen(v => !v)}
              cloudToolbar={<DesignerCloudToolbar />}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* QUICK LAUNCHER — panneau flottant sous la TopBar */}
      <QuickLauncherPanel
        isOpen={quickLauncherOpen}
        onClose={() => setQuickLauncherOpen(false)}
        onCreate={(type, outputs) => {
          setDocType(type);
          setOutputFormats(outputs);
          setQuickLauncherOpen(false);
        }}
        onImportFile={handleImportFile}
      />

      {/* CORPS — relative pour dock LONGIA compact + languette hub */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">

        {/* LEFT TOOL SIDEBAR */}
        <AnimatePresence initial={false}>
          {!fullscreen && (
            <motion.div key="tools" initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="flex-shrink-0 overflow-hidden">
              <ToolSidebar
                activeTool={toolSidebarActive}
                onTool={handleTool}
                designerMode={designerMode}
                docType={docType}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* CONTEXTUAL PANEL — s'ouvre sur outil actif OU sur sélection canvas */}
        <AnimatePresence>
          {(activeTool || canvasHasSelection) && !fullscreen && (
            <ContextualPanel
              key={activeTool ?? 'element-ctx'}
              tool={activeTool}
              onClose={() => setActiveTool(null)}
            />
          )}
        </AnimatePresence>

        {/* CANVAS — SmartboardKonvaEditorV1 avec hideChrome */}
        <div
          className="relative flex flex-1 min-w-0 flex-col overflow-hidden"
          style={{
            background: '#0a0b0f',
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        >
          {isnaImportSummary && !fullscreen ? (
            <div className="pointer-events-none absolute right-3 top-3 z-30">
              <div className="pointer-events-auto w-[320px] rounded-xl border border-fuchsia-500/30 bg-[#120c1f]/90 p-3 text-[11px] text-fuchsia-100 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
                <div className="mb-1 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-fuchsia-300" />
                  <p className="font-semibold text-fuchsia-100">Import source actif</p>
                </div>
                <p className="text-fuchsia-100/85">
                  {isnaImportSummary.stepsCount} etape(s) importe(e)s · source {isnaImportSummary.source || 'isna'}
                </p>
                <p className="mt-0.5 text-fuchsia-200/70">{isnaImportSummary.savedAtLabel || 'date inconnue'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    to={isnaImportSummary.runId ? `/studio/constructeur-isna?runId=${encodeURIComponent(isnaImportSummary.runId)}` : '/studio/constructeur-isna'}
                    className="rounded-md border border-fuchsia-400/35 bg-fuchsia-500/15 px-2 py-1 text-[10px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25"
                  >
                    Retour au run d&apos;origine
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsnaImportSummary(null)}
                    className="rounded-md border border-white/20 bg-white/[0.08] px-2 py-1 text-[10px] font-semibold text-white/85 transition hover:bg-white/[0.14]"
                  >
                    Vider import
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* PROPERTIES BAR — contextuel selon l'objet sélectionné */}
          <AnimatePresence>
            {!fullscreen && docType && <PropertiesBar key="props-bar" />}
          </AnimatePresence>

          {/* Bouton sortie plein écran */}
          <AnimatePresence>
            {fullscreen && (
              <motion.button
                key="exit-fs"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }} exit={{ opacity: 0, y: -8 }}
                onClick={() => setFullscreen(false)}
                className="absolute top-3 right-3 z-50 flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#0F1117]/80 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur hover:border-cyan-500/30 hover:text-cyan-400 transition-all"
              >
                <Minimize2 className="h-3.5 w-3.5" /> Quitter plein écran
              </motion.button>
            )}
          </AnimatePresence>

          {/* Feature root (parity) — masqué visuellement, garde ses effets */}
          <div className="hidden">
            <KonvaParityFeatureRoot editorRef={konvaEditorRef} />
          </div>

          {/* ── Écran de création de document ── */}
          <AnimatePresence>
            {!docType && (
              <motion.div
                key="new-doc-screen"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="absolute inset-0 z-20 flex flex-col"
                style={{ background: 'rgba(10,11,15,0.96)' }}
              >
                <NewDocumentScreen
                  onCreate={(type, outputs) => {
                    setDocType(type);
                    setOutputFormats(outputs);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Lanceur Document Administratif Intelligent ── */}
          <AnimatePresence>
            {docType === 'document' && documentLauncherOpen && (
              <motion.div
                key="doc-launcher"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 z-30 flex flex-col overflow-hidden"
              >
                <Suspense
                  fallback={
                    <div className="flex flex-1 items-center justify-center text-[12px] text-white/30" style={{ background: '#12111a' }}>
                      Chargement du Studio Document…
                    </div>
                  }
                >
                  <DocumentStudioLauncher
                    onClose={() => setDocumentLauncherOpen(false)}
                    onLaunch={handleDocumentLaunch}
                  />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>

          {/* L'éditeur Konva — chrome masqué, canvas plein espace */}
          <SmartboardKonvaEditorV1
            ref={konvaEditorRef}
            className="min-h-0 flex-1 rounded-none border-0 shadow-none"
            cloudBootstrap={cloudBootstrap}
            onCloudBootstrapConsumed={onCloudBootstrapConsumed}
            initialKonvaProject={initialKonvaProject}
            hideChrome
            videoExportContentId={isFormationContentUuid(postProdContentId) ? postProdContentId : null}
            onCollabPresence={setCollabPresence}
          />

          {docType && !fullscreen && collabPresence.enabled && (collabPresence.members?.length ?? 0) > 0 ? (
            <div
              className="pointer-events-auto absolute bottom-14 right-4 z-[32] flex max-w-[min(92vw,420px)] items-center gap-2 rounded-2xl border border-white/10 bg-[#0a0b0f]/90 px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md"
              title={collabPresence.roomId ? `Room ${collabPresence.roomId}` : undefined}
            >
              <Users className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
              <span className="hidden text-[9px] font-semibold uppercase tracking-wider text-white/45 sm:inline">En ligne</span>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto [scrollbar-width:none]">
                {collabPresence.members.slice(0, 14).map((m) => (
                  <div
                    key={m.userId}
                    title={m.name || m.userId}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white/95 shadow-sm"
                    style={{
                      borderColor: m.color || 'rgba(255,255,255,.25)',
                      background: `${m.color || '#64748b'}29`,
                    }}
                  >
                    {(m.name || '?').trim().slice(0, 2).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {aiHubOpen && !fullscreen && docType ? (
            <AIHub docType={docType} designerMode={designerMode} onClose={() => setAiHubOpen(false)} />
          ) : null}
        </div>

        <DesignerQuickRail
          docType={docType}
          designerMode={designerMode}
          fullscreen={fullscreen}
          activeTool={toolSidebarActive}
          onTool={handleTool}
          onOpenLongia={openLongiaHubToSuggest}
          onSelectAll={selectAllInActiveScene}
        />

        {/* Post-production dock (formation_day_contents) */}
        <AnimatePresence initial={false}>
          {postProdOpen && !fullscreen && (
            <motion.div
              ref={postProdDockRef}
              key="postprod-dock"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex max-w-[min(100vw,460px)] flex-shrink-0 overflow-hidden"
            >
              <Suspense
                fallback={
                  <aside
                    className="flex h-full min-h-0 w-[min(100vw,460px)] flex-shrink-0 items-center justify-center border-l border-white/[0.07]"
                    style={{ background: '#12111a' }}
                  >
                    <span className="text-[11px] text-white/35">Chargement post-production…</span>
                  </aside>
                }
              >
                <DesignerPostProductionDock
                  contentId={postProdContentId}
                  onContentIdChange={onPostProdContentIdChange}
                  onClose={closePostProdDock}
                  returnToHref={returnToHref}
                  designerBackHref={designerBackHref}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle AI hub (flottant — plus de colonne latérale) */}
        {!fullscreen && docType ? (
          <button
            onClick={() => {
              setAiHubOpen((open) => {
                if (open) return false;
                useAiHubStore.getState().requestAiHubTab('suggest');
                return true;
              });
            }}
            title={aiHubOpen ? 'Fermer LONGIA' : 'Ouvrir LONGIA'}
            className={cn(
              'absolute right-0 top-1/2 z-20 flex h-12 w-5 -translate-y-1/2 items-center justify-center rounded-l-xl border border-white/10 text-white/30 transition-all hover:text-amber-400',
              aiHubOpen ? 'bg-[#12111a] border-r-0' : 'bg-[#0F1117]',
            )}
            style={{
              right: postProdOpen ? postProdDockWidth : 0,
            }}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', aiHubOpen ? '-rotate-90' : 'rotate-90')} />
          </button>
        ) : null}

        {!fullscreen && !aiHubOpen && (
          <LongiaCompactDock
            rightOffsetPx={postProdOpen ? postProdDockWidth : 0}
            onExpandHub={openLongiaHubToSuggest}
          />
        )}
      </div>

      {/* Cinéma pédagogique — prises (MVP) */}
      <AnimatePresence>
        {isCinemaPedagogy && !fullscreen && docType && (
          <motion.div
            key="cinema-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0"
          >
            <CinemaPedagogyBar
              ref={cinemaBarRef}
              editorRef={konvaEditorRef}
              onRecordingChange={setCinemaRecording}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM BAR */}
      <AnimatePresence>
        {!fullscreen && (
          <motion.div key="bottom" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="flex-shrink-0">
            <BottomBar
              designerMode={designerMode}
              docType={docType}
              workspaceCloudId={cloudWorkspaceId}
              workspaceCloudTitle={cloudWorkspaceTitle}
              outputFormats={outputFormats}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
