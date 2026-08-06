/**
 * useDocumentSuggestionsStore — la mémoire des propositions IA du Studio Document.
 *
 * ⛔ POURQUOI CE STORE EXISTE
 * Les propositions de blocs et le brouillon de rédaction vivaient en `useState`
 * dans DocumentSuggestionsPanel. Fermer le hub LONGIA ou changer d'onglet démonte
 * le panneau : mesuré, 0 bloc survivant. Or chaque proposition est un appel modèle
 * déjà payé. Un store de module vit hors de l'arbre React : il survit au démontage
 * et ne se vide que sur demande explicite de l'utilisateur.
 *
 * ⚠️ RIEN N'EST PURGÉ AUTOMATIQUEMENT quand le document change. Les propositions
 * portent la clé de contexte de leur production (`contexte`) ; le panneau compare
 * et AVERTIT. Une purge silencieuse serait la même perte, seulement déplacée.
 *
 * ⚠️ Ce store ne contient AUCUN état transitoire (chargement, id occupé, message
 * d'erreur) : ces valeurs-là doivent au contraire mourir avec le panneau, sinon un
 * spinner ressuscite sans requête derrière.
 *
 * ═══ Contrat glisser-déposer — à l'attention de la coque / du canevas ═══
 *
 * Les cartes de suggestion sont `draggable`. Au `dragstart` elles écrivent DEUX
 * formats dans le `dataTransfer` :
 *   · `application/liri-document-bloc` → JSON `PayloadBlocDnd` (voir plus bas)
 *   · `text/plain`                     → le texte brut (repli hors canevas)
 *
 * ⚠️ Côté réception, `SmartboardKonvaEditorV1.handleCanvasDrop` n'écoute
 * aujourd'hui QUE `application/liri-library` et ignore les coordonnées du dépôt.
 * Il reste donc à y ajouter, AVANT le `return` du format bibliothèque :
 *
 *     const bloc = lireBlocDnd(e.dataTransfer);
 *     if (bloc) {
 *       const p = pointScene(e);                       // clientX/Y → coords scène
 *       addObjects([makeDocumentTextObject({
 *         text: bloc.texte, x: p.x, y: p.y,
 *         width: bloc.largeur, fontSize: bloc.fontSize,
 *       })]);
 *       return;
 *     }
 *
 * Tant que cette réception n'existe pas, le bouton « Insérer ici » reste le chemin
 * sûr : il n'a pas été retiré, le glisser s'y AJOUTE.
 */
import { create } from 'zustand';
import { DOC_PAGE } from '@/features/smartboard-konva-editor/lib/documentBlockLayout';

/** Type MIME du glisser-déposer d'un bloc de document. */
export const DOC_BLOC_DND_MIME = 'application/liri-document-bloc';

/** Corps et largeur conseillés — ceux de `makeDocumentTextObject` pour la page A4. */
export const DOC_BLOC_DND_DEFAUTS = Object.freeze({
  fontSize: 13,
  largeur: DOC_PAGE.contentWidth,
});

/**
 * @typedef {object} PayloadBlocDnd
 * @property {1} version                              rupture de format ⇒ version 2
 * @property {'document-bloc'} type
 * @property {string} texte                           texte à poser (jamais vide)
 * @property {string} bloc                            nom du bloc du plan ('objet', 'corps'…)
 * @property {string|null} suggestionId
 * @property {'suggestions'|'redaction-auto'} origine
 * @property {number} fontSize                        corps conseillé (px)
 * @property {number} largeur                         largeur conseillée (px), colonne utile A4
 */

/**
 * Écrit un bloc dans un `dataTransfer` de `dragstart`.
 * @param {DataTransfer} dataTransfer
 * @param {{ texte: string, bloc?: string, suggestionId?: string|null, origine?: string, fontSize?: number, largeur?: number }} bloc
 * @returns {PayloadBlocDnd|null} le payload écrit, `null` si le texte est vide
 */
export function ecrireBlocDnd(dataTransfer, bloc) {
  const texte = String(bloc?.texte ?? '').trim();
  if (!dataTransfer || !texte) return null;

  /** @type {PayloadBlocDnd} */
  const payload = {
    version: 1,
    type: 'document-bloc',
    texte,
    bloc: String(bloc?.bloc ?? '').trim() || 'bloc',
    suggestionId: bloc?.suggestionId ?? null,
    origine: bloc?.origine === 'redaction-auto' ? 'redaction-auto' : 'suggestions',
    fontSize: Number.isFinite(bloc?.fontSize) ? Number(bloc.fontSize) : DOC_BLOC_DND_DEFAUTS.fontSize,
    largeur: Number.isFinite(bloc?.largeur) ? Number(bloc.largeur) : DOC_BLOC_DND_DEFAUTS.largeur,
  };

  dataTransfer.setData(DOC_BLOC_DND_MIME, JSON.stringify(payload));
  /* Repli : un dépôt hors canevas (éditeur externe, champ de saisie) donne le texte. */
  dataTransfer.setData('text/plain', texte);
  dataTransfer.effectAllowed = 'copy';
  return payload;
}

/**
 * Relit un bloc déposé. Rend `null` pour tout autre payload — un `onDrop` peut donc
 * l'appeler en premier sans risque pour le format bibliothèque.
 * @param {DataTransfer} dataTransfer
 * @returns {PayloadBlocDnd|null}
 */
