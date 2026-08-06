/**
 * Tests documentTables — exécution : node --test documentTables.test.mjs
 * Priorité : l'arithmétique du devis (arrondis, TVA, TTC) et la non-mutation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEVISES,
  TAUX_TVA_DEFAUT,
  arrondiComptable,
  parseNombre,
  formaterMontant,
  formaterQuantite,
  formaterTaux,
  creerTableau,
  creerTableauDevis,
  recalculerTotaux,
  changerTauxTva,
  ajouterLigne,
  supprimerLigne,
  compterLignes,
  lireGrille,
  projeter,
  fusionnerPatches,
  signatureSources,
  tableauxChiffres,
  recalculerTousTotaux,
} from './documentTables.js';

const NBSP = ' ';
const clone = (v) => JSON.parse(JSON.stringify(v));
const texteDe = (objets, predicat) => objets.filter(predicat).map((o) => o.content.text);

/* ── Arithmétique ─────────────────────────────────────────────── */

test('arrondiComptable corrige la dérive binaire (1,005 → 1,01)', () => {
  assert.equal(arrondiComptable(1.005, 2), 1.01);
  assert.equal(arrondiComptable(0.225, 2), 0.23);
  assert.equal(arrondiComptable(10.555, 2), 10.56);
  assert.equal(arrondiComptable(0.1 + 0.2, 2), 0.3);
  assert.equal(arrondiComptable(-1.005, 2), -1.01);
  assert.equal(arrondiComptable(1499.5, 0), 1500);
  assert.equal(arrondiComptable('pas un nombre', 2), 0);
});

test('parseNombre lit les saisies humaines', () => {
  assert.equal(parseNombre(`1${NBSP}234,56${NBSP}€`), 1234.56);
  assert.equal(parseNombre('1 234,56 €'), 1234.56);
  assert.equal(parseNombre('1.234,56'), 1234.56);
  assert.equal(parseNombre('1.234'), 1234);
  assert.equal(parseNombre('12.5'), 12.5);
  assert.equal(parseNombre('12,5'), 12.5);
  assert.equal(parseNombre('-3,5'), -3.5);
  assert.equal(parseNombre(''), 0);
  assert.equal(parseNombre('abc'), 0);
  assert.equal(parseNombre(7), 7);
});

test('formaterMontant respecte la devise (2 décimales EUR, 0 en FCFA)', () => {
  assert.equal(formaterMontant(1234.5, 'EUR'), `1${NBSP}234,50${NBSP}€`);
  assert.equal(formaterMontant(1234567.891, 'EUR'), `1${NBSP}234${NBSP}567,89${NBSP}€`);
  assert.equal(formaterMontant(4500, 'XAF'), `4${NBSP}500${NBSP}FCFA`);
  assert.equal(formaterMontant(12, 'USD'), `$${NBSP}12,00`);
  assert.equal(formaterMontant(-3.5, 'EUR'), `-3,50${NBSP}€`);
  assert.equal(DEVISES.XAF.decimales, 0);
});

test('formaterQuantite et formaterTaux suppriment les zéros inutiles', () => {
  assert.equal(formaterQuantite(3), '3');
  assert.equal(formaterQuantite(1.5), '1,5');
  assert.equal(formaterTaux(20), `20${NBSP}%`);
  assert.equal(formaterTaux(5.5), `5,5${NBSP}%`);
});

/* ── Tableau simple ───────────────────────────────────────────── */

test('creerTableau pose une grille cohérente dans la largeur utile', () => {
  const t = creerTableau({
    colonnes: [
      { cle: 'a', titre: 'Article', largeur: 0.6 },
      { cle: 'b', titre: 'Note', largeur: 0.4 },
    ],
    lignes: [{ a: 'Ligne 1', b: 'x' }, { a: 'Ligne 2', b: 'y' }],
  });

  const grille = lireGrille(t.objects);
  assert.ok(grille, 'le cadre porte la grille');
  assert.equal(grille.colonnes.length, 2);
  const somme = grille.colonnes.reduce((s, c) => s + c.px, 0);
  assert.ok(Math.abs(somme - grille.largeur) < 0.001, 'les colonnes remplissent la largeur');

  assert.equal(compterLignes(t.objects), 2);
  const cellules = t.objects.filter((o) => o.meta.role === 'cellule');
  assert.equal(cellules.length, 4);
  assert.deepEqual(texteDe(t.objects, (o) => o.meta.role === 'entete-cellule'), ['Article', 'Note']);

  // Aucun objet ne sort de la page A4 en largeur.
  for (const o of t.objects) {
    assert.ok(o.x >= 0 && o.x + (o.width ?? 0) <= 794.001, `objet hors page: ${o.meta.role}`);
    assert.ok(['text', 'rect', 'line'].includes(o.type), `type non rendu par le moteur: ${o.type}`);
  }
});

