/**
 * Chemins vectoriels — contours échantillonnés + opérations booléennes sur POLYGONES.
 *
 * ⛔ MESURÉ (escouade Formes & Vecteur, 2026-08-06) : « Unir » rect + cercle rendait la
 * boîte englobante (le contour circulaire disparaissait), « Intersecter » l'intersection
 * des boîtes (des coins hors du cercle), « Soustraire » supprimait simplement une forme.
 * Un booléen honnête travaille sur les CONTOURS. Ce module les fournit : chaque forme
 * finie du moteur est échantillonnée en polygone fermé, et les opérations découpent puis
 * recousent les vrais bords.
 *
 * ⛔ FAIL-CLOSED : un cas que la couture ne sait pas fermer (tangences, bords confondus
 * partiels, tracé auto-sécant) rend { ok:false, raison } — JAMAIS un polygone faux.
 * L'appelant doit le dire à l'écran ; un résultat faux est pire qu'un refus expliqué.
 *
 * Module PUR (aucun Konva, aucun store) : testable par node --test.
 */

/** Écart en dessous duquel deux points sont LE MÊME (unités document ≈ px). */
const EPS_POINT = 1e-6;
/** Distance au bord en dessous de laquelle un point est SUR le contour de l'autre forme. */
const EPS_BORD = 1e-6;
/** Aire (px²) en dessous de laquelle une boucle est un déchet numérique, pas une forme. */
const EPS_AIRE = 0.5;
/** Paramètre de tolérance des intersections de segments. */
const EPS_PARAM = 1e-9;

/** Segments d'échantillonnage d'un cercle / d'une ellipse complets. */
const SEGMENTS_COURBE = 64;
/** Segments d'un quart de congé (coin arrondi de rectangle). */
const SEGMENTS_CONGE = 6;

/* ═══════════════════════════════════════════════════════════════════
   Petites primitives
   ═══════════════════════════════════════════════════════════════════ */

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Rotation d'un point autour d'un centre, en DEGRÉS (sens Konva : horaire). */
export function tournerAutour(p, centre, degres) {
  const a = ((Number(degres) || 0) * Math.PI) / 180;
  if (!a) return { x: p.x, y: p.y };
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - centre.x;
  const dy = p.y - centre.y;
  return { x: centre.x + dx * cos - dy * sin, y: centre.y + dx * sin + dy * cos };
}

/** Aire signée d'un polygone (positive = sens horaire en repère écran). */
export function airePolygone(poly) {
  if (!poly || poly.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const j = (i + 1) % poly.length;
    a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
  }
  return a / 2;
}

/** Ray casting — le polygone est fermé implicitement (dernier → premier). */
export function pointDansPolygone(p, poly) {
  if (!poly || poly.length < 3) return false;
  let dedans = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const den = yj - yi;
    if (Math.abs(den) < 1e-12) continue;
    const coupe = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / den + xi;
    if (coupe) dedans = !dedans;
  }
  return dedans;
}

function distanceAuSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance d'un point au CONTOUR (pas à l'intérieur) d'un polygone. */
export function distanceAuContour(p, poly) {
  if (!poly || poly.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < poly.length; i += 1) {
    const d = distanceAuSegment(p, poly[i], poly[(i + 1) % poly.length]);
    if (d < min) min = d;
  }
  return min;
}

/** 'dedans' | 'dehors' | 'bord' — le classement qui pilote les booléens. */
function classerPoint(p, poly) {
  if (distanceAuContour(p, poly) < EPS_BORD) return 'bord';
  return pointDansPolygone(p, poly) ? 'dedans' : 'dehors';
}

/* ═══════════════════════════════════════════════════════════════════
   Contours des objets du moteur
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Types dont un contour fidèle est calculable. Texte, image, icône, tableau, HTML n'ont
 * PAS de contour vectoriel — les booléens doivent les REFUSER (jamais transformer un
 * titre en rectangle muet, défaut mesuré). La flèche est exclue : ses pointes sont un
 * décor de rendu, pas un chemin du modèle.
 */
export const TYPES_OPERABLES = new Set(['rect', 'circle', 'ellipse', 'triangle', 'diamond', 'starshape', 'line']);

