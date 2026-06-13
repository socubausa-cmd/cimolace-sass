#!/usr/bin/env node
/**
 * READ-ONLY : inspecte la publication `supabase_realtime` en prod.
 * - liste les tables actuellement publiées
 * - affiche la replica identity des tables live ciblées
 * DATABASE_URL est lu depuis ../../.env.production (jamais affiché).
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
  // pooler Supabase : tente sans ssl puis avec ssl relaxé
  for (const ssl of [undefined, { rejectUnauthorized: false }]) {
    const client = new Client({ connectionString, ssl });
    try {
      await client.connect();
      return client;
    } catch (e) {
      await client.end().catch(() => {});
      if (ssl) throw e;
    }
  }
}

async function main() {
  const client = await connect();
  console.log('✅ Connecté (prod)\n');

  const pub = await client.query(`
    SELECT schemaname, tablename
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    ORDER BY tablename;
  `);
  console.log(`📡 Publication supabase_realtime — ${pub.rows.length} table(s) :`);
  for (const r of pub.rows) console.log(`   - ${r.schemaname}.${r.tablename}`);

  // Réglage de la publication (FOR ALL TABLES ?)
  const pubDef = await client.query(`
    SELECT puballtables, pubinsert, pubupdate, pubdelete
    FROM pg_publication WHERE pubname = 'supabase_realtime';
  `);
  console.log('\n⚙️  pg_publication:', JSON.stringify(pubDef.rows[0] || null));

  // Replica identity des tables live ciblées
  const targets = [
    'live_waiting_room_entries', 'live_scenes', 'live_sessions',
    'debates', 'debate_rounds', 'debate_votes', 'debate_ai_reports',
    'immersive_live_chat_messages', 'immersive_live_sessions',
    'live_visibility_rules', 'live_session_proctor_camera_events',
    'live_notifications', 'live_neuro_recall_state', 'live_session_guest_notes',
    'live_questions', 'live_invitations', 'privileged_seats',
  ];
  const ri = await client.query(`
    SELECT c.relname,
           CASE c.relreplident WHEN 'd' THEN 'default(pk)' WHEN 'f' THEN 'full'
                WHEN 'n' THEN 'nothing' WHEN 'i' THEN 'index' END AS replica_identity,
           EXISTS (SELECT 1 FROM pg_publication_tables pt
                   WHERE pt.pubname='supabase_realtime' AND pt.tablename=c.relname) AS in_pub
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname = ANY($1)
    ORDER BY c.relname;
  `, [targets]);
  console.log('\n🔎 Tables live ciblées (existence / replica identity / déjà publiée) :');
  const found = new Set();
  for (const r of ri.rows) {
    found.add(r.relname);
    console.log(`   - ${r.relname.padEnd(38)} ${String(r.replica_identity).padEnd(12)} in_pub=${r.in_pub}`);
  }
  const missing = targets.filter((t) => !found.has(t));
  if (missing.length) console.log('\n   ⚠️ Tables CIBLÉES INEXISTANTES en DB :', missing.join(', '));

  await client.end();
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
