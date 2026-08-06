/**
 * Tests documentFiligrane — exécution :
 *   node --test src/features/smartboard-konva-editor/lib/documentFiligrane.test.mjs
 *
 * Priorité : les quatre pièges nommés en tête de documentFiligrane.js, parce que
 * chacun a déjà mordu dans ce dépôt.
 *
 *  [FIL-DERRIÈRE]  le `layer` du filigrane doit être STRICTEMENT inférieur à celui de
 *                  tout objet présent (ordre de dessin = `layer × 100000 + index`).
 *  [FIL-PDF]       jsPDF dessine dans l'ORDRE D'APPEL : on lit le flux du PDF produit
 *                  et on vérifie que le filigrane y est écrit AVANT le corps.
 *  [FIL-CRITIQUE]  la critique doit se taire sur le filigrane — et rester bavarde sur
 *                  trois images empilées (le défaut d'origine de la règle
 *                  `occultation`, qu'une exemption trop large rouvrirait).
 *  [FIL-REFUS]     un réglage absent est REFUSÉ en le nommant, jamais remplacé par un
 *                  défaut silencieux (famille des sept pertes de données du dépôt).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

import {
  filigraneVide,
  normaliserFiligrane,
  texteDuFiligrane,
  resumeFiligrane,
  objetsFiligrane,
  appliquerFiligrane,
  retirerFiligrane,
  filigranePose,
  sansFiligrane,
  patchesAncrageFiligrane,
  layerDeFond,
  estFiligrane,
  MOTIFS_FILIGRANE,
  DISPOSITIONS,
  MAX_TUILES_PAR_PAGE,
  TAILLE_TEXTE_DEFAUT,
  ANGLE_TEXTE_DEFAUT,
  OPACITE_DEFAUT,
} from './documentFiligrane.js';
import { FORMATS_PAGE, origineDePage, paginer, patchesDePagination } from './documentPagination.js';
import { construirePdf, paginerObjets, preparerExport } from './documentExport.js';

const A4 = FORMATS_PAGE.a4_portrait;
const PAGE = { format: 'a4_portrait', nbPages: 1 };

/** Objet minimal complet : le store pose toujours ces clés. */
const bloc = (id, y, extra = {}) => ({
  id,
  type: 'text',
  x: 52,
  y,
  width: 690,
  height: 40,
  rotation: 0,
  layer: 0,
  visible: true,
  locked: false,
  step: 0,
  opacity: 1,
  content: { text: `Bloc ${id}` },
  style: { fontSize: 13, fill: '#1e293b', fontFamily: 'Georgia, serif' },
  ...extra,
});

const brouillon = (extra = {}) => normaliserFiligrane({ motif: 'brouillon', ...extra });

/* ═══════════════════════════════════════════════════════════════════
   Modèle : rien n'est inventé
═══════════════════════════════════════════════════════════════════ */

test('filigraneVide() ne porte NI texte NI image', () => {
  const v = filigraneVide();
  assert.equal(v.texte, '');
  assert.equal(v.motif, '');
  assert.equal(v.image.src, '');
  assert.equal(v.image.largeurNative, null);
  assert.equal(v.couleur, '', 'aucune couleur affirmée');
  /* Seules les géométries ont un défaut : ce sont des choix de mise en page. */
  assert.equal(v.taille, TAILLE_TEXTE_DEFAUT);
  assert.equal(v.angle, ANGLE_TEXTE_DEFAUT);
  assert.equal(v.opacite, OPACITE_DEFAUT);
  assert.equal(v.disposition, 'centre');
  assert.equal(v.toutesLesPages, true);
});

test('le motif « libre » n’apporte AUCUN texte : c’est l’utilisateur qui l’écrit', () => {
  assert.equal(MOTIFS_FILIGRANE.find((m) => m.id === 'libre').texte, '');
  assert.equal(texteDuFiligrane({ motif: 'libre' }), '');
  assert.equal(texteDuFiligrane({ motif: 'libre', texte: 'ÉPREUVE' }), 'ÉPREUVE');
  assert.equal(texteDuFiligrane({ motif: 'confidentiel' }), 'CONFIDENTIEL');
  /* Le motif fait autorité sur la saisie : sinon deux sources se contrediraient. */
  assert.equal(texteDuFiligrane({ motif: 'copie', texte: 'PAYÉ' }), 'COPIE');
});

