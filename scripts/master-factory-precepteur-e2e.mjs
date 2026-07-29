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
const email = `codex-precepteur-${Date.now()}@cimolace.test`;
const password = `CodexPrecepteur!${Date.now()}`;
const title = 'E2E — Du concept au geste';
const contentText = 'Une notion devient compétence quand l’élève peut reconnaître le mécanisme dans une situation nouvelle, choisir une action et justifier son choix. '.repeat(5);
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
  const ingestResponse = await fetch(`${api}/master-factory/sources/ingest`, { method: 'POST', headers, body: JSON.stringify({ sourceType: 'texte', title, contentText }) });
  const sourceEnvelope = await ingestResponse.json();
  const source = sourceEnvelope?.data || sourceEnvelope;
  sourceId = source.id;

  const root = await admin.from('course_pivots').insert({
    tenant_id: tenant.data.id, source_type: 'texte', source_id: sourceId, kind: 'comprehension', model: 'e2e-fixture',
    payload: { schema_version: 1, titre: title, promesse: 'Transformer une idée en décision observable.', public: 'Débutants', glossaire: [{ terme: 'transfert', simple: 'Réutiliser ce qui est appris dans une nouvelle situation.' }], notions: [{ id: 'n1', titre: 'Le transfert', idee_centrale: 'Comprendre, c’est pouvoir agir ailleurs.', pourquoi: 'La répétition seule ne prouve pas la compréhension.', appuis: ['situation nouvelle', 'justifier son choix'] }], meta: { source_type: 'texte', source_id: sourceId, source_title: title, transcript_chars: contentText.length, segments: 1, model: 'e2e-fixture', generated_at: new Date().toISOString() } },
  }).select('id').single();
  if (root.error) throw root.error;
  const written = await admin.from('course_pivots').insert({
    tenant_id: tenant.data.id, source_type: 'texte', source_id: sourceId, kind: 'ecrit', parent_id: root.data.id, model: 'e2e-fixture',
    payload: { schema_version: 1, titre: title, lecons: [{ notion_id: 'n1', titre: 'Reconnaître le transfert', amorce: { situation: 'Tu apprends une route puis tu changes de quartier.', question: 'Peux-tu encore t’orienter ?' }, intuition: 'Le transfert apparaît quand le repère fonctionne hors de son exemple initial.', definition: { enonce: 'Le transfert est la mobilisation autonome d’un acquis dans une situation nouvelle.' }, exemple: { titre: 'Nouvelle situation', deroule: 'L’élève repère le mécanisme, choisit une action puis explique son choix.' }, contre_exemple: { titre: 'Récitation', pourquoi_faux: 'Répéter la phrase ne prouve pas que l’élève sait décider.' }, erreur_frequente: { erreur: 'Confondre mémoire et maîtrise.', correction: 'Demander une décision justifiée.' }, experience_pensee: { consigne: 'Change un détail du problème.', deroule: 'Observe si la méthode reste utilisable.', ce_que_ca_montre: 'Le mécanisme a été compris.' }, mise_en_situation: { contexte: 'Une situation professionnelle différente.', consigne: 'Choisis une action et justifie-la.', reussite: 'Le mécanisme est nommé et appliqué.' }, je_retiens: { phrases: ['Une compétence se prouve par transfert.'], mots_cles: ['transfert'] }, quiz: [{ question: 'Quel signe prouve la maîtrise ?', options: ['Réciter', 'Décider ailleurs', 'Copier', 'Attendre'], correctAnswer: 1, explication: 'La décision nouvelle montre le transfert.' }] }] },
  }).select('id').single();
  if (written.error) throw written.error;

  const call = (route) => fetch(`${api}${route}`, { method: 'POST', headers, body: JSON.stringify({ sourceType: 'texte', sourceId }) });
  const firstResponse = await call('/master-factory/render/precepteur');
  const firstEnvelope = await firstResponse.json();
  const first = firstEnvelope?.data || firstEnvelope;
  const secondResponse = await call('/master-factory/render/precepteur');
  const secondEnvelope = await secondResponse.json();
  const second = secondEnvelope?.data || secondEnvelope;
  const manualResponse = await call('/master-factory/render/manual');
  const manualEnvelope = await manualResponse.json();
  const manual = manualEnvelope?.data || manualEnvelope;
  const statusResponse = await fetch(`${api}/master-factory/status`, { method: 'POST', headers, body: JSON.stringify({ sourceType: 'texte', sourceId }) });
  const statusEnvelope = await statusResponse.json();
  const status = statusEnvelope?.data || statusEnvelope;

  const screenshotPath = path.resolve('artifacts/master-factory-course-review-20260729/39-precepteur-output-real.png');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    const ref = new URL(supabaseUrl).host.split('.')[0];
    await page.addInitScript(({ key, value }) => { localStorage.setItem(key, value); localStorage.setItem('tenantSlug', 'isna'); }, { key: `sb-${ref}-auth-token`, value: JSON.stringify(signed.data.session) });
    await page.goto(`http://localhost:5173/liri/atelier?mfSourceType=texte&mfSourceId=${sourceId}`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.getByText(title, { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByRole('button', { name: /Précepteur/ }).click();
    await page.getByText('Précepteur jouable', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } finally { await browser.close(); }

  const proof = { generatedAt: new Date().toISOString(), firstStatus: firstResponse.status, secondStatus: secondResponse.status, firstCached: first.cached, secondCached: second.cached, samePivot: first.pivotId === second.pivotId, concepts: first.course?.concepts?.length, scenes: first.course?.concepts?.reduce((n, concept) => n + concept.scenes.length, 0), manualStatus: manualResponse.status, manualChars: manual.markdown?.length, status, screenshotPath };
  fs.writeFileSync(path.resolve('artifacts/master-factory-course-review-20260729/precepteur-e2e-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
  if (firstResponse.status >= 300 || secondResponse.status >= 300 || manualResponse.status >= 300 || first.cached || !second.cached || !proof.samePivot || !proof.concepts || !proof.scenes || !status.joue) process.exitCode = 1;
} finally {
  if (sourceId) {
    await admin.from('course_pivots').delete().eq('source_id', sourceId);
    await admin.from('master_factory_sources').delete().eq('id', sourceId);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}
