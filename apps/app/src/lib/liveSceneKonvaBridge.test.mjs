/**
 * Test Node pur du pont scène live ⇄ canevas Konva.
 *   node --test apps/app/src/lib/liveSceneKonvaBridge.test.mjs
 *
 * Ce test existe pour UNE raison : ce dépôt a perdu cinq fois des données parce
 * qu'une écriture reconstruisait la ligne au lieu de la préserver. Il doit donc
 * échouer dès qu'un aller-retour cesse d'être conservateur.
 *
 * ⚠️ Le module testé est du code applicatif Vite : il importe par l'alias `@/`
 * et sa chaîne d'imports contient du TypeScript sans extension. Node ne sait
 * résoudre ni l'un ni l'autre, d'où le crochet de résolution ci-dessous — c'est
 * la condition pour tester le VRAI fichier plutôt qu'une copie divergente.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import module from 'node:module';

const SRC_URL = new URL('../', import.meta.url).href;
const EXT = ['.js', '.jsx', '.mjs', '.ts', '.tsx', '/index.js', '/index.jsx', '/index.ts'];

function resolveHook(spec, ctx, next) {
  const s = spec.startsWith('@/') ? SRC_URL + spec.slice(2) : spec;
  try {
    return next(s, ctx);
  } catch (err) {
    if (!(s.startsWith('.') || s.startsWith('/') || s.startsWith('file:'))) throw err;
    for (const e of EXT) {
      try {
        return next(s + e, ctx);
      } catch {
        /* extension suivante */
      }
    }
    throw err;
  }
}

// `registerHooks` (synchrone, Node ≥ 22.15) ; `register` reste le repli pour les runtimes plus anciens.
if (typeof module.registerHooks === 'function') {
  module.registerHooks({ resolve: resolveHook });
} else {
  const src = `
    const EXT = ${JSON.stringify(EXT)};
    export async function resolve(spec, ctx, next) {
      const s = spec.startsWith('@/') ? ${JSON.stringify(SRC_URL)} + spec.slice(2) : spec;
      try { return await next(s, ctx); } catch (err) {
        if (!(s.startsWith('.') || s.startsWith('/') || s.startsWith('file:'))) throw err;
        for (const e of EXT) { try { return await next(s + e, ctx); } catch { /* suivant */ } }
        throw err;
      }
    }`;
  module.register(`data:text/javascript,${encodeURIComponent(src)}`);
}

const {
  liveSceneToKonvaScene,
  konvaSceneToLiveScenePatch,
  applyLiveScenePatch,
  detectSceneCanvasMode,
  isStructuredDevelopment,
  KONVA_LAYOUT_PAYLOAD_KEY,
  LIRI_IA_ROLE_PREFIX,
} = await import('./liveSceneKonvaBridge.js');

/* --------------------------------------------------------------- fixtures */

/** Scène réaliste : Master Factory, narration, chapitre, mode, croquis. */
function makeScene() {
  return {
    id: '7f3a91c2-4d55-4f1e-9b28-0ac6d5e17b44',
    live_session_id: 'ec1f0b6a-2d19-4a77-8c31-5b9e0f2a4c88',
    name: 'Le temps courbé par l\'espace — écran 2',
    scene_type: 'smartboard',
    order_index: 4,
    is_active: false,
    is_preset: false,
    chapter_id: 3,
    render_mode: 'progressive',
    audio_url: 'https://r2.cimolace.space/narration/sess-ec1f/scene-04.mp3',
    content_payload_json: {
      ia_data: {
        title: 'La courbure n\'est pas une force',
        subtitle: 'Chapitre 3 · Gravitation',
        core_idea: 'Un corps en chute libre ne subit aucune force : il suit la ligne la plus droite possible dans un espace-temps courbé.',
        development: [
          {
            label: 'Ce que Newton disait',
            points: [
              'Une force attire la pomme vers la Terre.',
              'L\'espace est un décor fixe, indifférent aux masses.',
            ],
          },
          {
            label: 'Ce qu\'Einstein répond',
            points: [
              'La masse déforme la géométrie elle-même.',
              'La pomme ne tombe pas : elle suit une géodésique.',
              'Le décor devient acteur.',
            ],
          },
        ],
        slide_summary: 'Passage du cadre newtonien au cadre géométrique.',
        student_prompt: 'Selon vous, que ressent un astronaute en chute libre ?',
        sketch: {
          kind: 'diagram',
          caption: 'Nappe déformée par une masse',
          strokes: [
            { type: 'grid', density: 12 },
            { type: 'well', cx: 0.5, cy: 0.55, depth: 0.32 },
          ],
        },
        theme: 'gravitation',
        illustration_url: 'https://r2.cimolace.space/illus/geodesique.png',
      },
      slide_hint: 'Marquer une pause après « le décor devient acteur ».',
      objectives: ['Distinguer force et géométrie', 'Définir une géodésique'],
      source_moment_id: 'moment-12',
    },
  };
}

