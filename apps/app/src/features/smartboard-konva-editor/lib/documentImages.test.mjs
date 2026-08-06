/**
 * Tests documentImages — exécution :
 *   node --test src/features/smartboard-konva-editor/lib/documentImages.test.mjs
 *
 * Priorité : les DEUX défauts mesurés en navigateur le 2026-08-05.
 *   [IMG-RATIO]   les trois fichiers réels doivent sortir à déformation < 1 %
 *                 là où la boîte 560×320 en dur les étirait de 161 %, 16 % et 133 %.
 *   [IMG-HORSPAGE] aucune position rendue ne doit dépasser le bas de la page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODES_AJUSTEMENT,
  MODE_AJUSTEMENT_DEFAUT,
  BOITE_MAX_DEFAUT,
  TAILLE_MIN,
  SEUIL_RECOUVREMENT,
  dimensionsNatives,
  mesurerImage,
  viderCacheMesures,
  boiteAuFormat,
  boiteNeutre,
  normaliserMode,
  calculerCrop,
  verrouillerRapport,
  pointFixePourPoignee,
  placerDansLaPage,
  recouvrementMaximal,
  estFondDePage,
  deformation,
  diagnostiquerDeformation,
  proposerGeometrieImage,
} from './documentImages.js';

/* Les TROIS fichiers réellement importés dans le navigateur le 2026-08-05. */
const CAS_REELS = [
  { nom: 'rentrée scolaire (portrait)', largeurNative: 602, hauteurNative: 900 },
  { nom: 'crayons (paysage)', largeurNative: 900, hauteurNative: 600 },
  { nom: 'siège Orabank (portrait)', largeurNative: 675, hauteurNative: 900 },
];

/* Page A4 @96dpi + marges des 100 modèles (DOC_PAGE). */
const PAGE_A4 = { largeur: 794, hauteur: 1123 };
const MARGES = { haut: 72, bas: 70, gauche: 52, droite: 52 };
const BAS_UTILE = PAGE_A4.hauteur - MARGES.bas; // 1053

/* ═══════════════ 1. Mesure ═══════════════ */

test('dimensionsNatives lit les trois formes (largeur/width/naturalWidth)', () => {
  assert.deepEqual(dimensionsNatives({ largeur: 602, hauteur: 900 }).largeurNative, 602);
  assert.equal(dimensionsNatives({ width: 900, height: 600 }).rapportNatif, 1.5);
  assert.equal(dimensionsNatives({ naturalWidth: 675, naturalHeight: 900 }).rapportNatif, 0.75);
  assert.throws(() => dimensionsNatives({ width: 0, height: 10 }), /introuvables/);
});

test('mesurerImage accepte une mesure injectée et met en cache', async () => {
  viderCacheMesures();
  let appels = 0;
  const mesurer = () => {
    appels += 1;
    return { naturalWidth: 602, naturalHeight: 900 };
  };
  const a = await mesurerImage('signed://affiche.jpg', { mesurer });
  const b = await mesurerImage('signed://affiche.jpg', { mesurer });
  assert.equal(appels, 1, 'la deuxième mesure doit venir du cache');
  assert.deepEqual(a, b);
  assert.equal(a.largeurNative, 602);
  assert.equal(Math.round(a.rapportNatif * 1000), 669);
  viderCacheMesures();
});

test('mesurerImage rejette une src vide et remonte une erreur de chargement', async () => {
  await assert.rejects(() => mesurerImage('  '), /src vide/);
  await assert.rejects(
    () => mesurerImage('x://cassee', { cache: false, mesurer: () => { throw new Error('boom'); } }),
    /boom/,
  );
});

test('mesurerImage hors navigateur le dit au lieu de planter', async () => {
  const sauvegarde = globalThis.Image;
  delete globalThis.Image;
  try {
    await assert.rejects(() => mesurerImage('x://sans-dom', { cache: false }), /hors navigateur/);
  } finally {
    if (sauvegarde) globalThis.Image = sauvegarde;
  }
});

/* ═══════════════ 2. [IMG-RATIO] — le correctif ═══════════════ */

