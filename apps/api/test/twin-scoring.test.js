'use strict';
/**
 * Tests unitaires — TwinScoringService (moteur de scoring DÉTERMINISTE v1).
 * Runner node:test (zéro dépendance), cible le code compilé `dist/`.
 *
 *   npm run build && npm run test:unit      (depuis apps/api)
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { TwinScoringService } = require('../dist/medos/twin/twin-scoring.service.js');

function ref(p) {
  return Object.assign(
    {
      name_fr: p.code,
      category: 'metabolic',
      dimension: 'metabolism',
      unit: 'u',
      optimal_low: null,
      optimal_high: null,
      lab_low: null,
      lab_high: null,
      organs: [],
      higher_is_worse: true,
      associated_symptoms: [],
    },
    p,
  );
}

const svc = new TwinScoringService();

const CRP = ref({ code: 'CRP_HS', optimal_low: 0, optimal_high: 1, lab_low: 0, lab_high: 5 });
const HDL = ref({ code: 'HDL', optimal_low: 60, optimal_high: 90, lab_low: 40, lab_high: 200, higher_is_worse: false });

test('computeFlag — normal inside optimal', () => {
  assert.equal(svc.computeFlag(CRP, 0.5), 'normal');
});
test('computeFlag — high above optimal, inside lab', () => {
  assert.equal(svc.computeFlag(CRP, 3), 'high');
});
test('computeFlag — critical above lab range', () => {
  assert.equal(svc.computeFlag(CRP, 12), 'critical');
});
test('computeFlag — low below optimal', () => {
  assert.equal(svc.computeFlag(HDL, 50), 'low');
});
test('computeFlag — critical below lab range', () => {
  assert.equal(svc.computeFlag(HDL, 30), 'critical');
});
test('computeFlag — missing ranges => normal', () => {
  assert.equal(svc.computeFlag(ref({ code: 'X' }), 999), 'normal');
});

test('scoreColor — thresholds', () => {
  assert.equal(svc.scoreColor(100), 'green');
  assert.equal(svc.scoreColor(80), 'green');
  assert.equal(svc.scoreColor(79), 'yellow');
  assert.equal(svc.scoreColor(60), 'yellow');
  assert.equal(svc.scoreColor(59), 'orange');
  assert.equal(svc.scoreColor(40), 'orange');
  assert.equal(svc.scoreColor(39), 'red');
});

const refs = [
  ref({ code: 'ALT', organs: ['liver'], optimal_low: 10, optimal_high: 25, lab_low: 7, lab_high: 56, dimension: 'toxicity' }),
  ref({ code: 'GGT', organs: ['liver'], optimal_low: 10, optimal_high: 25, lab_low: 8, lab_high: 61, dimension: 'toxicity' }),
  ref({ code: 'TSH', organs: ['thyroid'], optimal_low: 1, optimal_high: 2, lab_low: 0.4, lab_high: 4, dimension: 'hormones' }),
];

test('computeOrganScore — healthy organ => 100/green', () => {
  const s = svc.computeOrganScore('liver', refs, [
    { biomarker_code: 'ALT', value: 18 },
    { biomarker_code: 'GGT', value: 15 },
  ]);
  assert.ok(s);
  assert.equal(s.score, 100);
  assert.equal(s.color, 'green');
  assert.equal(s.contributing_biomarkers.length, 2);
});

test('computeOrganScore — mild penalty', () => {
  const s = svc.computeOrganScore('liver', refs, [
    { biomarker_code: 'ALT', value: 40 },
    { biomarker_code: 'GGT', value: 15 },
  ]);
  assert.equal(s.score, 88);
});

test('computeOrganScore — critical markers => orange', () => {
  const s = svc.computeOrganScore('liver', refs, [
    { biomarker_code: 'ALT', value: 200 },
    { biomarker_code: 'GGT', value: 100 },
  ]);
  assert.equal(s.score, 40);
  assert.equal(s.color, 'orange');
});

test('computeOrganScore — no data => null', () => {
  assert.equal(svc.computeOrganScore('kidneys', refs, []), null);
});

test('computeOrganScore — dimension subscore', () => {
  const s = svc.computeOrganScore('liver', refs, [{ biomarker_code: 'ALT', value: 40 }]);
  assert.equal(s.dimensions.toxicity, 88);
});

test('detectAlerts — metabolic syndrome', () => {
  const r = [
    ref({ code: 'HOMA_IR', optimal_low: 0.5, optimal_high: 1.5, lab_low: 0, lab_high: 2.5 }),
    ref({ code: 'TRIGLYCERIDES', optimal_low: 40, optimal_high: 90, lab_low: 0, lab_high: 150 }),
    ref({ code: 'HDL', optimal_low: 60, optimal_high: 90, lab_low: 40, lab_high: 200, higher_is_worse: false }),
  ];
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'HOMA_IR', value: 2.2 },
    { biomarker_code: 'TRIGLYCERIDES', value: 130 },
    { biomarker_code: 'HDL', value: 45 },
  ]);
  assert.ok(alerts.some((a) => a.kind === 'metabolic_syndrome'));
});

test('detectAlerts — chronic inflammation', () => {
  const r = [
    ref({ code: 'CRP_HS', optimal_low: 0, optimal_high: 1, lab_low: 0, lab_high: 5 }),
    ref({ code: 'FERRITIN', optimal_low: 50, optimal_high: 120, lab_low: 30, lab_high: 300 }),
  ];
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'CRP_HS', value: 3 },
    { biomarker_code: 'FERRITIN', value: 200 },
  ]);
  assert.ok(alerts.some((a) => a.kind === 'chronic_inflammation'));
});

test('detectAlerts — healthy profile => none', () => {
  const r = [
    ref({ code: 'CRP_HS', optimal_low: 0, optimal_high: 1, lab_low: 0, lab_high: 5 }),
    ref({ code: 'VIT_D', optimal_low: 40, optimal_high: 60, lab_low: 30, lab_high: 100, higher_is_worse: false }),
  ];
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'CRP_HS', value: 0.4 },
    { biomarker_code: 'VIT_D', value: 50 },
  ]);
  assert.equal(alerts.length, 0);
});
