/**
 * Tests du JUGE DE CONFORMITÉ (brique C). `node --test`.
 * PURE ESM, aucun réseau : invokeEdge mocké. Couvre auditCourse (chaque code),
 * conformCourse (idempotence, non-destructif, fail-safe, opt-in/out), déterminisme,
 * garde renderable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditCourse, conformCourse, conformCourseSync, stripMeta,
  SCENE_VOCABULARY, RENDERABLE_TYPES, CANONICAL_ORDER, CHECKS, isValidElement,
} from './conformCourse.js';
import { masterclassProjectToPrecepteurCourse } from './fromMasterclass.js';

const codes = (audit) => audit.findings.map((f) => f.code);
const oneConcept = (scenes, extra = {}) => ({ title: 'C', concepts: [{ title: 'C', scenes, ...extra }] });
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── auditCourse : robustesse & déterminisme ──────────────────────────────────
test('auditCourse : null/{}/[] → jamais throw, COURSE_VIDE, ok=false', () => {
  for (const bad of [null, undefined, {}, { concepts: [] }, { concepts: 'x' }]) {
    let out;
    assert.doesNotThrow(() => { out = auditCourse(bad); });
    assert.equal(out.ok, false);
    assert.ok(codes(out).includes('COURSE_VIDE'));
  }
});

test('auditCourse : déterministe (mêmes entrées → même sortie)', () => {
  const c = oneConcept([
    { type: 'lecon', board_text: "On appelle «énergie» la capacité à produire un travail." },
    { type: 'transition', narration: 'Suite.' },
  ]);
  assert.deepEqual(stripMeta(auditCourse(c)), stripMeta(auditCourse(c)));
});

// ── auditCourse : chaque code ────────────────────────────────────────────────
test('CONCEPT_NO_LECON : concept sans leçon → error', () => {
  const out = auditCourse(oneConcept([{ type: 'transition', narration: 'x' }]));
  assert.ok(codes(out).includes('CONCEPT_NO_LECON'));
  assert.equal(out.ok, false);
});

test('CONCEPT_SANS_SCENE : concept scenes vides → error', () => {
  const out = auditCourse({ concepts: [{ title: 'C', scenes: [] }] });
  assert.ok(codes(out).includes('CONCEPT_SANS_SCENE'));
  assert.equal(out.ok, false);
});

test('LECON_TEXTE_VIDE : leçon < 12 chars → error', () => {
  const out = auditCourse(oneConcept([{ type: 'lecon', board_text: '', narration: 'ab' }]));
  assert.ok(codes(out).includes('LECON_TEXTE_VIDE'));
});

test('DEFINITION_SANS_ENCADRE (+ SURLIGNAGE) : leçon définition sans encadré', () => {
  const out = auditCourse(oneConcept([
    { type: 'lecon', board_text: "On appelle «énergie» la capacité à produire un travail." },
  ]));
  assert.ok(codes(out).includes('DEFINITION_SANS_ENCADRE'));
  assert.ok(codes(out).includes('DEFINITION_SANS_SURLIGNAGE'));
  const f = out.findings.find((x) => x.code === 'DEFINITION_SANS_ENCADRE');
  assert.equal(f.repair, 'deterministic');
});

test('FORMULE_SANS_ENCADRE : leçon avec calcul sans encadré formule', () => {
  const out = auditCourse(oneConcept([
    { type: 'lecon', board_text: 'Le calcul se pose ainsi : 7 + 5 = 12, on additionne.' },
  ]));
  assert.ok(codes(out).includes('FORMULE_SANS_ENCADRE'));
});

test('RESUME_MANQUANT : énumération sans résumé encadré', () => {
  const out = auditCourse(oneConcept([
    { type: 'lecon', board_text: "Il existe plusieurs types : d'abord les conducteurs, ensuite les isolants, enfin les semi-conducteurs." },
  ]));
  assert.ok(codes(out).includes('RESUME_MANQUANT'));
});

test('CROQUIS_MANQUANT : leçon abstraite (relation) sans croquis → warn/llm', () => {
  const out = auditCourse(oneConcept([
    { type: 'lecon', board_text: 'La force est proportionnelle à la masse et inversement à la distance.' },
  ]));
  assert.ok(codes(out).includes('CROQUIS_MANQUANT'));
  const f = out.findings.find((x) => x.code === 'CROQUIS_MANQUANT');
  assert.equal(f.repair, 'llm');
});

test('CROQUIS_INVALIDE : sketch element sans géométrie / hors vocab → error', () => {
  const noGeom = auditCourse(oneConcept([
    { type: 'lecon', board_text: 'Un dessin neutre ici présent à tester.' },
    { type: 'croquis', sketch: { elements: [{ kind: 'vector' }] } },
  ]));
  assert.ok(codes(noGeom).includes('CROQUIS_INVALIDE'));
  const outOfVocab = auditCourse(oneConcept([
    { type: 'lecon', board_text: 'Un dessin neutre ici présent à tester.' },
    { type: 'croquis', sketch: { elements: [{ kind: 'blob', center: [1, 2] }] } },
  ]));
  assert.ok(codes(outOfVocab).includes('CROQUIS_INVALIDE'));
});

test('croquis VALIDE : aucun CROQUIS_INVALIDE', () => {
  const out = auditCourse(oneConcept([
    { type: 'lecon', board_text: 'Un dessin neutre ici présent à tester.' },
    { type: 'croquis', sketch: { elements: [{ kind: 'vector', from: [0, 0], to: [10, 10] }] } },
  ]));
  assert.ok(!codes(out).includes('CROQUIS_INVALIDE'));
});

test('ATELIER_INCOMPLET : atelier sans ack_variants → warn deterministic', () => {
  const out = auditCourse(oneConcept([
    { type: 'lecon', board_text: 'La relation oppose deux forces contraires en équilibre.' },
    { type: 'atelier', question: 'Pourquoi ?', reveal_narration: 'Parce que.' },
  ]));
  assert.ok(codes(out).includes('ATELIER_INCOMPLET'));
});

test('ATELIER_MANQUANT : leçon abstraite sans atelier → warn llm', () => {
  const out = auditCourse(oneConcept([
    { type: 'lecon', board_text: 'La force est proportionnelle à la masse et varie avec la distance.' },
  ]));
  assert.ok(codes(out).includes('ATELIER_MANQUANT'));
});

test('IMAGE_MANQUANTE : leçon concrète (phénomène) sans image → info', () => {
  const out = auditCourse(oneConcept([
    { type: 'lecon', board_text: 'On observe ce phénomène au quotidien, dans la nature, concrètement.' },
  ]));
  assert.ok(codes(out).includes('IMAGE_MANQUANTE'));
});

test('ORDRE_INVALIDE : encadré avant leçon → warn deterministic', () => {
  const out = auditCourse(oneConcept([
    { type: 'encadre', kind: 'definition', text: 'x' },
    { type: 'lecon', board_text: 'Un texte neutre sans aucun signal ici présent.' },
  ]));
  assert.ok(codes(out).includes('ORDRE_INVALIDE'));
});

test('SCENE_TYPE_NON_RENDU + NARRATION_ABSENTE_FALLTHROUGH', () => {
  const out = auditCourse(oneConcept([
    { type: 'lecon', board_text: 'Un texte neutre sans aucun signal ici présent.' },
    { type: 'quiz' },
  ]));
  assert.ok(codes(out).includes('SCENE_TYPE_NON_RENDU'));
  assert.ok(codes(out).includes('NARRATION_ABSENTE_FALLTHROUGH'));
});

// ── Garde renderable & cohérence des compteurs ───────────────────────────────
test('GARDE RENDERABLE : vocabulaire == renderable, ordre canonique ⊆ renderable', () => {
  assert.deepEqual([...SCENE_VOCABULARY].sort(), [...RENDERABLE_TYPES].sort());
  for (const t of Object.keys(CANONICAL_ORDER)) assert.ok(RENDERABLE_TYPES.includes(t));
  // aucun check ne cite un type hors renderable dans son scope/severity (méta cohérente)
  for (const [code, meta] of Object.entries(CHECKS)) {
    assert.ok(['error', 'warn', 'info'].includes(meta.severity), `${code} severity`);
    assert.ok(['deterministic', 'llm', 'none'].includes(meta.repair), `${code} repair`);
  }
});

test('counts/score cohérents : ok === (error===0)', () => {
  const out = auditCourse(oneConcept([{ type: 'transition', narration: 'x' }]));
  assert.equal(out.ok, out.counts.error === 0);
  assert.equal(out.conceptsConform, out.ok ? 1 : 0);
  assert.ok(out.score >= 0 && out.score <= 100);
});

// ── conformCourse : idempotence, non-destructif, réparation ──────────────────
test('conformCourse : IDEMPOTENCE (rejouer ne change rien)', async () => {
  const c = oneConcept([
    { type: 'lecon', board_text: "On appelle «flux» le débit d'information. C'est le socle." },
    { type: 'transition', narration: 'Suite.' },
  ]);
  const r1 = await conformCourse(c);
  const r2 = await conformCourse(r1.course);
  assert.deepEqual(r2.course, r1.course);
});

test('conformCourse : NON-DESTRUCTIF (entrée jamais mutée)', async () => {
  const c = oneConcept([
    { type: 'lecon', board_text: "On appelle «flux» le débit d'information ici présent." },
    { type: 'transition', narration: 'Suite.' },
  ]);
  const snapshot = clone(c);
  await conformCourse(c);
  assert.deepEqual(c, snapshot);
});

test('conformCourse : répare DEFINITION_SANS_ENCADRE (compose enrichCourseWithDevices)', async () => {
  const c = oneConcept([
    { type: 'lecon', board_text: "On appelle «énergie» la capacité à produire un travail ici." },
    { type: 'transition', narration: 'Suite.' },
  ]);
  const { course, report } = await conformCourse(c);
  assert.ok(!codes(auditCourse(course)).includes('DEFINITION_SANS_ENCADRE'));
  assert.ok(report.repaired.some((id) => id.startsWith('DEFINITION_SANS_ENCADRE')));
  const scenes = course.concepts[0].scenes;
  assert.ok(scenes.some((s) => s.type === 'encadre' && s.kind === 'definition'));
  assert.ok(scenes.some((s) => s.type === 'surlignage' && s.term === 'énergie'));
});

test('conformCourse : DÉDUP (cours déjà enrichi → pas de doublon)', async () => {
  const c = oneConcept([
    { type: 'lecon', board_text: "On appelle «énergie» la capacité à produire un travail ici." },
    { type: 'transition', narration: 'Suite.' },
  ]);
  const once = (await conformCourse(c)).course;
  const twice = (await conformCourse(once)).course;
  const count = (course, type) => course.concepts[0].scenes.filter((s) => s.type === type).length;
  assert.equal(count(twice, 'surlignage'), count(once, 'surlignage'));
  assert.equal(count(twice, 'encadre'), count(once, 'encadre'));
  assert.equal(count(once, 'surlignage'), 1);
});

test('conformCourse : CROQUIS_INVALIDE filtré ; tous invalides → scène retirée', async () => {
  const mixte = oneConcept([
    { type: 'lecon', board_text: 'Un texte neutre sans signal ici présent à tester.' },
    { type: 'croquis', sketch: { elements: [{ kind: 'vector', from: [0, 0], to: [1, 1] }, { kind: 'blob' }] } },
  ]);
  const r1 = await conformCourse(mixte);
  const croquis = r1.course.concepts[0].scenes.find((s) => s.type === 'croquis');
  assert.equal(croquis.sketch.elements.length, 1);
  assert.ok(croquis.sketch.elements.every(isValidElement));

  const tousInvalides = oneConcept([
    { type: 'lecon', board_text: 'Un texte neutre sans signal ici présent à tester.' },
    { type: 'croquis', sketch: { elements: [{ kind: 'blob' }] } },
  ]);
  const r2 = await conformCourse(tousInvalides);
  assert.ok(!r2.course.concepts[0].scenes.some((s) => s.type === 'croquis'));
});

test('conformCourse : REORDER canonique stable', async () => {
  const c = oneConcept([
    { type: 'encadre', kind: 'definition', text: 'x' },
    { type: 'lecon', board_text: 'Un texte neutre sans aucun signal ici présent.' },
    { type: 'transition', narration: 'fin' },
    { type: 'resume_encadre', points: ['a', 'b'], narration: 'r' },
  ]);
  const { course } = await conformCourse(c);
  assert.deepEqual(
    course.concepts[0].scenes.map((s) => s.type),
    ['lecon', 'encadre', 'resume_encadre', 'transition'],
  );
});

test('conformCourse : BEAT-AWARE (multi-leçon → dispositifs restent avec LEUR leçon)', async () => {
  const c = oneConcept([
    { type: 'lecon', board_text: "On appelle «flux» le débit d'information. C'est le socle ici." },
    { type: 'lecon', board_text: "Mais le flux ne va jamais seul : il structure la suite du cours." },
    { type: 'transition', narration: 'Suite.' },
  ]);
  const { course } = await conformCourse(c);
  const types = course.concepts[0].scenes.map((s) => s.type);
  const firstLecon = types.indexOf('lecon');
  const secondLecon = types.indexOf('lecon', firstLecon + 1);
  const enc = types.indexOf('encadre');
  assert.ok(secondLecon > firstLecon, `deux leçons attendues : ${types.join('>')}`);
  assert.ok(enc > firstLecon && enc < secondLecon, `encadré doit rester dans le beat de la 1re leçon : ${types.join('>')}`);
});

test('conformCourse : ATELIER défauts (ack_variants=DEFAULT_ACK, expected_*=[])', async () => {
  const c = oneConcept([
    { type: 'lecon', board_text: 'La relation oppose deux forces contraires en équilibre ici.' },
    { type: 'atelier', question: 'Pourquoi ?', reveal_narration: 'Parce que.' },
  ]);
  const { course } = await conformCourse(c);
  const atelier = course.concepts[0].scenes.find((s) => s.type === 'atelier');
  assert.ok(atelier.ack_variants && Array.isArray(atelier.ack_variants.ok));
  assert.deepEqual(atelier.expected_answers, []);
  assert.deepEqual(atelier.expected_errors, []);
});

// ── conformCourse : croquis LLM (opt-out / opt-in / fail-safe) ───────────────
const CROQUIS_PROJECT = {
  pedagogy: [{
    title: 'Gravitation',
    simple_lesson: 'La force est proportionnelle à la masse et inversement à la distance.',
    thought_experiment: 'Imagine deux masses qui s’attirent dans le vide.',
  }],
};

test('conformCourse : LLM OPT-OUT (défaut) → CROQUIS_MANQUANT reste flaggé, aucun croquis', async () => {
  const course = masterclassProjectToPrecepteurCourse(CROQUIS_PROJECT);
  const { course: out, report } = await conformCourse(course); // enrichCroquis=false par défaut
  assert.ok(!out.concepts[0].scenes.some((s) => s.type === 'croquis'));
  assert.ok(report.flagged.some((id) => id.startsWith('CROQUIS_MANQUANT')));
});

test('conformCourse : LLM OPT-IN (mock edge valide) → croquis inséré et valide', async () => {
  const course = masterclassProjectToPrecepteurCourse(CROQUIS_PROJECT);
  const invokeEdge = async () => ({ caption: 'schéma', elements: [{ kind: 'vector', from: [0, 0], to: [50, 50] }] });
  const { course: out } = await conformCourse(course, { enrichCroquis: true, project: CROQUIS_PROJECT, invokeEdge });
  const croquis = out.concepts[0].scenes.find((s) => s.type === 'croquis');
  assert.ok(croquis, 'un croquis doit être inséré');
  assert.ok(Array.isArray(croquis.sketch.elements) && croquis.sketch.elements.every(isValidElement));
});

test('conformCourse : FAIL-SAFE (edge qui throw) → pas de throw, pas de croquis', async () => {
  const course = masterclassProjectToPrecepteurCourse(CROQUIS_PROJECT);
  const invokeEdge = async () => { throw new Error('boom edge'); };
  let out;
  await assert.doesNotReject(async () => {
    out = await conformCourse(course, { enrichCroquis: true, project: CROQUIS_PROJECT, invokeEdge });
  });
  assert.ok(!out.course.concepts[0].scenes.some((s) => s.type === 'croquis'));
  assert.ok(out.report.flagged.some((id) => id.startsWith('CROQUIS_MANQUANT')));
});

test('conformCourseSync : chemin sync ≡ conformCourse (déterministe)', async () => {
  const c = oneConcept([
    { type: 'lecon', board_text: "On appelle «énergie» la capacité à produire un travail ici." },
    { type: 'lecon', board_text: 'La force est proportionnelle à la masse et varie avec la distance.' },
    { type: 'transition', narration: 'Suite.' },
  ]);
  const sync = conformCourseSync(c);
  const asyncR = await conformCourse(c);
  assert.deepEqual(sync.course, asyncR.course);
  assert.deepEqual(sync.report.repaired, asyncR.report.repaired);
});

test('conformCourse : jamais-throw sur course=null', async () => {
  let out;
  await assert.doesNotReject(async () => { out = await conformCourse(null); });
  assert.ok(out.course && Array.isArray(out.course.concepts));
});
