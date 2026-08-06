/**
 * documentDesignCritique.js — cahier des charges §5 et §6 du Studio Document.
 *
 *  §5  critiquerMiseEnPage(objets, formatPage)  → diagnostic MESURÉ avant export.
 *  §6  proposerHabillage(typeDoc, contexte)     → police / échelle / palette / blocs.
 *
 * Deux règles de fond, tenues dans tout le fichier :
 *
 *  1. AUCUN constat n'est rendu sans sa mesure. Chaque entrée porte `mesure`
 *     (la valeur relevée, en px ou en ratio) — jamais un adjectif seul. Ce qui
 *     n'est pas mesurable ici est déclaré dans `nonMesure`, pas maquillé en avis.
 *
 *  2. Une correction est une LISTE DE PATCHES `{ id, partial }` destinée à
 *     `useSmartboardKonvaStore.updateObject`, qui fusionne en profondeur.
 *     ⛔ Jamais de reconstruction d'objet ni de scène : le texte de l'utilisateur
 *     n'est touché par aucune correction de ce module (seuls x/y/width/style
 *     bougent). Un constat qui exigerait de réécrire du contenu porte
 *     `correction: null` + `pourquoiPasAuto`.
 *
 * Sources réutilisées (charte déjà présente dans le dépôt, rien n'est réinventé) :
 *   · data/liri-text-design-v1/auto_text_design_engine.json — ux_rules.spacing,
 *     style_map, theme_overrides (via lib/liriTextDesignPack.js)
 *   · data/liri-text-design-v1/text_design_pack.json + liri-style-to-pro-preset.json
 *   · data/documentTemplates.json — page_setup.margins et style_variants
 *     (polices + accent réels des 100 modèles, via lib/documentTemplateLibrary.js)
 */
import {
  LIRI_TEXT_DESIGN_ENGINE,
  LIRI_TEXT_DESIGN_STYLES,
  LIRI_STYLE_TO_PRO_PRESET,
  getStyleIdsForClassification,
} from './liriTextDesignPack';
import { getTemplatesForCoachType, getTemplateById } from './documentTemplateLibrary';
import { ENCRE_DEFAUT_MOTEUR } from './documentBlockLayout';
/* Géométrie d'image (agent « images ») : la déformation se MESURE là-bas, elle ne
   se réinvente pas ici. `dimensionsNatives` LÈVE quand la mesure manque — d'où les
   try/catch en §14 : une image non mesurée ne produit aucun constat, jamais un faux. */
import { deformation, dimensionsNatives, boiteAuFormat } from './documentImages';
/* Le filigrane se RECONNAÎT à son `meta`, il ne se devine pas à sa taille — cf. la
   note « FILIGRANE » sous `critiquerMiseEnPage`. */
import { estFiligrane } from './documentFiligrane';

/* ═══════════════════════════════════════════════════════════════════
   Constantes de page
═══════════════════════════════════════════════════════════════════ */

/** 96 dpi — le canevas Document est A4 794×1123 px, soit 210×297 mm. */
export const PX_PAR_MM = 96 / 25.4;

export const FORMAT_A4_PORTRAIT = Object.freeze({
  width: 794,
  height: 1123,
  /** millimètres, identiques à `page_setup.margins` des 100 modèles */
  margesMm: { top: 20, right: 15, bottom: 20, left: 15 },
});

/**
 * ⚠️ Les fabriques de `documentTemplateLibrary` posent leurs blocs à x=52 px
 * (13,8 mm) alors que `page_setup` déclare 15 mm : 4,5 px d'écart structurel.
 * Sans tolérance, TOUT document issu d'un modèle sortirait « hors marge » et le
 * diagnostic deviendrait du bruit. 8 px ≈ 2 mm.
 */
export const TOLERANCE_MARGE_PX = 8;

/**
 * Déformation d'image — écart en % entre le rapport de la BOÎTE et le rapport NATIF
 * (`documentImages.deformation`). Sous 5 % c'est l'arrondi au pixel entier, pas un
 * défaut. Au-delà de 100 % l'image n'est plus reconnaissable : mesuré sur l'affiche
 * Orabank, une photo 602×900 posée en 560×320 sort à 162 % (étirée ×2,6 en largeur).
 */
export const SEUILS_DEFORMATION = Object.freeze({ mineur: 5, majeur: 25, bloquant: 100 });

/**
 * Occultation — part de la surface d'un bloc de CONTENU recouverte par ce qui est
 * dessiné au-dessus de lui. Mesuré sur l'affiche Orabank : trois images importées
 * se posent toutes au même point, deux d'entre elles sont recouvertes à 100 % et le
 * verdict affichait « Mise en page propre ». 100 % = le contenu n'existe plus à
 * l'impression, même famille de perte que l'image non embarquée → bloquant.
 * Le plancher à 60 % n'est pas cosmétique : sous ce seuil, un décalage volontaire
 * (photo qui mord sur un cartouche) est indiscernable d'un empilement raté.
 */
export const SEUILS_OCCULTATION = Object.freeze({ mineur: 60, majeur: 80, bloquant: 97 });

/** Écart minimum entre deux blocs — charte LIRI, déjà utilisé par la règle 10. */
const ECART_DEROULE_PX = 20;

/**
 * Un bloc qui couvre au moins cette part de la page est un FOND : il est fait pour
 * être recouvert. Sans ce garde-fou, toute affiche à photo pleine page sortirait
 * « contenu invisible » dès le premier titre posé dessus.
 */
const RATIO_FOND_DE_PAGE = 0.85;

/** Types qui peignent une surface pleine (le texte peint des glyphes, pas un aplat). */
const TYPES_SURFACE_PLEINE = ['rect', 'circle', 'ellipse', 'diamond', 'triangle'];

/** Largeur moyenne d'un glyphe rapportée à la taille de police. */
const RATIO_GLYPHE = { serif: 0.5, sans: 0.5, mono: 0.6 };

/**
 * Longueur de ligne en caractères. Bornes calées sur le document A4 à UNE colonne
 * (norme administrative : 170 mm de zone utile, corps 10-12 pt ≈ 95-105 signes),
 * pas sur la typographie de livre qui viserait 65.
 */
export const CPL_MIN = 40;
export const CPL_CIBLE = 85;
export const CPL_MAX = 105;

/** Corps minimum lisible à l'impression : 11 px ≈ 8,3 pt ; 9 px ≈ 6,8 pt. */
const CORPS_MIN_CONFORT_PX = 11;
const CORPS_MIN_ABSOLU_PX = 9;

export const GRAVITES = ['bloquant', 'majeur', 'mineur', 'info'];
const POIDS_GRAVITE = { bloquant: 0, majeur: 1, mineur: 2, info: 3 };

/* ═══════════════════════════════════════════════════════════════════
   Couleur — parsing et contraste WCAG 2.1
═══════════════════════════════════════════════════════════════════ */

const COULEURS_NOMMEES = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  blue: '#0000ff',
  green: '#008000',
  gray: '#808080',
  grey: '#808080',
};

/**
 * @param {string} couleur
 * @returns {{ r: number, g: number, b: number, a: number } | null}
 */
export function parserCouleur(couleur) {
  if (typeof couleur !== 'string') return null;
  const c = couleur.trim().toLowerCase();
  if (!c || c === 'none') return null;
  if (c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const nommee = COULEURS_NOMMEES[c];
  const src = nommee || c;

  if (src.startsWith('#')) {
    const h = src.slice(1);
    if (h.length === 3 || h.length === 4) {
      const [r, g, b, a] = h.split('').map((x) => parseInt(x + x, 16));
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b, a: h.length === 4 ? a / 255 : 1 };
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    return null;
  }

  const m = src.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[,/\s]+/).filter(Boolean).map((p) => p.trim());
    if (parts.length < 3) return null;
    const conv = (p) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p));
    const r = conv(parts[0]);
    const g = conv(parts[1]);
    const b = conv(parts[2]);
    if ([r, g, b].some(Number.isNaN)) return null;
    let a = 1;
    if (parts[3] != null) {
      a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
      if (Number.isNaN(a)) a = 1;
    }
    return { r, g, b, a };
  }
  return null;
}

