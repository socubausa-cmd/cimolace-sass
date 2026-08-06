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
import { uploadSmartboardCanvasImage } from '@/lib/uploadSmartboardCanvasImage';
import KonvaBoardObject from './KonvaBoardObject';
import { sortObjectsByLayer } from '../model/sceneModel';
import {
  useSmartboardKonvaStore,
  decoderPressePapiers,
  pageDuCanevas,
} from '../store/useSmartboardKonvaStore';
import { normaliserMode, mesurerImage, MODES_AJUSTEMENT } from '../lib/documentImages';
import { pairesDuTrace, localVersDocTrace } from '../lib/cheminsVectoriels';

/**
 * Une saisie est-elle en cours ? Les raccourcis du canevas ne doivent JAMAIS voler
 * un ⌘C / ⌘V à un champ de texte (le collage natif y est déjà le bon comportement).
 */
function estSaisieEnCours(cible) {
  const el = cible instanceof Element ? cible : null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest('[contenteditable="true"], [role="textbox"]'));
}

export function transformerBoundBoxFunc(oldBox, newBox) {
  if (newBox.width < 14 || newBox.height < 14) return oldBox;
  return newBox;
}

/** Jeu complet des poignées du Transformer (ordre Konva). */
export const TOUTES_LES_ANCRES = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'middle-left',
  'middle-right',
  'top-center',
  'bottom-center',
];

/**
 * Taille d'une poignée en px ÉCRAN : anchorSize 8 + le trait de 1 px.
 * ⛔ Konva compense l'échelle de la Stage : une poignée mesure toujours ~9 px à
 * l'écran, alors qu'une ligne de tableau n'en fait que 16,8 (26 px × 0,645).
 */
const ANCRE_PX = 9;

/**
 * Décide des poignées du Transformer pour la sélection courante.
 *
 * ⛔ PIÈGE MESURÉ : les poignées `top-center`/`bottom-center` sont centrées sur le
 * milieu horizontal de la boîte et mordent ANCRE_PX/2 vers l'intérieur. Sur un objet
 * plus bas que 3 × ANCRE_PX (cas d'une cellule de tableau), les deux se rejoignent et
 * tuent TOUTE la colonne médiane : `stage.getIntersection()` au centre renvoyait
 * `Rect|bottom-center _anchor`, donc le double-clic n'atteignait jamais la cellule.
 *
 * @param {Array<object>} objets objets sélectionnés (déjà filtrés des verrouillés)
 * @param {number} echelle échelle de la Stage
 */
export function reglerTransformerPourSelection(objets, echelle) {
  const complet = {
    ancres: TOUTES_LES_ANCRES,
    redimensionnable: true,
    rotatif: true,
    ecoutePointeur: true,
    garderRapport: false,
  };
  const liste = (objets || []).filter(Boolean);
  if (!liste.length) return complet;

  /* Une image garde ses proportions par DÉFAUT ; Maj les libère (convention
     universelle — l'inverser reproduirait exactement le défaut mesuré : la 602×900
     posée en 560×320). 'etirer' est le choix explicite d'écraser le rapport. */
  const garderRapport =
    liste.every((o) => o?.type === 'image') &&
    liste.every((o) => normaliserMode(o?.style?.ajustement) !== MODES_AJUSTEMENT.ETIRER);

  // ⛔ Une pièce de tableau ne se redimensionne PAS à la main : sa géométrie est
  // reconstruite par documentTables (colonnes, filets, fonds de ligne). Une poignée
  // ici ne désynchroniserait la grille que pour, en prime, confisquer le centre de
  // la cellule. Le cadre de sélection reste visible, l'objet reste déplaçable.
  if (liste.every((o) => o?.meta?.doc === 'tableau')) {
    return { ancres: [], redimensionnable: false, rotatif: false, ecoutePointeur: false, garderRapport: false };
  }

  const sc = echelle || 1;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const o of liste) {
    const x = Number(o.x) || 0;
    const y = Number(o.y) || 0;
    const w = Math.abs(Number(o.width) || 0);
    const h = Math.abs(Number(o.height) || 0);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  }
  const largeurEcran = (x1 - x0) * sc;
  const hauteurEcran = (y1 - y0) * sc;
  const seuil = ANCRE_PX * 3;

  const ancres = TOUTES_LES_ANCRES.filter((a) => {
    if ((a === 'top-center' || a === 'bottom-center') && hauteurEcran < seuil) return false;
    if ((a === 'middle-left' || a === 'middle-right') && largeurEcran < seuil) return false;
    return true;
  });
  return { ancres, redimensionnable: true, rotatif: true, ecoutePointeur: true, garderRapport };
}

/* ═══════════════════════════════════════════════════════════════════
   Guides d'alignement magnétiques
   ═══════════════════════════════════════════════════════════════════ */

/** Seuil d'accrochage, en px ÉCRAN (converti en unités document par l'échelle). */
export const SEUIL_ACCROCHAGE_PX = 4;

/** Bords + centre d'une boîte, sur un axe. */
function reperesBoite(b, axe) {
  return axe === 'V'
    ? [b.x, b.x + (b.width ?? 0) / 2, b.x + (b.width ?? 0)]
    : [b.y, b.y + (b.height ?? 0) / 2, b.y + (b.height ?? 0)];
}

/**
 * Accrochage d'une boîte en cours de déplacement sur les repères des AUTRES objets
 * et sur ceux de la page (bords, centres, marges).
 *
 * ⛔ Calcul PUR (aucun Konva, aucun store) : c'est ce qui sépare un éditeur amateur
 * d'un Canva, donc c'est aussi ce qui doit rester vérifiable.
 * ⛔ Le seuil est donné en unités DOCUMENT : à l'écran il doit rester constant quel
 * que soit le zoom (4 px), sinon un canevas d'affiche à 0,18 collerait tout.
 *
 * @param {{ boite:{x:number,y:number,width:number,height:number},
 *           cibles?: Array<{x:number,y:number,width:number,height:number}>,
 *           lignes?: {V?: number[], H?: number[]}, seuil?: number }} p
 * @returns {{ dx:number, dy:number, guides: Array<{axe:'V'|'H', valeur:number}> }}
 */
export function calculerAccrochage({ boite, cibles = [], lignes = {}, seuil = 4 } = {}) {
  const vide = { dx: 0, dy: 0, guides: [] };
  if (!boite || !Number.isFinite(boite.x) || !Number.isFinite(boite.y)) return vide;

  const candidats = { V: [...(lignes.V ?? [])], H: [...(lignes.H ?? [])] };
  for (const c of cibles) {
    if (!c) continue;
    candidats.V.push(...reperesBoite(c, 'V'));
    candidats.H.push(...reperesBoite(c, 'H'));
  }

  const guides = [];
  const meilleur = (axe) => {
    const mobiles = reperesBoite(boite, axe);
    let delta = 0;
    let ecart = Infinity;
    let valeur = null;
    for (const cible of candidats[axe]) {
      if (!Number.isFinite(cible)) continue;
      for (const m of mobiles) {
        const d = cible - m;
        if (Math.abs(d) < ecart) {
          ecart = Math.abs(d);
          delta = d;
          valeur = cible;
        }
      }
    }
    if (ecart > seuil || valeur === null) return 0;
    guides.push({ axe, valeur });
    return delta;
  };

  return { dx: meilleur('V'), dy: meilleur('H'), guides };
}

