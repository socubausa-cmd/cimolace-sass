#!/usr/bin/env node
/**
 * test-api.mjs
 * Tests HTTP des endpoints clés de l'API ISNA.
 *
 * Prérequis : l'API doit tourner sur le port 4002
 *   npm run start:dev -w @isna/api
 *
 * Usage :
 *   node scripts/test-api.mjs
 *   node scripts/test-api.mjs --token <JWT>   (pour les endpoints authentifiés)
 */

const BASE = 'http://localhost:4002';
const TOKEN = process.argv.includes('--token')
  ? process.argv[process.argv.indexOf('--token') + 1]
  : null;

let passed = 0, failed = 0, skipped = 0;

// ─── helpers ────────────────────────────────────────────────────────────────

function color(str, code) { return `\x1b[${code}m${str}\x1b[0m`; }
const green  = s => color(s, '32');
const red    = s => color(s, '31');
const yellow = s => color(s, '33');
const bold   = s => color(s, '1');

async function req(method, path, body, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  } catch (e) {
    return { status: 0, error: e.message };
  }
}

async function test(label, fn) {
  try {
    const result = await fn();
    if (result.skip) {
      console.log(`  ${yellow('⏭')}  ${label}  ${yellow('(skip — JWT requis)')}`);
      skipped++;
      return;
    }
    if (result.ok) {
      console.log(`  ${green('✅')}  ${label}  ${color(`[${result.status}]`, '90')}`);
      passed++;
    } else {
      console.log(`  ${red('❌')}  ${label}  ${red(`[${result.status}]`)}  ${color(result.reason || '', '90')}`);
      failed++;
    }
  } catch (e) {
    console.log(`  ${red('❌')}  ${label}  ${red(e.message)}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n  ${bold('📦  ' + title)}`);
}

// ─── tests ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log(bold('┌──────────────────────────────────────────────────────────┐'));
  console.log(bold(`│  🚀  Test API ISNA  →  ${BASE}              │`));
  console.log(bold('└──────────────────────────────────────────────────────────┘'));

  // ── Santé ────────────────────────────────────────────────────────────────
  section('Health');

  await test('GET /health → 200', async () => {
    const r = await req('GET', '/health');
    if (r.status === 0) throw new Error(`API non démarrée : ${r.error}`);
    return { ok: r.status === 200, status: r.status };
  });

  await test('GET / → 200 ou 404 (racine)', async () => {
    const r = await req('GET', '/');
    return { ok: [200, 404].includes(r.status), status: r.status };
  });

  // ── Auth ─────────────────────────────────────────────────────────────────
  // Auth = Supabase côté client. L'API expose uniquement GET /auth/me
  section('Auth');

  await test('GET /auth/me → 401 sans token', async () => {
    const r = await req('GET', '/auth/me');
    return { ok: r.status === 401, status: r.status };
  });

  await test('GET /auth/me → 200 avec token', async () => {
    if (!TOKEN) return { skip: true };
    const r = await req('GET', '/auth/me', null, true);
    return { ok: r.status === 200, status: r.status };
  });

  // ── Forum ────────────────────────────────────────────────────────────────
  // Routes réelles : GET categories, GET topics, POST topics, POST topics/:id/posts
  section('Forum');

  await test('GET /forum/categories → 401 sans token', async () => {
    const r = await req('GET', '/forum/categories?tenantId=test');
    return { ok: r.status === 401, status: r.status };
  });

  await test('GET /forum/topics → 401 sans token', async () => {
    const r = await req('GET', '/forum/topics?tenantId=test');
    return { ok: r.status === 401, status: r.status };
  });

  await test('POST /forum/topics → 401 sans token', async () => {
    const r = await req('POST', '/forum/topics', { title: 'test', tenantId: 'x' });
    return { ok: r.status === 401, status: r.status };
  });

  await test('GET /forum/categories → 200 avec token', async () => {
    if (!TOKEN) return { skip: true };
    const r = await req('GET', '/forum/categories?tenantId=00000000-0000-0000-0000-000000000001', null, true);
    return { ok: [200, 404].includes(r.status), status: r.status };
  });

  // ── Notifications ────────────────────────────────────────────────────────
  // Routes réelles : GET /, POST /send, PATCH /:id/read, GET+PATCH /preferences
  section('Notifications');

  await test('GET /notifications → 401 sans token', async () => {
    const r = await req('GET', '/notifications');
    return { ok: r.status === 401, status: r.status };
  });

  await test('POST /notifications/send → 401 sans token', async () => {
    const r = await req('POST', '/notifications/send', { type: 'test' });
    return { ok: r.status === 401, status: r.status };
  });

  await test('PATCH /notifications/abc/read → 401 sans token', async () => {
    const r = await req('PATCH', '/notifications/abc/read');
    return { ok: r.status === 401, status: r.status };
  });

  await test('GET /notifications → 200 avec token', async () => {
    if (!TOKEN) return { skip: true };
    const r = await req('GET', '/notifications', null, true);
    return { ok: r.status === 200, status: r.status };
  });

  // ── Email Engine ─────────────────────────────────────────────────────────
  section('Email Engine');

  await test('GET /email-engine/templates → 401 sans token', async () => {
    const r = await req('GET', '/email-engine/templates');
    return { ok: r.status === 401, status: r.status };
  });

  // ── Billing ──────────────────────────────────────────────────────────────
  section('Billing');

  await test('GET /billing/subscription → 401 sans token', async () => {
    const r = await req('GET', '/billing/subscription');
    return { ok: r.status === 401, status: r.status };
  });

  await test('GET /billing/invoices → 401 sans token', async () => {
    const r = await req('GET', '/billing/invoices');
    return { ok: r.status === 401, status: r.status };
  });

  // ── Booking ──────────────────────────────────────────────────────────────
  section('Booking');

  await test('GET /booking/slots → 401 sans token', async () => {
    const r = await req('GET', '/booking/slots');
    return { ok: r.status === 401, status: r.status };
  });

  await test('GET /booking/appointments → 401 sans token', async () => {
    const r = await req('GET', '/booking/appointments');
    return { ok: r.status === 401, status: r.status };
  });

  // ── Marketing ────────────────────────────────────────────────────────────
  section('Marketing');

  await test('GET /marketing/promo-codes → 401 sans token', async () => {
    const r = await req('GET', '/marketing/promo-codes');
    return { ok: r.status === 401, status: r.status };
  });

  await test('GET /marketing/popups → 401 sans token', async () => {
    const r = await req('GET', '/marketing/popups');
    return { ok: r.status === 401, status: r.status };
  });

  // ── MedOS ─────────────────────────────────────────────────────────────────
  section('MedOS');

  await test('GET /med/patients → 401 sans token', async () => {
    const r = await req('GET', '/med/patients');
    return { ok: r.status === 401, status: r.status };
  });

  // ── LIRI Brain ────────────────────────────────────────────────────────────
  section('LIRI Brain');

  await test('GET /liri/brain/models → 401 sans token', async () => {
    const r = await req('GET', '/liri/brain/models');
    return { ok: r.status === 401, status: r.status };
  });

  await test('GET /liri/brain/conversations → 401 sans token', async () => {
    const r = await req('GET', '/liri/brain/conversations');
    return { ok: r.status === 401, status: r.status };
  });

  // ─── résumé ───────────────────────────────────────────────────────────────
  const total = passed + failed + skipped;
  console.log('');
  console.log('──────────────────────────────────────────────────────────────');
  console.log(`  ${green(`${passed} passés`)}  /  ${failed > 0 ? red(`${failed} échoués`) : '0 échoués'}  /  ${yellow(`${skipped} skippés (JWT)`)}  /  ${total} total`);
  console.log('──────────────────────────────────────────────────────────────');

  if (failed === 0) {
    console.log(`\n  ${green('🎉  API opérationnelle — tous les endpoints répondent correctement.')}\n`);
  } else {
    console.log(`\n  ${red('⚠️   Certains endpoints échouent. Vérifie les logs du serveur.')}\n`);
    process.exit(1);
  }

  if (skipped > 0 && !TOKEN) {
    console.log(`  💡  Pour tester les endpoints authentifiés :`);
    console.log(`      node scripts/test-api.mjs --token <ton_JWT_Supabase>\n`);
  }
}

main().catch(err => {
  console.error(red('\nErreur fatale :'), err.message);
  console.log(yellow('\n  👉  L\'API est-elle démarrée ?  npm run start:dev -w @isna/api\n'));
  process.exit(1);
});
