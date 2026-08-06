/**
 * Tests documentPagination — exécution : node --test documentPagination.test.mjs
 * Priorité : la répartition en pages, les débordements et les jetons de numérotation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FORMATS_PAGE,
  MARGES_DEFAUT,
  zoneUtile,
  resoudreFormat,
  resoudreMarges,
  origineDePage,
  hauteurTotale,
  hauteurDeCadrage,
  formatDepuisCanevas,
  paginer,
  patchesDePagination,
  insererSautDePage,
  estSautDePage,
  substituerJetons,
  enTetePiedRecurrents,
  remplacerEntetePied,
  reserveDesBandes,
  patchesReserveBandes,
  configDepuisBandes,
} from './documentPagination.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const bloc = (id, y, height = 200) => ({ id, type: 'text', x: 52, y, width: 690, height, content: { text: id } });

/* ── Formats ──────────────────────────────────────────────────── */

test('FORMATS_PAGE donne les dimensions px à 96 dpi', () => {
  assert.equal(FORMATS_PAGE.a4_portrait.largeur, 794);
  assert.equal(FORMATS_PAGE.a4_portrait.hauteur, 1123);
  assert.equal(FORMATS_PAGE.a4_paysage.largeur, 1123);
  assert.equal(FORMATS_PAGE.a4_paysage.hauteur, 794);
  assert.equal(FORMATS_PAGE.a5_portrait.hauteur, 794);
  assert.equal(FORMATS_PAGE.letter_portrait.largeur, 816);
  assert.equal(resoudreFormat('inconnu').id, 'a4_portrait');
  assert.equal(resoudreFormat({ largeur: 500, hauteur: 500 }).id, 'perso');
});

test('zoneUtile retranche les marges', () => {
  const z = zoneUtile('a4_portrait', MARGES_DEFAUT);
  assert.equal(z.haut, 72);
  assert.equal(z.bas, 1053);
  assert.equal(z.hauteur, 981);
  assert.equal(z.largeur, 690);
  assert.equal(resoudreMarges({ haut: 10 }).bas, MARGES_DEFAUT.bas);
});

test('origineDePage et hauteurTotale tiennent compte de l\'écart', () => {
  assert.equal(origineDePage(0), 0);
  assert.equal(origineDePage(2), 2246);
  assert.equal(origineDePage(2, 'a4_portrait', 40), 2326);
  assert.equal(hauteurTotale(3), 3369);
});

/* ── Pagination ───────────────────────────────────────────────── */

test('un document qui tient sur une page n\'est PAS déplacé', () => {
  const objets = [bloc('a', 72, 300), bloc('b', 400, 300), bloc('c', 720, 300)];
  const r = paginer(objets, 'a4_portrait', MARGES_DEFAUT);
  assert.equal(r.nbPages, 1);
  assert.deepEqual(r.placements.map((p) => p.decalage), [0, 0, 0]);
  assert.deepEqual(r.debordements, []);
  assert.deepEqual(patchesDePagination(r), []);
  assert.deepEqual(r.pages[0].objets, ['a', 'b', 'c']);
});

test('un objet qui déborde bascule en page 2, calé sur la marge haute', () => {
  const objets = [72, 292, 512, 732, 952].map((y, i) => bloc(`b${i}`, y, 200));
  const r = paginer(objets, 'a4_portrait', MARGES_DEFAUT);

  assert.equal(r.nbPages, 2);
  assert.deepEqual(r.pages[0].objets, ['b0', 'b1', 'b2', 'b3']);
  assert.deepEqual(r.pages[1].objets, ['b4']);

  const dernier = r.placements.find((p) => p.id === 'b4');
  assert.equal(dernier.page, 1);
  assert.equal(dernier.yPage, 72, 'calé sur la marge haute de sa page');
  assert.equal(dernier.yAbsolu, 1123 + 72);
  assert.equal(dernier.decalage, 243);
  assert.equal(dernier.debordant, true);
  assert.equal(dernier.coupe, false);

  assert.deepEqual(r.placements.slice(0, 4).map((p) => p.decalage), [0, 0, 0, 0]);
  assert.deepEqual(patchesDePagination(r), [{ id: 'b4', patch: { y: 1195 } }]);
  assert.equal(r.debordements.length, 1);
});

