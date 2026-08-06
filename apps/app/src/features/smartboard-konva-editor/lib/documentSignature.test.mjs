/**
 * Tests documentSignature — exécution : node --test documentSignature.test.mjs
 *
 * Priorité : ce qui ferait poser une fausse signature ou perdre le travail de
 * l'utilisateur — les TROIS voies, le refus NOMMÉ quand un champ manque, les
 * dimensions natives transmises (sinon le canevas impose un carré), le hors-page,
 * et la reprise sans perte des identités enregistrées avant les trois voies.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VOIES_SIGNATURE,
  VOIE_TRACEE,
  VOIE_TELEVERSEE,
  VOIE_DACTYLO,
  ROLE_SIGNATURE,
  POLICES_MANUSCRITES,
  ANCRAGES_SIGNATURE,
  HAUTEUR_SIGNATURE_DEFAUT,
  signatureVide,
  normaliserSignature,
  signaturePrete,
  resumeSignature,
  avertissementsSignature,
  blocRenseigne,
  lignesBloc,
  pointsPlats,
  lisserTrait,
  boiteDesTraits,
  tracesEnObjets,
  detourerFondClair,
  objetsDeSignature,
  appliquerSignature,
  signaturePosee,
  retirerSignature,
  idsSignaturesPosees,
} from './documentSignature.js';
import { normaliserIdentite, appliquerIdentite, identiteVide } from './documentIdentite.js';
import { FORMATS_PAGE, MARGES_DEFAUT } from './documentPagination.js';

const A4 = FORMATS_PAGE.a4_portrait;

/** Un paraphe de test : deux traits, coordonnées écrites PAR LE TEST. */
const TRAITS = [
  [0, 40, 10, 10, 30, 60, 50, 12, 70, 55],
  [12, 62, 68, 58],
];

const sigTracee = (extra = {}) => normaliserSignature({
  voie: VOIE_TRACEE,
  tracee: { traits: TRAITS },
  ...extra,
});

/* ═══ Modèle : rien n'est inventé, rien n'est deviné ═══════════════ */

test('signatureVide() : aucune voie, aucun nom, aucune date', () => {
  const v = signatureVide();
  assert.equal(v.voie, '', 'aucune voie choisie à la place de l’utilisateur');
  assert.equal(v.nom, '');
  assert.equal(v.fonction, '');
  assert.equal(v.mention, '');
  assert.equal(v.date, '');
  assert.equal(v.afficherDate, false);
  assert.equal(v.image.src, '');
  assert.equal(v.dactylographiee.texte, '');
  assert.equal(v.dactylographiee.police, '', 'aucune police manuscrite imposée');
  assert.deepEqual(v.tracee.traits, []);
});

test('normaliserSignature refuse une voie inconnue au lieu d’en choisir une', () => {
  const n = normaliserSignature({ voie: 'nfc', nom: 'X' });
  assert.equal(n.voie, '');
});

test('normaliserSignature refuse une police manuscrite hors liste', () => {
  const n = normaliserSignature({ voie: VOIE_DACTYLO, dactylographiee: { texte: 'X', police: 'Comic Fantasy' } });
  assert.equal(n.dactylographiee.police, '');
  const ok = normaliserSignature({ dactylographiee: { police: POLICES_MANUSCRITES[1].valeur } });
  assert.equal(ok.dactylographiee.police, POLICES_MANUSCRITES[1].valeur);
});

test('les trois voies annoncées existent et sont les seules', () => {
  assert.deepEqual(VOIES_SIGNATURE.map((v) => v.id), [VOIE_TRACEE, VOIE_TELEVERSEE, VOIE_DACTYLO]);
});

/* ═══ Refus NOMMÉS : une valeur absente n'est pas une valeur voulue ═ */

test('voie « tracée » sans aucun trait : refusée en le NOMMANT', () => {
  const r = signaturePrete(normaliserSignature({ voie: VOIE_TRACEE }));
  assert.equal(r.prete, false);
  assert.match(r.raison, /tracée.*aucun trait/i);
});

test('voie « photo ou scan » sans image : refusée en le NOMMANT', () => {
  const r = signaturePrete(normaliserSignature({ voie: VOIE_TELEVERSEE }));
  assert.equal(r.prete, false);
  assert.match(r.raison, /aucune image/i);
});

