/**
 * Test de l'émission des dispositifs (A2). `node --test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enrichCourseWithDevices } from './enrichCourseWithDevices.js';

const types = (scenes) => scenes.map((s) => s.type);

test('définition → surlignage + encadre insérés juste après la leçon', () => {
  const course = { title: 'T', concepts: [{ title: 'C', scenes: [
    { type: 'lecon', board_text: "On appelle «énergie» la capacité à produire un travail. C'est fondamental." },
    { type: 'transition', narration: 'Suite…' },
  ] }] };
  const out = enrichCourseWithDevices(course).concepts[0].scenes;
  assert.deepEqual(types(out).slice(0, 3), ['lecon', 'surlignage', 'encadre']);
  assert.equal(out[1].term, 'énergie');
  assert.ok(out[1].text.toLowerCase().includes('énergie'));
});

test('énumération → resume_encadre AVANT la transition, ≥2 points', () => {
  const course = { title: 'T', concepts: [{ title: 'C', scenes: [
    { type: 'lecon', board_text: "Il existe plusieurs types : d'abord les conducteurs, ensuite les isolants, enfin les semi-conducteurs." },
    { type: 'transition', narration: 'Suite' },
  ] }] };
  const out = enrichCourseWithDevices(course).concepts[0].scenes;
  const t = types(out);
  assert.ok(t.includes('resume_encadre'));
  assert.ok(t.indexOf('resume_encadre') < t.indexOf('transition'));
  assert.ok(out.find((s) => s.type === 'resume_encadre').points.length >= 3);
});

test('formule → encadre kind=formule', () => {
  const course = { concepts: [{ scenes: [
    { type: 'lecon', board_text: 'Le calcul se pose ainsi : 7 × 9 = 63, puis on additionne.' },
  ] }] };
  const out = enrichCourseWithDevices(course).concepts[0].scenes;
  const enc = out.find((s) => s.type === 'encadre');
  assert.ok(enc && enc.kind === 'formule');
});

test('aucun signal → aucune scène ajoutée (pas d\'encadré vide)', () => {
  const course = { concepts: [{ scenes: [{ type: 'lecon', board_text: 'Un texte simple sans signal ici présent.' }] }] };
  assert.deepEqual(types(enrichCourseWithDevices(course).concepts[0].scenes), ['lecon']);
});

test('robuste : null / concept vide → jamais de throw', () => {
  assert.doesNotThrow(() => enrichCourseWithDevices(null));
  assert.doesNotThrow(() => enrichCourseWithDevices({ concepts: [{}] }));
  assert.doesNotThrow(() => enrichCourseWithDevices({ concepts: [{ scenes: [] }] }));
});
