/**
 * LIRI NeuroInk — traitement des tracés libres (lissage, snap droite, beautify léger).
 * Les points sont en coordonnées pixels du canvas ; le résultat reste dans le même repère.
 */

export const NEURO_INK_MODE = {
  FREE: 'free',
  ASSISTED: 'assisted',
  SHAPES: 'shapes',
  AUTO: 'auto',
};

export function defaultNeuroInkSettings() {
  return {
    mode: NEURO_INK_MODE.ASSISTED,
    stabilization: 45,
    beautify: 'medium',
    shapeDetection: true,
    snapStraight: true,
    curvePreserve: true,
    fidelity: 'medium',
  };
}

function clonePoints(points) {
  return (points || []).map((p) => [p[0], p[1]]);
}

/** Distance max d’un point à la droite (P0, P1). */
function maxChordDeviation(points) {
  if (points.length < 3) return 0;
  const [x0, y0] = points[0];
  const [x1, y1] = points[points.length - 1];
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1e-6) return Infinity;
  let max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const d = Math.abs((y1 - y0) * x - (x1 - x0) * y + x1 * y0 - y1 * x0) / len;
    if (d > max) max = d;
  }
  return max;
}

function chaikinOpen(points, iterations) {
  if (!points?.length || iterations <= 0) return clonePoints(points);
  let p = clonePoints(points);
  for (let it = 0; it < iterations; it++) {
    if (p.length < 2) break;
    const n = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i];
      const p1 = p[i + 1];
      n.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
      n.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
    }
    n.push(p[p.length - 1]);
    p = n;
  }
  return p;
}

function movingAverageOpen(points, window) {
  if (!points?.length || window < 3 || points.length < 3) return clonePoints(points);
  const half = Math.floor(window / 2);
  const out = [];
  for (let i = 0; i < points.length; i++) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      sx += points[j][0];
      sy += points[j][1];
      n++;
    }
    out.push([sx / n, sy / n]);
  }
  return out;
}

function beautifyPass(points, level) {
  if (level === 'off' || !points?.length) return clonePoints(points);
  const w = level === 'low' ? 3 : level === 'high' ? 7 : 5;
  let p = movingAverageOpen(points, w);
  if (level === 'high' && p.length >= 3) {
    p = movingAverageOpen(p, 5);
  }
  return p;
}

function stabilizationIterations(settings) {
  const st = Math.max(0, Math.min(100, Number(settings.stabilization) || 0));
  let cap = 3;
  if (settings.mode === NEURO_INK_MODE.FREE) {
    cap = 2;
  } else if (settings.mode === NEURO_INK_MODE.ASSISTED || settings.mode === NEURO_INK_MODE.AUTO) {
    cap = 4;
  } else if (settings.mode === NEURO_INK_MODE.SHAPES) {
    cap = 3;
  }
  let base = Math.round((st / 100) * cap);
  if (settings.fidelity === 'high') base = Math.max(0, base - 1);
  if (settings.fidelity === 'low') base = Math.min(cap, base + 1);
  if (settings.mode === NEURO_INK_MODE.FREE) {
    base = Math.min(base, Math.round((st / 100) * 2));
  }
  return Math.max(0, Math.min(cap, base));
}

function shouldTryStraightSnap(settings) {
  if (settings.mode === NEURO_INK_MODE.SHAPES) {
    return settings.snapStraight;
  }
  if (settings.mode === NEURO_INK_MODE.AUTO) {
    return settings.snapStraight || settings.shapeDetection;
  }
  if (settings.mode === NEURO_INK_MODE.ASSISTED) {
    return settings.snapStraight;
  }
  return false;
}

