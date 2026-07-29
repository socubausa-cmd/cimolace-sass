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
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const admin = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const api = process.env.API_ORIGIN || 'http://localhost:4002';
const email = `codex-url-${Date.now()}@cimolace.test`;
const password = `CodexUrl!${Date.now()}`;
let userId;
let sourceId;

try {
  const tenant = await admin.from('tenants').select('id').eq('slug', 'isna').single();
  if (tenant.error) throw tenant.error;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const member = await admin.from('tenant_memberships').insert({ tenant_id: tenant.data.id, user_id: userId, role: 'owner' });
  if (member.error) throw member.error;
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  const headers = { Authorization: `Bearer ${signed.data.session.access_token}`, 'X-Tenant-Slug': 'isna', 'Content-Type': 'application/json' };

  const blockedResponse = await fetch(`${api}/master-factory/sources/ingest`, {
    method: 'POST', headers,
    body: JSON.stringify({ sourceType: 'url', sourceUrl: 'http://127.0.0.1:4002/docs' }),
  });
  const ingestResponse = await fetch(`${api}/master-factory/sources/ingest`, {
    method: 'POST', headers,
    body: JSON.stringify({ sourceType: 'url', title: 'Pédagogie — source web E2E', sourceUrl: 'https://fr.wikipedia.org/wiki/P%C3%A9dagogie', metadata: { test: true } }),
  });
  const envelope = await ingestResponse.json();
  const source = envelope?.data || envelope;
  sourceId = source.id;
  const screenshotPath = path.resolve('artifacts/master-factory-course-review-20260729/38-url-extraction-real.png');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const ref = new URL(supabaseUrl).host.split('.')[0];
    await page.addInitScript(({ key, value }) => {
      localStorage.setItem(key, value);
      localStorage.setItem('tenantSlug', 'isna');
    }, { key: `sb-${ref}-auth-token`, value: JSON.stringify(signed.data.session) });
    await page.goto(`http://localhost:5173/liri/atelier?mfSourceType=url&mfSourceId=${sourceId}`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.getByText('Pédagogie — source web E2E', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } finally {
    await browser.close();
  }
  const proof = { generatedAt: new Date().toISOString(), blockedPrivateNetworkStatus: blockedResponse.status, ingestStatus: ingestResponse.status, source, screenshotPath };
  const proofPath = path.resolve('artifacts/master-factory-course-review-20260729/url-source-e2e-proof.json');
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ blockedPrivateNetworkStatus: blockedResponse.status, ingestStatus: ingestResponse.status, ready: source?.ready, chars: source?.chars }, null, 2));
  if (blockedResponse.status !== 400 || ingestResponse.status >= 300 || !source?.ready || source?.chars < 200) process.exitCode = 1;
} finally {
  if (sourceId) await admin.from('master_factory_sources').delete().eq('id', sourceId);
  if (userId) await admin.auth.admin.deleteUser(userId);
}
