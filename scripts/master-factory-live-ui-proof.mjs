import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const root = process.cwd();
const outDir = path.join(root, 'artifacts/master-factory-course-review-20260729');
const proof = JSON.parse(fs.readFileSync(path.join(outDir, 'replay-to-live-real-e2e-proof.json'), 'utf8'));
const env = {};
for (const line of fs.readFileSync(path.join(root, 'apps/api/.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const password = `FinalShots!${Date.now()}Aa`;
const updated = await admin.auth.admin.updateUserById(proof.testActor.userId, { password });
if (updated.error) throw updated.error;
const auth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const signed = await auth.auth.signInWithPassword({ email: proof.testActor.email, password });
if (signed.error) throw signed.error;

// Une preuve qui ne peut pas échouer ne prouve rien : aucun indicateur n'est
// affirmé en dur, tout est MESURÉ sur la page ; chaque étape ratée est
// consignée dans le JSON et fait sortir le run en code 1.
const expectedScenes = proof.counts?.smartboardScenes ?? proof.counts?.persistedLiveScenes ?? 0;
const firstSceneTitle = proof.samples?.firstSmartboardScene?.title || 'Les limites du critère de falsifiabilité';
const firstSceneIdea = String(proof.samples?.firstMasterScriptMoment?.message_central || 'Le critère de Popper').slice(0, 24).trim();
const failures = [];
const step = async (name, fn) => {
  try {
    return await fn();
  } catch (error) {
    failures.push({ step: name, error: String(error?.message || error).slice(0, 600) });
    return undefined;
  }
};

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1080 } });
  const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value);
    localStorage.setItem('tenantSlug', 'isna');
    localStorage.setItem('isna-v2-tenant-slug', 'isna');
    localStorage.setItem('selectedTenantSlug', 'isna');
  }, { key: `sb-${ref}-auth-token`, value: JSON.stringify(signed.data.session) });

  // Le compteur de scènes est LU depuis la page, jamais supposé.
  let measuredScenes = 0;
  await step('preparation-scenes-counter', async () => {
    await page.goto(`http://localhost:5173/studio/live-preparation/${proof.liveSession.id}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction(() => /SCÈNES\s+\d+/.test(document.body?.innerText || ''), null, { timeout: 60_000 });
    const match = (await page.locator('body').innerText()).match(/SCÈNES\s+(\d+)/);
    measuredScenes = match ? Number(match[1]) : 0;
  });

  await step('preparation-smartboard-screen', async () => {
    // Le rail expose des noms accessibles stables (ex. « 2. Scènes »).
    await page.getByRole('button', { name: '2. Scènes', exact: true }).click();
    await page.getByRole('heading', { name: 'Scènes', exact: true }).waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Écran 2 sur 3', exact: true }).click();
    await page.getByText("Composez l'ordre et le type de chaque scène du live.", { exact: true }).waitFor({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outDir, '47-real-smartboard-scenes.png'), fullPage: true });
  });

  await step('preparation-mindmap-screen', async () => {
    await page.getByRole('button', { name: '1. Blueprint', exact: true }).click();
    await page.getByRole('heading', { name: 'Blueprint', exact: true }).waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Écran 2 sur 2', exact: true }).click();
    await page.getByText('Mindmap Master Factory', { exact: true }).waitFor({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outDir, '48-real-live-mindmap.png'), fullPage: true });
  });

  await step('preparation-prompter-screen', async () => {
    await page.getByRole('button', { name: '3. Script', exact: true }).click();
    await page.getByRole('heading', { name: 'Script', exact: true }).waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: /Ouvrir.*script/i }).click();
    await page.getByRole('heading', { name: /Script.*prompteur/i }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '49-real-master-script-prompter.png'), fullPage: true });
  });

  let arenaText = '';
  await step('arena-first-scene', async () => {
    await page.goto(`http://localhost:5173/studio/live-arena/${proof.liveSession.id}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction(() => (document.body?.innerText || '').length > 150, null, { timeout: 60_000 });
    await page.getByText(firstSceneTitle, { exact: true }).first().waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(700);
  });

  await step('arena-reveal-first-idea', async () => {
    // Révélation progressive : canvas si présent, sinon bouton. L'idée doit
    // réellement apparaître — plus d'échec silencieux avalé par un catch.
    const progressiveCanvas = page.locator('[title^="Cliquer pour révéler"]:visible').first();
    const firstReveal = page.getByRole('button', { name: /Idée centrale/i });
    const useCanvas = (await progressiveCanvas.count()) > 0;
    if (!useCanvas && !(await firstReveal.isVisible())) return; // déjà révélée : l'indicateur final tranche sur le texte mesuré
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (useCanvas) await progressiveCanvas.click({ position: { x: 360, y: 300 }, force: true });
      else await firstReveal.click({ force: true });
      const revealed = await page
        .waitForFunction((probe) => (document.body?.innerText || '').includes(probe), firstSceneIdea, { timeout: attempt === 0 ? 2500 : 5000 })
        .then(() => true, () => false);
      if (revealed) return;
    }
    throw new Error(`L'idée « ${firstSceneIdea} » n'apparaît pas après la révélation.`);
  });

  await step('arena-body-text', async () => {
    await page.waitForTimeout(700);
    arenaText = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(outDir, '50-real-live-arena-ready.png'), fullPage: true });
  });

  // Le parcours d'import est MESURÉ : l'indicateur ne vaut true que si le toast
  // de confirmation (avec le bon nombre de scènes) apparaît réellement.
  const importDone = await step('arena-master-factory-import', async () => {
    await page.getByRole('button', { name: 'Importer un projet Master Factory', exact: true }).click();
    await page.getByRole('dialog', { name: 'Importer depuis Master Factory', exact: true }).waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: /La physique quantique décodée par l'Égypte antique/i }).first().click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Importer et remplacer le programme', exact: true }).click();
    await page.getByRole('status').getByText(new RegExp(`${expectedScenes} scènes.*Mindmap.*Master Script`, 'i')).waitFor({ timeout: 120_000 });
    await page.screenshot({ path: path.join(outDir, '51-real-arena-master-factory-import.png'), fullPage: true });
    return true;
  });

  const sequencePattern = new RegExp(`01\\s*/\\s*${String(expectedScenes).padStart(2, '0')}`);
  const arena = {
    hasSequenceCounter: sequencePattern.test(arenaText),
    hasFirstSceneTitle: arenaText.includes(firstSceneTitle),
    hasFirstSceneIdea: arenaText.includes(firstSceneIdea),
    directMasterFactoryImport: importDone === true,
  };
  const ok = expectedScenes > 0
    && measuredScenes === expectedScenes
    && Object.values(arena).every((value) => value === true)
    && failures.length === 0;

  const uiProof = {
    generatedAt: new Date().toISOString(),
    ok,
    sourceId: proof.source.id,
    liveSessionId: proof.liveSession.id,
    scenes: measuredScenes,
    expectedScenes,
    arena,
    screenshots: ['47-real-smartboard-scenes.png', '48-real-live-mindmap.png', '49-real-master-script-prompter.png', '50-real-live-arena-ready.png', '51-real-arena-master-factory-import.png'],
    browserErrors: errors,
    failures,
  };
  fs.writeFileSync(path.join(outDir, 'live-ui-proof.json'), `${JSON.stringify(uiProof, null, 2)}\n`);
  console.log(JSON.stringify(uiProof, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
}
