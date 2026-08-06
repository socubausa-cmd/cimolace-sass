/**
 * documentFiligrane — le filigrane d'un document : une marque RÉPÉTÉE sur chaque
 * page, DERRIÈRE tout le contenu (BROUILLON, CONFIDENTIEL, COPIE… ou le logo atténué).
 *
 * ⛔ CE FICHIER N'ÉCRIT RIEN. Comme documentPagination et documentIdentite, il rend
 * des `{ ajouts, patches, suppressions }` que l'appelant applique en UN pas
 * d'historique (cf. `appliquerMutationDocument` dans components/DocumentBusinessPanels.jsx).
 *
 * ⛔ CE N'EST PAS UNE MARQUE PROBANTE. Un filigrane posé ici est du texte ou une
 * image dans un PDF : il ne certifie rien, il n'horodate rien, il n'authentifie rien.
 * Aucun libellé de ce fichier ne le laisse croire — {@link MOTIFS_FILIGRANE} ne
 * contient que des mots que l'utilisateur choisit lui-même.
 *
 * ⛔ RIEN N'EST INVENTÉ : {@link filigraneVide} naît SANS texte et SANS image. Seules
 * les GÉOMÉTRIES ont un défaut (angle, opacité, taille, disposition) — ce sont des
 * choix de mise en page, pas du contenu. Quand le contenu manque,
 * {@link appliquerFiligrane} REFUSE en le NOMMANT (`refus`) au lieu de poser un
 * « BROUILLON » que personne n'a demandé.
 *
 * ═══ LES QUATRE CONTRAINTES QUI ONT DICTÉ CE FICHIER ═══
 *
 * 1. DERRIÈRE, ET L'ORDRE SE JOUE SUR `layer`. Le canevas rend `sortObjectsByLayer`
 *    (model/sceneModel.js) : `layer × 100000 + index`, l'index ne départage que les
 *    ex æquo. Un filigrane ajouté en dernier avec le `layer` par défaut (0) passe
 *    DEVANT le texte. {@link layerDeFond} lui donne donc un `layer` STRICTEMENT
 *    inférieur au minimum des objets présents (et ≤ −1 sur un document vide, parce
 *    que 0 est la valeur par défaut, pas l'arrière-plan — cf. `sendToBack` du store).
 *
 * 2. HORS DU FLUX. Le filigrane ne pousse rien, ne réserve rien : `appliquerFiligrane`
 *    rend `patches: []`, toujours. Il naît `locked: true` — un clic sur le contenu ne
 *    doit pas l'attraper (le store expose `toggleObjectLock` pour le déverrouiller).
 *    Il ne porte PAS `meta.doc = 'entete-pied'` : `reserveDesBandes` en ferait une
 *    bande d'en-tête haute d'une page entière et tout le corps descendrait.
 *
 * 3. LA CRITIQUE DOIT SE TAIRE DESSUS — ET SEULEMENT DESSUS. Un filigrane diagonal
 *    est un objet dont la BOÎTE n'est pas l'empreinte : sa boîte non pivotée déborde
 *    forcément la page (mesuré : x = −130, x2 = 873 sur une page de 794). Jugé comme
 *    un bloc ordinaire il déclencherait `debordement` (bloquant), `marges`,
 *    `chevauchement`, `alignement`, `contraste` et `occultation` sur CHAQUE document
 *    filigrané. `critiquerMiseEnPage` l'écarte donc par son `meta` — et par lui seul :
 *    aucune heuristique de taille, sinon trois images empilées redeviendraient
 *    invisibles à la critique (c'est le défaut d'origine de la règle `occultation`).
 *
 * 4. LES DIMENSIONS NATIVES ACCOMPAGNENT TOUTE IMAGE. Sans `content.natif`, le store
 *    (`adapterImagesAuCanevas`) impose une boîte NEUTRE carrée — c'est ce qui a sorti
 *    le logo en 48 × 48 au lieu de 33 × 44. Un filigrane image sans dimensions natives
 *    est donc REFUSÉ, pas deviné.
 *
 * ═══ CONTRAT pour la coque (montage du panneau) ═══
 *
 *   1. Lire/écrire le réglage avec {@link filigraneVide} / {@link normaliserFiligrane}.
 *   2. Poser : `appliquerFiligrane({ filigrane, objets, page: { format, marges, ecart,
 *      nbPages } })`. `page.nbPages` est OBLIGATOIRE — sans lui le module refuse
 *      plutôt que de supposer 1 page et de ne marquer que la première.
 *   3. Le retour porte `refus` (string|null) et `avertissements` (string[]) : les
 *      AFFICHER. Un `refus` non nul ⟹ `ajouts` vide ; le bouton doit le dire.
 *   4. Retirer : {@link retirerFiligrane}. État courant : {@link filigranePose}.
 *   5. ⚠️ APRÈS `addObjects`, POUR UN FILIGRANE IMAGE : le store repositionne et
 *      redimensionne toute image qui n'est pas « plein fond » (`geometrieImage`
 *      → `poserSansEmpiler`). Appliquer ensuite {@link patchesAncrageFiligrane} sur la
 *      scène remet la géométrie voulue. Sans ce second temps, le filigrane image
 *      atterrit ailleurs que là où il est calculé ici.
 *   6. ⚠️ AVANT `paginer()` / « Réorganiser en pages » : filtrer avec
 *      {@link sansFiligrane}. `documentPagination.paginer` ne connaît que les bandes
 *      d'en-tête ; un filigrane pleine page y serait traité comme un bloc de corps
 *      plus haut qu'une page et ouvrirait une page pour lui tout seul.
 *
 * ⚠️ CE QUE CE MODULE NE FAIT PAS : la SIGNATURE. Le bloc de signature vit dans
 * documentIdentite.js (`objetsSignature`, rôle `signature`) et c'est là qu'il faut
 * l'étendre — un second mécanisme concurrent est exclu.
 *
 * Aucun import React, aucun réseau : testable sous `node --test`.
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
import { DOC_INK_SOFT } from './documentBlockLayout.js';

/* ═══════════════════════════════════════════════════════════════════
   Constantes
═══════════════════════════════════════════════════════════════════ */

