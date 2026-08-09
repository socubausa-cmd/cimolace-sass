// node --test apps/app/src/lib/phonePays.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAYS_TEL, PAYS_AUTRE, trouverPays, nettoyerLocal, validerLocal, composerE164 } from './phonePays.js';

const GA = trouverPays('GA');
const FR = trouverPays('FR');
const CM = trouverPays('CM');

test('table des pays : indicatifs uniques par iso, bornes cohérentes', () => {
  const isos = new Set(PAYS_TEL.map((p) => p.iso));
  assert.equal(isos.size, PAYS_TEL.length);
  for (const p of PAYS_TEL) {
    assert.ok(/^\d+$/.test(p.cc), `${p.iso} indicatif numérique`);
    assert.ok(p.min >= 6 && p.max <= 15 && p.min <= p.max, `${p.iso} bornes plausibles`);
  }
});

test('Gabon : le 0 de tête est CONSERVÉ (+241 06… → +24106…)', () => {
  const local = nettoyerLocal(GA, '06 86 33 36');
  assert.equal(local, '06863336');
  assert.equal(validerLocal(GA, local).ok, true);
  assert.equal(composerE164(GA, local), '+24106863336');
});

test('France : le 0 national est retiré (06 12 34 56 78 → +33612345678)', () => {
  const local = nettoyerLocal(FR, '06 12 34 56 78');
  assert.equal(local, '612345678');
  assert.equal(validerLocal(FR, local).ok, true);
  assert.equal(composerE164(FR, local), '+33612345678');
});

test('indicatif recollé par le visiteur : absorbé, pas doublé', () => {
  assert.equal(composerE164(GA, nettoyerLocal(GA, '+241 06 86 33 36')), '+24106863336');
  assert.equal(composerE164(GA, nettoyerLocal(GA, '00241 06863336')), '+24106863336');
  assert.equal(composerE164(CM, nettoyerLocal(CM, '+237 6 90 12 34 56')), '+237690123456');
});

test('longueur nationale : trop court / trop long refusés avec aide chiffrée', () => {
  assert.equal(validerLocal(CM, '69012').ok, false);
  assert.match(validerLocal(CM, '69012').message, /9 chiffres/);
  assert.equal(validerLocal(CM, '690123456').ok, true);
  assert.equal(validerLocal(CM, '6901234567').ok, false);
});

test('Autre pays : international libre 8–15 chiffres, + imposé à la composition', () => {
  assert.equal(validerLocal(PAYS_AUTRE, '590690').ok, false);
  assert.equal(validerLocal(PAYS_AUTRE, '590690000000').ok, true);
  assert.equal(composerE164(PAYS_AUTRE, '590 690 00 00 00'), '+590690000000');
});

test('vide → composition vide (pas de « + » orphelin)', () => {
  assert.equal(composerE164(GA, ''), '');
  assert.equal(validerLocal(GA, '').ok, false);
  assert.equal(validerLocal(GA, '').message, '');
});