/** Scène « éléments positionnels » (import Architect / diapo). */
function makeElementsScene() {
  return {
    id: '2b8e44a1-9c07-4d3a-b512-6ef0a7c31d90',
    name: 'Diapo importée',
    order_index: 9,
    chapter_id: 5,
    render_mode: 'instant',
    audio_url: 'https://r2.cimolace.space/narration/sess-ec1f/scene-09.mp3',
    content_payload_json: {
      elements: [
        {
          type: 'free_text',
          id: 'el-title',
          x: 44,
          y: 72,
          width: 772,
          height: 72,
          content: 'Titre importé',
          fontFamily: 'Georgia, serif',
          fontSize: 32,
          fontWeight: '700',
          color: '#D4AF37',
          textAlign: 'left',
          lineHeight: 1.35,
          opacity: 1,
          rotation: 0,
          zIndex: 1,
        },
      ],
      slide_hint: 'Ne pas relire le titre à voix haute.',
    },
  };
}

/** Objets porteurs d'un rôle `ia_data` (les seuls que le patch relit). */
function roleObjects(konva) {
  return konva.objects.filter((o) => String(o.masterScriptRef || '').startsWith(LIRI_IA_ROLE_PREFIX));
}

function findByRole(konva, role) {
  return konva.objects.find((o) => o.masterScriptRef === `${LIRI_IA_ROLE_PREFIX}${role}`);
}

function iaOf(scene) {
  return scene.content_payload_json.ia_data;
}

/* ------------------------------------------------------------ sens 1 : lecture */

test('sens 1 — la scène Master Factory devient des objets de canevas exploitables', () => {
  const scene = makeScene();
  const konva = liveSceneToKonvaScene(scene);

  assert.equal(konva.mode, 'ia');
  assert.equal(konva.fromSavedLayout, false);
  assert.equal(konva.id, scene.id);
  assert.ok(konva.canvas.width > 0 && konva.canvas.height > 0);

  assert.equal(findByRole(konva, 'title').text, iaOf(scene).title);
  assert.equal(findByRole(konva, 'subtitle').text, iaOf(scene).subtitle);
  assert.equal(findByRole(konva, 'core_idea').text, iaOf(scene).core_idea);
  assert.equal(findByRole(konva, 'development/0/label').text, 'Ce que Newton disait');
  assert.equal(
    findByRole(konva, 'development/1/points').text,
    iaOf(scene).development[1].points.join('\n'),
  );
});

test('sens 1 — les objets sortent des fabriques du modèle (champs obligatoires présents)', () => {
  const konva = liveSceneToKonvaScene(makeScene());
  assert.ok(konva.objects.length > 0);

  // Ces champs ne sont pas décoratifs : le designer Konva les lit (verrou, calque
  // élève/prof, palier de révélation). Un objet fabriqué à la main les perdrait.
  for (const obj of konva.objects) {
    for (const key of ['id', 'type', 'x', 'y', 'width', 'height', 'opacity', 'rotation', 'locked', 'visibleFor', 'step', 'mindmapNodeId', 'masterScriptRef']) {
      assert.ok(Object.prototype.hasOwnProperty.call(obj, key), `champ « ${key} » absent de l'objet ${obj.id}`);
    }
    assert.ok(Number.isFinite(obj.x) && Number.isFinite(obj.y));
  }
});

test('sens 1 — les identifiants d\'objets sont stables entre deux ouvertures', () => {
  const a = liveSceneToKonvaScene(makeScene()).objects.map((o) => o.id);
  const b = liveSceneToKonvaScene(makeScene()).objects.map((o) => o.id);
  assert.deepEqual(a, b);
});