/**
 * L'objet peut-il entrer dans une opération booléenne ?
 * @returns {{ ok: boolean, raison?: 'type'|'ligne_plate' }}
 */
export function estOperableBooleen(obj) {
  if (!obj || !TYPES_OPERABLES.has(obj.type)) return { ok: false, raison: 'type' };
  if (obj.type === 'line') {
    const pts = obj.content?.points;
    /* 2 ancres = un trait : refermé il n'enclot AUCUNE surface. */
    if (!Array.isArray(pts) || pts.length < 6) return { ok: false, raison: 'ligne_plate' };
  }
  return { ok: true };
}

/** Vertices d'un polygone régulier façon Konva (1er sommet en HAUT, sens horaire). */
function polygoneRegulier(cx, cy, rayon, cotes, rotationDeg) {
  const pts = [];
  for (let k = 0; k < cotes; k += 1) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / cotes;
    pts.push(tournerAutour({ x: cx + rayon * Math.cos(a), y: cy + rayon * Math.sin(a) }, { x: cx, y: cy }, rotationDeg));
  }
  return pts;
}

/**
 * Contour FERMÉ d'un objet, en coordonnées DOCUMENT, rotation comprise — au plus près
 * de ce que KonvaBoardObject dessine réellement (mêmes centres, mêmes rayons, même
 * départ en haut pour les polygones réguliers, rotation 45° FIGÉE du losange).
 *
 * @returns {Array<{x:number,y:number}>|null} null si le type n'est pas opérable
 */
