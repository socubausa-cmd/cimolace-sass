/**
 * Konva Engine — scene building, serialization, and state management helpers.
 * Pure logic layer — no React, no Konva imports. Used by components and stores.
 */
import type { DesignElement, BoardState, CanvasConfig } from '@/engines/types';

export const DESIGN_WIDTH = 1837;
export const DESIGN_HEIGHT = 1063;

export const DEFAULT_CANVAS: CanvasConfig = {
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  background: '#0f1117',
  gridEnabled: false,
  gridSize: 8,
  snapEnabled: false,
};

// ── Scale computation ────────────────────────────────────────────────────────

export function computeScale(containerWidth: number, containerHeight: number): number {
  const scaleX = containerWidth / DESIGN_WIDTH;
  const scaleY = containerHeight / DESIGN_HEIGHT;
  return Math.min(scaleX, scaleY);
}

// ── Element factories ────────────────────────────────────────────────────────

function genId() { return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

type TextOptions = { x?: number; y?: number; text?: string; fontSize?: number; fill?: string; sectionId?: string | null };
export function makeTextElement(opts: TextOptions = {}): DesignElement {
  return {
    id: genId(),
    type: 'text',
    x: opts.x ?? 100,
    y: opts.y ?? 100,
    width: 400,
    opacity: 1,
    locked: false,
    hidden: false,
    sectionId: opts.sectionId ?? null,
    data: { text: opts.text ?? 'Nouveau texte' },
    style: {
      fontSize: opts.fontSize ?? 24,
      fontFamily: 'Inter, system-ui, sans-serif',
      fill: opts.fill ?? '#ffffff',
      align: 'left',
    },
  };
}

type RectOptions = { x?: number; y?: number; width?: number; height?: number; fill?: string; stroke?: string; sectionId?: string | null };
export function makeRectElement(opts: RectOptions = {}): DesignElement {
  return {
    id: genId(),
    type: 'shape',
    x: opts.x ?? 200,
    y: opts.y ?? 200,
    width: opts.width ?? 200,
    height: opts.height ?? 120,
    opacity: 1,
    locked: false,
    hidden: false,
    sectionId: opts.sectionId ?? null,
    data: { shape: 'rect' },
    style: {
      fill: opts.fill ?? '#1e293b',
      stroke: opts.stroke ?? '#334155',
      strokeWidth: 1,
      cornerRadius: 8,
    },
  };
}

type ImageOptions = { x?: number; y?: number; width?: number; height?: number; url: string; sectionId?: string | null };
export function makeImageElement(opts: ImageOptions): DesignElement {
  return {
    id: genId(),
    type: 'image',
    x: opts.x ?? 100,
    y: opts.y ?? 100,
    width: opts.width ?? 400,
    height: opts.height ?? 300,
    opacity: 1,
    locked: false,
    hidden: false,
    sectionId: opts.sectionId ?? null,
    data: { url: opts.url },
    style: {},
  };
}

// ── Serialization ────────────────────────────────────────────────────────────

export function serializeScene(elements: DesignElement[], canvas: CanvasConfig = DEFAULT_CANVAS): BoardState {
  return {
    elements: structuredClone(elements),
  };
}

export function deserializeScene(state: BoardState): DesignElement[] {
  return structuredClone(state.elements ?? []);
}

// ── Layout helpers ───────────────────────────────────────────────────────────

/**
 * Returns the bounding box of a set of elements.
 */
export function getBoundingBox(elements: DesignElement[]): { x: number; y: number; width: number; height: number } | null {
  if (elements.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width ?? 0));
    maxY = Math.max(maxY, el.y + (el.height ?? 0));
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Aligns elements to a reference axis.
 */
export type AlignAxis = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV';

export function alignElements(elements: DesignElement[], selectedIds: string[], axis: AlignAxis): DesignElement[] {
  const selected = elements.filter((e) => selectedIds.includes(e.id));
  const bbox = getBoundingBox(selected);
  if (!bbox || selected.length < 2) return elements;

  return elements.map((el) => {
    if (!selectedIds.includes(el.id)) return el;
    switch (axis) {
      case 'left': return { ...el, x: bbox.x };
      case 'right': return { ...el, x: bbox.x + bbox.width - (el.width ?? 0) };
      case 'top': return { ...el, y: bbox.y };
      case 'bottom': return { ...el, y: bbox.y + bbox.height - (el.height ?? 0) };
      case 'centerH': return { ...el, x: bbox.x + bbox.width / 2 - (el.width ?? 0) / 2 };
      case 'centerV': return { ...el, y: bbox.y + bbox.height / 2 - (el.height ?? 0) / 2 };
      default: return el;
    }
  });
}

/**
 * Snaps a value to the nearest grid position.
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Checks if two elements overlap.
 */
export function doElementsOverlap(a: DesignElement, b: DesignElement): boolean {
  const aRight = a.x + (a.width ?? 0);
  const aBottom = a.y + (a.height ?? 0);
  const bRight = b.x + (b.width ?? 0);
  const bBottom = b.y + (b.height ?? 0);
  return a.x < bRight && aRight > b.x && a.y < bBottom && aBottom > b.y;
}