/** Marqueur porté par TOUT objet posé par ce module. C'est la seule clé de lecture. */
export const META_FILIGRANE = 'filigrane';

/** Vrai pour un objet posé par ce module — utilisé par la critique et par l'export. */
export const estFiligrane = (o) => o?.meta?.doc === META_FILIGRANE;

/**
 * Motifs proposés. `libre` n'a PAS de texte : c'est l'utilisateur qui l'écrit, et
 * tant qu'il ne l'a pas fait la pose est refusée.
 */
export const MOTIFS_FILIGRANE = Object.freeze([
  { id: 'brouillon', texte: 'BROUILLON' },
  { id: 'confidentiel', texte: 'CONFIDENTIEL' },
  { id: 'copie', texte: 'COPIE' },
  { id: 'original', texte: 'ORIGINAL' },
  { id: 'paye', texte: 'PAYÉ' },
  { id: 'libre', texte: '' },
]);

export const DISPOSITIONS = Object.freeze([
  { id: 'centre', label: 'Une seule marque, au centre de la page' },
  { id: 'mosaique', label: 'Marque répétée en mosaïque sur toute la page' },
]);

export const DISPOSITION_DEFAUT = 'centre';

/** Deux natures de filigrane, jamais mélangées dans une même pose. */
export const TYPES_FILIGRANE = Object.freeze(['texte', 'image']);
export const TYPE_DEFAUT = 'texte';

/* Géométries — réglages de mise en page, pas du contenu. */
export const TAILLE_TEXTE_DEFAUT = 96;
export const TAILLE_TEXTE_MIN = 8;
export const TAILLE_TEXTE_MAX = 400;
/** Un filigrane image ne PEUT pas être pivoté : cf. {@link normaliserFiligrane}. */
export const ANGLE_TEXTE_DEFAUT = -45;
export const ANGLE_MIN = -90;
export const ANGLE_MAX = 90;
export const OPACITE_DEFAUT = 0.12;
/**
 * Plancher pour le CURSEUR du panneau. `normaliserFiligrane` ne l'applique pas :
 * une opacité de 0 doit rester lisible telle quelle pour que
 * {@link appliquerFiligrane} la REFUSE en la nommant, au lieu de la remonter en
 * douce à 0,02 et de poser une marque que personne ne voit.
 */
