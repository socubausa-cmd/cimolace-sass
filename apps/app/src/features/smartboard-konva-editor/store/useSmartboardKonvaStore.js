import { create } from 'zustand';
import {
  createEmptyProject,
  createEmptyScene,
  genSceneId,
  genSbKonvaId,
  createSection,
  sortObjectsByLayer,
} from '../model/sceneModel';
import {
  contourDeLObjet,
  estOperableBooleen,
  unionDePolygones,
  intersectionDePolygones,
  soustractionDePolygones,
  divisionDePolygones,
  stylePeintDeLObjet,
  boucleVersObjetLine,
  pairesDuTrace,
  projeterSurTrace,
  arrondirCoinTrace,
  rebaserTrace,
  docVersLocalTrace,
} from '../lib/cheminsVectoriels';
import { getPalettePageBackground, getPolotnoTypographyForPreset } from '../lib/liriCourseTheme';
import { buildSceneFromSlide } from '../lib/buildSceneFromSlide';
import { normaliserObjetsDocument, encreLisible, DOC_PAGE_BG } from '../lib/documentBlockLayout';
import { FORMATS_PAGE, MARGES_DEFAUT } from '../lib/documentPagination';
import {
  boiteAuFormat,
  boiteNeutre,
  placerDansLaPage,
  deformation as deformationImage,
  normaliserMode,
  MODE_AJUSTEMENT_DEFAUT,
  MODES_AJUSTEMENT,
  BOITE_MAX_DEFAUT,
} from '../lib/documentImages';
import { useDesignerShellStore } from './useDesignerShellStore';

/**
 * @typedef {import('../model/sceneTypes').SbKonvaProject} SbKonvaProject
 * @typedef {import('../model/sceneTypes').SbKonvaObjectBase} SbKonvaObjectBase
 */

/** Historique undo/redo — large pour ne pas couper le travail (coût mémoire modéré). */
const historyLimit = 5000;

function cloneProject(p) {
  return structuredClone(p);
}

/** Boîte englobante union des objets (coords modèle x,y,width,height). */
function selectionUnionBounds(objs) {
  if (!objs?.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of objs) {
    const x = o.x ?? 0;
    const y = o.y ?? 0;
    const w = o.width ?? 0;
    const h = o.height ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: minX + w / 2,
    centerY: minY + h / 2,
  };
}

/**
 * Passe le lot inséré par la normalisation « page A4 blanche » — et SEULEMENT en mode
 * Document. Ailleurs (Smartboard, Présentation, Affiche, Vidéo) le lot ressort intact.
 *
 * ⛔ CONTRAINTE : c'est le seul point de passage commun à toutes les insertions
 * (rail métier, presets Texte, modèles, plume, IA). Corriger chaque appelant à la
 * source laisserait repasser le défaut au prochain bouton ajouté.
 *
 * @param {any[]} objs @param {any} etat état courant du store
 */
function adapterInsertionAuDocument(objs, etat) {
  const lot = Array.isArray(objs) ? objs : [];
  if (!lot.length) return lot;
  let docType = null;
  try {
    docType = useDesignerShellStore.getState()?.docType ?? null;
  } catch {
    docType = null; // store non monté (test unitaire, rendu serveur) : on ne normalise pas.
  }
  if (docType !== 'document') return lot;
  const projet = etat?.project;
  const scene = projet?.scenes?.find((s) => s.id === projet.activeSceneId) || projet?.scenes?.[0];
  return normaliserObjetsDocument(lot, scene?.objects ?? [], {
    fondPage: projet?.canvas?.background,
    largeurPage: projet?.canvas?.width,
  });
}

/**
 * Encre lisible sur le fond du canevas — pour les modes AUTRES que Document.
 *
 * ⛔ MESURÉ le 2026-08-05 sur l'affiche Orabank : un titre inséré sortait en encre
 * #F7F2E8 (le crème du Smartboard) pour un contraste de 1,12:1 — invisible. Le
 * correctif existait déjà mais était conditionné à `docType === 'document'` et ne
 * couvrait donc ni l'affiche, ni la présentation, ni la vidéo.
 *
 * ⛔ N'AGIT QUE si le contraste est réellement insuffisant (`encreLisible` rend null
 * sinon) : sur le Smartboard, fond sombre, le crème reste le bon choix et rien ne
 * bouge. Ne touche ni la position, ni la taille, ni un objet déjà calibré (`meta`).
 */
