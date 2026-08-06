/**
 * documentTemplateLibrary.test.mjs — chantier [MODELE-1]
 *
 * Vérifie qu'AUCUN des 100 modèles de documentTemplates.json ne rend de zone
 * générique « [ZONE] », et que chaque modèle produit du texte réel.
 *
 * Exécution (aucune dépendance : vitest n'est pas installé dans ce dépôt) :
 *   node apps/app/src/features/smartboard-konva-editor/lib/documentTemplateLibrary.test.mjs
 *
 * ⚠️ CONTRAINTE : la lib importe '@/data/documentTemplates.json'. L'alias '@'
 * et l'import JSON sans attribut sont des facilités Vite ; sous Node il faut
 * un hook de résolution — d'où le register() ci-dessous.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(ICI, '../../../');            // apps/app/src

const hook = `
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const SRC = ${JSON.stringify(SRC)};
export function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) {
    const url = pathToFileURL(path.join(SRC, spec.slice(2))).href;
    if (url.endsWith('.json')) {
      return { url, shortCircuit: true, format: 'json', importAttributes: { type: 'json' } };
    }
    return { url, shortCircuit: true };
  }
  return next(spec, ctx);
}
`;
register(`data:text/javascript,${encodeURIComponent(hook)}`);

const lib = await import('./documentTemplateLibrary.js');
const {
  TEMPLATES, templateToKonvaObjects, diagnostiquerZones,
  enregistrerFabriquesTableau, sourceFabriquesTableau,
} = lib;

/* Le module voisin est écrit par un chantier parallèle : on le branche s'il
   est là, sinon la lib retombe sur son repli interne (les deux doivent passer). */
const CHEMIN_TABLES = path.join(ICI, 'documentTables.js');
let MOD_TABLES = null;
if (existsSync(CHEMIN_TABLES)) {
  try {
    MOD_TABLES = await import(pathToFileURL(CHEMIN_TABLES).href);
    enregistrerFabriquesTableau(MOD_TABLES);
  } catch (e) {
    console.warn('documentTables.js présent mais non importable :', e.message);
  }
}

/* ─── Référence AVANT : les 23 zones couvertes au tour 1 ─────────── */
const ZONES_COUVERTES_TOUR1 = new Set([
  'header', 'sender', 'recipient', 'subject', 'body', 'formule_politesse',
  'signature', 'title', 'parties', 'clauses', 'modalités', 'date',
  "corps de l'attestation", 'bénéficiaire', 'identité', 'formation',
  'expérience', 'compétences', 'résumé exécutif', 'contexte', 'analyse',
  'conclusion', 'footer',
]);

function inventaireAvant() {
  const freq = new Map();
  const modeles = new Set();
  for (const t of TEMPLATES) {
    for (const z of t.zones ?? []) {
      if (ZONES_COUVERTES_TOUR1.has(z)) continue;
      freq.set(z, (freq.get(z) ?? 0) + 1);
      modeles.add(t.id);
    }
  }
  return { freq, modeles };
}

function inventaireApres() {
  const freq = new Map();
  const modeles = new Set();
  for (const t of TEMPLATES) {
    for (const z of diagnostiquerZones(t).generiques) {
      freq.set(z, (freq.get(z) ?? 0) + 1);
      modeles.add(t.id);
    }
  }
  return { freq, modeles };
}

const AV = inventaireAvant();
const AP = inventaireApres();
const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);

console.log('\n═══ [MODELE-1] couverture des zones ═══');
console.log(`AVANT  : ${AV.modeles.size}/${TEMPLATES.length} modèles avec zone générique — `
  + `${AV.freq.size} noms distincts, ${total(AV.freq)} occurrences`);
for (const [z, n] of [...AV.freq].sort((a, b) => b[1] - a[1])) {
  console.log(`         ${String(n).padStart(3)}  ${z}`);
}
console.log(`APRÈS  : ${AP.modeles.size}/${TEMPLATES.length} modèles avec zone générique — `
  + `${AP.freq.size} noms distincts, ${total(AP.freq)} occurrences`);