test('normaliserFiligrane refuse les valeurs hors bornes et l’angle par défaut suit le TYPE', () => {
  const t = normaliserFiligrane({ type: 'texte', taille: 9999, opacite: 12, angle: -200 });
  assert.equal(t.taille, 400);
  assert.equal(t.opacite, 1);
  assert.equal(t.angle, -90);
  /* Une image ne peut pas être pivotée dans le PDF : elle naît à 0°. */
  assert.equal(normaliserFiligrane({ type: 'image' }).angle, 0);
  assert.equal(normaliserFiligrane({ type: 'texte' }).angle, ANGLE_TEXTE_DEFAUT);
  assert.equal(normaliserFiligrane({ couleur: 'rouge' }).couleur, '', 'couleur non hexa rejetée');
  assert.equal(normaliserFiligrane({ disposition: 'spirale' }).disposition, 'centre');
  assert.equal(DISPOSITIONS.map((d) => d.id).join(','), 'centre,mosaique');
});

test('resumeFiligrane NOMME ce qui manque', () => {
  assert.deepEqual(resumeFiligrane(filigraneVide()).manques, ['le texte du filigrane']);
  const img = resumeFiligrane({ type: 'image' });
  assert.deepEqual(img.manques, ["l'image du filigrane", "les dimensions natives de l'image"]);
  assert.equal(resumeFiligrane(brouillon()).vide, false);
});

/* ═══════════════════════════════════════════════════════════════════
   [FIL-DERRIÈRE] — le filigrane naît sous tout
═══════════════════════════════════════════════════════════════════ */

test('layerDeFond rend un calque STRICTEMENT inférieur au minimum présent', () => {
  assert.equal(layerDeFond([]), -1, 'document vide : 0 est le DÉFAUT, pas l’arrière-plan');
  assert.equal(layerDeFond([bloc('a', 100), bloc('b', 200, { layer: 3 })]), -1);
  assert.equal(layerDeFond([bloc('a', 100, { layer: -4 }), bloc('b', 200, { layer: 2 })]), -5);
});

test('le filigrane posé est DERRIÈRE chaque objet, verrouillé, et ne pousse rien', () => {
  const objets = [bloc('a', 100), bloc('b', 300, { layer: -2 }), bloc('c', 500, { layer: 7 })];
  const r = appliquerFiligrane({ filigrane: brouillon(), objets, page: PAGE });

  assert.equal(r.refus, null);
  assert.equal(r.ajouts.length, 1);
  const fil = r.ajouts[0];

  const minAutres = Math.min(...objets.map((o) => o.layer));
  assert.ok(fil.layer < minAutres, `layer ${fil.layer} doit être < ${minAutres}`);
  /* La règle de tri réelle du canevas (sortObjectsByLayer) : layer × 100000 + index. */
  const rang = (o, i) => o.layer * 100000 + i;
  const rangFil = rang(fil, objets.length);
  assert.ok(objets.every((o, i) => rang(o, i) > rangFil), 'dessiné avant TOUS les objets');

  assert.equal(fil.locked, true, 'verrouillé : un clic sur le contenu ne l’attrape pas');
  assert.deepEqual(r.patches, [], 'le filigrane ne pousse aucun contenu');
  assert.equal(fil.meta.doc, 'filigrane');
  assert.equal(estFiligrane(fil), true);
  assert.equal(fil.opacity, OPACITE_DEFAUT);
});

test('reposer un filigrane ne fait PAS descendre le calque sans fin', () => {
  const objets = [bloc('a', 100)];
  const un = appliquerFiligrane({ filigrane: brouillon(), objets, page: PAGE });
  const apres = [...objets, ...un.ajouts];
  const deux = appliquerFiligrane({ filigrane: brouillon(), objets: apres, page: PAGE });
  assert.equal(deux.layer, un.layer, 'même calque de fond aux deux poses');
  assert.deepEqual(deux.suppressions, un.ajouts.map((o) => o.id), 'l’ancien est remplacé, pas empilé');
});

