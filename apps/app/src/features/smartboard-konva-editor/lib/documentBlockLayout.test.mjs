/**
 * Tests documentBlockLayout — exécution : node --test documentBlockLayout.test.mjs
 * Priorité : la normalisation d'insertion (encre lisible, replacement dans le flux)
 * et surtout ce qu'elle ne doit JAMAIS toucher — un point de chute délibéré.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOC_PAGE,
  DOC_INK,
  DOC_INK_SOFT,
  DOC_PAGE_BG,
  ENCRE_DEFAUT_MOTEUR,
  parseCouleur,
  contrasteWCAG,
  encreLisible,
  makeDocumentTextObject,
  normaliserObjetsDocument,
} from './documentBlockLayout.js';

const page = { fondPage: DOC_PAGE_BG, largeurPage: DOC_PAGE.width };

/* Littéraux EXACTS du rail Document (StudioSmartboardKonvaPage.jsx, handleAdd). */
const railTitre = () => ({
  type: 'text', x: 40, y: 60, width: 700, height: 56,
  content: { text: 'Titre H1' },
  style: { fontSize: 36, fill: '#F7F2E8', fontFamily: 'Inter, system-ui, sans-serif' },
});
const railListe = () => ({
  type: 'text', x: 40, y: 100, width: 500, height: 80,
  content: { text: '• Item\n• Item' },
  style: { fontSize: 14, fill: '#F7F2E8', lineHeight: 1.7 },
});

