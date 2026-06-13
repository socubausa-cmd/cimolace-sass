#!/usr/bin/env node
/**
 * Runner SQL prod générique (db push est cassé ici → fallback pg direct).
 * DATABASE_URL lu depuis ../../.env.production (jamais affiché).
 *
 * Usage :
 *   node run-sql.js --file ../../supabase/migrations/XXXX.sql
 *   node run-sql.js --sql "SELECT 1;"
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadDatabaseUrl() {
  const envPath = path.resolve(__dirname, '../../.env.production');
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('DATABASE_URL introuvable dans .env.production');
}

async function connect() {
  const connectionString = loadDatabaseUrl();
  for (const ssl of [undefined, { rejectUnauthorized: false }]) {
    const client = new Client({ connectionString, ssl });
    try { await client.connect(); return client; }
    catch (e) { await client.end().catch(() => {}); if (ssl) throw e; }
  }
}

async function main() {
  const args = process.argv.slice(2);
  let sql = null;
  const fileIdx = args.indexOf('--file');
  const sqlIdx = args.indexOf('--sql');
  if (fileIdx !== -1) sql = fs.readFileSync(path.resolve(process.cwd(), args[fileIdx + 1]), 'utf8');
  else if (sqlIdx !== -1) sql = args[sqlIdx + 1];
  if (!sql) { console.error('Fournir --file <path> ou --sql "<sql>"'); process.exit(1); }

  const client = await connect();
  console.log('✅ Connecté (prod)\n');
  try {
    const res = await client.query(sql);
    const results = Array.isArray(res) ? res : [res];
    for (const r of results) {
      if (r.command) console.log(`» ${r.command}${r.rowCount != null ? ` (${r.rowCount})` : ''}`);
      if (r.rows && r.rows.length) console.table(r.rows);
    }
    console.log('\n✅ OK');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('❌ Fatal:', e.message); process.exit(1); });
