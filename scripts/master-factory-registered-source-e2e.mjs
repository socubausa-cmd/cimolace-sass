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
const email = `codex-source-${Date.now()}@cimolace.test`;
const password = `CodexSource!${Date.now()}`;
const title = 'E2E — La transmission devient compétence';
const contentText = `Une information ne devient pas automatiquement une connaissance. L’élève doit pouvoir relier une idée à une situation observable, distinguer la règle de son contre-exemple, puis essayer la méthode dans un contexte nouveau. Le premier geste pédagogique consiste donc à rendre le problème visible. On part d’une situation familière, on nomme l’obstacle, puis on construit une représentation simple du mécanisme.\n\nUne bonne analogie ne remplace pas la définition. Elle crée un pont provisoire entre un domaine connu et le concept à apprendre. Le professeur explicite ce qui correspond, mais aussi la limite de la comparaison. Cette limite évite que l’image devienne une fausse règle. Le tableau vivant révèle les éléments dans l’ordre du raisonnement et réduit la charge cognitive.\n\nEnfin, le transfert prouve que la notion est comprise. L’élève reçoit une situation différente, prend une décision et explique pourquoi son choix respecte le mécanisme étudié. Le système conserve les appuis issus de la source, enrichit la reformulation sans attribuer de nouvelles idées à l’auteur et prépare plusieurs sorties : cours écrit, précepteur, manuel, SmartBoard ou scénario Live.`;
let userId;
let sourceId;

try {
  const tenant = await admin.from('tenants').select('id').eq('slug', 'isna').single();
  if (tenant.error) throw tenant.error;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const membership = await admin.from('tenant_memberships').insert({ tenant_id: tenant.data.id, user_id: userId, role: 'owner' });
  if (membership.error) throw membership.error;
  const otherTenant = await admin.from('tenants').select('id,slug').neq('id', tenant.data.id).not('slug', 'is', null).limit(1).maybeSingle();
  if (otherTenant.data?.id) {
    const otherMembership = await admin.from('tenant_memberships').insert({ tenant_id: otherTenant.data.id, user_id: userId, role: 'owner' });
    if (otherMembership.error) throw otherMembership.error;
  }
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  const headers = { Authorization: `Bearer ${signed.data.session.access_token}`, 'X-Tenant-Slug': 'isna', 'Content-Type': 'application/json' };
  const payload = { sourceType: 'texte', title, contentText, mimeType: 'text/plain', metadata: { test: true } };
  const firstResponse = await fetch(`${api}/master-factory/sources/ingest`, { method: 'POST', headers, body: JSON.stringify(payload) });
  const firstEnvelope = await firstResponse.json();
  const first = firstEnvelope?.data || firstEnvelope;
  sourceId = first.id;
  const secondResponse = await fetch(`${api}/master-factory/sources/ingest`, { method: 'POST', headers, body: JSON.stringify(payload) });
  const secondEnvelope = await secondResponse.json();
  const second = secondEnvelope?.data || secondEnvelope;
  const listResponse = await fetch(`${api}/master-factory/sources/texte`, { headers });
  const listEnvelope = await listResponse.json();
  const list = Array.isArray(listEnvelope) ? listEnvelope : listEnvelope?.data || [];
  const listed = list.find((item) => item.id === sourceId);
  const sourceResponse = await fetch(`${api}/master-factory/source/texte/${sourceId}`, { headers });
  const sourceEnvelope = await sourceResponse.json();
  const source = sourceEnvelope?.data || sourceEnvelope;
  const crossTenantResponse = otherTenant.data?.slug
    ? await fetch(`${api}/master-factory/source/texte/${sourceId}`, { headers: { ...headers, 'X-Tenant-Slug': otherTenant.data.slug } })
    : null;

  const artifactDir = path.resolve('artifacts/master-factory-course-review-20260729');
  fs.mkdirSync(artifactDir, { recursive: true });
  const desktopPath = path.join(artifactDir, '36-registered-text-source-real.png');
  const mobilePath = path.join(artifactDir, '37-registered-text-source-mobile.png');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const ref = new URL(url).host.split('.')[0];
    const open = async (viewport, screenshotPath, scrollToSource = false) => {
      const page = await browser.newPage({ viewport });
      await page.addInitScript(({ key, value }) => {
        localStorage.setItem(key, value);
        localStorage.setItem('tenantSlug', 'isna');
      }, { key: `sb-${ref}-auth-token`, value: JSON.stringify(signed.data.session) });
      await page.goto(`http://localhost:5173/liri/atelier?mfSourceType=texte&mfSourceId=${sourceId}`, { waitUntil: 'networkidle', timeout: 90_000 });
      const sourceTitle = page.getByText(title, { exact: true }).first();
      await sourceTitle.waitFor({ state: 'visible', timeout: 30_000 });
      if (scrollToSource) {
        await sourceTitle.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
      }
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await page.close();
    };
    await open({ width: 1600, height: 1100 }, desktopPath);
    await open({ width: 390, height: 844 }, mobilePath, true);
  } finally {
    await browser.close();
  }

  const proof = {
    generatedAt: new Date().toISOString(),
    ingestStatus: firstResponse.status,
    repeatedIngestStatus: secondResponse.status,
    idempotent: first.id === second.id,
    listStatus: listResponse.status,
    sourceStatus: sourceResponse.status,
    crossTenantStatus: crossTenantResponse?.status ?? null,
    source,
    listed,
    screenshots: [desktopPath, mobilePath],
  };
  fs.writeFileSync(path.join(artifactDir, 'registered-source-e2e-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ ingestStatus: firstResponse.status, idempotent: proof.idempotent, listStatus: listResponse.status, sourceStatus: sourceResponse.status, crossTenantStatus: proof.crossTenantStatus, ready: source?.ready, chars: source?.chars }, null, 2));
  if (firstResponse.status >= 300 || secondResponse.status >= 300 || listResponse.status >= 300 || sourceResponse.status >= 300 || (crossTenantResponse && crossTenantResponse.status !== 404) || !proof.idempotent || !source?.ready || !listed?.ready) process.exitCode = 1;
} finally {
  if (sourceId) await admin.from('master_factory_sources').delete().eq('id', sourceId);
  if (userId) await admin.auth.admin.deleteUser(userId);
}