test('parseCouleur lit hex court, hex long et rgba', () => {
  assert.deepEqual(parseCouleur('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseCouleur('#1e293b'), { r: 30, g: 41, b: 59, a: 1 });
  assert.deepEqual(parseCouleur('rgba(217,119,87,0.25)'), { r: 217, g: 119, b: 87, a: 0.25 });
  assert.equal(parseCouleur('linear-gradient(red, blue)'), null);
});

test('contrasteWCAG chiffre bien l’encre du Smartboard sur la page blanche', () => {
  assert.ok(contrasteWCAG('#F7F2E8', '#ffffff') < 1.2); // 1,12:1 — invisible
  assert.ok(contrasteWCAG('#ffffff', '#ffffff') === 1); // plume blanche sur page blanche
  assert.ok(contrasteWCAG(DOC_INK, '#ffffff') > 14);
});

test('contrasteWCAG composite l’alpha sur le fond avant de juger', () => {
  /* Une encre sombre à 10 % d'opacité est illisible même si sa teinte pleine passe. */
  assert.ok(contrasteWCAG('rgba(30,41,59,0.1)', '#ffffff') < 1.5);
});

test('encreLisible : invisible → encre pleine, pâle → encre douce, lisible → intact', () => {
  assert.equal(encreLisible('#F7F2E8'), DOC_INK);
  assert.equal(encreLisible('#a8a29a'), DOC_INK_SOFT); // 2,53:1 : intention « discret » gardée
  assert.equal(encreLisible('#1e293b'), null);
  /* Encre ABSENTE : le moteur peint alors le crème du Smartboard. */
  assert.equal(encreLisible(undefined), DOC_INK);
  assert.equal(encreLisible(ENCRE_DEFAUT_MOTEUR), DOC_INK);
});

test('insertion du rail : encre lisible et bloc replacé dans les marges', () => {
  const [o] = normaliserObjetsDocument([railTitre()], [], page);
  assert.equal(o.style.fill, DOC_INK);
  assert.equal(o.x, DOC_PAGE.marginX);
  assert.equal(o.y, DOC_PAGE.marginTop);
});

test('deux insertions successives ne se recouvrent plus', () => {
  const scene = [];
  const [a] = normaliserObjetsDocument([railTitre()], scene, page);
  scene.push(a);
  const [b] = normaliserObjetsDocument([railListe()], scene, page);
  assert.ok(b.y > a.y + a.height - 1, `le 2e bloc doit passer sous le 1er (a.y=${a.y} b.y=${b.y})`);
});

test('la plume blanche devient lisible sans bouger d’un pixel', () => {
  const trait = {
    type: 'line', x: 300, y: 400, width: 120, height: 40,
    content: { points: [0, 0, 120, 40] }, style: { stroke: '#ffffff', strokeWidth: 2 },
  };
  const [o] = normaliserObjetsDocument([trait], [], page);
  assert.equal(o.style.stroke, DOC_INK);
  assert.equal(o.x, 300);
  assert.equal(o.y, 400);
});

test('⛔ un bloc posé délibérément (glisser-déposer) est renvoyé TEL QUEL', () => {
  const scene = [makeDocumentTextObject({ text: 'déjà là', x: 52, y: 72, width: 690 })];
  const drop = makeDocumentTextObject({ text: 'déposé', x: 317, y: 642, width: 400 });
  const [o] = normaliserObjetsDocument([drop], scene, page);
  assert.equal(o, drop, 'même référence : rien ne doit être recopié ni recalculé');
  assert.equal(o.x, 317);
  assert.equal(o.y, 642);
});

test('⛔ un lot composite garde sa géométrie relative', () => {
  const lot = [
    { type: 'rect', x: 72, y: 100, width: 380, height: 220, style: { fill: 'rgba(218,160,122,0.12)' } },
    { type: 'text', x: 92, y: 118, width: 320, height: 36, content: { text: 'Colonne A' }, style: { fontSize: 22, fill: '#F7F2E8' } },
  ];
  const [cadre, libelle] = normaliserObjetsDocument(lot, [], page);
  assert.equal(cadre.x, 72);
  assert.equal(libelle.x, 92, 'le libellé ne doit pas quitter son cadre');
  assert.equal(libelle.y, 118);
  assert.equal(libelle.style.fill, DOC_INK, 'seule l’encre est corrigée');
});

test('page assombrie par l’utilisateur : l’encre claire est conservée', () => {
  const [o] = normaliserObjetsDocument([railTitre()], [], { fondPage: '#111827', largeurPage: 794 });
  assert.equal(o.style.fill, '#F7F2E8');
});

test('fond « transparent » : on raisonne sur du papier blanc', () => {
  const [o] = normaliserObjetsDocument([railTitre()], [], { fondPage: 'transparent', largeurPage: 794 });
  assert.equal(o.style.fill, DOC_INK);
});

test('hors format page (canvas 1920) : encre corrigée, position intacte', () => {
  const [o] = normaliserObjetsDocument([railTitre()], [], { fondPage: '#ffffff', largeurPage: 1920 });
  assert.equal(o.style.fill, DOC_INK);
  assert.equal(o.x, 40);
  assert.equal(o.y, 60);
});

test('Séparateur : un filet identique au précédent descend dans le flux', () => {
  const hr = () => ({
    type: 'line', x: 52, y: 240, width: 690, height: 2,
    content: { points: [0, 0, 690, 0] }, style: { stroke: '#94a3b8', strokeWidth: 1 },
  });
  const scene = [];
  const [a] = normaliserObjetsDocument([hr()], scene, page);
  scene.push(a);
  const [b] = normaliserObjetsDocument([hr()], scene, page);
  assert.equal(a.y, 240, 'le premier filet ne bouge pas');
  assert.ok(b.y > a.y, `le second doit descendre (a.y=${a.y} b.y=${b.y})`);
  assert.equal(b.x, 52, 'le centrage horizontal reste un choix de mise en page');
  assert.equal(b.width, 690);
});

test('⛔ Séparateur : Fin, Épais, Pointillé, Décoratif s’étagent au lieu de s’empiler', () => {
  // Le défaut mesuré : fin{52,240,690}, epais{52,240,690}, decoratif{237,240,320}
  // tous au même y=240 — l'Épais recouvrait le Fin, impossible à cibler à la souris.
  const filets = [
    { type: 'line', x: 52, y: 240, width: 690, height: 2, content: { points: [0, 0, 690, 0] }, style: { stroke: '#94a3b8', strokeWidth: 1 } },
    { type: 'line', x: 52, y: 240, width: 690, height: 3, content: { points: [0, 0, 690, 0] }, style: { stroke: '#475569', strokeWidth: 3 } },
    { type: 'line', x: 52, y: 240, width: 690, height: 2, content: { points: [0, 0, 690, 0] }, style: { stroke: '#94a3b8', strokeWidth: 1, dash: [6, 5] } },
    { type: 'line', x: 237, y: 240, width: 320, height: 2, content: { points: [0, 0, 320, 0] }, style: { stroke: '#b08968', strokeWidth: 2, dash: [18, 6, 3, 6] } },
  ];
  const scene = [];
  const poses = [];
  for (const filet of filets) {
    const [o] = normaliserObjetsDocument([filet], scene, page);
    scene.push(o);
    poses.push(o);
  }
  assert.equal(new Set(poses.map((o) => o.y)).size, 4, 'quatre ordonnées distinctes');
  for (let i = 1; i < poses.length; i += 1) {
    assert.ok(poses[i].y > poses[i - 1].y + poses[i - 1].height, `filet ${i + 1} au-dessus du ${i}`);
  }
  assert.equal(poses[3].x, 237, 'le décoratif garde son centrage horizontal');
});

test('⛔ un tracé à la plume n’est JAMAIS pris pour un filet du rail', () => {
  // Points nombreux venus du curseur : le point de chute est intouchable, même posé
  // en plein sur un objet existant.
  const plume = {
    type: 'line', x: 52, y: 240, width: 300, height: 40,
    content: { points: [0, 12, 80, 0, 160, 30, 300, 8] }, style: { stroke: '#1e293b', strokeWidth: 2 },
  };
  const scene = [{ type: 'line', x: 52, y: 240, width: 690, height: 2, content: { points: [0, 0, 690, 0] }, style: { stroke: '#94a3b8' } }];
  const [o] = normaliserObjetsDocument([plume], scene, page);
  assert.equal(o.y, 240, 'la plume reste où le geste l’a posée');
});

test('⛔ un filet pâle mais visible garde sa couleur', () => {
  const hr = {
    type: 'line', x: 52, y: 240, width: 690, height: 2,
    content: { points: [0, 0, 690, 0] }, style: { stroke: '#94a3b8', strokeWidth: 1 },
  };
  const [o] = normaliserObjetsDocument([hr], [], page);
  assert.equal(o.style.stroke, '#94a3b8', '2,59:1 sur blanc — un filet, pas du texte');
});
