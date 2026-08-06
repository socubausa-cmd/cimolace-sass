/**
 * documentIdentite — l'identité d'entreprise du créateur de document (papier à en-tête).
 *
 * BUT : qu'une entreprise règle UNE FOIS son logo, son en-tête, son pied et son bloc
 * de signature, et que tout document créé ensuite naisse déjà marqué, sans que
 * personne ne les repose à la main.
 *
 * ⛔ AUCUNE DONNÉE D'ENTREPRISE N'EST INVENTÉE ICI. {@link identiteVide} rend des
 * champs VIDES — pas d'adresse d'exemple, pas de SIRET, pas de téléphone, pas de logo.
 * Un gabarit pré-rempli de fausses coordonnées finit imprimé et envoyé : les seules
 * valeurs par défaut de ce fichier sont des GÉOMÉTRIES (hauteur de logo, écarts) et
 * des choix de mise en page (disposition, numérotation), jamais du contenu.
 *
 * ⛔ CE FICHIER N'ÉCRIT RIEN. Comme documentPagination, il rend des `{ ajouts, patches,
 * suppressions }` que l'appelant applique en UN pas d'historique (cf.
 * `appliquerMutationDocument` dans components/DocumentBusinessPanels.jsx).
 *
 * ⛔ [SIG-2] LE BLOC DE SIGNATURE N'EST PAS FABRIQUÉ ICI : `identite.signature` EST une
 * signature `documentSignature.js` (trois voies : tracée à la main, téléversée,
 * dactylographiée). Ce fichier n'en garde que le MARQUAGE (`meta.identite`) et le
 * PLACEMENT dans la page. Une signature réglée dans l'identité se repose ainsi telle
 * quelle d'un document à l'autre. Les identités enregistrées AVANT (format
 * `{nom, fonction, mention, image}`) sont reprises sans perte par `normaliserSignature`.
 * ⛔ Aucune valeur probante : c'est un dessin dans un PDF, rien de plus.
 *
 * ⛔ LA NUMÉROTATION ET LES BANDES NE SONT PAS RÉÉCRITES ICI : {@link appliquerIdentite}
 * appelle `enTetePiedRecurrents` de documentPagination.js. Deux générateurs de bandes
 * donneraient deux géométries et la critique de mise en page dénoncerait le produit.
 *
 * ⚠️ RANGEMENT (dit sans détour) : il n'existe AUCUN chemin d'écriture atteignable
 * depuis le front pour poser une clé libre dans `tenants.metadata`. Le seul endpoint
 * self-serve, `PATCH /tenants/current/settings`, n'accepte que `requiresStudentDossier`
 * et `memberDiscounts` (DTO `UpdateTenantSettingsDto`, sanitisé côté service). Les
 * identités sont donc persistées LOCALEMENT (useDocumentIdentiteStore → localStorage) :
 * elles ne sont PAS partagées entre les postes ni entre les membres d'un tenant. Le
 * store expose `brancherStockageDistant()` pour que ce chemin soit branché le jour où
 * l'API l'ouvrira — aucun appelant aujourd'hui.
 *
 * ⚠️ LOGO : téléversé dans le bucket PRIVÉ `smartboard-canvas`. On stocke la forme
 * durable rendue par `uploadSmartboardCanvasImage` ; le rendu et l'export re-signent
 * (`signSmartboardCanvasUrl`). Ne JAMAIS stocker une URL signée : elle expire.
 *
 * ═══ CONTRAT pour la coque (montage du panneau) ═══
 *   1. `useDocumentIdentiteStore.getState().charger()` au montage (idempotent).
 *   2. L'identité active se lit avec `identiteActive(collection)`.
 *   3. La pose est EXPLICITE : rien ne s'applique à un document ouvert sans un clic.
 *      `appliquerIdentite({ identite, objets, page })` → mutation à appliquer telle
 *      quelle (`ajouts` + `patches` + `suppressions`) en un seul pas d'historique.
 *   4. Pour un document NEUF, la coque peut appeler `appliquerIdentite` juste après
 *      la création de la scène : `objets: []` rend `patches: []` (rien à pousser).
 *
 * ⚠️ LIMITE CONNUE, non corrigée ici (le correctif tomberait hors périmètre) :
 * « Ajouter une page » (DocumentBusinessPanels) régénère les bandes à partir de
 * `configDepuisBandes`, qui ne relit que les rôles TEXTE (entete/pied/numero). Le
 * LOGO, lui, est un objet image : il est supprimé par cette régénération et non
 * recréé. {@link identitePosee} permet au panneau de le détecter et de proposer
 * « Réappliquer » — c'est ce que fait DocumentIdentitePanel.
 *
 * Aucun import React, aucun réseau : testable sous `node --test`.
 */