test('⛔ [IMG-RATIO] les trois fichiers mesurés sortent à déformation < 1 %', () => {
  const releve = [];
  for (const cas of CAS_REELS) {
    const boite = boiteAuFormat({ ...cas, ...BOITE_MAX_DEFAUT });
    const ecart = deformation(boite, cas.largeurNative / cas.hauteurNative);
    releve.push({ nom: cas.nom, width: boite.width, height: boite.height, ecart });
    assert.ok(ecart < 1, `${cas.nom} : déformation ${ecart}% ≥ 1 %`);
    assert.ok(boite.width <= BOITE_MAX_DEFAUT.largeurMax);
    assert.ok(boite.height <= BOITE_MAX_DEFAUT.hauteurMax);
  }
  /* Boîtes attendues, calculées à la main sur le gabarit 560×320. */
  assert.deepEqual(
    releve.map((r) => [r.width, r.height]),
    [[214, 320], [480, 320], [240, 320]],
  );
});

test('⛔ [IMG-RATIO] l’ancienne boîte 560×320 en dur était bien fautive', () => {
  const ancienne = { width: 560, height: 320 };
  const mesures = CAS_REELS.map((c) => deformation(ancienne, c.largeurNative / c.hauteurNative));
  assert.ok(mesures[0] > 160, `602×900 : ${mesures[0]}%`); // ×2,6 en largeur
  assert.ok(mesures[1] > 15 && mesures[1] < 20, `900×600 : ${mesures[1]}%`); // ×1,17
  assert.ok(mesures[2] > 130, `675×900 : ${mesures[2]}%`); // ×2,3
  assert.equal(diagnostiquerDeformation(ancienne, 602 / 900).sens, 'etiree');
  assert.equal(diagnostiquerDeformation(ancienne, 602 / 900).facteurLargeur, 2.616);
  assert.equal(diagnostiquerDeformation({ width: 214, height: 320 }, 602 / 900).sens, 'fidele');
});

test('boiteAuFormat n’agrandit pas au-delà du natif, sauf plancher de lisibilité', () => {
  const petite = boiteAuFormat({ largeurNative: 120, hauteurNative: 80, largeurMax: 560, hauteurMax: 320 });
  assert.deepEqual([petite.width, petite.height], [120, 80], 'pas d’upscale par défaut');

  const agrandie = boiteAuFormat({ largeurNative: 120, hauteurNative: 80, largeurMax: 560, hauteurMax: 320, agrandir: true });
  assert.deepEqual([agrandie.width, agrandie.height], [480, 320]);
  assert.ok(deformation(agrandie, 1.5) < 1);

  const minuscule = boiteAuFormat({ largeurNative: 16, hauteurNative: 16, largeurMax: 560, hauteurMax: 320 });
  assert.ok(minuscule.width >= TAILLE_MIN, `plancher ${TAILLE_MIN}px : ${minuscule.width}`);
});

test('boiteAuFormat ne déborde jamais du gabarit demandé', () => {
  for (const [lMax, hMax] of [[690, 981], [200, 200], [40, 900]]) {
    for (const cas of CAS_REELS) {
      const b = boiteAuFormat({ ...cas, largeurMax: lMax, hauteurMax: hMax, agrandir: true });
      assert.ok(b.width <= lMax + 0.5 && b.height <= hMax + 0.5, `${cas.nom} déborde ${b.width}×${b.height}`);
      /* Plafond assumé : la boîte est en pixels ENTIERS, donc un demi-pixel d'arrondi
         pèse d'autant plus que la boîte est petite (40 px de large → jusqu'à 1,3 %). */
      const plafond = 100 / Math.min(b.width, b.height);
      assert.ok(
        deformation(b, cas.largeurNative / cas.hauteurNative) < Math.max(1, plafond),
        `${cas.nom} en ${b.width}×${b.height}`,
      );
    }
  }
});

/* ═══════════════ 3. Crop ═══════════════ */

test('normaliserMode refuse l’inconnu et ne tombe JAMAIS sur etirer', () => {
  assert.equal(normaliserMode(undefined), MODE_AJUSTEMENT_DEFAUT);
  assert.equal(normaliserMode('n’importe quoi'), MODES_AJUSTEMENT.CONTAIN);
  assert.notEqual(MODE_AJUSTEMENT_DEFAUT, MODES_AJUSTEMENT.ETIRER);
  assert.equal(normaliserMode('COVER'), MODES_AJUSTEMENT.COVER);
});