for (const [z, n] of [...AP.freq].sort((a, b) => b[1] - a[1])) {
  console.log(`         ${String(n).padStart(3)}  ${z}`);
}
console.log('Tableaux rendus par :', sourceFabriquesTableau().source);

/* ─── Tests ──────────────────────────────────────────────────────── */

test('les 100 modèles sont bien chargés', () => {
  assert.equal(TEMPLATES.length, 100);
});

test('aucun modèle ne rend de zone générique « [ZONE] »', () => {
  const fautifs = [];
  for (const t of TEMPLATES) {
    const objets = templateToKonvaObjects(t);
    const repli = objets.filter(o => o.generique);
    const marqueurs = objets.filter(o =>
      typeof o?.content?.text === 'string'
      && /^\[Contenu de la zone /.test(o.content.text));
    if (repli.length || marqueurs.length) {
      fautifs.push(`${t.slug} → ${diagnostiquerZones(t).generiques.join(', ')}`);
    }
  }
  assert.deepEqual(fautifs, []);
});

test('chaque modèle produit du texte réel (≥ 3 blocs, ≥ 200 caractères)', () => {
  const maigres = [];
  for (const t of TEMPLATES) {
    const textes = templateToKonvaObjects(t)
      .filter(o => o.type === 'text' && typeof o.content?.text === 'string')
      .map(o => o.content.text.trim())
      .filter(Boolean);
    const car = textes.join('').length;
    if (textes.length < 3 || car < 200) maigres.push(`${t.slug} (${textes.length} blocs, ${car} car.)`);
  }
  assert.deepEqual(maigres, []);
});

test('chaque zone de chaque modèle pose au moins un objet', () => {
  const vides = [];
  for (const t of TEMPLATES) {
    const objets = templateToKonvaObjects(t);
    for (const z of t.zones ?? []) {
      if (z === 'footer') continue; // posé en pied de page, hors flux
      if (!objets.some(o => o.zone === z)) vides.push(`${t.slug} / ${z}`);
    }
  }
  assert.deepEqual(vides, []);
});

test('les zones tabulaires produisent un vrai tableau (facture, devis, bulletin)', () => {
  const cas = [
    ['business_invoice', ['Désignation', 'Qté', 'Total HT', 'Total TTC']],
    ['business_quote', ['Désignation', 'P.U. HT', 'Total TTC']],
    ['business_purchase_order', ['[REF-001]', 'Qté', 'Total TTC']],
    ['education_report_card', ['Matière', 'Note /20', 'Moyenne générale']],
    ['education_attendance_sheet', ['Nom et prénom', 'Signature']],
  ];
  for (const [slug, attendus] of cas) {
    const tpl = TEMPLATES.find(t => t.slug === slug);
    assert.ok(tpl, `modèle ${slug} introuvable`);
    const objets = templateToKonvaObjects(tpl);
    const zoneTable = objets.filter(o => o.zone === 'table');
    assert.ok(zoneTable.length >= 8, `${slug} : tableau trop pauvre (${zoneTable.length} objets)`);
    assert.ok(zoneTable.some(o => o.type === 'rect'), `${slug} : aucun cadre de tableau`);
    const texte = zoneTable.map(o => o.content?.text ?? '').join(' | ');
    for (const a of attendus) {
      assert.ok(texte.includes(a), `${slug} : colonne/total « ${a} » absent du tableau`);
    }
  }
});

test('sans documentTables.js, le repli interne rend quand même un tableau', () => {
  enregistrerFabriquesTableau(null);
  try {
    assert.equal(sourceFabriquesTableau().source, 'repli interne');
    for (const t of TEMPLATES.filter(x => (x.zones ?? []).includes('table'))) {
      const zone = templateToKonvaObjects(t).filter(o => o.zone === 'table');
      assert.ok(zone.length >= 8, `${t.slug} : repli trop pauvre (${zone.length} objets)`);
      assert.ok(zone.some(o => o.type === 'rect'), `${t.slug} : repli sans cadre`);
      assert.ok(zone.some(o => o.type === 'line'), `${t.slug} : repli sans filet`);
    }
  } finally {
    enregistrerFabriquesTableau(MOD_TABLES);
  }
});

test('les contrats sortent des articles numérotés et différenciés', () => {
  const contrats = TEMPLATES.filter(t => t.domain === 'contracts');
  assert.equal(contrats.length, 10);
  const signatures = new Set();
  for (const t of contrats) {
    const texte = templateToKonvaObjects(t)
      .filter(o => o.zone === 'articles')
      .map(o => o.content?.text ?? '').join('\n');
    assert.match(texte, /ARTICLE 1 —/, `${t.slug} : pas d'article 1`);
    assert.match(texte, /ARTICLE 4 —/, `${t.slug} : pas d'article 4`);
    signatures.add(texte);
  }
  assert.equal(signatures.size, 10, 'les 10 contrats doivent avoir des articles distincts');
});

test('les CV et les rapports ont leur structure propre', () => {
  for (const t of TEMPLATES.filter(x => x.domain === 'cv_profiles')) {
    const txt = templateToKonvaObjects(t).map(o => o.content?.text ?? '').join('\n');
    for (const attendu of ['PROFIL', 'EXPÉRIENCE PROFESSIONNELLE', 'FORMATION', 'COMPÉTENCES']) {
      assert.ok(txt.includes(attendu), `${t.slug} : rubrique « ${attendu} » absente`);
    }
  }
  for (const t of TEMPLATES.filter(x => x.domain === 'reports')) {
    const txt = templateToKonvaObjects(t).map(o => o.content?.text ?? '').join('\n');
    assert.ok(txt.includes('SOMMAIRE'), `${t.slug} : pas de sommaire`);
    assert.ok(txt.includes(t.name), `${t.slug} : le titre du rapport n'apparaît pas`);
    assert.match(txt, /1\. .+\n?/, `${t.slug} : pas de sections numérotées`);
  }
});

test('les attestations portent la mention de lieu et de date', () => {
  for (const t of TEMPLATES.filter(x => x.domain === 'attestations_certificates')) {
    const txt = templateToKonvaObjects(t).map(o => o.content?.text ?? '').join('\n');
    assert.ok(txt.includes('Fait à [Ville]'), `${t.slug} : mention « Fait à » absente`);
    assert.ok(txt.includes('Je soussigné(e)'), `${t.slug} : formule d'attestation absente`);
  }
});

test('identifiants uniques et géométrie dans la largeur A4', () => {
  for (const t of TEMPLATES) {
    const objets = templateToKonvaObjects(t);
    assert.equal(new Set(objets.map(o => o.id)).size, objets.length, `${t.slug} : id dupliqué`);
    for (const o of objets) {
      assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y), `${t.slug} : coordonnée invalide`);
      assert.ok(o.x >= 0 && o.x + (o.width ?? 0) <= 794 + 1,
        `${t.slug} : objet hors page (x=${o.x}, w=${o.width})`);
    }
  }
});

/* ─── Mesure de débordement vertical (info : dépend de [VIDE-1] multi-pages) ── */
test('mesure du débordement vertical (informatif, non bloquant)', () => {
  const hauteurs = TEMPLATES.map(t => {
    const objets = templateToKonvaObjects(t);
    const bas = objets.reduce((m, o) => Math.max(m, (o.y ?? 0) + (o.height ?? 0)), 0);
    return { slug: t.slug, domaine: t.domain, bas: Math.round(bas) };
  }).sort((a, b) => b.bas - a.bas);
  const debordent = hauteurs.filter(h => h.bas > 1123);
  console.log(`\nDébordement A4 (1123 px) : ${debordent.length}/100 modèles`);
  for (const h of debordent.slice(0, 8)) console.log(`   ${h.bas} px  ${h.slug} (${h.domaine})`);
  console.log(`   plus haut modèle tenant dans la page : ${hauteurs.find(h => h.bas <= 1123)?.bas} px`);
  assert.ok(hauteurs[0].bas > 0);
});