export function contourDeLObjet(obj) {
  if (!estOperableBooleen(obj).ok) return null;
  const x = Number(obj.x) || 0;
  const y = Number(obj.y) || 0;
  const w = Math.abs(Number(obj.width) || 0);
  const h = Math.abs(Number(obj.height) || 0);
  const rot = Number(obj.rotation) || 0;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const st = obj.style || {};

  switch (obj.type) {
    case 'rect': {
      const r = Math.max(0, Math.min(Number(st.cornerRadius) || 0, Math.min(w, h) / 2));
      let pts;
      if (r <= 0) {
        pts = [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ];
      } else {
        /* Quatre congés quart-de-cercle échantillonnés, dans l'ordre horaire. */
        pts = [];
        const coins = [
          { cx: x + w - r, cy: y + r, de: -90, a: 0 },
          { cx: x + w - r, cy: y + h - r, de: 0, a: 90 },
          { cx: x + r, cy: y + h - r, de: 90, a: 180 },
          { cx: x + r, cy: y + r, de: 180, a: 270 },
        ];
        for (const c of coins) {
          for (let s = 0; s <= SEGMENTS_CONGE; s += 1) {
            const a = ((c.de + ((c.a - c.de) * s) / SEGMENTS_CONGE) * Math.PI) / 180;
            pts.push({ x: c.cx + r * Math.cos(a), y: c.cy + r * Math.sin(a) });
          }
        }
      }
      /* Konva fait tourner un Rect autour de son ORIGINE (x,y), pas de son centre. */
      return pts.map((p) => tournerAutour(p, { x, y }, rot));
    }
    case 'circle': {
      const r = Math.min(w, h) / 2;
      const pts = [];
      for (let k = 0; k < SEGMENTS_COURBE; k += 1) {
        const a = (k * 2 * Math.PI) / SEGMENTS_COURBE;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      return pts; // rotation d'un cercle : invisible, inutile
    }
    case 'ellipse': {
      const rx = w / 2;
      const ry = h / 2;
      const pts = [];
      for (let k = 0; k < SEGMENTS_COURBE; k += 1) {
        const a = (k * 2 * Math.PI) / SEGMENTS_COURBE;
        pts.push(tournerAutour({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }, { x: cx, y: cy }, rot));
      }
      return pts;
    }
    case 'triangle':
      return polygoneRegulier(cx, cy, Math.min(w, h) / 2, 3, rot);
    case 'diamond':
      /* ⛔ Le rendu ÉCRASE la rotation de l'objet par un 45° figé (prop après spread) :
         le contour doit reproduire le rendu, pas le modèle rêvé. */
      return polygoneRegulier(cx, cy, Math.min(w, h) / 2, 4, 45);
    case 'starshape': {
      const branches = Math.max(3, Number(st.numPoints) || 5);
      const rExt = Math.min(w, h) / 2;
      const rInt = rExt * 0.42; // même rapport figé que le rendu
      const pts = [];
      for (let k = 0; k < branches * 2; k += 1) {
        const r = k % 2 === 0 ? rExt : rInt;
        const a = -Math.PI / 2 + (k * Math.PI) / branches;
        pts.push(tournerAutour({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }, { x: cx, y: cy }, rot));
      }
      return pts;
    }
    case 'line': {
      const brut = obj.content?.points ?? [];
      const pts = [];
      for (let i = 0; i + 1 < brut.length; i += 2) {
        const p = tournerAutour({ x: x + brut[i], y: y + brut[i + 1] }, { x, y }, rot);
        const dernier = pts[pts.length - 1];
        if (dernier && distance(dernier, p) < EPS_POINT) continue;
        pts.push(p);
      }
      /* Chemin implicitement REFERMÉ (convention Pathfinder) — l'appelant l'annonce. */
      if (pts.length > 1 && distance(pts[0], pts[pts.length - 1]) < EPS_POINT) pts.pop();
      return pts.length >= 3 ? pts : null;
    }
    default:
      return null;
  }
}

/**
 * Couleurs telles que RENDUES par KonvaBoardObject (défauts compris) — pour qu'une
 * forme convertie en chemin garde exactement son apparence.
 */
export function stylePeintDeLObjet(obj) {
  const st = obj?.style || {};
  const defauts = {
    rect: 'rgba(212,175,55,0.15)',
    circle: 'rgba(96,165,250,0.2)',
    triangle: 'rgba(168,85,247,0.25)',
    starshape: '#D4AF37',
    diamond: 'rgba(20,184,166,0.25)',
    ellipse: 'rgba(139,92,246,0.2)',
  };
  if (obj?.type === 'line') {
    return {
      fill: st.fill ?? undefined,
      stroke: st.stroke ?? '#94a3b8',
      strokeWidth: st.strokeWidth ?? 2,
    };
  }
  return {
    fill: st.fill || defauts[obj?.type] || 'rgba(212,175,55,0.15)',
    stroke: st.stroke || undefined,
    strokeWidth: st.strokeWidth ?? 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Booléens : découpe des arêtes + couture des boucles
   ═══════════════════════════════════════════════════════════════════ */

/** Intersection propre de deux segments — null si parallèles ou hors bornes. */
function intersectionSegments(a1, a2, b1, b2) {
  const rx = a2.x - a1.x;
  const ry = a2.y - a1.y;
  const sx = b2.x - b1.x;
  const sy = b2.y - b1.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null; // colinéaires : traités par le classement 'bord'
  const qx = b1.x - a1.x;
  const qy = b1.y - a1.y;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < -EPS_PARAM || t > 1 + EPS_PARAM || u < -EPS_PARAM || u > 1 + EPS_PARAM) return null;
  const tc = Math.max(0, Math.min(1, t));
  return { t: tc, u: Math.max(0, Math.min(1, u)), point: { x: a1.x + tc * rx, y: a1.y + tc * ry } };
}

/**
 * Découpe chaque polygone aux points d'intersection avec l'autre.
 * ⛔ Le MÊME objet point est partagé entre la coupe de A et celle de B : la couture
 * peut alors recoller par identité numérique exacte, sans tolérance hasardeuse.
 */
function decouperAretes(polyA, polyB) {
  const coupesA = polyA.map(() => []);
  const coupesB = polyB.map(() => []);
  let nb = 0;
  for (let i = 0; i < polyA.length; i += 1) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j += 1) {
      const hit = intersectionSegments(a1, a2, polyB[j], polyB[(j + 1) % polyB.length]);
      if (!hit) continue;
      coupesA[i].push({ t: hit.t, point: hit.point });
      coupesB[j].push({ t: hit.u, point: hit.point });
      nb += 1;
    }
  }
  const sousAretes = (poly, coupes, origine) => {
    const out = [];
    for (let i = 0; i < poly.length; i += 1) {
      const fin = poly[(i + 1) % poly.length];
      const seq = [poly[i], ...coupes[i].sort((p, q) => p.t - q.t).map((c) => c.point), fin];
      for (let k = 0; k + 1 < seq.length; k += 1) {
        if (distance(seq[k], seq[k + 1]) < EPS_POINT) continue;
        out.push({ a: seq[k], b: seq[k + 1], origine });
      }
    }
    return out;
  };
  return { aretesA: sousAretes(polyA, coupesA, 'A'), aretesB: sousAretes(polyB, coupesB, 'B'), nb };
}

