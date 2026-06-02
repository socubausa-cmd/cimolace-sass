'use strict';
/**
 * Tests unitaires — BrainToolsService (registre d'outils LIRI Brain + RBAC).
 *
 * Runner : node:test intégré (aucune dépendance jest). Cible le code COMPILÉ
 * (`dist/`) — lancer `npm run build` avant si dist est périmé (le watcher
 * `start:dev` le garde à jour en développement).
 *
 *   npm run test:unit            (depuis apps/api)
 *   node --test test/            (équivalent)
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { BrainToolsService } = require('../dist/liri-brain/brain-tools.service.js');
const { LIRI_MODELS } = require('../dist/liri-brain/liri-brain.types.js');

// Seuls les handlers réellement exécutés ont besoin d'une vraie méthode ; le
// reste peut rester vide (les specs/RBAC ne touchent pas aux handlers).
const makeSvc = (overrides = {}) => {
  const empty = {};
  const courses = { listCourses: (tid) => ({ ok: 'courses', tid }), ...(overrides.courses || {}) };
  return new BrainToolsService(courses, empty, empty, empty, empty, empty, empty);
};

const WRITE_TOOLS = ['create_forum_topic', 'reply_forum_topic', 'create_live', 'request_appointment'];
const ownerCtx = (role) => ({ tenant: { id: 'T1' }, userId: 'U1', role });

test('getToolSpecs : owner voit les 21 outils', () => {
  assert.strictEqual(makeSvc().getToolSpecs('owner').length, 21);
});

test('getToolSpecs : student est privé des outils réservés à la direction', () => {
  const student = makeSvc().getToolSpecs('student').map((t) => t.name);
  assert.ok(!student.includes('list_enrollments'), 'student ne doit pas voir list_enrollments');
  assert.ok(!student.includes('get_school_stats'), 'student ne doit pas voir get_school_stats');
  assert.ok(!student.includes('create_live'), 'student ne doit pas voir create_live');
  // … mais conserve les outils ANY (lecture + écriture forum + réservation)
  assert.ok(student.includes('list_courses'));
  assert.ok(student.includes('request_appointment'));
  assert.strictEqual(student.length, 18);
});

test('getToolSpecs : les specs exposées ne fuient pas le handler', () => {
  for (const spec of makeSvc().getToolSpecs('owner')) {
    assert.strictEqual(spec.handler, undefined, `${spec.name} ne doit pas exposer son handler`);
    assert.ok(typeof spec.name === 'string' && spec.parameters && 'requiresConfirmation' in spec);
  }
});

test('requiresConfirmation : exactement les 4 outils d\'écriture', () => {
  const svc = makeSvc();
  const writes = svc
    .getToolSpecs('owner')
    .filter((t) => t.requiresConfirmation)
    .map((t) => t.name)
    .sort();
  assert.deepStrictEqual(writes, [...WRITE_TOOLS].sort());
  assert.strictEqual(svc.requiresConfirmation('list_courses'), false);
  assert.strictEqual(svc.requiresConfirmation('create_live'), true);
});

test('execute : outil de lecture → appelle le service avec le tenant forcé', async () => {
  const res = await makeSvc().execute('list_courses', {}, ownerCtx('owner'));
  assert.deepStrictEqual(res, { ok: 'courses', tid: 'T1' });
});

test('execute : rôle non autorisé → rejette (RBAC re-vérifié)', async () => {
  await assert.rejects(
    () => makeSvc().execute('list_enrollments', {}, ownerCtx('student')),
    /non autoris/i,
  );
});

test('execute : outil inconnu → rejette', async () => {
  await assert.rejects(() => makeSvc().execute('does_not_exist', {}, ownerCtx('owner')), /inconnu/i);
});

test('LIRI_MODELS : catalogue Claude à jour (aucun ID daté)', () => {
  const keys = LIRI_MODELS.map((m) => m.key);
  assert.ok(keys.includes('claude-sonnet-4-6'), 'Sonnet 4.6 présent');
  assert.ok(keys.includes('claude-opus-4-8'), 'Opus 4.8 présent');
  assert.ok(!keys.some((k) => /20250514/.test(k)), 'aucun ID Claude daté (…20250514) ne doit subsister');
  for (const m of LIRI_MODELS) {
    assert.ok(['deepseek', 'anthropic', 'openai'].includes(m.provider), `provider inconnu: ${m.provider}`);
  }
});