test('voie « dactylographiée » sans nom : refusée en le NOMMANT', () => {
  const r = signaturePrete(normaliserSignature({ voie: VOIE_DACTYLO }));
  assert.equal(r.prete, false);
  assert.match(r.raison, /nom à écrire est vide/i);
});

test('aucune voie ET aucun bloc : refus qui nomme les DEUX manques', () => {
  const r = signaturePrete(signatureVide());
  assert.equal(r.prete, false);
  assert.match(r.raison, /ni voie choisie, ni bloc écrit/);
});

test('le bloc SEUL (sans dessin) est un usage légitime, pas un défaut', () => {
  const s = normaliserSignature({ mention: 'Pour la direction,', nom: 'A. B.' });
  assert.equal(signaturePrete(s).prete, true);
  assert.equal(signaturePrete(s).dessin, false);
});

/* ═══ Voie 1 — tracée à la main ════════════════════════════════════ */

test('pointsPlats accepte les deux formes de saisie', () => {
  assert.deepEqual(pointsPlats([{ x: 1, y: 2 }, { x: 3, y: 4 }]), [1, 2, 3, 4]);
  assert.deepEqual(pointsPlats([1, 2, 3, 4]), [1, 2, 3, 4]);
  assert.deepEqual(pointsPlats([1, 2, 3]), [1, 2], 'un point orphelin est jeté, pas complété');
});

test('lisserTrait enlève les doublons d’un pointeur immobile', () => {
  const brut = [0, 0, 0, 0, 0, 0, 10, 10];
  const out = lisserTrait(brut, { tolerance: 0, passes: 0 });
  assert.equal(out.length, 4);
});

test('lisserTrait garde les extrémités exactes (une signature ne se raccourcit pas)', () => {
  const brut = [];
  for (let i = 0; i <= 40; i += 1) brut.push(i * 2, Math.sin(i / 3) * 12 + (i % 2));
  const out = lisserTrait(brut);
  assert.equal(out[0], brut[0]);
  assert.equal(out[1], brut[1]);
  assert.equal(out[out.length - 2], brut[brut.length - 2]);
  assert.equal(out[out.length - 1], brut[brut.length - 1]);
});

test('lisserTrait adoucit : moins d’angles vifs qu’au brut', () => {
  const brut = [];
  for (let i = 0; i <= 60; i += 1) brut.push(i * 3, (i % 2) * 9); // dents de scie
  const angleMoyen = (pts) => {
    let somme = 0;
    let n = 0;
    for (let i = 2; i + 3 < pts.length; i += 2) {
      const a = Math.atan2(pts[i + 1] - pts[i - 1], pts[i] - pts[i - 2]);
      const b = Math.atan2(pts[i + 3] - pts[i + 1], pts[i + 2] - pts[i]);
      somme += Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
      n += 1;
    }
    return n ? somme / n : 0;
  };
  assert.ok(angleMoyen(lisserTrait(brut)) < angleMoyen(brut) * 0.6);
});

test('boiteDesTraits rend null sur du vide (pas de boîte 0×0 fantôme)', () => {
  assert.equal(boiteDesTraits([]), null);
  assert.equal(boiteDesTraits([[1, 2]]), null, 'un trait d’un seul point n’est pas un trait');
  const b = boiteDesTraits(TRAITS);
  assert.equal(b.minX, 0);
  assert.equal(b.maxX, 70);
  assert.equal(b.minY, 10);
  assert.equal(b.maxY, 62);
});

test('tracesEnObjets sort des objets `line` — la forme du Crayon, la seule que le PDF sait tracer', () => {
  const r = tracesEnObjets({ traits: TRAITS, x: 100, y: 200, hauteur: 52 });
  assert.equal(r.objets.length, 2, 'un objet par trait');
  for (const o of r.objets) {
    assert.equal(o.type, 'line');
    assert.ok(Array.isArray(o.content.points) && o.content.points.length >= 4);
    assert.equal(o.x, 100);
    assert.equal(o.y, 200);
    assert.equal(o.meta.role, ROLE_SIGNATURE);
    assert.ok(o.style.strokeWidth > 0);
  }
  assert.equal(r.objets[0].meta.groupe, r.objets[1].meta.groupe, 'les traits partagent un groupe');
});

test('tracesEnObjets TIENT le rapport (un paraphe étiré n’est plus une signature)', () => {
  const b = boiteDesTraits(TRAITS);
  const r = tracesEnObjets({ traits: TRAITS, hauteur: 52, largeurMax: 500 });
  assert.equal(r.height, 52);
  const attendu = Math.round(b.largeur * (52 / b.hauteur));
  assert.equal(r.width, attendu);
});

