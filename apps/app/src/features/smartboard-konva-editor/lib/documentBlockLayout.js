/**
 * documentBlockLayout — pose des blocs de texte sur la page A4 du mode Document.
 *
 * Complément volontairement étroit de `documentIntelligence.js` : ce dernier PROPOSE
 * du texte et ne touche jamais au canvas ; ce fichier ne fabrique que des objets
 * Konva et des coordonnées, et n'appelle aucun modèle. Aucun réseau ici.
 *
 * ⛔ PIÈGE corrigé : les insertions du mode Document tombaient toutes au même point
 * (40,60) — le deuxième paragraphe recouvrait exactement le premier.
 * ⛔ PIÈGE corrigé : l'encre héritée du Smartboard (#F7F2E8) est invisible sur la
 * page Document, dont le fond est forcé à #ffffff.
 *
 * ⛔ CONTRAINTE : les deux pièges ci-dessus n'étaient corrigés QUE pour les blocs
 * fabriqués ici. Toutes les autres insertions (rail Titre/Paragraphe/Liste, presets
 * Texte, plume) construisent leur objet à la main avec les valeurs du Smartboard.
 * D'où `normaliserObjetsDocument`, appelée par le store à l'insertion : c'est le seul
 * point de passage commun. Elle ne retouche JAMAIS un objet déjà calibré pour la page
 * (marqué `meta`), sans quoi le dépôt par glisser-déposer perdrait son point de chute.
 */

/* Géométrie A4 @96dpi — cf. CANVAS_DIMS.document (794×1123). */
export const DOC_PAGE = {
  width: 794,
  height: 1123,
  marginX: 52,
  marginTop: 72,
  marginBottom: 70,
  contentWidth: 794 - 52 * 2,
};

export const DOC_INK = '#1e293b';
export const DOC_INK_SOFT = '#475569';

/** Fond de la page Document (le shell force `#ffffff` quand docType passe à 'document'). */
export const DOC_PAGE_BG = '#ffffff';

/**
 * Marqueur `meta.doc` des blocs fabriqués ici : « déjà calibré pour la page ».
 * Valeur distincte de 'tableau' (documentTables), 'saut-de-page' et 'entete-pied'
 * (documentPagination) — les trois familles se reconnaissent au même champ.
 */
export const DOC_META_BLOC = 'bloc';

/** Un objet PORTANT un `meta` est posé par un module qui connaît la page : on n'y touche pas. */
export const estPoseDelibere = (o) => Boolean(o?.meta);

/**
 * Hauteur approchée d'un bloc de texte dans la largeur utile.
 * Approximation assumée : elle sert à empiler sans chevauchement, pas à mesurer.
 * @param {string} text @param {number} [fontSize] @param {number} [width]
 */
export function estimateTextHeight(text, fontSize = 13, width = DOC_PAGE.contentWidth) {
  const perLine = Math.max(12, Math.floor(width / (fontSize * 0.52)));
  const lines = String(text ?? '')
    .split('\n')
    .reduce((acc, para) => acc + Math.max(1, Math.ceil(para.length / perLine)), 0);
  return Math.round(lines * fontSize * 1.6) + 8;
}

/**
 * Position d'insertion suivante : SOUS le dernier bloc, jamais par-dessus.
 * @param {Array<{y?:number,height?:number}>} objects
 * @param {number} blockHeight
 * @returns {{ x: number, y: number, width: number, overflow: boolean }}
 */
export function nextFlowPosition(objects, blockHeight) {
  const list = Array.isArray(objects) ? objects : [];
  let bottom = DOC_PAGE.marginTop;
  for (const o of list) {
    const y = Number(o?.y);
    if (!Number.isFinite(y)) continue;
    const h = Number(o?.height);
    const b = y + (Number.isFinite(h) ? h : 0);
    if (b > bottom && b < DOC_PAGE.height * 4) bottom = b;
  }
  const y = list.length ? Math.round(bottom + 18) : DOC_PAGE.marginTop;
  return {
    x: DOC_PAGE.marginX,
    y,
    width: DOC_PAGE.contentWidth,
    overflow: y + blockHeight > DOC_PAGE.height - DOC_PAGE.marginBottom,
  };
}

/**
 * Objet Konva texte calibré pour la page A4 (encre sombre, largeur utile).
 * @param {{ text: string, x: number, y: number, width: number, fontSize?: number, bold?: boolean }} p
 */
