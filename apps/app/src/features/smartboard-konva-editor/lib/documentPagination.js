/**
 * documentPagination — formats de page, pagination et en-têtes/pieds récurrents
 * du mode Document.
 *
 * ⛔ CONTRAINTE : le canevas Document est UNE surface continue (794×1123 px = A4 à
 * 96 dpi, cf. `DOC_PAGE`). Il n'existe pas d'objet « page » dans le moteur Konva.
 * Les pages sont donc une LECTURE de l'axe Y : la page `i` occupe la bande
 * [i·pas, i·pas + hauteur[. `pas` vaut la hauteur de page (+ un écart visuel
 * optionnel, nul par défaut pour rester fidèle à l'impression).
 *
 * ⛔ Aucune fonction ne mute les objets reçus : elles rendent des patches
 * ({ ajouts, patches, suppressions }) que l'appelant applique au store.
 *
 * Aucun appel réseau, aucun import React : testable sous `node --test`.
 */
import { DOC_PAGE, DOC_INK_SOFT } from './documentBlockLayout.js';

/* ═══════════════════════════════════════════════════════════════════
   Formats
═══════════════════════════════════════════════════════════════════ */

/** Dimensions en pixels CSS à 96 dpi (1 pouce = 96 px). */
export const FORMATS_PAGE = {
  a4_portrait: { id: 'a4_portrait', label: 'A4 portrait', largeur: 794, hauteur: 1123, mm: [210, 297] },
  a4_paysage: { id: 'a4_paysage', label: 'A4 paysage', largeur: 1123, hauteur: 794, mm: [297, 210] },
  a5_portrait: { id: 'a5_portrait', label: 'A5 portrait', largeur: 559, hauteur: 794, mm: [148, 210] },
  a5_paysage: { id: 'a5_paysage', label: 'A5 paysage', largeur: 794, hauteur: 559, mm: [210, 148] },
  letter_portrait: { id: 'letter_portrait', label: 'Letter portrait', largeur: 816, hauteur: 1056, mm: [216, 279] },
  letter_paysage: { id: 'letter_paysage', label: 'Letter paysage', largeur: 1056, hauteur: 816, mm: [279, 216] },
};

export const FORMAT_DEFAUT = 'a4_portrait';

/** Marges par défaut : celles déjà utilisées par les 100 modèles (DOC_PAGE). */
export const MARGES_DEFAUT = {
  haut: DOC_PAGE.marginTop,
  bas: DOC_PAGE.marginBottom,
  gauche: DOC_PAGE.marginX,
  droite: DOC_PAGE.marginX,
};

/** Écart visuel entre deux pages sur le canevas. 0 = rendu fidèle à l'impression. */
export const ECART_PAGES_DEFAUT = 0;

/**
 * Filet d'air entre une bande récurrente et le corps du texte.
 *
 * ⛔ POURQUOI LES BANDES SONT DANS LA ZONE IMPRIMABLE : posées dans la marge
 * (l'ancien comportement, en-tête à 39 px et numéro jusqu'à 1105 px sur une page
 * de 1123), elles étaient dénoncées par la critique de l'appli elle-même —
 * « bloc(s) mordent la marge », gravité majeure. Le produit se contredisait sous
 * les yeux de l'utilisateur. Elles occupent désormais le HAUT et le BAS de la zone
 * imprimable, et le corps se cale entre les deux ({@link reserveDesBandes}).
 */
export const ECART_BANDE_CORPS = 8;

/** @param {string|object} format @returns {{id:string,label:string,largeur:number,hauteur:number}} */
export function resoudreFormat(format) {
  if (format && typeof format === 'object' && Number.isFinite(format.hauteur) && Number.isFinite(format.largeur)) {
    return { id: format.id ?? 'perso', label: format.label ?? 'Personnalisé', ...format };
  }
  return FORMATS_PAGE[String(format ?? '').toLowerCase()] ?? FORMATS_PAGE[FORMAT_DEFAUT];
}

/** @param {object} [marges] @returns {{haut:number,bas:number,gauche:number,droite:number}} */
export function resoudreMarges(marges) {
  const m = marges && typeof marges === 'object' ? marges : {};
  const nb = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    haut: nb(m.haut, MARGES_DEFAUT.haut),
    bas: nb(m.bas, MARGES_DEFAUT.bas),
    gauche: nb(m.gauche, MARGES_DEFAUT.gauche),
    droite: nb(m.droite, MARGES_DEFAUT.droite),
  };
}

