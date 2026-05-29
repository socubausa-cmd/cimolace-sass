/**
 * Traits scolaires — tableau blanc live.
 * Kinds : arrow, polyline, polygon, triangle, star, frame, axes, numberline, table, ruler, protractor, latex
 */

/* ── helpers locaux ──────────────────────────────────────────────────────── */
function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(255,255,255,${alpha})`;
  const h = hex.slice(1);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return `rgba(255,255,255,${alpha})`;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1; const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function arrowHead(ctx, x, y, angle, size, color) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - Math.PI / 7), y - size * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x - size * Math.cos(angle + Math.PI / 7), y - size * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/* ── LaTeX / KaTeX async ──────────────────────────────────────────────────── */
export const latexDecodeListeners = new Set();
const _latexCache = new Map();

function latexKey(s) {
  return `${s.formula}|${s.color || '#fff'}|${s.fontSize || 24}|${s.displayMode ? 'd' : 'i'}`;
}

export function getOrRenderLatexImage(stroke) {
  const key = latexKey(stroke);
  const cached = _latexCache.get(key);
  if (cached) return cached;
  const entry = { ready: false, img: null, failed: false };
  _latexCache.set(key, entry);
  (async () => {
    try {
      const katexMod = await import('katex');
      const katex = katexMod.default ?? katexMod;
      const html = katex.renderToString(String(stroke.formula || ''), {
        throwOnError: false,
        output: 'html',
        displayMode: stroke.displayMode === true,
      });
      const fontSize = stroke.fontSize || 24;
      const color = stroke.color || '#ffffff';
      const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="240">
        <foreignObject width="900" height="240">
          <div xmlns="http://www.w3.org/1999/xhtml"
               style="color:${color};font-size:${fontSize}px;display:inline-block;padding:6px 10px;white-space:nowrap;font-family:KaTeX_Main,serif">
            ${html}
          </div>
        </foreignObject>
      </svg>`;
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          entry.img = img;
          entry.ready = true;
          URL.revokeObjectURL(url);
          latexDecodeListeners.forEach((fn) => { try { fn(); } catch { /* */ } });
          res();
        };
        img.onerror = () => { entry.failed = true; URL.revokeObjectURL(url); rej(new Error('svg')); };
        img.src = url;
      });
    } catch {
      entry.failed = true;
      latexDecodeListeners.forEach((fn) => { try { fn(); } catch { /* */ } });
    }
  })();
  return entry;
}

/* ── Arrow ───────────────────────────────────────────────────────────────── */
export function drawArrowStroke(ctx, s) {
  const { x1 = 0, y1 = 0, x2 = 100, y2 = 0, color = '#fff', lineWidth: lw = 2, doubleArrow = false, arrowSize = 14 } = s;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const cap = arrowSize * 0.75;
  ctx.beginPath();
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.moveTo(x1 + (doubleArrow ? cap * Math.cos(angle) : 0), y1 + (doubleArrow ? cap * Math.sin(angle) : 0));
  ctx.lineTo(x2 - cap * Math.cos(angle), y2 - cap * Math.sin(angle));
  ctx.stroke();
  arrowHead(ctx, x2, y2, angle, arrowSize, color);
  if (doubleArrow) arrowHead(ctx, x1, y1, angle + Math.PI, arrowSize, color);
}

export function arrowVisualBounds(s) {
  const pad = Math.max(s.arrowSize || 14, (s.lineWidth || 2) / 2) + 4;
  return {
    x: Math.min(s.x1 || 0, s.x2 || 0) - pad,
    y: Math.min(s.y1 || 0, s.y2 || 0) - pad,
    w: Math.abs((s.x2 || 0) - (s.x1 || 0)) + pad * 2,
    h: Math.abs((s.y2 || 0) - (s.y1 || 0)) + pad * 2,
  };
}

export function hitTestArrow(ctx, s, px, py) {
  return distSeg(px, py, s.x1 || 0, s.y1 || 0, s.x2 || 0, s.y2 || 0) <= (s.lineWidth || 2) / 2 + 10;
}

/* ── Polyline (stylo illimité) ───────────────────────────────────────────── */
export function drawPolylineStroke(ctx, s) {
  const pts = s.points;
  if (!pts?.length) return;
  ctx.beginPath();
  ctx.lineWidth = s.lineWidth ?? 2;
  ctx.strokeStyle = s.color || '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (s.closed) ctx.closePath();
  ctx.stroke();
  if (s.closed && s.fill) {
    ctx.fillStyle = hexToRgba(s.color || '#fff', 0.22);
    ctx.fill();
  }
}

export function polylineVisualBounds(s) {
  const pts = s.points;
  if (!pts?.length) return null;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  pts.forEach(([x, y]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); });
  const pad = (s.lineWidth ?? 2) / 2 + 4;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

export function hitTestPolyline(ctx, s, px, py) {
  const pts = s.points;
  if (!pts?.length) return false;
  const tol = (s.lineWidth ?? 2) / 2 + 8;
  for (let i = 1; i < pts.length; i++) {
    if (distSeg(px, py, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= tol) return true;
  }
  if (s.closed && pts.length >= 3) {
    const lp = pts[pts.length - 1];
    if (distSeg(px, py, lp[0], lp[1], pts[0][0], pts[0][1]) <= tol) return true;
  }
  return false;
}

/* ── Regular polygon (N-gone) ────────────────────────────────────────────── */
export function drawPolygonStroke(ctx, s) {
  const { cx = 0, cy = 0, r = 50, sides = 6, rotation = 0, color = '#fff', lineWidth: lw = 2, fill = false, fillColor } = s;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2 - Math.PI / 2;
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
            : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
  else if (fill) { ctx.fillStyle = hexToRgba(color, 0.22); ctx.fill(); }
  ctx.stroke();
}

export function polygonVisualBounds(s) {
  const pad = (s.r || 50) + (s.lineWidth || 2) / 2 + 2;
  return { x: (s.cx || 0) - pad, y: (s.cy || 0) - pad, w: pad * 2, h: pad * 2 };
}

export function hitTestPolygon(ctx, s, px, py) {
  return Math.hypot(px - (s.cx || 0), py - (s.cy || 0)) <= (s.r || 50) + 8;
}

/* ── Triangle ────────────────────────────────────────────────────────────── */
export function drawTriangleStroke(ctx, s) {
  const { x0 = 0, y0 = 0, x1 = 100, y1 = 100, x2 = -50, y2 = 100, color = '#fff', lineWidth: lw = 2, fill = false, fillColor } = s;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath();
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
  else if (fill) { ctx.fillStyle = hexToRgba(color, 0.22); ctx.fill(); }
  ctx.stroke();
}

export function triangleVisualBounds(s) {
  const xs = [s.x0 ?? 0, s.x1 ?? 0, s.x2 ?? 0];
  const ys = [s.y0 ?? 0, s.y1 ?? 0, s.y2 ?? 0];
  const lw = (s.lineWidth ?? 2) / 2 + 2;
  return { x: Math.min(...xs) - lw, y: Math.min(...ys) - lw, w: Math.max(...xs) - Math.min(...xs) + lw * 2, h: Math.max(...ys) - Math.min(...ys) + lw * 2 };
}

export function hitTestTriangle(ctx, s, px, py) {
  const { x0 = 0, y0 = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0, lineWidth: lw = 2 } = s;
  const tol = (lw ?? 2) / 2 + 8;
  return (
    distSeg(px, py, x0, y0, x1, y1) <= tol ||
    distSeg(px, py, x1, y1, x2, y2) <= tol ||
    distSeg(px, py, x2, y2, x0, y0) <= tol
  );
}

/* ── Star ────────────────────────────────────────────────────────────────── */
export function drawStarStroke(ctx, s) {
  const { cx = 0, cy = 0, outerR = 50, innerR, points: pts = 5, rotation = 0, color = '#fff', lineWidth: lw = 2, fill = false, fillColor } = s;
  const ir = innerR ?? outerR * 0.42;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = rotation + (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
    const r2 = i % 2 === 0 ? outerR : ir;
    i === 0 ? ctx.moveTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a))
            : ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
  }
  ctx.closePath();
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
  else if (fill) { ctx.fillStyle = hexToRgba(color, 0.22); ctx.fill(); }
  ctx.stroke();
}

export function starVisualBounds(s) {
  const pad = (s.outerR || 50) + (s.lineWidth || 2) / 2 + 2;
  return { x: (s.cx || 0) - pad, y: (s.cy || 0) - pad, w: pad * 2, h: pad * 2 };
}

export function hitTestStar(ctx, s, px, py) {
  return Math.hypot(px - (s.cx || 0), py - (s.cy || 0)) <= (s.outerR || 50) + 8;
}

/* ── Frame / conteneur ───────────────────────────────────────────────────── */
export function drawFrameStroke(ctx, s) {
  const { x = 0, y = 0, w = 200, h = 150, label = 'Cadre', color = '#a78bfa', lineWidth: lw = 1.5 } = s;
  const LABEL_H = 22;
  ctx.save();
  ctx.fillStyle = hexToRgba(color, 0.15);
  ctx.fillRect(x, y, w, LABEL_H);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (label) {
    ctx.font = '600 11px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label).slice(0, 36), x + 6, y + LABEL_H / 2);
  }
  ctx.restore();
}

export function frameVisualBounds(s) {
  const lw = (s.lineWidth ?? 1.5) / 2 + 2;
  return { x: (s.x ?? 0) - lw, y: (s.y ?? 0) - lw, w: (s.w ?? 200) + lw * 2, h: (s.h ?? 150) + lw * 2 };
}

export function hitTestFrame(ctx, s, px, py) {
  const { x = 0, y = 0, w = 200, h = 150, lineWidth: lw = 1.5 } = s;
  const tol = (lw ?? 1.5) / 2 + 8;
  const LABEL_H = 22;
  if (px >= x && px <= x + w && py >= y && py <= y + LABEL_H) return true;
  return (
    distSeg(px, py, x, y, x + w, y) <= tol ||
    distSeg(px, py, x + w, y, x + w, y + h) <= tol ||
    distSeg(px, py, x + w, y + h, x, y + h) <= tol ||
    distSeg(px, py, x, y + h, x, y) <= tol
  );
}

/* ── Axes (repère orthogonal) ─────────────────────────────────────────────── */
export function drawAxesStroke(ctx, s) {
  const { cx = 0, cy = 0, size = 150, tickStep = 30, color = '#60a5fa', lineWidth: lw = 2, showLabels = true } = s;
  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - size, cy); ctx.lineTo(cx + size - 14, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy + size); ctx.lineTo(cx, cy - size + 14); ctx.stroke();
  arrowHead(ctx, cx + size, cy, 0, 12, color);
  arrowHead(ctx, cx, cy - size, -Math.PI / 2, 12, color);
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 1;
  const tOff = tickStep || 30;
  for (let i = tOff; i < size - 16; i += tOff) {
    [[cx + i, cy], [cx - i, cy]].forEach(([tx, ty]) => {
      ctx.beginPath(); ctx.moveTo(tx, ty - 5); ctx.lineTo(tx, ty + 5); ctx.stroke();
    });
    [[cx, cy + i], [cx, cy - i]].forEach(([tx, ty]) => {
      ctx.beginPath(); ctx.moveTo(tx - 5, ty); ctx.lineTo(tx + 5, ty); ctx.stroke();
    });
  }
  if (showLabels) {
    ctx.font = '11px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = hexToRgba(color, 0.75);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('x', cx + size + 6, cy - 8);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('y', cx - 8, cy - size - 4);
    ctx.fillText('O', cx - 6, cy + 8);
  }
  ctx.restore();
}