/* ═══════════════════════════════════════════════════════════════════
   Répétition sur les pages
═══════════════════════════════════════════════════════════════════ */

test('le filigrane est répété sur les 3 pages, une marque par page, chacune dans SA page', () => {
  const r = appliquerFiligrane({
    filigrane: brouillon(),
    objets: [bloc('a', 100), bloc('b', 1300), bloc('c', 2400)],
    page: { format: 'a4_portrait', nbPages: 3 },
  });
  assert.equal(r.refus, null);
  assert.equal(r.ajouts.length, 3, 'exactement 3 marques');
  assert.deepEqual(r.ajouts.map((o) => o.meta.page), [0, 1, 2]);

  r.ajouts.forEach((o, p) => {
    const y0 = origineDePage(p, A4);
    /* Le centre VISUEL, pas l'ancre : l'ancre d'un texte pivoté sort de la page. */
    const a = (o.rotation * Math.PI) / 180;
    const cx = o.x + (o.width / 2) * Math.cos(a) - (o.height / 2) * Math.sin(a);
    const cy = o.y + (o.width / 2) * Math.sin(a) + (o.height / 2) * Math.cos(a);
    assert.ok(Math.abs(cx - A4.largeur / 2) <= 1, `page ${p} : centré en x (${cx})`);
    assert.ok(Math.abs(cy - (y0 + A4.hauteur / 2)) <= 1, `page ${p} : centré en y (${cy})`);
  });
});

test('« première page seulement » pose UNE marque et le DIT', () => {
  const r = appliquerFiligrane({
    filigrane: brouillon({ toutesLesPages: false }),
    objets: [bloc('a', 100)],
    page: { format: 'a4_portrait', nbPages: 4 },
  });
  assert.equal(r.ajouts.length, 1);
  assert.equal(r.ajouts[0].meta.page, 0);
  assert.match(r.avertissements.join(' '), /première page seulement/);
});

test('la mosaïque pave la page et reste sous le plafond', () => {
  const r = appliquerFiligrane({
    filigrane: brouillon({ disposition: 'mosaique', taille: 40 }),
    objets: [bloc('a', 100)],
    page: { format: 'a4_portrait', nbPages: 2 },
  });
  assert.equal(r.refus, null);
  assert.ok(r.resume.tuilesParPage > 1, `mosaïque = plusieurs marques (${r.resume.tuilesParPage})`);
  assert.ok(r.resume.tuilesParPage <= MAX_TUILES_PAR_PAGE);
  assert.equal(r.ajouts.length, r.resume.tuilesParPage * 2);
  /* Chaque tuile reste rattachée à sa page. */
  assert.equal(r.ajouts.filter((o) => o.meta.page === 1).length, r.resume.tuilesParPage);
});

/* ═══════════════════════════════════════════════════════════════════
   [FIL-REFUS] — une valeur absente est nommée, jamais devinée
═══════════════════════════════════════════════════════════════════ */

test('sans texte, la pose est REFUSÉE et rien ne bouge', () => {
  const objets = [bloc('a', 100)];
  const r = appliquerFiligrane({ filigrane: filigraneVide(), objets, page: PAGE });
  assert.match(r.refus, /aucun texte de filigrane/);
  assert.deepEqual(r.ajouts, []);
  assert.deepEqual(r.suppressions, [], 'un refus ne supprime rien non plus');
});

test('sans page.nbPages, la pose est REFUSÉE (supposer 1 page perdrait les suivantes)', () => {
  const r = appliquerFiligrane({ filigrane: brouillon(), objets: [bloc('a', 100)], page: {} });
  assert.match(r.refus, /nombre de pages non fourni/);
  assert.deepEqual(r.ajouts, []);
});

test('opacité nulle : REFUS explicite plutôt qu’un filigrane invisible', () => {
  const r = appliquerFiligrane({ filigrane: brouillon({ opacite: 0 }), objets: [], page: PAGE });
  assert.match(r.refus, /opacité nulle/);
});

