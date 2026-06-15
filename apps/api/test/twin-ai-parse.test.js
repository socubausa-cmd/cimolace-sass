// Vérifie la robustesse de parsing JSON du copilote (extractJsonBlock +
// repairTruncatedJson) sur des sorties LLM malformées réalistes.
// Convention repo : node --test contre dist/. (Lancer après `nest build`.)
const test = require('node:test');
const assert = require('node:assert');
const {
  extractJsonBlock,
  repairTruncatedJson,
} = require('../dist/medos/twin/twin-ai.service.js');

// Reproduit la cascade de callClaudeRaw pour valider le comportement bout-en-bout.
function parseRobust(rawText) {
  const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const block = extractJsonBlock(cleaned);
    const looseComma = (x) => (x ? x.replace(/,(\s*[}\]])/g, '$1') : null);
    const repaired = repairTruncatedJson(block ?? cleaned);
    for (const c of [block, looseComma(block), repaired, looseComma(repaired)]) {
      if (!c) continue;
      try {
        return JSON.parse(c);
      } catch {
        /* suivant */
      }
    }
    return undefined;
  }
}

test('JSON propre passe tel quel', () => {
  const r = parseRobust('{"hypotheses":[{"label_fr":"Dysbiose","probability":0.6}]}');
  assert.equal(r.hypotheses[0].label_fr, 'Dysbiose');
});

test('JSON enrobé de prose → extrait', () => {
  const r = parseRobust('Voici mon analyse :\n{"hypotheses":[{"label_fr":"Stress"}]}\nJ\'espère que cela aide.');
  assert.equal(r.hypotheses[0].label_fr, 'Stress');
});

test('fences markdown → nettoyées', () => {
  const r = parseRobust('```json\n{"root_causes":[{"label_fr":"Inflammation"}]}\n```');
  assert.equal(r.root_causes[0].label_fr, 'Inflammation');
});

test('virgule traînante → tolérée', () => {
  const r = parseRobust('{"hypotheses":[{"label_fr":"A"},{"label_fr":"B"},]}');
  assert.equal(r.hypotheses.length, 2);
});

test('JSON TRONQUÉ (coupé en plein milieu d\'une string) → réparé, hypothèses complètes conservées', () => {
  const truncated =
    '{"hypotheses":[' +
    '{"label_fr":"Résistance à l\'insuline","probability":0.7,"reasoning_fr":"glycémie élevée"},' +
    '{"label_fr":"Dysbiose","probability":0.5,"reasoning_fr":"ballonnements chro';
  const r = parseRobust(truncated);
  assert.ok(r && Array.isArray(r.hypotheses), 'doit produire un objet avec hypotheses');
  assert.ok(r.hypotheses.length >= 1, 'au moins la 1re hypothèse complète est conservée');
  assert.equal(r.hypotheses[0].label_fr, 'Résistance à l\'insuline');
});

test('JSON tronqué après une entrée complète + virgule → réparé', () => {
  const truncated = '{"root_causes":[{"label_fr":"Stress chronique","probability":0.8},';
  const r = parseRobust(truncated);
  assert.ok(r && r.root_causes.length === 1);
  assert.equal(r.root_causes[0].label_fr, 'Stress chronique');
});

test('garbage non-JSON → undefined (pas de crash, 503 propre)', () => {
  assert.equal(parseRobust('je ne sais pas répondre'), undefined);
});

test('repairTruncatedJson ne renvoie QUE du JSON valide (jamais de régression)', () => {
  // Entrée irréparable → null (donc le code retombe sur le 503, comportement inchangé).
  assert.equal(repairTruncatedJson('{"a": 0.'), null);
});
