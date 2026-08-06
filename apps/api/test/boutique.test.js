'use strict';
/**
 * Test — boutique numérique publique (vente du PDF + avis + accompagnement).
 *
 * Ce qu'il protège, dans l'ordre de ce qui coûte le plus cher si ça casse :
 *  - le PRIX vient de la base, jamais du navigateur — sinon n'importe qui achète à 1 centime ;
 *  - un jeton de téléchargement expiré ou épuisé est REFUSÉ (le lien circule par e-mail,
 *    donc il finit toujours par être partagé) ;
 *  - l'avis est déposé en `pending` et ne porte JAMAIS l'e-mail de l'acheteuse : la policy
 *    anonyme de site_reviews rend la ligne approuvée lisible en entier ;
 *  - le renvoi de lien répond pareil que l'adresse ait acheté ou non (anti-énumération) ;
 *  - la demande d'accompagnement exige un consentement explicite.
 *
 *   npm run build && node --test test/boutique.test.js     (depuis apps/api)
 */
const test = require('node:test');
const assert = require('node:assert');
const { BoutiqueService } = require('../dist/boutique/boutique.service.js');

const PRODUCT = {
  slug: 'femme-nouvelle',
  tenant_slug: 'isna',
  title: 'On t’a jugée sans t’entendre',
  subtitle: 'Le procès',
  is_active: true,
  price_cents: 1200,
  price_xaf: 7900,
  currency: 'EUR',
  storage_bucket: 'digital-products',
  storage_path: 'femme-nouvelle/on-t-a-jugee.pdf',
  watermark: true,
  max_downloads: 5,
  download_days: 90,
  page_count: 144,
  highlights: [],
  excerpts: [],
};

/**
 * Faux client Supabase : chaînable, et pilotable table par table.
 * `rows` donne ce que renvoie une lecture ; `inserted` capte les écritures.
 */
function makeDb({ rows = {}, updateReturns = {} } = {}) {
  const inserted = [];
  const updated = [];
  const make = (table) => {
    const q = {
      _table: table,
      select: () => q,
      eq: () => q,
      ilike: () => q,
      gte: () => q,
      not: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: rows[table] ?? null }),
      single: async () => ({ data: rows[table] ?? { id: 'new-id' }, error: null }),
      insert: (payload) => {
        inserted.push({ table, payload });
        return {
          select: () => ({ single: async () => ({ data: { id: 'new-id' }, error: null }) }),
          then: (r) => r({ error: null }),
        };
      },
      update: (payload) => {
        updated.push({ table, payload });
        const u = {
          eq: () => u,
          select: async () => ({ data: updateReturns[table] ?? null }),
          then: (r) => r({ error: null }),
        };
        return u;
      },
    };
    return q;
  };
  const db = {
    from: (t) => make(t),
    storage: { from: () => ({ download: async () => ({ data: null, error: 'absent' }), upload: async () => ({}) }) },
    _inserted: inserted,
    _updated: updated,
  };
  return db;
}

function makeService(db) {
  const svc = new BoutiqueService({ client: db }, { getActiveConfig: async () => null });
  return svc;
}

// ── 1. Le prix vient de la base ────────────────────────────────────────────

test('createStripe facture le prix de la BASE, pas celui envoyé par le client', async () => {
  const db = makeDb({ rows: { digital_products: PRODUCT } });
  const svc = makeService(db);

  const captured = [];
  global.fetch = async () => ({ ok: true, json: async () => ({ id: 'cs_test', url: 'https://stripe/x' }) });
  // stripeCreateCheckoutSession lit STRIPE_SECRET_KEY ; on l'espionne via fetch.
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  const realFetch = global.fetch;
  global.fetch = async (url, init) => { captured.push(String(init?.body ?? '')); return realFetch(url, init); };

  await svc.createStripe('femme-nouvelle', {
    buyerEmail: 'lectrice@example.org',
    // Un client malveillant tenterait d'imposer son montant :
    amountCents: 1,
    priceCents: 1,
  });

  // Le corps Stripe est du form-urlencoded : les crochets sont échappés
  // (`line_items[0][price_data][unit_amount]` → `…%5Bunit_amount%5D`).
  const body = captured.join('&');
  assert.match(body, /unit_amount%5D=1200/, 'le montant doit être celui de la base (1200)');
  assert.doesNotMatch(body, /unit_amount%5D=1(&|$)/, 'le montant du client ne doit jamais passer');

  const order = db._inserted.find((i) => i.table === 'digital_orders');
  assert.equal(order.payload.amount_cents, 1200);
});

test('createPawapay facture le prix CFA de la base', async () => {
  const db = makeDb({ rows: { digital_products: PRODUCT } });
  let sent = null;
  const svc = new BoutiqueService({ client: db }, {
    getActiveConfig: async () => null,
    initiateDeposit: async (p) => { sent = p; return { status: 'ACCEPTED' }; },
  });

  const r = await svc.createPawapay('femme-nouvelle', {
    buyerEmail: 'lectrice@example.org',
    phoneNumber: '077514015',
    provider: 'AIRTEL_GAB',
    country: 'GAB',
    mobileMoneyAmount: 1, // tentative d'imposer un montant
  });

  assert.equal(sent.amount, '7900', 'le montant Mobile Money vient de price_xaf');
  assert.equal(sent.currency, 'XAF', 'le Gabon est en zone XAF');
  assert.equal(sent.payer.accountDetails.phoneNumber, '24177514015', 'MSISDN international, 0 initial retiré');
  assert.equal(r.displayAmount, 7900);
});

