'use strict';
/**
 * Tests unitaires — TwinService.assistantForMe (assistant santé patient).
 *
 * Garde-fous couverts :
 *  - escalade DÉTERMINISTE (pré-filtre) même quand le LLM est indisponible (503) ;
 *  - disclaimer FR systématiquement présent ;
 *  - 404 quand aucun dossier patient n'est lié au compte.
 *
 * Runner node:test (zéro dépendance), cible le code compilé `dist/`.
 *   npm run build && npm run test:unit      (depuis apps/api)
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { ServiceUnavailableException, NotFoundException } = require('@nestjs/common');
const { TwinService } = require('../dist/medos/twin/twin.service.js');

const TENANT = { id: 'T1', slug: 'demo' };
const USER = 'U1';

// Query builder Supabase factice : chainable, .maybeSingle() renvoie le patient,
// les .order() terminaux renvoient des listes (roue / alertes) selon la table.
function makeDb({ patient = { id: 'P1' }, wheel = [], alerts = [] } = {}) {
  return {
    from(table) {
      const b = {};
      b._table = table;
      const chain = () => b;
      b.select = chain;
      b.eq = chain;
      b.order = () => {
        if (table === 'med_transformation_wheel') return Promise.resolve({ data: wheel });
        if (table === 'med_alerts') return Promise.resolve({ data: alerts });
        return Promise.resolve({ data: [] });
      };
      b.insert = () => Promise.resolve({ data: null, error: null });
      b.maybeSingle = () => Promise.resolve({ data: patient });
      return b;
    },
  };
}

// Construit un TwinService avec un client Supabase factice + stubs d'instance.
function makeService({ db, aiImpl } = {}) {
  const supabase = { client: db ?? makeDb() };
  const svc = new TwinService(supabase, {}, { patientAssistant: aiImpl ?? (async () => {}) }, {}, {});
  // buildAiContext sort du périmètre (DB référentiels) → stub d'instance.
  svc.buildAiContext = async () => ({
    age: 40,
    sex: 'F',
    symptoms: [],
    biomarkers: [],
    organ_scores: [],
  });
  return svc;
}

const DISCLAIMER_FRAGMENT = "ne remplacent pas l'avis de votre praticien";
const EMERGENCY_FRAGMENT = 'appelez immédiatement le 15 ou le 112';

test('escalade déterministe même si le LLM est en panne (503)', async () => {
  const svc = makeService({
    aiImpl: async () => {
      throw new ServiceUnavailableException('IA indisponible');
    },
  });
  const res = await svc.assistantForMe(TENANT, USER, "J'ai une douleur dans la poitrine depuis ce matin");
  assert.equal(res.escalate, true, 'escalate doit être forcé par le pré-filtre');
  assert.ok(res.reply.includes(EMERGENCY_FRAGMENT), 'la réponse doit orienter vers le 15/112');
  assert.equal(res.disclaimer.includes(DISCLAIMER_FRAGMENT), true, 'disclaimer présent même en panne');
  assert.deepEqual(res.suggestions, [], 'pas de relance en cas d’urgence');
});

test('LLM en panne SANS alerte → 503 repropagé', async () => {
  const svc = makeService({
    aiImpl: async () => {
      throw new ServiceUnavailableException('IA indisponible');
    },
  });
  await assert.rejects(
    () => svc.assistantForMe(TENANT, USER, 'Comment améliorer mon sommeil ?'),
    (err) => err instanceof ServiceUnavailableException,
  );
});

test('disclaimer toujours présent sur réponse normale', async () => {
  const svc = makeService({
    aiImpl: async () => ({
      data: { reply: 'Votre score de digestion peut se travailler via l’alimentation.', suggestions: ['Q1', 'Q2'], escalate: false },
      model: 'claude-sonnet-4-6',
      tokens: 42,
    }),
  });
  const res = await svc.assistantForMe(TENANT, USER, 'Pourquoi mon score de digestion est-il bas ?');
  assert.equal(res.escalate, false);
  assert.ok(res.disclaimer.includes(DISCLAIMER_FRAGMENT));
  assert.deepEqual(res.suggestions, ['Q1', 'Q2']);
  assert.ok(!res.reply.includes(EMERGENCY_FRAGMENT), 'pas d’encart urgences hors alerte');
});

test('escalade LLM (sans déclencheur regex) préfixe l’encart urgences', async () => {
  const svc = makeService({
    aiImpl: async () => ({
      data: { reply: 'Contactez votre praticien.', suggestions: ['ignorée'], escalate: true },
      model: 'm',
      tokens: 1,
    }),
  });
  const res = await svc.assistantForMe(TENANT, USER, 'je ne me sens pas bien');
  assert.equal(res.escalate, true);
  assert.ok(res.reply.startsWith(EMERGENCY_FRAGMENT.slice(0, 10)) || res.reply.includes(EMERGENCY_FRAGMENT));
  assert.deepEqual(res.suggestions, []);
});

test('404 quand aucun dossier patient lié au compte', async () => {
  const svc = makeService({ db: makeDb({ patient: null }) });
  await assert.rejects(
    () => svc.assistantForMe(TENANT, USER, 'bonjour'),
    (err) => err instanceof NotFoundException,
  );
});
