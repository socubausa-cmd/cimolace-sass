/**
 * documentExport.js — export du DOCUMENT (mode Document du Designer Konva).
 *
 * ⛔ CE N'EST PAS le centre d'export des slides (`features/export`). Celui-là lit
 *    le store des présentations : sur un document il répond « Aucun slide à
 *    exporter ». Ici on part des objets Konva de la page A4 (794×1123 @96 dpi),
 *    ou à défaut du stage Konva.
 *
 * ⛔ ORDRE IMPOSÉ PAR LE CAHIER : la critique de mise en page précède l'export.
 *    `preparerExport()` rend le diagnostic de `critiquerMiseEnPage` pour que
 *    l'appelant l'AFFICHE AVANT. Ce module n'empêche jamais d'exporter et
 *    n'exporte jamais de force : il informe, l'utilisateur tranche.
 *
 * ⛔ CONTRAINTE D'IMPORT : `documentDesignCritique.js` tire (via
 *    `liriTextDesignPack`) des imports JSON et `?raw` propres à Vite — importé
 *    statiquement ici, ce fichier deviendrait intestable hors navigateur. D'où :
 *      · `critiquerMiseEnPage` chargé en import DYNAMIQUE, avec repli honnête
 *        (`diagnosticIndisponible`) quand la chaîne Vite est absente ;
 *      · un parseur de couleur local restreint (hex / rgb / rgba / nommées
 *        usuelles) au lieu de `parserCouleur` du module de critique.
 *
 * ⛔ AUCUNE DÉPENDANCE AJOUTÉE : `jspdf` (4.2.1) est déjà au package.json et
 *    déjà utilisé (konvaExportPdf.js, exportCoursePdf.js). Il est chargé en
 *    import dynamique pour ne pas alourdir le bundle du Designer et pour
 *    garder ce module importable par un test node.
 *
 * ⛔ IMAGES : elles sont embarquées en /XObject par `resoudreImages` (voir la section
 *    « Images » plus bas pour la mesure du défaut et l'ordre de résolution). Une image
 *    qui ne peut PAS l'être n'est jamais perdue en silence : `resoudreImages().echecs`
 *    la nomme, `constatImagesNonIntegrees` en fait un constat BLOQUANT que
 *    `preparerExport` place en tête, et `construirePdf` l'ajoute aux avertissements.
 *
 * TEXTE SÉLECTIONNABLE : le chemin `vecteur` (par défaut dès qu'on a les objets)
 * écrit de VRAIS objets texte PDF — sélectionnables et cherchables. Le chemin
 * `image` (stage seul, aucun objet fourni) produit une page-image : le texte n'y
 * est PAS sélectionnable, et le rapport de retour le dit (`texteSelectionnable`).
 */

/* ═══════════════════════════════════════════════════════════════════
   Constantes
═══════════════════════════════════════════════════════════════════ */

/** Le canevas Document est en px @96 dpi ; le PDF est en points (72 dpi). */
export const PT_PAR_PX = 72 / 96;
export const PX_PAR_MM = 96 / 25.4;

/** Formats de page en PIXELS canevas (cf. CANVAS_DIMS.document = 794×1123). */
export const FORMATS_PAGE = Object.freeze({
  a4: { width: 794, height: 1123, formatPdf: 'a4', orientation: 'portrait' },
  a4_paysage: { width: 1123, height: 794, formatPdf: 'a4', orientation: 'landscape' },
  a5: { width: 559, height: 794, formatPdf: 'a5', orientation: 'portrait' },
  letter: { width: 816, height: 1056, formatPdf: 'letter', orientation: 'portrait' },
  letter_paysage: { width: 1056, height: 816, formatPdf: 'letter', orientation: 'landscape' },
});

/** Encre par défaut du mode Document (cf. documentBlockLayout.DOC_INK). */
const ENCRE_DEFAUT = '#1e293b';

const COULEURS_NOMMEES = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', gray: '#808080',
  grey: '#808080', silver: '#c0c0c0', navy: '#000080', teal: '#008080',
  purple: '#800080', maroon: '#800000', olive: '#808000', lime: '#00ff00',
  aqua: '#00ffff', cyan: '#00ffff', fuchsia: '#ff00ff', magenta: '#ff00ff',
};

/** Types que ce module sait tracer en vectoriel. Tout le reste est signalé. */
const TYPES_RENDUS = new Set([
  'text', 'rect', 'circle', 'ellipse', 'triangle', 'diamond', 'starshape',
  'line', 'arrow', 'table', 'image', 'icon',
]);

/* ═══════════════════════════════════════════════════════════════════
   Couleurs
═══════════════════════════════════════════════════════════════════ */

/**
 * Parseur restreint — voir la contrainte d'import en tête de fichier.
 * @param {*} couleur
 * @returns {{ r: number, g: number, b: number, a: number } | null}
 */
