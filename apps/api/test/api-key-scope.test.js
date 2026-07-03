'use strict';
/**
 * Test — least-privilege scope moteur par préfixe de clé API (apiKeyScopeViolation).
 * cml_ = wildcard ; mdk_ = medos ; mbk_ = mbolo. Une clé moteur-spécifique sur un
 * AUTRE moteur = violation. Endpoint générique ou clé cml_ = jamais de violation.
 *
 *   npm run build && node --test test/api-key-scope.test.js   (depuis apps/api)
 */
const test = require('node:test');
const assert = require('node:assert');
const { apiKeyScopeViolation } = require('../dist/auth/api-key.guard.js');

const K = { cml: 'cml_zahir_' + 'a'.repeat(32), mdk: 'mdk_zahir_' + 'a'.repeat(32), mbk: 'mbk_zahir_' + 'a'.repeat(32) };

test('clé cml_ (générique) = JAMAIS de violation (wildcard)', () => {
  assert.strictEqual(apiKeyScopeViolation(K.cml, '/v1/medos/embed/server-token'), null);
  assert.strictEqual(apiKeyScopeViolation(K.cml, '/v1/mbolo/storefront/products'), null);
});

test('clé moteur-concordante = OK', () => {
  assert.strictEqual(apiKeyScopeViolation(K.mdk, '/v1/medos/embed/server-token'), null);
  assert.strictEqual(apiKeyScopeViolation(K.mbk, '/v1/mbolo/storefront/products'), null);
});

test('clé moteur CROISÉE = violation détectée', () => {
  assert.deepStrictEqual(
    apiKeyScopeViolation(K.mbk, '/v1/medos/embed/server-token'),
    { keyEngine: 'mbolo', endpointEngine: 'medos' },
  );
  assert.deepStrictEqual(
    apiKeyScopeViolation(K.mdk, '/v1/mbolo/storefront/products'),
    { keyEngine: 'medos', endpointEngine: 'mbolo' },
  );
});

test('endpoint générique (ni medos ni mbolo) = pas de violation', () => {
  assert.strictEqual(apiKeyScopeViolation(K.mdk, '/v1/liri/sessions'), null);
  assert.strictEqual(apiKeyScopeViolation(K.mbk, '/health'), null);
});