/** Recoud un sac de sous-arêtes en boucles fermées — null si la couture échoue. */
function coudreEnBoucles(aretes) {
  const restantes = [...aretes];
  const boucles = [];
  while (restantes.length) {
    const premiere = restantes.pop();
    const chemin = [premiere.a, premiere.b];
    let garde = 0;
    let fermee = false;
    while (garde < 100000) {
      garde += 1;
      const bout = chemin[chemin.length - 1];
      if (chemin.length > 2 && distance(bout, chemin[0]) < EPS_POINT) {
        chemin.pop();
        fermee = true;
        break;
      }
      let trouvee = -1;
      let inverse = false;
      for (let k = 0; k < restantes.length; k += 1) {
        if (distance(restantes[k].a, bout) < EPS_POINT) {
          trouvee = k;
          inverse = false;
          break;
        }
        if (distance(restantes[k].b, bout) < EPS_POINT) {
          trouvee = k;
          inverse = true;
          break;
        }
      }
      if (trouvee === -1) return null; // impasse : cas dégénéré, on refuse
      const e = restantes.splice(trouvee, 1)[0];
      chemin.push(inverse ? e.a : e.b);
    }
    if (!fermee) return null;
    if (Math.abs(airePolygone(chemin)) > EPS_AIRE) boucles.push(chemin);
  }
  return boucles;
}

/**
 * Opération booléenne entre deux polygones fermés simples.
 *
 * Modes : 'union' | 'intersection' | 'soustraction' (A − B).
 * @returns {{ ok:true, polygones: Array<Array<{x,y}>> } | { ok:false, raison:string }}
 *   raisons : 'disjointes' (aucun recouvrement exploitable), 'vide' (résultat sans
 *   surface), 'trou' (anneau non représentable sans chemins composés), 'couture'
 *   (cas dégénéré refusé plutôt que faux).
 */
export function operationBooleenne(polyA, polyB, mode) {
  if (!polyA || polyA.length < 3 || !polyB || polyB.length < 3) return { ok: false, raison: 'vide' };
  const { aretesA, aretesB, nb } = decouperAretes(polyA, polyB);

  if (nb === 0) {
    /* Aucun croisement : tout se joue au contenant/contenu. */
    const classeA = polyA.map((p) => classerPoint(p, polyB)).find((c) => c !== 'bord') ?? 'bord';
    const classeB = polyB.map((p) => classerPoint(p, polyA)).find((c) => c !== 'bord') ?? 'bord';
    const aDansB = classeA === 'dedans';
    const bDansA = classeB === 'dedans';
    if (mode === 'union') {
      if (aDansB) return { ok: true, polygones: [polyB] };
      if (bDansA) return { ok: true, polygones: [polyA] };
      return { ok: false, raison: 'disjointes' };
    }
    if (mode === 'intersection') {
      if (aDansB) return { ok: true, polygones: [polyA] };
      if (bDansA) return { ok: true, polygones: [polyB] };
      if (classeA === 'bord' && classeB === 'bord') return { ok: true, polygones: [polyA] }; // formes confondues
      return { ok: false, raison: 'disjointes' };
    }
    /* soustraction A − B */
    if (bDansA) return { ok: false, raison: 'trou' };
    if (aDansB) return { ok: false, raison: 'vide' };
    if (classeA === 'bord' && classeB === 'bord') return { ok: false, raison: 'vide' };
    return { ok: true, polygones: [polyA] }; // B ne touche pas A : il est simplement retiré
  }

  const milieu = (e) => ({ x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 });
  const gardees = [];
  for (const e of aretesA) {
    const c = classerPoint(milieu(e), polyB);
    if (mode === 'union' && c === 'dehors') gardees.push(e);
    if (mode === 'intersection' && (c === 'dedans' || c === 'bord')) gardees.push(e);
    if (mode === 'soustraction' && (c === 'dehors' || c === 'bord')) gardees.push(e);
  }
  for (const e of aretesB) {
    const c = classerPoint(milieu(e), polyA);
    if (mode === 'union' && c === 'dehors') gardees.push(e);
    if (mode === 'intersection' && c === 'dedans') gardees.push(e);
    if (mode === 'soustraction' && c === 'dedans') gardees.push(e);
  }
  if (!gardees.length) return { ok: false, raison: 'vide' };
  const boucles = coudreEnBoucles(gardees);
  if (boucles === null) return { ok: false, raison: 'couture' };
  if (!boucles.length) return { ok: false, raison: 'vide' };
  return { ok: true, polygones: boucles };
}