/** Zone imprimable d'une page (coordonnées locales à la page). */
export function zoneUtile(format = FORMAT_DEFAUT, marges = MARGES_DEFAUT) {
  const f = resoudreFormat(format);
  const m = resoudreMarges(marges);
  return {
    haut: m.haut,
    bas: f.hauteur - m.bas,
    gauche: m.gauche,
    droite: f.largeur - m.droite,
    largeur: Math.max(1, f.largeur - m.gauche - m.droite),
    hauteur: Math.max(1, f.hauteur - m.haut - m.bas),
  };
}

/**
 * Format de page LU depuis les dimensions du canevas — la règle de lecture commune.
 *
 * ⛔ PIÈGE MESURÉ (2026-08-06) : deux formats partagent la largeur 794 (A4 portrait
 * et A5 paysage). Lue à la LARGEUR SEULE, un canevas A5 paysage de 2 pages
 * (794×1118) repassait « A4 portrait, 1 page » (1118/1123 arrondi à 1) : l'aller-
 * retour A5 paysage → A4 portrait tronquait le document d'une page entière. La
 * HAUTEUR départage : le canevas empile des pages ENTIÈRES, le bon format est
 * celui dont un multiple entier de la hauteur colle le mieux à la hauteur du
 * canevas (écart 0 pour le vrai format, ≥ 5 px pour l'imposteur).
 *
 * ⚠️ TOUT lecteur de format (`useFormatPage` et consorts côté UI compris) doit
 * passer par ici : deux règles de lecture différentes donneraient deux nombres de
 * pages pour le même document.
 *
 * @returns {{id:string,label:string,largeur:number,hauteur:number}|null}
 *          null = la largeur ne correspond à aucune page (SmartBoard, Affiche…)
 */
export function formatDepuisCanevas(canvasW, canvasH) {
  const w = Number(canvasW) || 0;
  const h = Number(canvasH) || 0;
  if (!(w > 0)) return null;
  const candidats = Object.values(FORMATS_PAGE).filter((f) => Math.abs(f.largeur - w) <= 2);
  if (!candidats.length) return null;
  if (candidats.length === 1 || !(h > 0)) return candidats[0];
  let meilleur = candidats[0];
  let moindreEcart = Infinity;
  for (const f of candidats) {
    const nbPages = Math.max(1, Math.round(h / f.hauteur));
    const ecart = Math.abs(h - nbPages * f.hauteur);
    if (ecart < moindreEcart) {
      moindreEcart = ecart;
      meilleur = f;
    }
  }
  return meilleur;
}

/**
 * Hauteur que l'ajustement automatique doit CADRER, pour un canevas donné.
 *
 * ⛔ MESURÉ — sur un document de 2 pages, cadrer le canevas ENTIER écrase l'échelle :
 * 794×1123 → 0,73 (fenêtre de clic verticale d'une cellule de tableau : 11 px),
 * 794×2246 → 0,3645 (fenêtre : 5 px). La cible devient plus petite qu'un geste
 * humain alors que rien du document n'a changé — seul son nombre de pages. Le
 * cadrage porte donc sur UNE page, comme dans un traitement de texte : on voit une
 * page, on fait défiler pour les suivantes (défilement à la molette, cf.
 * `SmartboardKonvaEditorV1`).
 *
 * ⚠️ Rend `canvasH` inchangé quand la largeur ne correspond à AUCUN format de page
 * (SmartBoard 1037×750, 1920×1080…) ou quand le document tient sur une seule page :
 * ces deux cas n'ont pas de pages empilées et ne doivent rien changer.
 *
 * @returns {number} hauteur à cadrer (px du repère document)
 */
export function hauteurDeCadrage(canvasW, canvasH) {
  const w = Number(canvasW) || 0;
  const h = Number(canvasH) || 0;
  if (!(w > 0) || !(h > 0)) return h;
  const trouve = formatDepuisCanevas(w, h);
  if (!trouve) return h;
  const nbPages = Math.max(1, Math.round(h / trouve.hauteur));
  return nbPages <= 1 ? h : trouve.hauteur;
}