function trySnapToLine(points, canvasW, canvasH) {
  if (points.length < 2) return null;
  const [x0, y0] = points[0];
  const [x1, y1] = points[points.length - 1];
  const chord = Math.hypot(x1 - x0, y1 - y0);
  const minChord = Math.max(12, Math.min(canvasW, canvasH) * 0.02);
  if (chord < minChord) return null;
  const dev = maxChordDeviation(points);
  const ratio = dev / chord;
  const threshold = 0.07;
  if (ratio > threshold) return null;
  return [
    [x0, y0],
    [x1, y1],
  ];
}

function strokePerimeter(points) {
  let p = 0;
  for (let i = 1; i < points.length; i++) {
    p += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return p;
}

function isStrokeClosed(points, canvasW, canvasH) {
  if (points.length < 10) return false;
  const a = points[0];
  const b = points[points.length - 1];
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const perim = strokePerimeter(points);
  const scale = Math.min(canvasW, canvasH);
  if (perim < 1e-6) return false;
  return d < Math.max(10, 0.12 * perim) && d < 0.08 * scale;
}

function sampleCircle(cx, cy, r, steps) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
}

function sampleEllipse(cx, cy, rx, ry, steps) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return out;
}

function pointToSegDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-12) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * vx + (py - ay) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * vx;
  const qy = ay + t * vy;
  return Math.hypot(px - qx, py - qy);
}

function pointToLineDist(px, py, x0, y0, x1, y1) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  return Math.abs((y1 - y0) * px - (x1 - x0) * py + x1 * y0 - y1 * x0) / len;
}

function pointToRectPerimeterDist(px, py, minx, miny, maxx, maxy) {
  return Math.min(
    pointToSegDist(px, py, minx, miny, maxx, miny),
    pointToSegDist(px, py, maxx, miny, maxx, maxy),
    pointToSegDist(px, py, maxx, maxy, minx, maxy),
    pointToSegDist(px, py, minx, maxy, minx, miny),
  );
}