export function axesVisualBounds(s) {
  const size = (s.size || 150) + 24;
  return { x: (s.cx || 0) - size, y: (s.cy || 0) - size, w: size * 2, h: size * 2 };
}

export function hitTestAxes(ctx, s, px, py) {
  const { cx = 0, cy = 0, size = 150, lineWidth: lw = 2 } = s;
  const tol = (lw ?? 2) + 10;
  return (
    distSeg(px, py, cx - size, cy, cx + size, cy) <= tol ||
    distSeg(px, py, cx, cy - size, cx, cy + size) <= tol
  );
}

/* ── Droite graduée (number line) ────────────────────────────────────────── */
export function drawNumberlineStroke(ctx, s) {
  const { x = 0, y = 0, length = 300, min = 0, max = 10, step = 1, color = '#34d399', lineWidth: lw = 2, showLabels = true, unit = '' } = s;
  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + length + 10, y); ctx.stroke();
  arrowHead(ctx, x + length + 10, y, 0, 12, color);
  arrowHead(ctx, x - 10, y, Math.PI, 12, color);
  const range = Math.max(1, max - min);
  const tickCount = Math.round(range / Math.max(0.001, step));
  const tickSpacing = length / Math.max(1, tickCount);
  ctx.lineWidth = 1;
  for (let i = 0; i <= tickCount; i++) {
    const tx = x + i * tickSpacing;
    const val = min + i * step;
    const major = i % 5 === 0 || tickCount <= 12;
    const tickH = major ? 10 : 6;
    ctx.beginPath(); ctx.moveTo(tx, y - tickH); ctx.lineTo(tx, y + tickH); ctx.stroke();
    if (showLabels && major) {
      ctx.font = '11px ui-sans-serif,system-ui,sans-serif';
      ctx.fillStyle = hexToRgba(color, 0.8);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(Number.isInteger(val) ? String(val) : val.toFixed(1), tx, y + 13);
    }
  }
  if (unit) {
    ctx.font = 'italic 11px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(unit, x + length + 26, y);
  }
  ctx.restore();
}

export function numberlineVisualBounds(s) {
  return { x: (s.x || 0) - 20, y: (s.y || 0) - 32, w: (s.length || 300) + 70, h: 64 };
}

export function hitTestNumberline(ctx, s, px, py) {
  return distSeg(px, py, (s.x || 0) - 10, s.y || 0, (s.x || 0) + (s.length || 300) + 10, s.y || 0) <= (s.lineWidth || 2) + 12;
}

/* ── Tableau / grille ────────────────────────────────────────────────────── */
export function drawTableStroke(ctx, s) {
  const { x = 0, y = 0, cols = 3, rows = 3, cellW = 60, cellH = 30, color = '#fff', lineWidth: lw = 1.5, headers = [] } = s;
  const W = cols * cellW;
  const H = rows * cellH;
  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.strokeRect(x, y, W, H);
  for (let c = 1; c < cols; c++) {
    ctx.beginPath(); ctx.moveTo(x + c * cellW, y); ctx.lineTo(x + c * cellW, y + H); ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    ctx.beginPath(); ctx.moveTo(x, y + r * cellH); ctx.lineTo(x + W, y + r * cellH); ctx.stroke();
  }
  if (rows > 1) {
    ctx.fillStyle = hexToRgba(color, 0.1);
    ctx.fillRect(x, y, W, cellH);
  }
  headers.slice(0, cols).forEach((h, c) => {
    if (!h) return;
    ctx.font = '700 10px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(h).slice(0, 16), x + c * cellW + cellW / 2, y + cellH / 2);
  });
  ctx.restore();
}

export function tableVisualBounds(s) {
  const lw = (s.lineWidth ?? 1.5) / 2 + 2;
  const W = (s.cols || 3) * (s.cellW || 60);
  const H = (s.rows || 3) * (s.cellH || 30);
  return { x: (s.x || 0) - lw, y: (s.y || 0) - lw, w: W + lw * 2, h: H + lw * 2 };
}

export function hitTestTable(ctx, s, px, py) {
  const W = (s.cols || 3) * (s.cellW || 60);
  const H = (s.rows || 3) * (s.cellH || 30);
  return px >= (s.x || 0) && px <= (s.x || 0) + W && py >= (s.y || 0) && py <= (s.y || 0) + H;
}

/* ── Règle graduée ───────────────────────────────────────────────────────── */
export function drawRulerStroke(ctx, s) {
  const { x = 0, y = 0, length = 240, angle = 0, color = '#D4AF37', lineWidth: lw = 1.5, divisions = 10 } = s;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const H = 26;
  ctx.fillStyle = hexToRgba(color, 0.12);
  ctx.fillRect(0, -H / 2, length, H);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.strokeRect(0, -H / 2, length, H);
  const step = length / Math.max(1, divisions);
  for (let i = 0; i <= divisions; i++) {
    const tx = i * step;
    const major = i % 5 === 0;
    const tickH = major ? H * 0.55 : H * 0.3;
    ctx.lineWidth = major ? lw : lw * 0.7;
    ctx.beginPath(); ctx.moveTo(tx, -tickH / 2); ctx.lineTo(tx, tickH / 2); ctx.stroke();
    if (major) {
      ctx.font = '9px ui-sans-serif,system-ui,sans-serif';
      ctx.fillStyle = hexToRgba(color, 0.8);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(String(i), tx, tickH / 2 + 1);
    }
  }
  ctx.restore();
}

export function rulerVisualBounds(s) {
  const { x = 0, y = 0, length = 240, angle = 0 } = s;
  const cos = Math.abs(Math.cos(angle)); const sin = Math.abs(Math.sin(angle));
  const pad = 18;
  return { x: x - pad, y: y - pad - 14, w: length * cos + pad * 2 + 24, h: length * sin + pad * 2 + 28 };
}

export function hitTestRuler(ctx, s, px, py) {
  const { x = 0, y = 0, length = 240, angle = 0 } = s;
  const cos = Math.cos(angle); const sin = Math.sin(angle);
  const rx = px - x; const ry = py - y;
  const lx = rx * cos + ry * sin;
  const ly = -rx * sin + ry * cos;
  return lx >= -8 && lx <= length + 8 && Math.abs(ly) <= 18;
}

/* ── Rapporteur ──────────────────────────────────────────────────────────── */
export function drawProtractorStroke(ctx, s) {
  const { cx = 0, cy = 0, r = 80, startAngle = Math.PI, color = '#f87171', lineWidth: lw = 1.5 } = s;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, startAngle + Math.PI, false);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(color, 0.08);
  ctx.fill();
  ctx.stroke();
  for (let deg = 0; deg <= 180; deg += 10) {
    const rad = startAngle + (deg / 180) * Math.PI;
    const tick = deg % 30 === 0 ? r * 0.18 : r * 0.09;
    ctx.lineWidth = deg % 30 === 0 ? lw : lw * 0.7;
    const x0 = cx + (r - tick) * Math.cos(rad); const y0 = cy + (r - tick) * Math.sin(rad);
    const x1 = cx + r * Math.cos(rad); const y1 = cy + r * Math.sin(rad);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (deg % 30 === 0) {
      ctx.font = '9px ui-sans-serif,system-ui,sans-serif';
      ctx.fillStyle = hexToRgba(color, 0.7);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const lr = r - tick - 11;
      ctx.fillText(String(deg), cx + lr * Math.cos(rad), cy + lr * Math.sin(rad));
    }
  }
  ctx.beginPath();
  ctx.moveTo(cx - r - 8, cy); ctx.lineTo(cx + r + 8, cy);
  ctx.lineWidth = lw; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

export function protractorVisualBounds(s) {
  const r = (s.r || 80) + 18;
  return { x: (s.cx || 0) - r, y: (s.cy || 0) - r, w: r * 2, h: r };
}

export function hitTestProtractor(ctx, s, px, py) {
  return Math.hypot(px - (s.cx || 0), py - (s.cy || 0)) <= (s.r || 80) + 8;
}

/* ── Formule LaTeX ───────────────────────────────────────────────────────── */
export function drawLatexStroke(ctx, s) {
  const entry = getOrRenderLatexImage(s);
  if (entry.ready && entry.img?.naturalWidth) {
    try { ctx.drawImage(entry.img, s.x ?? 0, s.y ?? 0); } catch { /* */ }
  } else if (!entry.failed) {
    ctx.save();
    ctx.font = `italic 16px ui-sans-serif,system-ui,sans-serif`;
    ctx.fillStyle = hexToRgba(s.color || '#fff', 0.5);
    ctx.textBaseline = 'top';
    ctx.fillText(`∫ ${s.formula || '…'}`, s.x ?? 0, s.y ?? 0);
    ctx.restore();
  } else {
    ctx.save();
    ctx.font = `${s.fontSize || 20}px ui-sans-serif,system-ui,sans-serif`;
    ctx.fillStyle = s.color || '#fff';
    ctx.textBaseline = 'top';
    ctx.fillText(String(s.formula || ''), s.x ?? 0, s.y ?? 0);
    ctx.restore();
  }
}

export function latexVisualBounds(s) {
  return { x: (s.x ?? 0) - 4, y: (s.y ?? 0) - 4, w: 280, h: 80 };
}

export function hitTestLatex(ctx, s, px, py) {
  const b = latexVisualBounds(s);
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function formatNum(n) {
  if (!isFinite(n)) return '–';
  if (Number.isInteger(n) || Math.abs(n) >= 100) return String(Math.round(n * 100) / 100);
  return String(parseFloat(n.toFixed(2)));
}

/* ── Réflexion axiale (symétrie) ─────────────────────────────────────────── */
export function reflectPoint(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) return { x: px, y: py };
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  const fx = ax + t * dx; const fy = ay + t * dy;
  return { x: 2 * fx - px, y: 2 * fy - py };
}