test('sens 1 — la lecture ne mute pas la scène source', () => {
  const scene = makeScene();
  const before = JSON.stringify(scene);
  liveSceneToKonvaScene(scene);
  assert.equal(JSON.stringify(scene), before);
});

/* ------------------------------------------------- sens 2 : patch partiel */

test('sens 2 — le patch est PARTIEL : aucune colonne système n\'y figure', () => {
  const scene = makeScene();
  const patch = konvaSceneToLiveScenePatch(liveSceneToKonvaScene(scene), scene);

  assert.deepEqual(Object.keys(patch), ['content_payload_json']);
  for (const forbidden of ['id', 'name', 'order_index', 'scene_type', 'live_session_id', 'is_active', 'audio_url', 'chapter_id', 'render_mode']) {
    assert.ok(!(forbidden in patch), `le patch ne doit pas porter « ${forbidden} »`);
  }
});

test('sens 2 — le patch ne mute pas la scène précédente', () => {
  const scene = makeScene();
  const konva = liveSceneToKonvaScene(scene);
  const before = JSON.stringify(scene);
  konvaSceneToLiveScenePatch(konva, scene);
  assert.equal(JSON.stringify(scene), before);
});

/* --------------------------------------------------- aller-retour sans perte */

test('aller-retour — la scène revient équivalente (colonnes + ia_data intacts)', () => {
  const scene = makeScene();
  const patch = konvaSceneToLiveScenePatch(liveSceneToKonvaScene(scene), scene);
  const next = applyLiveScenePatch(scene, patch);

  // Colonnes de la ligne : la narration, le chapitre et le mode survivent.
  assert.equal(next.audio_url, scene.audio_url);
  assert.equal(next.chapter_id, scene.chapter_id);
  assert.equal(next.render_mode, scene.render_mode);
  assert.equal(next.name, scene.name);
  assert.equal(next.order_index, scene.order_index);
  assert.equal(next.id, scene.id);

  // Contenu pédagogique : identique champ pour champ.
  assert.deepEqual(iaOf(next), iaOf(scene));

  // Reste du payload (indices de prompteur, objectifs, traçabilité).
  assert.equal(next.content_payload_json.slide_hint, scene.content_payload_json.slide_hint);
  assert.deepEqual(next.content_payload_json.objectives, scene.content_payload_json.objectives);
  assert.equal(next.content_payload_json.source_moment_id, scene.content_payload_json.source_moment_id);
});

test('aller-retour — les champs de ia_data non représentés sur le canevas survivent', () => {
  const scene = makeScene();
  const konva = liveSceneToKonvaScene(scene);

  // Aucun objet ne porte le croquis, le résumé ni la question : ils ne peuvent
  // donc revenir que par PRÉSERVATION, jamais par reconstruction.
  const roles = roleObjects(konva).map((o) => o.masterScriptRef);
  for (const absent of ['sketch', 'slide_summary', 'student_prompt', 'theme', 'illustration_url']) {
    assert.ok(!roles.includes(`${LIRI_IA_ROLE_PREFIX}${absent}`));
  }

  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(konva, scene));
  assert.deepEqual(iaOf(next).sketch, iaOf(scene).sketch);
  assert.equal(iaOf(next).slide_summary, iaOf(scene).slide_summary);
  assert.equal(iaOf(next).student_prompt, iaOf(scene).student_prompt);
  assert.equal(iaOf(next).theme, iaOf(scene).theme);
  assert.equal(iaOf(next).illustration_url, iaOf(scene).illustration_url);
});

test('aller-retour — la forme legacy de `development` reste legacy (pas de bascule de layout)', () => {
  const scene = makeScene();
  scene.content_payload_json.ia_data.development = [
    'Premier point énoncé au tableau.',
    'Deuxième point.',
    'Troisième point.',
  ];
  assert.equal(isStructuredDevelopment(iaOf(scene).development), false);

  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(liveSceneToKonvaScene(scene), scene));
  assert.equal(isStructuredDevelopment(iaOf(next).development), false);
  assert.deepEqual(iaOf(next).development, iaOf(scene).development);
});

