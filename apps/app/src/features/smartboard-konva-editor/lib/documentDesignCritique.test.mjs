/**
 * Tests documentDesignCritique — exécution :
 *   node --test src/features/smartboard-konva-editor/lib/documentDesignCritique.test.mjs
 *
 * Ce qui est sous test, dans l'ordre des défauts mesurés en navigateur le 2026-08-05 :
 *
 *  [CRIT-RECOUVR] trois images posées au MÊME point (x=52 y=180 en mode Document,
 *                 100,120 en mode Affiche) : deux d'entre elles sont entièrement
 *                 invisibles et le verdict affichait « Mise en page propre ·
 *                 0 bloquant · Aucun défaut de mise en page relevé ».
 *                 → attendu : 2 constats `occultation` BLOQUANTS.
 *  [FAUX-POSITIFS] le vrai risque de la règle. Une bulle (texte sur son rectangle)
 *                 et un tableau (fonds + filets + cellules) doivent produire
 *                 ZÉRO constat d'occultation, sinon la critique crie sur chaque
 *                 devis et personne ne la lit plus.
 *  [RÈGLE 14]     image_deformee — non-régression du tour précédent.
 *  [RÈGLE 15]     hors_page (coupe de page en canevas empilé) — idem.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

/**
 * ⛔ CONTRAINTE : `documentDesignCritique.js` tire, par sa chaîne d'imports
 *    (liriTextDesignPack → sceneModel, documentTemplateLibrary), des formes que
 *    Vite résout et que Node ignore : import JSON sans attribut, suffixe `?raw`,
 *    alias `@/`, et spécificateurs relatifs SANS extension. C'est pour cela que
 *    `documentExport.test.mjs` injecte une critique factice au lieu de charger
 *    celle-ci. Ici on ne peut pas tricher : c'est le module SOUS TEST.
 *    On enregistre donc un crochet de résolution ESM — il ne touche à aucun
 *    fichier du dépôt et ne modifie rien du code testé.
 */
const RACINE_SRC = new URL('../../../', import.meta.url).href;
const CROCHETS = `
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
const SRC = ${JSON.stringify(RACINE_SRC)};
export async function resolve(specifier, context, nextResolve) {
  let spec = specifier;
  let raw = false;
  if (spec.endsWith('?raw')) { spec = spec.slice(0, -4); raw = true; }
  if (spec.startsWith('@/')) spec = new URL(spec.slice(2), SRC).href;
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('file:')) {
    const base = spec.startsWith('file:') ? new URL(spec) : new URL(spec, context.parentURL);
    let chemin = fileURLToPath(base);
    if (!fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) {
      for (const ext of ['.js', '.mjs', '.jsx', '.json', '/index.js']) {
        if (fs.existsSync(chemin + ext)) { chemin += ext; break; }
      }
    }
    return { url: pathToFileURL(chemin).href + (raw ? '?raw' : ''), format: 'module', shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url.endsWith('?raw')) {
    const p = fileURLToPath(new URL(url.slice(0, -4)));
    return { format: 'module', shortCircuit: true, source: 'export default ' + JSON.stringify(fs.readFileSync(p, 'utf8')) + ';' };
  }
  if (url.endsWith('.json')) {
    const p = fileURLToPath(new URL(url));
    return { format: 'module', shortCircuit: true, source: 'export default ' + fs.readFileSync(p, 'utf8') + ';' };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(CROCHETS)}`, import.meta.url);

const {
  critiquerMiseEnPage,
  aireUnion,
  SEUILS_OCCULTATION,
  SEUILS_DEFORMATION,
} = await import('./documentDesignCritique.js');

/* Page A4 @96 dpi + marges des 100 modèles. */
const PAGE_A4 = { width: 794, height: 1123 };

/** Objet minimal complet : le store pose toujours ces clés. */
function obj(o) {
  return {
    rotation: 0,
    layer: 0,
    visible: true,
    locked: false,
    step: 0,
    opacity: 1,
    content: {},
    style: {},
    ...o,
  };
}

const image = (id, p) => obj({
  id,
  type: 'image',
  content: { src: `blob://${id}`, natif: { width: p.nw ?? 600, height: p.nh ?? 900 } },
  ...p,
});

