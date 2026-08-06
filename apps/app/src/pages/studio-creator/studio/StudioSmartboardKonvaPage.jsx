/**
 * StudioSmartboardKonvaPage — LIRI SmartBoard Designer v2
 * Shell entièrement redesigné selon le cahier de charge LIRI.
 *
 * Layout : top bar, rail outils, canvas plein flex, LONGIA en barre flottante (overlay),
 * bande membres collab horizontale en bas à droite, bottom bar.
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import SmartboardCanvasImage from '@/components/media/SmartboardCanvasImage';
import {
  Type, Square, Circle, Image as ImageIcon, LayoutGrid, Layers, Cpu,
  UploadCloud, Sparkles, Box, Zap, FileImage, ChevronRight, ChevronLeft, Radio, FileOutput,
  Bell, LogOut, Undo2, Redo2, Monitor, Smartphone, Projector, GraduationCap,
  Eye, Mic, MessageSquare, Wand2, GitBranch, BookOpen, ScrollText,
  Map, SlidersHorizontal, Plus, Star, Palette, ArrowLeft, ArrowRight,
  CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp, X, Maximize2, Minimize2,
  HelpCircle, Settings2, Play, Pause, SkipForward, Search, Timer,
  AlignLeft, AlignCenter, AlignRight, Lock, Unlock, Trash2, Minus, Disc,
  FlipHorizontal2, FlipVertical2, ScanLine, Camera, Send,
  Film, Tablet, Printer, Tv, Code, Clapperboard,
  PenTool, Pencil, MousePointer2, RefreshCw, Hexagon, Eraser,
  History, Cloud, Loader2, PanelRightOpen, Users, MoreHorizontal, Building2,
  Droplets, Stamp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import SmartboardKonvaEditorV1 from '@/features/smartboard-konva-editor/SmartboardKonvaEditorV1';
import CinemaPedagogyBar from '@/features/smartboard-konva-editor/components/CinemaPedagogyBar';
import { supabase } from '@/lib/customSupabaseClient';
import {
  redeemWorkspaceInvite,
  fetchLiriCourseWorkspaceById,
  saveLiriCourseWorkspace,
} from '@/features/smartboard-konva-editor/lib/liriCourseWorkspaceSupabase';
import { normalizeLifecycleStatus } from '@/features/smartboard-konva-editor/lib/liriWorkspaceLifecycle';
import {
  assertWorkspacePayload,
  isLegacyPolotnoOnlyPayload,
  liriCourseWorkspaceLocalKey,
} from '@/features/smartboard-konva-editor/lib/courseWorkspaceBundle';
import { clearWorkspaceBaseline } from '@/features/smartboard-konva-editor/lib/liriWorkspaceBaseline';
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
import { getSmartboardMobileReadabilitySummary, SMARTBOARD_DESIGN_WIDTH } from '@/lib/smartboardDesignCanvas';
import {
  echelleAjustementCanevas,
  PLANCHER_ECHELLE_DOCUMENT,
} from '@/features/smartboard-konva-editor/components/CanvasZoomControl';
import {
  hauteurDeCadrage,
  FORMATS_PAGE,
  MARGES_DEFAUT,
} from '@/features/smartboard-konva-editor/lib/documentPagination';
import { useDocumentCoachStore } from '@/features/smartboard-konva-editor/store/useDocumentCoachStore';
import DocumentCoachPanel from '@/pages/studio-creator/studio/DocumentCoachPanel';
import DocumentTextAiActions from '@/features/smartboard-konva-editor/components/DocumentTextAiActions';
import DocumentReviewPanel from '@/features/smartboard-konva-editor/components/DocumentReviewPanel';
import LayersStackPanel from '@/features/smartboard-konva-editor/components/LayersStackPanel';
import DocumentExportPanel from '@/features/smartboard-konva-editor/components/DocumentExportPanel';
import {
  echelleDuCanevas,
  pxCanevas,
} from '@/features/smartboard-konva-editor/components/echelleCanevasDocument';
import {
  DocumentTablePanel,
  DocumentHeaderFooterPanel,
  DocumentPagePanel,
  appliquerMutationDocument,
} from '@/features/smartboard-konva-editor/components/DocumentBusinessPanels';
import { identiteActive, normaliserCollection } from '@/features/smartboard-konva-editor/lib/documentIdentite';
/* [FIL-1] Le moteur du filigrane — la coque ne recalcule ni le calque de fond
   (`layerDeFond`) ni la géométrie : elle règle, montre et pose. */
import {
  ANGLE_MAX,
  ANGLE_MIN,
  DISPOSITIONS,
  MOTIFS_FILIGRANE,
  OPACITE_MAX,
  OPACITE_MIN,
  PART_LARGEUR_IMAGE_DEFAUT,
  TAILLE_TEXTE_MAX,
  TAILLE_TEXTE_MIN,
  appliquerFiligrane,
  filigranePose,
  filigraneVide,
  normaliserFiligrane,
  patchesAncrageFiligrane,
  resumeFiligrane,
  retirerFiligrane,
} from '@/features/smartboard-konva-editor/lib/documentFiligrane';
/* [SIG-1] La saisie (tracée / téléversée / dactylographiée), le bloc « Pour la
   direction / Nom / Fonction / Date » et la pose vivent ENTIÈREMENT dans ce panneau :
   la coque le monte, elle ne réécrit rien. */
import DocumentSignaturePanel from '@/features/smartboard-konva-editor/components/DocumentSignaturePanel';
import {
  useDocumentIdentiteStore,
  selecteurCollection,
} from '@/features/smartboard-konva-editor/store/useDocumentIdentiteStore';
/* ⛔ CONTRAT INTER-MODULES : `DocumentIdentitePanel` appartient à un autre module.
   Un import nommé qui ne correspond pas à son export vaut `undefined` et le rail
   ouvrirait une coque vide — l'import d'espace de noms lit les deux conventions. */
import * as ModuleIdentitePanel from '@/features/smartboard-konva-editor/components/DocumentIdentitePanel';
import { lireBlocDnd, DOC_BLOC_DND_MIME } from '@/features/smartboard-konva-editor/store/useDocumentSuggestionsStore';
import { makeDocumentTextObject, encreLisible, nextFlowPosition } from '@/features/smartboard-konva-editor/lib/documentBlockLayout';
import { estOperableBooleen } from '@/features/smartboard-konva-editor/lib/cheminsVectoriels';
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
import { createEmptyProject, mkTextObject, mkRectObject, mkImageObject } from '@/features/smartboard-konva-editor/model/sceneModel';
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
import { useTenantBranding } from '@/hooks/useTenantBranding';
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
import { proColors, proRadii, proType, proSize } from '@/components/studio-creator/studio-pro';

/* ─── Constantes ─────────────────────────────────────────────────── */
const LOCAL_AUTOSAVE_MS = 45_000;
const LEGACY_POLOTNO_NOTICE =
  'Ancien workspace Polotno : seul le plan Copilot est chargé, le canevas Konva démarre vide. '
  + 'Ses pages d\'origine restent intactes en base (l\'enregistrement les préserve), mais le Designer ne sait pas les afficher — '
  + 'réimportez un export JSON Konva ou reconstruisez les slides.';
const ISNA_PHASE3_HANDOFF_KEY = 'isna_phase3_handoff_v1';
/** Marqueur obligatoire des réponses de repli local (aucun appel IA n'a abouti). */
const LONGIA_LOCAL_REPLY_PREFIX =
  '⚠︎ Réponse LOCALE — le moteur LONGIA n\'a rien renvoyé (crédits, réseau ou session).\n\n';

const DesignerPostProductionDock = lazy(() => import('@/pages/studio-creator/studio/DesignerPostProductionDock'));
const DocumentStudioLauncher     = lazy(() => import('@/pages/studio-creator/studio/DocumentStudioLauncher'));

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
/**
 * ⛔ « Icônes » et « 3D » sont RETIRÉS du rail : aucune de leurs entrées n'a de branche
 * dans `handleAdd`, donc l'outil n'ouvrait qu'un panneau d'excuses (« pas encore
 * disponibles »). Leur catalogue reste dans `TOOL_CONTENT` : le jour où une branche
 * d'insertion existe, il suffit de remettre la ligne ici — le filtre `isUsableTool`
 * les laissera alors passer.
 */
const TOOLS = [
  { id: 'selection', icon: MousePointer2, label: 'Sélection', accent: 'teal' },
  { id: 'texte',    icon: Type,       label: 'Texte',         accent: 'cyan' },
  { id: 'formes',   icon: Square,     label: 'Formes',        accent: 'violet' },
  { id: 'images',   icon: ImageIcon,  label: 'Images',        accent: 'emerald' },
  { id: 'fond',     icon: Palette,    label: 'Fond',          accent: 'pink' },
  { id: 'animes',   icon: Zap,        label: 'Animés',        accent: 'orange' },
  { id: 'modeles',  icon: FileImage,  label: 'Modèles',       accent: 'teal' },
];

/**
 * ⚠️ Les CLÉS (`cyan`, `violet`, `blue`, `teal`…) ne sont plus que des NOMS DE
 * FENTE hérités : les valeurs qu'elles portent sont toutes chaudes. On ne les
 * renomme pas ici parce qu'elles sont référencées par une douzaine de tables
 * (TOOLS, DOC_TYPES, ELEMENT_META, FV_BOOLEAN, PEDAGOGIC_TOOLS…) derrière un
 * `?? ACCENT.cyan` : une clé oubliée retomberait SILENCIEUSEMENT sur le mauvais
 * accent. C'est du renommage, pas de la couleur — hors périmètre de cette passe.
 */
const ACCENT = {
  cyan:    { text: 'text-[#e3aa6b]',    bg: 'bg-[#e3aa6b]/15',    border: 'border-[#e3aa6b]/30',    glow: 'shadow-[0_0_14px_rgba(227,170,107,0.3)]'    },
  violet:  { text: 'text-[#e08a5f]',  bg: 'bg-[#d97757]/15',  border: 'border-[#d97757]/30',  glow: 'shadow-[0_0_14px_rgba(217,119,87,0.3)]'   },
  amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   glow: 'shadow-[0_0_14px_rgba(251,191,36,0.3)]'    },
  /* Halo aligné sur l'olive de la fente (il était resté sur une argile orangée). */
  emerald: { text: 'text-[#7bb06a]', bg: 'bg-[#5a8f52]/15', border: 'border-[#5a8f52]/30', glow: 'shadow-[0_0_14px_rgba(90,143,82,0.32)]'    },
  pink:    { text: 'text-pink-400',    bg: 'bg-pink-500/15',    border: 'border-pink-500/30',    glow: 'shadow-[0_0_14px_rgba(244,114,182,0.3)]'   },
  blue:    { text: 'text-[#daa07a]',    bg: 'bg-[#daa07a]/15',    border: 'border-[#daa07a]/30',    glow: 'shadow-[0_0_14px_rgba(218,160,122,0.3)]'    },
  orange:  { text: 'text-orange-400',  bg: 'bg-orange-500/15',  border: 'border-orange-500/30',  glow: 'shadow-[0_0_14px_rgba(251,146,60,0.3)]'    },
  teal:    { text: 'text-[#e0976a]',    bg: 'bg-[#e0976a]/15',    border: 'border-[#e0976a]/30',    glow: 'shadow-[0_0_14px_rgba(224,151,106,0.3)]'    },
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
/**
 * ⛔ « Vision » (œil) et « Audio » (micro) sont RETIRÉS : ils ne déclenchaient aucun traitement.
 * Seul `architect` change quoi que ce soit dans l'appel LONGIA (`llmMode`) ; les deux autres
 * rendaient exactement le même coach texte, sans jamais solliciter caméra ni micro. Les modules
 * qui les implémenteraient (callLiriSmartboardVisionDescribe / …VisionSegment / grabVisionFrame /
 * uploadLiriVisionSegment) existent mais n'ont aucun importeur — à rebrancher AVANT de remettre
 * ces deux boutons.
 */
const AI_QUICK_MODES = [
  { id: 'analyse',    icon: Sparkles,        label: 'Analyse',      color: 'text-amber-400',   dot: 'bg-amber-400'   },
  { id: 'architect',  icon: Cpu,             label: 'Architect',    color: 'text-[#e08a5f]',  dot: 'bg-[#e08a5f]'  },
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

/**
 * Types de projet servis par le centre d'export du CANEVAS (DocumentExportPanel).
 *
 * ⛔ MESURÉ le 2026-08-05 : en mode Affiche, « Exporter » partait sur
 * /studio/export-center, qui lit `useSmartboardStore` (le store des SLIDES) et
 * répondait « 0 Slides, 0 Éléments — Aucun slide à exporter » sur une affiche de
 * 8 objets dont 3 images. Ni PDF, ni critique : impossible de livrer l'annonce presse.
 * Présentation avait EXACTEMENT le même symptôme (même condition `docType === 'document'`).
 *
 * ⚠️ `smartboard` et `video` restent sur /studio/export-center : le premier n'est pas
 * un livrable papier, le second sort en MP4 par la post-production. Leur bouton mène
 * donc toujours au centre d'export des slides — ce n'est PAS corrigé ici.
 */
const DOC_TYPES_EXPORT_CANEVAS = new Set(['document', 'affiche', 'presentation']);

/* ─── Dimensions canvas par type de document ─────────────────────── */
const CANVAS_DIMS = {
  smartboard:   { w: 1920, h: 1080 },
  presentation: { w: 1920, h: 1080 },
  affiche:      { w: 2480, h: 3508 }, // A4 portrait @300dpi
  document:     { w:  794, h: 1123 }, // A4 @96dpi écran
  video:        { w: 1920, h: 1080 },
};

/**
 * Encre du canevas de conception — le crème du Smartboard, juste sur fond sombre.
 * Sur une page CLAIRE (Document, Affiche destinée à l'impression) il donne 1,12:1.
 */
const ENCRE_CANEVAS_SOMBRE = '#F7F2E8';

/**
 * Rend lisible l'encre d'un objet texte posé sur une page CLAIRE.
 *
 * ⛔ CONTRAINTE : `adapterInsertionAuDocument` (store) ne normalise que
 * `docType === 'document'`. En mode Affiche, un titre inséré sortait en #F7F2E8 sur
 * un fond papier — contraste 1,12:1, invisible. La correction se fait donc ici,
 * au point d'insertion du catalogue, en interrogeant le FOND RÉEL du canevas :
 * aucune liste de types à tenir à jour.
 *
 * ⚠️ Fond `transparent` = rendu sombre à l'écran : on ne touche à rien.
 *
 * @param {any} obj objet Konva sur le point d'être posé
 * @param {string} fondPage `project.canvas.background`
 */
function adapterEncreAuFond(obj, fondPage) {
  const fond = typeof fondPage === 'string' ? fondPage.trim() : '';
  if (!fond || fond === 'transparent' || fond === 'none') return obj;
  if (!obj || obj.type !== 'text') return obj;
  const encre = encreLisible(obj.style?.fill ?? ENCRE_CANEVAS_SOMBRE, fond);
  if (!encre) return obj;
  return { ...obj, style: { ...(obj.style ?? {}), fill: encre } };
}

/* ─── Modules frères OPTIONNELS : filigrane et signature ─────────── */
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
  /* [ID-2] L'identité d'entreprise est aussi atteignable DEPUIS l'éditeur : c'est
     par là que passe l'application explicite à un document déjà ouvert. */
  { id: 'doc-identite', icon: Building2, label: 'Identité',     accent: 'amber'   },
  /* [FIL-1] Filigrane — répété sur chaque page, derrière le contenu. */
  { id: 'doc-filigrane', icon: Droplets, label: 'Filigrane', accent: 'blue' },
  /* [SIG-1] Signature — le GESTE PONCTUEL sur le document courant. L'autre porte
     (signature réutilisable de l'entreprise) est le panneau Identité, qui monte le
     même écran en mode « integre ». Deux portes, un seul mécanisme. */
  { id: 'doc-signature', icon: Stamp, label: 'Signature', accent: 'emerald' },
];

/* ─── Outils métier Présentation ─────────────────────────────────── */
/**
 * ⛔ « Média », « Disposition », « Animation » et « Modèle » sont RETIRÉS : leurs items
 * n'ont aucune branche d'insertion (pas de moteur de disposition ni de transitions côté
 * Konva), l'outil n'affichait donc qu'un panneau d'excuses. « Texte », lui, est BRANCHÉ
 * (voir `handleAdd`) — c'est le seul du lot qui posait un objet réel à peu de frais.
 */