test('mosaïque trop dense : REFUS chiffré plutôt que 1 500 objets', () => {
  const r = appliquerFiligrane({
    filigrane: brouillon({ disposition: 'mosaique', taille: 8 }),
    objets: [],
    page: PAGE,
  });
  assert.match(r.refus, /mosaïque trop dense/);
  assert.match(r.refus, new RegExp(`plafond ${MAX_TUILES_PAR_PAGE}`));
  assert.deepEqual(r.ajouts, []);
});

test('ancre qui sort par le HAUT : REFUS (la marque des pages suivantes serait téléportée)', () => {
  const r = appliquerFiligrane({
    filigrane: brouillon({ motif: 'libre', texte: 'NE PAS DIFFUSER HORS SERVICE', angle: 45 }),
    objets: [],
    page: { format: 'a4_portrait', nbPages: 2 },
  });
  assert.match(r.refus, /sort par le haut de la page/);
  assert.deepEqual(r.ajouts, []);
  /* Le même texte à un angle plus doux passe. */
  const ok = appliquerFiligrane({
    filigrane: brouillon({ motif: 'libre', texte: 'NE PAS DIFFUSER HORS SERVICE', angle: 45, taille: 32 }),
    objets: [],
    page: { format: 'a4_portrait', nbPages: 2 },
  });
  assert.equal(ok.refus, null);
});

/* ── Filigrane image : les trois refus qui protègent le rendu ────── */

test('image sans src, puis sans dimensions natives : deux REFUS distincts', () => {
  const sansSrc = appliquerFiligrane({ filigrane: { type: 'image' }, objets: [], page: PAGE });
  assert.match(sansSrc.refus, /aucune image de filigrane/);

  const sansNatif = appliquerFiligrane({
    filigrane: { type: 'image', image: { src: 'https://x/logo.png' } },
    objets: [],
    page: PAGE,
  });
  /* ⛔ PIÈGE 4 : sans natif, le store impose une boîte carrée (logo sorti en 48×48). */
  assert.match(sansNatif.refus, /dimensions natives/);
});

test('angle non nul sur un filigrane image : REFUS (le PDF ne trace pas la rotation d’image)', () => {
  const r = appliquerFiligrane({
    filigrane: { type: 'image', angle: -45, image: { src: 'https://x/l.png', largeurNative: 330, hauteurNative: 440 } },
    objets: [],
    page: PAGE,
  });
  assert.match(r.refus, /angle non nul/);
});

test('un filigrane image porte SES dimensions natives et son rapport', () => {
  const r = appliquerFiligrane({
    filigrane: { type: 'image', image: { src: 'https://x/l.png', largeurNative: 330, hauteurNative: 440 } },
    objets: [bloc('a', 100)],
    page: PAGE,
  });
  assert.equal(r.refus, null);
  const fil = r.ajouts[0];
  assert.deepEqual(fil.content.natif, { largeurNative: 330, hauteurNative: 440 });
  const rapport = fil.width / fil.height;
  assert.ok(Math.abs(rapport - 330 / 440) < 0.02, `rapport natif tenu (${rapport})`);
  assert.equal(fil.rotation, 0);
  assert.ok(fil.x >= 0 && fil.x + fil.width <= A4.largeur, 'image dans la page');
});

/* ═══════════════════════════════════════════════════════════════════
   Retrait, état, garde-fous d'intégration
═══════════════════════════════════════════════════════════════════ */

test('retirerFiligrane enlève TOUT le filigrane et RIEN d’autre', () => {
  const objets = [bloc('a', 100), bloc('b', 1300)];
  const r = appliquerFiligrane({
    filigrane: brouillon(),
    objets,
    page: { format: 'a4_portrait', nbPages: 2 },
  });
  const scene = [...objets, ...r.ajouts];
  const { suppressions } = retirerFiligrane(scene);
  assert.equal(suppressions.length, 2);
  const restant = scene.filter((o) => !suppressions.includes(o.id));
  assert.deepEqual(restant.map((o) => o.id), ['a', 'b']);
  assert.equal(filigranePose(restant, 2).posee, false);
});

