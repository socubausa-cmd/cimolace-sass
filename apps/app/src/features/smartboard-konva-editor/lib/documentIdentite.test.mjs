/**
 * Tests documentIdentite — exécution : node --test documentIdentite.test.mjs
 *
 * Priorité : ce qui ferait perdre du travail ou imprimer un faux — l'identité vierge
 * (aucune donnée inventée), la pose sur page vide, la pose sur page OCCUPÉE sans
 * écrasement, et la numérotation sur plusieurs pages.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  identiteVide,
  normaliserIdentite,
  couleurValide,
  resumeIdentite,
  identiteEstVide,
  normaliserCollection,
  listerIdentites,
  identiteActive,
  enregistrerIdentite,
  supprimerIdentite,
  definirIdentiteActive,
  texteEnTete,
  textePied,
  bandesIdentite,
  appliquerIdentite,
  apercuIdentite,
  identitePosee,
  retirerIdentite,
  DISPOSITIONS_ENTETE,
  HAUTEUR_LOGO_MAX,
} from './documentIdentite.js';
import { FORMATS_PAGE, MARGES_DEFAUT, estEntetePied } from './documentPagination.js';

const A4 = FORMATS_PAGE.a4_portrait;
const bloc = (id, y, height = 200) => ({
  id, type: 'text', x: 52, y, width: 690, height, content: { text: id },
});

/** Identité de test — champs remplis EXPRÈS par le test, jamais par le module. */
function identiteTest(extra = {}) {
  return normaliserIdentite({
    id: 'idn_test',
    libelle: 'Entité de test',
    raisonSociale: 'Société de test',
    entete: { texte: 'Direction générale', disposition: 'logo-gauche' },
    coordonnees: { adresse: '1 rue du Test', telephone: '+000', courriel: 't@test', site: 'test' },
    pied: { mentions: 'Mentions de test', numerotation: true },
    signature: { nom: 'Nom Test', fonction: 'Fonction test' },
    ...extra,
  });
}

/* ── Modèle de données : rien n'est inventé ─────────────────────── */

test('identiteVide() ne porte AUCUNE donnée d’entreprise', () => {
  const v = identiteVide();
  assert.equal(v.raisonSociale, '');
  assert.equal(v.logo.src, '');
  assert.equal(v.coordonnees.adresse, '');
  assert.equal(v.coordonnees.telephone, '');
  assert.equal(v.coordonnees.courriel, '');
  assert.equal(v.coordonnees.site, '');
  assert.equal(v.pied.mentions, '');
  assert.equal(v.signature.nom, '');
  assert.equal(v.signature.image.src, '');
  assert.equal(v.palette.primaire, '');
  assert.equal(v.polices.corps, '');
  assert.equal(identiteEstVide(v), true);
  assert.equal(resumeIdentite(v).remplis, 0);
});

test('normaliserIdentite ne comble aucun champ de contenu', () => {
  const n = normaliserIdentite({ raisonSociale: '  Orabank  ' });
  assert.equal(n.raisonSociale, 'Orabank');
  assert.equal(n.coordonnees.telephone, '');
  assert.equal(n.pied.mentions, '');
  assert.equal(n.signature.nom, '');
});

test('normaliserIdentite borne les géométries et valide les couleurs', () => {
  const n = normaliserIdentite({
    logo: { hauteur: 9999 },
    palette: { primaire: '#a12', secondaire: 'rouge', accent: '#AABBCC' },
    entete: { disposition: 'n’importe quoi' },
  });
  assert.equal(n.logo.hauteur, HAUTEUR_LOGO_MAX);
  assert.equal(n.palette.primaire, '#a12');
  assert.equal(n.palette.secondaire, '', 'une couleur non hexadécimale est refusée, pas devinée');
  assert.equal(n.palette.accent, '#AABBCC');
  assert.equal(n.entete.disposition, DISPOSITIONS_ENTETE[0].id);
  assert.equal(couleurValide('#fff'), '#fff');
  assert.equal(couleurValide('#ff'), '');
});

/* ── Collection : plusieurs identités, une active ───────────────── */