test('les écarts relatifs sont conservés à l\'intérieur d\'une page', () => {
  const objets = [bloc('a', 72, 900), bloc('b', 1000, 100), bloc('c', 1140, 100)];
  const r = paginer(objets, 'a4_portrait', MARGES_DEFAUT);
  const b = r.placements.find((p) => p.id === 'b');
  const c = r.placements.find((p) => p.id === 'c');
  assert.equal(b.page, 1);
  assert.equal(b.yPage, 72);
  assert.equal(c.page, 1);
  assert.equal(c.yPage - b.yPage, 140, 'l\'écart d\'origine (140 px) est préservé');
});

test('un saut de page ferme la page même si la place restait', () => {
  const objets = [bloc('a', 72, 100), bloc('b', 400, 100)];
  const { objets: avecSaut, marqueur } = insererSautDePage(objets, 200);
  assert.ok(estSautDePage(marqueur));

  const r = paginer(avecSaut, 'a4_portrait', MARGES_DEFAUT);
  assert.equal(r.nbPages, 2);
  assert.deepEqual(r.pages[0].objets, ['a', marqueur.id]);
  assert.deepEqual(r.pages[1].objets, ['b']);
  assert.equal(r.placements.find((p) => p.id === 'b').yPage, 72);
});

test('insererSautDePage ne mute pas la liste reçue', () => {
  const objets = [bloc('a', 72, 100)];
  const avant = clone(objets);
  const res = insererSautDePage(objets, 300);
  assert.deepEqual(clone(objets), avant);
  assert.equal(res.ajouts.length, 1);
  assert.equal(res.objets.length, 2);
  assert.equal(res.marqueur.y, 300);
  assert.equal(res.marqueur.type, 'line');
});

test('un objet plus haut qu\'une page est signalé, jamais découpé en silence', () => {
  const objets = [bloc('geant', 72, 1200), bloc('suite', 1300, 50)];
  const r = paginer(objets, 'a4_portrait', MARGES_DEFAUT);
  const geant = r.placements.find((p) => p.id === 'geant');
  assert.equal(geant.coupe, true);
  assert.equal(geant.page, 0);
  assert.equal(r.debordements.some((p) => p.id === 'geant'), true);
  assert.equal(r.placements.find((p) => p.id === 'suite').page, 1);
  assert.equal(r.nbPages, 2);
});

test('changer de format change la répartition (A5 = plus de pages)', () => {
  const objets = [72, 292, 512, 732].map((y, i) => bloc(`b${i}`, y, 200));
  const a4 = paginer(objets, 'a4_portrait', MARGES_DEFAUT);
  const a5 = paginer(objets, 'a5_portrait', MARGES_DEFAUT);
  assert.equal(a4.nbPages, 1);
  assert.ok(a5.nbPages > 1, 'la zone utile A5 (652 px) ne tient pas 4 blocs de 200');
  assert.equal(a5.format.hauteur, 794);
});

test('paginer ignore les bandes récurrentes et les objets sans y', () => {
  const bandes = enTetePiedRecurrents({ pied: 'Cabinet', nbPages: 1 });
  const objets = [...bandes, bloc('a', 72, 100), { id: 'sansY', type: 'text' }];
  const r = paginer(objets, 'a4_portrait', MARGES_DEFAUT);
  assert.deepEqual(r.pages[0].objets, ['a']);
});

/* ── En-tête / pied / numérotation ────────────────────────────── */

test('substituerJetons remplace {{page}} et {{pages}}', () => {
  assert.equal(substituerJetons('Page {{page}} / {{pages}}', { page: 2, pages: 5 }), 'Page 2 / 5');
  assert.equal(substituerJetons('{{ PAGE }}', { page: 3, pages: 3 }), '3');
  assert.equal(substituerJetons('sans jeton', { page: 1, pages: 1 }), 'sans jeton');
});