test('filigranePose dit les pages couvertes, celles qui manquent, et le passage DEVANT', () => {
  const objets = [bloc('a', 100), bloc('b', 1300), bloc('c', 2400)];
  const r = appliquerFiligrane({
    filigrane: brouillon(),
    objets,
    page: { format: 'a4_portrait', nbPages: 3 },
  });
  const scene = [...objets, ...r.ajouts];
  const etat = filigranePose(scene, 3);
  assert.equal(etat.posee, true);
  assert.equal(etat.type, 'texte');
  assert.equal(etat.disposition, 'centre');
  assert.deepEqual(etat.pages, [0, 1, 2]);
  assert.deepEqual(etat.pagesManquantes, []);
  assert.equal(etat.devant, false);

  /* Page ajoutée sans réappliquer : le panneau doit pouvoir le dire. */
  assert.deepEqual(filigranePose(scene, 4).pagesManquantes, [3]);

  /* Filigrane remonté au-dessus du contenu (mise au premier plan par mégarde). */
  const casse = scene.map((o) => (estFiligrane(o) ? { ...o, layer: 5 } : o));
  assert.equal(filigranePose(casse, 3).devant, true);
});

test('sansFiligrane protège la repagination : `paginer` ne DÉPLACE pas le fond', () => {
  const objets = [bloc('a', 100), bloc('b', 300), bloc('c', 1300)];
  const r = appliquerFiligrane({
    filigrane: brouillon(),
    objets,
    page: { format: 'a4_portrait', nbPages: 2 },
  });
  const scene = [...objets, ...r.ajouts];
  const idsFil = r.ajouts.map((o) => o.id);

  /* Le piège est réel : `paginer` prend le filigrane pour un bloc de corps et le
     recale — la marque de la page 2 perd son centrage (mesuré : y 1950 → 1845). */
  const avec = patchesDePagination(paginer(scene, 'a4_portrait'));
  assert.equal(avec.some((p) => idsFil.includes(p.id)), true, 'le piège existe bien');

  const sans = patchesDePagination(paginer(sansFiligrane(scene), 'a4_portrait'));
  assert.equal(sans.some((p) => idsFil.includes(p.id)), false);
  /* Et le corps, lui, est paginé exactement pareil. */
  assert.deepEqual(sans, avec.filter((p) => !idsFil.includes(p.id)));
});

test('patchesAncrageFiligrane répare une géométrie déplacée par le store, et se tait sinon', () => {
  const r = appliquerFiligrane({
    filigrane: { type: 'image', image: { src: 'https://x/l.png', largeurNative: 330, hauteurNative: 440 } },
    objets: [bloc('a', 100)],
    page: PAGE,
  });
  assert.deepEqual(patchesAncrageFiligrane(r.ajouts), [], 'rien à réparer à la sortie du module');

  const deplace = r.ajouts.map((o) => ({ ...o, x: o.x + 130, width: 200, height: 200 }));
  const patches = patchesAncrageFiligrane(deplace);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].patch.x, r.ajouts[0].x);
  assert.equal(patches[0].patch.width, r.ajouts[0].width);
  assert.equal(patches[0].patch.height, r.ajouts[0].height);
});

/* ═══════════════════════════════════════════════════════════════════
   [FIL-PDF] — jsPDF dessine dans l'ORDRE D'APPEL
═══════════════════════════════════════════════════════════════════ */

test('paginerObjets trie par layer AVANT le tracé : le filigrane sort en tête', () => {
  const objets = [bloc('a', 100), bloc('b', 300)];
  const r = appliquerFiligrane({ filigrane: brouillon(), objets, page: PAGE });
  /* Ordre d'entrée DÉFAVORABLE : le filigrane arrive en dernier, comme après un
     `addObjects`. C'est exactement le cas où l'ordre d'appel le mettrait devant. */
  const pagination = paginerObjets([...objets, ...r.ajouts], { hauteurPage: A4.hauteur });
  assert.equal(pagination.pages[0].objets[0].meta.doc, 'filigrane');
  assert.deepEqual(pagination.pages[0].objets.map((o) => o.id).slice(1), ['a', 'b']);
});