export const unionDePolygones = (a, b) => operationBooleenne(a, b, 'union');
export const intersectionDePolygones = (a, b) => operationBooleenne(a, b, 'intersection');
export const soustractionDePolygones = (a, b) => operationBooleenne(a, b, 'soustraction');

/**
 * « Diviser » façon Pathfinder : les morceaux A∖B, B∖A et A∩B, chacun en boucles.
 * @returns {{ ok:true, communs:[], restesA:[], restesB:[] } | { ok:false, raison }}
 */
export function divisionDePolygones(a, b) {
  const communs = intersectionDePolygones(a, b);
  if (!communs.ok) return { ok: false, raison: communs.raison };
  const coupe = (poly, autre) => {
    const r = soustractionDePolygones(poly, autre);
    if (r.ok) return r.polygones;
    if (r.raison === 'vide') return []; // entièrement recouvert : pas de reste, pas une erreur
    return null; // 'trou' / 'couture' : la division entière est refusée
  };
  const restesA = coupe(a, b);
  if (restesA === null) return { ok: false, raison: 'couture' };
  const restesB = coupe(b, a);
  if (restesB === null) return { ok: false, raison: 'couture' };
  return { ok: true, communs: communs.polygones, restesA, restesB };
}

/* ═══════════════════════════════════════════════════════════════════
   Ancres d'un tracé (content.points) — outils plume avancés
   ═══════════════════════════════════════════════════════════════════ */

/** [x0,y0,x1,y1…] → [{x,y}…] (paires incomplètes ignorées). */
export function pairesDuTrace(points) {
  const out = [];
  const pts = Array.isArray(points) ? points : [];
  for (let i = 0; i + 1 < pts.length; i += 2) out.push({ x: Number(pts[i]) || 0, y: Number(pts[i + 1]) || 0 });
  return out;
}

/** Coordonnée DOCUMENT d'un point LOCAL du tracé (rotation autour de l'origine du nœud). */
export function localVersDocTrace(obj, p) {
  return tournerAutour({ x: (Number(obj.x) || 0) + p.x, y: (Number(obj.y) || 0) + p.y }, { x: Number(obj.x) || 0, y: Number(obj.y) || 0 }, Number(obj.rotation) || 0);
}

/** Inverse : point DOCUMENT → repère LOCAL du tracé. */
export function docVersLocalTrace(obj, p) {
  const x0 = Number(obj.x) || 0;
  const y0 = Number(obj.y) || 0;
  const t = tournerAutour(p, { x: x0, y: y0 }, -(Number(obj.rotation) || 0));
  return { x: t.x - x0, y: t.y - y0 };
}

/**
 * Projette un point LOCAL sur le tracé : segment le plus proche et point projeté.
 * `ferme` ajoute le segment dernier → premier.
 * @returns {{ index:number, point:{x,y}, distance:number } | null} index = insertion à index+1
 */