/* ⚠️ `...p` AVANT `style` : sinon le style passé écrase le style fusionné, le bloc
   part sans `fill` et la règle 3 le déclare invisible sur le fond. */
const texte = (id, p) => obj({
  id,
  type: 'text',
  ...p,
  content: { text: p.text ?? '' },
  style: { fontSize: 14, fill: '#1e293b', lineHeight: 1.5, ...(p.style || {}) },
});

const rect = (id, p) => obj({
  id,
  type: 'rect',
  ...p,
  style: { fill: '#e2e8f0', ...(p.style || {}) },
});

const occultations = (rapport) => rapport.constats.filter((c) => c.regle === 'occultation');

/* ═══════════════ 0. Aire d'union ═══════════════ */

test('aireUnion ne compte pas deux fois la zone commune', () => {
  /* Deux carrés 100×100 décalés de 50 : union = 2×10000 − 2500 = 17 500. */
  assert.equal(
    aireUnion([
      { x: 0, y: 0, x2: 100, y2: 100 },
      { x: 50, y: 50, x2: 150, y2: 150 },
    ]),
    17500,
  );
  /* Trois rectangles IDENTIQUES : union = un seul, pas 300 %. */
  const meme = { x: 10, y: 20, x2: 210, y2: 320 };
  assert.equal(aireUnion([meme, { ...meme }, { ...meme }]), 200 * 300);
  assert.equal(aireUnion([]), 0);
});

/* ═══════════════ 1. [CRIT-RECOUVR] la pile de trois images ═══════════════ */

test('trois images au même point → 2 constats occultation BLOQUANTS', () => {
  /* Reproduction exacte du mode Document : x=52, y=180, boîtes déjà au rapport. */
  const objets = [
    image('img_a', { x: 52, y: 180, width: 214, height: 320, nw: 602, nh: 900, layer: 0 }),
    image('img_b', { x: 52, y: 180, width: 214, height: 320, nw: 675, nh: 900, layer: 1 }),
    image('img_c', { x: 52, y: 180, width: 214, height: 320, nw: 602, nh: 900, layer: 2 }),
  ];
  const rapport = critiquerMiseEnPage(objets, PAGE_A4);
  const occ = occultations(rapport);

  assert.equal(occ.length, 2, `attendu 2 constats, obtenu ${occ.length}`);
  assert.deepEqual(occ.map((c) => c.gravite), ['bloquant', 'bloquant']);
  /* Les deux victimes sont bien celles du DESSOUS, jamais celle du dessus. */
  assert.deepEqual(occ.map((c) => c.objetIds[0]).sort(), ['img_a', 'img_b']);
  assert.match(occ[0].mesure, /100 % de sa surface/);
  assert.equal(rapport.verdict, 'bloquant');
  assert.ok(rapport.compte.bloquant >= 2);
});

test('la correction déroule la pile A4 EN LIGNE (la colonne n’y tiendrait pas)', () => {
  /* 3 × 320 px + 2 × 20 px d'écart = 1 000 px réclamés à partir de y=180, pour une
     page de 1 123 : la colonne ne tient pas. En ligne : 3 × 214 + 40 = 682 px à
     partir de x=52, pour une zone de contenu qui va jusqu'à x≈737. */
  const objets = [
    image('img_a', { x: 52, y: 180, width: 214, height: 320, layer: 0 }),
    image('img_b', { x: 52, y: 180, width: 214, height: 320, layer: 1 }),
    image('img_c', { x: 52, y: 180, width: 214, height: 320, layer: 2 }),
  ];
  const occ = occultations(critiquerMiseEnPage(objets, PAGE_A4));

  /* Plan COMMUN : les deux constats proposent EXACTEMENT les mêmes destinations. */
  assert.equal(occ.length, 2);
  assert.deepEqual(occ[0].correction.patches, occ[1].correction.patches);
  assert.match(occ[0].correction.label, /en ligne/);

  const plan = new Map(occ[0].correction.patches.map((p) => [p.id, p.partial]));
  assert.deepEqual([...plan.keys()].sort(), ['img_b', 'img_c']);
  assert.deepEqual(plan.get('img_b'), { x: 286 }); // 52 + 214 + 20
  assert.deepEqual(plan.get('img_c'), { x: 520 }); // 286 + 214 + 20
  assert.ok(520 + 214 <= PAGE_A4.width, 'la pile déroulée sort de la page');

  /* Le déroulé résout RÉELLEMENT le défaut : rejoué, plus aucune occultation. */
  const apres = objets.map((o) => (plan.has(o.id) ? { ...o, ...plan.get(o.id) } : o));
  assert.equal(occultations(critiquerMiseEnPage(apres, PAGE_A4)).length, 0);
});

