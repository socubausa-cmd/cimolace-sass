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