function adapterEncreAuCanevas(objs, etat) {
  const lot = Array.isArray(objs) ? objs : [];
  if (!lot.length) return lot;
  let docType = null;
  try {
    docType = useDesignerShellStore.getState()?.docType ?? null;
  } catch {
    docType = null;
  }
  if (docType === 'document') return lot; // déjà traité par normaliserObjetsDocument
  const fond = etat?.project?.canvas?.background;
  if (!fond || fond === 'transparent' || fond === 'none') return lot;
  return lot.map((o) => {
    if (!o || o.type !== 'text' || o.meta) return o;
    const corrigee = encreLisible(o.style?.fill, fond);
    if (!corrigee) return o;
    return { ...o, style: { ...(o.style ?? {}), fill: corrigee } };
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Images — la boîte vient du rapport NATIF, jamais d'un gabarit en dur
   ═══════════════════════════════════════════════════════════════════ */

/** Marqueur porté par une image dont la boîte n'a pas encore été validée à la main. */
export const META_IMAGE = 'image';

/**
 * Géométrie de page déduite du canevas.
 *
 * ⛔ Le canevas n'est PAS toujours une page : Smartboard (1037×750), Affiche
 * (2480×3508 @300 dpi), Vidéo (1920×1080) n'ont ni format normalisé ni marges. On ne
 * reconnaît une pile de pages qu'à la largeur (comme `hauteurDeCadrage`) ; ailleurs on
 * garde une marge proportionnelle, sans quoi une image d'affiche serait bornée par des
 * marges A4 calculées à 96 dpi sur un canevas qui est à 300.
 *
 * @param {{width?:number,height?:number}} canvas
 * @returns {{ page: {largeur:number,hauteur:number,pages:number,ecartPages:number},
 *             marges: {haut:number,bas:number,gauche:number,droite:number} }}
 */
export function pageDuCanevas(canvas) {
  const largeur = Math.max(1, Number(canvas?.width) || 794);
  const hauteur = Math.max(1, Number(canvas?.height) || 1123);
  const format = Object.values(FORMATS_PAGE).find((f) => Math.abs(f.largeur - largeur) <= 2);
  if (format) {
    return {
      page: {
        largeur: format.largeur,
        hauteur: format.hauteur,
        pages: Math.max(1, Math.round(hauteur / format.hauteur)),
        ecartPages: 0,
      },
      marges: { ...MARGES_DEFAUT },
    };
  }
  const m = Math.round(Math.min(largeur, hauteur) * 0.04);
  return {
    page: { largeur, hauteur, pages: 1, ecartPages: 0 },
    marges: { haut: m, bas: m, gauche: m, droite: m },
  };
}

function borne(v, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(v, min), max);
}

/**
 * Boîte + position d'une image, bornées par la zone utile de la page.
 *
 * Deux régimes, volontairement distincts :
 *  · position DEMANDÉE (import, modèle, IA) → on la garde et on la borne dans la page ;
 *  · aucune position (collage) → `placerDansLaPage` pose dans le flux, sous le dernier bloc.
 *
 * ⛔ MESURÉ le 2026-08-05 : sans ce passage, toute image recevait 560 × 320
 * (602×900 → étirée ×2,6) et pouvait atterrir à y=1382 sur une page haute de 1123.
 *
 * ⛔ MESURÉ le 2026-08-05 (défaut [CRIT-RECOUVR]) : « position DEMANDÉE → on la garde »
 * posait les trois images du même import au même pixel (52,180 en Document, 100,120 en
 * Affiche), deux invisibles sous la troisième. La position demandée n'est donc plus
 * gardée que si elle est LIBRE — `placerDansLaPage` la teste et descend dans le flux
 * sinon. Seul le PLEIN FOND garde sa position quoi qu'il arrive : un fond perdu est
 * fait pour être recouvert.
 *
 * @param {{ natif?: {largeurNative:number,hauteurNative:number} | null,
 *           souhait?: {x?:number,y?:number,width?:number,height?:number},
 *           objets?: Array<object>, canvas?: object }} p
 * @returns {{x:number,y:number,width:number,height:number,place:boolean,deformation:number,
 *            deplace:boolean,raison:string|null,neutre:boolean}}
 */
export function geometrieImage({ natif = null, souhait = {}, objets = [], canvas = {} } = {}) {
  const { page, marges } = pageDuCanevas(canvas);
  const zoneL = Math.max(1, page.largeur - marges.gauche - marges.droite);
  const zoneH = Math.max(1, page.hauteur - marges.haut - marges.bas);

  const lNat = Number(natif?.largeurNative) > 0 ? Number(natif.largeurNative) : null;
  const hNat = Number(natif?.hauteurNative) > 0 ? Number(natif.hauteurNative) : null;
  const lVoulue = Number(souhait?.width) > 0 ? Number(souhait.width) : null;
  const hVoulue = Number(souhait?.height) > 0 ? Number(souhait.height) : null;
  const xVoulu = Number.isFinite(Number(souhait?.x)) ? Number(souhait.x) : null;
  const yVoulu = Number.isFinite(Number(souhait?.y)) ? Number(souhait.y) : null;

  /**
   * ⛔ PLEIN FOND : une image de fond d'affiche est DEMANDÉE plus grande que la zone
   * imprimable, souvent posée à (0,0). La borner aux marges la réduirait à une vignette
   * centrée — on corrigerait un défaut en en créant un autre. Dans ce cas le cadre de
   * référence est la PAGE entière, pas la zone utile.
   *
   * ⛔ MESURÉ le 2026-08-06 (bannière 690 px) : la comparaison LARGE (`>=`) rangeait la
   * bannière « Pleine largeur » (690 = exactement la zone utile) parmi les fonds
   * perdus — qui gardent leur position quoi qu'il arrive — et elle s'écrasait sur les
   * images déjà posées. Un fond perdu DÉBORDE de la zone ; une bannière la remplit.
   */
  const pleinFond =
    (lVoulue !== null && lVoulue > zoneL) ||
    (hVoulue !== null && hVoulue > zoneH) ||
    (xVoulu !== null && xVoulu < marges.gauche) ;

  /**
   * BANNIÈRE : largeur demandée = toute la zone utile, hauteur imposée. Ce cadre est
   * une PROMESSE de mise en page (« Pleine largeur »), pas un gabarit maximal : la
   * boîte reste telle quelle et c'est l'ajustement `cover` qui y inscrit l'image —
   * jamais l'inverse (la 690×300 relue au rapport natif finissait à 201 px de large).
   */
  const banniere =
    !pleinFond && lVoulue !== null && hVoulue !== null && lVoulue >= zoneL - 2;
  const cadre = pleinFond
    ? { gauche: 0, haut: 0, largeur: page.largeur, hauteur: page.hauteur }
    : { gauche: marges.gauche, haut: marges.haut, largeur: zoneL, hauteur: zoneH };

  /** Borne la boîte dans la page où tombe `y` (documents à pages empilées). */
  const poserDansLaPage = (width, height, deformationBoite) => {
    const pas = page.hauteur + page.ecartPages;
    const index = borne(Math.floor((yVoulu ?? cadre.haut) / pas), 0, page.pages - 1);
    const hautPage = index * pas;
    return {
      x: Math.round(borne(xVoulu ?? cadre.gauche, cadre.gauche, cadre.gauche + cadre.largeur - width)),
      y: Math.round(
        borne(yVoulu ?? hautPage + cadre.haut, hautPage + cadre.haut, hautPage + cadre.haut + cadre.hauteur - height),
      ),
      width: Math.round(width),
      height: Math.round(height),
      place: true,
      deformation: deformationBoite,
      deplace: false,
      raison: null,
      neutre: false,
      banniere: false,
    };
  };

  /** Aire d'intersection de deux boîtes {x,y,width,height}. */
  const aireCommune = (a, b) => {
    const l = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return l * h;
  };

  /**
   * La boîte posée ENTERRE-t-elle une image déjà là ?
   *
   * ⛔ `placerDansLaPage` ne mesure le recouvrement que rapporté à la boîte à POSER :
   * une bannière large posée sur une vignette n'était « gênée » qu'à 51 % (< seuil)
   * alors que la vignette, elle, disparaissait à 85 %. Le test manquant est celui-ci —
   * rapporté à l'aire de l'OBSTACLE. Même seuil (0,55) que le reste du dépôt.
   */
  const enterreUneImage = (boite, obstacles) => {
    const aireBoite = boite.width * boite.height;
    if (!(aireBoite > 0)) return false;
    for (const o of obstacles) {
      const b = {
        x: Number(o?.x) || 0,
        y: Number(o?.y) || 0,
        width: Math.max(0, Number(o?.width) || 0),
        height: Math.max(0, Number(o?.height) || 0),
      };
      const aire = b.width * b.height;
      if (!(aire > 0)) continue;
      if (aireCommune(boite, b) / aire > 0.55) return true;
    }
    return false;
  };

  /**
   * Pose en évitant les objets DÉJÀ POSÉS. Le point de chute demandé est transmis tel
   * quel : `placerDansLaPage` le garde s'il est libre, l'abandonne s'il empile.
   *
   * ⛔ Les obstacles sont les IMAGES, pas tous les objets : un aplat, un filet ou un
   * cartouche sont faits pour être recouverts par une image, et une image chassée de
   * son fond serait un défaut de plus, pas un de moins. Le flux, lui, tient compte de
   * TOUS les objets (`objets`) — une image ne doit pas retomber sur un paragraphe.
   */
  const poserSansEmpiler = (image, neutre) => {
    const obstacles = objets.filter((o) => o?.type === 'image');
    const position =
      xVoulu === null && yVoulu === null ? null : { x: xVoulu ?? cadre.gauche, y: yVoulu ?? cadre.haut };
    let pose = placerDansLaPage({ objets, obstacles, image, page, marges, position });
    let deplace = pose.deplace === true;
    /* Point de chute gardé mais une image déjà posée disparaît dessous : on descend
       dans le flux quand même (cf. enterreUneImage — le test symétrique manquant). */
    if (position && !deplace && enterreUneImage(pose, obstacles)) {
      pose = placerDansLaPage({ objets, obstacles, image, page, marges, position: null });
      deplace = true;
    }
    /* ⛔ Le reflux recentrait l'image (x = (page − largeur)/2) : une « Colonne gauche »
       chassée de son point de chute perdait sa marge gauche. Le x demandé est une
       intention de mise en page — on le garde, borné à la zone. Le y du flux, lui,
       est le bon (il est là pour ça). */
    const x =
      deplace && xVoulu !== null
        ? Math.round(borne(xVoulu, cadre.gauche, Math.max(cadre.gauche, cadre.gauche + cadre.largeur - pose.width)))
        : pose.x;
    return {
      x,
      y: pose.y,
      width: pose.width,
      height: pose.height,
      place: pose.place,
      deformation: pose.deformation,
      deplace,
      raison: pose.raison ?? null,
      neutre: neutre === true,
      banniere: false,
    };
  };

  /* ── Bannière : le cadre demandé EST la boîte, l'image s'y inscrit en `cover` ──
     Le pseudo-natif (largeur/hauteur du cadre) fait garder au placement exactement
     ces proportions ; l'anti-empilement de `poserSansEmpiler` s'applique. */
  if (banniere) {
    return {
      ...poserSansEmpiler({ width: Math.min(lVoulue, zoneL), height: Math.min(hVoulue, zoneH) }, false),
      banniere: true,
    };
  }

  /* Pas encore de mesure native : AUCUNE boîte ne peut être juste. On pose un carré de
     la surface demandée (cf. `boiteNeutre`) plutôt que le 560 × 320 qui affirmait un
     format au hasard pendant les 3,4 à 6,1 s de chargement du bitmap. */
  if (lNat === null || hNat === null) {
    const lDemandee = Math.min(lVoulue ?? Math.min(BOITE_MAX_DEFAUT.largeurMax, cadre.largeur), cadre.largeur);
    const hDemandee = Math.min(hVoulue ?? Math.min(BOITE_MAX_DEFAUT.hauteurMax, cadre.hauteur), cadre.hauteur);
    /* Un fond perdu est demandé plein cadre : le rendre carré le décadrerait. */
    if (pleinFond) return poserDansLaPage(lDemandee, hDemandee, 0);
    const neutre = boiteNeutre({
      largeurVoulue: lDemandee,
      hauteurVoulue: hDemandee,
      largeurMax: cadre.largeur,
      hauteurMax: cadre.hauteur,
    });
    return poserSansEmpiler({ width: neutre.width, height: neutre.height }, true);
  }

  const boite = boiteAuFormat({
    largeurNative: lNat,
    hauteurNative: hNat,
    largeurMax: Math.min(lVoulue ?? cadre.largeur, cadre.largeur),
    hauteurMax: Math.min(hVoulue ?? cadre.hauteur, cadre.hauteur),
    /* Un fond d'affiche DOIT pouvoir dépasser sa taille native, sinon il ne couvre rien. */
    agrandir: pleinFond,
  });

  if (pleinFond) return poserDansLaPage(boite.width, boite.height, boite.deformation);

  return poserSansEmpiler(
    { largeurNative: lNat, hauteurNative: hNat, largeurMax: boite.width, hauteurMax: boite.height },
    false,
  );
}

/**
 * Passe TOUTES les insertions d'images (import, presse-papiers, modèle, IA) par la
 * géométrie ci-dessus. Point de passage unique : `addObject` / `addObjects`.
 *
 * ⛔ Une image déjà mesurée (`content.natif`) et posée à la main n'est pas retouchée.
 */
function adapterImagesAuCanevas(objs, etat) {
  const lot = Array.isArray(objs) ? objs : [];
  if (!lot.some((o) => o?.type === 'image')) return lot;
  const projet = etat?.project;
  const scene = projet?.scenes?.find((s) => s.id === projet.activeSceneId) || projet?.scenes?.[0];
  /* ⛔ Le lot s'ajoute à lui-même : sans cette accumulation, trois images insérées d'un
     seul geste s'ignoreraient entre elles et se reposeraient au même point — le défaut
     mesuré, déplacé d'un cran. */
  const objets = [...(scene?.objects ?? [])];
  return lot.map((o) => {
    if (!o || o.type !== 'image') {
      if (o) objets.push(o);
      return o;
    }
    const natif =
      Number(o.content?.natif?.largeurNative) > 0 && Number(o.content?.natif?.hauteurNative) > 0
        ? o.content.natif
        : null;
    const g = geometrieImage({
      natif,
      souhait: { x: o.x, y: o.y, width: o.width, height: o.height },
      objets,
      canvas: projet?.canvas,
    });
    /* Bannière : cadre promis → l'image le REMPLIT (`cover`, rogné jamais déformé) —
       sauf habillage explicitement demandé par l'appelant, qui garde le dernier mot. */
    const ajustement =
      g.banniere && o.style?.ajustement == null
        ? MODES_AJUSTEMENT.COVER
        : normaliserMode(o.style?.ajustement);
    const pose = {
      ...o,
      x: g.x,
      y: g.y,
      width: g.width,
      height: g.height,
      style: { ...(o.style ?? {}), ajustement },
      meta: {
        ...(o.meta ?? {}),
        [META_IMAGE]: {
          ...(o.meta?.[META_IMAGE] ?? {}),
          /* Cadre PROMIS (bannière) : la mesure native ne devra pas le rétrécir. */
          ...(g.banniere ? { cadre: { width: g.width, height: g.height } } : {}),
          /* Boîte provisoire (NEUTRE, carrée) tant que la mesure native n'est pas revenue
             du chargement : `boiteAuto === true` ⟺ « rien n'a encore été affirmé sur le
             format de ce fichier ». C'est le seul drapeau, il n'en faut pas un second. */
          boiteAuto: natif ? false : true,
          /* Trace de la pose : `deplace` = point de chute occupé, `place:false` = page
             pleine. Écrit plutôt que tu par un empilement silencieux. */
          pose: { deplace: g.deplace === true, place: g.place !== false, raison: g.raison ?? null },
        },
      },
    };
    objets.push(pose);
    return pose;
  });
}

/** Tailles de police proposées par l'UI — hors de cette échelle, on borne (jamais 0). */
const TAILLE_POLICE_MIN = 4;
const TAILLE_POLICE_MAX = 800;

/**
 * Assainit un patch avant écriture.
 *
 * ⛔ MESURÉ : une taille de police hors liste écrivait `fontSize: 0` — le texte
 * disparaissait sans un mot. Une valeur nulle, négative ou non numérique est ici
 * REFUSÉE (la précédente est conservée), jamais enregistrée.
 */
function assainirPatch(partial) {
  const st = partial?.style;
  if (!st || typeof st !== 'object' || !('fontSize' in st)) return partial;
  const brut = Number(st.fontSize);
  if (Number.isFinite(brut) && brut >= TAILLE_POLICE_MIN) {
    if (brut <= TAILLE_POLICE_MAX) return partial;
    return { ...partial, style: { ...st, fontSize: TAILLE_POLICE_MAX } };
  }
  const { fontSize: _refuse, ...reste } = st;
  return { ...partial, style: reste };
}

/* ═══════════════════════════════════════════════════════════════════
   Booléens vectoriels — préparation de la sélection
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Sélection dans l'ORDRE DE RENDU (layer croissant puis insertion) : le « dessus »
 * est le DERNIER.
 *
 * ⛔ MESURÉ : `(a.layer??0) >= (b.layer??0)` prenait le PREMIER objet comme « dessus »
 * quand aucun layer n'était posé — Soustraire supprimait la forme visuellement
 * DESSOUS. L'ordre de rendu, lui, tranche comme l'écran.
 */
function selectionOrdreRendu(scene, selectedIds) {
  const ids = new Set(selectedIds);
  return sortObjectsByLayer(scene?.objects ?? []).filter((o) => ids.has(o.id));
}

/**
 * Contours de toute la sélection — ou le refus TYPÉ si un objet n'est pas opérable
 * (texte, image… : un booléen ne transforme JAMAIS un titre en rectangle muet).
 * @returns {{ ok:true, contours: Array<{obj, contour}> } | { ok:false, raison, type? }}
 */
function contoursDeLaSelection(objs) {
  const contours = [];
  for (const o of objs) {
    const v = estOperableBooleen(o);
    if (!v.ok) return { ok: false, raison: v.raison, type: o.type };
    const contour = contourDeLObjet(o);
    if (!contour) return { ok: false, raison: 'type', type: o.type };
    contours.push({ obj: o, contour });
  }
  return { ok: true, contours };
}

/** Remplace les objets `remplaces` de la scène active par `nouveaux` (fin de pile). */
function remplacerDansScene(set, remplaces, nouveaux) {
  const enleves = new Set(remplaces);
  set((state) => ({
    project: {
      ...state.project,
      scenes: state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return { ...s, objects: [...s.objects.filter((o) => !enleves.has(o.id)), ...nouveaux] };
      }),
    },
    selectedIds: nouveaux.map((o) => o.id),
  }));
}