test('cover remplit le cadre en rognant la source, sans déformer', () => {
  /* 602×900 (portrait) dans un cadre paysage 560×320 : on rogne le HAUT et le BAS. */
  const r = calculerCrop({
    largeurNative: 602, hauteurNative: 900,
    boite: { x: 100, y: 50, width: 560, height: 320 },
    mode: 'cover',
  });
  assert.equal(r.unite, 'px');
  assert.equal(r.deformation, 0);
  assert.equal(r.crop.width, 602, 'toute la largeur source est gardée');
  assert.equal(r.crop.height, Math.round((602 / (560 / 320)) * 100) / 100);
  assert.equal(r.crop.x, 0);
  assert.ok(r.crop.y > 0 && r.crop.y + r.crop.height <= 900);
  /* Le rapport du crop épouse celui du cadre : rien n'est écrasé au rendu. */
  assert.ok(Math.abs(r.crop.width / r.crop.height - 560 / 320) < 1e-6);
  assert.deepEqual(r.boite, { x: 100, y: 50, width: 560, height: 320 });
});

test('cover sur une source paysage dans un cadre portrait rogne à gauche/droite', () => {
  const r = calculerCrop({ largeurNative: 900, hauteurNative: 600, boite: { width: 300, height: 400 }, mode: 'cover' });
  assert.equal(r.crop.height, 600);
  assert.equal(r.crop.width, 450);
  assert.equal(r.crop.x, 225, 'centré par défaut');
  assert.equal(r.crop.y, 0);
});

test('recadrer applique zoom et point focal, bornés à la source', () => {
  const r = calculerCrop({
    largeurNative: 900, hauteurNative: 600,
    boite: { width: 300, height: 400 },
    mode: 'recadrer', zoom: 2, focale: { x: 0, y: 0 },
  });
  assert.equal(r.crop.width, 225);
  assert.equal(r.crop.height, 300);
  assert.equal(r.crop.x, 0, 'focale hors bord : bornée, pas négative');
  assert.equal(r.crop.y, 0);
  const bord = calculerCrop({
    largeurNative: 900, hauteurNative: 600,
    boite: { width: 300, height: 400 }, mode: 'recadrer', zoom: 1.5, focale: { x: 1, y: 1 },
  });
  assert.ok(bord.crop.x + bord.crop.width <= 900 + 1e-6);
  assert.ok(bord.crop.y + bord.crop.height <= 600 + 1e-6);
});

test('contain letterboxe dans le cadre et ne rogne rien', () => {
  const r = calculerCrop({
    largeurNative: 602, hauteurNative: 900,
    boite: { x: 100, y: 50, width: 560, height: 320 }, mode: 'contain',
  });
  assert.equal(r.crop, null);
  assert.ok(r.deformation < 1);
  assert.equal(r.boite.height, 320);
  assert.ok(r.boite.width < 560);
  assert.equal(r.boite.x, 100 + r.decalage.x, 'la boîte est recentrée dans le cadre');
});

test('etirer reste possible mais assume sa déformation', () => {
  const r = calculerCrop({ largeurNative: 602, hauteurNative: 900, boite: { width: 560, height: 320 }, mode: 'etirer' });
  assert.equal(r.crop, null);
  assert.ok(r.deformation > 160, `déformation annoncée : ${r.deformation}%`);
});

test('sans dimensions natives le crop est RELATIF et le dit', () => {
  const r = calculerCrop({ rapportNatif: 602 / 900, boite: { width: 560, height: 320 }, mode: 'cover' });
  assert.equal(r.unite, 'ratio');
  assert.ok(r.crop.width <= 1 && r.crop.height <= 1);
  assert.throws(() => calculerCrop({ boite: { width: 10, height: 10 } }), /rapport natif inconnu/);
  assert.throws(() => calculerCrop({ rapportNatif: 1, boite: { width: 0, height: 10 } }), /cadre/);
});

/* ═══════════════ 4. Verrou de proportions ═══════════════ */

test('verrouillerRapport garde le coin opposé immobile', () => {
  /* Poignée bas-droite tirée → point fixe 'nw' : x,y ne bougent pas. */
  const r = verrouillerRapport({ boite: { x: 100, y: 50, width: 560, height: 320 }, rapport: 602 / 900, ancre: 'nw' });
  assert.equal(r.x, 100);
  assert.equal(r.y, 50);
  assert.ok(deformation(r, 602 / 900) < 1);
  assert.equal(pointFixePourPoignee('bottom-right'), 'nw');
  assert.equal(pointFixePourPoignee('top-left'), 'se');
  assert.equal(pointFixePourPoignee('inconnue'), 'nw');
});

