'use strict';
/**
 * Tests unitaires — TwinProjectionService (projection temporelle DÉTERMINISTE).
 *   npm run build && node --test test/twin-projection.test.js
 *
 * Convention du repo : CommonJS, node:test, instanciation directe (pas de DI
 * NestJS, pas de @nestjs/testing — qui n'est pas une dépendance ici), tests
 * exécutés contre la sortie compilée dist/.
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const {
  TwinProjectionService,
  PROJECTION_DISCLAIMER,
  PROJECTION_VERSION,
  SCENARIOS,
  DEFAULT_COHORT_AGE,
  COHORT_LE,
} = require('../dist/medos/twin/twin-projection.service.js');

const svc = new TwinProjectionService();

// ── Fixtures ────────────────────────────────────────────────────────────────
// Un organe « moyen/dégradé » porteur des 6 dimensions du scoring.
function organ(code, score, dims) {
  return {
    organ_code: code,
    score,
    color: score >= 80 ? 'green' : score >= 60 ? 'yellow' : score >= 40 ? 'orange' : 'red',
    dimensions: dims || {},
    contributing_biomarkers: [],
    confidence: 0.5,
  };
}

const ORGANS_DEGRADED = [
  organ('pancreas', 45, { metabolism: 40, inflammation: 50 }),
  organ('liver', 55, { toxicity: 50, oxidative_stress: 60 }),
  organ('thyroid', 60, { hormones: 55, cellular_energy: 58 }),
];

// Roue « mauvaise » sur tous les axes utilisés par les pénalités.
const WHEEL_BAD = [
  { domain: 'environment', score: 30 },
  { domain: 'metabolism', score: 35 },
  { domain: 'digestion', score: 40 },
  { domain: 'physical_activity', score: 30 },
  { domain: 'sleep', score: 35 },
  { domain: 'stress', score: 40 },
  { domain: 'inflammation', score: 30 },
  { domain: 'energy', score: 45 },
  { domain: 'immunity', score: 50 },
  { domain: 'hormones', score: 55 },
  { domain: 'cognition', score: 60 },
  { domain: 'emotions', score: 50 },
];

const ALL_KEYS = SCENARIOS.map((s) => s.key);

function baseInput(over) {
  return Object.assign(
    {
      age: 52,
      sex: 'male',
      organScores: ORGANS_DEGRADED,
      wheel: WHEEL_BAD,
      biomarkerCount: 12,
      horizonsYears: [1, 5, 10, 20],
      scenarioKeys: ALL_KEYS,
      horizonFocus: 20,
    },
    over || {},
  );
}

// Récursivement : tout nombre dans l'objet est fini (jamais NaN / Infinity).
function assertNoNaN(node, path) {
  path = path || '$';
  if (typeof node === 'number') {
    assert.ok(Number.isFinite(node), `${path} doit être fini, reçu ${node}`);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => assertNoNaN(v, `${path}[${i}]`));
    return;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) assertNoNaN(node[k], `${path}.${k}`);
  }
}

// ── 1. Déterminisme ───────────────────────────────────────────────────────
test('même entrée → sortie identique (déterminisme)', () => {
  const a = svc.project(baseInput());
  const b = svc.project(baseInput());
  assert.deepStrictEqual(a, b);
});

// ── 2. Aucun NaN / Infinity dans toute la réponse ──────────────────────────
test('aucun NaN/Infinity nulle part dans la réponse', () => {
  assertNoNaN(svc.project(baseInput()));
  // Entrées extrêmes : roue vide, pas d'organe, pas d'âge.
  assertNoNaN(
    svc.project(baseInput({ age: null, organScores: [], wheel: [], biomarkerCount: 0 })),
  );
});

// ── 3. Bornes du risque composite 0..100 + vitalité = 100 - risque ─────────
test('risque composite et vitalité bornés 0..100 à chaque horizon/scénario', () => {
  const r = svc.project(baseInput());
  for (const h of r.horizons) {
    for (const key of Object.keys(h.scenarios)) {
      const p = h.scenarios[key];
      assert.ok(p.composite_risk >= 0 && p.composite_risk <= 100, `${key}@${h.year} risk`);
      assert.ok(p.vitality >= 0 && p.vitality <= 100, `${key}@${h.year} vitality`);
      for (const dim of Object.keys(p.systems)) {
        assert.ok(p.systems[dim] >= 0 && p.systems[dim] <= 100, `${key}@${h.year} sys ${dim}`);
      }
    }
  }
});

// ── 4. status_quo : delta d'espérance = 0 ──────────────────────────────────
test('status_quo : delta_vs_status_quo_years === 0', () => {
  const r = svc.project(baseInput());
  assert.strictEqual(r.life_expectancy.scenarios.status_quo.delta_vs_status_quo_years, 0);
});

// ── 5. Monotonie temporelle : le risque status_quo ne décroît jamais ───────
test('status_quo : le risque composite croît (ou stagne) avec le temps', () => {
  const r = svc.project(baseInput());
  let prev = -Infinity;
  for (const h of r.horizons) {
    const risk = h.scenarios.status_quo.composite_risk;
    assert.ok(risk >= prev - 1e-9, `risque @${h.year}=${risk} < précédent ${prev}`);
    prev = risk;
  }
});

// ── 6. combined_optimal ≤ status_quo (un programme améliore) ───────────────
test('combined_optimal : risque ≤ status_quo à chaque horizon', () => {
  const r = svc.project(baseInput());
  for (const h of r.horizons) {
    const sq = h.scenarios.status_quo.composite_risk;
    const opt = h.scenarios.combined_optimal.composite_risk;
    assert.ok(opt <= sq + 1e-9, `combined_optimal @${h.year}=${opt} > status_quo ${sq}`);
  }
});

// ── 7. quit_smoking ≤ status_quo ───────────────────────────────────────────
test('quit_smoking : risque ≤ status_quo à chaque horizon', () => {
  const r = svc.project(baseInput());
  for (const h of r.horizons) {
    assert.ok(
      h.scenarios.quit_smoking.composite_risk <= h.scenarios.status_quo.composite_risk + 1e-9,
      `quit_smoking @${h.year}`,
    );
  }
});

// ── 8. Espérance de vie : leviers ≥ status_quo, et bornes crédibles ────────
test('espérance de vie : tout levier ≥ status_quo et bornée [age+3, age+remaining+8]', () => {
  const inp = baseInput();
  const r = svc.project(inp);
  const sq = r.life_expectancy.scenarios.status_quo.estimate_years;
  for (const key of Object.keys(r.life_expectancy.scenarios)) {
    const est = r.life_expectancy.scenarios[key].estimate_years;
    assert.ok(est >= sq - 1e-9, `${key} estimate ${est} < status_quo ${sq}`);
    assert.ok(est >= inp.age + 3 - 1e-9, `${key} estimate < age+3`);
    // borne haute large (remaining = LE_cohorte - age, +8) — vérifie juste finitude/ordre.
    assert.ok(est <= COHORT_LE.male + 8 + 1e-9, `${key} estimate ${est} dépasse la borne haute`);
    // healthspan ≤ estimate
    assert.ok(
      r.life_expectancy.scenarios[key].healthspan_years <= est + 1e-9,
      `${key} healthspan > estimate`,
    );
  }
});

// ── 9. Disclaimer exact (valeur fixe) + engine_version ─────────────────────
test('disclaimer = PROJECTION_DISCLAIMER et engine_version = projection-v1', () => {
  const r = svc.project(baseInput());
  assert.strictEqual(r.disclaimer, PROJECTION_DISCLAIMER);
  assert.strictEqual(r.engine_version, PROJECTION_VERSION);
  assert.match(r.disclaimer, /pas une prédiction médicale|n'est PAS une prédiction médicale/i);
});

// ── 10. status_quo toujours forcé même si non demandé ──────────────────────
test('status_quo forcé présent même si scenarioKeys ne le contient pas', () => {
  const r = svc.project(baseInput({ scenarioKeys: ['quit_smoking'] }));
  assert.ok(r.inputs.scenario_keys.includes('status_quo'));
  for (const h of r.horizons) assert.ok(h.scenarios.status_quo, `horizon ${h.year} sans status_quo`);
});

// ── 11. Données vides : ne crash pas, renvoie une structure cohérente ──────
test('données totalement vides : pas de crash, structure complète', () => {
  const r = svc.project({
    age: null,
    sex: null,
    organScores: [],
    wheel: [],
    biomarkerCount: 0,
    horizonsYears: [1, 5, 10, 20],
    scenarioKeys: ALL_KEYS,
    horizonFocus: 20,
  });
  assert.ok(Array.isArray(r.horizons) && r.horizons.length === 4);
  assert.ok(r.current.composite_risk >= 0 && r.current.composite_risk <= 100);
  assert.strictEqual(r.inputs.sex, null);
  assert.strictEqual(r.confidence.level, 'faible');
});

// ── 12. Fallback cohorte : âge absent → baseline = fallback, et drivers le disent
test('âge absent → cohorte 45 ans, baseline = COHORT_LE.fallback', () => {
  const r = svc.project(baseInput({ age: null, sex: null }));
  assert.strictEqual(r.inputs.age, null);
  assert.strictEqual(r.life_expectancy.baseline, COHORT_LE.fallback);
  const ageDriver = r.drivers.find((d) => d.code === 'age');
  assert.ok(ageDriver && /45/.test(ageDriver.why_fr), 'driver âge doit mentionner la cohorte 45');
  // age_at_horizon doit rester null quand l'âge est inconnu.
  for (const h of r.horizons) assert.strictEqual(h.age_at_horizon, null);
});

// ── 13. Drivers : somme ≈ 100, triés desc, âge non modifiable ──────────────
test('drivers : somme des contributions ≈ 100, tri décroissant, âge non modifiable', () => {
  const r = svc.project(baseInput());
  assert.ok(r.drivers.length > 0);
  const sum = r.drivers.reduce((a, d) => a + d.contribution_pct, 0);
  assert.ok(Math.abs(sum - 100) <= 2, `somme contributions = ${sum}, attendu ~100`);
  for (let i = 1; i < r.drivers.length; i++) {
    assert.ok(
      r.drivers[i - 1].contribution_pct >= r.drivers[i].contribution_pct,
      'drivers doivent être triés décroissant',
    );
  }
  const ageDriver = r.drivers.find((d) => d.code === 'age');
  assert.ok(ageDriver && ageDriver.modifiable === false, 'le driver âge ne doit pas être modifiable');
});

// ── 14. Confiance croissante avec la complétude des données ────────────────
test('confiance : croît avec âge + roue + organes + biomarqueurs', () => {
  const poor = svc.project(baseInput({ age: null, organScores: [], wheel: [], biomarkerCount: 0 }));
  const rich = svc.project(baseInput());
  assert.ok(rich.confidence.score > poor.confidence.score, 'plus de données → plus de confiance');
  assert.strictEqual(poor.confidence.level, 'faible');
  assert.ok(['faible', 'moderee', 'bonne'].includes(rich.confidence.level));
});

// ── 15. Pénalité jamais appliquée si l'axe roue est null (aucune donnée fabriquée)
test('axe roue null → aucune pénalité lifestyle correspondante (pas de donnée inventée)', () => {
  // Roue avec UNIQUEMENT environment renseigné (mauvais) ; le reste null.
  const wheelSparse = [{ domain: 'environment', score: 20 }];
  const r = svc.project(baseInput({ wheel: wheelSparse }));
  const codes = r.drivers.map((d) => d.code);
  // smoking/alcohol viennent de environment → présents.
  assert.ok(codes.includes('smoking') || codes.includes('alcohol'), 'environment mauvais → driver toxique');
  // sleep/stress/sedentary n'ont pas de donnée → absents.
  assert.ok(!codes.includes('sleep'), 'sleep ne doit pas apparaître sans donnée');
  assert.ok(!codes.includes('stress'), 'stress ne doit pas apparaître sans donnée');
  assert.ok(!codes.includes('sedentary'), 'sedentary ne doit pas apparaître sans donnée');
});
