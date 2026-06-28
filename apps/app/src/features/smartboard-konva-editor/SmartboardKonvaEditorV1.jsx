/**
 * SmartBoard Editor V1 — React + Konva + Zustand (LIRI).
 * Layout type logiciel pro (Photoshop) : barre d'app, outils, structure cours, plan de travail
 * centré (repère natif 1037×750), panneaux droite (calques / propriétés / coach), bandeau scènes.
 */
import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import {
  Type, Square, Circle as CircleIcon, Image as ImageIcon, Sparkles, Atom,
  Undo2, Redo2, Download, Upload, Trash2, ZoomIn, Save, FolderOpen, Loader2, Film,
  ChevronLeft, ChevronRight, Mic, Code, Eye, GraduationCap, BookOpen, Monitor, Layers,
  PenLine, ScrollText, Map, GitBranch, SlidersHorizontal, Bot, History,
  Star, Palette, X, BookMarked,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  computeSmartboardCanvasScale,
  SMARTBOARD_DESIGN_WIDTH,
  SMARTBOARD_DESIGN_HEIGHT,
} from '@/lib/smartboardDesignCanvas';
import KonvaBoardStage from './canvas/KonvaBoardStage';
import { useSmartboardKonvaStore } from './store/useSmartboardKonvaStore';
import {
  mkTextObject,
  mkImageObject,
  mkRectObject,
  serializeProject,
  parseProjectJson,
} from './model/sceneModel';
import { improveSceneLayout, improveSceneLayoutVariants } from './ai/improveSceneLayout';
import CourseStructureColumn from './components/CourseStructureColumn';
import CourseSlideCoachColumn from './components/CourseSlideCoachColumn';
import DesignerLayersPanel from './components/DesignerLayersPanel';
import CourseWorkspaceCloudSection from './components/CourseWorkspaceCloudSection';
import CanvaDesignPanel from './components/CanvaDesignPanel';
import CanvaPropertiesPanel from './components/CanvaPropertiesPanel';
import SlideQualityBadge from './components/SlideQualityBadge';
import SlideProgressionPanel from './components/SlideProgressionPanel';
import ProjectDashboardBar from './components/ProjectDashboardBar';
import ValidationChecklist from './components/ValidationChecklist';
import VersionHistoryPanel from './components/VersionHistoryPanel';
import GlossairePanel from './components/GlossairePanel';
import LiriWritePanel from './components/LiriWritePanel';
import { useSmartboardCollab } from './hooks/useSmartboardCollab';
import { useSmartboardDesignKeyboardShortcuts } from './hooks/useSmartboardDesignKeyboardShortcuts';
import { analyzeSlideQuality, analyzeProjectQuality } from './lib/slideQualityAnalyzer';
import { useCourseCopilotStore } from './store/useCourseCopilotStore';
import {
  activateKonvaSceneAndSyncSlide,
  buildWorkspacePayloadFromStores,
  hydrateWorkspaceIntoKonvaEditor,
  parseWorkspaceImport,
  LIRI_COURSE_WORKSPACE_LOCAL_KEY,
} from './store/smartboardWorkspaceApi';
import { uploadSmartboardCanvasImage } from '@/lib/uploadSmartboardCanvasImage';
import { saveRenderSlideFramesToFormationContent } from '@/lib/saveRenderSlideFrames';
import { supabase } from '@/lib/customSupabaseClient';
import {
  invokeGenerateVisualImage,
  pushLegacyLocalDesignerImage,
} from './lib/designerIaImageHistory';
import {
  readPedagogyHintsQueue,
  clearPedagogyHintsQueue,
  buildKonvaObjectsFromPedagogyHints,
  LIRI_PEDAGOGY_HINTS_QUEUE_KEY,
} from '@/lib/liriPedagogyHintsKonvaBridge';
import LibraryPanel from '@/features/library/components/LibraryPanel';
import { useLibrary } from '@/features/library/hooks/useLibrary';
import LongiaDesignerChatSection from './components/LongiaDesignerChatSection';
import { buildLongiaDesignerChatContext } from './lib/buildLongiaDesignerChatContext';
import { applyLongiaDesignerCanvasActions } from './lib/applyLongiaDesignerCanvasActions';
import { useDesignerCopilotPresenceStore } from './store/useDesignerCopilotPresenceStore';

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Système', value: 'system-ui, sans-serif' },
  { label: 'Mono', value: 'ui-monospace, SFMono-Regular, monospace' },
];

function buildSceneExport(project) {
  const scene = project.scenes.find((s) => s.id === project.activeSceneId) || project.scenes[0];
  if (!scene) return null;
  return {
    sceneId: scene.id,
    canvas: project.canvas,
    objects: scene.objects,
  };
}

