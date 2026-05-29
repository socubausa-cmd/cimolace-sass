/**
 * LIRI Konva Pro Presets Pack V1 — conversion nœuds pack → objets scène SmartBoard Konva.
 */
import packMeta from '../data/konva-pro-pack-v1/pack-meta.json';
import textPresetsBatch1 from '../data/konva-pro-pack-v1/text-presets-batch-1.json';
import textPresetsBatch2 from '../data/konva-pro-pack-v1/text-presets-batch-2.json';
import textPresetsBatch3 from '../data/konva-pro-pack-v1/text-presets-batch-3.json';
import textPresetsBatch4 from '../data/konva-pro-pack-v1/text-presets-batch-4.json';
import elementsBatch1 from '../data/konva-pro-pack-v1/elements-batch-1.json';
import elementsBatch2 from '../data/konva-pro-pack-v1/elements-batch-2.json';
import elementsBatch3 from '../data/konva-pro-pack-v1/elements-batch-3.json';
import elementsBatch4 from '../data/konva-pro-pack-v1/elements-batch-4.json';
import starterLayouts from '../data/konva-pro-pack-v1/starter-layouts.json';
import {
  mkTextObject,
  mkRectObject,
  mkCircleObject,
  mkLineObject,
  mkArrowObject,
  mkEllipseObject,
} from '../model/sceneModel';

export const LIRI_KONVA_PRO_PRESETS_PACK_V1 = {
  meta: packMeta.meta,
  styleTokens: packMeta.styleTokens,
  textPresets: [
    ...textPresetsBatch1,
    ...textPresetsBatch2,
    ...textPresetsBatch3,
    ...textPresetsBatch4,
  ],
  elements: [...elementsBatch1, ...elementsBatch2, ...elementsBatch3, ...elementsBatch4],
  starterLayouts,
};

function estimateTextSize(attrs) {
  const text = String(attrs.text || '');
  const lines = Math.max(1, text.split('\n').length);
  const fs = Number(attrs.fontSize) || 24;
  const lh = Number(attrs.lineHeight) || 1.25;
  const w =
    attrs.width != null
      ? Number(attrs.width)
      : Math.min(920, Math.max(120, text.length * fs * 0.32));
  const h =
    attrs.height != null
      ? Number(attrs.height)
      : Math.max(fs * lh * lines * 1.12, fs * 1.35);
  return { width: w, height: h };
}

/**
 * @param {{ type: string; attrs?: Record<string, unknown> }} node
 * @param {number} layer
 */