/* ── Homothétie (mise à l'échelle depuis un centre) ──────────────────────── */
export function scaleStroke(stroke, cx, cy, k) {
  const sc = (px, py) => [cx + k * (px - cx), cy + k * (py - cy)];
  const sco = (px, py) => { const [x, y] = sc(px, py); return { x, y }; };
  const kind = stroke.kind || 'path';
  // eslint-disable-next-line no-unused-vars
  const { id: _id, ...base } = stroke;
  if (kind === 'path' || kind === 'polyline') {
    return { ...base, points: stroke.points.map(([px, py]) => sc(px, py)) };
  }
  if (kind === 'line' || kind === 'arrow' || kind === 'vector' || kind === 'segment' || kind === 'measure') {
    const a = sco(stroke.x1 || 0, stroke.y1 || 0); const b = sco(stroke.x2 || 0, stroke.y2 || 0);
    return { ...base, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }
  if (kind === 'circle' || kind === 'arc') {
    const nc = sco(stroke.cx || 0, stroke.cy || 0);
    return { ...base, cx: nc.x, cy: nc.y, r: (stroke.r || 50) * Math.abs(k) };
  }
  if (kind === 'polygon' || kind === 'star') {
    const nc = sco(stroke.cx || 0, stroke.cy || 0);
    const rProp = stroke.outerR ?? stroke.r ?? 50;
    return { ...base, cx: nc.x, cy: nc.y, r: rProp * Math.abs(k), outerR: rProp * Math.abs(k) };
  }
  if (kind === 'rect' || kind === 'frame' || kind === 'curtain') {
    const p1 = sco(stroke.x || 0, stroke.y || 0);
    const p2 = sco((stroke.x || 0) + (stroke.w || 0), (stroke.y || 0) + (stroke.h || 0));
    return { ...base, x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) };
  }
  if (kind === 'triangle') {
    const [x0, y0] = sc(stroke.x0 || 0, stroke.y0 || 0);
    const [x1, y1] = sc(stroke.x1 || 0, stroke.y1 || 0);
    const [x2, y2] = sc(stroke.x2 || 0, stroke.y2 || 0);
    return { ...base, x0, y0, x1, y1, x2, y2 };
  }
  if (kind === 'angle-mark') {
    const vp = sco(stroke.vx || 0, stroke.vy || 0);
    const ap = sco(stroke.ax || 0, stroke.ay || 0);
    const bp = sco(stroke.bx || 0, stroke.by || 0);
    return { ...base, vx: vp.x, vy: vp.y, ax: ap.x, ay: ap.y, bx: bp.x, by: bp.y };
  }
  if (kind === 'axes') {
    const nc = sco(stroke.cx || 0, stroke.cy || 0);
    return { ...base, cx: nc.x, cy: nc.y, size: (stroke.size || 150) * Math.abs(k) };
  }
  if (kind === 'numberline') {
    const p = sco(stroke.x || 0, stroke.y || 0);
    return { ...base, x: p.x, y: p.y, length: (stroke.length || 300) * Math.abs(k) };
  }
  if (stroke.cx !== undefined) {
    const nc = sco(stroke.cx, stroke.cy || 0);
    return { ...base, cx: nc.x, cy: nc.y };
  }
  const np = sco(stroke.x || 0, stroke.y || 0);
  return { ...base, x: np.x, y: np.y };
}