export function projeterSurTrace(paires, p, { ferme = false } = {}) {
  if (!paires || paires.length < 2) return null;
  const nSeg = ferme ? paires.length : paires.length - 1;
  let meilleur = null;
  for (let i = 0; i < nSeg; i += 1) {
    const a = paires[i];
    const b = paires[(i + 1) % paires.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    const proj = { x: a.x + t * dx, y: a.y + t * dy };
    const d = distance(p, proj);
    if (!meilleur || d < meilleur.distance) meilleur = { index: i, point: proj, distance: d };
  }
  return meilleur;
}

/**
 * Coin → courbe : remplace l'ancre `index` par un ARRONDI échantillonné (Bézier
 * quadratique dont l'ancre est le point de contrôle). SENS UNIQUE : le modèle ne
 * stocke que des polylignes, l'arrondi devient des ancres ordinaires — l'UI l'annonce.
 *
 * @returns {{ ok:true, paires:[] } | { ok:false, raison:'extremite'|'colineaire' }}
 */
export function arrondirCoinTrace(paires, index, { ferme = false, fraction = 0.5, segments = 8 } = {}) {
  const n = paires?.length ?? 0;
  if (n < 3) return { ok: false, raison: 'extremite' };
  const interne = index > 0 && index < n - 1;
  if (!interne && !ferme) return { ok: false, raison: 'extremite' };
  const P = paires[index];
  const avant = paires[(index - 1 + n) % n];
  const apres = paires[(index + 1) % n];
  const dAvant = distance(P, avant);
  const dApres = distance(P, apres);
  if (dAvant < EPS_POINT || dApres < EPS_POINT) return { ok: false, raison: 'colineaire' };
  const f = Math.max(0.05, Math.min(0.5, fraction));
  const m1 = { x: P.x + (avant.x - P.x) * f, y: P.y + (avant.y - P.y) * f };
  const m2 = { x: P.x + (apres.x - P.x) * f, y: P.y + (apres.y - P.y) * f };
  const arc = [];
  for (let s = 0; s <= segments; s += 1) {
    const t = s / segments;
    const u = 1 - t;
    arc.push({
      x: u * u * m1.x + 2 * u * t * P.x + t * t * m2.x,
      y: u * u * m1.y + 2 * u * t * P.y + t * t * m2.y,
    });
  }
  const out = [...paires.slice(0, index), ...arc, ...paires.slice(index + 1)];
  return { ok: true, paires: out };
}

/**
 * Rebase un jeu de paires locales pour que le min soit (0,0) — et rend le décalage
 * d'origine à appliquer au nœud (ROTATION COMPRISE : déplacer l'origine locale de
 * (minX,minY) déplace le nœud du même vecteur TOURNÉ, sinon le tracé saute).
 *
 * @returns {{ points:number[], x:number, y:number, width:number, height:number }}
 */
export function rebaserTrace(obj, paires) {
  const xs = paires.map((p) => p.x);
  const ys = paires.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const rot = Number(obj.rotation) || 0;
  const decal = tournerAutour({ x: minX, y: minY }, { x: 0, y: 0 }, rot);
  return {
    points: paires.flatMap((p) => [p.x - minX, p.y - minY]),
    x: (Number(obj.x) || 0) + decal.x,
    y: (Number(obj.y) || 0) + decal.y,
    width: Math.max(14, maxX - minX),
    height: Math.max(14, maxY - minY),
  };
}

/**
 * Boucle document → objet `line` fermé du modèle (points locaux, boîte englobante).
 * Le style est fourni par l'appelant (cf. stylePeintDeLObjet).
 */
export function boucleVersObjetLine(boucle, { id, style, opacity = 1, layer = 0 } = {}) {
  const xs = boucle.map((p) => p.x);
  const ys = boucle.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    id,
    type: 'line',
    x: minX,
    y: minY,
    width: Math.max(14, Math.max(...xs) - minX),
    height: Math.max(14, Math.max(...ys) - minY),
    rotation: 0,
    layer,
    visible: true,
    locked: false,
    opacity,
    content: { points: boucle.flatMap((p) => [p.x - minX, p.y - minY]), closed: true },
    style: { ...style },
  };
}
