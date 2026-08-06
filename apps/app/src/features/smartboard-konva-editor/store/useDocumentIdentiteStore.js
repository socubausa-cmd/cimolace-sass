/**
 * useDocumentIdentiteStore — les identités d'entreprise du créateur de document.
 *
 * ⛔ OÙ C'EST RANGÉ, SANS ENJOLIVER : dans le **localStorage du navigateur**.
 * J'ai cherché le chemin par tenant d'abord (c'est là que vivent déjà `social_apps`,
 * `booking_availability`, `settings.memberDiscounts`) : il n'existe AUCUN endpoint
 * atteignable depuis le front pour écrire une clé libre dans `tenants.metadata`.
 * `PATCH /tenants/current/settings` n'accepte que `requiresStudentDossier` et
 * `memberDiscounts` (DTO `UpdateTenantSettingsDto`, re-sanitisé dans
 * `TenantService.updateTenantSettings`) ; tout le reste passe par des contrôleurs
 * dédiés (branding, vocabulaire, os-knowledge, social). Écrire une identité d'entreprise
 * par tenant demande donc un lot API — il N'EST PAS FAIT.
 *
 * CONSÉQUENCE À DIRE À L'UTILISATEUR (le panneau l'affiche) : une identité saisie ici
 * ne suit pas l'utilisateur d'un poste à l'autre et n'est pas partagée entre les
 * membres de l'entreprise. Ce n'est pas une préférence d'implémentation, c'est une
 * limite du produit tant que l'API n'ouvre pas le chemin.
 *
 * {@link brancherStockageDistant} est le point d'accroche prévu pour ce jour-là :
 * il fonctionne (il est utilisé par `charger`/`sauver` dès qu'un adaptateur est
 * fourni), mais AUCUN appelant ne le branche aujourd'hui.
 *
 * ⚠️ Le logo n'est PAS copié dans le localStorage : on n'y garde que la forme durable
 * rendue par `uploadSmartboardCanvasImage` (bucket privé `smartboard-canvas`). Une URL
 * signée mise en cache ici expirerait et afficherait un 403 le lendemain.
 */
import { create } from 'zustand';
import {
  normaliserCollection,
  normaliserIdentite,
  listerIdentites as listerPur,
  identiteActive as activePur,
  enregistrerIdentite as enregistrerPur,
  supprimerIdentite as supprimerPur,
  definirIdentiteActive as definirActivePur,
} from '@/features/smartboard-konva-editor/lib/documentIdentite';

/** Clé de stockage. Le suffixe de version évite de lire un format futur incompatible. */
export const CLE_IDENTITES = 'liri_document_identites_v1';

const COLLECTION_VIDE = { identites: [], actifId: null };

/* ═══════════════════════════════════════════════════════════════════
   Persistance
═══════════════════════════════════════════════════════════════════ */

/** @type {{charger: () => Promise<object|null>, enregistrer: (etat:object) => Promise<void>} | null} */
let _distant = null;

/**
 * Branche un stockage partagé (API tenant) à la place du seul localStorage.
 * Le local reste écrit en second : il sert de cache hors-ligne.
 * @param {{charger:Function, enregistrer:Function}|null} adaptateur
 */
export function brancherStockageDistant(adaptateur) {
  _distant = adaptateur && typeof adaptateur.charger === 'function' && typeof adaptateur.enregistrer === 'function'
    ? adaptateur
    : null;
  return _distant;
}

function lireLocal() {
  try {
    if (typeof localStorage === 'undefined') return COLLECTION_VIDE;
    const brut = localStorage.getItem(CLE_IDENTITES);
    if (!brut) return COLLECTION_VIDE;
    return normaliserCollection(JSON.parse(brut));
  } catch {
    // Un JSON corrompu ne doit pas empêcher d'ouvrir le studio : on repart à vide
    // SANS écraser la valeur stockée (l'utilisateur peut encore la récupérer à la main).
    return COLLECTION_VIDE;
  }
}

function ecrireLocal(collection) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(CLE_IDENTITES, JSON.stringify(normaliserCollection(collection)));
    return true;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Store
═══════════════════════════════════════════════════════════════════ */

export const useDocumentIdentiteStore = create((set, get) => ({
  /** @type {{identites: object[], actifId: string|null}} */
  collection: COLLECTION_VIDE,
  charge: false,
  occupe: false,
  /** Dernière erreur d'écriture, à AFFICHER — une sauvegarde perdue en silence est un piège. */
  erreur: null,
  /** 'local' | 'distant' — ce que le panneau annonce à l'utilisateur. */
  source: 'local',

  /**
   * Charge les identités. Idempotent : un second appel ne relit rien.
   * @param {{force?:boolean}} [opts]
   */
  charger: async (opts = {}) => {
    if (get().charge && !opts.force) return get().collection;
    set({ occupe: true, erreur: null });
    let collection = lireLocal();
    let source = 'local';
    if (_distant) {
      try {
        const distant = await _distant.charger();
        if (distant) {
          collection = normaliserCollection(distant);
          source = 'distant';
          ecrireLocal(collection);
        }
      } catch (e) {
        set({ erreur: `Identités partagées indisponibles : ${e?.message || 'erreur réseau'}` });
      }
    }
    set({ collection, charge: true, occupe: false, source });
    return collection;
  },

  /** Applique une nouvelle collection : état + persistance. */
  _poser: async (collection) => {
    const propre = normaliserCollection(collection);
    set({ collection: propre, erreur: null });
    const okLocal = ecrireLocal(propre);
    if (!okLocal) set({ erreur: 'Enregistrement local impossible (stockage du navigateur refusé).' });
    if (_distant) {
      try {
        await _distant.enregistrer(propre);
      } catch (e) {
        set({ erreur: `Non synchronisé : ${e?.message || 'erreur réseau'}` });
      }
    }
    return propre;
  },

  /** Crée ou remplace une identité. @returns {Promise<object>} l'identité enregistrée */
  enregistrerIdentite: async (identite) => {
    const avant = get().collection;
    const idsAvant = new Set(avant.identites.map((x) => x.id));
    const apres = enregistrerPur(avant, identite);
    await get()._poser(apres);
    const n = normaliserIdentite(identite);
    return apres.identites.find((x) => (n.id ? x.id === n.id : !idsAvant.has(x.id))) ?? null;
  },

  supprimerIdentite: async (id) => get()._poser(supprimerPur(get().collection, id)),

  definirIdentiteActive: async (id) => get()._poser(definirActivePur(get().collection, id)),

  /* Lectures — les mêmes fonctions pures que les tests. */
  listerIdentites: () => listerPur(get().collection),
  identiteActive: () => activePur(get().collection),
}));

/* ── Sélecteurs (évitent de re-rendre le panneau sur chaque champ) ── */
export const selecteurCollection = (s) => s.collection;
export const selecteurIdentites = (s) => s.collection.identites;
export const selecteurActifId = (s) => s.collection.actifId;
