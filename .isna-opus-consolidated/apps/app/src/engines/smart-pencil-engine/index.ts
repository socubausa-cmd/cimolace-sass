/**
 * Smart Pencil Engine — free drawing, smoothing, shape recognition.
 * Pipeline: raw stroke → smoothed → recognized shape → clean path
 */
import type { DesignElement } from '@/engines/types';
import type { Point, PathData, AnchorPoint } from '@/engines/vector-engine';

// ── Types ────────────────────────────────────────────────────────────────────

export type RawStroke = {
  id: string;
  points: Point[];
  pressure?: number[];
  timestamp: number;
};

export type SmoothedStroke = {
  id: string;
  points: Point[];
};

export type RecognizedShape =
  | { type: 'line'; start: Point; end: Point; confidence: number }
  | { type: 'rect'; x: number; y: number; width: number; height: number; confidence: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; confidence: number }
  | { type: 'triangle'; points: [Point, Point, Point]; confidence: number }
  | { type: 'arrow'; start: Point; end: Point; confidence: number }
  | { type: 'freeform'; path: PathData; confidence: number };

export type ShapeVariant = {
  id: string;
  shape: RecognizedShape;
  label: string;
};

// ── Smoothing ─────────────────────────────────────────────────────────────────

const SMOOTHING_FACTOR = 0.3;

/**
 * Applies Chaikin's algorithm for stroke smoothing.
 */
export function smoothStroke(points: Point[], iterations = 2): Point[] {
  let pts = points;
  for (let i = 0; i < iterations; i++) {
    const smoothed: Point[] = [];
    for (let j = 0; j < pts.length - 1; j++) {
      const p0 = pts[j];
      const p1 = pts[j + 1];
      smoothed.push({
        x: p0.x * (1 - SMOOTHING_FACTOR) + p1.x * SMOOTHING_FACTOR,
        y: p0.y * (1 - SMOOTHING_FACTOR) + p1.y * SMOOTHING_FACTOR,
      });
      smoothed.push({
        x: p0.x * SMOOTHING_FACTOR + p1.x * (1 - SMOOTHING_FACTOR),
        y: p0.y * SMOOTHING_FACTOR + p1.y * (1 - SMOOTHING_FACTOR),
      });
    }
    if (pts.length > 0) smoothed.push(pts[pts.length - 1]);
    pts = smoothed;
  }
  return pts;
}

/**
 * Douglas-Peucker stroke simplification.
 */
export function simplifyStroke(points: Point[], tolerance = 2): Point[] {
  if (points.length <= 2) return points;

  const dmax = points.reduce((max, p, i) => {
    if (i === 0 || i === points.length - 1) return max;
    const d = perpendicularDistance(p, points[0], points[points.length - 1]);
    return Math.max(max, d);
  }, 0);

  if (dmax < tolerance) return [points[0], points[points.length - 1]];

  const splitIdx = points.reduce((maxIdx, p, i) => {
    if (i === 0 || i === points.length - 1) return maxIdx;
    const d = perpendicularDistance(p, points[0], points[points.length - 1]);
    return d > perpendicularDistance(points[maxIdx], points[0], points[points.length - 1]) ? i : maxIdx;
  }, 1);

  return [
    ...simplifyStroke(points.slice(0, splitIdx + 1), tolerance),
    ...simplifyStroke(points.slice(splitIdx), tolerance).slice(1),
  ];
}

function perpendicularDistance(p: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return Math.sqrt((p.x - start.x) ** 2 + (p.y - start.y) ** 2);
  return Math.abs(dx * (start.y - p.y) - (start.x - p.x) * dy) / mag;
}

// ── Shape recognition ─────────────────────────────────────────────────────────

function getBoundingBox(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  const width = Math.max(...xs) - x, height = Math.max(...ys) - y;
  return { x, y, width, height };
}

function strokeLength(points: Point[]): number {
  return points.slice(1).reduce((acc, p, i) => {
    const prev = points[i];
    return acc + Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
  }, 0);
}

/**
 * Recognizes the shape from a stroke.
 */
