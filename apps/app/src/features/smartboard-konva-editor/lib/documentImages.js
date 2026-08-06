/**
 * documentImages — géométrie des images posées sur le canevas (calcul PUR).
 *
 * Ce fichier ne touche NI au store, NI au DOM (sauf `mesurerImage`, qui charge une
 * image pour lire ses dimensions natives et accepte une mesure injectée pour rester
 * testable hors navigateur). Aucun réseau, aucun import React, aucun import Konva.
 * Le câblage (store, poignées, import de fichier) est fait ailleurs.
 *
 * ⛔ PIÈGE MESURÉ LE 2026-08-05 (défaut [IMG-RATIO]) : l'import posait la MÊME boîte
 * 560 × 320 à toute image, sans regarder son format. Trois cas réels :
 *   · 602 × 900 (portrait, rapport 0,669) → 560 × 320 (1,750) = étirée ×2,6 en largeur
 *   · 900 × 600 (paysage, 1,500)          → 560 × 320        = ×1,17
 *   · 675 × 900 (portrait, 0,750)         → 560 × 320        = ×2,3
 * Et rien ne rattrapait : `content` ne portait que `src`, `style` vide, `crop` à zéro.
 * L'information existe pourtant (`image().naturalWidth/naturalHeight`) — elle n'était
 * pas utilisée. {@link boiteAuFormat} est le correctif : plus jamais de 560×320 en dur.
 *
 * ⛔ PIÈGE MESURÉ (défaut [IMG-HORSPAGE]) : des images posées à y=1044 et y=1382 sur
 * une page haute de 1123, sans un mot. {@link placerDansLaPage} ne rend JAMAIS une
 * position hors page : quand il n'y a plus la place, il le DIT (`place:false`).
 *
 * ⛔ PIÈGE MESURÉ LE 2026-08-05 (défaut [CRIT-RECOUVR], moitié POSE) : les trois images
 * importées tombaient TOUTES au même point — 52,180 en mode Document, 100,120 en mode
 * Affiche. Recouvrement 100 %, deux images sur trois invisibles. `placerDansLaPage`
 * savait éviter le débordement, pas l'empilement : il n'entrait dans le flux que
 * lorsque AUCUNE position n'était demandée, et l'appelant en demandait toujours une.
 * D'où {@link placerDansLaPage}.`position` : la position demandée n'est gardée que si
 * elle est LIBRE ; sinon l'image descend dans le flux et le retour le dit (`deplace`).
 *
 * ⛔ PIÈGE MESURÉ (défaut [IMG-FLASH]) : la boîte était posée à 560 × 320 puis corrigée
 * 3,4 à 6,1 s plus tard, au chargement du bitmap. Tant que le fichier n'est pas mesuré,
 * AUCUNE boîte ne peut être juste — {@link boiteNeutre} refuse d'en inventer une.
 *
 * ⛔ CONTRAINTE Konva : `crop` s'exprime en PIXELS DE L'IMAGE SOURCE, pas en pixels
 * écran (cf. `canvas/KonvaBoardObject.jsx`, qui passe `crop={cropRect}` tel quel).
 * D'où l'obligation de connaître les dimensions natives pour un recadrage exploitable ;
 * sans elles {@link calculerCrop} renvoie un crop RELATIF (0..1) et le signale par
 * `unite: 'ratio'` — à ne pas donner à Konva en l'état.
 *
 * ── Ce que l'agent « canevas » peut appeler ────────────────────────────────────
 *   mesurerImage(src, { mesurer })        → { largeurNative, hauteurNative, rapportNatif }
 *   boiteAuFormat({ … })                  → { width, height, … } au rapport natif
 *   calculerCrop({ … })                   → { crop, boite, decalage, mode, unite }
 *   verrouillerRapport({ boite, rapport, ancre }) → boîte contrainte (poignées)
 *   pointFixePourPoignee('top-left')      → 'se'  (nom d'ancre pour verrouillerRapport)
 *   placerDansLaPage({ objets, image, page, marges, position }) → position QUI TIENT
 *   boiteNeutre({ largeurVoulue, hauteurVoulue, … }) → boîte provisoire non menteuse
 *   recouvrementMaximal(boite, objets)    → part de la boîte déjà occupée (0..1)
 *   deformation(boite, rapportNatif)      → écart en % (0 = fidèle)
 *   proposerGeometrieImage({ … })         → composition des cinq ci-dessus
 * Toutes ces fonctions sont pures et sans effet de bord (sauf le cache de mesures,
 * vidable par `viderCacheMesures()`).
 */

/* ═══════════════════════════════════════════════════════════════════
   Constantes
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Modes d'ajustement d'une image dans un cadre imposé.
 * ⛔ 'etirer' reproduit l'ancien défaut : il reste POSSIBLE, jamais par défaut.
 */
export const MODES_AJUSTEMENT = Object.freeze({
  CONTAIN: 'contain', // l'image entière tient dans le cadre, bandes vides possibles
  COVER: 'cover', // le cadre est rempli, le débord est ROGNÉ (pas déformé)
  ETIRER: 'etirer', // choix explicite d'écraser le rapport natif
  RECADRER: 'recadrer', // cover + zoom et point focal choisis par l'utilisateur
});

export const MODE_AJUSTEMENT_DEFAUT = MODES_AJUSTEMENT.CONTAIN;

