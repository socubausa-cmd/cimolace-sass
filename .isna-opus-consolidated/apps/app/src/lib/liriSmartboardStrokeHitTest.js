/**
 * Sélection / gomme par zone — traits normalisés (`norm: true`) ou legacy pixels.
 */

function normBBoxLine(s) {
  const minx = Math.min(s.x1n, s.x2n);
  const maxx = Math.max(s.x1n, s.x2n);
  const miny = Math.min(s.y1n, s.y2n);
  const maxy = Math.max(s.y1n, s.y2n);
  return { minx, maxx, miny, maxy };
}

function normBBoxRectLike(s) {
  return {
    minx: s.xn,
    maxx: s.xn + s.wn,
    miny: s.yn,
    maxy: s.yn + s.hn,
  };
}

function aabbOverlap(a, b) {
  return !(a.maxx < b.minx || a.minx > b.maxx || a.maxy < b.miny || a.miny > b.maxy);
}

function legacyStrokeTouchesNormRect(stroke, rxn, ryn, rwn, rhn, cw, ch) {
  const W = Math.max(1, cw);
  const H = Math.max(1, ch);
  const rx2 = rxn + rwn;
  const ry2 = ryn + rhn;
  const sel = { minx: rxn, maxx: rx2, miny: ryn, maxy: ry2 };

  if (stroke.type === 'free' && Array.isArray(stroke.points)) {
    return stroke.points.some(([px, py]) => {
      const nx = px / W;
      const ny = py / H;
      return nx >= rxn && nx <= rx2 && ny >= ryn && ny <= ry2;
    });
  }

  if (stroke.type === 'line') {
    const minx = Math.min(stroke.x1, stroke.x2) / W;
    const maxx = Math.max(stroke.x1, stroke.x2) / W;
    const miny = Math.min(stroke.y1, stroke.y2) / H;
    const maxy = Math.max(stroke.y1, stroke.y2) / H;
    return aabbOverlap({ minx, maxx, miny, maxy }, sel);
  }

  if (stroke.type === 'rect' || stroke.type === 'ellipse') {
    const minx = stroke.x / W;
    const miny = stroke.y / H;
    const maxx = (stroke.x + stroke.w) / W;
    const maxy = (stroke.y + stroke.h) / H;
    return aabbOverlap({ minx, maxx, miny, maxy }, sel);
  }

  return false;
}

/**
 * Rectangle de sélection (norm) : [xn, yn, wn, hn] avec wn/hn ≥ 0.
 * @param {number} [cw] — largeur canvas (px) pour traits legacy sans `norm`
 * @param {number} [ch] — hauteur canvas (px)
 */
export function strokeTouchesNormRect(stroke, rxn, ryn, rwn, rhn, cw, ch) {
  if (!stroke) return false;
  const rx2 = rxn + rwn;
  const ry2 = ryn + rhn;

  if (stroke.norm) {
    if (stroke.type === 'free' && Array.isArray(stroke.points)) {
      return stroke.points.some(([nx, ny]) => nx >= rxn && nx <= rx2 && ny >= ryn && ny <= ry2);
    }

    if (stroke.type === 'line') {
      const b = normBBoxLine(stroke);
      const sel = { minx: rxn, maxx: rx2, miny: ryn, maxy: ry2 };
      return aabbOverlap(b, sel);
    }

    if (stroke.type === 'rect' || stroke.type === 'ellipse') {
      const b = normBBoxRectLike(stroke);
      const sel = { minx: rxn, maxx: rx2, miny: ryn, maxy: ry2 };
      return aabbOverlap(b, sel);
    }
    return false;
  }

  if (cw > 0 && ch > 0) {
    return legacyStrokeTouchesNormRect(stroke, rxn, ryn, rwn, rhn, cw, ch);
  }

  return false;
}

export function filterStrokesOutsideNormRect(strokes, rxn, ryn, rwn, rhn, cw, ch) {
  const list = Array.isArray(strokes) ? strokes : [];
  return list.filter((s) => !strokeTouchesNormRect(s, rxn, ryn, rwn, rhn, cw, ch));
}
