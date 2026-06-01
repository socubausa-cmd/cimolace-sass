import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [rawKey, ...rawValue] = trimmed.split('=');
    env[rawKey.trim()] = rawValue.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error('Usage: node scripts/apply-sql-file.mjs <path-to-sql>');
  process.exit(1);
}

const env = loadEnv(resolve('apps/api/.env'));
const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/api/.env');
  process.exit(1);
}

const sql = readFileSync(resolve(sqlPath), 'utf8');
const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`exec_sql failed: HTTP ${res.status}`);
  console.error(text);
  process.exit(1);
}

console.log(`Applied ${sqlPath}`);