/* ── Rotation d'un trait autour d'un centre ──────────────────────────────── */
export function rotateStroke(stroke, cx, cy, angle) {
  const cos = Math.cos(angle); const sin = Math.sin(angle);
  const rv = (px, py) => [
    cx + (px - cx) * cos - (py - cy) * sin,
    cy + (px - cx) * sin + (py - cy) * cos,
  ];
  const ro = (px, py) => { const [x, y] = rv(px, py); return { x, y }; };
  const k = stroke.kind || 'path';
  // eslint-disable-next-line no-unused-vars
  const { id: _id, ...base } = stroke;
  if (k === 'path' || k === 'polyline') {
    return { ...base, points: stroke.points.map(([px, py]) => rv(px, py)) };
  }
  if (k === 'line' || k === 'arrow' || k === 'vector' || k === 'segment' || k === 'measure') {
    const a = ro(stroke.x1 || 0, stroke.y1 || 0); const b = ro(stroke.x2 || 0, stroke.y2 || 0);
    return { ...base, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }
  if (k === 'rect' || k === 'frame') {
    const nc = ro((stroke.x || 0) + (stroke.w || 0) / 2, (stroke.y || 0) + (stroke.h || 0) / 2);
    return { ...base, x: nc.x - (stroke.w || 0) / 2, y: nc.y - (stroke.h || 0) / 2 };
  }
  if (k === 'circle' || k === 'arc' || k === 'polygon' || k === 'star' || k === 'protractor' || k === 'axes' || k === 'pie-chart') {
    const nc = ro(stroke.cx || 0, stroke.cy || 0);
    return { ...base, cx: nc.x, cy: nc.y };
  }
  if (k === 'triangle') {
    const [x0, y0] = rv(stroke.x0 || 0, stroke.y0 || 0);
    const [x1, y1] = rv(stroke.x1 || 0, stroke.y1 || 0);
    const [x2, y2] = rv(stroke.x2 || 0, stroke.y2 || 0);
    return { ...base, x0, y0, x1, y1, x2, y2 };
  }
  if (k === 'angle-mark') {
    const vp = ro(stroke.vx || 0, stroke.vy || 0);
    const ap = ro(stroke.ax || 0, stroke.ay || 0);
    const bp = ro(stroke.bx || 0, stroke.by || 0);
    return { ...base, vx: vp.x, vy: vp.y, ax: ap.x, ay: ap.y, bx: bp.x, by: bp.y };
  }
  if (k === 'numberline' || k === 'ruler') {
    const p = ro(stroke.x || 0, stroke.y || 0);
    return { ...base, x: p.x, y: p.y, angle: (stroke.angle || 0) + angle };
  }
  if (stroke.cx !== undefined) {
    const nc = ro(stroke.cx, stroke.cy || 0);
    return { ...base, cx: nc.x, cy: nc.y };
  }
  const np = ro(stroke.x || 0, stroke.y || 0);
  return { ...base, x: np.x, y: np.y };
}

export function reflectStrokeAcrossLine(stroke, ax, ay, bx, by) {
  const r = (px, py) => { const o = reflectPoint(px, py, ax, ay, bx, by); return [o.x, o.y]; };
  const rv = (px, py) => { const o = reflectPoint(px, py, ax, ay, bx, by); return { x: o.x, y: o.y }; };
  const k = stroke.kind || 'path';
  // eslint-disable-next-line no-unused-vars
  const { id: _id, ...base } = stroke;
  if (k === 'path' || k === 'polyline') {
    return { ...base, points: stroke.points.map(([px, py]) => r(px, py)) };
  }
  if (k === 'line' || k === 'arrow' || k === 'vector' || k === 'segment' || k === 'measure') {
    const a = rv(stroke.x1 || 0, stroke.y1 || 0); const b = rv(stroke.x2 || 0, stroke.y2 || 0);
    return { ...base, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }
  if (k === 'rect' || k === 'frame') {
    const p1 = rv(stroke.x || 0, stroke.y || 0);
    const p2 = rv((stroke.x || 0) + (stroke.w || 0), (stroke.y || 0) + (stroke.h || 0));
    return { ...base, x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) };
  }
  if (k === 'circle' || k === 'arc' || k === 'polygon' || k === 'star' || k === 'protractor' || k === 'axes') {
    const c = rv(stroke.cx || 0, stroke.cy || 0);
    return { ...base, cx: c.x, cy: c.y };
  }
  if (k === 'triangle') {
    const p0 = rv(stroke.x0 || 0, stroke.y0 || 0);
    const p1 = rv(stroke.x1 || 0, stroke.y1 || 0);
    const p2 = rv(stroke.x2 || 0, stroke.y2 || 0);
    return { ...base, x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }
  if (k === 'angle-mark') {
    const vp = rv(stroke.vx || 0, stroke.vy || 0);
    const ap = rv(stroke.ax || 0, stroke.ay || 0);
    const bp = rv(stroke.bx || 0, stroke.by || 0);
    return { ...base, vx: vp.x, vy: vp.y, ax: ap.x, ay: ap.y, bx: bp.x, by: bp.y };
  }
  if (k === 'numberline' || k === 'ruler') {
    const p = rv(stroke.x || 0, stroke.y || 0);
    const endX = (stroke.x || 0) + (stroke.length || 0) * Math.cos(stroke.angle || 0);
    const endY = (stroke.y || 0) + (stroke.length || 0) * Math.sin(stroke.angle || 0);
    const pe = rv(endX, endY);
    return { ...base, x: p.x, y: p.y, angle: Math.atan2(pe.y - p.y, pe.x - p.x) };
  }
  /* fallback: reflect x/y or cx/cy */
  if (stroke.cx !== undefined) {
    const c = rv(stroke.cx, stroke.cy || 0);
    return { ...base, cx: c.x, cy: c.y };
  }
  const p = rv(stroke.x || 0, stroke.y || 0);
  return { ...base, x: p.x, y: p.y };
}

/* ── Évaluateur mathématique sécurisé ────────────────────────────────────── */
export function safeMathEval(expr) {
  if (!expr || typeof expr !== 'string') return null;
  const clean = String(expr)
    .replace(/\^/g, '**')
    .replace(/π/g, 'Math.PI')
    .replace(/\bPI\b/g, 'Math.PI')
    .replace(/\bE\b/g, 'Math.E')
    .replace(/\b(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|sqrt|cbrt|abs|pow|log|log2|log10|exp|ceil|floor|round|sign|min|max|hypot|random)\b/g, 'Math.$1');
  const blocked = /\b(eval|Function|this|window|document|process|require|import|export|class|new\s|delete|void|typeof|instanceof|for\s*\(|while\s*\(|do\s*\{|switch\s*\(|break|continue|return|throw|try|catch|finally|yield|async|await|let\s|var\s|const\s|prototype|__proto__|constructor)\b/;
  if (blocked.test(clean)) return null;
  try {
    const fn = new Function('x', `"use strict"; return (${clean});`);
    const test = fn(1);
    if (typeof test !== 'number') return null;
    return fn;
  } catch {
    return null;
  }
}

/* ── Segment / Droite / Demi-droite nommés ──────────────────────────────── */
export function drawSegmentStroke(ctx, s) {
  const {
    x1 = 0, y1 = 0, x2 = 100, y2 = 0,
    labelA = '', labelB = '', style = 'segment',
    color = '#fff', lineWidth: lw = 2,
    showLength = false, tickCount = 0,
  } = s;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const perpX = -Math.sin(angle); const perpY = Math.cos(angle);
  const EXT = Math.max(60, len * 0.3);
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';

  const sx = style === 'line' ? x1 - EXT * Math.cos(angle) : x1;
  const sy = style === 'line' ? y1 - EXT * Math.sin(angle) : y1;
  const ex = (style === 'line' || style === 'ray') ? x2 + EXT * Math.cos(angle) : x2;
  const ey = (style === 'line' || style === 'ray') ? y2 + EXT * Math.sin(angle) : y2;

  if (style === 'dashed') ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.setLineDash([]);

  /* barres d'extrémité pour segment */
  if (style === 'segment') {
    const CAP = 7;
    [[x1, y1], [x2, y2]].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(cx + CAP * perpX, cy + CAP * perpY);
      ctx.lineTo(cx - CAP * perpX, cy - CAP * perpY);
      ctx.stroke();
    });
  }
  /* flèche pour demi-droite */
  if (style === 'ray') arrowHead(ctx, ex, ey, angle, 12, color);

  /* coches de codage (longueurs égales) */
  if (tickCount > 0) {
    const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
    for (let t = 0; t < tickCount; t++) {
      const off = (t - (tickCount - 1) / 2) * 7;
      const tx = mx + off * Math.cos(angle); const ty = my + off * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(tx + 6 * perpX, ty + 6 * perpY);
      ctx.lineTo(tx - 6 * perpX, ty - 6 * perpY);
      ctx.stroke();
    }
  }

  /* étiquettes des points */
  ctx.font = 'bold 13px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = color;
  if (labelA) {
    ctx.beginPath(); ctx.arc(x1, y1, 3.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labelA, x1 - Math.cos(angle) * 14 + perpX * 6, y1 - Math.sin(angle) * 14 + perpY * 6);
  }
  if (labelB) {
    ctx.beginPath(); ctx.arc(x2, y2, 3.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labelB, x2 + Math.cos(angle) * 14 + perpX * 6, y2 + Math.sin(angle) * 14 + perpY * 6);
  }

  /* longueur */
  if (showLength) {
    const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
    const lblText = labelA && labelB ? `${labelA}${labelB} = ${Math.round(len)}` : `${Math.round(len)}`;
    ctx.font = '11px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = hexToRgba(color, 0.8);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(lblText, mx + perpX * 16, my + perpY * 16);
  }
  ctx.restore();
}

export function segmentVisualBounds(s) {
  const EXT = 80;
  const pad = (s.lineWidth || 2) / 2 + EXT + 20;
  return {
    x: Math.min(s.x1 || 0, s.x2 || 0) - pad,
    y: Math.min(s.y1 || 0, s.y2 || 0) - pad,
    w: Math.abs((s.x2 || 0) - (s.x1 || 0)) + pad * 2,
    h: Math.abs((s.y2 || 0) - (s.y1 || 0)) + pad * 2,
  };
}

export function hitTestSegment(ctx, s, px, py) {
  return distSeg(px, py, s.x1 || 0, s.y1 || 0, s.x2 || 0, s.y2 || 0) <= (s.lineWidth || 2) / 2 + 10;
}

/* ── Mesure de distance (ligne de cote) ──────────────────────────────────── */
export function drawMeasureStroke(ctx, s) {
  const { x1 = 0, y1 = 0, x2 = 100, y2 = 0, color = '#D4AF37', lineWidth: lw = 1.5, label = '' } = s;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perpX = -Math.sin(angle); const perpY = Math.cos(angle);
  const CAP = 10;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;

  /* guides perpendiculaires */
  [[x1, y1], [x2, y2]].forEach(([cx, cy]) => {
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + perpX * 18, cy + perpY * 18); ctx.stroke();
    ctx.setLineDash([]);
  });

  /* ligne de cote décalée */
  const off = 14;
  const lx1 = x1 + perpX * off; const ly1 = y1 + perpY * off;
  const lx2 = x2 + perpX * off; const ly2 = y2 + perpY * off;
  ctx.beginPath(); ctx.moveTo(lx1, ly1); ctx.lineTo(lx2, ly2); ctx.stroke();

  /* barres d'extrémité */
  [[lx1, ly1], [lx2, ly2]].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.moveTo(cx + CAP * perpX, cy + CAP * perpY);
    ctx.lineTo(cx - CAP * perpX, cy - CAP * perpY);
    ctx.stroke();
  });

  /* points */
  [[x1, y1], [x2, y2]].forEach(([cx, cy]) => {
    ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  });

  /* étiquette */
  const displayLabel = label || `${formatNum(len)} px`;
  const mx = (lx1 + lx2) / 2; const my = (ly1 + ly2) / 2;
  ctx.font = 'bold 12px ui-sans-serif,system-ui,sans-serif';
  const tw = ctx.measureText(displayLabel).width + 10;
  ctx.fillStyle = 'rgba(10,11,15,0.80)';
  ctx.fillRect(mx - tw / 2, my - 10, tw, 20);
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(displayLabel, mx, my);
  ctx.restore();
}

export function measureVisualBounds(s) {
  const pad = 40;
  return {
    x: Math.min(s.x1 || 0, s.x2 || 0) - pad,
    y: Math.min(s.y1 || 0, s.y2 || 0) - pad,
    w: Math.abs((s.x2 || 0) - (s.x1 || 0)) + pad * 2,
    h: Math.abs((s.y2 || 0) - (s.y1 || 0)) + pad * 2,
  };
}

export function hitTestMeasure(ctx, s, px, py) {
  return distSeg(px, py, s.x1 || 0, s.y1 || 0, s.x2 || 0, s.y2 || 0) <= 14;
}

/* ── Tableau de valeurs f(x) ─────────────────────────────────────────────── */
export function drawValueTableStroke(ctx, s) {
  const {
    x = 0, y = 0,
    expr = 'x', xMin = -3, xMax = 3, xStep = 1,
    color = '#fff', lineWidth: lw = 1.5,
  } = s;
  const fn = safeMathEval(expr);
  const xVals = [];
  const step = Math.max(0.001, xStep);
  for (let xv = xMin; xv <= xMax + 1e-9 && xVals.length <= 16; xv += step) {
    xVals.push(parseFloat(xv.toFixed(6)));
  }

  const cellW = 50; const cellH = 28;
  const cols = xVals.length + 1;
  const W = cols * cellW; const H = cellH * 2;

  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;

  /* fond en-tête */
  ctx.fillStyle = hexToRgba(color, 0.08);
  ctx.fillRect(x, y, cellW, H);
  ctx.strokeRect(x, y, W, H);

  /* séparateur horizontal */
  ctx.beginPath(); ctx.moveTo(x, y + cellH); ctx.lineTo(x + W, y + cellH); ctx.stroke();

  /* séparateurs verticaux */
  for (let c = 1; c < cols; c++) {
    ctx.beginPath(); ctx.moveTo(x + c * cellW, y); ctx.lineTo(x + c * cellW, y + H); ctx.stroke();
  }

  /* en-têtes */
  ctx.font = 'bold italic 12px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('x', x + cellW / 2, y + cellH / 2);
  ctx.fillText('y', x + cellW / 2, y + cellH + cellH / 2);

  /* valeurs */
  ctx.font = '11px ui-sans-serif,system-ui,sans-serif';
  xVals.forEach((xv, i) => {
    const cx = x + (i + 1) * cellW + cellW / 2;
    ctx.fillStyle = hexToRgba(color, 0.75);
    ctx.fillText(formatNum(xv), cx, y + cellH / 2);
    let yv; try { yv = fn ? fn(xv) : NaN; } catch { yv = NaN; }
    ctx.fillStyle = isFinite(yv) ? color : hexToRgba(color, 0.3);
    ctx.fillText(isFinite(yv) ? formatNum(yv) : '?', cx, y + cellH + cellH / 2);
  });

  /* étiquette expression */
  ctx.font = 'italic 10px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = hexToRgba(color, 0.5);
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText(`y = ${expr}`, x + W, y - 3);

  ctx.restore();
}

export function valueTableVisualBounds(s) {
  const step = Math.max(0.001, s.xStep || 1);
  const n = Math.min(17, Math.ceil(((s.xMax || 3) - (s.xMin || -3)) / step) + 1);
  const cellW = 50;
  return { x: (s.x || 0) - 4, y: (s.y || 0) - 20, w: (n + 1) * cellW + 8, h: 56 + 20 };
}

export function hitTestValueTable(ctx, s, px, py) {
  const b = valueTableVisualBounds(s);
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/* ── Histogramme ─────────────────────────────────────────────────────────── */
export function drawHistogramStroke(ctx, s) {
  const {
    x = 0, y = 0, w = 280, h = 180,
    labels = [], values = [],
    color = '#60a5fa', title = '', lineWidth: lw = 1.5,
    showValues = true, barColors = [],
  } = s;
  const n = Math.max(1, labels.length);
  const vals = values.slice(0, n).map((v) => Number(v) || 0);
  const maxVal = Math.max(1, ...vals);
  const axisH = 22; const topPad = title ? 22 : 4;
  const chartH = h - axisH - topPad;
  const slotW = w / n;

  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;

  /* axes */
  ctx.beginPath(); ctx.moveTo(x, y + topPad); ctx.lineTo(x, y + h - axisH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + h - axisH); ctx.lineTo(x + w, y + h - axisH); ctx.stroke();

  /* barres */
  vals.forEach((v, i) => {
    const barH = (v / maxVal) * chartH;
    const bx = x + i * slotW + slotW * 0.12;
    const bw = slotW * 0.76;
    const by = y + topPad + chartH - barH;
    const barCol = barColors[i] || color;

    ctx.fillStyle = hexToRgba(barCol, 0.45);
    ctx.fillRect(bx, by, bw, barH);
    ctx.strokeStyle = barCol;
    ctx.strokeRect(bx, by, bw, barH);

    /* étiquette barre */
    ctx.font = '10px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = hexToRgba(color, 0.7);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(String(labels[i] ?? i).slice(0, 10), bx + bw / 2, y + h - axisH + 3);

    /* valeur */
    if (showValues) {
      ctx.fillStyle = barCol; ctx.textBaseline = 'bottom';
      ctx.fillText(formatNum(v), bx + bw / 2, by - 1);
    }
  });

  /* titre */
  if (title) {
    ctx.font = 'bold 11px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(title, x + w / 2, y + 2);
  }
  ctx.restore();
}

export function histogramVisualBounds(s) {
  const pad = 20;
  return { x: (s.x || 0) - pad, y: (s.y || 0) - 30, w: (s.w || 280) + pad * 2, h: (s.h || 180) + 50 };
}

export function hitTestHistogram(ctx, s, px, py) {
  return px >= (s.x || 0) && px <= (s.x || 0) + (s.w || 280) && py >= (s.y || 0) && py <= (s.y || 0) + (s.h || 180);
}

/* ── Vecteur nommé (physics / math) ─────────────────────────────────────── */
export function drawVectorStroke(ctx, s) {
  const {
    x1 = 0, y1 = 0, x2 = 100, y2 = 0,
    label = '', color = '#fff', lineWidth: lw = 2, arrowSize = 14,
  } = s;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const cap = arrowSize * 0.75;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';

  /* origine dot */
  ctx.beginPath();
  ctx.arc(x1, y1, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();

  /* tige */
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - cap * Math.cos(angle), y2 - cap * Math.sin(angle));
  ctx.stroke();

  /* pointe */
  arrowHead(ctx, x2, y2, angle, arrowSize, color);

  /* étiquette vecteur perpendiculaire à la flèche */
  if (label) {
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const OFF = 20;
    const lx = (x1 + x2) / 2 + perpX * OFF;
    const ly = (y1 + y2) / 2 + perpY * OFF;
    ctx.font = 'bold italic 15px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    /* notation vecteur : lettre + flèche au-dessus (U+20D7) */
    ctx.fillText(`${label}\u20D7`, lx, ly);
  }

  ctx.restore();
}

export function vectorVisualBounds(s) {
  const pad = Math.max(s.arrowSize || 14, (s.lineWidth || 2) / 2) + 28;
  return {
    x: Math.min(s.x1 || 0, s.x2 || 0) - pad,
    y: Math.min(s.y1 || 0, s.y2 || 0) - pad,
    w: Math.abs((s.x2 || 0) - (s.x1 || 0)) + pad * 2,
    h: Math.abs((s.y2 || 0) - (s.y1 || 0)) + pad * 2,
  };
}

export function hitTestVector(ctx, s, px, py) {
  return distSeg(px, py, s.x1 || 0, s.y1 || 0, s.x2 || 0, s.y2 || 0) <= (s.lineWidth || 2) / 2 + 12;
}

/* ── Fraction visuelle (barre ou camembert) ─────────────────────────────── */
export function drawFractionStroke(ctx, s) {
  const {
    x = 0, y = 0,
    numerator: num = 1, denominator: den = 4,
    style = 'bar', color = '#60a5fa', cellSize = 32, lineWidth: lw = 1.5,
  } = s;
  const safeNum = Math.max(0, Math.min(num, den));
  const safeDen = Math.max(1, den);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;

  if (style === 'pie') {
    const r = Math.max(12, cellSize);
    const startA = -Math.PI / 2;
    const endA = startA + (safeNum / safeDen) * Math.PI * 2;
    if (safeNum > 0) {
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.arc(x, y, r, startA, endA, false); ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.45); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < safeDen; i++) {
      const a = startA + (i / safeDen) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); ctx.stroke();
    }
    ctx.font = 'bold 13px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`${safeNum}/${safeDen}`, x, y + r + 6);
  } else {
    /* bar */
    const cs = Math.max(16, cellSize);
    for (let i = 0; i < safeDen; i++) {
      const cx = x + i * cs;
      if (i < safeNum) {
        ctx.fillStyle = hexToRgba(color, 0.45);
        ctx.fillRect(cx, y, cs, cs);
      }
      ctx.strokeRect(cx, y, cs, cs);
    }
    ctx.font = 'bold 13px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`${safeNum}/${safeDen}`, x + safeDen * cs / 2, y + cs + 4);
  }
  ctx.restore();
}