export function recognizeShape(points: Point[]): RecognizedShape {
  if (points.length < 2) {
    return { type: 'freeform', path: { anchors: [], closed: false }, confidence: 0 };
  }

  const simplified = simplifyStroke(points, 5);
  const bbox = getBoundingBox(points);
  const len = strokeLength(points);
  const diagonal = Math.sqrt(bbox.width ** 2 + bbox.height ** 2);
  const lineRatio = diagonal / len;

  // Line detection
  if (lineRatio > 0.85 && simplified.length <= 3) {
    return {
      type: 'line',
      start: points[0],
      end: points[points.length - 1],
      confidence: lineRatio,
    };
  }

  // Rectangle detection
  if (simplified.length >= 4 && simplified.length <= 6) {
    const perimeterRatio = (2 * (bbox.width + bbox.height)) / len;
    if (perimeterRatio > 0.75) {
      return {
        type: 'rect',
        x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
        confidence: perimeterRatio,
      };
    }
  }

  // Ellipse detection (roughly circular strokes)
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const avgR = (bbox.width + bbox.height) / 4;
  const circlePerimeter = 2 * Math.PI * avgR;
  const circleRatio = circlePerimeter / len;
  if (circleRatio > 0.7 && circleRatio < 1.3) {
    return {
      type: 'ellipse',
      cx, cy, rx: bbox.width / 2, ry: bbox.height / 2,
      confidence: 1 - Math.abs(1 - circleRatio),
    };
  }

  // Freeform fallback
  const anchors: AnchorPoint[] = simplified.map((p) => ({
    id: `pt-${Math.random().toString(36).slice(2, 6)}`,
    position: p,
    type: 'corner' as const,
  }));
  return { type: 'freeform', path: { anchors, closed: false }, confidence: 0.5 };
}

/**
 * Generates 5 shape variant suggestions from a recognized shape.
 */
export function suggestShapeVariants(recognized: RecognizedShape): ShapeVariant[] {
  const id = () => Math.random().toString(36).slice(2, 7);
  const variants: ShapeVariant[] = [{ id: id(), shape: recognized, label: 'Original' }];

  if (recognized.type === 'line') {
    variants.push({ id: id(), shape: { ...recognized, type: 'arrow' }, label: 'Fleche' });
  }
  if (recognized.type === 'rect') {
    const { x, y, width, height } = recognized;
    variants.push({ id: id(), shape: { type: 'ellipse', cx: x + width / 2, cy: y + height / 2, rx: width / 2, ry: height / 2, confidence: 0.9 }, label: 'Ellipse' });
    variants.push({ id: id(), shape: { type: 'triangle', points: [{ x: x + width / 2, y }, { x: x + width, y: y + height }, { x, y: y + height }], confidence: 0.9 }, label: 'Triangle' });
  }

  // Pad to 5 variants
  while (variants.length < 5) {
    variants.push({ id: id(), shape: recognized, label: `Variante ${variants.length}` });
  }

  return variants.slice(0, 5);
}

// ── Stroke → DesignElement conversion ────────────────────────────────────────

function genElId() { return `pencil-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

/**
 * Converts a recognized shape to a DesignElement ready to insert into the canvas.
 */
export function recognizedShapeToElement(shape: RecognizedShape): DesignElement | null {
  switch (shape.type) {
    case 'line':
    case 'arrow':
      return {
        id: genElId(), type: 'line',
        x: Math.min(shape.start.x, shape.end.x),
        y: Math.min(shape.start.y, shape.end.y),
        opacity: 1, locked: false, hidden: false, sectionId: null,
        data: { points: [shape.start.x, shape.start.y, shape.end.x, shape.end.y], isArrow: shape.type === 'arrow' },
        style: { stroke: '#ffffff', strokeWidth: 2 },
      };
    case 'rect':
      return {
        id: genElId(), type: 'shape',
        x: shape.x, y: shape.y, width: shape.width, height: shape.height,
        opacity: 1, locked: false, hidden: false, sectionId: null,
        data: { shape: 'rect' },
        style: { fill: 'transparent', stroke: '#ffffff', strokeWidth: 2 },
      };
    case 'ellipse':
      return {
        id: genElId(), type: 'shape',
        x: shape.cx - shape.rx, y: shape.cy - shape.ry, width: shape.rx * 2, height: shape.ry * 2,
        opacity: 1, locked: false, hidden: false, sectionId: null,
        data: { shape: 'ellipse' },
        style: { fill: 'transparent', stroke: '#ffffff', strokeWidth: 2 },
      };
    case 'freeform':
      return {
        id: genElId(), type: 'path',
        x: 0, y: 0,
        opacity: 1, locked: false, hidden: false, sectionId: null,
        data: { pathData: shape.path },
        style: { stroke: '#ffffff', strokeWidth: 2, fill: 'transparent' },
      };
    default:
      return null;
  }
}