test('enregistrerIdentite crée, rend active la première, puis remplace', () => {
  let c = normaliserCollection(null);
  assert.deepEqual(c, { identites: [], actifId: null });
  assert.equal(identiteActive(c), null);

  c = enregistrerIdentite(c, { libelle: 'A', raisonSociale: 'A SA' }, '2026-08-06T10:00:00Z');
  assert.equal(c.identites.length, 1);
  assert.equal(c.actifId, c.identites[0].id);
  const idA = c.identites[0].id;

  c = enregistrerIdentite(c, { libelle: 'B' }, '2026-08-06T11:00:00Z');
  assert.equal(c.identites.length, 2);
  assert.equal(c.actifId, idA, 'la seconde identité ne vole pas l’activation');

  c = enregistrerIdentite(c, { ...c.identites[0], raisonSociale: 'A SARL' }, '2026-08-06T12:00:00Z');
  assert.equal(c.identites.length, 2, 'un id existant remplace, il ne duplique pas');
  assert.equal(c.identites[0].raisonSociale, 'A SARL');
  assert.equal(c.identites[0].creeLe, '2026-08-06T10:00:00Z', 'la date de création est conservée');
  assert.equal(c.identites[0].majLe, '2026-08-06T12:00:00Z');

  assert.equal(listerIdentites(c)[0].id, c.identites[0].id, 'la plus récemment modifiée en tête');
});

test('definirIdentiteActive ignore un id inconnu ; supprimerIdentite rebascule', () => {
  let c = enregistrerIdentite(normaliserCollection(null), { libelle: 'A' }, '2026-01-01T00:00:00Z');
  c = enregistrerIdentite(c, { libelle: 'B' }, '2026-01-02T00:00:00Z');
  const [a, b] = c.identites;

  const inchange = definirIdentiteActive(c, 'fantome');
  assert.equal(inchange.actifId, a.id);

  c = definirIdentiteActive(c, b.id);
  assert.equal(c.actifId, b.id);

  c = supprimerIdentite(c, b.id);
  assert.equal(c.identites.length, 1);
  assert.equal(c.actifId, a.id, 'la suppression de l’active rebascule sur une restante');

  c = supprimerIdentite(c, a.id);
  assert.equal(c.actifId, null);
});

/* ── Textes des bandes ─────────────────────────────────────────── */

test('texteEnTete / textePied ne posent pas de séparateur pour un champ absent', () => {
  const i = normaliserIdentite({
    raisonSociale: 'Société de test',
    coordonnees: { telephone: '+241 00 00 00' },
  });
  assert.equal(texteEnTete(i), 'Société de test');
  assert.equal(textePied(i), '+241 00 00 00');
  assert.ok(!textePied(i).includes('·'), 'aucun séparateur orphelin');
  assert.equal(textePied(identiteVide()), '', 'une identité vide ne produit aucun pied');
  assert.equal(texteEnTete(identiteVide()), '');
});

/* ── Pose sur page VIDE ────────────────────────────────────────── */

test('appliquerIdentite sur document vide : bandes posées, aucun patch', () => {
  const res = appliquerIdentite({ identite: identiteTest(), objets: [], page: { nbPages: 1 } });
  assert.equal(res.patches.length, 0, 'rien à pousser : le document est vide');
  assert.equal(res.suppressions.length, 0);
  assert.ok(res.ajouts.length >= 3, `attendu ≥3 objets, obtenu ${res.ajouts.length}`);

  const roles = res.ajouts.map((o) => o.meta.role);
  assert.ok(roles.includes('entete'));
  assert.ok(roles.includes('pied'));
  assert.ok(roles.includes('numero'));
  assert.equal(res.signaturePlacee, true);
  assert.ok(roles.includes('signature'));

  for (const o of res.ajouts) {
    assert.equal(o.meta.identite, 'idn_test', 'tout objet posé est traçable');
    assert.ok(o.y >= 0 && o.y + o.height <= A4.hauteur, `objet hors page: ${o.meta.role} y=${o.y}`);
  }
});

test('les bandes sont des objets en-tête/pied (donc réservées et remplaçables)', () => {
  const { bandes } = bandesIdentite({ identite: identiteTest(), nbPages: 1 });
  assert.ok(bandes.length > 0);
  for (const b of bandes) assert.equal(estEntetePied(b), true);
});

test('sans logo, aucune image n’est posée (rien ne s’annonce qui n’existe)', () => {
  const { bandes } = bandesIdentite({ identite: identiteTest(), nbPages: 1 });
  assert.equal(bandes.filter((o) => o.type === 'image').length, 0);
});

