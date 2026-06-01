#!/usr/bin/env node
/**
 * check-migrations.mjs
 * Vérifie que toutes les tables nécessaires au site sont présentes dans Supabase.
 * Usage : node scripts/check-migrations.mjs
 */

const SUPABASE_URL = 'https://fwfupxvmwtxbtbjdeqvu.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3ZnVweHZtd3R4YnRiamRlcXZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk5MTQ2OCwiZXhwIjoyMDkzNTY3NDY4fQ.vInOwyDXAqmG8MzM2pTle8ZuTfEjEvdPJdPR5UC7eLk';

// ─────────────────────────────────────────────────────────────────────────────
// TABLES ATTENDUES — noms exacts issus des fichiers de migration SQL
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_TABLES = [
  // Phase 1 — Fondation (20250505000001_tenants.sql)
  { table: 'tenants',                   phase: 'Phase 1 — Fondation' },
  { table: 'tenant_memberships',        phase: 'Phase 1 — Fondation' },

  // Phase 1.5 — Live payant (20250505000002/003 + 20250512000006)
  { table: 'access_passes',              phase: 'Phase 1.5 — Live payant' },
  { table: 'live_sessions',              phase: 'Phase 1.5 — Live payant' },
  { table: 'live_session_participants',  phase: 'Phase 1.5 — Live payant' },
  { table: 'live_webhook_events',        phase: 'Phase 1.5 — Live payant' },

  // Phase 2 — Marketing (20250505000004_marketing.sql)
  { table: 'promo_codes',               phase: 'Phase 2 — Marketing' },
  { table: 'popups',                    phase: 'Phase 2 — Marketing' },
  { table: 'banners',                   phase: 'Phase 2 — Marketing' },

  // Billing (20250505000005_billing.sql) — table réelle = subscriptions
  { table: 'subscriptions',            phase: 'Billing' },
  { table: 'invoices',                 phase: 'Billing' },
  { table: 'billing_events',           phase: 'Billing' },

  // Cimolace Catalog (20250510000006)
  { table: 'tenant_services',          phase: 'Cimolace Catalog' },

  // Phase 3 — Forum (20260513000018_forum.sql)
  { table: 'forum_categories',         phase: 'Phase 3 — Forum' },
  { table: 'forum_topics',             phase: 'Phase 3 — Forum' },
  { table: 'forum_posts',              phase: 'Phase 3 — Forum' },

  // Phase 3 — Notifications (20260513000019)
  { table: 'notifications',            phase: 'Phase 3 — Notifications' },
  { table: 'notification_preferences', phase: 'Phase 3 — Notifications' },

  // Phase 3 — Email Engine (20260513000020)
  { table: 'email_templates',          phase: 'Phase 3 — Email Engine' },
  { table: 'email_campaigns',          phase: 'Phase 3 — Email Engine' },

  // Phase 3 — SMS Engine (20260513000021)
  { table: 'sms_logs',                 phase: 'Phase 3 — SMS Engine' },
  { table: 'whatsapp_logs',            phase: 'Phase 3 — SMS Engine' },

  // PawaPay (20260513000017) — table réelle = pawapay_deposits
  { table: 'pawapay_deposits',         phase: 'PawaPayment' },

  // MedOS (20260510000007_medos_core.sql) — tables réelles = med_*
  { table: 'med_patients',             phase: 'MedOS' },
  { table: 'med_consultation_notes',   phase: 'MedOS' },
  { table: 'med_audit_log',            phase: 'MedOS' },

  // Booking (20260513000016_booking.sql) — tables réelles
  { table: 'booking_slots',            phase: 'Booking' },
  { table: 'appointments',             phase: 'Booking' },
  { table: 'appointment_feedback',     phase: 'Booking' },

  // LIRI (20260513000015)
  { table: 'liri_conversations',       phase: 'LIRI Brain' },

  // SmartBoard (20260512000010) — tables réelles = smartboard_decks/slides
  { table: 'smartboard_decks',         phase: 'SmartBoard' },
  { table: 'smartboard_slides',        phase: 'SmartBoard' },

  // Phase 4 — IA et vidéo (20260513000022_ai_video.sql)
  { table: 'course_pipelines',         phase: 'Phase 4 — Course Builder' },
  { table: 'pipeline_segments',        phase: 'Phase 4 — Course Builder' },
  { table: 'render_jobs',              phase: 'Phase 4 — Course Builder' },
  { table: 'masterclasses',            phase: 'Phase 4 — Masterclass Factory' },
  { table: 'masterclass_modules',      phase: 'Phase 4 — Masterclass Factory' },
  { table: 'masterclass_lessons',      phase: 'Phase 4 — Masterclass Factory' },
  { table: 'video_assets',             phase: 'Phase 4 — Video Engine' },
  { table: 'ai_jobs',                  phase: 'Phase 4 — AI Worker' },
];

// ─────────────────────────────────────────────────────────────────────────────

async function checkTable(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?limit=0`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  return res.ok; // 200 = table existe, 404 = absente
}

async function main() {
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  🔍  Vérification des migrations Supabase                       │');
  console.log(`│  🌐  ${SUPABASE_URL}  │`);
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  let currentPhase = '';
  let ok = 0, missing = 0;
  const missingList = [];

  for (const { table, phase } of REQUIRED_TABLES) {
    if (phase !== currentPhase) {
      console.log(`\n  📦  ${phase}`);
      currentPhase = phase;
    }

    const exists = await checkTable(table);
    if (exists) {
      console.log(`     ✅  ${table}`);
      ok++;
    } else {
      console.log(`     ❌  ${table}  ← MANQUANTE`);
      missing++;
      missingList.push({ table, phase });
    }
  }

  console.log('');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`  Résultat : ${ok} présentes  /  ${missing} manquantes  /  ${REQUIRED_TABLES.length} total`);
  console.log('─────────────────────────────────────────────────────────────────');

  if (missingList.length === 0) {
    console.log('  🎉  Toutes les migrations sont en place — le site peut démarrer.\n');
  } else {
    console.log('\n  ⚠️   Tables manquantes à migrer :');
    for (const { table, phase } of missingList) {
      console.log(`        • ${table}  (${phase})`);
    }
    console.log('');
    console.log('  👉  Applique les fichiers SQL correspondants dans le SQL Editor Supabase.');
    console.log('      Dossier : supabase/migrations/\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Erreur réseau :', err.message);
  process.exit(1);
});
