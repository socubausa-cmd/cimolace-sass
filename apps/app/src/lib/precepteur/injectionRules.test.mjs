/**
 * Test déterministe de l'atelier d'analyse (brique A). Aucune dépendance : `node --test`.
 *   node --test apps/app/src/lib/precepteur/injectionRules.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planInjections, classifySegment } from './injectionRules.js';

const devices = (t, o) => planInjections(t, o).map((d) => d.device);

test('déterministe : même entrée → même plan', () => {
  const t = 'Quand deux corps entrent en contact, ce qui provoque un déséquilibre.';
  assert.deepEqual(planInjections(t), planInjections(t));
});

test('définition → surlignage + encadre', () => {
  const p = devices('On appelle «énergie» la capacité à produire un travail.');
  assert.ok(p.includes('surlignage'), 'surlignage attendu');
  assert.ok(p.includes('encadre'), 'encadre attendu');
});

test('phénomène concret → image_analogie, PAS de croquis', () => {
  const p = devices('Par exemple, dans la nature, on observe la spirale dans les coquillages.');
  assert.ok(p.includes('image_analogie'));
  assert.ok(!p.includes('croquis'));
});

test('formule → encadre + croquis (couleur-codé)', () => {
  const p = devices('Le calcul 7 × 9 = 63 se décompose en produits croisés.');
  assert.ok(p.includes('encadre'));
  assert.ok(p.includes('croquis'));
});

test('énumération / key_points → resume_encadre', () => {
  const p = devices('Il existe plusieurs types de matériaux.', {
    key_points: ['conducteurs', 'isolants', 'semi-conducteurs'],
  });
  assert.ok(p.includes('resume_encadre'));
});

test('1 idée = 1 croquis (jamais 2)', () => {
  const p = devices('Le calcul 7 × 9 = 63 crée une relation, un mécanisme, une force.');
  assert.ok(p.filter((d) => d === 'croquis').length <= 1);
});

test('toujours une lecon en premier', () => {
  for (const t of ['blabla', 'On appelle X', '3 + 5 = 8']) {
    assert.equal(devices(t)[0], 'lecon');
  }
});

test('classifySegment infère l\'abstraction (relation sans phénomène)', () => {
  const c = classifySegment('La force est proportionnelle à la masse.');
  assert.equal(c.isAbstract, true);
});