test('verrouillerRapport déplace l’origine quand le point fixe est en bas à droite', () => {
  const depart = { x: 100, y: 50, width: 200, height: 200 };
  const r = verrouillerRapport({ boite: depart, rapport: 1.5, ancre: 'se' });
  assert.equal(r.x + r.width, depart.x + depart.width, 'le bord droit reste fixe');
  assert.equal(r.y + r.height, depart.y + depart.height, 'le bord bas reste fixe');
  assert.ok(Math.abs(r.width / r.height - 1.5) < 1e-6);
});

test('verrouillerRapport : poignée latérale = la largeur commande, verticale = la hauteur', () => {
  const lat = verrouillerRapport({ boite: { x: 0, y: 0, width: 300, height: 999 }, rapport: 1.5, ancre: 'w' });
  assert.equal(lat.width, 300);
  assert.equal(lat.height, 200);
  const vert = verrouillerRapport({ boite: { x: 0, y: 0, width: 999, height: 200 }, rapport: 1.5, ancre: 'n' });
  assert.equal(vert.height, 200);
  assert.equal(vert.width, 300);
});

test('verrouillerRapport : stratégies max (suit le geste) et min (reste dedans)', () => {
  const b = { x: 0, y: 0, width: 400, height: 100 };
  const max = verrouillerRapport({ boite: b, rapport: 1, ancre: 'nw', strategie: 'max' });
  const min = verrouillerRapport({ boite: b, rapport: 1, ancre: 'nw', strategie: 'min' });
  assert.deepEqual([max.width, max.height], [400, 400]);
  assert.deepEqual([min.width, min.height], [100, 100]);
  assert.throws(() => verrouillerRapport({ boite: { width: 0, height: 10 }, rapport: 1 }), /boîte invalide/);
});

/* ═══════════════ 5. [IMG-HORSPAGE] — placement ═══════════════ */

const dansLaPage = (r) => r.y >= MARGES.haut && r.y + r.height <= BAS_UTILE;

test('⛔ [IMG-HORSPAGE] page vide : l’image tient dans la zone imprimable', () => {
  for (const cas of CAS_REELS) {
    const r = placerDansLaPage({ objets: [], image: cas, page: PAGE_A4, marges: MARGES });
    assert.ok(r.place, `${cas.nom} devrait être placée`);
    assert.ok(dansLaPage(r), `${cas.nom} : y=${r.y} h=${r.height} sort de la page`);
    assert.ok(r.x >= MARGES.gauche && r.x + r.width <= PAGE_A4.largeur - MARGES.droite);
    assert.ok(r.deformation < 1, `${cas.nom} : déformation ${r.deformation}%`);
  }
});

test('⛔ [IMG-HORSPAGE] les positions fautives mesurées (y=1044, y=1382) ne se reproduisent pas', () => {
  /* Le flux existant descend déjà à 1044 : l'ancien code posait la suivante à 1382. */
  const objets = [{ y: 700, height: 344 }];
  const r = placerDansLaPage({ objets, image: CAS_REELS[0], page: PAGE_A4, marges: MARGES });
  assert.ok(r.y < 1044, `posée à y=${r.y}`);
  assert.ok(r.y + r.height <= BAS_UTILE, `bas à ${r.y + r.height} > ${BAS_UTILE}`);
});

test('place réduite AU RAPPORT quand il ne reste qu’un bandeau', () => {
  const objets = [{ y: 72, height: 828 }]; // bas = 900, reste 135 px sous l'écart
  const r = placerDansLaPage({ objets, image: CAS_REELS[0], page: PAGE_A4, marges: MARGES });
  assert.ok(r.place);
  assert.equal(r.reduit, true);
  assert.ok(dansLaPage(r));
  assert.ok(r.deformation < 1, `réduction déformante : ${r.deformation}%`);
});

test('⛔ page pleine : le retour le DIT au lieu de déborder', () => {
  const objets = [{ y: 72, height: 950 }]; // bas = 1022, il ne reste rien d'utile
  const r = placerDansLaPage({ objets, image: CAS_REELS[0], page: PAGE_A4, marges: MARGES });
  assert.equal(r.place, false);
  assert.equal(r.raison, 'page-pleine');
  assert.ok(dansLaPage(r), `position de secours hors page : y=${r.y} h=${r.height}`);
});