test('un filigrane diagonal n’est PAS compté comme « rogné » (sa boîte n’est pas son empreinte)', () => {
  const objets = [bloc('a', 100)];
  /* Texte long : c'est là que la boîte NON pivotée passe sous le bas de la page,
     alors que la marque, elle, tient visiblement dedans. */
  const r = appliquerFiligrane({
    filigrane: brouillon({ motif: 'libre', texte: 'DOCUMENT INTERNE' }),
    objets,
    page: PAGE,
  });
  const fil = r.ajouts[0];
  assert.ok(fil.y + fil.height > A4.hauteur, `le piège existe bien (bas de boîte à ${fil.y + fil.height})`);

  const pagination = paginerObjets([...objets, ...r.ajouts], { hauteurPage: A4.hauteur });
  assert.deepEqual(pagination.coupes, []);
  /* Un VRAI bloc qui déborde reste dénoncé : l'exemption ne couvre que le filigrane. */
  const trop = paginerObjets([...objets, bloc('deborde', 1050, { height: 200 })], { hauteurPage: A4.hauteur });
  assert.equal(trop.coupes.length, 1);
  assert.equal(trop.coupes[0].id, 'deborde');
});

test('dans le PDF, le filigrane est écrit AVANT le corps (ordre réel des opérateurs)', async () => {
  const objets = [bloc('corps1', 200), bloc('corps2', 400)];
  const r = appliquerFiligrane({
    filigrane: brouillon({ motif: 'confidentiel' }),
    objets,
    page: PAGE,
  });
  const pdf = await construirePdf([...objets, ...r.ajouts], {
    format: { width: A4.largeur, height: A4.hauteur },
    compresser: false,
    telecharger: false,
  });
  const brut = Buffer.from(pdf.doc.output('arraybuffer')).toString('latin1');
  const ordre = [...brut.matchAll(/\(((?:\\.|[^()\\])*)\)\s*Tj/g)].map((m) => m[1]);

  const iFil = ordre.findIndex((t) => t.includes('CONFIDENTIEL'));
  const iCorps = ordre.findIndex((t) => t.includes('Bloc corps1'));
  assert.ok(iFil >= 0, `« CONFIDENTIEL » présent dans le flux — lu : ${ordre.join(' | ')}`);
  assert.ok(iCorps >= 0, 'le corps est présent');
  assert.ok(iFil < iCorps, `filigrane (index ${iFil}) tracé avant le corps (index ${iCorps})`);
  assert.equal(pdf.pages, 1);
});

/**
 * Origine de la ligne de base écrite dans le flux, ramenée en points ÉCRAN
 * (y vers le bas, comme le canevas). Un texte pivoté sort en `Tm`.
 */
async function baselineEcrite(objet, hauteurPage = A4.hauteur) {
  const pdf = await construirePdf([objet], {
    format: { width: A4.largeur, height: hauteurPage },
    compresser: false,
    telecharger: false,
  });
  const brut = Buffer.from(pdf.doc.output('arraybuffer')).toString('latin1');
  const m = brut.match(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) Tm/);
  assert.ok(m, 'une matrice de texte pivoté est écrite dans le flux');
  return [Number(m[5]), hauteurPage * (72 / 96) - Number(m[6])];
}

