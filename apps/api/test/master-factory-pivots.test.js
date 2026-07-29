/**
 * Master Factory pivots — test déterministe sans DB.
 *
 * Runner :
 *   npm run build -w @isna/api
 *   node --test apps/api/test/master-factory-pivots.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { MasterFactoryService } = require('../dist/masterclass-factory/master-factory.service.js');
const { RenderPivotService } = require('../dist/masterclass-factory/render-pivot.service.js');
const { SourceAdaptersService } = require('../dist/masterclass-factory/source-adapters.service.js');

const svc = new MasterFactoryService(null, null, null, null, null);

const comprehension = {
  schema_version: 1,
  titre: 'Introduction à la Prorascience',
  promesse: 'Comprendre le problème, la solution et le parcours proposé.',
  public: 'Élèves et parents',
  prerequis: [],
  notions: [
    {
      id: 'n1',
      titre: 'La problématique',
      idee_centrale: "Avant, l'élève reçoit trop d'informations sans navigation intelligente.",
      pourquoi: "Nommer le problème permet de comprendre pourquoi Liri doit guider l'apprentissage.",
      appuis: ['ancien parcours saturé'],
    },
    {
      id: 'n2',
      titre: 'La solution',
      idee_centrale: 'Le moteur intelligent organise, explique et guide au lieu de montrer une page statique.',
      pourquoi: "L'élève doit pouvoir avancer par questions, raccourcis et reformulations.",
      appuis: ['mode IA, navigation intelligente, écran qui parle'],
    },
  ],
  glossaire: [],
  meta: {
    source_type: 'texte',
    source_id: 'demo-prorascience',
    source_title: 'Démo Prorascience',
    transcript_chars: 1200,
    segments: 1,
    model: 'test',
    generated_at: '2026-07-28T00:00:00.000Z',
  },
};

test('comprehension → master script → smartboard timeline → live scenario', () => {
  const master = svc.makeMasterScript(comprehension, 'pivot-comprehension');
  assert.equal(master.kind, 'master_script');
  assert.equal(master.moments.length, 2);
  assert.equal(master.moments[0].notion_id, 'n1');
  assert.match(master.moments[0].teacher_script, /problématique/i);

  const smartboard = svc.makeSmartboardTimeline(master, 'pivot-master-script');
  assert.equal(smartboard.kind, 'smartboard_timeline');
  assert.equal(smartboard.scenes.length, 2);
  assert.equal(smartboard.scenes[0].timeline.some((a) => a.type === 'write'), true);
  assert.equal(smartboard.scenes[0].timeline.some((a) => a.type === 'highlight'), true);
  assert.equal(smartboard.scenes[0].camera_zone, 'bottom-right');

  const live = svc.makeLiveScenario(master, smartboard, 'pivot-master-script', 'pivot-smartboard');
  assert.equal(live.kind, 'live_scenario');
  assert.equal(live.scenes.length, 2);
  assert.equal(live.scenes[0].smartboard_scene_id, smartboard.scenes[0].id);
  assert.equal(live.replay_postprod_targets.includes('video_semaine'), true);
  assert.equal(live.replay_postprod_targets.includes('quiz'), true);

  const liveSceneRows = svc.makeLiveSceneRows('live-session-1', smartboard, live);
  assert.equal(liveSceneRows.length, 2);
  assert.equal(liveSceneRows[0].live_session_id, 'live-session-1');
  assert.equal(liveSceneRows[0].scene_type, 'smartboard');
  assert.equal(liveSceneRows[0].content_payload_json.source, 'master_factory');
  assert.equal(liveSceneRows[0].content_payload_json.ia_data.timeline.length > 0, true);

  const scriptRows = svc.makeLiveScriptRows('live-session-1', 'user-1', master);
  assert.equal(scriptRows.length, 2);
  assert.equal(scriptRows[0].session_id, 'live-session-1');
  assert.equal(scriptRows[0].created_by, 'user-1');
  assert.match(scriptRows[0].content, /Discours du professeur/);
  assert.equal(scriptRows[0].master_agent.message_central, master.moments[0].message_central);
});

test('cours écrit → projet Masterclass éditable sans nouvelle génération', async () => {
  const written = {
    titre: 'Introduction à la Prorascience',
    lecons: [
      {
        notion_id: 'n1',
        titre: 'La problématique',
        amorce: { situation: 'Une page saturée.', question: 'Comment mieux guider ?' },
        intuition: 'Commencer par une intention, pas par un menu.',
        definition: { enonce: 'La navigation intelligente répond et agit.' },
        exemple: { deroule: 'Liri ouvre le bon écran au bon moment.' },
        erreur_frequente: { erreur: 'Tout afficher.', correction: 'Révéler progressivement.' },
        mise_en_situation: { contexte: 'Accueil', consigne: 'Poser une question', reussite: 'Le bon parcours est ouvert.' },
        je_retiens: { phrases: ['Une intention produit un parcours.'] },
        quiz: [{ question: 'Que faut-il privilégier ?', options: ['Le guidage', 'La saturation'], explication: 'Le guidage.' }],
      },
    ],
  };
  const db = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        is() { return query; },
        maybeSingle() {
          if (table !== 'course_pivots') return Promise.resolve({ data: null });
          query.calls = (query.calls || 0) + 1;
          const data = db.pivotCall++ === 0
            ? { id: 'pivot-comp', payload: comprehension }
            : { id: 'pivot-ecrit', payload: written };
          return Promise.resolve({ data });
        },
      };
      return query;
    },
    pivotCall: 0,
  };
  const render = new RenderPivotService({ client: db });
  const project = await render.renderMasterclassProject('tenant-1', 'replay', 'replay-1');

  assert.equal(project.analysis.global_subject, written.titre);
  assert.equal(project.chapters.length, 1);
  assert.equal(project.chapters[0].segments.length, 21);
  assert.equal(project.chapters[0].segments.find((s) => s.name === 'JE RETIENS').content, 'Une intention produit un parcours.');
  assert.equal(project.master_factory.comprehension_pivot_id, 'pivot-comp');
  assert.equal(project.master_factory.written_pivot_id, 'pivot-ecrit');
  assert.equal(project.master_factory.imported_without_regeneration, true);
  assert.equal(project.analysis.provider, 'master-factory-pivot');
});

test('adaptateur replay normalise les trois dialectes de repères temporels', async () => {
  const row = {
    id: 'replay-1', tenant_id: 'tenant-1', title: 'Replay',
    transcript_text: 'Une transcription suffisamment longue et réellement exploitable.',
    transcript_cues: [
      { start: 12, text: 'ancien format start' },
      { start_sec: 34, text: 'format start sec' },
      { t: 56, text: 'format canonique' },
    ],
  };
  const query = {
    select() { return query; },
    eq() { return query; },
    maybeSingle() { return Promise.resolve({ data: row }); },
  };
  const adapter = new SourceAdaptersService({ client: { from: () => query } });
  const source = await adapter.load('replay', row.id, row.tenant_id);
  assert.deepEqual(source.cues.map((cue) => cue.t), [12, 34, 56]);
});
