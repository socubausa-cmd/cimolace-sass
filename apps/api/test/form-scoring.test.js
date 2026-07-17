'use strict';
/**
 * Tests unitaires — moteur PUR form-scoring (formulaire → roue + biomarqueurs).
 *   npm run build && node --test test/form-scoring.test.js
 * Convention du repo : CommonJS, node:test, contre la sortie compilée dist/.
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  scoreFormResponsesToWheel,
  extractMeasureBiomarkers,
  WHEEL_DOMAINS,
  DECLARABLE_BIOMARKERS,
} = require('../dist/medos/form-scoring.js');

test('select → map d’un axe', () => {
  const fields = [{ id: 'q1', type: 'select', scoring: [{ axis: 'sleep', map: { bon: 100, moyen: 50, mauvais: 0 } }] }];
  assert.deepStrictEqual(scoreFormResponsesToWheel(fields, { q1: 'moyen' }), [{ domain: 'sleep', score: 50 }]);
});

test('number → range linéaire + invert', () => {
  const fields = [{ id: 'stress', type: 'number', scoring: [{ axis: 'stress', range: { min: 0, max: 10, invert: true } }] }];
  // 8/10 stress, inversé → 20
  assert.deepStrictEqual(scoreFormResponsesToWheel(fields, { stress: 8 }), [{ domain: 'stress', score: 20 }]);
});

test('multi → moyenne des options mappées', () => {
  const fields = [{ id: 'm', type: 'multi', scoring: [{ axis: 'energy', map: { a: 100, b: 0, c: 50 } }] }];
  assert.deepStrictEqual(scoreFormResponsesToWheel(fields, { m: ['a', 'b'] }), [{ domain: 'energy', score: 50 }]);
});

test('agrégation : deux champs sur le même axe → moyenne', () => {
  const fields = [
    { id: 'q1', scoring: [{ axis: 'digestion', map: { oui: 80 } }] },
    { id: 'q2', scoring: [{ axis: 'digestion', map: { oui: 40 } }] },
  ];
  assert.deepStrictEqual(scoreFormResponsesToWheel(fields, { q1: 'oui', q2: 'oui' }), [{ domain: 'digestion', score: 60 }]);
});

test('champ sans scoring ou réponse vide → ignoré (aucun axe fabriqué)', () => {
  const fields = [
    { id: 'plain', type: 'text' },
    { id: 'q', scoring: [{ axis: 'sleep', map: { x: 100 } }] },
  ];
  assert.deepStrictEqual(scoreFormResponsesToWheel(fields, { plain: 'coucou', q: '' }), []);
});

test('axe hors WHEEL_DOMAINS → ignoré', () => {
  const fields = [{ id: 'q', scoring: [{ axis: 'not_an_axis', map: { x: 100 } }] }];
  assert.deepStrictEqual(scoreFormResponsesToWheel(fields, { q: 'x' }), []);
  assert.ok(WHEEL_DOMAINS.length === 12);
});

test('mesure objective whitelistée → biomarqueur extrait', () => {
  const fields = [{ id: 'w', type: 'measure', biomarker_code: 'WEIGHT', unit: 'kg' }];
  assert.deepStrictEqual(extractMeasureBiomarkers(fields, { w: '72.5' }), [{ biomarker_code: 'WEIGHT', value: 72.5, unit: 'kg' }]);
});

test('mesure NON whitelistée (ressenti déguisé) → rejetée', () => {
  const fields = [{ id: 'x', type: 'measure', biomarker_code: 'MOOD_SUBJECTIF' }];
  assert.deepStrictEqual(extractMeasureBiomarkers(fields, { x: 8 }), []);
});

test('mesure non numérique ou ≤ 0 → rejetée ; champ non-measure → ignoré', () => {
  const fields = [
    { id: 'bp', type: 'measure', biomarker_code: 'BP_SYSTOLIC' },
    { id: 'txt', type: 'text', biomarker_code: 'WEIGHT' },
  ];
  assert.deepStrictEqual(extractMeasureBiomarkers(fields, { bp: 'n/a', txt: '99' }), []);
  assert.ok(DECLARABLE_BIOMARKERS.has('BP_SYSTOLIC'));
});
