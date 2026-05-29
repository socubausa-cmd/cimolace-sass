import { create } from 'zustand';
import {
  createEmptyProject,
  createEmptyScene,
  genSceneId,
  genSbKonvaId,
  createSection,
} from '../model/sceneModel';
import { getPalettePageBackground, getPolotnoTypographyForPreset } from '../lib/liriCourseTheme';
import { buildSceneFromSlide } from '../lib/buildSceneFromSlide';

/**
 * @typedef {import('../model/sceneTypes').SbKonvaProject} SbKonvaProject
 * @typedef {import('../model/sceneTypes').SbKonvaObjectBase} SbKonvaObjectBase
 */

/** Historique undo/redo — large pour ne pas couper le travail (coût mémoire modéré). */
const historyLimit = 5000;

function cloneProject(p) {
  return structuredClone(p);
}

/** Boîte englobante union des objets (coords modèle x,y,width,height). */
function selectionUnionBounds(objs) {
  if (!objs?.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of objs) {
    const x = o.x ?? 0;
    const y = o.y ?? 0;
    const w = o.width ?? 0;
    const h = o.height ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: minX + w / 2,
    centerY: minY + h / 2,
  };
}

export const useSmartboardKonvaStore = create((set, get) => ({
  project: createEmptyProject(),
  selectedIds: [],
  /** Studio Image / workbench : pointer | sélection rect / ellipse / lasso */
  interactionTool: 'pointer',
  /** Région doc-space { kind, x, y, width, height } pour contexte IA après sélection */
  regionMarquee: null,
  historyPast: [],
  historyFuture: [],
  /** timestamps (ms) paralleles a historyPast */
  historyTimestamps: [],
  /** JSON scene propose par l'IA avant apply */
  aiPreview: null,

  pushHistory: () => {
    const { project, historyPast, historyFuture, historyTimestamps } = get();
    const snap = cloneProject(project);
    const past = [...historyPast, snap].slice(-historyLimit);
    const ts = [...historyTimestamps, Date.now()].slice(-historyLimit);
    set({ historyPast: past, historyFuture: [], historyTimestamps: ts });
  },

  undo: () => {
    const { historyPast, historyFuture, project, historyTimestamps } = get();
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, -1);
    set({
      project: prev,
      historyPast: newPast,
      historyFuture: [cloneProject(project), ...historyFuture],
      historyTimestamps: historyTimestamps.slice(0, -1),
      selectedIds: [],
    });
  },

  redo: () => {
    const { historyFuture, historyPast, project } = get();
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const newFut = historyFuture.slice(1);
    set({
      project: next,
      historyPast: [...historyPast, cloneProject(project)],
      historyFuture: newFut,
      selectedIds: [],
    });
  },

  getActiveScene: () => {
    const { project } = get();
    return project.scenes.find((s) => s.id === project.activeSceneId) || project.scenes[0];
  },

  setActiveScene: (sceneId) => {
    set((state) => ({
      project: { ...state.project, activeSceneId: sceneId },
      selectedIds: [],
    }));
  },

  addScene: () => {
    get().pushHistory();
    const name = `Scène ${get().project.scenes.length + 1}`;
    const scene = createEmptyScene(name);
    set((state) => ({
      project: {
        ...state.project,
        scenes: [...state.project.scenes, scene],
        activeSceneId: scene.id,
      },
      selectedIds: [],
    }));
  },

  duplicateActiveScene: () => {
    get().pushHistory();
    const scene = get().getActiveScene();
    if (!scene) return;
    const copy = structuredClone(scene);
    copy.id = genSceneId();
    copy.name = `${scene.name} (copie)`;
    set((state) => ({
      project: {
        ...state.project,
        scenes: [...state.project.scenes, copy],
        activeSceneId: copy.id,
      },
      selectedIds: [],
    }));
  },

  setSceneDuration: (sceneId, durationMinutes) => {
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId ? { ...s, durationMinutes: Math.max(0, Number(durationMinutes) || 0) } : s,
        ),
      },
    }));
  },

  /** Applique un theme global a toutes les scenes (fond) */
  applyGlobalTheme: (theme) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        canvas: { ...state.project.canvas, background: theme.bg },
        scenes: state.project.scenes.map((s) => ({ ...s, _themeAccent: theme.accent, _themeFontTitle: theme.fontTitle, _themeFontBody: theme.fontBody })),
      },
    }));
  },

  renameScene: (sceneId, name) => {
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId ? { ...s, name } : s,
        ),
      },
    }));
  },

  deleteScene: (sceneId) => {
    const { project } = get();
    if (project.scenes.length <= 1) return; // garder au moins 1 scene
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.filter((s) => s.id !== sceneId);
      const activeSceneId =
        state.project.activeSceneId === sceneId
          ? (scenes[scenes.indexOf(state.project.scenes.find((s) => s.id === sceneId)) - 1] || scenes[0])?.id
          : state.project.activeSceneId;
      return { project: { ...state.project, scenes, activeSceneId }, selectedIds: [] };
    });
  },

  setCanvasBackground: (background) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        canvas: { ...state.project.canvas, background },
      },
    }));
  },

  /** Redimensionne le canvas sans pousser d'historique (changement de type de document) */
  setCanvasDimensions: (w, h) => {
    set((state) => ({
      project: {
        ...state.project,
        canvas: { ...state.project.canvas, width: Math.round(w), height: Math.round(h) },
      },
    }));
  },

  selectOnly: (id) => {
    set({ selectedIds: id ? [id] : [] });
  },

  setSelectedIds: (ids) => {
    set({ selectedIds: Array.isArray(ids) ? ids.filter(Boolean) : [] });
  },

  setInteractionTool: (tool) => {
    const allowed = new Set(['pointer', 'marquee-rect', 'marquee-ellipse', 'marquee-lasso', 'crop-image']);
    const t = allowed.has(tool) ? tool : 'pointer';
    set({ interactionTool: t });
  },

  setRegionMarquee: (r) => set({ regionMarquee: r }),

  clearRegionMarquee: () => set({ regionMarquee: null }),

  toggleSelect: (id) => {
    set((state) => {
      const has = state.selectedIds.includes(id);
      return {
        selectedIds: has
          ? state.selectedIds.filter((x) => x !== id)
          : [...state.selectedIds, id],
      };
    });
  },

  /** @param {SbKonvaObjectBase} obj */
  addObject: (obj) => {
    const withId = obj && obj.id ? obj : { ...obj, id: genSbKonvaId(obj?.type || 'obj') };
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return { ...s, objects: [...s.objects, withId] };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: [withId.id],
      };
    });
  },

  /** @param {SbKonvaObjectBase[]} objs */
  addObjects: (objs) => {
    if (!objs?.length) return;
    const withIds = objs.map((o) => (o && o.id ? o : { ...o, id: genSbKonvaId(o?.type || 'obj') }));
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return { ...s, objects: [...s.objects, ...withIds] };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: withIds.map((o) => o.id),
      };
    });
  },

  /** Sélectionne tous les objets de la scène active (Shift+clic reste disponible pour la multi-sélection). */
  selectAllInActiveScene: () => {
    set((state) => {
      const scene = state.project.scenes.find((s) => s.id === state.project.activeSceneId);
      const ids = (scene?.objects ?? []).map((o) => o.id).filter(Boolean);
      return { selectedIds: ids };
    });
  },

  updateObject: (id, partial) => {
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return {
          ...s,
          objects: s.objects.map((o) =>
            o.id === id ? mergeDeepObject(o, partial) : o,
          ),
        };
      });
      return { project: { ...state.project, scenes } };
    });
  },

  /** Retire `content.crop` (merge profond ne supprime pas les clés absentes). */
  removeImageCrop: (id) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) => {
              if (o.id !== id || o.type !== 'image' || !o.content) return o;
              const { crop: _omit, ...rest } = o.content;
              return { ...o, content: rest };
            }),
          };
        }),
      },
    }));
  },

  /** Mise à jour live (pas d'historique) — drag / transform en cours */
  updateObjectTransform: (id, attrs) => {
    const { x, y, width, height, rotation, content } = attrs;
    const patch = {
      x,
      y,
      width,
      height,
      rotation: rotation ?? 0,
    };
    if (content !== undefined) patch.content = content;
    get().updateObject(id, patch);
  },

  deleteSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return {
          ...s,
          objects: s.objects.filter((o) => !selectedIds.includes(o.id)),
        };
      });
      return { project: { ...state.project, scenes }, selectedIds: [] };
    });
  },

  /**
   * LONGIA / sélection : rectangle, triangle, losange, étoile, ellipse → `circle` (même bbox, styles conservés).
   * @returns {{ ok: boolean; count?: number; reason?: string }}
   */
  convertSelectedShapesToCircles: () => {
    const convertible = new Set(['rect', 'triangle', 'diamond', 'starshape', 'ellipse']);
    const { selectedIds, project } = get();
    const scene = project.scenes.find((s) => s.id === project.activeSceneId);
    if (!scene) return { ok: false, reason: 'no_scene' };
    if (!selectedIds.length) return { ok: false, reason: 'no_selection' };
    const toConvert = selectedIds.filter((id) => {
      const o = scene.objects.find((x) => x.id === id);
      return o && convertible.has(o.type);
    });
    if (!toConvert.length) return { ok: false, reason: 'no_convertible' };
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return {
          ...s,
          objects: s.objects.map((o) =>
            toConvert.includes(o.id) ? { ...o, type: 'circle' } : o,
          ),
        };
      });
      return { project: { ...state.project, scenes } };
    });
    return { ok: true, count: toConvert.length };
  },

  /** Supprime un objet par id (ex. glissé hors du canvas) */
  deleteObjectById: (id) => {
    if (!id) return;
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return { ...s, objects: s.objects.filter((o) => o.id !== id) };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: state.selectedIds.filter((x) => x !== id),
      };
    });
  },

  /** Restore d'un snapshot par index dans historyPast (Module 1) */
  restoreHistorySnapshot: (index) => {
    const { historyPast, historyTimestamps, project } = get();
    const snap = historyPast[index];
    if (!snap) return;
    const newPast = historyPast.slice(0, index);
    const newTs = historyTimestamps.slice(0, index);
    set({
      project: cloneProject(snap),
      historyPast: newPast,
      historyFuture: [cloneProject(project)],
      historyTimestamps: newTs,
      selectedIds: [],
    });
  },

  loadProject: (project) => {
    set({
      project: cloneProject(project),
      selectedIds: [],
      historyPast: [],
      historyFuture: [],
      historyTimestamps: [],
      aiPreview: null,
    });
  },

  setAiPreview: (preview) => set({ aiPreview: preview }),

  applyAiPreview: () => {
    const { aiPreview } = get();
    if (!aiPreview || !aiPreview.objects) return;
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return {
          ...s,
          objects: structuredClone(aiPreview.objects),
        };
      });
      return {
        project: {
          ...state.project,
          canvas: aiPreview.canvas
            ? { ...state.project.canvas, ...aiPreview.canvas }
            : state.project.canvas,
          scenes,
        },
        aiPreview: null,
        selectedIds: [],
      };
    });
  },

  discardAiPreview: () => set({ aiPreview: null }),

  // ─── LONGIA Messages ──────────────────────────────────────────
  longiaMessages: [
    { id: 'init', role: 'ai', text: 'Prêt à analyser votre scène. Tapez en bas pour interagir.', ts: Date.now() },
  ],

  addLongiaMessage: (msg) =>
    set((state) => ({
      longiaMessages: [
        ...state.longiaMessages,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ts: Date.now(),
          ...msg,
        },
      ],
    })),

  clearLongiaMessages: () =>
    set({
      longiaMessages: [
        { id: 'init', role: 'ai', text: 'Prêt à analyser votre scène. Tapez en bas pour interagir.', ts: Date.now() },
      ],
    }),

  /** Restaure le flux LONGIA depuis un export workspace (`designerStudio.longiaMessages`). */
  hydrateLongiaFromExport: (msgs) => {
    if (!Array.isArray(msgs) || msgs.length === 0) return;
    const mapped = msgs.map((m, i) => {
      const x = m && typeof m === 'object' ? m : {};
      const role = x.role === 'user' ? 'user' : 'ai';
      const text = typeof x.text === 'string' ? x.text : '';
      const base = {
        id: x.id || `lm_${Date.now()}_${i}`,
        ts: typeof x.ts === 'number' ? x.ts : Date.now(),
        role,
        text,
      };
      /** @type {Record<string, unknown>} */
      const out = { ...base };
      if (Array.isArray(x.suggestions) && x.suggestions.length) {
        out.suggestions = x.suggestions;
      }
      if (x.longiaUnified && typeof x.longiaUnified === 'object') {
        out.longiaUnified = x.longiaUnified;
      }
      if (x.longiaComposed && typeof x.longiaComposed === 'object') {
        out.longiaComposed = x.longiaComposed;
      }
      return out;
    });
    set({ longiaMessages: mapped });
  },

  // ─── Outil vecteur actif ──────────────────────────────────────
  /** 'pen' | 'penAdd' | 'penRemove' | 'penConvert' | 'pencil' | 'directSelect' | null */
  activeVectorTool: null,
  setVectorTool: (tool) => set({ activeVectorTool: tool }),
  clearVectorTool: () => set({ activeVectorTool: null }),

  /** Épaisseur du crayon vectoriel (SmartBoard Designer) */
  pencilSize: 2,
  setPencilSize: (next) =>
    set((state) => ({
      pencilSize: typeof next === 'function' ? next(state.pencilSize) : next,
    })),

  // ─── Grouper / Dégrouper ─────────────────────────────────────
  groupSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 2) return;
    get().pushHistory();
    const groupId = `grp_${Date.now()}`;
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) =>
              selectedIds.includes(o.id) ? { ...o, groupId } : o,
            ),
          };
        }),
      },
    }));
    return groupId;
  },

  ungroupSelected: () => {
    const { selectedIds } = get();
    if (!selectedIds.length) return;
    const scene = get().getActiveScene();
    const selObjs = scene?.objects?.filter((o) => selectedIds.includes(o.id)) ?? [];
    const groupIds = [...new Set(selObjs.map((o) => o.groupId).filter(Boolean))];
    if (!groupIds.length) return;
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) =>
              groupIds.includes(o.groupId) ? { ...o, groupId: null } : o,
            ),
          };
        }),
      },
    }));
  },

  // ─── Opérations booléennes (simplifiées) ─────────────────────
  /** Unite : fusionne les bounding-boxes des objets sélectionnés en un seul rect */
  uniteSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 2) return;
    const scene = get().getActiveScene();
    const objs = scene?.objects?.filter((o) => selectedIds.includes(o.id)) ?? [];
    if (objs.length < 2) return;
    const minX = Math.min(...objs.map((o) => o.x));
    const minY = Math.min(...objs.map((o) => o.y));
    const maxX = Math.max(...objs.map((o) => o.x + (o.width ?? 0)));
    const maxY = Math.max(...objs.map((o) => o.y + (o.height ?? 0)));
    const firstStyle = objs[0].style ?? {};
    get().pushHistory();
    const united = {
      id: `rect_${Date.now()}_united`,
      type: 'rect',
      x: minX, y: minY,
      width: maxX - minX, height: maxY - minY,
      style: { fill: firstStyle.fill ?? 'rgba(139,92,246,0.4)', stroke: firstStyle.stroke ?? '#7c3aed', strokeWidth: firstStyle.strokeWidth ?? 2, cornerRadius: 4 },
      opacity: objs[0].opacity ?? 1,
    };
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return { ...s, objects: [...s.objects.filter((o) => !selectedIds.includes(o.id)), united] };
        }),
      },
      selectedIds: [united.id],
    }));
  },

  /** Soustraire : retire la forme du dessus de celle du dessous (simplifié → supprime le dessus) */
  subtractSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 2) return;
    const scene = get().getActiveScene();
    const objs = scene?.objects?.filter((o) => selectedIds.includes(o.id)) ?? [];
    if (objs.length < 2) return;
    // Forme "du dessus" = celle avec le z-order (layer) le plus haut
    const top = objs.reduce((a, b) => ((a.layer ?? 0) >= (b.layer ?? 0) ? a : b));
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return { ...s, objects: s.objects.filter((o) => o.id !== top.id) };
        }),
      },
      selectedIds: selectedIds.filter((id) => id !== top.id),
    }));
  },

  /** Intersecter : crée un rect à l'intersection des bounding-boxes */
  intersectSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 2) return;
    const scene = get().getActiveScene();
    const objs = scene?.objects?.filter((o) => selectedIds.includes(o.id)) ?? [];
    if (objs.length < 2) return;
    const x1 = Math.max(...objs.map((o) => o.x));
    const y1 = Math.max(...objs.map((o) => o.y));
    const x2 = Math.min(...objs.map((o) => o.x + (o.width ?? 0)));
    const y2 = Math.min(...objs.map((o) => o.y + (o.height ?? 0)));
    if (x2 <= x1 || y2 <= y1) return; // pas d'intersection
    const firstStyle = objs[0].style ?? {};
    get().pushHistory();
    const intersected = {
      id: `rect_${Date.now()}_intersect`,
      type: 'rect',
      x: x1, y: y1, width: x2 - x1, height: y2 - y1,
      style: { fill: firstStyle.fill ?? 'rgba(59,130,246,0.4)', stroke: '#3b82f6', strokeWidth: 2, cornerRadius: 0 },
      opacity: 1,
    };
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return { ...s, objects: [...s.objects.filter((o) => !selectedIds.includes(o.id)), intersected] };
        }),
      },
      selectedIds: [intersected.id],
    }));
  },

  /** Subdiviser : découpe un objet en 4 quarts */
  subdivideSelected: () => {
    const { selectedIds } = get();
    if (!selectedIds.length) return;
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === selectedIds[0]);
    if (!obj) return;
    get().pushHistory();
    const hw = (obj.width ?? 160) / 2;
    const hh = (obj.height ?? 140) / 2;
    const baseStyle = { ...(obj.style ?? {}), strokeWidth: 1 };
    const quads = [
      { x: obj.x,      y: obj.y,       width: hw, height: hh },
      { x: obj.x + hw, y: obj.y,       width: hw, height: hh },
      { x: obj.x,      y: obj.y + hh,  width: hw, height: hh },
      { x: obj.x + hw, y: obj.y + hh,  width: hw, height: hh },
    ].map((q, i) => ({
      id: `rect_${Date.now()}_q${i}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'rect',
      ...q,
      style: { ...baseStyle, cornerRadius: 0 },
      opacity: obj.opacity ?? 1,
    }));
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return { ...s, objects: [...s.objects.filter((o) => o.id !== obj.id), ...quads] };
        }),
      },
      selectedIds: quads.map((q) => q.id),
    }));
  },

  /**
   * Aligne la sélection : **1 objet** → canvas ; **2+** → bbox du groupe.
   * `options.forceCanvas` (ex. Alt+clic UI) : toujours le canvas, même à plusieurs.
   * @param {{ forceCanvas?: boolean }} [options]
   */
  alignSelected: (direction, options = {}) => {
    const { selectedIds, project } = get();
    if (!selectedIds.length) return;
    const scene = get().getActiveScene();
    if (!scene) return;
    const objs = scene.objects.filter((o) => selectedIds.includes(o.id));
    if (!objs.length) return;

    const cw = project.canvas.width;
    const ch = project.canvas.height;
    const forceCanvas = options.forceCanvas === true;
    const multi = objs.length >= 2 && !forceCanvas;
    const u = multi ? selectionUnionBounds(objs) : null;

    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return {
          ...s,
          objects: s.objects.map((o) => {
            if (!selectedIds.includes(o.id)) return o;
            const w = o.width ?? 0;
            const h = o.height ?? 0;
            if (multi && u) {
              switch (direction) {
                case 'left':
                  return { ...o, x: u.minX };
                case 'centerH':
                  return { ...o, x: Math.round(u.centerX - w / 2) };
                case 'right':
                  return { ...o, x: Math.round(u.maxX - w) };
                case 'top':
                  return { ...o, y: u.minY };
                case 'centerV':
                  return { ...o, y: Math.round(u.centerY - h / 2) };
                case 'bottom':
                  return { ...o, y: Math.round(u.maxY - h) };
                default:
                  return o;
              }
            }
            switch (direction) {
              case 'left':
                return { ...o, x: 0 };
              case 'centerH':
                return { ...o, x: Math.round((cw - w) / 2) };
              case 'right':
                return { ...o, x: cw - w };
              case 'top':
                return { ...o, y: 0 };
              case 'centerV':
                return { ...o, y: Math.round((ch - h) / 2) };
              case 'bottom':
                return { ...o, y: ch - h };
              default:
                return o;
            }
          }),
        };
      });
      return { project: { ...state.project, scenes } };
    });
  },

  /**
   * Centre sur le canvas : **1 objet** ; **2+** → groupe entier centré.
   * `options.forceCanvas` : avec 2+, centre **chaque** objet sur le canvas (pas le groupe).
   * @param {{ forceCanvas?: boolean }} [options]
   */
  alignSelectedCenterBoth: (options = {}) => {
    const { selectedIds, project } = get();
    if (!selectedIds.length) return;
    const scene = get().getActiveScene();
    if (!scene) return;
    const objs = scene.objects.filter((o) => selectedIds.includes(o.id));
    if (!objs.length) return;

    const cw = project.canvas.width;
    const ch = project.canvas.height;
    const forceCanvas = options.forceCanvas === true;

    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        if (objs.length >= 2 && !forceCanvas) {
          const u = selectionUnionBounds(objs);
          if (!u) return s;
          const gw = u.maxX - u.minX;
          const gh = u.maxY - u.minY;
          const dx = Math.round((cw - gw) / 2 - u.minX);
          const dy = Math.round((ch - gh) / 2 - u.minY);
          return {
            ...s,
            objects: s.objects.map((o) =>
              selectedIds.includes(o.id) ? { ...o, x: (o.x ?? 0) + dx, y: (o.y ?? 0) + dy } : o,
            ),
          };
        }
        return {
          ...s,
          objects: s.objects.map((o) => {
            if (!selectedIds.includes(o.id)) return o;
            const w = o.width ?? 0;
            const h = o.height ?? 0;
            return {
              ...o,
              x: Math.round((cw - w) / 2),
              y: Math.round((ch - h) / 2),
            };
          }),
        };
      });
      return { project: { ...state.project, scenes } };
    });
  },

  /**
   * Répartit les objets sélectionnés horizontalement : espacement égal entre bords,
   * en conservant le bord gauche du plus à gauche et le bord droit du plus à droite (tri par x).
   */
  distributeSelectedHorizontal: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 3) return;
    const scene = get().getActiveScene();
    if (!scene) return;
    const objs = scene.objects.filter((o) => selectedIds.includes(o.id));
    if (objs.length < 3) return;
    const sorted = [...objs].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    const leftBound = sorted[0].x ?? 0;
    const last = sorted[sorted.length - 1];
    const rightBound = (last.x ?? 0) + (last.width ?? 0);
    let totalW = 0;
    for (const o of sorted) totalW += o.width ?? 0;
    const n = sorted.length;
    const gap = (rightBound - leftBound - totalW) / (n - 1);
    const positions = new Map();
    let cx = leftBound;
    for (const o of sorted) {
      positions.set(o.id, Math.round(cx));
      cx += (o.width ?? 0) + gap;
    }
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) =>
              positions.has(o.id) ? { ...o, x: positions.get(o.id) } : o,
            ),
          };
        }),
      },
    }));
  },

  /** Idem distributeSelectedHorizontal sur l'axe Y (tri par y, haut / bas fixes). */
  distributeSelectedVertical: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 3) return;
    const scene = get().getActiveScene();
    if (!scene) return;
    const objs = scene.objects.filter((o) => selectedIds.includes(o.id));
    if (objs.length < 3) return;
    const sorted = [...objs].sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
    const topBound = sorted[0].y ?? 0;
    const last = sorted[sorted.length - 1];
    const bottomBound = (last.y ?? 0) + (last.height ?? 0);
    let totalH = 0;
    for (const o of sorted) totalH += o.height ?? 0;
    const n = sorted.length;
    const gap = (bottomBound - topBound - totalH) / (n - 1);
    const positions = new Map();
    let cy = topBound;
    for (const o of sorted) {
      positions.set(o.id, Math.round(cy));
      cy += (o.height ?? 0) + gap;
    }
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) =>
              positions.has(o.id) ? { ...o, y: positions.get(o.id) } : o,
            ),
          };
        }),
      },
    }));
  },

  bringForward: (id) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const obj = scene.objects.find((o) => o.id === id);
    if (!obj) return;
    get().updateObject(id, { layer: (obj.layer ?? 0) + 1 });
  },

  sendBackward: (id) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const obj = scene.objects.find((o) => o.id === id);
    if (!obj) return;
    get().updateObject(id, { layer: Math.max(0, (obj.layer ?? 0) - 1) });
  },

  bringToFront: (id) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const maxLayer = Math.max(...scene.objects.map((o) => o.layer ?? 0), 0);
    get().updateObject(id, { layer: maxLayer + 1 });
  },

  sendToBack: (id) => {
    get().updateObject(id, { layer: 0 });
  },

  setObjectOpacity: (id, opacity) => {
    get().updateObject(id, { opacity: Math.max(0, Math.min(1, opacity)) });
  },

  toggleObjectLock: (id) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj) return;
    get().updateObject(id, { locked: !obj.locked });
  },

  toggleObjectVisibility: (id) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj) return;
    get().updateObject(id, { hidden: !obj.hidden });
  },

  reorderScenes: (fromIndex, toIndex) => {
    get().pushHistory();
    set((state) => {
      const scenes = [...state.project.scenes];
      const [moved] = scenes.splice(fromIndex, 1);
      scenes.splice(toIndex, 0, moved);
      return { project: { ...state.project, scenes } };
    });
  },

  // ─── Sections internes ───────────────────────────────────────
  addSection: (label = 'Section') => {
    const sec = createSection(label);
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id !== state.project.activeSceneId
            ? s
            : { ...s, sections: [...(s.sections || []), sec] },
        ),
      },
    }));
    return sec.id;
  },

  renameSection: (sectionId, label) => {
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id !== state.project.activeSceneId
            ? s
            : {
                ...s,
                sections: (s.sections || []).map((sec) =>
                  sec.id === sectionId ? { ...sec, label } : sec,
                ),
              },
        ),
      },
    }));
  },

  deleteSection: (sectionId) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            sections: (s.sections || []).filter((sec) => sec.id !== sectionId),
            objects: s.objects.map((o) =>
              o.sectionId === sectionId ? { ...o, sectionId: null } : o,
            ),
          };
        }),
      },
    }));
  },

  reorderSections: (fromIndex, toIndex) => {
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          const secs = [...(s.sections || [])];
          const [moved] = secs.splice(fromIndex, 1);
          secs.splice(toIndex, 0, moved);
          return { ...s, sections: secs };
        }),
      },
    }));
  },

  setObjectSection: (objectId, sectionId) => {
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) =>
              o.id === objectId ? { ...o, sectionId: sectionId || null } : o,
            ),
          };
        }),
      },
    }));
  },

  // ─── Etats initial / reset ────────────────────────────────────
  saveSceneInitialState: () => {
    const scene = get().getActiveScene();
    if (!scene) return;
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id !== state.project.activeSceneId
            ? s
            : { ...s, stateInitial: structuredClone(s.objects) },
        ),
      },
    }));
  },

  resetSceneToInitialState: () => {
    const scene = get().getActiveScene();
    if (!scene || !scene.stateInitial) return;
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id !== state.project.activeSceneId
            ? s
            : { ...s, objects: structuredClone(s.stateInitial) },
        ),
      },
      selectedIds: [],
    }));
  },

  duplicateSelected: () => {
    const { selectedIds } = get();
    if (!selectedIds.length) return;
    const scene = get().getActiveScene();
    if (!scene) return;
    const objs = scene.objects.filter((o) => selectedIds.includes(o.id));
    if (!objs.length) return;
    get().pushHistory();
    const copies = objs.map((o) => ({
      ...structuredClone(o),
      id: `${o.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      x: o.x + 20,
      y: o.y + 20,
    }));
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return { ...s, objects: [...s.objects, ...copies] };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: copies.map((c) => c.id),
      };
    });
  },

  /** Fond canvas (toutes les scènes partagent `project.canvas`). */
  applyCoursePaletteToCanvas: (paletteId) => {
    const bg = getPalettePageBackground(paletteId);
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        canvas: { ...state.project.canvas, background: bg },
      },
    }));
  },

  /**
   * Applique le préréglage typo aux blocs texte de **toutes** les scènes (Module 4).
   * @param {string} typographyPresetId
   * @returns {{ updated: number }}
   */
  applyTypographyPresetGlobally: (typographyPresetId) => {
    const cfg = getPolotnoTypographyForPreset(typographyPresetId);
    if (!cfg) return { updated: 0 };
    let updated = 0;
    for (const sc of get().project.scenes) {
      for (const o of sc.objects) {
        if (o.type === 'text') updated += 1;
      }
    }
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((scene) => ({
          ...scene,
          objects: scene.objects.map((o) => {
            if (o.type !== 'text') return o;
            const fs = Number(o.style?.fontSize) || 16;
            const fontSize = cfg.mapFontSize(fs);
            return mergeDeepObject(o, {
              style: {
                fontFamily: cfg.fontFamily,
                fontSize,
                fontWeight: cfg.fontWeight,
              },
            });
          }),
        })),
      },
    }));
    return { updated };
  },

  /**
   * Aligne le nombre de scènes Konva sur le plan Copilot (scènes vides ajoutées si besoin).
   * Les N premières scènes correspondent aux slides 0..N-1.
   * @param {import('../model/courseCopilotTypes').CourseSlide[]} slides
   * @param {number} [activeIndex]
   */
  ensureScenesForSlides: (slides, activeIndex = 0) => {
    if (!slides?.length) return;
    get().pushHistory();
    set((state) => {
      let scenes = [...state.project.scenes];
      while (scenes.length < slides.length) {
        const i = scenes.length;
        const short = (slides[i].title || `Slide ${i + 1}`).slice(0, 36);
        scenes.push(createEmptyScene(`S${i + 1} · ${short}`));
      }
      const ai = Math.max(0, Math.min(activeIndex ?? 0, slides.length - 1));
      const targetId = scenes[ai]?.id;
      return {
        project: {
          ...state.project,
          scenes,
          activeSceneId: targetId || state.project.activeSceneId,
        },
        selectedIds: [],
      };
    });
  },

  /**
   * Load a SmartboardSlide into the active (or target) Konva scene.
   * Converts DesignElement[] BoardState → SbKonvaObject[] via buildSceneFromSlide.
   *
   * @param {import('../../../engines/types/smartboard').SmartboardSlide} slide
   * @param {'initial'|'live'|string} stateKey  Which board state to load
   * @param {string|null} targetSceneId  Scene to populate (default: activeSceneId)
   */
  loadSceneFromSlide: (slide, stateKey = 'initial', targetSceneId = null) => {
    if (!slide) return;
    const built = buildSceneFromSlide(slide, stateKey);
    get().pushHistory();
    set((state) => {
      const sceneId = targetSceneId || state.project.activeSceneId;
      const scenes = state.project.scenes.map((sc) => {
        if (sc.id !== sceneId) return sc;
        return {
          ...sc,
          name: built.name || sc.name,
          objects: built.objects,
          sections: built.sections?.length ? built.sections : sc.sections,
          stateInitial: built.stateInitial ?? sc.stateInitial,
        };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: [],
      };
    });
  },
}));

/* ── Expose store en DEV pour les tests ── */
if (typeof window !== 'undefined') {
  // Accessible via window.__sbKonvaStore.getState() / .setState()
  window.__sbKonvaStore = useSmartboardKonvaStore;
}

function mergeDeepObject(target, partial) {
  const out = { ...target };
  for (const k of Object.keys(partial)) {
    const v = partial[k];
    if (v != null && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] != null) {
      out[k] = mergeDeepObject(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}