test('le filigrane pivoté tourne AUTOUR DE (x, y) — la convention Konva — dans le PDF', async () => {
  /**
   * ⛔ DEUX DÉFAUTS PROUVÉS ICI (corrigés dans documentExport.js) :
   *    1. le PDF pivotait le texte autour du CENTRE de la boîte, Konva autour de son
   *       angle haut-gauche ;
   *    2. jsPDF applique `align`/`baseline` AVANT la rotation, dans le repère de la
   *       PAGE : décalage constant (−219,3 ; +25,2) pt relevé dans le flux.
   *
   * La mesure ci-dessous ne dépend d'aucun détail interne de jsPDF : si le pivot est
   * bien (x, y) et qu'aucun décalage de page ne subsiste, alors le vecteur
   * (origine écrite − pivot) garde une NORME constante et tourne EXACTEMENT de
   * l'angle demandé. Le défaut 1 change la norme, le défaut 2 la rend variable.
   */
  const r = appliquerFiligrane({ filigrane: brouillon(), objets: [], page: PAGE });
  const fil = r.ajouts[0];
  const PT = 72 / 96;
  const P = [fil.x * PT, fil.y * PT];

  const mesures = [];
  for (const rot of [-30, -45, -60, 30]) {
    const T = await baselineEcrite({ ...fil, rotation: rot });
    mesures.push({
      rot,
      norme: Math.hypot(T[0] - P[0], T[1] - P[1]),
      arg: (Math.atan2(T[1] - P[1], T[0] - P[0]) * 180) / Math.PI,
    });
  }
  const ref = mesures[0];
  for (const m of mesures) {
    assert.ok(Math.abs(m.norme - ref.norme) < 0.01, `norme ${m.norme} ≠ ${ref.norme} à ${m.rot}°`);
    const derive = m.arg - ref.arg - (m.rot - ref.rot);
    assert.ok(Math.abs(derive) < 0.01, `dérive de ${derive}° à ${m.rot}°`);
  }

  /* Le pivot ne dépend PAS de la hauteur de la boîte — c'est ce qui distingue
     l'angle haut-gauche du centre, et `ajusterHauteurTexte` peut la réécrire. */
  const haut = await baselineEcrite({ ...fil, rotation: -45, height: 400 });
  const bas = await baselineEcrite({ ...fil, rotation: -45 });
  assert.deepEqual(haut, bas);
});