/* ── Devis ────────────────────────────────────────────────────── */

const LIGNES_TROIS = [
  { designation: 'Prestation A', quantite: 1.5, prixUnitaire: 0.15 },
  { designation: 'Prestation B', quantite: 1.5, prixUnitaire: 0.15 },
  { designation: 'Prestation C', quantite: 1.5, prixUnitaire: 0.15 },
];

test('devis : somme des lignes ARRONDIES, pas arrondi de la somme brute', () => {
  const d = creerTableauDevis({ lignes: LIGNES_TROIS, tauxTva: 20, devise: 'EUR' });
  // 1,5 × 0,15 = 0,225 → 0,23 par ligne. 3 × 0,23 = 0,69.
  // La somme brute (0,675) arrondie donnerait 0,68 : c'est l'erreur à ne pas faire.
  assert.deepEqual(d.totaux.lignes.map((l) => l.total), [0.23, 0.23, 0.23]);
  assert.equal(d.totaux.totalHT, 0.69);
  assert.notEqual(d.totaux.totalHT, arrondiComptable(0.675, 2));
  assert.equal(d.totaux.tva, 0.14);        // 0,69 × 20 % = 0,138 → 0,14
  assert.equal(d.totaux.totalTTC, 0.83);   // 0,69 + 0,14
  assert.equal(d.totaux.tauxTva, 20);
});

test('devis : les montants affichés sont ceux du calcul', () => {
  const d = creerTableauDevis({ lignes: LIGNES_TROIS, tauxTva: 20, devise: 'EUR' });
  const valeur = (champ) =>
    d.objects.find((o) => o.meta.role === 'total-valeur' && o.meta.champ === champ).content.text;
  assert.equal(valeur('totalHT'), `0,69${NBSP}€`);
  assert.equal(valeur('tva'), `0,14${NBSP}€`);
  assert.equal(valeur('totalTTC'), `0,83${NBSP}€`);

  const libelleTva = d.objects.find((o) => o.meta.role === 'total-libelle' && o.meta.champ === 'tva');
  assert.equal(libelleTva.content.text, `TVA (20${NBSP}%)`);

  const totauxLignes = d.objects
    .filter((o) => o.meta.champ === 'totalLigne' && o.meta.role === 'cellule')
    .map((o) => o.content.text);
  assert.deepEqual(totauxLignes, [`0,23${NBSP}€`, `0,23${NBSP}€`, `0,23${NBSP}€`]);

  const entetes = texteDe(d.objects, (o) => o.meta.role === 'entete-cellule');
  assert.deepEqual(entetes, ['Désignation', 'Qté', 'P.U. HT', 'Total HT']);
});

test('devis en FCFA : aucun centime inventé', () => {
  const d = creerTableauDevis({
    lignes: [{ designation: 'Consultation', quantite: 3, prixUnitaire: 1500 }],
    tauxTva: 18,
    devise: 'XAF',
  });
  assert.equal(d.totaux.totalHT, 4500);
  assert.equal(d.totaux.tva, 810);
  assert.equal(d.totaux.totalTTC, 5310);
  const ttc = d.objects.find((o) => o.meta.role === 'total-valeur' && o.meta.champ === 'totalTTC');
  assert.equal(ttc.content.text, `5${NBSP}310${NBSP}FCFA`);
});

test('devis vierge : lignes vides laissées vides, totaux à zéro', () => {
  const d = creerTableauDevis({ lignesVides: 4 });
  assert.equal(compterLignes(d.objects), 4);
  assert.equal(d.totaux.totalHT, 0);
  assert.equal(d.totaux.tauxTva, TAUX_TVA_DEFAUT);
  const totauxLignes = d.objects
    .filter((o) => o.meta.champ === 'totalLigne' && o.meta.role === 'cellule')
    .map((o) => o.content.text);
  assert.deepEqual(totauxLignes, ['', '', '', '']);
});

test('recalculerTotaux ne mute rien et est idempotent', () => {
  const d = creerTableauDevis({ lignes: LIGNES_TROIS });
  const avant = clone(d.objects);
  const res = recalculerTotaux(d.objects);
  assert.deepEqual(clone(d.objects), avant, 'les objets d\'entrée sont intacts');
  assert.equal(res.patches.length, 0, 'un état déjà juste ne produit aucun patch');
});