/** Repères de page : bords, centres et marges de la zone utile. */
export function lignesDePage(canvas) {
  const { page, marges } = pageDuCanevas(canvas);
  const largeur = Number(canvas?.width) || page.largeur;
  const hauteur = Number(canvas?.height) || page.hauteur;
  const V = [0, largeur / 2, largeur, marges.gauche, largeur - marges.droite];
  const H = [0, hauteur / 2, hauteur];
  const pas = page.hauteur + page.ecartPages;
  for (let i = 0; i < page.pages; i += 1) {
    H.push(i * pas + marges.haut, (i + 1) * page.hauteur - marges.bas + i * page.ecartPages);
  }
  return { V, H };
}

/**
 * Couleurs du cadre de sélection, selon la clarté du fond du canevas.
 *
 * ⛔ MESURÉ : sur une page A4 blanche, le trait blanc d'origine ne faisait bouger
 * que ~12 niveaux sur 255 (diff pixel du canevas : 696 px modifiés, contraste max
 * 55 toutes composantes cumulées). Le cadre était bien DESSINÉ et parfaitement
 * invisible — sur un tableau, dont les poignées sont retirées, il ne restait donc
 * aucun signe de sélection avant de tenter un déplacement.
 *
 * @param {string | undefined} fond couleur de fond du canevas
 */
export function couleursCadreSelection(fond) {
  const clair = { trait: 'rgba(17,20,28,0.92)', ancre: 'rgba(17,20,28,0.95)', remplissage: '#ffffff' };
  const sombre = { trait: 'rgba(255,255,255,0.92)', ancre: 'rgba(255,255,255,0.95)', remplissage: '#121318' };
  const s = String(fond || '').trim().toLowerCase();
  if (!s || s === 'transparent' || s === 'none') return sombre;
  let r; let v; let b;
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    r = parseInt(h.slice(0, 2), 16); v = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const rgb = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!rgb) return sombre;
    r = Number(rgb[1]); v = Number(rgb[2]); b = Number(rgb[3]);
  }
  // Luminance perçue (Rec. 601) : au-delà de la moitié, le fond est clair.
  return (0.299 * r + 0.587 * v + 0.114 * b) > 140 ? clair : sombre;
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

/* ═══════════════════════════════════════════════════════════════════
   Fond du canevas — traduction d'un dégradé CSS en remplissage Konva
   ═══════════════════════════════════════════════════════════════════ */

/** Découpe une liste CSS sur les virgules de PREMIER niveau (un `rgb(…)` reste entier). */
function decouperArgumentsCss(texte) {
  const morceaux = [];
  let profondeur = 0;
  let courant = '';
  for (const c of String(texte)) {
    if (c === '(') profondeur += 1;
    if (c === ')') profondeur = Math.max(0, profondeur - 1);
    if (c === ',' && profondeur === 0) {
      morceaux.push(courant.trim());
      courant = '';
      continue;
    }
    courant += c;
  }
  if (courant.trim()) morceaux.push(courant.trim());
  return morceaux;
}