test('quand la colonne tient, c’est la colonne (geste de la règle 10)', () => {
  const objets = [
    image('p1', { x: 100, y: 100, width: 200, height: 150, layer: 0 }),
    image('p2', { x: 100, y: 100, width: 200, height: 150, layer: 1 }),
  ];
  const occ = occultations(critiquerMiseEnPage(objets, PAGE_A4));
  assert.equal(occ.length, 1);
  assert.match(occ[0].correction.label, /en colonne/);
  assert.deepEqual(occ[0].correction.patches, [{ id: 'p2', partial: { y: 270 } }]); // 100 + 150 + 20
});

test('une pile qui ne tient ni en colonne ni en ligne ne reçoit AUCUN patch', () => {
  /* Deux images de 700×900 : ni 2×900+20 en hauteur, ni 2×700+20 en largeur. */
  const objets = [
    image('g1', { x: 40, y: 150, width: 700, height: 900, layer: 0 }),
    image('g2', { x: 40, y: 150, width: 700, height: 900, layer: 1 }),
  ];
  const occ = occultations(critiquerMiseEnPage(objets, PAGE_A4));
  assert.equal(occ.length, 1);
  assert.equal(occ[0].gravite, 'bloquant');
  assert.equal(occ[0].correction, null);
  assert.match(occ[0].pourquoiPasAuto, /hors page|hors du cadre|sortirait/);
});

test('mode Affiche 2480×3508 : même pile à 100,120, même verdict', () => {
  const AFFICHE = { width: 2480, height: 3508 };
  const objets = [
    image('a1', { x: 100, y: 120, width: 214, height: 320, layer: 0 }),
    image('a2', { x: 100, y: 120, width: 214, height: 320, layer: 1 }),
    image('a3', { x: 100, y: 120, width: 214, height: 320, layer: 2 }),
  ];
  const occ = occultations(critiquerMiseEnPage(objets, AFFICHE));
  assert.equal(occ.length, 2);
  assert.ok(occ.every((c) => c.gravite === 'bloquant'));
});

test("l'ordre de dessin se joue sur layer, PAS sur l'index du tableau", () => {
  /* img_dessus est posé EN PREMIER dans le tableau mais envoyé à l'arrière-plan
     (layer −1, ce que fait `sendToBack`) : il ne cache donc plus rien. */
  const objets = [
    image('img_dessous', { x: 52, y: 180, width: 214, height: 320, layer: -1 }),
    image('img_dessus', { x: 52, y: 180, width: 214, height: 320, layer: 3 }),
  ];
  const occ = occultations(critiquerMiseEnPage(objets, PAGE_A4));
  assert.equal(occ.length, 1);
  assert.equal(occ[0].objetIds[0], 'img_dessous', 'la victime doit être celle du calque le plus bas');
});

test('un texte entièrement caché sous une image opaque est bloquant', () => {
  const objets = [
    texte('t1', { x: 52, y: 180, width: 400, height: 100, text: 'Communiqué de presse Orabank', layer: 0 }),
    image('img', { x: 40, y: 170, width: 440, height: 140, layer: 1 }),
  ];
  const occ = occultations(critiquerMiseEnPage(objets, PAGE_A4));
  assert.equal(occ.length, 1);
  assert.equal(occ[0].gravite, 'bloquant');
  assert.equal(occ[0].objetIds[0], 't1');
});

test('un recouvrement partiel est gradué, pas bloquant', () => {
  /* Image 400×400 recouverte sur 400×340 = 85 % → majeur (seuil 80). */
  const objets = [
    image('img', { x: 100, y: 100, width: 400, height: 400, layer: 0 }),
    rect('bandeau', { x: 100, y: 100, width: 400, height: 340, layer: 1, style: { fill: '#0f172a' } }),
  ];
  const occ = occultations(critiquerMiseEnPage(objets, PAGE_A4));
  assert.equal(occ.length, 1);
  assert.equal(occ[0].gravite, 'majeur');
  assert.match(occ[0].mesure, /85 % de sa surface/);
});

