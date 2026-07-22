/**
 * Modèle JSON scène SmartBoard Konva — aligné 1037×750 (LIRI / smartboardDesignCanvas).
 * V1 : text, rect, circle, line, arrow, ellipse, image, icon, html. Champs V2+ : step, visibleFor, liaisons pédago.
 */
import {
  SMARTBOARD_DESIGN_WIDTH,
  SMARTBOARD_DESIGN_HEIGHT,
} from '@/lib/smartboardDesignCanvas';

export const SB_KONVA_CANVAS_W = SMARTBOARD_DESIGN_WIDTH;
export const SB_KONVA_CANVAS_H = SMARTBOARD_DESIGN_HEIGHT;
export const SB_KONVA_STANDARD_W = 856;
export const SB_KONVA_FOCUS_W = SMARTBOARD_DESIGN_WIDTH;

let _seq = 0;
export function genSbKonvaId(prefix = 'obj') {
  _seq += 1;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
  }
  return `${prefix}_${Date.now()}_${_seq}`;
}

export function genSceneId() {
  return genSbKonvaId('scene');
}

export function genSectionId() {
  return genSbKonvaId('sec');
}

/** @returns {{ id: string; label: string }} */
export function createSection(label) {
  return { id: genSectionId(), label };
}

/** @returns {import('./sceneTypes').SbKonvaScene} */
export function createEmptyScene(name = 'Scene 1') {
  return {
    id: genSceneId(),
    name,
    objects: [],
    sections: [],      // Array<{ id: string; label: string }>
    stateInitial: null, // objects[] snapshot or null
  };
}

/** @returns {import('./sceneTypes').SbKonvaProject} */
export function createEmptyProject() {
  const scene = createEmptyScene('Scène 1');
  return {
    version: 1,
    canvas: {
      width: SB_KONVA_CANVAS_W,
      height: SB_KONVA_CANVAS_H,
      background: 'transparent',
    },
    scenes: [scene],
    activeSceneId: scene.id,
  };
}