/** Liste plate, pour valider une valeur venue de l'UI. */
export const LISTE_MODES_AJUSTEMENT = Object.freeze(Object.values(MODES_AJUSTEMENT));

/**
 * Boîte maximale par défaut d'une image insérée « à la volée ».
 * ⛔ Ce sont les DEUX MÊMES nombres que l'ancien défaut (560 × 320) — mais ici ce
 * n'est plus la boîte finale, seulement le gabarit maximal : la boîte rendue par
 * {@link boiteAuFormat} respecte le rapport natif à l'intérieur de ce gabarit.
 */
export const BOITE_MAX_DEFAUT = Object.freeze({ largeurMax: 560, hauteurMax: 320 });

/** Plus petite dimension acceptable pour une image posée (en dessous : illisible). */
export const TAILLE_MIN = 48;

/** Écart vertical entre deux blocs dans le flux de la page (aligné sur documentBlockLayout). */
export const ECART_FLUX = 18;

/** Tolérance d'affichage : sous ce seuil, la déformation n'est pas dénonçable à l'œil. */
export const SEUIL_DEFORMATION_VISIBLE = 1; // %

/**
 * Part de la boîte à poser qui peut recouvrir un objet déjà là avant qu'on parle
 * d'empilement. ⛔ MÊME VALEUR que la règle texte de `documentBlockLayout`
 * (`_intersection(b, autre) > aire * 0.55`) : deux modules qui décident « ça se
 * recouvre » avec deux seuils différents donneraient deux mises en page pour un même
 * document. Toute correction ici doit être reportée là-bas.
 */
export const SEUIL_RECOUVREMENT = 0.55;

/**
 * Part de la page au-delà de laquelle un objet est un FOND, pas un obstacle.
 * ⛔ Sans ce garde-fou, la première affiche à fond perdu rendrait toutes les images
 * suivantes « page pleine » : le fond couvre la feuille, donc tout le reste le recouvre.
 */
export const SEUIL_FOND_DE_PAGE = 0.9;

/* ═══════════════════════════════════════════════════════════════════
   Outils internes
   ═══════════════════════════════════════════════════════════════════ */

const nb = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const nbPositif = (v) => {
  const n = nb(v);
  return n !== null && n > 0 ? n : null;
};

const borner = (v, min, max) => Math.min(Math.max(v, min), max);

/** Arrondi à `d` décimales sans traîner de 0,30000000000000004. */
const arrondi = (v, d = 2) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/* ═══════════════════════════════════════════════════════════════════
   1. Mesure des dimensions natives
   ═══════════════════════════════════════════════════════════════════ */

/** Cache des mesures : une même src (URL signée comprise) n'est chargée qu'une fois. */
const cacheMesures = new Map();

/** Vide le cache de {@link mesurerImage} (utile aux tests et après rotation d'URL signée). */
export function viderCacheMesures() {
  cacheMesures.clear();
}

/**
 * Normalise une mesure quelle que soit sa forme d'origine.
 * Accepte `{largeur,hauteur}`, `{width,height}`, `{naturalWidth,naturalHeight}`
 * — donc aussi bien un objet de test qu'un nœud `HTMLImageElement`.
 * @param {object} source
 * @returns {{largeurNative:number,hauteurNative:number,rapportNatif:number}}
 */
export function dimensionsNatives(source) {
  const s = source ?? {};
  const l = nbPositif(s.largeurNative) ?? nbPositif(s.largeur) ?? nbPositif(s.naturalWidth) ?? nbPositif(s.width);
  const h = nbPositif(s.hauteurNative) ?? nbPositif(s.hauteur) ?? nbPositif(s.naturalHeight) ?? nbPositif(s.height);
  if (l === null || h === null) {
    throw new Error('dimensionsNatives : largeur/hauteur natives introuvables ou nulles');
  }
  return { largeurNative: l, hauteurNative: h, rapportNatif: l / h };
}

/**
 * Charge l'image pour lire `naturalWidth`/`naturalHeight`.
 * ⛔ Pas de `crossOrigin` : on ne lit aucun pixel, seulement les dimensions. Le poser
 * ferait échouer le chargement depuis un bucket privé sans en-tête CORS.
 */
function mesurerViaNavigateur(src, delaiMs) {
  const Constructeur = globalThis.Image;
  if (typeof Constructeur !== 'function') {
    return Promise.reject(
      new Error("mesurerImage : hors navigateur — passez options.mesurer pour injecter la mesure"),
    );
  }
  return new Promise((resoudre, rejeter) => {
    const img = new Constructeur();
    let minuteur = null;
    const nettoyer = () => {
      if (minuteur !== null) clearTimeout(minuteur);
      img.onload = null;
      img.onerror = null;
    };
    img.onload = () => {
      nettoyer();
      try {
        resoudre(dimensionsNatives(img));
      } catch (e) {
        rejeter(e);
      }
    };
    img.onerror = () => {
      nettoyer();
      rejeter(new Error(`mesurerImage : chargement impossible (${String(src).slice(0, 120)})`));
    };
    if (delaiMs > 0) {
      minuteur = setTimeout(() => {
        nettoyer();
        rejeter(new Error('mesurerImage : délai dépassé'));
      }, delaiMs);
    }
    img.src = src;
  });
}