test('sous le plancher de 60 %, la règle se tait', () => {
  const objets = [
    image('img', { x: 100, y: 100, width: 400, height: 400, layer: 0 }),
    rect('coin', { x: 100, y: 100, width: 400, height: 200, layer: 1, style: { fill: '#0f172a' } }),
  ];
  assert.equal(SEUILS_OCCULTATION.mineur, 60);
  assert.equal(occultations(critiquerMiseEnPage(objets, PAGE_A4)).length, 0);
});

/* ═══════════════ 2. [FAUX-POSITIFS] les superpositions LÉGITIMES ═══════════════ */

test('bulle : un texte posé sur son rectangle → 0 constat', () => {
  const objets = [
    rect('bulle_fond', {
      x: 60, y: 200, width: 420, height: 160, layer: 0,
      style: { fill: '#fef3c7', cornerRadius: 16 },
    }),
    texte('bulle_texte', {
      x: 76, y: 216, width: 388, height: 128, layer: 1,
      text: "Le texte de la bulle recouvre son fond à 100 %, et c'est exactement ce qu'on veut.",
    }),
  ];
  const occ = occultations(critiquerMiseEnPage(objets, PAGE_A4));
  assert.equal(occ.length, 0, occ.map((c) => c.titre).join(' | '));
});

test('tableau : fonds, filets et cellules → 0 constat', () => {
  /* Structure réelle de documentTables.js : COUCHE_FOND 0, COUCHE_FILET 1,
     COUCHE_TEXTE 2, tous marqués `meta.doc = 'tableau'` + même `tableId`. */
  const t = (m) => ({ doc: 'tableau', tableId: 'tbl_1', ...m });
  const objets = [
    rect('cadre', {
      x: 52, y: 300, width: 690, height: 160, layer: 0,
      style: { fill: 'transparent', stroke: '#cbd5e1', strokeWidth: 1 },
      meta: t({ role: 'cadre' }),
    }),
    rect('fond_entete', {
      x: 52, y: 300, width: 690, height: 30, layer: 0,
      style: { fill: '#f1f5f9' }, meta: t({ role: 'fond-entete' }),
    }),
    texte('cell_h1', {
      x: 60, y: 306, width: 300, height: 18, layer: 2, text: 'Désignation',
      meta: t({ role: 'entete-cellule', colonne: 'designation' }),
    }),
    texte('cell_h2', {
      x: 500, y: 306, width: 200, height: 18, layer: 2, text: 'Montant',
      meta: t({ role: 'entete-cellule', colonne: 'montant' }),
    }),
    obj({
      id: 'filet_entete', type: 'line', x: 52, y: 330, width: 690, height: 2, layer: 1,
      content: { points: [0, 0, 690, 0] }, style: { stroke: '#cbd5e1', strokeWidth: 1 },
      meta: t({ role: 'filet-entete' }),
    }),
    rect('fond_ligne_0', {
      x: 52, y: 330, width: 690, height: 26, layer: 0,
      style: { fill: '#ffffff' }, meta: t({ role: 'fond-ligne', ligne: 0 }),
    }),
    texte('cell_0_0', {
      x: 60, y: 336, width: 300, height: 16, layer: 2, text: 'Prestation de conseil',
      meta: t({ role: 'cellule', ligne: 0, colonne: 'designation' }),
    }),
    rect('fond_ligne_1', {
      x: 52, y: 356, width: 690, height: 26, layer: 0,
      style: { fill: '#f8fafc' }, meta: t({ role: 'fond-ligne', ligne: 1 }),
    }),
    texte('cell_1_0', {
      x: 60, y: 362, width: 300, height: 16, layer: 2, text: 'Hébergement annuel',
      meta: t({ role: 'cellule', ligne: 1, colonne: 'designation' }),
    }),
  ];
  const occ = occultations(critiquerMiseEnPage(objets, PAGE_A4));
  assert.equal(occ.length, 0, occ.map((c) => c.titre).join(' | '));
});