import {
  FORMAT_DEFAUT,
  MARGES_DEFAUT,
  ECART_PAGES_DEFAUT,
  META_ENTETE_PIED,
  resoudreFormat,
  resoudreMarges,
  zoneUtile,
  origineDePage,
  enTetePiedRecurrents,
  patchesReserveBandes,
  estEntetePied,
} from './documentPagination.js';
import { boiteAuFormat } from './documentImages.js';
import { DOC_INK, DOC_INK_SOFT } from './documentBlockLayout.js';
/* [SIG-2] Le bloc de signature n'est PAS refait ici : documentSignature.js le porte
   (trois voies : tracée, téléversée, dactylographiée). Deux mécanismes concurrents
   auraient donné deux signatures différentes selon l'écran qui la pose. */
import {
  HAUTEUR_SIGNATURE_DEFAUT as HAUTEUR_SIGNATURE_DEFAUT_SIG,
  avertissementsSignature,
  normaliserSignature,
  objetsDeSignature,
  signatureVide,
} from './documentSignature.js';

/* ═══════════════════════════════════════════════════════════════════
   Constantes
═══════════════════════════════════════════════════════════════════ */

/** Marqueur porté par TOUT objet posé par ce module (`meta.identite` = id de l'identité). */
export const META_IDENTITE = 'identite';

/** Rôles posés : les trois premiers sont des bandes récurrentes, le dernier non. */
export const ROLES_IDENTITE = Object.freeze(['logo', 'entete', 'pied', 'numero', 'signature']);

/**
 * Dispositions de l'en-tête. Aucune ne superpose le logo et le texte : un recouvrement
 * de plus de 2 px est compté BLOQUANT par `critiquerMiseEnPage` — le produit se
 * dénoncerait lui-même à l'export.
 */
export const DISPOSITIONS_ENTETE = Object.freeze([
  { id: 'logo-gauche', label: 'Logo à gauche, texte à droite' },
  { id: 'logo-droite', label: 'Logo à droite, texte à gauche' },
  { id: 'logo-centre', label: 'Logo centré, texte dessous' },
  { id: 'texte-seul', label: 'Texte seul (logo non posé)' },
]);

export const DISPOSITION_DEFAUT = 'logo-gauche';

/** Géométries — ce sont des réglages de mise en page, pas des données d'entreprise. */
export const HAUTEUR_LOGO_DEFAUT = 44;
export const HAUTEUR_LOGO_MIN = 16;
export const HAUTEUR_LOGO_MAX = 140;
/** Part maximale de la largeur utile qu'un logo peut prendre (le reste porte le texte). */
const PART_LARGEUR_LOGO_MAX = 0.45;
/** Filet d'air entre le logo et le texte d'en-tête (horizontal puis vertical). */
const ECART_LOGO_TEXTE = 14;
const ECART_LOGO_DESSOUS = 8;

/** Ré-exportée depuis documentSignature — une seule hauteur de signature dans le produit. */
export const HAUTEUR_SIGNATURE_DEFAUT = HAUTEUR_SIGNATURE_DEFAUT_SIG;
const LARGEUR_BLOC_SIGNATURE = 268;
const ECART_AVANT_SIGNATURE = 28;

/** Gabarit de numérotation par défaut — celui de documentPagination. */
export const GABARIT_NUMEROTATION_DEFAUT = 'Page {{page}} / {{pages}}';

/** Police de repli : celle de la page Document (documentBlockLayout). */
const POLICE_DEFAUT = 'Georgia, serif';

/** Séparateur des coordonnées en pied de page. */
const SEP_PIED = ' · ';

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
 * Identité VIERGE. ⛔ Tous les champs de contenu naissent vides — c'est la règle
 * qui empêche un faux SIRET de partir à l'impression.
 * @returns {object}
 */