test('multi-pages : le débordement descend à la page suivante, pas dans le vide', () => {
  const page = { ...PAGE_A4, pages: 2 };
  const objets = [{ y: 72, height: 960 }];
  const r = placerDansLaPage({ objets, image: CAS_REELS[0], page, marges: MARGES, reduireSiBesoin: false });
  assert.equal(r.place, true);
  assert.equal(r.pageIndex, 1);
  assert.equal(r.y, PAGE_A4.hauteur + MARGES.haut);
  assert.ok(r.y + r.height <= PAGE_A4.hauteur * 2 - MARGES.bas);
});

test('alignement gauche / droite / centre restent dans les marges', () => {
  const base = { objets: [], image: CAS_REELS[2], page: PAGE_A4, marges: MARGES };
  const g = placerDansLaPage({ ...base, alignement: 'gauche' });
  const d = placerDansLaPage({ ...base, alignement: 'droite' });
  const c = placerDansLaPage({ ...base, alignement: 'centre' });
  assert.equal(g.x, MARGES.gauche);
  assert.equal(d.x + d.width, PAGE_A4.largeur - MARGES.droite);
  assert.ok(c.x > g.x && c.x < d.x);
});

test('sans dimensions natives, une boîte fournie est respectée et bornée à la page', () => {
  const r = placerDansLaPage({ objets: [], image: { width: 2000, height: 1200 }, page: PAGE_A4, marges: MARGES });
  assert.ok(r.width <= PAGE_A4.largeur - MARGES.gauche - MARGES.droite);
  assert.ok(dansLaPage(r));
  assert.ok(deformation(r, 2000 / 1200) < 1);
});

/* ═══════════════ 5 bis. [CRIT-RECOUVR] — la POSE n'empile plus ═══════════════ */

/* L'habillage « image » du rail Document : 440 × 280 posés à 52,180 — les trois
   fichiers du 2026-08-05 sont arrivés avec exactement cette demande. */
const HABILLAGE = { largeurNative: 900, hauteurNative: 600, largeurMax: 300, hauteurMax: 200 };
const CHUTE_DOCUMENT = { x: 52, y: 180 };

test('recouvrementMaximal mesure la part CACHÉE de la boîte à poser', () => {
  const b = { x: 0, y: 0, width: 100, height: 100 };
  assert.equal(recouvrementMaximal(b, []), 0);
  assert.equal(recouvrementMaximal(b, [{ x: 0, y: 0, width: 100, height: 100 }]), 1);
  assert.equal(recouvrementMaximal(b, [{ x: 50, y: 0, width: 100, height: 100 }]), 0.5);
  assert.equal(recouvrementMaximal(b, [{ x: 200, y: 200, width: 10, height: 10 }]), 0);
  /* Rapportée à la boîte POSÉE : une vignette sur une grande image est cachée à 100 %. */
  const vignette = { x: 10, y: 10, width: 20, height: 20 };
  assert.equal(recouvrementMaximal(vignette, [{ x: 0, y: 0, width: 500, height: 500 }]), 1);
});

test('estFondDePage ne confond pas une grande image et un fond perdu', () => {
  assert.equal(estFondDePage({ width: 794, height: 1123 }, 794, 1123), true);
  assert.equal(estFondDePage({ width: 690, height: 300 }, 794, 1123), false);
  assert.equal(estFondDePage({ y: 72, height: 950 }, 794, 1123), false, 'sans largeur : pas un fond');
});

test('⛔ [CRIT-RECOUVR] trois imports au MÊME point de chute donnent trois positions', () => {
  const objets = [];
  const poses = [];
  for (let i = 0; i < 3; i += 1) {
    const r = placerDansLaPage({
      objets,
      image: HABILLAGE,
      page: PAGE_A4,
      marges: MARGES,
      position: CHUTE_DOCUMENT,
    });
    assert.ok(r.place, `image ${i + 1} : ${r.raison}`);
    assert.ok(dansLaPage(r), `image ${i + 1} hors page : y=${r.y} h=${r.height}`);
    poses.push(r);
    objets.push({ type: 'image', x: r.x, y: r.y, width: r.width, height: r.height });
  }
  /* Le défaut mesuré : trois fois 52,180. */
  assert.equal(new Set(poses.map((r) => `${r.x},${r.y}`)).size, 3, 'positions confondues');
  assert.deepEqual(poses.map((r) => r.deplace), [false, true, true]);
  /* Aucune paire ne se recouvre au-delà du seuil. */
  for (let i = 0; i < poses.length; i += 1) {
    for (let j = i + 1; j < poses.length; j += 1) {
      assert.ok(
        recouvrementMaximal(poses[i], [poses[j]]) < SEUIL_RECOUVREMENT,
        `images ${i + 1} et ${j + 1} empilées`,
      );
    }
  }
});

