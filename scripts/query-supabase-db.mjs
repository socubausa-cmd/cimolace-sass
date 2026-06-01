import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const sql = process.argv.slice(2).join(' ');
if (!sql) {
  console.error('Usage: node scripts/query-supabase-db.mjs <sql>');
  process.exit(1);
}

const env = loadEnv('apps/api/.env');
const dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error('Missing DATABASE_URL in apps/api/.env');
  process.exit(1);
}

const url = new URL(dbUrl);
url.searchParams.set('default_query_exec_mode', 'simple_protocol');
url.searchParams.set('statement_cache_capacity', '0');

const result = spawnSync('supabase', ['db', 'query', '--db-url', url.toString(), sql], {
  encoding: 'utf8',
  timeout: 30_000,
});

process.stdout.write(result.stdout || '');
process.stderr.write((result.stderr || '').replaceAll(url.toString(), '[DATABASE_URL]'));
process.exit(result.status ?? 1);