export const OPACITE_MIN = 0.02;
export const OPACITE_MAX = 1;
/** Part de la LARGEUR de page qu'une image de filigrane occupe par défaut. */
export const PART_LARGEUR_IMAGE_DEFAUT = 0.6;
/** Air entre deux tuiles de mosaïque, sur les deux axes. */
export const ECART_MOSAIQUE = 56;
/**
 * Plafond de tuiles PAR PAGE. Une taille de 8 px en mosaïque sur A4 réclamerait
 * plus de 1 500 objets : le document deviendrait inutilisable et l'utilisateur ne
 * saurait pas pourquoi. Au-delà, on refuse en le disant.
 */
export const MAX_TUILES_PAR_PAGE = 60;

/** Graisse du texte de filigrane — une marque doit se lire sous le contenu. */
const GRAISSE_FILIGRANE = 700;
/** Interligne posé sur l'objet ET lu par l'export (documentExport, cas 'text'). */
const INTERLIGNE = 1.2;
/** Police de repli : celle de la page Document (documentBlockLayout). */
const POLICE_DEFAUT = 'Georgia, serif';
/**
 * Largeur moyenne d'un glyphe, en part de la taille de police. documentBlockLayout
 * retient 0,52 pour du texte courant ; un filigrane est en CAPITALES et en gras, donc
 * plus large. 0,78 est volontairement généreux : une boîte trop large ne fait que
 * centrer le texte dans du vide, une boîte trop étroite le fait REVENIR À LA LIGNE.
 */
const RATIO_GLYPHE_CAPITALES = 0.78;

/* ═══════════════════════════════════════════════════════════════════
   Modèle de données
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

/** Couleur retenue seulement si elle est une vraie valeur hexadécimale ; sinon ''. */
export function couleurValide(v) {
  const s = txt(v);
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : '';
}

/**
 * Réglage VIERGE. ⛔ Ni texte, ni image : les seuls défauts sont des géométries.
 * @returns {object}
 */
export function filigraneVide() {
  return {
    /** Le type décide de tout le reste ; il n'y a pas de filigrane « mixte ». */
    type: TYPE_DEFAUT,
    /** Identifiant d'un motif de {@link MOTIFS_FILIGRANE}, ou '' tant qu'aucun choix. */
    motif: '',
    /** Texte saisi — la seule source quand `motif` vaut 'libre' ou ''. */
    texte: '',
    police: '',
    taille: TAILLE_TEXTE_DEFAUT,
    couleur: '',
    opacite: OPACITE_DEFAUT,
    angle: ANGLE_TEXTE_DEFAUT,
    disposition: DISPOSITION_DEFAUT,
    /** Faux ⟹ la marque ne va que sur la première page (choix explicite). */
    toutesLesPages: true,
    image: { src: '', largeurNative: null, hauteurNative: null, largeur: null },
  };
}

/**
 * Rend un réglage complet et sûr à partir d'un objet partiel (formulaire, stockage).
 * Ne comble AUCUN champ de contenu : `texte`, `motif` et `image.src` restent vides.
 *
 * ⛔ L'ANGLE PAR DÉFAUT DÉPEND DU TYPE. `documentExport.dessinerObjet` ne trace PAS la
 * rotation d'une image (cas 'image' : « Rotation non appliquée à une image »). Un
 * filigrane image naît donc à 0° — sinon l'écran et le papier ne diraient pas la même
 * chose. Un angle non nul explicitement demandé sur une image est REFUSÉ, pas ramené
 * à 0 en silence (cf. {@link appliquerFiligrane}).
 *
 * @param {object} [brut]
 */
export function normaliserFiligrane(brut) {
  const b = brut && typeof brut === 'object' ? brut : {};
  const v = filigraneVide();
  const type = TYPES_FILIGRANE.includes(b.type) ? b.type : TYPE_DEFAUT;
  const motif = MOTIFS_FILIGRANE.some((m) => m.id === b.motif) ? b.motif : '';
  const disposition = DISPOSITIONS.some((d) => d.id === b.disposition) ? b.disposition : DISPOSITION_DEFAUT;
  const angleDefaut = type === 'image' ? 0 : ANGLE_TEXTE_DEFAUT;
  const img = b.image && typeof b.image === 'object' ? b.image : {};

  return {
    ...v,
    type,
    motif,
    texte: txt(b.texte),
    police: txt(b.police),
    taille: nbBorne(b.taille, TAILLE_TEXTE_MIN, TAILLE_TEXTE_MAX, TAILLE_TEXTE_DEFAUT),
    couleur: couleurValide(b.couleur),
    opacite: nbBorne(b.opacite, 0, OPACITE_MAX, OPACITE_DEFAUT),
    angle: nbBorne(b.angle, ANGLE_MIN, ANGLE_MAX, angleDefaut),
    disposition,
    toutesLesPages: bool(b.toutesLesPages, true),
    image: {
      src: txt(img.src),
      largeurNative: nbOuNull(img.largeurNative),
      hauteurNative: nbOuNull(img.hauteurNative),
      largeur: nbOuNull(img.largeur),
    },
  };
}