test('logo mesuré : rapport conservé ; logo non mesuré : carré, signalé', () => {
  const mesure = identiteTest({
    logo: { src: 'uid/logo.png', largeurNative: 600, hauteurNative: 200, hauteur: 40 },
  });
  const a = bandesIdentite({ identite: mesure, nbPages: 1 });
  const img = a.bandes.find((o) => o.type === 'image');
  assert.ok(img, 'le logo est posé');
  assert.equal(a.logoMesure, true);
  const ecart = Math.abs(img.width / img.height - 3) / 3 * 100;
  assert.ok(ecart < 1, `déformation ${ecart.toFixed(2)} % > 1 %`);

  const brut = identiteTest({ logo: { src: 'uid/logo.png', hauteur: 40 } });
  const b = bandesIdentite({ identite: brut, nbPages: 1 });
  const img2 = b.bandes.find((o) => o.type === 'image');
  assert.equal(b.logoMesure, false, 'le module DIT qu’il n’a pas mesuré');
  assert.equal(img2.width, img2.height, 'faute de mesure : carré, aucun rapport inventé');
});

test('disposition « texte-seul » ne pose pas le logo même s’il existe', () => {
  const i = identiteTest({
    entete: { texte: '', disposition: 'texte-seul' },
    logo: { src: 'uid/logo.png', largeurNative: 100, hauteurNative: 100 },
  });
  const { bandes } = bandesIdentite({ identite: i, nbPages: 1 });
  assert.equal(bandes.filter((o) => o.type === 'image').length, 0);
});

test('logo à gauche : le texte d’en-tête ne le recouvre pas', () => {
  const i = identiteTest({ logo: { src: 'uid/logo.png', largeurNative: 300, hauteurNative: 150, hauteur: 40 } });
  const { bandes } = bandesIdentite({ identite: i, nbPages: 1 });
  const logo = bandes.find((o) => o.type === 'image');
  const entete = bandes.find((o) => o.meta.role === 'entete');
  assert.ok(entete.x >= logo.x + logo.width, `texte à x=${entete.x}, logo finit à ${logo.x + logo.width}`);
  assert.ok(entete.x + entete.width <= A4.largeur - MARGES_DEFAUT.gauche + 1);
});

test('logo centré : le texte d’en-tête passe SOUS le logo', () => {
  const i = identiteTest({
    entete: { texte: 'Direction générale', disposition: 'logo-centre' },
    logo: { src: 'uid/logo.png', largeurNative: 200, hauteurNative: 200, hauteur: 40 },
  });
  const { bandes } = bandesIdentite({ identite: i, nbPages: 1 });
  const logo = bandes.find((o) => o.type === 'image');
  const entete = bandes.find((o) => o.meta.role === 'entete');
  assert.ok(entete.y >= logo.y + logo.height, `texte à y=${entete.y}, logo finit à ${logo.y + logo.height}`);
});

/* ── Pose sur page OCCUPÉE : rien n’est écrasé ─────────────────── */

test('page occupée : le corps DESCEND sous l’en-tête, rien n’est supprimé', () => {
  const objets = [bloc('b1', MARGES_DEFAUT.haut, 120), bloc('b2', MARGES_DEFAUT.haut + 140, 120)];
  const avant = JSON.parse(JSON.stringify(objets));
  const res = appliquerIdentite({ identite: identiteTest(), objets, page: { nbPages: 1 } });

  assert.deepEqual(objets, avant, 'appliquerIdentite ne mute pas ses entrées');
  assert.equal(res.suppressions.length, 0, 'aucun bloc de contenu supprimé');
  assert.equal(res.patches.length, 2, 'les deux blocs sont poussés');

  const bandeEntete = res.ajouts.find((o) => o.meta.role === 'entete');
  const basBande = bandeEntete.y + bandeEntete.height;
  for (const p of res.patches) {
    assert.ok(p.patch.y >= basBande, `bloc à y=${p.patch.y} reste sous la bande (${basBande})`);
  }
  const decalage = res.patches.map((p) => p.patch.y - objets.find((o) => o.id === p.id).y);
  assert.equal(new Set(decalage).size, 1, 'décalage UNIFORME : l’espacement voulu est conservé');
});