export function makeDocumentTextObject({ text, x, y, width, fontSize = 13, bold = false }) {
  return {
    type: 'text',
    x, y, width,
    height: estimateTextHeight(text, fontSize, width),
    rotation: 0,
    layer: 1,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    content: { text },
    style: {
      fontFamily: 'Georgia, serif',
      fontSize,
      fontWeight: bold ? 700 : 400,
      fontStyle: 'normal',
      fill: DOC_INK,
      align: 'left',
      lineHeight: 1.6,
      letterSpacing: 0,
    },
    opacity: 1,
    /* Marqueur de pose délibérée : le point de chute d'un glisser-déposer ne doit pas
       être « corrigé » par la normalisation d'insertion. */
    meta: { doc: DOC_META_BLOC },
  };
}

/**
 * Empile plusieurs blocs rédigés en UN SEUL lot (donc un seul pas d'historique :
 * un Ctrl+Z annule toute la rédaction, pas un bloc sur cinq).
 *
 * @param {Array<{ titre?: string, texte: string }>} blocs
 * @param {Array<{y?:number,height?:number}>} existingObjects
 * @returns {{ objects: object[], overflow: boolean }}
 */
export function layoutDocumentBlocks(blocs, existingObjects) {
  const objects = [];
  let cursor = nextFlowPosition(existingObjects, 0);
  let overflow = false;

  for (const bloc of blocs) {
    const texte = String(bloc?.texte ?? '').trim();
    if (!texte) continue;

    const titre = String(bloc?.titre ?? '').trim();
    if (titre) {
      const hTitre = estimateTextHeight(titre, 11, cursor.width);
      objects.push(makeDocumentTextObject({ text: titre.toUpperCase(), x: cursor.x, y: cursor.y, width: cursor.width, fontSize: 11, bold: true }));
      cursor = { ...cursor, y: cursor.y + hTitre + 4 };
    }

    const h = estimateTextHeight(texte, 13, cursor.width);
    objects.push(makeDocumentTextObject({ text: texte, x: cursor.x, y: cursor.y, width: cursor.width }));
    if (cursor.y + h > DOC_PAGE.height - DOC_PAGE.marginBottom) overflow = true;
    cursor = { ...cursor, y: cursor.y + h + 16 };
  }

  return { objects, overflow };
}

/* ══════════════════════════════════════════════════════════════════════════════
   Normalisation d'insertion — adapter à la page A4 blanche ce qui a été écrit
   pour le tableau noir du Smartboard (encre claire, coordonnées 1920×1080).
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Encre par défaut du moteur quand `style.fill` est absent :
 * `KonvaBoardObject.jsx` peint `fill={st.fill || '#F7F2E8'}`. Sur la page blanche
 * cela donne 1,12:1 — un texte sans couleur est donc un texte INVISIBLE.
 */
export const ENCRE_DEFAUT_MOTEUR = '#F7F2E8';

/* ⛔ Le calcul WCAG est volontairement redit ici plutôt qu'importé de
   `documentDesignCritique.js` : ce fichier est la dépendance BASSE de
   `documentTables` et `documentPagination`, et la critique traîne derrière elle la
   bibliothèque des 100 modèles. La dette est le sens de la flèche, pas les 30 lignes.
   Toute correction de seuil doit être reportée dans les deux. */
/** Trait par défaut de la plume (cf. KonvaBoardStage.finalizePen). */
const TYPES_TRACE = new Set(['line', 'arrow']);

function _canalLineaire(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Parse une couleur CSS simple en {r,g,b,a}. Renvoie null si non interprétable
 * (dégradé, `currentColor`, nom CSS…) — dans ce cas on ne touche à rien.
 * @param {unknown} couleur
 */
export function parseCouleur(couleur) {
  const s = String(couleur ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'transparent' || s === 'none') return { r: 0, g: 0, b: 0, a: 0 };
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) {
    const [x, y, z] = m[1];
    return { r: parseInt(x + x, 16), g: parseInt(y + y, 16), b: parseInt(z + z, 16), a: 1 };
  }
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/.exec(s);
  if (m) {
    return {
      r: Math.min(255, Number(m[1])),
      g: Math.min(255, Number(m[2])),
      b: Math.min(255, Number(m[3])),
      a: m[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(m[4]))),
    };
  }
  return null;
}

/** Luminance relative WCAG d'une couleur OPAQUE {r,g,b}. */
function _luminance({ r, g, b }) {
  return 0.2126 * _canalLineaire(r) + 0.7152 * _canalLineaire(g) + 0.0722 * _canalLineaire(b);
}

/**
 * Contraste WCAG d'une couleur d'encre sur un fond. L'alpha de l'encre est composité
 * sur le fond AVANT le calcul : une encre à 25 % d'opacité n'est pas lisible même si
 * sa teinte pleine l'est.
 * @param {unknown} encre @param {unknown} fond
 * @returns {number|null} rapport 1..21, ou null si une des deux couleurs est illisible
 */