test('aller-retour — deux passages consécutifs sont stables (idempotence)', () => {
  const scene = makeScene();
  const once = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(liveSceneToKonvaScene(scene), scene));
  const twice = applyLiveScenePatch(once, konvaSceneToLiveScenePatch(liveSceneToKonvaScene(once), once));
  assert.deepEqual(iaOf(twice), iaOf(once));
  assert.equal(twice.audio_url, scene.audio_url);
  assert.equal(twice.chapter_id, scene.chapter_id);
  assert.equal(twice.render_mode, scene.render_mode);
});

test('aller-retour — la mise en page manuelle est mémorisée puis relue', () => {
  const scene = makeScene();
  const konva = liveSceneToKonvaScene(scene);
  konva.objects.find((o) => o.masterScriptRef === `${LIRI_IA_ROLE_PREFIX}title`).x = 321;

  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(konva, scene));
  assert.ok(Array.isArray(next.content_payload_json[KONVA_LAYOUT_PAYLOAD_KEY]));

  const reopened = liveSceneToKonvaScene(next);
  assert.equal(reopened.fromSavedLayout, true);
  assert.equal(findByRole(reopened, 'title').x, 321);
});

/* ------------------------------------------------------------- édition réelle */

test('édition — retoucher un texte le remonte dans ia_data, le reste ne bouge pas', () => {
  const scene = makeScene();
  const konva = liveSceneToKonvaScene(scene);
  findByRole(konva, 'title').text = 'La courbure, autrement dit la géométrie';
  findByRole(konva, 'development/1/points').text = 'La masse déforme la géométrie.\nLa pomme suit une géodésique.';

  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(konva, scene));
  assert.equal(iaOf(next).title, 'La courbure, autrement dit la géométrie');
  assert.deepEqual(iaOf(next).development[1].points, [
    'La masse déforme la géométrie.',
    'La pomme suit une géodésique.',
  ]);
  // Le groupe voisin et les champs muets n'ont pas été touchés.
  assert.deepEqual(iaOf(next).development[0], iaOf(scene).development[0]);
  assert.equal(iaOf(next).development[1].label, iaOf(scene).development[1].label);
  assert.deepEqual(iaOf(next).sketch, iaOf(scene).sketch);
  assert.equal(next.audio_url, scene.audio_url);
});

/* ------------------------------------------------------------ non-destruction */

test('non-destruction — vider un bloc sur le canevas n\'efface pas la donnée', () => {
  const scene = makeScene();
  const konva = liveSceneToKonvaScene(scene);
  findByRole(konva, 'title').text = '';
  findByRole(konva, 'core_idea').text = '   ';
  findByRole(konva, 'development/0/points').text = '';

  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(konva, scene));
  assert.equal(iaOf(next).title, iaOf(scene).title);
  assert.equal(iaOf(next).core_idea, iaOf(scene).core_idea);
  assert.deepEqual(iaOf(next).development[0].points, iaOf(scene).development[0].points);
});

test('non-destruction — supprimer des objets n\'efface pas la donnée correspondante', () => {
  const scene = makeScene();
  const konva = liveSceneToKonvaScene(scene);
  konva.objects = konva.objects.filter((o) => o.masterScriptRef === `${LIRI_IA_ROLE_PREFIX}title`);

  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(konva, scene));
  assert.deepEqual(iaOf(next), iaOf(scene));
});

test('non-destruction — un canevas totalement vide ne vide pas la scène', () => {
  const scene = makeScene();
  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch([], scene));
  assert.deepEqual(iaOf(next), iaOf(scene));
  assert.equal(next.audio_url, scene.audio_url);
  assert.equal(next.chapter_id, scene.chapter_id);
});

/* ------------------------------------------------------- fidélité du texte brut */

/** Points « piégeux » : chacun a réellement été corrompu par une version du pont. */
function sceneWithPoints(points) {
  const scene = makeScene();
  scene.content_payload_json.ia_data.development = [{ label: 'Repères', points }];
  return scene;
}

test('fidélité — un point commençant par « - » garde son signe moins', () => {
  // Régression : « -273,15 °C » revenait « 273,15 °C ». Un cours de physique
  // perdait son zéro absolu, sans trace ni moyen de le rattraper.
  const scene = sceneWithPoints(['-273,15 °C : le zéro absolu.', 'Température ordinaire.']);
  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(liveSceneToKonvaScene(scene), scene));
  assert.deepEqual(iaOf(next).development[0].points, iaOf(scene).development[0].points);
});