export function identiteVide() {
  return {
    id: '',
    version: 1,
    /** Nom de la configuration dans la liste (ex. « Siège », « Marque B »). */
    libelle: '',
    raisonSociale: '',
    entete: {
      texte: '',
      disposition: DISPOSITION_DEFAUT,
      afficherRaisonSociale: true,
    },
    logo: { src: '', largeurNative: null, hauteurNative: null, hauteur: HAUTEUR_LOGO_DEFAUT },
    coordonnees: { adresse: '', telephone: '', courriel: '', site: '' },
    pied: {
      mentions: '',
      afficherCoordonnees: true,
      numerotation: true,
      gabaritNumerotation: GABARIT_NUMEROTATION_DEFAUT,
      sauterPremiere: false,
    },
    /* [SIG-2] Le bloc de signature de l'identité EST une signature documentSignature :
       les trois voies sont donc disponibles ici, et une signature réglée une fois se
       repose d'un document à l'autre avec l'identité. */
    signature: signatureVide(),
    palette: { primaire: '', secondaire: '', accent: '' },
    polices: { titre: '', corps: '' },
    page: { format: '', marges: null },
    creeLe: '',
    majLe: '',
  };
}

/**
 * Rend une identité complète et sûre à partir d'un objet partiel (formulaire, stockage).
 * Ne comble AUCUN champ de contenu : ce qui est absent reste vide.
 * @param {object} [brut]
 */
export function normaliserIdentite(brut) {
  const b = brut && typeof brut === 'object' ? brut : {};
  const v = identiteVide();
  const disposition = DISPOSITIONS_ENTETE.some((d) => d.id === b?.entete?.disposition)
    ? b.entete.disposition
    : DISPOSITION_DEFAUT;

  return {
    ...v,
    id: txt(b.id),
    libelle: txt(b.libelle),
    raisonSociale: txt(b.raisonSociale),
    entete: {
      texte: txt(b?.entete?.texte),
      disposition,
      afficherRaisonSociale: bool(b?.entete?.afficherRaisonSociale, true),
    },
    logo: {
      src: txt(b?.logo?.src),
      largeurNative: nbOuNull(b?.logo?.largeurNative),
      hauteurNative: nbOuNull(b?.logo?.hauteurNative),
      hauteur: nbBorne(b?.logo?.hauteur, HAUTEUR_LOGO_MIN, HAUTEUR_LOGO_MAX, HAUTEUR_LOGO_DEFAUT),
    },
    coordonnees: {
      adresse: txt(b?.coordonnees?.adresse),
      telephone: txt(b?.coordonnees?.telephone),
      courriel: txt(b?.coordonnees?.courriel),
      site: txt(b?.coordonnees?.site),
    },
    pied: {
      mentions: txt(b?.pied?.mentions),
      afficherCoordonnees: bool(b?.pied?.afficherCoordonnees, true),
      numerotation: bool(b?.pied?.numerotation, true),
      gabaritNumerotation: txt(b?.pied?.gabaritNumerotation) || GABARIT_NUMEROTATION_DEFAUT,
      sauterPremiere: bool(b?.pied?.sauterPremiere, false),
    },
    /* Reprend l'ANCIEN format `{nom, fonction, mention, image}` sans rien perdre :
       une identité enregistrée avant les trois voies garde son image et se voit
       attribuer la voie « téléversée » — la seule qu'elle pouvait être. */
    signature: normaliserSignature(b?.signature),
    palette: {
      primaire: couleurValide(b?.palette?.primaire),
      secondaire: couleurValide(b?.palette?.secondaire),
      accent: couleurValide(b?.palette?.accent),
    },
    polices: { titre: txt(b?.polices?.titre), corps: txt(b?.polices?.corps) },
    page: {
      format: txt(b?.page?.format),
      marges: b?.page?.marges && typeof b.page.marges === 'object' ? resoudreMarges(b.page.marges) : null,
    },
    creeLe: txt(b.creeLe),
    majLe: txt(b.majLe),
  };
}