export function fractionVisualBounds(s) {
  const den = Math.max(1, s.denominator || 4);
  const cs = Math.max(16, s.cellSize || 32);
  if (s.style === 'pie') {
    const r = Math.max(12, cs) + 4;
    return { x: (s.x || 0) - r, y: (s.y || 0) - r, w: r * 2, h: r * 2 + 28 };
  }
  return { x: (s.x || 0) - 4, y: (s.y || 0) - 4, w: den * cs + 8, h: cs + 32 };
}

export function hitTestFraction(ctx, s, px, py) {
  const b = fractionVisualBounds(s);
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/* ── Tracé de courbe f(x) ────────────────────────────────────────────────── */
export function drawFunctionPlotStroke(ctx, s) {
  const {
    cx = 0, cy = 0,
    scaleX = 50, scaleY = 50,
    xMin = -5, xMax = 5,
    color = '#60a5fa', lineWidth: lw = 2,
    expr = 'x', label = '',
  } = s;
  const fn = safeMathEval(expr);
  if (!fn) {
    ctx.save();
    ctx.font = '12px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = hexToRgba(color, 0.55);
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillText(`y = ${expr} (erreur)`, cx, cy - 20);
    ctx.restore();
    return;
  }
  const steps = 400;
  const dx = (xMax - xMin) / steps;
  const maxY = ((xMax - xMin) / 2) * 6;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let penDown = false;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * dx;
    let y;
    try { y = fn(x); } catch { y = NaN; }
    if (!isFinite(y) || isNaN(y) || Math.abs(y) > maxY) { penDown = false; continue; }
    const px = cx + x * scaleX;
    const py = cy - y * scaleY;
    if (!penDown) { ctx.moveTo(px, py); penDown = true; }
    else { ctx.lineTo(px, py); }
  }
  ctx.stroke();

  /* étiquette courbe */
  const displayLabel = label || `y = ${expr}`;
  const lastX = xMax;
  let lastY;
  try { lastY = fn(lastX); } catch { lastY = NaN; }
  ctx.font = 'italic 11px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = color;
  if (isFinite(lastY) && Math.abs(lastY) <= maxY) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(displayLabel, cx + lastX * scaleX + 6, cy - lastY * scaleY);
  } else {
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(displayLabel, cx + xMin * scaleX, cy - 4);
  }
  ctx.restore();
}

export function functionPlotVisualBounds(s) {
  const { cx = 0, cy = 0, scaleX = 50, scaleY = 50, xMin = -5, xMax = 5 } = s;
  const w = (xMax - xMin) * scaleX;
  const hEst = w * (scaleY / scaleX);
  return { x: cx + xMin * scaleX - 20, y: cy - hEst / 2 - 30, w: w + 80, h: hEst + 60 };
}

export function hitTestFunctionPlot(ctx, s, px, py) {
  const b = functionPlotVisualBounds(s);
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/* ── Dispatch ────────────────────────────────────────────────────────────── */
/* ── Point de coordonnées sur un repère ──────────────────────────────────── */
export function drawCoordPointStroke(ctx, s) {
  const { x = 0, y = 0, label = 'A', cx = 0, cy = 0, color = '#fbbf24', fontSize = 14 } = s;
  ctx.save();
  /* croix / dot */
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = hexToRgba(color, 0.6);
  ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke();
  /* guide lines to axes if cx/cy provided */
  if (cx !== x || cy !== y) {
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = hexToRgba(color, 0.35); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, y); ctx.stroke();
    ctx.setLineDash([]);
  }
  /* label */
  const xVal = s.xVal != null ? Number(s.xVal.toFixed(2)) : null;
  const yVal = s.yVal != null ? Number(s.yVal.toFixed(2)) : null;
  const lbl = label + (xVal != null ? `(${xVal}; ${yVal})` : '');
  ctx.font = `bold ${fontSize}px ui-sans-serif,system-ui,sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
  ctx.fillText(lbl, x + 8, y - 4);
  ctx.restore();
}

export function coordPointVisualBounds(s) {
  return { x: (s.x ?? 0) - 24, y: (s.y ?? 0) - 32, w: 120, h: 56 };
}

export function hitTestCoordPoint(ctx, s, px, py) {
  return Math.hypot(px - (s.x ?? 0), py - (s.y ?? 0)) <= 14;
}

/* ── Angle (deux demi-droites + arc + étiquette) ─────────────────────────── */

function normalizeAngle(a) { return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); }

function sweepBetweenAngles(a1, a2) {
  const d = normalizeAngle(a2 - a1);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

function midAngleBetween(a1, a2) {
  const d = normalizeAngle(a2 - a1);
  if (d > Math.PI) return normalizeAngle(a1 - (Math.PI * 2 - d) / 2);
  return normalizeAngle(a1 + d / 2);
}

const RAY_DISPLAY_LEN = 140;

export function drawAngleMarkStroke(ctx, s) {
  const {
    vx = 0, vy = 0,
    ax = 140, ay = 0,
    bx = 0, by = -140,
    color = '#fff', lineWidth: lw = 2,
    showArc = true, showDegrees = true, label = '', arcRadius,
    rightAngle = false,
  } = s;
  const lenA = Math.hypot(ax - vx, ay - vy) || 1;
  const lenB = Math.hypot(bx - vx, by - vy) || 1;
  const dAX = (ax - vx) / lenA; const dAY = (ay - vy) / lenA;
  const dBX = (bx - vx) / lenB; const dBY = (by - vy) / lenB;
  const RAY = Math.max(RAY_DISPLAY_LEN, Math.max(lenA, lenB) * 1.05);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';

  /* demi-droites */
  ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx + RAY * dAX, vy + RAY * dAY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx + RAY * dBX, vy + RAY * dBY); ctx.stroke();

  /* marque angle */
  if (showArc) {
    const r = arcRadius || Math.min(38, RAY * 0.27);
    if (rightAngle) {
      const sx = vx + r * dAX; const sy = vy + r * dAY;
      const ex = vx + r * dBX; const ey = vy + r * dBY;
      const mx = sx + r * dBX; const my = sy + r * dBY;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.lineTo(ex, ey);
      ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
    } else {
      const a1 = Math.atan2(dAY, dAX);
      const a2 = Math.atan2(dBY, dBX);
      ctx.beginPath();
      ctx.arc(vx, vy, r, a1, a2, normalizeAngle(a2 - a1) > Math.PI);
      ctx.strokeStyle = hexToRgba(color, 0.88); ctx.lineWidth = lw * 1.2; ctx.stroke();
    }
  }

  /* étiquette */
  const displayLabel = label || (showDegrees ? (() => {
    if (rightAngle) return '90°';
    const a1 = Math.atan2(dAY, dAX); const a2 = Math.atan2(dBY, dBX);
    const deg = Math.round(sweepBetweenAngles(a1, a2) * 180 / Math.PI);
    return `${deg}°`;
  })() : '');
  if (displayLabel) {
    const r = (arcRadius || 38) + 16;
    const a1 = Math.atan2(dAY, dAX); const a2 = Math.atan2(dBY, dBX);
    const mid = rightAngle ? normalizeAngle(a1 + Math.PI / 4) : midAngleBetween(a1, a2);
    ctx.font = 'bold 13px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(displayLabel, vx + r * Math.cos(mid), vy + r * Math.sin(mid));
  }

  /* sommet */
  ctx.beginPath(); ctx.arc(vx, vy, 3.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

export function angleMarkVisualBounds(s) {
  const { vx = 0, vy = 0 } = s;
  const RAY = RAY_DISPLAY_LEN + 20;
  return { x: vx - RAY, y: vy - RAY, w: RAY * 2, h: RAY * 2 };
}

export function hitTestAngleMark(ctx, s, px, py) {
  const {
    vx = 0, vy = 0, ax = 140, ay = 0, bx = 0, by = -140,
    lineWidth: lw = 2,
  } = s;
  const lenA = Math.hypot(ax - vx, ay - vy) || 1;
  const lenB = Math.hypot(bx - vx, by - vy) || 1;
  const dAX = (ax - vx) / lenA; const dAY = (ay - vy) / lenA;
  const dBX = (bx - vx) / lenB; const dBY = (by - vy) / lenB;
  const RAY = RAY_DISPLAY_LEN;
  const tol = (lw ?? 2) + 10;
  return (
    distSeg(px, py, vx, vy, vx + RAY * dAX, vy + RAY * dAY) <= tol ||
    distSeg(px, py, vx, vy, vx + RAY * dBX, vy + RAY * dBY) <= tol ||
    Math.hypot(px - vx, py - vy) <= 16
  );
}

/* ── Prévisualisation de l'angle en cours de tracé ─────────────────────── */
export function drawAngleDraft(ctx, draft, color, lw) {
  if (!draft || draft.phase < 1) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.setLineDash([5, 4]);

  const { vx, vy } = draft;

  if (draft.phase >= 1) {
    /* demi-droite 1 vers le curseur / 1er point */
    const tx = draft.phase === 1 ? draft.cx : draft.ax;
    const ty = draft.phase === 1 ? draft.cy : draft.ay;
    ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(tx, ty); ctx.stroke();
  }
  if (draft.phase === 2) {
    /* demi-droite 2 vers le curseur */
    ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(draft.cx, draft.cy); ctx.stroke();
    /* arc prévisualisation */
    const dAX = (draft.ax - vx) / Math.hypot(draft.ax - vx, draft.ay - vy);
    const dAY = (draft.ay - vy) / Math.hypot(draft.ax - vx, draft.ay - vy);
    const dBX = (draft.cx - vx) / Math.hypot(draft.cx - vx, draft.cy - vy);
    const dBY = (draft.cy - vy) / Math.hypot(draft.cx - vx, draft.cy - vy);
    const a1 = Math.atan2(dAY, dAX);
    const a2 = Math.atan2(dBY, dBX);
    const r = 32;
    ctx.setLineDash([]);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = hexToRgba(color, 0.75);
    ctx.beginPath();
    ctx.arc(vx, vy, r, a1, a2, normalizeAngle(a2 - a1) > Math.PI);
    ctx.stroke();

    /* affichage degrés */
    const deg = Math.round(sweepBetweenAngles(a1, a2) * 180 / Math.PI);
    const mid = midAngleBetween(a1, a2);
    ctx.font = 'bold 12px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = hexToRgba(color, 0.85);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${deg}°`, vx + (r + 18) * Math.cos(mid), vy + (r + 18) * Math.sin(mid));
  }

  /* sommet */
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(vx, vy, 5, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(color, 0.9); ctx.fill();
  ctx.restore();
}