export function hauteurTotale(nbPages, format = FORMAT_DEFAUT, ecart = ECART_PAGES_DEFAUT) {
  const f = resoudreFormat(format);
  const n = Math.max(1, Math.trunc(Number(nbPages) || 1));
  return n * f.hauteur + (n - 1) * (Number(ecart) || 0);
}

/** Ordonnée absolue du haut de la page `index` sur le canevas continu. */
export function origineDePage(index, format = FORMAT_DEFAUT, ecart = ECART_PAGES_DEFAUT) {
  const f = resoudreFormat(format);
  return Math.max(0, Math.trunc(Number(index) || 0)) * (f.hauteur + (Number(ecart) || 0));
}

/* ═══════════════════════════════════════════════════════════════════
   Sauts de page
═══════════════════════════════════════════════════════════════════ */

export const META_SAUT = 'saut-de-page';
export const META_ENTETE_PIED = 'entete-pied';

export const estSautDePage = (o) => o?.meta?.doc === META_SAUT;
export const estEntetePied = (o) => o?.meta?.doc === META_ENTETE_PIED;

let _seq = 0;
function uid(prefixe) {
  _seq += 1;
  return `${prefixe}_${Date.now().toString(36)}${_seq.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Marqueur de saut de page : une ligne pointillée réelle sur le canevas.
 * ⛔ Un saut invisible est indébogable pour l'utilisateur — on le VOIT et on peut
 * le sélectionner puis le supprimer comme n'importe quel objet.
 */
function mkMarqueurSaut({ y, x, largeur }) {
  return {
    id: uid('saut'),
    type: 'line',
    x,
    y,
    width: largeur,
    height: 2,
    rotation: 0,
    layer: 3,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    opacity: 1,
    content: { points: [0, 0, largeur, 0] },
    style: { stroke: '#94a3b8', strokeWidth: 1, dash: [8, 6], lineCap: 'butt' },
    meta: { doc: META_SAUT, role: 'saut' },
  };
}

/**
 * Insère un saut de page après l'ordonnée `apresY`. NE MUTE RIEN.
 *
 * @param {object[]} objets
 * @param {number} apresY
 * @param {{format?:string|object, marges?:object}} [opts]
 * @returns {{ marqueur: object, ajouts: object[], objets: object[] }} `objets` = copie
 *          triée contenant le marqueur (pratique pour enchaîner sur {@link paginer}).
 */
export function insererSautDePage(objets, apresY, opts = {}) {
  const f = resoudreFormat(opts.format ?? FORMAT_DEFAUT);
  const m = resoudreMarges(opts.marges);
  const y = Number.isFinite(Number(apresY)) ? Number(apresY) : m.haut;
  const marqueur = mkMarqueurSaut({ y, x: m.gauche, largeur: Math.max(20, f.largeur - m.gauche - m.droite) });
  const liste = Array.isArray(objets) ? [...objets] : [];
  return { marqueur, ajouts: [marqueur], objets: [...liste, marqueur] };
}

/* ═══════════════════════════════════════════════════════════════════
   Pagination
═══════════════════════════════════════════════════════════════════ */

/**
 * Répartit les objets en pages, détecte les débordements et rend le décalage à
 * appliquer à chaque objet pour qu'il retombe dans sa page.
 *
 * L'espacement RELATIF entre objets d'une même page est conservé : le premier
 * objet d'une page est calé sur la marge haute, les suivants gardent leur écart
 * d'origine. Les objets d'en-tête/pied récurrents sont ignorés (ils sont déjà
 * posés page par page) ; un marqueur de saut ferme la page courante.
 *
 * @param {object[]} objets
 * @param {string|object} [format]
 * @param {object} [marges]
 * @param {{ecart?:number}} [opts]
 * @returns {{
 *   format: object, marges: object, ecart: number, pas: number, nbPages: number,
 *   hauteurTotale: number,
 *   pages: Array<{index:number,numero:number,y0:number,y1:number,objets:string[]}>,
 *   placements: Array<{id:string,page:number,pageNaturelle:number,yInitial:number,
 *                      yPage:number,yAbsolu:number,decalage:number,
 *                      debordant:boolean,coupe:boolean}>,
 *   debordements: Array<object>
 * }}
 */
export function paginer(objets, format = FORMAT_DEFAUT, marges = MARGES_DEFAUT, opts = {}) {
  const f = resoudreFormat(format);
  const m = resoudreMarges(marges);
  const ecart = Number.isFinite(Number(opts.ecart)) ? Number(opts.ecart) : ECART_PAGES_DEFAUT;
  const pas = f.hauteur + ecart;
  // Les bandes récurrentes occupent le haut et le bas de la zone imprimable :
  // le corps se replie entre les deux, sinon la première ligne passerait SOUS
  // l'en-tête. Sans bande posée, la zone est celle des marges, inchangée.
  const reserve = reserveDesBandes(objets, f, ecart);
  const zMarges = zoneUtile(f, m);
  const z = {
    ...zMarges,
    haut: Math.max(zMarges.haut, reserve.haut),
    bas: reserve.bas == null ? zMarges.bas : Math.min(zMarges.bas, reserve.bas),
  };
  z.hauteur = Math.max(1, z.bas - z.haut);
  const plancher = reserve.haut > 0 ? z.haut : 0;

  const liste = (Array.isArray(objets) ? objets : [])
    .filter((o) => o && Number.isFinite(Number(o.y)) && !estEntetePied(o))
    .sort((a, b) => (Number(a.y) - Number(b.y)) || (Number(a.x) || 0) - (Number(b.x) || 0));

  const placements = [];
  const pages = [{ index: 0, numero: 1, y0: 0, y1: f.hauteur, objets: [] }];
  let page = 0;
  // ⛔ Décalage NUL tant que rien ne déborde : une pagination qui déplace un
  // document déjà correct détruirait la mise en page de l'utilisateur.
  let deltaPage = 0;
  let forcerNouvellePage = false;

  const ouvrirPage = (yRef) => {
    page += 1;
    if (!pages[page]) {
      const y0 = origineDePage(page, f, ecart);
      pages[page] = { index: page, numero: page + 1, y0, y1: y0 + f.hauteur, objets: [] };
    }
    deltaPage = origineDePage(page, f, ecart) + z.haut - yRef;
  };
  const recalerPageCourante = (yRef) => {
    deltaPage = origineDePage(page, f, ecart) + z.haut - yRef;
  };

  for (const o of liste) {
    const yInitial = Number(o.y);
    const h = Number.isFinite(Number(o.height)) ? Math.max(0, Number(o.height)) : 0;
    const pageNaturelle = Math.max(0, Math.floor(yInitial / pas));
    const yDansPageNaturelle = yInitial - pageNaturelle * pas;
    const debordantSurPlace = yDansPageNaturelle + h > z.bas || yDansPageNaturelle < z.haut;

    if (forcerNouvellePage) {
      ouvrirPage(yInitial);
      forcerNouvellePage = false;
    }

    let yPage = yInitial + deltaPage - origineDePage(page, f, ecart);
    let coupe = false;

    if (h > z.hauteur) {
      // Objet plus haut qu'une page entière : aucune page ne peut le contenir.
      // On le pose seul en haut d'une page et on le SIGNALE — le découper
      // silencieusement fabriquerait un document faux.
      if (pages[page].objets.length) ouvrirPage(yInitial);
      else recalerPageCourante(yInitial);
      yPage = z.haut;
      coupe = true;
    // ⛔ `plancher` vaut 0 tant qu'aucune bande n'est posée : sans lui, une simple
    // repagination remonterait/descendrait des blocs volontairement placés en
    // pleine page (bandeaux des modèles). Avec un en-tête récurrent, en revanche,
    // laisser le corps à la marge haute le ferait passer SOUS la bande.
    } else if (yPage + h > z.bas || yPage < plancher) {
      if (pages[page].objets.length) ouvrirPage(yInitial);
      else recalerPageCourante(yInitial);
      yPage = z.haut;
    }

    const yAbsolu = origineDePage(page, f, ecart) + yPage;
    placements.push({
      id: o.id,
      page,
      pageNaturelle,
      yInitial,
      yPage,
      yAbsolu,
      decalage: yAbsolu - yInitial,
      debordant: debordantSurPlace || page !== pageNaturelle,
      coupe,
    });
    pages[page].objets.push(o.id);

    if (estSautDePage(o)) forcerNouvellePage = true;
  }

  const nbPages = pages.length;
  return {
    format: f,
    marges: m,
    ecart,
    pas,
    nbPages,
    hauteurTotale: hauteurTotale(nbPages, f, ecart),
    pages,
    placements,
    debordements: placements.filter((p) => p.debordant || p.coupe),
  };
}

/**
 * Patches de repositionnement issus d'une pagination. NE MUTE RIEN.
 * @param {ReturnType<typeof paginer>} resultat
 * @param {{seuil?:number}} [opts] tolérance en px sous laquelle on ne bouge rien
 * @returns {{id:string,patch:{y:number}}[]}
 */
export function patchesDePagination(resultat, opts = {}) {
  const seuil = Number.isFinite(Number(opts.seuil)) ? Number(opts.seuil) : 0.5;
  return (resultat?.placements ?? [])
    .filter((p) => Math.abs(p.decalage) > seuil)
    .map((p) => ({ id: p.id, patch: { y: p.yAbsolu } }));
}

/* ═══════════════════════════════════════════════════════════════════
   En-tête / pied récurrents
═══════════════════════════════════════════════════════════════════ */

/**
 * Remplace `{{page}}` et `{{pages}}` (espaces internes tolérés).
 * @param {string} texte @param {{page:number,pages:number}} ctx
 */
export function substituerJetons(texte, ctx = {}) {
  const page = Number(ctx.page ?? 1);
  const pages = Number(ctx.pages ?? 1);
  return String(texte ?? '')
    .replace(/\{\{\s*page\s*\}\}/gi, String(page))
    .replace(/\{\{\s*pages\s*\}\}/gi, String(pages));
}

const GABARIT_NUMERO_DEFAUT = 'Page {{page}} / {{pages}}';

function normaliserBande(valeur) {
  if (valeur == null || valeur === false) return null;
  if (typeof valeur === 'string') return valeur.trim() ? { texte: valeur } : null;
  if (typeof valeur === 'object' && String(valeur.texte ?? '').trim()) return { ...valeur };
  return null;
}

function mkTexteBande({ x, y, largeur, texte, align, taille, fill, police, meta }) {
  return {
    id: uid('bande'),
    type: 'text',
    x,
    y,
    width: largeur,
    height: Math.round(taille * 1.5),
    rotation: 0,
    layer: 3,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    opacity: 1,
    content: { text: texte },
    style: {
      fontFamily: police,
      fontSize: taille,
      fontWeight: 400,
      fontStyle: 'normal',
      fill,
      align,
      lineHeight: 1.3,
      letterSpacing: 0,
    },
    meta,
  };
}

/**
 * Objets d'en-tête / pied répétés sur chaque page, jetons substitués.
 *
 * @param {object} p
 * @param {string|{texte:string,align?:string,taille?:number,fill?:string}} [p.enTete]
 * @param {string|{texte:string,align?:string,taille?:number,fill?:string}} [p.pied]
 * @param {boolean|{gabarit?:string,align?:string,depart?:number,sauterPremiere?:boolean,position?:'pied'|'entete'}} [p.numerotation]
 * @param {number} [p.nbPages]
 * @param {string|object} [p.format] @param {object} [p.marges]
 * @param {number} [p.ecart] @param {object} [p.style]
 * @returns {object[]} objets prêts pour `addObjects()`
 */
export function enTetePiedRecurrents({
  enTete = null,
  pied = null,
  numerotation = false,
  nbPages = 1,
  format = FORMAT_DEFAUT,
  marges = MARGES_DEFAUT,
  ecart = ECART_PAGES_DEFAUT,
  style = {},
} = {}) {
  const f = resoudreFormat(format);
  const m = resoudreMarges(marges);
  const n = Math.max(1, Math.trunc(Number(nbPages) || 1));
  const largeur = Math.max(20, f.largeur - m.gauche - m.droite);
  const police = style.police ?? 'Georgia, serif';
  // ⛔ 11 px ≈ 8,3 pt : c'est le seuil de confort d'impression que la critique de
  // l'appli applique (« bloc(s) sous 11 px »). L'ancien défaut, 8,5 px ≈ 6,4 pt,
  // faisait dénoncer par le produit ses propres bandes.
  const taille = Number(style.taille) || 11;
  const encre = style.encre ?? DOC_INK_SOFT;

  const hautBande = normaliserBande(enTete);
  const basBande = normaliserBande(pied);
  const num = numerotation === true ? {} : (numerotation && typeof numerotation === 'object' ? numerotation : null);

  const z = zoneUtile(f, m);
  const hLigne = Math.round(taille * 1.5);
  // ⛔ 3 px d'écart minimum entre deux bandes empilées : la critique compte tout
  // recouvrement de plus de 2 px comme un défaut BLOQUANT (blocs superposés).
  const pasLigne = hLigne + 3;

  const depart = Number.isFinite(Number(num?.depart)) ? Number(num.depart) : 1;
  const positionNum = num?.position === 'entete' ? 'entete' : 'pied';
  const out = [];

  for (let i = 0; i < n; i += 1) {
    const y0 = origineDePage(i, f, ecart);
    const ctx = { page: i + depart, pages: n + depart - 1 };
    const numIci = Boolean(num) && !(num.sauterPremiere && i === 0);

    const poser = (l, y) => {
      const estNumero = l.role === 'numero';
      const gabaritNum = l.bande.gabarit ?? GABARIT_NUMERO_DEFAUT;
      out.push(mkTexteBande({
        x: m.gauche,
        y,
        largeur,
        texte: substituerJetons(estNumero ? gabaritNum : l.bande.texte, ctx),
        align: l.bande.align ?? l.alignDefaut,
        taille: Number(l.bande.taille) || taille,
        fill: l.bande.fill ?? encre,
        police,
        // ⛔ Le gabarit est mémorisé sur l'objet : le texte, lui, porte les jetons
        // DÉJÀ substitués (« Page 1 / 2 ») et ne permet pas de régénérer la bande
        // quand une page est ajoutée.
        meta: { doc: META_ENTETE_PIED, role: l.role, page: i, ...(estNumero ? { gabarit: gabaritNum } : {}) },
      }));
    };

    /* Bloc du haut : ancré SOUS le bord haut de la zone imprimable. */
    const lignesHaut = [];
    if (hautBande) lignesHaut.push({ bande: hautBande, role: 'entete', alignDefaut: 'left' });
    if (numIci && positionNum === 'entete') lignesHaut.push({ bande: num, role: 'numero', alignDefaut: 'right' });
    lignesHaut.forEach((l, k) => poser(l, y0 + z.haut + k * pasLigne));

    /* Bloc du bas : ancré SUR le bord bas de la zone imprimable. */
    const lignesBas = [];
    if (basBande) lignesBas.push({ bande: basBande, role: 'pied', alignDefaut: 'center' });
    if (numIci && positionNum === 'pied') lignesBas.push({ bande: num, role: 'numero', alignDefaut: 'right' });
    const hautBloc = z.bas - (lignesBas.length * pasLigne - 3);
    lignesBas.forEach((l, k) => poser(l, y0 + hautBloc + k * pasLigne));
  }

  return out;
}

/**
 * Hauteur réservée par les bandes déjà posées, EN COORDONNÉES LOCALES à la page.
 * Sert à empêcher le corps de passer sous un en-tête ou par-dessus un pied.
 *
 * @param {object[]} objets scène courante
 * @param {string|object} [format] @param {number} [ecart]
 * @returns {{haut:number, bas:number|null}} `bas` = null si aucune bande basse
 */
export function reserveDesBandes(objets, format = FORMAT_DEFAUT, ecart = ECART_PAGES_DEFAUT) {
  const f = resoudreFormat(format);
  const pas = f.hauteur + (Number(ecart) || 0);
  let haut = 0;
  let bas = null;
  for (const o of Array.isArray(objets) ? objets : []) {
    if (!estEntetePied(o) || !Number.isFinite(Number(o.y))) continue;
    const yLocal = Number(o.y) - Math.floor(Number(o.y) / pas) * pas;
    const h = Number.isFinite(Number(o.height)) ? Number(o.height) : 0;
    if (yLocal + h / 2 < f.hauteur / 2) {
      haut = Math.max(haut, yLocal + h + ECART_BANDE_CORPS);
    } else {
      bas = bas == null ? yLocal - ECART_BANDE_CORPS : Math.min(bas, yLocal - ECART_BANDE_CORPS);
    }
  }
  return { haut, bas };
}

/**
 * Part de la hauteur de page au-delà de laquelle un bloc est tenu pour un FOND
 * (bandeau pleine page, aplat de couverture) et n'est plus poussé : le glisser
 * sous l'en-tête ne le sortirait de nulle part et détruirait la maquette.
 */
const RATIO_FOND_DE_PAGE = 0.6;

/**
 * Libère la zone des bandes : rend les patches qui font DESCENDRE le corps sous
 * l'en-tête, page par page. NE MUTE RIEN.
 *
 * ⛔ POURQUOI : `prochaineOrdonnee` pose un tableau à la marge haute (y = 72) et
 * `enTetePiedRecurrents` pose la bande d'en-tête au MÊME y = 72. Dans l'ordre
 * « tableau puis en-tête », les deux outils de l'appli se marchaient dessus —
 * 4 paires superposées, 5 165 px² relevés par `critiquerMiseEnPage`. L'ordre
 * inverse était déjà correct parce que `prochaineOrdonnee` lit {@link reserveDesBandes} ;
 * il manquait la réservation quand la bande arrive APRÈS le contenu.
 *
 * ⛔ Le décalage est UNIFORME par page : décaler les seuls blocs intrus écraserait
 * l'espacement voulu par l'utilisateur et fabriquerait de nouveaux recouvrements.
 *
 * ⛔ Il est aussi TOUT OU RIEN, plafonné par le bas de page. Sur une page dont le
 * contenu déborde déjà (mesuré : un bloc à y = 1122 sur une page de 1123), pousser
 * le faisait entrer en collision avec la page suivante — la réservation fabriquait
 * un recouvrement de 690 × 15 px en réparant l'autre. Quand la place manque on ne
 * bouge RIEN et la page part dans `pagesBloquees` : c'est « Réorganiser en pages »
 * qui sait traiter ce cas, pas cette fonction.
 *
 * Rien n'est poussé vers le HAUT pour la bande de pied : ce serait rentrer dans
 * l'en-tête. Le conflit est rendu dans `conflitsBas` pour que l'appelant le DISE.
 *
 * @param {object[]} objets scène courante (les bandes déjà posées sont ignorées)
 * @param {object[]} bandes bandes qui vont être posées (sortie d'{@link enTetePiedRecurrents})
 * @param {{format?:string|object, ecart?:number}} [opts]
 * @returns {{patches:{id:string,patch:{y:number}}[], reserve:{haut:number,bas:number|null},
 *           deplaces:number, conflitsBas:string[], pagesBloquees:number[]}}
 */
export function patchesReserveBandes(objets, bandes, opts = {}) {
  const f = resoudreFormat(opts.format ?? FORMAT_DEFAUT);
  const ecart = Number.isFinite(Number(opts.ecart)) ? Number(opts.ecart) : ECART_PAGES_DEFAUT;
  const pas = f.hauteur + ecart;
  const reserve = reserveDesBandes(bandes, f, ecart);
  const hFond = f.hauteur * RATIO_FOND_DE_PAGE;

  const parPage = new Map();
  for (const o of Array.isArray(objets) ? objets : []) {
    if (!o || estEntetePied(o) || !Number.isFinite(Number(o.y))) continue;
    const p = Math.max(0, Math.floor(Number(o.y) / pas));
    if (!parPage.has(p)) parPage.set(p, []);
    parPage.get(p).push(o);
  }

  const patches = [];
  const conflitsBas = [];
  const pagesBloquees = [];
  for (const [p, liste] of parPage) {
    const y0 = origineDePage(p, f, ecart);
    // ⛔ Un bloc verrouillé est un choix explicite de l'utilisateur : on ne le
    // déplace pas, et il ne dicte pas non plus le décalage des autres.
    const poussables = liste.filter((o) => !o.locked && (Number(o.height) || 0) < hFond);
    const basDe = (o) => Number(o.y) - y0 + (Number(o.height) || 0);

    let voulu = 0;
    for (const o of poussables) {
      const yLocal = Number(o.y) - y0;
      if (yLocal < reserve.haut) voulu = Math.max(voulu, reserve.haut - yLocal);
    }
    voulu = Math.round(voulu);

    // Plafond DUR = le bas de page : franchir la coupure ferait entrer ce contenu
    // dans la page suivante. `reserve.bas` (le filet d'air du pied) n'est qu'un
    // seuil d'ALERTE — mordre la bande de pied reste préférable à disparaître
    // sous l'en-tête, et le cas est signalé.
    const place = f.hauteur - poussables.reduce((m, o) => Math.max(m, basDe(o)), 0);
    const delta = voulu > 0 && place >= voulu ? voulu : 0;
    if (voulu > 0 && delta === 0) pagesBloquees.push(p + 1);
    if (delta > 0) {
      for (const o of poussables) patches.push({ id: o.id, patch: { y: Math.round(Number(o.y)) + delta } });
    }
    if (reserve.bas != null) {
      for (const o of poussables) {
        if (basDe(o) + delta > reserve.bas) conflitsBas.push(o.id);
      }
    }
  }
  // Les pages sont parcourues dans l'ordre du tableau d'objets, pas dans l'ordre
  // des pages : on trie pour que le message affiché se lise « page(s) 1, 3 ».
  pagesBloquees.sort((a, b) => a - b);
  return { patches, reserve, deplaces: patches.length, conflitsBas, pagesBloquees };
}

/**
 * Reconstitue la configuration des bandes À PARTIR de celles posées sur le canevas.
 *
 * ⛔ POURQUOI : sans ça, ajouter une page obligeait l'utilisateur à RETAPER son
 * en-tête pour que la nouvelle page soit couverte. Le gabarit de numérotation est
 * relu dans `meta.gabarit` — le texte, lui, porte déjà les jetons substitués
 * (« Page 1 / 2 ») et ne peut pas servir de source.
 *
 * @param {object[]} objets
 * @param {string|object} [format] @param {number} [ecart]
 * @returns {{enTete:object|null, pied:object|null, numerotation:object|false} | null}
 *          null si aucune bande n'est posée
 */
export function configDepuisBandes(objets, format = FORMAT_DEFAUT, ecart = ECART_PAGES_DEFAUT) {
  const bandes = (Array.isArray(objets) ? objets : []).filter(estEntetePied);
  if (!bandes.length) return null;
  const f = resoudreFormat(format);
  const pas = f.hauteur + (Number(ecart) || 0);
  const yLocalDe = (o) => {
    const y = Number(o?.y) || 0;
    return y - Math.floor(y / pas) * pas;
  };
  const premiere = (role) => {
    const parPage = bandes.filter((o) => o.meta?.role === role);
    if (!parPage.length) return null;
    return parPage.reduce((a, b) => ((Number(a.meta?.page) || 0) <= (Number(b.meta?.page) || 0) ? a : b));
  };
  const lire = (o) => (o ? {
    texte: String(o.content?.text ?? ''),
    align: o.style?.align,
    taille: o.style?.fontSize,
    fill: o.style?.fill,
  } : null);

  const oEntete = premiere('entete');
  const oPied = premiere('pied');
  const oNum = premiere('numero');
  const numPage0 = bandes.some((o) => o.meta?.role === 'numero' && Number(o.meta?.page) === 0);

  return {
    enTete: lire(oEntete),
    pied: lire(oPied),
    numerotation: oNum
      ? {
        gabarit: oNum.meta?.gabarit ?? GABARIT_NUMERO_DEFAUT,
        align: oNum.style?.align ?? 'right',
        taille: oNum.style?.fontSize,
        fill: oNum.style?.fill,
        position: yLocalDe(oNum) < f.hauteur / 2 ? 'entete' : 'pied',
        sauterPremiere: !numPage0,
      }
      : false,
  };
}

/**
 * Régénère les bandes récurrentes : supprime les précédentes avant d'ajouter les
 * nouvelles. ⛔ Sans cette suppression, chaque repagination empile un jeu d'en-têtes
 * de plus sur le même pixel. NE MUTE RIEN.
 *
 * Les `patches` rendus libèrent la zone des bandes ({@link patchesReserveBandes}) :
 * ils font partie de la MÊME mutation, donc du même pas d'historique — un Ctrl+Z
 * rend le document exactement tel qu'il était.
 *
 * @param {object[]} objets scène courante
 * @param {Parameters<typeof enTetePiedRecurrents>[0]} config
 * @returns {{ ajouts: object[], patches: {id:string,patch:{y:number}}[], suppressions: string[],
 *            reserve: {haut:number,bas:number|null}, conflitsBas: string[], pagesBloquees: number[] }}
 */
export function remplacerEntetePied(objets, config = {}) {
  const suppressions = (Array.isArray(objets) ? objets : [])
    .filter(estEntetePied)
    .map((o) => o.id)
    .filter(Boolean);
  const ajouts = enTetePiedRecurrents(config);
  const { patches, reserve, conflitsBas, pagesBloquees } = patchesReserveBandes(objets, ajouts, {
    format: config.format ?? FORMAT_DEFAUT,
    ecart: config.ecart,
  });
  return { ajouts, patches, suppressions, reserve, conflitsBas, pagesBloquees };
}
