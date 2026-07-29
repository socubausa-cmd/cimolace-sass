/**
 * Master Factory — garde-fous de contenu (bug « K »/« a » du 29/07).
 *
 * Fixture volontairement CORROMPUE, reproduisant la sortie IA réelle consignée
 * dans artifacts/master-factory-course-review-20260729/replay-to-live-real-e2e-proof.json:154-158 :
 * la compréhension avait renvoyé des appuis d'un seul caractère (« K », « a »)
 * qui finissaient affichés tels quels dans le prompteur, la mindmap et le
 * tableau. Le master script doit filtrer ces fragments SANS écarter la notion.
 *
 * Runner (le build est requis : les tests chargent dist/) :
 *   npm run build
 *   node --test apps/api/test/master-factory-content-guard.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { MasterFactoryService } = require('../dist/masterclass-factory/master-factory.service.js');

const svc = new MasterFactoryService(null, null, null, null, null);

const meta = {
  source_type: 'replay',
  source_id: 'replay-popper',
  source_title: 'Replay falsifiabilité',
  transcript_chars: 4200,
  segments: 3,
  model: 'test',
  generated_at: '2026-07-29T00:00:00.000Z',
};

// Notion 1 : deux fragments corrompus + un appui réel — l'appui réel doit survivre.
// Notion 2 : TOUS les appuis sont corrompus — la notion reste exploitable,
// key_points retombe sur l'idée centrale seule.
const corrupted = {
  schema_version: 1,
  titre: "La physique quantique décodée par l'Égypte antique",
  promesse: 'Comprendre où le critère de démarcation atteint ses limites.',
  public: 'Élèves',
  prerequis: [],
  notions: [
    {
      id: 'n1',
      titre: 'Les limites du critère de falsifiabilité',
      idee_centrale: 'Le critère de Popper exige la réfutabilité pour distinguer science et non-science.',
      pourquoi: 'Sans démarcation claire, tout discours peut se prétendre scientifique.',
      appuis: ['K', 'a', 'Le critère de Popper exige la réfutabilité'],
    },
    {
      id: 'n2',
      titre: 'Notion aux appuis entièrement corrompus',
      idee_centrale: 'Une notion reste exploitable même quand la source ne fournit aucun appui valide.',
      pourquoi: '',
      appuis: ['K', ' a ', '!'],
    },
  ],
  glossaire: [],
  meta,
};

// Un fragment entre guillemets français de 1 ou 2 caractères = résidu du bug.
const FRAGMENT_ENTRE_GUILLEMETS = /«\s*[^»\s]{1,2}\s*»/;

test('makeMasterScript ne laisse passer aucun key_point < 3 caractères', () => {
  const master = svc.makeMasterScript(corrupted, 'pivot-comprehension');
  assert.equal(master.moments.length, 2, 'aucune notion ne doit être écartée par le filtre des appuis');
  for (const moment of master.moments) {
    for (const point of moment.key_points) {
      assert.equal(typeof point, 'string');
      assert.equal(point.trim().length >= 3, true, `key_point corrompu conservé : "${point}" (${moment.id})`);
    }
    assert.doesNotMatch(moment.teacher_script, FRAGMENT_ENTRE_GUILLEMETS, `repère corrompu dans le prompteur (${moment.id})`);
  }
  // Le prompteur ne doit jamais citer un fragment d'un caractère comme repère source.
  assert.doesNotMatch(master.moments[0].teacher_script, /repère\s*:\s*«\s*K\s*»/);
  assert.doesNotMatch(master.moments[0].teacher_script, /«\s*K\s*»/);
  assert.doesNotMatch(master.moments[0].teacher_script, /«\s*a\s*»/);
  // L'appui réel de la source survit au nettoyage.
  assert.equal(master.moments[0].key_points.includes('Le critère de Popper exige la réfutabilité'), true);
});

test('une notion sans appui valide retombe sur son idée centrale seule', () => {
  const master = svc.makeMasterScript(corrupted, 'pivot-comprehension');
  const moment = master.moments.find((m) => m.notion_id === 'n2');
  assert.ok(moment, 'la notion aux appuis corrompus doit rester présente dans le master script');
  assert.deepEqual(moment.key_points, [moment.message_central]);
  assert.doesNotMatch(moment.teacher_script, FRAGMENT_ENTRE_GUILLEMETS);
});

test('la mindmap ne contient aucune branche key_point d’un caractère', () => {
  const master = svc.makeMasterScript(corrupted, 'pivot-comprehension');
  const mindmap = svc.makeMindmap(master, 'pivot-master-script');
  assert.equal(mindmap.branches.length, master.moments.length);
  for (const branch of mindmap.branches) {
    for (const point of branch.key_points) {
      assert.equal(point.trim().length >= 3, true, `branche corrompue dans la mindmap : "${point}"`);
    }
  }
  assert.doesNotMatch(mindmap.mermaid, /\("K"\)/);
  assert.doesNotMatch(mindmap.mermaid, /\("a"\)/);
});

test('au-delà de 12 notions, la troncature est tracée dans meta.truncated_notions', () => {
  const many = {
    ...corrupted,
    notions: Array.from({ length: 14 }, (_, index) => ({
      id: `n${index + 1}`,
      titre: `Notion ${index + 1}`,
      idee_centrale: `Idée centrale numéro ${index + 1}, suffisamment développée pour être enseignée.`,
      pourquoi: '',
      appuis: ['appui source réellement exploitable'],
    })),
  };
  const truncated = svc.makeMasterScript(many, 'pivot-comprehension');
  assert.equal(truncated.moments.length, 12);
  assert.equal(Object.hasOwn(truncated.meta, 'truncated_notions'), true, 'la troncature silencieuse est interdite');
  assert.ok(truncated.meta.truncated_notions, 'truncated_notions doit signaler les notions écartées');
  // À l'inverse, un cours court ne doit pas prétendre avoir été tronqué.
  const short = svc.makeMasterScript(corrupted, 'pivot-comprehension');
  assert.equal(Boolean(short.meta.truncated_notions), false);
});
