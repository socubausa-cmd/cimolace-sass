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
  // Le shell déclare ses routes via les listes HIDDEN / IMMERSIVE depuis le
  // passage aux moteurs : on cherche la chaîne, pas l'ancien attribut JSX.
  const code = await source('app/_layout.tsx');
  for (const route of [
    'formations',
    'formation/[courseId]',
    'calendrier-annuel',
    'rendez-vous',
    'ma-classe',
  ]) {
    assert.ok(code.includes(`'${route}'`), `route ${route} absente du shell`);
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
  const manquantes = (await walk(appDir)).filter((r) => !code.includes(`'${r}'`));
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

test('les moteurs natifs ne pointent que vers des écrans existants', async () => {
  // Le rail web liste des surfaces qui n'ont pas toutes d'équivalent natif :
  // en lister une sans écran donnerait un onglet qui ne mène nulle part.
  const { access } = await import('node:fs/promises');
  const nav = await source('lib/engines-nav.ts');
  const routes = [...nav.matchAll(/route: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(routes.length >= 8, 'catalogue de moteurs suspicieusement court');
  for (const r of new Set(routes)) {
    await access(new URL(`../src/app/${r}.tsx`, import.meta.url));
  }
  // Et tout item de moteur doit être déclaré dans le shell, sinon pas d'onglet.
  const shell = await source('app/_layout.tsx');
  for (const r of new Set(routes)) {
    assert.ok(shell.includes(`'${r}'`), `route de moteur ${r} absente du shell`);
  }
});

test('les moteurs payants sont bien conditionnés à un service', async () => {
  const nav = await source('lib/engines-nav.ts');
  assert.match(nav, /key: 'ecole'[\s\S]{0,200}requires: 'school'/);
  assert.match(nav, /key: 'mbolo'[\s\S]{0,200}requires: 'shop'/);
  const tenant = await source('lib/tenant.tsx');
  assert.match(tenant, /from\('tenant_services'\)/, 'la source des moteurs doit être tenant_services');
  assert.match(tenant, /from\('tenant_memberships'\)/, 'le rôle doit venir de tenant_memberships');
});

test('Ma semaine lit la chaîne LEGACY des parcours, pas celle des formations', async () => {
  // Deux structures cohabitent en base : `modules/formation_weeks/...` porte les
  // FORMATIONS, `course_modules/module_weeks/week_days` porte les PARCOURS
  // hebdomadaires. Se tromper de chaîne donne un écran vide (vérifié en prod :
  // 33 module_weeks, 165 week_days, 363 pedagogical_blocks).
  const code = await source('app/semaine.tsx');
  for (const table of ['school_paths', 'path_courses', 'course_modules', 'module_weeks', 'week_days']) {
    assert.match(code, new RegExp(`from\\('${table}'\\)`), `${table} absente`);
  }
  assert.match(code, /pedagogical_blocks\(\*\)/, 'les blocs doivent être joints aux jours');
  assert.doesNotMatch(code, /from\('formation_weeks'\)/, 'mauvaise chaîne : formations ≠ parcours');
  // Le parcours vient du profil, pas d'un identifiant en dur.
  assert.match(code, /metadata\?\.school_path_id/);
});

test('les erreurs de connexion sont en français', async () => {
  // Supabase répond en anglais ; « Invalid login credentials » s'affichait tel
  // quel au milieu d'une app entièrement française (constaté sur émulateur).
  const code = await source('lib/auth.tsx');
  assert.match(code, /messageAuth\(error\.message\)/, 'signIn doit traduire l’erreur');
  assert.match(code, /E-mail ou mot de passe incorrect/);
  assert.doesNotMatch(code, /return \{ error: error\.message \}/, 'plus de message brut');
});

test('la connexion offre une sortie en cas de mot de passe oublié', async () => {
  // L'écran n'en avait aucune : un utilisateur qui oubliait son mot de passe
  // était bloqué définitivement (constaté sur émulateur).
  const screen = await source('components/login-screen.tsx');
  assert.match(screen, /Mot de passe oublié/);
  assert.match(screen, /resetPassword\(email\)/);

  const auth = await source('lib/auth.tsx');
  assert.match(auth, /resetPasswordForEmail\(/);
  // Une app mobile n'a pas d'origine HTTP : la redirection vise le portail web.
  assert.match(auth, /\$\{PORTAL_URL\}\/update-password/);

  const api = await source('lib/liri-api.ts');
  assert.match(api, /EXPO_PUBLIC_PORTAL_URL/, "l'URL du portail doit être configurable");
});

test('les réglages exposent les liens légaux et la gestion du compte', async () => {
  // Ces accès doivent rester visibles dans l'app livrée : ils font partie des
  // informations de confidentialité et d'assistance vérifiées par Apple.
  const code = await source('app/reglages.tsx');
  assert.match(code, /prorascience\.org\/politique-confidentialite/);
  assert.match(code, /prorascience\.org\/nous-contacter/);
  assert.match(code, /\$\{PORTAL_URL\}\/liri\/compte/);
  assert.match(code, /Gérer ou supprimer mon compte/);
});