test('tracesEnObjets rétrécit plutôt que de déborder de la largeur donnée', () => {
  const r = tracesEnObjets({ traits: TRAITS, hauteur: 140, largeurMax: 60 });
  assert.ok(r.width <= 60, `largeur ${r.width} > 60`);
  assert.ok(r.height < 140, 'la hauteur cède pour tenir le rapport');
});

test('les points du tracé restent DANS la boîte annoncée', () => {
  const r = tracesEnObjets({ traits: TRAITS, x: 0, y: 0, hauteur: 52 });
  for (const o of r.objets) {
    for (let i = 0; i + 1 < o.content.points.length; i += 2) {
      assert.ok(o.content.points[i] >= -0.5 && o.content.points[i] <= r.width + 0.5);
      assert.ok(o.content.points[i + 1] >= -0.5 && o.content.points[i + 1] <= r.height + 0.5);
    }
  }
});

/* ═══ Voie 2 — téléversée (détourage + dimensions natives) ═════════ */

test('l’image de signature TRANSMET ses dimensions natives (sinon carré imposé)', () => {
  const r = objetsDeSignature({
    signature: normaliserSignature({
      voie: VOIE_TELEVERSEE,
      image: { src: 'sign.png', largeurNative: 600, hauteurNative: 200 },
    }),
    x: 0, y: 0, largeur: 268,
  });
  const img = r.objets.find((o) => o.type === 'image');
  assert.ok(img, 'image posée');
  assert.deepEqual(img.content.natif, { largeurNative: 600, hauteurNative: 200 });
  assert.equal(r.mesuree, true);
  assert.ok(img.width > img.height, 'rapport 3:1 respecté');
});

test('image sans dimensions natives : carré ASSUMÉ et signalé (aucun rapport inventé)', () => {
  const r = objetsDeSignature({
    signature: normaliserSignature({ voie: VOIE_TELEVERSEE, image: { src: 'sign.png' } }),
    x: 0, y: 0, largeur: 268,
  });
  const img = r.objets.find((o) => o.type === 'image');
  assert.equal(img.width, img.height);
  assert.equal(img.content.natif, undefined);
  assert.equal(r.mesuree, false);
  assert.ok(r.avertissements.some((a) => /carré/i.test(a)));
});

test('detourerFondClair rend transparent le papier atteint depuis le bord', () => {
  const L = 9; const H = 9;
  const px = new Uint8ClampedArray(L * H * 4).fill(255);
  // Un trait noir horizontal au milieu.
  for (let x = 1; x < L - 1; x += 1) {
    const o = (4 * L + x) * 4;
    px[o] = 0; px[o + 1] = 0; px[o + 2] = 0; px[o + 3] = 255;
  }
  const r = detourerFondClair(px, { largeur: L, hauteur: H });
  assert.equal(r.modifie, true);
  assert.equal(px[(4 * L + 4) * 4 + 3], 255, 'le trait reste opaque');
  assert.equal(px[3], 0, 'le coin (papier) devient transparent');
  assert.ok(r.partTransparente > 0.8 && r.partTransparente < 1);
});

test('detourerFondClair NE touche PAS une zone claire enfermée dans l’encre', () => {
  const L = 7; const H = 7;
  const px = new Uint8ClampedArray(L * H * 4).fill(255);
  // Anneau noir : le blanc du centre n'est pas atteignable depuis le bord.
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 2; x <= 4; x += 1) {
      if (x === 3 && y === 3) continue;
      const o = (y * L + x) * 4;
      px[o] = 0; px[o + 1] = 0; px[o + 2] = 0;
    }
  }
  detourerFondClair(px, { largeur: L, hauteur: H });
  assert.equal(px[(3 * L + 3) * 4 + 3], 255, 'la boucle intérieure du paraphe survit');
  assert.equal(px[3], 0);
});

test('detourerFondClair mesure 0 quand il n’y a pas de fond clair (et ne ment pas)', () => {
  const L = 5; const H = 5;
  const px = new Uint8ClampedArray(L * H * 4).fill(40);
  for (let i = 3; i < px.length; i += 4) px[i] = 255;
  const r = detourerFondClair(px, { largeur: L, hauteur: H });
  assert.equal(r.partTransparente, 0);
  assert.equal(r.modifie, false);
});