const PRESENTATION_TOOLS = [
  { id: 'slide-titre',   icon: Type,       label: 'Titre',       accent: 'cyan'    },
  { id: 'slide-texte',   icon: AlignLeft,  label: 'Texte',       accent: 'teal'    },
  { id: 'slide-forme',   icon: Square,     label: 'Forme',       accent: 'blue'    },
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
  const panneauRef = useRef(/** @type {HTMLElement | null} */ (null));

  /**
   * ⛔ LE VOILE CONFISQUAIT LE PREMIER CLIC — même panne que le hub LONGIA.
   *
   * Un `DIV.fixed inset-0 z-40` cliquable couvrait TOUT l'écran tant que le lanceur
   * était ouvert : le premier clic sur un outil du rail, sur « Exporter » ou sur
   * n'importe quel bouton de la coque ne faisait que fermer le lanceur. Il fallait
   * cliquer deux fois, partout. Le voile est supprimé ; la fermeture au clic
   * extérieur passe par ce listener en phase de CAPTURE, qui n'appelle NI
   * preventDefault NI stopPropagation : le clic ferme le lanceur ET atteint sa cible.
   */
  useEffect(() => {
    if (!isOpen) return undefined;
    const surClicExterieur = (e) => {
      const racine = panneauRef.current;
      if (!racine || !(e.target instanceof Node)) return;
      if (racine.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener('pointerdown', surClicExterieur, true);
    return () => document.removeEventListener('pointerdown', surClicExterieur, true);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.aside
            key="quick-launcher"
            ref={panneauRef}
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="fixed left-3 top-[44px] z-50 w-[480px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_12px_60px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)]"
            style={{ background: '#1f1e1c' }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#d4924a]/20 bg-[#d4924a]/15 text-[#e0a458]">
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
                    className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-8 text-center transition-all hover:border-[#d4924a]/30 hover:bg-[#d4924a]/[0.04]"
                  >
                    <UploadCloud className="h-9 w-9 text-white/15" />
                    <div>
                      <p className="text-[11px] font-medium text-white/45">Glisser un fichier ici</p>
                      <p className="mt-0.5 text-[9px] text-white/25">ou cliquer pour sélectionner</p>
                    </div>
                    {/* ⛔ N'annoncer que ce que handleImportFile sait traiter. PDF et Vidéo étaient
                        proposés puis refusés, avec un renvoi vers un panneau inexistant. */}
                    <p className="text-[9px] text-white/20">JSON Konva · Image</p>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { onImportFile(file); onClose(); }
                      e.target.value = '';
                    }}
                  />
                  <p className="text-center text-[9px] leading-relaxed text-white/25">
                    PDF, .docx et .pptx : passez par{' '}
                    <Link to="/studio/liri/import" className="text-[#d4924a] underline underline-offset-2" onClick={onClose}>
                      Studio LIRI → Import
                    </Link>
                    .
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'JSON Konva', accept: '.json',   color: 'cyan',    icon: Code      },
                      { label: 'Image',      accept: 'image/*', color: 'emerald', icon: ImageIcon },
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
        // ⛔ Ne PAS écrire lifecycle_status ici : cette barre ne pilote pas le cycle de vie.
        // Elle le forçait à « draft » à chaque clic, ce qui annulait silencieusement un
        // « Validé » / « Prêt pour le live » posé dans le panneau Cloud. Le statut n'est
        // envoyé qu'à la CRÉATION, où il n'écrase rien.
        ...(cloudId ? {} : { lifecycleStatus: normalizeLifecycleStatus('draft') }),
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
      <Cloud className="h-3.5 w-3.5 text-[#e0a458]/70 shrink-0" title="Workspace cloud" />
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
        className="flex shrink-0 items-center justify-center rounded-md border border-[#d4924a]/30 bg-[#d4924a]/15 px-2 py-0.5 text-[10px] font-semibold text-[#ecc98f] hover:bg-[#d4924a]/25 disabled:opacity-40"
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
  onExportDocument = null,
  cloudToolbar = null,
}) {
  const undo = useSmartboardKonvaStore(s => s.undo);
  const redo = useSmartboardKonvaStore(s => s.redo);
  const scenes = useSmartboardKonvaStore(s => s.project?.scenes ?? []);
  const activeSceneId = useSmartboardKonvaStore(s => s.project?.activeSceneId);
  const activeIdx = scenes.findIndex(s => s.id === activeSceneId);
  const totalScenes = scenes.length;

  const modeColors = {
    design: { active: 'bg-[#d4924a]/20 text-[#e6b566] border-[#d4924a]/35 shadow-[0_0_12px_rgba(227,170,107,0.2)]',   dot: 'bg-[#e0a458]'   },
    live:   { active: 'bg-red-500/20 text-red-300 border-red-500/35 shadow-[0_0_12px_rgba(239,68,68,0.2)]',       dot: 'bg-red-400 animate-pulse' },
    video:  { active: 'bg-amber-500/20 text-amber-300 border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.2)]',dot: 'bg-amber-400'  },
    cinema: { active: 'bg-[#d97757]/20 text-[#e8a97f] border-[#d97757]/35 shadow-[0_0_12px_rgba(217,119,87,0.2)]', dot: 'bg-[#e08a5f]' },
  };

  /**
   * ⛔ LA BARRE DÉBORDAIT SANS SE REPLIER. Tous ses blocs étaient en `shrink-0` et
   * rien ne clippait : sous ~1900 px de large, « Exporter » se retrouvait au-delà
   * du bord droit (mesuré à x = 1822 dans une fenêtre de 1440) et
   * `document.elementFromPoint` n'y trouvait plus rien. Hors d'écran = inexistant.
   *
   * Le repli est décidé sur une MESURE (`scrollWidth > clientWidth`), pas sur un
   * point de rupture deviné. L'hystérésis (`seuilRepliRef`) évite l'oscillation :
   * une fois replié, le contenu tient, donc le test de débordement redeviendrait
   * faux et la barre se déplierait en boucle.
   */
  const barreRef = useRef(/** @type {HTMLElement | null} */ (null));
  const [replie, setReplie] = useState(false);
  const seuilRepliRef = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    const el = barreRef.current;
    if (!el) return undefined;
    const mesurer = () => {
      const dispo = el.clientWidth;
      if (!dispo) return;
      setReplie((etaitReplie) => {
        if (!etaitReplie) {
          if (el.scrollWidth > dispo + 2) {
            seuilRepliRef.current = dispo;
            return true;
          }
          return false;
        }
        /* +48 px de marge : on ne déplie qu'une fois la place franchement revenue. */
        return dispo <= seuilRepliRef.current + 48;
      });
    };
    mesurer();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null;
    ro?.observe(el);
    window.addEventListener('resize', mesurer);
    return () => { ro?.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [docType, designerMode, cinemaPedagogy, Boolean(onTogglePostProd)]);

  /* Entrées reléguées au menu de débordement. Elles ne DISPARAISSENT pas : elles
     changent de place. Chacune garde son action d'origine. */
  const entreesRepliees = [
    ...DESIGNER_MODES.map((m) => ({
      key: `mode-${m.id}`, icon: m.icon, label: `Mode ${m.label}`,
      actif: designerMode === m.id, onClick: () => setDesignerMode(m.id),
    })),
    ...(typeof onTogglePostProd === 'function'
      ? [{ key: 'postprod', icon: Clapperboard, label: 'Post-production', actif: postProdOpen, onClick: onTogglePostProd }]
      : []),
    /* ⛔ Les entrées « Aperçu Bureau/Mobile/… » sont retirées du menu replié :
       `viewMode` n'a jamais piloté le rendu (cf. bloc retiré plus haut). */
    {
      key: 'fullscreen', icon: fullscreen ? Minimize2 : Maximize2,
      label: fullscreen ? 'Quitter le plein écran' : 'Plein écran',
      actif: fullscreen, onClick: onToggleFullscreen,
    },
    { key: 'aide', icon: HelpCircle, label: 'Aide', to: '/studio/smartboard-aide' },
    { key: 'live', icon: Radio, label: 'Live', to: '/studio/live' },
    { key: 'hub', icon: LogOut, label: 'Hub LIRI', to: '/studio/liri' },
  ];

  return (
    <div className="flex-shrink-0">
      <header
        ref={barreRef}
        className="flex items-center gap-2 overflow-hidden px-3"
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
        {!replie && <span className="h-4 w-px bg-white/10 shrink-0" />}
        {!replie && (
        <nav className="flex items-center gap-1 text-[11px] text-white/35 shrink-0">
          <Link to="/studio/liri" className="hover:text-white/60 transition-colors">Écosystème</Link>
          <ChevronRight className="h-3 w-3 text-white/20" />
          {cinemaPedagogy ? (
            <>
              <Link to="/studio/smartboard-designer" className="hover:text-white/60 transition-colors">Designer</Link>
              <ChevronRight className="h-3 w-3 text-white/20" />
              <span className="font-medium text-[var(--school-accent)]">Cinéma pédagogique</span>
            </>
          ) : (
            <span className="text-[#e0a458] font-medium">Designer</span>
          )}
        </nav>
        )}

        {/* Titre projet */}
        <div className={cn('flex items-center gap-2 ml-2 shrink-0', replie && 'hidden')}>
          <div
            className={cn(
              'h-6 w-6 flex items-center justify-center rounded-lg border shrink-0',
              cinemaPedagogy
                ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)]'
                : 'bg-[#d4924a]/15 border-[#d4924a]/20',
            )}
          >
            {cinemaPedagogy ? (
              <Film className="h-3 w-3 text-[var(--school-accent)]" />
            ) : (
              <LayoutGrid className="h-3 w-3 text-[#e0a458]" />
            )}
          </div>
          <span className="text-[12px] font-semibold text-white/70 hidden lg:block">
            {cinemaPedagogy ? 'Enregistrement guidé (bêta)' : 'SmartBoard Designer'}
          </span>
        </div>

        {!replie && <span className="h-4 w-px bg-white/10 mx-1 shrink-0" />}

        {/* ── MODE TABS ── centre de gravité du top bar (relégué au menu ⋯ au repli) */}
        <div className={cn('flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 shrink-0', replie && 'hidden')}>
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

        {typeof onTogglePostProd === 'function' && !replie ? (
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
        {docType && !replie && (
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
        {/* ⛔ PERTE DE DONNÉES CORRIGÉE : ce bouton n'appelait QUE `onQuickLaunch`.
            `onNewDoc` (= handleNewDocument, la seule coupure propre avec la fiche
            précédente) était passé en prop et jamais invoqué. Résultat : le lanceur
            changeait le type de document, les objets de l'ancien document restaient,
            `?workspace=` restait chargé, et le « Sauver » suivant écrivait le NOUVEAU
            contenu DANS L'ANCIENNE FICHE Supabase. La demande de coupure passe
            désormais par `onNewDoc`, qui confirme puis ouvre le lanceur. */}
        <span className="h-4 w-px bg-white/10 mx-1 shrink-0" />
        <button
          type="button"
          onClick={typeof onNewDoc === 'function' ? onNewDoc : onQuickLaunch}
          title="Nouveau document — ferme la fiche en cours, puis Créer · Importer · Récents"
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all shrink-0',
            quickLauncherOpen
              ? 'border-[#d4924a]/35 bg-[#d4924a]/15 text-[#ecc98f] shadow-[0_0_12px_rgba(227,170,107,0.2)]'
              : 'border-white/[0.07] bg-white/[0.03] text-white/40 hover:bg-white/[0.07] hover:text-white/70',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Nouveau</span>
        </button>

        {/* ⛔ RETIRÉ — les 4 boutons de vue Bureau/Mobile/Projecteur/Élève : ils
            n'allumaient que leur propre pastille (`viewMode` n'est consommé nulle
            part). Les VRAIES vues (Design/Élève/Prof/Live) vivent en bas à droite
            du canevas, dans l'éditeur. Un bouton qui ne fait rien est interdit. */}

        <div className="flex-1" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button onClick={undo} title="Annuler (⌘Z)" className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/10 hover:text-white/70 transition-all">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={redo} title="Rétablir (⌘⇧Z)" className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/10 hover:text-white/70 transition-all">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="h-4 w-px bg-white/10 shrink-0" />

        {/* Scènes compteur */}
        {!replie && (
        <span className="hidden text-[11px] text-white/30 sm:block shrink-0">
          {activeIdx + 1} / {totalScenes} scène{totalScenes > 1 ? 's' : ''}
        </span>
        )}

        {!replie && <span className="h-4 w-px bg-white/10 shrink-0" />}

        {/* Plein écran */}
        {!replie && (
        <button
          onClick={onToggleFullscreen}
          title={fullscreen ? 'Quitter plein écran' : 'Plein écran'}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/10 hover:text-white/70 transition-all"
        >
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        )}

        {/* Aide */}
        {!replie && (
        <Link to="/studio/smartboard-aide" title="Aide" className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/10 hover:text-white/70 transition-all">
          <HelpCircle className="h-3.5 w-3.5" />
        </Link>
        )}

        {!replie && <span className="h-4 w-px bg-white/10 shrink-0" />}

        {/* Live */}
        {!replie && (
        <Link to="/studio/live" className="flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition-all hover:bg-red-500/20 shrink-0">
          <Radio className="h-3 w-3" />
          <span className="hidden sm:inline">Live</span>
        </Link>
        )}

        {/* ⋯ MENU DE DÉBORDEMENT — n'existe QUE si la barre s'est repliée. Les
            commandes essentielles (Sauver, Nouveau, Exporter) restent en clair. */}
        {replie && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Plus de commandes"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] text-white/45 transition-all hover:bg-white/10 hover:text-white/80"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-56 border-white/[0.1] bg-[#1f1e1c] p-1 text-white/80"
            >
              <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/25">
                {activeIdx + 1} / {totalScenes} scène{totalScenes > 1 ? 's' : ''}
              </p>
              {entreesRepliees.map((e) => {
                const Icon = e.icon;
                const classes = cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors',
                  e.actif ? 'bg-[#d4924a]/15 text-[#ecc98f]' : 'text-white/55 hover:bg-white/[0.07] hover:text-white/85',
                );
                return e.to ? (
                  <Link key={e.key} to={e.to} className={classes}>
                    <Icon className="h-3 w-3 shrink-0" />{e.label}
                  </Link>
                ) : (
                  <button key={e.key} type="button" onClick={e.onClick} className={classes}>
                    <Icon className="h-3 w-3 shrink-0" />{e.label}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        )}

        {/* Exporter — ⛔ /studio/export-center lit le store des SLIDES : sur TOUT projet
            composé dans le Designer Konva il répond « Aucun slide à exporter ». Le
            centre d'export du canevas (PDF vectoriel + critique de mise en forme avant
            le clic) couvre désormais Document, Affiche et Présentation (cf.
            DOC_TYPES_EXPORT_CANEVAS). */}
        {DOC_TYPES_EXPORT_CANEVAS.has(docType) && typeof onExportDocument === 'function' ? (
          <button
            type="button"
            onClick={onExportDocument}
            title="Exporter (PDF) — relecture de la mise en page d'abord"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/40 transition-all hover:border-white/20 hover:text-white/70 shrink-0"
          >
            <FileOutput className="h-3 w-3" />
            <span className="hidden sm:inline">Exporter</span>
          </button>
        ) : (
          <Link to="/studio/export-center" className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/40 transition-all hover:border-white/20 hover:text-white/70 shrink-0">
            <FileOutput className="h-3 w-3" />
            <span className="hidden sm:inline">Exporter</span>
          </Link>
        )}

        {!replie && <Bell className="h-4 w-4 text-white/25 cursor-pointer hover:text-white/50 transition-colors shrink-0" />}

        {!replie && (
        <Link to="/studio/liri" title="Hub" className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/10 hover:text-white/60 transition-all shrink-0">
          <LogOut className="h-3.5 w-3.5" />
        </Link>
        )}
      </header>

      {/* Bandeaux notification */}
      <AnimatePresence>
        {inviteBanner && (
          <motion.div key="invite" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#d4924a]/20 bg-[#2e2016]/25 px-4 py-1.5 text-[11px] text-[#ecc98f]/90">
              <Info className="h-3.5 w-3.5 text-[#e0a458] shrink-0" />{inviteBanner}
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
            <div className="flex items-center justify-between gap-3 border-b border-[#d97757]/25 bg-[#2e1610]/30 px-4 py-1.5 text-[11px] text-[#f5d9cc]/90">
              <div className="flex min-w-0 items-center gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 text-[#e8a97f]" />
                <span className="truncate">
                  Résumé import : {isnaImportSummary.stepsCount} étape(s) · source {isnaImportSummary.source || '—'} · {isnaImportSummary.savedAtLabel || 'date inconnue'}
                </span>
              </div>
              {typeof onClearIsnaImport === 'function' ? (
                <button
                  type="button"
                  onClick={onClearIsnaImport}
                  className="rounded-md border border-[#e08a5f]/35 bg-[#d97757]/15 px-2 py-0.5 text-[10px] font-semibold text-[#f5d9cc] transition hover:bg-[#d97757]/25"
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
/**
 * ⛔ Les rails Live et Vidéo sont VIDES, et Cinéma ne garde que « Enregistrer ».
 * Pointeur, Annotation, Minuteur, Spotlight, Dessin libre, Segment, Marqueur,
 * Transcription, Capture, Prise, Script et Prompteur n'avaient AUCUNE branche : ni
 * objet posé, ni action, ni message — juste un panneau d'excuses. « Enregistrer »
 * reste parce qu'il est intercepté par `handleTool` (pilote `cinemaBarRef`) et ne
 * passe jamais par le panneau catalogue.
 * Le rail n'est pas vide à l'écran pour autant : « Calques » et « Paramètres canvas »
 * sont ajoutés en pied de `ToolSidebar`, hors de cette table.
 */
const MODE_TOOLS = {
  design: TOOLS,
  live: [],
  video: [],
  cinema: [
    { id: 'record',     icon: Disc,       label: 'Enregistrer',  accent: 'red'     },
  ],
};

function ToolSidebar({ activeTool, onTool, designerMode = 'design', docType = null }) {
  // Context Engine : le type de projet prime sur le mode designer
  let tools;
  if (docType === 'document')     tools = DOCUMENT_TOOLS;
  else if (docType === 'presentation') tools = PRESENTATION_TOOLS;
  else tools = MODE_TOOLS[designerMode] ?? TOOLS;
  /* ⛔ Filet permanent : même si une table de rail réintroduit un outil sans branche
     d'insertion, il ne doit pas s'afficher — sinon il rouvre un panneau vide. */
  tools = tools.filter((tool) => isUsableTool(tool.id));

  return (
    <aside
      className="flex flex-col gap-0.5 w-12 flex-shrink-0 border-r border-white/[0.07] py-3 px-1.5"
      style={{ background: '#1f1e1c' }}
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

      {/* ⛔ Ces deux boutons étaient des <button> SANS onClick : ils survolaient, ils
          cliquaient, et il ne se passait rien. Branchés — pas retirés — parce que les
          deux panneaux existaient déjà (la liste des calques pour l'un, les actions
          canevas du store pour l'autre) : seul le fil manquait. */}
      {[
        { id: 'calques', icon: Layers, label: 'Calques' },
        { id: 'reglages-canvas', icon: Settings2, label: 'Paramètres canvas' },
      ].map((t) => {
        const Icon = t.icon;
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => onTool(isActive ? null : t.id)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl border transition-all',
              isActive
                ? 'border-[#d4924a]/30 bg-[#d4924a]/15 text-[#e0a458]'
                : 'border-transparent text-white/25 hover:bg-white/[0.06] hover:text-white/50',
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
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

/** Dock droit (mode Design) — ACTIONS seulement, jamais de catalogues.
    ⛔ Il portait 4 doublons du rail gauche (Texte, Formes, Sélection, Modèles) qui
    ouvraient leur panneau… dans le tiroir GAUCHE, à ~1 600 px du clic — mesuré, et
    contradictoire en mode Document où le rail métier propose d'AUTRES catalogues de
    texte. Répartition tranchée par le fondateur (2026-08-06) : gauche = outils et
    catalogues, droite = IA et actions. */
function DesignerQuickRail({
  docType,
  designerMode,
  fullscreen,
  onOpenLongia,
  onSelectAll,
}) {
  if (!docType || fullscreen || designerMode !== 'design') return null;
  return (
    <aside
      className="flex w-11 flex-shrink-0 flex-col items-center gap-1 border-l border-white/[0.06] bg-[#1f1e1c] py-2"
      aria-label="Actions studio"
    >
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

/**
 * ⛔ NE PAS « réchauffer » cette table. Ce sont les THÈMES DE TABLEAU proposés à
 * l'enseignant : « Minuit », « Royal », « Forêt », « Or »… autrement dit des
 * DONNÉES qu'il choisit et qui atterrissent dans project.canvas.background — pas
 * du chrome LIRI. Un professeur a parfaitement le droit d'un tableau bleu nuit ;
 * les remplacer par du corail supprimerait des choix, pas de la décoration.
 * (Le chrome de l'éditeur — barres, panneaux, boutons — suit la charte chaude.)
 */
const BG_PRESETS = [
  { id: 'dark',        label: 'Nuit',         value: '#07080c',                              swatch: '#07080c'   },
  { id: 'midnight',    label: 'Minuit',        value: '#0b0d1a',                              swatch: '#0b0d1a'   },
  { id: 'transparent', label: 'Transparent',   value: 'transparent',                          swatch: null        },
  { id: 'white',       label: 'Blanc',         value: '#ffffff',                              swatch: '#ffffff'   },
  { id: 'slate',       label: 'Ardoise',       value: '#2b2520',                              swatch: '#2b2520'   },
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

/**
 * ⚠️ Les `fill` des presets ci-dessous ne sont PAS des données utilisateur : ce
 * sont les encres par défaut que LIRI pose sur le tableau. Elles formaient une
 * échelle FROIDE (#F7F2E8 ivoire, puis lavande #d4d0e0/#c4bfd4, gris-bleu
 * #8892aa, ciel #7dd3fc pour le code) — l'ivoire chaud du titre jurait donc avec
 * son propre sous-titre. L'échelle est rejouée dans la famille chaude, en
 * gardant EXACTEMENT la même hiérarchie de valeurs (4 marches + 1 accent) :
 *   #F7F2E8 titre/corps · #ddd9cf intro · #c9c5bb sous-titre & citation
 *   · #a8a29a légende/note · #e6c48f code (sable, remplace le ciel #7dd3fc).
 * Les neutres sont ceux de @/styles/proTokens (textSecondary #c9c5bb, textMuted
 * #a8a29a), pas des valeurs inventées. Mesurés sur le fond de tableau sombre
 * (« Nuit » #07080c) : 14,2:1 · 11,6:1 · 7,9:1 · 12,1:1 — tous très au-dessus de
 * 4,5:1, comme les froids qu'ils remplacent. Cette famille d'encres a toujours
 * visé un tableau SOMBRE (même l'ivoire #F7F2E8 est illisible sur le preset
 * « Blanc », avant comme après). Le thème du tableau, lui, reste le choix de
 * l'enseignant et n'est pas touché (cf. BG_PRESETS).
 */
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
          style: { fontSize: 20, fontWeight: 400, lineHeight: 1.4,  letterSpacing: 0,    fill: '#c9c5bb' } } },
      { id: 'lead',    label: 'Introduction', sub: '18px · Léger',        shape: '⁋',
        textPreset: { w: 580, h: 58, text: "Texte d'introduction pour accrocher le lecteur dès la première ligne.",
          style: { fontSize: 18, fontWeight: 300, lineHeight: 1.6,  letterSpacing: 0.2,  fill: '#ddd9cf' } } },
      { id: 'body',    label: 'Corps',        sub: '16px · Regular',      shape: 'ΒΤ',
        textPreset: { w: 520, h: 80, text: 'Votre texte principal va ici. Cliquez deux fois pour éditer directement sur le canvas.',
          style: { fontSize: 16, fontWeight: 400, lineHeight: 1.65, letterSpacing: 0.1,  fill: '#F7F2E8' } } },
      { id: 'caption', label: 'Légende',      sub: '12px · Gris',         shape: 'ab',
        textPreset: { w: 340, h: 32, text: 'Légende ou note de bas de page',
          style: { fontSize: 12, fontWeight: 400, lineHeight: 1.5,  letterSpacing: 0.2,  fill: '#a8a29a' } } },
      { id: 'quote',   label: 'Citation',     sub: '16px · Italique',     shape: '❝',
        textPreset: { w: 480, h: 64, text: '« Une pensée inspirante que vous souhaitez mettre en valeur »',
          style: { fontSize: 16, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.7, fill: '#c9c5bb' } } },
      { id: 'label',   label: 'Étiquette',    sub: '10px · Majuscules',   shape: 'TT',
        textPreset: { w: 220, h: 28, text: 'ÉTIQUETTE',
          style: { fontSize: 10, fontWeight: 700, lineHeight: 1.4,  letterSpacing: 3,    fill: '#F7F2E8' } } },
      { id: 'code',    label: 'Code',         sub: 'Monospace · 13px',    shape: '</>',
        textPreset: { w: 380, h: 44, text: 'console.log("Hello, world!")',
          style: { fontSize: 13, fontWeight: 400, fontFamily: 'Courier New, monospace', lineHeight: 1.6, fill: '#e6c48f' } } },
      { id: 'ai',      label: 'IA Texte',     sub: 'Générer avec LONGIA', icon: Sparkles, ai: true },
    ],
    /* ⛔ RÈGLE (vaut pour tout `tabs` de ce catalogue) : `ContextualPanel` ne route
       `activeTab` que pour l'outil `images` — partout ailleurs un 2e onglet affichait
       exactement la même liste : un bouton qui ne fait rien. Un onglet n'existe que
       s'il a un contenu propre ; à un seul onglet, la barre ne s'affiche pas. */
    tabs: ['Styles'],
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
    tabs: ['Couleurs'],
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
    tabs: ['CSS/HTML'],
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
    tabs: ['Modèles LIRI'],
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
    tabs: ['Styles'],
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
    tabs: ['Styles'],
  },
  'doc-liste': {
    label: 'Liste',
    items: [
      { id: 'bullet',    label: 'À puces',        sub: 'Bullets ronds',   shape: '•' },
      { id: 'numbered',  label: 'Numérotée',      sub: '1. 2. 3.',        shape: '1.' },
      { id: 'checklist', label: 'Cases à cocher', sub: 'Tâches / Todo',   shape: '☑' },
      { id: 'glossary',  label: 'Définitions',    sub: 'Terme · Définition', shape: '◦' },
    ],
    tabs: ['Listes'],
  },
  'doc-image': {
    label: 'Image',
    items: [
      /* ⛔ « Texte entoure » était faux : le moteur ne fait pas d'habillage de texte
         autour d'une image. Ces trois entrées posent un bloc image à une géométrie
         donnée — le libellé le dit maintenant. */
      { id: 'upload',   label: 'Importer',         sub: 'PNG / JPG / SVG · 440 px', icon: UploadCloud },
      { id: 'float-l',  label: 'Colonne gauche',   sub: 'Bloc 300 px, marge gauche', shape: '⬱' },
      { id: 'float-r',  label: 'Colonne droite',   sub: 'Bloc 300 px, marge droite', shape: '⬲' },
      { id: 'full',     label: 'Pleine largeur',   sub: 'Bannière 690 px',           shape: '⬛' },
      { id: 'ai',       label: 'IA Image',        sub: 'Générer',        icon: Sparkles, ai: true },
    ],
    tabs: ['Insertion'],
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

/**
 * ⛔ CONTRAINTE DE COQUE — largeur UNIQUE de la gouttière des panneaux (px).
 *
 * Le viewport du canevas ne doit JAMAIS changer de taille à cause d'un panneau :
 * l'éditeur Konva ré-« auto-fit » à chaque redimensionnement de son espace de
 * travail (`SmartboardKonvaEditorV1.jsx`, ResizeObserver → `setScale`). Un
 * panneau qui s'ouvre en flux poussait donc le canevas — et le second clic d'un
 * double-clic atterrissait une ligne plus bas que la cellule visée (verrou de
 * saisie des tableaux). La gouttière est réservée en permanence, à UNE largeur
 * fixe : les panneaux (jadis 210 / 230 / 244 px) la remplissent sans jamais la
 * redimensionner, y compris en passant de l'un à l'autre.
 */
const GOUTTIERE_PANNEAU_PX = 244;

/**
 * ⛔ LARGEUR EN FLUX de la gouttière — INVARIANTE, tiroir replié comme ouvert.
 *
 * Le tiroir se replie tout seul quand il n'a rien à montrer, mais il ne peut pas le
 * faire EN FLUX : rendre 244 px au plan de travail relance l'auto-fit de l'éditeur
 * (ResizeObserver sur `workspaceRef`) et le canevas glisse sous le curseur — le défaut
 * exact que `GOUTTIERE_PANNEAU_PX` avait fermé, et qui mord au pire moment puisque la
 * réouverture se produit À LA SÉLECTION, donc ENTRE les deux clics d'un double-clic.
 * Seul ce liseré occupe donc le flux, en permanence ; le panneau s'ouvre EN
 * SURIMPRESSION à sa droite. La largeur du plan de travail ne dépend alors plus du
 * tout de l'état du tiroir : la non-régression tient par CONSTRUCTION.
 *
 * ⚠️ Compenser le glissement (décaler le stage de la moitié de la variation) n'était
 * pas jouable : `canvasPan.x` est borné à `panXMax = max(0, cw × scale − largeurEspace)/2`,
 * donc à ZÉRO dès que le canevas tient dans l'espace — le cas courant. Il n'existe
 * aucun endroit où poser la compensation sans défaire cette borne, qui est elle-même
 * ce qui garde la moitié droite d'un canevas zoomé atteignable.
 */
const GOUTTIERE_LISERE_PX = 26;

/**
 * ⛔ LA SURIMPRESSION N'EST PAS TOUJOURS PERMISE — mesuré, pas supposé.
 *
 * Un panneau posé par-dessus le plan de travail ne coûte rien tant que la page
 * ajustée laisse assez de marge à sa gauche. Sur un canevas PAYSAGE elle n'en laisse
 * pas : à 1157 × 994, SmartBoard 1920×1080 et Présentation 16/9 rendent une page de
 * 1007 px dont le panneau ouvert recouvrait 227 px — bande invisible ET inatteignable
 * au pointeur. La gouttière revient donc, pour ces formats-là seulement, à sa largeur
 * pleine EN FLUX (comportement d'avant, ni gain ni régression).
 *
 * ⛔ La décision ne dépend QUE du format du canevas et de la taille de la fenêtre —
 * JAMAIS de l'état du tiroir. C'est ce qui interdit à la gouttière de changer de
 * largeur à l'ouverture ou au repli, et c'est toute la garantie de ce fichier.
 * La largeur totale « zone + gouttière » étant invariante, il n'y a aucune boucle
 * de rétroaction avec le ResizeObserver ; l'hystérésis ci-dessous ne couvre que le
 * tremblement sous-pixel d'un redimensionnement au ras du seuil.
 */
const HYSTERESIS_SURIMPRESSION_PX = 16;

/** Largeur de la poignée de repli/réouverture — toujours DANS la gouttière, jamais au-dessus du canevas. */
const POIGNEE_TIROIR_PX = 18;

/** Hauteur RÉSERVÉE de la barre de propriétés (px) — même contrainte que la gouttière, sur l'axe vertical. */
const BARRE_PROPS_PX = 44;

/**
 * Plancher d'échelle à l'ÉDITION.
 *
 * ⛔ SEUIL MESURÉ, pas choisi à vue. La cible d'un double-clic dans un tableau est
 * la CELLULE (nœud texte, 15,4 px du repère document) : sa fenêtre de clic
 * verticale vaut ~15,4 × échelle. Sondée dans le navigateur avec
 * `stage.getIntersection()` (balayage vertical au pixel), elle mesure 5 px à
 * l'échelle 0,3645 et 11 px à 0,73. On retient 10 px de fenêtre comme minimum
 * utilisable → 10 / 15,4 ≈ 0,62.
 *
 * ⚠️ Un plancher ne se pose QUE parce que le canevas défile désormais : sans
 * défilement il rognerait le haut de la page — la panne que la borne de largeur
 * ci-dessous avait précisément corrigée.
 *
 * ⛔ UNE SEULE SOURCE : le même seuil pilote l'ajustement automatique de l'éditeur.
 * Deux copies dériveraient, et la borne de largeur viserait une échelle que
 * l'ajustement ne produit plus.
 */
const PLANCHER_ECHELLE_EDITION = PLANCHER_ECHELLE_DOCUMENT;

/** Largeur de viewport qui produit exactement `PLANCHER_ECHELLE_EDITION`. */
const LARGEUR_VIEWPORT_PLANCHER = PLANCHER_ECHELLE_EDITION * SMARTBOARD_DESIGN_WIDTH + 32;

/**
 * ⛔ CONTRAINTE EXTERNE — le sommet de la page doit être atteignable.
 *
 * ⚠️ HISTORIQUE, désormais inerte dans le cas courant : l'auto-fit de l'éditeur
 * mesure maintenant le canevas RÉEL (`echelleAjustementCanevas`). La sonde ci-dessous
 * l'interroge, donc elle ne borne plus rien tant que l'ajustement suffit. Elle reste
 * en place comme filet pour un canevas qu'aucune échelle ne loge.
 *
 * L'auto-fit de l'éditeur ne mesurait PAS le canevas réel : il logeait le gabarit de
 * conception 1037×750 dans l'espace disponible. Sur une page A4 PORTRAIT (794×1123),
 * l'échelle retenue est bornée par la hauteur d'un gabarit PAYSAGE : la page
 * dépasse d'environ 350 px, se centre, et l'espace de travail (overflow hidden,
 * sans défilement) la rogne — mesuré : sommet de la page à y = −134 px. Le haut
 * du document, donc la PREMIÈRE LIGNE d'un tableau, n'était atteignable ni au
 * clic ni au double-clic.
 *
 * Depuis la coque, le seul levier est la LARGEUR : en la bornant, le facteur
 * limitant de l'ajustement redevient la largeur et l'échelle retombe assez bas
 * pour que la page entière tienne. La borne est CHERCHÉE avec la fonction
 * d'ajustement de l'éditeur elle-même — aucune constante n'est recopiée ici.
 *
 * ⚠️ Ne vaut que pour un canevas PORTRAIT. Un canevas paysage (SmartBoard
 * 1920×1080) déborde lui aussi, et AUCUNE largeur ne le corrige : il faut
 * réparer l'auto-fit à sa source (`SmartboardKonvaEditorV1`, ResizeObserver).
 * La fonction rend alors `null` — pas de faux correctif.
 *
 * ⛔ CE QUI EST CADRÉ EST UNE PAGE, PAS LA PILE. Cadrer le canevas entier faisait
 * dépendre l'échelle du NOMBRE DE PAGES : mesuré à viewport 1601×1000, une page
 * donne 0,73 et deux pages 0,3645 — la fenêtre de clic verticale d'une cellule de
 * tableau tombe de 11 px à 5 px, alors que le tableau, lui, n'a pas bougé. Voir
 * `hauteurDeCadrage`. Les pages suivantes se rejoignent à la molette (défilement
 * vertical du canevas, `SmartboardKonvaEditorV1`).
 *
 * @returns {number | null} largeur maximale du viewport, ou null s'il n'y a rien à borner.
 */
function largeurViewportPourPageEntiere(largeurDispo, hauteurDispo, canvasW, canvasH) {
  if (!(largeurDispo > 8) || !(hauteurDispo > 8) || !(canvasW > 0) || !(canvasH > 0)) return null;
  const utile = hauteurDispo - 32;
  const hCadre = hauteurDeCadrage(canvasW, canvasH);
  /* ⛔ La sonde DOIT interroger la MÊME règle d'ajustement que l'éditeur, sinon
     elle borne la largeur pour compenser un défaut qui n'existe plus — et rétrécit
     l'espace de travail sans rien corriger. Depuis que l'ajustement mesure le
     canevas réel, `tient()` répond vrai d'emblée et la borne se retire d'elle-même
     (elle reste en place pour un canevas qu'aucune échelle ne loge). */
  const tient = (w) => {
    const s = echelleAjustementCanevas(w - 32, utile, canvasW, canvasH);
    if (s == null) return true;
    return s * hCadre <= utile + 0.5 && s * canvasW <= w - 32 + 0.5;
  };
  if (tient(largeurDispo)) return null;
  const mini = 320;
  if (largeurDispo <= mini || !tient(mini)) return null;
  let bas = mini;
  let haut = largeurDispo;
  for (let i = 0; i < 22; i += 1) {
    const mid = (bas + haut) / 2;
    if (tient(mid)) bas = mid; else haut = mid;
  }
  /* Plancher : ne jamais descendre sous une échelle où plus rien ne se pointe.
     La borne reste ≤ largeurDispo — au-delà elle ne bornerait plus rien. */
  const borne = Math.max(bas, LARGEUR_VIEWPORT_PLANCHER);
  if (borne >= largeurDispo) return null;
  return Math.floor(borne);
}

/** Ouverture/fermeture d'un panneau : glissement seul — JAMAIS d'animation de largeur (cf. GOUTTIERE_PANNEAU_PX). */
const ANIM_PANNEAU = {
  initial: { opacity: 0, x: -14 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -14 },
  transition: { duration: 0.16, ease: 'easeOut' },
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
    <p className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-white/20">{children}</p>
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
      {...ANIM_PANNEAU}
      className="absolute inset-0 flex flex-col overflow-hidden border-r border-white/[0.07]"
      style={{ background: '#17150f' }}
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
                { lbl: 'S',   style: { fontSize: 20, fontWeight: 400, lineHeight: 1.4,  fill: '#c9c5bb' } },
                { lbl: 'ΒΤ',  style: { fontSize: 16, fontWeight: 400, lineHeight: 1.65 } },
                { lbl: 'ab',  style: { fontSize: 12, fontWeight: 400, lineHeight: 1.5,  fill: '#a8a29a' } },
                { lbl: '❝',   style: { fontSize: 16, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.7, fill: '#c9c5bb' } },
              ].map(p => (
                <button key={p.lbl} type="button" onClick={() => updateStyle(p.style)}
                  className="flex h-7 min-w-[30px] items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[10px] font-bold text-white/45 transition-all hover:border-[#d4924a]/30 hover:bg-[#d4924a]/10 hover:text-[#e6b566]">
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
                  className="w-full appearance-none rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-2.5 pr-7 text-[11px] text-white/70 focus:border-[#d4924a]/30 focus:outline-none"
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
              {/* ⛔ `Math.max(6, v)` laissait passer NaN (Math.max(6, NaN) = NaN) :
                  une saisie non numérique effaçait la taille. On refuse au lieu de convertir. */}
              <NumInput
                value={obj.style?.fontSize ?? 16}
                onChange={v => { const t = tailleDePoliceValide(v); if (t != null) updateStyle({ fontSize: t }); }}
                min={TAILLE_POLICE_MIN} max={TAILLE_POLICE_MAX} w="w-10"
              />
              <div className="relative flex-1">
                <select
                  value={obj.style?.fontWeight ?? 400}
                  onChange={e => updateStyle({ fontWeight: Number(e.target.value) })}
                  className="w-full appearance-none rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-2 pr-6 text-[10px] text-white/70 focus:border-[#d4924a]/30 focus:outline-none"
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
                      ? 'border-[#d4924a]/30 bg-[#d4924a]/15 text-[#e6b566]'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-[#d4924a]/30 hover:bg-[#d4924a]/10 hover:text-[#e6b566]')}>
                  B
                </button>
                {/* I */}
                <button type="button" title="Italique"
                  onClick={() => updateStyle({ fontStyle: obj.style?.fontStyle === 'italic' ? 'normal' : 'italic' })}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg border text-[12px] font-bold italic transition-all',
                    obj.style?.fontStyle === 'italic'
                      ? 'border-[#d4924a]/30 bg-[#d4924a]/15 text-[#e6b566]'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-[#d4924a]/30 hover:bg-[#d4924a]/10 hover:text-[#e6b566]')}>
                  I
                </button>
                {/* U */}
                <button type="button" title="Souligné"
                  onClick={() => updateStyle({ textDecoration: obj.style?.textDecoration === 'underline' ? '' : 'underline' })}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg border text-[12px] font-bold underline transition-all',
                    obj.style?.textDecoration === 'underline'
                      ? 'border-[#d4924a]/30 bg-[#d4924a]/15 text-[#e6b566]'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-[#d4924a]/30 hover:bg-[#d4924a]/10 hover:text-[#e6b566]')}>
                  U
                </button>
                {/* S */}
                <button type="button" title="Barré"
                  onClick={() => updateStyle({ textDecoration: obj.style?.textDecoration === 'line-through' ? '' : 'line-through' })}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg border text-[12px] font-bold line-through transition-all',
                    obj.style?.textDecoration === 'line-through'
                      ? 'border-[#d4924a]/30 bg-[#d4924a]/15 text-[#e6b566]'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-[#d4924a]/30 hover:bg-[#d4924a]/10 hover:text-[#e6b566]')}>
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
                        ? 'border-[#d4924a]/30 bg-[#d4924a]/15 text-[#e6b566]'
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
                    className="h-1 w-full appearance-none rounded-full bg-white/10 accent-[#e0a458]" />
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
                      ? 'border-[#d4924a]/30 bg-[#d4924a]/15 text-[#e6b566]'
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
                        className="h-1 w-full appearance-none rounded-full bg-white/10 accent-[#e0a458]" />
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
            <DocumentTextAiActions
              text={obj.content?.text ?? ''}
              onApply={(next) => updateObject(obj.id, { content: { text: next } })}
            />
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
                <p className="truncate font-mono text-[10px] text-white/30">{toHex(String(obj.style?.fill || '#d97757'))}</p>
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
                    className="h-1 flex-1 appearance-none rounded-full bg-white/10 accent-[#e08a5f]" />
                  <span className="w-9 text-right text-[10px] text-white/40">{obj.style?.cornerRadius ?? 0}px</span>
                </div>
              </>
            )}

            {/* ⛔ Bloc « IA LONGIA » (Palette harmonieuse, Style graphique) RETIRÉ :
                les boutons n'avaient aucun handler et aucun moteur design n'est branché
                sur ce panneau. Un bouton décoratif est interdit — le rebrancher passe par
                CanvaDesignPanel / improveSceneLayout, qui ne sont pas montés ici. */}
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
                    className="h-1 w-full appearance-none rounded-full bg-white/10 accent-[#7bb06a]" />
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

            {/* ⛔ Bloc « IA LONGIA » (Détourage, Améliorer l'image, Générer variante) RETIRÉ :
                aucun handler, aucun pipeline image branché depuis ce panneau. */}
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
            {/* ⛔ Bloc « IA LONGIA » (Optimiser, Variante créative) RETIRÉ : aucun handler. */}
          </>
        )}

        {/* ────── OPACITÉ (tous types) ────── */}
        <div className="px-3 pb-4 pt-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Opacité</span>
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

/* ── Opérations booléennes ──
   ⛔ « Exclure » (XOR), « Décomposer », « Masque découp. » et « Libérer masque » sont
   RETIRÉS des grilles : leur clic n'écrivait RIEN au document (juste un message
   « À venir » dans le chat) — un bouton qui ne fait rien est interdit. Ils ne
   reviendront qu'avec le moteur de clipping vectoriel qui leur donne un effet. */
const FV_BOOLEAN = [
  { id: 'unite',     label: 'Unir',         sub: 'Fusionner les contours',  glyph: '⊕', color: 'emerald', needs: 2 },
  { id: 'subtract',  label: 'Soustraire',   sub: 'Le dessus mord le dessous', glyph: '⊖', color: 'rose',    needs: 2 },
  { id: 'intersect', label: 'Intersecter',  sub: 'Zone commune réelle',     glyph: '⊗', color: 'blue',    needs: 2 },
  /* ⛔ « Diviser » appelait subdivideSelected (doublon strict de Subdiviser) alors que
     son libellé promettait « Couper aux intersect. » — il coupe désormais VRAIMENT aux
     intersections de DEUX formes (restes + zone commune), d'où needs: 2. */
  { id: 'divide',    label: 'Diviser',      sub: 'Couper aux intersect. (2 formes)', glyph: '⊟', color: 'amber',   needs: 2 },
];

/** Raisons de refus des booléens, dites à l'écran plutôt qu'un résultat faux. */
const FV_BOOL_RAISONS = {
  type: 'Les opérations booléennes ne travaillent que sur des formes et tracés — pas sur le texte, les images ou les flèches.',
  ligne_plate: 'Un tracé de deux ancres n’enclot aucune surface : ajoutez une ancre d’abord.',
  disjointes: 'Les formes ne se touchent pas : aucune surface commune à traiter.',
  vide: 'Le résultat serait vide (forme entièrement recouverte).',
  trou: 'Ce découpage créerait un anneau (trou) — non représentable ici, le moteur n’a pas de chemins composés.',
  couture: 'Contours trop enchevêtrés (bords confondus, tracé auto-sécant) : opération refusée plutôt que faussée.',
  deux: 'Diviser travaille sur exactement DEUX formes qui se chevauchent.',
  selection: 'Sélectionnez au moins deux formes.',
};

/* ── Organisation ── */
const FV_ORGANIZE = [
  { id: 'group',       label: 'Grouper',          sub: 'Ctrl+G',       icon: Layers,        needs: 2 },
  { id: 'ungroup',     label: 'Dégrouper',        sub: 'Ctrl+Shift+G', icon: Layers,        needs: 1 },
  { id: 'subdivide',   label: 'Subdiviser',       sub: 'Couper en 4',  icon: LayoutGrid,    needs: 1 },
];

const FV_BOOL_COLORS = {
  emerald: 'border-[#5a8f52]/30 bg-[#5a8f52]/10 text-[#9cc48a] hover:bg-[#5a8f52]/20',
  rose:    'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
  blue:    'border-[#d4924a]/30 bg-[#d4924a]/10 text-[#e6b566] hover:bg-[#d4924a]/20',
  violet:  'border-[#d97757]/30 bg-[#d97757]/10 text-[#e8a97f] hover:bg-[#d97757]/20',
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
  const diviserSelection = useSmartboardKonvaStore(s => s.diviserSelection);
  const addLongiaMessage = useSmartboardKonvaStore(s => s.addLongiaMessage);

  const selCount = selectedIds.length;
  const activeSceneObjs = scenes.find(s => s.id === activeSceneId)?.objects ?? [];
  const selObj = activeSceneObjs.find(o => o.id === selectedIds[0]) ?? null;

  /* Un booléen refuse texte/image/flèche : le bouton se DÉSACTIVE avec la raison au
     survol au lieu de transformer un titre en rectangle muet (défaut mesuré). */
  const selObjs = activeSceneObjs.filter(o => selectedIds.includes(o.id));
  const inoperable = selObjs.find(o => !estOperableBooleen(o).ok) ?? null;
  const raisonInoperable = inoperable
    ? (estOperableBooleen(inoperable).raison === 'ligne_plate'
        ? FV_BOOL_RAISONS.ligne_plate
        : `${FV_BOOL_RAISONS.type} (sélection : ${ELEMENT_META[inoperable.type]?.label ?? inoperable.type})`)
    : null;

  /**
   * ⛔ [AFF-DPI] CE PANNEAU EST LE SEUL CHEMIN D'INSERTION DE FORMES ATTEIGNABLE.
   * L'outil « Formes » du rail gauche renvoie ici (cf. le routage `if (tool === 'formes')`
   * de `ContextualPanel`) : la branche `tool === 'formes'` de `handleAdd`, elle, est
   * MORTE — le routage rend avant de l'atteindre. Le report à la résolution du canevas
   * fait à cet endroit-là ne servait donc à rien.
   *
   * Mesuré le 2026-08-05 sur l'affiche Orabank (2480 × 3508, A4 @300 dpi) : la bulle
   * « DISPONIBLE EN 72H » sortait en 160 × 130 px, soit 1,4 × 1,1 cm sur une page de
   * 21 × 29,7 cm — un confetti. Les valeurs des tables restent écrites en px @96 dpi
   * (c'est l'unité du Designer) ; c'est l'insertion qui les reporte.
   *
   * ⚠️ Sur tout canevas déjà 96 dpi (Document 794 × 1123, Smartboard/Présentation
   * 1920 × 1080) `echelleDuCanevas` rend 1 : pas un pixel ne bouge.
   */
  const canvasLargeur = useSmartboardKonvaStore(s => s.project?.canvas?.width ?? 0);
  const canvasHauteur = useSmartboardKonvaStore(s => s.project?.canvas?.height ?? 0);
  const echelleFormes = useMemo(
    () => echelleDuCanevas(canvasLargeur, canvasHauteur),
    [canvasLargeur, canvasHauteur],
  );
  const Ef = useCallback((px96) => pxCanevas(px96, echelleFormes), [echelleFormes]);

  /* ── Ajout d'une forme ── */
  const handleShape = (id) => {
    const base = {
      x: Ef(100 + Math.random() * 80),
      y: Ef(100 + Math.random() * 60),
      style: { fill: 'rgba(217,119,87,0.28)', stroke: '#d97757', strokeWidth: Ef(2) },
    };
    switch (id) {
      case 'roundrect': addObject({ ...base, type: 'rect', width: Ef(160), height: Ef(120), style: { ...base.style, cornerRadius: Ef(20) } }); break;
      case 'circle':    addObject({ ...base, type: 'circle', width: Ef(120), height: Ef(120) }); break;
      case 'ellipse':   addObject({ ...base, type: 'ellipse', width: Ef(180), height: Ef(110) }); break;
      case 'triangle':  addObject({ ...base, type: 'triangle', width: Ef(140), height: Ef(140) }); break;
      case 'diamond':   addObject({ ...base, type: 'diamond', width: Ef(130), height: Ef(150) }); break;
      /* `innerRadius`/`outerRadius` sont des RAYONS EN PIXELS lus par le rendu Konva :
         sans report, l'étoile resterait un confetti dans une boîte à l'échelle. */
      case 'pentagon':  addObject({ ...base, type: 'starshape', width: Ef(130), height: Ef(130), content: { numPoints: 5, innerRadius: Ef(52), outerRadius: Ef(64) } }); break;
      case 'hexagon':   addObject({ ...base, type: 'starshape', width: Ef(130), height: Ef(130), content: { numPoints: 6, innerRadius: Ef(56), outerRadius: Ef(64) } }); break;
      case 'starshape': addObject({ ...base, type: 'starshape', width: Ef(130), height: Ef(130), content: { numPoints: 5, innerRadius: Ef(28), outerRadius: Ef(64) } }); break;
      case 'star6':     addObject({ ...base, type: 'starshape', width: Ef(130), height: Ef(130), content: { numPoints: 6, innerRadius: Ef(32), outerRadius: Ef(64) } }); break;
      /* `points` est en coordonnées LOCALES du tracé : il suit la largeur, pas la boîte. */
      case 'line':      addObject({ type: 'line', x: Ef(80), y: Ef(200), width: Ef(200), height: Ef(4), content: { points: [0,0,Ef(200),0] }, style: { stroke: '#a8a29a', strokeWidth: Ef(3) } }); break;
      case 'arrow':     addObject({ type: 'arrow', x: Ef(80), y: Ef(200), width: Ef(200), height: Ef(4), content: { points: [0,0,Ef(200),0] }, style: { stroke: '#a8a29a', fill: '#a8a29a', strokeWidth: Ef(3), pointerLength: Ef(10), pointerWidth: Ef(10) } }); break;
      default:          addObject({ ...base, type: 'rect', width: Ef(160), height: Ef(130), style: { ...base.style, cornerRadius: 0 } });
    }
  };

  /* ── Activation d'un outil de tracé ── */
  const handlePen = (id) => {
    if (activeVectorTool === id) { clearVectorTool(); return; }
    setVectorTool(id);
    /* Chaque outil dit ce qu'il fait VRAIMENT — plus de « support en cours ». */
    const consignes = {
      pen: '✦ Plume activée — cliquez pour poser des ancres, Entrée (ou double-clic sur place) termine le chemin.',
      penAdd: '✦ Ajouter ancre — cliquez sur un tracé : une ancre est insérée au point cliqué.',
      penRemove: '✦ Suppr. ancre — cliquez un tracé pour voir ses ancres, puis cliquez l’ancre à ôter.',
      penConvert: '✦ Convertir point — cliquez une ancre intérieure : le coin devient une courbe (arrondi, SENS UNIQUE : le retour au coin n’existe pas).',
      pencil: '✦ Crayon activé — tracez librement, la molette règle l’épaisseur.',
      eraser: '✦ Gomme activée — balayez les tracés à effacer (un balayage = un pas d’historique).',
      directSelect: '✦ Sélection directe — cliquez un tracé puis glissez ses ancres (points cyan) pour remodeler le chemin.',
    };
    addLongiaMessage({ role: 'ai', text: consignes[id] ?? `✦ Outil ${id} activé.` });
  };

  /* ── Opérations booléennes — messages tirés du RÉSULTAT, jamais affirmés d'avance ── */
  const direRefus = (r) => {
    addLongiaMessage({ role: 'ai', text: `✦ Opération refusée : ${FV_BOOL_RAISONS[r?.raison] ?? 'cas non traité par le moteur.'}` });
  };
  const handleBoolean = (id) => {
    if (selCount < 2) return;
    if (id === 'unite') {
      const r = uniteSelected();
      if (r.ok) addLongiaMessage({ role: 'ai', text: `✦ ${r.count} formes fusionnées en UN chemin fermé (contours réels, style de la forme du dessous).` });
      else direRefus(r);
      return;
    }
    if (id === 'subtract') {
      const r = subtractSelected();
      if (r.ok) addLongiaMessage({ role: 'ai', text: `✦ Forme du dessus soustraite : le dessous est entaillé (${r.count} morceau${r.count > 1 ? 'x' : ''}).` });
      else direRefus(r);
      return;
    }
    if (id === 'intersect') {
      const r = intersectSelected();
      if (r.ok) addLongiaMessage({ role: 'ai', text: `✦ Zone commune réelle conservée (${r.count} chemin${r.count > 1 ? 's' : ''}).` });
      else direRefus(r);
      return;
    }
    if (id === 'divide') {
      const r = diviserSelection();
      if (r.ok) addLongiaMessage({ role: 'ai', text: `✦ Découpe aux intersections : ${r.count} morceaux indépendants (restes + zone commune).` });
      else direRefus(r);
    }
  };

  /* ── Organisation ── */
  const handleOrganize = (id) => {
    if (id === 'group') {
      if (selCount >= 2 && groupSelected()) {
        addLongiaMessage({ role: 'ai', text: `✦ ${selCount} éléments groupés — un clic sur un membre sélectionne et déplace tout le groupe (⌘G / ⌘⇧G au clavier).` });
      }
      return;
    }
    if (id === 'ungroup') {
      if (selCount < 1) return;
      const n = ungroupSelected();
      addLongiaMessage({
        role: 'ai',
        text: n ? `✦ ${n} groupe${n > 1 ? 's' : ''} dissous — les objets redeviennent indépendants.` : '✦ Aucun groupe dans la sélection.',
      });
      return;
    }
    if (id === 'subdivide') { if (selCount >= 1) { subdivideSelected(); addLongiaMessage({ role: 'ai', text: '✦ Forme subdivisée en 4 parties égales.' }); } }
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
      {...ANIM_PANNEAU}
      className="absolute inset-0 flex flex-col border-r border-white/[0.07] overflow-hidden"
      style={{ background: '#17150f' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5 shrink-0">
        <Hexagon className="h-3.5 w-3.5 text-[#e08a5f]" />
        <span className="text-[12px] font-semibold text-[#e8a97f]">Formes & Vecteur</span>
        {activeVectorTool && (
          <span className="ml-1 rounded-md border border-[#d97757]/25 bg-[#d97757]/15 px-1.5 py-0.5 text-[8px] font-bold text-[#e8a97f] uppercase tracking-wide">
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
        <div className="mx-3 mt-2 flex items-center gap-1.5 rounded-xl border border-[#d97757]/20 bg-[#d97757]/[0.07] px-2.5 py-1.5 shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-[#e08a5f] shadow-[0_0_5px_rgba(236,174,144,0.8)]" />
          <span className="text-[10px] text-[#e8a97f]/80 font-medium">{selCount} sélectionné{selCount > 1 ? 's' : ''}</span>
          {selObj && <span className="ml-1 text-[9px] text-[#e08a5f]/60">· {ELEMENT_META[selObj.type]?.label}</span>}
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
        <SecHead label="Formes de base" color="text-[#e08a5f]/70" />
        <div className="mx-3 grid grid-cols-3 gap-1 mb-1">
          {FV_SHAPES.map(sh => (
            <button key={sh.id} onClick={() => handleShape(sh.id)}
              title={sh.label + (sh.shortcut ? ` (${sh.shortcut})` : '')}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 px-1 hover:border-[#d97757]/30 hover:bg-[#d97757]/10 transition-all active:scale-95">
              <span className="text-[16px] leading-none text-white/60">{sh.shape}</span>
              <span className="text-[8px] text-white/35 truncate w-full text-center leading-tight">{sh.label}</span>
            </button>
          ))}
        </div>

        <div className="mx-3 my-2.5 h-px bg-white/[0.05]" />

        {/* ──────── OUTILS DE TRACÉ ──────── */}
        <SecHead icon={PenTool} label="Tracé & Plume" color="text-[#e0a458]/70" />
        <div className="mx-3 space-y-0.5 mb-1">
          {FV_PEN.map(t => {
            const Icon = t.icon;
            const isActive = activeVectorTool === t.id;
            return (
              <button key={t.id} onClick={() => handlePen(t.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all',
                  isActive
                    ? 'border-[#d4924a]/35 bg-[#d4924a]/15 text-[#e6b566]'
                    : 'border-transparent hover:border-white/10 hover:bg-white/[0.04] text-white/55',
                )}>
                <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-[#e0a458]' : 'text-white/35')} />
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
        <SecHead icon={MousePointer2} label="Sélection directe" color="text-[#e0a458]/70" />
        <div className="mx-3 mb-1">
          {FV_SELECT.map(t => {
            const Icon = t.icon;
            const isActive = activeVectorTool === t.id;
            return (
              <button key={t.id} onClick={() => handlePen(t.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 transition-all',
                  isActive
                    ? 'border-[#d4924a]/35 bg-[#d4924a]/15 text-[#e6b566]'
                    : 'border-white/[0.07] bg-white/[0.02] text-white/55 hover:bg-white/[0.05] hover:border-white/10',
                )}>
                <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-[#e0a458]' : 'text-white/35')} />
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
            const assez = selCount >= op.needs && (op.id !== 'divide' || selCount === 2);
            const enabled = assez && !inoperable;
            const titre = !assez
              ? `${op.label} — ${op.id === 'divide' ? 'sélectionnez exactement 2 formes' : `sélectionnez ${op.needs}+ formes`}`
              : inoperable
                ? `${op.label} — ${raisonInoperable}`
                : `${op.label} — ${op.sub}`;
            return (
              <button key={op.id} onClick={() => enabled && handleBoolean(op.id)}
                title={titre}
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
        {/* Légende booléenne — dit aussi POURQUOI c'est désactivé (règle : jamais un
            bouton muet, la raison au survol ET sous la grille). */}
        <p className="mx-3 mb-2 text-[8.5px] text-white/20 leading-relaxed">
          {selCount < 2
            ? 'Sélectionnez 2 formes qui se chevauchent pour activer les opérations.'
            : inoperable
              ? raisonInoperable
              : `${selCount} formes sélectionnées — les opérations travaillent sur les contours réels.`}
        </p>

        <div className="mx-3 my-2 h-px bg-white/[0.05]" />

        {/* ──────── ORGANISATION ──────── */}
        <SecHead icon={Layers} label="Organisation & Découpage" color="text-[#7bb06a]/70" />
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
                    ? 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-[#5a8f52]/10 hover:border-[#5a8f52]/25 hover:text-[#9cc48a] active:scale-95'
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
            className="flex w-full items-center gap-2 rounded-xl border border-[#d97757]/20 bg-[#d97757]/[0.07] px-3 py-2.5 hover:bg-[#d97757]/10 transition-colors">
            <Sparkles className="h-4 w-4 text-[#e08a5f] shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-[#e8a97f]">IA Forme — LONGIA</p>
              <p className="text-[9px] text-[#e08a5f]/60">Décrire ou générer une forme</p>
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

/** Familles d'outils dont `handleAdd` sait produire un objet sans condition d'identifiant. */
const CATALOG_TOOLS_WITH_INSERT = new Set([
  'texte', 'formes', 'doc-titre', 'doc-para', 'doc-liste', 'doc-hr',
  'slide-titre', 'slide-texte', 'slide-forme',
]);
/** Modèles réellement construits par `handleAdd` (les autres ids n'ont aucune branche). */
const CATALOG_TEMPLATE_IDS = new Set(['intro', 'timeline', 'compare', 'mindmap', 'quiz']);

/**
 * Un item du catalogue produit-il vraiment quelque chose ?
 *
 * ⛔ Miroir OBLIGATOIRE de `handleAdd`. Des dizaines d'entrées (icônes, fonds, tableau,
 * minuteur, laser, et les 11 items « IA » en corail) s'affichaient comme des boutons
 * ordinaires et ne faisaient RIEN au clic — ni objet, ni message, ni erreur. Tant qu'une
 * famille n'a pas sa branche dans `handleAdd`, elle ne doit pas s'afficher.
 * Toute branche ajoutée à `handleAdd` doit être déclarée ici, sinon elle restera invisible.
 *
 * @param {string | null | undefined} tool
 * @param {{ id?: string; ai?: boolean } | null | undefined} item
 */
function isInsertableCatalogItem(tool, item) {
  if (!item) return false;
  // Aucun item marqué `ai` n'est branché (ni `ai`, ni `ai-gen`, ni les variantes par onglet).
  if (item.ai || item.id === 'ai' || item.id === 'ai-gen') return false;
  if (tool === 'images') {
    return item.id === 'upload' || item.id === 'library' || Boolean(DESIGNER_STOCK_IMAGE_URL[item.id]);
  }
  if (tool === 'doc-image') {
    return ['upload', 'float-l', 'float-r', 'full'].includes(item.id);
  }
  if (tool === 'animes') return item.id === 'html';
  if (tool === 'modeles') return CATALOG_TEMPLATE_IDS.has(item.id);
  return CATALOG_TOOLS_WITH_INSERT.has(tool);
}

/**
 * Prompts d'amorce du générateur d'images. Ils dictaient « bleu nuit » et
 * « or et bleu » : les visuels fabriqués depuis le studio arrivaient donc froids
 * sur un canvas chaud. Les consignes de palette suivent maintenant la charte
 * (terre / terracotta / or) — le reste du prompt est inchangé.
 */
const DESIGNER_IA_IMAGE_PRESETS = [
  {
    label: 'LIRI',
    prompt:
      'Illustration pédagogique : immersion LIRI, écran montrant un transmetteur digne, élève concentré, palette sombre terre et or chaud, cinématique, aucun texte lisible dans l\'image.',
  },
  {
    label: 'MK5',
    prompt:
      'Infographie pédagogique sombre : schéma clair or et terracotta sur fond #262624, flux ou cycles, style académique premium, pas de texte dans l\'image.',
  },
  {
    label: 'Symbole',
    prompt:
      'Symbole spirituel abstrait et sobre, géométrie dorée douce, fond noir profond, peinture digitale élégante, aucun texte.',
  },
];

/* ── Coque commune des panneaux du rail gauche (remplit la gouttière, même chrome que ContextualPanel) ── */
function ToolAside({ label, onClose, children }) {
  return (
    <motion.aside
      {...ANIM_PANNEAU}
      className="absolute inset-0 flex flex-col border-r border-white/[0.07] overflow-hidden"
      style={{ background: '#17150f' }}
    >
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5 shrink-0">
        <span className="text-[12px] font-semibold text-[#e0976a]">{label}</span>
        <div className="flex-1" />
        <button onClick={onClose} className="h-5 w-5 flex items-center justify-center rounded-md text-white/30 hover:text-white/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">{children}</div>
    </motion.aside>
  );
}

/** Panneau « Calques » — la pile réelle : réordonner, renommer, masquer, verrouiller. */
function LayersToolPanel({ onClose }) {
  const scenes = useSmartboardKonvaStore(s => s.project?.scenes ?? []);
  const activeSceneId = useSmartboardKonvaStore(s => s.project?.activeSceneId);
  const selectedIds = useSmartboardKonvaStore(s => s.selectedIds);
  const selectOnly = useSmartboardKonvaStore(s => s.selectOnly);
  const toggleObjectLock = useSmartboardKonvaStore(s => s.toggleObjectLock);
  const toggleObjectVisibility = useSmartboardKonvaStore(s => s.toggleObjectVisibility);
  const updateObject = useSmartboardKonvaStore(s => s.updateObject);
  const bringToFront = useSmartboardKonvaStore(s => s.bringToFront);
  const sendToBack = useSmartboardKonvaStore(s => s.sendToBack);
  const pushHistory = useSmartboardKonvaStore(s => s.pushHistory);
  const [query, setQuery] = useState('');
  const objects = scenes.find(s => s.id === activeSceneId)?.objects ?? [];

  /**
   * Renumérote TOUTE la pile après un glissement.
   *
   * ⛔ Le rendu trie par `layer` avec un tri STABLE : déplacer une seule ligne sans
   * renuméroter laisserait des ex æquo, et la pile affichée ne serait plus celle
   * qui est dessinée. `updateObject` n'empile pas d'historique — un seul
   * `pushHistory` en tête rend le glissement annulable d'un seul Ctrl+Z.
   *
   * @param {string[]} idsDuFondVersLeHaut
   */
  const renumeroter = (idsDuFondVersLeHaut) => {
    if (!Array.isArray(idsDuFondVersLeHaut) || idsDuFondVersLeHaut.length === 0) return;
    pushHistory();
    idsDuFondVersLeHaut.forEach((id, i) => updateObject(id, { layer: i }));
  };

  return (
    <ToolAside label="Calques" onClose={onClose}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filtrer…"
        className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10.5px] text-white/80 placeholder:text-white/25 focus:border-[#d4924a]/40 focus:outline-none"
      />
      <LayersStackPanel
        objects={objects}
        selectedIds={selectedIds}
        onSelectOnly={selectOnly}
        onRenumber={renumeroter}
        onToggleLock={toggleObjectLock}
        onToggleVisibility={toggleObjectVisibility}
        onRename={(id, nom) => updateObject(id, { name: nom })}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
        filterQuery={query}
      />
    </ToolAside>
  );
}

/** Panneau « Paramètres canvas » — dimensions + fond, les deux actions réelles du store. */
function CanvasSettingsToolPanel({ onClose }) {
  const width = useSmartboardKonvaStore(s => s.project?.canvas?.width ?? 1920);
  const height = useSmartboardKonvaStore(s => s.project?.canvas?.height ?? 1080);
  const bg = useSmartboardKonvaStore(s => s.project?.canvas?.background ?? 'transparent');
  const setCanvasDimensions = useSmartboardKonvaStore(s => s.setCanvasDimensions);
  const setCanvasBackground = useSmartboardKonvaStore(s => s.setCanvasBackground);
  const pushHistory = useSmartboardKonvaStore(s => s.pushHistory);

  /* `setCanvasDimensions` n'empile pas d'historique : sans ce pushHistory, un
     redimensionnement ne serait pas annulable par Ctrl+Z. */
  const appliquer = (w, h) => {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 80 || h < 80) return;
    pushHistory();
    setCanvasDimensions(w, h);
  };

  return (
    <ToolAside label="Paramètres canvas" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">Dimensions (px)</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <input
              type="number" value={width} min={80}
              onChange={(e) => appliquer(Number(e.target.value), height)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10.5px] text-white/85 focus:border-[#d4924a]/40 focus:outline-none"
            />
            <input
              type="number" value={height} min={80}
              onChange={(e) => appliquer(width, Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10.5px] text-white/85 focus:border-[#d4924a]/40 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">Formats rapides</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {Object.entries(CANVAS_DIMS).map(([id, d]) => (
              <button
                key={id}
                type="button"
                onClick={() => appliquer(d.w, d.h)}
                className={cn(
                  'rounded-lg border px-2 py-1.5 text-left text-[10px] transition-all',
                  width === d.w && height === d.h
                    ? 'border-[#d4924a]/35 bg-[#d4924a]/15 text-[#ecc98f]'
                    : 'border-white/[0.09] bg-white/[0.03] text-white/55 hover:border-white/20',
                )}
              >
                <span className="block font-medium capitalize">{id}</span>
                <span className="block text-[8px] text-white/30">{d.w} × {d.h}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">Fond</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="h-8 flex-1 rounded-lg border border-white/10"
              style={{ background: bg === 'transparent' ? 'repeating-conic-gradient(#444 0% 25%, #222 0% 50%) 0 0/10px 10px' : bg }}
            />
            <input type="color" onChange={(e) => setCanvasBackground(e.target.value)} className="h-8 w-8 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
          </div>
          <button
            type="button"
            onClick={() => setCanvasBackground('transparent')}
            className="mt-1.5 w-full rounded-lg border border-white/[0.09] px-2 py-1.5 text-[10px] text-white/50 hover:border-white/20 hover:text-white/75"
          >
            Fond transparent
          </button>
        </div>
      </div>
    </ToolAside>
  );
}

/**
 * Panneau d'identité — module d'un autre propriétaire, résolu par espace de noms.
 * ⛔ Si le module ne rend rien d'utilisable, l'outil affiche une excuse EXPLICITE
 * plutôt qu'une coque vide : un panneau muet se lit comme une panne.
 */
const IdentitePanelResolu =
  ModuleIdentitePanel.default ?? ModuleIdentitePanel.DocumentIdentitePanel ?? null;

function DocumentIdentiteToolPanel() {
  if (!IdentitePanelResolu) {
    return (
      <p className="px-3 pb-3 text-[10px] leading-relaxed text-amber-300/80">
        Le panneau d'identité d'entreprise n'est pas disponible dans cette version
        (<code>DocumentIdentitePanel</code> introuvable).
      </p>
    );
  }
  /* [SIG-2] Pas de bouton « Signature » ajouté ici : `DocumentIdentitePanel` monte
     déjà `DocumentSignaturePanel` en mode « integre ». Une seconde entrée vers le
     même écran, dans un autre mode, ferait croire à deux signatures. */
  return <IdentitePanelResolu />;
}

/* ═══════════════════════════════════════════════════════════════════
   [FIL-1] Filigrane · [SIG-1] Signature — panneaux du rail Document
═══════════════════════════════════════════════════════════════════ */

/**
 * ⛔ PIÈGE 6 — le raccourci d'annulation n'est PAS le même partout. Sur Mac,
 * `SmartboardKonvaEditorV1` calcule `const mod = isMac ? e.metaKey : e.ctrlKey` :
 * Ctrl+Z n'y déclenche RIEN. Le libellé est dérivé de la MÊME règle que
 * l'écouteur, sinon l'écran désigne une touche morte.
 */
const RACCOURCI_ANNULER = (() => {
  try {
    return navigator.platform.toUpperCase().includes('MAC') ? '⌘Z' : 'Ctrl+Z';
  } catch {
    return 'Ctrl+Z';
  }
})();

const CLS_DOC_BTN = 'flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.03] px-2.5 py-2 text-[11px] font-medium text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35';
const CLS_DOC_BTN_ACCENT = 'flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#d4924a]/35 bg-[#d4924a]/15 px-2.5 py-2 text-[11px] font-semibold text-[#ecc98f] transition-all hover:bg-[#d4924a]/25 disabled:cursor-not-allowed disabled:opacity-35';
const CLS_DOC_INPUT = 'w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10.5px] text-white/85 placeholder:text-white/25 focus:border-[#d4924a]/40 focus:outline-none';
const CLS_DOC_LABEL = 'block text-[9px] font-bold uppercase tracking-[0.14em] text-white/30';
const CLS_DOC_CHIP = 'rounded-lg border px-2 py-1 text-[9.5px] font-semibold uppercase tracking-wider transition-colors';

/** Objets de la scène active (lecture seule). */
function useObjetsSceneActive() {
  const scenes = useSmartboardKonvaStore((s) => s.project?.scenes ?? []);
  const activeSceneId = useSmartboardKonvaStore((s) => s.project?.activeSceneId);
  return useMemo(
    () => scenes.find((s) => s.id === activeSceneId)?.objects ?? [],
    [scenes, activeSceneId],
  );
}

/**
 * Format et nombre de pages DÉDUITS du canevas.
 *
 * ⚠️ Même règle de lecture que `DocumentIdentitePanel` et `DocumentBusinessPanels` :
 * le PREMIER format à la bonne largeur gagne. Deux règles différentes donneraient deux
 * nombres de pages différents pour le même document — donc un filigrane répété sur un
 * nombre de pages qui n'est pas celui qu'affiche l'outil « Pages ».
 */
function useFormatDocumentCourant() {
  const w = useSmartboardKonvaStore((s) => s.project?.canvas?.width ?? FORMATS_PAGE.a4_portrait.largeur);
  const h = useSmartboardKonvaStore((s) => s.project?.canvas?.height ?? FORMATS_PAGE.a4_portrait.hauteur);
  return useMemo(() => {
    const trouve = Object.entries(FORMATS_PAGE).find(([, f]) => Math.abs(f.largeur - w) <= 2);
    const [cle, format] = trouve ?? ['a4_portrait', FORMATS_PAGE.a4_portrait];
    return { cle, format, nbPages: Math.max(1, Math.round(h / format.hauteur)) };
  }, [w, h]);
}

/** Objets de la scène active LUS HORS RENDU (après une écriture dans le store). */
function objetsSceneActiveMaintenant() {
  const st = useSmartboardKonvaStore.getState();
  const scenes = st.project?.scenes ?? [];
  return scenes.find((s) => s.id === st.project?.activeSceneId)?.objects ?? [];
}

/**
 * Aperçu FIDÈLE : il rend les objets que la pose produirait, pas un dessin refait à
 * côté. Un aperçu dessiné à part mentirait sur l'angle, la densité et l'opacité réels.
 */
function ApercuFiligrane({ ajouts, format }) {
  const echelle = 168 / format.largeur;
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-sm bg-white shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
      style={{ width: 168, height: Math.round(format.hauteur * echelle) }}
    >
      {(ajouts ?? []).map((o, i) => {
        const base = {
          position: 'absolute',
          left: (Number(o?.x) || 0) * echelle,
          top: (Number(o?.y) || 0) * echelle,
          width: (Number(o?.width) || 0) * echelle,
          height: (Number(o?.height) || 0) * echelle,
          opacity: Number.isFinite(Number(o?.opacity)) ? Number(o.opacity) : 1,
          transform: `rotate(${Number(o?.rotation) || 0}deg)`,
          /* ⛔ LE PIVOT EST L'ANGLE HAUT-GAUCHE, comme dans Konva (`KonvaBoardObject`
             rend le texte à x/y avec offsetX/offsetY nuls) et comme le suppose
             `ancrePourCentre`. Un aperçu pivoté autour du centre décalerait la marque
             de plusieurs centaines de pixels par rapport à la page réelle. */
          transformOrigin: '0 0',
        };
        if (o?.type === 'image') {
          return (
            <SmartboardCanvasImage
              key={o.id ?? `fil-${i}`}
              src={o?.content?.src}
              style={{ ...base, objectFit: 'contain' }}
              draggable={false}
            />
          );
        }
        return (
          <div
            key={o?.id ?? `fil-${i}`}
            style={{
              ...base,
              fontFamily: o?.style?.fontFamily,
              fontSize: Math.max(2, (Number(o?.style?.fontSize) || 11) * echelle),
              fontWeight: o?.style?.fontWeight,
              color: o?.style?.fill,
              textAlign: o?.style?.align ?? 'center',
              lineHeight: o?.style?.lineHeight ?? 1.2,
              whiteSpace: 'pre',
              overflow: 'hidden',
            }}
          >
            {o?.content?.text ?? ''}
          </div>
        );
      })}
      {!(ajouts ?? []).length ? (
        <p className="absolute inset-x-2 top-1/2 -translate-y-1/2 text-center text-[8px] text-slate-400">
          Rien à poser avec ces réglages.
        </p>
      ) : null}
    </div>
  );
}

/**
 * [FIL-1] Panneau « Filigrane » — répété sur CHAQUE page, DERRIÈRE le contenu.
 *
 * ⛔ RIEN NE S'APPLIQUE EN SILENCE : le filigrane ne touche le document qu'au clic sur
 * « Poser ». Le retrait est le clic symétrique.
 *
 * ⛔ AUCUN RÉGLAGE N'EST INVENTÉ. `filigraneVide()` naît sans texte, sans image, sans
 * police et sans couleur : ces quatre-là restent VIDES tant que l'utilisateur n'a rien
 * dit, et le module refuse la pose en NOMMANT ce qui manque (`refus`) plutôt que de
 * substituer un défaut. Le panneau relaie ce refus mot pour mot.
 *
 * ⛔ L'ARRIÈRE-PLAN EST L'AFFAIRE DU `layer`, PAS DE L'INDEX : `layerDeFond` rend un
 * calque strictement sous la pile, `sortObjectsByLayer` le dessine en premier à
 * l'écran et `preparerExport` trie sur la même clé avant `addImage` — donc le PDF
 * aussi. La coque ne retouche pas ce calque : elle le VÉRIFIE (`filigranePose.devant`).
 *
 * ⚠️ Aucun modèle n'est appelé ici : le mode « Contrôle libre » ne change rien à cet
 * outil et aucune requête ne part de ce panneau.
 */
function DocumentFiligraneToolPanel() {
  const objets = useObjetsSceneActive();
  const { cle: cleFormat, format, nbPages } = useFormatDocumentCourant();

  /* [FIL-1] Le filigrane image réutilise le LOGO de l'identité active : on ne
     téléverse pas une seconde image concurrente de celle de l'entreprise. */
  const collectionIdentites = useDocumentIdentiteStore(selecteurCollection);
  const chargerIdentites = useDocumentIdentiteStore((s) => s.charger);
  useEffect(() => { chargerIdentites?.(); }, [chargerIdentites]);
  const logoIdentite = useMemo(() => {
    try {
      const active = identiteActive(normaliserCollection(collectionIdentites));
      return active?.logo?.src ? active.logo : null;
    } catch {
      return null;
    }
  }, [collectionIdentites]);

  const [brouillon, setBrouillon] = useState(() => filigraneVide());
  const [message, setMessage] = useState(/** @type {string|null} */ (null));
  const [erreur, setErreur] = useState(/** @type {string|null} */ (null));
  const [avertis, setAvertis] = useState(/** @type {string[]} */ ([]));

  const maj = useCallback((patch) => {
    setBrouillon((v) => ({ ...v, ...patch }));
    setMessage(null);
    setErreur(null);
  }, []);

  /** Réglage envoyé au module : l'image vient de l'identité, jamais d'ailleurs. */
  const configFiligrane = useMemo(() => {
    const cfg = { ...brouillon };
    if (cfg.type === 'image') {
      cfg.image = logoIdentite
        ? {
          src: logoIdentite.src,
          largeurNative: logoIdentite.largeurNative ?? null,
          hauteurNative: logoIdentite.hauteurNative ?? null,
          largeur: null,
        }
        /* ⛔ Pas de `src` inventé : sans logo, le module refusera et le dira. */
        : { src: '', largeurNative: null, hauteurNative: null, largeur: null };
    }
    return normaliserFiligrane(cfg);
  }, [brouillon, logoIdentite]);

  const resume = useMemo(() => resumeFiligrane(configFiligrane), [configFiligrane]);

  /* L'aperçu joue la pose sur une page VIERGE : c'est la MÊME fonction que la pose
     réelle, donc il ne peut pas raconter autre chose qu'elle. */
  const apercu = useMemo(() => {
    try {
      return appliquerFiligrane({
        filigrane: configFiligrane,
        objets: [],
        page: { format: cleFormat, marges: MARGES_DEFAUT, nbPages: 1 },
      });
    } catch (e) {
      return { ajouts: [], refus: e?.message || 'aperçu impossible', avertissements: [] };
    }
  }, [configFiligrane, cleFormat]);

  const etatPose = useMemo(() => filigranePose(objets, nbPages), [objets, nbPages]);

  const surPoser = useCallback(() => {
    setErreur(null);
    setAvertis([]);
    let plan;
    try {
      plan = appliquerFiligrane({
        filigrane: configFiligrane,
        objets,
        /* ⛔ `nbPages` est OBLIGATOIRE côté module : sans lui il refuse au lieu de
           supposer 1 et de ne marquer que la première page d'un document de trois. */
        page: { format: cleFormat, marges: MARGES_DEFAUT, nbPages },
      });
    } catch (e) {
      setErreur(e?.message || 'Le module de filigrane a refusé ces réglages.');
      return;
    }
    if (plan.refus) { setErreur(plan.refus); return; }
    if (!plan.ajouts.length) { setMessage('Rien à poser avec ces réglages.'); return; }

    /* UN SEUL pas d'historique pour tout le geste : ajouts + retrait du filigrane
       précédent. Sinon annuler « poser un filigrane » coûterait autant de frappes
       qu'il y a de tuiles sur le document. */
    const ok = appliquerMutationDocument({
      ajouts: plan.ajouts,
      patches: plan.patches,
      suppressions: plan.suppressions,
      selectionner: false,
    });
    if (!ok) { setErreur('Le document n\'a pas accepté la pose.'); return; }

    /* Filet d'ancrage : `patchesAncrageFiligrane` remet une image de filigrane à sa
       géométrie voulue si la chaîne d'insertion l'a déplacée. `historique: false` —
       c'est la CONSÉQUENCE du pas déjà empilé, pas un second geste à annuler. */
    const ancrages = patchesAncrageFiligrane(objetsSceneActiveMaintenant());
    if (ancrages.length) {
      appliquerMutationDocument({ patches: ancrages, selectionner: false, historique: false });
    }

    const bouts = [
      `${plan.resume.objets} marque(s) posée(s) sur ${plan.resume.pages} page(s), derrière le contenu (calque ${plan.layer})`,
    ];
    if (plan.resume.tuilesParPage > 1) bouts.push(`${plan.resume.tuilesParPage} par page`);
    if (plan.suppressions.length) bouts.push(`${plan.suppressions.length} objet(s) du filigrane précédent remplacé(s)`);
    if (ancrages.length) bouts.push(`${ancrages.length} image(s) recalée(s) à leur ancrage`);
    setAvertis(plan.avertissements ?? []);
    setMessage(`${bouts.join(' · ')}. ${RACCOURCI_ANNULER} annule tout le geste.`);
  }, [configFiligrane, objets, cleFormat, nbPages]);

  const surRetirer = useCallback(() => {
    setErreur(null);
    setAvertis([]);
    const { suppressions } = retirerFiligrane(objets);
    if (!suppressions.length) { setMessage('Aucun filigrane posé sur ce document.'); return; }
    appliquerMutationDocument({ suppressions, selectionner: false });
    setMessage(`${suppressions.length} objet(s) de filigrane retirés. ${RACCOURCI_ANNULER} revient en arrière.`);
  }, [objets]);

  const estImage = brouillon.type === 'image';
  const motifChoisi = MOTIFS_FILIGRANE.find((m) => m.id === brouillon.motif) ?? null;
  const texteLibre = !motifChoisi || motifChoisi.id === 'libre';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Droplets className="h-3.5 w-3.5 text-[#d4924a]" />
        <p className="flex-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Filigrane</p>
      </div>
      <p className="text-[9.5px] leading-snug text-white/35">
        Répété sur chaque page, <strong className="text-white/55">derrière</strong> le contenu.
        C'est une marque imprimée : elle ne confère aucune valeur juridique au document.
      </p>

      {/* Nature — texte ou logo de l'identité. Jamais les deux (TYPES_FILIGRANE). */}
      <div className="flex gap-1.5">
        {[
          { id: 'texte', label: 'Texte' },
          { id: 'image', label: 'Logo de l\'identité' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => maj(
              /* ⛔ Le passage en image met l'angle à 0 — pas en douce : la note
                 ci-dessous dit pourquoi (le PDF ne trace pas la rotation d'une image). */
              t.id === 'image' ? { type: 'image', angle: 0 } : { type: 'texte' },
            )}
            className={cn(
              'flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-colors',
              brouillon.type === t.id
                ? 'border-[#d4924a]/35 bg-[#d4924a]/10 text-[#ecc98f]'
                : 'border-white/10 bg-black/30 text-white/45 hover:text-white/70',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!estImage ? (
        <>
          <div className="space-y-1">
            <span className={CLS_DOC_LABEL}>Motif</span>
            <div className="flex flex-wrap gap-1">
              {MOTIFS_FILIGRANE.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => maj({ motif: m.id })}
                  className={cn(
                    CLS_DOC_CHIP,
                    brouillon.motif === m.id
                      ? 'border-[#d4924a]/35 bg-[#d4924a]/10 text-[#ecc98f]'
                      : 'border-white/10 bg-black/30 text-white/45 hover:text-white/70',
                  )}
                >
                  {m.texte || 'Texte libre'}
                </button>
              ))}
            </div>
          </div>

          {/* Le champ libre n'est proposé que quand il sert : avec un motif choisi,
             c'est le texte du motif qui part, et un champ actif mentirait. */}
          {texteLibre ? (
            <label className="block space-y-1">
              <span className={CLS_DOC_LABEL}>Texte du filigrane</span>
              <input
                className={CLS_DOC_INPUT}
                value={brouillon.texte}
                placeholder="(vide tant que vous ne l'écrivez pas)"
                onChange={(e) => maj({ texte: e.target.value })}
              />
            </label>
          ) : (
            <p className="text-[9.5px] leading-snug text-white/35">
              Texte posé : <strong className="text-white/60">{motifChoisi.texte}</strong>.
            </p>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
          {logoIdentite ? (
            <div className="flex items-center gap-2">
              <SmartboardCanvasImage
                src={logoIdentite.src}
                className="h-9 w-12 object-contain"
                pending={<div className="h-9 w-12 rounded border border-dashed border-white/15" />}
              />
              <p className="flex-1 text-[9.5px] leading-snug text-white/40">
                {logoIdentite.largeurNative && logoIdentite.hauteurNative
                  ? `Logo de l'identité active (${logoIdentite.largeurNative}×${logoIdentite.hauteurNative} px natifs).`
                  : 'Dimensions natives inconnues : le module refusera la pose plutôt que d\'imposer un carré.'}
              </p>
            </div>
          ) : (
            <p className="text-[9.5px] leading-snug text-amber-300/70">
              Aucun logo dans l'identité active — téléversez-le dans « Identité d'entreprise ».
            </p>
          )}
          <p className="mt-1.5 text-[9px] leading-snug text-white/30">
            Angle bloqué à 0° : la rotation d'une image n'est pas tracée dans le PDF,
            l'écran et le papier ne diraient pas la même chose.
          </p>
        </div>
      )}

      {/* ── Réglages de mise en page ── */}
      <label className="block space-y-1">
        <span className={CLS_DOC_LABEL}>
          {estImage ? `Largeur ${Math.round(PART_LARGEUR_IMAGE_DEFAUT * 100)} % de la page` : `Taille (${brouillon.taille} px)`}
        </span>
        {!estImage ? (
          <input
            type="range"
            min={TAILLE_TEXTE_MIN}
            max={TAILLE_TEXTE_MAX}
            step={1}
            value={brouillon.taille}
            onChange={(e) => maj({ taille: Number(e.target.value) })}
            className="w-full accent-[#d4924a]"
          />
        ) : null}
      </label>

      {!estImage ? (
        <>
          <div className="space-y-1">
            <span className={CLS_DOC_LABEL}>Couleur</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brouillon.couleur || '#94a3b8'}
                onChange={(e) => maj({ couleur: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded-lg border border-white/10 bg-transparent"
              />
              {/* ⛔ « Vide » n'est PAS une couleur choisie : c'est l'encre du module.
                 Le bouton le dit, au lieu d'imposer un gris de notre cru. */}
              <button
                type="button"
                onClick={() => maj({ couleur: '' })}
                className={cn(
                  'flex-1 rounded-lg border px-2 py-1.5 text-[10px] transition-colors',
                  brouillon.couleur
                    ? 'border-white/10 bg-black/30 text-white/45 hover:text-white/70'
                    : 'border-[#d4924a]/35 bg-[#d4924a]/10 text-[#ecc98f]',
                )}
              >
                Encre du document
              </button>
            </div>
          </div>

          <label className="block space-y-1">
            <span className={CLS_DOC_LABEL}>Police</span>
            <input
              className={CLS_DOC_INPUT}
              value={brouillon.police}
              placeholder="(police du document)"
              onChange={(e) => maj({ police: e.target.value })}
            />
          </label>

          <label className="block space-y-1">
            <span className={CLS_DOC_LABEL}>Angle ({brouillon.angle}°)</span>
            <input
              type="range"
              min={ANGLE_MIN}
              max={ANGLE_MAX}
              step={1}
              value={brouillon.angle}
              onChange={(e) => maj({ angle: Number(e.target.value) })}
              className="w-full accent-[#d4924a]"
            />
          </label>
        </>
      ) : null}

      <label className="block space-y-1">
        <span className={CLS_DOC_LABEL}>Opacité ({Math.round(brouillon.opacite * 100)} %)</span>
        <input
          type="range"
          min={OPACITE_MIN}
          max={OPACITE_MAX}
          step={0.01}
          value={brouillon.opacite}
          onChange={(e) => maj({ opacite: Number(e.target.value) })}
          className="w-full accent-[#d4924a]"
        />
      </label>

      <div className="space-y-1">
        <span className={CLS_DOC_LABEL}>Disposition</span>
        <div className="flex gap-1.5">
          {DISPOSITIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => maj({ disposition: d.id })}
              title={d.label}
              className={cn(
                'flex-1 rounded-lg border px-2 py-1.5 text-[10px] transition-colors',
                brouillon.disposition === d.id
                  ? 'border-[#d4924a]/35 bg-[#d4924a]/10 text-[#ecc98f]'
                  : 'border-white/10 bg-black/30 text-white/45 hover:text-white/70',
              )}
            >
              {d.id === 'mosaique' ? 'Mosaïque' : 'Centre'}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => maj({ toutesLesPages: !brouillon.toutesLesPages })}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-[10.5px] transition-colors',
          brouillon.toutesLesPages
            ? 'border-[#d4924a]/35 bg-[#d4924a]/10 text-[#ecc98f]'
            : 'border-white/10 bg-black/30 text-white/45',
        )}
      >
        <span>Sur toutes les pages</span>
        <span className="text-[9px] uppercase tracking-wider">
          {brouillon.toutesLesPages ? `${nbPages} page(s)` : 'première seulement'}
        </span>
      </button>

      {/* Aperçu fidèle — produit par la fonction de pose, sur une page vierge. */}
      <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
        <span className={CLS_DOC_LABEL}>Aperçu (page vierge)</span>
        {apercu.refus
          ? <p className="text-[9.5px] leading-snug text-amber-300/80">{apercu.refus}</p>
          : <ApercuFiligrane ajouts={apercu.ajouts} format={format} />}
      </div>

      {/* État de la pose — et le seul cas grave : un filigrane passé DEVANT. */}
      {etatPose.posee ? (
        <p className={cn(
          'text-[9.5px] leading-snug',
          etatPose.devant ? 'text-amber-300/85' : 'text-white/35',
        )}>
          {etatPose.devant
            ? `Le filigrane posé est DEVANT du contenu (calque ${etatPose.layer}) : reposez-le pour le renvoyer au fond.`
            : `Filigrane posé sur ${etatPose.pages.length} page(s)${etatPose.pagesManquantes.length ? `, absent de ${etatPose.pagesManquantes.length} page(s)` : ''}.`}
        </p>
      ) : null}

      {/* ⛔ Ce qui manque est NOMMÉ, jamais remplacé par un défaut. */}
      {resume.vide ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-2 py-1.5 text-[9.5px] leading-relaxed text-amber-300/80">
          Manque : {resume.manques.join(', ')}.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <button type="button" className={CLS_DOC_BTN_ACCENT} disabled={resume.vide} onClick={surPoser}>
          <Droplets className="h-3 w-3" /> Poser sur le document
        </button>
        <button type="button" className={CLS_DOC_BTN} disabled={!etatPose.posee} onClick={surRetirer}>
          <Eraser className="h-3 w-3" /> Retirer le filigrane
        </button>
      </div>

      {erreur ? <p className="text-[9.5px] leading-snug text-red-300/85">{erreur}</p> : null}
      {avertis.map((a) => (
        <p key={a} className="text-[9.5px] leading-snug text-amber-300/70">{a}</p>
      ))}
      {message ? <p className="text-[9.5px] leading-snug text-white/45">{message}</p> : null}
    </div>
  );
}

/**
 * [SIG-1] / [SIG-2] Panneau « Signature » — MONTÉ, pas réécrit.
 *
 * Les trois voies (tracée à la main, téléversée, dactylographiée), le bloc « Pour la
 * direction / Nom / Fonction / Date » et le cadre juridique honnête sont ÉCRITS DANS
 * `DocumentSignaturePanel`, qui étend le bloc de signature déjà porté par l'identité
 * d'entreprise. La coque ne fabrique pas un second mécanisme concurrent : elle ouvre
 * une deuxième PORTE sur le même écran.
 *
 * ⚠️ `mode` reste « autonome » ici — c'est le geste PONCTUEL sur le document courant,
 * donc le bouton « Enregistrer dans l'identité active » a du sens. Monté depuis
 * l'identité (`DocumentIdentitePanel`), le même écran passe en « integre » et ce
 * bouton disparaît : deux chemins d'écriture auraient enregistré deux versions de la
 * même signature.
 *
 * ⚠️ Aucun modèle n'est appelé : le mode « Contrôle libre » ne coupe rien ici.
 */

/** Outils Document dont le panneau est un vrai module métier (plus un catalogue d'items). */
const DOC_BUSINESS_PANELS = {
  'doc-tableau': { label: 'Tableau', Panel: DocumentTablePanel },
  'doc-entete': { label: 'En-tête / Pied', Panel: DocumentHeaderFooterPanel },
  'doc-page': { label: 'Pages', Panel: DocumentPagePanel },
  'doc-identite': { label: 'Identité d\'entreprise', Panel: DocumentIdentiteToolPanel },
  'doc-filigrane': { label: 'Filigrane', Panel: DocumentFiligraneToolPanel },
  /* ⚠️ Monté SANS prop : `mode` retombe sur « autonome », qui est bien le geste
     ponctuel. `ContextualPanel` rend `<Panel />` — voir le commentaire ci-dessus. */
  'doc-signature': { label: 'Signature', Panel: DocumentSignaturePanel },
};

/**
 * Outils qui ne passent PAS par le catalogue d'items : soit ils ouvrent leur propre
 * panneau (`selection`, `fond`, `formes`, `calques`, `reglages-canvas` + modules
 * Document), soit ils déclenchent une action directe sans panneau — `record` est
 * intercepté par `handleTool` pour piloter l'enregistrement Cinéma.
 */
const NON_CATALOG_USABLE_TOOLS = new Set([
  'selection', 'fond', 'formes', 'calques', 'reglages-canvas', 'record',
  ...Object.keys(DOC_BUSINESS_PANELS),
]);

/**
 * Un outil de rail mène-t-il quelque part ?
 *
 * ⛔ Seconde moitié du miroir de `handleAdd`. Masquer les ITEMS morts ne suffisait pas :
 * un outil dont TOUS les items sont morts restait cliquable et n'ouvrait qu'un panneau
 * d'excuses (« pas encore disponible dans le Designer »). Un outil ne s'affiche que s'il
 * a un panneau/une action dédiés ou au moins un item réellement insérable.
 *
 * @param {string | null | undefined} toolId
 */
function isUsableTool(toolId) {
  if (!toolId) return false;
  if (NON_CATALOG_USABLE_TOOLS.has(toolId)) return true;
  const items = TOOL_CONTENT[toolId]?.items ?? [];
  return items.some((item) => isInsertableCatalogItem(toolId, item));
}

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
  /* Géométrie visée par le prochain import (outil Document « Image ») : le picker de
     fichier est asynchrone, la cible doit survivre au voyage aller-retour. */
  const docImageGeoRef = useRef(null);
  const addObject           = useSmartboardKonvaStore(s => s.addObject);
  const addObjects          = useSmartboardKonvaStore(s => s.addObjects);
  const selectAllInActiveScene = useSmartboardKonvaStore(s => s.selectAllInActiveScene);
  const setCanvasBackground = useSmartboardKonvaStore(s => s.setCanvasBackground);
  const canvasBg            = useSmartboardKonvaStore(s => s.project?.canvas?.background ?? 'transparent');
  const canvasLargeur       = useSmartboardKonvaStore(s => s.project?.canvas?.width ?? 0);
  const canvasHauteur       = useSmartboardKonvaStore(s => s.project?.canvas?.height ?? 0);

  /**
   * ⛔ [AFF-DPI] Les préréglages de ce catalogue sont écrits en PIXELS À 96 dpi (H1
   * 48 px, corps 16 px, gabarit d'image 560 × 320). Posés tels quels sur le canevas
   * Affiche — A4 à 300 dpi, 2480 × 3508 — ils sortaient 3,125× trop petits : le H1
   * mesurait 11,5 pt à l'impression et le corps 3,8 pt (plancher usuel 8-9 pt), et
   * l'image plafonnée au gabarit couvrait 0,8 % de la page.
   *
   * Les TABLES ne changent pas (elles servent aussi aux libellés « 48px · Gras » et à
   * l'aperçu) : c'est l'insertion qui reporte la valeur à la résolution réelle.
   * Sur tout canevas 96 dpi (Document 794 × 1123, Smartboard/Présentation 1920 × 1080)
   * l'échelle vaut 1 et RIEN ne bouge.
   */
  const echelleCanevas = useMemo(
    () => echelleDuCanevas(canvasLargeur, canvasHauteur),
    [canvasLargeur, canvasHauteur],
  );
  const E = useCallback((px96) => pxCanevas(px96, echelleCanevas), [echelleCanevas]);

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
      /* ⛔ Le gabarit d'image appartient à `lib/documentImages` (BOITE_MAX_DEFAUT) et
         n'est pas modifié : c'est la boîte DEMANDÉE qui est mise à l'échelle, et le
         store la reçoit comme `largeurMax`/`hauteurMax` (cf. geometrieImage). */
      addObject(mkImageObject(u, { x: E(100), y: E(120), width: E(620), height: E(354), layer: 2 }));
    },
    [addObject, E],
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

  /* ── Routage du panneau ──────────────────────────────────────────────────
     ⛔ RÈGLE : un outil du rail ouvre TOUJOURS son panneau, sélection ou pas.
     Avant, `ElementPanel` était rendu dès qu'un objet était sélectionné sauf
     pour une liste blanche (`texte/images/fond/animes/modeles/selection`) où
     les outils `doc-*` ne figuraient pas : Titre, Paragraphe, Liste, Image et
     Séparateur affichaient donc tous le panneau « Texte » juste après n'importe
     quelle insertion — l'insertion sélectionne l'objet posé. Cinq outils du rail
     devenaient des boutons qui ne font rien.
     Les propriétés de l'objet restent atteignables : la barre du haut
     (`PropertiesBar`) les montre en permanence, et la languette « Propriétés de
     l'objet » de la gouttière referme l'outil pour rendre `ElementPanel`. */
  if (tool === 'formes') {
    return <FormesVectorPanel onClose={onClose} />;
  }
  if (tool === 'calques') return <LayersToolPanel onClose={onClose} />;
  if (tool === 'reglages-canvas') return <CanvasSettingsToolPanel onClose={onClose} />;
  if (DOC_BUSINESS_PANELS[tool]) {
    const { label, Panel } = DOC_BUSINESS_PANELS[tool];
    return (
      <ToolAside label={label} onClose={onClose}>
        <Panel />
      </ToolAside>
    );
  }

  /* Filet : un outil sans branche d'insertion ni panneau dédié ne doit ouvrir AUCUNE
     coque (le rail ne l'expose plus, mais `activeTool` peut venir d'ailleurs). */
  if (tool && !isUsableTool(tool)) {
    return selectedObj ? <ElementPanel obj={selectedObj} onClose={onClose} /> : null;
  }

  /* Propriétés d'élément : SEULEMENT quand aucun outil n'est ouvert (voir la règle
     de routage ci-dessus). Plus de liste blanche à tenir à jour. */
  if (!tool && selectedObj) {
    return <ElementPanel obj={selectedObj} onClose={onClose} />;
  }

  /* Toute insertion du catalogue passe par ces deux portes : l'encre y est rendue
     lisible sur le fond de page courant (cf. adapterEncreAuFond). */
  const poser = (obj) => addObject(adapterEncreAuFond(obj, canvasBg));
  const poserLot = (objs) => addObjects((objs ?? []).map((o) => adapterEncreAuFond(o, canvasBg)));

  const handleAdd = (item) => {
    if (tool === 'images' && item.id === 'upload') {
      designerImagesFileRef.current?.click();
      return;
    }
    /* ── Document · Image ── Le téléversement n'est PAS réécrit : c'est le chemin
       existant (uploadSmartboardCanvasImage + insertDesignerUploadMetadata). Seule
       la géométrie de dépose change selon l'habillage demandé. */
    if (tool === 'doc-image') {
      /* ⛔ PIÈGE : le y était une CONSTANTE (180) — chaque habillage se posait
         par-dessus les images déjà en place (recouvrement total mesuré), et la
         normalisation du store ne touche jamais aux images. Le y vient donc du
         flux (sous le dernier bloc), figé au clic : la scène ne bouge pas pendant
         l'aller-retour du sélecteur de fichier. */
      const geos = {
        upload:    { x: 52,  width: 440, height: 280, layer: 2 },
        'float-l': { x: 52,  width: 300, height: 190, layer: 2 },
        'float-r': { x: 442, width: 300, height: 190, layer: 2 },
        full:      { x: 52,  width: 690, height: 300, layer: 2 },
      };
      const geo = geos[item.id];
      if (!geo) return;
      let y = nextFlowPosition(activeSceneObjs, geo.height).y;
      if (item.id === 'float-r') {
        /* « Colonne droite » ne s'aligne à hauteur d'une colonne gauche QUE si le bloc
           le plus bas de la page est une image qui laisse la colonne droite libre —
           sinon on resterait dans le flux et rien ne peut se recouvrir. */
        let bas = null;
        for (const o of activeSceneObjs) {
          const oy = Number(o?.y);
          if (!Number.isFinite(oy)) continue;
          const fond = oy + (Number(o?.height) || 0);
          if (!bas || fond > (Number(bas.y) || 0) + (Number(bas.height) || 0)) bas = o;
        }
        if (bas && bas.type === 'image' && (Number(bas.x) || 0) + (Number(bas.width) || 0) <= geo.x) {
          y = Number(bas.y);
        }
      }
      docImageGeoRef.current = { ...geo, y };
      designerImagesFileRef.current?.click();
      return;
    }
    /* ── Document · Séparateur ── filet horizontal, primitive `line` du moteur. */
    if (tool === 'doc-hr') {
      const styles = {
        'hr-thin':  { stroke: '#94a3b8', strokeWidth: 1 },
        'hr-thick': { stroke: '#475569', strokeWidth: 3 },
        'hr-dot':   { stroke: '#94a3b8', strokeWidth: 1, dash: [6, 5] },
        'hr-deco':  { stroke: '#b08968', strokeWidth: 2, dash: [18, 6, 3, 6], lineCap: 'round' },
      };
      const st = styles[item.id];
      if (!st) return;
      const largeur = item.id === 'hr-deco' ? 320 : 690;
      const x = item.id === 'hr-deco' ? Math.round((794 - largeur) / 2) : 52;
      const hauteur = Math.max(2, st.strokeWidth);
      /* ⛔ PIÈGE : y=240 en dur empilait Fin/Épais/Décoratif au pixel près (l'anti-
         doublon du store exige une boîte STRICTEMENT identique — 1 px de haut de
         différence suffit à passer au travers) : tirer le trait attrapait toujours
         le mauvais. Le y vient du flux, comme les blocs de texte. */
      poser({
        type: 'line', x, y: nextFlowPosition(activeSceneObjs, hauteur).y, width: largeur, height: hauteur,
        content: { points: [0, 0, largeur, 0] },
        style: st,
      });
      return;
    }
    if (tool === 'images' && item.id === 'library') {
      setActiveTab(2);
      void refreshIaGallery();
      return;
    }
    const stockUrl = DESIGNER_STOCK_IMAGE_URL[item.id];
    if (tool === 'images' && stockUrl) {
      poser(mkImageObject(stockUrl, { x: E(72), y: E(120), width: E(560), height: E(320), layer: 2 }));
      return;
    }
    // Garde-fou : la vraie barrière est le filtre d'affichage (isInsertableCatalogItem),
    // qui ne laisse plus apparaître un item sans branche d'insertion.
    if (!isInsertableCatalogItem(tool, item)) return;
    /* ⛔ PIÈGE : chaque insertion de texte naissait au MÊME point fixe — 11 styles
       posés d'affilée = 11 blocs superposés illisibles (Smartboard comme Affiche ;
       la normalisation du store ne replace qu'en mode Document). La cascade décale
       en diagonale tant que le point d'ancrage exact est déjà occupé, sans jamais
       sortir du canevas. */
    const poseEnCascade = (x0, y0) => {
      const pas = Math.max(1, E(28));
      let x = x0;
      let y = y0;
      let garde = 0;
      const occupe = () => activeSceneObjs.some(
        (o) => Math.abs((Number(o?.x) || 0) - x) < pas / 2 && Math.abs((Number(o?.y) || 0) - y) < pas / 2,
      );
      while (garde < 40 && occupe()
        && x + pas < canvasLargeur - E(80) && y + pas < canvasHauteur - E(60)) {
        x += pas; y += pas; garde += 1;
      }
      return { x, y };
    };
    if (tool === 'texte') {
      // Utiliser le preset enrichi (textPreset) ou fallback minimal
      const preset = item.textPreset;
      if (preset) {
        /* `lineHeight` est un RAPPORT et `fontWeight` une graisse : ni l'un ni l'autre
           ne se met à l'échelle. Seules les grandeurs en pixels passent par E(). */
        const st = preset.style ?? {};
        poser({
          type: 'text',
          ...poseEnCascade(E(80), E(80)),
          width: E(preset.w),
          height: E(preset.h),
          content: { text: preset.text },
          style: {
            fontFamily: st.fontFamily ?? 'Inter, system-ui, sans-serif',
            fill: '#F7F2E8',
            ...st,
            ...(Number.isFinite(Number(st.fontSize)) ? { fontSize: E(st.fontSize) } : {}),
            ...(Number.isFinite(Number(st.letterSpacing)) ? { letterSpacing: Number(st.letterSpacing) * echelleCanevas } : {}),
          },
        });
      } else {
        poser({ type: 'text', ...poseEnCascade(E(80), E(80)), width: E(400), height: E(40),
          content: { text: item.label ?? 'Texte' },
          style: { fontSize: E(24), fill: '#F7F2E8', fontFamily: 'Inter, system-ui, sans-serif' } });
      }
    }
    if (tool === 'formes') {
      const typeMap = { rect: 'rect', circle: 'circle', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', starshape: 'starshape', line: 'line', arrow: 'arrow' };
      const t = typeMap[item.id] ?? 'rect';
      if (t === 'line') poser({ type: 'line', x: E(80), y: E(200), width: E(200), height: E(4), content: { points: [0, 0, E(200), 0] }, style: { stroke: '#a8a29a', strokeWidth: E(3) } });
      else if (t === 'arrow') poser({ type: 'arrow', x: E(80), y: E(200), width: E(200), height: E(4), content: { points: [0, 0, E(200), 0] }, style: { stroke: '#a8a29a', fill: '#a8a29a', strokeWidth: E(3), pointerLength: E(10), pointerWidth: E(10) } });
      else poser({ type: t, x: E(100), y: E(100), width: E(160), height: E(140), style: { fill: 'rgba(217,119,87,0.25)', stroke: '#d97757', strokeWidth: E(2), cornerRadius: t === 'rect' ? E(6) : 0 } });
    }
    if (tool === 'animes' && item.id === 'html') {
      poser({ type: 'html', x: 120, y: 180, width: 360, height: 200, content: { html: '<!DOCTYPE html><html><body style="margin:0;background:#262624;display:flex;align-items:center;justify-content:center;height:100vh"><div style="width:60px;height:60px;border:3px solid rgba(217,154,78,.2);border-top-color:#d99a4e;border-radius:50%;animation:s 1s linear infinite"></div><style>@keyframes s{to{transform:rotate(360deg)}}</style></body></html>' } });
    }
    if (tool === 'modeles' && item.id !== 'ai') {
      if (item.id === 'intro') {
        poserLot([
          mkTextObject({
            x: 72, y: 52, width: 880, height: 64,
            content: { text: 'Titre du cours' },
            style: { fontSize: 40, fontWeight: 700, lineHeight: 1.15, fill: '#F7F2E8' },
          }),
          mkTextObject({
            x: 72, y: 128, width: 720, height: 120,
            content: { text: 'Objectifs pédagogiques\n• …\n• …' },
            style: { fontSize: 17, fontWeight: 400, lineHeight: 1.55, fill: '#c9c5bb' },
          }),
        ]);
        return;
      }
      if (item.id === 'timeline') {
        poserLot([
          mkRectObject({ x: 64, y: 204, width: 820, height: 6, style: { fill: 'rgba(217,154,78,0.35)', stroke: 'none', cornerRadius: 3 } }),
          mkRectObject({ x: 118, y: 178, width: 16, height: 16, style: { fill: '#d99a4e', cornerRadius: 8 } }),
          mkRectObject({ x: 398, y: 178, width: 16, height: 16, style: { fill: '#d99a4e', cornerRadius: 8 } }),
          mkRectObject({ x: 678, y: 178, width: 16, height: 16, style: { fill: '#d99a4e', cornerRadius: 8 } }),
          mkTextObject({ x: 90, y: 222, width: 200, height: 28, content: { text: 'Étape 1' }, style: { fontSize: 14, fill: '#a8a29a' } }),
          mkTextObject({ x: 370, y: 222, width: 200, height: 28, content: { text: 'Étape 2' }, style: { fontSize: 14, fill: '#a8a29a' } }),
          mkTextObject({ x: 650, y: 222, width: 200, height: 28, content: { text: 'Étape 3' }, style: { fontSize: 14, fill: '#a8a29a' } }),
        ]);
        return;
      }
      if (item.id === 'compare') {
        poserLot([
          mkRectObject({ x: 72, y: 100, width: 380, height: 220, style: { fill: 'rgba(218,160,122,0.12)', stroke: '#cf7a52', strokeWidth: 2 } }),
          mkRectObject({ x: 480, y: 100, width: 380, height: 220, style: { fill: 'rgba(236,174,144,0.12)', stroke: '#d97757', strokeWidth: 2 } }),
          mkTextObject({ x: 92, y: 118, width: 320, height: 36, content: { text: 'Colonne A' }, style: { fontSize: 22, fontWeight: 600, fill: '#F7F2E8' } }),
          mkTextObject({ x: 500, y: 118, width: 320, height: 36, content: { text: 'Colonne B' }, style: { fontSize: 22, fontWeight: 600, fill: '#F7F2E8' } }),
          mkTextObject({ x: 92, y: 160, width: 340, height: 140, content: { text: 'Arguments, exemples…' }, style: { fontSize: 15, fill: '#c9c5bb', lineHeight: 1.5 } }),
          mkTextObject({ x: 500, y: 160, width: 340, height: 140, content: { text: 'Arguments, exemples…' }, style: { fontSize: 15, fill: '#c9c5bb', lineHeight: 1.5 } }),
        ]);
        return;
      }
      if (item.id === 'mindmap') {
        poserLot([
          mkRectObject({ x: 380, y: 160, width: 200, height: 72, style: { fill: 'rgba(217,154,78,0.2)', stroke: '#d99a4e', strokeWidth: 2, cornerRadius: 12 } }),
          mkTextObject({ x: 400, y: 178, width: 160, height: 40, content: { text: 'Idée centrale' }, style: { fontSize: 18, fontWeight: 700, fill: '#F7F2E8', align: 'center' } }),
          mkTextObject({ x: 120, y: 80, width: 160, height: 36, content: { text: 'Branche 1' }, style: { fontSize: 15, fill: '#c9c5bb' } }),
          mkTextObject({ x: 640, y: 80, width: 160, height: 36, content: { text: 'Branche 2' }, style: { fontSize: 15, fill: '#c9c5bb' } }),
          mkTextObject({ x: 120, y: 300, width: 160, height: 36, content: { text: 'Branche 3' }, style: { fontSize: 15, fill: '#c9c5bb' } }),
        ]);
        return;
      }
      if (item.id === 'quiz') {
        poserLot([
          mkTextObject({ x: 72, y: 72, width: 760, height: 48, content: { text: 'Question QCM ?' }, style: { fontSize: 26, fontWeight: 600, fill: '#F7F2E8' } }),
          mkTextObject({ x: 92, y: 130, width: 700, height: 120, content: { text: 'A) …\nB) …\nC) …\nD) …' }, style: { fontSize: 16, fill: '#c9c5bb', lineHeight: 1.65 } }),
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
      /* ⛔ LA GRAISSE PARTAIT DANS LE VIDE. Elle était écrite dans `fontVariant`,
         qui ne prend que 'normal' | 'small-caps' côté Konva ; le rendu lit
         `style.fontWeight` (traduit en fontStyle:'bold'). « Titre 1 · 36px · Gras »
         sortait donc en normal — l'étiquette disait vrai, le code ne suivait pas. */
      poser({ type: 'text', x: E(40), y: E(60), width: E(700), height: E(sz + 20),
        content: { text: item.label },
        style: { fontSize: E(sz), fill: item.id === 'note' ? '#a8a29a' : '#F7F2E8',
          fontStyle: italicIds.has(item.id) ? 'italic' : 'normal',
          fontWeight: boldIds.has(item.id) ? 700 : 400,
          fontFamily: 'Inter, system-ui, sans-serif' } });
    }
    // ── Document — liste → texte multi-lignes avec préfixe ──
    if (tool === 'doc-liste') {
      const bulletMap = { bullet: '• Item\n• Item\n• Item', numbered: '1. Item\n2. Item\n3. Item', checklist: '☐ Tâche 1\n☐ Tâche 2\n☐ Tâche 3', glossary: 'Terme : définition du terme' };
      poser({ type: 'text', x: E(40), y: E(100), width: E(500), height: E(80),
        content: { text: bulletMap[item.id] ?? '• Item' },
        style: { fontSize: E(14), fill: '#F7F2E8', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.7 } });
    }
    // ── Présentation — mêmes types que design ──
    if (tool === 'slide-titre') {
      const sizes = { title: 48, subtitle: 28, section: 32 };
      poser({ type: 'text', ...poseEnCascade(80, 120), width: 800, height: (sizes[item.id] ?? 36) + 20,
        content: { text: item.label }, style: { fontSize: sizes[item.id] ?? 36, fill: '#F7F2E8', fontFamily: 'Inter, system-ui, sans-serif' } });
    }
    /* ── Présentation · Texte ── Branché (au lieu d'être retiré du rail) : sans lui, une
       diapositive n'a plus aucun moyen de recevoir du corps de texte. Canvas 1920 × 1080. */
    if (tool === 'slide-texte') {
      const presets = {
        body:   { text: 'Texte de la diapositive',            fontSize: 26, lineHeight: 1.5,  fill: '#F7F2E8' },
        bullet: { text: '• Point clé\n• Point clé\n• Point clé', fontSize: 24, lineHeight: 1.7,  fill: '#F7F2E8' },
        quote:  { text: '« Citation »',                        fontSize: 28, lineHeight: 1.45, fill: '#e6d9c3', fontStyle: 'italic' },
        note:   { text: 'Note de diapositive',                 fontSize: 16, lineHeight: 1.4,  fill: '#a8a29a' },
      };
      const p = presets[item.id];
      if (!p) return;
      const lignes = p.text.split('\n').length;
      poser({
        type: 'text', ...poseEnCascade(120, 360), width: 1000,
        height: Math.round(p.fontSize * p.lineHeight * lignes) + 16,
        content: { text: p.text },
        style: {
          fontSize: p.fontSize, lineHeight: p.lineHeight, fill: p.fill,
          fontStyle: p.fontStyle ?? 'normal',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      });
    }
    if (tool === 'slide-forme') {
      const typeMap2 = { rect: 'rect', circle: 'circle', triangle: 'triangle', arrow: 'arrow' };
      const t2 = typeMap2[item.id] ?? 'rect';
      if (t2 === 'arrow') poser({ type: 'arrow', x: 80, y: 200, width: 200, height: 4, content: { points: [0,0,200,0] }, style: { stroke: '#a8a29a', fill: '#a8a29a', strokeWidth: 3, pointerLength: 10, pointerWidth: 10 } });
      else poser({ type: t2, x: 200, y: 200, width: 160, height: 140, style: { fill: 'rgba(218,160,122,0.2)', stroke: '#cf7a52', strokeWidth: 2 } });
    }
  };

  return (
    <motion.aside
      {...ANIM_PANNEAU}
      className="absolute inset-0 flex flex-col border-r border-white/[0.07] overflow-hidden"
      style={{ background: '#17150f' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5 shrink-0">
        <span className={cn('text-[12px] font-semibold', a.text)}>{content.label}</span>
        <div className="flex-1" />
        <button onClick={onClose} className="h-5 w-5 flex items-center justify-center rounded-md text-white/30 hover:text-white/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {tool === 'images' || tool === 'doc-image' ? (
        <input
          ref={designerImagesFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={async (ev) => {
            const file = ev.target.files?.[0];
            ev.target.value = '';
            if (!file) return;
            const geo = docImageGeoRef.current;
            docImageGeoRef.current = null;
            try {
              const { url, path } = await uploadSmartboardCanvasImage(file);
              await insertDesignerUploadMetadata(supabase, { storagePath: path, prompt: file.name, publicUrl: url });
              addObject(mkImageObject(url, geo ?? { x: E(100), y: E(120), width: E(560), height: E(320), layer: 2 }));
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
            <span className="font-semibold text-[#e6b566]/90">Multi-sélection :</span>{' '}
            maintenez <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[9px]">⇧</kbd>{' '}
            ou <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[9px]">⌘</kbd>
            / <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-mono text-[9px]">Ctrl</kbd> puis cliquez sur plusieurs objets.
          </p>
          <button
            type="button"
            onClick={() => selectAllInActiveScene()}
            className="w-full rounded-xl border border-[#d4924a]/25 bg-[#d4924a]/10 px-3 py-2.5 text-left transition-colors hover:bg-[#d4924a]/15"
          >
            <span className="text-[11px] font-semibold text-[#ecc98f]">Tout sélectionner</span>
            <span className="mt-0.5 block text-[9px] text-white/40">Tous les objets de la scène active</span>
          </button>
        </div>
      )}

      {tool === 'fond' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Fond actuel</p>
          <div className="h-10 w-full rounded-xl border border-white/10 overflow-hidden"
            style={{ background: canvasBg === 'transparent' ? 'repeating-conic-gradient(#444 0% 25%, #222 0% 50%) 0 0/10px 10px' : canvasBg }} />
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 pt-1">Presets</p>
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
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#e8a97f]/80">
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
                    className="rounded-lg border border-[#d97757]/25 bg-[#d97757]/10 px-2 py-1 text-[9px] font-medium text-[#f0c4b3]/90 hover:bg-[#d97757]/20"
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
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 py-1.5 pl-2 pr-6 text-[10px] text-white/85"
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
                placeholder="Décrivez l'illustration…"
                rows={4}
                className="w-full resize-y rounded-xl border border-white/10 bg-black/45 px-2.5 py-2 text-[11px] text-white/85 placeholder:text-white/25 focus:border-[#d97757]/35 focus:outline-none"
              />
              {iaImageErr ? (
                <p className="text-[9px] leading-snug text-rose-400/90">{iaImageErr}</p>
              ) : null}
              <button
                type="button"
                disabled={iaImageBusy || !iaImagePrompt.trim()}
                onClick={() => void runDesignerIaImage()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#e08a5f]/35 bg-[#4a2116]/35 py-2 text-[11px] font-semibold text-[#f5d9cc] disabled:opacity-45"
              >
                {iaImageBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Générer &amp; placer
              </button>
            </div>
          ) : tool === 'images' && activeTab === 2 ? (
            <div className="space-y-2 px-0.5 pb-2">
              <p className="text-[9px] leading-snug text-white/40">
                Compte connecté : galerie complète synchronisée (bucket public, pas d'expiration). Sans compte : liste locale sur cet appareil (quota navigateur).
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
                      <SmartboardCanvasImage
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
                            className="rounded border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] px-2 py-0.5 text-[9px] font-medium text-[#ebca5e] hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]"
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
                            className="rounded border border-white/10 px-2 py-0.5 text-[9px] text-white/45 hover:bg-white/10"
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
          {/* ⛔ Plus d'écran d'excuses ici : un outil dont aucun item n'est insérable
              n'atteint plus ce rendu — `isUsableTool` le retire du rail en amont. */}
          {content.items
            .filter((item) => isInsertableCatalogItem(tool, item))
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
                  item.ai && 'bg-[#d97757]/[0.06] border-[#d97757]/15 hover:border-[#d97757]/25',
                )}>
                {item.shape && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-base text-white/70">
                    {item.shape}
                  </span>
                )}
                {Icon && !item.shape && (
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', item.ai ? 'bg-[#d97757]/15' : 'bg-white/[0.06]')}>
                    <Icon className={cn('h-4 w-4', item.ai ? 'text-[#e08a5f]' : 'text-white/50')} />
                  </span>
                )}
                {!item.shape && !item.icon && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                    <Plus className="h-3.5 w-3.5 text-white/40" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[12px] font-medium truncate', item.ai ? 'text-[#e8a97f]' : 'text-white/75')}>{item.label}</p>
                  {item.sub && <p className="text-[10px] text-white/30 truncate">{item.sub}</p>}
                </div>
              </button>
            );
          })}

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
/* ── AI Hub : onglets + suggestions actionnables + registre d'exécution ── */
/**
 * @param {boolean} enRetrait Le hub s'efface sous l'écran qui le demande (lanceur
 *   Document). ⛔ Il reste MONTÉ — la conversation LONGIA n'est pas perdue — mais il
 *   passe sous le lanceur et cesse de capter le pointeur.
 */
function AIHub({ docType = null, designerMode = 'design', onClose = () => {}, enRetrait = false }) {
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
  const [activeQuickMode, setActiveQuickMode] = useState('analyse');
  const [aiHubTab, setAiHubTab] = useState(/** @type {string} */ ('suggest'));
  const [hubPanelOpen, setHubPanelOpen] = useState(true);
  const unifiedHubScrollRef = useRef(null);
  const hubRootRef = useRef(null);

  /**
   * ⛔ LE VOILE CONFISQUAIT LE PREMIER CLIC.
   *
   * Le panneau s'ouvre à l'arrivée (c'est LONGIA : le refermer d'office cacherait la
   * valeur du produit), mais il posait par-dessus tout l'écran un `DIV.fixed inset-0
   * z-[198]` cliquable : 90 boutons sur 104 n'attrapaient rien au premier clic — le
   * clic fermait le voile, il fallait recommencer. Le voile est désormais
   * `pointer-events-none` (il ne sert plus qu'à assombrir) et la fermeture au clic
   * extérieur passe par ce listener en phase de CAPTURE, qui n'appelle NI
   * preventDefault NI stopPropagation : le clic ferme le hub ET atteint sa cible.
   */
  useEffect(() => {
    if (!hubPanelOpen) return undefined;
    const surClicExterieur = (e) => {
      const racine = hubRootRef.current;
      if (!racine) return;
      if (!(e.target instanceof Node)) return;
      if (racine.contains(e.target)) return;
      /* Le popover « activité » est monté en portail sur <body> : sans cette garde,
         cliquer dedans refermerait le panneau qui l'a ouvert. */
      if (e.target instanceof Element && e.target.closest('[data-radix-popper-content-wrapper]')) return;
      setHubPanelOpen(false);
    };
    document.addEventListener('pointerdown', surClicExterieur, true);
    return () => document.removeEventListener('pointerdown', surClicExterieur, true);
  }, [hubPanelOpen]);

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
    /* ⛔ z-[36] passe AU-DESSUS du lanceur Document (z-30) : tant que le lanceur est
       ouvert, le hub doit rentrer sous lui (z-10) et rendre le pointeur, sinon les
       cartes du PREMIER écran sont interceptées et aucun document ne peut démarrer. */
    <div className={cn('pointer-events-none absolute inset-0', enRetrait ? 'z-10' : 'z-[36]')}>
      <div
        ref={hubRootRef}
        aria-hidden={enRetrait || undefined}
        /**
         * ⛔ [PROP-BARRE] Le hub était à `top-3`, donc À CHEVAL sur la barre de
         * propriétés (44 px, montée juste au-dessus du canevas dans la MÊME colonne
         * que ce calque `inset-0`). Mesuré à 1440 px : « Miroir horizontal » (x=818),
         * « Miroir vertical » (852), « Tracé » (987) et « Déformer » (1060) rendaient
         * le bandeau LONGIA à `elementFromPoint` — quatre commandes cliquables sur le
         * papier, inatteignables à l'écran. Le hub commence désormais SOUS la barre.
         * ⚠️ AIHub n'est monté que si `docType && !fullscreen`, exactement la condition
         * de montage de `PropertiesBar` : la réserve est donc toujours juste.
         *
         * ⛔ MÊME MALADIE, UN ÉTAGE PLUS BAS (mesuré le 2026-08-05, affiche Orabank) :
         * ce conteneur portait `pointer-events-auto`. C'est une COLONNE FLEX SANS FOND :
         * sa boîte est l'union de ses enfants — bandeau (661 × 42) + panneau ouvert
         * (420 × 560, collé à droite) — soit 661 × 610 px à (723, 160). La bande
         * TRANSPARENTE laissée à gauche du panneau, 241 × 568 px, avalait tout : mesuré
         * au glissement, un rectangle attrapé à (900, 525) ne bougeait pas d'un pixel,
         * `elementFromPoint` rendant ce div et jamais le canevas. Le pointeur est donc
         * rendu ici et repris SUR CHAQUE ENFANT VISIBLE — le vide ne clique plus.
         */
        className="pointer-events-none absolute right-3 flex max-w-[min(96vw,calc(100%-1.5rem))] flex-col items-end gap-2"
        style={{ top: BARRE_PROPS_PX + 12 }}
      >
        {/* Le pointeur est repris ENFANT PAR ENFANT (cf. la réserve du conteneur) :
            `enRetrait` continue de tout rendre au lanceur Document. */}
        <div className={cn(
          'flex flex-wrap items-center justify-end gap-1 rounded-2xl border border-white/10 bg-[#1f1e1c]/95 px-1.5 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md',
          enRetrait ? 'pointer-events-none' : 'pointer-events-auto',
        )}>
          <div className="flex max-w-[min(100%,280px)] items-center gap-1.5 border-r border-white/[0.08] pr-2">
            <div className="relative h-7 w-7 shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/90 to-orange-600/80 shadow-[0_0_14px_rgba(245,158,11,0.35)]">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#1f1e1c] bg-[#7bb06a]" />
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
                title="Œil sur l'activité — notifications temps réel (hub + LONGIA)"
                className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-[#d4924a]/25 bg-[#d4924a]/10 text-[#ecc98f]/90 hover:bg-[#d4924a]/20"
              >
                <Eye className="h-3.5 w-3.5" />
                {actionHistory.length > 0 || longiaMessages.length > 1 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-0.5 text-[7px] font-bold text-black">
                    {Math.min(99, actionHistory.length + Math.max(0, longiaMessages.length - 1))}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" sideOffset={8} className="z-[5000] w-[min(100vw-2rem,340px)] border-white/[0.1] bg-[#1f1e1c] p-0">
              <div className="border-b border-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-bold text-white/85">Activité en direct</p>
                <p className="text-[9px] leading-snug text-white/40">
                  Fil des actions de l'hub et des échanges LONGIA — comme un flux de notifications temps réel.
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
            {/* Voile purement visuel : il assombrit, il n'intercepte plus rien
                (cf. le listener de clic extérieur, plus haut). */}
            <div className="pointer-events-none fixed inset-0 z-[198] bg-black/30" aria-hidden />
            <div className="pointer-events-auto relative z-[199] w-[min(420px,calc(100vw-1.5rem))] max-w-full">
              <div
                ref={unifiedHubScrollRef}
                className="max-h-[min(68vh,560px)] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#1f1e1c]/95 px-3 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-sm [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.2)_transparent]"
              >

        {aiHubTab === 'suggest' && (
          <>
            {isDocumentMode ? (
              <button
                type="button"
                onClick={() => setAiHubTab('architect')}
                className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-[9px] font-semibold text-amber-100/95 transition-colors hover:bg-amber-500/15"
              >
                <Wand2 className="h-3 w-3 shrink-0" />
                Coach documentaire (Architect) — ouvrir l'onglet
              </button>
            ) : null}

            {/* ⛔ Indicateur HEURISTIQUE LOCAL, pas une évaluation IA : addition en dur sur le nombre
                d'objets, la présence d'un plan et d'un objectif (computeLongiaClarityScore, base 38,
                plafond 96). Le libellé disait « Lecture instantanée » avec un pourcentage, et
                l'enseignant lisait « 38 % » sur un canevas vide comme une note pédagogique.
                Le vrai score de slide vient du Coach LIRI+ (edge `liri-coach-slide`), rail gauche. */}
            <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 border-b border-amber-500/15 pb-2">
                <span
                  className="text-[10px] font-semibold text-amber-100/90"
                  title="Mesure locale du remplissage de la scène — ce n'est pas le score du Coach IA."
                >
                  Complétude de la scène
                </span>
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
                  ? 'border-[#d97757]/35 bg-[#d97757]/10 text-[#f0c4b3] hover:bg-[#d97757]/20'
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
                  ? 'border-[#d4924a]/35 bg-[#d4924a]/10 text-[#ecc98f] hover:bg-[#d4924a]/20'
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
                  ? 'border-[#5a8f52]/35 bg-[#5a8f52]/10 text-[#bcd9a4] hover:bg-[#5a8f52]/20'
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
              <li className="flex gap-2"><span className="text-amber-400/80">5.</span> En mode Document, l'onglet <strong className="text-white/50">Architect</strong> occupe le panneau pour le flux guidé.</li>
              <li className="flex gap-2"><span className="text-amber-400/80">6.</span> Écrivez dans la barre du bas : la réponse apparaît dans <strong className="text-white/50">Suggestion</strong> ou <strong className="text-white/50">Action</strong>.</li>
            </ul>
          </div>
        )}

        {aiHubTab === 'architect' && (
          <div className="space-y-3">
            {isDocumentMode ? <DocumentCoachPanel /> : null}
            {!isDocumentMode && docType !== 'document' ? (
              <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[10px] leading-relaxed text-white/40">
                L'agent <strong className="text-white/55">Architect</strong> est disponible pour les projets de type{' '}
                <strong className="text-white/55">Document</strong>. Créez un document depuis le lanceur pour activer le flux
                guidé (intention, plan, reformulation).
              </p>
            ) : null}
            {/* Revue de mise en page : disponible même hors coach (mode contrôle libre). */}
            {docType === 'document' ? (
              <div className="border-t border-white/[0.06] pt-3">
                <DocumentReviewPanel />
              </div>
            ) : null}
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
              <p className="text-[9px] text-white/30">Aucune action depuis l'AI Hub pour l\'instant.</p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto [scrollbar-width:thin]">
                {actionHistory.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5 text-[9px] text-white/50"
                  >
                    <span className="font-semibold text-white/65">{h.label}</span>
                    <span className="text-white/25"> · </span>
                    <span className="text-[#e8a97f]/70">{h.actionId}</span>
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
            {/* ⛔ RETIRÉ — bloc « Temps réel » : trois boutons Élève / Projecteur / Prof
                SANS `onClick`, dont un affichait en dur l'état « actif » (Projecteur).
                Ils ne pilotaient rien : le seul `viewMode` de cette page n'allume que
                ses propres pastilles dans la barre du haut. Mesuré au cours de l'audit
                de clic du hub — ils n'« interceptaient » rien, ils étaient morts. Même
                arbitrage que les boutons décoratifs retirés juste en dessous : à ne
                remettre qu'avec une action réelle derrière chacun. */}
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
                <GitBranch className="h-3 w-3 text-[#7bb06a]/70" />
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
                        ? 'border-[#5a8f52]/25 bg-[#5a8f52]/[0.08] text-[#9cc48a]'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/45 hover:bg-white/[0.05]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold',
                        scene.id === activeSceneId ? 'bg-[#5a8f52]/20 text-[#9cc48a]' : 'bg-white/[0.06] text-white/30',
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
                <ScrollText className="h-3 w-3 text-[#e0a458]/70" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">Script · scène active</span>
              </div>
              {course && (course.slides || [])[activeSceneIdx] ? (
                <div className="rounded-xl border border-[#d4924a]/15 bg-[#d4924a]/[0.05] p-2.5">
                  <p className="mb-1 truncate text-[10px] font-semibold text-[#e6b566]/80">
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
            {/* ⛔ Bloc « Outils pédagogiques » retiré : ses 6 boutons (Progression A/B/C, Vue Élève,
                Script Prof, Minuteur, Annotation, Export PDF) ne pilotaient QUE leur propre
                surbrillance — `activePedaTool` n'avait aucun autre lecteur dans le fichier.
                Ne pas les remettre sans une action réelle derrière chacun. */}
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
                        : 'border border-amber-500/20 bg-amber-500/10 text-amber-50/90',
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
      className="pointer-events-auto absolute z-[25] flex max-w-[100vw] flex-col overflow-hidden rounded-l-2xl border border-amber-500/30 border-r-0 bg-gradient-to-b from-[#2b2926] to-[#1a1815] shadow-[0_4px_40px_rgba(0,0,0,0.5)]"
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
                  : 'border border-amber-500/20 bg-amber-500/10 text-amber-50/85',
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
        <div className="shrink-0 border-t border-[#d4924a]/20 bg-black/25 px-2.5 py-1.5">
          <p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-[#e0a458]/75">Dernière réponse</p>
          <div className="flex flex-wrap gap-1">
            {chips.map((s, i) => (
              <button
                key={`short_${lastAi.id}_${i}`}
                type="button"
                onClick={() => handleLongiaChip(s, lastAi)}
                className="rounded-md border border-[#d4924a]/35 bg-[#d4924a]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#f0d9b8]/90 hover:bg-[#d4924a]/20"
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
  text:    { label: 'Texte',    icon: Type,     color: 'text-[#e0a458]',    bg: 'bg-[#d4924a]/10',    border: 'border-[#d4924a]/20'    },
  rect:    { label: 'Rectangle',icon: Square,   color: 'text-[#e08a5f]',  bg: 'bg-[#d97757]/10',  border: 'border-[#d97757]/20'  },
  circle:  { label: 'Cercle',   icon: Circle,   color: 'text-[#e0a458]',    bg: 'bg-[#d4924a]/10',    border: 'border-[#d4924a]/20'    },
  ellipse: { label: 'Ellipse',  icon: Disc,     color: 'text-[#e0a458]',    bg: 'bg-[#d4924a]/10',    border: 'border-[#d4924a]/20'    },
  line:    { label: 'Ligne',    icon: Minus,    color: 'text-white/60',    bg: 'bg-white/[0.06]',   border: 'border-white/15'       },
  arrow:   { label: 'Flèche',   icon: ArrowRight,color:'text-white/60',   bg: 'bg-white/[0.06]',   border: 'border-white/15'       },
  image:   { label: 'Image',    icon: ImageIcon,color: 'text-[#7bb06a]', bg: 'bg-[#5a8f52]/10', border: 'border-[#5a8f52]/20' },
  html:    { label: 'Animé',    icon: Zap,      color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
};

const GOOGLE_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Roboto', 'Playfair Display', 'Roboto Mono', 'Oswald', 'Lato', 'Raleway', 'Georgia'];
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96, 120];

/** Bornes de saisie libre : au-delà, la valeur n'est plus une taille de texte. */
const TAILLE_POLICE_MIN = 4;
const TAILLE_POLICE_MAX = 400;

/**
 * Une taille de police proposée est-elle utilisable ?
 *
 * ⛔ PERTE DE CONTENU CORRIGÉE. La taille passait par un `<select>` dont la liste
 * saute de 36 à 42 : toute valeur absente (40, par exemple) ne correspondait à
 * AUCUNE option, `e.target.value` valait '' et `Number('')` vaut 0. Le store
 * recevait `fontSize: 0` et le texte disparaissait sans un mot. Une valeur qui ne
 * passe pas ce filtre doit être REFUSÉE — jamais convertie.
 *
 * @param {unknown} valeur
 * @returns {number | null} taille retenue, ou null si elle ne s'applique pas
 */
function tailleDePoliceValide(valeur) {
  const n = typeof valeur === 'string' ? Number(valeur.trim()) : Number(valeur);
  if (!Number.isFinite(n)) return null;
  if (n < TAILLE_POLICE_MIN || n > TAILLE_POLICE_MAX) return null;
  return Math.round(n * 10) / 10;
}

/**
 * Champ de taille de police — saisie LIBRE (40 est légitime, la liste sautait de
 * 36 à 42) avec les paliers usuels en suggestion.
 *
 * ⚠️ Une frappe VALIDE s'applique aussitôt (taper « 4 » puis « 0 » passe par 4 px
 * avant 40 px, comme dans Figma) ; une frappe invalide — champ vide, « abc », 0,
 * 500 — n'écrit RIEN et le champ se signale en rouge. C'est le point du correctif :
 * le store ne reçoit jamais de taille qu'il ne peut pas rendre.
 */
function ChampTaillePolice({ value, onCommit, className }) {
  const courante = tailleDePoliceValide(value) ?? 16;
  const [brouillon, setBrouillon] = useState(String(courante));
  const [edite, setEdite] = useState(false);
  const affiche = edite ? brouillon : String(courante);
  const invalide = edite && tailleDePoliceValide(brouillon) == null;

  const valider = (v) => {
    const t = tailleDePoliceValide(v);
    if (t == null) return false;
    onCommit(t);
    return true;
  };

  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        value={affiche}
        list="liri-tailles-police"
        title={`Taille du texte — ${TAILLE_POLICE_MIN} à ${TAILLE_POLICE_MAX} px`}
        aria-invalid={invalide || undefined}
        onFocus={() => { setEdite(true); setBrouillon(String(courante)); }}
        onChange={(e) => {
          setEdite(true);
          setBrouillon(e.target.value);
          valider(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { valider(brouillon); setEdite(false); e.currentTarget.blur(); }
          if (e.key === 'Escape') { setEdite(false); e.currentTarget.blur(); }
          /* Flèches : incrément d'1 px sur la valeur COURANTE (un champ texte ne
             les gère pas tout seul, et le pas du `select` était la liste entière). */
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const pas = e.shiftKey ? 10 : 1;
            const suivant = courante + (e.key === 'ArrowUp' ? pas : -pas);
            if (valider(suivant)) setBrouillon(String(tailleDePoliceValide(suivant)));
          }
        }}
        onBlur={() => { setEdite(false); }}
        className={cn(
          'h-7 w-14 shrink-0 rounded-lg border bg-white/[0.04] px-1.5 text-center text-[11px] focus:outline-none',
          invalide ? 'border-red-500/60 text-red-300' : 'border-white/[0.08] text-white/70',
          className,
        )}
      />
      <datalist id="liri-tailles-police">
        {FONT_SIZES.map((s) => <option key={s} value={s} />)}
      </datalist>
    </>
  );
}
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
  const convertirEnTrace   = useSmartboardKonvaStore(s => s.convertirEnTrace);
  const addLongiaMessage   = useSmartboardKonvaStore(s => s.addLongiaMessage);

  const activeScene = scenes.find(s => s.id === activeSceneId);
  const obj = activeScene?.objects?.find(o => o.id === selectedIds[0]);

  /**
   * ⛔ [PROP-BARRE] LA BARRE DÉBORDAIT SANS LE DIRE — même maladie que l'ancien
   * bouton « Exporter » de la barre du haut. Mesuré à 1440 px, un objet sélectionné :
   * « Descendre d'un calque » (x=1434), « Verrouiller » (1491) et « Supprimer » (1525)
   * tombaient HORS de la colonne du canevas, et « Monter d'un calque » (1400) sous le
   * rail de raccourcis de droite. La barre est `overflow-x-auto` avec
   * `[scrollbar-width:none]` : elle défile à la molette, mais RIEN ne le signalait —
   * ni barre, ni chevron, ni repli. Hors d'écran = inexistant.
   *
   * Même solution que `DesignerTopBar` : le repli est décidé sur une MESURE
   * (`scrollWidth > clientWidth`), avec hystérésis — une fois replié le contenu tient,
   * donc le test redeviendrait faux et la barre oscillerait.
   *
   * ⚠️ Le déclencheur « Plus de commandes » est posé HORS de la zone défilante : dans
   * le flux il serait lui-même repoussé hors d'écran, ce qui ne réglerait rien.
   */
  const barreRef = useRef(/** @type {HTMLElement | null} */ (null));
  const [replie, setReplie] = useState(false);
  const seuilRepliRef = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    const el = barreRef.current;
    if (!el) { setReplie(false); return undefined; }
    const mesurer = () => {
      const dispo = el.clientWidth;
      if (!dispo) return;
      setReplie((etaitReplie) => {
        if (!etaitReplie) {
          if (el.scrollWidth > dispo + 2) {
            seuilRepliRef.current = dispo;
            return true;
          }
          return false;
        }
        /* +48 px de marge : on ne déplie qu'une fois la place franchement revenue. */
        return dispo <= seuilRepliRef.current + 48;
      });
    };
    mesurer();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null;
    ro?.observe(el);
    window.addEventListener('resize', mesurer);
    return () => { ro?.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [obj?.id, obj?.type]);

  /* ⛔ Sans sélection : la barre reste MONTÉE et garde sa hauteur (BARRE_PROPS_PX).
     Elle apparaissait/disparaissait en flux au-dessus du canevas — 44 px pris ou
     rendus à l'espace de travail à CHAQUE sélection, donc un auto-fit et un
     glissement vertical du canevas juste avant le 2e clic d'un double-clic. */
  if (!obj) {
    return (
      <div
        className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 text-[10px] text-white/25"
        style={{ height: BARRE_PROPS_PX, background: 'rgba(31,30,28,0.98)' }}
      >
        <MousePointer2 className="h-3 w-3 shrink-0 text-white/20" />
        Sélectionnez un objet de la page pour afficher ses propriétés.
      </div>
    );
  }

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
    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-white/20">{children}</span>
  );
  const IconBtn = ({ active, onClick, children, title, danger }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] transition-all',
        danger  ? 'border-white/[0.07] text-white/30 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400'
        : active ? 'border-[#d4924a]/30 bg-[#d4924a]/15 text-[#e6b566]'
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
        'h-7 rounded-lg border border-white/[0.08] bg-white/[0.04] px-1.5 text-center text-[11px] text-white/70 focus:border-[#d4924a]/40 focus:outline-none shrink-0',
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

  /**
   * Commandes de FIN de barre — celles que la mesure a trouvées inatteignables.
   * Elles ne DISPARAISSENT jamais : elles changent de place (inline tant que la barre
   * tient, sinon dans « Plus de commandes »). Chacune garde son action d'origine.
   *
   * ⚠️ « Miroir » y entre aussi : recouvert par le bandeau LONGIA à 1440 px, et
   * repoussé hors d'écran dès que la barre déborde.
   */
  const commandesFin = [
    ...(isImage || isShape ? [
      {
        key: 'flipX', Icon: FlipHorizontal2, label: 'Miroir horizontal',
        actif: Boolean(obj.style?.flipX), onClick: () => updateStyle({ flipX: !(obj.style?.flipX) }),
      },
      {
        key: 'flipY', Icon: FlipVertical2, label: 'Miroir vertical',
        actif: Boolean(obj.style?.flipY), onClick: () => updateStyle({ flipY: !(obj.style?.flipY) }),
      },
    ] : []),
    { key: 'monter', Icon: ChevronUp, label: "Monter d'un calque", onClick: () => bringForward(obj.id) },
    { key: 'descendre', Icon: ChevronDown, label: "Descendre d'un calque", onClick: () => sendBackward(obj.id) },
    {
      key: 'verrou', Icon: obj.locked ? Lock : Unlock,
      label: obj.locked ? 'Déverrouiller' : 'Verrouiller',
      actif: Boolean(obj.locked), onClick: () => toggleObjectLock(obj.id),
    },
    { key: 'supprimer', Icon: Trash2, label: 'Supprimer', danger: true, onClick: () => deleteSelected() },
  ];

  const CurseurOpacite = ({ large = false }) => (
    <>
      <input
        type="range" min={0} max={1} step={0.01}
        value={obj.opacity ?? 1}
        title="Opacité"
        onChange={e => setObjectOpacity(obj.id, Number(e.target.value))}
        className={cn('h-1 shrink-0 cursor-pointer accent-[#e0a458]', large ? 'w-full' : 'w-16')}
      />
      <span className="w-7 shrink-0 text-[10px] text-white/35">{Math.round((obj.opacity ?? 1) * 100)}%</span>
    </>
  );

  return (
    <motion.div
      key={obj.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="relative z-[38] flex shrink-0 items-stretch border-b border-white/[0.06]"
      /* Barre de propriétés : surface « rail sombre » #1f1e1c de la charte.
         C'était rgba(11,10,18) — un noir BLEUTÉ qui tranchait sur le canvas chaud.
         Hauteur FIGÉE (BARRE_PROPS_PX) : voir la branche « sans sélection » ci-dessus.
         `z-[38]` : filet de sécurité au-dessus du calque du hub LONGIA (z-[36]) —
         celui-ci commence désormais sous la barre, mais un futur calque flottant ne
         doit plus pouvoir avaler des commandes en silence. */
      style={{ height: BARRE_PROPS_PX, background: 'rgba(31,30,28,0.98)', backdropFilter: 'blur(14px)' }}
    >
    <div
      ref={barreRef}
      className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overflow-y-hidden px-3 [scrollbar-width:none]"
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
          {GOOGLE_FONTS.map(f => <option key={f} value={f} style={{ background: '#1f1e1c' }}>{f}</option>)}
        </select>

        {/* Taille — saisie libre, valeur invalide refusée (cf. tailleDePoliceValide) */}
        <ChampTaillePolice
          value={obj.style?.fontSize ?? 32}
          onCommit={(t) => updateStyle({ fontSize: t })}
        />

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
                ? 'border-[#d4924a]/35 bg-[#d4924a]/15 text-[#e6b566]'
                : 'border-white/[0.07] text-white/40 hover:border-white/20 hover:bg-white/[0.05] hover:text-white/70',
            )}>
            {lut.label}
          </button>
        ))}

        <Divider />

        <Lbl>Studio</Lbl>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-[#d97757]/25 bg-[#d97757]/[0.08] px-2.5 py-1 text-[10px] text-[#e8a97f] hover:bg-[#d97757]/15 transition-colors">
          <Wand2 className="h-3 w-3" /> Détourage
        </button>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-pink-500/25 bg-pink-500/[0.08] px-2.5 py-1 text-[10px] text-pink-300 hover:bg-pink-500/15 transition-colors">
          <Sparkles className="h-3 w-3" /> Supp. fond
        </button>

        <Divider />

        {/* ⚠️ « Miroir » a rejoint les commandes de fin de barre (cf. commandesFin) :
            posé ici, il tombait sous le bandeau LONGIA à 1440 px. */}

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

        {/* ⚠️ « Miroir » a rejoint les commandes de fin de barre (cf. commandesFin). */}

        {/* ⛔ MESURÉ : « Tracé » et « Déformer » étaient deux boutons SANS onClick
            (zéro changement d'état) — interdits par la règle du dépôt. « Tracé » est
            désormais branché sur convertirEnTrace (contour réel, ancres éditables) ;
            « Déformer » est RETIRÉ : aucun moteur de déformation n'existe ici. */}
        <Lbl>Vectoriser</Lbl>
        <button
          type="button"
          title="Convertir la forme en tracé fermé — ses ancres deviennent modifiables (Sélection directe)"
          onClick={() => {
            const r = convertirEnTrace(obj.id);
            addLongiaMessage({
              role: 'ai',
              text: r.ok
                ? '✦ Forme convertie en tracé : ses ancres sont éditables via Formes & Vecteur → Sélection directe.'
                : '✦ Cette forme ne peut pas être convertie en tracé.',
            });
          }}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/45 hover:text-white/70 hover:bg-white/[0.07] transition-colors">
          <ScanLine className="h-3 w-3" /> Convertir en tracé
        </button>
      </>}

      {/* ══════════════════════════════════ LINE / ARROW ══════════════════════════════════ */}
      {isLine && <>
        <Lbl>Trait</Lbl>
        <ColorSwatch value={obj.style?.stroke ?? '#a8a29a'} onChange={v => updateStyle({ stroke: v, fill: v })} title="Couleur" />
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
                isCurrent ? 'border-[#d4924a]/35 bg-[#d4924a]/15 text-[#e6b566]' : 'border-white/[0.07] text-white/40 hover:text-white/70',
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
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-[#d97757]/25 bg-[#d97757]/[0.08] px-2.5 py-1 text-[10px] text-[#e8a97f] hover:bg-[#d97757]/15 transition-colors">
          <Box className="h-3 w-3" /> Keyframes
        </button>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/50 hover:text-white/70 transition-colors">
          <MessageSquare className="h-3 w-3" /> Éditer HTML
        </button>
        <button type="button" className="shrink-0 flex items-center gap-1.5 rounded-lg border border-[#d4924a]/20 bg-[#d4924a]/[0.07] px-2.5 py-1 text-[10px] text-[#e6b566] hover:bg-[#d4924a]/10 transition-colors">
          <Sparkles className="h-3 w-3" /> IA → anim
        </button>

        <Divider />

        <Lbl>Bord</Lbl>
        <NumInput value={obj.style?.borderRadius ?? 0} onChange={v => updateStyle({ borderRadius: v })} min={0} max={60} step={2} />
      </>}

      {/* ══════════════════════════════════ COMMUN ══════════════════════════════════ */}
      {/* ⛔ Tout ce bloc DISPARAÎT de la zone défilante quand la barre déborde : il
          repart dans « Plus de commandes », à droite, hors du défilement. */}
      {!replie && <>
        <Divider />
        <Lbl>Opacité</Lbl>
        <CurseurOpacite />
        <Divider />
        {commandesFin.map(({ key, Icon, label, actif, danger, onClick }) => (
          <IconBtn key={key} active={actif} danger={danger} onClick={onClick} title={label}>
            <Icon className="h-3.5 w-3.5" />
          </IconBtn>
        ))}
      </>}

    </div>

    {/* ── PLUS DE COMMANDES ── hors de la zone défilante : c'est la condition pour
        qu'il reste atteignable quand justement plus rien ne tient. */}
    {replie && (
      <div className="flex shrink-0 items-center border-l border-white/[0.07] px-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Plus de commandes"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] text-white/45 transition-all hover:bg-white/10 hover:text-white/80"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 border-white/[0.1] bg-[#1f1e1c] p-2 text-white/80">
            <p className="px-1 pb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/25">
              {meta.label}
            </p>
            <div className="flex items-center gap-2 px-1 pb-2">
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-white/20">Opacité</span>
              <CurseurOpacite large />
            </div>
            {commandesFin.map(({ key, Icon, label, actif, danger, onClick }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors',
                  danger ? 'text-white/55 hover:bg-red-500/10 hover:text-red-300'
                    : actif ? 'bg-[#d4924a]/15 text-[#ecc98f]'
                      : 'text-white/55 hover:bg-white/[0.07] hover:text-white/85',
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />{label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    )}

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
            'rgba(227,170,107,0.05)',
            'rgba(227,170,107,0.18)',
            'rgba(217,119,87,0.15)',
            'rgba(227,170,107,0.05)',
          ],
          boxShadow: [
            '0 0 0px rgba(227,170,107,0)',
            '0 0 40px rgba(227,170,107,0.07)',
            '0 0 40px rgba(217,119,87,0.05)',
            '0 0 0px rgba(227,170,107,0)',
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
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4924a]/40 to-[#d97757]/40 shadow-[0_0_20px_rgba(227,170,107,0.2)]">
              <Sparkles className="h-4 w-4 text-white/80" />
            </div>
          </div>
          <h2 className="text-[22px] font-bold tracking-tight text-white/90">Nouveau document</h2>
          <p className="mt-1 text-[13px] text-white/35">Choisissez le type et les sorties de votre création</p>
          {/* Le double-clic n'existe pour l'utilisateur que s'il est écrit quelque part. */}
          <p className="mt-1 text-[11px] text-white/25">
            Un clic choisit le type · <span className="text-white/45">double-clic pour ouvrir l&apos;atelier directement</span>
          </p>
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
                  /* ⛔ On passe dt.id, PAS selectedType : le double-clic peut arriver sur une
                     carte non encore sélectionnée, et l'état du premier clic n'est pas
                     forcément appliqué quand le second part. Lire l'état ouvrirait le
                     type précédent. */
                  onDoubleClick={() => { setSelectedType(dt.id); onCreate(dt.id, selectedOutputs); }}
                  title={`${dt.label} — double-cliquez pour ouvrir l'atelier`}
                  className={cn(
                    'group flex flex-col items-center gap-2.5 rounded-2xl border px-3 py-4 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]',
                    selected
                      ? [a.bg, a.border, a.glow]
                      : 'border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/15',
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
                    <p className="mt-0.5 text-[9px] text-white/30">{dt.sub}</p>
                  </div>
                  <p className="line-clamp-2 text-[9.5px] leading-relaxed text-white/40">{dt.desc}</p>
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
                  /* Même règle qu'en rangée 1 : on ouvre dt.id, jamais selectedType. */
                  onDoubleClick={() => { setSelectedType(dt.id); onCreate(dt.id, selectedOutputs); }}
                  title={`${dt.label} — double-cliquez pour ouvrir l'atelier`}
                  className={cn(
                    'group flex flex-col items-center gap-2.5 rounded-2xl border px-3 py-4 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]',
                    selected
                      ? [a.bg, a.border, a.glow]
                      : 'border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/15',
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
                    <p className="mt-0.5 text-[9px] text-white/30">{dt.sub}</p>
                  </div>
                  <p className="line-clamp-2 text-[9.5px] leading-relaxed text-white/40">{dt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sorties */}
        <div className="w-full">
          <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-white/20">Sorties du document</p>
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
                      ? 'border-[#d4924a]/35 bg-[#d4924a]/15 text-[#e6b566] shadow-[0_0_10px_rgba(227,170,107,0.12)]'
                      : t.optional
                        ? 'border-dashed border-white/10 text-white/30 hover:border-white/30 hover:text-white/55'
                        : 'border-white/[0.07] bg-white/[0.03] text-white/40 hover:bg-white/[0.07] hover:text-white/70',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.label}</span>
                  <span className="text-white/20 text-[9px]">{t.w}×{t.h}</span>
                </button>
              );
            })}
          </div>
          {selectedOutputs.includes('mobile') && (
            <p className="mt-2.5 rounded-lg border border-[#d4924a]/15 bg-[#d4924a]/[0.04] px-2.5 py-2 text-[9px] leading-relaxed text-white/50">
              <span className="font-semibold text-[#ecc98f]/90">Aperçu invité (vertical)</span>
              {' '}
              — {mobileRead.hint} Zone scène ≈ {mobileRead.availableStage.width}×{mobileRead.availableStage.height} px, échelle
              ≈ {mobileRead.scaleContainPercent} % (canevas 1037×750 inchangé, mis à l'échelle en contain).
            </p>
          )}
          {selectedOutputs.includes('tablet') && (
            <p className="mt-2.5 rounded-lg border border-[#d97757]/15 bg-[#d97757]/[0.04] px-2.5 py-2 text-[9px] leading-relaxed text-white/50">
              <span className="font-semibold text-[#f0c4b3]/90">Tablette</span>
              {' '}
              — {tabletRead.hint} Zone scène ≈ {tabletRead.availableStage.width}×{tabletRead.availableStage.height} px, échelle
              ≈ {tabletRead.scaleContainPercent} %.
            </p>
          )}
        </div>

        {/* Bouton créer */}
        <button
          onClick={() => onCreate(selectedType, selectedOutputs)}
          className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#d4924a]/75 to-[#d97757]/75 px-10 py-3.5 text-[14px] font-bold text-white shadow-[0_0_28px_rgba(227,170,107,0.2)] transition-all hover:shadow-[0_0_38px_rgba(227,170,107,0.35)] hover:scale-[1.03] active:scale-[0.99]"
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
        // ⛔ Le repli local parle à la première personne et était indiscernable d'une vraie
        // réponse IA : un tenant sans crédits « discutait avec LONGIA » sans le savoir.
        text: hasCloud ? payload.text : `${LONGIA_LOCAL_REPLY_PREFIX}${payload.text}`,
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
    } catch (err) {
      const localRich = buildLocalLongiaRichReply(msg, scene, selectedIds, {
        getLabel: (t) => ELEMENT_META[t]?.label ?? 'élément',
      });
      const payload = enrichLocalLongiaForStore(localRich);
      const reason = err?.message ? ` Détail : ${String(err.message).slice(0, 200)}` : '';
      addLongiaMessage({
        role: 'ai',
        // L'erreur réelle était AVALÉE : ni l'utilisateur ni l'équipe ne pouvaient savoir
        // si le moteur IA était vivant pendant un incident.
        text: `${LONGIA_LOCAL_REPLY_PREFIX}${reason}\n\n${payload.text}`,
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
    design: { border: 'border-[#d4924a]/30', bg: 'bg-[#d4924a]/15', text: 'text-[#e0a458]', glow: 'shadow-[0_0_8px_rgba(227,170,107,0.2)]' },
    live:   { border: 'border-red-500/30',  bg: 'bg-red-500/15',  text: 'text-red-400',  glow: 'shadow-[0_0_8px_rgba(239,68,68,0.2)]' },
    video:  { border: 'border-amber-500/30',bg: 'bg-amber-500/15',text: 'text-amber-400',glow: 'shadow-[0_0_8px_rgba(245,158,11,0.2)]' },
    cinema: { border: 'border-[#d97757]/30',bg: 'bg-[#d97757]/15',text: 'text-[#e08a5f]',glow: 'shadow-[0_0_8px_rgba(217,119,87,0.2)]' },
  };
  const accent = modeAccent[designerMode] ?? modeAccent.design;

  const bottomBarH = getBottomBarHeightPx();

  /* ── Navigation de scènes + diaporama ──
     ⛔ Ces trois boutons étaient rendus SANS onClick (bouton mort = interdit).
     Précédent/Suivant naviguent dans le filmstrip ; Lecture enchaîne les scènes
     toutes les 4 s et s'arrête SEUL sur la dernière — pas de boucle infinie. */
  const indexSceneActive = scenes.findIndex((s) => s.id === activeSceneId);
  const allerScene = useCallback((delta) => {
    const cible = scenes[indexSceneActive + delta];
    if (cible) setActiveScene(cible.id);
  }, [scenes, indexSceneActive, setActiveScene]);
  const [diaporama, setDiaporama] = useState(false);
  useEffect(() => {
    if (!diaporama) return undefined;
    if (indexSceneActive >= scenes.length - 1) { setDiaporama(false); return undefined; }
    const t = setTimeout(() => allerScene(1), 4000);
    return () => clearTimeout(t);
  }, [diaporama, indexSceneActive, scenes.length, allerScene]);

  return (
    <div
      className="flex min-h-0 flex-shrink-0 items-center gap-2 border-t border-white/[0.06] px-3 py-1.5"
      /* Même surface #1f1e1c que la barre de propriétés (ex-rgba(11,10,18) bleuté). */
      style={{ minHeight: bottomBarH, background: 'rgba(31,30,28,0.98)', backdropFilter: 'blur(16px)' }}
    >
      {/* ── Timeline contrôles ── */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => allerScene(-1)}
          disabled={indexSceneActive <= 0}
          title="Scène précédente"
          className="flex h-6 w-6 items-center justify-center rounded-md text-white/25 hover:text-white/60 transition-all disabled:opacity-30 disabled:hover:text-white/25"
        >
          <SkipForward className="h-3 w-3 rotate-180" />
        </button>
        <button
          onClick={() => setDiaporama((v) => !v)}
          disabled={scenes.length < 2}
          title={diaporama ? 'Arrêter le diaporama' : 'Diaporama — enchaîne les scènes (4 s)'}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg border transition-all disabled:opacity-30',
            accent.border, accent.bg, accent.text, 'hover:opacity-80',
          )}
        >
          {diaporama ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
        </button>
        <button
          onClick={() => allerScene(1)}
          disabled={indexSceneActive >= scenes.length - 1}
          title="Scène suivante"
          className="flex h-6 w-6 items-center justify-center rounded-md text-white/25 hover:text-white/60 transition-all disabled:opacity-30 disabled:hover:text-white/25"
        >
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
          className={cn('shrink-0 transition-colors', micActive ? 'text-[#e0a458]' : 'text-white/20 hover:text-white/50')}
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
  const { branding, cssVars, shellTheme } = useTenantBranding();
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
  const [docExportOpen, setDocExportOpen] = useState(false);

  /* ── Context Engine : adapte le canvas + LONGIA au type de document ── */
  const setCanvasDimensions  = useSmartboardKonvaStore(s => s.setCanvasDimensions);
  const addObjects           = useSmartboardKonvaStore(s => s.addObjects);
  const setCanvasBackground  = useSmartboardKonvaStore(s => s.setCanvasBackground);
  const _addLongiaMsgCtx    = useSmartboardKonvaStore(s => s.addLongiaMessage);
  useEffect(() => {
    if (!docType) return;
    const dims = CANVAS_DIMS[docType];
    if (dims) setCanvasDimensions(dims.w, dims.h);
    /* ⛔ Une AFFICHE naît sur du PAPIER, pas sur du vide. Le canevas était créé en
       fond `transparent` — rendu noir à l'écran : impossible de juger une mise en
       page destinée à l'impression, et toute l'encre claire y devenait invisible. */
    if (docType === 'affiche') setCanvasBackground('#ffffff');
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
      // ⚠️ CE MESSAGE ENVOYAIT CHERCHER UN OUTIL QUI N'EXISTE PAS. Il annonçait
      // « l'outil Capture (barre gauche) » ; la barre gauche contient onze outils —
      // Sélection, Texte, Formes, Icônes, Images, Fond, 3D, Animés, Modèles, Calques,
      // Paramètres canvas — et aucun ne s'appelle Capture. Le vrai chemin passe par
      // le bouton « Post-prod » de la barre du HAUT, puis « Capturer ou importer ».
      // Un mode d'emploi faux coûte plus cher qu'une absence de mode d'emploi :
      // l'utilisateur cherche là où on lui dit de chercher, puis conclut que c'est cassé.
      video:        `✦ Studio Vidéo activé — 1920×1080. Pour filmer ou importer : bouton « Post-prod » en haut, puis « Capturer ou importer ».`,
    };
    const ctxMsg = ctxMsgs[docType] ?? `✦ Type "${dtMeta?.label ?? docType}" activé.`;
    _addLongiaMsgCtx({ role: 'ai', text: ctxMsg });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType]);

  /* Observe la sélection canvas pour ouvrir le panneau contextuel automatiquement */
  const canvasHasSelection = useSmartboardKonvaStore(s => s.selectedIds.length > 0);
  const selectAllInActiveScene = useSmartboardKonvaStore((s) => s.selectAllInActiveScene);

  /* ── TIROIR DES PANNEAUX ──────────────────────────────────────────────────────
     Il se replie de lui-même dès qu'il n'a RIEN à montrer (aucun outil ouvert ET
     aucune sélection). L'épinglage existe pour que ce repli reste CONTRARIABLE :
     un tiroir qu'on ne peut pas garder ouvert est une prison.
     ⚠️ Ni le repli ni la réouverture ne touchent au FLUX — cf. GOUTTIERE_LISERE_PX. */
  const [tiroirEpingle, setTiroirEpingle] = useState(false);
  const tiroirOuvert = Boolean(activeTool || canvasHasSelection || tiroirEpingle);
  /* Replier à la main = fermer TOUT ce qui le retenait ouvert, sinon le tiroir
     se rouvrirait dans la foulée sur la sélection restée en place. */
  const replierTiroir = useCallback(() => {
    setTiroirEpingle(false);
    setActiveTool(null);
    useSmartboardKonvaStore.getState().selectOnly?.(null);
  }, []);

  /* ── Viewport : borner la largeur pour que TOUTE la page reste visible ──────
     Voir `largeurViewportPourPageEntiere`. La borne ne dépend que de la HAUTEUR
     disponible (jamais de la largeur rendue) : aucune boucle de rétroaction avec
     le ResizeObserver de l'éditeur. */
  const zoneCanvasRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [viewportMaxW, setViewportMaxW] = useState(null);
  /* Largeur EN FLUX de la gouttière. Valeur de départ = la pleine largeur, c'est-à-dire
     le comportement d'avant : on ne passe en surimpression qu'une fois la marge MESURÉE. */
  const [gouttiereEnFlux, setGouttiereEnFlux] = useState(GOUTTIERE_PANNEAU_PX);
  const tiroirEnSurimpression = gouttiereEnFlux !== GOUTTIERE_PANNEAU_PX;
  const canvasW = useSmartboardKonvaStore((s) => s.project?.canvas?.width ?? 0);
  const canvasH = useSmartboardKonvaStore((s) => s.project?.canvas?.height ?? 0);
  useEffect(() => {
    const el = zoneCanvasRef.current;
    if (!el) return undefined;
    const mesurer = () => {
      const r = el.getBoundingClientRect();
      /* Hauteur de l'espace de travail de l'éditeur = colonne moins la barre de
         propriétés, seule bande EN FLUX au-dessus du canevas (tout le reste est en
         `absolute`). Mesuré : colonne 796 px → espace de travail 752 px. */
      const hDispo = r.height - (docType && !fullscreen ? BARRE_PROPS_PX : 0);
      setViewportMaxW(largeurViewportPourPageEntiere(r.width, hDispo, canvasW, canvasH));

      /* ── Le tiroir a-t-il de quoi passer en surimpression ? (cf. HYSTERESIS_SURIMPRESSION_PX)
         ⛔ La gouttière est LUE DANS LE DOM, jamais gardée dans une ref : quand elle
         change, c'est ce même observateur qui se rallume, et une ref mise à jour par un
         effet passif arriverait peut-être après lui. La somme « zone + gouttière » est
         invariante, la mesure est donc stable quelle que soit la largeur en cours. */
      const gout = el.parentElement?.querySelector('[data-gouttiere-panneaux]');
      const largeurTotale = r.width + (gout ? gout.getBoundingClientRect().width : 0);
      const espace = largeurTotale - GOUTTIERE_LISERE_PX;
      const s = echelleAjustementCanevas(espace - 32, hDispo - 32, canvasW, canvasH);
      const margeGauche = s == null ? 0 : (espace - canvasW * s) / 2;
      const besoin = GOUTTIERE_PANNEAU_PX - GOUTTIERE_LISERE_PX;
      setGouttiereEnFlux((prec) => (prec === GOUTTIERE_LISERE_PX
        ? (margeGauche >= besoin ? prec : GOUTTIERE_PANNEAU_PX)
        : (margeGauche >= besoin + HYSTERESIS_SURIMPRESSION_PX ? GOUTTIERE_LISERE_PX : prec)));
    };
    mesurer();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null;
    ro?.observe(el);
    window.addEventListener('resize', mesurer);
    return () => { ro?.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [canvasW, canvasH, docType, fullscreen]);

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
        // Le message renvoyait vers un « panneau Import » qui n'existe pas dans le Designer :
        // le seul import documentaire du produit est Studio LIRI → Import (/studio/liri/import).
        setFormatNotice(
          `Format « ${t || name.split('.').pop() || 'inconnu'} » non pris en charge ici : l'import rapide accepte une image ou un JSON Konva. `
          + 'Pour un PDF, un .docx ou un .pptx, passez par Studio LIRI → Import (/studio/liri/import).',
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
  const handleDocumentLaunch = useCallback((mode, templateId, objects, bg, answers, identiteAppliquee) => {
    if (bg) setCanvasBackground(bg);
    /* ⛔ `addObjects` AJOUTE et empile un pas d'historique : rien de ce qui est déjà
       sur le canevas n'est écrasé, et un seul Ctrl+Z défait la création — marque
       d'entreprise comprise, puisqu'elle arrive dans le même lot. */
    if (objects?.length) addObjects(objects);
    setDocumentLauncherOpen(false);
    // Feedback LONGIA
    const modeLabel = { template: 'modèle', canvas: 'Canvas Intelligent', assistant: 'Assistant guidé', libre: 'Mode Libre' }[mode] ?? mode;
    const marque = identiteAppliquee
      ? ` Marqué aux couleurs de ${identiteAppliquee.nom || 'votre identité'} — en-tête, pied, numérotation et bloc de signature posés.`
      : '';
    _addLongiaMsgCtx({
      role: 'ai',
      text: `✦ Document initialisé en ${modeLabel}${templateId ? ` — ${templateId}` : ''}. Vos blocs sont prêts à être édités.${marque}`,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addObjects, setCanvasBackground]);

  /* Le lanceur doit savoir si la page porte déjà des blocs : sur un document rempli,
     le marquage part DÉCOCHÉ (on n'ajoute pas un second en-tête dans le dos). */
  const documentNonVide = useSmartboardKonvaStore((s) => {
    const p = s.project;
    const scene = p?.scenes?.find((sc) => sc.id === p?.activeSceneId);
    return (scene?.objects?.length ?? 0) > 0;
  });

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
    /* Éviter l'overlay « Nouveau document » qui masquait tout l'éditeur après import Agent LIRI */
    setDocType('smartboard');
    setOutputFormats(['screen']);
    navigate(`${location.pathname}${location.search || ''}`, { replace: true, state: {} });
  }, [location.pathname, location.search, location.state, navigate, setDocType, setOutputFormats]);

  /* ── Clear invite query ── */
  const clearInviteQuery = useCallback(() => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('cw_invite'); return n; }, { replace: true });
  }, [setSearchParams]);

  const onCloudBootstrapConsumed = useCallback(() => setCloudBootstrap(null), []);

  /**
   * « Nouveau document » — coupure COMPLÈTE avec la fiche précédente.
   *
   * ⛔ Avant, seuls le shell et le coach étaient réinitialisés : le canevas Konva et le plan
   * Copilot restaient à l'écran, l'URL gardait `?workspace=`, et l'autosauvegarde 2 min du
   * panneau Cloud continuait d'écrire le NOUVEAU contenu dans l'ANCIENNE fiche, sans clic ni
   * message. Tout ce qui identifie le document précédent doit tomber ici, empreinte comprise.
   */
  const handleNewDocument = useCallback(() => {
    useDesignerShellStore.getState().resetForNewDocument();
    useDocumentCoachStore.getState().deactivateDocumentMode();
    useCourseCopilotStore.getState().resetCourse();
    useSmartboardKonvaStore.getState().loadProject(createEmptyProject());
    clearWorkspaceBaseline();
    setCloudBootstrap(null);
    setFormatNotice('');
    setInviteBanner('');
    workspaceUrlLoadedRef.current = null;
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete('workspace');
        n.delete('cw');
        n.delete('cw_invite');
        return n;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  /**
   * Demande de nouveau document depuis la barre du haut.
   *
   * ⛔ C'est ICI que la perte de données se jouait : le bouton « Nouveau » n'ouvrait
   * que le lanceur, dont `onCreate` se contentait de changer `docType`. Les objets de
   * la fiche précédente restaient sur le canevas et `cloudWorkspaceId` restait chargé :
   * le « Sauver » suivant écrasait l'ANCIENNE fiche Supabase avec le NOUVEAU contenu.
   * La coupure (`handleNewDocument`) est maintenant appelée, et confirmée dès qu'il y a
   * quelque chose à perdre — canevas non vide OU fiche cloud ouverte.
   */
  const demanderNouveauDocument = useCallback(() => {
    const p = useSmartboardKonvaStore.getState().project;
    const nbObjets = (p?.scenes ?? []).reduce((n, s) => n + (s.objects?.length ?? 0), 0);
    const cloudId = useDesignerShellStore.getState().cloudWorkspaceId;
    if (nbObjets > 0 || cloudId) {
      const detail = cloudId
        ? `Le document en cours est lié à une fiche enregistrée (${nbObjets} objet(s)).`
        : `Le canevas contient ${nbObjets} objet(s) non rattaché(s) à une fiche.`;
      const ok = window.confirm(
        `Fermer le document en cours ?\n\n${detail}\n\n`
        + 'Ce qui est déjà enregistré dans le cloud reste intact ; ce qui ne l\'est pas sera perdu.',
      );
      if (!ok) return;
    }
    handleNewDocument();
    setQuickLauncherOpen(true);
  }, [handleNewDocument]);

  /**
   * Dépôt d'un bloc de suggestion sur le canevas (payload `application/liri-document-bloc`).
   *
   * ⚠️ En `dragover`, le navigateur INTERDIT la lecture du contenu du dataTransfer :
   * seuls les types sont visibles. On se fie donc à `types`, jamais à `getData` ici.
   */
  const handleBlocDragOver = useCallback((e) => {
    const types = e.dataTransfer?.types;
    if (!types || !Array.from(types).includes(DOC_BLOC_DND_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleBlocDrop = useCallback((e) => {
    const bloc = lireBlocDnd(e.dataTransfer);
    if (!bloc) return; // payload bibliothèque ou inconnu : on laisse passer au canevas.
    e.preventDefault();
    e.stopPropagation();

    /* Écran → scène : `.konvajs-content` est le conteneur de la Stage, sa largeur
       rendue porte le zoom. On divise par elle plutôt que de lire le `scale` de
       l'éditeur, qui n'est pas exposé hors de son composant. */
    const stageEl = e.currentTarget.querySelector('.konvajs-content');
    const projet = useSmartboardKonvaStore.getState().project;
    const largeurScene = projet?.canvas?.width ?? 794;
    const hauteurScene = projet?.canvas?.height ?? 1123;
    let x = 52;
    let y = 120;
    if (stageEl) {
      const r = stageEl.getBoundingClientRect();
      const k = r.width > 0 ? largeurScene / r.width : 1;
      x = Math.round((e.clientX - r.left) * k);
      y = Math.round((e.clientY - r.top) * k);
    }
    const largeurBloc = Math.min(bloc.largeur, largeurScene - 24);
    x = Math.max(0, Math.min(x, largeurScene - largeurBloc));
    y = Math.max(0, Math.min(y, Math.max(0, hauteurScene - 24)));

    useSmartboardKonvaStore.getState().addObjects([
      makeDocumentTextObject({ text: bloc.texte, x, y, width: largeurBloc, fontSize: bloc.fontSize }),
    ]);
  }, []);

  useEffect(() => {
    const p = searchParams.get('pp');
    if (p && isFormationContentUuid(p)) {
      setPostProdContentId(p);
      setPostProdOpen(true);
      // ⚠️ SANS CETTE LIGNE, LE VOILE « NOUVEAU DOCUMENT » RECOUVRE TOUT.
      // Il s'affiche dès que `docType` est vide (`{!docType && …}`), et arriver par
      // `?pp=` ne le renseignait jamais : la post-production s'ouvrait bien, avec son
      // contenu chargé, PUIS disparaissait sous un écran qui demande « quel type de
      // document veux-tu créer ? ». Question absurde quand on vient justement
      // travailler sur une vidéo existante — et le dock devenait inatteignable.
      // Le même défaut avait déjà été corrigé pour l'import Agent LIRI (voir plus
      // haut, « Éviter l'overlay Nouveau document ») ; ce chemin-ci avait été oublié.
      // 'video' est le type juste : `?pp=` désigne un contenu vidéo de formation.
      setDocType('video');
      setOutputFormats(['screen']);
    }
  }, [searchParams, setDocType, setOutputFormats]);

  /** À l'ouverture avec `?pp=`, refermer LONGIA une fois pour éviter canvas + dock + hub trop étroit. */
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
        // Même clé PAR DOCUMENT que l'éditeur (qui dérive son scope de `cloudBootstrap`),
        // sinon les deux écrivains se marchent dessus et un second document écrase le premier.
        const cloudId = useDesignerShellStore.getState().cloudWorkspaceId;
        const payload = buildWorkspacePayloadFromStores();
        localStorage.setItem(
          liriCourseWorkspaceLocalKey(cloudId ? `ws-${cloudId}` : 'local-konva'),
          JSON.stringify(payload),
        );
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
      if (!data.session) {
        // Sortie MUETTE auparavant : l'enseignant dont la session avait expiré voyait un
        // designer vide et pouvait croire son document perdu — puis en créer un doublon.
        if (!cancelled) {
          setFormatNotice(
            "Connectez-vous d'abord pour ouvrir ce workspace — le paramètre URL est conservé.",
          );
        }
        return;
      }
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
      setFormatNotice(isLegacyPolotnoOnlyPayload(payload) ? LEGACY_POLOTNO_NOTICE : '');
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
      setFormatNotice(isLegacyPolotnoOnlyPayload(payload) ? LEGACY_POLOTNO_NOTICE : '');
      useDesignerShellStore.getState().setCloudMeta({ id: row.id, title: row.title || '' });
      setCloudBootstrap({ workspaceId: row.id, title: row.title || '', accessRole: result.role === 'editor' ? 'editor' : 'viewer' });
      setInviteBanner('Invitation acceptée — workspace chargé.');
      clearInviteQuery();
    })();
    return () => { cancelled = true; };
  }, [inviteToken, clearInviteQuery]);

  return (
    <div
      /* ⛔ `overflow-x: clip` et pas `hidden` : `hidden` reste DÉFILABLE par programme.
         La barre du haut dépasse la fenêtre en deçà d'environ 1 990 px de large ; il
         suffisait qu'un élément hors champ prenne le focus pour que le navigateur
         fasse défiler TOUTE la coque de 473 px (mesuré) — rail, gouttière et canevas
         partaient sous le bord gauche et chaque clic tombait à côté. `clip` interdit
         ce défilement. La barre elle-même reste à rendre responsive : voir rapport. */
      className="flex h-[100dvh] flex-col overflow-y-hidden overflow-x-clip"
      style={{
        background: '#262624',
        color: proColors.textPrimary,
        fontFamily: 'var(--school-font-family, Inter, system-ui, sans-serif)',
        ...cssVars,
      }}
      data-school-shell="smartboard-designer"
      data-tenant-brand={branding.name}
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
              onNewDoc={demanderNouveauDocument}
              designerMode={designerMode}
              setDesignerMode={setDesignerMode}
              cinemaPedagogy={isCinemaPedagogy}
              postProdOpen={postProdOpen}
              onTogglePostProd={togglePostProdDock}
              quickLauncherOpen={quickLauncherOpen}
              onQuickLaunch={() => setQuickLauncherOpen(v => !v)}
              onExportDocument={() => setDocExportOpen(true)}
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
          /* Seconde barrière : le lanceur peut être ouvert autrement que par
             « Nouveau ». Créer un document coupe TOUJOURS le lien avec la fiche
             précédente — sinon « Sauver » viserait encore l'ancienne. */
          const p = useSmartboardKonvaStore.getState().project;
          const nbObjets = (p?.scenes ?? []).reduce((n, s) => n + (s.objects?.length ?? 0), 0);
          if (nbObjets > 0 || useDesignerShellStore.getState().cloudWorkspaceId) handleNewDocument();
          setDocType(type);
          setOutputFormats(outputs);
          setQuickLauncherOpen(false);
        }}
        onImportFile={handleImportFile}
      />

      {/* CENTRE D'EXPORT DOCUMENT — critique de mise en forme puis PDF */}
      <DocumentExportPanel
        open={docExportOpen}
        onClose={() => setDocExportOpen(false)}
        titreDocument={cloudWorkspaceTitle}
        docType={docType || 'document'}
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

        {/* GOUTTIÈRE DES PANNEAUX — seul le LISERÉ occupe le flux (cf. GOUTTIERE_LISERE_PX),
            et sa largeur ne varie JAMAIS. Le panneau s'ouvre par-dessus le plan de travail.
            ⛔ Ne pas remettre le panneau EN FLUX, sous aucune forme (ni largeur variable, ni
            montage/démontage d'une colonne) : l'éditeur Konva relance son auto-fit à chaque
            changement de taille de son espace de travail, et le canevas glissait alors sous
            le curseur entre le 1er et le 2e clic d'un double-clic. */}
        {!fullscreen && (
          <div
            data-gouttiere-panneaux=""
            /* ⛔ PAS d'`overflow-hidden` ici : c'est cette colonne qui ancre le panneau,
               lequel déborde volontairement sur sa droite en mode surimpression.
               `z-40` le porte au-dessus des voiles du plan de travail (z-20 / z-30). */
            className="relative z-40 flex flex-shrink-0 flex-col border-r border-white/[0.05]"
            style={{ width: gouttiereEnFlux, background: '#17150f' }}
          >
            {/* COQUE DU PANNEAU — toujours ancrée au bord GAUCHE de la gouttière et
                toujours large de GOUTTIERE_PANNEAU_PX : elle remplit la gouttière quand
                celle-ci est pleine, elle déborde sur le plan de travail quand la gouttière
                est réduite au liseré. Une seule règle, donc aucun cas particulier.
                ⛔ `pointer-events-none` dès l'instant du repli : un panneau qui s'efface
                reste cliquable pendant toute sa sortie, et il recouvre ici une bande du
                plan de travail — il confisquerait les clics destinés au canevas.
                ⛔ Transition sur l'OPACITÉ et le GLISSEMENT seuls, jamais sur la largeur
                (une largeur animée relance l'auto-fit à chaque image). */}
            <div
              className={cn(
                'absolute bottom-0 left-0 flex flex-col overflow-hidden border-r border-white/[0.05]',
                tiroirOuvert ? 'pointer-events-auto' : 'pointer-events-none',
              )}
              style={{
                /* ⛔ En surimpression, le panneau démarre SOUS la barre de propriétés :
                   elle est en `z-[38]`, il est en `z-40`, et il lui mangeait sinon ses
                   premières commandes (mesuré : 218 px de barre masqués). Il ne recouvre
                   ainsi que le plan de travail, jamais une commande. */
                top: tiroirEnSurimpression && docType ? BARRE_PROPS_PX : 0,
                width: GOUTTIERE_PANNEAU_PX,
                background: '#17150f',
                opacity: tiroirOuvert ? 1 : 0,
                transform: tiroirOuvert ? 'translateX(0)' : 'translateX(-12px)',
                transition: 'opacity 160ms ease-out, transform 160ms ease-out',
                /* L'ombre ne se justifie que s'il y a quelque chose SOUS le panneau. */
                boxShadow: tiroirEnSurimpression ? '0 0 28px rgba(0,0,0,0.45)' : 'none',
              }}
              aria-hidden={!tiroirOuvert}
              data-tiroir-panneau={tiroirOuvert ? 'ouvert' : 'replie'}
            >
              {/* Languette : rendre les propriétés de l'objet accessibles SANS confisquer
                  le clic sur un outil (l'outil garde son catalogue, cf. ContextualPanel). */}
              {activeTool && canvasHasSelection ? (
                <button
                  type="button"
                  onClick={() => setActiveTool(null)}
                  className="z-10 flex shrink-0 items-center gap-1.5 border-b border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-left text-[10px] font-semibold text-white/45 transition-colors hover:bg-white/[0.07] hover:text-[#e0a458]"
                  title="Fermer l'outil et afficher les propriétés de l'objet sélectionné"
                >
                  <SlidersHorizontal className="h-3 w-3 shrink-0" />
                  <span className="truncate">Propriétés de l&apos;objet</span>
                  <ChevronRight className="ml-auto h-3 w-3 shrink-0" />
                </button>
              ) : null}
              <div className="relative min-h-0 flex-1">
                {/* ⛔ MESURÉ (deux fois) : la sortie d'AnimatePresence n'ABOUTIT PAS toujours.
                    1) Sélection puis désélection : l'`<aside>` restait monté à `opacity: 1`
                       — le cas « plus rien à montrer » est déjà démonté franchement ici.
                    2) La sélection CHANGE pendant les 160 ms de sortie du panneau
                       `element-ctx` (clic outil puis clic objet dans la foulée) : le
                       panneau Élément se REMONTE (clé `el-<id>`) sous une présence déjà
                       sortante, sa sortie ne se joue jamais, et le panneau RÉPLIQUÉ reste
                       à `opacity: 1` à côté du panneau courant — un fantôme par fenêtre
                       manquée, d'où les 2 puis 4 colonnes vues en capture.
                    AnimatePresence est donc RETIRÉ : montage/démontage francs. L'entrée
                    (`initial`→`animate` de ANIM_PANNEAU) se joue sans lui, et la
                    transition d'ouverture/fermeture du tiroir reste portée par la coque.
                    ⚠️ Aucun effet sur la coque : ce panneau est en `absolute` dans une
                    colonne de largeur figée, ni la gouttière ni le plan de travail n'en
                    dépendent. */}
                {activeTool || canvasHasSelection ? (
                  <ContextualPanel
                    key={activeTool ?? 'element-ctx'}
                    tool={activeTool}
                    onClose={() => setActiveTool(null)}
                  />
                ) : tiroirEpingle ? (
                  /* Seul état vide qui subsiste : l'utilisateur a épinglé le tiroir
                     lui-même. L'ancienne phrase (« Choisissez un outil à gauche, ou
                     sélectionnez un objet ») décrivait un état qui n'existe plus,
                     puisque le tiroir se referme désormais tout seul. */
                  <motion.p
                    key="tiroir-epingle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-3 py-4 text-[10px] leading-relaxed text-white/25"
                  >
                    Tiroir maintenu ouvert. Il se refermera de lui-même au prochain repli
                    manuel&nbsp;: outil ou sélection l&apos;alimenteront d&apos;ici là.
                  </motion.p>
                ) : null}
              </div>
            </div>

            {/* POIGNÉE — l'utilisateur doit pouvoir contrarier le repli automatique.
                ⛔ Elle se cale sur le bord DROIT de ce qui est visible (panneau ouvert,
                gouttière repliée) et reste donc toujours DANS la gouttière ou DANS le
                panneau : elle ne survole jamais le canevas, contrairement aux languettes
                flottantes qui ont déjà confisqué des clics ici.
                Elle se déplace par `left` — un absolu dans une colonne de largeur figée,
                sans le moindre effet sur la taille du plan de travail. */}
            <button
              type="button"
              onClick={tiroirOuvert ? replierTiroir : () => setTiroirEpingle(true)}
              className="absolute z-10 flex items-center justify-center rounded-l border-y border-l border-white/[0.07] bg-white/[0.04] text-white/30 transition-[left,color,background-color] duration-150 hover:bg-white/[0.09] hover:text-[#e0a458]"
              style={{
                top: '50%',
                marginTop: -28,
                height: 56,
                width: POIGNEE_TIROIR_PX,
                left: (tiroirOuvert ? GOUTTIERE_PANNEAU_PX : gouttiereEnFlux) - POIGNEE_TIROIR_PX,
              }}
              title={tiroirOuvert
                ? 'Replier le tiroir des propriétés'
                : 'Ouvrir le tiroir des propriétés et le garder ouvert'}
              aria-expanded={tiroirOuvert}
              aria-label={tiroirOuvert ? 'Replier le tiroir des propriétés' : 'Ouvrir le tiroir des propriétés'}
            >
              {tiroirOuvert
                ? <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            </button>
          </div>
        )}

        {/* CANVAS — SmartboardKonvaEditorV1 avec hideChrome */}
        {/* ⛔ Le dépôt d'un BLOC DE SUGGESTION est intercepté ici, en phase de CAPTURE :
            le `onDrop` interne du canevas n'accepte que `application/liri-library` et
            ignore les coordonnées. On ne le remplace pas — `lireBlocDnd` rend `null`
            sur tout autre payload, et l'évènement continue alors sa route vers lui. */}
        <div
          ref={zoneCanvasRef}
          className="relative flex min-w-0 flex-1 justify-center overflow-hidden"
          /* Fond NEUTRE, pas celui du tenant : cf. canvasBackdrop dans
             schoolShellTheme — une paroi teintée fausse le jugement des couleurs. */
          style={shellTheme.canvasBackdrop || shellTheme.gridBackground}
        >
        <div
          className="relative flex w-full min-w-0 flex-col overflow-hidden"
          /* Largeur bornée en portrait pour que TOUTE la page reste visible — voir
             largeurViewportPourPageEntiere (null = aucune borne, rien ne change). */
          style={viewportMaxW ? { maxWidth: viewportMaxW } : undefined}
          onDragOverCapture={handleBlocDragOver}
          onDropCapture={handleBlocDrop}
        >
          {isnaImportSummary && !fullscreen ? (
            <div className="pointer-events-none absolute right-3 top-3 z-30">
              <div className="pointer-events-auto w-[320px] rounded-xl border border-[#d97757]/30 bg-[#1f1e1c]/90 p-3 text-[11px] text-[#f5d9cc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
                <div className="mb-1 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-[#e8a97f]" />
                  <p className="font-semibold text-[#f5d9cc]">Import source actif</p>
                </div>
                <p className="text-[#f5d9cc]/85">
                  {isnaImportSummary.stepsCount} etape(s) importe(e)s · source {isnaImportSummary.source || 'isna'}
                </p>
                <p className="mt-0.5 text-[#f0c4b3]/70">{isnaImportSummary.savedAtLabel || 'date inconnue'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    to={isnaImportSummary.runId ? `/studio/constructeur-isna?runId=${encodeURIComponent(isnaImportSummary.runId)}` : '/studio/constructeur-isna'}
                    className="rounded-md border border-[#e08a5f]/35 bg-[#d97757]/15 px-2 py-1 text-[10px] font-semibold text-[#f5d9cc] transition hover:bg-[#d97757]/25"
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
                className="absolute top-3 right-3 z-50 flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#262624]/80 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur hover:border-[#d4924a]/30 hover:text-[#e0a458] transition-all"
              >
                <Minimize2 className="h-3.5 w-3.5" /> Quitter plein écran
              </motion.button>
            )}
          </AnimatePresence>

          {/* ⛔ KonvaParityFeatureRoot était monté ici dans un `<div className="hidden">` avec le
              commentaire « masqué visuellement, garde ses effets ». C'ÉTAIT FAUX : ce composant
              n'a aucun useEffect, uniquement du JSX et des handlers. Onze commandes (export PDF,
              script prof, support élève, quiz, flashcards, export workspace JSON, palette,
              typographie, blocs pédagogiques) étaient donc chargées, invisibles et inutilisables.
              Le mount est retiré plutôt que laissé en leurre ; le composant reste disponible pour
              être posé dans un panneau RÉEL — voir le rapport d'audit du Studio Konva. */}

          {/* ── Écran de création de document ── */}
          <AnimatePresence>
            {!docType && (
              <motion.div
                key="new-doc-screen"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, pointerEvents: 'none' }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                /* ⛔ Un voile plein écran qui S'EFFACE reste cliquable pendant toute
                   son animation de sortie : le premier clic dans l'éditeur, juste
                   après le choix du type de document, partait dans le vide.
                   `pointerEvents: 'none'` est posé dès le début de la sortie. */
                className="absolute inset-0 z-20 flex flex-col"
                /* Voile « Nouveau document » : fond de page #262624 (ex-rgba(10,11,15) froid). */
                style={{ background: 'rgba(38,38,36,0.96)' }}
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
                exit={{ opacity: 0, pointerEvents: 'none' }}
                transition={{ duration: 0.18 }}
                /* Même règle que le voile « Nouveau document » : plus rien
                   n'intercepte dès l'instant où le lanceur se referme. */
                className="absolute inset-0 z-30 flex flex-col overflow-hidden"
              >
                <Suspense
                  fallback={
                    <div className="flex flex-1 items-center justify-center text-[12px] text-white/30" style={{ background: '#1f1e1c' }}>
                      Chargement du Studio Document…
                    </div>
                  }
                >
                  <DocumentStudioLauncher
                    onClose={() => setDocumentLauncherOpen(false)}
                    onLaunch={handleDocumentLaunch}
                    documentNonVide={documentNonVide}
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
              className="pointer-events-auto absolute bottom-14 right-4 z-[32] flex max-w-[min(92vw,420px)] items-center gap-2 rounded-2xl border border-white/10 bg-[#1f1e1c]/90 px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md"
              title={collabPresence.roomId ? `Room ${collabPresence.roomId}` : undefined}
            >
              <Users className="h-3.5 w-3.5 shrink-0 text-[#7bb06a]/80" aria-hidden />
              <span className="hidden text-[9px] font-semibold uppercase tracking-wider text-white/45 sm:inline">En ligne</span>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto [scrollbar-width:none]">
                {collabPresence.members.slice(0, 14).map((m) => (
                  <div
                    key={m.userId}
                    title={m.name || m.userId}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white/95 shadow-sm"
                    style={{
                      // m.color vient du moteur de collaboration : c'est la couleur
                      // du participant, une DONNÉE — on n'y touche pas. Seul le repli
                      // « membre sans couleur » passe du slate #64748b au neutre chaud.
                      borderColor: m.color || 'rgba(255,255,255,.25)',
                      background: `${m.color || '#a8a29a'}29`,
                    }}
                  >
                    {(m.name || '?').trim().slice(0, 2).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {aiHubOpen && !fullscreen && docType ? (
            <AIHub
              docType={docType}
              designerMode={designerMode}
              onClose={() => setAiHubOpen(false)}
              /* Le lanceur Document est le PREMIER écran : le hub s'efface DESSOUS le
                 temps qu'il est ouvert, au lieu de confisquer ses quatre cartes. */
              enRetrait={docType === 'document' && documentLauncherOpen}
            />
          ) : null}
        </div>
        </div>

        <DesignerQuickRail
          docType={docType}
          designerMode={designerMode}
          fullscreen={fullscreen}
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
                    style={{ background: '#1f1e1c' }}
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
              aiHubOpen ? 'bg-[#1f1e1c] border-r-0' : 'bg-[#262624]',
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
