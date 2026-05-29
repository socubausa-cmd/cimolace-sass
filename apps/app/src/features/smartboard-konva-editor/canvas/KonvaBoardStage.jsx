import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import { Stage, Layer, Transformer, Rect, Text, Line, Circle, Group, Shape, Ellipse } from 'react-konva';
import { useToast } from '@/components/ui/use-toast';
import KonvaBoardObject from './KonvaBoardObject';
import { sortObjectsByLayer } from '../model/sceneModel';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';

export function transformerBoundBoxFunc(oldBox, newBox) {
  if (newBox.width < 14 || newBox.height < 14) return oldBox;
  return newBox;
}

function snapScalar(v, grid) {
  if (!grid || grid <= 0) return v;
  return Math.round(v / grid) * grid;
}

function snapPosAttrs(attrs, grid) {
  if (!grid) return attrs;
  return {
    ...attrs,
    x: snapScalar(attrs.x, grid),
    y: snapScalar(attrs.y, grid),
  };
}

/** Maj pendant le drag : verrouille le déplacement sur l'axe dominant (H ou V). */
function applyShiftAxisLock(attrs, origin, shiftKey) {
  if (!shiftKey || !origin) return attrs;
  const dx = attrs.x - origin.x;
  const dy = attrs.y - origin.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { ...attrs, y: origin.y };
  }
  return { ...attrs, x: origin.x };
}

/** Pendant déplacement : pas de reset scale */
function dragAttrs(obj, node) {
  const rot = node.rotation();
  if (obj.type === 'circle') {
    const r = node.radius();
    return {
      x: node.x() - r,
      y: node.y() - r,
      width: obj.width,
      height: obj.height,
      rotation: rot,
    };
  }
  if (obj.type === 'ellipse') {
    const rx = node.radiusX();
    const ry = node.radiusY();
    return {
      x: node.x() - rx,
      y: node.y() - ry,
      width: rx * 2,
      height: ry * 2,
      rotation: rot,
    };
  }
  return {
    x: node.x(),
    y: node.y(),
    width: obj.width,
    height: obj.height,
    rotation: rot,
  };
}

/** Fin transform : normalise scale sur le nœud + dims finales */
function finalizeTransformAttrs(obj, node) {
  const rot = node.rotation();

  if (obj.type === 'circle') {
    const sc = node.scaleX();
    const r = Math.max(7, (node.radius() || Math.min(obj.width, obj.height) / 2) * sc);
    node.scaleX(1);
    node.scaleY(1);
    node.radius(r);
    const w = r * 2;
    return {
      x: node.x() - r,
      y: node.y() - r,
      width: w,
      height: w,
      rotation: rot,
    };
  }

  if (obj.type === 'ellipse') {
    const scx = node.scaleX();
    const scy = node.scaleY();
    let rx = node.radiusX() * scx;
    let ry = node.radiusY() * scy;
    node.scaleX(1);
    node.scaleY(1);
    rx = Math.max(4, rx);
    ry = Math.max(4, ry);
    node.radiusX(rx);
    node.radiusY(ry);
    return {
      x: node.x() - rx,
      y: node.y() - ry,
      width: rx * 2,
      height: ry * 2,
      rotation: rot,
    };
  }

  if (obj.type === 'line' || obj.type === 'arrow') {
    const scx = node.scaleX();
    const scy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const raw = [...node.points()];
    const pts = [];
    for (let i = 0; i < raw.length; i += 2) {
      pts.push(raw[i] * scx, raw[i + 1] * scy);
    }
    node.points(pts);
    const box = node.getClientRect({ skipTransform: true });
    return {
      x: node.x(),
      y: node.y(),
      width: Math.max(14, box.width),
      height: Math.max(14, box.height),
      rotation: node.rotation(),
      content: { points: pts },
    };
  }

  const sx = node.scaleX();
  const sy = node.scaleY();
  const w = Math.max(14, node.width() * sx);
  const h = Math.max(14, node.height() * sy);
  node.scaleX(1);
  node.scaleY(1);
  node.width(w);
  node.height(h);

  return {
    x: node.x(),
    y: node.y(),
    width: w,
    height: h,
    rotation: rot,
  };
}

/** Aperçu live pendant resize (sans muter le nœud) */
function transformPreviewAttrs(obj, node) {
  const rot = node.rotation();
  if (obj.type === 'circle') {
    const sc = node.scaleX();
    const r = (node.radius() || Math.min(obj.width, obj.height) / 2) * sc;
    const w = Math.max(14, r * 2);
    return {
      x: node.x() - r,
      y: node.y() - r,
      width: w,
      height: w,
      rotation: rot,
    };
  }
  if (obj.type === 'ellipse') {
    const scx = node.scaleX();
    const scy = node.scaleY();
    const rx = node.radiusX() * scx;
    const ry = node.radiusY() * scy;
    return {
      x: node.x() - rx,
      y: node.y() - ry,
      width: Math.max(14, rx * 2),
      height: Math.max(14, ry * 2),
      rotation: rot,
    };
  }
  if (obj.type === 'line' || obj.type === 'arrow') {
    const box = node.getClientRect({ skipTransform: false });
    return {
      x: node.x(),
      y: node.y(),
      width: Math.max(14, box.width),
      height: Math.max(14, box.height),
      rotation: rot,
    };
  }
  const sx = node.scaleX();
  const sy = node.scaleY();
  return {
    x: node.x(),
    y: node.y(),
    width: Math.max(14, node.width() * sx),
    height: Math.max(14, node.height() * sy),
    rotation: rot,
  };
}

