/**
 * documentSignature — la signature apposée sur un document, par TROIS voies au choix :
 * tracée à la main, téléversée (photo / scan), ou dactylographiée.
 *
 * ⛔ CE QU'UNE SIGNATURE EST ICI, dit sans détour : un DESSIN posé dans un document.
 * Un tracé vectoriel ou une image dans un PDF. Ce module ne produit AUCUNE preuve :
 * pas de scellement, pas d'horodatage opposable, pas de certificat, pas de « document
 * authentifié ». Aucun libellé de ce fichier ne le laisse croire, et la date du bloc
 * est un texte que l'utilisateur écrit lui-même — elle ne fait foi de rien.
 *
 * ⛔ AUCUNE DONNÉE INVENTÉE. {@link signatureVide} rend des champs VIDES : pas de nom
 * de signataire, pas de fonction, pas de date. Les seules valeurs par défaut sont des
 * GÉOMÉTRIES (hauteur, épaisseur du trait) et des choix de rendu.
 *
 * ⛔ AUCUNE VOIE PAR DÉFAUT. `voie` naît vide : une signature sans voie choisie est
 * REFUSÉE en le disant (`raison`), jamais remplacée en douce par une voie plausible.
 * C'est la famille de pertes de données du dépôt : une valeur absente n'est pas une
 * valeur voulue.
 *
 * ⛔ CE FICHIER N'ÉCRIT RIEN. Comme documentPagination et documentIdentite, il rend des
 * `{ ajouts, patches, suppressions }` que l'appelant applique en UN pas d'historique.
 *
 * ═══ POURQUOI LE TRACÉ EST UNE POLYLIGNE LISSÉE, ET PAS UNE COURBE ═══
 * Le tracé sort en objets `line` — exactement la forme produite par le Crayon du
 * panneau Formes & Vecteur (`finalizePen` dans canvas/KonvaBoardStage.jsx) :
 * `content.points` relatifs à (x, y), `style.stroke` / `style.strokeWidth`. C'est la
 * seule forme que SAVENT dessiner les deux rendus : `KonvaBoardObject` pose un
 * `<Line>` SANS `tension`, et `documentExport` trace le PDF segment par segment
 * (`doc.line`). Une courbe de Bézier serait donc lissée à l'écran et anguleuse au PDF.
 * Le lissage doit vivre dans les POINTS : simplification Ramer-Douglas-Peucker puis
 * adoucissement de Chaikin (cf. {@link lisserTrait}).
 *
 * ⚠️ CE QUI N'EST PAS RÉUTILISÉ, dit franchement : le moteur de tracé du Crayon est
 * soudé au `Stage` Konva du document (`onStageMouseDown/Move/Up`, `getStagePos`) et
 * n'est pas extractible depuis ce périmètre. Le cadre de capture du panneau est donc
 * un capteur MINIMAL écrit à part ; ce qu'il partage avec le Crayon, c'est la SORTIE
 * (mêmes objets `line`), pas le code de saisie.
 *
 * ⚠️ POLICE MANUSCRITE : aucune police d'écriture manuscrite n'est embarquée dans ce
 * dépôt (ni webfont, ni `@font-face`, ni classe Tailwind `font-cursive` définie).
 * {@link POLICES_MANUSCRITES} n'aligne que des polices SYSTÈME suivies de la famille
 * générique `cursive` : le dessin dépend donc de la machine. Et à l'export PDF,
 * `familleFontPdf` (documentExport) retombe sur les 14 polices standard — un nom
 * dactylographié laissé en TEXTE sortira en Times/Helvetica, pas en manuscrit.
 * C'est pour cela que {@link avertissementsSignature} le dit et que le panneau
 * propose de figer le nom en image.
 *
 * Aucun import React, aucun réseau, aucun accès au DOM : testable sous `node --test`.
 */
import {
  FORMAT_DEFAUT,
  MARGES_DEFAUT,
  ECART_PAGES_DEFAUT,
  resoudreFormat,
  resoudreMarges,
  zoneUtile,
  origineDePage,
} from './documentPagination.js';
import { boiteAuFormat } from './documentImages.js';
import { DOC_INK, DOC_META_BLOC, estimateTextHeight } from './documentBlockLayout.js';

/* ═══════════════════════════════════════════════════════════════════
   Constantes
═══════════════════════════════════════════════════════════════════ */

/** Rôle porté par TOUT objet de signature — c'est lui qui permet de la retrouver. */
export const ROLE_SIGNATURE = 'signature';

/** Marqueur de regroupement : tous les traits d'UNE signature portent le même. */
export const META_SIGNATURE = 'signature';

export const VOIE_TRACEE = 'tracee';
export const VOIE_TELEVERSEE = 'televersee';
export const VOIE_DACTYLO = 'dactylographiee';

/**
 * Les trois voies. `aide` dit ce que la voie produit RÉELLEMENT dans le document —
 * c'est ce que le panneau affiche, pour qu'aucun utilisateur ne croie signer autre
 * chose qu'un dessin.
 */
export const VOIES_SIGNATURE = Object.freeze([
  {
    id: VOIE_TRACEE,
    label: 'Tracée à la main',
    aide: 'Signez à la souris ou au doigt. Posée en tracé vectoriel (net à toutes les tailles).',
  },
  {
    id: VOIE_TELEVERSEE,
    label: 'Photo ou scan',
    aide: 'Image de votre signature. Le fond clair peut être détouré avant la pose.',
  },
  {
    id: VOIE_DACTYLO,
    label: 'Nom dactylographié',
    aide: 'Votre nom écrit dans une police manuscrite du système. Ce n’est pas votre main.',
  },
]);