test('⛔ le reflux GARDE la marge demandée : « Colonne gauche » ne se recentre pas', () => {
  // Le défaut mesuré : la place 52,180 occupée, l'image descendait mais ressortait
  // à x=278 — centrage exact (794−l)/2, plus aucune « marge gauche ».
  const r = placerDansLaPage({
    objets: [{ type: 'image', x: 52, y: 180, width: 351, height: 351 }],
    image: HABILLAGE,
    page: PAGE_A4,
    marges: MARGES,
    position: CHUTE_DOCUMENT,
  });
  assert.equal(r.deplace, true, 'le point de chute occupé est bien abandonné');
  assert.ok(r.y > 180, 'l’image descend dans le flux');
  assert.equal(r.x, 52, 'le x demandé (marge gauche) est conservé');
});

test('sans x demandé, le reflux suit toujours l’alignement', () => {
  const r = placerDansLaPage({
    objets: [{ type: 'text', x: 52, y: 72, width: 690, height: 300 }],
    image: HABILLAGE,
    page: PAGE_A4,
    marges: MARGES,
    alignement: 'centre',
  });
  const centre = MARGES.gauche + (PAGE_A4.largeur - MARGES.gauche - MARGES.droite - r.width) / 2;
  assert.equal(r.x, Math.round(centre));
});

test('un point de chute LIBRE est respecté, pas « corrigé »', () => {
  const r = placerDansLaPage({
    objets: [{ type: 'image', x: 52, y: 700, width: 300, height: 200 }],
    image: HABILLAGE,
    page: PAGE_A4,
    marges: MARGES,
    position: CHUTE_DOCUMENT,
  });
  assert.equal(r.deplace, false);
  assert.deepEqual([r.x, r.y], [52, 180]);
  assert.ok(r.recouvrement < SEUIL_RECOUVREMENT);
});

test('un FOND PERDU n’est pas un obstacle : l’affiche reste posable', () => {
  const fond = { type: 'image', x: 0, y: 0, width: PAGE_A4.largeur, height: PAGE_A4.hauteur };
  const r = placerDansLaPage({
    objets: [fond],
    image: HABILLAGE,
    page: PAGE_A4,
    marges: MARGES,
    position: CHUTE_DOCUMENT,
  });
  assert.equal(r.place, true);
  assert.equal(r.deplace, false);
  assert.deepEqual([r.x, r.y], [52, 180]);
});

test('⛔ point de chute occupé ET page pleine : le retour le DIT (pas d’empilement muet)', () => {
  const r = placerDansLaPage({
    objets: [{ type: 'image', x: 52, y: 72, width: 690, height: 950 }],
    image: HABILLAGE,
    page: PAGE_A4,
    marges: MARGES,
    position: CHUTE_DOCUMENT,
  });
  assert.equal(r.place, false);
  assert.equal(r.raison, 'page-pleine');
  assert.equal(r.deplace, true);
  assert.ok(dansLaPage(r));
});

test('obstacles ≠ objets : le flux voit le texte, le recouvrement ne voit que ce qu’on lui donne', () => {
  const texte = { type: 'text', x: 52, y: 72, width: 690, height: 300 };
  const r = placerDansLaPage({
    objets: [texte],
    obstacles: [], // aplat décoratif : rien ne gêne
    image: HABILLAGE,
    page: PAGE_A4,
    marges: MARGES,
    position: CHUTE_DOCUMENT,
  });
  assert.equal(r.deplace, false, 'aucun obstacle déclaré : la chute est gardée');
  const avecObstacle = placerDansLaPage({
    objets: [texte],
    obstacles: [texte],
    image: HABILLAGE,
    page: PAGE_A4,
    marges: MARGES,
    position: CHUTE_DOCUMENT,
  });
  assert.equal(avecObstacle.deplace, true);
  /* Le flux descend sous le TEXTE, même quand il n'était pas obstacle. */
  assert.ok(avecObstacle.y >= 372, `posée à y=${avecObstacle.y}`);
});

