'use strict';
/**
 * Tests unitaires — LiriBrainService.streamConversation
 * (garde-quota crédits IA · prompt système · historique borné).
 *
 * Runner node:test (zéro dépendance), cible le code compilé `dist/`.
 * On instancie le service avec des stubs et on remplace, sur l'instance, les
 * méthodes qui sortent du périmètre (getConversation, streamChatWithTools) pour
 * capturer ce qui est réellement transmis au LLM — sans DB ni appel réseau.
 *
 *   npm run test:unit            (depuis apps/api)
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { LiriBrainService } = require('../dist/liri-brain/liri-brain.service.js');

const ctx = { tenant: { id: 'T1', name: 'École Test' }, userId: 'U1', role: 'owner' };

const collect = async (gen) => {
  const out = [];
  for await (const chunk of gen) out.push(chunk);
  return out;
};

// Crée un service dont l'appel LLM est remplacé par un générateur qui CAPTURE
// les messages transmis (svc._captured) au lieu d'appeler un vrai modèle.
function makeService(balanceOrFn) {
  const getBalance =
    typeof balanceOrFn === 'function' ? balanceOrFn : async () => balanceOrFn;
  const svc = new LiriBrainService({}, {}, {}, { getBalance });
  svc._captured = null;
  const capture = async function* (model, messages) {
    svc._captured = { model, messages };
    yield { content: 'DELEGATED', done: true };
  };
  svc.streamChatWithTools = capture;
  svc.streamChat = capture;
  return svc;
}

test('quota : tenant bloqué → message « épuisé », aucune délégation LLM', async () => {
  const svc = makeService({ is_blocked: true, balance_credits: 100 });
  const out = await collect(svc.streamConversation('deepseek-chat', 'salut', ctx, { useTools: true }));
  assert.strictEqual(out.length, 1);
  assert.match(out[0].content, /épuis/i);
  assert.strictEqual(out[0].done, true);
  assert.strictEqual(svc._captured, null);
});

test('quota : solde ≤ 0 → bloqué', async () => {
  const svc = makeService({ is_blocked: false, balance_credits: 0 });
  const out = await collect(svc.streamConversation('deepseek-chat', 'salut', ctx, { useTools: true }));
  assert.match(out[0].content, /épuis/i);
  assert.strictEqual(svc._captured, null);
});

test('quota : solde positif → délègue au LLM', async () => {
  const svc = makeService({ is_blocked: false, balance_credits: 50 });
  const out = await collect(svc.streamConversation('deepseek-chat', 'salut', ctx, { useTools: true }));
  assert.strictEqual(out[0].content, 'DELEGATED');
  assert.ok(svc._captured);
});

test('quota : facturation en erreur → fail-open (délègue quand même)', async () => {
  const svc = makeService(async () => {
    throw new Error('billing down');
  });
  const out = await collect(svc.streamConversation('deepseek-chat', 'salut', ctx, { useTools: true }));
  assert.strictEqual(out[0].content, 'DELEGATED');
  assert.ok(svc._captured);
});

test('prompt système : 1er message = system (mentionne LIRI + nom école), dernier = user', async () => {
  const svc = makeService({ is_blocked: false, balance_credits: 50 });
  await collect(svc.streamConversation('deepseek-chat', 'salut', ctx, { useTools: true }));
  const msgs = svc._captured.messages;
  assert.strictEqual(msgs[0].role, 'system');
  assert.match(msgs[0].content, /LIRI/);
  assert.match(msgs[0].content, /École Test/);
  const last = msgs[msgs.length - 1];
  assert.strictEqual(last.role, 'user');
  assert.strictEqual(last.content, 'salut');
});

test('historique borné : 30 messages → seuls les 20 derniers réinjectés (system + 20 + user = 22)', async () => {
  const svc = makeService({ is_blocked: false, balance_credits: 50 });
  const history = Array.from({ length: 30 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user',
    content: `m${i}`,
  }));
  svc.getConversation = async () => ({ messages: history });
  await collect(
    svc.streamConversation('deepseek-chat', 'nouveau', ctx, { conversationId: 'C1', useTools: true }),
  );
  const msgs = svc._captured.messages;
  assert.strictEqual(msgs.length, 22);
  assert.strictEqual(msgs[1].content, 'm10'); // les 10 plus anciens tronqués
  assert.strictEqual(msgs[21].content, 'nouveau');
});

test('historique : conversation introuvable (throw) → on continue sans historique', async () => {
  const svc = makeService({ is_blocked: false, balance_credits: 50 });
  svc.getConversation = async () => {
    throw new Error('introuvable');
  };
  await collect(
    svc.streamConversation('deepseek-chat', 'salut', ctx, { conversationId: 'BAD', useTools: true }),
  );
  assert.strictEqual(svc._captured.messages.length, 2); // system + user uniquement
});