test('fidélité — un point commençant par « * » garde son astérisque', () => {
  const scene = sceneWithPoints(['*étoile* en Markdown']);
  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(liveSceneToKonvaScene(scene), scene));
  assert.deepEqual(iaOf(next).development[0].points, ['*étoile* en Markdown']);
});

test('fidélité — un point contenant un retour à la ligne ne se scinde pas en deux', () => {
  const scene = sceneWithPoints(['Une idée\nqui tient sur deux lignes.']);
  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(liveSceneToKonvaScene(scene), scene));
  assert.equal(iaOf(next).development[0].points.length, 1);
  assert.deepEqual(iaOf(next).development[0].points, iaOf(scene).development[0].points);
});

test('fidélité — idem pour la forme legacy de `development`', () => {
  const scene = makeScene();
  scene.content_payload_json.ia_data.development = ['-273,15 °C', 'Deux\nlignes'];
  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(liveSceneToKonvaScene(scene), scene));
  assert.deepEqual(iaOf(next).development, ['-273,15 °C', 'Deux\nlignes']);
});

test('fidélité — sur un bloc ÉDITÉ, la puce tombe mais pas le signe moins', () => {
  // Le bloc est réellement retouché : la préservation « bloc non touché » ne
  // s'applique plus, c'est donc le découpage en points qui est éprouvé ici — le
  // seul endroit où une puce mal détectée peut encore manger un caractère.
  const scene = sceneWithPoints(['Point initial']);
  const konva = liveSceneToKonvaScene(scene);
  findByRole(konva, 'development/0/points').text = '- Puce tapée à la main\n-273,15 °C reste intact\n• Autre puce\n*étoile* intacte';

  const next = applyLiveScenePatch(scene, konvaSceneToLiveScenePatch(konva, scene));
  assert.deepEqual(iaOf(next).development[0].points, [
    'Puce tapée à la main',
    '-273,15 °C reste intact',
    'Autre puce',
    '*étoile* intacte',
  ]);
});

/* -------------------------------------------------------- scènes « elements » */

test('elements — aller-retour sans perte du reste du payload', () => {
  const scene = makeElementsScene();
  assert.equal(detectSceneCanvasMode(scene), 'elements');

  const konva = liveSceneToKonvaScene(scene);
  assert.equal(konva.mode, 'elements');
  assert.equal(konva.objects[0].text, 'Titre importé');

  const patch = konvaSceneToLiveScenePatch(konva, scene);
  assert.deepEqual(Object.keys(patch), ['content_payload_json']);

  const next = applyLiveScenePatch(scene, patch);
  assert.equal(next.audio_url, scene.audio_url);
  assert.equal(next.chapter_id, scene.chapter_id);
  assert.equal(next.render_mode, scene.render_mode);
  assert.equal(next.content_payload_json.slide_hint, scene.content_payload_json.slide_hint);
  assert.equal(next.content_payload_json.elements[0].content, 'Titre importé');
  assert.equal(next.content_payload_json.elements[0].x, 44);
});

test('elements — un canevas vidé ne remplace pas les éléments existants', () => {
  const scene = makeElementsScene();
  const patch = konvaSceneToLiveScenePatch([], scene, { mode: 'elements' });
  assert.deepEqual(patch, {});
  const next = applyLiveScenePatch(scene, patch);
  assert.deepEqual(next.content_payload_json.elements, scene.content_payload_json.elements);
});

/* ---------------------------------------------------------- brouillon wizard */

test('brouillon wizard — le patch vise `ia_data` à la racine, là où la donnée vit', () => {
  const draft = {
    id: 'draft-1',
    name: 'Brouillon',
    ia_data: { title: 'Titre brouillon', core_idea: 'Idée', student_prompt: 'Question ?' },
    content_payload_json: { slide_hint: 'indice' },
  };
  const konva = liveSceneToKonvaScene(draft);
  findByRole(konva, 'title').text = 'Titre retouché';

  const patch = konvaSceneToLiveScenePatch(konva, draft);
  assert.ok('ia_data' in patch);
  assert.equal(patch.ia_data.title, 'Titre retouché');
  assert.equal(patch.ia_data.student_prompt, 'Question ?');
  assert.equal(patch.content_payload_json.slide_hint, 'indice');
});
