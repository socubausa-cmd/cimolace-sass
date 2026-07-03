'use strict';
/**
 * Tests unitaires — provisioning école (CimolaceBackofficeService, endpoints
 * /school-onboarding/*). Ces méthodes étaient appelées sur un controller jamais
 * enregistré → 404 (audit 2026-07-03, P0). On prouve ici le CHEMIN LECTURE
 * (manifeste + dry-run preview), sans écriture prod.
 *
 *   npm run build && node --test test/school-onboarding.test.js   (depuis apps/api)
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { CimolaceBackofficeService } = require('../dist/cimolace-backoffice/cimolace-backoffice.service.js');

// Supabase simulé : maybeSingle() résout selon la table demandée.
function makeSupabase({ slugTaken = false, ownerExists = false } = {}) {
  const client = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          if (table === 'tenants') return Promise.resolve({ data: slugTaken ? { id: 'T-existing' } : null });
          if (table === 'profiles') return Promise.resolve({ data: ownerExists ? { id: 'U-1' } : null });
          return Promise.resolve({ data: null });
        },
      };
    },
  };
  return { client };
}

function makeService(sbOpts) {
  // pawapay/airtel non utilisés par les méthodes testées.
  return new CimolaceBackofficeService(makeSupabase(sbOpts), {}, {});
}

test('getSchoolEngineManifest : renvoie engines + base + recommended + planLimits', () => {
  const svc = makeService();
  const m = svc.getSchoolEngineManifest();
  assert.ok(Array.isArray(m.engines) && m.engines.length >= 10, 'engines liste non vide');
  assert.ok(Array.isArray(m.baseEngines) && m.baseEngines.includes('booking_engine'));
  assert.ok(m.recommendedEngines.length >= m.baseEngines.length, 'recommended ⊇ base');
  assert.ok(m.planLimits.starter && m.planLimits.school, 'quotas par plan présents');
});

test('previewProvisionSchool : slug libre + owner sans compte', async () => {
  const svc = makeService({ slugTaken: false, ownerExists: false });
  const p = await svc.previewProvisionSchool({ name: 'École Fatima', slug: 'ecole-fatima', owner_email: 'ADMIN@Ecole.org', plan: 'starter' });
  assert.strictEqual(p.checks.slugAvailable, true);
  assert.strictEqual(p.checks.ownerHasAccount, false);
  assert.strictEqual(p.willCreate.tenant.slug, 'ecole-fatima');
  assert.strictEqual(p.willCreate.tenant.plan, 'starter');
  assert.strictEqual(p.willCreate.limits.maxStudents, 50); // limites starter
  assert.ok(p.willCreate.engines.some((e) => e.key === 'booking_engine'), 'moteurs recommandés listés');
});

test('previewProvisionSchool : slug pris + owner déjà inscrit (plan par défaut school)', async () => {
  const svc = makeService({ slugTaken: true, ownerExists: true });
  const p = await svc.previewProvisionSchool({ name: 'Zahir', slug: 'zahir', owner_email: 'jkalonji06@gmail.com' });
  assert.strictEqual(p.checks.slugAvailable, false);
  assert.strictEqual(p.checks.ownerHasAccount, true);
  assert.strictEqual(p.willCreate.tenant.plan, 'school'); // défaut
  assert.ok(Array.isArray(p.checks.missingProviders));
});
