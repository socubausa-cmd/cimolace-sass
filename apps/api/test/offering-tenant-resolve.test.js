'use strict';
/**
 * Test unitaire — offering-checkout : dé-hardcode du tenant qui encaisse.
 * resolveTenantSlug(dto.tenantSlug) doit :
 *  - défaut 'isna' quand absent/vide (RÉTROCOMPATIBLE — flux historique inchangé) ;
 *  - respecter un autre tenant fourni ; normaliser (trim + minuscules).
 *
 *   npm run build && node --test test/offering-tenant-resolve.test.js   (depuis apps/api)
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { OfferingCheckoutService } = require('../dist/checkout/offering-checkout.service.js');

// resolveTenantSlug n'utilise aucune dépendance → deps factices suffisent.
const svc = new OfferingCheckoutService({}, {}, {});

test('défaut isna quand tenantSlug absent (rétrocompatible)', () => {
  assert.strictEqual(svc.resolveTenantSlug(undefined), 'isna');
  assert.strictEqual(svc.resolveTenantSlug(null), 'isna');
  assert.strictEqual(svc.resolveTenantSlug(''), 'isna');
});

test('respecte un autre tenant + normalise (trim/minuscules)', () => {
  assert.strictEqual(svc.resolveTenantSlug('zahirwellness'), 'zahirwellness');
  assert.strictEqual(svc.resolveTenantSlug('  Zahir-Wellness  '), 'zahir-wellness');
  assert.strictEqual(svc.resolveTenantSlug('ISNA'), 'isna');
});