test('la saisie utilisateur pilote le calcul (quantité corrigée sur le canevas)', () => {
  const d = creerTableauDevis({
    lignes: [{ designation: 'A', quantite: 2, prixUnitaire: 10 }],
    tauxTva: 20,
  });
  const cellQte = d.objects.find((o) => o.meta.role === 'cellule' && o.meta.champ === 'quantite');
  const modifie = d.objects.map((o) => (o.id === cellQte.id ? { ...o, content: { text: '5' } } : o));

  const res = recalculerTotaux(modifie);
  assert.equal(res.totaux.totalHT, 50);
  assert.equal(res.totaux.tva, 10);
  assert.equal(res.totaux.totalTTC, 60);

  const applique = projeter(modifie, { patches: res.patches });
  const ttc = applique.find((o) => o.meta?.role === 'total-valeur' && o.meta.champ === 'totalTTC');
  assert.equal(ttc.content.text, `60,00${NBSP}€`);
});

test('le taux tapé dans le libellé prime sur meta.taux', () => {
  const d = creerTableauDevis({ lignes: [{ designation: 'A', quantite: 1, prixUnitaire: 100 }], tauxTva: 20 });
  const label = d.objects.find((o) => o.meta.role === 'total-libelle' && o.meta.champ === 'tva');
  const modifie = d.objects.map((o) =>
    o.id === label.id ? { ...o, content: { text: `TVA (18${NBSP}%)` } } : o,
  );
  const res = recalculerTotaux(modifie);
  assert.equal(res.totaux.tauxTva, 18);
  assert.equal(res.totaux.tva, 18);
  assert.equal(res.totaux.totalTTC, 118);
  const patchMeta = res.patches.find((p) => p.id === label.id);
  assert.equal(patchMeta.patch.meta.taux, 18, 'meta.taux est réaligné sur le libellé');
});

test('changerTauxTva réécrit le libellé et les totaux', () => {
  const d = creerTableauDevis({ lignes: [{ designation: 'A', quantite: 1, prixUnitaire: 200 }], tauxTva: 20 });
  const res = changerTauxTva(d.objects, 5.5);
  const applique = projeter(d.objects, res);
  const label = applique.find((o) => o.meta?.role === 'total-libelle' && o.meta.champ === 'tva');
  assert.equal(label.content.text, `TVA (5,5${NBSP}%)`);
  assert.equal(res.totaux.tva, 11);
  assert.equal(res.totaux.totalTTC, 211);
});

/* ── Ajout / suppression de ligne ─────────────────────────────── */

test('ajouterLigne décale la suite, agrandit le cadre et recalcule', () => {
  const d = creerTableauDevis({
    lignes: [
      { designation: 'A', quantite: 1, prixUnitaire: 100 },
      { designation: 'B', quantite: 1, prixUnitaire: 50 },
    ],
    tauxTva: 20,
  });
  const grille = lireGrille(d.objects);
  const cadreAvant = d.objects.find((o) => o.meta.role === 'cadre');
  const ttcAvant = d.objects.find((o) => o.meta.role === 'total-valeur' && o.meta.champ === 'totalTTC');
  const avant = clone(d.objects);

  const res = ajouterLigne(d.objects, {
    index: 1,
    valeurs: { designation: 'C', quantite: '2', prixUnitaire: `25,00${NBSP}€` },
  });
  assert.deepEqual(clone(d.objects), avant, 'ajouterLigne ne mute pas l\'entrée');

  const apres = projeter(d.objects, res);
  assert.equal(compterLignes(apres), 3);

  const cadre = apres.find((o) => o.id === cadreAvant.id);
  assert.equal(cadre.height, cadreAvant.height + grille.hauteurLigne);

  const ttc = apres.find((o) => o.id === ttcAvant.id);
  assert.equal(ttc.y, ttcAvant.y + grille.hauteurLigne, 'le bloc de totaux descend');

  const designations = apres
    .filter((o) => o.meta?.role === 'cellule' && o.meta.champ === 'designation')
    .sort((a, b) => a.meta.ligne - b.meta.ligne)
    .map((o) => o.content.text);
  assert.deepEqual(designations, ['A', 'C', 'B']);

  assert.equal(res.totaux.totalHT, 200);   // 100 + 50 + 50
  assert.equal(res.totaux.tva, 40);
  assert.equal(res.totaux.totalTTC, 240);
  assert.equal(recalculerTotaux(apres).patches.length, 0, 'état projeté déjà cohérent');
});

