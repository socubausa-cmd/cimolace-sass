/**
 * Tests d'`echelleCanevasDocument` — les deux défauts mesurés au navigateur
 * le 2026-08-05 sur l'affiche Orabank : [AFF-DPI] (préréglages 3,125× trop petits)
 * et [AFF-EXPORT] (scène 300 dpi remise telle quelle au moteur d'export 96 dpi).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  echelleDuCanevas,
  pageDeReference,
  pxCanevas,
  pointsSurCanevas,
  ramenerAuRepere96,
} from './echelleCanevasDocument.js';

/* ═══════════════════════════════════════════════════════════════════
   Détection de résolution
═══════════════════════════════════════════════════════════════════ */

test('les canevas 96 dpi gardent une échelle de 1 — non-régression stricte', () => {
  assert.equal(echelleDuCanevas(794, 1123), 1, 'Document A4 @96 dpi');
  assert.equal(echelleDuCanevas(1920, 1080), 1, 'Smartboard / Présentation');
  assert.equal(echelleDuCanevas(794, 2246), 1, 'Document A4 de 2 pages empilées');
  assert.equal(echelleDuCanevas(0, 0), 1, 'canevas non mesuré');
});

test('l’Affiche 2480 × 3508 est reconnue comme un A4 à 300 dpi', () => {
  const ref = pageDeReference(2480, 3508);
  assert.ok(ref, 'page de référence trouvée');
  assert.equal(ref.id, 'a4_portrait');
  assert.equal(ref.largeur, 794);
  assert.equal(ref.hauteur, 1123);
  assert.ok(Math.abs(96 * ref.echelle - 300) < 1, `≈300 dpi, lu ${(96 * ref.echelle).toFixed(1)}`);
});

test('A5 ne vole pas la détection à A4 : la tolérance est absolue, pas en pourcentage', () => {
  /* 2480/559 = 4,4365 → A5 prédirait 3 522 px de haut contre 3 508 mesurés (14 px).
     Une tolérance de 1 % (35 px) l'aurait laissé passer. */
  assert.equal(pageDeReference(2480, 3508).id, 'a4_portrait');
});

/* ═══════════════════════════════════════════════════════════════════
   [AFF-DPI] même taille IMPRIMÉE aux deux résolutions
═══════════════════════════════════════════════════════════════════ */

test('un préréglage rend la même taille imprimée à 96 et à 300 dpi', () => {
  const e96 = echelleDuCanevas(794, 1123);
  const e300 = echelleDuCanevas(2480, 3508);

  /* ⚠️ Tolérance 0,15 pt = l'arrondi au pixel entier du canevas. À 300 dpi, ±0,5 px
     valent ±0,12 pt : une égalité stricte serait un test faux, pas un test sévère. */
  for (const px96 of [48, 36, 28, 22, 18, 16, 14, 12, 10]) {
    const a = pointsSurCanevas(pxCanevas(px96, e96), e96);
    const b = pointsSurCanevas(pxCanevas(px96, e300), e300);
    assert.ok(Math.abs(a - b) <= 0.15, `${px96} px96 → ${a.toFixed(2)} pt vs ${b.toFixed(2)} pt`);
  }

  /* ⛔ Le corps de texte est le contrôle qui comptait : 16 px sur un canevas 300 dpi
     valaient 3,8 pt (illisible en presse, plancher usuel 8-9 pt). */
  const corps = pointsSurCanevas(pxCanevas(16, e300), e300);
  assert.ok(corps >= 8, `corps de texte à ${corps.toFixed(2)} pt — plancher 8 pt`);
  assert.equal(pxCanevas(16, e300), 50);
  /* Non-régression : H1 du mode Document reste EXACTEMENT 36 px. */
  assert.equal(pxCanevas(36, e96), 36);
});

test('le gabarit d’image cesse d’être une vignette sur une affiche', () => {
  const e = echelleDuCanevas(2480, 3508);
  const l = pxCanevas(560, e);
  const h = pxCanevas(320, e);
  assert.equal(l, 1749);
  assert.equal(h, 999);
  /* Avant : 560 × 320 sur 2480 × 3508 = 0,8 % de la surface. */
  const part = (l * h) / (2480 * 3508);
  assert.ok(part > 0.15, `${(part * 100).toFixed(1)} % de la page`);
});

/* ═══════════════════════════════════════════════════════════════════
   [AFF-EXPORT] retour au repère 96 dpi
═══════════════════════════════════════════════════════════════════ */

test('ramenerAuRepere96 ne touche à rien quand l’échelle vaut 1', () => {
  const objets = [{ id: 'a', x: 52, y: 180, width: 560, height: 320, style: { fontSize: 36 } }];
  assert.equal(ramenerAuRepere96(objets, 1), objets, 'même référence : zéro copie inutile');
});

test('ramenerAuRepere96 divise la géométrie ET les grandeurs en pixels du style', () => {
  const source = {
    id: 'a', type: 'text', x: 250, y: 375, width: 1750, height: 1000, rotation: 12, opacity: 0.5,
    style: { fontSize: 150, letterSpacing: 3, strokeWidth: 6, cornerRadius: 18, lineHeight: 1.15, dash: [24, 18] },
    content: { points: [0, 0, 625, 0], crop: { x: 10, y: 10, width: 80, height: 60 } },
  };
  const [o] = ramenerAuRepere96([source], 3.125);

  assert.equal(o.x, 80);
  assert.equal(o.y, 120);
  assert.equal(o.width, 560);
  assert.equal(o.style.fontSize, 48);
  assert.equal(o.style.strokeWidth, 1.92);
  assert.deepEqual(o.style.dash, [7.68, 5.76]);
  assert.deepEqual(o.content.points, [0, 0, 200, 0]);

  /* Sans unité ou sans rapport au canevas : intouchés. */
  assert.equal(o.rotation, 12);
  assert.equal(o.opacity, 0.5);
  assert.equal(o.style.lineHeight, 1.15);
  /* ⛔ `crop` est en pixels de l'image SOURCE (contrainte Konva) : le diviser
     recadrerait une zone qui n'existe pas. */
  assert.deepEqual(o.content.crop, { x: 10, y: 10, width: 80, height: 60 });

  /* NE MUTE RIEN. */
  assert.equal(source.x, 250);
  assert.equal(source.style.fontSize, 150);
});

test('l’identifiant survit au changement de repère (resoudreImages le cherche)', () => {
  const [o] = ramenerAuRepere96([{ id: 'img-1', type: 'image', x: 312, y: 375, width: 1749, height: 999, content: { src: 'data:image/png;base64,AA' } }], 3.1234);
  assert.equal(o.id, 'img-1');
  assert.equal(o.content.src, 'data:image/png;base64,AA');
});
