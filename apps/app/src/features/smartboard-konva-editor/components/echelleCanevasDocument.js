/**
 * echelleCanevasDocument — résolution du canevas, et report des préréglages dessus.
 *
 * ⛔ DÉFAUT MESURÉ (affiche Orabank, 2026-08-05) : tout le catalogue d'insertion du
 *    Designer est calibré pour un canevas 96 dpi (H1 48 px, corps 16 px, gabarit
 *    d'image 560 × 320). Posé tel quel sur le canevas Affiche — 2480 × 3508, c'est-à-dire
 *    A4 à 300 dpi — le même H1 mesure 48/300 de pouce, soit 11,5 pt à l'impression, et
 *    le corps 3,8 pt : illisible en presse (le plancher usuel est 8-9 pt). Tout sortait
 *    3,125× trop petit (300/96) d'entrée de jeu.
 *
 * ⛔ LA CONVERSION SE FAIT ICI, PAS DANS LES TABLES DE PRÉRÉGLAGES : les tables
 *    servent aussi à l'aperçu et aux libellés (« 48px · Gras »). Elles restent donc
 *    écrites en PIXELS DE RÉFÉRENCE À 96 dpi — une unité qui vaut exactement
 *    4/3 de point typographique ({@link pointsImprimes}) — et c'est le point
 *    d'insertion qui les reporte à la résolution réelle ({@link pxCanevas}).
 *
 * ⛔ NON-RÉGRESSION : sur un canevas dont la largeur EST déjà une largeur 96 dpi
 *    (Document A4 794 × 1123, Smartboard 1920 × 1080, Présentation 1920 × 1080),
 *    {@link echelleDuCanevas} rend 1 et rien ne change — aucun préréglage prouvé
 *    n'est déplacé d'un pixel.
 *
 * ⛔ AUCUN IMPORT REACT, aucun appel réseau : testable sous `node --test`.
 */

/** Le repère du Designer est le pixel CSS à 96 dpi (1 pouce = 96 px). */
export const DPI_REFERENCE = 96;

/** 1 px @96 dpi = 0,75 pt. C'est ce qui relie le canevas au PDF (cf. PT_PAR_PX). */
export const PT_PAR_PX96 = 72 / DPI_REFERENCE;

/**
 * Formats papier en px @96 dpi.
 *
 * ⚠️ Recopie DÉLIBÉRÉE de `documentPagination.FORMATS_PAGE` réduite aux couples
 * largeur/hauteur : ce module doit rester importable sans tirer la chaîne du mode
 * Document. Les valeurs sont identiques et servent uniquement de RAPPORT de
 * référence — aucune décision de pagination n'est prise ici.
 */
const FORMATS_96 = Object.freeze([
  { id: 'a4_portrait', largeur: 794, hauteur: 1123 },
  { id: 'a4_paysage', largeur: 1123, hauteur: 794 },
  { id: 'a3_portrait', largeur: 1123, hauteur: 1587 },
  { id: 'a5_portrait', largeur: 559, hauteur: 794 },
  { id: 'a5_paysage', largeur: 794, hauteur: 559 },
  { id: 'letter_portrait', largeur: 816, hauteur: 1056 },
  { id: 'letter_paysage', largeur: 1056, hauteur: 816 },
]);

/**
 * Page de référence 96 dpi d'un canevas haute résolution.
 *
 * ⛔ LE RAPPORT DÉCIDE, PAS LA LARGEUR : A4 (0,7071) et A5 (0,7040) portrait ont des
 * rapports très voisins. La tolérance est donc ABSOLUE et proportionnelle à l'échelle
 * candidate (`2 × echelle` px), pas un pourcentage de la hauteur — sur 2480 × 3508 un
 * pourcentage de 1 % laissait A5 passer aussi (14 px d'écart contre 0,4 px pour A4).
 *
 * @param {number} largeur largeur du canevas, en px
 * @param {number} hauteur hauteur du canevas, en px
 * @returns {{id:string, largeur:number, hauteur:number, echelle:number} | null}
 *          null quand le canevas ne correspond à aucun format papier agrandi
 */
export function pageDeReference(largeur, hauteur) {
  const l = Number(largeur) || 0;
  const h = Number(hauteur) || 0;
  if (!(l > 0) || !(h > 0)) return null;

  let meilleur = null;
  for (const f of FORMATS_96) {
    const echelle = l / f.largeur;
    /* En dessous de 1,02 on est sur un canevas 96 dpi (ou plus petit) : rien à faire.
       Au-delà de 12 (≈ 1150 dpi) ce n'est plus une page, c'est une coïncidence. */
    if (!(echelle > 1.02) || echelle > 12) continue;
    const ecart = Math.abs(h - f.hauteur * echelle);
    if (ecart > 2 * echelle) continue;
    if (!meilleur || ecart < meilleur.ecart) meilleur = { f, echelle, ecart };
  }
  if (!meilleur) return null;
  return {
    id: meilleur.f.id,
    largeur: meilleur.f.largeur,
    hauteur: meilleur.f.hauteur,
    echelle: meilleur.echelle,
  };
}