test('enTetePiedRecurrents répète les bandes page par page', () => {
  const objets = enTetePiedRecurrents({
    enTete: 'Cabinet Ngowazulu',
    pied: 'contact@exemple.org',
    numerotation: true,
    nbPages: 3,
  });
  assert.equal(objets.length, 9, '3 pages × (en-tête + pied + numéro)');

  const numeros = objets.filter((o) => o.meta.role === 'numero').map((o) => o.content.text);
  assert.deepEqual(numeros, ['Page 1 / 3', 'Page 2 / 3', 'Page 3 / 3']);

  const entetes = objets.filter((o) => o.meta.role === 'entete');
  assert.deepEqual(entetes.map((o) => o.meta.page), [0, 1, 2]);
  assert.equal(entetes[1].y - entetes[0].y, 1123, 'une page d\'écart exactement');

  // ⛔ DOCTRINE : les bandes sont DANS la zone imprimable (la critique de l'appli
  // dénonçait « bloc(s) mordent la marge » sur ses propres en-têtes). Le corps ne
  // passe pas dessous : `reserveDesBandes` le repousse.
  const z = zoneUtile('a4_portrait', MARGES_DEFAUT);
  for (const o of objets) {
    const yLocal = o.y - origineDePage(o.meta.page);
    assert.ok(yLocal >= z.haut, `bande au-dessus de la zone imprimable: ${o.meta.role} (${yLocal})`);
    assert.ok(yLocal + o.height <= z.bas, `bande sous la zone imprimable: ${o.meta.role} (${yLocal + o.height})`);
  }

  // Aucune paire de bandes ne se recouvre (recouvrement > 2 px = défaut BLOQUANT).
  for (let i = 0; i < objets.length; i += 1) {
    for (let j = i + 1; j < objets.length; j += 1) {
      const a = objets[i];
      const b = objets[j];
      const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      assert.ok(oy <= 2, `bandes superposées: ${a.meta.role} × ${b.meta.role} (${oy} px)`);
    }
  }

  // Le corps est repoussé sous l'en-tête et au-dessus du pied.
  const reserve = reserveDesBandes(objets, 'a4_portrait');
  assert.ok(reserve.haut > z.haut, 'réserve haute posée');
  assert.ok(reserve.bas !== null && reserve.bas < z.bas, 'réserve basse posée');
});

test('reserveDesBandes empêche le corps de passer sous l\'en-tête', () => {
  const bandes = enTetePiedRecurrents({ enTete: 'Cabinet', pied: 'contact', numerotation: true, nbPages: 2 });
  const corps = bloc('corps', 72, 900);
  const res = paginer([corps, ...bandes], 'a4_portrait', MARGES_DEFAUT);
  const p = res.placements.find((x) => x.id === 'corps');
  const reserve = reserveDesBandes(bandes, 'a4_portrait');
  assert.ok(p.yAbsolu >= reserve.haut, `corps posé à ${p.yAbsolu}, réserve ${reserve.haut}`);
});

test('configDepuisBandes relit ce qui est posé sur le canevas', () => {
  const bandes = enTetePiedRecurrents({
    enTete: 'Cabinet Ngowazulu',
    pied: 'contact@exemple.org',
    numerotation: { gabarit: '— {{page}} —' },
    nbPages: 2,
  });
  const cfg = configDepuisBandes(bandes, 'a4_portrait');
  assert.equal(cfg.enTete.texte, 'Cabinet Ngowazulu');
  assert.equal(cfg.pied.texte, 'contact@exemple.org');
  assert.equal(cfg.numerotation.gabarit, '— {{page}} —', 'le gabarit survit aux jetons substitués');
  assert.equal(cfg.numerotation.position, 'pied');
  assert.equal(configDepuisBandes([], 'a4_portrait'), null);

  // Regénérer depuis la config relue redonne EXACTEMENT les mêmes textes.
  const refaites = enTetePiedRecurrents({ ...cfg, nbPages: 2 });
  assert.deepEqual(refaites.map((o) => o.content.text), bandes.map((o) => o.content.text));
});

test('page ajoutée : les bandes couvrent la page neuve sans rien retaper', () => {
  const scene = [
    bloc('corps', 120, 300),
    ...enTetePiedRecurrents({
      enTete: 'Cabinet Ngowazulu',
      pied: 'contact@exemple.org',
      numerotation: true,
      nbPages: 2,
    }),
  ];
  // Ce que fait l'outil Pages : relire la config posée, régénérer pour N+1.
  const cfg = configDepuisBandes(scene, 'a4_portrait');
  const res = remplacerEntetePied(scene, { ...cfg, nbPages: 3, format: 'a4_portrait', marges: MARGES_DEFAUT });

  assert.equal(res.suppressions.length, 6, 'les 6 anciennes bandes sont retirées');
  assert.equal(res.ajouts.length, 9, '3 pages × 3 bandes');
  assert.deepEqual(
    res.ajouts.filter((o) => o.meta.role === 'numero').map((o) => o.content.text),
    ['Page 1 / 3', 'Page 2 / 3', 'Page 3 / 3'],
    'la numérotation est réécrite sur le nouveau total',
  );
  assert.deepEqual(
    res.ajouts.filter((o) => o.meta.role === 'entete').map((o) => o.content.text),
    ['Cabinet Ngowazulu', 'Cabinet Ngowazulu', 'Cabinet Ngowazulu'],
  );
  // La page 3 est bien couverte, dans SA bande de canevas.
  const enteteP2 = res.ajouts.find((o) => o.meta.role === 'entete' && o.meta.page === 2);
  assert.ok(enteteP2.y >= origineDePage(2) && enteteP2.y < origineDePage(3));
});