test('photo pleine page + titre par-dessus → 0 constat (le fond est fait pour ça)', () => {
  const objets = [
    image('fond', { x: 0, y: 0, width: 794, height: 1123, layer: -1 }),
    texte('titre', {
      x: 52, y: 120, width: 690, height: 90, layer: 1,
      text: 'ORABANK — ANNONCE PRESSE', style: { fontSize: 48, fontWeight: 700, fill: '#ffffff' },
    }),
  ];
  assert.equal(occultations(critiquerMiseEnPage(objets, PAGE_A4)).length, 0);
});

test('un occulteur translucide ou masqué ne compte pas', () => {
  const base = image('img', { x: 100, y: 100, width: 400, height: 400, layer: 0 });
  const voile = (p) => rect('voile', { x: 100, y: 100, width: 400, height: 400, layer: 1, ...p });

  assert.equal(occultations(critiquerMiseEnPage([base, voile({ opacity: 0.2 })], PAGE_A4)).length, 0);
  assert.equal(
    occultations(critiquerMiseEnPage([base, voile({ style: { fill: 'rgba(0,0,0,0.3)' } })], PAGE_A4)).length,
    0,
  );
  assert.equal(occultations(critiquerMiseEnPage([base, voile({ visible: false })], PAGE_A4)).length, 0);
  /* Étape de révélation différente : jamais à l'écran en même temps. */
  assert.equal(occultations(critiquerMiseEnPage([base, voile({ step: 1 })], PAGE_A4)).length, 0);
  /* Et en opaque plein, le même voile DOIT parler — sinon les cas ci-dessus ne prouvent rien. */
  assert.equal(occultations(critiquerMiseEnPage([base, voile({})], PAGE_A4)).length, 1);
});

test('une page saine reste déclarée propre (aucun constat inventé)', () => {
  const objets = [
    texte('h1', {
      x: 52, y: 72, width: 690, height: 60,
      text: 'Communiqué de presse', style: { fontSize: 30, fontWeight: 700, lineHeight: 1.15 },
    }),
    texte('p1', {
      x: 52, y: 160, width: 500, height: 200,
      text: 'Orabank annonce ce jour la nomination de son nouveau directeur régional pour la zone UEMOA. '
        + "Cette nomination prend effet au premier jour du mois prochain et s'inscrit dans la continuité du plan.",
      style: { fontSize: 12, lineHeight: 1.5 },
    }),
    image('photo', { x: 52, y: 400, width: 400, height: 300, nw: 800, nh: 600 }),
  ];
  const rapport = critiquerMiseEnPage(objets, PAGE_A4);
  assert.equal(occultations(rapport).length, 0);
  assert.equal(rapport.compte.bloquant, 0, rapport.constats.map((c) => c.titre).join(' | '));
});

test('les 100 modèles réels ne déclenchent AUCUNE occultation', async () => {
  /* ⛔ C'est LE test qui compte pour cette règle : le risque n'est pas de rater un
     recouvrement, c'est de crier sur chaque devis, chaque facture, chaque bulletin.
     On rejoue donc la critique sur les objets réellement produits par les 100
     modèles du dépôt (fonds d'encadrés, bulles, tableaux complets compris). */
  const { TEMPLATES, templateToKonvaObjects, enregistrerFabriquesTableau } =
    await import('./documentTemplateLibrary.js');
  const tableaux = await import('./documentTables.js');
  enregistrerFabriquesTableau(tableaux);

  const coupables = [];
  for (const modele of TEMPLATES) {
    const objets = templateToKonvaObjects(modele);
    const occ = occultations(critiquerMiseEnPage(objets, PAGE_A4, { templateId: modele.id }));
    if (occ.length) coupables.push(`${modele.id} → ${occ.map((c) => c.titre).join(' / ')}`);
  }
  assert.equal(TEMPLATES.length, 100);
  assert.deepEqual(coupables, [], coupables.slice(0, 5).join('\n'));
});

/* ═══════════════ 3. [RÈGLE 14] image_deformee — non-régression ═══════════════ */

test('règle 14 : une image 602×900 posée en 560×320 sort BLOQUANTE', () => {
  const objets = [image('img', { x: 52, y: 180, width: 560, height: 320, nw: 602, nh: 900 })];
  const c = critiquerMiseEnPage(objets, PAGE_A4).constats.find((x) => x.regle === 'image_deformee');
  assert.ok(c, 'aucun constat image_deformee');
  assert.equal(c.gravite, 'bloquant');
  assert.match(c.mesure, /602×900 px natif/);
  assert.match(c.mesure, /étirée en largeur/);
});

