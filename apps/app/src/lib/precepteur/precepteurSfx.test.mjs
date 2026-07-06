/**
 * Tests du kit SFX (brique D). `node --test`.
 * AudioContext mocké (enregistre les nœuds créés / start / connect) → on prouve la logique
 * de synthèse sans navigateur, + le no-op headless + le mute.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrecepteurSfx, SFX_RECIPES, SCENE_SFX } from './precepteurSfx.js';

// ── Mock minimal d'AudioContext ──────────────────────────────────────────────
class MockParam {
  constructor() { this.value = 0; this.calls = []; }
  setValueAtTime(v, t) { this.calls.push(['set', v, t]); }
  linearRampToValueAtTime(v, t) { this.calls.push(['lin', v, t]); }
  exponentialRampToValueAtTime(v, t) { this.calls.push(['exp', v, t]); }
}
class MockNode {
  constructor(kind) { this.kind = kind; this.frequency = new MockParam(); this.gain = new MockParam(); this.Q = { value: 0 }; this.out = []; this.started = false; this.stopped = false; }
  connect(n) { this.out.push(n); }
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
function makeMockCtx() {
  const created = [];
  const ctx = {
    currentTime: 0, sampleRate: 44100, state: 'running', resumed: 0, closed: false,
    destination: new MockNode('dest'),
    createGain() { const n = new MockNode('gain'); created.push(n); return n; },
    createOscillator() { const n = new MockNode('osc'); created.push(n); return n; },
    createBufferSource() { const n = new MockNode('buffersrc'); created.push(n); return n; },
    createBiquadFilter() { const n = new MockNode('filter'); created.push(n); return n; },
    createBuffer(_ch, len) { return { getChannelData() { return new Float32Array(len); } }; },
    resume() { this.resumed += 1; this.state = 'running'; },
    close() { this.closed = true; },
  };
  return { ctx, created };
}
const MockAC = function MockAudioContext() { return makeMockCtx().ctx; };
// Fabrique un AudioContextImpl partageant `created` pour l'inspection.
function ACWithProbe() {
  const holder = {};
  const Impl = function () { const { ctx, created } = makeMockCtx(); holder.ctx = ctx; holder.created = created; return ctx; };
  return { Impl, holder };
}
const sources = (created) => created.filter((n) => n.kind === 'osc' || n.kind === 'buffersrc');

// ── Données pures ────────────────────────────────────────────────────────────
test('SFX_RECIPES : chaque voix a kind + gain ; SCENE_SFX pointe des recettes existantes', () => {
  for (const [name, recipe] of Object.entries(SFX_RECIPES)) {
    assert.ok(Array.isArray(recipe) && recipe.length, `${name} non vide`);
    for (const v of recipe) {
      assert.ok(v.kind === 'tone' || v.kind === 'noise', `${name}: kind`);
      assert.ok(typeof v.gain === 'number' && v.gain > 0 && v.gain <= 0.12, `${name}: gain bas`);
      if (v.kind === 'noise') assert.ok(v.filter, `${name}: bruit sans filtre`);
    }
  }
  for (const [type, sfx] of Object.entries(SCENE_SFX)) {
    assert.ok(SFX_RECIPES[sfx], `SCENE_SFX['${type}']='${sfx}' doit exister dans SFX_RECIPES`);
  }
});

// ── Headless / no-op ─────────────────────────────────────────────────────────
test('headless (aucun AudioContext) → kit no-op sûr, available=false, jamais throw', () => {
  const sfx = createPrecepteurSfx(); // window indéfini sous node → NOOP
  assert.equal(sfx.available, false);
  assert.doesNotThrow(() => { sfx.unlock(); sfx.play('reveal'); sfx.setMuted(true); sfx.dispose(); });
  assert.equal(sfx.isMuted(), true);
});

// ── Synthèse via mock ────────────────────────────────────────────────────────
test('play("reveal") : crée 2 oscillateurs démarrés, connectés au maître', () => {
  const { Impl, holder } = ACWithProbe();
  const sfx = createPrecepteurSfx({ AudioContextImpl: Impl });
  assert.equal(sfx.available, true);
  sfx.unlock();
  sfx.play('reveal');
  const osc = holder.created.filter((n) => n.kind === 'osc');
  assert.equal(osc.length, 2);
  assert.ok(osc.every((o) => o.started && o.stopped), 'oscillateurs start+stop');
});

test('play("write") : bruit filtré (3 buffersources + 3 filtres)', () => {
  const { Impl, holder } = ACWithProbe();
  const sfx = createPrecepteurSfx({ AudioContextImpl: Impl });
  sfx.play('write');
  assert.equal(holder.created.filter((n) => n.kind === 'buffersrc').length, 3);
  assert.equal(holder.created.filter((n) => n.kind === 'filter').length, 3);
});

test('play("sweep") : glissando de filtre (freqTo) programmé', () => {
  const { Impl, holder } = ACWithProbe();
  const sfx = createPrecepteurSfx({ AudioContextImpl: Impl });
  sfx.play('sweep');
  const filter = holder.created.find((n) => n.kind === 'filter');
  assert.ok(filter, 'un filtre créé');
  assert.ok(filter.frequency.calls.some((c) => c[0] === 'exp'), 'rampe exponentielle de fréquence');
});

test('mute : aucun nœud source créé quand muté ; réactivable', () => {
  const { Impl, holder } = ACWithProbe();
  const sfx = createPrecepteurSfx({ AudioContextImpl: Impl });
  sfx.unlock();
  sfx.setMuted(true);
  sfx.play('reveal');
  assert.equal(holder.created ? sources(holder.created).length : 0, 0, 'muté → aucune source');
  sfx.setMuted(false);
  sfx.play('reveal');
  assert.ok(sources(holder.created).length >= 2, 'réactivé → sources créées');
});

test('play(nom inconnu) : no-op, jamais throw', () => {
  const { Impl, holder } = ACWithProbe();
  const sfx = createPrecepteurSfx({ AudioContextImpl: Impl });
  sfx.unlock();
  assert.doesNotThrow(() => sfx.play('inexistant'));
  assert.equal(sources(holder.created).length, 0);
});

test('unlock() reprend un contexte suspendu', () => {
  let ctxRef;
  const Impl = function () { const { ctx } = makeMockCtx(); ctx.state = 'suspended'; ctxRef = ctx; return ctx; };
  const sfx = createPrecepteurSfx({ AudioContextImpl: Impl });
  sfx.unlock();
  assert.ok(ctxRef.resumed >= 1, 'resume appelé');
});
