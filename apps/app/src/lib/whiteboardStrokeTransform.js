/**
 * Décale un trait (et les groupes récursivement) pour duplication / collage.
 */

function offPt(dx, dy, x, y) {
  return [x + dx, y + dy];
}

export function offsetWhiteboardStroke(stroke, dx, dy) {
  if (!stroke || typeof stroke !== 'object') return stroke;
  const k = stroke.kind || 'path';

  if (k === 'group') {
    const inner = Array.isArray(stroke.strokes) ? stroke.strokes : [];
    return {
      ...stroke,
      strokes: inner.map((s) => offsetWhiteboardStroke(s, dx, dy)),
    };
  }

  if (k === 'path') {
    const pts = Array.isArray(stroke.points) ? stroke.points : [];
    return {
      ...stroke,
      points: pts.map(([x, y]) => offPt(dx, dy, x, y)),
    };
  }

  if (k === 'text') {
    return { ...stroke, x: (stroke.x ?? 0) + dx, y: (stroke.y ?? 0) + dy };
  }

  if (k === 'rect') {
    return { ...stroke, x: (stroke.x ?? 0) + dx, y: (stroke.y ?? 0) + dy };
  }

  if (k === 'circle') {
    return { ...stroke, cx: (stroke.cx ?? 0) + dx, cy: (stroke.cy ?? 0) + dy };
  }

  if (k === 'line') {
    return {
      ...stroke,
      x1: (stroke.x1 ?? 0) + dx,
      y1: (stroke.y1 ?? 0) + dy,
      x2: (stroke.x2 ?? 0) + dx,
      y2: (stroke.y2 ?? 0) + dy,
    };
  }

  if (k === 'quadratic') {
    return {
      ...stroke,
      x0: (stroke.x0 ?? 0) + dx,
      y0: (stroke.y0 ?? 0) + dy,
      cx: (stroke.cx ?? 0) + dx,
      cy: (stroke.cy ?? 0) + dy,
      x1: (stroke.x1 ?? 0) + dx,
      y1: (stroke.y1 ?? 0) + dy,
    };
  }

  if (k === 'image') {
    return {
      ...stroke,
      x: (stroke.x ?? 0) + dx,
      y: (stroke.y ?? 0) + dy,
    };
  }

  return stroke;
}

export function offsetWhiteboardStrokes(strokes, dx, dy) {
  if (!Array.isArray(strokes)) return [];
  return strokes.map((s) => offsetWhiteboardStroke(s, dx, dy));
}

export function cloneStrokesDeep(strokes) {
  try {
    return JSON.parse(JSON.stringify(strokes));
  } catch {
    return [];
  }
}