/** Champs de CONTENU renseignés / attendus — sert à dire honnêtement où en est la config. */
export function resumeIdentite(identite) {
  const i = normaliserIdentite(identite);
  const champs = [
    ['Raison sociale', i.raisonSociale],
    ['Logo', i.logo.src],
    ['Adresse', i.coordonnees.adresse],
    ['Téléphone', i.coordonnees.telephone],
    ['Courriel', i.coordonnees.courriel],
    ['Site', i.coordonnees.site],
    ['Mentions légales', i.pied.mentions],
    ['Signataire', i.signature.nom],
    ['Fonction', i.signature.fonction],
  ];
  const manquants = champs.filter(([, v]) => !v).map(([nom]) => nom);
  return {
    remplis: champs.length - manquants.length,
    total: champs.length,
    manquants,
    vide: manquants.length === champs.length,
  };
}

/** Vrai si l'identité ne porte AUCUN contenu (rien à poser sur une page). */
export const identiteEstVide = (identite) => resumeIdentite(identite).vide;

/* ═══════════════════════════════════════════════════════════════════
   Collection : plusieurs identités, une active — [ID-4]
═══════════════════════════════════════════════════════════════════ */

/** @typedef {{identites: object[], actifId: string|null}} CollectionIdentites */

/** Collection sûre à partir de n'importe quelle valeur stockée. */
export function normaliserCollection(brut) {
  const b = brut && typeof brut === 'object' ? brut : {};
  const identites = (Array.isArray(b.identites) ? b.identites : [])
    .map((x) => normaliserIdentite(x))
    .filter((x) => x.id);
  const actifId = identites.some((x) => x.id === b.actifId) ? b.actifId : (identites[0]?.id ?? null);
  return { identites, actifId };
}

/** Liste des identités, la plus récemment modifiée d'abord. */
export function listerIdentites(collection) {
  const c = normaliserCollection(collection);
  return [...c.identites].sort((a, b) => String(b.majLe).localeCompare(String(a.majLe)));
}

/** Identité active, ou `null` s'il n'y en a aucune. */
export function identiteActive(collection) {
  const c = normaliserCollection(collection);
  return c.identites.find((x) => x.id === c.actifId) ?? null;
}

/**
 * Enregistre (crée ou remplace) une identité. NE MUTE RIEN.
 * La première identité enregistrée devient active — sinon elle serait invisible.
 * @returns {CollectionIdentites}
 */
export function enregistrerIdentite(collection, identite, maintenant = new Date().toISOString()) {
  const c = normaliserCollection(collection);
  const n = normaliserIdentite(identite);
  const id = n.id || uid('idn');
  const existante = c.identites.find((x) => x.id === id);
  const fusionnee = {
    ...n,
    id,
    creeLe: existante?.creeLe || n.creeLe || maintenant,
    majLe: maintenant,
  };
  const identites = existante
    ? c.identites.map((x) => (x.id === id ? fusionnee : x))
    : [...c.identites, fusionnee];
  return { identites, actifId: c.actifId ?? id };
}

/** Supprime une identité. L'active bascule sur la première restante (ou null). */
export function supprimerIdentite(collection, id) {
  const c = normaliserCollection(collection);
  const identites = c.identites.filter((x) => x.id !== id);
  const actifId = c.actifId === id ? (identites[0]?.id ?? null) : c.actifId;
  return { identites, actifId };
}

/** Change l'identité active. Un id inconnu ne change RIEN (pas d'état fantôme). */
export function definirIdentiteActive(collection, id) {
  const c = normaliserCollection(collection);
  if (!c.identites.some((x) => x.id === id)) return c;
  return { ...c, actifId: id };
}

/* ═══════════════════════════════════════════════════════════════════
   Textes des bandes
═══════════════════════════════════════════════════════════════════ */

/**
 * Texte de la bande d'en-tête : raison sociale puis lignes libres.
 * Rend '' si rien n'est renseigné — `enTetePiedRecurrents` ne pose alors aucune bande.
 */
export function texteEnTete(identite) {
  const i = normaliserIdentite(identite);
  const lignes = [];
  if (i.entete.afficherRaisonSociale && i.raisonSociale) lignes.push(i.raisonSociale);
  if (i.entete.texte) lignes.push(i.entete.texte);
  return lignes.join('\n');
}

/**
 * Texte du pied : coordonnées sur une ligne, mentions légales dessous.
 * ⛔ Les séparateurs ne sont posés qu'entre des valeurs RÉELLEMENT présentes :
 * un pied « · · » signale à l'imprimeur des champs qu'on n'a pas.
 */
