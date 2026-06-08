// Apply migration 20250510000006_cimolace_catalog.sql to Supabase dev
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', 'apps', 'api', '.env');

// Parse .env
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function runSql(sql) {
  // Execute SQL via RPC (if pg_execute is available) or direct REST
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return res;
}

async function main() {
  // Step 1: Add infrastructure_type column (idempotent via REST API)
  // We can't run DDL via REST, but we can check if it exists and apply via raw SQL
  
  console.log('=== Checking current schema state ===');
  
  // Check if tenant_services exists
  const { error: checkErr } = await supabase.from('tenant_services').select('id').limit(1);
  if (!checkErr) {
    console.log('tenant_services table already exists');
  } else {
    console.log(`tenant_services table does not exist: ${checkErr.message}`);
  }
  
  // Check if infrastructure_type exists on tenants
  const { error: colErr } = await supabase.from('tenants').select('infrastructure_type').limit(1);
  if (!colErr) {
    console.log('infrastructure_type column exists on tenants');
    // Check constraint
    const { data: constraintData } = await supabase.rpc('get_constraint_info', { 
      table_name: 'tenants', 
      constraint_name: 'tenants_infrastructure_type_check' 
    }).maybeSingle();
    console.log('constraint check:', constraintData);
  } else {
    console.log(`infrastructure_type column missing: ${colErr.message}`);
  }
  
  console.log('\n=== NOTE: DDL migration must be applied via Supabase SQL Editor or supabase CLI ===');
  console.log('Run this command to apply the migration:');
  console.log(`  cd ${join(__dirname, '..')} && supabase db push --include-all`);
  console.log('\nOr copy/paste the content of:');
  console.log('  supabase/migrations/20250510000006_cimolace_catalog.sql');
  console.log('into the Supabase Dashboard SQL Editor');
}

main().catch(console.error);
