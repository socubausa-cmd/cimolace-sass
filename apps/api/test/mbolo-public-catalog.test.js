'use strict';
/**
 * Test sécurité — mbolo embed public : toPublicProduct ne fuit AUCUN champ sensible.
 * Le catalogue est servi SANS authentification (/v1/mbolo/embed/:slug/catalog) →
 * il ne doit JAMAIS exposer created_by (UUID auth.users), le stock exact, le sku,
 * status, tenant_id, ni les flags internes.
 *
 *   npm run build && node --test test/mbolo-public-catalog.test.js   (depuis apps/api)
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { MboloService } = require('../dist/mbolo/mbolo.service.js');

const svc = new MboloService({ client: {} });

const RAW = {
  id: 'p1', tenant_id: 't1', name: 'Équilibre Femme', slug: 'equilibre-femme',
  price_cents: 2990000, compare_at_price_cents: 3490000, currency: 'XAF',
  sku: 'ZW-EF-01', stock: 50, track_stock: true, unlimited_stock: false,
  status: 'published', is_active: true, is_featured: true,
  created_by: '11111111-2222-3333-4444-555555555555',
  benefits: ['a'], ingredients: ['b'], seo_title: 't', tagline: 'tg',
  images: [{ url: 'x', is_primary: true }],
};

const SENSITIVE = ['created_by', 'stock', 'sku', 'track_stock', 'unlimited_stock', 'status', 'tenant_id'];

test('toPublicProduct EXCLUT tous les champs sensibles', () => {
  const pub = svc.toPublicProduct(RAW);
  for (const k of SENSITIVE) {
    assert.ok(!(k in pub), `champ sensible « ${k} » FUIT dans la réponse publique`);
  }
});

test('toPublicProduct GARDE les champs vitrine + dispo booléenne', () => {
  const pub = svc.toPublicProduct(RAW);
  assert.strictEqual(pub.name, 'Équilibre Femme');
  assert.strictEqual(pub.price_cents, 2990000);
  assert.strictEqual(pub.currency, 'XAF');
  assert.strictEqual(pub.is_featured, true);
  assert.strictEqual(pub.in_stock, true);   // stock 50 → dispo, jamais le nombre
  assert.ok(Array.isArray(pub.images) && pub.images.length === 1);
});

test('in_stock : rupture (stock 0, non illimité) → false', () => {
  assert.strictEqual(svc.toPublicProduct({ ...RAW, stock: 0, unlimited_stock: false }).in_stock, false);
  assert.strictEqual(svc.toPublicProduct({ ...RAW, stock: 0, unlimited_stock: true }).in_stock, true);
});