export function textePied(identite) {
  const i = normaliserIdentite(identite);
  const lignes = [];
  if (i.pied.afficherCoordonnees) {
    const bouts = [i.coordonnees.adresse, i.coordonnees.telephone, i.coordonnees.courriel, i.coordonnees.site]
      .map((v) => v.replace(/\s*\n\s*/g, ', '))
      .filter(Boolean);
    if (bouts.length) lignes.push(bouts.join(SEP_PIED));
  }
  if (i.pied.mentions) lignes.push(i.pied.mentions);
  return lignes.join('\n');
}

/* ═══════════════════════════════════════════════════════════════════
   Application à un document — [ID-3]
═══════════════════════════════════════════════════════════════════ */

/** Boîte du logo au bon rapport. Sans dimensions natives on ne DEVINE pas : carré. */
function boiteLogo(logo, largeurUtile) {
  const hauteurVoulue = nbBorne(logo.hauteur, HAUTEUR_LOGO_MIN, HAUTEUR_LOGO_MAX, HAUTEUR_LOGO_DEFAUT);
  const largeurMax = Math.max(24, Math.round(largeurUtile * PART_LARGEUR_LOGO_MAX));
  if (logo.largeurNative && logo.hauteurNative) {
    const b = boiteAuFormat({
      largeurNative: logo.largeurNative,
      hauteurNative: logo.hauteurNative,
      largeurMax,
      hauteurMax: hauteurVoulue,
      agrandir: true,
      tailleMin: HAUTEUR_LOGO_MIN,
    });
    return { width: b.width, height: b.height, mesure: true, deformation: b.deformation };
  }
  // ⛔ Même raisonnement que `boiteNeutre` (documentImages) : un rapport affirmé au
  // hasard fait sauter l'image dès que le bitmap arrive. Le carré n'affirme rien.
  const cote = Math.min(hauteurVoulue, largeurMax);
  return { width: cote, height: cote, mesure: false, deformation: 0 };
}

/**
 * ⛔ PIÈGE MESURÉ EN NAVIGATEUR (2026-08-06) : la boîte calculée ici n'est PAS la
 * boîte finale. `adapterImagesAuCanevas` (useSmartboardKonvaStore) repasse par la
 * géométrie toute image ajoutée, et sans `content.natif` elle considère le fichier
 * comme NON MESURÉ : elle remplace alors la boîte par un CARRÉ neutre. Un logo
 * 675 × 900 posé en 33 × 44 ressortait ainsi en 48 × 48 — déformé, et débordant
 * d'un pixel sur la zone de texte de l'en-tête que ce module lui avait réservée.
 * Les dimensions natives sont connues (elles sont dans l'identité) : on les
 * TRANSMET, et la géométrie du canevas respecte alors la boîte demandée.
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

/**
 * Bandes récurrentes + logo, page par page. Aucune écriture.
 *
 * ⛔ `enTetePiedRecurrents` est appelée DEUX fois — une pour le haut (avec des marges
 * élargies là où le logo occupe la place), une pour le bas (marges réelles). Un seul
 * appel aurait indenté le pied de la largeur du logo.
 *
 * @param {{identite:object, nbPages?:number, format?:string|object, marges?:object, ecart?:number}} p
 * @returns {{bandes:object[], logoMesure:boolean, reserveLogo:number}}
 */
