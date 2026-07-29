import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const root = process.cwd();
const env = {};
for (const file of ['apps/api/.env', 'apps/app/.env', 'apps/app/.env.local']) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !serviceKey || !anonKey) throw new Error('Configuration Supabase incomplète.');

const apiOrigin = process.env.API_ORIGIN || 'http://localhost:4002';
const appOrigin = process.env.APP_ORIGIN || 'http://localhost:5173';
const sourceId = process.env.MF_SOURCE_ID || 'b11a419e-8508-4058-a42c-eda9cb3a5f2d';
const outDir = path.join(root, 'artifacts/master-factory-course-review-20260729');
fs.mkdirSync(outDir, { recursive: true });

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const stamp = Date.now();
const email = `codex-replay-live-${stamp}@cimolace.test`;
const password = `CodexLive!${stamp}`;
let userId;
let liveSessionId;
let browser;
let completed = false;

const unwrapEnvelope = (input) => {
  let value = input;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'data')) break;
    value = value.data;
  }
  return value;
};

const jsonCall = async (route, token, options = {}) => {
  const response = await fetch(`${apiOrigin}${route}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': 'isna',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeout || 120_000),
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`${route} → HTTP ${response.status}: ${text.slice(0, 800)}`);
  return { status: response.status, body, data: unwrapEnvelope(body) };
};

try {
  const tenantResult = await admin.from('tenants').select('id,slug,name').eq('slug', 'isna').single();
  if (tenantResult.error) throw tenantResult.error;
  const tenant = tenantResult.data;

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const membership = await admin.from('tenant_memberships').insert({ tenant_id: tenant.id, user_id: userId, role: 'owner' });
  if (membership.error) throw membership.error;
  const profile = await admin.from('profiles').upsert({
    id: userId,
    email,
    name: 'Codex Master Factory E2E',
    full_name: 'Codex Master Factory E2E',
    role: 'owner',
    status: 'active',
    metadata: { purpose: 'replay-to-live-e2e', tenant_slug: 'isna' },
  }, { onConflict: 'id' });
  if (profile.error) throw profile.error;
  const signed = await authClient.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  const token = signed.data.session.access_token;

  const library = await jsonCall('/master-factory/sources/replay', token);
  const libraryRows = Array.isArray(library.data) ? library.data : [];
  const librarySource = libraryRows.find((row) => row.id === sourceId);
  if (!librarySource) throw new Error('Le replay réel choisi est absent de la vidéothèque API.');

  const source = await jsonCall(`/master-factory/source/replay/${sourceId}`, token);
  const understanding = await jsonCall('/master-factory/understand', token, {
    method: 'POST', body: { sourceType: 'replay', sourceId }, timeout: 15 * 60_000,
  });
  const masterclass = await jsonCall('/master-factory/render/masterclass-project', token, {
    method: 'POST', body: { sourceType: 'replay', sourceId },
  });
  const masterScript = await jsonCall('/master-factory/produce/master-script', token, {
    method: 'POST', body: { sourceType: 'replay', sourceId },
  });
  const mindmap = await jsonCall('/master-factory/produce/mindmap', token, {
    method: 'POST', body: { sourceType: 'replay', sourceId },
  });
  const smartboard = await jsonCall('/master-factory/produce/smartboard', token, {
    method: 'POST', body: { sourceType: 'replay', sourceId },
  });
  const liveStack = await jsonCall('/master-factory/produce/live-stack', token, {
    method: 'POST', body: { sourceType: 'replay', sourceId },
  });

  const createdLive = await jsonCall('/lives', token, {
    method: 'POST',
    body: {
      title: `Master Factory · ${source.data?.title || librarySource.title}`,
      description: `LIVE préparé de bout en bout depuis le replay ${sourceId}.`,
      scheduled_at: new Date().toISOString(),
      session_type: 'class',
      duration_minutes: liveStack.data?.masterScript?.estimated_duration_minutes || 60,
      replay_enabled: true,
      config: { e2e_proof: true, waiting_room: true },
    },
  });
  const createdLiveData = createdLive.data;
  liveSessionId = createdLiveData?.id;
  if (!liveSessionId) throw new Error('La création officielle du LIVE ne renvoie aucun identifiant.');

  const publication = await jsonCall('/master-factory/publish/live-session', token, {
    method: 'POST',
    body: { sourceType: 'replay', sourceId, liveSessionId, replaceExisting: true },
  });
  const liveReadback = await jsonCall(`/lives/${liveSessionId}`, token);
  const status = await jsonCall(`/master-factory/status/replay/${sourceId}`, token);

  const [pivotRows, blueprintRow, sceneRows, scriptRows, sessionRow] = await Promise.all([
    admin.from('course_pivots').select('id,kind,parent_id,model,payload').eq('tenant_id', tenant.id).eq('source_type', 'replay').eq('source_id', sourceId),
    admin.from('live_blueprints').select('*').eq('live_session_id', liveSessionId).single(),
    admin.from('live_scenes').select('id,name,order_index,content_payload_json').eq('live_session_id', liveSessionId).order('order_index'),
    admin.from('live_script_sections').select('id,title,order_index,content,master_agent').eq('session_id', liveSessionId).order('order_index'),
    admin.from('live_sessions').select('id,title,status,config,tenant_id').eq('id', liveSessionId).single(),
  ]);
  for (const result of [pivotRows, blueprintRow, sceneRows, scriptRows, sessionRow]) {
    if (result.error) throw result.error;
  }

  const sourceData = source.data;
  const understandingData = understanding.data;
  const masterclassData = masterclass.data;
  const masterScriptData = masterScript.data;
  const mindmapData = mindmap.data;
  const smartboardData = smartboard.data;
  const stack = liveStack.data;
  const ms = masterScriptData?.masterScript;
  const mm = mindmapData?.mindmap;
  const sb = smartboardData?.smartboardTimeline;
  const blueprintMindmap = blueprintRow.data?.outline_json?.mindmap;
  const assertions = {
    replay_is_real_library_source: Boolean(librarySource && sourceData?.ready && sourceData?.chars > 0),
    comprehension_has_notions: (understandingData?.comprehension?.notions?.length || 0) > 0,
    written_course_has_chapters: (masterclassData?.chapters?.length || 0) > 0,
    master_script_aligned: ms?.moments?.length > 0,
    mindmap_aligned: mm?.branches?.length === ms?.moments?.length && mm?.edges?.length === mm?.branches?.length,
    smartboard_aligned: sb?.scenes?.length === ms?.moments?.length,
    live_scenario_aligned: stack?.liveScenario?.scenes?.length === ms?.moments?.length,
    live_created_for_tenant: sessionRow.data?.tenant_id === tenant.id,
    blueprint_contains_mindmap: blueprintMindmap?.branches?.length === mm?.branches?.length,
    scenes_persisted: sceneRows.data?.length === sb?.scenes?.length,
    scripts_persisted: scriptRows.data?.length === ms?.moments?.length,
    mindmap_enabled_in_live: sessionRow.data?.config?.ai_mindmap_enabled === true,
    source_trace_in_live: sessionRow.data?.config?.master_factory?.source_id === sourceId,
  };
  if (Object.values(assertions).some((value) => value !== true)) {
    throw new Error(`Assertions E2E invalides: ${JSON.stringify(assertions)}`);
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1080 }, deviceScaleFactor: 1 });
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value);
    localStorage.setItem('tenantSlug', 'isna');
    localStorage.setItem('isna-v2-tenant-slug', 'isna');
    localStorage.setItem('selectedTenantSlug', 'isna');
  }, { key: `sb-${ref}-auth-token`, value: JSON.stringify(signed.data.session) });
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto(`${appOrigin}/dashboard/tools/masterclass-factory?mfSourceType=replay&mfSourceId=${sourceId}&step=5`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction(() => (document.body?.innerText || '').trim().length > 120, null, { timeout: 60_000 });
  await page.screenshot({ path: path.join(outDir, '45-real-replay-master-factory.png'), fullPage: true });
  const factoryPage = { url: page.url(), title: await page.title(), text: (await page.locator('body').innerText()).slice(0, 2400) };

  await page.goto(`${appOrigin}/studio/live-preparation/${liveSessionId}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction(() => (document.body?.innerText || '').trim().length > 120, null, { timeout: 60_000 });
  await page.screenshot({ path: path.join(outDir, '46-real-live-preparation.png'), fullPage: true });
  const livePage = { url: page.url(), title: await page.title(), text: (await page.locator('body').innerText()).slice(0, 2400) };

  const proof = {
    generatedAt: new Date().toISOString(),
    tenant,
    testActor: { userId, email },
    source: {
      id: sourceId,
      title: sourceData?.title || librarySource.title,
      transcriptChars: sourceData?.chars,
      libraryReady: librarySource.ready,
    },
    liveSession: { id: liveSessionId, title: sessionRow.data.title, status: sessionRow.data.status },
    counts: {
      notions: understandingData.comprehension.notions.length,
      chapters: masterclassData.chapters.length,
      masterScriptMoments: ms.moments.length,
      mindmapBranches: mm.branches.length,
      smartboardScenes: sb.scenes.length,
      liveScenarioScenes: stack.liveScenario.scenes.length,
      persistedLiveScenes: sceneRows.data.length,
      persistedScriptSections: scriptRows.data.length,
      pivots: pivotRows.data.map((row) => row.kind),
    },
    ids: {
      comprehension: understandingData.pivotId,
      masterScript: masterScriptData.pivotId,
      smartboard: smartboardData.pivotId,
      liveScenario: stack.pivots.live_scenario,
    },
    publication: publication.data,
    status: status.data,
    assertions,
    browser: { factoryPage, livePage, errors: browserErrors },
    samples: {
      mindmapMermaid: mm.mermaid,
      firstMasterScriptMoment: ms.moments[0],
      firstSmartboardScene: sb.scenes[0],
      firstPersistedLiveScene: sceneRows.data[0],
      firstPersistedScriptSection: scriptRows.data[0],
      liveReadback: liveReadback.data,
    },
  };
  fs.writeFileSync(path.join(outDir, 'replay-to-live-real-e2e-proof.json'), JSON.stringify(proof, null, 2));
  completed = true;
  console.log(JSON.stringify({
    ok: true,
    source: proof.source,
    liveSession: proof.liveSession,
    counts: proof.counts,
    assertions,
    browserErrors,
    screenshots: ['45-real-replay-master-factory.png', '46-real-live-preparation.png'],
  }, null, 2));
} finally {
  if (browser) await browser.close();
  // Le compte et la session sont intentionnellement conservés : le LIVE doit
  // rester visible dans le tenant pour la vérification manuelle du fondateur.
  if (!completed && liveSessionId) await admin.from('live_sessions').delete().eq('id', liveSessionId);
  if (!completed && userId) await admin.auth.admin.deleteUser(userId);
}