test('page pleine : rien ne bouge et la page est signalée (aucun dégât silencieux)', () => {
  // ⚠️ Trois blocs plutôt qu'un seul très haut : `patchesReserveBandes` traite tout
  // bloc de plus de 60 % de la page comme un FOND et ne le pousse jamais — un unique
  // bloc de 1041 px ne prouverait donc rien.
  const objets = [bloc('b1', MARGES_DEFAUT.haut, 300), bloc('b2', 380, 300), bloc('b3', 690, 420)];
  const res = appliquerIdentite({ identite: identiteTest(), objets, page: { nbPages: 1 } });
  assert.equal(res.patches.length, 0, 'aucun déplacement quand la place manque');
  assert.deepEqual(res.pagesBloquees, [1], 'la page pleine est DITE');
});

test('réappliquer remplace ses propres bandes au lieu de les empiler', () => {
  const premier = appliquerIdentite({ identite: identiteTest(), objets: [], page: { nbPages: 1 } });
  const scene = [bloc('corps', 400, 100), ...premier.ajouts];
  const second = appliquerIdentite({ identite: identiteTest(), objets: scene, page: { nbPages: 1 } });

  const aRemplacer = new Set(second.suppressions);
  for (const o of premier.ajouts) {
    assert.ok(aRemplacer.has(o.id), `l’objet ${o.meta.role} précédent doit être remplacé`);
  }
  assert.ok(!aRemplacer.has('corps'), 'le contenu de l’utilisateur n’est jamais supprimé');
  const survivants = scene.filter((o) => !aRemplacer.has(o.id)).length + second.ajouts.length;
  assert.equal(survivants, 1 + second.ajouts.length, 'aucune pile de bandes en double');
});

test('signature : posée sous le contenu ; refusée (avec raison) si la page est pleine', () => {
  const res = appliquerIdentite({
    identite: identiteTest(),
    objets: [bloc('b1', MARGES_DEFAUT.haut, 200)],
    page: { nbPages: 1 },
  });
  const sign = res.ajouts.find((o) => o.meta.role === 'signature');
  assert.ok(sign, 'signature posée');
  assert.equal(res.signaturePlacee, true);
  assert.ok(sign.y > MARGES_DEFAUT.haut + 200, 'la signature est SOUS le contenu');

  const pleine = appliquerIdentite({
    identite: identiteTest(),
    objets: [bloc('b1', MARGES_DEFAUT.haut, 600), bloc('b2', 690, 300)],
    page: { nbPages: 1 },
  });
  assert.equal(pleine.signaturePlacee, false);
  assert.match(pleine.raisonSignature, /pleine/);
  assert.equal(pleine.ajouts.some((o) => o.meta.role === 'signature'), false, 'rien hors page');

  const sansSignataire = appliquerIdentite({
    identite: identiteTest({ signature: { nom: '', fonction: '', mention: '' } }),
    objets: [],
    page: { nbPages: 1 },
  });
  assert.equal(sansSignataire.signaturePlacee, false);
  assert.match(sansSignataire.raisonSignature, /aucun champ/);
});

/* ── Numérotation multi-pages ──────────────────────────────────── */

test('numérotation multi-pages : un numéro par page, jetons substitués', () => {
  const res = appliquerIdentite({ identite: identiteTest(), objets: [], page: { nbPages: 3 } });
  const numeros = res.ajouts.filter((o) => o.meta.role === 'numero');
  assert.equal(numeros.length, 3);
  assert.deepEqual(numeros.map((o) => o.content.text), ['Page 1 / 3', 'Page 2 / 3', 'Page 3 / 3']);

  const entetes = res.ajouts.filter((o) => o.meta.role === 'entete');
  assert.equal(entetes.length, 3, 'l’en-tête couvre TOUTES les pages');
  entetes.forEach((o, k) => {
    const yLocal = o.y - k * A4.hauteur;
    assert.ok(yLocal >= MARGES_DEFAUT.haut - 1 && yLocal < A4.hauteur / 2, `en-tête page ${k} mal placé (${yLocal})`);
  });

  const pieds = res.ajouts.filter((o) => o.meta.role === 'pied');
  assert.equal(pieds.length, 3);
  const sign = res.ajouts.find((o) => o.meta.role === 'signature');
  assert.ok(sign.y > 2 * A4.hauteur, 'la signature est sur la DERNIÈRE page');
});

