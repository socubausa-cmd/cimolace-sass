'use strict';
/**
 * Tests unitaires — TwinSimulationService (simulateur d'intervention DÉTERMINISTE).
 *   npm run build && node --test test/twin-simulation.test.js
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { TwinScoringService } = require('../dist/medos/twin/twin-scoring.service.js');
const { TwinSimulationService } = require('../dist/medos/twin/twin-simulation.service.js');

function ref(p) {
  return Object.assign(
    { name_fr: p.code, category: 'metabolic', dimension: 'metabolism', unit: 'u',
      optimal_low: null, optimal_high: null, lab_low: null, lab_high: null,
      organs: [], higher_is_worse: true, associated_symptoms: [] }, p);
}

const scoring = new TwinScoringService();
const sim = new TwinSimulationService(scoring);

const refs = [
  ref({ code: 'HOMA_IR', organs: ['pancreas'], dimension: 'metabolism', optimal_low: 0.5, optimal_high: 1.5, lab_low: 0, lab_high: 2.5 }),
  ref({ code: 'CRP_HS', organs: ['immune'], dimension: 'inflammation', optimal_low: 0, optimal_high: 1, lab_low: 0, lab_high: 5 }),
];

test('applyInterventions moves targeted biomarker toward optimal', () => {
  const adjusted = sim.applyInterventions(refs, [{ biomarker_code: 'HOMA_IR', value: 2.2 }], ['glycemic']);
  const v = adjusted.find((x) => x.biomarker_code === 'HOMA_IR').value;
  assert.ok(v < 2.2, 'value should decrease toward optimal');
  assert.ok(v > 1.0, 'value should not overshoot below optimal mid');
});

test('non-targeted intervention leaves value unchanged', () => {
  const adjusted = sim.applyInterventions(refs, [{ biomarker_code: 'CRP_HS', value: 4 }], ['glycemic']);
  // glycemic targets metabolism dimension, CRP is inflammation → unchanged
  assert.equal(adjusted.find((x) => x.biomarker_code === 'CRP_HS').value, 4);
});

test('antiinflammatory improves inflammation dimension', () => {
  const adjusted = sim.applyInterventions(refs, [{ biomarker_code: 'CRP_HS', value: 4 }], ['antiinflammatory']);
  assert.ok(adjusted.find((x) => x.biomarker_code === 'CRP_HS').value < 4);
});

test('simulate returns before/after with non-negative organ deltas for relevant intervention', () => {
  const result = sim.simulate(['pancreas', 'immune'], refs, [
    { biomarker_code: 'HOMA_IR', value: 2.2 },
    { biomarker_code: 'CRP_HS', value: 4 },
  ], ['glycemic', 'antiinflammatory']);
  assert.ok(Array.isArray(result.before));
  assert.ok(Array.isArray(result.after));
  // Every organ score should improve or stay equal under improving interventions.
  for (const d of result.organ_deltas) {
    assert.ok(d.delta >= 0, `organ ${d.organ_code} delta should be >= 0`);
  }
});