test('numérotation : gabarit libre et première page sautée', () => {
  const objets = enTetePiedRecurrents({
    numerotation: { gabarit: '— {{page}} —', sauterPremiere: true },
    nbPages: 3,
  });
  assert.deepEqual(objets.map((o) => o.content.text), ['— 2 —', '— 3 —']);
});

test('remplacerEntetePied purge les bandes précédentes', () => {
  const anciennes = enTetePiedRecurrents({ pied: 'v1', nbPages: 2 });
  const scene = [bloc('a', 72, 100), ...anciennes];
  const res = remplacerEntetePied(scene, { pied: 'v2', nbPages: 3 });

  assert.equal(res.suppressions.length, 2);
  assert.deepEqual(res.suppressions, anciennes.map((o) => o.id));
  assert.equal(res.ajouts.length, 3);
  assert.deepEqual(res.ajouts.map((o) => o.content.text), ['v2', 'v2', 'v2']);

  const restant = scene.filter((o) => !res.suppressions.includes(o.id));
  assert.deepEqual(restant.map((o) => o.id), ['a']);
});

/* ── Réservation des bandes ───────────────────────────────────── */

test('patchesReserveBandes fait descendre le corps sous la bande d\'en-tête', () => {
  // Le cas exact du défaut : le tableau est posé à la marge haute (72) et la
  // bande d'en-tête atterrit au MÊME y.
  const corps = [bloc('titre', 72, 40), bloc('tableau', 130, 300)];
  const bandes = enTetePiedRecurrents({ enTete: 'SARL Boisclair — Devis', nbPages: 1 });
  assert.equal(bandes[0].y, 72, 'la bande occupe bien le haut de la zone imprimable');

  const { patches, reserve } = patchesReserveBandes(corps, bandes, { format: 'a4_portrait' });
  assert.equal(reserve.haut, 97, '72 + 17 px de bande + 8 px de filet');
  assert.equal(patches.length, 2, 'toute la page descend, pas seulement le bloc intrus');
  // ⛔ Décalage UNIFORME : l'écart de 18 px entre les deux blocs est conservé.
  assert.equal(patches[0].patch.y, 97);
  assert.equal(patches[1].patch.y, 155);
});

test('patchesReserveBandes ne bouge rien si le corps est déjà sous la bande', () => {
  const corps = [bloc('a', 97, 200), bloc('b', 320, 200)];
  const bandes = enTetePiedRecurrents({ enTete: 'X', nbPages: 1 });
  assert.deepEqual(patchesReserveBandes(corps, bandes, { format: 'a4_portrait' }).patches, []);
  // Sans bande haute, aucune réservation possible : rien ne doit bouger non plus.
  const piedSeul = enTetePiedRecurrents({ pied: 'X', nbPages: 1 });
  assert.deepEqual(patchesReserveBandes([bloc('a', 0, 20)], piedSeul, {}).patches, []);
});

test('patchesReserveBandes épargne les blocs verrouillés et les fonds de page', () => {
  const fond = { ...bloc('fond', 0, 1123), type: 'rect' };
  const verrou = { ...bloc('verrou', 10, 30), locked: true };
  const bandes = enTetePiedRecurrents({ enTete: 'X', nbPages: 1 });
  const { patches } = patchesReserveBandes([fond, verrou, bloc('texte', 72, 40)], bandes, {});
  assert.deepEqual(patches.map((p) => p.id), ['texte'], 'seul le corps poussable descend');
});

test('patchesReserveBandes traite chaque page pour elle-même et signale le bas', () => {
  const corps = [bloc('p1', 72, 40), bloc('p2', 1123 + 200, 40), bloc('p2bas', 1123 + 990, 40)];
  const bandes = enTetePiedRecurrents({ enTete: 'X', pied: 'Y', nbPages: 2 });
  const { patches, conflitsBas, reserve } = patchesReserveBandes(corps, bandes, { format: 'a4_portrait' });
  assert.deepEqual(patches.map((p) => p.id), ['p1'], 'la page 2 n\'a pas d\'intrus, elle ne bouge pas');
  assert.equal(patches[0].patch.y, 97);
  assert.ok(reserve.bas != null && reserve.bas < 1123);
  // Le bloc qui touche la bande de pied ne remonte PAS : il est signalé.
  assert.deepEqual(conflitsBas, ['p2bas']);
});

