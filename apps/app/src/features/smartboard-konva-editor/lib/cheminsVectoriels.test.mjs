/**
 * Tests cheminsVectoriels — exécution : node --test cheminsVectoriels.test.mjs
 * Priorité : les booléens rendent les VRAIS contours (cas mesurés rect+cercle de
 * l'escouade), et refusent proprement plutôt que de produire un polygone faux.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contourDeLObjet,
  estOperableBooleen,
  airePolygone,
  pointDansPolygone,
  unionDePolygones,
  intersectionDePolygones,
  soustractionDePolygones,
  divisionDePolygones,
  pairesDuTrace,
  projeterSurTrace,
  arrondirCoinTrace,
  rebaserTrace,
  boucleVersObjetLine,
  localVersDocTrace,
  docVersLocalTrace,
  stylePeintDeLObjet,
} from './cheminsVectoriels.js';

/* ── Gabarits : la paire MESURÉE par l'escouade ── */
const rect = { type: 'rect', x: 500, y: 300, width: 160, height: 130, style: {} };
const cercle = { type: 'circle', x: 580, y: 360, width: 120, height: 120, style: {} };
const RAYON = 60;
const CENTRE = { x: 640, y: 420 };

const aireAbs = (polys) => polys.reduce((s, p) => s + Math.abs(airePolygone(p)), 0);
const dansUn = (polys, pt) => polys.some((p) => pointDansPolygone(pt, p));

test('estOperableBooleen : formes oui, texte/image/flèche non', () => {
  assert.equal(estOperableBooleen(rect).ok, true);
  assert.equal(estOperableBooleen(cercle).ok, true);
  assert.deepEqual(estOperableBooleen({ type: 'text' }), { ok: false, raison: 'type' });
  assert.deepEqual(estOperableBooleen({ type: 'image' }), { ok: false, raison: 'type' });
  assert.deepEqual(estOperableBooleen({ type: 'arrow' }), { ok: false, raison: 'type' });
  assert.deepEqual(
    estOperableBooleen({ type: 'line', content: { points: [0, 0, 10, 10] } }),
    { ok: false, raison: 'ligne_plate' },
  );
  assert.equal(estOperableBooleen({ type: 'line', content: { points: [0, 0, 10, 0, 10, 10] } }).ok, true);
});

test('contour rect : quatre coins exacts', () => {
  const c = contourDeLObjet(rect);
  assert.deepEqual(c, [
    { x: 500, y: 300 },
    { x: 660, y: 300 },
    { x: 660, y: 430 },
    { x: 500, y: 430 },
  ]);
});

test('contour cercle : rayon constant, aire proche de πr²', () => {
  const c = contourDeLObjet(cercle);
  for (const p of c) {
    assert.ok(Math.abs(Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y) - RAYON) < 1e-9);
  }
  const aire = Math.abs(airePolygone(c));
  assert.ok(Math.abs(aire - Math.PI * RAYON * RAYON) / (Math.PI * RAYON * RAYON) < 0.01);
});

test('contour line : translation + fermeture implicite', () => {
  const l = { type: 'line', x: 10, y: 20, rotation: 0, content: { points: [0, 0, 40, 0, 40, 30] } };
  assert.deepEqual(contourDeLObjet(l), [
    { x: 10, y: 20 },
    { x: 50, y: 20 },
    { x: 50, y: 50 },
  ]);
});

test('contour rect tourné : pivote autour de (x,y) comme Konva', () => {
  const r = { type: 'rect', x: 100, y: 100, width: 40, height: 20, rotation: 90, style: {} };
  const c = contourDeLObjet(r);
  assert.ok(Math.hypot(c[0].x - 100, c[0].y - 100) < 1e-9); // l'origine ne bouge pas
  assert.ok(Math.hypot(c[1].x - 100, c[1].y - 140) < 1e-9); // (140,100) → (100,140)
});

test('union rect+cercle : un seul chemin, aire = A + B − recouvrement, coins gardés', () => {
  const A = contourDeLObjet(rect);
  const B = contourDeLObjet(cercle);
  const r = unionDePolygones(A, B);
  assert.equal(r.ok, true);
  assert.equal(r.polygones.length, 1);
  const aire = aireAbs(r.polygones);
  const aireA = aireAbs([A]);
  const aireB = aireAbs([B]);
  const inter = intersectionDePolygones(A, B);
  assert.equal(inter.ok, true);
  assert.ok(Math.abs(aire - (aireA + aireB - aireAbs(inter.polygones))) < 1.0);
  /* Le contour circulaire NE disparaît PLUS : un point du croissant du cercle est dedans. */
  assert.ok(dansUn(r.polygones, { x: 690, y: 420 }));
  /* Un coin du rect reste dedans, un point hors des deux reste dehors. */
  assert.ok(dansUn(r.polygones, { x: 505, y: 305 }));
  assert.ok(!dansUn(r.polygones, { x: 700, y: 300 }));
});