/**
 * Texte RÉELLEMENT posé : celui du motif choisi, ou la saisie libre.
 * Rend '' quand rien n'a été choisi ni écrit — c'est ce '' qui déclenche le refus.
 * @param {object} filigrane
 * @returns {string}
 */
export function texteDuFiligrane(filigrane) {
  const f = normaliserFiligrane(filigrane);
  if (f.motif && f.motif !== 'libre') {
    return MOTIFS_FILIGRANE.find((m) => m.id === f.motif)?.texte ?? '';
  }
  return f.texte;
}

/**
 * Résumé pour le panneau : ce qui manque, dit par son nom.
 * @returns {{vide:boolean, manques:string[], type:string}}
 */
export function resumeFiligrane(filigrane) {
  const f = normaliserFiligrane(filigrane);
  const manques = [];
  if (f.type === 'texte') {
    if (!texteDuFiligrane(f)) manques.push('le texte du filigrane');
  } else {
    if (!f.image.src) manques.push("l'image du filigrane");
    if (!f.image.largeurNative || !f.image.hauteurNative) manques.push("les dimensions natives de l'image");
  }
  if (!(f.opacite > 0)) manques.push('une opacité non nulle');
  return { vide: manques.length > 0, manques, type: f.type };
}

/* ═══════════════════════════════════════════════════════════════════
   Calque de fond
═══════════════════════════════════════════════════════════════════ */

/**
 * `layer` à donner au filigrane pour qu'il soit DERRIÈRE TOUT.
 *
 * ⛔ PIÈGE 1 DE CE FICHIER : `layer: 0` n'est pas l'arrière-plan, c'est le DÉFAUT.
 * Un filigrane à 0 posé après le corps (également à 0) est départagé par l'index et
 * passe DEVANT — le document devient illisible. On rend donc `min − 1`, borné à −1.
 *
 * Les filigranes déjà posés sont ignorés : sans ça, chaque réapplication ferait
 * descendre le calque d'un cran sans fin.
 *
 * @param {object[]} objets
 * @returns {number} strictement inférieur au `layer` de tout objet non-filigrane
 */
export function layerDeFond(objets) {
  const liste = (Array.isArray(objets) ? objets : []).filter((o) => o && !estFiligrane(o));
  let min = 0;
  for (const o of liste) {
    const l = Number(o.layer);
    if (Number.isFinite(l) && l < min) min = l;
  }
  return min - 1;
}

/* ═══════════════════════════════════════════════════════════════════
   Géométrie
═══════════════════════════════════════════════════════════════════ */

const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Position de l'ancre (x, y) d'un bloc dont on veut que le CENTRE VISUEL tombe en
 * (cx, cy) une fois pivoté de `angle`.
 *
 * ⛔ LE PIVOT EST L'ANGLE HAUT-GAUCHE, PAS LE CENTRE. Konva rend le texte avec
 * `x={obj.x} y={obj.y}` et `offsetX/offsetY = 0` (canvas/KonvaBoardObject.jsx) : la
 * rotation tourne autour de (x, y). Placer naïvement le bloc centré puis le pivoter
 * l'envoie ailleurs — mesuré à 234 px de dérive pour une boîte de 600 × 120 à −45°.
 */
function ancrePourCentre(cx, cy, largeur, hauteur, angle) {
  const a = rad(angle);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = largeur / 2;
  const dy = hauteur / 2;
  return {
    x: Math.round(cx - (dx * cos - dy * sin)),
    y: Math.round(cy - (dx * sin + dy * cos)),
  };
}

/** Empreinte au sol d'une boîte pivotée — sert au pas de la mosaïque. */
function empreintePivotee(largeur, hauteur, angle) {
  const a = rad(angle);
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  return {
    largeur: largeur * cos + hauteur * sin,
    hauteur: largeur * sin + hauteur * cos,
  };
}