test('supprimerLigne retire les objets de la ligne et recalcule', () => {
  const d = creerTableauDevis({
    lignes: [
      { designation: 'A', quantite: 1, prixUnitaire: 100 },
      { designation: 'B', quantite: 1, prixUnitaire: 50 },
      { designation: 'C', quantite: 1, prixUnitaire: 25 },
    ],
    tauxTva: 20,
  });
  const avant = clone(d.objects);
  const res = supprimerLigne(d.objects, 1);
  assert.deepEqual(clone(d.objects), avant, 'supprimerLigne ne mute pas l\'entrée');
  assert.ok(res.suppressions.length >= 5, 'fond + 4 cellules + filet');

  const apres = projeter(d.objects, res);
  assert.equal(compterLignes(apres), 2);
  const designations = apres
    .filter((o) => o.meta?.role === 'cellule' && o.meta.champ === 'designation')
    .sort((a, b) => a.meta.ligne - b.meta.ligne)
    .map((o) => o.content.text);
  assert.deepEqual(designations, ['A', 'C']);
  assert.equal(res.totaux.totalHT, 125);
  assert.equal(res.totaux.totalTTC, 150);
});

test('supprimerLigne refuse un index hors bornes', () => {
  const d = creerTableauDevis({ lignes: [{ designation: 'A', quantite: 1, prixUnitaire: 10 }] });
  const res = supprimerLigne(d.objects, 9);
  assert.deepEqual(res.suppressions, []);
  assert.deepEqual(res.patches, []);
});

/* ── Utilitaires de patch ─────────────────────────────────────── */

test('fusionnerPatches fusionne en profondeur par id', () => {
  const out = fusionnerPatches(
    [{ id: 'x', patch: { y: 10, meta: { ligne: 1 } } }],
    [{ id: 'x', patch: { meta: { ligne: 2 } } }, { id: 'z', patch: { y: 5 } }],
  );
  assert.deepEqual(out, [
    { id: 'x', patch: { y: 10, meta: { ligne: 2 } } },
    { id: 'z', patch: { y: 5 } },
  ]);
});


/* ── Observation des sources : socle du recalcul automatique ───── */

test("l'empreinte des sources ignore les cellules CALCULÉES (anti-boucle)", () => {
  const d = creerTableauDevis({ lignes: [{ designation: 'A', quantite: 2, prixUnitaire: 10 }], tauxTva: 20 });
  const avant = signatureSources(d.objects, d.tableId);

  // Réécrire TOUTES les cellules calculées ne doit RIEN changer à l'empreinte,
  // sinon le recalcul se redéclencherait sur son propre patch — boucle infinie.
  const calculees = d.objects.filter(
    (o) => o.meta?.role === 'total-valeur' || (o.meta?.role === 'cellule' && o.meta?.champ === 'totalLigne'),
  );
  assert.ok(calculees.length >= 4, 'le devis a bien des cellules calculées');
  const bidon = projeter(d.objects, {
    patches: calculees.map((o) => ({ id: o.id, patch: { content: { text: 'XXX' } } })),
  });
  assert.equal(signatureSources(bidon, d.tableId), avant, "l'empreinte n'a pas bougé");

  // Une VRAIE saisie, elle, change l'empreinte.
  const q = d.objects.find((o) => o.meta?.role === 'cellule' && o.meta?.champ === 'quantite');
  const saisi = projeter(d.objects, { patches: [{ id: q.id, patch: { content: { text: '3' } } }] });
  assert.notEqual(signatureSources(saisi, d.tableId), avant);
});

test('recalculerTousTotaux atteint un point fixe en une passe', () => {
  const d = creerTableauDevis({ lignesVides: 2, tauxTva: 20 });
  const q = d.objects.find((o) => o.meta?.role === 'cellule' && o.meta?.ligne === 0 && o.meta?.champ === 'quantite');
  const pu = d.objects.find((o) => o.meta?.role === 'cellule' && o.meta?.ligne === 0 && o.meta?.champ === 'prixUnitaire');
  const saisi = projeter(d.objects, {
    patches: [
      { id: q.id, patch: { content: { text: '32' } } },
      { id: pu.id, patch: { content: { text: '12,80' } } },
    ],
  });

  const un = recalculerTousTotaux(saisi);
  assert.ok(un.patches.length > 0, 'la saisie appelle un recalcul');
  const apres = projeter(saisi, { patches: un.patches });
  assert.equal(recalculerTousTotaux(apres).patches.length, 0, 'la seconde passe ne trouve plus rien');

  const ttc = apres.find((o) => o.meta?.role === 'total-valeur' && o.meta?.champ === 'totalTTC');
  assert.match(ttc.content.text, /491,52/);
});

test('tableauxChiffres ne retient que les tableaux à totaux', () => {
  const simple = creerTableau({ colonnes: ['A', 'B'], lignes: [[]] });
  const devis = creerTableauDevis({ lignesVides: 1 });
  const scene = [...simple.objects, ...devis.objects];
  assert.deepEqual(tableauxChiffres(scene), [devis.tableId]);
  assert.deepEqual(tableauxChiffres(simple.objects), []);
  assert.equal(signatureSources(simple.objects, simple.tableId).includes('tva'), false);
});
