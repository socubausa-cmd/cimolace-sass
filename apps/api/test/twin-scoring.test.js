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

// ─── Règles étendues (référentiel v2 — 144 codes additionnels) ─────────────

test('detectAlerts — cardiac_risk (NT_PROBNP critique)', () => {
  const r = [ref({ code: 'NT_PROBNP', optimal_low: 0, optimal_high: 125, lab_low: 0, lab_high: 300 })];
  const alerts = svc.detectAlerts(r, [{ biomarker_code: 'NT_PROBNP', value: 800 }]);
  const a = alerts.find((x) => x.kind === 'cardiac_risk');
  assert.ok(a, 'cardiac_risk alert missing');
  assert.equal(a.severity, 'critical');
});

test('detectAlerts — methylation_block (homocystéine + MMA)', () => {
  const r = [
    ref({ code: 'HOMOCYSTEINE', optimal_low: 5, optimal_high: 7, lab_low: 5, lab_high: 15 }),
    ref({ code: 'MMA', optimal_low: 0, optimal_high: 250, lab_low: 0, lab_high: 400 }),
  ];
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'HOMOCYSTEINE', value: 12 },
    { biomarker_code: 'MMA', value: 350 },
  ]);
  assert.ok(alerts.some((a) => a.kind === 'methylation_block'));
});

test('detectAlerts — gut_permeability (zonuline + calprotectine)', () => {
  const r = [
    ref({ code: 'ZONULIN', optimal_low: 0, optimal_high: 50, lab_low: 0, lab_high: 100 }),
    ref({ code: 'CALPROTECTIN', optimal_low: 0, optimal_high: 50, lab_low: 0, lab_high: 150 }),
  ];
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'ZONULIN', value: 80 },
    { biomarker_code: 'CALPROTECTIN', value: 120 },
  ]);
  assert.ok(alerts.some((a) => a.kind === 'gut_permeability'));
});

test('detectAlerts — oxidative_stress_high (attaque + défenses)', () => {
  const r = [
    ref({ code: 'MDA', optimal_low: 0, optimal_high: 1, lab_low: 0, lab_high: 2 }),
    ref({ code: 'GSH', optimal_low: 600, optimal_high: 900, lab_low: 500, lab_high: 1200, higher_is_worse: false }),
  ];
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'MDA', value: 1.5 },
    { biomarker_code: 'GSH', value: 400 },
  ]);
  assert.ok(alerts.some((a) => a.kind === 'oxidative_stress_high'));
});

test('detectAlerts — thyroid_autoimmune (Hashimoto pattern)', () => {
  const r = [
    ref({ code: 'ANTI_TPO', optimal_low: 0, optimal_high: 15, lab_low: 0, lab_high: 34 }),
    ref({ code: 'TSH', optimal_low: 1, optimal_high: 2, lab_low: 0.4, lab_high: 4 }),
  ];
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'ANTI_TPO', value: 80 },
    { biomarker_code: 'TSH', value: 5.5 },
  ]);
  const a = alerts.find((x) => x.kind === 'thyroid_autoimmune');
  assert.ok(a, 'thyroid_autoimmune alert missing');
  assert.equal(a.severity, 'critical');
});

test('detectAlerts — cortisol_dysregulation (pattern inversé)', () => {
  const r = [
    ref({ code: 'CORTISOL_AM', optimal_low: 10, optimal_high: 18, lab_low: 6, lab_high: 23 }),
    ref({ code: 'CORTISOL_PM', optimal_low: 0, optimal_high: 5, lab_low: 0, lab_high: 8 }),
  ];
  // AM 12 (normal) + PM 10 (haut, ratio 0.83 > 0.6) => alerte
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'CORTISOL_AM', value: 12 },
    { biomarker_code: 'CORTISOL_PM', value: 10 },
  ]);
  assert.ok(alerts.some((a) => a.kind === 'cortisol_dysregulation'));
});

test('detectAlerts — insulin_resistance_advanced (HOMA-IR + adipocytokines)', () => {
  const r = [
    ref({ code: 'HOMA_IR', optimal_low: 0.5, optimal_high: 1.5, lab_low: 0, lab_high: 2.5 }),
    ref({ code: 'LEPTIN', optimal_low: 2, optimal_high: 10, lab_low: 1, lab_high: 25 }),
    ref({ code: 'ADIPONECTIN', optimal_low: 10, optimal_high: 25, lab_low: 4, lab_high: 30, higher_is_worse: false }),
  ];
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'HOMA_IR', value: 3.5 },
    { biomarker_code: 'LEPTIN', value: 30 },
    { biomarker_code: 'ADIPONECTIN', value: 3 },
  ]);
  assert.ok(alerts.some((a) => a.kind === 'insulin_resistance_advanced'));
});

test('detectAlerts — electrolyte_imbalance (2+ ions hors plage)', () => {
  const r = [
    ref({ code: 'POTASSIUM', optimal_low: 3.5, optimal_high: 4.5, lab_low: 3, lab_high: 5 }),
    ref({ code: 'SODIUM', optimal_low: 138, optimal_high: 142, lab_low: 132, lab_high: 148 }),
  ];
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'POTASSIUM', value: 2.5 },
    { biomarker_code: 'SODIUM', value: 150 },
  ]);
  const a = alerts.find((x) => x.kind === 'electrolyte_imbalance');
  assert.ok(a);
  assert.equal(a.severity, 'critical');
});

test('detectAlerts — liver_strain (3 enzymes hépatiques ↑)', () => {
  const r = [
    ref({ code: 'ALT', optimal_low: 10, optimal_high: 25, lab_low: 7, lab_high: 56 }),
    ref({ code: 'AST', optimal_low: 10, optimal_high: 25, lab_low: 8, lab_high: 40 }),
    ref({ code: 'GGT', optimal_low: 10, optimal_high: 25, lab_low: 8, lab_high: 61 }),
  ];
  const alerts = svc.detectAlerts(r, [
    { biomarker_code: 'ALT', value: 45 },
    { biomarker_code: 'AST', value: 35 },
    { biomarker_code: 'GGT', value: 50 },
  ]);
  const a = alerts.find((x) => x.kind === 'liver_strain');
  assert.ok(a);
  assert.equal(a.severity, 'warning');
});