/** Boîte NON pivotée d'un texte de filigrane, tenu sur une seule ligne. */
function boiteTexte(texte, taille) {
  const nb = Math.max(1, String(texte).length);
  return {
    largeur: Math.ceil(nb * taille * RATIO_GLYPHE_CAPITALES) + 2 * taille,
    hauteur: Math.round(taille * INTERLIGNE),
  };
}

/** Centres des tuiles d'une page, disposition comprise. */
function centresDesTuiles({ disposition, largeurPage, hauteurPage, y0, empreinte }) {
  if (disposition !== 'mosaique') {
    return [{ cx: largeurPage / 2, cy: y0 + hauteurPage / 2 }];
  }
  const pasX = Math.max(1, empreinte.largeur + ECART_MOSAIQUE);
  const pasY = Math.max(1, empreinte.hauteur + ECART_MOSAIQUE);
  const colonnes = Math.max(1, Math.ceil(largeurPage / pasX));
  const lignes = Math.max(1, Math.ceil(hauteurPage / pasY));
  /* Le reliquat est réparti pour que la grille reste CENTRÉE sur la page : une
     mosaïque calée en haut à gauche laisse une bande vide en bas à droite. */
  const margeX = (largeurPage - colonnes * pasX) / 2;
  const margeY = (hauteurPage - lignes * pasY) / 2;
  const out = [];
  for (let j = 0; j < lignes; j += 1) {
    for (let i = 0; i < colonnes; i += 1) {
      out.push({
        cx: margeX + (i + 0.5) * pasX,
        cy: y0 + margeY + (j + 0.5) * pasY,
      });
    }
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   Fabrication des objets
═══════════════════════════════════════════════════════════════════ */

function metaFiligrane({ page, type, disposition, ancrage }) {
  return {
    doc: META_FILIGRANE,
    role: 'filigrane',
    page,
    filigrane: { type, disposition, ancrage },
    /* La hauteur ne doit plus être recalculée au rendu : `ajusterHauteurTexte`
       (store) réécrirait `height`, et c'est `height` qui a servi à calculer
       l'ancre de rotation — la marque glisserait toute seule. */
    texte: { hauteurManuelle: true },
  };
}

function mkTexteFiligrane({ x, y, largeur, hauteur, texte, f, layer, page }) {
  const ancrage = { x, y, width: largeur, height: hauteur };
  return {
    id: uid('filig'),
    type: 'text',
    x,
    y,
    width: largeur,
    height: hauteur,
    rotation: f.angle,
    layer,
    visible: true,
    /* Verrouillé : un clic sur le contenu ne doit pas attraper le fond. */
    locked: true,
    step: 0,
    visibleFor: 'both',
    opacity: f.opacite,
    content: { text: texte },
    style: {
      fontFamily: f.police || POLICE_DEFAUT,
      fontSize: f.taille,
      fontWeight: GRAISSE_FILIGRANE,
      fontStyle: 'normal',
      fill: f.couleur || DOC_INK_SOFT,
      align: 'center',
      lineHeight: INTERLIGNE,
      letterSpacing: 0,
    },
    meta: metaFiligrane({ page, type: 'texte', disposition: f.disposition, ancrage }),
  };
}

function mkImageFiligrane({ x, y, largeur, hauteur, f, layer, page }) {
  const ancrage = { x, y, width: largeur, height: hauteur };
  return {
    id: uid('filig'),
    type: 'image',
    x,
    y,
    width: largeur,
    height: hauteur,
    rotation: 0,
    layer,
    visible: true,
    locked: true,
    step: 0,
    visibleFor: 'both',
    opacity: f.opacite,
    content: {
      src: f.image.src,
      /* ⛔ PIÈGE 4 : sans `content.natif`, le store impose une boîte NEUTRE carrée
         (`adapterImagesAuCanevas`). C'est ce qui a sorti le logo en 48 × 48. */
      natif: {
        largeurNative: f.image.largeurNative,
        hauteurNative: f.image.hauteurNative,
      },
    },
    style: { ajustement: 'contain' },
    meta: metaFiligrane({ page, type: 'image', disposition: f.disposition, ancrage }),
  };
}

/**
 * Objets du filigrane, page par page. Aucune écriture, aucune validation : c'est
 * {@link appliquerFiligrane} qui refuse ce qui doit l'être.
 *
 * @param {{filigrane:object, nbPages?:number, format?:string|object, marges?:object,
 *          ecart?:number, layer?:number}} p
 * @returns {{objets:object[], tuilesParPage:number, boite:{largeur:number,hauteur:number}}}
 */
export function objetsFiligrane({
  filigrane,
  nbPages = 1,
  format = FORMAT_DEFAUT,
  marges = MARGES_DEFAUT,
  ecart = ECART_PAGES_DEFAUT,
  layer = -1,
} = {}) {
  const f = normaliserFiligrane(filigrane);
  const fmt = resoudreFormat(format);
  const m = resoudreMarges(marges);
  const z = zoneUtile(fmt, m);
  const n = Math.max(1, Math.trunc(Number(nbPages) || 1));

  let boite;
  if (f.type === 'image') {
    /* Défaut assis sur la ZONE UTILE, pas sur la page : une marque qui mord la marge
       se fait rogner par les imprimantes à bord perdu. La largeur explicitement
       demandée, elle, est respectée telle quelle. */
    const largeurVoulue = f.image.largeur ?? Math.round(z.largeur * PART_LARGEUR_IMAGE_DEFAUT);
    const b = boiteAuFormat({
      largeurNative: f.image.largeurNative,
      hauteurNative: f.image.hauteurNative,
      largeurMax: Math.min(largeurVoulue, fmt.largeur),
      hauteurMax: Math.min(largeurVoulue, fmt.hauteur),
      /* Un filigrane doit COUVRIR : on l'autorise à dépasser sa taille native, comme
         un fond d'affiche (cf. `geometrieImage` du store). */
      agrandir: true,
    });
    boite = { largeur: b.width, hauteur: b.height };
  } else {
    boite = boiteTexte(texteDuFiligrane(f), f.taille);
  }

  const angle = f.type === 'image' ? 0 : f.angle;
  const empreinte = empreintePivotee(boite.largeur, boite.hauteur, angle);
  const objets = [];
  let tuilesParPage = 0;

  for (let p = 0; p < n; p += 1) {
    const y0 = origineDePage(p, fmt, ecart);
    const centres = centresDesTuiles({
      disposition: f.disposition,
      largeurPage: fmt.largeur,
      hauteurPage: fmt.hauteur,
      y0,
      empreinte,
    });
    tuilesParPage = centres.length;
    for (const c of centres) {
      const ancre = f.type === 'image'
        ? { x: Math.round(c.cx - boite.largeur / 2), y: Math.round(c.cy - boite.hauteur / 2) }
        : ancrePourCentre(c.cx, c.cy, boite.largeur, boite.hauteur, angle);
      objets.push(
        f.type === 'image'
          ? mkImageFiligrane({ ...ancre, largeur: boite.largeur, hauteur: boite.hauteur, f, layer, page: p })
          : mkTexteFiligrane({
            ...ancre,
            largeur: boite.largeur,
            hauteur: boite.hauteur,
            texte: texteDuFiligrane(f),
            f,
            layer,
            page: p,
          }),
      );
    }
  }

  /* La GRILLE, elle, couvre la PAGE entière et non la zone utile : un filigrane est
     un fond, il ne s'arrête pas aux marges. */
  return { objets, tuilesParPage, boite };
}

/* ═══════════════════════════════════════════════════════════════════
   Mutation
═══════════════════════════════════════════════════════════════════ */

/**
 * Applique un filigrane à un document. NE MUTE RIEN, N'ÉCRIT RIEN.
 *
 * ⛔ `patches` est TOUJOURS vide : le filigrane ne pousse aucun contenu, ne réserve
 * aucune bande. Il n'est pas dans le flux.
 *
 * ⛔ REFUS PLUTÔT QUE DÉFAUT SILENCIEUX. Un `refus` non nul ⟹ `ajouts: []` et rien
 * n'est supprimé : l'état du document ne change pas et la raison est nommée.
 *
 * @param {{filigrane:object,
 *          objets?:object[],
 *          page?:{format?:string|object, marges?:object, nbPages?:number, ecart?:number}}} p
 * @returns {{ajouts:object[], patches:[], suppressions:string[], layer:number,
 *            refus:string|null, avertissements:string[],
 *            resume:{tuilesParPage:number, pages:number, objets:number}}}
 */
export function appliquerFiligrane({ filigrane, objets = [], page = {} } = {}) {
  const f = normaliserFiligrane(filigrane);
  const liste = Array.isArray(objets) ? objets.filter(Boolean) : [];
  const avertissements = [];
  const vide = {
    ajouts: [],
    patches: [],
    suppressions: [],
    layer: layerDeFond(liste),
    avertissements,
    resume: { tuilesParPage: 0, pages: 0, objets: 0 },
  };

  /* ⛔ `nbPages` est OBLIGATOIRE. Supposer 1 sur un document de 3 pages ne marquerait
     que la première : une valeur absente traitée comme une valeur voulue, c'est la
     famille de pertes de données que ce dépôt paie déjà sept fois. */
  const nbPagesBrut = Number(page?.nbPages);
  if (!Number.isFinite(nbPagesBrut) || nbPagesBrut < 1) {
    return { ...vide, refus: "nombre de pages non fourni (page.nbPages) : impossible de savoir sur combien de pages répéter le filigrane" };
  }
  const nbPagesDoc = Math.trunc(nbPagesBrut);
  const nbPages = f.toutesLesPages ? nbPagesDoc : 1;
  if (!f.toutesLesPages && nbPagesDoc > 1) {
    avertissements.push(`Filigrane posé sur la première page seulement (${nbPagesDoc} pages dans le document).`);
  }

  if (!(f.opacite > 0)) {
    return { ...vide, refus: 'opacité nulle : le filigrane serait invisible à l’écran comme au PDF' };
  }

  if (f.type === 'texte') {
    if (!texteDuFiligrane(f)) {
      return { ...vide, refus: 'aucun texte de filigrane : choisissez un motif ou saisissez le vôtre' };
    }
  } else {
    if (!f.image.src) {
      return { ...vide, refus: 'aucune image de filigrane : téléversez-en une' };
    }
    if (!f.image.largeurNative || !f.image.hauteurNative) {
      return {
        ...vide,
        refus: "dimensions natives de l’image inconnues : mesurez-la (documentImages.mesurerImage) avant de la poser, sinon le canevas lui impose une boîte carrée",
      };
    }
    if (f.angle !== 0) {
      return {
        ...vide,
        refus: "angle non nul sur un filigrane image : la rotation d’une image n’est pas tracée dans le PDF (documentExport, cas « image ») — l’écran et le papier ne diraient pas la même chose. Mettez l’angle à 0, ou choisissez un filigrane texte",
      };
    }
  }

  const layer = layerDeFond(liste);
  const { objets: poses, tuilesParPage, boite } = objetsFiligrane({
    filigrane: f,
    nbPages,
    format: page.format,
    marges: page.marges,
    ecart: page.ecart,
    layer,
  });

  if (tuilesParPage > MAX_TUILES_PAR_PAGE) {
    return {
      ...vide,
      refus: `mosaïque trop dense : ${tuilesParPage} marques par page (plafond ${MAX_TUILES_PAR_PAGE}). Augmentez la taille du filigrane ou passez en disposition « centre »`,
    };
  }

  /**
   * ⛔ ANCRE AU-DESSUS DE SA PAGE = MARQUE TÉLÉPORTÉE. `documentExport.paginerObjets`
   * lit `meta.page` puis décide si `y` est absolu ou déjà local : « un y local est
   * toujours < le pas ». Une ancre locale NÉGATIVE (texte très long à angle positif,
   * dont l'ancre part au-dessus du bord haut) casse cette lecture et la marque de la
   * page 2 est tracée à l'intérieur de la page 2 au lieu de la déborder par le haut.
   * On refuse au lieu de rogner en silence.
   */
  const fmt = resoudreFormat(page.format);
  const ecartPages = Number.isFinite(Number(page.ecart)) ? Number(page.ecart) : undefined;
  const horsHaut = poses.some((o) => o.y - origineDePage(Number(o.meta?.page) || 0, fmt, ecartPages) < 0);
  if (horsHaut) {
    return {
      ...vide,
      refus: `filigrane trop long pour cet angle : son point d’ancrage sort par le haut de la page. Réduisez la taille (${f.taille} px), raccourcissez le texte, ou rapprochez l’angle de 0°`,
    };
  }

  /* Remplacement, pas empilement : reposer sans retirer laisserait deux filigranes
     superposés dont l'un serait invisible et impossible à désigner. */
  const suppressions = retirerFiligrane(liste).suppressions;

  return {
    ajouts: poses,
    patches: [],
    suppressions,
    layer,
    refus: null,
    avertissements,
    resume: { tuilesParPage, pages: nbPages, objets: poses.length },
  };
}

/**
 * Suppressions seules — « Retirer le filigrane ».
 * @param {object[]} objets
 * @returns {{suppressions:string[]}}
 */
export function retirerFiligrane(objets) {
  const liste = Array.isArray(objets) ? objets : [];
  return { suppressions: liste.filter((o) => estFiligrane(o) && o?.id).map((o) => o.id) };
}

/**
 * État de la pose dans un document — sur le modèle d'`identitePosee`.
 *
 * @param {object[]} objets
 * @param {number} [nbPages]
 * @returns {{posee:boolean, type:string|null, disposition:string|null, layer:number|null,
 *            pages:number[], pagesManquantes:number[], devant:boolean}}
 */
export function filigranePose(objets, nbPages = 1) {
  const liste = (Array.isArray(objets) ? objets : []).filter(estFiligrane);
  const n = Math.max(1, Math.trunc(Number(nbPages) || 1));
  if (!liste.length) {
    return { posee: false, type: null, disposition: null, layer: null, pages: [], pagesManquantes: [], devant: false };
  }
  const pages = [...new Set(liste.map((o) => Number(o.meta?.page) || 0))].sort((a, b) => a - b);
  const pagesManquantes = [];
  for (let p = 0; p < n; p += 1) if (!pages.includes(p)) pagesManquantes.push(p);

  const layerFiligrane = Math.min(...liste.map((o) => Number(o.layer) || 0));
  const autres = (Array.isArray(objets) ? objets : []).filter((o) => o && !estFiligrane(o));
  const layerMinAutres = autres.length
    ? Math.min(...autres.map((o) => Number(o.layer) || 0))
    : Number.POSITIVE_INFINITY;

  return {
    posee: true,
    type: liste[0].meta?.filigrane?.type ?? null,
    disposition: liste[0].meta?.filigrane?.disposition ?? null,
    layer: layerFiligrane,
    pages,
    pagesManquantes,
    /* Vrai = le filigrane est passé DEVANT du contenu : le panneau doit le dire et
       proposer de le reposer. */
    devant: layerFiligrane >= layerMinAutres,
  };
}

/**
 * Objets du document SANS le filigrane — à passer à `documentPagination.paginer()`.
 * Voir le point 6 du contrat en tête de fichier.
 * @param {object[]} objets
 * @returns {object[]}
 */
export function sansFiligrane(objets) {
  return (Array.isArray(objets) ? objets : []).filter((o) => !estFiligrane(o));
}

/**
 * Patches qui REMETTENT chaque filigrane à sa géométrie voulue (`meta.filigrane.ancrage`).
 *
 * ⛔ POURQUOI : le store fait passer TOUTE image ajoutée par `adapterImagesAuCanevas`
 * → `geometrieImage`, qui déplace une image qui n'est pas « plein fond » pour qu'elle
 * n'en empile pas une autre. Un filigrane image atterrit donc à côté de sa place.
 * Rien à faire pour les textes (le store ne les repositionne pas) : ils ne rendent
 * aucun patch ici.
 *
 * @param {object[]} objets scène APRÈS `addObjects`
 * @returns {{id:string,patch:{x:number,y:number,width:number,height:number}}[]}
 */
export function patchesAncrageFiligrane(objets) {
  const patches = [];
  for (const o of Array.isArray(objets) ? objets : []) {
    if (!estFiligrane(o) || !o?.id) continue;
    const a = o.meta?.filigrane?.ancrage;
    if (!a || !Number.isFinite(Number(a.x))) continue;
    const differe = ['x', 'y', 'width', 'height'].some(
      (k) => Math.round(Number(o[k]) || 0) !== Math.round(Number(a[k]) || 0),
    );
    if (!differe) continue;
    patches.push({
      id: o.id,
      patch: {
        x: Math.round(a.x),
        y: Math.round(a.y),
        width: Math.round(a.width),
        height: Math.round(a.height),
      },
    });
  }
  return patches;
}
