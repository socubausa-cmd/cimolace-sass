/**
 * Sémantique placement vs manipulation (drag/transform géré séparément sur le stage).
 * @param {{ type?: string; content?: { points?: number[] } }} obj
 * @returns {{ kind: 'placement'; semantic: string; objectType: string }}
 */
export function classifyCanvasPlacement(obj) {
  const t = obj?.type || 'unknown';
  if (t === 'line' || t === 'arrow') {
    const pts = obj?.content?.points;
    const n = Array.isArray(pts) ? pts.length : 0;
    if (n > 4) {
      return { kind: 'placement', semantic: 'stroke_polyline', objectType: t };
    }
    return { kind: 'placement', semantic: 'stroke_segment', objectType: t };
  }
  if (t === 'rect' || t === 'circle' || t === 'ellipse' || t === 'triangle' || t === 'star' || t === 'diamond' || t === 'table') {
    return { kind: 'placement', semantic: 'block_shape', objectType: t };
  }
  if (t === 'text' || t === 'html' || t === 'icon' || t === 'emoji') {
    return { kind: 'placement', semantic: 'block_content', objectType: t };
  }
  if (t === 'image') {
    return { kind: 'placement', semantic: 'block_image', objectType: t };
  }
  return { kind: 'placement', semantic: 'other', objectType: t };
}