export function mkTextObject(overrides = {}) {
  const id = genSbKonvaId('txt');
  return {
    id,
    type: 'text',
    x: 120,
    y: 80,
    width: 420,
    height: 72,
    rotation: 0,
    layer: 1,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 32,
      fontWeight: 700,
      fontStyle: 'normal',
      fill: '#F7F2E8',
      align: 'left',
      lineHeight: 1.25,
    },
    content: {
      text: 'Titre',
      collapsible: false,
      defaultCollapsed: false,
      sectionLabel: '',
    },
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkRectObject(overrides = {}) {
  const id = genSbKonvaId('rect');
  return {
    id,
    type: 'rect',
    x: 100,
    y: 200,
    width: 200,
    height: 120,
    rotation: 0,
    layer: 0,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: {
      fill: 'rgba(212,175,55,0.15)',
      stroke: '#D4AF37',
      strokeWidth: 2,
      cornerRadius: 8,
    },
    content: {},
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkLineObject(overrides = {}) {
  const id = genSbKonvaId('line');
  return {
    id,
    type: 'line',
    x: 0,
    y: 0,
    width: 100,
    height: 4,
    rotation: 0,
    layer: 0,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    style: {
      stroke: '#94a3b8',
      strokeWidth: 3,
      lineCap: 'round',
      opacity: 1,
      hitStrokeWidth: 14,
    },
    content: { points: [0, 0, 100, 0] },
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkArrowObject(overrides = {}) {
  const id = genSbKonvaId('arr');
  return {
    id,
    type: 'arrow',
    x: 0,
    y: 0,
    width: 100,
    height: 4,
    rotation: 0,
    layer: 0,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    style: {
      stroke: '#94a3b8',
      fill: '#94a3b8',
      strokeWidth: 3,
      lineCap: 'round',
      pointerLength: 10,
      pointerWidth: 10,
      opacity: 1,
      hitStrokeWidth: 14,
    },
    content: { points: [0, 0, 100, 0] },
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkEllipseObject(overrides = {}) {
  const id = genSbKonvaId('ell');
  return {
    id,
    type: 'ellipse',
    x: 200,
    y: 200,
    width: 160,
    height: 100,
    rotation: 0,
    layer: 0,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    style: {
      fill: 'rgba(139,92,246,0.2)',
      stroke: 'rgba(139,92,246,0.4)',
      strokeWidth: 0,
    },
    content: {},
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkCircleObject(overrides = {}) {
  const id = genSbKonvaId('circ');
  return {
    id,
    type: 'circle',
    x: 400,
    y: 280,
    width: 120,
    height: 120,
    rotation: 0,
    layer: 0,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: {
      fill: 'rgba(96,165,250,0.2)',
      stroke: '#60a5fa',
      strokeWidth: 2,
    },
    content: {},
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkImageObject(src, overrides = {}) {
  const id = genSbKonvaId('img');
  return {
    id,
    type: 'image',
    x: 200,
    y: 200,
    width: 280,
    height: 180,
    rotation: 0,
    layer: 1,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: {},
    content: { src: src || '' },
    ...overrides,
    id: overrides.id || id,
  };
}

/** HTML / animation (rendu live via iframe srcDoc dans SlideParallaxStage) */
export function mkHtmlEmbedObject(overrides = {}) {
  const id = genSbKonvaId('html');
  return {
    id,
    type: 'html',
    x: 120,
    y: 280,
    width: 420,
    height: 240,
    rotation: 0,
    layer: 1,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: {},
    content: {
      html: '<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#262624;color:#D4AF37;font-family:system-ui"><style>@keyframes spin{to{transform:rotate(360deg)}}</style><div style="width:48px;height:48px;border:3px solid rgba(212,175,55,.25);border-top-color:#D4AF37;border-radius:50%;animation:spin 1s linear infinite"></div></body></html>',
    },
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkIconObject(overrides = {}) {
  const id = genSbKonvaId('ico');
  return {
    id,
    type: 'icon',
    x: 500,
    y: 120,
    width: 64,
    height: 64,
    rotation: 0,
    layer: 2,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: { fill: '#D4AF37' },
    content: { glyph: '★', label: 'Étoile' },
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkTriangleObject(overrides = {}) {
  const id = genSbKonvaId('tri');
  return {
    id,
    type: 'triangle',
    x: 300,
    y: 200,
    width: 120,
    height: 120,
    rotation: 0,
    layer: 0,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: {
      fill: 'rgba(217, 119, 87,0.25)',
      stroke: '#d97757',
      strokeWidth: 2,
    },
    content: {},
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkStarShapeObject(overrides = {}) {
  const id = genSbKonvaId('star');
  return {
    id,
    type: 'starshape',
    x: 420,
    y: 200,
    width: 120,
    height: 120,
    rotation: 0,
    layer: 0,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: {
      fill: '#D4AF37',
      stroke: '',
      strokeWidth: 0,
      numPoints: 5,
    },
    content: {},
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkDiamondObject(overrides = {}) {
  const id = genSbKonvaId('dia');
  return {
    id,
    type: 'diamond',
    x: 350,
    y: 200,
    width: 130,
    height: 130,
    rotation: 0,
    layer: 0,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: {
      fill: 'rgba(20,184,166,0.25)',
      stroke: '#14b8a6',
      strokeWidth: 2,
    },
    content: {},
    ...overrides,
    id: overrides.id || id,
  };
}

export function mkEmojiObject(emoji = '✨', overrides = {}) {
  const id = genSbKonvaId('emoji');
  return {
    id,
    type: 'icon',
    x: 470,
    y: 100,
    width: 80,
    height: 80,
    rotation: 0,
    layer: 2,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: { fontSize: 64, fill: '#D4AF37' },
    content: { glyph: emoji, label: emoji },
    ...overrides,
    id: overrides.id || id,
  };
}

/**
 * Cree un tableau pedagogique (LIRI Sheet) — grille de cellules Konva.
 * data = tableau 2D de chaines. La premiere ligne est l'en-tete si headerRow=true.
 */
export function mkTableObject(overrides = {}) {
  const id = genSbKonvaId('tbl');
  const defaultData = [
    ['Colonne A', 'Colonne B', 'Colonne C'],
    ['Cellule 1', 'Cellule 2', 'Cellule 3'],
    ['Cellule 4', 'Cellule 5', 'Cellule 6'],
  ];
  return {
    id,
    type: 'table',
    x: 80,
    y: 120,
    width: 600,
    height: 200,
    rotation: 0,
    layer: 1,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    mindmapNodeId: '',
    masterScriptRef: '',
    sectionId: null,
    style: {
      headerBg: '#1a1f35',
      headerFill: '#f5dd8a',
      cellBg: '#0d1020',
      cellFill: '#e8e8e8',
      stroke: 'rgba(212,175,55,0.35)',
      strokeWidth: 1,
      fontSize: 14,
      fontFamily: 'Inter, system-ui, sans-serif',
      headerRow: true,
    },
    content: {
      data: defaultData,
    },
    ...overrides,
    id: overrides.id || id,
  };
}

/** Tri rendu : layer ascendant puis ordre d'insertion */
export function sortObjectsByLayer(objects) {
  return [...(objects || [])].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
}

/**
 * Sérialise le projet complet (multi-scènes) pour fichier .json
 * @param {import('./sceneTypes').SbKonvaProject} project
 */
export function serializeProject(project) {
  return JSON.stringify(project, null, 2);
}

/**
 * @param {string} json
 * @returns {import('./sceneTypes').SbKonvaProject}
 */
export function parseProjectJson(json) {
  const raw = JSON.parse(json);
  if (!raw.scenes || !Array.isArray(raw.scenes)) {
    throw new Error('JSON invalide : scenes manquant');
  }
  if (!raw.activeSceneId && raw.scenes[0]) {
    raw.activeSceneId = raw.scenes[0].id;
  }
  if (!raw.canvas) {
    raw.canvas = {
      width: SB_KONVA_CANVAS_W,
      height: SB_KONVA_CANVAS_H,
      background: 'transparent',
    };
  }
  return raw;
}