export function bandesIdentite({
  identite,
  nbPages = 1,
  format = FORMAT_DEFAUT,
  marges = MARGES_DEFAUT,
  ecart = ECART_PAGES_DEFAUT,
} = {}) {
  const i = normaliserIdentite(identite);
  const f = resoudreFormat(format);
  const m = resoudreMarges(marges);
  const n = Math.max(1, Math.trunc(Number(nbPages) || 1));
  const z = zoneUtile(f, m);
  const police = i.polices.corps || POLICE_DEFAUT;
  const style = {
    police,
    taille: 11,
    encre: i.palette.secondaire || DOC_INK_SOFT,
  };

  const haut = texteEnTete(i);
  const bas = textePied(i);
  const avecLogo = Boolean(i.logo.src) && i.entete.disposition !== 'texte-seul';
  const boite = avecLogo ? boiteLogo(i.logo, z.largeur) : null;

  /* Marges SPÉCIFIQUES à la bande haute : elles ne servent qu'à lui laisser la place
     que le logo occupe. Les marges réelles restent celles du document. */
  const margesHaut = { ...m };
  const logos = [];
  if (avecLogo) {
    for (let p = 0; p < n; p += 1) {
      const y0 = origineDePage(p, f, ecart);
      let x = z.gauche;
      if (i.entete.disposition === 'logo-droite') x = z.droite - boite.width;
      else if (i.entete.disposition === 'logo-centre') x = z.gauche + (z.largeur - boite.width) / 2;
      logos.push(mkImage({
        id: uid('idn_logo'),
        src: i.logo.src,
        x,
        y: y0 + z.haut,
        width: boite.width,
        height: boite.height,
        natif: { largeurNative: i.logo.largeurNative, hauteurNative: i.logo.hauteurNative },
        meta: { doc: META_ENTETE_PIED, role: 'logo', page: p, identite: i.id || META_IDENTITE },
      }));
    }
    if (i.entete.disposition === 'logo-gauche') margesHaut.gauche = m.gauche + boite.width + ECART_LOGO_TEXTE;
    else if (i.entete.disposition === 'logo-droite') margesHaut.droite = m.droite + boite.width + ECART_LOGO_TEXTE;
    else margesHaut.haut = m.haut + boite.height + ECART_LOGO_DESSOUS;
  }

  const numActive = i.pied.numerotation;
  const configNum = numActive
    ? {
      gabarit: i.pied.gabaritNumerotation || GABARIT_NUMEROTATION_DEFAUT,
      align: 'right',
      position: 'pied',
      sauterPremiere: i.pied.sauterPremiere,
    }
    : false;

  const bandesHautes = haut
    ? enTetePiedRecurrents({
      enTete: { texte: haut, align: 'left', fill: i.palette.primaire || DOC_INK },
      numerotation: false,
      nbPages: n,
      format: f,
      marges: margesHaut,
      ecart,
      style,
    })
    : [];

  const bandesBasses = (bas || numActive)
    ? enTetePiedRecurrents({
      pied: bas ? { texte: bas, align: 'center' } : null,
      numerotation: configNum,
      nbPages: n,
      format: f,
      marges: m,
      ecart,
      style,
    })
    : [];

  // Le marquage `meta.identite` est ce qui permet de RETROUVER (et de remplacer) les
  // objets posés par ce module sans toucher aux bandes faites à la main ailleurs.
  const marquer = (o) => ({ ...o, meta: { ...(o.meta || {}), identite: i.id || META_IDENTITE } });

  return {
    bandes: [...logos, ...bandesHautes.map(marquer), ...bandesBasses.map(marquer)],
    logoMesure: avecLogo ? boite.mesure : true,
    reserveLogo: avecLogo ? boite.height : 0,
  };
}

/**
 * [SIG-2] Bloc de signature de l'identité — DÉLÉGUÉ à documentSignature.
 *
 * ⛔ Aucune fabrication d'objet de signature ici : les trois voies (tracée, téléversée,
 * dactylographiée) vivent dans un seul module. Ce qui reste propre à l'identité, c'est
 * le MARQUAGE (`meta.identite`) qui permet à `retirerIdentite` de la reprendre.
 *
 * @returns {{objets:object[], hauteur:number, mesuree:boolean, raison:string|null}}
 */
function objetsSignature(identite, { x, y, largeur, police, encre }) {
  const i = normaliserIdentite(identite);
  const res = objetsDeSignature({
    signature: i.signature,
    x,
    y,
    largeur,
    police,
    encre,
    meta: { identite: i.id || META_IDENTITE },
  });
  return { objets: res.objets, hauteur: res.hauteur, mesuree: res.mesuree, raison: res.raison };
}

/** Objets déjà posés par une identité (bandes de ce module ET bandes d'en-tête tierces). */
function idsARemplacer(objets) {
  const ids = [];
  for (const o of Array.isArray(objets) ? objets : []) {
    if (!o?.id) continue;
    if (estEntetePied(o) || o.meta?.identite) ids.push(o.id);
  }
  return ids;
}