test('detourerFondClair refuse un tampon de taille incohérente au lieu de deviner', () => {
  assert.throws(
    () => detourerFondClair(new Uint8ClampedArray(10), { largeur: 4, hauteur: 4 }),
    /attendu 64/,
  );
});

/* ═══ Voie 3 — dactylographiée ════════════════════════════════════ */

test('le nom dactylographié sort en texte, dans une police manuscrite système', () => {
  const r = objetsDeSignature({
    signature: normaliserSignature({ voie: VOIE_DACTYLO, dactylographiee: { texte: 'A. Bakala' } }),
    x: 0, y: 0, largeur: 268,
  });
  const t = r.objets.find((o) => o.type === 'text' && o.content.text === 'A. Bakala');
  assert.ok(t);
  assert.equal(t.style.fontFamily, POLICES_MANUSCRITES[0].valeur);
  assert.match(t.style.fontFamily, /cursive$/, 'repli sur la famille générique');
});

test('la voie dactylographiée DIT ses deux limites (police système, PDF non embarqué)', () => {
  const av = avertissementsSignature(normaliserSignature({
    voie: VOIE_DACTYLO, dactylographiee: { texte: 'A. Bakala' },
  }));
  assert.ok(av.some((a) => /machine/i.test(a)), 'police non fournie par l’application');
  assert.ok(av.some((a) => /PDF/.test(a) && /Times/.test(a)), 'texte exporté en Times');
});

/* ═══ Bloc « Pour la direction, / Nom / Fonction / Date » ══════════ */

test('la date n’entre dans le bloc que si elle est écrite ET demandée', () => {
  const base = { mention: 'Pour la direction,', nom: 'A. B.', fonction: 'Gérant', date: '2026-08-06' };
  assert.deepEqual(lignesBloc(normaliserSignature(base)), ['Pour la direction,', 'A. B.', 'Gérant']);
  assert.deepEqual(
    lignesBloc(normaliserSignature({ ...base, afficherDate: true })),
    ['Pour la direction,', 'A. B.', 'Gérant', '2026-08-06'],
  );
  assert.deepEqual(
    lignesBloc(normaliserSignature({ ...base, date: '', afficherDate: true })),
    ['Pour la direction,', 'A. B.', 'Gérant'],
    'aucune date fabriquée quand le champ est vide',
  );
});

test('le bloc accompagne le dessin et se pose SOUS lui', () => {
  const r = objetsDeSignature({
    signature: sigTracee({ mention: 'Pour la direction,', nom: 'A. B.' }),
    x: 10, y: 100, largeur: 268,
  });
  const traits = r.objets.filter((o) => o.type === 'line');
  const bloc = r.objets.find((o) => o.type === 'text');
  assert.equal(traits.length, 2);
  assert.ok(bloc.y > traits[0].y + traits[0].height - 1, 'le bloc est sous le tracé');
  assert.ok(r.hauteur > 0);
  assert.equal(blocRenseigne(sigTracee({ nom: 'A. B.' })), true);
});

/* ═══ Pose sur un document ════════════════════════════════════════ */

const pageA4 = { format: 'a4_portrait', marges: MARGES_DEFAUT, nbPages: 1 };

test('appliquerSignature pose dans la page et rend une mutation applicable', () => {
  const r = appliquerSignature({ signature: sigTracee({ nom: 'A. B.' }), objets: [], page: pageA4 });
  assert.equal(r.placee, true);
  assert.ok(r.ajouts.length >= 2);
  assert.deepEqual(r.patches, []);
  assert.ok(r.boite.y + r.boite.hauteur <= A4.hauteur - MARGES_DEFAUT.bas + 1, 'ne dépasse pas la zone utile');
  assert.ok(r.boite.x >= MARGES_DEFAUT.gauche);
});

test('les trois ancrages posent à des abscisses différentes', () => {
  const xs = ANCRAGES_SIGNATURE.map((a) => appliquerSignature({
    signature: sigTracee(), page: pageA4, position: a.id,
  }).boite.x);
  assert.equal(new Set(xs).size, 3);
  assert.ok(xs[0] > xs[2] && xs[2] > xs[1], 'droite > centre > gauche');
});

test('une position {x,y} EXACTE est respectée (l’utilisateur pose où il veut)', () => {
  const r = appliquerSignature({ signature: sigTracee(), page: pageA4, position: { x: 90, y: 300 } });
  assert.equal(r.boite.x, 90);
  assert.equal(r.boite.y, 300);
});