/**
 * Dimensions natives d'une image.
 * @param {string} src URL (bucket privé signé, data: ou blob:)
 * @param {{ mesurer?: (src:string)=>any, cache?: boolean, delaiMs?: number }} [options]
 *   `mesurer` : injection de mesure (tests, worker) — peut rendre une valeur ou une Promise.
 * @returns {Promise<{largeurNative:number,hauteurNative:number,rapportNatif:number}>}
 */
export function mesurerImage(src, options = {}) {
  const cle = typeof src === 'string' ? src.trim() : '';
  if (!cle) return Promise.reject(new Error('mesurerImage : src vide'));

  const { mesurer, cache = true, delaiMs = 15000 } = options ?? {};
  if (cache && cacheMesures.has(cle)) return Promise.resolve(cacheMesures.get(cle));

  const brut =
    typeof mesurer === 'function'
      ? Promise.resolve().then(() => mesurer(cle))
      : mesurerViaNavigateur(cle, delaiMs);

  return brut.then((valeur) => {
    const mesure = dimensionsNatives(valeur);
    if (cache) cacheMesures.set(cle, mesure);
    return mesure;
  });
}

/* ═══════════════════════════════════════════════════════════════════
   2. Boîte au format natif — le cœur du correctif [IMG-RATIO]
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Boîte qui RESPECTE le rapport natif et tient dans la zone utile.
 *
 * ⛔ N'AGRANDIT PAS au-delà du natif par défaut (`agrandir:false`) : une vignette de
 * 120 px étirée à 560 px de large est floue, pas « adaptée ». Seule exception, le
 * plancher {@link TAILLE_MIN}, pour qu'une image minuscule reste cliquable.
 *
 * ⛔ LIMITE ASSUMÉE : la boîte sort en pixels ENTIERS (comme le reste des objets du
 * canevas). L'arrondi coûte jusqu'à un demi-pixel par côté, soit une déformation
 * résiduelle de ~100/côté en % — négligeable au-dessus de 100 px, mesurable en
 * dessous (une boîte de 40 px de large peut dériver de 1,3 %).
 *
 * @param {{largeurNative:number,hauteurNative:number,largeurMax?:number,hauteurMax?:number,
 *          agrandir?:boolean, tailleMin?:number}} p
 * @returns {{width:number,height:number,rapport:number,echelle:number,deformation:number,
 *            largeurNative:number,hauteurNative:number,rapportNatif:number}}
 */
export function boiteAuFormat(p = {}) {
  const { largeurNative, hauteurNative, rapportNatif } = dimensionsNatives(p);
  const largeurMax = nbPositif(p.largeurMax) ?? BOITE_MAX_DEFAUT.largeurMax;
  const hauteurMax = nbPositif(p.hauteurMax) ?? BOITE_MAX_DEFAUT.hauteurMax;
  const agrandir = p.agrandir === true;
  const tailleMin = nbPositif(p.tailleMin) ?? TAILLE_MIN;

  let echelle = Math.min(largeurMax / largeurNative, hauteurMax / hauteurNative);
  if (!agrandir) echelle = Math.min(echelle, 1);

  /* Plancher de lisibilité — sans jamais repasser au-dessus du gabarit maximal. */
  const echelleMin = Math.min(
    Math.min(tailleMin / largeurNative, tailleMin / hauteurNative) > echelle
      ? Math.max(tailleMin / largeurNative, tailleMin / hauteurNative)
      : echelle,
    Math.min(largeurMax / largeurNative, hauteurMax / hauteurNative),
  );
  echelle = Math.max(echelle, echelleMin);

  const width = Math.max(1, Math.round(largeurNative * echelle));
  const height = Math.max(1, Math.round(hauteurNative * echelle));

  return {
    width,
    height,
    rapport: width / height,
    echelle: arrondi(echelle, 6),
    deformation: deformation({ width, height }, rapportNatif),
    largeurNative,
    hauteurNative,
    rapportNatif,
  };
}

/**
 * Boîte PROVISOIRE d'une image dont le fichier n'est pas encore mesuré.
 *
 * ⛔ CHRONO MESURÉ LE 2026-08-05 (défaut [IMG-FLASH]) : pose à 2 422 / 2 627 / 2 627 ms,
 * correction au chargement du bitmap à 6 054 / 6 259 / 8 681 ms — soit 3,4 à 6,1 s
 * pendant lesquelles la boîte 560 × 320 affichait un rapport 1,75 affirmé au hasard
 * (le fichier réel valait 0,669). On ne peut pas deviner le rapport d'un fichier pas
 * encore chargé ; on peut refuser de l'inventer.
 *
 * D'où le CARRÉ : il n'affirme aucune orientation. Son côté est la moyenne géométrique
 * des dimensions demandées, donc sa surface est celle qu'on voulait — la boîte finale,
 * inscrite à son rapport réel, reste du même ordre de grandeur et l'image ne « saute »
 * pas d'échelle à la mesure.
 *
 * @param {{largeurVoulue?:number, hauteurVoulue?:number, largeurMax?:number,
 *          hauteurMax?:number, tailleMin?:number}} p
 * @returns {{width:number,height:number,cote:number,neutre:true}}
 */
