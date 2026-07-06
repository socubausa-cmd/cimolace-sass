// Tests du reducer PUR du Protocole de Visite (spec §3). node --test, zéro DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProtocol, STEPS_SCHEMA, VNP_PHASES } from './vnpProtocol.js';

// Graphe mock minimal (schéma nœud VNP enrichi).
const NODES = {
  identity: { id: 'identity', title: 'Identité', summary: 'Résumé identité.', content: 'Détail long identité.', related: ['vision', 'produits'], actions: ['contacter'] },
  vision: { id: 'vision', title: 'Vision', summary: 'Résumé vision.', content: 'Détail vision.', related: ['identity'], actions: [] },
  produits: { id: 'produits', title: 'Forfaits', summary: 'Résumé forfaits.', content: 'Détail forfaits 50/180 €.', related: ['contact'], actions: ['acheter', 'contacter'] },
  contact: { id: 'contact', title: 'Contact', summary: 'Contactez-nous.', content: '', related: [], actions: ['contacter'] },
};
const graph = { nodes: NODES, tourOrder: ['identity', 'vision', 'produits', 'contact'], byId: (id) => NODES[id] || null };
const mk = () => createProtocol({ graph });
const types = (r) => r.effects.map((e) => e.type);

test('état initial = accueil', () => {
  assert.equal(mk().state.phase, 'accueil');
});

test('transition ILLÉGALE = no-op déterministe (effets vides, phase inchangée)', () => {
  const p = mk();
  const r = p.dispatch({ type: 'WANT_DETAIL' }); // illégal depuis accueil
  assert.deepEqual(r.effects, []);
  assert.equal(p.state.phase, 'accueil');
});

test('OPEN_NODE : RÉSUMÉ d\'abord + action Approfondir + couverture', () => {
  const p = mk();
  const r = p.dispatch({ type: 'OPEN_NODE', payload: { nodeId: 'identity' } });
  assert.equal(p.state.phase, 'approfondissement');
  assert.equal(r.effects[0].type, 'SPEAK');
  assert.equal(r.effects[0].text, 'Résumé identité.'); // le RÉSUMÉ, pas le détail
  const acts = r.effects.find((e) => e.type === 'SET_ACTIONS').items;
  assert.ok(acts.some((a) => a.id === '__detail__'), 'action Approfondir présente');
  assert.ok(p.state.covered.includes('identity'));
});

test('WANT_DETAIL : DÉTAIL sur demande, une seule fois', () => {
  const p = mk();
  p.dispatch({ type: 'OPEN_NODE', payload: { nodeId: 'identity' } });
  const r1 = p.dispatch({ type: 'WANT_DETAIL' });
  assert.equal(r1.effects[0].text, 'Détail long identité.');
  assert.equal(p.state.detailShown, true);
  const r2 = p.dispatch({ type: 'WANT_DETAIL' }); // pas de répétition
  assert.deepEqual(r2.effects, []);
});

test('visite guidée : ASK_TOUR déroule par priorite_tour, PAUSE puis reprise', () => {
  const p = mk();
  const r0 = p.dispatch({ type: 'ASK_TOUR' });
  assert.equal(p.state.phase, 'visite_guidee');
  const step0 = r0.effects.find((e) => e.type === 'TOUR_STEP');
  assert.equal(step0.nodeId, 'identity'); // 1er de tourOrder
  assert.ok(types(r0).includes('ASK_TOUR_CONTINUE'));
  const r1 = p.dispatch({ type: 'TOUR_NEXT' });
  assert.equal(r1.effects.find((e) => e.type === 'TOUR_STEP').nodeId, 'vision');
  assert.ok(p.state.covered.includes('identity') && p.state.covered.includes('vision'));
  // PAUSE → exploration libre, puis on peut reprendre le tour
  const rp = p.dispatch({ type: 'TOUR_PAUSE' });
  assert.equal(p.state.phase, 'exploration_libre');
  assert.equal(rp.effects[0].type, 'SPEAK');
  const rr = p.dispatch({ type: 'ASK_TOUR' });
  assert.equal(p.state.phase, 'visite_guidee'); // reprise
  assert.ok(rr.effects.some((e) => e.type === 'TOUR_STEP'));
});

test('fin du tour → TOUR_STEP end + retour orientation', () => {
  const p = mk();
  p.dispatch({ type: 'ASK_TOUR' }); // beat 0 = identity ; tourOrder a 4 nœuds
  let last;
  for (let i = 0; i < 4; i += 1) last = p.dispatch({ type: 'TOUR_NEXT' }); // le 4e dépasse la fin
  const end = last.effects.find((e) => e.type === 'TOUR_STEP');
  assert.equal(end.end, true);
  assert.equal(p.state.phase, 'orientation');
});

test('CONVERSION : ACTION contacter → OPEN_CONTACT + phase conversion', () => {
  const p = mk();
  p.dispatch({ type: 'OPEN_NODE', payload: { nodeId: 'produits' } });
  const r = p.dispatch({ type: 'ACTION', payload: { action: 'contacter' } });
  assert.equal(p.state.phase, 'conversion');
  assert.ok(r.effects.some((e) => e.type === 'OPEN_CONTACT'));
  const r2 = p.dispatch({ type: 'DELIVERED' });
  assert.equal(p.state.phase, 'cloture');
  assert.ok(r2.effects.some((e) => e.type === 'SPEAK'));
});

test('ACTION acheter → GO_CHECKOUT (pas OPEN_CONTACT)', () => {
  const p = mk();
  p.dispatch({ type: 'OPEN_NODE', payload: { nodeId: 'produits' } });
  const r = p.dispatch({ type: 'ACTION', payload: { action: 'acheter' } });
  assert.ok(r.effects.some((e) => e.type === 'GO_CHECKOUT'));
  assert.ok(!r.effects.some((e) => e.type === 'OPEN_CONTACT'));
});

test('reset() = idempotent (retour accueil, couverture vidée)', () => {
  const p = mk();
  p.dispatch({ type: 'ASK_TOUR' });
  p.dispatch({ type: 'TOUR_NEXT' });
  p.reset();
  assert.equal(p.state.phase, 'accueil');
  assert.deepEqual(p.state.covered, []);
  assert.equal(p.state.tourIdx, -1);
});

test('cohérence : toute cible de transition est une phase connue', () => {
  for (const [phase, table] of Object.entries(STEPS_SCHEMA)) {
    assert.ok(VNP_PHASES.includes(phase));
    for (const target of Object.values(table)) assert.ok(VNP_PHASES.includes(target), `${target} inconnue`);
  }
});
