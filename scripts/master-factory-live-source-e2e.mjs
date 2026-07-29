import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const file of ['apps/api/.env', 'apps/app/.env', 'apps/app/.env.local']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const client = createClient(url, env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const api = process.env.API_ORIGIN || 'http://localhost:4002';
const email = `codex-live-${Date.now()}@cimolace.test`;
const password = `CodexLive!${Date.now()}`;
let userId;
let sessionId;

try {
  const tenant = await admin.from('tenants').select('id').eq('slug', 'isna').single();
  if (tenant.error) throw tenant.error;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const membership = await admin.from('tenant_memberships').insert({ tenant_id: tenant.data.id, user_id: userId, role: 'owner' });
  if (membership.error) throw membership.error;
  const now = Date.now();
  const inserted = await admin.from('live_sessions').insert({
    tenant_id: tenant.data.id,
    host_user_id: userId,
    teacher_id: userId,
    title: 'E2E Master Factory — LIVE temporaire',
    description: 'Source temporaire supprimée automatiquement après le test.',
    scheduled_at: new Date(now - 3_600_000).toISOString(),
    started_at: new Date(now - 3_000_000).toISOString(),
    ended_at: new Date(now - 1_200_000).toISOString(),
    status: 'ended',
    session_type: 'class',
    kind: 'class',
    replay_enabled: true,
  }).select('id').single();
  if (inserted.error) throw inserted.error;
  sessionId = inserted.data.id;
  const state = await admin.from('live_neuro_recall_state').insert({
    live_session_id: sessionId,
    workflow_status: 'pending_review',
    transcript_text: '[00:00] Une graine ne devient pas arbre en un jour.\n[00:12] La pratique répétée transforme une notion en compétence.\n[00:35] On vérifie le transfert quand l’élève applique seul la méthode dans une situation nouvelle.',
  });
  if (state.error) throw state.error;
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  const headers = { Authorization: `Bearer ${signed.data.session.access_token}`, 'X-Tenant-Slug': 'isna' };
  const sourceResponse = await fetch(`${api}/master-factory/source/live/${sessionId}`, { headers });
  const sourceEnvelope = await sourceResponse.json();
  const source = sourceEnvelope?.data || sourceEnvelope;
  const listResponse = await fetch(`${api}/master-factory/sources/live`, { headers });
  const list = await listResponse.json();
  const found = (Array.isArray(list) ? list : list?.data || []).find((item) => item.id === sessionId);
  const screenshotPath = path.resolve('artifacts/master-factory-course-review-20260729/35-live-source-atelier-real.png');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const ref = new URL(url).host.split('.')[0];
    await page.addInitScript(({ key, value }) => {
      localStorage.setItem(key, value);
      localStorage.setItem('tenantSlug', 'isna');
    }, { key: `sb-${ref}-auth-token`, value: JSON.stringify(signed.data.session) });
    await page.goto(`http://localhost:5173/liri/atelier?mfSourceType=live&mfSourceId=${sessionId}`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.getByRole('heading', { name: 'Atelier de cours' }).waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByText('E2E Master Factory — LIVE temporaire', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } finally {
    await browser.close();
  }
  const proof = {
    generatedAt: new Date().toISOString(),
    sourceStatus: sourceResponse.status,
    listStatus: listResponse.status,
    source,
    listed: found || null,
    screenshotPath,
  };
  const out = path.join('artifacts/master-factory-course-review-20260729/live-source-e2e-proof.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ sourceStatus: sourceResponse.status, listStatus: listResponse.status, ready: source?.ready, chars: source?.chars, listedReady: found?.ready }, null, 2));
  if (sourceResponse.status >= 300 || listResponse.status >= 300 || !source?.ready || !found?.ready) process.exitCode = 1;
} finally {
  if (sessionId) await admin.from('live_sessions').delete().eq('id', sessionId);
  if (userId) await admin.auth.admin.deleteUser(userId);
}