test('numérotation « sauter la première » ne pose rien sur la page 1', () => {
  const i = identiteTest({ pied: { mentions: '', numerotation: true, sauterPremiere: true } });
  const res = appliquerIdentite({ identite: i, objets: [], page: { nbPages: 2 } });
  const numeros = res.ajouts.filter((o) => o.meta.role === 'numero');
  assert.equal(numeros.length, 1);
  assert.deepEqual(numeros.map((o) => o.content.text), ['Page 2 / 2']);
});

test('numérotation désactivée : aucun numéro', () => {
  const i = identiteTest({ pied: { mentions: 'Mentions de test', numerotation: false } });
  const res = appliquerIdentite({ identite: i, objets: [], page: { nbPages: 2 } });
  assert.equal(res.ajouts.filter((o) => o.meta.role === 'numero').length, 0);
});

test('format paysage : les bandes suivent la largeur de page', () => {
  const res = appliquerIdentite({
    identite: identiteTest(),
    objets: [],
    page: { nbPages: 1, format: 'a4_paysage' },
  });
  const entete = res.ajouts.find((o) => o.meta.role === 'entete');
  assert.equal(entete.width, FORMATS_PAGE.a4_paysage.largeur - MARGES_DEFAUT.gauche - MARGES_DEFAUT.droite);
});

/* ── État de la pose / retrait ─────────────────────────────────── */

test('identitePosee détecte un logo qui ne couvre plus toutes les pages', () => {
  const i = identiteTest({ logo: { src: 'uid/logo.png', largeurNative: 200, hauteurNative: 100, hauteur: 40 } });
  const res = appliquerIdentite({ identite: i, objets: [], page: { nbPages: 2 } });
  const etat = identitePosee(res.ajouts, 2);
  assert.equal(etat.posee, true);
  assert.equal(etat.identiteId, 'idn_test');
  assert.deepEqual(etat.pagesLogo, [0, 1]);
  assert.equal(etat.logoManquant, false);
  assert.equal(etat.aSignature, true);

  const ampute = res.ajouts.filter((o) => !(o.meta.role === 'logo' && o.meta.page === 1));
  assert.equal(identitePosee(ampute, 2).logoManquant, true);
  assert.equal(identitePosee([], 2).posee, false);
});

test('retirerIdentite ne rend que SES objets', () => {
  const res = appliquerIdentite({ identite: identiteTest(), objets: [], page: { nbPages: 1 } });
  const scene = [bloc('corps', 500, 80), ...res.ajouts];
  const { suppressions } = retirerIdentite(scene);
  assert.equal(suppressions.length, res.ajouts.length);
  assert.ok(!suppressions.includes('corps'));
});

test('apercuIdentite rend les mêmes bandes que la pose réelle', () => {
  const i = identiteTest();
  const ap = apercuIdentite({ identite: i });
  const pose = appliquerIdentite({ identite: i, objets: [], page: { nbPages: 1 } });
  const roles = (l) => l.map((o) => o.meta.role).sort();
  assert.deepEqual(roles(ap.objets), roles(pose.ajouts));
  assert.equal(ap.format.largeur, A4.largeur);
});

test('identité vide : aucune bande de contenu, aucun cadre fantôme', () => {
  const res = appliquerIdentite({ identite: identiteVide(), objets: [bloc('b1', 100, 50)], page: { nbPages: 1 } });
  const roles = res.ajouts.map((o) => o.meta.role);
  assert.equal(roles.includes('entete'), false);
  assert.equal(roles.includes('pied'), false);
  assert.equal(roles.includes('logo'), false);
  assert.equal(res.signaturePlacee, false);
  // Seule la numérotation subsiste : c'est un INTERRUPTEUR de mise en page, pas une
  // donnée d'entreprise. Le panneau interdit d'appliquer une identité vide
  // (`identiteEstVide`), ce cas n'arrive donc que par appel direct.
  assert.deepEqual(roles, ['numero']);
  assert.equal(res.patches.length, 0, 'un simple numéro de page ne déplace rien');
});