test('la marque diagonale tombe au CENTRE de la page dans le PDF', async () => {
  /* Contrôle de bout en bout : on remonte de la ligne de base écrite jusqu'au centre
     visuel du texte, et on le compare au centre de la page. */
  const r = appliquerFiligrane({ filigrane: brouillon(), objets: [], page: PAGE });
  const fil = r.ajouts[0];
  const PT = 72 / 96;
  const T = await baselineEcrite(fil);

  const a = (fil.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const corps = fil.style.fontSize * PT;
  /* Largeur de « BROUILLON » déduite de la mesure : l'origine écrite vaut
     ancre − (largeur/2) le long de l'axe du texte, et l'ancre est calculable. */
  const ancre = [
    fil.x * PT + (fil.width * PT) / 2 * cos - ((0.5 * 1.2 * corps + corps / 2 - corps * 0.15)) * sin,
    fil.y * PT + (fil.width * PT) / 2 * sin + ((0.5 * 1.2 * corps + corps / 2 - corps * 0.15)) * cos,
  ];
  const demiLargeur = Math.hypot(ancre[0] - T[0], ancre[1] - T[1]);
  /* Centre du texte = origine + demi-largeur le long de l'axe, puis remontée de la
     ligne de base vers la médiane (perpendiculaire). */
  const mediane = corps / 2 - corps * 0.15;
  const cx = T[0] + demiLargeur * cos + mediane * sin;
  const cy = T[1] + demiLargeur * sin - mediane * cos;

  assert.ok(Math.abs(cx - (A4.largeur / 2) * PT) < 1, `centre x = ${cx.toFixed(2)} pt`);
  assert.ok(Math.abs(cy - (A4.hauteur / 2) * PT) < 1, `centre y = ${cy.toFixed(2)} pt`);
});

test('preparerExport n’avertit de rien à cause du filigrane', async () => {
  const objets = [bloc('a', 200), bloc('b', 400)];
  const r = appliquerFiligrane({ filigrane: brouillon(), objets, page: PAGE });
  const p = await preparerExport([...objets, ...r.ajouts], {
    format: { width: A4.largeur, height: A4.hauteur },
    auditerImages: false,
    critiquer: () => ({ constats: [], compte: { bloquant: 0, majeur: 0, mineur: 0, info: 0 }, resume: null }),
  });
  assert.deepEqual(p.coupes, []);
  assert.deepEqual(p.avertissements, []);
  assert.equal(p.nbPages, 1);
});

/* ═══════════════════════════════════════════════════════════════════
   [FIL-CRITIQUE] — muette sur le filigrane, bavarde sur un vrai empilement

   ⛔ Même contrainte d'import que documentDesignCritique.test.mjs : la chaîne
      liriTextDesignPack tire des formes que seul Vite résout. On réutilise le même
      crochet ESM — il ne touche à aucun fichier du dépôt.
═══════════════════════════════════════════════════════════════════ */

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

const { critiquerMiseEnPage } = await import('./documentDesignCritique.js');

const PAGE_A4 = { width: A4.largeur, height: A4.hauteur };

/** Trois images posées AU MÊME POINT — le défaut d'origine de la règle occultation. */
const empilement = () => [0, 1, 2].map((i) => ({
  id: `img${i}`,
  type: 'image',
  x: 52,
  y: 180,
  width: 300,
  height: 300,
  rotation: 0,
  layer: i,
  visible: true,
  locked: false,
  step: 0,
  opacity: 1,
  content: { src: `blob://img${i}`, natif: { largeurNative: 300, hauteurNative: 300 } },
  style: {},
}));

test('la critique est MUETTE sur un document propre que l’on filigrane', () => {
  const objets = [bloc('a', 120), bloc('b', 300)];
  const avant = critiquerMiseEnPage(objets, PAGE_A4, {});
  const r = appliquerFiligrane({ filigrane: brouillon(), objets, page: PAGE });
  const apres = critiquerMiseEnPage([...objets, ...r.ajouts], PAGE_A4, {});

  assert.deepEqual(
    apres.constats.map((c) => c.regle).sort(),
    avant.constats.map((c) => c.regle).sort(),
    `le filigrane n'ajoute AUCUN constat — lu : ${apres.constats.map((c) => `${c.regle}/${c.gravite}`).join(', ')}`,
  );
  assert.equal(apres.verdict, avant.verdict);
  /* Aucune règle de cadre : la boîte non pivotée déborde pourtant la page. */
  assert.equal(apres.constats.filter((c) => c.regle === 'debordement').length, 0);
  assert.equal(apres.constats.filter((c) => c.regle === 'occultation').length, 0);
});

test('l’exemption N’OUVRE PAS le trou : trois images empilées restent détectées', () => {
  const pile = empilement();
  const sans = critiquerMiseEnPage(pile, PAGE_A4, {});
  const occSans = sans.constats.filter((c) => c.regle === 'occultation');
  assert.equal(occSans.length, 2, '2 images entièrement recouvertes');
  assert.equal(occSans.filter((c) => c.gravite === 'bloquant').length, 2);

  /* Le MÊME empilement, filigrané : le compte ne bouge pas d'un constat. */
  const r = appliquerFiligrane({ filigrane: brouillon(), objets: pile, page: PAGE });
  const avec = critiquerMiseEnPage([...pile, ...r.ajouts], PAGE_A4, {});
  const occAvec = avec.constats.filter((c) => c.regle === 'occultation');
  assert.equal(occAvec.length, 2, 'toujours 2 constats d’occultation');
  assert.deepEqual(
    occAvec.flatMap((c) => c.objetIds).sort(),
    occSans.flatMap((c) => c.objetIds).sort(),
    'exactement les mêmes objets accusés',
  );
});

test('le filigrane n’est victime d’occultation NI occultant, même opaque', () => {
  /* Opacité 1 : sans l'exemption par `meta`, il deviendrait un occultant plein
     (`estOccultantPlein` ne le disqualifie que sous 0,85). */
  const objets = [bloc('a', 120)];
  const r = appliquerFiligrane({ filigrane: brouillon({ opacite: 1 }), objets, page: PAGE });
  const d = critiquerMiseEnPage([...objets, ...r.ajouts], PAGE_A4, {});
  const ids = d.constats.flatMap((c) => c.objetIds ?? []);
  assert.equal(ids.some((id) => id === r.ajouts[0].id), false, 'le filigrane n’est cité par aucun constat');
});

test('un filigrane image ne masque pas les images du document', () => {
  const pile = empilement();
  const r = appliquerFiligrane({
    filigrane: { type: 'image', opacite: 1, image: { src: 'https://x/l.png', largeurNative: 330, hauteurNative: 440 } },
    objets: pile,
    page: PAGE,
  });
  assert.equal(r.refus, null);
  const d = critiquerMiseEnPage([...pile, ...r.ajouts], PAGE_A4, {});
  assert.equal(d.constats.filter((c) => c.regle === 'occultation').length, 2);
});