/* ═══════════════ 5 ter. [IMG-FLASH] — la boîte provisoire n'invente rien ═══════════════ */

test('⛔ [IMG-FLASH] la boîte d’attente est CARRÉE : aucune orientation affirmée', () => {
  const n = boiteNeutre({ largeurVoulue: 560, hauteurVoulue: 320, largeurMax: 690, hauteurMax: 981 });
  assert.equal(n.width, n.height, 'un rectangle affirmerait un format qu’on n’a pas mesuré');
  assert.equal(n.width, Math.round(Math.sqrt(560 * 320)), 'surface demandée conservée');
  /* La déformation de la boîte d'attente ne dépend plus du fichier : elle est la MÊME
     dans les deux sens, là où 560×320 étirait de 161 % un portrait et de 16 % un paysage. */
  const portrait = deformation(n, 602 / 900);
  const paysage = deformation(n, 900 / 600);
  assert.ok(portrait < 50 && paysage < 50, `${portrait}% / ${paysage}%`);
  assert.ok(deformation({ width: 560, height: 320 }, 602 / 900) > 160, 'témoin : l’ancienne boîte');
});

test('boiteNeutre reste dans le gabarit et au-dessus du plancher de lisibilité', () => {
  const bornee = boiteNeutre({ largeurVoulue: 2000, hauteurVoulue: 2000, largeurMax: 300, hauteurMax: 120 });
  assert.deepEqual([bornee.width, bornee.height], [120, 120]);
  const minuscule = boiteNeutre({ largeurVoulue: 4, hauteurVoulue: 4, largeurMax: 690, hauteurMax: 981 });
  assert.ok(minuscule.width >= TAILLE_MIN, `plancher : ${minuscule.width}`);
  /* Gabarit plus petit que le plancher : le gabarit gagne, on ne déborde jamais. */
  const etroit = boiteNeutre({ largeurVoulue: 100, hauteurVoulue: 100, largeurMax: 20, hauteurMax: 900 });
  assert.equal(etroit.width, 20);
});

test('la boîte finale s’inscrit dans la boîte d’attente : la mesure ne fait pas sauter l’échelle', () => {
  const n = boiteNeutre({ largeurVoulue: 440, hauteurVoulue: 280, largeurMax: 690, hauteurMax: 981 });
  for (const cas of CAS_REELS) {
    const finale = boiteAuFormat({ ...cas, largeurMax: n.width, hauteurMax: n.height, agrandir: true });
    assert.ok(finale.width <= n.width && finale.height <= n.height, `${cas.nom} déborde la boîte d’attente`);
    assert.ok(deformation(finale, cas.largeurNative / cas.hauteurNative) < 1, cas.nom);
    /* Même ordre de grandeur : pas de vignette après une grande boîte d'attente. */
    assert.ok(finale.width * finale.height > n.width * n.height * 0.5, `${cas.nom} : surface effondrée`);
  }
});

/* ═══════════════ 6. Composition ═══════════════ */

test('proposerGeometrieImage rend un patch complet, fidèle et dans la page', () => {
  const r = proposerGeometrieImage({
    largeurNative: 675, hauteurNative: 900,
    objets: [], page: PAGE_A4, marges: MARGES,
  });
  assert.equal(r.crop, null);
  assert.equal(r.mode, MODES_AJUSTEMENT.CONTAIN);
  assert.ok(r.place);
  assert.ok(r.deformation < 1);
  assert.ok(dansLaPage(r));
});

test('proposerGeometrieImage avec cadre imposé rogne au lieu d’étirer', () => {
  const r = proposerGeometrieImage({
    largeurNative: 602, hauteurNative: 900,
    cadre: { width: 560, height: 320 }, mode: 'cover',
    objets: [], page: PAGE_A4, marges: MARGES,
  });
  assert.equal(r.width, 560);
  assert.equal(r.height, 320);
  assert.equal(r.unite, 'px');
  assert.equal(r.deformation, 0);
  assert.ok(r.crop && r.crop.width > 0 && r.crop.height > 0);
  assert.ok(dansLaPage(r));
});

test('deformation reste muette quand le rapport natif est inconnu', () => {
  assert.equal(deformation({ width: 560, height: 320 }, null), 0);
  assert.equal(deformation(null, 1.5), 0);
  assert.equal(diagnostiquerDeformation(null, null).visible, false);
});