/**
 * Applique une identité à un document. NE MUTE RIEN, N'ÉCRIT RIEN.
 *
 * ⛔ NE DOIT RIEN ÉCRASER : les bandes réservent leur zone et le corps DESCEND
 * (`patchesReserveBandes` de documentPagination). Quand la place manque, la page part
 * dans `pagesBloquees` et RIEN ne bouge sur cette page — c'est « Réorganiser en pages »
 * qui sait traiter ce cas.
 *
 * ⛔ La signature n'est pas posée de force : si la dernière page est pleine, elle
 * n'est PAS posée et la raison est rendue (`raisonSignature`). Une signature hors page
 * est pire qu'une signature absente — elle est invisible à l'écran et présente au PDF.
 *
 * @param {{identite:object, objets?:object[],
 *          page?:{format?:string|object, marges?:object, nbPages?:number, ecart?:number},
 *          poserSignature?:boolean}} p
 * @returns {{ajouts:object[], patches:{id:string,patch:object}[], suppressions:string[],
 *            reserve:{haut:number,bas:number|null}, conflitsBas:string[], pagesBloquees:number[],
 *            signaturePlacee:boolean, raisonSignature:string|null, signatureMesuree:boolean,
 *            avertissementsSignature:string[], logoMesure:boolean,
 *            resume:{bandes:number, deplaces:number, pages:number}}}
 */
export function appliquerIdentite({ identite, objets = [], page = {}, poserSignature = true } = {}) {
  const i = normaliserIdentite(identite);
  const f = resoudreFormat(page.format ?? i.page.format ?? FORMAT_DEFAUT);
  const m = resoudreMarges(page.marges ?? i.page.marges ?? MARGES_DEFAUT);
  const ecart = Number.isFinite(Number(page.ecart)) ? Number(page.ecart) : ECART_PAGES_DEFAUT;
  const nbPages = Math.max(1, Math.trunc(Number(page.nbPages) || 1));
  const liste = Array.isArray(objets) ? objets.filter(Boolean) : [];

  const { bandes, logoMesure } = bandesIdentite({ identite: i, nbPages, format: f, marges: m, ecart });

  /* Les objets remplacés ne doivent PAS être poussés par la réservation : ils
     disparaissent dans la même mutation. Les compter ferait descendre le corps de la
     hauteur d'un en-tête qui n'existera plus. */
  const suppressions = idsARemplacer(liste);
  const aSupprimer = new Set(suppressions);
  const restants = liste.filter((o) => !aSupprimer.has(o.id));

  const { patches, reserve, conflitsBas, pagesBloquees } = patchesReserveBandes(restants, bandes, {
    format: f,
    ecart,
  });

  const ajouts = [...bandes];
  let signaturePlacee = false;
  let raisonSignature = null;
  let signatureMesuree = true;

  if (poserSignature) {
    const z = zoneUtile(f, m);
    const pas = f.hauteur + ecart;
    const y0 = origineDePage(nbPages - 1, f, ecart);
    const parId = new Map(patches.map((p) => [p.id, p.patch.y]));
    // Bas du corps SUR LA DERNIÈRE PAGE, positions d'APRÈS la réservation : mesurer
    // avant ferait poser la signature là où un bloc va justement descendre.
    let bas = null;
    for (const o of restants) {
      const y = parId.has(o.id) ? parId.get(o.id) : Number(o.y);
      if (!Number.isFinite(y)) continue;
      if (Math.floor(y / pas) !== nbPages - 1) continue;
      bas = Math.max(bas ?? -Infinity, y + (Number(o.height) || 0));
    }
    const plancher = y0 + Math.max(z.haut, reserve.haut);
    const yDepart = bas === null ? plancher : Math.max(plancher, bas + ECART_AVANT_SIGNATURE);
    const largeur = Math.min(LARGEUR_BLOC_SIGNATURE, z.largeur);
    const bloc = objetsSignature(i, {
      x: z.droite - largeur,
      y: yDepart,
      largeur,
      police: i.polices.corps || POLICE_DEFAUT,
      encre: i.palette.primaire || DOC_INK,
    });
    if (!bloc.objets.length) {
      // La raison vient de documentSignature : elle NOMME le champ manquant (voie non
      // choisie, aucun trait, image absente, nom vide) au lieu d'un « rien à poser ».
      raisonSignature = bloc.raison || 'aucun champ de signature renseigné';
    } else {
      const limite = y0 + (reserve.bas == null ? z.bas : Math.min(z.bas, reserve.bas));
      if (yDepart + bloc.hauteur > limite) {
        raisonSignature = 'la dernière page est pleine : ajoutez une page puis réappliquez';
      } else {
        ajouts.push(...bloc.objets);
        signaturePlacee = true;
        signatureMesuree = bloc.mesuree;
      }
    }
  }

  return {
    ajouts,
    patches,
    suppressions,
    reserve,
    conflitsBas,
    pagesBloquees,
    signaturePlacee,
    raisonSignature,
    signatureMesuree,
    /* Ce que l'utilisateur doit savoir AVANT d'exporter (police manuscrite non
       embarquée au PDF, scan non détouré…). Rendu tel quel : le panneau l'affiche. */
    avertissementsSignature: avertissementsSignature(i.signature),
    logoMesure,
    resume: { bandes: bandes.length, deplaces: patches.length, pages: nbPages },
  };
}