export function boiteNeutre(p = {}) {
  const lVoulue = nbPositif(p.largeurVoulue) ?? BOITE_MAX_DEFAUT.largeurMax;
  const hVoulue = nbPositif(p.hauteurVoulue) ?? BOITE_MAX_DEFAUT.hauteurMax;
  const largeurMax = nbPositif(p.largeurMax) ?? Infinity;
  const hauteurMax = nbPositif(p.hauteurMax) ?? Infinity;
  const tailleMin = nbPositif(p.tailleMin) ?? TAILLE_MIN;

  const plafond = Math.min(largeurMax, hauteurMax);
  let cote = Math.sqrt(lVoulue * hVoulue);
  if (Number.isFinite(plafond)) cote = Math.min(cote, plafond);
  cote = Math.max(1, Math.round(Math.max(cote, Math.min(tailleMin, plafond))));

  return { width: cote, height: cote, cote, neutre: true };
}

/* ═══════════════════════════════════════════════════════════════════
   3. Recadrage — remplir un cadre imposé SANS déformer
   ═══════════════════════════════════════════════════════════════════ */

/** Valide un mode venu de l'UI ; retombe sur le défaut plutôt que d'étirer par accident. */
export function normaliserMode(mode) {
  const m = String(mode ?? '').toLowerCase();
  return LISTE_MODES_AJUSTEMENT.includes(m) ? m : MODE_AJUSTEMENT_DEFAUT;
}

/**
 * Crop Konva pour un cadre imposé.
 *
 * @param {{ rapportNatif?:number, boite:{x?:number,y?:number,width:number,height:number},
 *           mode?:string, largeurNative?:number, hauteurNative?:number,
 *           focale?:{x:number,y:number}, zoom?:number }} p
 *   `boite` = le CADRE imposé (celui que l'utilisateur a dessiné).
 *   `focale` en coordonnées relatives de la source (0..1, défaut centre).
 *   `zoom` ≥ 1, mode 'recadrer' seulement (1 = équivalent à 'cover').
 * @returns {{mode:string, crop:{x,y,width,height}|null, boite:{x,y,width,height},
 *            decalage:{x:number,y:number}, deformation:number, unite:'px'|'ratio'}}
 *   `unite:'ratio'` = crop exprimé en 0..1 faute de dimensions natives.
 *   ⛔ Konva attend des PIXELS SOURCE : ne passez un crop 'ratio' à Konva sous aucun prétexte.
 */