test('un ancrage inconnu est REFUSÉ en le nommant, pas remplacé en silence', () => {
  const r = appliquerSignature({ signature: sigTracee(), page: pageA4, position: 'milieu-milieu' });
  assert.equal(r.placee, false);
  assert.match(r.raison, /ancrage inconnu « milieu-milieu »/);
  assert.equal(r.ajouts.length, 0);
});

test('une position sans coordonnées exploitables est refusée', () => {
  const r = appliquerSignature({ signature: sigTracee(), page: pageA4, position: { x: 10 } });
  assert.equal(r.placee, false);
  assert.match(r.raison, /coordonnées exploitables/);
});

test('jamais hors page : une position trop basse remonte dans la zone utile', () => {
  const r = appliquerSignature({
    signature: sigTracee({ nom: 'A. B.' }), page: pageA4, position: { x: 60, y: A4.hauteur - 5 },
  });
  assert.equal(r.placee, true);
  assert.ok(r.boite.y + r.boite.hauteur <= A4.hauteur - MARGES_DEFAUT.bas + 1);
});

test('une signature qui ne tient pas dans la page n’est PAS posée (et le dit)', () => {
  const r = appliquerSignature({
    signature: sigTracee(),
    page: { format: 'a4_portrait', marges: { haut: 545, bas: 545, gauche: 40, droite: 40 } },
  });
  assert.equal(r.placee, false);
  assert.match(r.raison, /ne tient pas dans la zone utile/);
  assert.equal(r.ajouts.length, 0);
});

test('la pose sur la page 2 tombe bien sur la page 2', () => {
  const r = appliquerSignature({
    signature: sigTracee(), page: { ...pageA4, nbPages: 3, index: 1 },
  });
  assert.equal(r.placee, true);
  assert.ok(r.boite.y > A4.hauteur, 'au-delà de la première page');
  assert.ok(r.boite.y < 2 * A4.hauteur, 'avant la troisième');
});

test('poser une signature remplace la précédente (une seule signature)', () => {
  const premiere = appliquerSignature({ signature: sigTracee(), page: pageA4 });
  const seconde = appliquerSignature({ signature: sigTracee(), objets: premiere.ajouts, page: pageA4 });
  assert.deepEqual(seconde.suppressions.sort(), premiere.ajouts.map((o) => o.id).sort());
  const sans = appliquerSignature({ signature: sigTracee(), objets: premiere.ajouts, page: pageA4, remplacer: false });
  assert.deepEqual(sans.suppressions, []);
});

test('signaturePosee / retirerSignature ne rendent QUE des objets de signature', () => {
  const r = appliquerSignature({ signature: sigTracee({ nom: 'A. B.' }), page: pageA4 });
  const scene = [{ id: 'corps', type: 'text', x: 0, y: 0, width: 10, height: 10 }, ...r.ajouts];
  const etat = signaturePosee(scene);
  assert.equal(etat.posee, true);
  assert.equal(etat.nbObjets, r.ajouts.length);
  assert.deepEqual(etat.voies, [VOIE_TRACEE]);
  assert.deepEqual(retirerSignature(scene).suppressions, idsSignaturesPosees(scene));
  assert.equal(retirerSignature(scene).suppressions.includes('corps'), false);
});

test('signature non prête : appliquerSignature ne pose RIEN (bouton sans effet interdit)', () => {
  const r = appliquerSignature({ signature: signatureVide(), page: pageA4 });
  assert.equal(r.placee, false);
  assert.equal(r.ajouts.length, 0);
  assert.equal(r.suppressions.length, 0);
  assert.ok(r.raison);
});

test('resumeSignature dit l’état sans le deviner', () => {
  const r = resumeSignature(sigTracee({ nom: 'A. B.' }));
  assert.equal(r.voie, VOIE_TRACEE);
  assert.equal(r.voieLabel, 'Tracée à la main');
  assert.equal(r.prete, true);
  assert.equal(r.dessin, true);
  assert.equal(r.bloc, true);
  assert.equal(r.nbTraits, 2);
});

/* ═══ [SIG-2] Intégration à l'identité d'entreprise ════════════════ */

test('identiteVide().signature EST une signature à trois voies', () => {
  const s = identiteVide().signature;
  assert.equal(s.voie, '');
  assert.ok('tracee' in s && 'image' in s && 'dactylographiee' in s);
});