function cross2(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Enveloppe convexe (monotone chain), points distincts 2 décimales. */
function convexHull(points) {
  const seen = new Map();
  for (const [x, y] of points) {
    const k = `${x.toFixed(2)},${y.toFixed(2)}`;
    if (!seen.has(k)) seen.set(k, [x, y]);
  }
  const pts = Array.from(seen.values());
  if (pts.length < 3) return pts;
  pts.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross2(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross2(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function trySnapToRect(points, canvasW, canvasH) {
  if (!isStrokeClosed(points, canvasW, canvasH)) return null;
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  for (const [x, y] of points) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
  }
  const w = maxx - minx;
  const h = maxy - miny;
  if (w < 12 || h < 12) return null;
  const scale = Math.min(w, h);
  let sum = 0;
  for (const [x, y] of points) {
    sum += pointToRectPerimeterDist(x, y, minx, miny, maxx, maxy);
  }
  const meanErr = sum / points.length;
  if (meanErr / scale > 0.14) return null;
  const cornerTol = scale * 0.14;
  const corners = [
    [minx, miny],
    [maxx, miny],
    [maxx, maxy],
    [minx, maxy],
  ];
  let nearCorner = 0;
  for (const [cx, cy] of corners) {
    const ok = points.some(([x, y]) => Math.hypot(x - cx, y - cy) < cornerTol);
    if (ok) nearCorner += 1;
  }
  if (nearCorner < 2) return null;
  return [
    [minx, miny],
    [maxx, miny],
    [maxx, maxy],
    [minx, maxy],
    [minx, miny],
  ];
}

function trySnapToTriangle(points, canvasW, canvasH) {
  if (!isStrokeClosed(points, canvasW, canvasH)) return null;
  const hull = convexHull(points);
  if (hull.length !== 3) return null;
  const [a, b, c] = hull;
  const s1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const s2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const s3 = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const minSide = Math.min(s1, s2, s3);
  if (minSide < 12) return null;
  let err = 0;
  for (const [x, y] of points) {
    err += Math.min(
      pointToSegDist(x, y, a[0], a[1], b[0], b[1]),
      pointToSegDist(x, y, b[0], b[1], c[0], c[1]),
      pointToSegDist(x, y, c[0], c[1], a[0], a[1]),
    );
  }
  err /= points.length;
  if (err / minSide > 0.16) return null;
  return [[...a], [...b], [...c], [...a]];
}

function trySnapToArrow(points, canvasW, canvasH) {
  if (points.length < 12) return null;
  if (isStrokeClosed(points, canvasW, canvasH)) return null;

  const n = points.length;
  const lens = [];
  let acc = 0;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lens.push(d);
    acc += d;
  }
  const minArc = Math.max(28, Math.min(canvasW, canvasH) * 0.04);
  if (acc < minArc) return null;

  let cum = 0;
  let iSplit = n - 2;
  const target = acc * 0.72;
  for (let i = 0; i < lens.length; i++) {
    cum += lens[i];
    if (cum >= target) {
      iSplit = i + 1;
      break;
    }
  }
  iSplit = Math.max(4, Math.min(n - 4, iSplit));

  const [sx, sy] = points[0];
  const [ex, ey] = points[iSplit];
  const Ls = Math.hypot(ex - sx, ey - sy);
  if (Ls < 16) return null;

  let maxDevShaft = 0;
  for (let i = 1; i < iSplit; i++) {
    const d = pointToLineDist(points[i][0], points[i][1], sx, sy, ex, ey);
    if (d > maxDevShaft) maxDevShaft = d;
  }
  if (maxDevShaft / Ls > 0.11) return null;

  const [tx, ty] = points[n - 1];
  const tipDist = Math.hypot(tx - ex, ty - ey);
  if (tipDist < 5) return null;

  const vx = ex - sx;
  const vy = ey - sy;
  const vlen = Math.hypot(vx, vy) || 1;
  const ux = vx / vlen;
  const uy = vy / vlen;
  const px = -uy;
  const py = ux;

  let minSide = 0;
  let maxSide = 0;
  for (let i = iSplit; i < n; i++) {
    const [qx, qy] = points[i];
    const wx = qx - sx;
    const wy = qy - sy;
    const side = (vx * wy - vy * wx) / vlen;
    minSide = Math.min(minSide, side);
    maxSide = Math.max(maxSide, side);
  }
  const wing = maxSide - minSide;
  if (wing < Math.max(6, 0.06 * Ls)) return null;

  const headLen = Math.min(0.24 * Ls, Math.max(tipDist * 1.2, 10), 48);
  const baseX = tx - ux * headLen;
  const baseY = ty - uy * headLen;
  const halfW = Math.max(5, Math.min(0.2 * Ls, wing * 0.55));
  const leftX = baseX + px * halfW;
  const leftY = baseY + py * halfW;
  const rightX = baseX - px * halfW;
  const rightY = baseY - py * halfW;

  return [
    [sx, sy],
    [baseX, baseY],
    [leftX, leftY],
    [tx, ty],
    [rightX, rightY],
  ];
}

function trySnapToCircle(points, canvasW, canvasH) {
  if (!isStrokeClosed(points, canvasW, canvasH)) return null;
  let sx = 0;
  let sy = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    sx += points[i][0];
    sy += points[i][1];
  }
  const cx = sx / n;
  const cy = sy / n;
  const radii = points.map(([x, y]) => Math.hypot(x - cx, y - cy));
  const meanR = radii.reduce((a, b) => a + b, 0) / n;
  const minR = Math.max(10, Math.min(canvasW, canvasH) * 0.015);
  if (meanR < minR) return null;
  let varSum = 0;
  for (const r of radii) {
    varSum += (r - meanR) ** 2;
  }
  const stdR = Math.sqrt(varSum / n);
  if (stdR / meanR > 0.2) return null;
  return sampleCircle(cx, cy, meanR, 48);
}

function trySnapToEllipse(points, canvasW, canvasH) {
  if (!isStrokeClosed(points, canvasW, canvasH)) return null;
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  for (const [x, y] of points) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
  }
  const rx = (maxx - minx) / 2;
  const ry = (maxy - miny) / 2;
  if (rx < 8 || ry < 8) return null;
  const ar = Math.max(rx / ry, ry / rx);
  if (ar > 3.2) return null;
  const cx = (minx + maxx) / 2;
  const cy = (miny + maxy) / 2;
  let err = 0;
  for (const [x, y] of points) {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    err += Math.abs(nx * nx + ny * ny - 1);
  }
  err /= points.length;
  if (err > 0.28) return null;
  return sampleEllipse(cx, cy, rx, ry, 56);
}

