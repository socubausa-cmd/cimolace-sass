import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async (relativePath) =>
  readFile(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');

test('vie scolaire uses the canonical web data contracts', async () => {
  const code = await source('app/vie-scolaire.tsx');
  for (const table of [
    'student_evaluations',
    'attendance_records',
    'school_events',
    'school_calendar',
    'annual_program_weeks',
    'certificates',
    'student_live_reports',
  ]) {
    assert.match(code, new RegExp(`from\\('${table}'\\)`));
  }
  for (const legacy of ['grades', 'attendance', 'evaluations', 'documents', 'agenda_events']) {
    assert.doesNotMatch(code, new RegExp(`from\\('${legacy}'\\)`));
  }
});

test('messaging uses the protected conversation API', async () => {
  const code = await source('lib/liri-api.ts');
  assert.match(code, /getJson<ApiConversation\[\]>\('\/messaging\/conversations'\)/);
  assert.match(code, /postJson<ApiMessage>\('\/messaging\/send'/);
  assert.doesNotMatch(code, /\.from\('messages'\)/);
});

test('notifications use the canonical body/channel/data columns', async () => {
  const code = await source('lib/liri-api.ts');
  assert.match(code, /title,body,channel,data,is_read/);
  assert.doesNotMatch(code, /title,message,type,is_read,created_at,action_url/);
});

test('Arena writes schema-compatible NeuronQ questions and vote payloads', async () => {
  const code = await source('components/arena/data.ts');
  assert.match(code, /raw_text: text/);
  assert.match(code, /payload: JSON\.stringify\(\{ side: choice, round \}\)/);
  assert.doesNotMatch(code, /question: text/);
});

test('learning parity uses course, module, lesson and progress endpoints', async () => {
  const code = await source('lib/learning-api.ts');
  assert.match(code, /readJson<Course\[\]>\('\/courses'\)/);
  assert.match(code, /\/courses\/\$\{encodeURIComponent\(courseId\)\}\/modules/);
  assert.match(code, /\/courses\/modules\/\$\{encodeURIComponent\(module\.id\)\}\/lessons/);
  assert.match(code, /\/courses\/\$\{encodeURIComponent\(courseId\)\}\/progress/);
});

test('community parity uses protected Forum and Messaging APIs', async () => {
  const code = await source('lib/community-api.ts');
  assert.match(code, /\/forum\/topics\/\$\{encodeURIComponent\(id\)\}\/posts/);
  assert.match(code, /request\(`\/messaging\/send`/);
  assert.match(code, /request<CommunityMember\[\]>\('\/tenant-portal\/members'\)/);
});

test('critical student routes are registered in the native shell', async () => {
  const code = await source('app/_layout.tsx');
  for (const route of [
    'formations',
    'formation/[courseId]',
    'calendrier-annuel',
    'rendez-vous',
    'ma-classe',
  ]) {
    assert.ok(code.includes(`name="${route}"`), `route ${route} absente du shell`);
  }
});

test('toute route de src/app est déclarée dans le shell', async () => {
  // Expo Router ajoute d'office à la barre d'onglets toute route non déclarée,
  // sans titre ni icône — deux écrans s'y étaient glissés en carré vide.
  const { readdir } = await import('node:fs/promises');
  const appDir = new URL('../src/app/', import.meta.url);
  const walk = async (dir, prefix = '') => {
    const out = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) out.push(...(await walk(new URL(`${e.name}/`, dir), `${prefix}${e.name}/`)));
      else if (e.name.endsWith('.tsx') && e.name !== '_layout.tsx') out.push(prefix + e.name.replace(/\.tsx$/, ''));
    }
    return out;
  };
  const code = await source('app/_layout.tsx');
  const manquantes = (await walk(appDir)).filter((r) => !code.includes(`name="${r}"`));
  assert.deepEqual(manquantes, [], `routes absentes du shell : ${manquantes.join(', ')}`);
});

test('les préférences de live sont réellement envoyées à la création', async () => {
  // Elles ont déjà été affichées une fois sans rien piloter : un réglage qui ne
  // change rien est pire qu'un réglage absent.
  const api = await source('lib/liri-api.ts');
  assert.match(api, /getLivePrefs\(\)/, 'createLive doit lire les préférences');
  for (const field of ['session_type', 'recording_requested', 'replay_enabled']) {
    assert.match(api, new RegExp(`${field}:`), `${field} absent du payload createLive`);
  }
  // `waiting_room` n'est PAS une colonne de live_sessions : il passe par config.
  assert.match(api, /config: \{ waiting_room:/);

  const prefs = await source('lib/preferences.tsx');
  assert.match(prefs, /AsyncStorage\.setItem/, 'les préférences doivent être persistées');
  // Vocabulaire du CHECK live_sessions_session_type_check (migration 20260528190002).
  for (const type of ['webinar', 'class', 'workshop', 'masterclass', 'debate']) {
    assert.match(prefs, new RegExp(`'${type}'`), `type ${type} hors vocabulaire`);
  }
});