/**
 * Échelle du canevas par rapport au repère 96 dpi. Vaut 1 dès qu'on n'est PAS sur
 * une page papier agrandie — c'est la valeur qui garantit la non-régression.
 *
 * @returns {number} ≥ 1
 */
export function echelleDuCanevas(largeur, hauteur) {
  const ref = pageDeReference(largeur, hauteur);
  return ref ? ref.echelle : 1;
}

/** Résolution effective du canevas, en points par pouce (96 quand échelle = 1). */
export function dpiDuCanevas(largeur, hauteur) {
  return DPI_REFERENCE * echelleDuCanevas(largeur, hauteur);
}

/**
 * Reporte une valeur de préréglage (px @96 dpi) sur le canevas courant.
 * @param {number} px96 @param {number} echelle @returns {number} entier
 */
export function pxCanevas(px96, echelle) {
  const v = Number(px96) || 0;
  const e = Number(echelle) > 0 ? Number(echelle) : 1;
  return Math.round(v * e);
}

/** Taille imprimée, en POINTS typographiques, d'un préréglage écrit en px @96 dpi. */
export function pointsImprimes(px96) {
  return (Number(px96) || 0) * PT_PAR_PX96;
}

/**
 * Taille imprimée réelle d'un objet du canevas, en points.
 * ⛔ C'est le contrôle chiffré de la conversion : une même valeur de préréglage doit
 * rendre le MÊME nombre de points à 96 dpi et à 300 dpi.
 */
export function pointsSurCanevas(pxCanevasValeur, echelle) {
  const e = Number(echelle) > 0 ? Number(echelle) : 1;
  return ((Number(pxCanevasValeur) || 0) / e) * PT_PAR_PX96;
}

/* ═══════════════════════════════════════════════════════════════════
   Ramener une scène haute résolution dans le repère 96 dpi (export)
═══════════════════════════════════════════════════════════════════ */

/** Champs de `style` exprimés en PIXELS (donc à mettre à l'échelle). */
const STYLES_EN_PX = ['fontSize', 'letterSpacing', 'strokeWidth', 'cornerRadius', 'pointerLength', 'pointerWidth'];

/**
 * Copie une scène en divisant TOUTE sa géométrie par `echelle`. NE MUTE RIEN.
 *
 * ⛔ POURQUOI : `documentExport.resoudreFormat` force `formatPdf: null` dès qu'on lui
 *    passe un format {width, height} libre — jsPDF fabrique alors une page aux
 *    dimensions exactes du canevas. Une affiche 2480 × 3508 sortait donc sur une page
 *    de 1860 × 2631 pt (65,6 × 92,8 cm), pas sur de l'A4. Le module d'export
 *    appartient à un autre propriétaire : on ne le modifie pas, on lui donne la scène
 *    DANS SON REPÈRE (794 × 1123 px @96 dpi → 595,5 × 842,25 pt ≈ A4), exactement le
 *    repère du mode Document dont le PDF est prouvé.
 *
 * ⚠️ NE SONT PAS mis à l'échelle : `rotation` et `opacity` (sans unité), `lineHeight`
 *    (un rapport), `numPoints`, et surtout `content.crop` — Konva l'exprime en pixels
 *    de l'image SOURCE, pas du canevas (cf. documentImages).
 *
 * @param {object[]} objets
 * @param {number} echelle
 * @returns {object[]} copies superficielles ; `echelle` ≤ 1 rend le tableau tel quel
 */
export function ramenerAuRepere96(objets, echelle) {
  const liste = Array.isArray(objets) ? objets : [];
  const e = Number(echelle) > 0 ? Number(echelle) : 1;
  if (Math.abs(e - 1) < 1e-6) return liste;
  const d = (v) => (Number.isFinite(Number(v)) ? Number(v) / e : v);

  return liste.map((o) => {
    if (!o || typeof o !== 'object') return o;
    const copie = { ...o };
    for (const cle of ['x', 'y', 'width', 'height']) {
      if (Number.isFinite(Number(o[cle]))) copie[cle] = Number(o[cle]) / e;
    }

    if (o.style && typeof o.style === 'object') {
      const st = { ...o.style };
      for (const cle of STYLES_EN_PX) {
        if (Number.isFinite(Number(st[cle]))) st[cle] = Number(st[cle]) / e;
      }
      if (Array.isArray(st.dash)) st.dash = st.dash.map(d);
      copie.style = st;
    }

    if (o.content && typeof o.content === 'object' && Array.isArray(o.content.points)) {
      copie.content = { ...o.content, points: o.content.points.map(d) };
    }

    return copie;
  });
}