export function calculerCrop(p = {}) {
  const mode = normaliserMode(p.mode);
  const cadreL = nbPositif(p.boite?.width);
  const cadreH = nbPositif(p.boite?.height);
  if (cadreL === null || cadreH === null) throw new Error('calculerCrop : boîte (cadre) invalide');
  const cadreX = nb(p.boite?.x) ?? 0;
  const cadreY = nb(p.boite?.y) ?? 0;

  const largeurNative = nbPositif(p.largeurNative);
  const hauteurNative = nbPositif(p.hauteurNative);
  const rapportNatif =
    largeurNative !== null && hauteurNative !== null
      ? largeurNative / hauteurNative
      : nbPositif(p.rapportNatif);
  if (rapportNatif === null) throw new Error('calculerCrop : rapport natif inconnu');

  const unite = largeurNative !== null && hauteurNative !== null ? 'px' : 'ratio';
  /* Source virtuelle quand les natifs manquent : le crop sort alors en 0..1. */
  const sourceL = largeurNative ?? rapportNatif;
  const sourceH = hauteurNative ?? 1;

  if (mode === MODES_AJUSTEMENT.ETIRER) {
    return {
      mode,
      crop: null,
      boite: { x: cadreX, y: cadreY, width: cadreL, height: cadreH },
      decalage: { x: 0, y: 0 },
      deformation: deformation({ width: cadreL, height: cadreH }, rapportNatif),
      unite,
    };
  }

  if (mode === MODES_AJUSTEMENT.CONTAIN) {
    const echelle = Math.min(cadreL / sourceL, cadreH / sourceH);
    const width = Math.max(1, arrondi(sourceL * echelle, 2));
    const height = Math.max(1, arrondi(sourceH * echelle, 2));
    const decalage = { x: arrondi((cadreL - width) / 2, 2), y: arrondi((cadreH - height) / 2, 2) };
    return {
      mode,
      crop: null,
      boite: { x: arrondi(cadreX + decalage.x, 2), y: arrondi(cadreY + decalage.y, 2), width, height },
      decalage,
      deformation: deformation({ width, height }, rapportNatif),
      unite,
    };
  }

  /* cover / recadrer : le cadre est rempli, le débord est rogné dans la SOURCE. */
  const zoom = mode === MODES_AJUSTEMENT.RECADRER ? Math.max(1, nbPositif(p.zoom) ?? 1) : 1;
  const rapportCadre = cadreL / cadreH;
  let cw;
  let ch;
  if (rapportCadre > rapportNatif) {
    cw = sourceL; // la source est trop haute : on rogne en haut/bas
    ch = sourceL / rapportCadre;
  } else {
    ch = sourceH; // la source est trop large : on rogne à gauche/droite
    cw = sourceH * rapportCadre;
  }
  cw /= zoom;
  ch /= zoom;

  const fx = borner(nb(p.focale?.x) ?? 0.5, 0, 1);
  const fy = borner(nb(p.focale?.y) ?? 0.5, 0, 1);
  const x = borner(fx * sourceL - cw / 2, 0, Math.max(0, sourceL - cw));
  const y = borner(fy * sourceH - ch / 2, 0, Math.max(0, sourceH - ch));

  const d = unite === 'px' ? 2 : 6;
  return {
    mode,
    crop: { x: arrondi(x, d), y: arrondi(y, d), width: arrondi(cw, d), height: arrondi(ch, d) },
    boite: { x: cadreX, y: cadreY, width: cadreL, height: cadreH },
    decalage: { x: 0, y: 0 },
    deformation: 0, // le crop épouse le rapport du cadre : rien n'est écrasé
    unite,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   4. Verrou de proportions (poignées)
   ═══════════════════════════════════════════════════════════════════ */

/** Coordonnées relatives d'une ancre dans sa boîte. */
const ANCRES = {
  nw: [0, 0], n: [0.5, 0], ne: [1, 0],
  w: [0, 0.5], centre: [0.5, 0.5], e: [1, 0.5],
  sw: [0, 1], s: [0.5, 1], se: [1, 1],
};

/**
 * Point FIXE correspondant à la poignée tirée (noms d'ancres Konva Transformer).
 * Tirer 'bottom-right' laisse le coin haut-gauche immobile → 'nw'.
 * @param {string} poignee @returns {keyof typeof ANCRES}
 */
export function pointFixePourPoignee(poignee) {
  const table = {
    'top-left': 'se', 'top-center': 's', 'top-right': 'sw',
    'middle-left': 'e', 'middle-right': 'w',
    'bottom-left': 'ne', 'bottom-center': 'n', 'bottom-right': 'nw',
    nw: 'se', n: 's', ne: 'sw', w: 'e', e: 'w', sw: 'ne', s: 'n', se: 'nw',
  };
  return table[String(poignee ?? '').toLowerCase()] ?? 'nw';
}

/**
 * Contraint une boîte redimensionnée à conserver un rapport donné.
 *
 * ⛔ `ancre` est le point qui NE BOUGE PAS (utiliser {@link pointFixePourPoignee}
 * pour le déduire de la poignée tirée), pas la poignée elle-même.
 *
 * @param {{ boite:{x?:number,y?:number,width:number,height:number}, rapport:number,
 *           ancre?:string, strategie?:'max'|'min' }} p
 *   `strategie` : 'max' (défaut) = la boîte suit le pointeur vers l'extérieur,
 *   'min' = elle reste à l'intérieur du geste.
 * @returns {{x:number,y:number,width:number,height:number,rapport:number,ancre:string}}
 */
export function verrouillerRapport(p = {}) {
  const rapport = nbPositif(p.rapport);
  const l = nbPositif(p.boite?.width);
  const h = nbPositif(p.boite?.height);
  if (l === null || h === null) throw new Error('verrouillerRapport : boîte invalide');
  const x = nb(p.boite?.x) ?? 0;
  const y = nb(p.boite?.y) ?? 0;
  const ancre = ANCRES[String(p.ancre ?? 'nw').toLowerCase()] ? String(p.ancre ?? 'nw').toLowerCase() : 'nw';
  if (rapport === null) return { x, y, width: l, height: h, rapport: l / h, ancre };

  const parLargeur = { width: l, height: l / rapport };
  const parHauteur = { width: h * rapport, height: h };

  let choix;
  if (ancre === 'e' || ancre === 'w') choix = parLargeur; // geste horizontal
  else if (ancre === 'n' || ancre === 's') choix = parHauteur; // geste vertical
  else {
    const strategie = p.strategie === 'min' ? 'min' : 'max';
    const aire = (b) => b.width * b.height;
    choix =
      strategie === 'max'
        ? (aire(parLargeur) >= aire(parHauteur) ? parLargeur : parHauteur)
        : (aire(parLargeur) <= aire(parHauteur) ? parLargeur : parHauteur);
  }

  const width = Math.max(1, arrondi(choix.width, 2));
  const height = Math.max(1, arrondi(choix.height, 2));
  const [fx, fy] = ANCRES[ancre];
  return {
    x: arrondi(x + fx * l - fx * width, 2),
    y: arrondi(y + fy * h - fy * height, 2),
    width,
    height,
    rapport: width / height,
    ancre,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   5. Placement dans la page — correctif [IMG-HORSPAGE]
   ═══════════════════════════════════════════════════════════════════ */

const MARGES_PAR_DEFAUT = { haut: 72, bas: 70, gauche: 52, droite: 52 };

/** Zone imprimable d'une page donnée d'un canevas à pages empilées. */
function zoneUtile(page, marges, index) {
  const hauteurPage = nbPositif(page?.hauteur) ?? 1123;
  const largeurPage = nbPositif(page?.largeur) ?? 794;
  const ecart = nb(page?.ecartPages) ?? 0;
  const haut = index * (hauteurPage + ecart);
  return {
    x: marges.gauche,
    y: haut + marges.haut,
    width: Math.max(1, largeurPage - marges.gauche - marges.droite),
    height: Math.max(1, hauteurPage - marges.haut - marges.bas),
    bas: haut + hauteurPage - marges.bas,
  };
}

/** Boîte exploitable d'un objet de scène (les champs manquants valent 0). */
function boiteObjet(o) {
  return {
    x: nb(o?.x) ?? 0,
    y: nb(o?.y) ?? 0,
    width: Math.max(0, nb(o?.width) ?? 0),
    height: Math.max(0, nb(o?.height) ?? 0),
  };
}

/** Aire d'intersection de deux boîtes {x,y,width,height}. */
function aireCommune(a, b) {
  const l = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return l * h;
}

/**
 * Un objet qui couvre la quasi-totalité de la feuille est un FOND, pas un obstacle.
 * @see SEUIL_FOND_DE_PAGE
 */
export function estFondDePage(o, largeurPage, hauteurPage) {
  const l = nbPositif(o?.width);
  const h = nbPositif(o?.height);
  if (l === null || h === null) return false;
  return l >= largeurPage * SEUIL_FOND_DE_PAGE && h >= hauteurPage * SEUIL_FOND_DE_PAGE;
}

/**
 * Part de `boite` déjà occupée par l'objet le plus gênant (0 = libre, 1 = recouverte).
 * ⛔ Rapportée à l'aire de la boîte à POSER, pas à celle de l'obstacle : une vignette
 * lâchée sur une grande image est intégralement cachée, même si elle n'en masque que 5 %.
 *
 * @param {{x:number,y:number,width:number,height:number}} boite
 * @param {Array<{x?:number,y?:number,width?:number,height?:number}>} objets
 * @returns {number}
 */
export function recouvrementMaximal(boite, objets) {
  const b = boiteObjet(boite);
  const aire = b.width * b.height;
  if (!(aire > 0) || !Array.isArray(objets)) return 0;
  let pire = 0;
  for (const o of objets) {
    const part = aireCommune(b, boiteObjet(o)) / aire;
    if (part > pire) pire = part;
  }
  return arrondi(pire, 4);
}

/**
 * Position d'une image QUI TIENT DANS LA PAGE ET NE RECOUVRE PAS CE QUI Y EST DÉJÀ.
 *
 * ⛔ Ne rend jamais un y hors page : quand il n'y a plus la place, la position rendue
 * reste bornée à la zone imprimable et `place` vaut false avec une `raison`.
 *
 * ⛔ `position` (le point de chute demandé par l'appelant) n'est PAS un ordre : il est
 * gardé tant qu'il est libre, abandonné pour le flux dès qu'il empile (`deplace:true`).
 * Sans ce garde-fou, trois imports d'affilée se posaient au même pixel.
 *
 * @param {{ objets?:Array<{x?:number,y?:number,width?:number,height?:number}>,
 *           obstacles?:Array<object>,
 *           image:{largeurNative?:number,hauteurNative?:number,width?:number,height?:number,
 *                  largeurMax?:number,hauteurMax?:number},
 *           page?:{largeur?:number,hauteur?:number,pages?:number,ecartPages?:number},
 *           marges?:{haut?:number,bas?:number,gauche?:number,droite?:number},
 *           position?:{x?:number,y?:number}|null,
 *           alignement?:'centre'|'gauche'|'droite', reduireSiBesoin?:boolean,
 *           hauteurMin?:number, ecart?:number }} p
 *   `objets` sert au FLUX (bas du dernier bloc) ; `obstacles` au test de recouvrement.
 *   Les deux listes sont distinctes à dessein : l'appelant peut vouloir descendre sous
 *   un texte sans considérer un aplat décoratif comme un obstacle (défaut : `objets`).
 * @returns {{x:number,y:number,width:number,height:number,place:boolean,raison:string|null,
 *            pageIndex:number,reduit:boolean,deformation:number,deplace:boolean,
 *            recouvrement:number}}
 */
export function placerDansLaPage(p = {}) {
  const marges = { ...MARGES_PAR_DEFAUT, ...(p.marges ?? {}) };
  const page = p.page ?? {};
  const nbPages = Math.max(1, Math.round(nbPositif(page.pages) ?? 1));
  const alignement = ['centre', 'gauche', 'droite'].includes(p.alignement) ? p.alignement : 'centre';
  const reduireSiBesoin = p.reduireSiBesoin !== false;
  const hauteurMin = nbPositif(p.hauteurMin) ?? 120;
  const ecart = nb(p.ecart) ?? ECART_FLUX;

  const zone0 = zoneUtile(page, marges, 0);

  /* Taille souhaitée : au rapport natif si on le connaît, sinon la boîte fournie. */
  const img = p.image ?? {};
  let largeurNative = nbPositif(img.largeurNative);
  let hauteurNative = nbPositif(img.hauteurNative);
  let souhait;
  if (largeurNative !== null && hauteurNative !== null) {
    souhait = boiteAuFormat({
      largeurNative,
      hauteurNative,
      largeurMax: Math.min(nbPositif(img.largeurMax) ?? zone0.width, zone0.width),
      hauteurMax: Math.min(nbPositif(img.hauteurMax) ?? zone0.height, zone0.height),
    });
  } else {
    const w = nbPositif(img.width) ?? BOITE_MAX_DEFAUT.largeurMax;
    const h = nbPositif(img.height) ?? BOITE_MAX_DEFAUT.hauteurMax;
    largeurNative = w;
    hauteurNative = h;
    souhait = boiteAuFormat({
      largeurNative: w,
      hauteurNative: h,
      largeurMax: Math.min(w, zone0.width),
      hauteurMax: Math.min(h, zone0.height),
    });
  }
  const rapport = souhait.width / souhait.height;

  /* Bas du flux existant — mêmes bornes que documentBlockLayout.nextFlowPosition. */
  const tousObjets = Array.isArray(p.objets) ? p.objets : [];
  const hauteurPage = nbPositif(page.hauteur) ?? 1123;
  const largeurPage = nbPositif(page.largeur) ?? 794;
  const pasPage = hauteurPage + (nb(page.ecartPages) ?? 0);
  /* Un fond perdu n'appartient ni au flux ni aux obstacles : il est SOUS la mise en page. */
  const estFond = (o) => estFondDePage(o, largeurPage, hauteurPage);
  const objets = tousObjets.filter((o) => !estFond(o));
  const obstacles = (Array.isArray(p.obstacles) ? p.obstacles : tousObjets).filter((o) => !estFond(o));
  /** Le point de chute demandé a-t-il dû être abandonné ? (renseigne le retour) */
  let deplace = false;
  let basFlux = null;
  for (const o of objets) {
    const y = nb(o?.y);
    if (y === null) continue;
    const b = y + (nb(o?.height) ?? 0);
    if (b > (basFlux ?? -Infinity) && b < pasPage * nbPages + hauteurPage) basFlux = b;
  }

  const indexDepart = basFlux === null ? 0 : borner(Math.floor(basFlux / pasPage), 0, nbPages - 1);

  /* Lu AVANT `poser` : le point de chute demandé sert aussi au reflux (voir ci-dessous). */
  const xVoulu = nb(p.position?.x);
  const yVoulu = nb(p.position?.y);

  const poser = (index, y, width, height, reduit) => {
    const zone = zoneUtile(page, marges, index);
    /* ⛔ MESURÉ (2026-08-06) : une image « Colonne gauche » chassée de son point de
       chute (52,180 occupé) redescendait dans le flux mais RECENTRÉE — x=278, plus
       aucune marge gauche. Le reflux n'abandonne que le `y` demandé : le `x`, qui
       porte l'habillage choisi (marge gauche/droite), est conservé et seulement
       borné à la zone utile. L'alignement ne décide que lorsqu'aucun x n'est demandé. */
    const x =
      xVoulu !== null
        ? borner(xVoulu, zone.x, Math.max(zone.x, zone.x + zone.width - width))
        : alignement === 'gauche'
          ? zone.x
          : alignement === 'droite'
            ? zone.x + zone.width - width
            : zone.x + (zone.width - width) / 2;
    const boite = { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
    return {
      ...boite,
      place: true,
      raison: null,
      pageIndex: index,
      reduit,
      deformation: deformation({ width, height }, largeurNative / hauteurNative),
      deplace,
      recouvrement: recouvrementMaximal(boite, obstacles),
    };
  };

  /* ── Point de chute demandé ────────────────────────────────────────────────
     Il est RESPECTÉ tant qu'il ne recouvre rien. C'est le seul chemin par lequel
     passaient les trois imports mesurés : l'appelant demandait toujours 52,180
     (Document) ou 100,120 (Affiche), et rien ne regardait ce qui s'y trouvait déjà. */
  if (xVoulu !== null && yVoulu !== null) {
    const index = borner(Math.floor(yVoulu / pasPage), 0, nbPages - 1);
    const zone = zoneUtile(page, marges, index);
    const refit = boiteAuFormat({
      largeurNative,
      hauteurNative,
      largeurMax: Math.min(souhait.width, zone.width),
      hauteurMax: Math.min(souhait.height, zone.height),
      agrandir: true, // `souhait` est déjà borné au natif : ce refit ne fait que rentrer dans la zone
    });
    const boite = {
      x: borner(xVoulu, zone.x, Math.max(zone.x, zone.x + zone.width - refit.width)),
      y: borner(yVoulu, zone.y, Math.max(zone.y, zone.bas - refit.height)),
      width: refit.width,
      height: refit.height,
    };
    const gene = recouvrementMaximal(boite, obstacles);
    if (gene < SEUIL_RECOUVREMENT) {
      return {
        x: Math.round(boite.x),
        y: Math.round(boite.y),
        width: boite.width,
        height: boite.height,
        place: true,
        raison: null,
        pageIndex: index,
        reduit: refit.height < souhait.height,
        deformation: deformation(refit, largeurNative / hauteurNative),
        deplace: false,
        recouvrement: gene,
      };
    }
    /* Occupé : on abandonne le point de chute pour le flux, comme
       `documentBlockLayout.nextFlowPosition` le fait déjà pour le texte. */
    deplace = true;
  }

  const zoneDepart = zoneUtile(page, marges, indexDepart);
  const yFlux = basFlux === null ? zoneDepart.y : Math.max(zoneDepart.y, basFlux + ecart);

  /* 1. Ça tient tel quel, sous le dernier bloc. */
  if (yFlux + souhait.height <= zoneDepart.bas) {
    return poser(indexDepart, yFlux, souhait.width, souhait.height, false);
  }

  /* 2. Une page suivante existe : on y descend, en haut de zone. */
  if (indexDepart + 1 < nbPages) {
    const suivante = zoneUtile(page, marges, indexDepart + 1);
    const refit = boiteAuFormat({
      largeurNative,
      hauteurNative,
      largeurMax: Math.min(souhait.width, suivante.width),
      hauteurMax: Math.min(souhait.height, suivante.height),
    });
    return poser(indexDepart + 1, suivante.y, refit.width, refit.height, refit.height < souhait.height);
  }

  /* 3. Dernière page : on réduit AU RAPPORT, tant que ça reste lisible. */
  const reste = zoneDepart.bas - yFlux;
  if (reduireSiBesoin && reste >= hauteurMin) {
    const height = reste;
    const width = Math.min(zoneDepart.width, height * rapport);
    return poser(indexDepart, yFlux, width, width / rapport, true);
  }

  /* 4. Plus de place : on le DIT, et on rend malgré tout une position légale. */
  const height = Math.min(souhait.height, zoneDepart.height);
  const width = Math.min(souhait.width, zoneDepart.width);
  const y = borner(yFlux, zoneDepart.y, zoneDepart.bas - height);
  const secours = poser(indexDepart, y, width, height, height < souhait.height);
  return { ...secours, place: false, raison: 'page-pleine' };
}

/* ═══════════════════════════════════════════════════════════════════
   6. Déformation — le chiffre que la critique d'export doit dénoncer
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Écart en % entre le rapport de la boîte et le rapport natif.
 * 0 = fidèle. 161,6 = la 602×900 posée en 560×320 (défaut mesuré).
 * ⛔ Rend 0 quand le rapport natif est inconnu : on ne reproche pas ce qu'on n'a pas mesuré.
 * @param {{width:number,height:number}} boite @param {number} rapportNatif
 * @returns {number}
 */
export function deformation(boite, rapportNatif) {
  const l = nbPositif(boite?.width);
  const h = nbPositif(boite?.height);
  const rn = nbPositif(rapportNatif);
  if (l === null || h === null || rn === null) return 0;
  return arrondi((Math.abs(l / h - rn) / rn) * 100, 2);
}

/**
 * Détail lisible de la déformation (pour un message de critique).
 * @param {{width:number,height:number}} boite @param {number} rapportNatif
 * @returns {{ecartPct:number,facteurLargeur:number,sens:'etiree'|'ecrasee'|'fidele',visible:boolean}}
 */
export function diagnostiquerDeformation(boite, rapportNatif) {
  const ecartPct = deformation(boite, rapportNatif);
  const l = nbPositif(boite?.width);
  const h = nbPositif(boite?.height);
  const rn = nbPositif(rapportNatif);
  if (l === null || h === null || rn === null) {
    return { ecartPct: 0, facteurLargeur: 1, sens: 'fidele', visible: false };
  }
  const facteurLargeur = arrondi(l / h / rn, 3);
  return {
    ecartPct,
    facteurLargeur,
    sens: ecartPct < SEUIL_DEFORMATION_VISIBLE ? 'fidele' : facteurLargeur > 1 ? 'etiree' : 'ecrasee',
    visible: ecartPct >= SEUIL_DEFORMATION_VISIBLE,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Composition — ce que l'agent « canevas » applique à l'objet image
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Géométrie complète d'une image à insérer : boîte au rapport natif, position qui
 * tient dans la page, crop si un cadre est imposé.
 *
 * ⛔ Aucun écrit dans le store ici : le retour est un simple patch à appliquer
 * (`{x,y,width,height}` sur l'objet, `crop` dans `content`).
 *
 * @param {{ largeurNative:number, hauteurNative:number, objets?:Array,
 *           page?:object, marges?:object, mode?:string,
 *           cadre?:{width:number,height:number}, focale?:object, zoom?:number,
 *           alignement?:string }} p
 * @returns {{x:number,y:number,width:number,height:number,crop:object|null,mode:string,
 *            unite:'px'|'ratio',deformation:number,place:boolean,raison:string|null,
 *            pageIndex:number,rapportNatif:number}}
 */
export function proposerGeometrieImage(p = {}) {
  const { largeurNative, hauteurNative, rapportNatif } = dimensionsNatives(p);
  const mode = normaliserMode(p.mode);

  const cadreL = nbPositif(p.cadre?.width);
  const cadreH = nbPositif(p.cadre?.height);

  if (cadreL !== null && cadreH !== null) {
    /* Cadre imposé : on remplit/rogne, la position vient du placement du cadre. */
    const pose = placerDansLaPage({
      objets: p.objets,
      image: { width: cadreL, height: cadreH },
      page: p.page,
      marges: p.marges,
      alignement: p.alignement,
    });
    const r = calculerCrop({
      largeurNative,
      hauteurNative,
      boite: { x: pose.x, y: pose.y, width: pose.width, height: pose.height },
      mode,
      focale: p.focale,
      zoom: p.zoom,
    });
    return {
      x: Math.round(r.boite.x),
      y: Math.round(r.boite.y),
      width: Math.round(r.boite.width),
      height: Math.round(r.boite.height),
      crop: r.crop,
      mode,
      unite: r.unite,
      deformation: r.deformation,
      place: pose.place,
      raison: pose.raison,
      pageIndex: pose.pageIndex,
      rapportNatif,
    };
  }

  const pose = placerDansLaPage({
    objets: p.objets,
    image: { largeurNative, hauteurNative, largeurMax: p.largeurMax, hauteurMax: p.hauteurMax },
    page: p.page,
    marges: p.marges,
    alignement: p.alignement,
  });
  return {
    x: pose.x,
    y: pose.y,
    width: pose.width,
    height: pose.height,
    crop: null,
    mode: MODES_AJUSTEMENT.CONTAIN,
    unite: 'px',
    deformation: pose.deformation,
    place: pose.place,
    raison: pose.raison,
    pageIndex: pose.pageIndex,
    rapportNatif,
  };
}
