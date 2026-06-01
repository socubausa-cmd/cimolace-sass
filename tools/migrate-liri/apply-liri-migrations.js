#!/usr/bin/env node
/**
 * Applique les migrations LIRI v1 → DB Supabase v2 en tolérant les conflits
 * "already exists" (utile car v1 et v2 partagent certaines tables de base).
 *
 * Usage : node apply-liri-migrations.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.fwfupxvmwtxbtbjdeqvu:hgUTaXqu1vZmX7vC@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';
const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');

// Patterns LIRI à appliquer (les NOUVELLES migrations LIRI ajoutées depuis v1)
const LIRI_PATTERNS = /(live|liri|smart|recall|multilang|tts|annotation|whiteboard|neuro|booking_live|immersive|arena|script)/i;

async function main() {
  const allFiles = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .filter(f => LIRI_PATTERNS.test(f))
    .sort();

  console.log(`📊 ${allFiles.length} migrations LIRI à tenter`);

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('✅ Connecté à Supabase\n');

  let applied = 0, skipped = 0, failed = 0;
  const failures = [];

  for (const file of allFiles) {
    const sqlPath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Wrap in a transaction with savepoint pour pouvoir continuer après erreur
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`  ✅ ${file}`);
      applied++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const msg = err.message || '';
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        msg.includes('does not exist') && msg.includes('relation')  // référence à table v1 absente
      ) {
        console.log(`  ⏭️  ${file} (${msg.slice(0, 60)}…)`);
        skipped++;
      } else {
        console.log(`  ❌ ${file}: ${msg.slice(0, 100)}`);
        failed++;
        failures.push({ file, error: msg });
      }
    }
  }

  await client.end();

  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ Appliquées : ${applied}`);
  console.log(`⏭️  Sautées : ${skipped} (déjà existantes ou refs invalides)`);
  console.log(`❌ Échouées : ${failed}`);

  if (failures.length) {
    console.log(`\n⚠️  Échecs détaillés :`);
    failures.forEach(f => {
      console.log(`\n${f.file}\n  → ${f.error}`);
    });
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