test('intersection rect+cercle : jamais un point hors du cercle (défaut bbox mesuré)', () => {
  const A = contourDeLObjet(rect);
  const B = contourDeLObjet(cercle);
  const r = intersectionDePolygones(A, B);
  assert.equal(r.ok, true);
  for (const poly of r.polygones) {
    for (const p of poly) {
      assert.ok(Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y) <= RAYON + 0.5);
      assert.ok(p.x >= 500 - 0.5 && p.x <= 660 + 0.5 && p.y >= 300 - 0.5 && p.y <= 430 + 0.5);
    }
  }
  /* Le coin (580,360) de l'ex-« intersection des boîtes » est HORS du cercle (à 84,9
     du centre pour un rayon de 60) : il ne doit PLUS faire partie du résultat. */
  assert.ok(!dansUn(r.polygones, { x: 582, y: 362 }));
  /* Un point réellement commun est dedans. */
  assert.ok(dansUn(r.polygones, { x: 620, y: 400 }));
});

test('soustraction rect − cercle : le rect est ENTAILLÉ, pas supprimé', () => {
  const A = contourDeLObjet(rect);
  const B = contourDeLObjet(cercle);
  const r = soustractionDePolygones(A, B);
  assert.equal(r.ok, true);
  const inter = intersectionDePolygones(A, B);
  assert.ok(Math.abs(aireAbs(r.polygones) - (aireAbs([A]) - aireAbs(inter.polygones))) < 1.0);
  assert.ok(dansUn(r.polygones, { x: 505, y: 305 })); // coin du rect loin du cercle
  assert.ok(!dansUn(r.polygones, { x: 630, y: 410 })); // zone mordue par le cercle
});

test('division rect+cercle : communs + restes, aires qui se recollent', () => {
  const A = contourDeLObjet(rect);
  const B = contourDeLObjet(cercle);
  const d = divisionDePolygones(A, B);
  assert.equal(d.ok, true);
  assert.ok(d.communs.length >= 1);
  assert.ok(d.restesA.length >= 1);
  assert.ok(d.restesB.length >= 1);
  const total = aireAbs(d.communs) + aireAbs(d.restesA) + aireAbs(d.restesB);
  const union = unionDePolygones(A, B);
  assert.ok(Math.abs(total - aireAbs(union.polygones)) < 1.5);
});

test('contenance sans croisement : union→englobant, intersection→contenu, soustraction→trou refusé', () => {
  const grand = contourDeLObjet({ type: 'rect', x: 0, y: 0, width: 400, height: 400, style: {} });
  const petit = contourDeLObjet({ type: 'circle', x: 150, y: 150, width: 100, height: 100, style: {} });
  assert.deepEqual(unionDePolygones(grand, petit), { ok: true, polygones: [grand] });
  assert.deepEqual(intersectionDePolygones(grand, petit), { ok: true, polygones: [petit] });
  assert.deepEqual(soustractionDePolygones(grand, petit), { ok: false, raison: 'trou' });
  assert.deepEqual(soustractionDePolygones(petit, grand), { ok: false, raison: 'vide' });
});

test('formes disjointes : union/intersection refusées, soustraction = A intact', () => {
  const A = contourDeLObjet({ type: 'rect', x: 0, y: 0, width: 50, height: 50, style: {} });
  const B = contourDeLObjet({ type: 'rect', x: 200, y: 200, width: 50, height: 50, style: {} });
  assert.deepEqual(unionDePolygones(A, B), { ok: false, raison: 'disjointes' });
  assert.deepEqual(intersectionDePolygones(A, B), { ok: false, raison: 'disjointes' });
  assert.deepEqual(soustractionDePolygones(A, B), { ok: true, polygones: [A] });
});

test('deux rects en croix : soustraction en DEUX morceaux', () => {
  const A = contourDeLObjet({ type: 'rect', x: 0, y: 40, width: 200, height: 20, style: {} });
  const B = contourDeLObjet({ type: 'rect', x: 90, y: 0, width: 20, height: 100, style: {} });
  const r = soustractionDePolygones(A, B);
  assert.equal(r.ok, true);
  assert.equal(r.polygones.length, 2);
  assert.ok(Math.abs(aireAbs(r.polygones) - (200 * 20 - 20 * 20)) < 0.5);
});