export function parserCouleurExport(couleur) {
  if (typeof couleur !== 'string') return null;
  const c = couleur.trim().toLowerCase();
  if (!c || c === 'none') return null;
  if (c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const src = COULEURS_NOMMEES[c] || c;

  if (src.startsWith('#')) {
    const h = src.slice(1);
    if (h.length === 3 || h.length === 4) {
      const v = h.split('').map((x) => parseInt(x + x, 16));
      if (v.slice(0, 3).some(Number.isNaN)) return null;
      return { r: v[0], g: v[1], b: v[2], a: h.length === 4 ? v[3] / 255 : 1 };
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b, a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
    }
    return null;
  }

  const m = src.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  const parts = m[1].split(/[,/\s]+/).filter(Boolean);
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

/* ═══════════════════════════════════════════════════════════════════
   Format de page
═══════════════════════════════════════════════════════════════════ */

/**
 * Accepte : une clé de `FORMATS_PAGE`, `{ width, height }` en px, ou le
 * `page_setup` des 100 modèles (marges en mm).
 *
 * ⛔ DEUX JEUX DE MARGES, JAMAIS CONFONDUS — c'est de leur confusion que venait le
 *    « marges déclarées 0/0/0/0 px » de la critique d'export :
 *      · `marges` = INSET D'IMPRESSION. Il rétrécit la zone imprimée et met le
 *        contenu à l'échelle (`calculerTransformation`). Défaut 0 = report 1:1.
 *        Un `page_setup` de modèle n'a RIEN à faire ici : ses marges sont déjà
 *        tenues par la position des blocs, les appliquer en inset les doublerait.
 *      · `margesContenu` = marges TYPOGRAPHIQUES de la page, celles que la
 *        critique compare aux blocs. `null` = « non déclarées » et c'est
 *        `normaliserFormat` (documentDesignCritique) qui pose son défaut A4
 *        (20/15 mm) — UNE seule source de vérité, partagée avec l'onglet
 *        ARCHITECT. Un zéro écrit ici court-circuiterait ce défaut.
 *
 * @param {string|object} [format]
 * @param {{top?:number,right?:number,bottom?:number,left?:number}} [marges] en PX
 * @param {{top?:number,right?:number,bottom?:number,left?:number}} [margesContenu] en PX
 * @returns {{ width:number, height:number, formatPdf:string, orientation:string,
 *   fond:string, marges:{top:number,right:number,bottom:number,left:number},
 *   margesContenu:{top:number,right:number,bottom:number,left:number}|null }}
 */
export function resoudreFormat(format, marges, margesContenu) {
  let base = FORMATS_PAGE.a4;
  let source = {};

  if (typeof format === 'string') {
    base = FORMATS_PAGE[format] || FORMATS_PAGE[format.toLowerCase()] || FORMATS_PAGE.a4;
  } else if (format && typeof format === 'object') {
    source = format;
    const w = Number(format.width);
    const h = Number(format.height);
    if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
      base = {
        width: w,
        height: h,
        /* Format libre : on laisse jsPDF fabriquer la page aux dimensions exactes. */
        formatPdf: null,
        orientation: h >= w ? 'portrait' : 'landscape',
      };
    } else if (typeof format.preset === 'string' && FORMATS_PAGE[format.preset]) {
      base = FORMATS_PAGE[format.preset];
    }
  }

  const enPx = (o) => ({
    top: Number(o.top) || 0,
    right: Number(o.right) || 0,
    bottom: Number(o.bottom) || 0,
    left: Number(o.left) || 0,
  });

  /* Inset d'impression : seulement s'il est demandé explicitement. */
  const m = marges && typeof marges === 'object'
    ? enPx(marges)
    : { top: 0, right: 0, bottom: 0, left: 0 };

  /* Marges typographiques : explicites, sinon celles du modèle, sinon NULL. */
  let mc = null;
  if (margesContenu && typeof margesContenu === 'object') {
    mc = enPx(margesContenu);
  } else {
    const ps = source.page_setup || source.pageSetup;
    if (ps?.margins) {
      const k = (ps.unit ?? 'mm') === 'mm' ? PX_PAR_MM : 1;
      mc = {
        top: (Number(ps.margins.top) || 0) * k,
        right: (Number(ps.margins.right) || 0) * k,
        bottom: (Number(ps.margins.bottom) || 0) * k,
        left: (Number(ps.margins.left) || 0) * k,
      };
    }
  }

  const fondBrut = source.fond ?? source.background ?? '#ffffff';
  /* `transparent` s'imprime blanc : c'est le fond réel du papier. */
  const fond = !fondBrut || fondBrut === 'transparent' || fondBrut === 'none' ? '#ffffff' : fondBrut;

  return { ...base, fond, marges: m, margesContenu: mc };
}

/**
 * Transformation px canevas → points PDF, marges d'impression comprises.
 * Les marges RÉDUISENT la zone imprimée et le contenu est mis à l'échelle pour
 * y tenir (utile pour les imprimantes à bord non imprimable). Marges nulles =
 * report 1:1.
 *
 * @param {{width:number,height:number}} formatPx
 * @param {{top:number,right:number,bottom:number,left:number}} margesPx
 * @param {{largeur:number,hauteur:number}} pagePt dimensions de la page PDF en pt
 * @returns {{ k:number, dx:number, dy:number }}
 */
export function calculerTransformation(formatPx, margesPx, pagePt) {
  const wPt = (Number(formatPx?.width) || 1) * PT_PAR_PX;
  const hPt = (Number(formatPx?.height) || 1) * PT_PAR_PX;
  const mg = margesPx || { top: 0, right: 0, bottom: 0, left: 0 };
  const gPt = (Number(mg.left) || 0) * PT_PAR_PX;
  const dPt = (Number(mg.right) || 0) * PT_PAR_PX;
  const hautPt = (Number(mg.top) || 0) * PT_PAR_PX;
  const basPt = (Number(mg.bottom) || 0) * PT_PAR_PX;

  const dispoW = Math.max(1, (pagePt?.largeur || wPt) - gPt - dPt);
  const dispoH = Math.max(1, (pagePt?.hauteur || hPt) - hautPt - basPt);
  const k = Math.min(dispoW / wPt, dispoH / hPt);

  return {
    k,
    dx: gPt + (dispoW - wPt * k) / 2,
    dy: hautPt + (dispoH - hPt * k) / 2,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Source (stage Konva / tableau d'objets)
═══════════════════════════════════════════════════════════════════ */

/**
 * @param {*} entree stage Konva, tableau d'objets, ou `{ objets, stage }`
 * @returns {{ objets: object[], stage: object|null }}
 */
export function normaliserSource(entree) {
  if (!entree) return { objets: [], stage: null };
  if (Array.isArray(entree)) return { objets: entree, stage: null };
  if (typeof entree.toDataURL === 'function') return { objets: [], stage: entree };
  if (typeof entree === 'object') {
    const objets = Array.isArray(entree.objets)
      ? entree.objets
      : Array.isArray(entree.objects)
        ? entree.objects
        : [];
    const stage = entree.stage && typeof entree.stage.toDataURL === 'function' ? entree.stage : null;
    return { objets, stage };
  }
  return { objets: [], stage: null };
}

/* ═══════════════════════════════════════════════════════════════════
   Pagination
═══════════════════════════════════════════════════════════════════ */

const estVisible = (o) => o && o.visible !== false;

/**
 * Mobilier d'éditeur : le marqueur de saut de page de `documentPagination.js`
 * borne les pages sur le canevas, il n'a rien à faire sur le papier.
 */
const estMarqueurEditeur = (o) => o?.meta?.doc === 'saut-de-page';

/**
 * Filigrane (`documentFiligrane.js`). Le marqueur est recopié — et non importé —
 * pour la même raison que ci-dessus : ce fichier reste sans import statique, donc
 * testable hors navigateur (cf. « CONTRAINTE D'IMPORT » en tête).
 *
 * ⛔ Il SORT dans le PDF (il n'est pas du mobilier d'éditeur) mais il est exclu du
 *    compte des `coupes` : sa boîte non pivotée n'est pas son empreinte. Un
 *    « CONFIDENTIEL » à −45° a une boîte de 1 370 × 120 posée à y = 1 003 sur une
 *    page de 1 123 — annoncé « rogné » alors qu'il tient visiblement dans la page.
 */
const estFiligrane = (o) => o?.meta?.doc === 'filigrane';

/** Page explicite posée par l'éditeur (« Nouvelle page ») si elle existe. */
function pageDeclaree(o) {
  const v = o?.page ?? o?.pageIndex ?? o?.meta?.page;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Répartit les objets en pages. Trois sources d'affectation, dans cet ordre :
 *   1. `options.placements` — le résultat de `documentPagination.paginer()`
 *      (`{ id, page, yPage }`) fait autorité : quand la coque pagine déjà, on
 *      NE recalcule PAS, on suit ;
 *   2. une page explicite portée par l'objet (`page` / `pageIndex` / `meta.page`) ;
 *   3. à défaut, la bande verticale `floor(y / (hauteurPage + ecart))` — c'est
 *      ainsi qu'un document plus haut qu'une page se lit sur le canevas.
 *
 * Les objets rendus sont des COPIES superficielles avec `y` ramené en
 * coordonnées de page. Rien n'est muté.
 *
 * @param {object[]} objets
 * @param {{ hauteurPage?:number, ecart?:number, inclureMasques?:boolean,
 *   maxPages?:number, placements?:Array<{id:string,page:number,yPage:number}> }} [options]
 * @returns {{ pages: Array<{ index:number, objets:object[] }>, nbPages:number,
 *   hauteurPage:number, coupes:Array<{id:string,page:number,depassementPx:number}>,
 *   ignores:number }}
 */
export function paginerObjets(objets, options = {}) {
  const hauteurPage = Number(options.hauteurPage) > 0
    ? Number(options.hauteurPage)
    : FORMATS_PAGE.a4.height;
  /* `ecart` = respiration entre deux pages sur le canevas (documentPagination). */
  const ecart = Number(options.ecart) > 0 ? Number(options.ecart) : 0;
  const pas = hauteurPage + ecart;
  const maxPages = Number(options.maxPages) > 0 ? Math.floor(Number(options.maxPages)) : 200;
  const liste = Array.isArray(objets) ? objets : [];

  const places = new Map();
  if (Array.isArray(options.placements)) {
    for (const p of options.placements) {
      if (p?.id != null && Number.isFinite(Number(p.page))) {
        places.set(String(p.id), { page: Math.max(0, Math.floor(Number(p.page))), yPage: Number(p.yPage) });
      }
    }
  }

  const retenus = [];
  let ignores = 0;
  liste.forEach((o, i) => {
    if (!o || typeof o !== 'object') { ignores += 1; return; }
    if (estMarqueurEditeur(o)) { ignores += 1; return; }
    if (!options.inclureMasques && !estVisible(o)) { ignores += 1; return; }
    retenus.push({ o, i });
  });

  /* Ordre de tracé = ordre d'empilement du canevas : `layer` puis index d'ajout. */
  retenus.sort((a, b) => {
    const la = Number(a.o.layer) || 0;
    const lb = Number(b.o.layer) || 0;
    return la === lb ? a.i - b.i : la - lb;
  });

  const parPage = new Map();
  const coupes = [];
  let pageMax = 0;

  for (const { o } of retenus) {
    const place = places.get(String(o.id));
    const declaree = place ? place.page : pageDeclaree(o);
    const y = Number(o.y);
    const yy = Number.isFinite(y) ? y : 0;
    let page = declaree != null ? declaree : Math.floor(yy / pas);
    if (!Number.isFinite(page) || page < 0) page = 0;
    if (page > maxPages - 1) page = maxPages - 1;

    /**
     * ⛔ PIÈGE MESURÉ : une page déclarée ne veut PAS dire que `y` est déjà local.
     * `documentPagination.enTetePiedRecurrents` écrit `meta.page = 2` avec un `y`
     * ABSOLU (2318). Traité comme local, l'en-tête de la page 3 était tracé à
     * 2318 px du haut de la page 3 — hors papier — et la préparation annonçait
     * « 3 bloc(s) dépassent le bas de leur page » sur des bandes posées par
     * l'appli elle-même. Règle : `y` est absolu dès qu'il atteint l'origine de sa
     * page ; sinon il est déjà local (un y local est toujours < `pas`).
     */
    const yBrutLocal = yy - page * pas;
    const yLocal = place && Number.isFinite(place.yPage)
      ? place.yPage
      : declaree != null ? (yBrutLocal >= 0 ? yBrutLocal : yy) : yBrutLocal;
    const decalage = yy - yLocal;
    const h = Number(o.height);
    if (Number.isFinite(h) && h > 0 && yLocal + h > hauteurPage && !estFiligrane(o)) {
      coupes.push({ id: String(o.id ?? ''), page, depassementPx: Math.round(yLocal + h - hauteurPage) });
    }

    if (!parPage.has(page)) parPage.set(page, []);
    parPage.get(page).push(decalage === 0 ? { ...o } : { ...o, y: yLocal });
    if (page > pageMax) pageMax = page;
  }

  const pages = [];
  for (let p = 0; p <= pageMax; p += 1) {
    pages.push({ index: p, objets: parPage.get(p) || [] });
  }
  if (!pages.length) pages.push({ index: 0, objets: [] });

  return { pages, nbPages: pages.length, hauteurPage, coupes, ignores };
}

/* ═══════════════════════════════════════════════════════════════════
   Nommage de fichier
═══════════════════════════════════════════════════════════════════ */

function slug(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

function horodatage(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Nom de fichier stable et sans accent. Un nom déjà terminé par la bonne
 * extension est RESPECTÉ tel quel (l'utilisateur a tranché, on n'horodate pas).
 *
 * @param {{ nom?:string, typeDoc?:string, extension?:string, date?:Date, horodater?:boolean }} [p]
 * @returns {string}
 */
export function nommerFichier(p = {}) {
  const ext = String(p.extension || 'pdf').replace(/^\./, '').toLowerCase();
  const brut = String(p.nom ?? '').trim();
  if (brut && brut.toLowerCase().endsWith(`.${ext}`)) return brut;

  const base = slug(brut) || slug(p.typeDoc) || 'document';
  const suffixe = p.horodater === false ? '' : `-${horodatage(p.date)}`;
  return `${base}${suffixe}.${ext}`;
}

/* ═══════════════════════════════════════════════════════════════════
   Préparation : la critique AVANT l'export
═══════════════════════════════════════════════════════════════════ */

let _critiqueCache;

async function chargerCritique() {
  if (_critiqueCache !== undefined) return _critiqueCache;
  try {
    const mod = await import('./documentDesignCritique.js');
    _critiqueCache = typeof mod?.critiquerMiseEnPage === 'function' ? mod : null;
  } catch {
    /* Chaîne d'imports Vite absente (test node, worker) : on le DIT, on ne feint pas. */
    _critiqueCache = null;
  }
  return _critiqueCache;
}

/**
 * Règles de `critiquerMiseEnPage` dont le verdict dépend du CADRE (les bords de la
 * page), pas du contenu. Elles sont les seules à devoir être rejouées page par
 * page ; toutes les autres (corps, hiérarchie, contraste, chevauchement,
 * alignement…) se lisent sur le document entier et donnent le même résultat quel
 * que soit le découpage.
 */
const REGLES_DE_CADRE = new Set(['debordement', 'marges']);

const POIDS_GRAVITE = { bloquant: 0, majeur: 1, mineur: 2, info: 3 };

/**
 * Rebase en coordonnées ABSOLUES les `y` d'une correction issue d'une critique
 * jouée dans le repère d'une page.
 *
 * ⛔ Sans ça, « Ramener dans la page » sur un constat de la page 3 écrirait un `y`
 *    de page (72) dans un objet dont le `y` est absolu (2318) : la correction
 *    téléporterait le bloc en page 1. Une correction qui casse la mise en page est
 *    pire que le défaut qu'elle corrige.
 */
function rebaserConstat(c, origine, page, nbPages) {
  const titre = nbPages > 1 ? `Page ${page + 1} — ${c.titre}` : c.titre;
  const correction = c.correction && Array.isArray(c.correction.patches)
    ? {
      ...c.correction,
      patches: c.correction.patches.map((p) => (
        p?.partial && Number.isFinite(Number(p.partial.y))
          ? { ...p, partial: { ...p.partial, y: Math.round(Number(p.partial.y) + origine) } }
          : p
      )),
    }
    : c.correction;
  return { ...c, titre, page, correction };
}

/**
 * SOURCE DE VÉRITÉ UNIQUE de la critique d'un document paginé.
 *
 * ⛔ POURQUOI CETTE FONCTION EXISTE : l'export et l'onglet ARCHITECT appelaient
 *    `critiquerMiseEnPage` chacun à sa façon et se contredisaient sous les yeux de
 *    l'utilisateur sur le MÊME document (« marges 0/0/0/0 · 2 bloquants » contre
 *    « marges 75,59/56,69 · 1 bloquant »). Deux causes, toutes deux traitées ici :
 *      1. des marges de contenu à zéro passées en `margesPx`, qui court-circuitaient
 *         le défaut A4 de `normaliserFormat` (cf. `resoudreFormat`) ;
 *      2. des `y` BRUTS comparés à la hauteur d'UNE page alors que le canevas
 *         EMPILE les pages : tout ce qui était en page 2 sortait « hors de la page ».
 *
 * ⛔ Le canevas Document est une surface continue : le cadre d'ensemble est donc
 *    la PILE (hauteur × nombre de pages), celui de l'onglet ARCHITECT. Les deux
 *    règles de cadre, elles, sont rejouées dans le repère de CHAQUE page, où
 *    `paginerObjets` a déjà ramené les `y`.
 *
 * ⚠️ RESTE À FAIRE, HORS DE CE FICHIER : `DocumentReviewPanel` (onglet ARCHITECT)
 *    appelle encore `critiquerMiseEnPage` en direct avec la hauteur du CANEVAS.
 *    Il voit donc les mêmes constats que l'export sur un document sain, mais rate
 *    un bloc qui déborde le bas d'une page intermédiaire. L'adoption est d'une
 *    ligne : `await critiquerDocument(objets, { format: { width, height: hauteurPage,
 *    fond, page_setup }, typeDoc, templateId })` puis lire `.diagnostic`.
 *
 * @param {object[]} objets
 * @param {{ format?:*, marges?:object, margesContenu?:object, typeDoc?:string,
 *   templateId?:string, ecart?:number, placements?:Array, critiquer?:Function }} [options]
 * @returns {Promise<{ format:object, pagination:object, diagnostic:object|null,
 *   indisponible:string|null }>}
 */
export async function critiquerDocument(objets, options = {}) {
  const format = resoudreFormat(options.format, options.marges, options.margesContenu);
  const ecart = Number(options.ecart) > 0 ? Number(options.ecart) : 0;
  const pagination = paginerObjets(objets, {
    hauteurPage: format.height,
    ecart,
    placements: options.placements,
  });

  const critiquer = typeof options.critiquer === 'function'
    ? options.critiquer
    : (await chargerCritique())?.critiquerMiseEnPage;
  if (typeof critiquer !== 'function') {
    return {
      format,
      pagination,
      diagnostic: null,
      indisponible: 'Module de critique indisponible dans cet environnement.',
    };
  }

  const visibles = (Array.isArray(objets) ? objets : []).filter(estVisible);
  const contexte = {
    typeDoc: options.typeDoc ?? null,
    templateId: options.templateId ?? null,
    /**
     * Mesures NATIVES des images (`resoudreImages().natives`) : sans elles la règle
     * « image déformée » se tait, faute de rapport de référence.
     */
    imagesNatives: options.imagesNatives ?? null,
    /* La hauteur d'UNE page, pour juger la pile : un bloc peut tenir dans le canevas
       et traverser quand même une coupe de page (règle `hors_page`). */
    hauteurPage: format.height,
    ecartPages: ecart,
  };
  /* `margesPx` n'est transmis QUE s'il est déclaré : sinon, défaut A4 de la critique. */
  const cadre = {
    width: format.width,
    fond: format.fond,
    ...(format.margesContenu ? { margesPx: format.margesContenu } : {}),
  };

  try {
    const pas = format.height + ecart;
    const hauteurPile = format.height * pagination.nbPages + ecart * (pagination.nbPages - 1);
    const ensemble = critiquer(visibles, { ...cadre, height: hauteurPile }, contexte);

    const constats = (ensemble.constats ?? []).filter((c) => !REGLES_DE_CADRE.has(c.regle));
    for (const p of pagination.pages) {
      const parPage = critiquer(p.objets, { ...cadre, height: format.height }, contexte);
      for (const c of parPage.constats ?? []) {
        if (!REGLES_DE_CADRE.has(c.regle)) continue;
        constats.push(rebaserConstat(c, p.index * pas, p.index, pagination.nbPages));
      }
    }
    constats.sort((a, b) => (POIDS_GRAVITE[a.gravite] ?? 9) - (POIDS_GRAVITE[b.gravite] ?? 9));

    const compte = { bloquant: 0, majeur: 0, mineur: 0, info: 0 };
    for (const c of constats) if (compte[c.gravite] != null) compte[c.gravite] += 1;
    const verdict = !visibles.length
      ? 'vide'
      : compte.bloquant
        ? 'bloquant'
        : compte.majeur || compte.mineur
          ? 'a_corriger'
          : 'propre';

    return {
      format,
      pagination,
      indisponible: null,
      diagnostic: {
        ...ensemble,
        constats,
        compte,
        verdict,
        /* Le cadre RÉELLEMENT jugé, pour que le panneau puisse l'afficher. */
        cadre: {
          page: { width: format.width, height: format.height },
          nbPages: pagination.nbPages,
          marges: ensemble.format?.marges ?? null,
        },
      },
    };
  } catch (e) {
    return {
      format,
      pagination,
      diagnostic: null,
      indisponible: `Critique en échec : ${e?.message || 'erreur inconnue'}`,
    };
  }
}

/**
 * Ce que l'appelant doit montrer AVANT de lancer l'export : le diagnostic mesuré
 * de `critiquerMiseEnPage`, le nombre de pages et le nom de fichier proposé.
 *
 * ⛔ Ne bloque JAMAIS : `doitAlerter` est une information, pas un verrou. Aucun
 *    export n'est déclenché ici.
 *
 * @param {object[]} objets
 * @param {{ format?:*, marges?:object, nomFichier?:string, typeDoc?:string,
 *   templateId?:string, critiquer?:Function }} [options]
 * @returns {Promise<object>}
 */
export async function preparerExport(objets, options = {}) {
  /**
   * ⛔ LES IMAGES D'ABORD, ET AVANT LA CRITIQUE. Deux raisons :
   *   1. une image qui ne peut pas être embarquée est une PERTE DE CONTENU — elle
   *      doit sortir en constat BLOQUANT, pas en silence (défaut [IMG-PDF]) ;
   *   2. décoder les bitmaps donne leurs dimensions NATIVES, seule référence de la
   *      règle « image déformée » tant que l'import ne les stocke pas.
   * Le décodage est mis en cache : l'export qui suit ne recharge rien.
   */
  const resolutionImages = options.auditerImages === false
    ? { total: 0, integrees: 0, parObjet: new Map(), natives: new Map(), echecs: [] }
    : await resoudreImages(objets, options);

  const { format, pagination, diagnostic, indisponible } = await critiquerDocument(objets, {
    ...options,
    imagesNatives: resolutionImages.natives,
  });
  const avertissements = [];

  const liste = Array.isArray(objets) ? objets : [];
  const nonRendus = liste.filter((o) => estVisible(o) && o?.type && !TYPES_RENDUS.has(o.type));
  if (nonRendus.length) {
    avertissements.push(
      `${nonRendus.length} objet(s) d'un type non tracé en PDF (${[...new Set(nonRendus.map((o) => o.type))].join(', ')}) : ils seront absents de l'export.`,
    );
  }
  if (pagination.coupes.length) {
    avertissements.push(
      `${pagination.coupes.length} bloc(s) dépassent le bas de leur page : ils seront rognés à l'impression.`,
    );
  }

  const diagnosticIndisponible = indisponible;
  const constats = Array.isArray(diagnostic?.constats) ? [...diagnostic.constats] : [];

  /* Le constat des images perdues passe EN TÊTE : c'est le seul qui coûte du contenu. */
  const constatImages = constatImagesNonIntegrees(resolutionImages);
  if (constatImages) {
    constats.unshift(constatImages);
    avertissements.push(
      `${resolutionImages.echecs.length} image(s) sur ${resolutionImages.total} ne peuvent pas être embarquées : elles sortiront en cadre vide.`,
    );
    if (diagnostic) {
      diagnostic.constats = constats;
      if (diagnostic.compte) diagnostic.compte.bloquant = (diagnostic.compte.bloquant || 0) + 1;
      diagnostic.verdict = 'bloquant';
    }
  }

  const bloquants = constats.filter((c) => c?.gravite === 'bloquant').length;
  const majeurs = constats.filter((c) => c?.gravite === 'majeur').length;

  return {
    /* Les marges de contenu REELLEMENT retenues (défaut A4 de la critique compris). */
    format: { ...format, margesContenu: diagnostic?.cadre?.marges ?? format.margesContenu },
    nbPages: pagination.nbPages,
    pages: pagination.pages.map((p) => ({ index: p.index, nbObjets: p.objets.length })),
    nbObjets: liste.filter(estVisible).length,
    coupes: pagination.coupes,
    nomFichier: nommerFichier({ nom: options.nomFichier, typeDoc: options.typeDoc, extension: 'pdf', date: options.date }),
    /* Sans module de critique, le constat des images perdues doit passer QUAND MÊME :
       il ne vient pas de la critique, il vient du décodage des bitmaps. */
    diagnostic: diagnostic ?? (constatImages
      ? { constats, compte: { bloquant: 1, majeur: 0, mineur: 0, info: 0 }, verdict: 'bloquant', resume: null, cadre: null }
      : null),
    diagnosticIndisponible,
    verdict: diagnostic?.verdict ?? (constatImages ? 'bloquant' : 'inconnu'),
    /* Ce que l'appelant peut AFFICHER avant de cliquer : « 3 image(s) · 3 embarquée(s) ». */
    images: {
      total: resolutionImages.total,
      integrees: resolutionImages.integrees,
      echecs: resolutionImages.echecs,
    },
    bloquants,
    majeurs,
    /* Informatif : l'export reste possible, c'est l'utilisateur qui tranche. */
    doitAlerter: bloquants > 0 || majeurs > 0,
    avertissements,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Tracé vectoriel
═══════════════════════════════════════════════════════════════════ */

/**
 * ⛔ Le PDF ne sait pas embarquer les polices web du canevas : on retombe sur
 *    les 14 polices standard (helvetica / times / courier). Le texte reste
 *    sélectionnable, le dessin de la lettre change.
 */
export function familleFontPdf(fontFamily) {
  const f = String(fontFamily || '').toLowerCase();
  if (f.includes('mono') || f.includes('courier') || f.includes('consol')) return 'courier';
  if (
    (f.includes('serif') && !f.includes('sans-serif'))
    || f.includes('georgia') || f.includes('times') || f.includes('merriweather')
    || f.includes('playfair') || f.includes('garamond') || f.includes('cambria')
  ) return 'times';
  return 'helvetica';
}

function styleFontPdf(st) {
  const gras = String(st?.fontWeight ?? '') === '700'
    || String(st?.fontWeight ?? '') === 'bold'
    || Number(st?.fontWeight) >= 600
    || st?.fontStyle === 'bold';
  const italique = st?.fontStyle === 'italic' || /italic/i.test(String(st?.fontStyle || ''));
  if (gras && italique) return 'bolditalic';
  if (gras) return 'bold';
  if (italique) return 'italic';
  return 'normal';
}

/**
 * Extras cp1252 (guillemets courbes, apostrophe typographique, €, …) : les
 * polices standard PDF les écrivent, contrairement à tout le reste au-delà de
 * Latin-1 (émojis, grec, cyrillique) qui sort MUET. Il faut donc le dire.
 */
const EXTRAS_CP1252 = new Set(
  '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''),
);

/** @returns {string[]} caractères qui ne sortiront pas dans le PDF */
export function glyphesNonRendus(texte) {
  const perdus = new Set();
  for (const ch of String(texte ?? '')) {
    if (ch.codePointAt(0) > 0xff && !EXTRAS_CP1252.has(ch)) perdus.add(ch);
  }
  return [...perdus];
}

/** Rotation d'un point autour d'un centre (degrés, sens Konva = horaire). */
function tourner(px, py, cx, cy, deg) {
  if (!deg) return [px, py];
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

function styleTrace(fill, stroke, epaisseur) {
  const f = fill && fill.a > 0;
  const s = stroke && stroke.a > 0 && epaisseur > 0;
  if (f && s) return 'FD';
  if (f) return 'F';
  if (s) return 'S';
  return null;
}

function appliquerOpacite(doc, valeur) {
  const v = Math.max(0, Math.min(1, Number.isFinite(valeur) ? valeur : 1));
  try {
    doc.setGState(new doc.GState({ opacity: v, 'stroke-opacity': v }));
  } catch {
    /* GState indisponible : l'objet sort opaque — signalé par l'appelant si besoin. */
  }
}

/** Polygone fermé à partir de points absolus en pt. */
function polygone(doc, pts, style) {
  if (!style || pts.length < 2) return;
  const deltas = [];
  for (let i = 1; i < pts.length; i += 1) {
    deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  }
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], style, true);
}

/** Sommets d'un polygone régulier façon Konva (premier sommet en haut). */
function sommetsReguliers(cx, cy, r, cotes, rotationDeg) {
  const pts = [];
  for (let i = 0; i < cotes; i += 1) {
    const a = ((-90 + rotationDeg + (i * 360) / cotes) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function sommetsEtoile(cx, cy, rExt, rInt, branches, rotationDeg) {
  const pts = [];
  for (let i = 0; i < branches * 2; i += 1) {
    const r = i % 2 === 0 ? rExt : rInt;
    const a = ((-90 + rotationDeg + (i * 180) / branches) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/**
 * Trace UN objet. `ctx` = { k, dx, dy, images, avertissements }.
 * Toutes les coordonnées d'entrée sont en px de page, sorties en pt PDF.
 */
function dessinerObjet(doc, o, ctx) {
  const { k, dx, dy } = ctx;
  const X = (v) => dx + (Number(v) || 0) * PT_PAR_PX * k;
  const Y = (v) => dy + (Number(v) || 0) * PT_PAR_PX * k;
  const T = (v) => (Number(v) || 0) * PT_PAR_PX * k;

  const st = o.style || {};
  const rot = Number(o.rotation) || 0;
  const opac = Number.isFinite(Number(o.opacity)) ? Number(o.opacity) : 1;
  const fill = parserCouleurExport(st.fill);
  const stroke = parserCouleurExport(st.stroke);
  const epaisseur = Number(st.strokeWidth) || 0;
  const w = Number(o.width) || 0;
  const h = Number(o.height) || 0;
  const cx = (Number(o.x) || 0) + w / 2;
  const cy = (Number(o.y) || 0) + h / 2;

  const preparerTrace = () => {
    if (fill) doc.setFillColor(Math.round(fill.r), Math.round(fill.g), Math.round(fill.b));
    if (stroke) doc.setDrawColor(Math.round(stroke.r), Math.round(stroke.g), Math.round(stroke.b));
    doc.setLineWidth(T(epaisseur));
    try {
      if (Array.isArray(st.dash) && st.dash.length) doc.setLineDashPattern(st.dash.map((d) => T(d)), 0);
      else doc.setLineDashPattern([], 0);
    } catch { /* motif de tirets non supporté : trait plein */ }
    /* L'alpha de la couleur et l'opacité de l'objet se multiplient, comme sur le canevas. */
    appliquerOpacite(doc, opac * (fill?.a ?? stroke?.a ?? 1));
  };

  switch (o.type) {
    case 'text':
    case 'icon': {
      const texte = o.type === 'icon'
        ? String(o.content?.glyph ?? '★')
        : String(o.content?.text ?? '');
      if (!texte.trim()) return;

      const perdus = glyphesNonRendus(texte);
      if (perdus.length) {
        ctx.avertissements.push(
          `Caractères absents du PDF (polices standard) : ${perdus.slice(0, 6).join(' ')}`,
        );
      }

      const taille = Number(st.fontSize) > 0
        ? Number(st.fontSize)
        : o.type === 'icon' ? Math.min(w, h) * 0.75 : 24;
      const taillePt = T(taille);
      if (taillePt <= 0) return;

      /* ⛔ Le défaut du modèle Smartboard (#F7F2E8, crème) est INVISIBLE sur du
         papier blanc : en mode Document on retombe sur l'encre sombre. */
      const encre = parserCouleurExport(st.fill) || parserCouleurExport(ENCRE_DEFAUT);
      doc.setTextColor(Math.round(encre.r), Math.round(encre.g), Math.round(encre.b));
      doc.setFont(familleFontPdf(st.fontFamily), styleFontPdf(st));
      doc.setFontSize(taillePt);
      appliquerOpacite(doc, opac * (encre.a ?? 1));

      const espacement = Number(st.letterSpacing) || 0;
      if (espacement) { try { doc.setCharSpace(T(espacement)); } catch { /* ignoré */ } }

      const largeurPt = w > 0 ? T(w) : null;
      const lignes = largeurPt
        ? doc.splitTextToSize(texte, largeurPt)
        : texte.split('\n');
      const interligne = (Number(st.lineHeight) || 1.25) * taillePt;

      const align = st.align === 'center' ? 'center' : st.align === 'right' ? 'right' : 'left';
      const xGauche = X(o.x);
      const xAncre = largeurPt
        ? align === 'center' ? xGauche + largeurPt / 2
          : align === 'right' ? xGauche + largeurPt
            : xGauche
        : xGauche;

      /**
       * Décalage de la ligne MÉDIANE vers la ligne de base, à la formule EXACTE de
       * jsPDF (`baseline: 'middle'` → `y += corps/2 − corps × (facteur − 1)`).
       * Recalculé ici parce que le tracé pivoté ci-dessous ne peut PAS déléguer la
       * baseline à jsPDF (voir la note « TEXTE PIVOTÉ »).
       */
      const facteurInterligne = (() => {
        try {
          const v = Number(doc.getLineHeightFactor());
          return Number.isFinite(v) && v > 0 ? v : 1.15;
        } catch { return 1.15; }
      })();
      const medianeVersBase = taillePt / 2 - taillePt * (facteurInterligne - 1);

      lignes.forEach((ligne, i) => {
        /* Konva centre chaque ligne dans sa boîte d'interligne → baseline « middle ». */
        const yLigne = Y(o.y) + (i + 0.5) * interligne;

        if (!rot) {
          doc.text(ligne, xAncre, yLigne, { baseline: 'middle', align });
        } else {
          /**
           * ⛔ TEXTE PIVOTÉ — DEUX DÉFAUTS MESURÉS, CORRIGÉS ENSEMBLE le 2026-08-06.
           *
           *  1. PIVOT. Le canevas rend le texte avec `<Text x={obj.x} y={obj.y}>` et
           *     `offsetX/offsetY = 0` (canvas/KonvaBoardObject.jsx) : Konva tourne
           *     autour de l'angle HAUT-GAUCHE. Ce fichier tournait autour du CENTRE
           *     de la boîte — 234 px d'écart sur une boîte de 600 × 120 à −45°.
           *     (Les formes `circle`, `ellipse` et les polygones gardent le centre :
           *     elles sont VRAIMENT posées par leur centre côté Konva.)
           *
           *  2. `align` ET `baseline` DE jsPDF SONT APPLIQUÉS AVANT LA ROTATION, DANS
           *     LE REPÈRE DE LA PAGE (jspdf 4.2.1 : `x -= lineWidths[0] / 2` et
           *     `y += height/2 − descent`, tous deux avant la matrice de texte). Sur
           *     un « BROUILLON » de 72 pt à −45°, l'écart relevé dans le flux valait
           *     (−219,3 ; +25,2) pt CONSTANTS quel que soit l'angle — la marque
           *     partait à 292 px de sa place. On fait donc le calage NOUS-MÊMES, le
           *     long de l'axe du texte, et on ne laisse à jsPDF que la rotation.
           */
          const largeurLigne = doc.getTextWidth(ligne);
          const xDepart = align === 'center'
            ? xAncre - largeurLigne / 2
            : align === 'right' ? xAncre - largeurLigne : xAncre;
          const [px, py] = tourner(xDepart, yLigne + medianeVersBase, X(o.x), Y(o.y), rot);
          /* align/baseline laissés à leur défaut (gauche / alphabétique) : tout
             réglage ici réintroduirait le décalage en repère de page. */
          doc.text(ligne, px, py, { angle: -rot });
          return; /* le soulignement pivoté est signalé plus bas, pas tracé */
        }

        if (/underline/i.test(String(st.textDecoration || ''))) {
          const lw = doc.getTextWidth(ligne);
          const x0 = align === 'center' ? xAncre - lw / 2 : align === 'right' ? xAncre - lw : xAncre;
          doc.setDrawColor(Math.round(encre.r), Math.round(encre.g), Math.round(encre.b));
          /* 0.55 × corps sous la ligne médiane : sous les jambages, pas dedans. */
          const yTrait = yLigne + taillePt * 0.55;
          doc.setLineWidth(Math.max(0.4, taillePt * 0.05));
          doc.line(x0, yTrait, x0 + lw, yTrait);
        }
      });

      if (espacement) { try { doc.setCharSpace(0); } catch { /* ignoré */ } }
      if (rot && /underline/i.test(String(st.textDecoration || ''))) {
        ctx.avertissements.push('Soulignement non tracé sur un texte pivoté.');
      }
      return;
    }

    case 'rect': {
      const style = styleTrace(fill, stroke, epaisseur);
      if (!style) return;
      preparerTrace();
      const rayon = Number(st.cornerRadius) || 0;
      if (rot) {
        if (rayon) ctx.avertissements.push('Coins arrondis ignorés sur un rectangle pivoté.');
        const coins = [
          [o.x, o.y], [o.x + w, o.y], [o.x + w, o.y + h], [o.x, o.y + h],
        ].map(([px, py]) => {
          const [rx, ry] = tourner(px, py, cx, cy, rot);
          return [X(rx), Y(ry)];
        });
        polygone(doc, coins, style);
      } else if (rayon) {
        doc.roundedRect(X(o.x), Y(o.y), T(w), T(h), T(rayon), T(rayon), style);
      } else {
        doc.rect(X(o.x), Y(o.y), T(w), T(h), style);
      }
      return;
    }

    case 'circle':
    case 'ellipse': {
      const style = styleTrace(fill, stroke, epaisseur);
      if (!style) return;
      preparerTrace();
      const rx = o.type === 'circle' ? Math.min(w, h) / 2 : w / 2;
      const ry = o.type === 'circle' ? Math.min(w, h) / 2 : h / 2;
      if (rot) ctx.avertissements.push('Rotation non appliquée à une ellipse (tracé PDF non pivotable ici).');
      doc.ellipse(X(cx), Y(cy), T(rx), T(ry), style);
      return;
    }

    case 'triangle':
    case 'diamond':
    case 'starshape': {
      const style = styleTrace(fill, stroke, epaisseur);
      if (!style) return;
      preparerTrace();
      const r = Math.min(w, h) / 2;
      /* `diamond` est un RegularPolygon 4 côtés pivoté de 45° côté canevas. */
      const pts = o.type === 'starshape'
        ? sommetsEtoile(cx, cy, r, r * 0.42, Number(st.numPoints) || 5, rot)
        : sommetsReguliers(cx, cy, r, o.type === 'triangle' ? 3 : 4, rot + (o.type === 'diamond' ? 45 : 0));
      polygone(doc, pts.map(([px, py]) => [X(px), Y(py)]), style);
      return;
    }

    case 'line':
    case 'arrow': {
      const trait = parserCouleurExport(st.stroke) || parserCouleurExport('#94a3b8');
      doc.setDrawColor(Math.round(trait.r), Math.round(trait.g), Math.round(trait.b));
      doc.setLineWidth(T(Number(st.strokeWidth) || (o.type === 'arrow' ? 3 : 2)));
      appliquerOpacite(doc, opac * (trait.a ?? 1));
      try {
        if (Array.isArray(st.dash) && st.dash.length) doc.setLineDashPattern(st.dash.map((d) => T(d)), 0);
        else doc.setLineDashPattern([], 0);
      } catch { /* ignoré */ }

      const bruts = o.content?.points;
      const perso = Array.isArray(bruts) && bruts.length >= 4;
      const pts = perso
        ? bruts
        : o.type === 'arrow' && st.doubleArrow ? [w, 0, 0, 0] : [0, 0, w, 0];
      const yBase = perso ? Number(o.y) || 0 : (Number(o.y) || 0) + (o.type === 'arrow' ? (h || 40) : h) / 2;

      const abs = [];
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const px = (Number(o.x) || 0) + (Number(pts[i]) || 0);
        const py = yBase + (Number(pts[i + 1]) || 0);
        const [qx, qy] = rot ? tourner(px, py, cx, cy, rot) : [px, py];
        abs.push([X(qx), Y(qy)]);
      }
      for (let i = 1; i < abs.length; i += 1) {
        doc.line(abs[i - 1][0], abs[i - 1][1], abs[i][0], abs[i][1]);
      }

      if (o.type === 'arrow' && abs.length >= 2) {
        doc.setFillColor(Math.round(trait.r), Math.round(trait.g), Math.round(trait.b));
        const pointe = (aIdx, bIdx) => {
          const [ax, ay] = abs[aIdx];
          const [bx, by] = abs[bIdx];
          const ang = Math.atan2(by - ay, bx - ax);
          const L = T(Number(st.pointerLength) || 14);
          const Wp = T(Number(st.pointerWidth) || 10);
          const baseX = bx - L * Math.cos(ang);
          const baseY = by - L * Math.sin(ang);
          doc.triangle(
            bx, by,
            baseX - (Wp / 2) * Math.sin(-ang), baseY - (Wp / 2) * Math.cos(-ang),
            baseX + (Wp / 2) * Math.sin(-ang), baseY + (Wp / 2) * Math.cos(-ang),
            'F',
          );
        };
        pointe(abs.length - 2, abs.length - 1);
        if (st.doubleArrow) pointe(1, 0);
      }
      return;
    }

    case 'table': {
      const data = Array.isArray(o.content?.data) && o.content.data.length
        ? o.content.data
        : [['A', 'B'], ['1', '2']];
      const lignes = data.length;
      const cols = data[0]?.length || 1;
      const colW = w / cols;
      const rowH = h / lignes;
      const entete = st.headerRow !== false;
      const tPolice = Number(st.fontSize) || 14;
      if (rot) ctx.avertissements.push('Rotation non appliquée à un tableau.');

      const bordure = parserCouleurExport(st.stroke) || { r: 148, g: 163, b: 184, a: 1 };
      doc.setDrawColor(Math.round(bordure.r), Math.round(bordure.g), Math.round(bordure.b));
      doc.setLineWidth(T(Number(st.strokeWidth) ?? 1) || 0.5);
      try { doc.setLineDashPattern([], 0); } catch { /* ignoré */ }
      appliquerOpacite(doc, opac);

      data.forEach((rangee, ri) => {
        const estEntete = entete && ri === 0;
        const fondCell = parserCouleurExport(
          estEntete ? (st.headerBg || '#eef2f7') : (st.cellBg || '#ffffff'),
        );
        rangee.forEach((cell, ci) => {
          const cxCell = (Number(o.x) || 0) + ci * colW;
          const cyCell = (Number(o.y) || 0) + ri * rowH;
          if (fondCell && fondCell.a > 0) {
            doc.setFillColor(Math.round(fondCell.r), Math.round(fondCell.g), Math.round(fondCell.b));
            doc.rect(X(cxCell), Y(cyCell), T(colW), T(rowH), 'FD');
          } else {
            doc.rect(X(cxCell), Y(cyCell), T(colW), T(rowH), 'S');
          }

          const encre = parserCouleurExport(estEntete ? (st.headerFill || ENCRE_DEFAUT) : (st.cellFill || ENCRE_DEFAUT))
            || { r: 30, g: 41, b: 59, a: 1 };
          doc.setTextColor(Math.round(encre.r), Math.round(encre.g), Math.round(encre.b));
          doc.setFont(familleFontPdf(st.fontFamily), estEntete ? 'bold' : 'normal');
          doc.setFontSize(T(tPolice));
          const dispo = Math.max(1, T(colW) - T(12));
          /* Le canevas coupe la cellule (`wrap="none"` + ellipsis) : on garde la 1re ligne. */
          const contenu = doc.splitTextToSize(String(cell ?? ''), dispo)[0] ?? '';
          doc.text(contenu, X(cxCell + 6), Y(cyCell + rowH / 2), { baseline: 'middle' });
        });
      });
      return;
    }

    case 'image': {
      const src = o.content?.src;
      /* Résolution par ID d'objet : c'est elle qui porte le recadrage (`content.crop`),
         propre à CE bloc, là où deux blocs peuvent partager la même source. */
      const entree = ctx.images?.get(String(o.id ?? '')) || null;
      if (!entree) {
        /* L'échec est déjà nommé par `resoudreImages` : on ne le redit pas ici. */
        /* Cadre gris à la place : l'absence doit se VOIR, pas se deviner. */
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.5);
        appliquerOpacite(doc, 1);
        doc.rect(X(o.x), Y(o.y), T(w), T(h), 'S');
        return;
      }
      appliquerOpacite(doc, opac);
      try {
        if (rot) ctx.avertissements.push('Rotation non appliquée à une image.');
        doc.addImage(entree.ressource, undefined, X(o.x), Y(o.y), T(w), T(h), entree.alias);
        if (ctx.integrees) ctx.integrees.add(String(o.id ?? ''));
      } catch (e) {
        ctx.avertissements.push(
          `Image refusée par le PDF (${e?.message || 'erreur'}) : ${String(src).slice(0, 60)}`,
        );
      }
      return;
    }

    default:
      ctx.avertissements.push(`Type « ${o.type} » non tracé en PDF.`);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Images — du bitmap déjà décodé au /XObject du PDF

   ⛔ DÉFAUT MESURÉ le 2026-08-05 (affiche Orabank) : 3 images sur la page,
      0 dans le PDF, `/XObject` VIDE, 3 970 o contre 4 025 o avec les photos
      (55 octets d'écart pour 450 Ko d'images). Cause exacte : le `src` stocké
      est une URL `…/object/public/smartboard-canvas/…` d'un bucket passé en
      PRIVÉ — elle répond 403, `new Image()` échouait, l'export traçait un
      cadre gris et PERSONNE ne le disait avant de cliquer.

   ⛔ ORDRE DE RÉSOLUTION — le réseau en DERNIER : le bitmap est déjà décodé
      dans le canevas (`KonvaBoardObject` charge une `Image` re-signée). On le
      reprend au nœud Konva ; la re-signature n'est qu'un repli (canevas
      démonté, panneau ouvert sans scène, worker).

   ⛔ CE MODULE NE PARLE PAS À SUPABASE : `options.resoudreSrcImage` est le
      re-signeur passé par la coque (cf. `signSmartboardCanvasUrl`).
═══════════════════════════════════════════════════════════════════ */

/** Bitmaps déjà décodés dans cette session — clé : `src` d'origine. */
const _bitmaps = new Map();

/** À appeler si une source change de contenu sous la même URL. */
export function viderCacheImages() {
  _bitmaps.clear();
}

const estDataImage = (s) => typeof s === 'string' && /^data:image\//i.test(s);

/** Clé courte et stable pour l'alias jsPDF (deux blocs, une seule copie embarquée). */
function hachage(s) {
  let h = 5381;
  const t = String(s);
  for (let i = 0; i < t.length; i += 1) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function chargerImage(src) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; }
    const im = new Image();
    /* ⛔ Sans `crossOrigin`, le bitmap TEINTE le canevas et `toDataURL` lève :
       jsPDF ne peut alors plus l'encoder. Mieux vaut échouer au chargement (et le
       dire) que produire un PDF muet. */
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

/** Stages Konva vivants : celui passé par l'appelant d'abord, puis le registre Konva. */
async function stagesDisponibles(stage) {
  const liste = [];
  if (stage && typeof stage.findOne === 'function') liste.push(stage);
  if (typeof document === 'undefined') return liste;
  try {
    const mod = await import('konva');
    const K = mod?.default ?? mod;
    for (const s of K?.stages ?? []) if (!liste.includes(s)) liste.push(s);
  } catch {
    /* Konva absent (test node, worker) : on se rabat sur la résolution réseau. */
  }
  return liste;
}

/**
 * Bitmap déjà chargé pour l'objet `id`.
 * ⛔ Avec un masque, `KonvaBoardObject` pose l'id sur le GROUPE : le nœud image est
 *    alors un enfant, d'où la descente.
 */
function bitmapDuNoeud(stages, id) {
  if (!id) return null;
  for (const s of stages) {
    let n = null;
    try { n = s.findOne(`#${id}`); } catch { n = null; }
    if (!n) continue;
    const noeud = typeof n.image === 'function' ? n : (n.find?.('Image')?.[0] ?? null);
    let im = null;
    try { im = typeof noeud?.image === 'function' ? noeud.image() : null; } catch { im = null; }
    if (im && (im.naturalWidth || im.width)) return im;
  }
  return null;
}

/** Dimensions natives d'un bitmap décodé (sert aussi à mesurer la déformation). */
function dimensionsBitmap(res) {
  if (typeof res === 'string') return null;
  const largeurNative = Number(res?.naturalWidth ?? res?.width) || 0;
  const hauteurNative = Number(res?.naturalHeight ?? res?.height) || 0;
  return largeurNative > 0 && hauteurNative > 0 ? { largeurNative, hauteurNative } : null;
}

/**
 * Le bitmap est-il ENCODABLE par jsPDF ? jsPDF repasse par un canevas ; un bitmap
 * chargé sans en-tête CORS le teinte et `toDataURL` lève. On le sait AVANT l'export
 * au lieu de le découvrir dans un PDF sans images.
 */
function testerEncodage(res) {
  if (typeof res === 'string') return { ok: true, raison: null };
  if (typeof document === 'undefined') return { ok: true, raison: null };
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    c.getContext('2d').drawImage(res, 0, 0, 1, 1);
    c.toDataURL('image/png');
    return { ok: true, raison: null };
  } catch (e) {
    return { ok: false, raison: `bitmap verrouillé par le navigateur (CORS ${e?.name || 'erreur'})` };
  }
}

/** Recadrage Konva (`content.crop`, en pixels de la SOURCE) reporté sur le bitmap. */
function recadrer(res, crop) {
  const cw = Number(crop?.width) || 0;
  const ch = Number(crop?.height) || 0;
  if (!(cw > 0 && ch > 0)) return res;
  if (typeof res === 'string' || typeof document === 'undefined') return res;
  try {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cw));
    c.height = Math.max(1, Math.round(ch));
    c.getContext('2d').drawImage(res, Number(crop.x) || 0, Number(crop.y) || 0, cw, ch, 0, 0, c.width, c.height);
    return c;
  } catch {
    return res;
  }
}

/**
 * Résout le bitmap de CHAQUE objet image, prêt pour `doc.addImage`.
 *
 * ⛔ Ne jette jamais : une image perdue est un ÉCHEC NOMMÉ dans `echecs`, que
 *    `preparerExport` transforme en constat bloquant AVANT l'export.
 *
 * @param {object[]} objets
 * @param {{ stage?:object, resoudreSrcImage?:(src:string)=>Promise<string>,
 *   bitmaps?:Map<string,*> }} [options] `bitmaps` = injection (tests, worker).
 * @returns {Promise<{ total:number, integrees:number,
 *   parObjet:Map<string,{ressource:*,alias:string,origine:string}>,
 *   natives:Map<string,{largeurNative:number,hauteurNative:number}>,
 *   echecs:Array<{id:string,src:string,raison:string}> }>}
 */
export async function resoudreImages(objets, options = {}) {
  const liste = (Array.isArray(objets) ? objets : []).filter(
    (o) => o?.type === 'image' && estVisible(o) && !estMarqueurEditeur(o),
  );
  const rapport = { total: liste.length, integrees: 0, parObjet: new Map(), natives: new Map(), echecs: [] };
  if (!liste.length) return rapport;

  const stages = await stagesDisponibles(options.stage);
  const injectes = options.bitmaps instanceof Map ? options.bitmaps : null;
  let seq = 0;

  for (const o of liste) {
    const id = String(o.id ?? '');
    const src = String(o.content?.src ?? '');
    if (!src) {
      rapport.echecs.push({ id, src: '', raison: 'aucune source (content.src vide)' });
      continue;
    }

    let res = _bitmaps.get(src) ?? (injectes ? injectes.get(src) : null) ?? null;
    let origine = res ? 'cache' : null;
    if (!res) {
      const n = bitmapDuNoeud(stages, id);
      if (n) { res = n; origine = 'canevas'; }
    }
    if (!res && estDataImage(src)) {
      /* On DÉCODE même une data-URL quand un décodeur existe : c'est ce qui donne
         `naturalWidth/Height`, donc le rapport natif de la règle « image déformée ».
         Hors navigateur (test node), jsPDF sait lire la chaîne telle quelle. */
      const im = await chargerImage(src);
      res = im || src;
      origine = im ? 'data-url-decodee' : 'data-url';
    }
    if (!res && typeof options.resoudreSrcImage === 'function') {
      let url = src;
      try { url = (await options.resoudreSrcImage(src)) || src; } catch { url = src; }
      const im = await chargerImage(url);
      if (im) { res = im; origine = 'url-signee'; }
    }
    if (!res) {
      const im = await chargerImage(src);
      if (im) { res = im; origine = 'url-brute'; }
    }

    if (!res) {
      rapport.echecs.push({
        id,
        src,
        raison: typeof Image === 'undefined'
          ? "hors navigateur : aucun décodeur d'image"
          : 'bitmap introuvable (source du bucket privé non signée, périmée, ou hors ligne)',
      });
      continue;
    }

    const encodable = testerEncodage(res);
    if (!encodable.ok) {
      rapport.echecs.push({ id, src, raison: encodable.raison });
      continue;
    }

    if (typeof res !== 'string') {
      /* Le cache garde des bitmaps DÉCODÉS : sans plafond, un document lourd tiendrait
         toute la session en mémoire. Au-delà, on repart d'un cache neuf. */
      if (_bitmaps.size >= 64) _bitmaps.clear();
      _bitmaps.set(src, res);
    }
    const nat = dimensionsBitmap(res);
    if (nat) rapport.natives.set(id, nat);

    seq += 1;
    const utilisable = recadrer(res, o.content?.crop);
    rapport.parObjet.set(id, {
      ressource: utilisable,
      /* Alias jsPDF : la même photo posée deux fois ne pèse qu'un /XObject. */
      alias: utilisable === res ? `img-${hachage(src)}` : `img-${hachage(src)}-c${seq}`,
      origine,
    });
    rapport.integrees += 1;
  }

  return rapport;
}

/**
 * Constat BLOQUANT quand des images ne peuvent pas être embarquées.
 *
 * ⛔ POURQUOI BLOQUANT : c'est une PERTE DE CONTENU, pas une coquetterie de mise en
 *    page. Le silence d'avant (cadre gris dans le PDF, critique muette) est le vrai
 *    défaut ; ce constat n'interdit toujours pas d'exporter, il informe.
 *
 * @param {{ total:number, integrees:number, echecs:Array }} resolution
 * @returns {object|null}
 */
export function constatImagesNonIntegrees(resolution) {
  const echecs = resolution?.echecs ?? [];
  if (!echecs.length) return null;
  const raisons = [...new Set(echecs.map((e) => e.raison))];
  return {
    id: 'image_non_integree_1',
    regle: 'image_non_integree',
    gravite: 'bloquant',
    titre: `${echecs.length} image(s) sur ${resolution.total} ne partiront PAS dans le PDF`,
    mesure: `${resolution.integrees}/${resolution.total} image(s) embarquée(s) — ${raisons.join(' · ')}`,
    objetIds: echecs.map((e) => e.id).filter(Boolean),
    correction: null,
    pourquoiPasAuto:
      "Le bitmap est introuvable ou illisible : rien à corriger dans la mise en page. Rouvrir le document (le canevas re-signe ses images) ou réimporter le fichier.",
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Construction du PDF
═══════════════════════════════════════════════════════════════════ */

/**
 * Construit le document PDF sans l'enregistrer (partagé par `exporterPdf` et
 * `exporterImpression`).
 *
 * @param {*} stageOuObjets
 * @param {object} [options] voir `exporterPdf`
 * @returns {Promise<{ doc:object, mode:'vecteur'|'image', pages:number,
 *   format:object, texteSelectionnable:boolean, avertissements:string[] }>}
 */
export async function construirePdf(stageOuObjets, options = {}) {
  const { objets, stage } = normaliserSource(stageOuObjets);
  const format = resoudreFormat(options.format, options.marges);
  const avertissements = [];

  let mode = options.mode || 'auto';
  if (mode === 'auto') mode = objets.length ? 'vecteur' : stage ? 'image' : 'vecteur';
  if (mode === 'vecteur' && !objets.length && stage) {
    mode = 'image';
    avertissements.push('Aucun objet fourni : export en image (texte non sélectionnable).');
  }
  if (mode === 'image' && !stage) {
    throw new Error("Export image demandé sans canevas Konva : passe le stage, ou laisse le mode vectoriel.");
  }
  if (mode === 'vecteur' && !objets.length) {
    throw new Error("Rien à exporter : le document est vide.");
  }

  const { jsPDF } = await import('jspdf');
  const pagination = paginerObjets(objets, {
    hauteurPage: format.height,
    ecart: options.ecart,
    placements: options.placements,
  });
  const pasPage = format.height + (Number(options.ecart) > 0 ? Number(options.ecart) : 0);
  const nbPages = mode === 'image'
    ? Math.max(1, Math.ceil((stage.height?.() || format.height) / pasPage))
    : pagination.nbPages;

  const doc = new jsPDF({
    unit: 'pt',
    orientation: format.orientation,
    format: format.formatPdf || [format.width * PT_PAR_PX, format.height * PT_PAR_PX],
    compress: options.compresser !== false,
  });

  try {
    doc.setProperties({
      title: String(options.titre || options.nomFichier || 'Document'),
      creator: 'LIRI Studio — mode Document',
      ...(options.typeDoc ? { subject: String(options.typeDoc) } : {}),
    });
  } catch { /* métadonnées facultatives */ }

  const pagePt = { largeur: doc.internal.pageSize.getWidth(), hauteur: doc.internal.pageSize.getHeight() };
  const { k, dx, dy } = calculerTransformation(format, format.marges, pagePt);
  const fond = parserCouleurExport(format.fond);

  const resolution = mode === 'vecteur'
    ? await resoudreImages(objets, { ...options, stage: options.stage ?? stage })
    : { total: 0, integrees: 0, parObjet: new Map(), natives: new Map(), echecs: [] };
  for (const e of resolution.echecs) {
    avertissements.push(`Image PERDUE dans le PDF — ${e.raison} : ${String(e.src || e.id).slice(0, 70)}`);
  }
  /* Les objets réellement écrits en /XObject : c'est CE compte qui prouve le correctif. */
  const integrees = new Set();

  for (let p = 0; p < nbPages; p += 1) {
    if (p > 0) doc.addPage();

    if (fond && fond.a > 0 && !(fond.r === 255 && fond.g === 255 && fond.b === 255)) {
      appliquerOpacite(doc, 1);
      doc.setFillColor(Math.round(fond.r), Math.round(fond.g), Math.round(fond.b));
      doc.rect(0, 0, pagePt.largeur, pagePt.hauteur, 'F');
    }

    if (mode === 'image') {
      const dataUrl = capturerPage(stage, format, p, options.echelle, pasPage);
      if (dataUrl) {
        doc.addImage(
          dataUrl, 'PNG',
          dx, dy,
          format.width * PT_PAR_PX * k, format.height * PT_PAR_PX * k,
        );
      } else {
        avertissements.push(`Capture impossible pour la page ${p + 1}.`);
      }
    } else {
      const ctx = { k, dx, dy, images: resolution.parObjet, avertissements, integrees };
      for (const o of pagination.pages[p].objets) dessinerObjet(doc, o, ctx);
    }

    appliquerOpacite(doc, 1);
  }

  if (pagination.coupes.length && mode === 'vecteur') {
    avertissements.push(
      `${pagination.coupes.length} bloc(s) dépassent le bas de leur page et sortent rognés.`,
    );
  }

  return {
    doc,
    mode,
    pages: nbPages,
    format,
    texteSelectionnable: mode === 'vecteur',
    /**
     * `dessinees` = images RÉELLEMENT passées à `addImage` sans exception, à ne pas
     * confondre avec `resolues` (bitmaps trouvés). C'est le premier chiffre qui doit
     * égaler `total` pour que le PDF grossisse.
     */
    images: {
      total: resolution.total,
      resolues: resolution.integrees,
      dessinees: integrees.size,
      echecs: resolution.echecs,
      natives: resolution.natives,
    },
    avertissements: [...new Set(avertissements)],
  };
}

/** Capture d'une bande de page depuis le stage Konva (mode image). */
function capturerPage(stage, format, index, echelle, pas) {
  try {
    return stage.toDataURL({
      x: 0,
      y: index * (Number(pas) > 0 ? Number(pas) : format.height),
      width: format.width,
      height: format.height,
      pixelRatio: Number(echelle) > 0 ? Number(echelle) : 2,
      mimeType: 'image/png',
    });
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   API publique d'export
═══════════════════════════════════════════════════════════════════ */

/**
 * Export PDF A4 multi-pages du document.
 *
 * @param {*} stageOuObjets tableau d'objets Konva, `{ objets, stage }`, ou stage
 * @param {{
 *   format?: string|object,      // 'a4' (défaut), 'a4_paysage', ou { width, height }
 *   marges?: { top?:number, right?:number, bottom?:number, left?:number }, // px, inset d'impression
 *   nomFichier?: string,
 *   typeDoc?: string,
 *   titre?: string,
 *   mode?: 'auto'|'vecteur'|'image',
 *   ecart?: number,              // respiration entre pages sur le canevas (documentPagination)
 *   placements?: Array<{id:string,page:number,yPage:number}>, // sortie de documentPagination.paginer()
 *   echelle?: number,            // mode image : pixelRatio (défaut 2)
 *   telecharger?: boolean,       // défaut : true en navigateur
 *   compresser?: boolean,
 *   resoudreSrcImage?: (src:string)=>Promise<string>,
 * }} [options]
 * @returns {Promise<{ ok:boolean, nomFichier:string, pages:number,
 *   mode:string, texteSelectionnable:boolean, blob:Blob|null,
 *   avertissements:string[] }>}
 */
export async function exporterPdf(stageOuObjets, options = {}) {
  const resultat = await construirePdf(stageOuObjets, options);
  const nomFichier = nommerFichier({
    nom: options.nomFichier,
    typeDoc: options.typeDoc,
    extension: 'pdf',
    date: options.date,
  });

  const enNavigateur = typeof document !== 'undefined';
  const telecharger = options.telecharger ?? enNavigateur;
  if (telecharger) {
    if (!enNavigateur) throw new Error("Téléchargement impossible hors navigateur.");
    resultat.doc.save(nomFichier);
  }

  let blob = null;
  try { blob = resultat.doc.output('blob'); } catch { blob = null; }

  return {
    ok: true,
    nomFichier,
    pages: resultat.pages,
    mode: resultat.mode,
    texteSelectionnable: resultat.texteSelectionnable,
    blob,
    /* LA mesure : un PDF qui ne grossit pas n'a embarqué aucune image. */
    octets: blob?.size ?? null,
    images: resultat.images,
    avertissements: resultat.avertissements,
  };
}

/**
 * Export PNG — UNE image par page.
 *
 * ⛔ LIMITE ASSUMÉE : le PNG est une capture du canevas. Sans stage Konva
 *    (objets seuls), ce module ne sait PAS produire d'image — il le dit au lieu
 *    de rendre une page blanche.
 *
 * @param {*} stageOuObjets
 * @param {{ format?:*, nomFichier?:string, typeDoc?:string, echelle?:number,
 *   page?:number, telecharger?:boolean }} [options]
 * @returns {Promise<{ ok:boolean, fichiers:Array<{nom:string,dataUrl:string}> }>}
 */
export async function exporterPng(stageOuObjets, options = {}) {
  const { stage } = normaliserSource(stageOuObjets);
  if (!stage) {
    throw new Error(
      "Export PNG impossible : il faut le canevas Konva (stage). Les objets seuls ne donnent qu'un PDF vectoriel.",
    );
  }
  const format = resoudreFormat(options.format, options.marges);
  const hauteurStage = typeof stage.height === 'function' ? stage.height() : format.height;
  const pas = format.height + (Number(options.ecart) > 0 ? Number(options.ecart) : 0);
  const total = Math.max(1, Math.ceil(hauteurStage / pas));
  const pages = Number.isFinite(Number(options.page))
    ? [Math.max(0, Math.min(total - 1, Math.floor(Number(options.page))))]
    : Array.from({ length: total }, (_, i) => i);

  const base = nommerFichier({ nom: options.nomFichier, typeDoc: options.typeDoc, extension: 'png', date: options.date })
    .replace(/\.png$/i, '');

  const fichiers = [];
  for (const p of pages) {
    const dataUrl = capturerPage(stage, format, p, options.echelle, pas);
    if (!dataUrl) continue;
    const nom = pages.length > 1 || total > 1 ? `${base}-p${p + 1}.png` : `${base}.png`;
    fichiers.push({ nom, dataUrl });
  }
  if (!fichiers.length) throw new Error('Capture du canevas impossible (aucune image produite).');

  if ((options.telecharger ?? typeof document !== 'undefined') && typeof document !== 'undefined') {
    for (const f of fichiers) {
      const a = document.createElement('a');
      a.href = f.dataUrl;
      a.download = f.nom;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  return { ok: true, fichiers };
}

/**
 * Fenêtre d'impression du navigateur, sur le MÊME rendu que le PDF (donc texte
 * sélectionnable en mode vectoriel).
 *
 * Si le navigateur bloque la fenêtre, on ne fait pas semblant : `ok:false` +
 * l'URL du blob, pour que l'appelant propose un lien ou un téléchargement.
 *
 * @param {*} stageOuObjets
 * @param {object} [options] mêmes options que `exporterPdf`
 * @returns {Promise<{ ok:boolean, raison?:string, url?:string, pages:number,
 *   avertissements:string[] }>}
 */
export async function exporterImpression(stageOuObjets, options = {}) {
  const resultat = await construirePdf(stageOuObjets, options);
  try { resultat.doc.autoPrint(); } catch { /* autoPrint facultatif */ }

  if (typeof window === 'undefined') {
    return {
      ok: false,
      raison: 'hors_navigateur',
      pages: resultat.pages,
      images: resultat.images,
      avertissements: resultat.avertissements,
    };
  }

  const url = resultat.doc.output('bloburl');
  const fenetre = window.open(typeof url === 'string' ? url : url?.toString(), '_blank');
  if (!fenetre) {
    return {
      ok: false,
      raison: 'popup_bloquee',
      url: typeof url === 'string' ? url : url?.toString(),
      pages: resultat.pages,
      images: resultat.images,
      avertissements: resultat.avertissements,
    };
  }
  return { ok: true, pages: resultat.pages, images: resultat.images, avertissements: resultat.avertissements };
}