export function konvaPackNodeToSceneObject(node, layer = 1) {
  const type = node?.type;
  const a = node?.attrs || {};
  switch (type) {
    case 'Text': {
      const { width, height } = estimateTextSize(a);
      const fs = String(a.fontStyle || '');
      const bold = fs === 'bold' || fs.includes('bold');
      const italic = fs.includes('italic');
      return mkTextObject({
        x: a.x ?? 0,
        y: a.y ?? 0,
        width,
        height,
        layer,
        rotation: a.rotation ?? 0,
        style: {
          fontFamily: a.fontFamily ? `${a.fontFamily}, system-ui, sans-serif` : 'Inter, system-ui, sans-serif',
          fontSize: a.fontSize ?? 24,
          fontWeight: bold ? 700 : 400,
          fontStyle: italic ? 'italic' : 'normal',
          fill: a.fill ?? '#0F172A',
          align: a.align || 'left',
          lineHeight: a.lineHeight ?? 1.25,
          letterSpacing: typeof a.letterSpacing === 'number' ? a.letterSpacing : undefined,
          shadowColor: a.shadowColor,
          shadowBlur: a.shadowBlur ?? 0,
          shadowOffsetX: a.shadowOffsetX ?? 0,
          shadowOffsetY: a.shadowOffsetY ?? 0,
          shadowOpacity: typeof a.shadowOpacity === 'number' ? a.shadowOpacity : undefined,
          opacity: typeof a.opacity === 'number' ? a.opacity : undefined,
        },
        content: { text: a.text ?? '' },
      });
    }
    case 'Rect':
      return mkRectObject({
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        layer,
        rotation: a.rotation ?? 0,
        style: {
          fill: a.fill,
          stroke: a.stroke,
          strokeWidth: a.strokeWidth ?? 0,
          cornerRadius: Array.isArray(a.cornerRadius) ? a.cornerRadius : a.cornerRadius ?? 0,
          shadowColor: a.shadowColor,
          shadowBlur: a.shadowBlur ?? 0,
          dash: Array.isArray(a.dash) ? a.dash : undefined,
          opacity: typeof a.opacity === 'number' ? a.opacity : undefined,
        },
      });
    case 'Circle': {
      const r = a.radius ?? 20;
      const cx = a.x;
      const cy = a.y;
      return mkCircleObject({
        x: cx - r,
        y: cy - r,
        width: r * 2,
        height: r * 2,
        layer,
        rotation: a.rotation ?? 0,
        style: {
          fill: a.fill,
          stroke: a.stroke,
          strokeWidth: a.strokeWidth ?? 0,
        },
      });
    }
    case 'Line': {
      const pts = a.points || [0, 0, 100, 0];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        minX = Math.min(minX, pts[i]);
        minY = Math.min(minY, pts[i + 1]);
        maxX = Math.max(maxX, pts[i]);
        maxY = Math.max(maxY, pts[i + 1]);
      }
      const rel = [];
      for (let i = 0; i < pts.length; i += 2) {
        rel.push(pts[i] - minX, pts[i + 1] - minY);
      }
      return mkLineObject({
        x: minX,
        y: minY,
        width: Math.max(14, maxX - minX),
        height: Math.max(14, maxY - minY),
        layer,
        rotation: a.rotation ?? 0,
        style: {
          stroke: a.stroke ?? '#64748b',
          strokeWidth: a.strokeWidth ?? 2,
          lineCap: a.lineCap || 'round',
          opacity: typeof a.opacity === 'number' ? a.opacity : 1,
          hitStrokeWidth: 16,
        },
        content: { points: rel },
      });
    }
    case 'Arrow': {
      const pts = a.points || [0, 0, 100, 0];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        minX = Math.min(minX, pts[i]);
        minY = Math.min(minY, pts[i + 1]);
        maxX = Math.max(maxX, pts[i]);
        maxY = Math.max(maxY, pts[i + 1]);
      }
      const rel = [];
      for (let i = 0; i < pts.length; i += 2) {
        rel.push(pts[i] - minX, pts[i + 1] - minY);
      }
      const stroke = a.stroke ?? '#64748b';
      return mkArrowObject({
        x: minX,
        y: minY,
        width: Math.max(14, maxX - minX),
        height: Math.max(14, maxY - minY),
        layer,
        rotation: a.rotation ?? 0,
        style: {
          stroke,
          fill: a.fill ?? stroke,
          strokeWidth: a.strokeWidth ?? 2,
          lineCap: a.lineCap || 'round',
          pointerLength: typeof a.pointerLength === 'number' ? a.pointerLength : 10,
          pointerWidth: typeof a.pointerWidth === 'number' ? a.pointerWidth : 10,
          opacity: typeof a.opacity === 'number' ? a.opacity : 1,
          hitStrokeWidth: 16,
        },
        content: { points: rel },
      });
    }
    case 'Ellipse': {
      const rx = a.radiusX ?? 50;
      const ry = a.radiusY ?? 30;
      const cx = a.x;
      const cy = a.y;
      return mkEllipseObject({
        x: cx - rx,
        y: cy - ry,
        width: rx * 2,
        height: ry * 2,
        layer,
        rotation: a.rotation ?? 0,
        style: {
          fill: a.fill,
          stroke: a.stroke,
          strokeWidth: a.strokeWidth ?? 0,
          shadowColor: a.shadowColor,
          shadowBlur: a.shadowBlur ?? 0,
        },
      });
    }
    default:
      return null;
  }
}

/**
 * @param {{ nodes?: unknown[] }} preset
 */
export function packPresetToSceneObjects(preset) {
  const nodes = preset?.nodes || [];
  return nodes
    .map((node, i) => konvaPackNodeToSceneObject(node, i + 1))
    .filter(Boolean);
}

export function findTextPresetById(id) {
  return LIRI_KONVA_PRO_PRESETS_PACK_V1.textPresets.find((p) => p.id === id) || null;
}

export function findElementPresetById(id) {
  return LIRI_KONVA_PRO_PRESETS_PACK_V1.elements.find((p) => p.id === id) || null;
}

export function findStarterLayoutById(id) {
  return LIRI_KONVA_PRO_PRESETS_PACK_V1.starterLayouts.find((p) => p.id === id) || null;
}

/**
 * @param {string} layoutId
 * @returns {import('../model/sceneTypes').SbKonvaObjectBase[]}
 */
export function starterLayoutToSceneObjects(layoutId) {
  const layout = findStarterLayoutById(layoutId);
  if (!layout?.recipe?.length) return [];
  const out = [];
  for (const refId of layout.recipe) {
    const tp = findTextPresetById(refId);
    const el = findElementPresetById(refId);
    const preset = tp || el;
    if (preset) out.push(...packPresetToSceneObjects(preset));
  }
  return out;
}