test('le logo TRANSMET ses dimensions natives (sinon le canevas le rend carré)', () => {
  /* ⛔ RÉGRESSION MESURÉE EN NAVIGATEUR : `adapterImagesAuCanevas` remplace la boîte
     par un carré neutre pour toute image dont `content.natif` est absent. Le logo
     675 × 900 ressortait en 48 × 48 sur la page, déformé. Ce test verrouille le seul
     champ qui empêche cette perte de rapport. */
  const i = identiteTest({
    logo: { src: 'uid/logo.png', largeurNative: 675, hauteurNative: 900, hauteur: 44 },
  });
  const { bandes } = bandesIdentite({ identite: i, nbPages: 1 });
  const img = bandes.find((o) => o.meta?.role === 'logo');
  assert.deepEqual(img.content.natif, { largeurNative: 675, hauteurNative: 900 });

  // Sans mesure : aucune dimension native n'est inventée.
  const sansMesure = identiteTest({ logo: { src: 'uid/logo.png', hauteur: 44 } });
  const b2 = bandesIdentite({ identite: sansMesure, nbPages: 1 });
  assert.equal(b2.bandes.find((o) => o.meta?.role === 'logo').content.natif, undefined);
});

test('l’image de signature transmet aussi sa mesure native', () => {
  const i = identiteTest({
    signature: {
      nom: 'A', fonction: '', mention: '',
      image: { src: 'uid/sign.png', largeurNative: 400, hauteurNative: 120, hauteur: 52 },
    },
  });
  const plan = appliquerIdentite({ identite: i, objets: [], page: { nbPages: 1 } });
  const img = plan.ajouts.find((o) => o.type === 'image' && o.meta?.role === 'signature');
  assert.deepEqual(img.content.natif, { largeurNative: 400, hauteurNative: 120 });
});

/* ── [SIG-2] La signature voyage AVEC l'identité ─────────────────── */

test('[SIG-2] la signature tracée survit à l’enregistrement puis à la relecture', () => {
  const traits = [[0, 40, 10, 10, 30, 60, 50, 12], [12, 62, 68, 58]];
  const i = identiteTest({ signature: { voie: 'tracee', tracee: { traits }, nom: 'A. B.' } });
  const c1 = enregistrerIdentite({ identites: [], actifId: null }, i, '2026-08-06T00:00:00.000Z');
  // Aller-retour par le stockage : c'est ce que fait localStorage.
  const relue = normaliserCollection(JSON.parse(JSON.stringify(c1)));
  const active = identiteActive(relue);
  assert.equal(active.signature.voie, 'tracee');
  assert.equal(active.signature.tracee.traits.length, 2);
  assert.deepEqual(active.signature.tracee.traits[0], traits[0]);
});

test('[SIG-2] la même identité repose la même signature sur DEUX documents', () => {
  const traits = [[0, 40, 10, 10, 30, 60, 50, 12]];
  const i = identiteTest({ signature: { voie: 'tracee', tracee: { traits }, nom: 'A. B.' } });
  const page = { format: 'a4_portrait', marges: MARGES_DEFAUT, nbPages: 1 };
  const a = appliquerIdentite({ identite: i, objets: [], page });
  const b = appliquerIdentite({ identite: i, objets: [bloc('corps', MARGES_DEFAUT.haut, 120)], page });
  const traitsA = a.ajouts.filter((o) => o.type === 'line' && o.meta?.role === 'signature');
  const traitsB = b.ajouts.filter((o) => o.type === 'line' && o.meta?.role === 'signature');
  assert.equal(traitsA.length, 1);
  assert.equal(traitsB.length, 1);
  assert.deepEqual(traitsA[0].content.points, traitsB[0].content.points, 'même dessin');
  assert.notEqual(traitsA[0].id, traitsB[0].id, 'ids distincts (deux documents)');
});

test('[SIG-2] retirerIdentite reprend AUSSI les traits de la signature', () => {
  const traits = [[0, 40, 10, 10, 30, 60, 50, 12], [12, 62, 68, 58]];
  const i = identiteTest({ signature: { voie: 'tracee', tracee: { traits }, nom: 'A. B.' } });
  const res = appliquerIdentite({ identite: i, objets: [], page: { format: 'a4_portrait', marges: MARGES_DEFAUT, nbPages: 1 } });
  const scene = [bloc('corps', 400, 60), ...res.ajouts];
  const { suppressions } = retirerIdentite(scene);
  for (const o of res.ajouts.filter((x) => x.meta?.role === 'signature')) {
    assert.ok(suppressions.includes(o.id), `trait ${o.id} non repris`);
  }
  assert.equal(suppressions.includes('corps'), false);
});