export const useSmartboardKonvaStore = create((set, get) => ({
  project: createEmptyProject(),
  selectedIds: [],
  /** Studio Image / workbench : pointer | sélection rect / ellipse / lasso */
  interactionTool: 'pointer',
  /** Région doc-space { kind, x, y, width, height } pour contexte IA après sélection */
  regionMarquee: null,
  historyPast: [],
  historyFuture: [],
  /** timestamps (ms) paralleles a historyPast */
  historyTimestamps: [],
  /** JSON scene propose par l'IA avant apply */
  aiPreview: null,

  pushHistory: () => {
    const { project, historyPast, historyFuture, historyTimestamps } = get();
    const snap = cloneProject(project);
    const past = [...historyPast, snap].slice(-historyLimit);
    const ts = [...historyTimestamps, Date.now()].slice(-historyLimit);
    set({ historyPast: past, historyFuture: [], historyTimestamps: ts });
  },

  undo: () => {
    const { historyPast, historyFuture, project, historyTimestamps } = get();
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, -1);
    set({
      project: prev,
      historyPast: newPast,
      historyFuture: [cloneProject(project), ...historyFuture],
      historyTimestamps: historyTimestamps.slice(0, -1),
      selectedIds: [],
    });
  },

  redo: () => {
    const { historyFuture, historyPast, project } = get();
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const newFut = historyFuture.slice(1);
    set({
      project: next,
      historyPast: [...historyPast, cloneProject(project)],
      historyFuture: newFut,
      selectedIds: [],
    });
  },

  getActiveScene: () => {
    const { project } = get();
    return project.scenes.find((s) => s.id === project.activeSceneId) || project.scenes[0];
  },

  setActiveScene: (sceneId) => {
    set((state) => ({
      project: { ...state.project, activeSceneId: sceneId },
      selectedIds: [],
    }));
  },

  addScene: () => {
    get().pushHistory();
    const name = `Scène ${get().project.scenes.length + 1}`;
    const scene = createEmptyScene(name);
    set((state) => ({
      project: {
        ...state.project,
        scenes: [...state.project.scenes, scene],
        activeSceneId: scene.id,
      },
      selectedIds: [],
    }));
  },

  duplicateActiveScene: () => {
    get().pushHistory();
    const scene = get().getActiveScene();
    if (!scene) return;
    const copy = structuredClone(scene);
    copy.id = genSceneId();
    copy.name = `${scene.name} (copie)`;
    set((state) => ({
      project: {
        ...state.project,
        scenes: [...state.project.scenes, copy],
        activeSceneId: copy.id,
      },
      selectedIds: [],
    }));
  },

  setSceneDuration: (sceneId, durationMinutes) => {
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId ? { ...s, durationMinutes: Math.max(0, Number(durationMinutes) || 0) } : s,
        ),
      },
    }));
  },

  /** Applique un theme global a toutes les scenes (fond) */
  applyGlobalTheme: (theme) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        canvas: { ...state.project.canvas, background: theme.bg },
        scenes: state.project.scenes.map((s) => ({ ...s, _themeAccent: theme.accent, _themeFontTitle: theme.fontTitle, _themeFontBody: theme.fontBody })),
      },
    }));
  },

  renameScene: (sceneId, name) => {
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId ? { ...s, name } : s,
        ),
      },
    }));
  },

  deleteScene: (sceneId) => {
    const { project } = get();
    if (project.scenes.length <= 1) return; // garder au moins 1 scene
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.filter((s) => s.id !== sceneId);
      const activeSceneId =
        state.project.activeSceneId === sceneId
          ? (scenes[scenes.indexOf(state.project.scenes.find((s) => s.id === sceneId)) - 1] || scenes[0])?.id
          : state.project.activeSceneId;
      return { project: { ...state.project, scenes, activeSceneId }, selectedIds: [] };
    });
  },

  setCanvasBackground: (background) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        canvas: { ...state.project.canvas, background },
      },
    }));
  },

  /** Redimensionne le canvas sans pousser d'historique (changement de type de document) */
  setCanvasDimensions: (w, h) => {
    set((state) => ({
      project: {
        ...state.project,
        canvas: { ...state.project.canvas, width: Math.round(w), height: Math.round(h) },
      },
    }));
  },

  selectOnly: (id) => {
    set({ selectedIds: id ? [id] : [] });
  },

  setSelectedIds: (ids) => {
    set({ selectedIds: Array.isArray(ids) ? ids.filter(Boolean) : [] });
  },

  setInteractionTool: (tool) => {
    const allowed = new Set(['pointer', 'marquee-rect', 'marquee-ellipse', 'marquee-lasso', 'crop-image']);
    const t = allowed.has(tool) ? tool : 'pointer';
    set({ interactionTool: t });
  },

  setRegionMarquee: (r) => set({ regionMarquee: r }),

  clearRegionMarquee: () => set({ regionMarquee: null }),

  toggleSelect: (id) => {
    set((state) => {
      const has = state.selectedIds.includes(id);
      return {
        selectedIds: has
          ? state.selectedIds.filter((x) => x !== id)
          : [...state.selectedIds, id],
      };
    });
  },

  /** @param {SbKonvaObjectBase} obj */
  addObject: (obj) => {
    const [adapte] = adapterImagesAuCanevas(adapterEncreAuCanevas(adapterInsertionAuDocument([obj], get()), get()), get());
    const withId = adapte && adapte.id ? adapte : { ...adapte, id: genSbKonvaId(adapte?.type || 'obj') };
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return { ...s, objects: [...s.objects, withId] };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: [withId.id],
      };
    });
  },

  /** @param {SbKonvaObjectBase[]} objs */
  addObjects: (objs) => {
    if (!objs?.length) return;
    const adaptes = adapterImagesAuCanevas(adapterEncreAuCanevas(adapterInsertionAuDocument(objs, get()), get()), get());
    const withIds = adaptes.map((o) => (o && o.id ? o : { ...o, id: genSbKonvaId(o?.type || 'obj') }));
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return { ...s, objects: [...s.objects, ...withIds] };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: withIds.map((o) => o.id),
      };
    });
  },

  /** Sélectionne tous les objets de la scène active (Shift+clic reste disponible pour la multi-sélection). */
  selectAllInActiveScene: () => {
    set((state) => {
      const scene = state.project.scenes.find((s) => s.id === state.project.activeSceneId);
      const ids = (scene?.objects ?? []).map((o) => o.id).filter(Boolean);
      return { selectedIds: ids };
    });
  },

  updateObject: (id, partial) => {
    const propre = assainirPatch(partial);
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return {
          ...s,
          objects: s.objects.map((o) =>
            o.id === id ? mergeDeepObject(o, propre) : o,
          ),
        };
      });
      return { project: { ...state.project, scenes } };
    });
  },

  /** Retire `content.crop` (merge profond ne supprime pas les clés absentes). */
  removeImageCrop: (id) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) => {
              if (o.id !== id || o.type !== 'image' || !o.content) return o;
              const { crop: _omit, ...rest } = o.content;
              return { ...o, content: rest };
            }),
          };
        }),
      },
    }));
  },

  /**
   * Enregistre les dimensions NATIVES d'une image (lues à son chargement) et, tant que
   * la boîte est restée automatique, corrige SON RAPPORT.
   *
   * ⛔ AUCUN pas d'historique : c'est une mesure, pas un geste de l'utilisateur. Un
   * Ctrl+Z doit annuler l'insertion, pas « la mesure de l'image ».
   * ⛔ Ne touche JAMAIS une boîte redimensionnée à la main (`boiteAuto:false`).
   *
   * ⛔ CHRONO MESURÉ LE 2026-08-05 (défaut [IMG-FLASH]) : pose à 2 422 / 2 627 / 2 627 ms,
   * mesure à 6 054 / 6 259 / 8 681 ms. Cette écriture arrive donc 3,4 à 6,1 s APRÈS la
   * pose — largement de quoi tomber au milieu d'un glissement. Elle repassait alors par
   * `geometrieImage`, qui RECALCULE une position (bornage aux marges compris) : le point
   * où l'utilisateur venait de traîner l'image était remis au coin de la zone utile.
   * C'est la huitième de la série des pertes de données du dépôt : une écriture qui
   * reconstruit au lieu de patcher.
   *
   * Depuis : on corrige LE RAPPORT, inscrit dans la boîte courante, et RIEN d'autre.
   * `x` et `y` ne sont plus jamais écrits — un glissement en cours survit intact.
   *
   * @returns {{ ok: boolean, deformation?: number, raison?: string }}
   */
  noterDimensionsNativesImage: (id, largeurNative, hauteurNative) => {
    const lNat = Number(largeurNative);
    const hNat = Number(hauteurNative);
    if (!(lNat > 0) || !(hNat > 0)) return { ok: false, raison: 'mesure_invalide' };
    const state = get();
    const scene = state.getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj || obj.type !== 'image') return { ok: false, raison: 'objet_absent' };

    const dejaMesuree =
      Number(obj.content?.natif?.largeurNative) === lNat &&
      Number(obj.content?.natif?.hauteurNative) === hNat;
    const boiteAuto = obj.meta?.[META_IMAGE]?.boiteAuto !== false;
    if (dejaMesuree && !boiteAuto) return { ok: true, deformation: deformationImage(obj, lNat / hNat) };

    const patch = {
      content: { natif: { largeurNative: lNat, hauteurNative: hNat, rapportNatif: lNat / hNat } },
      style: { ajustement: normaliserMode(obj.style?.ajustement) },
    };
    if (boiteAuto) {
      /* La boîte courante sert de GABARIT, jamais de nouveau point de départ : la boîte
         corrigée s'y inscrit au rapport natif. Elle ne peut donc ni grandir, ni sortir
         de la page, ni bouger — les trois façons de voler un geste en cours. */
      const cadrePromis = obj.meta?.[META_IMAGE]?.cadre;
      const lCourante = Number(obj.width) > 0 ? Number(obj.width) : null;
      const hCourante = Number(obj.height) > 0 ? Number(obj.height) : null;
      /* ⛔ Cadre PROMIS (bannière « Pleine largeur ») : réinscrire la boîte au rapport
         natif la ramenait de 690 à 201 px de large — la promesse cassée en silence.
         Le cadre reste, c'est `cover` qui y inscrit l'image (rognée, pas déformée). */
      if (cadrePromis == null && lCourante !== null && hCourante !== null) {
        const b = boiteAuFormat({
          largeurNative: lNat,
          hauteurNative: hNat,
          largeurMax: lCourante,
          hauteurMax: hCourante,
          /* La boîte provisoire est un gabarit, pas un plafond de qualité : sans
             `agrandir`, une image plus petite que son cadre resterait en vignette. */
          agrandir: true,
        });
        patch.width = b.width;
        patch.height = b.height;
      }
      patch.meta = { [META_IMAGE]: { boiteAuto: false } };
    }
    get().updateObject(id, patch);
    const apres = get().getActiveScene()?.objects?.find((o) => o.id === id);
    return { ok: true, deformation: deformationImage(apres ?? obj, lNat / hNat) };
  },

  /**
   * Mode d'ajustement d'une image ('contain' | 'cover' | 'etirer' | 'recadrer').
   * 'etirer' reste possible — mais seulement sur choix EXPLICITE.
   */
  definirAjustementImage: (id, mode) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj || obj.type !== 'image') return;
    get().pushHistory();
    get().updateObject(id, { style: { ajustement: normaliserMode(mode) } });
  },

  /**
   * Marque la boîte d'une image comme POSÉE À LA MAIN : la mesure native ne la
   * reprendra plus. Appelé à la fin d'un redimensionnement (cf. KonvaBoardStage).
   */
  marquerBoiteImageManuelle: (id) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj || obj.type !== 'image') return;
    if (obj.meta?.[META_IMAGE]?.boiteAuto === false) return;
    get().updateObject(id, { meta: { [META_IMAGE]: { boiteAuto: false } } });
  },

  /**
   * Fait GRANDIR un bloc de texte d'après la hauteur réellement mesurée par Konva.
   *
   * ⛔ MESURÉ : un bloc H1 naît haut de 56 px ; un titre de 4 lignes n'en affichait
   * qu'UNE — `wrap:'word'` actif, texte complet dans le store, `textArr` d'une seule
   * ligne. Konva coupe à la hauteur fixe, sans un mot : perte de contenu invisible.
   *
   * ⛔ NE RÉTRÉCIT JAMAIS : rendre la hauteur à un texte raccourci déplacerait tout ce
   * que l'utilisateur a posé dessous. On ne fait que rendre visible ce qui existe.
   * ⛔ Hauteur posée à la main (`meta.texte.hauteurManuelle`) : on ne la reprend pas —
   * on note `tronque` pour que le rendu le SIGNALE au lieu de couper en silence.
   * ⛔ Aucun pas d'historique : c'est la conséquence d'une saisie déjà historisée.
   *
   * @returns {{ change: boolean, tronque: boolean }}
   */
  ajusterHauteurTexte: (id, hauteurMesuree) => {
    const h = Number(hauteurMesuree);
    if (!(h > 0)) return { change: false, tronque: false };
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj || obj.type !== 'text') return { change: false, tronque: false };
    const actuelle = Number(obj.height) || 0;
    const manuelle = obj.meta?.texte?.hauteurManuelle === true;
    const tronque = h > actuelle + 1;

    if (manuelle) {
      if ((obj.meta?.texte?.tronque === true) === tronque) return { change: false, tronque };
      get().updateObject(id, { meta: { texte: { tronque } } });
      return { change: true, tronque };
    }
    if (!tronque) {
      if (obj.meta?.texte?.tronque === true) get().updateObject(id, { meta: { texte: { tronque: false } } });
      return { change: false, tronque: false };
    }
    get().updateObject(id, { height: Math.ceil(h), meta: { texte: { tronque: false } } });
    return { change: true, tronque: false };
  },

  /** Le bloc a été redimensionné à la main : sa hauteur ne sera plus recalculée. */
  marquerHauteurTexteManuelle: (id) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj || obj.type !== 'text') return;
    if (obj.meta?.texte?.hauteurManuelle === true) return;
    get().updateObject(id, { meta: { texte: { hauteurManuelle: true } } });
  },

  /** Mise à jour live (pas d'historique) — drag / transform en cours */
  updateObjectTransform: (id, attrs) => {
    const { x, y, width, height, rotation, content } = attrs;
    const patch = {
      x,
      y,
      width,
      height,
      rotation: rotation ?? 0,
    };
    if (content !== undefined) patch.content = content;
    get().updateObject(id, patch);
  },

  deleteSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return {
          ...s,
          objects: s.objects.filter((o) => !selectedIds.includes(o.id)),
        };
      });
      return { project: { ...state.project, scenes }, selectedIds: [] };
    });
  },

  /**
   * LONGIA / sélection : rectangle, triangle, losange, étoile, ellipse → `circle` (même bbox, styles conservés).
   * @returns {{ ok: boolean; count?: number; reason?: string }}
   */
  convertSelectedShapesToCircles: () => {
    const convertible = new Set(['rect', 'triangle', 'diamond', 'starshape', 'ellipse']);
    const { selectedIds, project } = get();
    const scene = project.scenes.find((s) => s.id === project.activeSceneId);
    if (!scene) return { ok: false, reason: 'no_scene' };
    if (!selectedIds.length) return { ok: false, reason: 'no_selection' };
    const toConvert = selectedIds.filter((id) => {
      const o = scene.objects.find((x) => x.id === id);
      return o && convertible.has(o.type);
    });
    if (!toConvert.length) return { ok: false, reason: 'no_convertible' };
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return {
          ...s,
          objects: s.objects.map((o) =>
            toConvert.includes(o.id) ? { ...o, type: 'circle' } : o,
          ),
        };
      });
      return { project: { ...state.project, scenes } };
    });
    return { ok: true, count: toConvert.length };
  },

  /**
   * Supprime un lot d'objets SANS pousser d'historique.
   *
   * ⛔ Réservé aux gestes continus (gomme du canevas) : l'appelant pousse UN cliché au
   * premier effacement du geste — un balayage qui emporte dix tracés doit s'annuler
   * d'un seul ⌘Z, pas de dix. Pour une suppression ponctuelle : `deleteObjectById`.
   */
  effacerObjets: (ids) => {
    const cibles = new Set((ids ?? []).filter(Boolean));
    if (!cibles.size) return;
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return { ...s, objects: s.objects.filter((o) => !cibles.has(o.id)) };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: state.selectedIds.filter((x) => !cibles.has(x)),
      };
    });
  },

  /** Supprime un objet par id (ex. glissé hors du canvas) */
  deleteObjectById: (id) => {
    if (!id) return;
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return { ...s, objects: s.objects.filter((o) => o.id !== id) };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: state.selectedIds.filter((x) => x !== id),
      };
    });
  },

  /** Restore d'un snapshot par index dans historyPast (Module 1) */
  restoreHistorySnapshot: (index) => {
    const { historyPast, historyTimestamps, project } = get();
    const snap = historyPast[index];
    if (!snap) return;
    const newPast = historyPast.slice(0, index);
    const newTs = historyTimestamps.slice(0, index);
    set({
      project: cloneProject(snap),
      historyPast: newPast,
      historyFuture: [cloneProject(project)],
      historyTimestamps: newTs,
      selectedIds: [],
    });
  },

  loadProject: (project) => {
    set({
      project: cloneProject(project),
      selectedIds: [],
      historyPast: [],
      historyFuture: [],
      historyTimestamps: [],
      aiPreview: null,
    });
  },

  setAiPreview: (preview) => set({ aiPreview: preview }),

  applyAiPreview: () => {
    const { aiPreview } = get();
    if (!aiPreview || !aiPreview.objects) return;
    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return {
          ...s,
          objects: structuredClone(aiPreview.objects),
        };
      });
      return {
        project: {
          ...state.project,
          canvas: aiPreview.canvas
            ? { ...state.project.canvas, ...aiPreview.canvas }
            : state.project.canvas,
          scenes,
        },
        aiPreview: null,
        selectedIds: [],
      };
    });
  },

  discardAiPreview: () => set({ aiPreview: null }),

  // ─── LONGIA Messages ──────────────────────────────────────────
  longiaMessages: [
    { id: 'init', role: 'ai', text: 'Prêt à analyser votre scène. Tapez en bas pour interagir.', ts: Date.now() },
  ],

  addLongiaMessage: (msg) =>
    set((state) => ({
      longiaMessages: [
        ...state.longiaMessages,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ts: Date.now(),
          ...msg,
        },
      ],
    })),

  clearLongiaMessages: () =>
    set({
      longiaMessages: [
        { id: 'init', role: 'ai', text: 'Prêt à analyser votre scène. Tapez en bas pour interagir.', ts: Date.now() },
      ],
    }),

  /** Restaure le flux LONGIA depuis un export workspace (`designerStudio.longiaMessages`). */
  hydrateLongiaFromExport: (msgs) => {
    if (!Array.isArray(msgs) || msgs.length === 0) return;
    const mapped = msgs.map((m, i) => {
      const x = m && typeof m === 'object' ? m : {};
      const role = x.role === 'user' ? 'user' : 'ai';
      const text = typeof x.text === 'string' ? x.text : '';
      const base = {
        id: x.id || `lm_${Date.now()}_${i}`,
        ts: typeof x.ts === 'number' ? x.ts : Date.now(),
        role,
        text,
      };
      /** @type {Record<string, unknown>} */
      const out = { ...base };
      if (Array.isArray(x.suggestions) && x.suggestions.length) {
        out.suggestions = x.suggestions;
      }
      if (x.longiaUnified && typeof x.longiaUnified === 'object') {
        out.longiaUnified = x.longiaUnified;
      }
      if (x.longiaComposed && typeof x.longiaComposed === 'object') {
        out.longiaComposed = x.longiaComposed;
      }
      return out;
    });
    set({ longiaMessages: mapped });
  },

  // ─── Outil vecteur actif ──────────────────────────────────────
  /** 'pen' | 'penAdd' | 'penRemove' | 'penConvert' | 'pencil' | 'directSelect' | null */
  activeVectorTool: null,
  setVectorTool: (tool) => set({ activeVectorTool: tool }),
  clearVectorTool: () => set({ activeVectorTool: null }),

  /** Épaisseur du crayon vectoriel (SmartBoard Designer) */
  pencilSize: 2,
  setPencilSize: (next) =>
    set((state) => ({
      pencilSize: typeof next === 'function' ? next(state.pencilSize) : next,
    })),

  // ─── Grouper / Dégrouper ─────────────────────────────────────
  groupSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 2) return;
    get().pushHistory();
    const groupId = `grp_${Date.now()}`;
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) =>
              selectedIds.includes(o.id) ? { ...o, groupId } : o,
            ),
          };
        }),
      },
    }));
    return groupId;
  },

  /** @returns {number} nombre de groupes dissous (0 = rien à dégrouper, l'UI le dit) */
  ungroupSelected: () => {
    const { selectedIds } = get();
    if (!selectedIds.length) return 0;
    const scene = get().getActiveScene();
    const selObjs = scene?.objects?.filter((o) => selectedIds.includes(o.id)) ?? [];
    const groupIds = [...new Set(selObjs.map((o) => o.groupId).filter(Boolean))];
    if (!groupIds.length) return 0;
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) =>
              groupIds.includes(o.groupId) ? { ...o, groupId: null } : o,
            ),
          };
        }),
      },
    }));
    return groupIds.length;
  },

  // ─── Opérations booléennes (vrais contours — cf. lib/cheminsVectoriels) ──
  /**
   * Unir : fusion des CONTOURS en un chemin fermé (plus jamais la boîte englobante —
   * défaut mesuré : rect+cercle → rect, le contour circulaire disparaissait).
   * Style et opacité repris de la forme du DESSOUS. UN pas d'historique, si et
   * seulement si l'opération réussit.
   * @returns {{ ok:boolean, raison?:string, type?:string, count?:number }}
   */
  uniteSelected: () => {
    const { selectedIds } = get();
    const objs = selectionOrdreRendu(get().getActiveScene(), selectedIds);
    if (objs.length < 2) return { ok: false, raison: 'selection' };
    const prep = contoursDeLaSelection(objs);
    if (!prep.ok) return prep;
    let courant = prep.contours[0].contour;
    for (let i = 1; i < prep.contours.length; i += 1) {
      const r = unionDePolygones(courant, prep.contours[i].contour);
      if (!r.ok) return { ok: false, raison: r.raison };
      if (r.polygones.length !== 1) return { ok: false, raison: 'couture' };
      [courant] = r.polygones;
    }
    const bas = objs[0];
    get().pushHistory();
    const uni = boucleVersObjetLine(courant, {
      id: genSbKonvaId('line_uni'),
      style: stylePeintDeLObjet(bas),
      opacity: bas.opacity ?? 1,
      layer: Math.max(...objs.map((o) => o.layer ?? 0)),
    });
    remplacerDansScene(set, selectedIds, [uni]);
    return { ok: true, count: objs.length };
  },

  /**
   * Soustraire : la forme du DESSUS mord celle du DESSOUS — le dessous est ENTAILLÉ,
   * jamais simplement supprimé (défaut mesuré). Le « dessus » suit l'ordre de RENDU.
   * Un anneau (trou) n'est pas représentable sans chemins composés : REFUS explicite.
   * @returns {{ ok:boolean, raison?:string, type?:string, count?:number }}
   */
  subtractSelected: () => {
    const { selectedIds } = get();
    const objs = selectionOrdreRendu(get().getActiveScene(), selectedIds);
    if (objs.length < 2) return { ok: false, raison: 'selection' };
    const prep = contoursDeLaSelection(objs);
    if (!prep.ok) return prep;
    const bas = objs[0];
    let boucles = [prep.contours[0].contour];
    for (let i = 1; i < prep.contours.length; i += 1) {
      const suivantes = [];
      for (const b of boucles) {
        const r = soustractionDePolygones(b, prep.contours[i].contour);
        if (r.ok) suivantes.push(...r.polygones);
        else if (r.raison === 'vide') continue; // cette boucle est entièrement mangée
        else return { ok: false, raison: r.raison };
      }
      boucles = suivantes;
    }
    if (!boucles.length) return { ok: false, raison: 'vide' };
    get().pushHistory();
    const style = stylePeintDeLObjet(bas);
    const nouveaux = boucles.map((b) =>
      boucleVersObjetLine(b, {
        id: genSbKonvaId('line_sub'),
        style,
        opacity: bas.opacity ?? 1,
        layer: bas.layer ?? 0,
      }),
    );
    remplacerDansScene(set, selectedIds, nouveaux);
    return { ok: true, count: nouveaux.length };
  },

  /**
   * Intersecter : la VRAIE zone commune des contours (plus jamais l'intersection des
   * boîtes englobantes — défaut mesuré : des coins hors du cercle). Style repris de
   * la forme du DESSUS (celle qu'on voit à cet endroit).
   * @returns {{ ok:boolean, raison?:string, type?:string, count?:number }}
   */
  intersectSelected: () => {
    const { selectedIds } = get();
    const objs = selectionOrdreRendu(get().getActiveScene(), selectedIds);
    if (objs.length < 2) return { ok: false, raison: 'selection' };
    const prep = contoursDeLaSelection(objs);
    if (!prep.ok) return prep;
    let boucles = [prep.contours[0].contour];
    for (let i = 1; i < prep.contours.length; i += 1) {
      const suivantes = [];
      for (const b of boucles) {
        const r = intersectionDePolygones(b, prep.contours[i].contour);
        if (r.ok) suivantes.push(...r.polygones);
        else if (r.raison === 'disjointes' || r.raison === 'vide') continue;
        else return { ok: false, raison: r.raison };
      }
      boucles = suivantes;
    }
    if (!boucles.length) return { ok: false, raison: 'disjointes' };
    const haut = objs[objs.length - 1];
    get().pushHistory();
    const style = stylePeintDeLObjet(haut);
    const nouveaux = boucles.map((b) =>
      boucleVersObjetLine(b, {
        id: genSbKonvaId('line_int'),
        style,
        opacity: haut.opacity ?? 1,
        layer: haut.layer ?? 0,
      }),
    );
    remplacerDansScene(set, selectedIds, nouveaux);
    return { ok: true, count: nouveaux.length };
  },

  /**
   * Diviser (Pathfinder) : DEUX formes qui se chevauchent → morceaux découpés AUX
   * INTERSECTIONS (restes du dessous + restes du dessus + zone commune), chacun avec
   * le style de sa région visible. Remplace l'ancien alias muet de Subdiviser dont
   * le libellé mentait (« Couper aux intersect. » sans jamais regarder d'intersection).
   * @returns {{ ok:boolean, raison?:string, type?:string, count?:number }}
   */
  diviserSelection: () => {
    const { selectedIds } = get();
    const objs = selectionOrdreRendu(get().getActiveScene(), selectedIds);
    if (objs.length !== 2) return { ok: false, raison: 'deux' };
    const prep = contoursDeLaSelection(objs);
    if (!prep.ok) return prep;
    const [bas, haut] = objs;
    const d = divisionDePolygones(prep.contours[0].contour, prep.contours[1].contour);
    if (!d.ok) return { ok: false, raison: d.raison };
    get().pushHistory();
    const styleBas = stylePeintDeLObjet(bas);
    const styleHaut = stylePeintDeLObjet(haut);
    const fabrique = (boucle, style, source) =>
      boucleVersObjetLine(boucle, {
        id: genSbKonvaId('line_div'),
        style,
        opacity: source.opacity ?? 1,
        layer: source.layer ?? 0,
      });
    const nouveaux = [
      ...d.restesA.map((b) => fabrique(b, styleBas, bas)),
      ...d.restesB.map((b) => fabrique(b, styleHaut, haut)),
      /* La zone commune montre le DESSUS à l'écran : elle en garde la peinture. */
      ...d.communs.map((b) => fabrique(b, styleHaut, haut)),
    ];
    remplacerDansScene(set, selectedIds, nouveaux);
    return { ok: true, count: nouveaux.length };
  },

  /**
   * Convertit une forme finie (rect, cercle, étoile…) en TRACÉ fermé éditable — même
   * contour, mêmes couleurs de rendu (défauts compris). C'est le vrai « Décomposer en
   * tracé » : les ancres deviennent ensuite modifiables par la Sélection directe.
   * @returns {{ ok:boolean, raison?:string, id?:string }}
   */
  convertirEnTrace: (id) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj) return { ok: false, raison: 'objet' };
    if (obj.type === 'line') return { ok: false, raison: 'deja' };
    const v = estOperableBooleen(obj);
    if (!v.ok) return { ok: false, raison: v.raison };
    const contour = contourDeLObjet(obj);
    if (!contour) return { ok: false, raison: 'type' };
    get().pushHistory();
    const trace = boucleVersObjetLine(contour, {
      id: genSbKonvaId('line_vec'),
      style: stylePeintDeLObjet(obj),
      opacity: obj.opacity ?? 1,
      layer: obj.layer ?? 0,
    });
    /* Remplacement EN PLACE (même position dans la pile) : l'ordre de recouvrement
       à layer égal suit l'ordre d'insertion — le repousser en bout changerait l'écran. */
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return { ...s, objects: s.objects.map((o) => (o.id === id ? trace : o)) };
        }),
      },
      selectedIds: [trace.id],
    }));
    return { ok: true, id: trace.id };
  },

  // ─── Ancres d'un tracé (Ajouter / Suppr. / Convertir / Sélection directe) ──
  /**
   * Ajoute une ancre sur le tracé, au point projeté le plus proche du clic.
   * UN pas d'historique par insertion (même protocole que le Crayon).
   * @param {{x:number,y:number}} pointDoc  clic en coordonnées document
   * @param {number} tolerance  distance max (unités document) entre le clic et le tracé
   * @returns {{ ok:boolean, raison?:string, index?:number }}
   */
  insererAncreTrace: (id, pointDoc, tolerance = 10) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj || obj.type !== 'line') return { ok: false, raison: 'objet' };
    const paires = pairesDuTrace(obj.content?.points);
    if (paires.length < 2) return { ok: false, raison: 'objet' };
    const proj = projeterSurTrace(paires, docVersLocalTrace(obj, pointDoc), {
      ferme: obj.content?.closed === true,
    });
    if (!proj || proj.distance > tolerance) return { ok: false, raison: 'loin' };
    get().pushHistory();
    const suivantes = [...paires.slice(0, proj.index + 1), proj.point, ...paires.slice(proj.index + 1)];
    get().updateObject(id, { content: { points: suivantes.flatMap((p) => [p.x, p.y]) } });
    return { ok: true, index: proj.index + 1 };
  },

  /**
   * Supprime l'ancre `index` du tracé, puis REBASE la boîte (les points restent
   * relatifs à l'origine, comme à la création par la plume).
   * @returns {{ ok:boolean, raison?:string }}
   */
  supprimerAncreTrace: (id, index) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj || obj.type !== 'line') return { ok: false, raison: 'objet' };
    const paires = pairesDuTrace(obj.content?.points);
    if (index < 0 || index >= paires.length) return { ok: false, raison: 'objet' };
    const minimum = obj.content?.closed === true ? 3 : 2;
    if (paires.length - 1 < minimum) return { ok: false, raison: 'minimum' };
    get().pushHistory();
    const restantes = paires.filter((_, i) => i !== index);
    const base = rebaserTrace(obj, restantes);
    get().updateObject(id, {
      x: base.x,
      y: base.y,
      width: base.width,
      height: base.height,
      content: { points: base.points },
    });
    return { ok: true };
  },

  /**
   * Convertit une ancre COIN → COURBE (arrondi échantillonné). SENS UNIQUE : le modèle
   * ne stocke que des polylignes, l'inverse n'existe pas — l'UI doit l'annoncer.
   * @returns {{ ok:boolean, raison?:string }}
   */
  arrondirAncreTrace: (id, index) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj || obj.type !== 'line') return { ok: false, raison: 'objet' };
    const paires = pairesDuTrace(obj.content?.points);
    const r = arrondirCoinTrace(paires, index, { ferme: obj.content?.closed === true });
    if (!r.ok) return r;
    get().pushHistory();
    get().updateObject(id, { content: { points: r.paires.flatMap((p) => [p.x, p.y]) } });
    return { ok: true };
  },

  /**
   * Déplace UNE ancre (Sélection directe) — mise à jour LIVE, AUCUN historique ici :
   * l'appelant pousse un cliché au début du geste (protocole du Crayon corrigé).
   */
  deplacerAncreTrace: (id, index, pointDoc) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj || obj.type !== 'line') return;
    const paires = pairesDuTrace(obj.content?.points);
    if (index < 0 || index >= paires.length) return;
    paires[index] = docVersLocalTrace(obj, pointDoc);
    get().updateObject(id, { content: { points: paires.flatMap((p) => [p.x, p.y]) } });
  },

  /** Fin du geste de Sélection directe : rebase la boîte sur les points déplacés. */
  terminerDeplacementAncre: (id) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj || obj.type !== 'line') return;
    const paires = pairesDuTrace(obj.content?.points);
    if (paires.length < 2) return;
    const base = rebaserTrace(obj, paires);
    get().updateObject(id, {
      x: base.x,
      y: base.y,
      width: base.width,
      height: base.height,
      content: { points: base.points },
    });
  },

  /** Subdiviser : découpe un objet en 4 quarts */
  subdivideSelected: () => {
    const { selectedIds } = get();
    if (!selectedIds.length) return;
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === selectedIds[0]);
    if (!obj) return;
    get().pushHistory();
    const hw = (obj.width ?? 160) / 2;
    const hh = (obj.height ?? 140) / 2;
    const baseStyle = { ...(obj.style ?? {}), strokeWidth: 1 };
    const quads = [
      { x: obj.x,      y: obj.y,       width: hw, height: hh },
      { x: obj.x + hw, y: obj.y,       width: hw, height: hh },
      { x: obj.x,      y: obj.y + hh,  width: hw, height: hh },
      { x: obj.x + hw, y: obj.y + hh,  width: hw, height: hh },
    ].map((q, i) => ({
      id: `rect_${Date.now()}_q${i}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'rect',
      ...q,
      style: { ...baseStyle, cornerRadius: 0 },
      opacity: obj.opacity ?? 1,
    }));
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return { ...s, objects: [...s.objects.filter((o) => o.id !== obj.id), ...quads] };
        }),
      },
      selectedIds: quads.map((q) => q.id),
    }));
  },

  /**
   * Aligne la sélection : **1 objet** → canvas ; **2+** → bbox du groupe.
   * `options.forceCanvas` (ex. Alt+clic UI) : toujours le canvas, même à plusieurs.
   * @param {{ forceCanvas?: boolean }} [options]
   */
  alignSelected: (direction, options = {}) => {
    const { selectedIds, project } = get();
    if (!selectedIds.length) return;
    const scene = get().getActiveScene();
    if (!scene) return;
    const objs = scene.objects.filter((o) => selectedIds.includes(o.id));
    if (!objs.length) return;

    const cw = project.canvas.width;
    const ch = project.canvas.height;
    const forceCanvas = options.forceCanvas === true;
    const multi = objs.length >= 2 && !forceCanvas;
    const u = multi ? selectionUnionBounds(objs) : null;

    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return {
          ...s,
          objects: s.objects.map((o) => {
            if (!selectedIds.includes(o.id)) return o;
            const w = o.width ?? 0;
            const h = o.height ?? 0;
            if (multi && u) {
              switch (direction) {
                case 'left':
                  return { ...o, x: u.minX };
                case 'centerH':
                  return { ...o, x: Math.round(u.centerX - w / 2) };
                case 'right':
                  return { ...o, x: Math.round(u.maxX - w) };
                case 'top':
                  return { ...o, y: u.minY };
                case 'centerV':
                  return { ...o, y: Math.round(u.centerY - h / 2) };
                case 'bottom':
                  return { ...o, y: Math.round(u.maxY - h) };
                default:
                  return o;
              }
            }
            switch (direction) {
              case 'left':
                return { ...o, x: 0 };
              case 'centerH':
                return { ...o, x: Math.round((cw - w) / 2) };
              case 'right':
                return { ...o, x: cw - w };
              case 'top':
                return { ...o, y: 0 };
              case 'centerV':
                return { ...o, y: Math.round((ch - h) / 2) };
              case 'bottom':
                return { ...o, y: ch - h };
              default:
                return o;
            }
          }),
        };
      });
      return { project: { ...state.project, scenes } };
    });
  },

  /**
   * Centre sur le canvas : **1 objet** ; **2+** → groupe entier centré.
   * `options.forceCanvas` : avec 2+, centre **chaque** objet sur le canvas (pas le groupe).
   * @param {{ forceCanvas?: boolean }} [options]
   */
  alignSelectedCenterBoth: (options = {}) => {
    const { selectedIds, project } = get();
    if (!selectedIds.length) return;
    const scene = get().getActiveScene();
    if (!scene) return;
    const objs = scene.objects.filter((o) => selectedIds.includes(o.id));
    if (!objs.length) return;

    const cw = project.canvas.width;
    const ch = project.canvas.height;
    const forceCanvas = options.forceCanvas === true;

    get().pushHistory();
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        if (objs.length >= 2 && !forceCanvas) {
          const u = selectionUnionBounds(objs);
          if (!u) return s;
          const gw = u.maxX - u.minX;
          const gh = u.maxY - u.minY;
          const dx = Math.round((cw - gw) / 2 - u.minX);
          const dy = Math.round((ch - gh) / 2 - u.minY);
          return {
            ...s,
            objects: s.objects.map((o) =>
              selectedIds.includes(o.id) ? { ...o, x: (o.x ?? 0) + dx, y: (o.y ?? 0) + dy } : o,
            ),
          };
        }
        return {
          ...s,
          objects: s.objects.map((o) => {
            if (!selectedIds.includes(o.id)) return o;
            const w = o.width ?? 0;
            const h = o.height ?? 0;
            return {
              ...o,
              x: Math.round((cw - w) / 2),
              y: Math.round((ch - h) / 2),
            };
          }),
        };
      });
      return { project: { ...state.project, scenes } };
    });
  },

  /**
   * Répartit les objets sélectionnés horizontalement : espacement égal entre bords,
   * en conservant le bord gauche du plus à gauche et le bord droit du plus à droite (tri par x).
   */
  distributeSelectedHorizontal: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 3) return;
    const scene = get().getActiveScene();
    if (!scene) return;
    const objs = scene.objects.filter((o) => selectedIds.includes(o.id));
    if (objs.length < 3) return;
    const sorted = [...objs].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    const leftBound = sorted[0].x ?? 0;
    const last = sorted[sorted.length - 1];
    const rightBound = (last.x ?? 0) + (last.width ?? 0);
    let totalW = 0;
    for (const o of sorted) totalW += o.width ?? 0;
    const n = sorted.length;
    const gap = (rightBound - leftBound - totalW) / (n - 1);
    const positions = new Map();
    let cx = leftBound;
    for (const o of sorted) {
      positions.set(o.id, Math.round(cx));
      cx += (o.width ?? 0) + gap;
    }
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) =>
              positions.has(o.id) ? { ...o, x: positions.get(o.id) } : o,
            ),
          };
        }),
      },
    }));
  },

  /** Idem distributeSelectedHorizontal sur l'axe Y (tri par y, haut / bas fixes). */
  distributeSelectedVertical: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 3) return;
    const scene = get().getActiveScene();
    if (!scene) return;
    const objs = scene.objects.filter((o) => selectedIds.includes(o.id));
    if (objs.length < 3) return;
    const sorted = [...objs].sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
    const topBound = sorted[0].y ?? 0;
    const last = sorted[sorted.length - 1];
    const bottomBound = (last.y ?? 0) + (last.height ?? 0);
    let totalH = 0;
    for (const o of sorted) totalH += o.height ?? 0;
    const n = sorted.length;
    const gap = (bottomBound - topBound - totalH) / (n - 1);
    const positions = new Map();
    let cy = topBound;
    for (const o of sorted) {
      positions.set(o.id, Math.round(cy));
      cy += (o.height ?? 0) + gap;
    }
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) =>
              positions.has(o.id) ? { ...o, y: positions.get(o.id) } : o,
            ),
          };
        }),
      },
    }));
  },

  /* ⛔ Les quatre actions de recouvrement poussent leur propre cliché : sans lui, un
     changement d'ordre des calques n'était PAS annulable (Ctrl+Z sautait par-dessus). */
  bringForward: (id) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const obj = scene.objects.find((o) => o.id === id);
    if (!obj) return;
    get().pushHistory();
    get().updateObject(id, { layer: (obj.layer ?? 0) + 1 });
  },

  sendBackward: (id) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const obj = scene.objects.find((o) => o.id === id);
    if (!obj) return;
    get().pushHistory();
    get().updateObject(id, { layer: (obj.layer ?? 0) - 1 });
  },

  bringToFront: (id) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const maxLayer = Math.max(...scene.objects.map((o) => o.layer ?? 0), 0);
    if ((scene.objects.find((o) => o.id === id)?.layer ?? 0) === maxLayer && scene.objects.length === 1) return;
    get().pushHistory();
    get().updateObject(id, { layer: maxLayer + 1 });
  },

  /**
   * ⛔ MESURÉ : `layer: 0` n'est pas l'arrière-plan — c'est la valeur par DÉFAUT de
   * tous les objets. Envoyer une image « en arrière » la laissait donc à égalité avec
   * le reste, et `sortObjectsByLayer` tranchait par ordre d'insertion. On descend
   * réellement sous le minimum (valeur négative assumée : le tri est numérique).
   */
  sendToBack: (id) => {
    const scene = get().getActiveScene();
    if (!scene) return;
    const minLayer = Math.min(...scene.objects.map((o) => o.layer ?? 0), 0);
    get().pushHistory();
    get().updateObject(id, { layer: minLayer - 1 });
  },

  /**
   * Recouvrement pour TOUTE la sélection, en UN pas d'historique.
   * @param {'avant'|'arriere'|'premier-plan'|'arriere-plan'} sens
   * @returns {number} nombre d'objets déplacés dans la pile
   */
  deplacerSelectionDansLaPile: (sens) => {
    const { selectedIds } = get();
    const scene = get().getActiveScene();
    if (!scene || !selectedIds.length) return 0;
    const vises = scene.objects.filter((o) => selectedIds.includes(o.id) && !o.locked);
    if (!vises.length) return 0;
    const maxLayer = Math.max(...scene.objects.map((o) => o.layer ?? 0), 0);
    const minLayer = Math.min(...scene.objects.map((o) => o.layer ?? 0), 0);
    const calcul = (o, i) => {
      const l = o.layer ?? 0;
      switch (sens) {
        case 'avant':
          return l + 1;
        case 'arriere':
          return l - 1;
        case 'premier-plan':
          return maxLayer + 1 + i;
        case 'arriere-plan':
          return minLayer - vises.length + i;
        default:
          return l;
      }
    };
    const ordre = [...vises].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
    const cible = new Map(ordre.map((o, i) => [o.id, calcul(o, i)]));
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) => (cible.has(o.id) ? { ...o, layer: cible.get(o.id) } : o)),
          };
        }),
      },
    }));
    return cible.size;
  },

  setObjectOpacity: (id, opacity) => {
    get().updateObject(id, { opacity: Math.max(0, Math.min(1, opacity)) });
  },

  toggleObjectLock: (id) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj) return;
    get().updateObject(id, { locked: !obj.locked });
  },

  toggleObjectVisibility: (id) => {
    const scene = get().getActiveScene();
    const obj = scene?.objects?.find((o) => o.id === id);
    if (!obj) return;
    get().updateObject(id, { hidden: !obj.hidden });
  },

  reorderScenes: (fromIndex, toIndex) => {
    get().pushHistory();
    set((state) => {
      const scenes = [...state.project.scenes];
      const [moved] = scenes.splice(fromIndex, 1);
      scenes.splice(toIndex, 0, moved);
      return { project: { ...state.project, scenes } };
    });
  },

  // ─── Sections internes ───────────────────────────────────────
  addSection: (label = 'Section') => {
    const sec = createSection(label);
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id !== state.project.activeSceneId
            ? s
            : { ...s, sections: [...(s.sections || []), sec] },
        ),
      },
    }));
    return sec.id;
  },

  renameSection: (sectionId, label) => {
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id !== state.project.activeSceneId
            ? s
            : {
                ...s,
                sections: (s.sections || []).map((sec) =>
                  sec.id === sectionId ? { ...sec, label } : sec,
                ),
              },
        ),
      },
    }));
  },

  deleteSection: (sectionId) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            sections: (s.sections || []).filter((sec) => sec.id !== sectionId),
            objects: s.objects.map((o) =>
              o.sectionId === sectionId ? { ...o, sectionId: null } : o,
            ),
          };
        }),
      },
    }));
  },

  reorderSections: (fromIndex, toIndex) => {
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          const secs = [...(s.sections || [])];
          const [moved] = secs.splice(fromIndex, 1);
          secs.splice(toIndex, 0, moved);
          return { ...s, sections: secs };
        }),
      },
    }));
  },

  setObjectSection: (objectId, sectionId) => {
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => {
          if (s.id !== state.project.activeSceneId) return s;
          return {
            ...s,
            objects: s.objects.map((o) =>
              o.id === objectId ? { ...o, sectionId: sectionId || null } : o,
            ),
          };
        }),
      },
    }));
  },

  // ─── Etats initial / reset ────────────────────────────────────
  saveSceneInitialState: () => {
    const scene = get().getActiveScene();
    if (!scene) return;
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id !== state.project.activeSceneId
            ? s
            : { ...s, stateInitial: structuredClone(s.objects) },
        ),
      },
    }));
  },

  resetSceneToInitialState: () => {
    const scene = get().getActiveScene();
    if (!scene || !scene.stateInitial) return;
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id !== state.project.activeSceneId
            ? s
            : { ...s, objects: structuredClone(s.stateInitial) },
        ),
      },
      selectedIds: [],
    }));
  },

  duplicateSelected: () => {
    const { selectedIds } = get();
    if (!selectedIds.length) return;
    const scene = get().getActiveScene();
    if (!scene) return;
    const objs = scene.objects.filter((o) => selectedIds.includes(o.id));
    if (!objs.length) return;
    get().pushHistory();
    const copies = objs.map((o) => ({
      ...structuredClone(o),
      id: `${o.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      x: o.x + 20,
      y: o.y + 20,
    }));
    set((state) => {
      const scenes = state.project.scenes.map((s) => {
        if (s.id !== state.project.activeSceneId) return s;
        return { ...s, objects: [...s.objects, ...copies] };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: copies.map((c) => c.id),
      };
    });
  },

  /* ═══ Presse-papiers du canevas ═══════════════════════════════════════════
     ⛔ Le presse-papiers SYSTÈME est la source de vérité quand on peut y écrire
     (marqueur {@link MARQUEUR_PRESSE_PAPIERS}) : c'est ce qui permet de coller d'un
     onglet à l'autre. Cette copie mémoire est le filet quand l'écriture système est
     refusée (contexte non sécurisé, permission), pour que ⌘X / ⌘V marchent quand même. */
  presseCanevas: { objets: [], ts: 0, systeme: false },

  /**
   * Copie la sélection dans le presse-papiers interne.
   * @returns {{ objets: object[], texte: string }} `texte` = charge utile à écrire
   *   dans le presse-papiers système par l'appelant (seul lui a le geste utilisateur).
   */
  copierSelection: () => {
    const { selectedIds } = get();
    const scene = get().getActiveScene();
    const objs = scene?.objects?.filter((o) => selectedIds.includes(o.id)) ?? [];
    if (!objs.length) return { objets: [], texte: '' };
    const copie = structuredClone(objs);
    set({ presseCanevas: { objets: copie, ts: Date.now(), systeme: false } });
    return { objets: copie, texte: encoderPressePapiers(copie) };
  },

  /** L'écriture dans le presse-papiers système a réussi : il fait autorité au collage. */
  marquerPressePapiersSysteme: (ok) => {
    set((state) => ({ presseCanevas: { ...state.presseCanevas, systeme: ok === true } }));
  },

  /** Copie + suppression, en UN seul pas d'historique. */
  couperSelection: () => {
    const r = get().copierSelection();
    if (!r.objets.length) return r;
    get().deleteSelected();
    return r;
  },

  /**
   * Colle un lot d'objets (presse-papiers interne ou système) avec un décalage.
   * @returns {string[]} ids créés
   */
  collerObjets: (objets, options = {}) => {
    const lot = Array.isArray(objets) ? objets.filter((o) => o && typeof o === 'object' && o.type) : [];
    if (!lot.length) return [];
    const decalage = Number.isFinite(Number(options.decalage)) ? Number(options.decalage) : 20;
    const now = Date.now();
    const copies = lot.map((o, i) => ({
      ...structuredClone(o),
      id: `${o.type}_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      x: (Number(o.x) || 0) + decalage,
      y: (Number(o.y) || 0) + decalage,
    }));
    get().addObjects(copies);
    return copies.map((c) => c.id);
  },

  /**
   * Colle du TEXTE brut venu du presse-papiers système, en bloc de texte lisible.
   * ⛔ L'encre par défaut du moteur (#F7F2E8) est invisible sur une page blanche :
   * on la corrige d'après le fond réel du canevas avant l'insertion.
   * @returns {string|null} id créé
   */
  collerTexte: (texte, options = {}) => {
    const brut = String(texte ?? '').replace(/\r\n?/g, '\n').trim();
    if (!brut) return null;
    const state = get();
    const canvas = state.project?.canvas ?? {};
    const fond = canvas.background;
    const { page, marges } = pageDuCanevas(canvas);
    const largeur = Math.max(120, Math.min(page.largeur - marges.gauche - marges.droite, 690));
    const fontSize = Number(options.fontSize) > 0 ? Number(options.fontSize) : 16;
    const encre = encreLisible('#F7F2E8', fond && fond !== 'transparent' ? fond : DOC_PAGE_BG) ?? '#F7F2E8';
    /* Hauteur volontairement approchée : `ajusterHauteurTexte` la corrige dès le rendu,
       d'après la mesure réelle de Konva (pas d'estimation qui coupe). */
    const lignes = brut.split('\n').reduce(
      (acc, p) => acc + Math.max(1, Math.ceil(p.length / Math.max(12, Math.floor(largeur / (fontSize * 0.52))))),
      0,
    );
    const obj = {
      type: 'text',
      x: Number.isFinite(Number(options.x)) ? Number(options.x) : marges.gauche,
      y: Number.isFinite(Number(options.y)) ? Number(options.y) : marges.haut,
      width: largeur,
      height: Math.round(lignes * fontSize * 1.35) + 8,
      rotation: 0,
      layer: 1,
      visible: true,
      locked: false,
      opacity: 1,
      content: { text: brut },
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize,
        fontWeight: 400,
        fontStyle: 'normal',
        fill: encre,
        align: 'left',
        lineHeight: 1.35,
        letterSpacing: 0,
      },
    };
    get().addObject(obj);
    return get().selectedIds[0] ?? null;
  },

  /** Fond canvas (toutes les scènes partagent `project.canvas`). */
  applyCoursePaletteToCanvas: (paletteId) => {
    const bg = getPalettePageBackground(paletteId);
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        canvas: { ...state.project.canvas, background: bg },
      },
    }));
  },

  /**
   * Applique le préréglage typo aux blocs texte de **toutes** les scènes (Module 4).
   * @param {string} typographyPresetId
   * @returns {{ updated: number }}
   */
  applyTypographyPresetGlobally: (typographyPresetId) => {
    const cfg = getPolotnoTypographyForPreset(typographyPresetId);
    if (!cfg) return { updated: 0 };
    let updated = 0;
    for (const sc of get().project.scenes) {
      for (const o of sc.objects) {
        if (o.type === 'text') updated += 1;
      }
    }
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((scene) => ({
          ...scene,
          objects: scene.objects.map((o) => {
            if (o.type !== 'text') return o;
            const fs = Number(o.style?.fontSize) || 16;
            const fontSize = cfg.mapFontSize(fs);
            return mergeDeepObject(o, {
              style: {
                fontFamily: cfg.fontFamily,
                fontSize,
                fontWeight: cfg.fontWeight,
              },
            });
          }),
        })),
      },
    }));
    return { updated };
  },

  /**
   * Aligne le nombre de scènes Konva sur le plan Copilot (scènes vides ajoutées si besoin).
   * Les N premières scènes correspondent aux slides 0..N-1.
   * @param {import('../model/courseCopilotTypes').CourseSlide[]} slides
   * @param {number} [activeIndex]
   */
  ensureScenesForSlides: (slides, activeIndex = 0) => {
    if (!slides?.length) return;
    get().pushHistory();
    set((state) => {
      let scenes = [...state.project.scenes];
      while (scenes.length < slides.length) {
        const i = scenes.length;
        const short = (slides[i].title || `Slide ${i + 1}`).slice(0, 36);
        scenes.push(createEmptyScene(`S${i + 1} · ${short}`));
      }
      const ai = Math.max(0, Math.min(activeIndex ?? 0, slides.length - 1));
      const targetId = scenes[ai]?.id;
      return {
        project: {
          ...state.project,
          scenes,
          activeSceneId: targetId || state.project.activeSceneId,
        },
        selectedIds: [],
      };
    });
  },

  /**
   * Load a SmartboardSlide into the active (or target) Konva scene.
   * Converts DesignElement[] BoardState → SbKonvaObject[] via buildSceneFromSlide.
   *
   * @param {import('../../../engines/types/smartboard').SmartboardSlide} slide
   * @param {'initial'|'live'|string} stateKey  Which board state to load
   * @param {string|null} targetSceneId  Scene to populate (default: activeSceneId)
   */
  loadSceneFromSlide: (slide, stateKey = 'initial', targetSceneId = null) => {
    if (!slide) return;
    const built = buildSceneFromSlide(slide, stateKey);
    get().pushHistory();
    set((state) => {
      const sceneId = targetSceneId || state.project.activeSceneId;
      const scenes = state.project.scenes.map((sc) => {
        if (sc.id !== sceneId) return sc;
        return {
          ...sc,
          name: built.name || sc.name,
          objects: built.objects,
          sections: built.sections?.length ? built.sections : sc.sections,
          stateInitial: built.stateInitial ?? sc.stateInitial,
        };
      });
      return {
        project: { ...state.project, scenes },
        selectedIds: [],
      };
    });
  },
}));

/* ═══════════════════════════════════════════════════════════════════
   Presse-papiers système — encodage des objets du canevas
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Préfixe des objets du canevas dans le presse-papiers système.
 * ⛔ Il DOIT rester en tête d'une charge `text/plain` : c'est le seul type qu'un
 * navigateur laisse écrire sans permission spéciale. Un collage qui ne commence pas
 * par ce marqueur est du texte de l'utilisateur, jamais des objets.
 */
export const MARQUEUR_PRESSE_PAPIERS = 'LIRI-CANVAS-V1:';

/** @param {object[]} objets @returns {string} */
export function encoderPressePapiers(objets) {
  try {
    return `${MARQUEUR_PRESSE_PAPIERS}${JSON.stringify({ v: 1, objets })}`;
  } catch {
    return '';
  }
}

/**
 * @param {unknown} texte
 * @returns {object[]|null} null = ce n'est pas une charge du canevas (donc du texte).
 */
export function decoderPressePapiers(texte) {
  const s = typeof texte === 'string' ? texte.trim() : '';
  if (!s.startsWith(MARQUEUR_PRESSE_PAPIERS)) return null;
  try {
    const brut = JSON.parse(s.slice(MARQUEUR_PRESSE_PAPIERS.length));
    const objets = Array.isArray(brut?.objets) ? brut.objets : null;
    if (!objets?.length) return null;
    return objets.filter((o) => o && typeof o === 'object' && typeof o.type === 'string');
  } catch {
    return null;
  }
}

/* ── Expose store en DEV pour les tests ── */
if (typeof window !== 'undefined') {
  // Accessible via window.__sbKonvaStore.getState() / .setState()
  window.__sbKonvaStore = useSmartboardKonvaStore;
}

function mergeDeepObject(target, partial) {
  const out = { ...target };
  for (const k of Object.keys(partial)) {
    const v = partial[k];
    if (v != null && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] != null) {
      out[k] = mergeDeepObject(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}