test('reprise SANS PERTE d’une identité enregistrée avant les trois voies', () => {
  const ancienne = normaliserIdentite({
    id: 'idn_vieux',
    raisonSociale: 'Société',
    signature: { nom: 'A. B.', fonction: 'Gérant', mention: 'Pour la direction,', image: { src: 'sign.png', largeurNative: 600, hauteurNative: 200 } },
  });
  assert.equal(ancienne.signature.image.src, 'sign.png');
  assert.equal(ancienne.signature.voie, VOIE_TELEVERSEE, 'voie DÉDUITE, pas inventée');
  assert.equal(ancienne.signature.nom, 'A. B.');
});

test('une ancienne identité SANS image ne se voit attribuer aucune voie', () => {
  const n = normaliserIdentite({ signature: { nom: 'A. B.' } });
  assert.equal(n.signature.voie, '');
});

test('appliquerIdentite pose une signature TRACÉE (le tracé traverse l’identité)', () => {
  const identite = normaliserIdentite({
    id: 'idn_t',
    raisonSociale: 'Société',
    signature: { voie: VOIE_TRACEE, tracee: { traits: TRAITS }, nom: 'A. B.', fonction: 'Gérant' },
  });
  const res = appliquerIdentite({ identite, objets: [], page: { format: 'a4_portrait', marges: MARGES_DEFAUT, nbPages: 1 } });
  assert.equal(res.signaturePlacee, true);
  const traits = res.ajouts.filter((o) => o.type === 'line' && o.meta?.role === ROLE_SIGNATURE);
  assert.equal(traits.length, 2);
  assert.equal(traits[0].meta.identite, 'idn_t', 'marqué identité : « Retirer » le reprendra');
});

test('appliquerIdentite pose une signature DACTYLOGRAPHIÉE et remonte l’avertissement PDF', () => {
  const identite = normaliserIdentite({
    id: 'idn_d',
    raisonSociale: 'Société',
    signature: { voie: VOIE_DACTYLO, dactylographiee: { texte: 'A. Bakala' }, fonction: 'Gérant' },
  });
  const res = appliquerIdentite({ identite, objets: [], page: { format: 'a4_portrait', marges: MARGES_DEFAUT, nbPages: 1 } });
  assert.equal(res.signaturePlacee, true);
  assert.ok(res.ajouts.some((o) => o.content?.text === 'A. Bakala'));
  assert.ok(res.avertissementsSignature.some((a) => /PDF/.test(a)));
});

test('appliquerIdentite remonte une signature image NON MESURÉE', () => {
  const identite = normaliserIdentite({
    id: 'idn_i',
    raisonSociale: 'Société',
    signature: { voie: VOIE_TELEVERSEE, image: { src: 'sign.png' }, nom: 'A. B.' },
  });
  const res = appliquerIdentite({ identite, objets: [], page: { format: 'a4_portrait', marges: MARGES_DEFAUT, nbPages: 1 } });
  assert.equal(res.signaturePlacee, true);
  assert.equal(res.signatureMesuree, false);
});

test('appliquerIdentite NOMME la voie incomplète au lieu de « rien à poser »', () => {
  const identite = normaliserIdentite({
    id: 'idn_x',
    raisonSociale: 'Société',
    signature: { voie: VOIE_TRACEE, tracee: { traits: [] } },
  });
  const res = appliquerIdentite({ identite, objets: [], page: { format: 'a4_portrait', marges: MARGES_DEFAUT, nbPages: 1 } });
  assert.equal(res.signaturePlacee, false);
  assert.match(res.raisonSignature, /aucun trait/);
  assert.equal(res.ajouts.some((o) => o.meta?.role === ROLE_SIGNATURE), false, 'rien de posé');
});

test('la hauteur de signature de l’ancien format (`image.hauteur`) est reprise', () => {
  const n = normaliserSignature({ voie: VOIE_TELEVERSEE, image: { src: 'a.png', hauteur: 90 } });
  assert.equal(n.hauteur, 90);
  assert.equal(normaliserSignature({}).hauteur, HAUTEUR_SIGNATURE_DEFAUT);
});

test('une position exacte AU-DESSUS de la zone utile est recalée, pas rejetée', () => {
  const r = appliquerSignature({ signature: sigTracee(), page: pageA4, position: { x: 60, y: 0 } });
  assert.equal(r.placee, true);
  assert.equal(r.recalee, true);
  assert.equal(r.boite.y, MARGES_DEFAUT.haut);
});
