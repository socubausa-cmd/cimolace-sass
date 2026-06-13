/**
 * Fabriques de modèle SmartBoard (parité avec sceneModel.js du web).
 * Canevas de référence : 1037 × 750 (smartboardDesignCanvas).
 */
import type {
  SbKonvaObjectBase,
  SbKonvaProject,
  SbKonvaScene,
} from './types';

export const SB_CANVAS_W = 1037;
export const SB_CANVAS_H = 750;

let _seq = 0;
/** Identifiant stable sans dépendance externe (uuid non installé en mobile). */
export function genId(prefix = 'obj'): string {
  _seq += 1;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rnd}_${_seq}`;
}

export function createEmptyScene(name = 'Scène 1'): SbKonvaScene {
  return {
    id: genId('scene'),
    name,
    objects: [],
    sections: [],
    stateInitial: null,
  };
}

export function createEmptyProject(): SbKonvaProject {
  const scene = createEmptyScene('Scène 1');
  return {
    version: 1,
    canvas: { width: SB_CANVAS_W, height: SB_CANVAS_H, background: 'transparent' },
    scenes: [scene],
    activeSceneId: scene.id,
  };
}

const baseFields = (
  type: SbKonvaObjectBase['type'],
): Omit<SbKonvaObjectBase, 'id' | 'style' | 'content' | 'x' | 'y' | 'width' | 'height'> => ({
  type,
  rotation: 0,
  layer: 0,
  visible: true,
  locked: false,
  step: 0,
  visibleFor: 'both',
  mindmapNodeId: '',
  masterScriptRef: '',
  sectionId: null,
});

/** Tracé libre (pen) ou gomme : stocké en `line` avec une polyligne dans content.points. */
export function mkStroke(
  points: { x: number; y: number }[],
  opts: { color: string; width: number },
): SbKonvaObjectBase {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs, 0);
  const minY = Math.min(...ys, 0);
  return {
    id: genId('line'),
    ...baseFields('line'),
    x: 0,
    y: 0,
    width: Math.max(...xs, 0) - minX,
    height: Math.max(...ys, 0) - minY,
    style: { stroke: opts.color, strokeWidth: opts.width, lineCap: 'round', lineJoin: 'round' },
    content: { points },
  };
}

export function mkRect(
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { stroke: string; strokeWidth: number },
): SbKonvaObjectBase {
  return {
    id: genId('rect'),
    ...baseFields('rect'),
    x,
    y,
    width,
    height,
    style: { stroke: opts.stroke, strokeWidth: opts.strokeWidth, fill: 'transparent' },
    content: {},
  };
}

export function mkCircle(
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { stroke: string; strokeWidth: number },
): SbKonvaObjectBase {
  return {
    id: genId('circle'),
    ...baseFields('circle'),
    x,
    y,
    width,
    height,
    style: { stroke: opts.stroke, strokeWidth: opts.strokeWidth, fill: 'transparent' },
    content: {},
  };
}

export function mkText(
  x: number,
  y: number,
  text: string,
  opts: { color: string; fontSize: number },
): SbKonvaObjectBase {
  return {
    id: genId('txt'),
    ...baseFields('text'),
    x,
    y,
    width: 360,
    height: opts.fontSize * 1.4,
    style: { fill: opts.color, fontSize: opts.fontSize, fontWeight: 600 },
    content: { text },
  };
}

/** Lecture défensive d'un payload JSONB inconnu → SbKonvaProject valide. */
export function coerceProject(raw: unknown): SbKonvaProject {
  if (!raw || typeof raw !== 'object') return createEmptyProject();
  const p = raw as Partial<SbKonvaProject>;
  if (!Array.isArray(p.scenes) || p.scenes.length === 0) return createEmptyProject();
  const scenes: SbKonvaScene[] = p.scenes.map((s, i) => ({
    id: typeof s?.id === 'string' ? s.id : genId('scene'),
    name: typeof s?.name === 'string' ? s.name : `Scène ${i + 1}`,
    objects: Array.isArray(s?.objects) ? (s.objects as SbKonvaObjectBase[]) : [],
    sections: Array.isArray(s?.sections) ? s.sections : [],
    stateInitial: s?.stateInitial ?? null,
    durationMinutes: s?.durationMinutes,
  }));
  const activeSceneId =
    typeof p.activeSceneId === 'string' && scenes.some((s) => s.id === p.activeSceneId)
      ? p.activeSceneId
      : scenes[0].id;
  return {
    version: typeof p.version === 'number' ? p.version : 1,
    canvas: {
      width: p.canvas?.width ?? SB_CANVAS_W,
      height: p.canvas?.height ?? SB_CANVAS_H,
      background: p.canvas?.background ?? 'transparent',
    },
    scenes,
    activeSceneId,
  };
}

/** Extrait la liste de points d'un objet `line` (tracé / gomme). */
export function strokePoints(o: SbKonvaObjectBase): { x: number; y: number }[] {
  const pts = (o.content as { points?: unknown }).points;
  if (!Array.isArray(pts)) return [];
  return pts.filter(
    (p): p is { x: number; y: number } =>
      !!p && typeof (p as { x?: unknown }).x === 'number' && typeof (p as { y?: unknown }).y === 'number',
  );
}