export function contrasteWCAG(encre, fond) {
  const e = parseCouleur(encre);
  const f = parseCouleur(fond);
  if (!e || !f) return null;
  const compose = {
    r: e.r * e.a + f.r * (1 - e.a),
    g: e.g * e.a + f.g * (1 - e.a),
    b: e.b * e.a + f.b * (1 - e.a),
  };
  const l1 = _luminance(compose);
  const l2 = _luminance(f);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* Seuils : sous 1,6 l'encre est indiscernable du fond ; entre 1,6 et 3 elle reste
   trop pâle pour du corps de texte, mais l'intention « discret » est lisible et on
   la conserve en la ramenant à l'encre douce. */
const CONTRASTE_MINIMAL = 3;
const CONTRASTE_INVISIBLE = 1.6;

/**
 * Encre de remplacement pour une couleur illisible sur le fond de page.
 *
 * ⛔ `seuil` vaut CONTRASTE_INVISIBLE pour les TRAITS : un filet de séparation pâle
 * (#94a3b8, 2,59:1) est un choix de mise en page, pas un défaut — les seuils WCAG
 * portent sur le texte. Assombrir tous les filets redessinerait le document.
 *
 * @returns {string|null} null = la couleur passe, ne rien changer
 */
export function encreLisible(couleur, fond = DOC_PAGE_BG, seuil = CONTRASTE_MINIMAL) {
  const c = couleur == null || couleur === '' ? ENCRE_DEFAUT_MOTEUR : couleur;
  const ratio = contrasteWCAG(c, fond);
  if (ratio == null) return null;
  if (ratio >= seuil) return null;
  return ratio < CONTRASTE_INVISIBLE ? DOC_INK : DOC_INK_SOFT;
}

/** Aire d'intersection de deux boîtes {x,y,width,height}. */
function _intersection(a, b) {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

function _boite(o) {
  return {
    x: Number(o?.x) || 0,
    y: Number(o?.y) || 0,
    width: Math.max(1, Number(o?.width) || 1),
    height: Math.max(1, Number(o?.height) || 1),
  };
}

/** Un objet de la scène occupe-t-il EXACTEMENT la même boîte ? */
function _doublonExact(obj, existants) {
  const b = _boite(obj);
  return existants.some((autre) => {
    if (autre?.type !== obj?.type) return false;
    const a = _boite(autre);
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  });
}

/**
 * Un FILET de séparation posé par le rail : trait `line` dont les points valent
 * exactement [0, 0, largeur, 0] — la signature d'émission du rail Séparateur.
 *
 * ⛔ La reconnaissance porte sur les POINTS, pas sur la seule boîte : un tracé à la
 * plume ou au crayon (points nombreux, ordonnées venues du curseur) ne peut pas
 * matcher, et son point de chute reste donc intouchable. Seul un segment plume de
 * 2 ancres parfaitement horizontal partant de (0,0) relatif partage la signature —
 * et il n'est déplacé QUE s'il recouvre déjà quelque chose.
 */
function _estFiletHorizontal(obj) {
  if (!TYPES_TRACE.has(obj?.type)) return false;
  const pts = obj?.content?.points;
  if (!Array.isArray(pts) || pts.length !== 4) return false;
  const [x0, y0, x1, y1] = pts.map(Number);
  return x0 === 0 && y0 === 0 && y1 === 0 && Math.abs(x1 - (Number(obj?.width) || 0)) <= 2;
}

/** Le bloc sort-il de la zone imprimable (marges gauche/droite/haut) ? */
function _horsZoneImprimable(b, largeurPage) {
  return (
    b.x < DOC_PAGE.marginX - 1 ||
    b.y < DOC_PAGE.marginTop - 1 ||
    b.x + b.width > largeurPage - DOC_PAGE.marginX + 1
  );
}

/**
 * Adapte un LOT d'objets à la page Document au moment de l'insertion.
 *
 * Ce qui est corrigé :
 *  · encre de texte et trait de plume illisibles sur le fond de page (y compris
 *    l'encre ABSENTE, que le moteur remplace par le crème #F7F2E8 du Smartboard) ;
 *  · texte posé à une coordonnée fixe du Smartboard : replacé dans le flux, sous le
 *    dernier bloc, à l'intérieur des marges.
 *
 * Ce qui n'est JAMAIS touché :
 *  · tout objet portant un `meta` (bloc rédigé, tableau, en-tête/pied, saut de page) ;
 *  · la géométrie des lots composites (un lot qui n'est pas 100 % texte garde ses
 *    positions relatives : déplacer un libellé sans son cadre casserait le modèle) ;
 *  · les images, dont l'habillage est choisi par l'utilisateur.
 *
 * @param {object[]} objets lot à insérer
 * @param {object[]} objetsScene objets déjà présents dans la scène active
 * @param {{ fondPage?: string, largeurPage?: number }} [options]
 * @returns {object[]} nouveau lot (les objets inchangés sont renvoyés tels quels)
 */
export function normaliserObjetsDocument(objets, objetsScene, options = {}) {
  const lot = Array.isArray(objets) ? objets : [];
  if (!lot.length) return lot;
  /* Le fond du projet peut valoir `transparent` (bouton « Fond transparent » des
     paramètres canvas) : une page imprimée est blanche, on raisonne donc sur du blanc
     dès que le fond n'est pas une couleur opaque interprétable. */
  const fondBrut = parseCouleur(options.fondPage);
  const fond = fondBrut && fondBrut.a === 1 ? options.fondPage : DOC_PAGE_BG;
  const largeurPage = Number(options.largeurPage) > 0 ? Number(options.largeurPage) : DOC_PAGE.width;
  const contenuLargeur = Math.max(120, largeurPage - DOC_PAGE.marginX * 2);

  /* Un lot composite (texte + cadres) est une mise en page en soi : on corrige ses
     encres mais pas ses coordonnées. */
  const lotToutTexte = lot.every((o) => o?.type === 'text');
  /* Garde-fou : les marges ci-dessus sont celles d'une PAGE. Le plus large des formats
     supportés fait 1123 px (A4 paysage) ; au-delà on n'est pas sur une page et le
     replacement dans le flux n'aurait aucun sens — seules les encres sont corrigées. */
  const surUnePage = largeurPage <= 1200;
  const posables = Array.isArray(objetsScene) ? objetsScene.slice() : [];

  return lot.map((obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (estPoseDelibere(obj)) {
      posables.push(obj);
      return obj;
    }

    let suivant = obj;

    /* ── Encre ── */
    if (obj.type === 'text') {
      const remplacement = encreLisible(obj.style?.fill, fond);
      if (remplacement) suivant = { ...suivant, style: { ...(suivant.style || {}), fill: remplacement } };
    } else if (TYPES_TRACE.has(obj.type)) {
      const remplacementTrait = encreLisible(obj.style?.stroke, fond, CONTRASTE_INVISIBLE);
      if (remplacementTrait) suivant = { ...suivant, style: { ...(suivant.style || {}), stroke: remplacementTrait } };
      /* Une flèche peint sa pointe avec `fill` : sans ça, la pointe reste invisible. */
      if (obj.type === 'arrow' && obj.style?.fill != null) {
        const remplacementPointe = encreLisible(obj.style.fill, fond, CONTRASTE_INVISIBLE);
        if (remplacementPointe) suivant = { ...suivant, style: { ...(suivant.style || {}), fill: remplacementPointe } };
      }
    }

    /* ── Position ── */
    if (obj.type === 'text' && lotToutTexte && surUnePage) {
      const b = _boite(suivant);
      const aire = b.width * b.height;
      const recouvre = posables.some((autre) => _intersection(b, _boite(autre)) > aire * 0.55);
      if (recouvre || _horsZoneImprimable(b, largeurPage)) {
        const largeur = Math.min(Math.max(120, b.width), contenuLargeur);
        const pos = nextFlowPosition(posables, b.height);
        suivant = { ...suivant, x: pos.x, y: pos.y, width: largeur };
      }
    } else if (lot.length === 1 && surUnePage) {
      /* Cas du Séparateur : le rail le pose toujours à y=240, les filets s'y empilent.
         ⛔ MESURÉ (2026-08-06) : la règle « boîte STRICTEMENT identique » laissait passer
         l'Épais (3 px de haut) par-dessus le Fin (2 px) et le Décoratif (x=237, l=320)
         par-dessus les deux — trois traits au même y, impossibles à cibler à la souris.
         Un filet reconnu à sa signature de points ({@link _estFiletHorizontal}) est donc
         descendu dès qu'il RECOUVRE quoi que ce soit ; le doublon au pixel près reste
         couvert pour les autres types. Un tracé à la plume, dont les coordonnées
         viennent du curseur, ne matche ni l'une ni l'autre règle. On ne descend que le
         `y` : la largeur et le centrage horizontal (filet décoratif centré) sont des
         choix de mise en page. */
      const b = _boite(suivant);
      const filetSurOccupe =
        _estFiletHorizontal(suivant) && posables.some((autre) => _intersection(b, _boite(autre)) > 0);
      if (filetSurOccupe || _doublonExact(suivant, posables)) {
        suivant = { ...suivant, y: nextFlowPosition(posables, b.height).y };
      }
    }

    posables.push(suivant);
    return suivant;
  });
}