function clientRectIntersectsStage(box, stageW, stageH) {
  return !(
    box.x + box.width <= 0 ||
    box.x >= stageW ||
    box.y + box.height <= 0 ||
    box.y >= stageH
  );
}

function normMarqueeBox(x0, y0, x1, y1) {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return {
    x,
    y,
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
}

function aabbIntersects(ax, ay, aw, ah, bx, by, bw, bh) {
  return !(ax + aw < bx || bx + bw < ax || ay + ah < by || by + bh < ay);
}

/** Boîte englobante d'une liste de points (doc). */
function polygonBBox(pts) {
  if (!pts?.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Ray casting — polygone fermé (arête dernier → premier). */
function pointInPolygon(x, y, poly) {
  if (!poly?.length) return false;
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const denom = yj - yi;
    if (Math.abs(denom) < 1e-12) continue;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / denom + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Limite la taille du tableau de points pour le JSON LONGIA. */
const LASSO_POINTS_CONTEXT_CAP = 160;

function capLassoPoints(pts, maxN) {
  if (pts.length <= maxN) return pts.map((p) => ({ x: p.x, y: p.y }));
  const n = pts.length;
  const out = [];
  for (let i = 0; i < maxN; i++) {
    const t = i === maxN - 1 ? n - 1 : (i / (maxN - 1)) * (n - 1);
    const j = Math.floor(t);
    const f = t - j;
    const a = pts[j];
    const b = pts[Math.min(j + 1, n - 1)];
    out.push({ x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) });
  }
  return out;
}

function clampScalar(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Nœud Image Konva pour l'objet (direct ou dans un Group masque). */
function getBoardImageNode(nodeRefs, id) {
  const n = nodeRefs.current[id];
  if (!n) return null;
  const name = n.getClassName?.();
  if (name === 'Image') return n;
  if (name === 'Group') return n.findOne?.('Image') || null;
  return null;
}

/** Tolérance clip / intersections (bords du rectangle de sélection). */
const CROP_CLIP_EPS = 1e-4;

function intersectSegVertical(p1, p2, x0) {
  const dx = p2.x - p1.x;
  if (Math.abs(dx) < 1e-10) return null;
  const t = (x0 - p1.x) / dx;
  if (t < -CROP_CLIP_EPS || t > 1 + CROP_CLIP_EPS) return null;
  const tc = clampScalar(t, 0, 1);
  return { x: x0, y: p1.y + tc * (p2.y - p1.y) };
}

function intersectSegHorizontal(p1, p2, y0) {
  const dy = p2.y - p1.y;
  if (Math.abs(dy) < 1e-10) return null;
  const t = (y0 - p1.y) / dy;
  if (t < -CROP_CLIP_EPS || t > 1 + CROP_CLIP_EPS) return null;
  const tc = clampScalar(t, 0, 1);
  return { x: p1.x + tc * (p2.x - p1.x), y: y0 };
}

function clipPolygonByHalfPlane(poly, inside, lineIntersect) {
  if (!poly?.length) return [];
  const out = [];
  let prev = poly[poly.length - 1];
  let prevI = inside(prev);
  for (const cur of poly) {
    const curI = inside(cur);
    if (curI) {
      if (!prevI) {
        const ip = lineIntersect(prev, cur);
        if (ip) out.push(ip);
      }
      out.push(cur);
    } else if (prevI) {
      const ip = lineIntersect(prev, cur);
      if (ip) out.push(ip);
    }
    prev = cur;
    prevI = curI;
  }
  return out;
}

/** Intersection d'un polygone convexe avec un rectangle aligné aux axes (espace doc). */
function clipPolygonByAxisRect(poly, rx, ry, rw, rh) {
  const left = rx;
  const right = rx + rw;
  const top = ry;
  const bottom = ry + rh;
  let p = poly;
  p = clipPolygonByHalfPlane(
    p,
    (pt) => pt.x >= left - CROP_CLIP_EPS,
    (a, b) => intersectSegVertical(a, b, left),
  );
  p = clipPolygonByHalfPlane(
    p,
    (pt) => pt.x <= right + CROP_CLIP_EPS,
    (a, b) => intersectSegVertical(a, b, right),
  );
  p = clipPolygonByHalfPlane(
    p,
    (pt) => pt.y >= top - CROP_CLIP_EPS,
    (a, b) => intersectSegHorizontal(a, b, top),
  );
  p = clipPolygonByHalfPlane(
    p,
    (pt) => pt.y <= bottom + CROP_CLIP_EPS,
    (a, b) => intersectSegHorizontal(a, b, bottom),
  );
  return p;
}

/** Points le long du périmètre (stabilité inverse transform / flottants). */
function densifyClosedPolygon(poly, segmentsPerEdge = 20) {
  if (!poly?.length) return [];
  const n = poly.length;
  const out = [];
  const seg = Math.max(4, segmentsPerEdge);
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    for (let s = 0; s < seg; s++) {
      const t = s / seg;
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return out;
}

function polygonSignedArea(pts) {
  if (!pts?.length) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
}

function imageCornersDoc(node, iw, ih) {
  const m = node.getAbsoluteTransform();
  return [
    m.point({ x: 0, y: 0 }),
    m.point({ x: iw, y: 0 }),
    m.point({ x: iw, y: ih }),
    m.point({ x: 0, y: ih }),
  ];
}

/**
 * Boîte recadrage en coords locales image (0..iw × 0..ih), prise dans le cadre tourné.
 * Densification du contour puis AABB locale = enveloppe serrée (repère séparable → texture).
 */
function localCropBoxFromDocSelection(node, iw, ih, norm) {
  const corners = imageCornersDoc(node, iw, ih);
  const clipped = clipPolygonByAxisRect(corners, norm.x, norm.y, norm.width, norm.height);
  if (clipped.length < 3) return null;
  if (Math.abs(polygonSignedArea(clipped)) < 0.25) return null;
  const inv = node.getAbsoluteTransform().copy().invert();
  const denseDoc = densifyClosedPolygon(clipped, 24);
  const locals = denseDoc.map((p) => inv.point(p));
  const minX = Math.min(...locals.map((p) => p.x));
  const maxX = Math.max(...locals.map((p) => p.x));
  const minY = Math.min(...locals.map((p) => p.y));
  const maxY = Math.max(...locals.map((p) => p.y));
  const lx = clampScalar(minX, 0, iw);
  const ly = clampScalar(minY, 0, ih);
  const lw = Math.max(2, clampScalar(maxX - minX, 2, iw - lx));
  const lh = Math.max(2, clampScalar(maxY - minY, 2, ih - ly));
  if (lw < 4 || lh < 4) return null;
  return { lx, ly, lw, lh };
}

/** @param {import('konva').Stage | null} stage */
function clientToStage(stage, clientX, clientY) {
  if (!stage) return { x: 0, y: 0 };
  const rect = stage.container().getBoundingClientRect();
  const sc = stage.scaleX() || 1;
  return {
    x: (clientX - rect.left) / sc,
    y: (clientY - rect.top) / sc,
  };
}

const KonvaBoardStage = forwardRef(function KonvaBoardStage(
  {
    width,
    height,
    scale,
    background,
    objects,
    selectedIds,
    selectOnly,
    toggleSelect,
    pushHistory,
    updateObjectTransform,
    snapGrid = 0,
    /** Grille d'édition façon maillage (pixels), ex. 8 */
    showEditGrid = false,
    editGridSize = 8,
    /** Chaque clic sur un objet (y compris déjà sélectionné) → panneau Propriétés */
    onObjectPrimaryClick,
    onTextDblClick,
    /** Glisser entièrement hors du canvas → suppression */
    onDeleteObject,
    /** Clic molette sur objet (image, icône, …) → aperçu agrandi */
    onObjectMiddleClick,
    /** Glisser / redimensionner / rotation — pour présence Copilot (examen canvas) */
    onUserCanvasGesture,
  },
  ref,
) {
  const trRef = useRef(null);
  const konvaStageRef = useRef(null);
  const layerRef = useRef(null);
  const nodeRefs = useRef({});
  /** { x, y } modèle au début du drag — contrainte axe avec Maj */
  const dragOriginRef = useRef(null);

  // ── Studio workbench : sélection par région ─────────────────────────────
  const interactionTool = useSmartboardKonvaStore((s) => s.interactionTool);
  const setRegionMarquee = useSmartboardKonvaStore((s) => s.setRegionMarquee);
  const clearRegionMarquee = useSmartboardKonvaStore((s) => s.clearRegionMarquee);
  const setSelectedIds = useSmartboardKonvaStore((s) => s.setSelectedIds);
  const setInteractionTool = useSmartboardKonvaStore((s) => s.setInteractionTool);
  const updateObject = useSmartboardKonvaStore((s) => s.updateObject);
  const { toast } = useToast();

  const isMarqueeMode =
    interactionTool === 'marquee-rect' ||
    interactionTool === 'marquee-ellipse' ||
    interactionTool === 'marquee-lasso';
  const isCropMode = interactionTool === 'crop-image';
  const blockObjectHit = isMarqueeMode || isCropMode;
  const [marqueeDraft, setMarqueeDraft] = useState(null);
  const [cropDraft, setCropDraft] = useState(null);

  // ── Vector drawing state ────────────────────────────────────────────────
  const activeVectorTool = useSmartboardKonvaStore((s) => s.activeVectorTool);
  const pencilSize      = useSmartboardKonvaStore((s) => s.pencilSize ?? 2);
  const setPencilSize   = useSmartboardKonvaStore((s) => s.setPencilSize ?? (() => {}));
  const addObject        = useSmartboardKonvaStore((s) => s.addObject);
  const pushHistoryStore = useSmartboardKonvaStore((s) => s.pushHistory);
  const isPenMode        = activeVectorTool === 'pen';
  const isPencilMode     = activeVectorTool === 'pencil';
  const isDirectSelect   = activeVectorTool === 'directSelect';

  /** Points du tracé en cours [[x,y], …] */
  const [penPoints,      setPenPoints]     = useState([]);
  /** Position de la souris pour la ligne de preview */
  const [penPreview,     setPenPreview]    = useState(null);
  /** true = le crayon est en train de dessiner (mousedown tenu) */
  const [pencilActive,   setPencilActive]  = useState(false);

  const setNodeRef = (id) => (node) => {
    if (node) nodeRefs.current[id] = node;
    else delete nodeRefs.current[id];
  };

  const sorted = useMemo(() => sortObjectsByLayer(objects), [objects]);
  const lockedIds = useMemo(() => new Set(sorted.filter((o) => o.locked).map((o) => o.id)), [sorted]);

  const finalizeMarqueeFromDraft = useCallback(
    (d, shiftKey, altKey) => {
      if (d.kind === 'lasso') {
        const raw = d.points || [];
        if (raw.length < 3) {
          clearRegionMarquee();
          selectOnly?.(null);
          return;
        }
        const bbox = polygonBBox(raw);
        if (bbox.width < 3 && bbox.height < 3) {
          clearRegionMarquee();
          selectOnly?.(null);
          return;
        }
        const storedPts = capLassoPoints(raw, LASSO_POINTS_CONTEXT_CAP);
        setRegionMarquee({
          kind: 'lasso',
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
          points: storedPts,
        });
        const insideIds = sorted
          .filter((o) => {
            const cx = o.x + (o.width ?? 0) / 2;
            const cy = o.y + (o.height ?? 0) / 2;
            return pointInPolygon(cx, cy, raw);
          })
          .map((o) => o.id);
        const cur = useSmartboardKonvaStore.getState().selectedIds;
        if (altKey) {
          setSelectedIds(cur.filter((id) => !insideIds.includes(id)));
        } else if (shiftKey) {
          setSelectedIds([...new Set([...cur, ...insideIds])]);
        } else {
          setSelectedIds(insideIds);
        }
        return;
      }

      const norm = normMarqueeBox(d.x0, d.y0, d.x1, d.y1);
      if (norm.width < 3 && norm.height < 3) {
        clearRegionMarquee();
        selectOnly?.(null);
        return;
      }
      setRegionMarquee({
        kind: d.kind,
        x: norm.x,
        y: norm.y,
        width: norm.width,
        height: norm.height,
      });
      const insideIds = sorted
        .filter((o) =>
          aabbIntersects(norm.x, norm.y, norm.width, norm.height, o.x, o.y, o.width, o.height),
        )
        .map((o) => o.id);
      const cur = useSmartboardKonvaStore.getState().selectedIds;
      if (altKey) {
        setSelectedIds(cur.filter((id) => !insideIds.includes(id)));
      } else if (shiftKey) {
        setSelectedIds([...new Set([...cur, ...insideIds])]);
      } else {
        setSelectedIds(insideIds);
      }
    },
    [sorted, setRegionMarquee, setSelectedIds, clearRegionMarquee, selectOnly],
  );

  const finalizeCropFromDraft = useCallback(
    (d) => {
      const imgObj = sorted.find((o) => o.id === d.imageId && o.type === 'image');
      if (!imgObj || imgObj.locked) return;
      const norm = normMarqueeBox(d.x0, d.y0, d.x1, d.y1);
      if (norm.width < 3 || norm.height < 3) return;

      const iw = imgObj.width;
      const ih = imgObj.height;
      const kNode = getBoardImageNode(nodeRefs, d.imageId);
      const htmlImg = kNode && typeof kNode.image === 'function' ? kNode.image() : null;
      const nw = htmlImg?.naturalWidth || 0;
      const nh = htmlImg?.naturalHeight || 0;
      if (!nw || !nh) {
        toast({
          variant: 'destructive',
          title: 'Recadrage',
          description: 'Image pas encore chargée — réessayez dans un instant.',
        });
        return;
      }

      if (!kNode) {
        toast({
          variant: 'destructive',
          title: 'Recadrage',
          description: 'Nœud image introuvable.',
        });
        return;
      }

      const localBox = localCropBoxFromDocSelection(kNode, iw, ih, norm);
      if (!localBox) {
        toast({
          variant: 'destructive',
          title: 'Recadrage',
          description: 'Zone trop petite ou hors du cadre image.',
        });
        return;
      }
      const { lx, ly, lw, lh } = localBox;

      const crop0 = imgObj.content?.crop;
      const hasCrop =
        crop0 &&
        typeof crop0 === 'object' &&
        Number(crop0.width) > 0 &&
        Number(crop0.height) > 0;
      const cx0 = hasCrop ? Number(crop0.x) || 0 : 0;
      const cy0 = hasCrop ? Number(crop0.y) || 0 : 0;
      const cw0 = hasCrop ? Number(crop0.width) : nw;
      const ch0 = hasCrop ? Number(crop0.height) : nh;

      const u0 = cx0 + (lx / iw) * cw0;
      const u1 = cx0 + ((lx + lw) / iw) * cw0;
      const v0 = cy0 + (ly / ih) * ch0;
      const v1 = cy0 + ((ly + lh) / ih) * ch0;
      const rawMinX = Math.min(u0, u1);
      const rawMaxX = Math.max(u0, u1);
      const rawMinY = Math.min(v0, v1);
      const rawMaxY = Math.max(v0, v1);

      const minPix = 2;
      let sx = Math.max(0, Math.min(Math.max(0, nw - minPix), Math.floor(rawMinX)));
      let sy = Math.max(0, Math.min(Math.max(0, nh - minPix), Math.floor(rawMinY)));
      const sRight = Math.min(nw, Math.max(sx + minPix, Math.ceil(rawMaxX)));
      const sBottom = Math.min(nh, Math.max(sy + minPix, Math.ceil(rawMaxY)));
      let sw = Math.min(nw - sx, sRight - sx);
      let sh = Math.min(nh - sy, sBottom - sy);
      const minW = nw >= minPix ? minPix : 1;
      const minH = nh >= minPix ? minPix : 1;
      sw = Math.max(minW, sw);
      sh = Math.max(minH, sh);

      pushHistoryStore();
      updateObject(d.imageId, {
        content: {
          ...imgObj.content,
          crop: { x: sx, y: sy, width: sw, height: sh },
        },
      });
      toast({
        title: 'Recadrage appliqué',
        description: `Zone source ${sw}×${sh} px — ajustez encore dans Propriétés si besoin.`,
      });
      setInteractionTool('pointer');
    },
    [sorted, pushHistoryStore, updateObject, toast, setInteractionTool],
  );

  useLayoutEffect(() => {
    if (!marqueeDraft && !cropDraft) return undefined;
    const onMove = (e) => {
      if (!konvaStageRef.current) return;
      const pos = clientToStage(konvaStageRef.current, e.clientX, e.clientY);
      setMarqueeDraft((prev) => {
        if (!prev) return prev;
        if (prev.kind === 'lasso') {
          const last = prev.points[prev.points.length - 1];
          const dx = pos.x - last.x;
          const dy = pos.y - last.y;
          if (dx * dx + dy * dy < 4) return prev;
          return { ...prev, points: [...prev.points, pos] };
        }
        return { ...prev, x1: pos.x, y1: pos.y };
      });
      setCropDraft((prev) => (prev ? { ...prev, x1: pos.x, y1: pos.y } : prev));
    };
    const onUp = (e) => {
      setMarqueeDraft((prev) => {
        if (!prev) return null;
        finalizeMarqueeFromDraft(prev, e.shiftKey, e.altKey);
        return null;
      });
      setCropDraft((prev) => {
        if (!prev) return null;
        finalizeCropFromDraft(prev);
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [marqueeDraft, cropDraft, finalizeMarqueeFromDraft, finalizeCropFromDraft]);

  useImperativeHandle(
    ref,
    () => ({
      getTextScreenBox(id) {
        const node = nodeRefs.current[id];
        const stage = node?.getStage();
        if (!node || !stage) return null;
        try {
          // `relativeTo` doit être un nœud Konva (ex. Stage), pas le div DOM — sinon le rect est faux
          // et le <textarea> fixé se retrouve hors zone → fond blanc par défaut, saisie impossible.
          const r = node.getClientRect({ relativeTo: stage });
          const br = stage.container().getBoundingClientRect();
          const sc = stage.scaleX();
          const left = br.left + r.x * sc;
          const top = br.top + r.y * sc;
          const width = Math.max(24, r.width * sc);
          const height = Math.max(24, r.height * sc);
          if (![left, top, width, height].every((n) => Number.isFinite(n))) return null;
          return { left, top, width, height };
        } catch {
          return null;
        }
      },
      /** Export sans poignées du Transformer (PDF / image). */
      captureLayerDataURL(opts = {}) {
        const tr = trRef.current;
        if (tr) tr.nodes([]);
        const layer = layerRef.current;
        if (!layer) return null;
        const pixelRatio = typeof opts.pixelRatio === 'number' ? opts.pixelRatio : 2;
        try {
          return layer.toDataURL({
            mimeType: 'image/png',
            pixelRatio,
          });
        } catch {
          return null;
        }
      },
      /** Stream pour MediaRecorder (cinéma pédagogique). */
      getLayerCaptureStream(fps = 24) {
        const layer = layerRef.current;
        if (!layer) return null;
        try {
          const canvas = layer.getCanvas();
          const el =
            canvas?.getNativeCanvasElement?.() ?? /** @type {any} */ (canvas)?._canvas;
          if (!el || typeof el.captureStream !== 'function') return null;
          return el.captureStream(Math.max(1, Math.min(60, fps)));
        } catch {
          return null;
        }
      },
    }),
    [],
  );

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    // Masquer le Transformer quand un outil vecteur de dessin ou sélection région est actif
    if (isPenMode || isPencilMode || isMarqueeMode || isCropMode) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    // Exclure les objets verouilles du Transformer
    const nodes = (selectedIds || [])
      .filter((id) => !lockedIds.has(id))
      .map((id) => nodeRefs.current[id])
      .filter(Boolean);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, sorted, lockedIds, isPenMode, isPencilMode, isMarqueeMode, isCropMode]);

  /** Coords souris dans l'espace document (sans scale) */
  const getStagePos = useCallback((e) => {
    const stage = e.target.getStage();
    const pt    = stage.getPointerPosition();
    const sc    = stage.scaleX() || 1;
    return { x: pt.x / sc, y: pt.y / sc };
  }, []);

  /** Finalise le tracé plume et crée l'objet line dans la scène */
  const finalizePen = useCallback((pts) => {
    if (pts.length < 2) { setPenPoints([]); return; }
    pushHistoryStore();
    const xs   = pts.map((p) => p.x);
    const ys   = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    // Les points doivent être relatifs à (minX, minY) — origin du nœud Konva
    const relPoints = pts.flatMap((p) => [p.x - minX, p.y - minY]);
    addObject({
      id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'line',
      x: minX,
      y: minY,
      width:  Math.max(14, maxX - minX),
      height: Math.max(14, maxY - minY),
      rotation: 0,
      content: { points: relPoints },
      style:   { stroke: '#ffffff', strokeWidth: 2 },
      opacity: 1,
    });
    setPenPoints([]);
    setPenPreview(null);
  }, [addObject, pushHistoryStore]);

  const onStageMouseDown = useCallback(
    (e) => {
      // ── Plume : ajoute un ancrage à chaque clic ──────────────────────
      if (isPenMode) {
        if (e.target !== e.target.getStage()) return; // ignore clic sur objet
        const pos = getStagePos(e);
        setPenPoints((prev) => [...prev, pos]);
        return;
      }

      // ── Crayon : débute le tracé libre ───────────────────────────────
      if (isPencilMode) {
        if (e.target !== e.target.getStage()) return;
        const pos = getStagePos(e);
        setPencilActive(true);
        setPenPoints([pos]);
        return;
      }

      // ── Sélection par région (Studio) : uniquement sur le stage vide ──
      if (isMarqueeMode && !isPenMode && !isPencilMode) {
        if (e.target !== e.target.getStage()) return;
        const pos = getStagePos(e);
        if (interactionTool === 'marquee-lasso') {
          setMarqueeDraft({ kind: 'lasso', points: [pos] });
          return;
        }
        const kind = interactionTool === 'marquee-ellipse' ? 'ellipse' : 'rect';
        setMarqueeDraft({ kind, x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
        return;
      }

      // ── Recadrage image (1 sélection, point dans le cadre même si tourné) ─
      if (isCropMode && !isPenMode && !isPencilMode) {
        if (e.target !== e.target.getStage()) return;
        const sel = selectedIds || [];
        if (sel.length !== 1) return;
        const imgObj = sorted.find((o) => o.id === sel[0] && o.type === 'image');
        if (!imgObj || imgObj.locked) return;
        const kNode = getBoardImageNode(nodeRefs, imgObj.id);
        if (!kNode) return;
        const stage = e.target.getStage();
        stage?.setPointersPositions(e.evt);
        const local = kNode.getRelativePointerPosition();
        if (
          !local ||
          local.x < 0 ||
          local.x > imgObj.width ||
          local.y < 0 ||
          local.y > imgObj.height
        ) {
          return;
        }
        const pos = getStagePos(e);
        setCropDraft({ imageId: imgObj.id, x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
        return;
      }

      // ── Normal : désélectionne sur fond vide ─────────────────────────
      if (e.target === e.target.getStage()) {
        selectOnly?.(null);
      }
    },
    [
      selectOnly,
      isPenMode,
      isPencilMode,
      isMarqueeMode,
      isCropMode,
      interactionTool,
      getStagePos,
      selectedIds,
      sorted,
    ],
  );

  const onStageMouseMove = useCallback(
    (e) => {
      if (isPenMode && penPoints.length > 0) {
        setPenPreview(getStagePos(e));
        return;
      }
      if (isPencilMode && pencilActive) {
        const pos = getStagePos(e);
        setPenPoints((prev) => [...prev, pos]);
      }
    },
    [isPenMode, isPencilMode, penPoints.length, pencilActive, getStagePos],
  );

  const onStageMouseUp = useCallback(
    () => {
      if (isPencilMode && pencilActive) {
        setPencilActive(false);
        finalizePen(penPoints);
      }
    },
    [isPencilMode, pencilActive, penPoints, finalizePen],
  );

  const onStageDblClick = useCallback(
    (e) => {
      if (isPenMode && penPoints.length >= 1) {
        // Ajoute le point du dbl-clic et finalise
        const pos = getStagePos(e);
        finalizePen([...penPoints, pos]);
      }
    },
    [isPenMode, penPoints, finalizePen, getStagePos],
  );

  // Escape annule le tracé en cours ou la sélection région
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key !== 'Escape') return;
      if (marqueeDraft) {
        ev.preventDefault();
        setMarqueeDraft(null);
        toast({
          title: 'Sélection annulée',
          description: 'Le tracé de la région a été abandonné.',
        });
        return;
      }
      if (cropDraft) {
        ev.preventDefault();
        setCropDraft(null);
        toast({
          title: 'Recadrage annulé',
          description: 'Aucune modification du crop source n\'a été appliquée.',
        });
        return;
      }
      if (isPenMode || isPencilMode) {
        setPenPoints([]);
        setPenPreview(null);
        setPencilActive(false);
        return;
      }
      if (isMarqueeMode) {
        clearRegionMarquee();
        setInteractionTool('pointer');
        toast({
          title: 'Mode région',
          description: 'Retour au déplacement / sélection.',
        });
        return;
      }
      if (isCropMode) {
        setInteractionTool('pointer');
        toast({
          title: 'Mode recadrage',
          description: 'Retour au déplacement / sélection.',
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    isPenMode,
    isPencilMode,
    isMarqueeMode,
    isCropMode,
    marqueeDraft,
    cropDraft,
    clearRegionMarquee,
    setInteractionTool,
    toast,
  ]);

  const onObjectMouseDown = useCallback(
    (e, id) => {
      e.cancelBubble = true;
      if (e.evt.button === 1) {
        e.evt.preventDefault();
        return;
      }
      if (e.evt.button !== 0) return;
      const mod = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
      if (mod) {
        toggleSelect?.(id);
      } else {
        selectOnly?.(id);
      }
      onObjectPrimaryClick?.();
    },
    [selectOnly, toggleSelect, onObjectPrimaryClick],
  );

  const handleDragStart = useCallback(
    (obj) => {
      dragOriginRef.current = { x: obj.x, y: obj.y };
      pushHistory?.();
      onUserCanvasGesture?.({ kind: 'drag' });
    },
    [pushHistory, onUserCanvasGesture],
  );

  const handleDragMove = useCallback(
    (obj, e) => {
      const raw = dragAttrs(obj, e.target);
      const attrs = applyShiftAxisLock(raw, dragOriginRef.current, e.evt.shiftKey);
      updateObjectTransform?.(obj.id, attrs);
    },
    [updateObjectTransform],
  );

  const handleDragEnd = useCallback(
    (obj, e) => {
      const node = e.target;
      try {
        const box = node.getClientRect();
        if (!clientRectIntersectsStage(box, width, height)) {
          onDeleteObject?.(obj.id);
          dragOriginRef.current = null;
          return;
        }
      } catch {
        /* ignore */
      }
      let attrs = dragAttrs(obj, e.target);
      attrs = applyShiftAxisLock(attrs, dragOriginRef.current, e.evt.shiftKey);
      attrs = snapPosAttrs(attrs, snapGrid);
      updateObjectTransform?.(obj.id, attrs);
      dragOriginRef.current = null;
    },
    [updateObjectTransform, snapGrid, width, height, onDeleteObject],
  );

  const handleTransformStart = useCallback(() => {
    pushHistory?.();
    onUserCanvasGesture?.({ kind: 'transform' });
  }, [pushHistory, onUserCanvasGesture]);

  const handleTransform = useCallback(
    (obj, e) => {
      updateObjectTransform?.(obj.id, transformPreviewAttrs(obj, e.target));
    },
    [updateObjectTransform],
  );

  const handleTransformEnd = useCallback(
    (obj, e) => {
      const attrs = snapPosAttrs(finalizeTransformAttrs(obj, e.target), snapGrid);
      updateObjectTransform?.(obj.id, attrs);
    },
    [updateObjectTransform, snapGrid],
  );

  const sw = width * scale;
  const sh = height * scale;
  const selSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);

  const bindObjectMouseDown = useCallback(
    (obj) => (e) => {
      if (e.evt.button === 1) {
        e.cancelBubble = true;
        e.evt.preventDefault();
        const t = obj?.type;
        if (t === 'image' || t === 'icon' || t === 'html') {
          onObjectMiddleClick?.(obj);
        }
        return;
      }
      onObjectMouseDown(e, obj.id);
    },
    [onObjectMouseDown, onObjectMiddleClick],
  );

  return (
    <div className="relative inline-block">
      {/* Animated canvas boundary */}
      <style>{`
        @keyframes canvas-border-glow {
          0%,100% { box-shadow: 0 0 0 1px rgba(34,211,238,0.08), 0 0 18px rgba(34,211,238,0.05); }
          50%      { box-shadow: 0 0 0 1px rgba(34,211,238,0.28), 0 0 32px rgba(34,211,238,0.12); }
        }
        .canvas-glow-border { animation: canvas-border-glow 4s ease-in-out infinite; border-radius: 10px; }
      `}</style>
      <div
        className="canvas-glow-border pointer-events-none absolute inset-0 rounded-lg"
        style={{ zIndex: 2 }}
      />
    <Stage
      width={sw}
      height={sh}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={onStageMouseDown}
      onMouseMove={onStageMouseMove}
      onMouseUp={onStageMouseUp}
      onDblClick={onStageDblClick}
      onAuxClick={(e) => {
        if (e.evt.button === 1) e.evt.preventDefault();
      }}
      onWheel={(e) => {
        // Molette sur le canevas designer : ajuste l'épaisseur du crayon vectoriel
        if (!isPencilMode) return;
        e.evt.preventDefault();
        const sign = e.evt.deltaY > 0 ? -1 : 1;
        const baseStep = 0.5;
        const step = e.evt.shiftKey ? baseStep * 3 : baseStep;
        const next = Math.min(20, Math.max(0.5, pencilSize + sign * step));
        setPencilSize(next);
      }}
      ref={konvaStageRef}
      style={{
        cursor: isMarqueeMode || isCropMode
          ? 'crosshair'
          : isPenMode
            ? 'crosshair'
            : isPencilMode
              ? 'crosshair'
              : isDirectSelect
                ? 'default'
                : 'default',
      }}
      className="rounded-lg"
    >
      <Layer ref={layerRef}>
        {/* Fond du document — seulement si une couleur est définie (pas transparent) */}
        {background && background !== 'transparent' && background !== 'none' && (
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={background}
            listening={false}
          />
        )}

        {/* Artboard guide — cadre pointillé du document */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          stroke="rgba(34,211,238,0.22)"
          strokeWidth={1 / (scale || 1)}
          dash={[10 / (scale || 1), 5 / (scale || 1)]}
          listening={false}
          perfectDrawEnabled={false}
        />
        {/* Label artboard — affiché au-dessus du cadre */}
        <Text
          x={0}
          y={-22 / (scale || 1)}
          text={`${width} × ${height}`}
          fontSize={11 / (scale || 1)}
          fontFamily="Inter, system-ui, sans-serif"
          fill="rgba(34,211,238,0.45)"
          listening={false}
          perfectDrawEnabled={false}
        />

        {showEditGrid && editGridSize > 0 ? (
          <Shape
            listening={false}
            sceneFunc={(ctx) => {
              ctx.strokeStyle = 'rgba(212,175,55,0.14)';
              ctx.lineWidth = 1 / Math.max(scale || 1, 0.01);
              const g = editGridSize;
              for (let x = g; x < width; x += g) {
                ctx.beginPath();
                ctx.moveTo(x + 0.5, 0);
                ctx.lineTo(x + 0.5, height);
                ctx.stroke();
              }
              for (let y = g; y < height; y += g) {
                ctx.beginPath();
                ctx.moveTo(0, y + 0.5);
                ctx.lineTo(width, y + 0.5);
                ctx.stroke();
              }
            }}
          />
        ) : null}
        {sorted.map((obj, _i) => (
          <KonvaBoardObject
            key={obj.id ?? `obj_${_i}`}
            obj={obj}
            selected={selSet.has(obj.id)}
            shapeProps={{
              ref: setNodeRef(obj.id),
              draggable: !obj.locked && !blockObjectHit,
              listening: !blockObjectHit,
              onMouseDown: bindObjectMouseDown(obj),
              onDragStart: () => handleDragStart(obj),
              onDragMove: (e) => handleDragMove(obj, e),
              onDragEnd: (e) => handleDragEnd(obj, e),
              onTransformStart: handleTransformStart,
              onTransform: (e) => handleTransform(obj, e),
              onTransformEnd: (e) => handleTransformEnd(obj, e),
              onDblClick:
                onTextDblClick && obj.type === 'text'
                  ? (e) => {
                      e.cancelBubble = true;
                      onTextDblClick(obj.id);
                    }
                  : undefined,
            }}
          />
        ))}
        {/* ── Pen / Pencil preview ──────────────────────────────────────── */}
        {(isPenMode || isPencilMode) && penPoints.length > 0 && (() => {
          const flat = penPoints.flatMap((p) => [p.x, p.y]);
          // Si en mode plume : ajoute le point de preview pour la ligne fantôme
          const previewFlat = isPenMode && penPreview
            ? [...flat, penPreview.x, penPreview.y]
            : flat;
          return (
            <Group listening={false}>
              {/* Ligne de tracé */}
              <Line
                points={previewFlat}
                stroke="#22d3ee"
                strokeWidth={1.5 / (scale || 1)}
                dash={isPenMode ? [6 / (scale || 1), 3 / (scale || 1)] : undefined}
                lineCap="round"
                lineJoin="round"
                listening={false}
                perfectDrawEnabled={false}
              />
              {/* Ancrages (points fixes) */}
              {penPoints.map((p, i) => (
                <Circle
                  key={i}
                  x={p.x}
                  y={p.y}
                  radius={4 / (scale || 1)}
                  fill="#0a0b0f"
                  stroke="#22d3ee"
                  strokeWidth={1.5 / (scale || 1)}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              ))}
              {/* Ancrage ghost sous le curseur (pen uniquement) */}
              {isPenMode && penPreview && (
                <Circle
                  x={penPreview.x}
                  y={penPreview.y}
                  radius={3 / (scale || 1)}
                  fill="#22d3ee"
                  opacity={0.5}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              )}
            </Group>
          );
        })()}

        {marqueeDraft && (() => {
          const sc = scale || 1;
          const stroke = 'rgba(212,175,55,0.95)';
          const fill = 'rgba(212,175,55,0.12)';
          if (marqueeDraft.kind === 'lasso') {
            const flat = marqueeDraft.points.flatMap((p) => [p.x, p.y]);
            if (flat.length < 4) {
              return (
                <Circle
                  x={marqueeDraft.points[0]?.x ?? 0}
                  y={marqueeDraft.points[0]?.y ?? 0}
                  radius={3 / sc}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1 / sc}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              );
            }
            return (
              <Line
                points={flat}
                closed
                fill={fill}
                stroke={stroke}
                strokeWidth={1 / sc}
                lineJoin="round"
                lineCap="round"
                listening={false}
                perfectDrawEnabled={false}
              />
            );
          }
          const box = normMarqueeBox(marqueeDraft.x0, marqueeDraft.y0, marqueeDraft.x1, marqueeDraft.y1);
          if (marqueeDraft.kind === 'ellipse') {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            const rx = Math.max(1, box.width / 2);
            const ry = Math.max(1, box.height / 2);
            return (
              <Group listening={false}>
                <Ellipse
                  x={cx}
                  y={cy}
                  radiusX={rx}
                  radiusY={ry}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1 / sc}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              </Group>
            );
          }
          return (
            <Rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              fill={fill}
              stroke={stroke}
              strokeWidth={1 / sc}
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        })()}

        {cropDraft && (() => {
          const box = normMarqueeBox(cropDraft.x0, cropDraft.y0, cropDraft.x1, cropDraft.y1);
          const sc = scale || 1;
          return (
            <Rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              fill="rgba(139,92,246,0.14)"
              stroke="rgba(167,139,250,0.95)"
              strokeWidth={1 / sc}
              dash={[6 / sc, 4 / sc]}
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        })()}

        <Transformer
          ref={trRef}
          keepRatio={false}
          shiftBehavior="default"
          rotateEnabled
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
            'middle-left',
            'middle-right',
            'top-center',
            'bottom-center',
          ]}
          boundBoxFunc={transformerBoundBoxFunc}
          borderStroke="rgba(255,255,255,0.92)"
          anchorStroke="rgba(255,255,255,0.95)"
          anchorFill="#121318"
          anchorSize={8}
        />
      </Layer>
    </Stage>
    </div>
  );
});

export default KonvaBoardStage;
