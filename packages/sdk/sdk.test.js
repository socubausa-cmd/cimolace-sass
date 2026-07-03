'use strict';
/**
 * Tests unitaires — @cimolace/sdk (routage des moteurs + bases neutres + sécurité URL).
 * Le SDK est du code navigateur mais ses helpers purs sont exercables en node
 * (le bloc auto-mount est gardé par `typeof document !== 'undefined'`).
 *
 *   node --test packages/sdk/sdk.test.js   (depuis la racine du repo)
 */
const test = require('node:test');
const assert = require('node:assert');
const Cimolace = require('./cimolace-sdk.js');
const { ENGINES, origin, join } = Cimolace._internals;

const BASES = {
  apiBase: 'https://api.cimolace.space',
  appBase: 'https://app.cimolace.space',
  medBase: 'https://med.cimolace.space',
};

test('expose les 3 moteurs', () => {
  assert.deepStrictEqual(Cimolace.engines.sort(), ['liri', 'mbolo', 'medos']);
});

test('liri → iframe /embed/live/:id sur app base, avec tenant+mode', () => {
  const url = ENGINES.liri.iframeUrl({ tenant: 'mon-ecole', liveId: 'abc-123', mode: 'live' }, BASES);
  assert.ok(url.startsWith('https://app.cimolace.space/embed/live/abc-123'), url);
  assert.ok(url.includes('tenant=mon-ecole'));
  assert.ok(url.includes('mode=live'));
  assert.strictEqual(ENGINES.liri.originOf(BASES), 'https://app.cimolace.space');
});

test('medos → handoff SSO (code = token minté serveur), origine med', () => {
  const url = ENGINES.medos.iframeUrl({ token: 'sso-code-123' }, BASES);
  assert.ok(url.startsWith('https://med.cimolace.space/handoff'), url);
  assert.ok(url.includes('code=sso-code-123'));
  assert.strictEqual(ENGINES.medos.originOf(BASES), 'https://med.cimolace.space');
});

test('mbolo → route /embed/boutique (preview), app base', () => {
  const url = ENGINES.mbolo.iframeUrl({ tenant: 'ma-boutique' }, BASES);
  assert.ok(url.startsWith('https://app.cimolace.space/embed/boutique'), url);
  assert.ok(url.includes('tenant=ma-boutique'));
});

test('statut de disponibilité honnête par moteur', () => {
  assert.strictEqual(ENGINES.liri.status, 'ready');
  assert.strictEqual(ENGINES.medos.status, 'ready');
  assert.strictEqual(ENGINES.mbolo.status, 'preview'); // route publique pas encore livrée
});

test('option requise manquante → erreur claire', () => {
  assert.throws(() => ENGINES.liri.iframeUrl({ tenant: 'x' }, BASES), /liveId/);
  assert.throws(() => ENGINES.medos.iframeUrl({}, BASES), /token/);
});

test('bases NEUTRES : aucun DOMAINE tenant en dur (prorascience.*, isna.*)', () => {
  const raw = require('fs').readFileSync(require('path').join(__dirname, 'cimolace-sdk.js'), 'utf8');
  // Le risque = une URL de base pointant un tenant ; la mention en commentaire est OK.
  assert.ok(!/prorascience\.(org|com|space)/i.test(raw), 'aucun domaine prorascience en dur');
  assert.ok(!/\bisna\.cimolace\./i.test(raw), 'aucun domaine isna en dur');
  assert.ok(/api\.cimolace\.space/.test(raw), 'base cimolace neutre présente');
});

test('helpers origin()/join()', () => {
  assert.strictEqual(origin('https://app.cimolace.space/x/y'), 'https://app.cimolace.space');
  assert.strictEqual(join('https://a.b/', '/c'), 'https://a.b/c');
});