/** Angle CSS (`135deg`, `0.25turn`, `to bottom right`…) en degrés — null si absent. */
function angleCssEnDegres(brut, largeur, hauteur) {
  const s = String(brut ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const m = s.match(/^(-?[\d.]+)(deg|grad|rad|turn)$/);
  if (m) {
    const v = Number(m[1]);
    if (m[2] === 'grad') return (v * 360) / 400;
    if (m[2] === 'rad') return (v * 180) / Math.PI;
    if (m[2] === 'turn') return v * 360;
    return v;
  }
  if (!s.startsWith('to ')) return null;
  /* Coins : approximation par la diagonale (le « magic corner » CSS exact n'apporte
     rien de visible sur un fond plein cadre). */
  const coin = (Math.atan2(largeur, hauteur) * 180) / Math.PI;
  const table = {
    'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270,
    'to top right': coin, 'to right top': coin,
    'to bottom right': 180 - coin, 'to right bottom': 180 - coin,
    'to bottom left': 180 + coin, 'to left bottom': 180 + coin,
    'to top left': 360 - coin, 'to left top': 360 - coin,
  };
  return table[s] ?? null;
}

/** « couleur [pos%] » → { couleur, pos 0..1 | null } (la couleur peut contenir des espaces). */
function lireStopCss(brut) {
  const s = String(brut).trim();
  const m = s.match(/^(.*?)\s+(-?[\d.]+)%$/);
  if (m) return { couleur: m[1].trim(), pos: Math.min(1, Math.max(0, Number(m[2]) / 100)) };
  return { couleur: s, pos: null };
}

/**
 * Remplissage Konva pour le fond du canevas.
 *
 * ⛔ MESURÉ (préréglages Fond « Royal / Forêt / Or ») : le store porte une chaîne CSS
 * `linear-gradient(135deg,…)` et Konva la recevait dans `fill` — qui n'accepte qu'une
 * COULEUR. Le dégradé était écrit au store, affiché dans le swatch du panneau… et
 * jamais peint : pixels mesurés (0,0,0). Ici la chaîne est traduite en propriétés
 * `fillLinearGradient*` / `fillRadialGradient*`. Couleur simple : rendue telle quelle.
 * Dégradé illisible : première couleur trouvée — jamais un fond muet.
 *
 * @param {string} fond  couleur ou dégradé CSS du store
 * @param {number} largeur @param {number} hauteur  dimensions du canevas (unités doc)
 * @returns {object|null} props de remplissage à étaler sur le Rect de fond
 */
export function remplissageDuFond(fond, largeur, hauteur) {
  const s = String(fond ?? '').trim();
  if (!s || s === 'transparent' || s === 'none') return null;
  const lin = s.match(/^linear-gradient\((.+)\)$/i);
  const rad = s.match(/^radial-gradient\((.+)\)$/i);
  if (!lin && !rad) return { fill: s };

  const args = decouperArgumentsCss((lin ?? rad)[1]);
  let angle = 180; // défaut CSS : `to bottom`
  if (lin) {
    const a = angleCssEnDegres(args[0], largeur, hauteur);
    if (a !== null) {
      angle = a;
      args.shift();
    }
  } else if (/^(circle|ellipse|closest-|farthest-|at )/i.test(args[0] ?? '')) {
    args.shift(); // forme/position du radial : le centre par défaut suffit pour un fond
  }

  const stops = args.map(lireStopCss).filter((st) => st.couleur);
  if (stops.length < 2) return { fill: stops[0]?.couleur ?? s };

  const colorStops = [];
  stops.forEach((st, i) => {
    colorStops.push(st.pos ?? i / (stops.length - 1), st.couleur);
  });

  const cx = largeur / 2;
  const cy = hauteur / 2;
  if (rad) {
    return {
      fillRadialGradientStartPoint: { x: cx, y: cy },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndPoint: { x: cx, y: cy },
      /* Rayon = distance centre → coin (le `farthest-corner` par défaut de CSS). */
      fillRadialGradientEndRadius: Math.hypot(largeur, hauteur) / 2,
      fillRadialGradientColorStops: colorStops,
    };
  }
  const t = (angle * Math.PI) / 180;
  const dx = Math.sin(t);
  const dy = -Math.cos(t); // CSS : 0° pointe vers le HAUT, sens horaire
  const demi = (Math.abs(largeur * dx) + Math.abs(hauteur * dy)) / 2;
  return {
    fillLinearGradientStartPoint: { x: cx - dx * demi, y: cy - dy * demi },
    fillLinearGradientEndPoint: { x: cx + dx * demi, y: cy + dy * demi },
    fillLinearGradientColorStops: colorStops,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Gomme — proximité d'un point à un tracé vectoriel
   ═══════════════════════════════════════════════════════════════════ */

/** Distance d'un point au segment [AB]. */
function distanceAuSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Le tracé (objet `line`) passe-t-il à moins de `tolerance` du point (coords document) ?
 * ⛔ Les points d'un tracé sont stockés dans le repère LOCAL du nœud : une rotation de
 * l'objet doit être défaite avant de mesurer, sinon la gomme rate tout tracé tourné.
 */
export function tracePresDuPoint(obj, pos, tolerance) {
  const pts = obj?.content?.points;
  if (!Array.isArray(pts) || pts.length < 4) return false;
  const rot = ((Number(obj.rotation) || 0) * Math.PI) / 180;
  const dx = (Number(pos?.x) || 0) - (Number(obj.x) || 0);
  const dy = (Number(pos?.y) || 0) - (Number(obj.y) || 0);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    if (distanceAuSegment(lx, ly, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= tolerance) {
      return true;
    }
  }
  return false;
}

/** Rayon d'action de la gomme, en px ÉCRAN (constant quel que soit le zoom). */
export const RAYON_GOMME_ECRAN = 10;

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
  /**
   * Nombre de nœuds en cours de glissement.
   *
   * ⛔ MESURÉ : sur une sélection multiple, Konva démarre un vrai drag sur CHAQUE
   * nœud attaché au Transformer (journal d'évènements : 6 `dragstart` pour un clic).
   * Sans ce compteur, l'historique encaisse un cliché par pièce et il faut six
   * Ctrl+Z pour annuler un seul déplacement.
   */
  const glissementsEnCoursRef = useRef(0);
  /**
   * Id dont la réduction de sélection est REPORTÉE au relâchement.
   * ⛔ Réduire dès le `mousedown` tuait le déplacement d'un tableau : la pièce
   * attrapée devenait la seule sélectionnée avant même le premier `mousemove`.
   */
  const reductionDiffereeRef = useRef(null);
  /** Guides d'alignement affichés pendant le déplacement — [{axe,valeur}] */
  const [guidesAccrochage, setGuidesAccrochage] = useState([]);
  /** Nœud dont on a coupé le `draggable` le temps d'atteindre une poignée. */
  const draggableSuspenduRef = useRef(null);
  /** id → { width, height } relevés au DÉBUT d'un redimensionnement. */
  const taillesAvantTransformRef = useRef(new Map());
  /** Nombre de nœuds en cours de redimensionnement (cf. glissementsEnCoursRef). */
  const transformsEnCoursRef = useRef(0);

  // ── Studio workbench : sélection par région ─────────────────────────────
  const interactionTool = useSmartboardKonvaStore((s) => s.interactionTool);
  const setRegionMarquee = useSmartboardKonvaStore((s) => s.setRegionMarquee);
  const clearRegionMarquee = useSmartboardKonvaStore((s) => s.clearRegionMarquee);
  const setSelectedIds = useSmartboardKonvaStore((s) => s.setSelectedIds);
  const setInteractionTool = useSmartboardKonvaStore((s) => s.setInteractionTool);
  const updateObject = useSmartboardKonvaStore((s) => s.updateObject);
  const marquerBoiteImageManuelle = useSmartboardKonvaStore((s) => s.marquerBoiteImageManuelle);
  const marquerHauteurTexteManuelle = useSmartboardKonvaStore((s) => s.marquerHauteurTexteManuelle);
  const copierSelection = useSmartboardKonvaStore((s) => s.copierSelection);
  const couperSelection = useSmartboardKonvaStore((s) => s.couperSelection);
  const collerObjets = useSmartboardKonvaStore((s) => s.collerObjets);
  const collerTexte = useSmartboardKonvaStore((s) => s.collerTexte);
  const marquerPressePapiersSysteme = useSmartboardKonvaStore((s) => s.marquerPressePapiersSysteme);
  const deplacerSelectionDansLaPile = useSmartboardKonvaStore((s) => s.deplacerSelectionDansLaPile);
  const groupSelectedStore = useSmartboardKonvaStore((s) => s.groupSelected);
  const ungroupSelectedStore = useSmartboardKonvaStore((s) => s.ungroupSelected);
  const insererAncreTrace = useSmartboardKonvaStore((s) => s.insererAncreTrace);
  const supprimerAncreTrace = useSmartboardKonvaStore((s) => s.supprimerAncreTrace);
  const arrondirAncreTrace = useSmartboardKonvaStore((s) => s.arrondirAncreTrace);
  const deplacerAncreTrace = useSmartboardKonvaStore((s) => s.deplacerAncreTrace);
  const terminerDeplacementAncre = useSmartboardKonvaStore((s) => s.terminerDeplacementAncre);
  const { toast } = useToast();

  const isMarqueeMode =
    interactionTool === 'marquee-rect' ||
    interactionTool === 'marquee-ellipse' ||
    interactionTool === 'marquee-lasso';
  const isCropMode = interactionTool === 'crop-image';
  const [marqueeDraft, setMarqueeDraft] = useState(null);
  const [cropDraft, setCropDraft] = useState(null);

  // ── Vector drawing state ────────────────────────────────────────────────
  const activeVectorTool = useSmartboardKonvaStore((s) => s.activeVectorTool);
  const pencilSize      = useSmartboardKonvaStore((s) => s.pencilSize ?? 2);
  const setPencilSize   = useSmartboardKonvaStore((s) => s.setPencilSize ?? (() => {}));
  const addObject        = useSmartboardKonvaStore((s) => s.addObject);
  const pushHistoryStore = useSmartboardKonvaStore((s) => s.pushHistory);
  const effacerObjets    = useSmartboardKonvaStore((s) => s.effacerObjets);
  const isPenMode        = activeVectorTool === 'pen';
  const isPencilMode     = activeVectorTool === 'pencil';
  const isEraserMode     = activeVectorTool === 'eraser';
  const isDirectSelect   = activeVectorTool === 'directSelect';
  /**
   * Outils qui ÉDITENT les ancres d'un tracé existant (content.points).
   * ⛔ MESURÉ : ces quatre outils posaient un badge et rien d'autre — aucun clic
   * n'atteignait les points. Ils vivent ici : sélection du tracé, poignées d'ancre,
   * insertion/suppression/arrondi, glissement de nœud.
   */
  const outilAncres =
    isDirectSelect ||
    activeVectorTool === 'penAdd' ||
    activeVectorTool === 'penRemove' ||
    activeVectorTool === 'penConvert';

  /* ⛔ Un outil de DESSIN prend toute la surface : les objets cessent d'écouter le
     pointeur, sinon un coup de crayon posé sur une forme la DÉPLACE, et la gomme ne
     peut jamais atteindre un tracé recouvert. */
  const blockObjectHit = isMarqueeMode || isCropMode || isPenMode || isPencilMode || isEraserMode;

  /** Points du tracé en cours [[x,y], …] — APERÇU seulement (la vérité est en ref) */
  const [penPoints,      setPenPoints]     = useState([]);
  /** Position de la souris pour la ligne de preview */
  const [penPreview,     setPenPreview]    = useState(null);
  /**
   * Tracé crayon en cours — SOURCE DE VÉRITÉ.
   * ⛔ MESURÉ (tracé enregistré 24,7×49,7 px pour un geste de ~300×175, ancré à la FIN
   * du geste) : quand l'accumulation dépendait de l'état React (`pencilActive` lu dans
   * la closure du handler committé), tout mousemove arrivé avant le commit du mousedown
   * était PERDU — un geste rapide ne gardait que sa fin. Les points vivent donc ici.
   */
  const traceCrayonRef = useRef(null);
  /** Épaisseur crayon lue au relâchement (la molette peut bouger PENDANT le geste). */
  const pencilSizeRef = useRef(pencilSize);
  pencilSizeRef.current = pencilSize;
  /** Geste gomme en cours : { aPousse, tues:Set } — null hors geste. */
  const gommeRef = useRef(null);

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
    // Masquer le Transformer quand un outil vecteur de dessin ou sélection région est actif.
    // Les outils d'ancre aussi : leurs poignées de nœud remplacent le cadre, et une
    // poignée du Transformer volerait les clics posés près d'une ancre.
    if (isPenMode || isPencilMode || isEraserMode || isMarqueeMode || isCropMode || outilAncres) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    // Exclure les objets verouilles du Transformer
    const nodes = (selectedIds || [])
      .filter((id) => !lockedIds.has(id))
      .map((id) => nodeRefs.current[id])
      .filter(Boolean);
    /* ⛔ Ne PAS réattacher une liste identique : le Transformer est attaché à la main au
       `mousedown` (cf. attraperPoigneeAuMousedown) et un `nodes()` de trop en plein
       redimensionnement remettrait la géométrie à zéro sous le doigt. */
    const actuels = tr.nodes() || [];
    const memes = actuels.length === nodes.length && nodes.every((n, i) => actuels[i] === n);
    if (memes) return;
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, sorted, lockedIds, isPenMode, isPencilMode, isEraserMode, isMarqueeMode, isCropMode, outilAncres]);

  /** Coords souris dans l'espace document (sans scale) */
  const getStagePos = useCallback((e) => {
    const stage = e.target.getStage();
    const pt    = stage.getPointerPosition();
    const sc    = stage.scaleX() || 1;
    return { x: pt.x / sc, y: pt.y / sc };
  }, []);

  /** Finalise un tracé (plume ou crayon) et crée l'objet line dans la scène */
  const finalizePen = useCallback((pts, options = {}) => {
    /* Doublons consécutifs écartés : le double-clic de fin (plume) pose deux ancres
       confondues — deux points au même endroit ne tracent RIEN et polluaient la scène
       (objets fantômes points:[0,0,0,0] mesurés par l'escouade T2). */
    const propres = [];
    for (const p of pts ?? []) {
      const dernier = propres[propres.length - 1];
      if (dernier && Math.hypot(p.x - dernier.x, p.y - dernier.y) < 0.75) continue;
      propres.push(p);
    }
    setPenPoints([]);
    setPenPreview(null);
    if (propres.length < 2) return; // tracé dégénéré : pas d'objet, pas d'historique
    pushHistoryStore();
    const xs   = propres.map((p) => p.x);
    const ys   = propres.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    // Les points doivent être relatifs à (minX, minY) — origin du nœud Konva
    const relPoints = propres.flatMap((p) => [p.x - minX, p.y - minY]);
    addObject({
      id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'line',
      x: minX,
      y: minY,
      width:  Math.max(14, maxX - minX),
      height: Math.max(14, maxY - minY),
      rotation: 0,
      content: { points: relPoints },
      style:   { stroke: '#ffffff', strokeWidth: Math.max(0.5, Number(options.epaisseur) || 2) },
      opacity: 1,
    });
  }, [addObject, pushHistoryStore]);

  /**
   * Démarre un tracé crayon.
   *
   * ⛔ Les écouteurs sont posés AU GESTE (window), pas via useEffect : un commit React
   * peut n'arriver qu'après plusieurs mousemove d'un geste rapide, et tout évènement
   * d'avant-commit était perdu (cf. traceCrayonRef). La conversion écran → document
   * passe par le rect du conteneur mesuré à CHAQUE évènement (clientToStage) — aucune
   * dépendance au cache pointeur de Konva ni à l'état React.
   */
  const commencerCrayon = useCallback((e) => {
    const stage = konvaStageRef.current;
    if (!stage) return;
    const depart = clientToStage(stage, e.evt.clientX, e.evt.clientY);
    traceCrayonRef.current = [depart];
    setPenPoints([depart]);
    const surMouvement = (ev) => {
      const st = konvaStageRef.current;
      const pts = traceCrayonRef.current;
      if (!st || !pts) return;
      const pos = clientToStage(st, ev.clientX, ev.clientY);
      const dernier = pts[pts.length - 1];
      if (dernier && Math.hypot(pos.x - dernier.x, pos.y - dernier.y) < 0.5) return;
      pts.push(pos);
      setPenPoints([...pts]); // aperçu — la vérité reste dans la ref
    };
    const terminer = () => {
      window.removeEventListener('mousemove', surMouvement);
      window.removeEventListener('mouseup', terminer);
      const pts = traceCrayonRef.current;
      traceCrayonRef.current = null;
      if (pts) finalizePen(pts, { epaisseur: pencilSizeRef.current });
    };
    window.addEventListener('mousemove', surMouvement);
    window.addEventListener('mouseup', terminer);
  }, [finalizePen]);

  /** Efface les tracés (`line`) passant sous le pointeur — coords document. */
  const effacerSousLePointeur = useCallback(
    (pos) => {
      const tolBase = RAYON_GOMME_ECRAN / (scale || 1);
      const deja = gommeRef.current?.tues;
      const ids = [];
      for (const o of sorted) {
        if (o.type !== 'line' || o.locked || o.hidden || deja?.has(o.id)) continue;
        const tol = tolBase + (Number(o.style?.strokeWidth) || 2) / 2;
        if (tracePresDuPoint(o, pos, tol)) ids.push(o.id);
      }
      if (!ids.length) return;
      /* Un balayage = UN pas d'historique, poussé au premier tracé emporté. */
      if (gommeRef.current && !gommeRef.current.aPousse) {
        pushHistoryStore();
        gommeRef.current.aPousse = true;
      }
      ids.forEach((id) => deja?.add(id));
      effacerObjets(ids);
    },
    [sorted, scale, effacerObjets, pushHistoryStore],
  );

  /** Démarre un balayage de gomme (mêmes écouteurs imperatifs que le crayon). */
  const commencerGomme = useCallback((e) => {
    const stage = konvaStageRef.current;
    if (!stage) return;
    gommeRef.current = { aPousse: false, tues: new Set() };
    effacerSousLePointeur(clientToStage(stage, e.evt.clientX, e.evt.clientY));
    const surMouvement = (ev) => {
      const st = konvaStageRef.current;
      if (!st || !gommeRef.current) return;
      effacerSousLePointeur(clientToStage(st, ev.clientX, ev.clientY));
    };
    const terminer = () => {
      window.removeEventListener('mousemove', surMouvement);
      window.removeEventListener('mouseup', terminer);
      gommeRef.current = null;
    };
    window.addEventListener('mousemove', surMouvement);
    window.addEventListener('mouseup', terminer);
  }, [effacerSousLePointeur]);

  const onStageMouseDown = useCallback(
    (e) => {
      // ── Plume : ajoute un ancrage à chaque clic ──────────────────────
      if (isPenMode) {
        if (e.target !== e.target.getStage()) return; // ignore clic sur objet
        const pos = getStagePos(e);
        setPenPoints((prev) => [...prev, pos]);
        return;
      }

      // ── Crayon : débute le tracé libre (écouteurs window, cf. commencerCrayon) ──
      if (isPencilMode) {
        if (e.target !== e.target.getStage()) return;
        commencerCrayon(e);
        return;
      }

      // ── Gomme : efface les tracés balayés ────────────────────────────
      if (isEraserMode) {
        commencerGomme(e);
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
      isEraserMode,
      isMarqueeMode,
      isCropMode,
      interactionTool,
      getStagePos,
      selectedIds,
      sorted,
      commencerCrayon,
      commencerGomme,
    ],
  );

  const onStageMouseMove = useCallback(
    (e) => {
      if (isPenMode && penPoints.length > 0) {
        setPenPreview(getStagePos(e));
      }
    },
    [isPenMode, penPoints.length, getStagePos],
  );

  const onStageDblClick = useCallback(
    () => {
      if (!isPenMode || penPoints.length < 3) return;
      /* ⛔ MESURÉ : Konva émet un dblclick pour TOUTE paire de clics rapprochés dans le
         TEMPS, même à 150 px l'un de l'autre — 4 ancres posées vite = 3 objets au lieu
         d'un chemin. Un « double-clic de fin » authentique, ce sont deux clics au même
         ENDROIT : les deux dernières ancres confondues (le mousedown du double a déjà
         posé la sienne). Sinon, le chemin continue. */
      const a = penPoints[penPoints.length - 1];
      const b = penPoints[penPoints.length - 2];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 6 / (scale || 1)) return;
      finalizePen(penPoints);
    },
    [isPenMode, penPoints, finalizePen, scale],
  );

  // Entrée termine le chemin plume ; Escape annule le tracé en cours ou la sélection région
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Enter') {
        if (!isPenMode || penPoints.length < 2) return;
        if (estSaisieEnCours(ev.target) || estSaisieEnCours(document.activeElement)) return;
        ev.preventDefault();
        finalizePen(penPoints);
        return;
      }
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
      if (isPenMode || isPencilMode || isEraserMode) {
        traceCrayonRef.current = null; // le mouseup window ne finalisera rien
        gommeRef.current = null;
        setPenPoints([]);
        setPenPreview(null);
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
    isEraserMode,
    isMarqueeMode,
    isCropMode,
    marqueeDraft,
    cropDraft,
    clearRegionMarquee,
    setInteractionTool,
    toast,
    penPoints,
    finalizePen,
  ]);

  /**
   * Rattrape le glissement lancé JUSTE APRÈS le clic de sélection.
   *
   * ⛔ MESURÉ : un tel glissement DÉPLAÇAIT l'objet (bloc descendu de 100 px,
   * recouvrement créé) au lieu de le redimensionner — parce qu'au `mousedown` l'objet
   * n'était pas encore sélectionné : le Transformer n'était pas attaché, la poignée
   * visée n'existait pas encore, et le clic tombait donc sur la forme. Sur un objet
   * DÉJÀ sélectionné la même poignée redimensionnait bien (56 → 298 px).
   *
   * On attache donc le Transformer SYNCHRONEMENT (avant que React ne recommite) et, si
   * le pointeur tombe sur une poignée, on annule le glissement de l'objet et on démarre
   * le redimensionnement sur cette poignée.
   *
   * @returns {boolean} true si la poignée a pris la main
   */
  const attraperPoigneeAuMousedown = useCallback(
    (e, id) => {
      const tr = trRef.current;
      const node = nodeRefs.current[id];
      const stage = e.target?.getStage?.();
      if (!tr || !node || !stage || blockObjectHit || isPenMode || isPencilMode || outilAncres) return false;
      if (lockedIds.has(id)) return false;
      try {
        tr.nodes([node]);
        tr.forceUpdate();
        stage.setPointersPositions(e.evt);
        const p = stage.getPointerPosition();
        if (!p) return false;
        const ancres = tr.find('._anchor').filter((a) => a.visible() && a.listening());
        let cible = null;
        let meilleure = Infinity;
        for (const a of ancres) {
          const r = a.getClientRect();
          if (p.x < r.x || p.x > r.x + r.width || p.y < r.y || p.y > r.y + r.height) continue;
          const d = Math.hypot(p.x - (r.x + r.width / 2), p.y - (r.y + r.height / 2));
          if (d < meilleure) {
            meilleure = d;
            cible = a;
          }
        }
        if (!cible) return false;
        /* Coupe le glissement déjà armé par Konva au mousedown (`_dragElements`
           passe de 'ready' à supprimé) ; on le rendra au relâchement. */
        node.draggable(false);
        draggableSuspenduRef.current = node;
        cible.fire('mousedown', { evt: e.evt, target: cible });
        return true;
      } catch {
        return false;
      }
    },
    [blockObjectHit, isPenMode, isPencilMode, outilAncres, lockedIds],
  );

  /* Rend le `draggable` confisqué le temps d'un redimensionnement attrapé au vol. */
  useEffect(() => {
    const rendre = () => {
      const n = draggableSuspenduRef.current;
      if (!n) return;
      draggableSuspenduRef.current = null;
      try {
        n.draggable(true);
      } catch {
        /* nœud démonté entre-temps */
      }
    };
    window.addEventListener('mouseup', rendre);
    window.addEventListener('touchend', rendre);
    return () => {
      window.removeEventListener('mouseup', rendre);
      window.removeEventListener('touchend', rendre);
    };
  }, []);

  /* ═══ Presse-papiers système + recouvrement ═══════════════════════════════ */

  const collerImage = useCallback(
    async (fichier) => {
      let mesure = null;
      let urlLocale = null;
      try {
        urlLocale = URL.createObjectURL(fichier);
        /* Mesure AVANT le téléversement : le fichier local donne les dimensions natives
           sans signature ni aller-retour réseau — la boîte est donc juste dès la pose. */
        mesure = await mesurerImage(urlLocale, { cache: false });
      } catch {
        mesure = null;
      } finally {
        if (urlLocale) URL.revokeObjectURL(urlLocale);
      }
      try {
        const { url } = await uploadSmartboardCanvasImage(fichier);
        addObject({
          type: 'image',
          layer: 2,
          rotation: 0,
          opacity: 1,
          style: { ajustement: MODES_AJUSTEMENT.CONTAIN },
          content: {
            src: url,
            ...(mesure
              ? { natif: { largeurNative: mesure.largeurNative, hauteurNative: mesure.hauteurNative, rapportNatif: mesure.rapportNatif } }
              : {}),
          },
        });
        toast({
          title: 'Image collée',
          description: mesure
            ? `Posée au format natif ${mesure.largeurNative} × ${mesure.hauteurNative}.`
            : 'Format natif mesuré au chargement.',
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Collage impossible',
          description: err?.message || 'Le téléversement de l’image a échoué.',
        });
      }
    },
    [addObject, toast],
  );

  useEffect(() => {
    const onPaste = (e) => {
      if (estSaisieEnCours(e.target) || estSaisieEnCours(document.activeElement)) return;
      const dt = e.clipboardData;
      if (!dt) return;

      const fichier = Array.from(dt.items || [])
        .filter((it) => it.kind === 'file' && String(it.type || '').startsWith('image/'))
        .map((it) => it.getAsFile?.())
        .find(Boolean);
      if (fichier) {
        e.preventDefault();
        void collerImage(fichier);
        return;
      }

      const texte = typeof dt.getData === 'function' ? dt.getData('text/plain') || '' : '';
      const objets = decoderPressePapiers(texte);
      if (objets?.length) {
        e.preventDefault();
        collerObjets(objets);
        return;
      }

      /* Écriture système refusée à la copie : le presse-papiers interne fait foi,
         sinon ⌘C suivi de ⌘V collerait un vieux texte venu d'une autre application. */
      const interne = useSmartboardKonvaStore.getState().presseCanevas;
      if (interne?.objets?.length && interne.systeme !== true) {
        e.preventDefault();
        collerObjets(interne.objets);
        return;
      }

      if (texte.trim()) {
        e.preventDefault();
        collerTexte(texte);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [collerImage, collerObjets, collerTexte]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.repeat) return;
      if (estSaisieEnCours(e.target) || estSaisieEnCours(document.activeElement)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      /* Recouvrement — ⌘⇧] premier plan / ⌘⇧[ arrière-plan.
         ⛔ `preventDefault` est ici NÉCESSAIRE : `useSmartboardDesignKeyboardShortcuts`
         (hors périmètre) écoute les mêmes touches pour un alignement centré et sort sur
         `defaultPrevented`. Sans ça, un même appui ferait les deux. */
      if (e.shiftKey && (e.code === 'BracketRight' || e.code === 'BracketLeft')) {
        const n = deplacerSelectionDansLaPile(e.code === 'BracketRight' ? 'premier-plan' : 'arriere-plan');
        if (!n) return;
        e.preventDefault();
        return;
      }
      const bas = String(e.key || '').toLowerCase();

      /* ⌘G groupe / ⌘⇧G dégroupe — le sous-titre du bouton Grouper PROMETTAIT Ctrl+G
         sans qu'aucun binding n'existe (mesuré : rien). `preventDefault` obligatoire :
         ⌘G est « rechercher le suivant » dans le navigateur. */
      if (bas === 'g' && !e.altKey) {
        e.preventDefault();
        if (e.shiftKey) {
          const n = ungroupSelectedStore();
          if (n) toast({ title: 'Dégroupé', description: `${n} groupe(s) dissous — les objets redeviennent indépendants.` });
        } else {
          const gid = groupSelectedStore();
          if (gid) {
            const nb = useSmartboardKonvaStore.getState().selectedIds.length;
            toast({ title: 'Groupé', description: `${nb} objets liés — un clic sélectionne et déplace tout le groupe.` });
          }
        }
        return;
      }

      if (e.shiftKey || e.altKey) return;
      if (bas !== 'c' && bas !== 'x' && bas !== 'v') return;

      /* ⛔ CONTRAINTE : `SmartboardKonvaEditorV1` (hors périmètre) tient un
         presse-papiers interne sur ⌘C/⌘V. Laisser les deux vivre, c'est coller DEUX
         fois. Ce composant étant monté SOUS l'éditeur, son écouteur est enregistré en
         premier : `stopImmediatePropagation` neutralise l'ancien chemin, et le
         presse-papiers système devient la source unique. `preventDefault` est
         volontairement OMIS sur ⌘V — il empêcherait l'évènement `paste`. */
      if (bas === 'v') {
        e.stopImmediatePropagation();
        return;
      }

      const { objets, texte } = bas === 'x' ? couperSelection() : copierSelection();
      e.stopImmediatePropagation();
      if (!objets.length) return;
      e.preventDefault();
      if (texte && navigator?.clipboard?.writeText) {
        navigator.clipboard
          .writeText(texte)
          .then(() => marquerPressePapiersSysteme(true))
          .catch(() => marquerPressePapiersSysteme(false));
      } else {
        marquerPressePapiersSysteme(false);
      }
      toast({
        title: bas === 'x' ? 'Coupé' : 'Copié',
        description: `${objets.length} objet(s) — ⌘V pour coller.`,
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    copierSelection,
    couperSelection,
    marquerPressePapiersSysteme,
    deplacerSelectionDansLaPile,
    groupSelectedStore,
    ungroupSelectedStore,
    toast,
  ]);

  /** Ancre du tracé la plus proche d'un point document — -1 si aucune sous tolérance. */
  const ancreLaPlusProche = useCallback((obj, posDoc, tolDoc) => {
    const paires = pairesDuTrace(obj.content?.points);
    let idx = -1;
    let min = Infinity;
    paires.forEach((p, i) => {
      const doc = localVersDocTrace(obj, p);
      const d = Math.hypot(posDoc.x - doc.x, posDoc.y - doc.y);
      if (d < min) {
        min = d;
        idx = i;
      }
    });
    return min <= tolDoc ? idx : -1;
  }, []);

  /** Action d'un outil d'ancre sur UNE ancre (clic poignée ou clic tracé proche). */
  const agirSurAncre = useCallback(
    (objId, index) => {
      if (activeVectorTool === 'penRemove') {
        const r = supprimerAncreTrace(objId, index);
        if (!r.ok && r.raison === 'minimum') {
          toast({ title: 'Suppr. ancre', description: 'Un tracé garde au moins deux ancres (trois s’il est fermé).' });
        }
        return;
      }
      if (activeVectorTool === 'penConvert') {
        const r = arrondirAncreTrace(objId, index);
        if (!r.ok && r.raison === 'extremite') {
          toast({ title: 'Convertir point', description: 'Une extrémité de tracé ouvert ne s’arrondit pas — visez une ancre intérieure.' });
        } else if (!r.ok && r.raison === 'colineaire') {
          toast({ title: 'Convertir point', description: 'Ancre confondue avec sa voisine : rien à arrondir.' });
        }
      }
    },
    [activeVectorTool, supprimerAncreTrace, arrondirAncreTrace, toast],
  );

  const onObjectMouseDown = useCallback(
    (e, id) => {
      e.cancelBubble = true;
      if (e.evt.button === 1) {
        e.evt.preventDefault();
        return;
      }
      if (e.evt.button !== 0) return;
      const obj = sorted.find((o) => o.id === id);

      /* ── Outils d'ancre sur un tracé : le clic ÉDITE, il ne glisse pas ─────── */
      if (outilAncres && obj?.type === 'line' && !obj.locked) {
        selectOnly?.(id);
        onObjectPrimaryClick?.();
        const pos = getStagePos(e);
        const tol = 10 / (scale || 1);
        if (activeVectorTool === 'penAdd') {
          const r = insererAncreTrace(id, pos, tol + (Number(obj.style?.strokeWidth) || 2) / 2);
          if (!r.ok && r.raison === 'loin') {
            toast({ title: 'Ajouter ancre', description: 'Cliquez sur le tracé lui-même.' });
          }
          return;
        }
        if (activeVectorTool === 'penRemove' || activeVectorTool === 'penConvert') {
          const idx = ancreLaPlusProche(obj, pos, tol);
          if (idx === -1) {
            toast({ title: activeVectorTool === 'penRemove' ? 'Suppr. ancre' : 'Convertir point', description: 'Cliquez une ancre (point cyan) du tracé sélectionné.' });
            return;
          }
          agirSurAncre(id, idx);
        }
        return; // directSelect : les poignées d'ancre prennent le relais
      }

      const mod = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
      const dejaSelectionne = (selectedIds || []).includes(id);
      if (!mod && !dejaSelectionne && attraperPoigneeAuMousedown(e, id)) {
        selectOnly?.(id);
        onObjectPrimaryClick?.();
        return;
      }
      if (mod) {
        toggleSelect?.(id);
      } else if (dejaSelectionne && (selectedIds || []).length > 1) {
        /* Sélection multiple : on ne la casse PAS au `mousedown`, sinon aucune
           pièce d'un tableau ne peut entraîner les autres. Réduction reportée au
           relâchement, et seulement si rien n'a glissé (usage des éditeurs). */
        reductionDiffereeRef.current = id;
      } else {
        /* ── Groupe : cliquer un membre sélectionne TOUT le groupe ──────────────
           ⛔ MESURÉ : `groupId` n'était LU nulle part dans le moteur — le drag d'un
           membre déplaçait 1/3 du groupe. La sélection entière branche le groupe sur
           le multi-drag existant (Konva glisse tous les nœuds du Transformer). Un
           second clic sec sur un membre isole la pièce (réduction différée ci-dessus). */
        const groupe = obj?.groupId
          ? sorted.filter((o) => o.groupId === obj.groupId).map((o) => o.id)
          : null;
        if (groupe && groupe.length > 1) {
          setSelectedIds(groupe);
          /* Attache SYNCHRONE (avant le commit React) : sans elle, le drag entamé
             dans le même geste que le clic n'emporterait que la pièce cliquée. */
          const tr = trRef.current;
          const nodes = groupe.map((gid) => nodeRefs.current[gid]).filter(Boolean);
          if (tr && nodes.length) {
            try {
              tr.nodes(nodes);
              tr.forceUpdate();
            } catch {
              /* nœuds en cours de (dé)montage : l'effet réattachera */
            }
          }
        } else {
          selectOnly?.(id);
        }
      }
      onObjectPrimaryClick?.();
    },
    [
      selectOnly,
      toggleSelect,
      onObjectPrimaryClick,
      selectedIds,
      attraperPoigneeAuMousedown,
      sorted,
      outilAncres,
      activeVectorTool,
      getStagePos,
      scale,
      insererAncreTrace,
      ancreLaPlusProche,
      agirSurAncre,
      setSelectedIds,
      toast,
    ],
  );

  /** Clic sec (aucun glissement) sur une pièce déjà sélectionnée → on isole enfin. */
  const onObjectMouseUp = useCallback(
    (id) => {
      if (reductionDiffereeRef.current === id) selectOnly?.(id);
      reductionDiffereeRef.current = null;
    },
    [selectOnly],
  );

  const handleDragStart = useCallback(
    (obj) => {
      dragOriginRef.current = { x: obj.x, y: obj.y };
      reductionDiffereeRef.current = null;
      glissementsEnCoursRef.current += 1;
      /* Un seul cliché d'historique pour tout le geste (cf. glissementsEnCoursRef). */
      if (glissementsEnCoursRef.current === 1) {
        pushHistory?.();
        onUserCanvasGesture?.({ kind: 'drag' });
      }
    },
    [pushHistory, onUserCanvasGesture],
  );

  /**
   * Accroche la boîte déplacée aux repères des autres objets et de la page.
   *
   * ⛔ UN SEUL objet à la fois : sur une sélection multiple Konva glisse CHAQUE nœud
   * séparément (cf. glissementsEnCoursRef) ; accrocher chacun de son côté écarterait
   * les pièces les unes des autres. Mieux vaut pas de magnétisme qu'un groupe cassé.
   */
  const accrocher = useCallback(
    (obj, attrs, e) => {
      if (glissementsEnCoursRef.current !== 1 || e?.evt?.altKey) {
        if (guidesAccrochage.length) setGuidesAccrochage([]);
        return attrs;
      }
      const boite = { x: attrs.x, y: attrs.y, width: attrs.width ?? 0, height: attrs.height ?? 0 };
      const cibles = sorted
        .filter((o) => o.id !== obj.id && !o.hidden && o.visible !== false)
        .map((o) => ({ x: o.x ?? 0, y: o.y ?? 0, width: o.width ?? 0, height: o.height ?? 0 }));
      const { dx, dy, guides } = calculerAccrochage({
        boite,
        cibles,
        lignes: lignesDePage({ width, height }),
        seuil: SEUIL_ACCROCHAGE_PX / (scale || 1),
      });
      const memes =
        guides.length === guidesAccrochage.length &&
        guides.every((g, i) => g.axe === guidesAccrochage[i].axe && g.valeur === guidesAccrochage[i].valeur);
      if (!memes) setGuidesAccrochage(guides);
      if (!dx && !dy) return attrs;
      return { ...attrs, x: attrs.x + dx, y: attrs.y + dy };
    },
    [sorted, width, height, scale, guidesAccrochage],
  );

  const handleDragMove = useCallback(
    (obj, e) => {
      const raw = dragAttrs(obj, e.target);
      const cale = applyShiftAxisLock(raw, dragOriginRef.current, e.evt.shiftKey);
      const attrs = accrocher(obj, cale, e);
      updateObjectTransform?.(obj.id, attrs);
    },
    [updateObjectTransform, accrocher],
  );

  const handleDragEnd = useCallback(
    (obj, e) => {
      const node = e.target;
      try {
        const box = node.getClientRect();
        if (!clientRectIntersectsStage(box, width, height)) {
          onDeleteObject?.(obj.id);
          dragOriginRef.current = null;
          glissementsEnCoursRef.current = Math.max(0, glissementsEnCoursRef.current - 1);
          setGuidesAccrochage([]);
          return;
        }
      } catch {
        /* ignore */
      }
      let attrs = dragAttrs(obj, e.target);
      attrs = applyShiftAxisLock(attrs, dragOriginRef.current, e.evt.shiftKey);
      attrs = accrocher(obj, attrs, e);
      attrs = snapPosAttrs(attrs, snapGrid);
      updateObjectTransform?.(obj.id, attrs);
      dragOriginRef.current = null;
      glissementsEnCoursRef.current = Math.max(0, glissementsEnCoursRef.current - 1);
      setGuidesAccrochage([]);
    },
    [updateObjectTransform, snapGrid, width, height, onDeleteObject, accrocher],
  );

  /**
   * ⛔ La taille est relevée AU DÉBUT du geste : pendant le redimensionnement,
   * `updateObjectTransform` réécrit déjà l'objet à chaque `transform`, donc comparer à
   * la fin avec l'objet du rendu courant ne montrerait plus aucun écart — et le bloc
   * de texte reprendrait sa hauteur automatique juste après que l'utilisateur l'a fixée.
   */
  const handleTransformStart = useCallback(
    (obj) => {
      if (obj?.id) taillesAvantTransformRef.current.set(obj.id, { width: obj.width, height: obj.height });
      transformsEnCoursRef.current += 1;
      /* Même piège que le glissement : sur une sélection multiple, Konva émet un
         `transformstart` par nœud attaché. Un seul cliché pour tout le geste. */
      if (transformsEnCoursRef.current > 1) return;
      pushHistory?.();
      onUserCanvasGesture?.({ kind: 'transform' });
    },
    [pushHistory, onUserCanvasGesture],
  );

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
      /* La taille vient d'être posée à la main : ni la mesure native d'une image ni la
         mesure du texte ne doivent la reprendre ensuite (on ne confisque pas un geste). */
      transformsEnCoursRef.current = Math.max(0, transformsEnCoursRef.current - 1);
      const avant = taillesAvantTransformRef.current.get(obj.id);
      taillesAvantTransformRef.current.delete(obj.id);
      if (obj.type === 'image') marquerBoiteImageManuelle?.(obj.id);
      if (obj.type === 'text' && Math.abs((attrs.height ?? 0) - (avant?.height ?? obj.height ?? 0)) > 0.5) {
        marquerHauteurTexteManuelle?.(obj.id);
      }
    },
    [updateObjectTransform, snapGrid, marquerBoiteImageManuelle, marquerHauteurTexteManuelle],
  );

  const couleursCadre = useMemo(() => couleursCadreSelection(background), [background]);
  const remplissageFond = useMemo(
    () => remplissageDuFond(background, width, height),
    [background, width, height],
  );
  const sw = width * scale;
  const sh = height * scale;
  const selSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);

  /** Poignées du Transformer adaptées à la sélection (voir reglerTransformerPourSelection). */
  const reglageTransformer = useMemo(() => {
    const parId = new Map(sorted.map((o) => [o.id, o]));
    const objets = (selectedIds || [])
      .filter((id) => !lockedIds.has(id))
      .map((id) => parId.get(id))
      .filter(Boolean);
    return reglerTransformerPourSelection(objets, scale);
  }, [selectedIds, sorted, lockedIds, scale]);

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
              : isEraserMode
                ? 'cell'
                : outilAncres
                  ? isDirectSelect
                    ? 'default'
                    : 'crosshair'
                  : 'default',
      }}
      className="rounded-lg"
    >
      <Layer ref={layerRef}>
        {/* Fond du document — couleur OU dégradé CSS traduit (cf. remplissageDuFond) */}
        {remplissageFond && (
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            {...remplissageFond}
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
              /* ⛔ MESURÉ (Sélection directe) : glisser une ancre déplaçait l'objet
                 ENTIER — c'était le drag Konva du nœud. Sous un outil d'ancre, un
                 tracé ne se glisse plus : seuls ses nœuds bougent. */
              draggable: !obj.locked && !blockObjectHit && !(outilAncres && obj.type === 'line'),
              listening: !blockObjectHit,
              onMouseDown: bindObjectMouseDown(obj),
              onMouseUp: () => onObjectMouseUp(obj.id),
              onDragStart: () => handleDragStart(obj),
              onDragMove: (e) => handleDragMove(obj, e),
              onDragEnd: (e) => handleDragEnd(obj, e),
              onTransformStart: () => handleTransformStart(obj),
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
              {/* Ligne de tracé — le crayon montre son épaisseur RÉELLE (molette) */}
              <Line
                points={previewFlat}
                stroke="#22d3ee"
                strokeWidth={isPencilMode ? Math.max(0.5, pencilSize) : 1.5 / (scale || 1)}
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

        {/* ── Poignées d'ancre (Ajouter/Suppr./Convertir/Sélection directe) ────
            Visibles dès qu'UN tracé est sélectionné sous un outil d'ancre. En
            Sélection directe elles se GLISSENT : le geste pousse UN cliché
            d'historique au départ (protocole du Crayon), écrit en live, puis la
            boîte est rebasée au relâchement. */}
        {outilAncres && (() => {
          const sel = selectedIds || [];
          if (sel.length !== 1) return null;
          const obj = sorted.find((o) => o.id === sel[0]);
          if (!obj || obj.type !== 'line' || obj.locked) return null;
          const paires = pairesDuTrace(obj.content?.points);
          if (paires.length < 2) return null;
          const sc = scale || 1;
          return (
            <Group>
              {paires.map((p, i) => {
                const doc = localVersDocTrace(obj, p);
                return (
                  <Circle
                    key={`ancre_${obj.id}_${i}`}
                    x={doc.x}
                    y={doc.y}
                    radius={5 / sc}
                    fill="#0a0b0f"
                    stroke="#22d3ee"
                    strokeWidth={1.5 / sc}
                    hitStrokeWidth={8 / sc}
                    draggable={isDirectSelect}
                    onMouseDown={(ev) => {
                      ev.cancelBubble = true;
                      agirSurAncre(obj.id, i);
                    }}
                    onDragStart={(ev) => {
                      ev.cancelBubble = true;
                      pushHistoryStore();
                    }}
                    onDragMove={(ev) =>
                      deplacerAncreTrace(obj.id, i, { x: ev.target.x(), y: ev.target.y() })
                    }
                    onDragEnd={() => terminerDeplacementAncre(obj.id)}
                    perfectDrawEnabled={false}
                  />
                );
              })}
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

        {/* Guides d'alignement — visibles seulement pendant le geste. */}
        {guidesAccrochage.map((g, i) => (
          <Line
            key={`guide_${g.axe}_${g.valeur}_${i}`}
            points={g.axe === 'V' ? [g.valeur, 0, g.valeur, height] : [0, g.valeur, width, g.valeur]}
            stroke="#ff5c39"
            strokeWidth={1 / (scale || 1)}
            dash={[6 / (scale || 1), 4 / (scale || 1)]}
            listening={false}
            perfectDrawEnabled={false}
          />
        ))}

        <Transformer
          ref={trRef}
          /* Image : proportions gardées par défaut, Maj les libère ('inverted' =
             keepRatio && !shiftKey côté Konva). Ailleurs : comportement d'origine
             (libre, Maj contraint). */
          keepRatio={reglageTransformer.garderRapport}
          shiftBehavior={reglageTransformer.garderRapport ? 'inverted' : 'default'}
          /* ⛔ Les poignées sont dimensionnées en px ÉCRAN : sur une cellule de tableau
             elles recouvraient le centre et volaient le double-clic. Le réglage est donc
             calculé par sélection — jamais figé. */
          listening={reglageTransformer.ecoutePointeur}
          resizeEnabled={reglageTransformer.redimensionnable}
          rotateEnabled={reglageTransformer.rotatif}
          enabledAnchors={reglageTransformer.ancres}
          boundBoxFunc={transformerBoundBoxFunc}
          /* Contraste du cadre : voir couleursCadreSelection (blanc sur blanc = invisible). */
          borderStroke={couleursCadre.trait}
          borderStrokeWidth={1.5}
          anchorStroke={couleursCadre.ancre}
          anchorFill={couleursCadre.remplissage}
          anchorSize={8}
        />
      </Layer>
    </Stage>
    </div>
  );
});

export default KonvaBoardStage;