/**
 * Objets d'aperçu pour UNE page — même code que la pose réelle (sinon l'aperçu
 * mentirait), sur un document vide et sans signature de flux.
 * @returns {{objets:object[], format:object, marges:object}}
 */
export function apercuIdentite({ identite, format = FORMAT_DEFAUT, marges = MARGES_DEFAUT } = {}) {
  const i = normaliserIdentite(identite);
  const f = resoudreFormat(format ?? i.page.format ?? FORMAT_DEFAUT);
  const m = resoudreMarges(marges ?? i.page.marges ?? MARGES_DEFAUT);
  const { bandes } = bandesIdentite({ identite: i, nbPages: 1, format: f, marges: m });
  const z = zoneUtile(f, m);
  const largeur = Math.min(LARGEUR_BLOC_SIGNATURE, z.largeur);
  const { objets } = objetsSignature(i, {
    x: z.droite - largeur,
    // L'aperçu montre la signature à sa hauteur habituelle (bas de zone utile),
    // pas à l'endroit exact où elle tombera dans un document réel.
    y: z.bas - 96,
    largeur,
    police: i.polices.corps || POLICE_DEFAUT,
    encre: i.palette.primaire || DOC_INK,
  });
  return { objets: [...bandes, ...objets], format: f, marges: m };
}

/**
 * État de la pose dans un document : sert au panneau pour DIRE quand la marque a été
 * perdue (« Ajouter une page » supprime les bandes et ne recrée pas le logo).
 *
 * @param {object[]} objets
 * @param {number} [nbPages]
 * @returns {{posee:boolean, identiteId:string|null, pagesLogo:number[], pagesBandes:number[],
 *            logoManquant:boolean, aSignature:boolean}}
 */
export function identitePosee(objets, nbPages = 1) {
  const liste = Array.isArray(objets) ? objets : [];
  const marques = liste.filter((o) => o?.meta?.identite);
  const pagesLogo = [...new Set(marques.filter((o) => o.meta.role === 'logo').map((o) => Number(o.meta.page) || 0))];
  const pagesBandes = [...new Set(
    marques.filter((o) => o.meta.role === 'entete' || o.meta.role === 'pied' || o.meta.role === 'numero')
      .map((o) => Number(o.meta.page) || 0),
  )];
  const n = Math.max(1, Math.trunc(Number(nbPages) || 1));
  return {
    posee: marques.length > 0,
    identiteId: marques[0]?.meta?.identite ?? null,
    pagesLogo: pagesLogo.sort((a, b) => a - b),
    pagesBandes: pagesBandes.sort((a, b) => a - b),
    // Vrai seulement si un logo a existé et ne couvre plus toutes les pages.
    logoManquant: pagesLogo.length > 0 && pagesLogo.length < n,
    aSignature: marques.some((o) => o.meta.role === 'signature'),
  };
}

/**
 * Suppressions seules — « Retirer l'identité du document ».
 * @returns {{suppressions:string[]}}
 */
export function retirerIdentite(objets) {
  const liste = Array.isArray(objets) ? objets : [];
  return { suppressions: liste.filter((o) => o?.meta?.identite && o?.id).map((o) => o.id) };
}
