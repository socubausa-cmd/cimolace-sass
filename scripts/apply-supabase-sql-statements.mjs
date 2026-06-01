import { existsSync, readFileSync } from 'fs';
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

function stripLineComments(sql) {
  return sql
    .split(/\r?\n/)
    .map((line) => {
      let out = '';
      let single = false;
      let double = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        const next = line[i + 1];
        if (ch === "'" && !double) single = !single;
        else if (ch === '"' && !single) double = !double;
        if (!single && !double && ch === '-' && next === '-') break;
        out += ch;
      }
      return out;
    })
    .join('\n');
}

function splitSql(sql) {
  const source = stripLineComments(sql);
  const parts = [];
  let current = '';
  let single = false;
  let double = false;
  let dollarTag = null;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (!single && !double) {
      if (dollarTag) {
        if (source.startsWith(dollarTag, i)) {
          current += dollarTag;
          i += dollarTag.length - 1;
          dollarTag = null;
          continue;
        }
      } else {
        const match = source.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
        if (match) {
          dollarTag = match[0];
          current += dollarTag;
          i += dollarTag.length - 1;
          continue;
        }
      }
    }

    if (!dollarTag && ch === "'" && !double) {
      single = !single;
      current += ch;
      continue;
    }
    if (!dollarTag && ch === '"' && !single) {
      double = !double;
      current += ch;
      continue;
    }
    if (!single && !double && !dollarTag && ch === ';') {
      const statement = current.trim();
      if (statement) parts.push(`${statement};`);
      current = '';
      continue;
    }
    current += ch;
  }

  const tail = current.trim();
  if (tail) parts.push(tail);
  return parts;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/apply-supabase-sql-statements.mjs <file.sql> [...]');
  process.exit(1);
}

const env = loadEnv('apps/api/.env');
let dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error('Missing DATABASE_URL in apps/api/.env');
  process.exit(1);
}

if (process.env.SUPABASE_DIRECT_DB === '1') {
  const ref = existsSync('supabase/.temp/project-ref')
    ? readFileSync('supabase/.temp/project-ref', 'utf8').trim()
    : null;
  if (!ref) {
    console.error('Missing supabase/.temp/project-ref for direct DB URL');
    process.exit(1);
  }
  const directUrl = new URL(dbUrl);
  directUrl.username = 'postgres';
  directUrl.hostname = `db.${ref}.supabase.co`;
  directUrl.port = '5432';
  directUrl.search = '';
  dbUrl = directUrl.toString();
}

if (process.env.SUPABASE_SIMPLE_PROTOCOL === '1') {
  const simpleUrl = new URL(dbUrl);
  simpleUrl.searchParams.set('default_query_exec_mode', 'simple_protocol');
  simpleUrl.searchParams.set('statement_cache_capacity', '0');
  dbUrl = simpleUrl.toString();
}

let applied = 0;
for (const file of files) {
  const statements = splitSql(readFileSync(file, 'utf8'));
  console.log(`APPLY ${file} (${statements.length} statements)`);

  for (let i = 0; i < statements.length; i += 1) {
    const result = spawnSync(
      'supabase',
      ['db', 'query', '--db-url', dbUrl, statements[i]],
      { encoding: 'utf8', timeout: 60_000 },
    );

    if ((result.status ?? 1) !== 0) {
      console.error(`FAILED ${file} statement ${i + 1}/${statements.length}`);
      console.error((result.stderr || '').replaceAll(dbUrl, '[DATABASE_URL]'));
      console.error((result.stdout || '').replaceAll(dbUrl, '[DATABASE_URL]'));
      process.exit(result.status ?? 1);
    }
    applied += 1;
  }
}

console.log(`APPLIED_STATEMENTS ${applied}`);
