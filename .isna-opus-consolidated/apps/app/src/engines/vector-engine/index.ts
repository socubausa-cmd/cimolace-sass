/**
 * Vector Engine — SVG path editing, anchor points, bezier handles, boolean ops.
 */
import type { DesignElement } from '@/engines/types';

// ── Types ────────────────────────────────────────────────────────────────────

export type Point = { x: number; y: number };

export type AnchorPoint = {
  id: string;
  position: Point;
  handleIn?: Point;
  handleOut?: Point;
  type: 'smooth' | 'corner' | 'symmetric';
};

export type PathData = {
  anchors: AnchorPoint[];
  closed: boolean;
};

export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

// ── Path builders ─────────────────────────────────────────────────────────────

function genId() { return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; }

/**
 * Creates a simple rectangular path with 4 anchor points.
 */
export function buildRectPath(x: number, y: number, w: number, h: number): PathData {
  return {
    closed: true,
    anchors: [
      { id: genId(), position: { x, y }, type: 'corner' },
      { id: genId(), position: { x: x + w, y }, type: 'corner' },
      { id: genId(), position: { x: x + w, y: y + h }, type: 'corner' },
      { id: genId(), position: { x, y: y + h }, type: 'corner' },
    ],
  };
}

/**
 * Creates a circle approximation path (4 bezier anchors).
 */
export function buildCirclePath(cx: number, cy: number, r: number): PathData {
  const k = r * 0.5523; // bezier control constant
  return {
    closed: true,
    anchors: [
      { id: genId(), position: { x: cx, y: cy - r }, handleIn: { x: cx - k, y: cy - r }, handleOut: { x: cx + k, y: cy - r }, type: 'smooth' },
      { id: genId(), position: { x: cx + r, y: cy }, handleIn: { x: cx + r, y: cy - k }, handleOut: { x: cx + r, y: cy + k }, type: 'smooth' },
      { id: genId(), position: { x: cx, y: cy + r }, handleIn: { x: cx + k, y: cy + r }, handleOut: { x: cx - k, y: cy + r }, type: 'smooth' },
      { id: genId(), position: { x: cx - r, y: cy }, handleIn: { x: cx - r, y: cy + k }, handleOut: { x: cx - r, y: cy - k }, type: 'smooth' },
    ],
  };
}

// ── SVG serialization ─────────────────────────────────────────────────────────

/**
 * Converts PathData to an SVG path string.
 */
export function pathDataToSvgD(path: PathData): string {
  if (path.anchors.length === 0) return '';
  const parts: string[] = [];
  const [first, ...rest] = path.anchors;
  parts.push(`M ${first.position.x} ${first.position.y}`);

  for (let i = 0; i < rest.length; i++) {
    const prev = path.anchors[i];
    const curr = rest[i];
    if (prev.handleOut && curr.handleIn) {
      parts.push(`C ${prev.handleOut.x} ${prev.handleOut.y} ${curr.handleIn.x} ${curr.handleIn.y} ${curr.position.x} ${curr.position.y}`);
    } else if (prev.handleOut) {
      parts.push(`Q ${prev.handleOut.x} ${prev.handleOut.y} ${curr.position.x} ${curr.position.y}`);
    } else {
      parts.push(`L ${curr.position.x} ${curr.position.y}`);
    }
  }

  if (path.closed) {
    const last = path.anchors[path.anchors.length - 1];
    const curr = path.anchors[0];
    if (last.handleOut && curr.handleIn) {
      parts.push(`C ${last.handleOut.x} ${last.handleOut.y} ${curr.handleIn.x} ${curr.handleIn.y} ${curr.position.x} ${curr.position.y}`);
    }
    parts.push('Z');
  }

  return parts.join(' ');
}

// ── Anchor manipulation ───────────────────────────────────────────────────────

/**
 * Moves an anchor point and updates its handles relatively.
 */
export function moveAnchor(path: PathData, anchorId: string, delta: Point): PathData {
  return {
    ...path,
    anchors: path.anchors.map((a) => {
      if (a.id !== anchorId) return a;
      return {
        ...a,
        position: { x: a.position.x + delta.x, y: a.position.y + delta.y },
        handleIn: a.handleIn ? { x: a.handleIn.x + delta.x, y: a.handleIn.y + delta.y } : undefined,
        handleOut: a.handleOut ? { x: a.handleOut.x + delta.x, y: a.handleOut.y + delta.y } : undefined,
      };
    }),
  };
}

/**
 * Updates the handle of an anchor point.
 */
export function updateHandle(path: PathData, anchorId: string, which: 'in' | 'out', point: Point): PathData {
  return {
    ...path,
    anchors: path.anchors.map((a) => {
      if (a.id !== anchorId) return a;
      if (which === 'in') return { ...a, handleIn: point };
      return { ...a, handleOut: point };
    }),
  };
}

/**
 * Adds an anchor at a given position.
 */
export function addAnchor(path: PathData, afterIndex: number, position: Point): PathData {
  const newAnchor: AnchorPoint = { id: genId(), position, type: 'corner' };
  const anchors = [...path.anchors];
  anchors.splice(afterIndex + 1, 0, newAnchor);
  return { ...path, anchors };
}

/**
 * Removes an anchor by ID.
 */
export function removeAnchor(path: PathData, anchorId: string): PathData {
  return { ...path, anchors: path.anchors.filter((a) => a.id !== anchorId) };
}

// ── Shape conversion ──────────────────────────────────────────────────────────

/**
 * Converts a DesignElement (shape/rect/ellipse) to a PathData.
 */
export function elementToPath(element: DesignElement): PathData | null {
  const { type, x, y, width = 100, height = 100, data } = element;

  if (type === 'shape') {
    const shape = (data as Record<string, string>).shape ?? 'rect';
    if (shape === 'rect') return buildRectPath(x, y, width, height);
    if (shape === 'ellipse') return buildCirclePath(x + width / 2, y + height / 2, Math.min(width, height) / 2);
  }

  if (type === 'path') {
    const pathData = (data as Record<string, PathData>).pathData;
    return pathData ?? null;
  }

  return null;
}