export function lireBlocDnd(dataTransfer) {
  if (!dataTransfer) return null;
  let brut = '';
  try {
    brut = dataTransfer.getData(DOC_BLOC_DND_MIME);
  } catch {
    return null;
  }
  if (!brut) return null;
  try {
    const p = JSON.parse(brut);
    if (p?.type !== 'document-bloc') return null;
    const texte = String(p.texte ?? '').trim();
    if (!texte) return null;
    return {
      version: 1,
      type: 'document-bloc',
      texte,
      bloc: String(p.bloc ?? 'bloc'),
      suggestionId: p.suggestionId ?? null,
      origine: p.origine === 'redaction-auto' ? 'redaction-auto' : 'suggestions',
      fontSize: Number.isFinite(p.fontSize) ? Number(p.fontSize) : DOC_BLOC_DND_DEFAUTS.fontSize,
      largeur: Number.isFinite(p.largeur) ? Number(p.largeur) : DOC_BLOC_DND_DEFAUTS.largeur,
    };
  } catch {
    return null;
  }
}

/**
 * Clé de contexte : identifie le document pour lequel une proposition a été produite.
 * Sert uniquement à AVERTIR, jamais à effacer.
 * @param {{ detectedType?: string|null, templateId?: string|null }} [p]
 */
export function cleContexteDocument(p = {}) {
  return `${p.detectedType ?? '—'}::${p.templateId ?? '—'}`;
}

const ETAT_VIDE = {
  /** Bloc du plan actuellement visé par les propositions. */
  blocCible: '',
  /** Propositions de blocs (mode Suggestions). */
  propositions: [],
  /** Bloc auquel se rapportent `propositions`. */
  blocPropose: '',
  /** Brouillon complet (mode Rédaction auto) : `{ blocs, avertissements… }`. */
  brouillon: null,
  /** Clé de contexte au moment de la production. */
  contexte: null,
  /** Horodatage de la dernière production (ms). */
  produitLe: null,
};

export const useDocumentSuggestionsStore = create((set, get) => ({
  ...ETAT_VIDE,

  /**
   * Variantes de reformulation par bloc texte du canevas.
   * `{ [objetId]: { label, intention, items, source, produitLe } }`
   *
   * ⚠️ Créé mais PAS ENCORE BRANCHÉ : le producteur de ces variantes est
   * `DocumentTextAiActions.jsx`, hors du périmètre de ce lot. Tant que ce
   * composant garde son `useState`, ses variantes meurent toujours au démontage.
   * Le branchement tient en trois lignes : lire `variantesTexte[objetId]` à
   * l'affichage, appeler `setVariantesTexte` après l'appel modèle,
   * `oublierVariantesTexte` sur la croix de fermeture.
   */
  variantesTexte: {},

  setBlocCible: (bloc) => set({ blocCible: String(bloc ?? '') }),

  /**
   * @param {string} bloc      bloc du plan visé
   * @param {any[]} items      propositions rendues par le moteur
   * @param {string|null} contexte  `cleContexteDocument(...)`
   */
  setPropositions: (bloc, items, contexte = null) =>
    set({
      propositions: Array.isArray(items) ? items : [],
      blocPropose: String(bloc ?? ''),
      contexte,
      produitLe: Date.now(),
    }),

  /** ⛔ Patch d'un seul emplacement : régénérer une carte ne jette pas les autres. */
  remplacerProposition: (id, remplacante) =>
    set((s) => ({
      propositions: s.propositions.map((p) => (p.id === id ? remplacante : p)),
    })),

  retirerProposition: (id) =>
    set((s) => ({ propositions: s.propositions.filter((p) => p.id !== id) })),

  viderPropositions: () => set({ propositions: [], blocPropose: '' }),

  /** @param {any|null} brouillon */
  setBrouillon: (brouillon, contexte = null) =>
    set({ brouillon: brouillon ?? null, contexte, produitLe: Date.now() }),

  viderBrouillon: () => set({ brouillon: null }),

  /** Purge complète — n'est appelée que par un geste explicite de l'utilisateur. */
  toutOublier: () => set({ ...ETAT_VIDE }),

  /* ── Variantes de reformulation (API prête pour DocumentTextAiActions) ── */

  /**
   * @param {string} objetId
   * @param {{ label: string, intention: string|null, items: any[], source?: string }|null} payload
   */
  setVariantesTexte: (objetId, payload) =>
    set((s) => {
      if (!objetId) return s;
      const suivant = { ...s.variantesTexte };
      if (!payload) delete suivant[objetId];
      else suivant[objetId] = { ...payload, produitLe: Date.now() };
      return { variantesTexte: suivant };
    }),

  /** @param {string} objetId @returns {{label:string,intention:string|null,items:any[]}|null} */
  lireVariantesTexte: (objetId) => get().variantesTexte[objetId] ?? null,

  oublierVariantesTexte: (objetId) =>
    set((s) => {
      if (!(objetId in s.variantesTexte)) return s;
      const suivant = { ...s.variantesTexte };
      delete suivant[objetId];
      return { variantesTexte: suivant };
    }),
}));

export default useDocumentSuggestionsStore;
