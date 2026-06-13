#!/usr/bin/env node
/**
 * PREUVE end-to-end NON-INTRUSIVE de la chaîne publication → Realtime en prod.
 * Crée une table jetable, l'ajoute à supabase_realtime, s'abonne via supabase-js,
 * insère une ligne, et vérifie la réception de l'event postgres_changes.
 * Aucune donnée métier n'est touchée. Cleanup garanti (DROP TABLE).
 *
 * Auth en service_role → bypass RLS : isole la PUBLICATION (le fix) de la RLS.
 */
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const { createClient } = require(path.resolve(__dirname, '../../node_modules/@supabase/supabase-js'));

function env(key) {
  const raw = fs.readFileSync(path.resolve(__dirname, '../../.env.production'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(new RegExp(`^${key}=(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

async function pgConnect() {
  const connectionString = env('DATABASE_URL');
  for (const ssl of [undefined, { rejectUnauthorized: false }]) {
    const c = new Client({ connectionString, ssl });
    try { await c.connect(); return c; } catch (e) { await c.end().catch(() => {}); if (ssl) throw e; }
  }
}

const PROBE = '_rt_probe_realtime_check';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICE_ROLE = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('SUPABASE_URL / SERVICE_ROLE_KEY manquants');

  const pg = await pgConnect();
  console.log('✅ pg connecté (prod)');

  // 1) table jetable + ajout à la publication
  await pg.query(`DROP TABLE IF EXISTS public.${PROBE};`);
  await pg.query(`CREATE TABLE public.${PROBE} (id bigint PRIMARY KEY, note text);`);
  await pg.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${PROBE};`);
  console.log(`✅ table jetable ${PROBE} créée + ajoutée à supabase_realtime`);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  let received = null;
  const got = new Promise((resolve) => {
    supabase
      .channel(`probe-${PROBE}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: PROBE }, (payload) => {
        received = payload.new;
        resolve(true);
      })
      .subscribe((status) => console.log(`   canal realtime: ${status}`));
  });

  // 2) laisser Realtime recharger la publication, puis insérer (avec retries)
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    await sleep(2500);
    await pg.query(`INSERT INTO public.${PROBE} (id, note) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING;`, [attempt, `probe-${attempt}`]);
    console.log(`   → INSERT #${attempt} émis, attente de l'event…`);
    ok = await Promise.race([got, sleep(6000).then(() => false)]);
  }

  // 3) cleanup (DROP retire aussi de la publication)
  await supabase.removeAllChannels();
  await pg.query(`DROP TABLE IF EXISTS public.${PROBE};`);
  await pg.end();

  if (ok && received) {
    console.log(`\n✅ PREUVE OK — event INSERT realtime reçu :`, JSON.stringify(received));
    console.log('   → La chaîne publication → Realtime fonctionne en prod.');
    process.exit(0);
  } else {
    console.log('\n❌ Aucun event realtime reçu (timeout). Le mécanisme publication→Realtime ne répond pas.');
    process.exit(2);
  }
}

main().catch((e) => { console.error('❌ Fatal:', e.message); process.exit(1); });