// ── 2. Le téléchargement est gardé ─────────────────────────────────────────

test('download refuse un jeton mal formé sans même toucher la base', async () => {
  const svc = makeService(makeDb());
  await assert.rejects(() => svc.download('pas-un-jeton'), /Lien invalide/);
  await assert.rejects(() => svc.download(''), /Lien invalide/);
});

test('download refuse un lien expiré', async () => {
  const token = 'a'.repeat(64);
  const db = makeDb({
    rows: {
      digital_orders: {
        id: 'o1', product_slug: 'femme-nouvelle', status: 'completed',
        buyer_email: 'l@example.org', download_count: 0,
        download_expires_at: new Date(Date.now() - 86400000).toISOString(),
      },
      digital_products: PRODUCT,
    },
  });
  await assert.rejects(() => makeService(db).download(token), /expiré/);
});

test('download refuse un lien dont le quota est épuisé', async () => {
  const token = 'b'.repeat(64);
  const db = makeDb({
    rows: {
      digital_orders: {
        id: 'o2', product_slug: 'femme-nouvelle', status: 'completed',
        buyer_email: 'l@example.org', download_count: 5,
        download_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      digital_products: PRODUCT,
    },
  });
  await assert.rejects(() => makeService(db).download(token), /nombre maximum/);
});

test('download refuse une commande non payée', async () => {
  const token = 'c'.repeat(64);
  const db = makeDb({
    rows: {
      digital_orders: { id: 'o3', product_slug: 'femme-nouvelle', status: 'pending' },
      digital_products: PRODUCT,
    },
  });
  await assert.rejects(() => makeService(db).download(token), /Lien invalide/);
});

// ── 3. Les avis ────────────────────────────────────────────────────────────

test('un avis est déposé en attente et ne stocke JAMAIS l’e-mail', async () => {
  const db = makeDb({
    rows: { digital_products: PRODUCT, digital_orders: { id: 'order-42' } },
  });
  const svc = makeService(db);
  const r = await svc.submitReview('femme-nouvelle', {
    authorName: 'Awa', rating: 5, reviewText: 'Ce livre m’a remise debout.',
    buyerEmail: 'awa@example.org',
  });

  const row = db._inserted.find((i) => i.table === 'site_reviews').payload;
  assert.equal(row.status, 'pending', 'rien ne s’affiche sans modération');
  assert.equal(row.order_id, 'order-42', 'l’avis est rattaché à la commande');
  assert.equal(row.is_verified, true);
  assert.equal(r.verified, true);
  const serialized = JSON.stringify(row);
  assert.doesNotMatch(serialized, /awa@example\.org/, 'l’e-mail ne doit pas atterrir dans site_reviews');
});

test('le pot de miel fait taire le robot sans rien écrire', async () => {
  const db = makeDb({ rows: { digital_products: PRODUCT } });
  const svc = makeService(db);
  const r = await svc.submitReview('femme-nouvelle', {
    authorName: 'Bot', rating: 5, reviewText: 'promo montres', website: 'http://spam',
  });
  assert.equal(r.status, 'received', 'le robot ne doit pas voir qu’il a été filtré');
  assert.equal(db._inserted.length, 0, 'aucune écriture en base');
});

// ── 4. Renvoi de lien : réponse indistinguable ─────────────────────────────

test('resendLink répond pareil que l’adresse ait acheté ou non', async () => {
  const acheteuse = makeService(makeDb({
    rows: { digital_products: PRODUCT, digital_orders: { id: 'o9', buyer_email: 'a@example.org' } },
  }));
  const inconnue = makeService(makeDb({ rows: { digital_products: PRODUCT, digital_orders: null } }));

  const r1 = await acheteuse.resendLink('femme-nouvelle', 'a@example.org');
  const r2 = await inconnue.resendLink('femme-nouvelle', 'jamais-vue@example.org');
  assert.deepEqual(r1, r2, 'une réponse différenciée permettrait d’énumérer les acheteuses');
});

// ── 5. Accompagnement ──────────────────────────────────────────────────────

test('une demande d’accompagnement sans consentement est refusée', async () => {
  const db = makeDb({ rows: { accompaniment_programs: { slug: 'p', tenant_slug: 'isna', is_active: true } } });
  await assert.rejects(
    () => makeService(db).createRequest('p', { fullName: 'X', email: 'x@example.org', consent: false }),
    /recontacter/,
  );
  assert.equal(db._inserted.length, 0);
});

test('une demande valide est enregistrée avec son consentement', async () => {
  const db = makeDb({ rows: { accompaniment_programs: { slug: 'p', tenant_slug: 'isna', is_active: true } } });
  const svc = makeService(db);
  const r = await svc.createRequest('p', {
    fullName: 'Awa N.', email: 'awa@example.org', phone: '077514015',
    formulaKey: 'parcours', channel: 'whatsapp', consent: true,
  });
  assert.equal(r.status, 'received');
  const row = db._inserted.find((i) => i.table === 'accompaniment_requests').payload;
  assert.equal(row.consent, true);
  assert.equal(row.status, undefined, 'le statut par défaut « nouvelle » vient de la base');
  assert.equal(row.formula_key, 'parcours');
});