test('règle 14 : la correction rend un rapport natif, sans déplacer ni agrandir', () => {
  const objets = [image('img', { x: 52, y: 180, width: 560, height: 320, nw: 602, nh: 900 })];
  const c = critiquerMiseEnPage(objets, PAGE_A4).constats.find((x) => x.regle === 'image_deformee');
  const p = c.correction.patches.find((x) => x.id === 'img');
  assert.ok(p, 'aucun patch pour img');
  assert.equal(p.partial.x, undefined, 'la correction ne doit pas déplacer');
  assert.ok(p.partial.width <= 560 && p.partial.height <= 320, 'la correction ne doit pas agrandir');
  const ecart = Math.abs(p.partial.width / p.partial.height - 602 / 900) / (602 / 900) * 100;
  assert.ok(ecart < SEUILS_DEFORMATION.mineur, `rapport corrigé encore à ${ecart.toFixed(2)} % d'écart`);
});

test('règle 14 : sans mesure native, aucun constat (jamais de ratio deviné)', () => {
  const nu = obj({ id: 'img', type: 'image', x: 52, y: 180, width: 560, height: 320, content: { src: 'blob://x' } });
  const constats = critiquerMiseEnPage([nu], PAGE_A4).constats;
  assert.equal(constats.filter((c) => c.regle === 'image_deformee').length, 0);
});

test('règle 14 : un crop change le rapport de référence', () => {
  /* Source 900×600, recadrée en carré, posée en carré : rien à signaler. */
  const carre = obj({
    id: 'img', type: 'image', x: 52, y: 180, width: 300, height: 300, layer: 0,
    content: { src: 'blob://x', natif: { width: 900, height: 600 }, crop: { x: 0, y: 0, width: 600, height: 600 } },
    style: {}, rotation: 0, visible: true, locked: false, step: 0, opacity: 1,
  });
  assert.equal(
    critiquerMiseEnPage([carre], PAGE_A4).constats.filter((c) => c.regle === 'image_deformee').length,
    0,
  );
});

/* ═══════════════ 4. [RÈGLE 15] hors_page — non-régression ═══════════════ */

test('règle 15 : un bloc à cheval sur la coupe d’une page empilée est bloquant', () => {
  /* Canevas de 2 pages empilées (2×1123), image posée à y=1044 : elle traverse. */
  const objets = [image('img', { x: 52, y: 1044, width: 214, height: 320, nw: 602, nh: 900 })];
  const rapport = critiquerMiseEnPage(objets, { width: 794, height: 2246 }, { hauteurPage: 1123 });
  const c = rapport.constats.find((x) => x.regle === 'hors_page');
  assert.ok(c, 'aucun constat hors_page');
  assert.equal(c.gravite, 'bloquant');
  assert.match(c.mesure, /page 1/);
  assert.equal(c.correction.patches[0].id, 'img');
  /* Tête de zone de contenu de la page 2 : 1123 + marge haute 20 mm à 96 dpi (75,6 px). */
  assert.equal(c.correction.patches[0].partial.y, Math.round(1123 + (20 * 96) / 25.4));
});

test('règle 15 : sans hauteurPage, la règle se tait (c’est la règle 1 qui parle)', () => {
  const objets = [image('img', { x: 52, y: 1044, width: 214, height: 320, nw: 602, nh: 900 })];
  const rapport = critiquerMiseEnPage(objets, { width: 794, height: 2246 });
  assert.equal(rapport.constats.filter((c) => c.regle === 'hors_page').length, 0);
});

test('règle 15 : un bloc plus haut qu’une page n’est pas déplacé', () => {
  const objets = [image('geant', { x: 52, y: 200, width: 400, height: 1100, nw: 400, nh: 1100 })];
  const rapport = critiquerMiseEnPage(objets, { width: 794, height: 2246 }, { hauteurPage: 1123 });
  const c = rapport.constats.find((x) => x.regle === 'hors_page');
  assert.ok(c, 'aucun constat hors_page');
  assert.equal(c.correction.patches.length, 0, 'un bloc plus haut qu’une page ne doit pas être téléporté');
});