function canalLineaire(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative WCAG. @returns {number} 0..1 */
export function luminanceRelative(rgb) {
  return (
    0.2126 * canalLineaire(rgb.r) +
    0.7152 * canalLineaire(rgb.g) +
    0.0722 * canalLineaire(rgb.b)
  );
}

/** Composite `dessus` (semi-transparent) sur `dessous` (opaque). */
function composer(dessus, dessous) {
  const a = Math.max(0, Math.min(1, dessus.a ?? 1));
  if (a >= 1) return { ...dessus, a: 1 };
  return {
    r: dessus.r * a + dessous.r * (1 - a),
    g: dessus.g * a + dessous.g * (1 - a),
    b: dessus.b * a + dessous.b * (1 - a),
    a: 1,
  };
}

/**
 * Ratio de contraste WCAG entre une encre et un fond.
 * @returns {number | null} 1..21 — null si une des deux couleurs est illisible.
 */
export function ratioContraste(encre, fond) {
  const f = parserCouleur(fond);
  const e = parserCouleur(encre);
  if (!f || !e) return null;
  const fondOpaque = f.a >= 1 ? f : composer(f, { r: 255, g: 255, b: 255, a: 1 });
  const encreOpaque = composer(e, fondOpaque);
  const l1 = luminanceRelative(encreOpaque);
  const l2 = luminanceRelative(fondOpaque);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ═══════════════════════════════════════════════════════════════════
   Géométrie et mesures de texte
═══════════════════════════════════════════════════════════════════ */

const estVisible = (o) => o && o.visible !== false;
const estTexte = (o) => o?.type === 'text';
const texteDe = (o) => String(o?.content?.text ?? '');

function boite(o) {
  const x = Number(o?.x) || 0;
  const y = Number(o?.y) || 0;
  const w = Number(o?.width) || 0;
  const h = Number(o?.height) || 0;
  return { x, y, w, h, x2: x + w, y2: y + h };
}

function tailleDe(o) {
  const s = Number(o?.style?.fontSize);
  return Number.isFinite(s) && s > 0 ? s : 24;
}

function graisseDe(o) {
  const w = o?.style?.fontWeight;
  if (w === 'bold') return 700;
  const n = Number(w);
  return Number.isFinite(n) && n > 0 ? n : 400;
}

function familleDe(o) {
  return String(o?.style?.fontFamily || 'Inter, system-ui, sans-serif');
}

function ratioGlypheDe(o) {
  const f = familleDe(o).toLowerCase();
  if (f.includes('mono') || f.includes('courier')) return RATIO_GLYPHE.mono;
  if (f.includes('serif') || f.includes('georgia') || f.includes('merriweather') || f.includes('playfair')) {
    return RATIO_GLYPHE.serif;
  }
  return RATIO_GLYPHE.sans;
}

/**
 * Caractères par ligne — ESTIMATION : les métriques réelles de la police ne sont
 * connues qu'au rendu Konva, ce module ne mesure pas le DOM.
 */
export function caracteresParLigne(o) {
  const largeurGlyphe = tailleDe(o) * ratioGlypheDe(o) + (Number(o?.style?.letterSpacing) || 0);
  if (largeurGlyphe <= 0) return 0;
  return Math.max(1, Math.round((Number(o?.width) || 0) / largeurGlyphe));
}

/** Nombre de lignes estimé (retours forcés + repli sur la largeur du bloc). */
export function lignesEstimees(o) {
  const cpl = caracteresParLigne(o);
  if (!cpl) return 0;
  return texteDe(o)
    .split('\n')
    .reduce((acc, ligne) => acc + Math.max(1, Math.ceil(ligne.length / cpl)), 0);
}

/** Dernier mot isolé sur sa ligne (ligne creuse / orpheline typographique). */
function dernierMotIsole(o) {
  const cpl = caracteresParLigne(o);
  const paragraphes = texteDe(o).split('\n').filter((p) => p.trim());
  if (!cpl || !paragraphes.length) return null;
  const dernier = paragraphes[paragraphes.length - 1].trim();
  if (dernier.length <= cpl) return null;
  const reste = dernier.length % cpl;
  const mots = dernier.split(/\s+/);
  const dernierMot = mots[mots.length - 1] || '';
  if (mots.length < 6) return null;
  if (reste > 0 && reste <= dernierMot.length + 1) return dernierMot;
  return null;
}

const estImage = (o) => o?.type === 'image';

/**
 * Mesure NATIVE d'une image, cherchée dans cet ordre :
 *   1. `contexte.imagesNatives` — mesures relevées par l'appelant (l'export décode
 *      déjà chaque bitmap avant de l'embarquer : ses `naturalWidth/Height` sont la
 *      seule source SÛRE tant que l'import ne les stocke pas) ;
 *   2. l'objet lui-même (`content.natif`, `content.naturalWidth`, `meta.natif`…),
 *      normalisé par `documentImages.dimensionsNatives`.
 *
 * ⛔ Rend `null` quand rien n'est mesuré : une image dont on ignore le format natif
 *    ne produit AUCUN constat. Un ratio deviné vaudrait un faux positif sur chaque
 *    photo du document.
 *
 * @returns {{ largeurNative:number, hauteurNative:number, rapportNatif:number } | null}
 */
function mesureNativeDe(o, contexte = {}) {
  const table = contexte.imagesNatives;
  const brut = table instanceof Map
    ? table.get(String(o?.id ?? ''))
    : table && typeof table === 'object'
      ? table[String(o?.id ?? '')]
      : null;

  /* ⛔ Ni `o` ni `o.style` dans cette liste : leurs `width`/`height` sont ceux de la
     BOÎTE. `dimensionsNatives` les accepterait et la déformation mesurerait 0 %. */
  for (const source of [brut, o?.content?.natif, o?.content, o?.meta?.natif, o?.meta?.image]) {
    if (!source || typeof source !== 'object') continue;
    try {
      return dimensionsNatives(source);
    } catch {
      /* mesure absente dans cette source : on essaie la suivante */
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   Occultation — ordre de dessin et surface réellement cachée
═══════════════════════════════════════════════════════════════════ */

/**
 * Rang de DESSIN d'un objet.
 *
 * ⛔ PIÈGE : ce n'est PAS l'index du tableau. Le canevas rend
 *    `sortObjectsByLayer` (model/sceneModel.js), soit un tri par `layer`
 *    croissant ; l'index ne départage que les ex æquo (le tri JS est stable).
 *    Juger l'occultation sur l'index seul accuserait un objet posé en dernier
 *    mais envoyé en arrière-plan (`layer` négatif) de cacher toute la page.
 */
function rangDeDessin(o, i) {
  return (Number(o?.layer) || 0) * 100000 + i;
}

function opaciteDe(o) {
  const v = Number(o?.opacity);
  return Number.isFinite(v) ? v : 1;
}

/** Un objet qui peint un APLAT, et cache donc ce qui est dessous. */
function estOccultantPlein(o) {
  if (opaciteDe(o) < 0.85) return false;
  if (estImage(o)) return true;
  /* Ni texte, ni ligne, ni filet, ni tracé : ils laissent passer le fond entre
     leurs traits. C'est ce qui met hors de cause le texte d'une bulle posé sur
     son rectangle, et les filets d'un tableau posés sur ses fonds de ligne. */
  if (!TYPES_SURFACE_PLEINE.includes(o?.type)) return false;
  const fill = parserCouleur(o?.style?.fill);
  return !!fill && (fill.a ?? 1) >= 0.85;
}

/**
 * Un objet dont la disparition PERD quelque chose : texte écrit, ou image.
 *
 * ⛔ Les formes (rect, ellipse…) sont volontairement hors jeu comme victimes.
 *    Elles sont de la décoration faite pour porter autre chose : le rectangle
 *    d'une bulle, le fond d'un encadré, le fond de ligne et le cadre d'un
 *    tableau. Les compter ferait crier la critique sur CHAQUE devis et sur
 *    chaque bulle — et une critique qui crie partout ne se lit plus.
 */
function estContenuOcculable(o) {
  if (estTexte(o)) return texteDe(o).trim().length > 0;
  return estImage(o);
}

/** Deux morceaux d'un même ensemble composé (tableau…) : leur pile est voulue. */
function memeEnsembleCompose(a, b) {
  const ta = a?.meta?.tableId;
  return Boolean(ta) && ta === b?.meta?.tableId;
}

/**
 * Aire de l'UNION de rectangles, par compression de coordonnées.
 *
 * ⛔ Sommer les intersections une à une compterait deux fois la zone commune à
 *    deux occulteurs : sur les trois images empilées de l'affiche Orabank, le
 *    « recouvert » serait sorti à 200 %. L'union est la seule mesure honnête.
 */
export function aireUnion(rects) {
  const liste = (rects || []).filter((r) => r.x2 > r.x && r.y2 > r.y);
  if (!liste.length) return 0;
  const xs = [...new Set(liste.flatMap((r) => [r.x, r.x2]))].sort((a, b) => a - b);
  const ys = [...new Set(liste.flatMap((r) => [r.y, r.y2]))].sort((a, b) => a - b);
  let aire = 0;
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      if (liste.some((r) => cx > r.x && cx < r.x2 && cy > r.y && cy < r.y2)) {
        aire += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      }
    }
  }
  return aire;
}

/**
 * Fond effectif sous un bloc : rect/ellipse opaque posé dessous, sinon fond de page.
 * L'ordre de pile suit `layer` puis l'index dans le tableau (le store ajoute en fin).
 */
function fondSous(obj, objets, fondPage) {
  const rang = (o, i) => (Number(o?.layer) || 0) * 10000 + i;
  const idxCible = objets.indexOf(obj);
  const rangCible = rang(obj, idxCible);
  const b = boite(obj);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  let meilleur = null;
  let meilleurRang = -Infinity;

  objets.forEach((o, i) => {
    if (o === obj || !estVisible(o)) return;
    if (!['rect', 'circle', 'ellipse', 'diamond', 'triangle'].includes(o?.type)) return;
    const fill = parserCouleur(o?.style?.fill);
    if (!fill || (fill.a ?? 1) < 0.85) return;
    const ob = boite(o);
    if (cx < ob.x || cx > ob.x2 || cy < ob.y || cy > ob.y2) return;
    const r = rang(o, i);
    if (r < rangCible && r > meilleurRang) {
      meilleurRang = r;
      meilleur = o.style.fill;
    }
  });

  return meilleur || fondPage;
}

/* ═══════════════════════════════════════════════════════════════════
   Normalisation du format de page
═══════════════════════════════════════════════════════════════════ */

/**
 * @param {object} formatPage — `{ width, height, fond?, page_setup?, margesPx? }`
 *   `page_setup` est celui des 100 modèles (`margins` en mm).
 */
export function normaliserFormat(formatPage = {}) {
  const width = Number(formatPage.width) || FORMAT_A4_PORTRAIT.width;
  const height = Number(formatPage.height) || FORMAT_A4_PORTRAIT.height;

  let marges = null;
  if (formatPage.margesPx && typeof formatPage.margesPx === 'object') {
    marges = { ...formatPage.margesPx };
  } else {
    const ps = formatPage.page_setup || formatPage.pageSetup;
    const mm = ps?.margins || FORMAT_A4_PORTRAIT.margesMm;
    const k = (ps?.unit ?? 'mm') === 'mm' ? PX_PAR_MM : 1;
    marges = {
      top: (Number(mm.top) || 0) * k,
      right: (Number(mm.right) || 0) * k,
      bottom: (Number(mm.bottom) || 0) * k,
      left: (Number(mm.left) || 0) * k,
    };
  }

  const fondBrut = formatPage.fond ?? formatPage.background ?? '#ffffff';
  /** `transparent` s'imprime blanc : c'est le fond réel à l'export. */
  const fondEffectif =
    !fondBrut || fondBrut === 'transparent' || fondBrut === 'none' ? '#ffffff' : fondBrut;

  return {
    width,
    height,
    marges,
    fondDeclare: fondBrut,
    fond: fondEffectif,
    orientation: height >= width ? 'portrait' : 'paysage',
    zoneContenu: {
      x: marges.left,
      y: marges.top,
      x2: width - marges.right,
      y2: height - marges.bottom,
      w: width - marges.left - marges.right,
      h: height - marges.top - marges.bottom,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Fabrique de constats
═══════════════════════════════════════════════════════════════════ */

let _seqConstat = 0;

/**
 * @typedef {object} Constat
 * @property {string} id
 * @property {string} regle          famille de règle (marges, hierarchie, contraste…)
 * @property {'bloquant'|'majeur'|'mineur'|'info'} gravite
 * @property {string} titre
 * @property {string} mesure         la valeur relevée — jamais un adjectif seul
 * @property {string[]} objetIds     blocs concernés (le panneau sait les sélectionner)
 * @property {{ label: string, patches: Array<{id: string, partial: object}>, detail?: string } | null} correction
 * @property {string} [pourquoiPasAuto]
 */
function constat(c) {
  _seqConstat += 1;
  return {
    id: `${c.regle}_${_seqConstat}`,
    objetIds: [],
    correction: null,
    ...c,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   §5 — critiquerMiseEnPage
═══════════════════════════════════════════════════════════════════ */

/**
 * Diagnostic mesuré de la mise en page d'un document.
 *
 * @param {Array<object>} objets    objets Konva de la scène (jamais mutés)
 * @param {object} formatPage       voir `normaliserFormat`
 * @param {object} [contexte]       `{ typeDoc, templateId }` — sert à proposer une échelle
 * @returns {{
 *   format: ReturnType<typeof normaliserFormat>,
 *   resume: object,
 *   constats: Constat[],
 *   compte: Record<string, number>,
 *   verdict: 'vide'|'propre'|'a_corriger'|'bloquant',
 *   nonMesure: Array<{ titre: string, pourquoi: string }>
 * }}
 */
export function critiquerMiseEnPage(objets, formatPage = {}, contexte = {}) {
  const format = normaliserFormat(formatPage);
  const tous = Array.isArray(objets) ? objets : [];
  /**
   * ⛔ FILIGRANE — écarté du jugement, en victime comme en occultant, et pour TOUTES
   *    les règles. Trois raisons, toutes mesurées :
   *      1. sa BOÎTE n'est pas son empreinte. Un « CONFIDENTIEL » à −45° centré sur A4
   *         a une boîte non pivotée de x = −130 à x2 = 873 sur une page de 794 :
   *         `debordement` (BLOQUANT) et `marges` crieraient sur chaque document
   *         filigrané, pour un objet qui est visiblement dans la page ;
   *      2. c'est un FOND posé exprès sous le contenu (`layer` < tout le reste,
   *         verrouillé) : `occultation` le compterait comme victime — recouvert à
   *         100 % par le corps — et comme occultant du texte qu'il traverse ;
   *      3. il est en capitales, énorme et très pâle : `hierarchie`, `contraste`,
   *         `alignement`, `chevauchement` et `longueur_ligne` le prendraient chacune
   *         pour un défaut du document.
   *
   * ⛔ L'ÉCART SE FAIT PAR LE `meta`, JAMAIS PAR UNE HEURISTIQUE DE TAILLE OU
   *    D'OPACITÉ. Écarter « les grands objets pâles » rouvrirait le trou d'origine de
   *    la règle `occultation` : trois images empilées au même point doivent RESTER
   *    détectées (cf. documentFiligrane.test.mjs).
   */
  const visibles = tous.filter((o) => estVisible(o) && !estFiligrane(o));
  const textes = visibles.filter(estTexte);
  const constats = [];

  const habillage = proposerHabillage(contexte.typeDoc ?? null, {
    templateId: contexte.templateId ?? null,
    registre: contexte.registre ?? null,
  });
  const echelle = habillage.retenue.echelle;

  /* ── 1. Débordement hors page ─────────────────────────────────── */
  const horsPage = [];
  for (const o of visibles) {
    const b = boite(o);
    const debords = [];
    if (b.x < -1) debords.push(`gauche ${Math.round(-b.x)} px`);
    if (b.y < -1) debords.push(`haut ${Math.round(-b.y)} px`);
    if (b.x2 > format.width + 1) debords.push(`droite ${Math.round(b.x2 - format.width)} px`);
    if (b.y2 > format.height + 1) debords.push(`bas ${Math.round(b.y2 - format.height)} px`);
    if (debords.length) horsPage.push({ o, b, debords });
  }
  if (horsPage.length) {
    constats.push(
      constat({
        regle: 'debordement',
        gravite: 'bloquant',
        titre: `${horsPage.length} bloc(s) sortent de la page`,
        mesure: horsPage
          .slice(0, 4)
          .map((d) => `${etiquette(d.o)} : ${d.debords.join(', ')}`)
          .join(' · '),
        objetIds: horsPage.map((d) => d.o.id),
        correction: {
          label: 'Ramener dans la page',
          detail: 'Repositionne (x/y) sans toucher au contenu ni à la taille du texte.',
          patches: horsPage.map(({ o, b }) => ({
            id: o.id,
            partial: {
              x: Math.round(Math.max(0, Math.min(b.x, format.width - b.w))),
              y: Math.round(Math.max(0, Math.min(b.y, format.height - b.h))),
            },
          })),
        },
      }),
    );
  }

  /* ── 2. Marges ────────────────────────────────────────────────── */
  const z = format.zoneContenu;
  const horsMarge = [];
  for (const o of visibles) {
    const b = boite(o);
    const ecarts = [];
    if (b.x < z.x - TOLERANCE_MARGE_PX) ecarts.push({ cote: 'gauche', px: z.x - b.x });
    if (b.y < z.y - TOLERANCE_MARGE_PX) ecarts.push({ cote: 'haut', px: z.y - b.y });
    if (b.x2 > z.x2 + TOLERANCE_MARGE_PX) ecarts.push({ cote: 'droite', px: b.x2 - z.x2 });
    if (b.y2 > z.y2 + TOLERANCE_MARGE_PX) ecarts.push({ cote: 'bas', px: b.y2 - z.y2 });
    if (ecarts.length) horsMarge.push({ o, b, ecarts });
  }
  if (horsMarge.length) {
    const pire = Math.max(...horsMarge.flatMap((d) => d.ecarts.map((e) => e.px)));
    constats.push(
      constat({
        regle: 'marges',
        gravite: pire > 24 ? 'majeur' : 'mineur',
        titre: `${horsMarge.length} bloc(s) mordent la marge`,
        mesure:
          `marges déclarées ${Math.round(format.marges.left)}/${Math.round(format.marges.top)}/` +
          `${Math.round(format.marges.right)}/${Math.round(format.marges.bottom)} px (G/H/D/B), ` +
          `dépassement le plus fort ${Math.round(pire)} px (tolérance ${TOLERANCE_MARGE_PX} px)`,
        objetIds: horsMarge.map((d) => d.o.id),
        correction: {
          label: 'Aligner sur la zone de contenu',
          detail: 'Décale x/y ; réduit la largeur seulement si le bloc est plus large que la zone.',
          patches: horsMarge.map(({ o, b }) => {
            const partial = {};
            let x = b.x;
            let w = b.w;
            if (w > z.w) w = Math.round(z.w);
            if (x < z.x) x = z.x;
            if (x + w > z.x2) x = z.x2 - w;
            if (Math.round(x) !== Math.round(b.x)) partial.x = Math.round(x);
            if (Math.round(w) !== Math.round(b.w)) partial.width = Math.round(w);
            let y = b.y;
            if (y < z.y) y = z.y;
            if (y + b.h > z.y2 && b.h <= z.h) y = z.y2 - b.h;
            if (Math.round(y) !== Math.round(b.y)) partial.y = Math.round(y);
            return { id: o.id, partial };
          }).filter((p) => Object.keys(p.partial).length > 0),
        },
      }),
    );
  }

  /* ── 3. Contraste ─────────────────────────────────────────────── */
  const encresCandidates = [
    habillage.retenue.palette.encre,
    habillage.retenue.palette.encreForte,
    '#111827',
    '#ffffff',
  ];
  const contrasteFaible = [];
  for (const o of textes) {
    if (!texteDe(o).trim()) continue;
    const fond = fondSous(o, visibles, format.fond);
    /* ⛔ Le repli était `#000000` — 21:1 sur blanc, donc « rien à signaler ». Or un
       texte SANS `style.fill` n'est pas peint en noir : le moteur retombe sur le crème
       du Smartboard (KonvaBoardObject.jsx `fill={st.fill || '#F7F2E8'}`), soit 1,12:1
       sur la page. La critique blanchissait exactement les blocs invisibles à l'écran. */
    const encre = o?.style?.fill ?? ENCRE_DEFAUT_MOTEUR;
    const ratio = ratioContraste(encre, fond);
    if (ratio == null) continue;
    const grand = tailleDe(o) >= 24 || (tailleDe(o) >= 18.66 && graisseDe(o) >= 700);
    const seuil = grand ? 3 : 4.5;
    if (ratio < seuil) contrasteFaible.push({ o, ratio, seuil, fond, encre });
  }
  if (contrasteFaible.length) {
    const pire = contrasteFaible.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
    const invisible = pire.ratio < 1.6;
    constats.push(
      constat({
        regle: 'contraste',
        gravite: invisible ? 'bloquant' : 'majeur',
        titre: invisible
          ? `${contrasteFaible.length} bloc(s) quasi invisibles sur le fond`
          : `${contrasteFaible.length} bloc(s) sous le seuil de contraste`,
        mesure:
          `pire ratio ${pire.ratio.toFixed(2)}:1 (encre ${pire.encre} sur ${pire.fond}), ` +
          `seuil WCAG AA ${pire.seuil}:1`,
        objetIds: contrasteFaible.map((d) => d.o.id),
        correction: {
          label: 'Passer à une encre lisible',
          detail: 'Ne change que style.fill ; la police et la taille restent celles choisies.',
          patches: contrasteFaible
            .map(({ o, fond, seuil }) => {
              const choix = encresCandidates
                .map((c) => ({ c, r: ratioContraste(c, fond) ?? 0 }))
                .filter((x) => x.r >= seuil)
                .sort((a, b) => b.r - a.r)[0];
              if (!choix) return null;
              return { id: o.id, partial: { style: { fill: choix.c } } };
            })
            .filter(Boolean),
        },
      }),
    );
  }

  /* ── 4. Hiérarchie typographique ──────────────────────────────── */
  const tailles = new Map();
  for (const o of textes) {
    const t = Math.round(tailleDe(o) * 2) / 2;
    tailles.set(t, (tailles.get(t) || 0) + 1);
  }
  const taillesTriees = [...tailles.keys()].sort((a, b) => b - a);
  if (taillesTriees.length > 5) {
    constats.push(
      constat({
        regle: 'hierarchie',
        gravite: 'majeur',
        titre: `${taillesTriees.length} tailles de police distinctes`,
        mesure: `${taillesTriees.join(' / ')} px — au-delà de 5 niveaux, la hiérarchie ne se lit plus`,
        objetIds: textes.map((o) => o.id),
        correction: correctionEchelle(textes, echelle),
      }),
    );
  } else {
    /**
     * La règle vaut pour les NIVEAUX DE TITRE, pas pour « corps vs mention » :
     * un pied de page à 11 px sous un corps à 12 px est normal, et le signaler
     * rendrait le diagnostic ineffaçable — l'échelle proposée elle-même le
     * déclencherait. On ne compare donc que les paliers au-dessus du corps.
     */
    const pivot = taillePivotCorps(textes);
    const chaine = taillesTriees.filter((t) => t >= pivot);
    const trop = [];
    for (let i = 0; i < chaine.length - 1; i += 1) {
      const r = chaine[i] / chaine[i + 1];
      if (r < 1.12) trop.push(`${chaine[i]} px / ${chaine[i + 1]} px (×${r.toFixed(2)})`);
    }
    if (trop.length) {
      constats.push(
        constat({
          regle: 'hierarchie',
          gravite: 'mineur',
          titre: `${trop.length} paire(s) de niveaux trop proches`,
          mesure: `${trop.join(' · ')} — un écart sous ×1,12 se lit comme une erreur, pas comme un niveau`,
          objetIds: textes.map((o) => o.id),
          correction: correctionEchelle(textes, echelle),
        }),
      );
    }
  }

  /* ── 5. Corps trop petit à l'impression ───────────────────────── */
  const minuscules = textes.filter((o) => texteDe(o).trim() && tailleDe(o) < CORPS_MIN_CONFORT_PX);
  if (minuscules.length) {
    const pire = Math.min(...minuscules.map(tailleDe));
    constats.push(
      constat({
        regle: 'corps',
        gravite: pire < CORPS_MIN_ABSOLU_PX ? 'majeur' : 'mineur',
        titre: `${minuscules.length} bloc(s) sous ${CORPS_MIN_CONFORT_PX} px`,
        mesure: `plus petit corps ${pire} px ≈ ${(pire * 0.75).toFixed(1)} pt à 96 dpi (seuil de confort ${CORPS_MIN_CONFORT_PX} px ≈ 8,3 pt)`,
        objetIds: minuscules.map((o) => o.id),
        correction: {
          label: `Remonter à ${CORPS_MIN_CONFORT_PX} px`,
          detail: 'Le bloc garde sa largeur : il gagnera des lignes, vérifiez la suite de la page.',
          patches: minuscules.map((o) => ({
            id: o.id,
            partial: { style: { fontSize: CORPS_MIN_CONFORT_PX } },
          })),
        },
      }),
    );
  }

  /* ── 6. Interlignage ──────────────────────────────────────────── */
  const interligne = [];
  for (const o of textes) {
    if (!texteDe(o).trim()) continue;
    const lh = Number(o?.style?.lineHeight) || 1.25;
    const taille = tailleDe(o);
    const estCorps = taille <= 16 && texteDe(o).length > 80;
    if (estCorps && lh < 1.35) interligne.push({ o, lh, cible: 1.5, raison: 'corps trop serré' });
    else if (taille >= 24 && lh > 1.45) interligne.push({ o, lh, cible: 1.15, raison: 'titre trop aéré' });
    else if (lh > 2.2) interligne.push({ o, lh, cible: 1.6, raison: 'bloc délavé' });
  }
  if (interligne.length) {
    constats.push(
      constat({
        regle: 'interligne',
        gravite: 'mineur',
        titre: `${interligne.length} bloc(s) à l'interlignage discutable`,
        mesure: interligne
          .slice(0, 4)
          .map((d) => `${etiquette(d.o)} : ×${d.lh} (${d.raison}, cible ×${d.cible})`)
          .join(' · '),
        objetIds: interligne.map((d) => d.o.id),
        correction: {
          label: 'Régler les interlignes',
          detail: 'Corps ×1,5 · titre ×1,15 — valeurs de la charte texte LIRI.',
          patches: interligne.map(({ o, cible }) => ({
            id: o.id,
            partial: { style: { lineHeight: cible } },
          })),
        },
      }),
    );
  }

  /* ── 7. Longueur de ligne ─────────────────────────────────────── */
  const lignesLongues = [];
  const lignesCourtes = [];
  for (const o of textes) {
    const txt = texteDe(o);
    if (txt.replace(/\s+/g, ' ').trim().length < 120) continue;
    const cpl = caracteresParLigne(o);
    if (cpl > CPL_MAX) lignesLongues.push({ o, cpl });
    else if (cpl < CPL_MIN) lignesCourtes.push({ o, cpl });
  }
  const largeurPourCpl = (o, cpl) =>
    Math.round(cpl * (tailleDe(o) * ratioGlypheDe(o) + (Number(o?.style?.letterSpacing) || 0)));
  if (lignesLongues.length) {
    constats.push(
      constat({
        regle: 'longueur_ligne',
        gravite: 'mineur',
        titre: `${lignesLongues.length} paragraphe(s) à la ligne trop longue`,
        mesure: `${lignesLongues.map((d) => `${d.cpl} car./ligne`).join(' · ')} — au-delà de ${CPL_MAX}, l'œil perd le retour à la ligne (estimation, largeur ÷ corps)`,
        objetIds: lignesLongues.map((d) => d.o.id),
        correction: {
          label: `Ramener vers ${CPL_CIBLE} caractères`,
          detail: 'Réduit uniquement la largeur du bloc, dans la zone de contenu.',
          patches: lignesLongues.map(({ o }) => ({
            id: o.id,
            partial: { width: Math.min(Math.round(z.w), largeurPourCpl(o, CPL_CIBLE)) },
          })),
        },
      }),
    );
  }
  if (lignesCourtes.length) {
    constats.push(
      constat({
        regle: 'longueur_ligne',
        gravite: 'mineur',
        titre: `${lignesCourtes.length} paragraphe(s) en colonne étroite`,
        mesure: `${lignesCourtes.map((d) => `${d.cpl} car./ligne`).join(' · ')} — sous ${CPL_MIN}, le texte se hache (estimation)`,
        objetIds: lignesCourtes.map((d) => d.o.id),
        correction: {
          label: `Élargir vers ${CPL_CIBLE} caractères`,
          detail: 'Élargit le bloc sans dépasser la zone de contenu.',
          patches: lignesCourtes
            .map(({ o }) => {
              const b = boite(o);
              const cible = Math.min(largeurPourCpl(o, CPL_CIBLE), Math.round(z.x2 - b.x));
              if (cible <= b.w) return null;
              return { id: o.id, partial: { width: cible } };
            })
            .filter(Boolean),
        },
      }),
    );
  }

  /* ── 8. Alignements incohérents (bords gauches) ───────────────── */
  const desalignes = detecterDesalignements(textes);
  if (desalignes.length) {
    constats.push(
      constat({
        regle: 'alignement',
        gravite: 'mineur',
        titre: `${desalignes.length} bloc(s) presque alignés`,
        mesure: desalignes
          .slice(0, 5)
          .map((d) => `${etiquette(d.o)} : x=${Math.round(d.x)} px au lieu de ${Math.round(d.cible)} px`)
          .join(' · '),
        objetIds: desalignes.map((d) => d.o.id),
        correction: {
          label: 'Aligner sur le bord dominant',
          patches: desalignes.map(({ o, cible }) => ({ id: o.id, partial: { x: Math.round(cible) } })),
        },
      }),
    );
  }

  /* ── 9. Blocs centrés hors axe ────────────────────────────────── */
  const axePage = format.width / 2;
  const centresFaux = textes.filter((o) => {
    if ((o?.style?.align ?? 'left') !== 'center') return false;
    const b = boite(o);
    const d = Math.abs(b.x + b.w / 2 - axePage);
    return d > 1 && d < 40;
  });
  if (centresFaux.length) {
    constats.push(
      constat({
        regle: 'alignement',
        gravite: 'mineur',
        titre: `${centresFaux.length} bloc(s) centrés hors de l'axe de la page`,
        mesure: centresFaux
          .slice(0, 4)
          .map((o) => {
            const b = boite(o);
            return `${etiquette(o)} : ${Math.round(Math.abs(b.x + b.w / 2 - axePage))} px hors axe`;
          })
          .join(' · '),
        objetIds: centresFaux.map((o) => o.id),
        correction: {
          label: 'Recentrer sur la page',
          patches: centresFaux.map((o) => {
            const b = boite(o);
            return { id: o.id, partial: { x: Math.round(axePage - b.w / 2) } };
          }),
        },
      }),
    );
  }

  /* ── 10. Chevauchement de blocs de texte ──────────────────────── */
  const collisions = [];
  for (let i = 0; i < textes.length; i += 1) {
    for (let j = i + 1; j < textes.length; j += 1) {
      const a = boite(textes[i]);
      const b = boite(textes[j]);
      const ox = Math.min(a.x2, b.x2) - Math.max(a.x, b.x);
      const oy = Math.min(a.y2, b.y2) - Math.max(a.y, b.y);
      if (ox > 2 && oy > 2) {
        collisions.push({ a: textes[i], b: textes[j], aire: Math.round(ox * oy), ox, oy });
      }
    }
  }
  if (collisions.length) {
    const total = collisions.reduce((s, c) => s + c.aire, 0);
    const pire = collisions.reduce((x, y) => (x.aire >= y.aire ? x : y));
    /**
     * Empilement exact (le piège d'insertion à coordonnée fixe) : on décale le
     * bloc du dessus SOUS le bloc du dessous, sans jamais fusionner les textes.
     */
    const patches = [];
    const dejaDecale = new Set();
    for (const c of collisions) {
      if (dejaDecale.has(c.b.id)) continue;
      const ba = boite(c.a);
      const bb = boite(c.b);
      if (bb.y < ba.y2 && bb.y2 > ba.y) {
        const y = Math.round(ba.y2 + 20);
        if (y + bb.h <= format.height) {
          patches.push({ id: c.b.id, partial: { y } });
          dejaDecale.add(c.b.id);
        }
      }
    }
    constats.push(
      constat({
        regle: 'chevauchement',
        gravite: 'bloquant',
        titre: `${collisions.length} paire(s) de blocs superposés`,
        mesure:
          `recouvrement total ${total} px², pire cas ${etiquette(pire.a)} × ${etiquette(pire.b)} ` +
          `(${Math.round(pire.ox)}×${Math.round(pire.oy)} px)`,
        objetIds: [...new Set(collisions.flatMap((c) => [c.a.id, c.b.id]))],
        correction: patches.length
          ? {
              label: `Dérouler ${patches.length} bloc(s) vers le bas`,
              detail: "Décale en y de 20 px sous le bloc précédent — l'écart minimum de la charte LIRI.",
              patches,
            }
          : null,
        pourquoiPasAuto: patches.length
          ? undefined
          : "Les blocs se recouvrent latéralement : les dérouler verticalement les ferait sortir de la page. À replacer à la main.",
      }),
    );
  }

  /* ── 11. Placeholders à crochets restants ─────────────────────── */
  const avecCrochets = textes
    .map((o) => ({ o, trous: texteDe(o).match(/\[[^\]\n]{2,60}\]/g) || [] }))
    .filter((d) => d.trous.length);
  if (avecCrochets.length) {
    const total = avecCrochets.reduce((s, d) => s + d.trous.length, 0);
    constats.push(
      constat({
        regle: 'placeholders',
        gravite: 'majeur',
        titre: `${total} champ(s) à trous non remplis`,
        mesure: avecCrochets
          .flatMap((d) => d.trous)
          .slice(0, 6)
          .join(' · '),
        objetIds: avecCrochets.map((d) => d.o.id),
        correction: null,
        pourquoiPasAuto:
          "Seul l'auteur connaît ces valeurs. Ce module ne réécrit jamais un contenu : « Montrer » sélectionne les blocs concernés.",
      }),
    );
  }

  /* ── 12. Lignes creuses (orphelines typographiques) ───────────── */
  const creuses = textes
    .map((o) => ({ o, mot: dernierMotIsole(o) }))
    .filter((d) => d.mot);
  if (creuses.length) {
    constats.push(
      constat({
        regle: 'ligne_creuse',
        gravite: 'info',
        titre: `${creuses.length} paragraphe(s) finissent sur un mot seul`,
        mesure: creuses.slice(0, 4).map((d) => `« ${d.mot} » seul en dernière ligne`).join(' · '),
        objetIds: creuses.map((d) => d.o.id),
        correction: null,
        pourquoiPasAuto:
          "Mesure ESTIMÉE (largeur ÷ corps, pas les métriques réelles de la police). Corriger demande soit un mot en moins, soit quelques px de largeur — deux décisions qui appartiennent à l'auteur.",
      }),
    );
  }

  /* ── 13. Blocs à géométrie nulle ──────────────────────────────── */
  const nuls = visibles.filter((o) => (Number(o?.width) || 0) <= 1 || (Number(o?.height) || 0) <= 1);
  if (nuls.length) {
    constats.push(
      constat({
        regle: 'geometrie',
        gravite: 'majeur',
        titre: `${nuls.length} bloc(s) de largeur ou hauteur nulle`,
        mesure: nuls
          .slice(0, 4)
          .map((o) => `${etiquette(o)} : ${Math.round(Number(o.width) || 0)}×${Math.round(Number(o.height) || 0)} px`)
          .join(' · '),
        objetIds: nuls.map((o) => o.id),
        correction: null,
        pourquoiPasAuto:
          "Une taille arbitraire déplacerait la mise en page. À redimensionner sur le canevas, ou à supprimer.",
      }),
    );
  }

  /* ── 14. Images déformées ─────────────────────────────────────── */
  const deformees = [];
  for (const o of visibles.filter(estImage)) {
    const nat = mesureNativeDe(o, contexte);
    if (!nat) continue;
    const b = boite(o);
    if (b.w <= 1 || b.h <= 1) continue;
    /* Un recadrage change le rapport de la SOURCE utilisée : c'est lui qui fait foi. */
    const crop = o?.content?.crop;
    const rapport = Number(crop?.width) > 0 && Number(crop?.height) > 0
      ? Number(crop.width) / Number(crop.height)
      : nat.rapportNatif;
    const ecartPct = deformation({ width: b.w, height: b.h }, rapport);
    if (ecartPct >= SEUILS_DEFORMATION.mineur) deformees.push({ o, b, nat, rapport, ecartPct });
  }
  if (deformees.length) {
    const pire = deformees.reduce((a, c) => (a.ecartPct >= c.ecartPct ? a : c));
    constats.push(
      constat({
        regle: 'image_deformee',
        gravite: pire.ecartPct >= SEUILS_DEFORMATION.bloquant
          ? 'bloquant'
          : pire.ecartPct >= SEUILS_DEFORMATION.majeur ? 'majeur' : 'mineur',
        titre: `${deformees.length} image(s) déformée(s)`,
        mesure: deformees
          .slice(0, 4)
          .map((d) => (
            `${Math.round(d.nat.largeurNative)}×${Math.round(d.nat.hauteurNative)} px natif `
            + `(rapport ${d.rapport.toFixed(3)}) posé en ${Math.round(d.b.w)}×${Math.round(d.b.h)} `
            + `(${(d.b.w / d.b.h).toFixed(3)}) — écart ${Math.round(d.ecartPct)} % `
            + `${d.b.w / d.b.h > d.rapport ? 'étirée en largeur' : 'écrasée en largeur'}`
          ))
          .join(' · '),
        objetIds: deformees.map((d) => d.o.id),
        correction: {
          label: 'Rendre le rapport natif',
          detail: "Réduit la boîte au format natif SANS la déplacer ni l'agrandir : le cadrage reste celui choisi, seule la déformation part.",
          patches: deformees
            .map(({ o, b, nat }) => {
              try {
                const cible = boiteAuFormat({
                  largeurNative: nat.largeurNative,
                  hauteurNative: nat.hauteurNative,
                  largeurMax: b.w,
                  hauteurMax: b.h,
                  agrandir: true,
                });
                if (Math.round(cible.width) === Math.round(b.w)
                  && Math.round(cible.height) === Math.round(b.h)) return null;
                return { id: o.id, partial: { width: cible.width, height: cible.height } };
              } catch {
                return null;
              }
            })
            .filter(Boolean),
        },
      }),
    );
  }

  /* ── 15. Blocs à cheval sur la coupe d'une page ───────────────── */
  /**
   * ⛔ NE DOUBLE PAS la règle 1 : celle-ci juge le cadre RÉELLEMENT fourni. Quand le
   *    canevas EMPILE ses pages (mode Document : hauteur = N × page), un bloc peut
   *    tenir dans la pile et pourtant traverser une coupe. Mesuré : deux images
   *    posées à y=1044 et y=1382 sur une page haute de 1123 — la première sort
   *    coupée en deux à l'impression, et rien ne le disait.
   *    Sans `contexte.hauteurPage` (ou avec une page unique), la règle se tait :
   *    c'est la règle 1 qui parle.
   */
  const hauteurPage = Number(contexte.hauteurPage) > 0 ? Number(contexte.hauteurPage) : 0;
  const ecartPages = Number(contexte.ecartPages) > 0 ? Number(contexte.ecartPages) : 0;
  if (hauteurPage > 0 && format.height > hauteurPage + 1) {
    const pas = hauteurPage + ecartPages;
    const aCheval = [];
    for (const o of visibles) {
      const b = boite(o);
      if (b.h <= 1 || b.y < 0) continue;
      const page = Math.floor(b.y / pas);
      const yLocal = b.y - page * pas;
      const debord = yLocal + b.h - hauteurPage;
      if (debord > 1) aCheval.push({ o, b, page, yLocal, debord });
    }
    if (aCheval.length) {
      constats.push(
        constat({
          regle: 'hors_page',
          gravite: 'bloquant',
          titre: `${aCheval.length} bloc(s) à cheval sur la coupe d'une page`,
          mesure: aCheval
            .slice(0, 4)
            .map((d) => (
              `${etiquette(d.o)} : page ${d.page + 1}, bas à ${Math.round(d.yLocal + d.b.h)} px `
              + `pour une page de ${Math.round(hauteurPage)} px (${Math.round(d.debord)} px rognés)`
            ))
            .join(' · '),
          objetIds: aCheval.map((d) => d.o.id),
          correction: {
            label: 'Renvoyer au début de la page suivante',
            detail: "Ne déplace que y, en tête de zone de contenu de la page d'après. Aucun contenu, aucune taille ne bouge.",
            patches: aCheval
              /* Un bloc plus HAUT qu'une page ne rentrera nulle part : le déplacer
                 ne ferait que déguiser le problème (il faut le scinder ou le réduire). */
              .filter((d) => z.y + d.b.h <= hauteurPage)
              .map((d) => ({ id: d.o.id, partial: { y: Math.round((d.page + 1) * pas + z.y) } })),
          },
        }),
      );
    }
  }

  /* ── 16. Occultation : du contenu caché sous un autre ─────────── */
  /**
   * ⛔ MESURÉ le 2026-08-05 : les trois images importées se posent TOUTES à
   *    x=52 y=180 (mode Document) ou 100,120 (mode Affiche). Deux sur trois sont
   *    invisibles, et le verdict affichait « Mise en page propre · 0 bloquant ».
   *    La règle 10 ne pouvait pas le voir : elle ne regarde que les blocs TEXTE.
   */
  const rangs = visibles.map((o, i) => rangDeDessin(o, i));
  const occultations = [];
  for (let i = 0; i < visibles.length; i += 1) {
    const victime = visibles[i];
    if (!estContenuOcculable(victime)) continue;
    const bv = boite(victime);
    const aireV = bv.w * bv.h;
    if (aireV <= 1) continue; /* la règle 13 parle déjà des géométries nulles */
    if (aireV / (format.width * format.height || 1) >= RATIO_FOND_DE_PAGE) continue;

    const morceaux = [];
    const occulteurs = [];
    for (let j = 0; j < visibles.length; j += 1) {
      if (j === i) continue;
      const dessus = visibles[j];
      if (rangs[j] <= rangs[i]) continue; /* dessiné AVANT : il ne cache rien */
      if (!estOccultantPlein(dessus)) continue;
      if (memeEnsembleCompose(victime, dessus)) continue;
      /* Étapes de révélation différentes : les deux ne sont jamais à l'écran ensemble. */
      if (Number(victime?.step) !== Number(dessus?.step)) continue;
      const bd = boite(dessus);
      const x = Math.max(bv.x, bd.x);
      const y = Math.max(bv.y, bd.y);
      const x2 = Math.min(bv.x2, bd.x2);
      const y2 = Math.min(bv.y2, bd.y2);
      if (x2 - x <= 0 || y2 - y <= 0) continue;
      morceaux.push({ x, y, x2, y2 });
      occulteurs.push(dessus);
    }
    if (!morceaux.length) continue;
    const pct = (aireUnion(morceaux) / aireV) * 100;
    if (pct < SEUILS_OCCULTATION.mineur) continue;
    occultations.push({ victime, bv, occulteurs, pct });
  }

  /**
   * Plan de déroulé des PILES, calculé UNE fois pour toute la page.
   *
   * ⛔ Le plan est COMMUN à toute la pile et porté À L'IDENTIQUE par chacun de
   *    ses constats. Sans ça, deux constats de la même pile proposeraient chacun
   *    leur destination en partant de l'état d'origine, et les appliquer l'un
   *    après l'autre réempilerait tout au même endroit.
   * ⛔ Colonne d'abord (le geste de la règle 10) ; si la pile ne tient pas dans
   *    la hauteur — trois images de 320 px posées à y=180 réclament 1 000 px sur
   *    une page A4 qui n'en offre que 943 — on la déroule EN LIGNE tant que la
   *    zone de contenu l'accepte. Si ni l'un ni l'autre ne tient, AUCUN patch :
   *    remplacer un contenu invisible par un contenu hors page serait pire.
   */
  const planDeroule = new Map();
  const pilePourObjet = new Map();
  {
    const piles = [];
    const coincide = (a, b) => Math.abs(a.x - b.x) <= 8 && Math.abs(a.y - b.y) <= 8;
    for (const oc of occultations) {
      if (oc.pct < SEUILS_OCCULTATION.bloquant) continue;
      for (const dessus of oc.occulteurs) {
        if (!coincide(boite(dessus), oc.bv)) continue;
        const pile = piles.find((p) => coincide(p, oc.bv));
        if (pile) {
          pile.membres.add(oc.victime);
          pile.membres.add(dessus);
        } else {
          piles.push({ x: oc.bv.x, y: oc.bv.y, membres: new Set([oc.victime, dessus]) });
        }
      }
    }
    for (const pile of piles) {
      const ordonnes = [...pile.membres].sort(
        (a, b) => rangs[visibles.indexOf(a)] - rangs[visibles.indexOf(b)],
      );
      const boites = ordonnes.map(boite);
      const ecarts = ECART_DEROULE_PX * (ordonnes.length - 1);
      const hauteurPile = boites.reduce((s, b) => s + b.h, 0) + ecarts;
      const largeurPile = boites.reduce((s, b) => s + b.w, 0) + ecarts;

      let sens = null;
      if (pile.y + hauteurPile <= format.height) sens = 'colonne';
      else if (pile.x + largeurPile <= z.x2 + TOLERANCE_MARGE_PX) sens = 'ligne';
      if (!sens) continue;

      let curseur = sens === 'colonne' ? pile.y : pile.x;
      ordonnes.forEach((m, i) => {
        const b = boites[i];
        const cible = sens === 'colonne'
          ? { x: Math.round(pile.x), y: Math.round(curseur) }
          : { x: Math.round(curseur), y: Math.round(pile.y) };
        curseur += (sens === 'colonne' ? b.h : b.w) + ECART_DEROULE_PX;
        const partial = {};
        if (cible.x !== Math.round(b.x)) partial.x = cible.x;
        if (cible.y !== Math.round(b.y)) partial.y = cible.y;
        if (Object.keys(partial).length) planDeroule.set(m.id, partial);
        pilePourObjet.set(m.id, { pile, sens, ordonnes });
      });
    }
  }

  for (const { victime, bv, occulteurs, pct } of occultations) {
    const gravite = pct >= SEUILS_OCCULTATION.bloquant
      ? 'bloquant'
      : pct >= SEUILS_OCCULTATION.majeur ? 'majeur' : 'mineur';
    const groupe = pilePourObjet.get(victime.id);
    const patches = (groupe?.ordonnes ?? [])
      .filter((m) => planDeroule.has(m.id))
      .map((m) => ({ id: m.id, partial: planDeroule.get(m.id) }));
    constats.push(
      constat({
        regle: 'occultation',
        gravite,
        titre: gravite === 'bloquant'
          ? `${etiquette(victime)} est entièrement recouvert — invisible à l'impression`
          : `${etiquette(victime)} est recouvert à ${Math.round(pct)} %`,
        mesure:
          `${Math.round(pct)} % de sa surface (${Math.round(bv.w)}×${Math.round(bv.h)} px `
          + `en ${Math.round(bv.x)},${Math.round(bv.y)}, calque ${Number(victime?.layer) || 0}) `
          + `est sous ${occulteurs.length} objet(s) dessiné(s) au-dessus : `
          + occulteurs
            .slice(0, 3)
            .map((d) => `${etiquette(d)} (calque ${Number(d?.layer) || 0})`)
            .join(', '),
        objetIds: [victime.id, ...occulteurs.map((d) => d.id)],
        correction: patches.length
          ? {
            label: `Dérouler la pile de ${groupe.ordonnes.length} blocs en ${groupe.sens}`,
            detail: `Ne déplace que x/y, ${ECART_DEROULE_PX} px d'écart (charte LIRI). Aucun contenu, aucune taille, aucun calque ne bouge.`,
            patches,
          }
          : null,
        pourquoiPasAuto: patches.length
          ? undefined
          : "Le recouvrement n'est pas un empilement au même point, ou la pile ne tient ni en colonne ni en ligne dans la page : dérouler à l'aveugle sortirait un bloc du cadre. À replacer à la main, ou à remonter au premier plan.",
      }),
    );
  }

  constats.sort((a, b) => POIDS_GRAVITE[a.gravite] - POIDS_GRAVITE[b.gravite]);

  const compte = { bloquant: 0, majeur: 0, mineur: 0, info: 0 };
  for (const c of constats) compte[c.gravite] += 1;

  const verdict = !visibles.length
    ? 'vide'
    : compte.bloquant
      ? 'bloquant'
      : compte.majeur || compte.mineur
        ? 'a_corriger'
        : 'propre';

  return {
    format,
    habillage,
    resume: {
      objets: visibles.length,
      blocsTexte: textes.length,
      caracteres: textes.reduce((s, o) => s + texteDe(o).length, 0),
      taillesDistinctes: taillesTriees,
      famillesDistinctes: [...new Set(textes.map(familleDe))],
      zoneContenu: `${Math.round(z.w)}×${Math.round(z.h)} px`,
      page: `${format.width}×${format.height} px (${format.orientation})`,
      fondPage: format.fondDeclare,
    },
    constats,
    compte,
    verdict,
    nonMesure: nonMesurable(visibles, format),
  };
}

/**
 * Taille de police qui porte le plus de SIGNES = le corps de texte.
 * Sert de pivot à la hiérarchie : dans un document, on écrit surtout du corps.
 */
export function taillePivotCorps(textes) {
  const volume = new Map();
  for (const o of textes || []) {
    const t = Math.round(tailleDe(o) * 2) / 2;
    volume.set(t, (volume.get(t) || 0) + Math.max(1, texteDe(o).trim().length));
  }
  const tailles = [...volume.keys()];
  if (!tailles.length) return CORPS_BASE_PX;
  return tailles.reduce((a, b) => (volume.get(b) > volume.get(a) ? b : a), tailles[0]);
}

/** Étiquette courte et stable d'un bloc, pour les messages. */
function etiquette(o) {
  if (estTexte(o)) {
    const t = texteDe(o).replace(/\s+/g, ' ').trim();
    if (t) return `« ${t.slice(0, 24)}${t.length > 24 ? '…' : ''} »`;
  }
  return `${o?.type ?? 'bloc'} ${String(o?.id ?? '').slice(-4)}`;
}

/** Bords gauches quasi identiques mais pas égaux → intention d'alignement ratée. */
function detecterDesalignements(textes) {
  const points = textes.map((o) => ({ o, x: boite(o).x })).sort((a, b) => a.x - b.x);
  const sorties = [];
  let i = 0;
  while (i < points.length) {
    const groupe = [points[i]];
    let j = i + 1;
    while (j < points.length && points[j].x - groupe[groupe.length - 1].x <= 12) {
      groupe.push(points[j]);
      j += 1;
    }
    if (groupe.length >= 2) {
      const freq = new Map();
      for (const p of groupe) {
        const k = Math.round(p.x);
        freq.set(k, (freq.get(k) || 0) + 1);
      }
      const dominant = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      for (const p of groupe) {
        if (Math.abs(p.x - dominant) > 0.5) sorties.push({ o: p.o, x: p.x, cible: dominant });
      }
    }
    i = j;
  }
  return sorties;
}

/** Recale chaque bloc texte sur le palier d'échelle le plus proche. */
function correctionEchelle(textes, echelle) {
  const paliers = echelle.map((e) => e.taille);
  const patches = [];
  for (const o of textes) {
    const t = tailleDe(o);
    const proche = paliers.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), paliers[0]);
    if (Math.abs(proche - t) > 0.4) {
      patches.push({ id: o.id, partial: { style: { fontSize: proche } } });
    }
  }
  if (!patches.length) return null;
  return {
    label: `Recaler ${patches.length} bloc(s) sur l'échelle`,
    detail: `Paliers ${paliers.join(' / ')} px — ne touche que style.fontSize.`,
    patches,
  };
}

/** Ce que ce module NE SAIT PAS mesurer. Dit, jamais maquillé en verdict. */
function nonMesurable(visibles, format) {
  const liste = [
    {
      titre: 'Coupure de page réelle (veuves / orphelines de bas de page)',
      pourquoi:
        "Le mode Document n'a pas de moteur de pagination : une scène = une page. Tant que le texte ne reflue pas d'une page à l'autre, la veuve de bas de page n'existe pas comme mesure.",
    },
    {
      titre: 'Métriques exactes des polices',
      pourquoi:
        'Les caractères par ligne et le nombre de lignes sont ESTIMÉS (largeur ÷ corps × 0,5). Le rendu Konva peut différer de quelques caractères.',
    },
    {
      titre: 'Orthographe, grammaire, justesse juridique',
      pourquoi: "Ce module regarde la FORME. Le fond relève du moteur de rédaction, pas d'ici.",
    },
    {
      titre: 'Rendu à l’impression (CMJN, papier)',
      pourquoi: 'Le contraste est calculé en sRGB écran. Un gris clair validé ici peut disparaître en impression économique.',
    },
  ];
  if (visibles.some((o) => Number(o?.rotation))) {
    liste.push({
      titre: 'Blocs pivotés',
      pourquoi:
        "Leur boîte est mesurée sans la rotation : marges et chevauchements les concernant sont approximatifs.",
    });
  }
  if (visibles.some((o) => o?.type === 'image')) {
    liste.push({
      titre: 'Qualité et cadrage des images',
      pourquoi: "Aucune analyse de pixels : définition, recadrage et lisibilité d'une image ne sont pas évalués.",
    });
    liste.push({
      titre: "Canal alpha d'une image (règle « occultation »)",
      pourquoi:
        "Une image est comptée comme un aplat opaque : son `opacity` est lu, pas ses pixels. Un PNG détouré posé sur du texte sera signalé comme le recouvrant alors qu'il le laisse voir. À l'inverse une image blanche sur blanc reste, elle, un vrai recouvrement.",
    });
  }
  if (format.fondDeclare === 'transparent') {
    liste.push({
      titre: 'Fond de page déclaré « transparent »',
      pourquoi: 'Le contraste a été calculé sur blanc, qui est ce que produit l’export. À l’écran le rendu peut différer.',
    });
  }
  return liste;
}

/* ═══════════════════════════════════════════════════════════════════
   §6 — proposerHabillage (IA design)
═══════════════════════════════════════════════════════════════════ */

/** Registre de langage → réglages. `effectLevel` vient de `theme_overrides` LIRI. */
const REGISTRES = {
  administratif: { label: 'Administratif', themeLiri: 'academic', ratio: 1.2, types: ['letter', 'attestation', 'minutes', 'internal_policy', 'student_record'] },
  juridique: { label: 'Juridique', themeLiri: 'academic', ratio: 1.2, types: ['contract'] },
  commercial: { label: 'Commercial', themeLiri: 'business', ratio: 1.25, types: ['invoice'] },
  institutionnel: { label: 'Institutionnel', themeLiri: 'academic', ratio: 1.25, types: ['certificate', 'report'] },
  moderne: { label: 'Moderne professionnel', themeLiri: 'business', ratio: 1.25, types: ['cv'] },
};

/** Classification LIRI (auto_text_design_engine) → rôle dans un document. */
const ROLES_BLOCS = [
  { role: 'titre_document', label: 'Titre du document', classification: 'title' },
  { role: 'sous_titre', label: 'Sous-titre / objet', classification: 'subtitle' },
  { role: 'intertitre', label: 'Intertitre de section', classification: 'academic_header' },
  { role: 'corps', label: 'Corps de texte', classification: 'definition' },
  { role: 'mention', label: 'Mention / pied', classification: 'summary' },
];

const CORPS_BASE_PX = 12;

export function registrePourType(typeDoc) {
  for (const [id, r] of Object.entries(REGISTRES)) {
    if (r.types.includes(typeDoc)) return id;
  }
  return 'administratif';
}

/**
 * Habillage proposé pour un type de document.
 *
 * Rien n'est inventé : les polices et l'accent viennent des `style_variants` du
 * modèle correspondant dans `documentTemplates.json`, les espacements et le
 * traitement des blocs de `auto_text_design_engine.json` (charte LIRI).
 *
 * @param {string|null} typeDoc  type coach (`letter`, `invoice`, `cv`…)
 * @param {object} [contexte]    `{ templateId, registre }`
 */
export function proposerHabillage(typeDoc, contexte = {}) {
  const registreId = contexte.registre || registrePourType(typeDoc);
  const registre = REGISTRES[registreId] ?? REGISTRES.administratif;

  const modele =
    (contexte.templateId ? getTemplateById(contexte.templateId) : null) ||
    (typeDoc ? getTemplatesForCoachType(typeDoc)[0] : null);

  const variantesSource =
    modele?.style_variants?.length
      ? modele.style_variants
      : [{ id: 'classic_admin', name: 'Classique administratif', font_primary: 'Inter', font_secondary: 'Merriweather', accent: '#334155' }];

  const spacing = LIRI_TEXT_DESIGN_ENGINE?.ux_rules?.spacing ?? {};
  const grille = LIRI_TEXT_DESIGN_ENGINE?.ux_rules?.snap?.grid ?? 8;
  const effectLevel = LIRI_TEXT_DESIGN_ENGINE?.theme_overrides?.[registre.themeLiri]?.effectLevel ?? 'low';

  const variantes = variantesSource.map((v) => construireVariante(v, registre, effectLevel));

  return {
    typeDoc: typeDoc ?? null,
    registre: registreId,
    registreLabel: registre.label,
    effectLevel,
    regles: {
      margeMinCanvasPx: spacing.minimum_to_canvas_edge ?? 48,
      ecartEntreBlocsPx: spacing.minimum_between_text_blocks ?? 20,
      grillePx: grille,
    },
    source: {
      modeleId: modele?.id ?? null,
      modeleNom: modele?.name ?? null,
      pack: 'LIRI Text Design Pack V1 · auto_text_design_engine V1',
    },
    variantes,
    retenue: variantes[0],
  };
}

function construireVariante(v, registre, effectLevel) {
  const r = registre.ratio;
  const arrondi = (x) => Math.round(x * 2) / 2;
  const accent = v.accent || '#334155';
  const titre = v.font_secondary || v.font_primary || 'Inter';
  const corps = v.font_primary || 'Inter';

  /**
   * ⛔ Plancher CORPS_MIN_CONFORT_PX : sans lui, le palier « mention » (10,4 px)
   * tomberait sous le seuil de lisibilité, et les deux règles se corrigeraient
   * l'une l'autre en boucle (« remonter à 11 » ↔ « recaler sur l'échelle »).
   */
  const palier = (v) => Math.max(CORPS_MIN_CONFORT_PX, arrondi(v));
  const echelle = [
    { role: 'titre_document', label: 'Titre du document', taille: palier(CORPS_BASE_PX * r ** 3), graisse: 700, lineHeight: 1.15, letterSpacing: 0 },
    { role: 'sous_titre', label: 'Sous-titre / objet', taille: palier(CORPS_BASE_PX * r ** 2), graisse: 600, lineHeight: 1.25, letterSpacing: 0 },
    { role: 'intertitre', label: 'Intertitre de section', taille: palier(CORPS_BASE_PX * r), graisse: 600, lineHeight: 1.3, letterSpacing: 0.2 },
    { role: 'corps', label: 'Corps de texte', taille: palier(CORPS_BASE_PX), graisse: 400, lineHeight: 1.5, letterSpacing: 0 },
    { role: 'mention', label: 'Mention / pied', taille: palier(CORPS_BASE_PX / 1.15), graisse: 400, lineHeight: 1.4, letterSpacing: 0.1 },
  ];

  const blocs = ROLES_BLOCS.map((b) => {
    const styleId = getStyleIdsForClassification(b.classification)[0] ?? null;
    const styleMeta = LIRI_TEXT_DESIGN_STYLES.find((s) => s.id === styleId);
    return {
      role: b.role,
      label: b.label,
      classification: b.classification,
      styleLiri: styleId,
      styleLabel: styleMeta?.label ?? '—',
      presetPro: styleId ? (LIRI_STYLE_TO_PRO_PRESET[styleId] ?? null) : null,
    };
  });

  return {
    id: v.id,
    label: v.name || v.id,
    polices: { titre, corps },
    palette: {
      encre: '#1e293b',
      encreForte: '#111827',
      encreSecondaire: '#475569',
      accent,
      filet: '#cbd5e1',
      fond: '#ffffff',
    },
    echelle,
    blocs,
    effectLevel,
  };
}

/* ── Application d'un habillage : patches, jamais de reconstruction ── */

/**
 * Attribue un rôle d'échelle à chaque bloc texte.
 *
 * Le pivot n'est PAS le rang : c'est la taille qui porte le plus de SIGNES.
 * Dans un document, le corps de texte est ce qu'on écrit le plus — un classement
 * par rang seul promouvrait le paragraphe en intertitre dès qu'il n'y a que trois
 * tailles. Au-dessus du pivot on redescend l'échelle (titre → sous-titre →
 * intertitre), en dessous c'est une mention.
 */
export function attribuerRoles(objets, echelle) {
  const textes = (Array.isArray(objets) ? objets : []).filter((o) => estVisible(o) && estTexte(o));
  const arrondi = (o) => Math.round(tailleDe(o) * 2) / 2;

  const tailles = [...new Set(textes.map(arrondi))].sort((a, b) => b - a);
  if (!tailles.length) return [];

  const pivot = taillePivotCorps(textes);
  const auDessus = tailles.filter((t) => t > pivot); // déjà triées décroissantes
  const rolesHauts = ['titre_document', 'sous_titre', 'intertitre'];

  const map = new Map();
  map.set(pivot, 'corps');
  auDessus.forEach((t, i) => map.set(t, rolesHauts[Math.min(i, rolesHauts.length - 1)]));
  for (const t of tailles) if (t < pivot) map.set(t, 'mention');

  /** Un seul palier de titre disponible : c'est le titre du document, pas un intertitre. */
  if (auDessus.length === 1) map.set(auDessus[0], 'titre_document');

  const rolesConnus = new Set(echelle.map((e) => e.role));
  return textes.map((o) => {
    const r = map.get(arrondi(o)) ?? 'corps';
    return { objet: o, role: rolesConnus.has(r) ? r : 'corps' };
  });
}

/**
 * Patches d'application d'une variante d'habillage.
 * @param {Array<object>} objets
 * @param {object} variante        élément de `proposerHabillage().variantes`
 * @param {{ polices?: boolean, echelle?: boolean, encre?: boolean }} quoi
 *        volets INDÉPENDANTS — le panneau les expose séparément, jamais en bloc.
 */
export function patchesPourHabillage(objets, variante, quoi = {}) {
  if (!variante) return [];
  const assignations = attribuerRoles(objets, variante.echelle);
  const parRole = new Map(variante.echelle.map((e) => [e.role, e]));
  const patches = [];

  for (const { objet, role } of assignations) {
    const cible = parRole.get(role) ?? parRole.get('corps');
    const style = {};
    if (quoi.polices) {
      style.fontFamily =
        role === 'titre_document' || role === 'sous_titre' ? variante.polices.titre : variante.polices.corps;
    }
    if (quoi.echelle) {
      style.fontSize = cible.taille;
      style.fontWeight = cible.graisse;
      style.lineHeight = cible.lineHeight;
      style.letterSpacing = cible.letterSpacing;
    }
    if (quoi.encre) {
      style.fill =
        role === 'titre_document'
          ? variante.palette.encreForte
          : role === 'mention'
            ? variante.palette.encreSecondaire
            : variante.palette.encre;
    }
    const change = Object.entries(style).some(([k, v]) => objet?.style?.[k] !== v);
    if (change) patches.push({ id: objet.id, partial: { style }, role });
  }
  return patches;
}

/* ═══════════════════════════════════════════════════════════════════
   Application
═══════════════════════════════════════════════════════════════════ */

/**
 * Applique une liste de patches via le store. UN SEUL point d'historique pour
 * que « Annuler » remette exactement l'état d'avant la correction.
 *
 * @param {Array<{id: string, partial: object}>} patches
 * @param {{ pushHistory: Function, updateObject: Function }} api
 * @returns {number} nombre de blocs réellement patchés
 */
export function appliquerPatches(patches, api) {
  const liste = (patches || []).filter((p) => p && p.id && p.partial && Object.keys(p.partial).length);
  if (!liste.length || typeof api?.updateObject !== 'function') return 0;
  api.pushHistory?.();
  for (const p of liste) api.updateObject(p.id, p.partial);
  return liste.length;
}
