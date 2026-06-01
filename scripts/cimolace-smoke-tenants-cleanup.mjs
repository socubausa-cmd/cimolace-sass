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

function dbUrl() {
  const env = loadEnv('apps/api/.env');
  if (!env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL in apps/api/.env');
  }
  const url = new URL(env.DATABASE_URL);
  url.searchParams.set('default_query_exec_mode', 'simple_protocol');
  url.searchParams.set('statement_cache_capacity', '0');
  return url.toString();
}

function runSql(sql) {
  const url = dbUrl();
  for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean)) {
    const result = spawnSync('supabase', ['db', 'query', '--db-url', url, `${statement};`], {
      encoding: 'utf8',
      timeout: 60_000,
    });
    process.stdout.write(result.stdout || '');
    process.stderr.write((result.stderr || '').replaceAll(url, '[DATABASE_URL]'));
    if ((result.status ?? 1) !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

const args = new Set(process.argv.slice(2));
const shouldArchive = args.has('--archive');

const candidateWhere = `
  c.source = 'school_model_provisioning'
  AND c.portal_slug <> 'isna'
  AND (
    c.portal_slug LIKE 'ui-ecole-%'
    OR c.portal_slug LIKE 'ecole-e2e-%'
    OR c.portal_slug LIKE 'ecole-recette-cimolace-%'
    OR c.email LIKE 'owner-ui@%.test'
    OR c.email LIKE 'owner@ecole-e2e-%'
    OR c.email LIKE 'owner-ecole-recette-cimolace-%'
  )
`;

if (!shouldArchive) {
  runSql(`
    WITH candidates AS (
      SELECT
        c.id,
        c.name,
        c.portal_slug,
        c.status,
        c.email,
        c.created_at,
        s.id AS site_id,
        s.status AS site_status,
        s.app_tenant_id
      FROM cimolace_clients c
      LEFT JOIN cimolace_sites s ON s.client_id = c.id
      WHERE ${candidateWhere}
    )
    SELECT
      count(*) AS candidate_clients,
      count(site_id) AS linked_sites,
      count(app_tenant_id) AS linked_app_tenants,
      min(created_at) AS oldest_created_at,
      max(created_at) AS newest_created_at
    FROM candidates;

    SELECT
      c.name,
      c.portal_slug,
      c.status,
      c.email,
      c.created_at
    FROM cimolace_clients c
    WHERE ${candidateWhere}
    ORDER BY c.created_at DESC
    LIMIT 40;
  `);
  console.log('\nDRY_RUN_ONLY true');
  console.log('Pour archiver ces tenants de test: node scripts/cimolace-smoke-tenants-cleanup.mjs --archive');
  process.exit(0);
}

runSql(`
  WITH candidates AS (
    SELECT c.id, c.portal_slug
    FROM cimolace_clients c
    WHERE ${candidateWhere}
  )
  UPDATE cimolace_sites s
  SET
    status = 'archived',
    metadata = COALESCE(s.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archivedBy', 'cimolace-smoke-tenants-cleanup',
        'archivedAt', now(),
        'previousStatus', s.status
      ),
    updated_at = now()
  FROM candidates c
  WHERE s.client_id = c.id;

  WITH candidates AS (
    SELECT c.id
    FROM cimolace_clients c
    WHERE ${candidateWhere}
  )
  UPDATE cimolace_tenants t
  SET
    status = 'archived',
    metadata = COALESCE(t.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archivedBy', 'cimolace-smoke-tenants-cleanup',
        'archivedAt', now(),
        'previousStatus', t.status
      ),
    updated_at = now()
  FROM cimolace_sites s
  JOIN candidates c ON c.id = s.client_id
  WHERE t.id = s.tenant_id;

  WITH candidates AS (
    SELECT c.id
    FROM cimolace_clients c
    WHERE ${candidateWhere}
  )
  UPDATE tenants t
  SET
    status = 'archived',
    metadata = COALESCE(t.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archivedBy', 'cimolace-smoke-tenants-cleanup',
        'archivedAt', now(),
        'previousStatus', t.status
      ),
    updated_at = now()
  FROM cimolace_sites s
  JOIN candidates c ON c.id = s.client_id
  WHERE t.id = s.app_tenant_id;

  UPDATE cimolace_clients c
  SET
    status = 'cancelled',
    metadata = COALESCE(c.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archivedBy', 'cimolace-smoke-tenants-cleanup',
        'archivedAt', now(),
        'previousStatus', c.status
      ),
    updated_at = now()
  WHERE ${candidateWhere};

  SELECT
    count(*) AS archived_clients
  FROM cimolace_clients c
  WHERE ${candidateWhere}
    AND c.status = 'cancelled';
`);
