/**
 * documentTables — tableaux et tableaux chiffrés (devis / facture) du mode Document.
 *
 * ⛔ CONTRAINTE MOTEUR : le rendu Konva ne connaît qu'un jeu FINI de types
 * (`text`, `rect`, `line`, `table`, …). Le type natif `table` impose des colonnes
 * de largeur ÉGALE (`W / cols` dans KonvaBoardObject) : inutilisable pour un devis
 * où « Désignation » doit être quatre fois plus large que « Qté ». Un tableau est
 * donc ici un GROUPE d'objets primitifs (`rect` de fond, `line` de filet, `text`
 * de cellule) posés sur une grille, chaque objet portant son `meta` de repérage.
 *
 * ⛔ Aucune fonction ne mute les objets reçus : elles rendent des PATCHES
 * ({ ajouts, patches, suppressions }) que l'appelant applique au store.
 *
 * ⛔ Aucun prix ni libellé métier en dur : le contenu vient de l'utilisateur.
 * Seuls les taux de TVA légaux, paramétrables, sont pré-remplis.
 *
 * Aucun appel réseau, aucun import React : ce module est testable sous `node --test`.
 */
import { DOC_PAGE, DOC_INK, DOC_INK_SOFT } from './documentBlockLayout.js';

/* ═══════════════════════════════════════════════════════════════════
   Devises et taux
═══════════════════════════════════════════════════════════════════ */

/**
 * ⛔ `decimales` n'est pas cosmétique : le franc CFA n'a pas de subdivision en
 * circulation, arrondir ses lignes à 2 décimales fabrique des centimes qui
 * n'existent pas et fait diverger le total affiché du total encaissé.
 */
export const DEVISES = {
  EUR: { code: 'EUR', symbole: '€', position: 'apres', decimales: 2 },
  USD: { code: 'USD', symbole: '$', position: 'avant', decimales: 2 },
  XAF: { code: 'XAF', symbole: 'FCFA', position: 'apres', decimales: 0 },
  XOF: { code: 'XOF', symbole: 'FCFA', position: 'apres', decimales: 0 },
  MAD: { code: 'MAD', symbole: 'DH', position: 'apres', decimales: 2 },
  CHF: { code: 'CHF', symbole: 'CHF', position: 'apres', decimales: 2 },
};

/** Taux légaux proposés au choix — modifiables par l'utilisateur. */
export const TAUX_TVA_COURANTS = [
  { taux: 20, libelle: 'France — taux normal' },
  { taux: 10, libelle: 'France — taux intermédiaire' },
  { taux: 5.5, libelle: 'France — taux réduit' },
  { taux: 2.1, libelle: 'France — taux particulier' },
  { taux: 18, libelle: 'CEMAC / UEMOA — taux normal' },
  { taux: 0, libelle: 'Exonéré / non assujetti' },
];

export const TAUX_TVA_DEFAUT = 20;
export const DEVISE_DEFAUT = 'EUR';

/** Espace insécable : sépare les milliers et le symbole sans jamais couper le montant. */
const NBSP = '\u00A0';

export function infosDevise(devise) {
  if (devise && typeof devise === 'object' && devise.code) return devise;
  return DEVISES[String(devise ?? '').toUpperCase()] ?? DEVISES[DEVISE_DEFAUT];
}

/* ═══════════════════════════════════════════════════════════════════
   Arithmétique comptable
═══════════════════════════════════════════════════════════════════ */

/**
 * Arrondi comptable (demi vers le haut) sur `decimales`.
 * ⛔ PIÈGE flottant : `Math.round(1.005 * 100)` rend 100 (donc 1,00) parce que
 * 1.005 vaut 1.00499999… en binaire. Le passage par `toFixed(10)` avant la
 * notation exponentielle recale la valeur et rend bien 1,01.
 * @param {number} valeur @param {number} [decimales]
 * @returns {number}
 */
export function arrondiComptable(valeur, decimales = 2) {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return 0;
  const d = Number.isFinite(decimales) ? Math.max(0, Math.min(6, Math.trunc(decimales))) : 2;
  const signe = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const recale = Number(`${abs.toFixed(10)}e${d}`);
  return (signe * Math.round(recale)) / 10 ** d;
}

/**
 * Lit un nombre saisi à la main : « 1 234,56 € », « 1.234,56 », « 12.5 », « 3 ».
 * ⛔ AMBIGUÏTÉ assumée : un point unique suivi d'exactement 3 chiffres en fin de
 * chaîne est traité comme séparateur de milliers (« 1.234 » = 1234), sinon comme
 * séparateur décimal (« 12.5 » = 12,5). Quand les deux séparateurs sont présents,
 * le DERNIER rencontré est le séparateur décimal.
 * @param {string|number} brut
 * @returns {number} 0 si illisible
 */
export function parseNombre(brut) {
  if (typeof brut === 'number') return Number.isFinite(brut) ? brut : 0;
  let s = String(brut ?? '').trim();
  if (!s) return 0;
  s = s.replace(/\s/g, '');
  s = s.replace(/[^0-9.,\-]/g, '');
  if (!s || !/[0-9]/.test(s)) return 0;

  const negatif = s.startsWith('-');
  s = s.replace(/-/g, '');

  const dernierPoint = s.lastIndexOf('.');
  const derniereVirgule = s.lastIndexOf(',');
  let decimal = '';
  if (dernierPoint >= 0 && derniereVirgule >= 0) {
    decimal = dernierPoint > derniereVirgule ? '.' : ',';
  } else if (derniereVirgule >= 0) {
    decimal = ',';
  } else if (dernierPoint >= 0) {
    const apres = s.length - dernierPoint - 1;
    const avant = dernierPoint;
    decimal = apres === 3 && avant >= 1 && s.indexOf('.') === dernierPoint ? '' : '.';
  }

  let normalise;
  if (!decimal) {
    normalise = s.replace(/[.,]/g, '');
  } else {
    const autre = decimal === ',' ? '.' : ',';
    normalise = s.split(autre).join('');
    const i = normalise.lastIndexOf(decimal);
    normalise = `${normalise.slice(0, i).split(decimal).join('')}.${normalise.slice(i + 1)}`;
  }

  const n = Number(normalise);
  if (!Number.isFinite(n)) return 0;
  return negatif ? -n : n;
}

