#!/usr/bin/env node
// Dépouillement VNP « vibe-surfing » (spec §6) : lit analytics_events (prod) et imprime les
// sujets les plus demandés, l'entonnoir de conversion, les actions déclenchées, et les questions
// SANS réponse (= trous de Cartographie à combler). Lecture seule.
//
// Usage :
//   node tools/vnp-stats-report.mjs            (tous tenants)
//   node tools/vnp-stats-report.mjs isna       (un tenant)
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function databaseUrl() {
  const raw = readFileSync(resolve(__dirname, '../../.env.production'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('DATABASE_URL introuvable dans .env.production');
}

async function connect() {
  const connectionString = databaseUrl();
  for (const ssl of [undefined, { rejectUnauthorized: false }]) {
    const client = new pg.Client({ connectionString, ssl });
    try { await client.connect(); return client; }
    catch (e) { await client.end().catch(() => {}); if (ssl) throw e; }
  }
}

const slug = process.argv[2] || null;
const cond = slug ? ` and tenant_slug = $1` : '';
const params = slug ? [slug] : [];
const bar = (n, max) => '█'.repeat(Math.round((n / Math.max(1, max)) * 24)).padEnd(24);

async function main() {
  const c = await connect();
  const q = (sql) => c.query(sql, params).then((r) => r.rows);

  const total = Number((await q(`select count(*) n from analytics_events where true${cond}`))[0].n);
  console.log(`\n📊  DÉPOUILLEMENT VNP${slug ? ` — ${slug}` : ''}  ·  ${total} événement(s)\n`);

  console.log('— Lieux les plus demandés (à promouvoir / remonter en priorite_tour) —');
  const nodes = await q(`select payload->>'nodeId' node, count(*) n from analytics_events where type='node_opened' and payload->>'nodeId' is not null${cond} group by 1 order by n desc limit 10`);
  const nmax = nodes.length ? Number(nodes[0].n) : 1;
  nodes.length ? nodes.forEach((r) => console.log(`  ${String(r.n).padStart(4)}  ${bar(Number(r.n), nmax)}  ${r.node}`)) : console.log('  (aucun)');

  console.log('\n— Entonnoir de conversion (par type) —');
  const funnel = await q(`select type, count(*) n from analytics_events where true${cond} group by type order by n desc`);
  funnel.length ? funnel.forEach((r) => console.log(`  ${String(r.n).padStart(4)}  ${r.type}`)) : console.log('  (aucun)');

  console.log('\n— Actions déclenchées (conversion) —');
  const acts = await q(`select payload->>'action' a, count(*) n from analytics_events where type='action_triggered' and payload->>'action' is not null${cond} group by 1 order by n desc`);
  acts.length ? acts.forEach((r) => console.log(`  ${String(r.n).padStart(4)}  ${r.a}`)) : console.log('  (aucune)');

  console.log('\n— Questions SANS réponse (TROUS de Cartographie à combler) —');
  const un = Number((await q(`select count(*) n from analytics_events where type='unanswered_question'${cond}`))[0].n);
  console.log(`  ${un} question(s) sans réponse${un ? '  ⚠️  → créer/enrichir les Lieux manquants' : ''}`);

  console.log('');
  await c.end();
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
