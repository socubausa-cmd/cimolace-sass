import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const env = {};
for (const file of ['apps/api/.env', 'apps/app/.env', 'apps/app/.env.local']) {
  if (!fs.existsSync(path.join(root, file))) continue;
  for (const line of fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !serviceKey || !anonKey) throw new Error('Configuration Supabase incomplète.');

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const sourceId = process.env.MF_SOURCE_ID || '8719c02e-34bb-4008-8e94-3a179630bd7a';
const apiOrigin = process.env.API_ORIGIN || 'http://localhost:4002';
const email = `codex-mf-${Date.now()}@cimolace.test`;
const password = `CodexMF!${Date.now()}`;
let userId;

async function call(token, force) {
  const response = await fetch(`${apiOrigin}/master-factory/enrich/visual-pedagogy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': 'isna' },
    body: JSON.stringify({ sourceType: 'replay', sourceId, force }),
    signal: AbortSignal.timeout(15 * 60_000),
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: response.status, body };
}

try {
  const tenant = await admin.from('tenants').select('id').eq('slug', 'isna').single();
  if (tenant.error) throw tenant.error;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const membership = await admin.from('tenant_memberships').insert({ tenant_id: tenant.data.id, user_id: userId, role: 'owner' });
  if (membership.error) throw membership.error;
  const signed = await authClient.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;

  const first = await call(signed.data.session.access_token, process.env.MF_FORCE === '1');
  const second = first.status < 300 ? await call(signed.data.session.access_token, false) : null;
  const proof = { generatedAt: new Date().toISOString(), sourceId, first, second };
  const outDir = path.join(root, 'artifacts/master-factory-course-review-20260729');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'visual-pedagogy-persistence-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({
    firstStatus: first.status,
    firstError: first.status >= 300 ? first.body : undefined,
    firstPersisted: first.body?.persisted,
    firstCached: first.body?.cached,
    secondStatus: second?.status,
    secondPersisted: second?.body?.persisted,
    secondCached: second?.body?.cached,
    pivotIdStable: !!first.body?.pivotId && first.body?.pivotId === second?.body?.pivotId,
  }, null, 2));
  if (first.status >= 300 || second?.status >= 300) process.exitCode = 1;
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}