/**
 * Montant formaté à la française : « 1 234,56 € ».
 * @param {number|string} valeur @param {string} [devise]
 */
export function formaterMontant(valeur, devise = DEVISE_DEFAUT) {
  const d = infosDevise(devise);
  const n = arrondiComptable(parseNombre(valeur), d.decimales);
  const negatif = n < 0;
  const [entier, dec] = Math.abs(n).toFixed(d.decimales).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const corps = dec ? `${groupe},${dec}` : groupe;
  const signe = negatif ? '-' : '';
  return d.position === 'avant'
    ? `${signe}${d.symbole}${NBSP}${corps}`
    : `${signe}${corps}${NBSP}${d.symbole}`;
}

/** Quantité lisible : entier sans décimale, décimale sans zéros inutiles. */
export function formaterQuantite(valeur) {
  const n = parseNombre(valeur);
  if (!n) return String(valeur ?? '').trim() ? String(valeur).trim() : '';
  const s = arrondiComptable(n, 3).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}

/** Taux formaté : « 20 % », « 5,5 % ». */
export function formaterTaux(taux) {
  const n = parseNombre(taux);
  const s = arrondiComptable(n, 2).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${s.replace('.', ',')}${NBSP}%`;
}

/* ═══════════════════════════════════════════════════════════════════
   Style et géométrie
═══════════════════════════════════════════════════════════════════ */

export const STYLE_TABLEAU_DEFAUT = {
  police: 'Georgia, serif',
  taille: 11,
  tailleEntete: 10,
  encre: DOC_INK,
  encreEntete: DOC_INK_SOFT,
  fondEntete: 'rgba(241,245,249,0.85)',
  fondZebre: 'rgba(241,245,249,0.45)',
  zebre: true,
  filet: '#cbd5e1',
  filetEpaisseur: 0.75,
  filetEntete: '#94a3b8',
  filetsVerticaux: false,
  cadre: '#e2e8f0',
  hauteurEntete: 30,
  hauteurLigne: 26,
  paddingX: 8,
};

let _seq = 0;
function uid(prefixe) {
  _seq += 1;
  return `${prefixe}_${Date.now().toString(36)}${_seq.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Couches : fonds sous les filets, filets sous le texte (sinon l'encre est barrée). */
const COUCHE_FOND = 0;
const COUCHE_FILET = 1;
const COUCHE_TEXTE = 2;

function mkTexte({ x, y, width, height, text, style = {}, meta, couche = COUCHE_TEXTE }) {
  return {
    id: uid('tcell'),
    type: 'text',
    x, y, width, height,
    rotation: 0,
    layer: couche,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    opacity: 1,
    content: { text: String(text ?? '') },
    style: {
      fontFamily: STYLE_TABLEAU_DEFAUT.police,
      fontSize: STYLE_TABLEAU_DEFAUT.taille,
      fontWeight: 400,
      fontStyle: 'normal',
      fill: DOC_INK,
      align: 'left',
      lineHeight: 1.25,
      letterSpacing: 0,
      ...style,
    },
    meta,
  };
}

function mkFond({ x, y, width, height, fill, stroke, meta }) {
  return {
    id: uid('tfond'),
    type: 'rect',
    x, y, width, height,
    rotation: 0,
    layer: COUCHE_FOND,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    opacity: 1,
    content: {},
    // `stroke: undefined` disparaît à la sérialisation JSON du projet : la clé
    // n'est posée que si elle a une valeur, sinon un aller-retour cloud fait
    // diverger l'objet de lui-même.
    style: {
      fill: fill ?? 'transparent',
      ...(stroke ? { stroke, strokeWidth: 1 } : { strokeWidth: 0 }),
      cornerRadius: 0,
    },
    meta,
  };
}

function mkFilet({ x, y, longueur, vertical = false, stroke, strokeWidth, meta }) {
  const pts = vertical ? [0, 0, 0, longueur] : [0, 0, longueur, 0];
  return {
    id: uid('tfilet'),
    type: 'line',
    x,
    y,
    width: vertical ? 2 : longueur,
    height: vertical ? longueur : 2,
    rotation: 0,
    layer: COUCHE_FILET,
    visible: true,
    locked: false,
    step: 0,
    visibleFor: 'both',
    opacity: 1,
    content: { points: pts },
    style: {
      stroke: stroke ?? STYLE_TABLEAU_DEFAUT.filet,
      strokeWidth: strokeWidth ?? STYLE_TABLEAU_DEFAUT.filetEpaisseur,
      lineCap: 'butt',
    },
    meta,
  };
}

/** Le texte Konva n'a pas de centrage vertical : on le calcule à la pose. */
function yTexteCentre(yLigne, hauteur, taille) {
  return yLigne + Math.max(2, (hauteur - taille * 1.25) / 2);
}

/**
 * Normalise la description des colonnes.
 * `largeur` ≤ 1 = ratio de la largeur totale ; > 1 = pixels ; absent = part égale.
 */
function normaliserColonnes(colonnes, largeurTotale) {
  const brut = Array.isArray(colonnes) && colonnes.length ? colonnes : ['Colonne A', 'Colonne B'];
  const liste = brut.map((c, i) =>
    typeof c === 'string'
      ? { cle: `c${i}`, titre: c, largeur: null, align: i === 0 ? 'left' : 'right' }
      : {
          cle: c?.cle ?? `c${i}`,
          titre: c?.titre ?? '',
          largeur: Number.isFinite(Number(c?.largeur)) ? Number(c.largeur) : null,
          align: c?.align ?? (i === 0 ? 'left' : 'right'),
        },
  );

  const definies = liste.filter((c) => c.largeur != null);
  const ratios = definies.length > 0 && definies.every((c) => c.largeur <= 1);
  const restantes = liste.filter((c) => c.largeur == null);
  let consommee = 0;
  for (const c of definies) {
    c.px = ratios ? c.largeur * largeurTotale : c.largeur;
    consommee += c.px;
  }
  const part = restantes.length ? Math.max(24, (largeurTotale - consommee) / restantes.length) : 0;
  for (const c of restantes) c.px = part;

  let x = 0;
  for (const c of liste) {
    c.x = x;
    x += c.px;
    delete c.largeur;
  }
  // Le cumul des arrondis ne doit pas dépasser la largeur utile : on recale la dernière.
  const derniere = liste[liste.length - 1];
  if (x > largeurTotale) derniere.px -= x - largeurTotale;
  return liste;
}

/* ═══════════════════════════════════════════════════════════════════
   Construction d'un tableau
═══════════════════════════════════════════════════════════════════ */

/**
 * Fabrique un tableau (groupe d'objets Konva alignés sur une grille).
 *
 * @param {object} p
 * @param {Array<string|{cle?:string,titre?:string,largeur?:number,align?:string}>} p.colonnes
 * @param {Array<Array<string>|Record<string,string>>} [p.lignes] contenu utilisateur
 * @param {number} [p.largeur] défaut : largeur utile de la page A4
 * @param {number} [p.x] @param {number} [p.y]
 * @param {object} [p.style] surcharge partielle de {@link STYLE_TABLEAU_DEFAUT}
 * @param {string} [p.tableId] pour rattacher plusieurs blocs au même tableau
 * @param {string} [p.variante] marqueur métier ('simple' | 'devis')
 * @returns {{ tableId: string, objects: object[], grille: object, hauteur: number }}
 *          `objects` est directement compatible `addObjects()` du store Konva.
 */
export function creerTableau({
  colonnes,
  lignes = [],
  largeur = DOC_PAGE.contentWidth,
  x = DOC_PAGE.marginX,
  y = DOC_PAGE.marginTop,
  style = {},
  tableId = null,
  variante = 'simple',
} = {}) {
  const st = { ...STYLE_TABLEAU_DEFAUT, ...style };
  const id = tableId || uid('tbl');
  const cols = normaliserColonnes(colonnes, largeur);
  const donnees = normaliserLignes(lignes, cols);

  const grille = {
    x, y, largeur,
    hauteurEntete: st.hauteurEntete,
    hauteurLigne: st.hauteurLigne,
    colonnes: cols.map((c) => ({ cle: c.cle, titre: c.titre, x: c.x, px: c.px, align: c.align })),
    variante,
    style: st,
  };

  const hauteurCorps = donnees.length * st.hauteurLigne;
  const hauteur = st.hauteurEntete + hauteurCorps;
  const objects = [];

  // Cadre : porte la grille du tableau (source de vérité pour ajouterLigne / supprimerLigne).
  objects.push(
    mkFond({
      x, y, width: largeur, height: hauteur,
      fill: 'transparent',
      stroke: st.cadre || undefined,
      meta: { doc: 'tableau', tableId: id, role: 'cadre', variante, grille },
    }),
  );

  // En-tête
  objects.push(
    mkFond({
      x, y, width: largeur, height: st.hauteurEntete,
      fill: st.fondEntete,
      meta: { doc: 'tableau', tableId: id, role: 'fond-entete' },
    }),
  );
  for (const c of cols) {
    objects.push(
      mkTexte({
        x: x + c.x + st.paddingX,
        y: yTexteCentre(y, st.hauteurEntete, st.tailleEntete),
        width: Math.max(10, c.px - st.paddingX * 2),
        height: st.tailleEntete * 1.4,
        text: c.titre,
        style: {
          fontSize: st.tailleEntete,
          fontWeight: 700,
          fill: st.encreEntete,
          align: c.align,
          letterSpacing: 0.5,
          fontFamily: st.police,
        },
        meta: { doc: 'tableau', tableId: id, role: 'entete-cellule', colonne: c.cle },
      }),
    );
  }
  objects.push(
    mkFilet({
      x, y: y + st.hauteurEntete, longueur: largeur,
      stroke: st.filetEntete, strokeWidth: Math.max(1, st.filetEpaisseur),
      meta: { doc: 'tableau', tableId: id, role: 'filet-entete' },
    }),
  );

  // Corps
  donnees.forEach((valeurs, i) => {
    objects.push(...objetsDeLigne({ id, i, valeurs, cols, grille: { ...grille, style: st } }));
  });

  // Filets verticaux (grille pleine) — optionnels : un devis se lit mieux sans.
  if (st.filetsVerticaux) {
    for (let i = 1; i < cols.length; i += 1) {
      objects.push(
        mkFilet({
          x: x + cols[i].x, y, longueur: hauteur, vertical: true,
          stroke: st.filet, strokeWidth: st.filetEpaisseur,
          meta: { doc: 'tableau', tableId: id, role: 'filet-v', colonne: cols[i].cle },
        }),
      );
    }
  }

  for (const o of objects) o.groupId = id;
  return { tableId: id, objects, grille, hauteur };
}

/** Convertit lignes-objet ou lignes-tableau en tableau de valeurs par colonne. */
function normaliserLignes(lignes, cols) {
  const src = Array.isArray(lignes) ? lignes : [];
  return src.map((l) => {
    if (Array.isArray(l)) return cols.map((c, i) => String(l[i] ?? ''));
    if (l && typeof l === 'object') return cols.map((c) => String(l[c.cle] ?? ''));
    return cols.map(() => '');
  });
}

/** Objets d'une ligne de corps (fond + cellules + filet bas). */
function objetsDeLigne({ id, i, valeurs, cols, grille, champs = null }) {
  const st = grille.style ?? STYLE_TABLEAU_DEFAUT;
  const yLigne = grille.y + grille.hauteurEntete + i * grille.hauteurLigne;
  const out = [];

  out.push(
    mkFond({
      x: grille.x, y: yLigne, width: grille.largeur, height: grille.hauteurLigne,
      fill: st.zebre && i % 2 === 1 ? st.fondZebre : 'transparent',
      meta: { doc: 'tableau', tableId: id, role: 'fond-ligne', ligne: i },
    }),
  );

  cols.forEach((c) => {
    out.push(
      mkTexte({
        x: grille.x + c.x + st.paddingX,
        y: yTexteCentre(yLigne, grille.hauteurLigne, st.taille),
        width: Math.max(10, c.px - st.paddingX * 2),
        height: st.taille * 1.4,
        text: valeurs[cols.indexOf(c)] ?? '',
        style: { fontSize: st.taille, fill: st.encre, align: c.align, fontFamily: st.police },
        meta: {
          doc: 'tableau', tableId: id, role: 'cellule', ligne: i, colonne: c.cle,
          ...(champs?.[c.cle] ? champs[c.cle] : {}),
        },
      }),
    );
  });

  out.push(
    mkFilet({
      x: grille.x, y: yLigne + grille.hauteurLigne, longueur: grille.largeur,
      stroke: st.filet, strokeWidth: st.filetEpaisseur,
      meta: { doc: 'tableau', tableId: id, role: 'filet-ligne', ligne: i },
    }),
  );

  for (const o of out) o.groupId = id;
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   Tableau chiffré : devis / facture
═══════════════════════════════════════════════════════════════════ */

export const COLONNES_DEVIS = [
  { cle: 'designation', titre: 'Désignation', largeur: 0.52, align: 'left' },
  { cle: 'quantite', titre: 'Qté', largeur: 0.1, align: 'right' },
  { cle: 'prixUnitaire', titre: 'P.U. HT', largeur: 0.19, align: 'right' },
  { cle: 'totalLigne', titre: 'Total HT', largeur: 0.19, align: 'right' },
];

/**
 * Tableau chiffré complet : lignes + bloc Total HT / TVA / Total TTC.
 *
 * @param {object} p
 * @param {Array<{designation?:string,quantite?:number|string,prixUnitaire?:number|string}>} [p.lignes]
 * @param {number} [p.tauxTva] défaut {@link TAUX_TVA_DEFAUT} (paramétrable)
 * @param {string} [p.devise] défaut EUR
 * @param {number} [p.x] @param {number} [p.y] @param {number} [p.largeur]
 * @param {object} [p.style]
 * @param {number} [p.lignesVides] nombre de lignes vierges si `lignes` est absent
 * @returns {{ tableId: string, objects: object[], grille: object, hauteur: number, totaux: object }}
 */
export function creerTableauDevis({
  lignes = [],
  tauxTva = TAUX_TVA_DEFAUT,
  devise = DEVISE_DEFAUT,
  x = DOC_PAGE.marginX,
  y = DOC_PAGE.marginTop,
  largeur = DOC_PAGE.contentWidth,
  style = {},
  lignesVides = 3,
} = {}) {
  const d = infosDevise(devise);
  const taux = parseNombre(tauxTva);
  const st = { ...STYLE_TABLEAU_DEFAUT, ...style };

  const source = Array.isArray(lignes) && lignes.length
    ? lignes
    : Array.from({ length: Math.max(1, lignesVides) }, () => ({}));

  const valeurs = source.map((l) => {
    const q = l?.quantite === undefined || l?.quantite === null || l?.quantite === '' ? '' : parseNombre(l.quantite);
    const pu = l?.prixUnitaire === undefined || l?.prixUnitaire === null || l?.prixUnitaire === '' ? '' : parseNombre(l.prixUnitaire);
    const total = q === '' || pu === '' ? '' : arrondiComptable(q * pu, d.decimales);
    return {
      designation: String(l?.designation ?? ''),
      quantite: q === '' ? '' : formaterQuantite(q),
      prixUnitaire: pu === '' ? '' : formaterMontant(pu, d.code),
      totalLigne: total === '' ? '' : formaterMontant(total, d.code),
    };
  });

  const base = creerTableau({
    colonnes: COLONNES_DEVIS,
    lignes: valeurs,
    largeur, x, y, style: st,
    variante: 'devis',
  });

  // Marquage métier des cellules : c'est lui qui rend `recalculerTotaux` possible.
  const cles = { designation: 'designation', quantite: 'quantite', prixUnitaire: 'prixUnitaire', totalLigne: 'totalLigne' };
  for (const o of base.objects) {
    if (o.meta?.role === 'cellule' && cles[o.meta.colonne]) {
      o.meta.champ = o.meta.colonne;
      o.meta.devise = d.code;
      if (o.meta.colonne === 'totalLigne') o.meta.calcule = true;
    }
  }

  const totaux = objetsTotaux({
    tableId: base.tableId,
    grille: base.grille,
    nbLignes: valeurs.length,
    taux,
    devise: d.code,
    st,
  });

  const objects = [...base.objects, ...totaux.objects];
  const cadre = objects.find((o) => o.meta?.role === 'cadre');
  if (cadre) cadre.meta.grille.totaux = { hauteur: totaux.hauteur, taux, devise: d.code };

  const res = recalculerTotaux(objects, base.tableId);
  const parId = new Map(res.patches.map((p) => [p.id, p.patch]));
  const finaux = objects.map((o) => (parId.has(o.id) ? fusionProfonde(o, parId.get(o.id)) : o));

  return {
    tableId: base.tableId,
    objects: finaux,
    grille: base.grille,
    hauteur: base.hauteur + totaux.hauteur,
    totaux: res.totaux,
  };
}

const LIGNES_TOTAUX = [
  { champ: 'totalHT', libelle: 'Total HT' },
  { champ: 'tva', libelle: null },      // libellé calculé : « TVA (20 %) »
  { champ: 'totalTTC', libelle: 'Total TTC', fort: true },
];

/** Bloc de totaux aligné à droite, sous le corps du tableau. */
function objetsTotaux({ tableId, grille, nbLignes, taux, devise, st }) {
  const yBase = grille.y + grille.hauteurEntete + nbLignes * grille.hauteurLigne;
  const cols = grille.colonnes;
  const colValeur = cols[cols.length - 1];
  const colLibelle = cols[cols.length - 2] ?? colValeur;
  const hLigne = grille.hauteurLigne;
  const objects = [];

  LIGNES_TOTAUX.forEach((t, i) => {
    const yL = yBase + 10 + i * hLigne;
    const fort = Boolean(t.fort);
    if (fort) {
      objects.push(
        mkFond({
          x: grille.x + colLibelle.x, y: yL,
          width: colLibelle.px + colValeur.px, height: hLigne,
          fill: st.fondEntete,
          meta: { doc: 'tableau', tableId, role: 'fond-total', champ: t.champ },
        }),
      );
    }
    objects.push(
      mkTexte({
        x: grille.x + colLibelle.x + st.paddingX,
        y: yTexteCentre(yL, hLigne, st.taille),
        width: Math.max(10, colLibelle.px - st.paddingX * 2),
        height: st.taille * 1.4,
        text: t.libelle ?? `TVA (${formaterTaux(taux)})`,
        style: {
          fontSize: st.taille,
          fontWeight: fort ? 700 : 600,
          fill: fort ? st.encre : st.encreEntete,
          align: 'right',
          fontFamily: st.police,
        },
        meta: {
          doc: 'tableau', tableId, role: 'total-libelle', champ: t.champ,
          ...(t.champ === 'tva' ? { taux, devise } : {}),
        },
      }),
    );
    objects.push(
      mkTexte({
        x: grille.x + colValeur.x + st.paddingX,
        y: yTexteCentre(yL, hLigne, st.taille),
        width: Math.max(10, colValeur.px - st.paddingX * 2),
        height: st.taille * 1.4,
        text: formaterMontant(0, devise),
        style: {
          fontSize: fort ? st.taille + 1 : st.taille,
          fontWeight: fort ? 800 : 600,
          fill: st.encre,
          align: 'right',
          fontFamily: st.police,
        },
        meta: { doc: 'tableau', tableId, role: 'total-valeur', champ: t.champ, devise, calcule: true },
      }),
    );
  });

  for (const o of objects) o.groupId = tableId;
  return { objects, hauteur: 10 + LIGNES_TOTAUX.length * hLigne };
}

/* ═══════════════════════════════════════════════════════════════════
   Lecture / recalcul
═══════════════════════════════════════════════════════════════════ */

const estTableau = (o) => o?.meta?.doc === 'tableau';

/** Objets appartenant à un tableau donné (ou au premier tableau trouvé). */
export function objetsDuTableau(objets, tableId = null) {
  const liste = Array.isArray(objets) ? objets.filter(estTableau) : [];
  const cible = tableId || liste.find((o) => o.meta.role === 'cadre')?.meta.tableId || liste[0]?.meta.tableId || null;
  return { tableId: cible, objets: liste.filter((o) => o.meta.tableId === cible) };
}

/** Grille portée par le cadre — source de vérité de la géométrie. */
export function lireGrille(objets, tableId = null) {
  const { objets: liste } = objetsDuTableau(objets, tableId);
  return liste.find((o) => o.meta.role === 'cadre')?.meta?.grille ?? null;
}

/** Nombre de lignes de corps réellement présentes. */
export function compterLignes(objets, tableId = null) {
  const { objets: liste } = objetsDuTableau(objets, tableId);
  const idx = liste.filter((o) => o.meta.role === 'fond-ligne').map((o) => o.meta.ligne);
  return idx.length ? Math.max(...idx) + 1 : 0;
}

/**
 * Taux de TVA effectif : le libellé saisi sur le canevas prime sur `meta.taux`,
 * sinon un utilisateur qui corrige « TVA (20 %) » en « TVA (18 %) » verrait son
 * document mentir sur son propre calcul.
 */
function lireTaux(labelTva) {
  const txt = String(labelTva?.content?.text ?? '');
  const m = txt.match(/(-?[\d\s .,]+)\s*%/);
  if (m) return parseNombre(m[1]);
  const meta = Number(labelTva?.meta?.taux);
  return Number.isFinite(meta) ? meta : TAUX_TVA_DEFAUT;
}

/**
 * Recalcule les totaux d'un tableau chiffré. NE MUTE RIEN.
 *
 * Règle comptable appliquée : chaque total de ligne est arrondi d'abord, puis le
 * Total HT est la somme des lignes DÉJÀ arrondies (et non l'arrondi de la somme
 * brute) — un centime d'écart sur un devis est un défaut réel.
 *
 * ⛔ Les calculs partent des valeurs AFFICHÉES dans les cellules, pas d'un modèle
 * caché : un devis doit être vérifiable à l'œil par son destinataire. Corollaire
 * assumé : une quantité ou un prix unitaire est arrondi à la saisie.
 *
 * @param {object[]} objetsTableau objets de la scène (le tableau est filtré)
 * @param {string} [tableId]
 * @returns {{ patches: {id:string,patch:object}[], totaux: object }}
 */
export function recalculerTotaux(objetsTableau, tableId = null) {
  const { tableId: cible, objets } = objetsDuTableau(objetsTableau, tableId);
  const vide = {
    patches: [],
    totaux: { tableId: cible, lignes: [], totalHT: 0, tauxTva: 0, tva: 0, totalTTC: 0, devise: DEVISE_DEFAUT },
  };
  if (!cible || !objets.length) return vide;

  const cellules = objets.filter((o) => o.meta.role === 'cellule');
  const devise = infosDevise(
    cellules.find((o) => o.meta.devise)?.meta.devise
      ?? objets.find((o) => o.meta.devise)?.meta.devise
      ?? DEVISE_DEFAUT,
  );
  const dec = devise.decimales;

  const parLigne = new Map();
  for (const c of cellules) {
    if (!c.meta.champ) continue;
    const i = c.meta.ligne;
    if (!parLigne.has(i)) parLigne.set(i, {});
    parLigne.get(i)[c.meta.champ] = c;
  }
  if (!parLigne.size) return vide;

  const patches = [];
  const lignes = [];
  let totalHT = 0;

  for (const i of [...parLigne.keys()].sort((a, b) => a - b)) {
    const ch = parLigne.get(i);
    if (!ch.quantite || !ch.prixUnitaire) continue;
    // Ligne vierge : elle reste VIDE. Afficher « 0,00 € » sur les lignes non
    // remplies d'un devis fait croire à un article offert.
    const brutQ = String(ch.quantite.content?.text ?? '').trim();
    const brutPu = String(ch.prixUnitaire.content?.text ?? '').trim();
    if (!brutQ && !brutPu) {
      if (ch.totalLigne && String(ch.totalLigne.content?.text ?? '') !== '') {
        patches.push({ id: ch.totalLigne.id, patch: { content: { text: '' } } });
      }
      continue;
    }
    const q = parNombreCellule(ch.quantite);
    const pu = parNombreCellule(ch.prixUnitaire);
    const total = arrondiComptable(q * pu, dec);
    totalHT += total;
    lignes.push({ ligne: i, quantite: q, prixUnitaire: pu, total });
    if (ch.totalLigne) {
      const attendu = formaterMontant(total, devise.code);
      if (String(ch.totalLigne.content?.text ?? '') !== attendu) {
        patches.push({ id: ch.totalLigne.id, patch: { content: { text: attendu } } });
      }
    }
  }
  // Somme des lignes déjà arrondies : le second arrondi ne fait que purger la
  // dérive binaire de l'addition (0,1 + 0,2), il ne change aucun centime.
  totalHT = arrondiComptable(totalHT, dec);

  const labelTva = objets.find((o) => o.meta.role === 'total-libelle' && o.meta.champ === 'tva');
  const taux = labelTva ? lireTaux(labelTva) : TAUX_TVA_DEFAUT;
  const tva = arrondiComptable((totalHT * taux) / 100, dec);
  const totalTTC = arrondiComptable(totalHT + tva, dec);

  if (labelTva && Number(labelTva.meta?.taux) !== taux) {
    patches.push({ id: labelTva.id, patch: { meta: { taux } } });
  }

  const valeurs = { totalHT, tva, totalTTC };
  for (const o of objets) {
    if (o.meta.role !== 'total-valeur') continue;
    const v = valeurs[o.meta.champ];
    if (v === undefined) continue;
    const attendu = formaterMontant(v, devise.code);
    if (String(o.content?.text ?? '') !== attendu) {
      patches.push({ id: o.id, patch: { content: { text: attendu } } });
    }
  }

  return {
    patches,
    totaux: { tableId: cible, lignes, totalHT, tauxTva: taux, tva, totalTTC, devise: devise.code },
  };
}

function parNombreCellule(cellule) {
  return parseNombre(cellule?.content?.text ?? '');
}

/* ═══════════════════════════════════════════════════════════════════
   Observation des SOURCES — socle du recalcul automatique
═══════════════════════════════════════════════════════════════════ */

/** Champs qui ALIMENTENT le calcul. Tout le reste est une conséquence. */
export const CHAMPS_SOURCES = ['quantite', 'prixUnitaire'];

/** Cellules écrites par `recalculerTotaux` — jamais des sources. */
const estCelluleCalculee = (o) =>
  o?.meta?.role === 'total-valeur' || (o?.meta?.role === 'cellule' && o?.meta?.champ === 'totalLigne');

/** Identifiants des tableaux CHIFFRÉS (ceux qui portent un bloc de totaux). */
export function tableauxChiffres(objets) {
  const vus = [];
  for (const o of Array.isArray(objets) ? objets : []) {
    if (!estTableau(o) || o.meta.role !== 'total-valeur') continue;
    if (o.meta.tableId && !vus.includes(o.meta.tableId)) vus.push(o.meta.tableId);
  }
  return vus;
}

/**
 * Empreinte des seules cellules SOURCES d'un tableau chiffré.
 *
 * ⛔ C'est le garde-fou anti-boucle du recalcul automatique : l'empreinte ignore
 * délibérément les cellules que le recalcul ÉCRIT (total de ligne, Total HT, TVA,
 * Total TTC). Sans cette exclusion, chaque recalcul modifierait l'empreinte et
 * déclencherait le suivant — boucle infinie sur le document de l'utilisateur.
 *
 * @param {object[]} objets scène complète
 * @param {string} [tableId]
 * @returns {string} '' si le tableau n'existe pas / n'est pas chiffré
 */
export function signatureSources(objets, tableId = null) {
  const { tableId: cible, objets: liste } = objetsDuTableau(objets, tableId);
  if (!cible) return '';
  const morceaux = [];
  for (const o of liste) {
    if (estCelluleCalculee(o)) continue;
    const r = o.meta.role;
    if (r === 'cellule' && CHAMPS_SOURCES.includes(o.meta.champ)) {
      morceaux.push(`${o.id}|${o.meta.ligne}|${o.meta.champ}|${String(o.content?.text ?? '')}|${o.meta.devise ?? ''}`);
    } else if (r === 'total-libelle' && o.meta.champ === 'tva') {
      // Le taux se lit sur le libellé affiché : le corriger à la main est une saisie.
      morceaux.push(`tva|${String(o.content?.text ?? '')}`);
    } else if (r === 'fond-ligne') {
      // Ajout / suppression de ligne : le nombre de lignes fait partie des sources.
      morceaux.push(`ligne|${o.meta.ligne}`);
    }
  }
  return morceaux.sort().join('\n');
}

/**
 * Recalcule TOUS les tableaux chiffrés d'une scène. NE MUTE RIEN.
 * @param {object[]} objets
 * @returns {{ patches: {id:string,patch:object}[], tableaux: {tableId:string, totaux:object}[] }}
 */
export function recalculerTousTotaux(objets) {
  let patches = [];
  const tableaux = [];
  for (const tableId of tableauxChiffres(objets)) {
    const res = recalculerTotaux(objets, tableId);
    patches = fusionnerPatches(patches, res.patches);
    tableaux.push({ tableId, totaux: res.totaux });
  }
  return { patches, tableaux };
}

/**
 * Change le taux de TVA (libellé + meta) et recalcule. NE MUTE RIEN.
 * @returns {{ ajouts: object[], patches: {id:string,patch:object}[], suppressions: string[], totaux: object }}
 */
export function changerTauxTva(objetsTableau, taux, tableId = null) {
  const { tableId: cible, objets } = objetsDuTableau(objetsTableau, tableId);
  const label = objets.find((o) => o.meta.role === 'total-libelle' && o.meta.champ === 'tva');
  if (!label) return { ajouts: [], patches: [], suppressions: [], totaux: recalculerTotaux(objets, cible).totaux };
  const t = parseNombre(taux);
  const patches = [{ id: label.id, patch: { meta: { taux: t }, content: { text: `TVA (${formaterTaux(t)})` } } }];
  const projete = projeter(objets, { patches });
  const rec = recalculerTotaux(projete, cible);
  return { ajouts: [], patches: fusionnerPatches(patches, rec.patches), suppressions: [], totaux: rec.totaux };
}

/* ═══════════════════════════════════════════════════════════════════
   Ajout / suppression de ligne
═══════════════════════════════════════════════════════════════════ */

/**
 * Insère une ligne. NE MUTE RIEN : rend les objets à ajouter, les patches de
 * décalage (lignes suivantes, filets, cadre, bloc de totaux) et les totaux à jour.
 *
 * @param {object[]} objetsTableau
 * @param {{ index?: number, valeurs?: Record<string,string>|string[], tableId?: string }} [opts]
 * @returns {{ ajouts: object[], patches: {id:string,patch:object}[], suppressions: string[], totaux: object }}
 */
export function ajouterLigne(objetsTableau, opts = {}) {
  const { tableId: cible, objets } = objetsDuTableau(objetsTableau, opts.tableId ?? null);
  const grille = lireGrille(objets, cible);
  const nul = { ajouts: [], patches: [], suppressions: [], totaux: null };
  if (!cible || !grille) return nul;

  const nb = compterLignes(objets, cible);
  const index = Number.isFinite(opts.index) ? Math.max(0, Math.min(nb, Math.trunc(opts.index))) : nb;
  const h = grille.hauteurLigne;
  const st = grille.style ?? STYLE_TABLEAU_DEFAUT;
  const cols = grille.colonnes.map((c) => ({ ...c }));

  const patches = [];
  // Renumérotation + descente des lignes situées après le point d'insertion.
  for (const o of objets) {
    const li = o.meta.ligne;
    if (Number.isFinite(li) && li >= index) {
      patches.push({ id: o.id, patch: { y: o.y + h, meta: { ligne: li + 1 } } });
    }
  }
  // Le bloc de totaux, les filets verticaux et le cadre suivent la hauteur.
  for (const o of objets) {
    if (['total-libelle', 'total-valeur', 'fond-total'].includes(o.meta.role)) {
      patches.push({ id: o.id, patch: { y: o.y + h } });
    } else if (o.meta.role === 'filet-v') {
      patches.push({
        id: o.id,
        patch: { height: o.height + h, content: { points: [0, 0, 0, (o.content?.points?.[3] ?? o.height) + h] } },
      });
    } else if (o.meta.role === 'cadre') {
      patches.push({ id: o.id, patch: { height: o.height + h } });
    }
  }

  const valeursSaisies = opts.valeurs ?? {};
  const valeurs = Array.isArray(valeursSaisies)
    ? cols.map((c, i) => String(valeursSaisies[i] ?? ''))
    : cols.map((c) => String(valeursSaisies[c.cle] ?? ''));

  const champs = {};
  if (grille.variante === 'devis') {
    const devise = objets.find((o) => o.meta.devise)?.meta.devise ?? DEVISE_DEFAUT;
    for (const c of cols) {
      champs[c.cle] = { champ: c.cle, devise, ...(c.cle === 'totalLigne' ? { calcule: true } : {}) };
    }
  }

  const ajouts = objetsDeLigne({ id: cible, i: index, valeurs, cols, grille, champs });

  // La zébrure dépend de la parité : après insertion, elle s'inverse en aval.
  if (st.zebre) {
    const projeteFonds = projeter(objets, { patches }).filter(
      (o) => o.meta?.tableId === cible && o.meta.role === 'fond-ligne',
    );
    for (const f of projeteFonds) {
      const attendu = f.meta.ligne % 2 === 1 ? st.fondZebre : 'transparent';
      if (f.style?.fill !== attendu) patches.push({ id: f.id, patch: { style: { fill: attendu } } });
    }
  }

  const projete = projeter(objets, { patches, ajouts });
  const rec = recalculerTotaux(projete, cible);
  return {
    ajouts,
    patches: fusionnerPatches(patches, rec.patches),
    suppressions: [],
    totaux: rec.totaux,
  };
}

/**
 * Supprime une ligne. NE MUTE RIEN.
 * @param {object[]} objetsTableau @param {number} index @param {string} [tableId]
 * @returns {{ ajouts: object[], patches: {id:string,patch:object}[], suppressions: string[], totaux: object }}
 */
export function supprimerLigne(objetsTableau, index, tableId = null) {
  const { tableId: cible, objets } = objetsDuTableau(objetsTableau, tableId);
  const grille = lireGrille(objets, cible);
  const nul = { ajouts: [], patches: [], suppressions: [], totaux: null };
  if (!cible || !grille) return nul;

  const nb = compterLignes(objets, cible);
  const i = Math.trunc(Number(index));
  if (!Number.isFinite(i) || i < 0 || i >= nb) return nul;

  const h = grille.hauteurLigne;
  const st = grille.style ?? STYLE_TABLEAU_DEFAUT;

  const suppressions = objets.filter((o) => o.meta.ligne === i).map((o) => o.id);
  const patches = [];
  for (const o of objets) {
    const li = o.meta.ligne;
    if (Number.isFinite(li) && li > i) {
      patches.push({ id: o.id, patch: { y: o.y - h, meta: { ligne: li - 1 } } });
    }
  }
  for (const o of objets) {
    if (['total-libelle', 'total-valeur', 'fond-total'].includes(o.meta.role)) {
      patches.push({ id: o.id, patch: { y: o.y - h } });
    } else if (o.meta.role === 'filet-v') {
      patches.push({
        id: o.id,
        patch: { height: o.height - h, content: { points: [0, 0, 0, (o.content?.points?.[3] ?? o.height) - h] } },
      });
    } else if (o.meta.role === 'cadre') {
      patches.push({ id: o.id, patch: { height: o.height - h } });
    }
  }

  if (st.zebre) {
    const projeteFonds = projeter(objets, { patches, suppressions }).filter(
      (o) => o.meta?.tableId === cible && o.meta.role === 'fond-ligne',
    );
    for (const f of projeteFonds) {
      const attendu = f.meta.ligne % 2 === 1 ? st.fondZebre : 'transparent';
      if (f.style?.fill !== attendu) patches.push({ id: f.id, patch: { style: { fill: attendu } } });
    }
  }

  const projete = projeter(objets, { patches, suppressions });
  const rec = recalculerTotaux(projete, cible);
  return {
    ajouts: [],
    patches: fusionnerPatches(patches, rec.patches),
    suppressions,
    totaux: rec.totaux,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Utilitaires de patch (purs)
═══════════════════════════════════════════════════════════════════ */

/** Fusion profonde non destructive (mêmes règles que `updateObject` du store). */
export function fusionProfonde(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? base : patch;
  const out = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = fusionProfonde(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Fusionne deux listes de patches par id (le second l'emporte champ à champ). */
export function fusionnerPatches(a = [], b = []) {
  const ordre = [];
  const parId = new Map();
  for (const p of [...a, ...b]) {
    if (!p?.id) continue;
    if (!parId.has(p.id)) {
      ordre.push(p.id);
      parId.set(p.id, { ...p.patch });
    } else {
      parId.set(p.id, fusionProfonde(parId.get(p.id), p.patch));
    }
  }
  return ordre.map((id) => ({ id, patch: parId.get(id) }));
}

/**
 * Applique un résultat de patch à une COPIE de la liste (aucune mutation).
 * Sert à calculer les totaux d'un état qui n'existe pas encore dans le store.
 * @param {object[]} objets
 * @param {{ ajouts?: object[], patches?: {id:string,patch:object}[], suppressions?: string[] }} res
 */
export function projeter(objets, res = {}) {
  const supp = new Set(res.suppressions ?? []);
  const parId = new Map((res.patches ?? []).map((p) => [p.id, p.patch]));
  // ⛔ Les patches s'appliquent AUSSI aux objets ajoutés (le recalcul des totaux
  // porte sur la ligne qui vient d'être créée) — les ignorer rendait la
  // projection incohérente avec ce que le store obtiendra réellement.
  return [...(objets ?? []), ...(res.ajouts ?? [])]
    .filter((o) => !supp.has(o.id))
    .map((o) => (parId.has(o.id) ? fusionProfonde(o, parId.get(o.id)) : o));
}