function shouldTryClosedShapeSnap(settings) {
  if (!settings.shapeDetection) return false;
  if (settings.mode === NEURO_INK_MODE.FREE) return false;
  return true;
}

function shouldTryOpenShapeSnap(settings, points, canvasW, canvasH) {
  if (!settings.shapeDetection) return false;
  if (settings.mode === NEURO_INK_MODE.FREE) return false;
  if (isStrokeClosed(points, canvasW, canvasH)) return false;
  return true;
}

/**
 * @param {number[][]} points — [[x,y], ...] en pixels canvas
 * @param {ReturnType<typeof defaultNeuroInkSettings>} settings
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {{ forceStraightLine?: boolean }} [options] — `forceStraightLine` : ⌃/⌘ pendant le tracé → segment droit début→fin
 * @returns {number[][]}
 */
export function applyNeuroInkToFreePoints(points, settings, canvasW, canvasH, options = {}) {
  if (!points?.length) return [];
  const W = Math.max(1, canvasW);
  const H = Math.max(1, canvasH);

  let p = clonePoints(points);
  if (p.length === 1) return p;

  if (options.forceStraightLine && p.length >= 2) {
    const a = p[0];
    const b = p[p.length - 1];
    return [[a[0], a[1]], [b[0], b[1]]];
  }

  const curveOk = settings.curvePreserve !== false;
  const chord = Math.hypot(p[p.length - 1][0] - p[0][0], p[p.length - 1][1] - p[0][1]) || 1;
  const devRatio = maxChordDeviation(p) / chord;

  if (shouldTryStraightSnap(settings) && (!curveOk || devRatio <= 0.12)) {
    const snapped = trySnapToLine(p, W, H);
    if (snapped) return snapped;
  }

  if (shouldTryClosedShapeSnap(settings)) {
    const circle = trySnapToCircle(p, W, H);
    if (circle?.length) return circle;
    const rect = trySnapToRect(p, W, H);
    if (rect?.length) return rect;
    const ellipse = trySnapToEllipse(p, W, H);
    if (ellipse?.length) return ellipse;
    const tri = trySnapToTriangle(p, W, H);
    if (tri?.length) return tri;
  }

  if (shouldTryOpenShapeSnap(settings, p, W, H)) {
    const arrow = trySnapToArrow(p, W, H);
    if (arrow?.length) return arrow;
  }

  const iter = stabilizationIterations(settings);
  let beautifyLevel = settings.beautify;
  if (settings.mode === NEURO_INK_MODE.FREE) {
    beautifyLevel = 'off';
  }
  if (settings.mode === NEURO_INK_MODE.SHAPES && settings.shapeDetection) {
    beautifyLevel = beautifyLevel === 'off' ? 'low' : beautifyLevel;
  }

  p = chaikinOpen(p, iter);
  if (beautifyLevel !== 'off' && settings.mode !== NEURO_INK_MODE.FREE) {
    if (curveOk && devRatio > 0.18 && settings.mode === NEURO_INK_MODE.AUTO) {
      p = beautifyPass(p, 'low');
    } else {
      p = beautifyPass(p, beautifyLevel);
    }
  }

  if (p.length < 2 && points.length >= 2) {
    return [[points[0][0], points[0][1]], [points[points.length - 1][0], points[points.length - 1][1]]];
  }
  return p;
}