/** Géométries — réglages de mise en page, pas du contenu. */
export const HAUTEUR_SIGNATURE_DEFAUT = 52;
export const HAUTEUR_SIGNATURE_MIN = 16;
export const HAUTEUR_SIGNATURE_MAX = 140;
export const EPAISSEUR_TRAIT_DEFAUT = 2.4;
export const EPAISSEUR_TRAIT_MIN = 1;
export const EPAISSEUR_TRAIT_MAX = 8;
export const TAILLE_DACTYLO_DEFAUT = 28;
export const TAILLE_DACTYLO_MIN = 12;
export const TAILLE_DACTYLO_MAX = 72;

/** Largeur du bloc « Pour la direction, / Nom / Fonction / Date ». */
export const LARGEUR_BLOC_SIGNATURE = 268;
export const TAILLE_TEXTE_BLOC = 11;
/** Filet d'air entre le dessin de signature et le bloc de texte qui l'accompagne. */
const ECART_DESSIN_BLOC = 6;

/** Encre du tracé par défaut — l'encre du stylo, pas une couleur de marque. */
export const ENCRE_TRACE_DEFAUT = '#101828';

/**
 * ⚠️ AUCUNE de ces polices n'est fournie par le dépôt : ce sont des polices SYSTÈME,
 * repliées sur la famille générique `cursive`. Sur une machine qui n'en a aucune, le
 * navigateur choisit ce qu'il veut. `POLICES_MANUSCRITES[0]` reste la pile déjà
 * utilisée ailleurs dans le produit (lib/whiteboardTextCanvas.js), pour que deux
 * écrans n'affichent pas deux écritures différentes.
 */
