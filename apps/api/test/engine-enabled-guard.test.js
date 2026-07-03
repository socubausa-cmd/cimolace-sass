'use strict';
/**
 * Tests unitaires — EngineEnabledGuard (gating générique d'activation de moteur).
 *
 * Garde-fous couverts (contrat de sûreté « 0 régression ») :
 *  - NO-OP : route sans @RequireEngine ⇒ passe (le guard est inerte par défaut) ;
 *  - OPT-IN OFF : metadata.gating.runtime absent ⇒ passe (tenants existants intacts) ;
 *  - OPT-IN ON + moteur NON activé ⇒ 403 (l'activation gate enfin le runtime) ;
 *  - OPT-IN ON + moteur activé (préfixe mbolo_) ⇒ passe ;
 *  - BYPASS infrastructure_type = moteur ⇒ passe sans lire les services ;
 *  - FAIL-OPEN : erreur DB sur les services ⇒ passe (jamais bloquer sur panne) ;
 *  - tenant absent ⇒ 403.
 *
 * Runner node:test, cible le code compilé `dist/`.
 *   npm run build && node --test test/engine-enabled-guard.test.js   (depuis apps/api)
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { ForbiddenException } = require('@nestjs/common');
const { EngineEnabledGuard } = require('../dist/common/guards/engine-enabled.guard.js');

const BASE_TENANT = {
  id: 'tenant-1', name: 'Boutique', slug: 'boutique', plan: 'free',
  status: 'active', primary_domain: null, logo_url: null, brand_colors: null,
  infrastructure_type: null, userRole: 'owner',
};

function makeCtx(tenant) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ tenant }) }),
  };
}

function makeReflector(engine) {
  return { getAllAndOverride: () => engine };
}

// Client Supabase simulé : from('tenants')→maybeSingle({metadata}), from('tenant_services')→thenable(liste).
function makeSupabase({ metadata, metadataError, services, servicesError } = {}) {
  const client = {
    from(table) {
      if (table === 'tenants') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle() {
            return Promise.resolve({
              data: metadataError ? null : { metadata },
              error: metadataError || null,
            });
          },
        };
      }
      const result = { data: servicesError ? null : (services || []), error: servicesError || null };
      return {
        select() { return this; },
        eq() { return this; },
        then(resolve) { return resolve(result); },
      };
    },
  };
  return { client };
}

test('NO-OP : route sans @RequireEngine → passe', async () => {
  const g = new EngineEnabledGuard(makeReflector(undefined), makeSupabase());
  assert.strictEqual(await g.canActivate(makeCtx(BASE_TENANT)), true);
});

test('OPT-IN OFF : gating.runtime absent → passe (0 régression)', async () => {
  const g = new EngineEnabledGuard(makeReflector('mbolo'), makeSupabase({ metadata: {} }));
  assert.strictEqual(await g.canActivate(makeCtx(BASE_TENANT)), true);
});

test('OPT-IN ON + moteur NON activé → 403', async () => {
  const g = new EngineEnabledGuard(
    makeReflector('mbolo'),
    makeSupabase({ metadata: { gating: { runtime: true } }, services: [{ service_key: 'med_ehr', active: true }] }),
  );
  await assert.rejects(() => g.canActivate(makeCtx(BASE_TENANT)), ForbiddenException);
});

test('OPT-IN ON + moteur activé (préfixe mbolo_) → passe', async () => {
  const g = new EngineEnabledGuard(
    makeReflector('mbolo'),
    makeSupabase({ metadata: { gating: { runtime: true } }, services: [{ service_key: 'mbolo_boutique', active: true }] }),
  );
  assert.strictEqual(await g.canActivate(makeCtx(BASE_TENANT)), true);
});

test('BYPASS : infrastructure_type = moteur → passe sans lire les services', async () => {
  const g = new EngineEnabledGuard(makeReflector('mbolo'), makeSupabase());
  const tenant = Object.assign({}, BASE_TENANT, { infrastructure_type: 'mbolo' });
  assert.strictEqual(await g.canActivate(makeCtx(tenant)), true);
});

test('FAIL-OPEN : erreur DB services → passe', async () => {
  const g = new EngineEnabledGuard(
    makeReflector('mbolo'),
    makeSupabase({ metadata: { gating: { runtime: true } }, servicesError: { message: 'boom' } }),
  );
  assert.strictEqual(await g.canActivate(makeCtx(BASE_TENANT)), true);
});

test('tenant absent → 403', async () => {
  const g = new EngineEnabledGuard(makeReflector('mbolo'), makeSupabase());
  await assert.rejects(() => g.canActivate(makeCtx(undefined)), ForbiddenException);
});