test('cas dégénéré (bords confondus partiels) : refus propre, jamais un résultat faux', () => {
  const A = contourDeLObjet({ type: 'rect', x: 0, y: 0, width: 100, height: 100, style: {} });
  const B = contourDeLObjet({ type: 'rect', x: 100, y: 20, width: 80, height: 60, style: {} });
  const r = unionDePolygones(A, B); // simple contact d'arête, aucune surface commune
  if (r.ok) {
    /* S'il accepte, l'aire doit être EXACTE (les deux rects, rien inventé). */
    assert.ok(Math.abs(aireAbs(r.polygones) - (100 * 100 + 80 * 60)) < 1.0);
  } else {
    assert.ok(['disjointes', 'couture', 'vide'].includes(r.raison));
  }
});

test('pairesDuTrace / projeterSurTrace : projection au plus près, index d’insertion', () => {
  const paires = pairesDuTrace([0, 0, 100, 0, 100, 80]);
  assert.equal(paires.length, 3);
  const p = projeterSurTrace(paires, { x: 50, y: 6 });
  assert.equal(p.index, 0);
  assert.ok(Math.abs(p.point.x - 50) < 1e-9 && Math.abs(p.point.y) < 1e-9);
  assert.ok(Math.abs(p.distance - 6) < 1e-9);
  const q = projeterSurTrace(paires, { x: 104, y: 40 });
  assert.equal(q.index, 1);
});

test('arrondirCoinTrace : le coin devient une courbe qui passe PRÈS du coin, extrémités refusées', () => {
  const paires = pairesDuTrace([0, 0, 100, 0, 100, 100]);
  const refus = arrondirCoinTrace(paires, 0);
  assert.deepEqual(refus, { ok: false, raison: 'extremite' });
  const r = arrondirCoinTrace(paires, 1, { segments: 8 });
  assert.equal(r.ok, true);
  assert.equal(r.paires.length, 2 + 9); // 2 extrémités + 9 échantillons
  /* La courbe reste dans le coin : x ≤ 100, y ≥ 0, et s'écarte du sommet (100,0). */
  for (const p of r.paires) assert.ok(p.x <= 100 + 1e-9 && p.y >= -1e-9);
  const sommet = r.paires.some((p) => Math.hypot(p.x - 100, p.y) < 1e-6);
  assert.equal(sommet, false);
});

test('rebaserTrace : min → (0,0), origine compensée rotation comprise', () => {
  const obj = { x: 10, y: 20, rotation: 0 };
  const r = rebaserTrace(obj, [{ x: -5, y: 3 }, { x: 45, y: 33 }, { x: 20, y: -7 }]);
  assert.deepEqual(r.points, [0, 10, 50, 40, 25, 0]);
  assert.equal(r.x, 5);
  assert.equal(r.y, 13);
  assert.equal(r.width, 50);
  assert.equal(r.height, 40);
  /* Rotation 90° : le décalage local (-5,-7) doit être TOURNÉ avant d'être appliqué. */
  const rot = rebaserTrace({ x: 0, y: 0, rotation: 90 }, [{ x: -5, y: -7 }, { x: 5, y: 7 }]);
  assert.ok(Math.abs(rot.x - 7) < 1e-9 && Math.abs(rot.y - -5) < 1e-9);
});

test('localVersDocTrace / docVersLocalTrace : aller-retour stable avec rotation', () => {
  const obj = { x: 100, y: 50, rotation: 30 };
  const local = { x: 40, y: 10 };
  const doc = localVersDocTrace(obj, local);
  const retour = docVersLocalTrace(obj, doc);
  assert.ok(Math.abs(retour.x - local.x) < 1e-9 && Math.abs(retour.y - local.y) < 1e-9);
});

test('boucleVersObjetLine : boîte englobante et points relatifs fermés', () => {
  const o = boucleVersObjetLine(
    [{ x: 30, y: 40 }, { x: 90, y: 40 }, { x: 90, y: 120 }],
    { id: 'line_test', style: { fill: '#123456' }, opacity: 0.8, layer: 2 },
  );
  assert.equal(o.type, 'line');
  assert.equal(o.x, 30);
  assert.equal(o.y, 40);
  assert.equal(o.width, 60);
  assert.equal(o.height, 80);
  assert.equal(o.content.closed, true);
  assert.deepEqual(o.content.points, [0, 0, 60, 0, 60, 80]);
  assert.equal(o.opacity, 0.8);
});

test('stylePeintDeLObjet : reprend les DÉFAUTS du rendu, pas un style inventé', () => {
  assert.equal(stylePeintDeLObjet({ type: 'circle', style: {} }).fill, 'rgba(96,165,250,0.2)');
  assert.equal(stylePeintDeLObjet({ type: 'rect', style: { fill: '#fff' } }).fill, '#fff');
  const l = stylePeintDeLObjet({ type: 'line', style: {} });
  assert.equal(l.stroke, '#94a3b8');
  assert.equal(l.fill, undefined);
});