export const POLICES_MANUSCRITES = Object.freeze([
  { id: 'systeme', label: 'Manuscrite système', valeur: '"Segoe Script", "Bradley Hand", "Snell Roundhand", cursive' },
  { id: 'print', label: 'Bâton manuscrit', valeur: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' },
  { id: 'cursive', label: 'Cursive générique', valeur: 'cursive' },
]);

/** Ancrages disponibles quand aucune position exacte n'est donnée. */
export const ANCRAGES_SIGNATURE = Object.freeze([
  { id: 'bas-droite', label: 'En bas à droite' },
  { id: 'bas-gauche', label: 'En bas à gauche' },
  { id: 'bas-centre', label: 'En bas au centre' },
]);
export const ANCRAGE_DEFAUT = 'bas-droite';

/* ═══════════════════════════════════════════════════════════════════
   Petits utilitaires
═══════════════════════════════════════════════════════════════════ */

let _seq = 0;
function uid(prefixe) {
  _seq += 1;
  return `${prefixe}_${Date.now().toString(36)}${_seq.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const txt = (v) => (typeof v === 'string' ? v.trim() : '');
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const nbBorne = (v, min, max, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const nbOuNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const couleurValide = (v) => {
  const s = txt(v);
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : '';
};

/* ═══════════════════════════════════════════════════════════════════
   Traits : lissage et géométrie — [SIG-1] voie « tracée »
═══════════════════════════════════════════════════════════════════ */

/** Accepte `[x0,y0,x1,y1,…]` ou `[{x,y},…]` et rend TOUJOURS la forme plate. */
export function pointsPlats(entree) {
  if (!Array.isArray(entree)) return [];
  if (entree.length && typeof entree[0] === 'object' && entree[0] !== null) {
    const out = [];
    for (const p of entree) {
      const x = Number(p?.x);
      const y = Number(p?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) out.push(x, y);
    }
    return out;
  }
  const out = [];
  for (let i = 0; i + 1 < entree.length; i += 2) {
    const x = Number(entree[i]);
    const y = Number(entree[i + 1]);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push(x, y);
  }
  return out;
}

/** Distance d'un point au segment [a, b] — noyau du Ramer-Douglas-Peucker. */
function distanceAuSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Ramer-Douglas-Peucker itératif (une pile, pas de récursion : un tracé au doigt
 *  peut compter des milliers de points et faire sauter la pile d'appels). */
function simplifier(pts, tolerance) {
  const n = pts.length / 2;
  if (n < 3 || tolerance <= 0) return pts.slice();
  const garder = new Uint8Array(n);
  garder[0] = 1;
  garder[n - 1] = 1;
  const pile = [[0, n - 1]];
  while (pile.length) {
    const [i0, i1] = pile.pop();
    if (i1 - i0 < 2) continue;
    let maxD = -1;
    let maxI = -1;
    for (let i = i0 + 1; i < i1; i += 1) {
      const d = distanceAuSegment(
        pts[i * 2], pts[i * 2 + 1],
        pts[i0 * 2], pts[i0 * 2 + 1],
        pts[i1 * 2], pts[i1 * 2 + 1],
      );
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > tolerance && maxI > 0) {
      garder[maxI] = 1;
      pile.push([i0, maxI], [maxI, i1]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i += 1) if (garder[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

/** Adoucissement de Chaikin (coupe de coin). Les extrémités ne bougent pas : une
 *  signature qui « rentre » de deux pixels à chaque passe finirait raccourcie. */
function chaikin(pts) {
  const n = pts.length / 2;
  if (n < 3) return pts.slice();
  const out = [pts[0], pts[1]];
  for (let i = 0; i + 1 < n; i += 1) {
    const ax = pts[i * 2];
    const ay = pts[i * 2 + 1];
    const bx = pts[(i + 1) * 2];
    const by = pts[(i + 1) * 2 + 1];
    out.push(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25);
    out.push(ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75);
  }
  out.push(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1]);
  return out;
}

/**
 * Lisse UN trait. Une signature à la souris brute est laide : les points arrivent par
 * paquets, avec des marches d'escalier. On enlève d'abord le bruit (RDP), puis on
 * arrondit (Chaikin) — l'inverse rendrait le bruit lui-même « joli » et le garderait.
 *
 * @param {number[]|{x:number,y:number}[]} entree
 * @param {{tolerance?:number, passes?:number}} [opts]
 * @returns {number[]} points plats
 */
export function lisserTrait(entree, { tolerance = 1.2, passes = 2 } = {}) {
  const plats = pointsPlats(entree);
  if (plats.length < 4) return plats;
  // Doublons consécutifs : un pointeur immobile en émet des dizaines, et le RDP
  // comme Chaikin les traitent comme des segments de longueur nulle.
  const nets = [plats[0], plats[1]];
  for (let i = 2; i + 1 < plats.length; i += 2) {
    const dx = plats[i] - nets[nets.length - 2];
    const dy = plats[i + 1] - nets[nets.length - 1];
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) nets.push(plats[i], plats[i + 1]);
  }
  let out = simplifier(nets, tolerance);
  const n = Math.max(0, Math.min(4, Math.trunc(Number(passes) || 0)));
  for (let p = 0; p < n; p += 1) out = chaikin(out);
  return out;
}

/** Traits sûrs : chaque trait devient une liste plate d'au moins 2 points. */
export function normaliserTraits(brut) {
  if (!Array.isArray(brut)) return [];
  return brut
    .map((t) => pointsPlats(Array.isArray(t?.points) ? t.points : t))
    .filter((t) => t.length >= 4);
}

/**
 * Boîte englobante de tous les traits. Rend `null` s'il n'y a rien : on ne fabrique
 * pas une boîte de 0×0 qui ferait diviser par zéro plus loin.
 */
export function boiteDesTraits(traits) {
  const liste = normaliserTraits(traits);
  if (!liste.length) return null;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const t of liste) {
    for (let i = 0; i + 1 < t.length; i += 2) {
      if (t[i] < minX) minX = t[i];
      if (t[i] > maxX) maxX = t[i];
      if (t[i + 1] < minY) minY = t[i + 1];
      if (t[i + 1] > maxY) maxY = t[i + 1];
    }
  }
  if (!Number.isFinite(minX)) return null;
  return {
    minX, minY, maxX, maxY,
    largeur: Math.max(1, maxX - minX),
    hauteur: Math.max(1, maxY - minY),
  };
}

/**
 * Traits → objets `line` du canevas, remis à l'échelle dans la boîte demandée.
 *
 * ⛔ Le rapport est TENU : un tracé étiré horizontalement n'est plus la signature de
 * personne. La boîte rendue peut donc être plus étroite que `largeurMax`.
 *
 * ⚠️ Un trait = un objet. Ils partagent `meta.groupe` : la pose les sélectionne tous
 * (`selectionner: true`), et le Transformer attaché à plusieurs nœuds les déplace et
 * les redimensionne ensemble. Redimensionner UN SEUL trait le désolidarise — c'est la
 * limite connue de la sortie vectorielle.
 *
 * @returns {{objets:object[], width:number, height:number}|null}
 */
export function tracesEnObjets({
  traits,
  x = 0,
  y = 0,
  hauteur = HAUTEUR_SIGNATURE_DEFAUT,
  largeurMax = LARGEUR_BLOC_SIGNATURE,
  couleur = ENCRE_TRACE_DEFAUT,
  epaisseur = EPAISSEUR_TRAIT_DEFAUT,
  groupe = '',
  meta = {},
} = {}) {
  const liste = normaliserTraits(traits);
  const boite = boiteDesTraits(liste);
  if (!boite) return null;

  const hCible = nbBorne(hauteur, HAUTEUR_SIGNATURE_MIN, HAUTEUR_SIGNATURE_MAX, HAUTEUR_SIGNATURE_DEFAUT);
  const lMax = Math.max(24, Number(largeurMax) || LARGEUR_BLOC_SIGNATURE);
  const k = Math.min(hCible / boite.hauteur, lMax / boite.largeur);
  const width = Math.max(1, Math.round(boite.largeur * k));
  const height = Math.max(1, Math.round(boite.hauteur * k));
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const trait = couleurValide(couleur) || ENCRE_TRACE_DEFAUT;
  const ep = nbBorne(epaisseur, EPAISSEUR_TRAIT_MIN, EPAISSEUR_TRAIT_MAX, EPAISSEUR_TRAIT_DEFAUT);
  const g = txt(groupe) || uid('sig');

  const objets = liste.map((t) => {
    const pts = [];
    for (let i = 0; i + 1 < t.length; i += 2) {
      pts.push((t[i] - boite.minX) * k, (t[i + 1] - boite.minY) * k);
    }
    return {
      id: uid('sig_trait'),
      type: 'line',
      x: x0,
      y: y0,
      width,
      height,
      rotation: 0,
      layer: 3,
      visible: true,
      locked: false,
      step: 0,
      visibleFor: 'both',
      opacity: 1,
      content: { points: pts },
      style: { stroke: trait, strokeWidth: ep, lineCap: 'round' },
      meta: { doc: DOC_META_BLOC, role: ROLE_SIGNATURE, voie: VOIE_TRACEE, groupe: g, ...meta },
    };
  });

  return { objets, width, height };
}

/* ═══════════════════════════════════════════════════════════════════
   Détourage du fond clair — [SIG-1] voie « téléversée »
═══════════════════════════════════════════════════════════════════ */

/**
 * Rend transparent le fond clair d'une signature scannée. MUTE `donnees` sur place
 * (c'est ce qu'attend `ImageData.data` renvoyé à `putImageData`) et rend aussi le
 * même tableau.
 *
 * ⛔ POURQUOI UN REMPLISSAGE PAR LES BORDS, ET PAS UN SIMPLE SEUIL : un seuil global
 * efface aussi les zones claires INTÉRIEURES (une boucle du paraphe, un stylo bleu
 * pâle). On ne rend transparent que le clair ATTEINT DEPUIS LE BORD de l'image —
 * c'est-à-dire le papier. Le trait, lui, est entouré d'encre et n'est jamais atteint.
 *
 * ⚠️ CE QUE ÇA NE SAIT PAS FAIRE, et qu'il faut dire à l'utilisateur : une photo au
 * fond gris, ombré ou texturé ne sera PAS détourée (le remplissage s'arrête au
 * premier pixel sombre). `partTransparente` le mesure — 0 signifie « rien n'a été
 * retiré », pas « c'est propre ».
 *
 * @param {Uint8ClampedArray|number[]} donnees RGBA, longueur = largeur*hauteur*4
 * @param {{largeur:number, hauteur:number, seuil?:number, seuilPlein?:number}} p
 * @returns {{donnees:any, largeur:number, hauteur:number, partTransparente:number,
 *            seuil:number, modifie:boolean}}
 */
export function detourerFondClair(donnees, { largeur, hauteur, seuil = 0.86, seuilPlein = 0.58 } = {}) {
  const L = Math.trunc(Number(largeur) || 0);
  const H = Math.trunc(Number(hauteur) || 0);
  if (!donnees || !L || !H) throw new Error('detourerFondClair : largeur/hauteur manquantes');
  if (donnees.length !== L * H * 4) {
    throw new Error(`detourerFondClair : ${donnees.length} octets pour ${L}×${H} (attendu ${L * H * 4})`);
  }
  const sHaut = Math.min(1, Math.max(0, Number(seuil)));
  const sBas = Math.min(sHaut - 0.01, Math.max(0, Number(seuilPlein)));

  const n = L * H;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    // Luminance perceptuelle : un jaune vif est clair, un bleu vif est sombre.
    lum[i] = (0.2126 * donnees[o] + 0.7152 * donnees[o + 1] + 0.0722 * donnees[o + 2]) / 255;
  }

  // Remplissage depuis les bords (file d'attente explicite : une image A4 scannée
  // dépasse le million de pixels, la récursion exploserait).
  const fond = new Uint8Array(n);
  const file = new Int32Array(n);
  let tete = 0;
  let queue = 0;
  const pousser = (i) => {
    if (fond[i] || lum[i] < sHaut) return;
    fond[i] = 1;
    file[queue] = i;
    queue += 1;
  };
  for (let x = 0; x < L; x += 1) { pousser(x); pousser((H - 1) * L + x); }
  for (let y = 0; y < H; y += 1) { pousser(y * L); pousser(y * L + L - 1); }
  while (tete < queue) {
    const i = file[tete];
    tete += 1;
    const x = i % L;
    const y = (i - x) / L;
    if (x > 0) pousser(i - 1);
    if (x < L - 1) pousser(i + 1);
    if (y > 0) pousser(i - L);
    if (y < H - 1) pousser(i + L);
  }

  let transparents = 0;
  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    if (fond[i]) {
      donnees[o + 3] = 0;
      transparents += 1;
      continue;
    }
    /* Bordure anti-crénelage : l'alpha descend en pente entre les deux seuils, pour
       que le trait ne finisse pas cerné d'un liseré blanc.
       ⛔ SEULEMENT au CONTACT du fond. Appliquer cette pente à tous les pixels clairs
       effacerait aussi les clairs ENFERMÉS par l'encre — la boucle intérieure d'un
       paraphe disparaissait ainsi alors que le remplissage ne l'avait pas atteinte. */
    const x = i % L;
    const y = (i - x) / L;
    const auContact = (x > 0 && fond[i - 1])
      || (x < L - 1 && fond[i + 1])
      || (y > 0 && fond[i - L])
      || (y < H - 1 && fond[i + L]);
    if (!auContact) continue;
    const l = lum[i];
    if (l > sBas) {
      const k = Math.max(0, Math.min(1, (sHaut - l) / (sHaut - sBas)));
      donnees[o + 3] = Math.round(donnees[o + 3] * k);
      if (donnees[o + 3] === 0) transparents += 1;
    }
  }

  return {
    donnees,
    largeur: L,
    hauteur: H,
    partTransparente: transparents / n,
    seuil: sHaut,
    modifie: transparents > 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Modèle de données — [SIG-1] / [SIG-2]
═══════════════════════════════════════════════════════════════════ */

/**
 * Signature VIERGE. ⛔ `voie` est VIDE : aucune voie n'est choisie à la place de
 * l'utilisateur. Le bloc « Pour la direction, / Nom / Fonction / Date » naît vide lui
 * aussi — aucun nom de signataire, aucune date, aucune mention légale.
 */
export function signatureVide() {
  return {
    /** '' | 'tracee' | 'televersee' | 'dactylographiee' — VIDE tant qu'on n'a pas choisi. */
    voie: '',
    /** Bloc de texte facultatif qui accompagne le dessin. */
    mention: '',
    nom: '',
    fonction: '',
    date: '',
    afficherDate: false,
    /** Voie « tracée » : traits capturés dans le repère du cadre de saisie. */
    tracee: {
      traits: [],
      largeurNative: null,
      hauteurNative: null,
      couleur: ENCRE_TRACE_DEFAUT,
      epaisseur: EPAISSEUR_TRAIT_DEFAUT,
    },
    /**
     * Voie « téléversée ». ⚠️ Le champ s'appelle `image` et non `televersee` : c'est
     * le champ HISTORIQUE de `documentIdentite.signature.image`. Le renommer aurait
     * fait perdre l'image de toutes les identités déjà enregistrées en localStorage.
     */
    image: { src: '', largeurNative: null, hauteurNative: null, detoure: false },
    /** Voie « dactylographiée ». */
    dactylographiee: { texte: '', police: '', taille: TAILLE_DACTYLO_DEFAUT },
    /** Hauteur du dessin posé (voies tracée et téléversée). */
    hauteur: HAUTEUR_SIGNATURE_DEFAUT,
  };
}

/**
 * Signature sûre à partir d'un objet partiel.
 *
 * ⚠️ REPRISE DE L'ANCIEN FORMAT : `documentIdentite.signature` ne portait que
 * `{ mention, nom, fonction, image }`. Une identité enregistrée AVANT ce module n'a
 * pas de `voie` ; si elle porte une image, la voie déduite est « téléversée » — c'est
 * la seule qu'elle pouvait être. Sans image, la voie reste VIDE (on ne devine pas).
 */
export function normaliserSignature(brut) {
  const b = brut && typeof brut === 'object' ? brut : {};
  const v = signatureVide();

  const traits = normaliserTraits(b?.tracee?.traits);
  const srcImage = txt(b?.image?.src) || txt(b?.televersee?.src);
  const texteDactylo = txt(b?.dactylographiee?.texte);

  const voieDemandee = VOIES_SIGNATURE.some((x) => x.id === b.voie) ? b.voie : '';
  const voie = voieDemandee || (srcImage ? VOIE_TELEVERSEE : '');

  const policeDemandee = txt(b?.dactylographiee?.police);
  const police = POLICES_MANUSCRITES.some((p) => p.valeur === policeDemandee) ? policeDemandee : '';

  return {
    ...v,
    voie,
    mention: txt(b.mention),
    nom: txt(b.nom),
    fonction: txt(b.fonction),
    date: txt(b.date),
    afficherDate: bool(b.afficherDate, false),
    tracee: {
      traits,
      largeurNative: nbOuNull(b?.tracee?.largeurNative),
      hauteurNative: nbOuNull(b?.tracee?.hauteurNative),
      couleur: couleurValide(b?.tracee?.couleur) || ENCRE_TRACE_DEFAUT,
      epaisseur: nbBorne(b?.tracee?.epaisseur, EPAISSEUR_TRAIT_MIN, EPAISSEUR_TRAIT_MAX, EPAISSEUR_TRAIT_DEFAUT),
    },
    image: {
      src: srcImage,
      largeurNative: nbOuNull(b?.image?.largeurNative ?? b?.televersee?.largeurNative),
      hauteurNative: nbOuNull(b?.image?.hauteurNative ?? b?.televersee?.hauteurNative),
      detoure: bool(b?.image?.detoure, false),
    },
    dactylographiee: {
      texte: texteDactylo,
      police,
      taille: nbBorne(b?.dactylographiee?.taille, TAILLE_DACTYLO_MIN, TAILLE_DACTYLO_MAX, TAILLE_DACTYLO_DEFAUT),
    },
    hauteur: nbBorne(
      b?.hauteur ?? b?.image?.hauteur,
      HAUTEUR_SIGNATURE_MIN,
      HAUTEUR_SIGNATURE_MAX,
      HAUTEUR_SIGNATURE_DEFAUT,
    ),
  };
}

/** Vrai si le bloc de texte porte au moins une ligne écrite. */
export function blocRenseigne(signature) {
  const s = normaliserSignature(signature);
  return Boolean(s.mention || s.nom || s.fonction || (s.afficherDate && s.date));
}

/**
 * La signature est-elle POSABLE, et sinon POURQUOI.
 *
 * ⛔ Chaque refus NOMME ce qui manque. Une voie choisie mais vide n'est pas remplacée
 * par une autre voie ni par un dessin par défaut : elle est refusée, et le panneau
 * l'affiche.
 *
 * @returns {{prete:boolean, raison:string|null, dessin:boolean}}
 */
export function signaturePrete(signature) {
  const s = normaliserSignature(signature);
  if (!s.voie) {
    // Le bloc seul (« Pour la direction, / Nom / Fonction / Date ») est un usage
    // légitime : on ne réclame une voie que s'il n'y a RIEN du tout.
    return {
      prete: blocRenseigne(s),
      raison: blocRenseigne(s) ? null : 'aucun champ de signature renseigné : ni voie choisie, ni bloc écrit',
      dessin: false,
    };
  }
  if (s.voie === VOIE_TRACEE) {
    if (!s.tracee.traits.length) return { prete: false, raison: 'voie « tracée » choisie mais aucun trait n’a été dessiné', dessin: false };
    return { prete: true, raison: null, dessin: true };
  }
  if (s.voie === VOIE_TELEVERSEE) {
    if (!s.image.src) return { prete: false, raison: 'voie « photo ou scan » choisie mais aucune image n’a été téléversée', dessin: false };
    return { prete: true, raison: null, dessin: true };
  }
  if (!s.dactylographiee.texte) {
    return { prete: false, raison: 'voie « nom dactylographié » choisie mais le nom à écrire est vide', dessin: false };
  }
  return { prete: true, raison: null, dessin: true };
}

/**
 * Ce qu'il faut DIRE à l'utilisateur avant qu'il exporte. Rien d'alarmiste : des faits
 * mesurables sur cette signature précise.
 * @returns {string[]}
 */
export function avertissementsSignature(signature) {
  const s = normaliserSignature(signature);
  const out = [];
  if (s.voie === VOIE_TELEVERSEE && s.image.src && !s.image.largeurNative) {
    out.push('Dimensions natives inconnues : l’image sera posée dans un carré (aucun rapport inventé).');
  }
  if (s.voie === VOIE_TELEVERSEE && s.image.src && !s.image.detoure) {
    out.push('Fond non détouré : un scan sur papier blanc masquera ce qui se trouve dessous.');
  }
  if (s.voie === VOIE_DACTYLO && s.dactylographiee.texte) {
    out.push('Aucune police manuscrite n’est fournie par l’application : le dessin dépend de celles installées sur cette machine.');
    out.push('À l’export PDF, la police manuscrite n’est pas embarquée : laissé en texte, le nom sortira en Times. Figez-le en image pour garder le tracé.');
  }
  return out;
}

/** Où en est la signature — sert au panneau pour dire l'état sans le deviner. */
export function resumeSignature(signature) {
  const s = normaliserSignature(signature);
  const { prete, raison, dessin } = signaturePrete(s);
  return {
    voie: s.voie,
    voieLabel: VOIES_SIGNATURE.find((v) => v.id === s.voie)?.label ?? '',
    prete,
    raison,
    dessin,
    bloc: blocRenseigne(s),
    nbTraits: s.tracee.traits.length,
    avertissements: avertissementsSignature(s),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Fabrication des objets
═══════════════════════════════════════════════════════════════════ */

/**
 * ⛔ PIÈGE DÉJÀ SURVENU SUR LE LOGO (documentIdentite, 2026-08-06) : sans
 * `content.natif`, `adapterImagesAuCanevas` (useSmartboardKonvaStore) considère
 * l'image comme NON MESURÉE et lui impose un CARRÉ neutre — un logo 675×900 posé en
 * 33×44 ressortait en 48×48. Toute image de signature TRANSMET donc ses dimensions
 * natives.
 */
function mkImage({ id, src, x, y, width, height, meta, natif = null }) {
  const mesure = natif && natif.largeurNative > 0 && natif.hauteurNative > 0
    ? { natif: { largeurNative: natif.largeurNative, hauteurNative: natif.hauteurNative } }
    : null;
  return {
    id,
    type: 'image',
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    rotation: 0,
    layer: 3,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    opacity: 1,
    content: { src, ...(mesure ?? {}) },
    style: {},
    meta,
  };
}

function mkTexte({ id, x, y, width, height, texte, style, meta }) {
  return {
    id,
    type: 'text',
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    rotation: 0,
    layer: 3,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    opacity: 1,
    content: { text: texte },
    style: {
      fontFamily: 'Georgia, serif',
      fontSize: TAILLE_TEXTE_BLOC,
      fontWeight: 400,
      fontStyle: 'normal',
      fill: DOC_INK,
      align: 'left',
      lineHeight: 1.4,
      letterSpacing: 0,
      ...style,
    },
    meta,
  };
}

/** Boîte d'une image de signature. Sans dimensions natives on ne DEVINE pas : carré. */
function boiteImage(image, hauteurVoulue, largeurMax) {
  const h = nbBorne(hauteurVoulue, HAUTEUR_SIGNATURE_MIN, HAUTEUR_SIGNATURE_MAX, HAUTEUR_SIGNATURE_DEFAUT);
  const lMax = Math.max(24, Math.round(largeurMax));
  if (image.largeurNative && image.hauteurNative) {
    const b = boiteAuFormat({
      largeurNative: image.largeurNative,
      hauteurNative: image.hauteurNative,
      largeurMax: lMax,
      hauteurMax: h,
      agrandir: true,
      tailleMin: HAUTEUR_SIGNATURE_MIN,
    });
    return { width: b.width, height: b.height, mesuree: true };
  }
  const cote = Math.min(h, lMax);
  return { width: cote, height: cote, mesuree: false };
}

/** Lignes du bloc, dans l'ordre imprimé. La date n'y entre que si on l'a demandée. */
export function lignesBloc(signature) {
  const s = normaliserSignature(signature);
  const lignes = [s.mention, s.nom, s.fonction].filter(Boolean);
  if (s.afficherDate && s.date) lignes.push(s.date);
  return lignes;
}

/**
 * Objets d'UNE signature : le dessin (selon la voie) puis le bloc de texte.
 *
 * ⛔ Rien n'est posé de force : si la voie choisie est vide, `objets` est VIDE et
 * `raison` dit lequel des trois champs manque. Le bloc de texte, lui, peut être posé
 * seul (« Pour la direction, / Nom / Fonction / Date » sans dessin) — c'est un usage
 * légitime, pas un défaut silencieux.
 *
 * @param {{signature:object, x:number, y:number, largeur:number,
 *          police?:string, encre?:string, groupe?:string, meta?:object}} p
 * @returns {{objets:object[], hauteur:number, mesuree:boolean, raison:string|null,
 *            groupe:string, avertissements:string[]}}
 */
export function objetsDeSignature({
  signature,
  x = 0,
  y = 0,
  largeur = LARGEUR_BLOC_SIGNATURE,
  police = 'Georgia, serif',
  encre = DOC_INK,
  groupe = '',
  meta = {},
} = {}) {
  const s = normaliserSignature(signature);
  const g = txt(groupe) || uid('sig');
  const marqueur = { doc: DOC_META_BLOC, role: ROLE_SIGNATURE, groupe: g, ...meta };
  const etat = signaturePrete(s);
  const objets = [];
  let curseur = y;
  let mesuree = true;

  if (s.voie && !etat.prete) {
    return { objets: [], hauteur: 0, mesuree: true, raison: etat.raison, groupe: g, avertissements: [] };
  }

  if (s.voie === VOIE_TRACEE && s.tracee.traits.length) {
    const trace = tracesEnObjets({
      traits: s.tracee.traits,
      x,
      y: curseur,
      hauteur: s.hauteur,
      largeurMax: largeur,
      couleur: s.tracee.couleur,
      epaisseur: s.tracee.epaisseur,
      groupe: g,
      meta,
    });
    if (trace) {
      objets.push(...trace.objets);
      curseur += trace.height + ECART_DESSIN_BLOC;
    }
  } else if (s.voie === VOIE_TELEVERSEE && s.image.src) {
    const b = boiteImage(s.image, s.hauteur, largeur);
    mesuree = b.mesuree;
    objets.push(mkImage({
      id: uid('sig_img'),
      src: s.image.src,
      x,
      y: curseur,
      width: b.width,
      height: b.height,
      natif: { largeurNative: s.image.largeurNative, hauteurNative: s.image.hauteurNative },
      meta: { ...marqueur, voie: VOIE_TELEVERSEE },
    }));
    curseur += b.height + ECART_DESSIN_BLOC;
  } else if (s.voie === VOIE_DACTYLO && s.dactylographiee.texte) {
    const taille = s.dactylographiee.taille;
    const famille = s.dactylographiee.police || POLICES_MANUSCRITES[0].valeur;
    const h = estimateTextHeight(s.dactylographiee.texte, taille, largeur);
    objets.push(mkTexte({
      id: uid('sig_nom'),
      x,
      y: curseur,
      width: largeur,
      height: h,
      texte: s.dactylographiee.texte,
      style: { fontFamily: famille, fontSize: taille, fontWeight: 400, fill: encre, align: 'left', lineHeight: 1.2 },
      meta: { ...marqueur, voie: VOIE_DACTYLO },
    }));
    curseur += h + ECART_DESSIN_BLOC;
  }

  const lignes = lignesBloc(s);
  if (lignes.length) {
    const texte = lignes.join('\n');
    const h = estimateTextHeight(texte, TAILLE_TEXTE_BLOC, largeur);
    objets.push(mkTexte({
      id: uid('sig_bloc'),
      x,
      y: curseur,
      width: largeur,
      height: h,
      texte,
      style: {
        fontFamily: police,
        fontSize: TAILLE_TEXTE_BLOC,
        fontWeight: s.nom ? 600 : 400,
        fill: encre,
        align: 'left',
        lineHeight: 1.5,
      },
      meta: { ...marqueur, voie: s.voie || '' },
    }));
    curseur += h;
  }

  return {
    objets,
    hauteur: objets.length ? curseur - y : 0,
    mesuree,
    raison: objets.length ? null : (etat.raison || 'aucun champ de signature renseigné'),
    groupe: g,
    avertissements: avertissementsSignature(s),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Pose sur un document
═══════════════════════════════════════════════════════════════════ */

/** Ids des signatures déjà posées (celles de ce module ET celles de l'identité). */
export function idsSignaturesPosees(objets) {
  const liste = Array.isArray(objets) ? objets : [];
  return liste.filter((o) => o?.id && o?.meta?.role === ROLE_SIGNATURE).map((o) => o.id);
}

/** Suppressions seules — « Retirer la signature du document ». */
export function retirerSignature(objets) {
  return { suppressions: idsSignaturesPosees(objets) };
}

/**
 * Pose une signature à un endroit CHOISI. NE MUTE RIEN, N'ÉCRIT RIEN.
 *
 * ⛔ La signature n'est jamais posée hors page : si elle ne tient pas sous l'ancrage
 * demandé, elle remonte ; si elle ne tient toujours pas, elle N'EST PAS POSÉE et la
 * raison est rendue. Une signature hors page est invisible à l'écran et bien présente
 * au PDF — c'est le pire des deux mondes.
 *
 * ⛔ `position` accepte `{x, y}` EXACTS (le point posé par l'utilisateur) ou l'un des
 * {@link ANCRAGES_SIGNATURE}. Un ancrage inconnu n'est pas remplacé en silence : il
 * est refusé en le nommant.
 *
 * @param {{signature:object, objets?:object[],
 *          page?:{format?:string|object, marges?:object, ecart?:number, index?:number, nbPages?:number},
 *          position?:{x:number,y:number}|string, largeur?:number,
 *          remplacer?:boolean, police?:string, encre?:string}} p
 * @returns {{ajouts:object[], patches:[], suppressions:string[], placee:boolean,
 *            raison:string|null, recalee:boolean, mesuree:boolean, groupe:string,
 *            boite:object|null, avertissements:string[]}}
 */
export function appliquerSignature({
  signature,
  objets = [],
  page = {},
  position = ANCRAGE_DEFAUT,
  largeur,
  remplacer = true,
  police = 'Georgia, serif',
  encre = DOC_INK,
} = {}) {
  const s = normaliserSignature(signature);
  const f = resoudreFormat(page.format ?? FORMAT_DEFAUT);
  const m = resoudreMarges(page.marges ?? MARGES_DEFAUT);
  const ecart = Number.isFinite(Number(page.ecart)) ? Number(page.ecart) : ECART_PAGES_DEFAUT;
  const nbPages = Math.max(1, Math.trunc(Number(page.nbPages) || 1));
  const index = Math.min(nbPages - 1, Math.max(0, Math.trunc(Number(page.index) || 0)));
  const z = zoneUtile(f, m);
  const y0 = origineDePage(index, f, ecart);
  const liste = Array.isArray(objets) ? objets.filter(Boolean) : [];

  const vide = { ajouts: [], patches: [], suppressions: [], placee: false, mesuree: true, groupe: '', boite: null, avertissements: avertissementsSignature(s) };

  const etat = signaturePrete(s);
  if (!etat.prete) return { ...vide, raison: etat.raison };

  const lBloc = Math.min(Number(largeur) || LARGEUR_BLOC_SIGNATURE, z.largeur);

  let x;
  let yDepart;
  if (position && typeof position === 'object') {
    const px = Number(position.x);
    const py = Number(position.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      return { ...vide, raison: 'position fournie sans coordonnées exploitables (x, y)' };
    }
    x = px;
    yDepart = py;
  } else {
    const ancrage = txt(position) || ANCRAGE_DEFAUT;
    if (!ANCRAGES_SIGNATURE.some((a) => a.id === ancrage)) {
      return { ...vide, raison: `ancrage inconnu « ${ancrage} »` };
    }
    if (ancrage === 'bas-gauche') x = z.gauche;
    else if (ancrage === 'bas-centre') x = z.gauche + (z.largeur - lBloc) / 2;
    else x = z.droite - lBloc;
    // Placé au ras du bas de la zone utile : la hauteur exacte n'est connue qu'après
    // fabrication, donc on fabrique d'abord à y=0 puis on recale.
    yDepart = y0 + z.bas;
  }

  const essai = objetsDeSignature({ signature: s, x, y: 0, largeur: lBloc, police, encre });
  if (!essai.objets.length) return { ...vide, raison: essai.raison, groupe: essai.groupe };

  const ancre = !(position && typeof position === 'object');
  let yFinal = ancre ? yDepart - essai.hauteur : yDepart;

  /* ⛔ Recalage AVANT refus : une signature demandée trop bas (ou trop haut) est
     RAMENÉE dans la zone utile, pas rejetée — c'est ce que l'utilisateur voulait, à
     quelques pixels près. Le refus est réservé au cas où elle ne peut PAS tenir. */
  const plafond = y0 + z.haut;
  const plancher = y0 + z.bas;
  let recalee = false;
  if (essai.hauteur > z.hauteur) {
    return {
      ...vide,
      groupe: essai.groupe,
      raison: `la signature (${Math.round(essai.hauteur)} px) ne tient pas dans la zone utile de la page ${index + 1} (${Math.round(z.hauteur)} px)`,
    };
  }
  if (yFinal + essai.hauteur > plancher) { yFinal = plancher - essai.hauteur; recalee = true; }
  if (yFinal < plafond) { yFinal = plafond; recalee = true; }

  const bloc = objetsDeSignature({
    signature: s,
    x,
    y: yFinal,
    largeur: lBloc,
    police,
    encre,
    groupe: essai.groupe,
  });

  const suppressions = remplacer ? idsSignaturesPosees(liste) : [];

  return {
    ajouts: bloc.objets,
    patches: [],
    suppressions,
    placee: true,
    raison: null,
    recalee,
    mesuree: bloc.mesuree,
    groupe: bloc.groupe,
    boite: { x: Math.round(x), y: Math.round(yFinal), largeur: lBloc, hauteur: Math.round(bloc.hauteur) },
    avertissements: bloc.avertissements,
  };
}

/** État de la pose dans un document — sert au panneau pour activer « Retirer ». */
export function signaturePosee(objets) {
  const liste = Array.isArray(objets) ? objets : [];
  const marques = liste.filter((o) => o?.meta?.role === ROLE_SIGNATURE);
  const groupes = [...new Set(marques.map((o) => o?.meta?.groupe).filter(Boolean))];
  return {
    posee: marques.length > 0,
    nbObjets: marques.length,
    groupes,
    voies: [...new Set(marques.map((o) => o?.meta?.voie).filter(Boolean))],
  };
}