test('patchesReserveBandes ne pousse RIEN quand la page est déjà pleine', () => {
  // ⛔ Le piège mesuré : un bloc à y = 1122 sur une page de 1123. Le pousser de 25 px
  // le faisait entrer dans le contenu de la page 2 — la réservation créait un
  // recouvrement de 690 × 15 px en réparant celui de l'en-tête.
  const corps = [bloc('haut', 72, 200), bloc('debordant', 1122, 200), bloc('page2', 1332, 200)];
  const bandes = enTetePiedRecurrents({ enTete: 'X', nbPages: 2 });
  const res = patchesReserveBandes(corps, bandes, { format: 'a4_portrait' });
  assert.deepEqual(res.patches, [], 'tout ou rien : aucune page à moitié poussée');
  assert.deepEqual(res.pagesBloquees, [1], 'la page 1 est nommée pour que l\'écran le dise');
});

test('remplacerEntetePied embarque les patches de réservation', () => {
  const corps = [bloc('tableau', 72, 300)];
  const res = remplacerEntetePied(corps, { enTete: 'En-tête', nbPages: 1, format: 'a4_portrait' });
  assert.equal(res.patches.length, 1);
  assert.equal(res.patches[0].id, 'tableau');
  assert.equal(res.patches[0].patch.y, 97);
  assert.equal(res.suppressions.length, 0);
});

test('la repagination est idempotente après la réservation', () => {
  // Poser l'en-tête puis « Réorganiser en pages » ne doit rien redéplacer.
  const corps = [bloc('tableau', 72, 300)];
  const res = remplacerEntetePied(corps, { enTete: 'En-tête', nbPages: 1, format: 'a4_portrait' });
  const parId = new Map(res.patches.map((p) => [p.id, p.patch]));
  const scene = [...corps.map((o) => ({ ...o, ...(parId.get(o.id) ?? {}) })), ...res.ajouts];
  assert.deepEqual(patchesDePagination(paginer(scene, 'a4_portrait', MARGES_DEFAUT), {}), []);
});

test('hauteurDeCadrage cadre UNE page, pas la pile', () => {
  // A4 portrait : 1 page → rien à changer ; 2 pages → on cadre la page.
  assert.equal(hauteurDeCadrage(794, 1123), 1123);
  assert.equal(hauteurDeCadrage(794, 2246), 1123);
  assert.equal(hauteurDeCadrage(794, 3369), 1123);
});

test('hauteurDeCadrage laisse le SmartBoard intact', () => {
  // Aucune largeur de format ne correspond → la fonction ne doit rien inventer.
  assert.equal(hauteurDeCadrage(1037, 750), 750);
  assert.equal(hauteurDeCadrage(1920, 1080), 1080);
  assert.equal(hauteurDeCadrage(0, 0), 0);
});

test('hauteurDeCadrage suit les autres formats de page', () => {
  assert.equal(hauteurDeCadrage(816, 2112), 1056);
  assert.equal(hauteurDeCadrage(1123, 1588), 794);
});

test('⛔ formatDepuisCanevas départage A4 portrait et A5 paysage par la HAUTEUR', () => {
  // Le piège mesuré : 794×1118 (2 pages A5 paysage) relu « A4 portrait, 1 page »,
  // l'aller-retour de format perdait une page entière de canevas.
  assert.equal(formatDepuisCanevas(794, 1118).id, 'a5_paysage');
  assert.equal(formatDepuisCanevas(794, 559).id, 'a5_paysage');
  assert.equal(formatDepuisCanevas(794, 1123).id, 'a4_portrait');
  assert.equal(formatDepuisCanevas(794, 2246).id, 'a4_portrait');
  assert.equal(formatDepuisCanevas(1123, 794).id, 'a4_paysage');
});

test('formatDepuisCanevas rend null hors des largeurs de page', () => {
  assert.equal(formatDepuisCanevas(1037, 750), null);
  assert.equal(formatDepuisCanevas(1920, 1080), null);
  assert.equal(formatDepuisCanevas(0, 1123), null);
});

test('hauteurDeCadrage cadre la page A5 paysage d’un canevas 794×1118', () => {
  assert.equal(hauteurDeCadrage(794, 1118), 559);
});
