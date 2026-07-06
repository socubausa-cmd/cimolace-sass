/**
 * Tests des helpers de motion (brique D). `node --test`. Logique pure (aucun DOM/framer).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPO, sceneVariants, kenBurnsBoardZoom } from './precepteurMotion.js';

test('EXPO = cubic-bezier ease-out exponentiel', () => {
  assert.deepEqual(EXPO, [0.16, 1, 0.3, 1]);
});

test('reduced-motion : fondu SEUL (aucun translate/scale/blur) pour tous les types', () => {
  for (const type of ['lecon', 'croquis', 'surlignage', 'encadre', 'image_analogie', 'transition', 'atelier']) {
    const v = sceneVariants(type, true);
    assert.deepEqual(v.initial, { opacity: 0 }, `${type}: initial opacity-only`);
    assert.deepEqual(v.animate, { opacity: 1 }, `${type}: animate opacity-only`);
    for (const k of ['x', 'y', 'scale', 'filter']) {
      assert.ok(!(k in v.initial), `${type}: pas de ${k} en reduced`);
    }
  }
});

test('croquis (non reduced) : BoardSweep latéral (x négatif)', () => {
  const v = sceneVariants('croquis', false);
  assert.equal(v.initial.x, '-9%');
  assert.equal(v.animate.x, 0);
  assert.deepEqual(v.transition.ease, EXPO);
});

test('révélations (surlignage/encadre/resume) : entrée en pop (scale)', () => {
  for (const type of ['surlignage', 'encadre', 'resume_encadre']) {
    const v = sceneVariants(type, false);
    assert.equal(v.initial.scale, 0.9, `${type}: scale de départ`);
    assert.equal(v.animate.scale, 1);
  }
});

test('image_analogie : grande entrée latérale (x 55%)', () => {
  assert.equal(sceneVariants('image_analogie', false).initial.x, '55%');
});

test('leçon / défaut : montée douce (y)', () => {
  const v = sceneVariants('lecon', false);
  assert.equal(v.initial.y, '4%');
  assert.equal(v.animate.y, 0);
});

test('kenBurnsBoardZoom : push-in subtil ; neutre en reduced', () => {
  const on = kenBurnsBoardZoom(false);
  assert.ok(on.animate.scale > 1 && on.animate.scale <= 1.02, 'push-in subtil');
  assert.ok(on.transition.duration >= 6, 'lent');
  const off = kenBurnsBoardZoom(true);
  assert.equal(off.animate.scale, 1, 'aucun zoom en reduced');
});