/* ── Arc de cercle ───────────────────────────────────────────────────────── */
export function drawArcStroke(ctx, s) {
  const { cx = 0, cy = 0, r = 50, startAngle = 0, endAngle = Math.PI * 2, color = '#fff', lineWidth: lw = 2, counterClockwise = false } = s;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, r), startAngle, endAngle, counterClockwise);
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function arcVisualBounds(s) {
  const { cx = 0, cy = 0, r = 50, lineWidth: lw = 2 } = s;
  const pad = r + (lw ?? 2) / 2 + 4;
  return { x: cx - pad, y: cy - pad, w: pad * 2, h: pad * 2 };
}

export function hitTestArc(ctx, s, px, py) {
  const { cx = 0, cy = 0, r = 50, startAngle = 0, endAngle = Math.PI * 2, lineWidth: lw = 2 } = s;
  const d = Math.hypot(px - cx, py - cy);
  const onCircle = Math.abs(d - r) <= (lw ?? 2) / 2 + 8;
  if (!onCircle) return false;
  const fullCircle = Math.abs(endAngle - startAngle - Math.PI * 2) < 0.01;
  if (fullCircle) return true;
  let a = Math.atan2(py - cy, px - cx);
  const sa = ((startAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const ea = ((endAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (sa <= ea) return a >= sa && a <= ea;
  return a >= sa || a <= ea;
}

/* ── Compas — dessin sur le canvas (prévisualisation pendant la frappe) ── */
export function drawCompassDraft(ctx, draft, color) {
  if (!draft || draft.r < 4) return;
  const { cx, cy, r, currentAngle = 0, startAngle = 0, arcMode = false } = draft;
  const pencilX = cx + r * Math.cos(currentAngle);
  const pencilY = cy + r * Math.sin(currentAngle);
  ctx.save();

  /* cercle complet (tirets) */
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(color, 0.25);
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  /* arc tracé en mode arc */
  if (arcMode && draft.phase === 'draw') {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, currentAngle);
    ctx.strokeStyle = hexToRgba(color, 0.7);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /* corps du compas — V inversé avec charnière */
  const legLen = Math.min(r * 0.85, 90);
  const halfR = r / 2;
  const perpH = Math.sqrt(Math.max(0, legLen * legLen - halfR * halfR));
  const midX = (cx + pencilX) / 2;
  const midY = (cy + pencilY) / 2;
  const dirX = r > 0 ? (pencilX - cx) / r : 1;
  const dirY = r > 0 ? (pencilY - cy) / r : 0;
  /* perpendiculaire : choisir celle qui pointe vers y négatif (haut de l'écran) */
  const p1X = -dirY; const p1Y = dirX;
  const p2X = dirY;  const p2Y = -dirX;
  const perpX = p1Y < 0 ? p1X : p2X;
  const perpY = p1Y < 0 ? p1Y : p2Y;
  const hingeX = midX + perpH * perpX;
  const hingeY = midY + perpH * perpY;

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  /* jambe aiguille (pivot → charnière) */
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hingeX, hingeY); ctx.stroke();
  /* jambe crayon (charnière → pointe crayon) */
  ctx.beginPath(); ctx.moveTo(hingeX, hingeY); ctx.lineTo(pencilX, pencilY); ctx.stroke();

  /* charnière */
  ctx.beginPath();
  ctx.arc(hingeX, hingeY, 5, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(color, 0.9);
  ctx.fill();

  /* point pivot (aiguille) */
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = 'transparent';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  /* croix sur le point pivot */
  ctx.lineWidth = 1.5;
  [[-8,0],[8,0],[0,-8],[0,8]].forEach(([dx,dy], i) => {
    if (i === 0) { ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.stroke(); }
    if (i === 2) { ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke(); }
  });

  /* pointe crayon */
  ctx.beginPath();
  ctx.arc(pencilX, pencilY, 5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  /* petit triangle crayon */
  ctx.beginPath();
  ctx.moveTo(pencilX, pencilY + 7);
  ctx.lineTo(pencilX - 4, pencilY + 14);
  ctx.lineTo(pencilX + 4, pencilY + 14);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(color, 0.7);
  ctx.fill();

  /* label rayon */
  ctx.font = 'bold 12px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = color;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  const lx = Math.max(midX, cx) + 8;
  const ly = Math.min(midY, cy) - 4;
  ctx.fillText(`r = ${Math.round(r)}`, lx, ly);

  ctx.restore();
}

/* ── Diagramme circulaire (camembert) ────────────────────────────────────── */
const PIE_PALETTE = [
  '#60a5fa', '#34d399', '#f87171', '#c084fc', '#fb923c',
  '#fbbf24', '#a3e635', '#f472b6', '#38bdf8', '#4ade80',
];

export function drawPieChartStroke(ctx, s) {
  const {
    cx = 0, cy = 0, r = 80,
    labels = [], values = [],
    color = '#60a5fa', title = '', lineWidth: lw = 1.5,
    barColors = [],
  } = s;
  const vals = labels.map((_, i) => Math.max(0, Number(values[i]) || 0));
  const total = vals.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(color, 0.4); ctx.lineWidth = lw; ctx.setLineDash([6, 4]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '11px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = hexToRgba(color, 0.5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('(aucune donnée)', cx, cy);
    ctx.restore();
    return;
  }
  ctx.save();
  let startAngle = -Math.PI / 2;
  vals.forEach((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    const endAngle = startAngle + sweep;
    const col = barColors[i] || PIE_PALETTE[i % PIE_PALETTE.length];
    const mid = startAngle + sweep / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle, false);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(col, 0.55); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
    /* % à l'intérieur */
    if (sweep > 0.18) {
      ctx.font = 'bold 11px ui-sans-serif,system-ui,sans-serif';
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round((v / total) * 100)}%`, cx + r * 0.62 * Math.cos(mid), cy + r * 0.62 * Math.sin(mid));
    }
    /* étiquette externe */
    if (sweep > 0.25) {
      const ex = cx + (r + 20) * Math.cos(mid); const ey = cy + (r + 20) * Math.sin(mid);
      ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = col;
      ctx.textAlign = Math.cos(mid) >= 0 ? 'left' : 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(String(labels[i] || '').slice(0, 12), ex, ey);
    }
    startAngle = endAngle;
  });
  if (title) {
    ctx.font = 'bold 12px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(title, cx, cy - r - 6);
  }
  ctx.restore();
}

export function pieChartVisualBounds(s) {
  const r = (s.r || 80) + 40;
  return { x: (s.cx || 0) - r, y: (s.cy || 0) - r - 24, w: r * 2, h: r * 2 + 24 };
}

export function hitTestPieChart(ctx, s, px, py) {
  return Math.hypot(px - (s.cx || 0), py - (s.cy || 0)) <= (s.r || 80) + 8;
}

/* ── Nuage de points (scatter plot) ─────────────────────────────────────── */
export function drawScatterPlotStroke(ctx, s) {
  const {
    cx = 0, cy = 0, scaleX = 50, scaleY = 50,
    xMin = -5, xMax = 5,
    color = '#60a5fa', lineWidth: lw = 2,
    data = [],
    connectDots = false, showAxes = true,
    title = '', pointRadius = 5,
  } = s;
  ctx.save();
  if (showAxes) {
    const sz = Math.max(((xMax - xMin) / 2) * scaleX, 60);
    ctx.strokeStyle = hexToRgba(color, 0.3); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - sz, cy); ctx.lineTo(cx + sz, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + sz); ctx.lineTo(cx, cy - sz); ctx.stroke();
  }
  if (connectDots && data.length >= 2) {
    ctx.beginPath(); ctx.strokeStyle = hexToRgba(color, 0.35); ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    data.forEach((pt, i) => {
      const px2 = cx + pt.x * scaleX; const py2 = cy - pt.y * scaleY;
      i === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
    });
    ctx.stroke(); ctx.setLineDash([]);
  }
  data.forEach((pt) => {
    const px2 = cx + pt.x * scaleX; const py2 = cy - pt.y * scaleY;
    ctx.beginPath(); ctx.arc(px2, py2, pointRadius, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, 0.75); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
    if (pt.label) {
      ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(pt.label, px2 + pointRadius + 3, py2 - 3);
    }
  });
  if (title) {
    ctx.font = 'bold 11px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(title, cx, cy - Math.max(((xMax - xMin) / 2) * scaleX, 60) - 14);
  }
  ctx.restore();
}

export function scatterPlotVisualBounds(s) {
  const { cx = 0, cy = 0, scaleX = 50, scaleY = 50, xMin = -5, xMax = 5 } = s;
  const hw = ((xMax - xMin) / 2 + 1) * scaleX + 40;
  return { x: cx - hw, y: cy - hw - 24, w: hw * 2, h: hw * 2 + 24 };
}

export function hitTestScatterPlot(ctx, s, px, py) {
  const b = scatterPlotVisualBounds(s);
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/* ── Rideau cacher/révéler ───────────────────────────────────────────────── */
export function drawCurtainStroke(ctx, s) {
  const { x = 0, y = 0, w = 400, h = 300, color = '#14131c', opacity = 0.96, label = '' } = s;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(212,175,55,0.35)';
  ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
  ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  if (w > 60 && h > 30) {
    ctx.font = '11px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = 'rgba(212,175,55,0.4)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label || '▓ Rideau', x + w / 2, y + h / 2);
  }
  ctx.restore();
}

export function curtainVisualBounds(s) {
  return { x: s.x ?? 0, y: s.y ?? 0, w: s.w ?? 400, h: s.h ?? 300 };
}

export function hitTestCurtain(ctx, s, px, py) {
  return px >= (s.x ?? 0) && px <= (s.x ?? 0) + (s.w ?? 400)
      && py >= (s.y ?? 0) && py <= (s.y ?? 0) + (s.h ?? 300);
}

/* ── Tableau de variations ───────────────────────────────────────────────── */
export function drawVariationTableStroke(ctx, s) {
  const {
    x = 0, y = 0, functionName = 'f',
    xValues = ['-∞', '1', '+∞'],
    derivSigns = ['+', '-'],
    critFValues = ['3'],
    increasing = [true, false],
    boundaryFValues = ['', ''],
    color = '#fff', lineWidth: lw = 1.5,
  } = s;
  const n = Math.max(2, xValues.length);
  const HEADER_W = 54; const X_COL_W = 38; const INT_COL_W = 76; const ROW_H = 36;
  const totalW = HEADER_W + n * X_COL_W + (n - 1) * INT_COL_W;
  const totalH = 3 * ROW_H;
  const getXL = (i) => x + HEADER_W + i * (X_COL_W + INT_COL_W);
  const getIL = (i) => getXL(i) + X_COL_W;

  ctx.save();
  ctx.fillStyle = hexToRgba(color, 0.05); ctx.fillRect(x, y, totalW, totalH);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.strokeRect(x, y, totalW, totalH);
  for (let r = 1; r < 3; r++) {
    ctx.beginPath(); ctx.moveTo(x, y + r * ROW_H); ctx.lineTo(x + totalW, y + r * ROW_H); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x + HEADER_W, y); ctx.lineTo(x + HEADER_W, y + totalH); ctx.stroke();
  for (let i = 0; i < n; i++) {
    if (i > 0) { ctx.beginPath(); ctx.moveTo(getXL(i), y); ctx.lineTo(getXL(i), y + totalH); ctx.stroke(); }
    if (i < n - 1) {
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(getIL(i), y); ctx.lineTo(getIL(i), y + totalH); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.font = 'bold italic 12px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('x', x + HEADER_W / 2, y + ROW_H / 2);
  ctx.fillText(`${functionName}'`, x + HEADER_W / 2, y + ROW_H * 1.5);
  ctx.fillText(`${functionName}`, x + HEADER_W / 2, y + ROW_H * 2.5);
  ctx.font = '11px ui-sans-serif,system-ui,sans-serif';
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(xValues[i] ?? ''), getXL(i) + X_COL_W / 2, y + ROW_H / 2);
  }
  ctx.font = 'bold 15px ui-sans-serif,system-ui,sans-serif';
  for (let i = 0; i < n - 1; i++) {
    const sign = derivSigns[i] ?? '+';
    ctx.fillStyle = sign === '+' ? '#34d399' : sign === '-' ? '#f87171' : hexToRgba(color, 0.8);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(sign, getIL(i) + INT_COL_W / 2, y + ROW_H * 1.5);
  }
  ctx.font = '11px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = hexToRgba(color, 0.7);
  for (let i = 1; i < n - 1; i++) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('0', getXL(i) + X_COL_W / 2, y + ROW_H * 1.5);
  }
  const fy = y + 2 * ROW_H; const TOP = fy + 6; const BOT = fy + ROW_H - 6;
  if (boundaryFValues[0]) {
    const atTop = !increasing[0];
    ctx.font = '11px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = atTop ? 'top' : 'bottom';
    ctx.fillText(String(boundaryFValues[0]), getXL(0) + X_COL_W / 2, atTop ? TOP : BOT);
  }
  if (boundaryFValues[1]) {
    const atTop = increasing[increasing.length - 1];
    ctx.font = '11px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = atTop ? 'top' : 'bottom';
    ctx.fillText(String(boundaryFValues[1]), getXL(n - 1) + X_COL_W / 2, atTop ? TOP : BOT);
  }
  for (let i = 1; i < n - 1; i++) {
    const fv = critFValues[i - 1];
    if (fv != null && fv !== '') {
      const isMax = (increasing[i - 1] !== false) && (increasing[i] === false);
      ctx.font = 'bold 11px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
      ctx.textAlign = 'center'; ctx.textBaseline = isMax ? 'bottom' : 'top';
      ctx.fillText(String(fv), getXL(i) + X_COL_W / 2, isMax ? BOT : TOP);
    }
  }
  ctx.lineWidth = 2;
  for (let i = 0; i < n - 1; i++) {
    const inc = increasing[i] !== false;
    const lx = getIL(i) + 6; const rx = getIL(i) + INT_COL_W - 6;
    const sy = inc ? BOT : TOP; const ey = inc ? TOP : BOT;
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(lx, sy); ctx.lineTo(rx, ey); ctx.stroke();
    const ang = Math.atan2(ey - sy, rx - lx); const AS = 8;
    ctx.beginPath();
    ctx.moveTo(rx, ey);
    ctx.lineTo(rx - AS * Math.cos(ang - Math.PI / 7), ey - AS * Math.sin(ang - Math.PI / 7));
    ctx.lineTo(rx - AS * Math.cos(ang + Math.PI / 7), ey - AS * Math.sin(ang + Math.PI / 7));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  ctx.restore();
}

export function variationTableVisualBounds(s) {
  const n = Math.max(2, (s.xValues || []).length);
  return { x: (s.x || 0) - 4, y: (s.y || 0) - 4, w: 54 + n * 38 + (n - 1) * 76 + 8, h: 116 };
}

export function hitTestVariationTable(ctx, s, px, py) {
  const b = variationTableVisualBounds(s);
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/* ── Tableau de signes ───────────────────────────────────────────────────── */
export function drawSignTableStroke(ctx, s) {
  const {
    x = 0, y = 0,
    xValues = ['-∞', '-1', '0', '2', '+∞'],
    rows = [{ label: '(x+1)', signs: ['-', '0', '+', '+', '+', '+', '+'] }],
    color = '#fff', lineWidth: lw = 1.5,
  } = s;
  const n = Math.max(2, xValues.length);
  const HEADER_W = 72; const X_COL_W = 36; const INT_COL_W = 58; const ROW_H = 28;
  const numDataCols = 2 * n - 1;
  const getColLeft = (c) => {
    let w = x + HEADER_W;
    for (let i = 0; i < c; i++) w += i % 2 === 0 ? X_COL_W : INT_COL_W;
    return w;
  };
  const getColW = (c) => c % 2 === 0 ? X_COL_W : INT_COL_W;
  const totalW = HEADER_W + n * X_COL_W + (n - 1) * INT_COL_W;
  const totalH = (rows.length + 1) * ROW_H;

  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.fillStyle = hexToRgba(color, 0.04); ctx.fillRect(x, y, totalW, totalH);
  ctx.strokeRect(x, y, totalW, totalH);

  for (let r = 1; r <= rows.length; r++) {
    const ry = y + r * ROW_H;
    if (r === rows.length && rows[r - 1]?.isFinal) {
      ctx.lineWidth = lw * 1.5;
      ctx.beginPath(); ctx.moveTo(x, ry - 2); ctx.lineTo(x + totalW, ry - 2); ctx.stroke();
      ctx.lineWidth = lw;
    }
    ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x + totalW, ry); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x + HEADER_W, y); ctx.lineTo(x + HEADER_W, y + totalH); ctx.stroke();
  for (let c = 1; c < numDataCols; c++) {
    const cl = getColLeft(c);
    ctx.setLineDash(c % 2 !== 0 ? [3, 3] : []);
    ctx.beginPath(); ctx.moveTo(cl, y); ctx.lineTo(cl, y + totalH); ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.font = 'bold italic 12px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('x', x + HEADER_W / 2, y + ROW_H / 2);
  ctx.font = '11px ui-sans-serif,system-ui,sans-serif';
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(xValues[i] ?? ''), getColLeft(i * 2) + X_COL_W / 2, y + ROW_H / 2);
  }

  rows.forEach((row, ri) => {
    const ry = y + (ri + 1) * ROW_H;
    ctx.font = row.isFinal ? 'bold 11px ui-sans-serif,system-ui,sans-serif' : '11px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(String(row.label || '').slice(0, 14), x + 4, ry + ROW_H / 2);

    const signs = row.signs || [];
    for (let c = 0; c < numDataCols && c < signs.length; c++) {
      const sign = (signs[c] ?? '').trim();
      if (!sign) continue;
      const cl = getColLeft(c); const cw = getColW(c);
      const cellCX = cl + cw / 2; const cellCY = ry + ROW_H / 2;
      ctx.font = 'bold 13px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (sign === '||') {
        ctx.strokeStyle = hexToRgba(color, 0.7); ctx.lineWidth = lw * 1.5;
        [cellCX - 4, cellCX + 4].forEach((lx) => {
          ctx.beginPath(); ctx.moveTo(lx, ry + 3); ctx.lineTo(lx, ry + ROW_H - 3); ctx.stroke();
        });
        ctx.lineWidth = lw; ctx.strokeStyle = color;
      } else if (sign === '0') {
        ctx.fillStyle = hexToRgba(color, 0.8); ctx.fillText('0', cellCX, cellCY);
      } else if (sign === '+') {
        ctx.fillStyle = '#34d399'; ctx.fillText('+', cellCX, cellCY);
      } else if (sign === '-') {
        ctx.fillStyle = '#f87171'; ctx.fillText('−', cellCX, cellCY);
      } else {
        ctx.fillStyle = color; ctx.fillText(sign, cellCX, cellCY);
      }
    }
  });
  ctx.restore();
}

export function signTableVisualBounds(s) {
  const n = Math.max(2, (s.xValues || []).length);
  const rows = Math.max(1, (s.rows || []).length) + 1;
  return { x: (s.x || 0) - 4, y: (s.y || 0) - 4, w: 72 + n * 36 + (n - 1) * 58 + 8, h: rows * 28 + 8 };
}

export function hitTestSignTable(ctx, s, px, py) {
  const b = signTableVisualBounds(s);
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/* ── Arbre de probabilités ───────────────────────────────────────────────── */
export function drawProbTreeStroke(ctx, s) {
  const {
    x = 0, y = 0,
    l1 = [{ label: 'A', p: '0.3' }, { label: 'Ā', p: '0.7' }],
    l2 = [[{ label: 'B', p: '0.4' }, { label: 'B̄', p: '0.6' }], [{ label: 'B', p: '0.2' }, { label: 'B̄', p: '0.8' }]],
    color = '#fff', lineWidth: lw = 1.5,
    showProducts = true, levelW = 130, branchSpacing = 52,
  } = s;

  const n1 = l1.length;
  const maxSub = Math.max(1, ...l2.map((sub) => (sub || []).length));
  const totalH = n1 * maxSub * branchSpacing;
  const rootX = x; const rootY = y + totalH / 2;

  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';

  /* root dot */
  ctx.beginPath(); ctx.arc(rootX, rootY, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();

  const l1Pos = l1.map((_, i) => ({
    x: rootX + levelW,
    y: rootY + (i - (n1 - 1) / 2) * maxSub * branchSpacing,
  }));

  l1.forEach((branch, i) => {
    const pos = l1Pos[i];
    ctx.beginPath(); ctx.moveTo(rootX, rootY); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();

    ctx.font = '11px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(String(branch.p || ''), (rootX + pos.x) / 2, (rootY + pos.y) / 2 - 3);
    ctx.font = 'bold 12px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(String(branch.label || ''), pos.x + 6, pos.y - 12);

    const subs = l2[i] || [];
    const ns = subs.length;
    subs.forEach((sub, j) => {
      const sp = { x: pos.x + levelW, y: pos.y + (j - (ns - 1) / 2) * branchSpacing };
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(sp.x, sp.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();

      ctx.font = '11px ui-sans-serif,system-ui,sans-serif'; ctx.fillStyle = color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(String(sub.p || ''), (pos.x + sp.x) / 2, (pos.y + sp.y) / 2 - 3);
      ctx.font = 'bold 11px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(String(sub.label || ''), sp.x + 6, sp.y);

      if (showProducts) {
        const p1 = parseFloat(branch.p) || 0; const p2 = parseFloat(sub.p) || 0;
        const prod = (p1 * p2).toFixed(4).replace(/\.?0+$/, '');
        ctx.font = 'italic 10px ui-sans-serif,system-ui,sans-serif';
        ctx.fillStyle = hexToRgba(color, 0.55); ctx.textAlign = 'left';
        ctx.fillText(`= ${prod}`, sp.x + 22, sp.y + 11);
      }
    });
  });
  ctx.restore();
}

export function probTreeVisualBounds(s) {
  const n1 = (s.l1 || []).length; const maxSub = Math.max(1, ...(s.l2 || []).map((sub) => (sub || []).length));
  const h = n1 * maxSub * (s.branchSpacing || 52);
  const w = (s.levelW || 130) * 2 + 120;
  return { x: (s.x || 0) - 10, y: (s.y || 0) - 10, w: w, h: h + 20 };
}

export function hitTestProbTree(ctx, s, px, py) {
  const b = probTreeVisualBounds(s);
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/* ── Composant électrique ────────────────────────────────────────────────── */
export function drawElectricComponentStroke(ctx, s) {
  const { cx = 0, cy = 0, component = 'resistor', size = 50, angle = 0, color = '#fff', lineWidth: lw = 1.5, label = '' } = s;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(angle);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';

  const hs = size / 2;
  switch (component) {
    case 'resistor': {
      const bw = size * 0.55; const bh = size * 0.22;
      ctx.beginPath(); ctx.moveTo(-hs, 0); ctx.lineTo(-bw / 2, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bw / 2, 0); ctx.lineTo(hs, 0); ctx.stroke();
      ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
      break;
    }
    case 'lamp': {
      const r = size * 0.26;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      [[[-r * 0.65, -r * 0.65], [r * 0.65, r * 0.65]], [[r * 0.65, -r * 0.65], [-r * 0.65, r * 0.65]]].forEach(([[x1, y1], [x2, y2]]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(-hs, 0); ctx.lineTo(-r, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(hs, 0); ctx.stroke();
      break;
    }
    case 'battery': {
      const lH = size * 0.36; const sH = size * 0.22;
      ctx.beginPath(); ctx.moveTo(-hs, 0); ctx.lineTo(-size * 0.07, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.07, 0); ctx.lineTo(hs, 0); ctx.stroke();
      ctx.lineWidth = lw * 1.8;
      ctx.beginPath(); ctx.moveTo(-size * 0.07, -lH); ctx.lineTo(-size * 0.07, lH); ctx.stroke();
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(size * 0.07, -sH); ctx.lineTo(size * 0.07, sH); ctx.stroke();
      break;
    }
    case 'switch-open': {
      const r = size * 0.1;
      ctx.beginPath(); ctx.moveTo(-hs, 0); ctx.lineTo(-r * 1.5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 1.5, 0); ctx.lineTo(hs, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 1.5, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 1.5, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, -size * 0.22); ctx.stroke();
      break;
    }
    case 'switch-closed': {
      const r = size * 0.1;
      ctx.beginPath(); ctx.moveTo(-hs, 0); ctx.lineTo(-r * 1.5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 1.5, 0); ctx.lineTo(hs, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 1.5, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 1.5, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke();
      break;
    }
    case 'ammeter': case 'voltmeter': case 'generator': {
      const r = size * 0.3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.font = `bold ${Math.round(r * 0.95)}px ui-sans-serif,system-ui,sans-serif`;
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(component === 'ammeter' ? 'A' : component === 'voltmeter' ? 'V' : '~', 0, 0);
      ctx.beginPath(); ctx.moveTo(-hs, 0); ctx.lineTo(-r, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(hs, 0); ctx.stroke();
      break;
    }
    case 'capacitor': {
      const gap = size * 0.14; const ph = size * 0.34;
      ctx.beginPath(); ctx.moveTo(-hs, 0); ctx.lineTo(-gap, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gap, 0); ctx.lineTo(hs, 0); ctx.stroke();
      [[-gap, gap], [gap, -gap]].forEach(([gx]) => {
        ctx.beginPath(); ctx.moveTo(gx, -ph); ctx.lineTo(gx, ph); ctx.stroke();
      });
      break;
    }
    case 'diode': {
      const r = size * 0.22;
      ctx.beginPath(); ctx.moveTo(-hs, 0); ctx.lineTo(-r, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(hs, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(-r, r); ctx.lineTo(r, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r, -r); ctx.lineTo(r, r); ctx.stroke();
      break;
    }
    case 'ground': {
      ctx.beginPath(); ctx.moveTo(0, -size * 0.3); ctx.lineTo(0, 0); ctx.stroke();
      [0, 1, 2].forEach((i) => {
        const gw = size * 0.38 * (1 - i * 0.27); const gy = i * size * 0.12;
        ctx.beginPath(); ctx.moveTo(-gw / 2, gy); ctx.lineTo(gw / 2, gy); ctx.stroke();
      });
      break;
    }
    case 'junction': {
      ctx.beginPath(); ctx.arc(0, 0, size * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      break;
    }
    default:
      ctx.beginPath(); ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2); ctx.stroke();
  }

  if (label) {
    ctx.font = '11px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(label, 0, size * 0.36);
  }
  ctx.restore();
}

export function electricComponentVisualBounds(s) {
  const sz = (s.size || 50) + 20;
  return { x: (s.cx || 0) - sz, y: (s.cy || 0) - sz, w: sz * 2, h: sz * 2 };
}

export function hitTestElectricComponent(ctx, s, px, py) {
  const r = (s.size || 50) / 2 + 8;
  return Math.hypot(px - (s.cx || 0), py - (s.cy || 0)) <= r;
}

export const SCHOOL_KINDS = new Set([
  'arrow', 'polyline', 'polygon', 'triangle', 'star',
  'frame', 'axes', 'numberline', 'table', 'ruler', 'protractor', 'latex', 'arc',
  'angle-mark', 'coord-point',
  'vector', 'fraction', 'function-plot',
  'segment', 'measure', 'value-table', 'histogram',
  'pie-chart', 'scatter-plot',
  'curtain', 'variation-table',
  'sign-table', 'prob-tree', 'electric-component',
]);

export function isSchoolKind(kind) { return SCHOOL_KINDS.has(kind); }

export function drawSchoolStroke(ctx, stroke) {
  switch (stroke.kind) {
    case 'coord-point': drawCoordPointStroke(ctx, stroke); break;
    case 'angle-mark': drawAngleMarkStroke(ctx, stroke); break;
    case 'arc': drawArcStroke(ctx, stroke); break;
    case 'arrow': drawArrowStroke(ctx, stroke); break;
    case 'polyline': drawPolylineStroke(ctx, stroke); break;
    case 'polygon': drawPolygonStroke(ctx, stroke); break;
    case 'triangle': drawTriangleStroke(ctx, stroke); break;
    case 'star': drawStarStroke(ctx, stroke); break;
    case 'frame': drawFrameStroke(ctx, stroke); break;
    case 'axes': drawAxesStroke(ctx, stroke); break;
    case 'numberline': drawNumberlineStroke(ctx, stroke); break;
    case 'table': drawTableStroke(ctx, stroke); break;
    case 'ruler': drawRulerStroke(ctx, stroke); break;
    case 'protractor': drawProtractorStroke(ctx, stroke); break;
    case 'latex': drawLatexStroke(ctx, stroke); break;
    case 'vector': drawVectorStroke(ctx, stroke); break;
    case 'fraction': drawFractionStroke(ctx, stroke); break;
    case 'function-plot': drawFunctionPlotStroke(ctx, stroke); break;
    case 'segment': drawSegmentStroke(ctx, stroke); break;
    case 'measure': drawMeasureStroke(ctx, stroke); break;
    case 'value-table': drawValueTableStroke(ctx, stroke); break;
    case 'histogram': drawHistogramStroke(ctx, stroke); break;
    case 'pie-chart': drawPieChartStroke(ctx, stroke); break;
    case 'scatter-plot': drawScatterPlotStroke(ctx, stroke); break;
    case 'curtain': drawCurtainStroke(ctx, stroke); break;
    case 'variation-table': drawVariationTableStroke(ctx, stroke); break;
    case 'sign-table': drawSignTableStroke(ctx, stroke); break;
    case 'prob-tree': drawProbTreeStroke(ctx, stroke); break;
    case 'electric-component': drawElectricComponentStroke(ctx, stroke); break;
    default: break;
  }
}

export function schoolStrokeVisualBounds(ctx, stroke) {
  switch (stroke.kind) {
    case 'coord-point': return coordPointVisualBounds(stroke);
    case 'angle-mark': return angleMarkVisualBounds(stroke);
    case 'arc': return arcVisualBounds(stroke);
    case 'arrow': return arrowVisualBounds(stroke);
    case 'polyline': return polylineVisualBounds(stroke);
    case 'polygon': return polygonVisualBounds(stroke);
    case 'triangle': return triangleVisualBounds(stroke);
    case 'star': return starVisualBounds(stroke);
    case 'frame': return frameVisualBounds(stroke);
    case 'axes': return axesVisualBounds(stroke);
    case 'numberline': return numberlineVisualBounds(stroke);
    case 'table': return tableVisualBounds(stroke);
    case 'ruler': return rulerVisualBounds(stroke);
    case 'protractor': return protractorVisualBounds(stroke);
    case 'latex': return latexVisualBounds(stroke);
    case 'vector': return vectorVisualBounds(stroke);
    case 'fraction': return fractionVisualBounds(stroke);
    case 'function-plot': return functionPlotVisualBounds(stroke);
    case 'segment': return segmentVisualBounds(stroke);
    case 'measure': return measureVisualBounds(stroke);
    case 'value-table': return valueTableVisualBounds(stroke);
    case 'histogram': return histogramVisualBounds(stroke);
    case 'pie-chart': return pieChartVisualBounds(stroke);
    case 'scatter-plot': return scatterPlotVisualBounds(stroke);
    case 'curtain': return curtainVisualBounds(stroke);
    case 'variation-table': return variationTableVisualBounds(stroke);
    case 'sign-table': return signTableVisualBounds(stroke);
    case 'prob-tree': return probTreeVisualBounds(stroke);
    case 'electric-component': return electricComponentVisualBounds(stroke);
    default: return null;
  }
}

export function hitTestSchoolStroke(ctx, stroke, px, py) {
  switch (stroke.kind) {
    case 'coord-point': return hitTestCoordPoint(ctx, stroke, px, py);
    case 'angle-mark': return hitTestAngleMark(ctx, stroke, px, py);
    case 'arc': return hitTestArc(ctx, stroke, px, py);
    case 'arrow': return hitTestArrow(ctx, stroke, px, py);
    case 'polyline': return hitTestPolyline(ctx, stroke, px, py);
    case 'polygon': return hitTestPolygon(ctx, stroke, px, py);
    case 'triangle': return hitTestTriangle(ctx, stroke, px, py);
    case 'star': return hitTestStar(ctx, stroke, px, py);
    case 'frame': return hitTestFrame(ctx, stroke, px, py);
    case 'axes': return hitTestAxes(ctx, stroke, px, py);
    case 'numberline': return hitTestNumberline(ctx, stroke, px, py);
    case 'table': return hitTestTable(ctx, stroke, px, py);
    case 'ruler': return hitTestRuler(ctx, stroke, px, py);
    case 'protractor': return hitTestProtractor(ctx, stroke, px, py);
    case 'latex': return hitTestLatex(ctx, stroke, px, py);
    case 'vector': return hitTestVector(ctx, stroke, px, py);
    case 'fraction': return hitTestFraction(ctx, stroke, px, py);
    case 'function-plot': return hitTestFunctionPlot(ctx, stroke, px, py);
    case 'segment': return hitTestSegment(ctx, stroke, px, py);
    case 'measure': return hitTestMeasure(ctx, stroke, px, py);
    case 'value-table': return hitTestValueTable(ctx, stroke, px, py);
    case 'histogram': return hitTestHistogram(ctx, stroke, px, py);
    case 'pie-chart': return hitTestPieChart(ctx, stroke, px, py);
    case 'scatter-plot': return hitTestScatterPlot(ctx, stroke, px, py);
    case 'curtain': return hitTestCurtain(ctx, stroke, px, py);
    case 'variation-table': return hitTestVariationTable(ctx, stroke, px, py);
    case 'sign-table': return hitTestSignTable(ctx, stroke, px, py);
    case 'prob-tree': return hitTestProbTree(ctx, stroke, px, py);
    case 'electric-component': return hitTestElectricComponent(ctx, stroke, px, py);
    default: return false;
  }
}