const SmartboardKonvaEditorV1 = forwardRef(function SmartboardKonvaEditorV1({
  className,
  cloudBootstrap = null,
  onCloudBootstrapConsumed,
  /** Projet Konva (invitation cloud) — chargement ponctuel, ne change pas le layout. */
  initialKonvaProject = null,
  /** Masque tout le chrome (header, barres) pour intégration dans un shell externe. */
  hideChrome = false,
  /** Avec hideChrome: réaffiche la colonne gauche Outils / Propriétés (CanvaDesignPanel, bibliothèque, etc.). */
  embedDesignerLeftRail = false,
  /** Si défini (UUID contenu vidéo), affiche la capture des slides pour l'export FFmpeg split-screen. */
  videoExportContentId = null,
  longiaThreadScopeId: longiaThreadScopeIdProp = null,
  /** Raccourcis 1–5 pour `interactionTool` (plan Studio Image). Undo/align clavier toujours actifs dans l'éditeur. */
  enableWorkbenchDigitShortcuts = false,
  /** Shell externe (hideChrome) : état collab pour bandeau membres flottant. */
  onCollabPresence = null,
}, ref) {
  useImperativeHandle(ref, () => ({
    /** @param {number} [fps] */
    getLayerCaptureStream: (fps) =>
      typeof stageRef.current?.getLayerCaptureStream === 'function'
        ? stageRef.current.getLayerCaptureStream(fps)
        : null,
  }));
  const containerRef = useRef(null);
  const workspaceRef = useRef(null);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const [scale, setScale] = useState(0.72);
  const [snapToGrid, setSnapToGrid] = useState(false);
  /** Module 3 - vue active: 'design' | 'student' | 'teacher' | 'live' */
  const [viewMode, setViewMode] = useState('design');
  /** Module 13 - etape courante pour apercu progressif */
  const [stepPreview, setStepPreview] = useState(0);
  /** Mode principal de l'editeur (barre haut) */
  const [topMode, setTopMode] = useState('edition');
  /** Onglet panneau droit */
  const [rightTab, setRightTab] = useState('plan');
  /** Outil actif panneau gauche */
  const [leftTool, setLeftTool] = useState('templates');
  /** Thème optionnel pour génération d'images (LONGIA) — le plan vient de l'agent LIRI */
  const [longiaTopic, setLongiaTopic] = useState('');
  const [longiaImageBusy, setLongiaImageBusy] = useState(false);
  const [longiaGraphBusy, setLongiaGraphBusy] = useState(false);
  /** Modale diffusion Live */
  const [liveModal, setLiveModal] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState('');
  const [liveBroadcastBusy, setLiveBroadcastBusy] = useState(false);
  const [liveBroadcastStatus, setLiveBroadcastStatus] = useState('');
  const [videoExportBusy, setVideoExportBusy] = useState(false);
  const [videoExportStatus, setVideoExportStatus] = useState('');
  /** Plein ecran presentation */
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRef = useRef(null);
  /** Collaboration Realtime */
  const [collabEnabled, setCollabEnabled] = useState(false);
  const [collabRoomId] = useState(() => {
    try { return localStorage.getItem('liri_collab_room') || crypto.randomUUID().slice(0, 8); } catch { return crypto.randomUUID().slice(0, 8); }
  });
  const [inlineTextId, setInlineTextId] = useState(null);
  const [inlineDraft, setInlineDraft] = useState('');
  const [inlineBox, setInlineBox] = useState(null);
  /** Renommer scene inline (filmstrip) */
  const [renamingSceneId, setRenamingSceneId] = useState(null);
  const [renamingSceneDraft, setRenamingSceneDraft] = useState('');
  /** Renommer scene depuis le header canvas */
  const [renamingHeaderScene, setRenamingHeaderScene] = useState(false);
  const [renamingHeaderDraft, setRenamingHeaderDraft] = useState('');
  /** Clipboard pour copier/coller objets */
  const clipboardRef = useRef([]);
  /** Collab */
  const [collabCopied, setCollabCopied] = useState(false);
  /** Drag-and-drop scenes filmstrip */
  const [dragSceneIdx, setDragSceneIdx] = useState(null);
  /** Section active pour le Spotlight pedagogique */
  const [activeSection, setActiveSection] = useState(null);
  const [imageUrlDraft, setImageUrlDraft] = useState('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=60');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProvider, setAiProvider] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [imageUploadHint, setImageUploadHint] = useState('');
  /** Aperçu clic molette (image / icône / HTML) */
  const [assetPreview, setAssetPreview] = useState(null);
  const fileInputRef = useRef(null);
  const workspaceFileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const initialKonvaLoadedRef = useRef(false);

  const longiaThreadScopeId =
    longiaThreadScopeIdProp ||
    (cloudBootstrap?.workspaceId ? `ws-${cloudBootstrap.workspaceId}` : 'local-konva');

  const project = useSmartboardKonvaStore((s) => s.project);
  const selectedIds = useSmartboardKonvaStore((s) => s.selectedIds);
  const aiPreview = useSmartboardKonvaStore((s) => s.aiPreview);
  const pushHistory = useSmartboardKonvaStore((s) => s.pushHistory);
  const undo = useSmartboardKonvaStore((s) => s.undo);
  const redo = useSmartboardKonvaStore((s) => s.redo);
  useSmartboardDesignKeyboardShortcuts({ enableToolDigitShortcuts: enableWorkbenchDigitShortcuts });
  const addObject = useSmartboardKonvaStore((s) => s.addObject);
  const addScene = useSmartboardKonvaStore((s) => s.addScene);
  const duplicateActiveScene = useSmartboardKonvaStore((s) => s.duplicateActiveScene);
  const setActiveScene = useSmartboardKonvaStore((s) => s.setActiveScene);
  const selectOnly = useSmartboardKonvaStore((s) => s.selectOnly);
  const toggleSelect = useSmartboardKonvaStore((s) => s.toggleSelect);
  const updateObject = useSmartboardKonvaStore((s) => s.updateObject);
  const updateObjectTransform = useSmartboardKonvaStore((s) => s.updateObjectTransform);
  const deleteSelected = useSmartboardKonvaStore((s) => s.deleteSelected);
  const deleteObjectById = useSmartboardKonvaStore((s) => s.deleteObjectById);
  const loadProject = useSmartboardKonvaStore((s) => s.loadProject);
  const setAiPreview = useSmartboardKonvaStore((s) => s.setAiPreview);
  const applyAiPreview = useSmartboardKonvaStore((s) => s.applyAiPreview);
  const discardAiPreview = useSmartboardKonvaStore((s) => s.discardAiPreview);
  const getActiveScene = useSmartboardKonvaStore((s) => s.getActiveScene);
  const ensureScenesForSlides = useSmartboardKonvaStore((s) => s.ensureScenesForSlides);
  const loadSceneFromSlide = useSmartboardKonvaStore((s) => s.loadSceneFromSlide);
  const addObjects = useSmartboardKonvaStore((s) => s.addObjects);
  const alignSelected = useSmartboardKonvaStore((s) => s.alignSelected);
  const bringForward = useSmartboardKonvaStore((s) => s.bringForward);
  const sendBackward = useSmartboardKonvaStore((s) => s.sendBackward);
  const bringToFront = useSmartboardKonvaStore((s) => s.bringToFront);
  const sendToBack = useSmartboardKonvaStore((s) => s.sendToBack);
  const setObjectOpacity = useSmartboardKonvaStore((s) => s.setObjectOpacity);
  const setCanvasBackground = useSmartboardKonvaStore((s) => s.setCanvasBackground);
  const applyGlobalTheme = useSmartboardKonvaStore((s) => s.applyGlobalTheme);
  const setSceneDuration = useSmartboardKonvaStore((s) => s.setSceneDuration);
  const deleteScene = useSmartboardKonvaStore((s) => s.deleteScene);
  const renameScene = useSmartboardKonvaStore((s) => s.renameScene);
  const reorderScenes = useSmartboardKonvaStore((s) => s.reorderScenes);
  const duplicateSelected = useSmartboardKonvaStore((s) => s.duplicateSelected);
  const toggleObjectLock = useSmartboardKonvaStore((s) => s.toggleObjectLock);
  const toggleObjectVisibility = useSmartboardKonvaStore((s) => s.toggleObjectVisibility);
  const groupSelected = useSmartboardKonvaStore((s) => s.groupSelected);
  const uniteSelected = useSmartboardKonvaStore((s) => s.uniteSelected);
  const addSection = useSmartboardKonvaStore((s) => s.addSection);
  const renameSection = useSmartboardKonvaStore((s) => s.renameSection);
  const deleteSection = useSmartboardKonvaStore((s) => s.deleteSection);
  const reorderSections = useSmartboardKonvaStore((s) => s.reorderSections);
  const setObjectSection = useSmartboardKonvaStore((s) => s.setObjectSection);
  const saveSceneInitialState = useSmartboardKonvaStore((s) => s.saveSceneInitialState);
  const resetSceneToInitialState = useSmartboardKonvaStore((s) => s.resetSceneToInitialState);
  const historyPast = useSmartboardKonvaStore((s) => s.historyPast);
  const historyTimestamps = useSmartboardKonvaStore((s) => s.historyTimestamps);
  const restoreHistorySnapshot = useSmartboardKonvaStore((s) => s.restoreHistorySnapshot);

  // ── Library ─────────────────────────────────────────────────────────────────
  const { useItemInDesigner: itemInDesigner } = useLibrary();

  const handleLibraryUse = useCallback((item) => {
    itemInDesigner(item, { addElement: addObject, addElements: addObjects, selectedIds });
  }, [itemInDesigner, addObject, addObjects, selectedIds]);

  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/liri-library');
    if (!raw) return;
    try {
      const { type, item } = JSON.parse(raw);
      if (type === 'library-item' && item) {
        handleLibraryUse(item);
      }
    } catch {}
  }, [handleLibraryUse]);

  const course = useCourseCopilotStore((s) => s.course);
  const activeSlideIndex = useCourseCopilotStore((s) => s.activeSlideIndex);
  const setActiveSlideIndex = useCourseCopilotStore((s) => s.setActiveSlideIndex);
  const nextSlide = useCourseCopilotStore((s) => s.nextSlide);
  const prevSlide = useCourseCopilotStore((s) => s.prevSlide);

  const { peers, members: collabMembers, sendCursor } = useSmartboardCollab({
    roomId: collabRoomId,
    enabled: collabEnabled,
  });

  useEffect(() => {
    if (typeof onCollabPresence !== 'function') return;
    onCollabPresence({ enabled: collabEnabled, members: collabMembers, roomId: collabRoomId });
  }, [onCollabPresence, collabEnabled, collabMembers, collabRoomId]);

  const courseSyncedRef = useRef(null);
  const skipEnsureNextCourseEffectRef = useRef(false);

  const [pedagogyQueue, setPedagogyQueue] = useState(/** @type {ReturnType<typeof readPedagogyHintsQueue>} */ (null));

  const refreshPedagogyQueue = useCallback(() => {
    setPedagogyQueue(readPedagogyHintsQueue());
  }, []);

  useEffect(() => {
    if (!initialKonvaProject || initialKonvaLoadedRef.current) return;
    try {
      loadProject(parseProjectJson(JSON.stringify(initialKonvaProject)));
      initialKonvaLoadedRef.current = true;
    } catch (e) {
      console.warn('[SmartboardKonvaEditorV1] initialKonvaProject load failed', e);
    }
  }, [initialKonvaProject, loadProject]);

  useEffect(() => {
    refreshPedagogyQueue();
    const onStorage = (e) => {
      if (e.key === LIRI_PEDAGOGY_HINTS_QUEUE_KEY || e.key === null) refreshPedagogyQueue();
    };
    window.addEventListener('storage', onStorage);
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshPedagogyQueue();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshPedagogyQueue]);

  const applyPedagogyFromQueue = useCallback(() => {
    const data = readPedagogyHintsQueue();
    if (!data?.hints?.length) return;
    const objs = buildKonvaObjectsFromPedagogyHints(data);
    if (objs.length) addObjects(objs);
    clearPedagogyHintsQueue();
    setPedagogyQueue(null);
  }, [addObjects]);

  const dismissPedagogyQueue = useCallback(() => {
    clearPedagogyHintsQueue();
    setPedagogyQueue(null);
  }, []);

  useEffect(() => {
    if (!course) {
      courseSyncedRef.current = null;
      return;
    }
    if (skipEnsureNextCourseEffectRef.current) {
      skipEnsureNextCourseEffectRef.current = false;
      courseSyncedRef.current = course;
      return;
    }
    if (course !== courseSyncedRef.current) {
      ensureScenesForSlides(course.slides, 0);
      courseSyncedRef.current = course;
    }
  }, [course, ensureScenesForSlides]);

  useEffect(() => {
    if (!course?.slides?.length) return;
    const { project } = useSmartboardKonvaStore.getState();
    const sid = project.scenes[activeSlideIndex]?.id;
    if (sid && sid !== project.activeSceneId) {
      setActiveScene(sid);
    }
  }, [activeSlideIndex, course?.slides?.length, setActiveScene]);

  // Reset spotlight quand on change de scene
  useEffect(() => {
    setActiveSection(null);
  }, [project.activeSceneId]);

  const activeScene = getActiveScene();
  const selectedId = selectedIds[0] || null;
  const selectedObj = activeScene?.objects?.find((o) => o.id === selectedId) || null;

  const textSelectedIds = useMemo(() => {
    const objs = activeScene?.objects || [];
    return selectedIds.filter((id) => objs.find((o) => o.id === id)?.type === 'text');
  }, [selectedIds, activeScene?.objects]);

  // ── Qualite slide + projet (Modules 2, 12, 14, 16, 17) ──────────────────
  const activeSceneQuality = useMemo(
    () => analyzeSlideQuality(activeScene, project.canvas),
    [activeScene, project.canvas],
  );

  const projectQuality = useMemo(
    () => analyzeProjectQuality(project),
    [project],
  );

  const interactionTool = useSmartboardKonvaStore((s) => s.interactionTool);
  const regionMarquee = useSmartboardKonvaStore((s) => s.regionMarquee);

  const getDesignerChatContext = useCallback(() => {
    const { centralIdea, activitySummary } = useDesignerCopilotPresenceStore.getState();
    return buildLongiaDesignerChatContext({
      project,
      activeScene,
      course,
      activeSlideIndex,
      selectedIds,
      centralIdea,
      activitySummary,
      interactionTool,
      regionMarquee,
    });
  }, [project, activeScene, course, activeSlideIndex, selectedIds, interactionTool, regionMarquee]);

  const handleApplyLongiaDesignerActions = useCallback(
    (actions) =>
      applyLongiaDesignerCanvasActions(actions, {
        addObject,
        pushHistory,
        setActiveSlideIndex,
        slideCount: course?.slides?.length ?? 0,
        deleteSelected,
        selectedIds,
        groupSelected,
        uniteSelected,
      }),
    [addObject, pushHistory, setActiveSlideIndex, course, deleteSelected, selectedIds, groupSelected, uniteSelected],
  );

  const totalDurationMinutes = useMemo(
    () => project.scenes.reduce((acc, s) => acc + (s.durationMinutes || 0), 0),
    [project.scenes],
  );

  // ── Module 3 : filtrage des objets selon le mode de vue ─────────────────
  const filteredObjects = useMemo(() => {
    const objs = activeScene?.objects || [];
    let result = objs;

    // Filtre visibilite selon le public
    if (viewMode === 'student') {
      result = result.filter((o) => !o.visibleFor || o.visibleFor === 'student' || o.visibleFor === 'both');
    } else if (viewMode === 'teacher') {
      result = result.filter((o) => !o.visibleFor || o.visibleFor === 'teacher' || o.visibleFor === 'both');
    } else if (viewMode === 'live') {
      result = result.filter((o) => !o.visibleFor || o.visibleFor === 'student' || o.visibleFor === 'both');
    }

    // Filtre progression (Module 13) : n'affiche que les objets dont step <= stepPreview
    if (stepPreview > 0) {
      result = result.filter((o) => !o.step || Number(o.step) <= stepPreview);
    }

    // Masquer les objets caches (hidden) sauf en mode design
    if (viewMode !== 'design') {
      result = result.filter((o) => !o.hidden);
    }

    return result;
  }, [activeScene?.objects, viewMode, stepPreview]);

  /** Calcule l'opacite Spotlight d'un objet selon la section active */
  const getSpotlightOpacity = useCallback((obj) => {
    if (!activeSection) return obj.opacity ?? 1;
    if (!obj.sectionId) return Math.min(obj.opacity ?? 1, 0.7);
    if (obj.sectionId === activeSection) return obj.opacity ?? 1;
    const scene = project.scenes.find((s) => s.id === project.activeSceneId);
    const sections = scene?.sections || [];
    const sectionOrder = sections.findIndex((s) => s.id === obj.sectionId);
    const activeOrder = sections.findIndex((s) => s.id === activeSection);
    if (sectionOrder < activeOrder) return Math.min(obj.opacity ?? 1, 0.3);
    return Math.min(obj.opacity ?? 1, 0.05);
  }, [activeSection, project]);

  /** filteredObjects avec opacite Spotlight appliquee */
  const spotlitObjects = useMemo(() => {
    if (!activeSection) return filteredObjects;
    return filteredObjects.map((obj) => ({
      ...obj,
      opacity: getSpotlightOpacity(obj),
    }));
  }, [filteredObjects, activeSection, getSpotlightOpacity]);

  // Nombre max d'etapes dans la scene (pour le curseur Module 13)
  const maxStep = useMemo(() => {
    const objs = activeScene?.objects || [];
    return objs.reduce((m, o) => Math.max(m, Number(o.step) || 0), 0);
  }, [activeScene?.objects]);

  const primaryTextObj = useMemo(() => {
    const objs = activeScene?.objects || [];
    for (const id of selectedIds) {
      const o = objs.find((x) => x.id === id);
      if (o?.type === 'text') return o;
    }
    return null;
  }, [selectedIds, activeScene?.objects]);

  const applyFontToSelectedTexts = useCallback(
    (partialStyle) => {
      const objs = activeScene?.objects || [];
      textSelectedIds.forEach((id) => {
        const o = objs.find((x) => x.id === id);
        if (!o || o.type !== 'text') return;
        updateObject(id, { style: { ...o.style, ...partialStyle } });
      });
    },
    [activeScene?.objects, textSelectedIds, updateObject],
  );

  const commitInlineText = useCallback(() => {
    if (!inlineTextId) return;
    const scene = getActiveScene();
    const o = scene?.objects?.find((x) => x.id === inlineTextId);
    if (o?.type === 'text') {
      pushHistory();
      updateObject(inlineTextId, { content: { ...o.content, text: inlineDraft } });
    }
    setInlineTextId(null);
    setInlineBox(null);
  }, [inlineTextId, inlineDraft, getActiveScene, pushHistory, updateObject]);

  useLayoutEffect(() => {
    if (!inlineTextId) {
      setInlineBox(null);
      return;
    }
    const scene = getActiveScene();
    const o = scene?.objects?.find((x) => x.id === inlineTextId);
    if (!o || o.type !== 'text') {
      setInlineTextId(null);
      return;
    }
    setInlineDraft(o.content?.text ?? '');
    const id = requestAnimationFrame(() => {
      const box = stageRef.current?.getTextScreenBox?.(inlineTextId);
      setInlineBox(box);
    });
    return () => cancelAnimationFrame(id);
  }, [inlineTextId, scale, activeScene?.objects, getActiveScene]);

  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      const s = computeSmartboardCanvasScale(width - 32, height - 32);
      setScale(Math.max(0.35, Math.min(s, 1.5)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onDownloadJson = useCallback(() => {
    const blob = new Blob([serializeProject(project)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `smartboard-konva-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [project]);

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        loadProject(parseProjectJson(String(r.result)));
      } catch {
        /* ignore */
      }
    };
    r.readAsText(f);
    e.target.value = '';
  };

  const onDownloadWorkspace = useCallback(() => {
    const payload = buildWorkspacePayloadFromStores();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `liri-workspace-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const onPickWorkspaceFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = parseWorkspaceImport(String(r.result));
        skipEnsureNextCourseEffectRef.current = true;
        hydrateWorkspaceIntoKonvaEditor(data);
      } catch {
        /* ignore */
      }
    };
    r.readAsText(f);
    e.target.value = '';
  };

  const onSaveLocalDraft = useCallback(() => {
    const payload = buildWorkspacePayloadFromStores();
    try {
      localStorage.setItem(LIRI_COURSE_WORKSPACE_LOCAL_KEY, JSON.stringify(payload));
    } catch {
      /* quota */
    }
  }, []);

  const onLoadLocalDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(LIRI_COURSE_WORKSPACE_LOCAL_KEY);
      if (!raw) return;
      const data = parseWorkspaceImport(raw);
      skipEnsureNextCourseEffectRef.current = true;
      hydrateWorkspaceIntoKonvaEditor(data);
    } catch {
      /* ignore */
    }
  }, []);

  const onPickImageUpload = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !f.type.startsWith('image/')) {
      if (f) setImageUploadHint('Choisissez un fichier image.');
      return;
    }
    setImageUploadBusy(true);
    setImageUploadHint('');
    try {
      const { url } = await uploadSmartboardCanvasImage(f);
      setImageUrlDraft(url);
      setImageUploadHint('Téléversé — URL mise à jour, cliquez « Ajouter » pour placer sur le canvas.');
    } catch (err) {
      setImageUploadHint(err instanceof Error ? err.message : String(err));
    } finally {
      setImageUploadBusy(false);
    }
  };

  const onExportPng = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Access the underlying Konva stage
    const konvaStage = stage._stage || stage;
    let dataUrl;
    try {
      // Try via getStage or direct stage ref
      const stageNode = typeof konvaStage.toDataURL === 'function'
        ? konvaStage
        : document.querySelector('canvas');
      if (stageNode && typeof stageNode.toDataURL === 'function') {
        dataUrl = stageNode.toDataURL('image/png');
      }
    } catch {
      // fallback: grab the canvas element from the DOM
      const canvas = document.querySelector('[class*="rounded-lg border border"][class*="bg-black"] canvas');
      if (canvas) dataUrl = canvas.toDataURL('image/png');
    }
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `smartboard-slide-${Date.now()}.png`;
    a.click();
  }, []);

  // ── Export PPTX (pptxgenjs + Konva toDataURL) ───────────────────────────
  const onExportPptx = useCallback(async () => {
    const pptxgen = (await import('pptxgenjs')).default;
    const prs = new pptxgen();
    prs.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches (16:9)
    const W = project.canvas?.width ?? SMARTBOARD_DESIGN_WIDTH;
    const H = project.canvas?.height ?? SMARTBOARD_DESIGN_HEIGHT;
    const stage = stageRef.current;
    const konvaStage = stage?._stage || stage;
    if (!konvaStage || typeof konvaStage.toDataURL !== 'function') return;

    for (let i = 0; i < project.scenes.length; i++) {
      useSmartboardKonvaStore.getState().setActiveScene(project.scenes[i].id);
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 80));
      const slide = prs.addSlide();
      try {
        const dataUrl = konvaStage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
        slide.addImage({ data: dataUrl, x: 0, y: 0, w: '100%', h: '100%' });
      } catch {
        slide.addText(project.scenes[i].name || 'Scene ' + (i + 1), {
          x: 1, y: 2.5, w: 11, h: 1, fontSize: 32, color: 'F7F2E8', align: 'center',
        });
      }
    }
    setActiveScene(project.activeSceneId);
    prs.writeFile({ fileName: 'smartboard-slides-' + Date.now() + '.pptx' });
  }, [project, stageRef, setActiveScene]);

  // ── Module 8 — Export PDF (jsPDF + Konva toDataURL) ─────────────────────
  const onExportPdf = useCallback(async () => {
    // Import dynamique pour ne pas alourdir le bundle initial
    const { jsPDF } = await import('jspdf');
    const W = project.canvas?.width ?? SMARTBOARD_DESIGN_WIDTH;
    const H = project.canvas?.height ?? SMARTBOARD_DESIGN_HEIGHT;
    // Orientation paysage, unites = px
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H], compress: true });

    const stage = stageRef.current;
    const konvaStage = stage?._stage || stage;
    if (!konvaStage || typeof konvaStage.toDataURL !== 'function') return;

    for (let i = 0; i < project.scenes.length; i++) {
      if (i > 0) pdf.addPage([W, H], 'landscape');
      // Activer la scene pour la capturer
      useSmartboardKonvaStore.getState().setActiveScene(project.scenes[i].id);
      // Attendre un frame pour que Konva re-render
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 80));
      try {
        const dataUrl = konvaStage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
        pdf.addImage(dataUrl, 'PNG', 0, 0, W, H, '', 'FAST');
      } catch {
        // Si la scene est vide, ajouter page blanche
      }
    }

    // Revenir a la scene active d'origine
    setActiveScene(project.activeSceneId);
    pdf.save('smartboard-slides-' + Date.now() + '.pdf');
  }, [project, stageRef, setActiveScene]);

  // ── Module 10 : Exports multi-formats ───────────────────────────────────
  const onExportScript = useCallback(() => {
    const lines = ['# Script enseignant\n'];
    project.scenes.forEach((s, i) => {
      lines.push(`## Scene ${i + 1} : ${s.name}${s.durationMinutes ? ' (' + s.durationMinutes + ' min)' : ''}\n`);
      const texts = s.objects.filter((o) => o.type === 'text');
      texts.forEach((o) => {
        const vis = o.visibleFor ? ' [' + o.visibleFor + ']' : '';
        const step = o.step ? ' (etape ' + o.step + ')' : '';
        lines.push('- ' + (o.content?.text || '').replace(/\n/g, ' ') + vis + step);
      });
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'script-enseignant-' + Date.now() + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [project]);

  const onExportStudentSheet = useCallback(() => {
    const lines = ['# Fiche eleve\n'];
    project.scenes.forEach((s, i) => {
      lines.push(`## Slide ${i + 1} : ${s.name}\n`);
      const texts = s.objects.filter(
        (o) => o.type === 'text' && (!o.visibleFor || o.visibleFor === 'student' || o.visibleFor === 'both'),
      );
      texts.forEach((o) => {
        const step = o.step ? ' [etape ' + o.step + ']' : '';
        lines.push('- ' + (o.content?.text || '').replace(/\n/g, ' ') + step);
      });
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fiche-eleve-' + Date.now() + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [project]);

  const onExportFlashcards = useCallback(() => {
    const cards = [];
    project.scenes.forEach((s) => {
      const texts = s.objects.filter((o) => o.type === 'text');
      texts.forEach((o) => {
        const text = (o.content?.text || '').trim();
        if (text.length > 5) {
          cards.push({ scene: s.name, content: text, step: o.step || 0, visibleFor: o.visibleFor || 'both' });
        }
      });
    });
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'flashcards-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [project]);

  // ── Module 15 : Tonalite pedagogique ────────────────────────────────────
  const applyTone = useCallback((tone) => {
    const scene = getActiveScene();
    if (!scene) return;
    pushHistory();
    const styleMap = {
      academique:  { fontFamily: 'Georgia, serif', fill: '#F7F2E8' },
      narratif:    { fontFamily: 'Georgia, serif', fill: '#fde68a', fontStyle: 'italic' },
      spirituel:   { fontFamily: 'Georgia, serif', fill: '#c4b5fd', letterSpacing: 1 },
      technique:   { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fill: '#7dd3fc' },
      emotionnel:  { fontFamily: 'Inter, system-ui, sans-serif', fill: '#fda4af', fontStyle: 'italic' },
    };
    const partial = styleMap[tone.id] || {};
    scene.objects.forEach((o) => {
      if (o.type === 'text') {
        updateObject(o.id, { style: { ...o.style, ...partial } });
      }
    });
  }, [getActiveScene, pushHistory, updateObject]);

  const generateNarrativeImage = useCallback(async () => {
    setLongiaImageBusy(true);
    const slideTitle = course?.slides?.[activeSlideIndex]?.title || activeScene?.name || 'Concept pedagogique';
    const slideIdea = course?.slides?.[activeSlideIndex]?.content?.mainIdea || longiaTopic || '';
    const prompt = 'Illustration narrative pedagogique: "' + slideTitle + '". ' + slideIdea + ' Style: metaphore visuelle symbolique, analogie naturelle (chenille-papillon, graine-arbre, eau-rocher), composition cinematographique, fond sombre bleu marine, accents dores, digital painting artisanal. Format paysage 16:9.';
    try {
      const { data } = await invokeGenerateVisualImage(supabase, { prompt, size: '1792x1024' });
      const url = data?.imageUrl || data?.url;
      if (url) {
        if (!data?.persisted) {
          pushLegacyLocalDesignerImage({ url, prompt, size: data?.size || '1792x1024' });
        }
        addObject(mkImageObject(url, { x: 80, y: 80, width: 480, height: 275, layer: 1 }));
      }
    } catch (err) {
      console.error('LONGIA image narrative error:', err);
    } finally {
      setLongiaImageBusy(false);
    }
  }, [course, activeSlideIndex, activeScene, longiaTopic, addObject]);

  const generatePedagogyGraph = useCallback(async () => {
    setLongiaGraphBusy(true);
    const slideTitle = course?.slides?.[activeSlideIndex]?.title || activeScene?.name || 'Schema pedagogique';
    const steps = course?.slides?.[activeSlideIndex]?.content?.keyPoints?.join(', ') || longiaTopic || '';
    const prompt = 'Graphique pedagogique structurel: "' + slideTitle + '". Etapes ou concepts: ' + steps + '. Style: diagramme vectoriel clair, fond sombre #0b0f1a, lignes et noeuds dores, fleches directionnelles, typographie lisible blanche, schema de flux ou cycle pedagogique. Pas de texte hors du diagramme. Format paysage 16:9.';
    try {
      const { data } = await invokeGenerateVisualImage(supabase, { prompt, size: '1792x1024' });
      const url = data?.imageUrl || data?.url;
      if (url) {
        if (!data?.persisted) {
          pushLegacyLocalDesignerImage({ url, prompt, size: data?.size || '1792x1024' });
        }
        addObject(mkImageObject(url, { x: 560, y: 80, width: 480, height: 275, layer: 1 }));
      }
    } catch (err) {
      console.error('LONGIA graph error:', err);
    } finally {
      setLongiaGraphBusy(false);
    }
  }, [course, activeSlideIndex, activeScene, longiaTopic, addObject]);

  /**
   * Apres generation LONGIA : place titre + sous-titre + zone contenu
   * sur la scene active en fonction du slide courant du parcours.
   */
  const applyLongiaCourseToCanvas = useCallback((resolvedCourse) => {
    const c = resolvedCourse || useCourseCopilotStore.getState().course;
    if (!c?.slides?.length) return;
    const idx = useCourseCopilotStore.getState().activeSlideIndex ?? 0;
    const slide = c.slides[idx];
    if (!slide) return;
    pushHistory();
    const W = SMARTBOARD_DESIGN_WIDTH;
    const H = SMARTBOARD_DESIGN_HEIGHT;
    const objects = [
      // Bande decorative haut
      mkRectObject({
        x: 0, y: 0, width: W, height: 6, layer: 0,
        style: { fill: '#D4AF37', stroke: '', strokeWidth: 0, cornerRadius: 0 },
      }),
      // Titre principal
      mkTextObject({
        x: 60, y: 40, width: W - 120, height: 80, layer: 2,
        style: { fontSize: 42, fontWeight: 700, fill: '#F7F2E8', align: 'left', lineHeight: 1.15 },
        content: { text: slide.title || 'Titre du slide', collapsible: false, sectionLabel: '' },
      }),
      // Sous-titre / objectif
      mkTextObject({
        x: 60, y: 130, width: W - 120, height: 48, layer: 2,
        style: { fontSize: 16, fontWeight: 400, fill: '#9098b8', align: 'left', fontStyle: 'italic', lineHeight: 1.3 },
        content: { text: slide.objective || slide.content?.subtitle || '', collapsible: false, sectionLabel: '' },
      }),
      // Corps principal
      mkTextObject({
        x: 60, y: 200, width: Math.round(W * 0.56), height: H - 260, layer: 2,
        style: { fontSize: 18, fontWeight: 400, fill: '#e0e4f0', align: 'left', lineHeight: 1.45 },
        content: {
          text: (slide.content?.mainText || slide.content?.blocks?.join('\n') || '').slice(0, 400),
          collapsible: false, sectionLabel: '',
        },
      }),
      // Zone visuelle droite (placeholder)
      mkRectObject({
        x: Math.round(W * 0.62), y: 200, width: Math.round(W * 0.32), height: H - 260, layer: 1,
        style: { fill: 'rgba(212,175,55,0.06)', stroke: 'rgba(212,175,55,0.22)', strokeWidth: 1, cornerRadius: 12 },
      }),
      // Numero slide
      mkTextObject({
        x: W - 80, y: H - 38, width: 60, height: 28, layer: 3,
        style: { fontSize: 11, fontWeight: 600, fill: '#D4AF37', align: 'right' },
        content: { text: String(idx + 1).padStart(2, '0') + ' / ' + String(c.slides.length).padStart(2, '0'), collapsible: false, sectionLabel: '' },
      }),
    ];
    addObjects(objects);
  }, [pushHistory, addObjects]);

  /**
   * Applique les blocs Konva de TOUTES les slides du cours —
   * une scene par slide, en creant les scenes manquantes au besoin.
   */
  const applyAllSlidesToCanvas = useCallback(async () => {
    const c = useCourseCopilotStore.getState().course;
    if (!c?.slides?.length) return;
    const W = SMARTBOARD_DESIGN_WIDTH;
    const H = SMARTBOARD_DESIGN_HEIGHT;
    // Creer / verifier les scenes
    ensureScenesForSlides(c.slides, 0);
    // Attendre un frame pour que le store se mette a jour
    await new Promise((r) => requestAnimationFrame(r));
    const { project: p } = useSmartboardKonvaStore.getState();
    c.slides.forEach((slide, idx) => {
      const scene = p.scenes[idx];
      if (!scene) return;
      // Passer sur la scene pour addObjects
      useSmartboardKonvaStore.getState().setActiveScene(scene.id);
      const { addObjects: ao, pushHistory: ph } = useSmartboardKonvaStore.getState();
      ph();
      ao([
        mkRectObject({ x: 0, y: 0, width: W, height: 6, layer: 0, style: { fill: '#D4AF37', stroke: '', strokeWidth: 0, cornerRadius: 0 } }),
        mkTextObject({
          x: 60, y: 40, width: W - 120, height: 80, layer: 2,
          style: { fontSize: 38, fontWeight: 700, fill: '#F7F2E8', align: 'left', lineHeight: 1.15 },
          content: { text: slide.title || 'Titre', collapsible: false, sectionLabel: '' },
        }),
        mkTextObject({
          x: 60, y: 128, width: W - 120, height: 44, layer: 2,
          style: { fontSize: 15, fontWeight: 400, fill: '#9098b8', align: 'left', fontStyle: 'italic', lineHeight: 1.3 },
          content: { text: slide.objective || slide.content?.subtitle || '', collapsible: false, sectionLabel: '' },
        }),
        mkTextObject({
          x: 60, y: 192, width: Math.round(W * 0.56), height: H - 250, layer: 2,
          style: { fontSize: 17, fontWeight: 400, fill: '#e0e4f0', align: 'left', lineHeight: 1.45 },
          content: { text: (slide.content?.mainText || slide.content?.blocks?.join('\n') || '').slice(0, 400), collapsible: false, sectionLabel: '' },
        }),
        mkRectObject({
          x: Math.round(W * 0.62), y: 192, width: Math.round(W * 0.32), height: H - 250, layer: 1,
          style: { fill: 'rgba(212,175,55,0.06)', stroke: 'rgba(212,175,55,0.22)', strokeWidth: 1, cornerRadius: 12 },
        }),
        mkTextObject({
          x: W - 80, y: H - 36, width: 60, height: 26, layer: 3,
          style: { fontSize: 10, fontWeight: 600, fill: '#D4AF37', align: 'right' },
          content: { text: String(idx + 1).padStart(2, '0') + ' / ' + String(c.slides.length).padStart(2, '0'), collapsible: false, sectionLabel: '' },
        }),
      ]);
    });
    // Revenir a la scene active
    const { project: p2 } = useSmartboardKonvaStore.getState();
    useSmartboardKonvaStore.getState().setActiveScene(p2.scenes[0]?.id || p2.activeSceneId);
    useCourseCopilotStore.getState().setActiveSlideIndex(0);
  }, [ensureScenesForSlides]);

  /**
   * Capture chaque scene Konva → upload Supabase Storage → patch
   * live_sessions.config.smartboard_slides pour diffuser en live.
   */
  const broadcastToLive = useCallback(async (sessionId) => {
    const sid = (sessionId || liveSessionId).trim();
    if (!sid) return;
    const stage = stageRef.current;
    const konvaStage = stage?._stage || stage;
    if (!konvaStage || typeof konvaStage.toDataURL !== 'function') {
      setLiveBroadcastStatus('Erreur : canvas non accessible.');
      return;
    }
    setLiveBroadcastBusy(true);
    setLiveBroadcastStatus('Capture des scenes...');
    const slides = [];
    const originSceneId = project.activeSceneId;
    try {
      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        useSmartboardKonvaStore.getState().setActiveScene(scene.id);
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => setTimeout(r, 90));
        setLiveBroadcastStatus('Scene ' + (i + 1) + '/' + project.scenes.length + ' — capture...');
        const dataUrl = konvaStage.toDataURL({ pixelRatio: 1.5, mimeType: 'image/png' });
        // dataUrl → Blob
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], 'scene-' + (i + 1) + '.png', { type: 'image/png' });
        setLiveBroadcastStatus('Scene ' + (i + 1) + '/' + project.scenes.length + ' — upload...');
        const { url } = await uploadSmartboardCanvasImage(file);
        slides.push({ url, label: scene.name || ('Scene ' + (i + 1)), kind: 'image' });
      }
      // Restaurer la scene active
      useSmartboardKonvaStore.getState().setActiveScene(originSceneId);
      // Patch live_sessions.config
      setLiveBroadcastStatus('Mise a jour de la session live...');
      const { data: row } = await supabase.from('live_sessions').select('config').eq('id', sid).maybeSingle();
      if (!row) throw new Error('Session introuvable : ' + sid);
      let cfg = {};
      try { cfg = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}); } catch { /**/ }
      const { error } = await supabase.from('live_sessions').update({
        config: { ...cfg, smartboard_slides: slides },
        updated_at: new Date().toISOString(),
      }).eq('id', sid);
      if (error) throw error;
      setLiveBroadcastStatus('Diffusion reussie — ' + slides.length + ' slide(s) envoyee(s).');
    } catch (err) {
      useSmartboardKonvaStore.getState().setActiveScene(originSceneId);
      setLiveBroadcastStatus('Erreur : ' + (err?.message || 'inconnue'));
    } finally {
      setLiveBroadcastBusy(false);
    }
  }, [liveSessionId, project, stageRef]);

  /**
   * Capture chaque scène → PNG → bucket SmartBoard → `formation_day_contents.data.renderSlideFrames`
   * pour le rendu FFmpeg split-screen (formateur | slide).
   */
  const captureScenesForVideoExport = useCallback(async () => {
    const cid = String(videoExportContentId || '').trim();
    if (!cid) return;
    const stage = stageRef.current;
    const konvaStage = stage?._stage || stage;
    if (!konvaStage || typeof konvaStage.toDataURL !== 'function') {
      setVideoExportStatus('Canvas inaccessible.');
      return;
    }
    if (!project?.scenes?.length) {
      setVideoExportStatus('Aucune scène à capturer.');
      return;
    }
    setVideoExportBusy(true);
    setVideoExportStatus('Capture…');
    const originSceneId = project.activeSceneId;
    const frames = [];
    try {
      for (let i = 0; i < project.scenes.length; i += 1) {
        const scene = project.scenes[i];
        useSmartboardKonvaStore.getState().setActiveScene(scene.id);
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => setTimeout(r, 90));
        setVideoExportStatus(`Slide ${i + 1}/${project.scenes.length}…`);
        const dataUrl = konvaStage.toDataURL({ pixelRatio: 2.5, mimeType: 'image/png' });
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `scene-${i + 1}.png`, { type: 'image/png' });
        const { url } = await uploadSmartboardCanvasImage(file);
        frames.push({
          slideIndex: i,
          url,
          label: scene.name || `Slide ${i + 1}`,
        });
      }
      await saveRenderSlideFramesToFormationContent(cid, frames);
      setVideoExportStatus(`${frames.length} slide(s) enregistré(s) pour l'export vidéo.`);
    } catch (err) {
      setVideoExportStatus(`Erreur : ${err?.message || 'inconnue'}`);
    } finally {
      useSmartboardKonvaStore.getState().setActiveScene(originSceneId);
      setVideoExportBusy(false);
    }
  }, [videoExportContentId, project]);

  // ── Raccourcis clavier globaux ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      // Ignorer si on tape dans un input/textarea/contenteditable
      const tag = document.activeElement?.tagName;
      const editable = document.activeElement?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Delete / Backspace — supprimer selection
      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        const { selectedIds: ids } = useSmartboardKonvaStore.getState();
        if (!ids.length) return;
        // Ne pas supprimer objets verrouilles
        const scene = useSmartboardKonvaStore.getState().getActiveScene();
        const anyLocked = ids.some((id) => scene?.objects?.find((o) => o.id === id)?.locked);
        if (anyLocked) return;
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Escape — quitter plein ecran ou deselectioner
      if (e.key === 'Escape') {
        setIsFullscreen((v) => { if (v) return false; selectOnly(null); return false; });
        return;
      }

      // Cmd/Ctrl + Z — undo
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Cmd/Ctrl + Shift + Z  ou Cmd/Ctrl + Y — redo
      if ((mod && e.shiftKey && e.key === 'z') || (mod && e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Cmd/Ctrl + C — copier
      if (mod && e.key === 'c') {
        const { selectedIds: ids } = useSmartboardKonvaStore.getState();
        if (!ids.length) return;
        const scene = useSmartboardKonvaStore.getState().getActiveScene();
        const objs = scene?.objects?.filter((o) => ids.includes(o.id)) || [];
        if (objs.length) {
          clipboardRef.current = structuredClone(objs);
        }
        return;
      }

      // Cmd/Ctrl + V — coller
      if (mod && e.key === 'v') {
        const copied = clipboardRef.current;
        if (!copied?.length) return;
        e.preventDefault();
        pushHistory();
        const offset = 20;
        const now = Date.now();
        const newObjs = copied.map((o, i) => ({
          ...structuredClone(o),
          id: `${o.type}_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          x: o.x + offset,
          y: o.y + offset,
        }));
        addObjects(newObjs);
        return;
      }

      // Cmd/Ctrl + D — dupliquer
      if (mod && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // Cmd/Ctrl + A — tout selectionner
      if (mod && e.key === 'a') {
        e.preventDefault();
        const scene = useSmartboardKonvaStore.getState().getActiveScene();
        const ids = (scene?.objects || [])
          .filter((o) => !o.locked)
          .map((o) => o.id);
        if (ids.length) {
          useSmartboardKonvaStore.setState({ selectedIds: ids });
        }
        return;
      }

      // F — plein ecran
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullscreen((v) => !v);
        return;
      }

      // Cmd/Ctrl + = ou + — zoom in
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setScale((s) => Math.min(12, Math.round((s + 0.1) * 10) / 10));
        return;
      }

      // Cmd/Ctrl + - — zoom out
      if (mod && e.key === '-') {
        e.preventDefault();
        setScale((s) => Math.max(0.2, Math.round((s - 0.1) * 10) / 10));
        return;
      }

      // Cmd/Ctrl + 1 — zoom centré sur la sélection
      if (mod && e.key === '1') {
        e.preventDefault();
        const scene = useSmartboardKonvaStore.getState().getActiveScene();
        const ids = useSmartboardKonvaStore.getState().selectedIds || [];
        const objs = scene?.objects?.filter((o) => ids.includes(o.id)) || [];
        if (!objs.length || !workspaceRef.current) return;
        const minX = Math.min(...objs.map((o) => o.x));
        const minY = Math.min(...objs.map((o) => o.y));
        const maxX = Math.max(...objs.map((o) => o.x + (o.width ?? 0)));
        const maxY = Math.max(...objs.map((o) => o.y + (o.height ?? 0)));
        const bw = Math.max(1, maxX - minX);
        const bh = Math.max(1, maxY - minY);
        const { width, height } = workspaceRef.current.getBoundingClientRect();
        const pad = 36;
        const fit = Math.min((width - pad) / bw, (height - pad) / bh);
        const nextScale = Math.max(0.2, Math.min(12, Math.round(fit * 10) / 10));
        setScale(nextScale);
        const cx = minX + bw / 2;
        const cy = minY + bh / 2;
        setCanvasPan({ x: width / 2 - cx * nextScale, y: height / 2 - cy * nextScale });
        return;
      }

      // Cmd/Ctrl + 0 — zoom reset auto-fit
      if (mod && e.key === '0') {
        e.preventDefault();
        if (workspaceRef.current) {
          const { width, height } = workspaceRef.current.getBoundingClientRect();
          const s = computeSmartboardCanvasScale(width - 32, height - 32);
          setScale(Math.max(0.35, Math.min(s, 1.5)));
          setCanvasPan({ x: 0, y: 0 });
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, deleteSelected, selectOnly, pushHistory, addObjects, duplicateSelected]);

  // ── Auto-save localStorage debounce 2s ──────────────────────────────────
  const autoSaveTimerRef = useRef(null);
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        const payload = buildWorkspacePayloadFromStores();
        localStorage.setItem(LIRI_COURSE_WORKSPACE_LOCAL_KEY, JSON.stringify(payload));
      } catch { /* quota */ }
    }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [project]);

  const runAiImprove = async (intent = 'balance') => {
    const exp = buildSceneExport(project);
    if (!exp) return;
    setAiBusy(true);
    setAiProvider(null);
    setAiSuggestions([]);
    try {
      const fn = improveSceneLayoutVariants[intent] || improveSceneLayout;
      const next = await fn(exp);
      setAiProvider(next._provider || null);
      setAiSuggestions(next._suggestions || []);
      // Nettoyer les champs internes avant de les passer au preview
      const { _provider, _suggestions, ...cleanNext } = next;
      setAiPreview(cleanNext);
    } finally {
      setAiBusy(false);
    }
  };

  const { width: cw, height: ch, background: cb } = project.canvas;

  const showLeftDesignerRail =
    !isFullscreen && (!hideChrome || embedDesignerLeftRail);
  const mainBodyGridCols = isFullscreen
    ? 'grid-cols-[minmax(0,1fr)]'
    : hideChrome && !embedDesignerLeftRail
      ? 'grid-cols-[minmax(0,1fr)]'
      : hideChrome && embedDesignerLeftRail
        ? 'grid-cols-[280px_minmax(0,1fr)]'
        : 'grid-cols-[280px_minmax(0,1fr)_340px]';
  const showDesignerBottomFilmstrip =
    !isFullscreen && (!hideChrome || embedDesignerLeftRail);
  const hideCanvasSceneBar = hideChrome && !embedDesignerLeftRail;

  return (
    <div
      ref={editorRef}
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden text-white',
        hideChrome ? 'bg-transparent' : 'bg-[#080a0f]',
        isFullscreen && 'fixed inset-0 z-[500]',
        className,
      )}
    >

      {/* Modale diffusion Live */}
      {liveModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !liveBroadcastBusy) setLiveModal(false); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#0c0f1c] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.8)]">
            <div className="mb-5 flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <h2 className="text-[15px] font-bold text-white">Diffuser en Live</h2>
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-white/50">
              Les scenes Konva seront capturees, uploadees et injectees dans la session LiveHostPage selectionnee.
            </p>
            <label className="block text-[12px] font-semibold text-white/60">ID de session live</label>
            <input
              type="text"
              value={liveSessionId}
              onChange={(e) => setLiveSessionId(e.target.value)}
              placeholder="ex: 8f3a2c1d-..."
              disabled={liveBroadcastBusy}
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5 text-[14px] text-white placeholder:text-white/25 focus:border-red-400/50 focus:outline-none disabled:opacity-50"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && liveSessionId.trim() && !liveBroadcastBusy) broadcastToLive(); }}
            />
            <p className="mt-1 text-[11px] text-white/30">Copiez cet ID depuis l&apos;URL de votre session LiveHostPage.</p>
            {liveBroadcastStatus && (
              <p className={cn(
                'mt-3 rounded-xl border px-3 py-2 text-[12px]',
                liveBroadcastStatus.startsWith('Erreur')
                  ? 'border-red-500/30 bg-red-950/30 text-red-300'
                  : liveBroadcastStatus.startsWith('Diffusion reussie')
                    ? 'border-green-500/30 bg-green-950/30 text-green-300'
                    : 'border-white/10 bg-white/[0.04] text-white/60',
              )}>
                {liveBroadcastBusy && <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />}
                {liveBroadcastStatus}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => { if (!liveBroadcastBusy) setLiveModal(false); }}
                disabled={liveBroadcastBusy}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-[12px] text-white/60 hover:bg-white/[0.05] disabled:opacity-40"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={!liveSessionId.trim() || liveBroadcastBusy}
                onClick={() => broadcastToLive()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-500/35 bg-red-950/40 py-2.5 text-[12px] font-semibold text-red-200 hover:bg-red-900/50 disabled:opacity-40"
              >
                {liveBroadcastBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-red-400" />}
                {liveBroadcastBusy ? 'Diffusion...' : 'Diffuser (' + project.scenes.length + ' scenes)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      {!hideChrome && <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[color-mix(in_srgb,var(--school-accent)_14%,transparent)] bg-[#09090f] px-3 shadow-[inset_0_-1px_0_rgba(212,175,55,0.07)]">
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] px-2.5 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--school-accent)]" />
            <LiriWordmark size="compact" className="text-[#e8c76b]" />
          </div>
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30 sm:inline">SMARTBOARD DESIGNER</span>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-0.5">
          {[
            { id: 'edition',      icon: PenLine,   label: 'Edition' },
            { id: 'masterscript', icon: ScrollText, label: 'MasterScript' },
            { id: 'mindmap',      icon: Map,        label: 'Mindmap' },
            { id: 'progression',  icon: GitBranch,  label: 'Progression' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTopMode(id);
                if (id === 'masterscript') setRightTab('masterscript');
                else if (id === 'mindmap') setRightTab('coach');
                else if (id === 'progression') { setRightTab('props'); setStepPreview(0); }
                else setRightTab('coach');
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all',
                topMode === id
                  ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[#f5dd8a] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.28)]'
                  : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => { setLiveModal(true); setLiveBroadcastStatus(''); }}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-950/30 px-2.5 py-1.5 text-[12px] font-semibold text-red-300 transition-all hover:bg-red-900/40"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Live
          </button>
          <button type="button" onClick={() => undo()}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/60 hover:bg-white/10"
            title="Annuler"
          ><Undo2 className="h-3 w-3" /></button>
          <button type="button" onClick={() => redo()}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/60 hover:bg-white/10"
            title="Retablir"
          ><Redo2 className="h-3 w-3" /></button>
          <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-black/30 text-[11px] text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.2, Math.round((s - 0.1) * 10) / 10))}
              className="flex h-7 w-6 items-center justify-center rounded-l-md hover:bg-white/10 hover:text-white"
              title="Zoom -  (Cmd -)"
            >−</button>
            <span className="flex min-w-[38px] items-center justify-center gap-1 px-1">
              <ZoomIn className="h-3 w-3" />
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2, Math.round((s + 0.1) * 10) / 10))}
              className="flex h-7 w-6 items-center justify-center rounded-r-md hover:bg-white/10 hover:text-white"
              title="Zoom +  (Cmd +)"
            >+</button>
          </div>
          {/* Quick props based on leftTool */}
          {leftTool === 'texte' && (
            <div className="hidden items-center gap-1 lg:flex">
              {['Police', 'Taille', 'Gras', 'Couleur', 'Preset IA'].map((p) => (
                <span key={p} className="rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-[11px] text-white/50">{p}</span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? 'Quitter plein ecran (F)' : 'Plein ecran (F)'}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/60 hover:bg-white/10"
          >
            {isFullscreen
              ? <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M5.5 0v5.5H0v1h6.5V0h-1zm5 0v1H16V0h-5.5zm0 16h1v-5.5H16v-1H10.5V16zM0 10.5v1h5.5V16h1v-6.5H0z"/></svg>
              : <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M1.5 1h4V0H0v5.5h1V1.5zm9-1v1h4v4h1V0H10.5zm4 14.5h-4v1H16V10.5h-1v4zM0 10.5V16h5.5v-1h-4v-4H0z"/></svg>
            }
          </button>
          {course ? (
            <span className="hidden rounded-md border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[#1a1510]/80 px-2 py-0.5 text-[11px] text-[#f5dd8a] lg:inline">
              {course.slides.length} slides
            </span>
          ) : null}
        </div>
      </header>}

      {/* Project Dashboard */}
      {!hideChrome && <ProjectDashboardBar
        projectQuality={projectQuality}
        totalDurationMinutes={totalDurationMinutes}
      />}

      {/* Pedagogy queue */}
      {!hideChrome && pedagogyQueue?.hints?.length ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-violet-500/25 bg-violet-950/35 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Mic className="h-4 w-4 shrink-0 text-violet-300" />
            <p className="text-[13px] leading-snug text-violet-100/95">
              <span className="font-semibold">Suggestions vocales</span>{' — '}inserer des blocs sur la scene active.
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button type="button" onClick={applyPedagogyFromQueue}
              className="rounded-lg border border-violet-400/40 bg-violet-600/40 px-3 py-1 text-[12px] font-medium text-white hover:bg-violet-500/50">
              Inserer
            </button>
            <button type="button" onClick={dismissPedagogyQueue}
              className="rounded-lg border border-white/15 px-2 py-1 text-[12px] text-white/60 hover:bg-white/10">
              Ignorer
            </button>
          </div>
        </div>
      ) : null}

      {/* Course banner */}
      {!hideChrome && course ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-gradient-to-r from-[#0a0f18]/95 to-[#080c14]/95 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7d89b0]">Parcours actif</p>
            <p className="truncate text-[14px] font-semibold text-white">{course.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[12px] text-white/75">
              {course.analysis.estimatedDurationMinutes} min
            </span>
            <span className="rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[#1a1510] px-2.5 py-1 text-[12px] font-medium text-[#f5dd8a]">
              {course.slides.length} slides
            </span>
            <span className="rounded-lg border border-teal-500/20 bg-teal-950/30 px-2.5 py-1 text-[11px] uppercase tracking-wide text-teal-200/90">
              {course.analysis.complexity}
            </span>
          </div>
        </div>
      ) : null}

      {/* Text formatting toolbar */}
      {!hideChrome && !isFullscreen && <div className="flex min-h-[44px] shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[#0d0f18] px-3 py-2">
        {textSelectedIds.length > 0 ? (
          <>
            <label className="flex items-center gap-1 text-[12px] text-white/50">
              <input
                type="text"
                value={
                  textSelectedIds.length === 1
                    ? (activeScene?.objects?.find((o) => o.id === textSelectedIds[0])?.content?.text ?? '')
                    : '(' + textSelectedIds.length + ' blocs)'
                }
                onChange={(e) => {
                  if (textSelectedIds.length !== 1) return;
                  const id = textSelectedIds[0];
                  const o = activeScene?.objects?.find((x) => x.id === id);
                  if (!o) return;
                  updateObject(id, { content: { ...o.content, text: e.target.value } });
                }}
                disabled={textSelectedIds.length !== 1}
                className="h-7 w-44 rounded-lg border border-white/12 bg-black/40 px-2 text-xs text-white disabled:opacity-50"
              />
            </label>
            <label className="flex items-center gap-1 text-[12px] text-white/50">
              <select
                value={
                  FONT_OPTIONS.some((f) => f.value === primaryTextObj?.style?.fontFamily)
                    ? primaryTextObj?.style?.fontFamily
                    : FONT_OPTIONS[0].value
                }
                onChange={(e) => applyFontToSelectedTexts({ fontFamily: e.target.value })}
                className="h-7 max-w-[120px] rounded-lg border border-white/12 bg-black/40 px-1 text-[12px] text-white"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-[12px] text-white/50">
              <input
                type="number"
                min={8}
                max={120}
                value={Number(primaryTextObj?.style?.fontSize ?? 24)}
                onChange={(e) => applyFontToSelectedTexts({ fontSize: Number(e.target.value) || 24 })}
                className="h-7 w-12 rounded-lg border border-white/12 bg-black/40 px-1 text-xs"
              />
            </label>
            <input
              type="color"
              value={typeof primaryTextObj?.style?.fill === 'string' ? primaryTextObj.style.fill : '#F7F2E8'}
              onChange={(e) => applyFontToSelectedTexts({ fill: e.target.value })}
              className="h-7 w-9 cursor-pointer rounded border border-white/12 bg-transparent"
            />
            {textSelectedIds.length > 1 ? (
              <span className="text-[11px] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">{textSelectedIds.length} textes</span>
            ) : null}
          </>
        ) : (
          <span className="text-[12px] text-white/30">Selectionnez un bloc texte pour le modifier</span>
        )}
        <label className="ml-auto flex cursor-pointer items-center gap-1 text-[11px] text-white/40">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
            className="rounded border-white/20 bg-black/40"
          />
          Snap 8px
        </label>
        <span className="text-[11px] text-white/25">Hors cadre = suppr · molette = apercu</span>
      </div>}

      {/* Main body — grille (masque panneaux en fullscreen ; hideChrome seul = canvas seul ; +embedDesignerLeftRail = rail gauche) */}
      <div className={cn(
        'grid min-h-0 min-w-0 flex-1 gap-0',
        mainBodyGridCols,
      )}>

        {/* Col 1 — Sidebar gauche unifiee (280px) */}
        {!showLeftDesignerRail ? null : (
          <div className="flex min-h-0 min-w-0 flex-col border-r border-white/[0.07] bg-[#0c0e18]">
            {/* Toggle tabs Outils / Proprietes */}
            <div className="flex shrink-0 border-b border-white/[0.07]">
              <button
                type="button"
                onClick={() => setLeftTool('templates')}
                className={cn(
                  'flex flex-1 items-center justify-center py-2.5 text-[12px] font-medium transition-colors',
                  leftTool !== 'properties'
                    ? 'border-b-2 border-[var(--school-accent)] text-[#f5dd8a]'
                    : 'border-b-2 border-transparent text-white/40 hover:text-white/70',
                )}
              >
                Outils
              </button>
              <button
                type="button"
                onClick={() => setLeftTool('properties')}
                className={cn(
                  'flex flex-1 items-center justify-center py-2.5 text-[12px] font-medium transition-colors',
                  leftTool === 'properties'
                    ? 'border-b-2 border-[var(--school-accent)] text-[#f5dd8a]'
                    : 'border-b-2 border-transparent text-white/40 hover:text-white/70',
                )}
              >
                Proprietes
              </button>
            </div>

            {/* Tools list — full-width buttons */}
            {leftTool !== 'properties' && (
              <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 [scrollbar-width:thin]">
                {[
                  { t: 'templates',    Icon: Sparkles,    label: 'Modeles' },
                  { t: 'texte',        Icon: Type,        label: 'Texte' },
                  { t: 'elements',     Icon: Square,      label: 'Formes' },
                  { t: 'icones',       Icon: Star,        label: 'Icones' },
                  { t: 'blocs',        Icon: BookOpen,    label: 'Blocs pedagogiques' },
                  { t: 'fonds',        Icon: Layers,      label: 'Fonds' },
                  { t: 'theme',        Icon: Palette,     label: 'Theme' },
                  { t: 'bibliotheque', Icon: BookMarked,  label: 'Bibliothèque' },
                  { t: 'fichier',      Icon: FolderOpen,  label: 'Import / Export' },
                ].map(({ t, Icon, label }) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLeftTool(t)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-all',
                      leftTool === t
                        ? 'border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[#f5dd8a]'
                        : 'border-white/[0.07] bg-white/[0.025] text-white/60 hover:bg-white/[0.05] hover:text-white/80',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                ))}
                {/* Sub-panel for selected tool */}
                {/* Bibliothèque communautaire */}
                {leftTool === 'bibliotheque' && (
                  <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-xl border border-white/[0.07]">
                    <LibraryPanel
                      className="h-full"
                      onUseItem={handleLibraryUse}
                    />
                  </div>
                )}

                {['templates','texte','elements','icones','blocs','fonds','theme','fichier'].includes(leftTool) && (
                  <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-xl border border-white/[0.07]">
                    <CanvaDesignPanel
                      activeTab={leftTool}
                      onTabChange={setLeftTool}
                      addObject={addObject}
                      addObjects={addObjects}
                      setCanvasBackground={setCanvasBackground}
                      applyGlobalTheme={applyGlobalTheme}
                      onDownloadJson={onDownloadJson}
                      onPickFile={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const r = new FileReader();
                        r.onload = () => { try { loadProject(parseProjectJson(String(r.result))); } catch {} };
                        r.readAsText(f);
                        e.target.value = '';
                      }}
                      onDownloadWorkspace={onDownloadWorkspace}
                      onPickWorkspaceFile={onPickWorkspaceFile}
                      onSaveLocalDraft={onSaveLocalDraft}
                      onLoadLocalDraft={onLoadLocalDraft}
                      onPickImageUpload={onPickImageUpload}
                      imageUploadBusy={imageUploadBusy}
                      imageUploadHint={imageUploadHint}
                      imageUrlDraft={imageUrlDraft}
                      setImageUrlDraft={setImageUrlDraft}
                      onExportPdf={onExportPdf}
                      onExportPptx={onExportPptx}
                      onExportScript={onExportScript}
                      onExportStudentSheet={onExportStudentSheet}
                      onExportFlashcards={onExportFlashcards}
                      applyTone={applyTone}
                      cloudSection={
                        <CourseWorkspaceCloudSection
                          cloudBootstrap={cloudBootstrap}
                          onCloudBootstrapConsumed={onCloudBootstrapConsumed}
                          onWorkspaceLoaded={(data) => {
                            skipEnsureNextCourseEffectRef.current = true;
                            hydrateWorkspaceIntoKonvaEditor(data);
                          }}
                        />
                      }
                      className="min-h-0 flex-1 overflow-hidden"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Properties tab — show CanvaPropertiesPanel for selected object */}
            {leftTool === 'properties' && (
              <CanvaPropertiesPanel
                selectedObj={selectedObj}
                selectedIds={selectedIds}
                objects={activeScene?.objects || []}
                canvasWidth={cw}
                canvasHeight={ch}
                updateObject={updateObject}
                alignSelected={alignSelected}
                bringForward={bringForward}
                sendBackward={sendBackward}
                bringToFront={bringToFront}
                sendToBack={sendToBack}
                deleteSelected={deleteSelected}
                setObjectOpacity={setObjectOpacity}
                onExportPng={onExportPng}
                className="min-h-0 flex-1 overflow-y-auto"
              />
            )}
          </div>
        )}

        {/* Col 3 — Canvas central */}
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col bg-transparent',
            hideChrome && videoExportContentId && 'relative',
          )}
        >
          {hideChrome && videoExportContentId ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end p-2">
              <div className="pointer-events-auto flex max-w-[min(100%,440px)] flex-col items-end gap-1 rounded-xl border border-amber-500/35 bg-black/80 px-2.5 py-2 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Film className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span className="text-[11px] font-medium text-white/90">Export vidéo (split)</span>
                </div>
                <p className="max-w-[380px] text-right text-[10px] leading-snug text-white/45">
                  Capture chaque scène en PNG pour le montage serveur (formateur + slide, jusqu'en 4K).
                </p>
                <button
                  type="button"
                  disabled={videoExportBusy || !project?.scenes?.length}
                  onClick={() => void captureScenesForVideoExport()}
                  className="flex items-center gap-2 rounded-lg bg-amber-500/90 px-3 py-1.5 text-[11px] font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {videoExportBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
                  {videoExportBusy ? 'Capture…' : 'Capturer les slides pour l\'export'}
                </button>
                {videoExportStatus ? (
                  <p className="max-w-[380px] text-right text-[10px] text-white/55">{videoExportStatus}</p>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className={cn('flex h-9 shrink-0 items-center justify-between gap-2 border-b border-black/35 bg-[#222] px-3', hideCanvasSceneBar && 'hidden')}>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Ecran central</p>
              {course?.slides?.[activeSlideIndex] ? (
                <p className="truncate text-[13px] font-medium text-white/85">
                  {String(activeSlideIndex + 1).padStart(2, '0') + ' — ' + course.slides[activeSlideIndex].title}
                </p>
              ) : renamingHeaderScene ? (
                <input
                  autoFocus
                  value={renamingHeaderDraft}
                  onChange={(e) => setRenamingHeaderDraft(e.target.value)}
                  onBlur={() => { if (activeScene) renameScene(activeScene.id, renamingHeaderDraft.trim() || activeScene.name); setRenamingHeaderScene(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { if (activeScene) renameScene(activeScene.id, renamingHeaderDraft.trim() || activeScene.name); setRenamingHeaderScene(false); }
                    if (e.key === 'Escape') setRenamingHeaderScene(false);
                  }}
                  className="h-5 w-40 rounded border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-black/50 px-1.5 text-[13px] text-[#f5dd8a] outline-none"
                />
              ) : (
                <p
                  onDoubleClick={() => { setRenamingHeaderDraft(activeScene?.name || ''); setRenamingHeaderScene(true); }}
                  title="Double-clic pour renommer la scene"
                  className="truncate cursor-default text-[13px] font-medium text-white/85 hover:text-white/95"
                >
                  {'Scene Konva · ' + (activeScene?.name || '—')}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {[
                { id: 'design',  icon: Layers,       label: 'Design',  title: 'Vue design' },
                { id: 'student', icon: GraduationCap, label: 'Eleve',  title: 'Vue eleve' },
                { id: 'teacher', icon: BookOpen,      label: 'Prof',   title: 'Vue professeur' },
                { id: 'live',    icon: Monitor,       label: 'Live',   title: 'Vue live' },
              ].map(({ id, icon: Icon, label, title }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewMode(id)}
                  title={title}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] transition-colors',
                    viewMode === id
                      ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[#f5dd8a]'
                      : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
              {maxStep > 0 && (
                <div className="ml-1 flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-1">
                  <Eye className="h-3 w-3 text-violet-400" />
                  <input
                    type="range"
                    min={0}
                    max={maxStep}
                    value={stepPreview}
                    onChange={(e) => setStepPreview(Number(e.target.value))}
                    className="h-1 w-14 accent-violet-500"
                    title={'Etape ' + stepPreview + '/' + maxStep}
                  />
                  <span className="text-[11px] text-violet-300">{stepPreview}/{maxStep}</span>
                </div>
              )}
              <span className="ml-1 hidden font-mono text-[11px] text-white/40 sm:inline">{cw}x{ch}</span>
              <span className="rounded border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] text-[color-mix(in_srgb,var(--school-accent)_85%,transparent)]">
                {Math.round(scale * 100)}%
              </span>
            </div>
          </div>

          {/* Fil d'Ariane pedagogique */}
          {!hideChrome && (course || activeScene?.sections?.length > 0) && (
            <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.05] bg-[#0a0c16] px-4 py-1.5 text-[11px] text-white/40">
              {course && <span className="text-white/60">{course.slides?.[activeSlideIndex]?.chapter || 'Cours'}</span>}
              {course && <span>/</span>}
              {course && <span>{course.slides?.[activeSlideIndex]?.title || ''}</span>}
              {activeScene?.sections?.length > 0 && <span>/</span>}
              {activeSection && (
                <span className="text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]">
                  {activeScene?.sections?.find(s => s.id === activeSection)?.label || ''}
                </span>
              )}
            </div>
          )}

          {topMode === 'progression' ? (
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#080a12] p-5 [scrollbar-width:thin]">
              <p className="mb-1 text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]">Progression — {activeScene?.name || 'Scene'}</p>
              <p className="mb-5 text-center text-[11px] text-white/30">
                {maxStep === 0 ? 'Aucune etape definie. Assignez un numero "Etape" aux blocs dans Proprietes.' : maxStep + ' etape(s) de revelation'}
              </p>
              {/* Steps timeline */}
              <div className="mx-auto max-w-2xl space-y-3">
                {Array.from({ length: maxStep + 1 }, (_, stepN) => {
                  const objs = (activeScene?.objects || []).filter((o) =>
                    stepN === 0 ? (!o.step || Number(o.step) === 0) : Number(o.step) === stepN,
                  );
                  const isCurrentStep = stepN === stepPreview;
                  return (
                    <button
                      key={stepN}
                      type="button"
                      onClick={() => setStepPreview(stepN)}
                      className={cn(
                        'w-full rounded-2xl border p-3 text-left transition-all',
                        isCurrentStep
                          ? 'border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-[#1a1510]/80 shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15',
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-lg text-[12px] font-bold',
                          isCurrentStep ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[#f5dd8a]' : 'bg-white/[0.06] text-white/40',
                        )}>
                          {stepN === 0 ? 'B' : stepN}
                        </span>
                        <span className={cn('text-[13px] font-semibold', isCurrentStep ? 'text-[#f5dd8a]' : 'text-white/55')}>
                          {stepN === 0 ? 'Base (toujours visible)' : 'Etape ' + stepN}
                        </span>
                        <span className="ml-auto rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-white/35">
                          {objs.length} bloc(s)
                        </span>
                        {isCurrentStep && <Eye className="h-3.5 w-3.5 text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]" />}
                      </div>
                      {objs.length > 0 ? (
                        <ul className="space-y-1 pl-8">
                          {objs.slice(0, 4).map((o) => (
                            <li key={o.id} className="flex items-center gap-1.5">
                              <span className={cn(
                                'shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase',
                                o.type === 'text' ? 'bg-blue-900/40 text-blue-300' : o.type === 'image' ? 'bg-teal-900/40 text-teal-300' : 'bg-violet-900/40 text-violet-300',
                              )}>
                                {o.type}
                              </span>
                              <span className="truncate text-[11px] text-white/50">
                                {o.type === 'text' ? (o.content?.text || '').slice(0, 60) : (o.content?.src ? 'Image' : 'Forme')}
                              </span>
                            </li>
                          ))}
                          {objs.length > 4 && <li className="text-[11px] text-white/25">+{objs.length - 4} de plus...</li>}
                        </ul>
                      ) : (
                        <p className="pl-8 text-[11px] text-white/25 italic">Aucun bloc a cette etape</p>
                      )}
                    </button>
                  );
                })}
              </div>
              {maxStep === 0 && (
                <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-dashed border-white/12 p-5 text-center">
                  <Eye className="mx-auto mb-2 h-8 w-8 text-white/15" />
                  <p className="text-[12px] text-white/35">Selectionnez un bloc dans le mode Edition, puis dans Proprietes assignez-lui un numero d&apos;etape (1, 2, 3...) pour creer une revelation progressive.</p>
                </div>
              )}
            </div>
          ) : topMode === 'mindmap' && course?.slides?.length ? (
            <div className="relative min-h-0 flex-1 overflow-auto bg-[#080a12] p-6">
              <p className="mb-4 text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]">Mindmap — {course.title}</p>
              <svg
                width="100%"
                viewBox={'0 0 ' + Math.max(900, course.slides.length * 160) + ' 340'}
                className="mx-auto"
                style={{ maxWidth: '100%' }}
              >
                {/* Root node */}
                <ellipse cx="60" cy="170" rx="54" ry="26" fill="#1a1510" stroke="#D4AF37" strokeWidth="1.5" />
                <text x="60" y="174" textAnchor="middle" fontSize="9" fill="#f5dd8a" fontFamily="Inter,system-ui,sans-serif" fontWeight="700">
                  {(course.title || 'Cours').slice(0, 14)}
                </text>
                {course.slides.map((slide, i) => {
                  const total = course.slides.length;
                  const spread = Math.max(900, total * 160);
                  const nodeX = 180 + (i / Math.max(total - 1, 1)) * (spread - 240);
                  const nodeY = 80 + (i % 2) * 180;
                  const lineX1 = 114;
                  const lineY1 = 170;
                  const isActive = i === activeSlideIndex;
                  return (
                    <g key={slide.id} style={{ cursor: 'pointer' }} onClick={() => setActiveSlideIndex(i)}>
                      <line x1={lineX1} y1={lineY1} x2={nodeX} y2={nodeY + 20} stroke={isActive ? '#D4AF37' : '#3a3a5a'} strokeWidth={isActive ? 1.5 : 1} strokeDasharray={isActive ? undefined : '4 3'} />
                      <rect x={nodeX - 68} y={nodeY} width="136" height="40" rx="8" fill={isActive ? '#1a1420' : '#0d1020'} stroke={isActive ? '#D4AF37' : '#2a2f50'} strokeWidth={isActive ? 1.5 : 1} />
                      <text x={nodeX} y={nodeY + 13} textAnchor="middle" fontSize="8" fill={isActive ? '#f5dd8a' : '#7d89b0'} fontFamily="Inter,system-ui,sans-serif" fontWeight="600">
                        {String(i + 1).padStart(2, '0')}
                      </text>
                      <text x={nodeX} y={nodeY + 27} textAnchor="middle" fontSize="9" fill={isActive ? '#e8e8e8' : '#9098b8'} fontFamily="Inter,system-ui,sans-serif">
                        {slide.title.slice(0, 18)}{slide.title.length > 18 ? '...' : ''}
                      </text>
                    </g>
                  );
                })}
              </svg>
              {!course && (
                <p className="mt-8 text-center text-[13px] text-white/30">
                  Importez un parcours depuis l'Agent IA pour afficher la mindmap.
                </p>
              )}
            </div>
          ) : (
          <div
            ref={workspaceRef}
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={handleCanvasDrop}
            onMouseMove={collabEnabled ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              sendCursor(Math.round(e.clientX - rect.left), Math.round(e.clientY - rect.top), project.activeSceneId);
            } : undefined}
            onWheel={(e) => {
              if (!e.ctrlKey && !e.metaKey) return;
              e.preventDefault();
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              setScale((s) => Math.max(0.2, Math.min(12, Math.round((s + delta) * 10) / 10)));
            }}
            style={{ background: 'transparent' }}
          >
            <div
              ref={containerRef}
              className="relative flex max-h-full max-w-full items-center justify-center overflow-visible bg-transparent"
              style={{ transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)` }}
            >
              {/* Bouton quitter plein ecran */}
              {isFullscreen && (
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="absolute right-3 top-3 z-50 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/70 px-2.5 py-1.5 text-[12px] text-white/80 backdrop-blur-sm hover:bg-black/90"
                  title="Quitter le plein ecran (F ou Echap)"
                >
                  <X className="h-3 w-3" />
                  Quitter
                </button>
              )}
              {/* Curseurs pairs collab */}
              {collabEnabled && Object.entries(peers).filter(([, p]) => p.sceneId === project.activeSceneId).map(([uid, p]) => (
                <div
                  key={uid}
                  className="pointer-events-none absolute z-50"
                  style={{ left: p.x, top: p.y, transform: 'translate(-2px,-2px)' }}
                >
                  <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                    <path d="M0 0L0 16L4.5 11.5L7 18L9 17L6.5 10.5L13 10.5Z" fill={p.color} stroke="#000" strokeWidth="0.5" />
                  </svg>
                  <span className="absolute left-4 top-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-md" style={{ background: p.color }}>
                    {p.name}
                  </span>
                </div>
              ))}

              {viewMode !== 'design' && (
                <div className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-1.5 rounded-t-sm py-1 text-[11px] font-semibold uppercase tracking-widest',
                  viewMode === 'student' ? 'bg-blue-600/80 text-blue-100' :
                  viewMode === 'teacher' ? 'bg-amber-600/80 text-amber-100' :
                  'bg-green-700/80 text-green-100',
                )}>
                  <Eye className="h-3 w-3" />
                  {viewMode === 'student' ? 'Apercu eleve' : viewMode === 'teacher' ? 'Apercu professeur' : 'Apercu live'}
                  {' — '}{filteredObjects.length}/{activeScene?.objects?.length || 0} objets
                  {stepPreview > 0 ? ' · etape ' + stepPreview : ''}
                </div>
              )}
              {activeSection && (
                <div className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] px-3 py-1 text-[11px] text-[#f5dd8a] shadow-lg backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--school-accent)]" />
                  Spotlight — {activeScene?.sections?.find(s => s.id === activeSection)?.label || 'Section'}
                  <button type="button" onClick={() => setActiveSection(null)} className="ml-1 text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] hover:text-[var(--school-accent)]">x</button>
                </div>
              )}
              <KonvaBoardStage
                ref={stageRef}
                width={cw}
                height={ch}
                scale={scale}
                background={cb}
                objects={spotlitObjects}
                selectedIds={viewMode === 'design' ? selectedIds : []}
                selectOnly={selectOnly}
                toggleSelect={toggleSelect}
                pushHistory={pushHistory}
                updateObjectTransform={updateObjectTransform}
                snapGrid={snapToGrid ? 8 : 0}
                onTextDblClick={(id) => setInlineTextId(id)}
                onDeleteObject={deleteObjectById}
                onObjectMiddleClick={(obj) => setAssetPreview({ kind: obj.type, obj })}
              />
            </div>
          </div>
          )}
        </div>

        {/* Col 4 — LONGIA Guide IA (320px) */}
        {(isFullscreen || hideChrome) ? null : <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-white/[0.08] bg-[#0e1019]">
          {/* LONGIA header */}
          <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#0a0c14] px-3 py-2">
            <Bot className="h-4 w-4 shrink-0 text-[var(--school-accent)]" />
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-bold tracking-[0.12em] text-[var(--school-accent)]">LONGIA</span>
              <span className="ml-1.5 text-[12px] text-white/40">Guide IA</span>
            </div>
            {aiProvider && (
              <span className="rounded-full border border-violet-400/30 px-2 py-0.5 text-[11px] text-violet-300">
                via {aiProvider}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-white/[0.07] bg-[#0b0d15]">
            {[
              { id: 'plan',  Icon: GitBranch,         label: 'Plan' },
              { id: 'coach', Icon: Bot,               label: 'Coach' },
              { id: 'props', Icon: SlidersHorizontal, label: 'Prop.' },
            ].map(({ id, Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setRightTab(id)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                  rightTab === id
                    ? 'border-b-2 border-[var(--school-accent)] text-[#f5dd8a]'
                    : 'border-b-2 border-transparent text-white/35 hover:text-white/65',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Guide IA tab */}
          {rightTab === 'coach' && (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 [scrollbar-width:thin]">
              <LongiaDesignerChatSection
                supabase={supabase}
                getContext={getDesignerChatContext}
                onApplyCanvasActions={handleApplyLongiaDesignerActions}
                scopeType="designer"
                scopeId={longiaThreadScopeId}
              />
              {/* LONGIA — Amelioration IA */}
              <div className="rounded-xl border border-violet-400/20 bg-violet-950/20 p-2.5">
                <p className="mb-2 text-[12px] font-semibold text-violet-200">LONGIA — Amelioration mise en scene</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'balance',    label: 'Equilibre',  desc: 'Layout harmonieux' },
                    { id: 'typography', label: 'Typo',       desc: 'Hierarchie texte' },
                    { id: 'premium',    label: 'Premium',    desc: 'Design elegant' },
                    { id: 'pedagogy',   label: 'Pedagogie',  desc: 'Lisibilite max' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={aiBusy}
                      onClick={() => runAiImprove(v.id)}
                      className="flex flex-col items-start rounded-xl border border-violet-400/22 bg-violet-900/25 px-2.5 py-2 text-left transition-all hover:bg-violet-800/35 disabled:opacity-50"
                    >
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-violet-100">
                        {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {v.label}
                      </span>
                      <span className="text-[11px] text-violet-300/60">{v.desc}</span>
                    </button>
                  ))}
                </div>
                {aiSuggestions.length > 0 && (
                  <div className="mt-2 space-y-1 rounded-lg bg-violet-900/20 p-2">
                    {aiSuggestions.map((s, i) => (
                      <p key={i} className="text-[11px] leading-snug text-violet-200/70">{'• ' + s}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Preview */}
              {aiPreview ? (
                <div className="rounded-xl border border-violet-400/30 bg-violet-950/40 p-3">
                  <p className="text-[13px] font-semibold text-violet-200">Apercu IA</p>
                  <p className="mt-1 text-[11px] text-white/45">
                    {aiPreview.objects?.length ?? 0} {"objet(s) — comparez avant d'appliquer."}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => applyAiPreview()}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-violet-500">
                      Appliquer
                    </button>
                    <button type="button" onClick={() => discardAiPreview()}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-[13px] text-white/70 hover:bg-white/5">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : null}

              {/* LONGIA — Images pedagogiques */}
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[#1a1310]/40 p-2.5">
                <p className="mb-1.5 text-[12px] font-semibold text-[#f5dd8a]">LONGIA — Images pedagogiques</p>
                {(longiaTopic || course?.slides?.[activeSlideIndex]?.title) ? (
                  <p className="mb-2 truncate text-[11px] text-[color-mix(in_srgb,var(--school-accent)_55%,transparent)]">
                    Theme : {longiaTopic || course?.slides?.[activeSlideIndex]?.title}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={longiaTopic}
                    onChange={(e) => setLongiaTopic(e.target.value)}
                    placeholder="Theme ou concept du slide..."
                    className="mb-2 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[12px] text-white placeholder:text-white/25 focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] focus:outline-none"
                  />
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={longiaImageBusy || longiaGraphBusy}
                    onClick={generateNarrativeImage}
                    className="flex flex-col items-start rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] bg-[var(--school-accent)]/[0.06] px-2.5 py-2 text-left transition-all hover:bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-[#f5dd8a]">
                      {longiaImageBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                      Image Narrative
                    </span>
                    <span className="text-[11px] text-[color-mix(in_srgb,var(--school-accent)_45%,transparent)]">Analogie visuelle symbolique</span>
                  </button>
                  <button
                    type="button"
                    disabled={longiaImageBusy || longiaGraphBusy}
                    onClick={generatePedagogyGraph}
                    className="flex flex-col items-start rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] bg-[var(--school-accent)]/[0.06] px-2.5 py-2 text-left transition-all hover:bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-[#f5dd8a]">
                      {longiaGraphBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitBranch className="h-3 w-3" />}
                      Graphique Pedagog.
                    </span>
                    <span className="text-[11px] text-[color-mix(in_srgb,var(--school-accent)_45%,transparent)]">Schema structurel etapes</span>
                  </button>
                </div>
              </div>

              {/* Appliquer slides au canvas */}
              {course?.slides?.length ? (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => applyLongiaCourseToCanvas()}
                    className="w-full rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] py-2 text-[12px] font-semibold text-[#f5dd8a] transition-all hover:bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)]"
                  >
                    <Sparkles className="mr-1.5 inline h-3 w-3" />
                    Appliquer slide {activeSlideIndex + 1} au canvas
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAllSlidesToCanvas()}
                    className="w-full rounded-xl border border-violet-400/25 bg-violet-950/25 py-2 text-[12px] font-semibold text-violet-200 transition-all hover:bg-violet-900/35"
                  >
                    <Layers className="mr-1.5 inline h-3 w-3" />
                    Appliquer toutes les slides ({course.slides.length})
                  </button>
                </div>
              ) : null}

              <SlideQualityBadge quality={activeSceneQuality} />
              <ValidationChecklist projectQuality={projectQuality} />
              <GlossairePanel scenes={project.scenes} />
            </div>
          )}

          {/* Proprietes tab */}
          {rightTab === 'props' && (
            <>
              <div className="shrink-0 border-b border-white/[0.07] p-2">
                <SlideQualityBadge quality={activeSceneQuality} />
              </div>
              <div className="shrink-0 border-b border-white/[0.07] p-2.5">
                <DesignerLayersPanel
                  objects={activeScene?.objects || []}
                  selectedIds={selectedIds}
                  onSelectOnly={selectOnly}
                  onToggleLock={toggleObjectLock}
                  onToggleVisibility={toggleObjectVisibility}
                />
              </div>
              <CanvaPropertiesPanel
                selectedObj={selectedObj}
                selectedIds={selectedIds}
                objects={activeScene?.objects || []}
                canvasWidth={cw}
                canvasHeight={ch}
                updateObject={updateObject}
                alignSelected={alignSelected}
                bringForward={bringForward}
                sendBackward={sendBackward}
                bringToFront={bringToFront}
                sendToBack={sendToBack}
                deleteSelected={deleteSelected}
                setObjectOpacity={setObjectOpacity}
                onExportPng={onExportPng}
                className="min-h-0 flex-1 overflow-y-auto"
              />
            </>
          )}

          {/* Script tab */}
          {rightTab === 'masterscript' && (
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
              <CourseSlideCoachColumn />
            </div>
          )}

          {/* LIRI WRITE tab */}
          {rightTab === 'write' && (
            <LiriWritePanel className="min-h-0 flex-1" />
          )}

          {/* Historique tab */}
          {rightTab === 'history' && (
            <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
              <VersionHistoryPanel
                historyPast={historyPast}
                historyTimestamps={historyTimestamps}
                onRestore={restoreHistorySnapshot}
              />
            </div>
          )}

          {/* Plan du slide tab */}
          {rightTab === 'plan' && (
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
              <SlideProgressionPanel
                scene={activeScene}
                activeSection={activeSection}
                onActivateSection={(secId) => {
                  setActiveSection(secId);
                  if (viewMode !== 'design') return;
                }}
                selectedIds={selectedIds}
                onAddSection={addSection}
                onRenameSection={renameSection}
                onDeleteSection={deleteSection}
                onReorderSections={reorderSections}
                onSetObjectSection={setObjectSection}
                onSaveInitialState={saveSceneInitialState}
                onResetToInitialState={resetSceneToInitialState}
              />
            </div>
          )}

          {/* Collab — barre presence en bas du panneau droit */}
          <div className="shrink-0 border-t border-white/[0.06] bg-[#090b12] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {collabEnabled ? (
                  <>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                    <button
                      type="button"
                      title="Copier l'ID de la room"
                      onClick={() => { navigator.clipboard?.writeText(collabRoomId); setCollabCopied(true); setTimeout(() => setCollabCopied(false), 1800); }}
                      className="text-[11px] text-green-300 hover:text-green-200"
                    >
                      {collabCopied ? 'Copie !' : collabRoomId}
                    </button>
                    {collabMembers.length > 0 && (
                      <span className="text-[11px] text-white/40">
                        {collabMembers.length + 1} connecte(s)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-white/30">Collab desactivee</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !collabEnabled;
                  setCollabEnabled(next);
                  if (next) {
                    try { localStorage.setItem('liri_collab_room', collabRoomId); } catch { /**/ }
                  }
                }}
                className={cn(
                  'rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-colors',
                  collabEnabled
                    ? 'border-green-500/30 bg-green-950/30 text-green-300 hover:bg-green-900/40'
                    : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/70',
                )}
              >
                {collabEnabled ? 'Quitter' : 'Rejoindre'}
              </button>
            </div>
          </div>
        </aside>}
      </div>

      {/* Filmstrip bas */}
      {!showDesignerBottomFilmstrip ? null : <div className="flex shrink-0 border-t border-white/[0.07] bg-[#080a10]" style={{ minHeight: '96px', maxHeight: '116px' }}>

        {/* Course slides */}
        {course?.slides?.length ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:thin]">
            <button type="button" onClick={() => prevSlide()} disabled={activeSlideIndex <= 0}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 text-white/60 hover:bg-white/[0.06] disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {course.slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSlideIndex(i)}
                className={cn(
                  'flex shrink-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-all',
                  i === activeSlideIndex
                    ? 'border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-[#1a1420] shadow-[0_0_16px_rgba(212,175,55,0.12)]'
                    : 'border-white/8 bg-white/[0.03] hover:border-white/18',
                )}
                style={{ minWidth: '110px', maxWidth: '170px' }}
              >
                <span className="text-[11px] font-bold text-[color-mix(in_srgb,var(--school-accent)_55%,transparent)]">{String(i + 1).padStart(2, '0')}</span>
                <span className={cn('line-clamp-2 text-[12px] font-medium leading-tight', i === activeSlideIndex ? 'text-[#f5dd8a]' : 'text-white/60')}>
                  {s.title}
                </span>
              </button>
            ))}
            <button type="button" onClick={() => nextSlide()} disabled={activeSlideIndex >= course.slides.length - 1}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 text-white/60 hover:bg-white/[0.06] disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {/* Konva scenes */}
        <div className={cn(
          'flex shrink-0 items-center gap-1.5 px-3 py-2',
          course?.slides?.length ? 'border-l border-white/[0.06]' : 'flex-1 overflow-x-auto',
        )}>
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-white/30">Scenes</span>
          {project.scenes.map((s, si) => {
            const sceneQual = projectQuality?.slideResults?.[si];
            const qColor = sceneQual ? sceneQual.levelColor : '#444';
            const isActive = s.id === project.activeSceneId;
            const isRenaming = renamingSceneId === s.id;
            return (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragSceneIdx(si)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSceneIdx !== null && dragSceneIdx !== si) {
                    reorderScenes(dragSceneIdx, si);
                  }
                  setDragSceneIdx(null);
                }}
                onDragEnd={() => setDragSceneIdx(null)}
                className={cn(
                  'group flex shrink-0 cursor-grab items-center overflow-hidden rounded-xl border transition-colors active:cursor-grabbing',
                  isActive
                    ? 'border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]'
                    : 'border-white/8 bg-white/[0.025] hover:border-white/18',
                  dragSceneIdx === si && 'opacity-50 ring-1 ring-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]',
                )}
              >
                <button
                  type="button"
                  onClick={() => activateKonvaSceneAndSyncSlide(s.id, si)}
                  className="flex items-center gap-1.5 px-2 py-1.5"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: qColor }} />
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renamingSceneDraft}
                      onChange={(e) => setRenamingSceneDraft(e.target.value)}
                      onBlur={() => { renameScene(s.id, renamingSceneDraft.trim() || s.name); setRenamingSceneId(null); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { renameScene(s.id, renamingSceneDraft.trim() || s.name); setRenamingSceneId(null); }
                        if (e.key === 'Escape') setRenamingSceneId(null);
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-20 rounded border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-black/50 px-1 text-[12px] text-[#f5dd8a] outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); setRenamingSceneId(s.id); setRenamingSceneDraft(s.name); }}
                      title="Double-clic pour renommer"
                      className={cn('text-[12px] font-medium', isActive ? 'text-[#f5dd8a]' : 'text-white/55')}
                    >
                      {s.name}
                    </span>
                  )}
                  {/* Sections count */}
                  {s.sections?.length > 0 && (
                    <span className="ml-1 text-[10px] text-white/30">{s.sections.length} sec.</span>
                  )}
                </button>
                <div className="flex items-center gap-0.5 border-l border-white/[0.07] px-1.5 py-1">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={s.durationMinutes || ''}
                    placeholder="0"
                    onChange={(e) => setSceneDuration(s.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-5 w-7 rounded border-0 bg-transparent text-center text-[11px] text-white/40 outline-none focus:text-white/80 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    title="Duree en minutes"
                  />
                  <span className="text-[11px] text-white/22">min</span>
                </div>
                {project.scenes.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteScene(s.id); }}
                    title="Supprimer cette scene"
                    className="hidden h-full items-center border-l border-white/[0.07] px-1.5 text-white/25 transition-colors hover:bg-red-950/40 hover:text-red-400 group-hover:flex"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" onClick={() => addScene()}
            className="shrink-0 rounded-xl border border-dashed border-white/16 px-2.5 py-1.5 text-[12px] text-white/45 transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] hover:text-[var(--school-accent)]">
            + Scene
          </button>
          <button type="button" onClick={() => duplicateActiveScene()}
            className="shrink-0 rounded-xl border border-white/10 px-2.5 py-1.5 text-[12px] text-white/50 hover:bg-white/5">
            Dupl.
          </button>
          {course?.slides?.[activeSlideIndex] && (
            <button
              type="button"
              title="Charger le contenu du slide cours dans la scène active"
              onClick={() => {
                const slide = course.slides[activeSlideIndex];
                loadSceneFromSlide(slide, 'initial');
              }}
              className="shrink-0 rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[var(--school-accent)]/[0.06] px-2.5 py-1.5 text-[12px] text-[#f5dd8a] transition-all hover:bg-[var(--school-accent)]/[0.12]"
            >
              ↓ Charger slide
            </button>
          )}
        </div>
      </div>}

      {/* Asset preview modal */}
      {assetPreview ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
          onClick={() => setAssetPreview(null)}
        >
          <div
            className="max-h-[92vh] max-w-[min(960px,96vw)] overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[#0b0f1a] shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
              <p className="text-[12px] font-semibold text-[var(--school-accent)]">Apercu (clic molette)</p>
              <button type="button" onClick={() => setAssetPreview(null)}
                className="rounded-lg px-2 py-1 text-[13px] text-white/50 hover:bg-white/10 hover:text-white">
                Fermer
              </button>
            </div>
            <div className="max-h-[calc(92vh-52px)] overflow-auto p-4">
              {assetPreview.kind === 'image' && assetPreview.obj?.content?.src ? (
                <img src={assetPreview.obj.content.src} alt="" className="mx-auto max-h-[75vh] w-auto max-w-full object-contain" />
              ) : null}
              {assetPreview.kind === 'icon' ? (
                <div className="flex min-h-[200px] items-center justify-center p-8 text-[140px] leading-none text-[var(--school-accent)]">★</div>
              ) : null}
              {assetPreview.kind === 'html' ? (
                <iframe
                  title="Apercu HTML"
                  srcDoc={String(assetPreview.obj?.content?.html ?? '')}
                  sandbox="allow-scripts allow-same-origin"
                  className="h-[min(72vh,600px)] w-full min-w-[260px] rounded-lg border border-white/10 bg-black/40"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Inline text editor — portail body + couleurs inline pour éviter fond blanc si coords/CSS dérivent */}
      {inlineTextId && inlineBox && typeof document !== 'undefined'
        ? createPortal(
            <textarea
              aria-label="Edition texte sur le canvas"
              autoFocus
              className="fixed z-[200] resize-none rounded-xl border p-2 text-[14px] leading-snug shadow-[0_8px_32px_rgba(0,0,0,0.55)] outline-none"
              style={{
                left: inlineBox.left,
                top: inlineBox.top,
                width: Math.max(120, inlineBox.width),
                minHeight: Math.max(72, inlineBox.height),
                backgroundColor: 'rgba(11, 15, 26, 0.98)',
                color: '#f4f4f5',
                borderColor: 'rgba(212, 175, 55, 0.45)',
                boxShadow: '0 0 0 1px rgba(212, 175, 55, 0.2)',
              }}
              value={inlineDraft}
              onChange={(e) => setInlineDraft(e.target.value)}
              onBlur={() => commitInlineText()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); setInlineTextId(null); setInlineBox(null); }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitInlineText(); }
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
});

export default SmartboardKonvaEditorV1;
