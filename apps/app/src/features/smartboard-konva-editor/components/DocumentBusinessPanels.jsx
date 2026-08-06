/**
 * Panneaux métier du Studio Document — Tableau, En-tête/Pied, Pages.
 *
 * Ces trois outils affichaient « Ces éléments ne sont pas encore disponibles dans le
 * Designer ». Les moteurs (documentTables.js, documentPagination.js) existaient déjà
 * mais n'avaient AUCUN importeur : rien ne les atteignait depuis l'écran. Ce fichier
 * est la coque qui les branche.
 *
 * ⛔ CONTRAINTE HISTORIQUE : toute mutation passe par `appliquerMutationDocument`,
 * qui empile UN SEUL `pushHistory` avant d'écrire. Sans ça, ajouter une ligne de devis
 * (1 ajout + 9 patches + recalcul) coûterait onze Ctrl+Z à l'utilisateur.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { LayoutGrid, Plus, Minus, RefreshCw, Calculator, BookOpen, AlertTriangle, FileStack, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import { DOC_PAGE, DOC_INK_SOFT } from '@/features/smartboard-konva-editor/lib/documentBlockLayout';
import {
  DEVISES,
  TAUX_TVA_COURANTS,
  TAUX_TVA_DEFAUT,
  DEVISE_DEFAUT,
  creerTableau,
  creerTableauDevis,
  ajouterLigne,
  supprimerLigne,
  recalculerTotaux,
  recalculerTousTotaux,
  signatureSources,
  tableauxChiffres,
  changerTauxTva,
  compterLignes,
  fusionProfonde,
} from '@/features/smartboard-konva-editor/lib/documentTables';
import {
  FORMATS_PAGE,
  formatDepuisCanevas,
  MARGES_DEFAUT,
  paginer,
  patchesDePagination,
  insererSautDePage,
  remplacerEntetePied,
  configDepuisBandes,
  reserveDesBandes,
  estEntetePied,
  estSautDePage,
} from '@/features/smartboard-konva-editor/lib/documentPagination';

/* ═══════════════════════════════════════════════════════════════════
   Écriture dans le store — un seul pas d'historique par action
═══════════════════════════════════════════════════════════════════ */

let _seqAjout = 0;
function idAjout(prefixe = 'doc') {
  _seqAjout += 1;
  return `${prefixe}_${Date.now().toString(36)}${_seqAjout.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Applique ajouts + patches + suppressions à la scène active en UN pas d'historique.
 *
 * ⚠️ Les patches sont appliqués APRÈS la concaténation des ajouts : `ajouterLigne`
 * renvoie des patches qui visent ses propres ajouts (le total de la ligne neuve).
 * Les appliquer avant les aurait silencieusement perdus.
 *
 * @param {{ajouts?: object[], patches?: {id:string,patch:object}[], suppressions?: string[],
 *          canvas?: {width?:number, height?:number}, selectionner?: boolean,
 *          historique?: boolean}} mutation
 * @returns {boolean} vrai si quelque chose a réellement changé
 */
export function appliquerMutationDocument(mutation = {}) {
  const ajouts = (mutation.ajouts ?? []).filter(Boolean).map((o) => (o?.id ? o : { ...o, id: idAjout(o?.type || 'obj') }));
  const patches = (mutation.patches ?? []).filter((p) => p?.id);
  const suppressions = new Set((mutation.suppressions ?? []).filter(Boolean));
  const canvas = mutation.canvas ?? null;
  if (!ajouts.length && !patches.length && !suppressions.size && !canvas) return false;

  const store = useSmartboardKonvaStore.getState();
  // ⛔ `historique: false` est réservé aux écritures qui ne sont que la CONSÉQUENCE
  // d'une action déjà empilée (recalcul automatique des totaux). Empiler un pas de
  // plus obligerait à deux Ctrl+Z pour annuler une seule frappe.
  if (mutation.historique !== false) store.pushHistory();

  const parId = new Map();
  for (const p of patches) parId.set(p.id, p.patch);

  useSmartboardKonvaStore.setState((state) => {
    const scenes = state.project.scenes.map((s) => {
      if (s.id !== state.project.activeSceneId) return s;
      const fusion = [...s.objects, ...ajouts]
        .filter((o) => !suppressions.has(o.id))
        .map((o) => (parId.has(o.id) ? fusionProfonde(o, parId.get(o.id)) : o));
      return { ...s, objects: fusion };
    });
    const project = { ...state.project, scenes };
    if (canvas) {
      project.canvas = {
        ...state.project.canvas,
        ...(Number.isFinite(canvas.width) ? { width: Math.round(canvas.width) } : {}),
        ...(Number.isFinite(canvas.height) ? { height: Math.round(canvas.height) } : {}),
      };
    }
    const ids = ajouts.map((o) => o.id);
    return {
      project,
      selectedIds: mutation.selectionner === false ? state.selectedIds : (ids.length ? ids : state.selectedIds.filter((x) => !suppressions.has(x))),
    };
  });
  return true;
}

/* ═══════════════════════════════════════════════════════════════════
   Recalcul AUTOMATIQUE des totaux — [TOTAUX-1]
═══════════════════════════════════════════════════════════════════ */

/** Laisse la frappe se poser avant d'écrire ; assez court pour être perçu comme immédiat. */
const DELAI_RECALCUL_MS = 200;

/**
 * L'éditeur inline du canevas (SmartboardKonvaEditorV1) : tant qu'il est monté,
 * l'utilisateur TAPE. Écrire dans la scène à ce moment-là re-rendrait le calque et
 * lui reprendrait le focus au milieu d'un mot.
 */
const SELECTEUR_EDITION_CANEVAS = 'textarea[aria-label="Edition texte sur le canvas"]';

let _minuteurRecalcul = null;
let _signaturesTableaux = new Map();
let _dernierObjetsVus = null;
let _abonnementRecalcul = null;

function editionCanevasOuverte() {
  return typeof document !== 'undefined' && Boolean(document.querySelector(SELECTEUR_EDITION_CANEVAS));
}

function objetsSceneActive(state) {
  const p = state?.project;
  if (!p) return null;
  return p.scenes?.find((s) => s.id === p.activeSceneId)?.objects ?? null;
}

function appliquerRecalculAuto() {
  _minuteurRecalcul = null;
  if (editionCanevasOuverte()) {
    // On ne renonce pas : on réessaie dès que l'éditeur se referme.
    _minuteurRecalcul = setTimeout(appliquerRecalculAuto, DELAI_RECALCUL_MS);
    return;
  }
  const objets = objetsSceneActive(useSmartboardKonvaStore.getState());
  if (!objets?.length) return;
  const { patches } = recalculerTousTotaux(objets);
  if (!patches.length) return;
  appliquerMutationDocument({ patches, selectionner: false, historique: false });
}

/**
 * Observe les cellules SOURCES et déclenche le recalcul. Ne recalcule JAMAIS sur
 * une modification des cellules de total : {@link signatureSources} les exclut,
 * c'est ce qui interdit la boucle infinie.
 */
function surChangementStore(state) {
  const objets = objetsSceneActive(state);
  if (!objets || objets === _dernierObjetsVus) return;   // sélection, zoom, outil : rien à voir
  _dernierObjetsVus = objets;

  const ids = tableauxChiffres(objets);
  const vus = new Set(ids);
  for (const id of [..._signaturesTableaux.keys()]) {
    if (!vus.has(id)) _signaturesTableaux.delete(id);
  }
  let aRecalculer = false;
  for (const id of ids) {
    const signature = signatureSources(objets, id);
    const avant = _signaturesTableaux.get(id);
    _signaturesTableaux.set(id, signature);
    // ⛔ Première rencontre = simple mémorisation. Recalculer à l'OUVERTURE d'un
    // document réécrirait des totaux que l'utilisateur a peut-être ajustés à la main.
    if (avant !== undefined && avant !== signature) aRecalculer = true;
  }
  if (!aRecalculer) return;
  if (_minuteurRecalcul) clearTimeout(_minuteurRecalcul);
  _minuteurRecalcul = setTimeout(appliquerRecalculAuto, DELAI_RECALCUL_MS);
}

/**
 * Branche l'observateur. Idempotent, et appelé au CHARGEMENT du module : le
 * recalcul ne doit pas dépendre de l'ouverture du panneau Tableau — l'utilisateur
 * remplit son devis avec l'outil Sélection, pas avec le rail ouvert.
 */
export function brancherRecalculAutoTotaux() {
  if (_abonnementRecalcul) return _abonnementRecalcul;
  _abonnementRecalcul = useSmartboardKonvaStore.subscribe(surChangementStore);
  return _abonnementRecalcul;
}

brancherRecalculAutoTotaux();

/** Objets de la scène active (lecture seule). */
function useObjetsScene() {
  const scenes = useSmartboardKonvaStore((s) => s.project?.scenes ?? []);
  const activeSceneId = useSmartboardKonvaStore((s) => s.project?.activeSceneId);
  return useMemo(
    () => scenes.find((s) => s.id === activeSceneId)?.objects ?? [],
    [scenes, activeSceneId],
  );
}

/**
 * Format de page déduit du canevas — évite un nouvel état à synchroniser.
 * ⛔ La lecture passe par `formatDepuisCanevas` (largeur ET hauteur) : lue à la
 * largeur seule, A4 portrait et A5 paysage (794 px tous les deux) se confondaient
 * et l'aller-retour A5 paysage → A4 portrait perdait une page de canevas.
 */
function useFormatPage() {
  const w = useSmartboardKonvaStore((s) => s.project?.canvas?.width ?? DOC_PAGE.width);
  const h = useSmartboardKonvaStore((s) => s.project?.canvas?.height ?? DOC_PAGE.height);
  return useMemo(() => {
    const format = formatDepuisCanevas(w, h) ?? FORMATS_PAGE.a4_portrait;
    const nbPages = Math.max(1, Math.round(h / format.hauteur));
    return { cle: format.id, format, nbPages, largeurCanevas: w, hauteurCanevas: h };
  }, [w, h]);
}

/**
 * Ordonnée libre sous le contenu existant.
 *
 * ⛔ Les bandes récurrentes sont EXCLUES du calcul : le pied de la dernière page se
 * trouve tout en bas du canevas, s'en servir de repère posait le nouveau bloc
 * hors page. Elles servent en revanche de PLANCHER (rien sous l'en-tête).
 */
function prochaineOrdonnee(objets, cleFormat = 'a4_portrait') {
  const reserve = reserveDesBandes(objets, cleFormat);
  const plancher = Math.max(DOC_PAGE.marginTop, Math.round(reserve.haut));
  const bas = objets.reduce((m, o) => {
    if (estEntetePied(o) || estSautDePage(o)) return m;
    return Number.isFinite(o?.y) ? Math.max(m, (o.y || 0) + (o.height || 0)) : m;
  }, 0);
  return bas > 0 ? Math.max(plancher, Math.round(bas + 28)) : plancher;
}

/**
 * Bandes régénérées pour un nouveau nombre de pages / un nouveau format, à partir
 * de celles DÉJÀ posées. Rend une mutation vide s'il n'y en a aucune.
 *
 * ⛔ Sans ça, « Ajouter une page » laissait la page neuve sans en-tête et il fallait
 * TOUT retaper dans l'outil En-tête pour la couvrir.
 *
 * ⚠️ Les `patches` de réservation voyagent avec les ajouts : les oublier ici
 * ramènerait le recouvrement en-tête × corps dès un changement de format.
 */
function mutationBandesPour(objets, cleFormat, nbPagesCible) {
  const cfg = configDepuisBandes(objets, cleFormat);
  if (!cfg) return { ajouts: [], patches: [], suppressions: [], conflitsBas: [] };
  const res = remplacerEntetePied(objets, {
    ...cfg,
    nbPages: Math.max(1, nbPagesCible),
    format: cleFormat,
    marges: MARGES_DEFAUT,
  });
  return {
    ajouts: res.ajouts,
    patches: res.patches,
    suppressions: res.suppressions,
    conflitsBas: res.conflitsBas ?? [],
    pagesBloquees: res.pagesBloquees ?? [],
  };
}

/**
 * Phrase qui REND VISIBLE le déplacement provoqué par la pose des bandes.
 * ⛔ Un glissement silencieux du contenu déjà saisi est interdit : l'utilisateur
 * doit lire ce qui a bougé et savoir que Ctrl+Z le rend.
 */
function phraseReserve(res) {
  const bouges = res?.patches?.length ?? 0;
  const bas = new Set(res?.conflitsBas ?? []).size;
  const bloquees = res?.pagesBloquees ?? [];
  const bouts = [];
  if (bouges) bouts.push(`${bouges} bloc(s) descendus sous l'en-tête (Ctrl+Z annule tout)`);
  if (bloquees.length) {
    bouts.push(`page(s) ${bloquees.join(', ')} trop pleine(s) : rien n'a pu descendre, lancez « Réorganiser en pages »`);
  } else if (bas) {
    bouts.push(`${bas} bloc(s) touchent la zone du pied : lancez « Réorganiser en pages »`);
  }
  return bouts.length ? ` ${bouts.join(' · ')}.` : '';
}

/* ═══════════════════════════════════════════════════════════════════
   Briques d'interface communes (largeur du rail : 210 px)
═══════════════════════════════════════════════════════════════════ */

const CLS_BTN = 'flex w-full items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-2.5 py-2 text-left text-[11px] font-medium text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35';
const CLS_BTN_ACCENT = 'flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#d4924a]/35 bg-[#d4924a]/15 px-2.5 py-2 text-[11px] font-semibold text-[#ecc98f] transition-all hover:bg-[#d4924a]/25 disabled:cursor-not-allowed disabled:opacity-35';
const CLS_INPUT = 'w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10.5px] text-white/85 placeholder:text-white/25 focus:border-[#d4924a]/40 focus:outline-none';
const CLS_LABEL = 'block text-[9px] font-bold uppercase tracking-[0.14em] text-white/30';

function Section({ titre, children }) {
  return (
    <div className="space-y-1.5">
      <p className={CLS_LABEL}>{titre}</p>
      {children}
    </div>
  );
}

function Note({ children, ton = 'neutre' }) {
  return (
    <p
      className={cn(
        'rounded-lg border px-2 py-1.5 text-[9px] leading-snug',
        ton === 'alerte'
          ? 'border-amber-500/25 bg-amber-500/[0.07] text-amber-100/85'
          : 'border-white/[0.07] bg-white/[0.02] text-white/40',
      )}
    >
      {children}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TABLEAU
═══════════════════════════════════════════════════════════════════ */

const GRILLES = [
  { id: '2x2', cols: 2, lignes: 2, label: '2 × 2' },
  { id: '3x3', cols: 3, lignes: 3, label: '3 × 3' },
  { id: '4x4', cols: 4, lignes: 4, label: '4 × 4' },
  { id: '5x8', cols: 5, lignes: 8, label: '5 × 8' },
];

export function DocumentTablePanel() {
  const objets = useObjetsScene();
  const { cle } = useFormatPage();
  const selectedIds = useSmartboardKonvaStore((s) => s.selectedIds);
  const [tauxTva, setTauxTva] = useState(TAUX_TVA_DEFAUT);
  const [devise, setDevise] = useState(DEVISE_DEFAUT);
  const [nbLignesDevis, setNbLignesDevis] = useState(4);
  const [message, setMessage] = useState('');

  /** Tableau visé : celui de la sélection, sinon le dernier posé. */
  const tableIdCible = useMemo(() => {
    const parSelection = objets.find((o) => selectedIds.includes(o.id) && o?.meta?.tableId);
    if (parSelection) return parSelection.meta.tableId;
    const cadres = objets.filter((o) => o?.meta?.doc === 'tableau' && o?.meta?.role === 'cadre');
    return cadres.length ? cadres[cadres.length - 1].meta.tableId : null;
  }, [objets, selectedIds]);

  const nbLignesCible = useMemo(
    () => (tableIdCible ? compterLignes(objets, tableIdCible) : 0),
    [objets, tableIdCible],
  );
  const estDevis = useMemo(
    () => Boolean(tableIdCible && objets.some((o) => o?.meta?.tableId === tableIdCible && o?.meta?.role === 'total-valeur')),
    [objets, tableIdCible],
  );

  const poserGrille = useCallback((g) => {
    const y = prochaineOrdonnee(objets, cle);
    const { objects } = creerTableau({
      colonnes: Array.from({ length: g.cols }, (_, i) => `Colonne ${String.fromCharCode(65 + i)}`),
      lignes: Array.from({ length: g.lignes }, () => []),
      x: DOC_PAGE.marginX,
      y,
      largeur: DOC_PAGE.contentWidth,
    });
    appliquerMutationDocument({ ajouts: objects });
    setMessage(`Tableau ${g.label} posé à y = ${y}.`);
  }, [objets, cle]);

  const poserDevis = useCallback(() => {
    const y = prochaineOrdonnee(objets, cle);
    const { objects } = creerTableauDevis({
      lignesVides: Math.max(1, nbLignesDevis),
      tauxTva,
      devise,
      x: DOC_PAGE.marginX,
      y,
      largeur: DOC_PAGE.contentWidth,
    });
    appliquerMutationDocument({ ajouts: objects });
    setMessage(`Devis ${devise} · TVA ${tauxTva} % posé. Double-cliquez une cellule pour la remplir : les totaux suivent la saisie.`);
  }, [objets, nbLignesDevis, tauxTva, devise, cle]);

  const surAjouterLigne = useCallback(() => {
    if (!tableIdCible) return;
    const res = ajouterLigne(objets, { tableId: tableIdCible });
    if (!res.ajouts.length && !res.patches.length) { setMessage('Aucune ligne ajoutée.'); return; }
    appliquerMutationDocument({ ...res, selectionner: false });
    setMessage(`Ligne ${nbLignesCible + 1} ajoutée.`);
  }, [objets, tableIdCible, nbLignesCible]);

  const surSupprimerLigne = useCallback(() => {
    if (!tableIdCible || nbLignesCible <= 0) return;
    const res = supprimerLigne(objets, nbLignesCible - 1, tableIdCible);
    if (!res.suppressions.length) { setMessage('Aucune ligne supprimée.'); return; }
    appliquerMutationDocument({ ...res, selectionner: false });
    setMessage(`Dernière ligne supprimée (${nbLignesCible - 1} restante(s)).`);
  }, [objets, tableIdCible, nbLignesCible]);

  const surRecalculer = useCallback(() => {
    if (!tableIdCible) return;
    const res = recalculerTotaux(objets, tableIdCible);
    if (!res.patches.length) {
      const t = recalculerTotaux(objets, tableIdCible).totaux;
      setMessage(estDevis
        ? `Déjà à jour : ${t.totalTTC} ${t.devise} TTC (HT ${t.totalHT} · TVA ${t.tauxTva} %).`
        : 'Rien à recalculer (aucun bloc de totaux).');
      return;
    }
    appliquerMutationDocument({ patches: res.patches, selectionner: false });
    const t = res.totaux;
    setMessage(`Total TTC recalculé : ${t.totalTTC} ${t.devise} (HT ${t.totalHT} · TVA ${t.tauxTva} %).`);
  }, [objets, tableIdCible, estDevis]);

  const surChangerTva = useCallback((valeur) => {
    setTauxTva(valeur);
    if (!tableIdCible || !estDevis) return;
    const res = changerTauxTva(objets, valeur, tableIdCible);
    if (!res.patches?.length) return;
    appliquerMutationDocument({ patches: res.patches, selectionner: false });
    setMessage(`TVA passée à ${valeur} % — totaux réécrits.`);
  }, [objets, tableIdCible, estDevis]);

  return (
    <div className="space-y-3.5 px-1 pb-3">
      <Section titre="Grille simple">
        <div className="grid grid-cols-2 gap-1.5">
          {GRILLES.map((g) => (
            <button key={g.id} type="button" onClick={() => poserGrille(g)} className={CLS_BTN}>
              <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-amber-300/70" />
              <span>{g.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section titre="Devis / Facture (chiffré)">
        <div className="grid grid-cols-2 gap-1.5">
          <label className="space-y-1">
            <span className="block text-[9px] text-white/35">TVA</span>
            <select value={tauxTva} onChange={(e) => surChangerTva(Number(e.target.value))} className={CLS_INPUT}>
              {TAUX_TVA_COURANTS.map((t) => (
                <option key={t.taux} value={t.taux} title={t.libelle}>{`${t.taux} %`}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[9px] text-white/35">Devise</span>
            <select value={devise} onChange={(e) => setDevise(e.target.value)} className={CLS_INPUT}>
              {Object.keys(DEVISES).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="space-y-1">
          <span className="block text-[9px] text-white/35">Lignes vierges</span>
          <input
            type="number" min={1} max={30} value={nbLignesDevis}
            onChange={(e) => setNbLignesDevis(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            className={CLS_INPUT}
          />
        </label>
        <button type="button" onClick={poserDevis} className={CLS_BTN_ACCENT}>
          <Calculator className="h-3.5 w-3.5" />
          Poser le tableau chiffré
        </button>
      </Section>

      <Section titre={tableIdCible ? `Tableau ciblé · ${nbLignesCible} ligne(s)` : 'Tableau ciblé'}>
        {!tableIdCible ? (
          <Note>Aucun tableau sur la page. Posez-en un ci-dessus — la cible suit ensuite votre sélection.</Note>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={surAjouterLigne} className={CLS_BTN}>
                <Plus className="h-3.5 w-3.5 shrink-0 text-[#7bb06a]" />
                <span>Ligne</span>
              </button>
              <button type="button" onClick={surSupprimerLigne} disabled={nbLignesCible <= 0} className={CLS_BTN}>
                <Minus className="h-3.5 w-3.5 shrink-0 text-rose-300/80" />
                <span>Retirer</span>
              </button>
            </div>
            <button type="button" onClick={surRecalculer} disabled={!estDevis} className={CLS_BTN}>
              <RefreshCw className="h-3.5 w-3.5 shrink-0 text-amber-300/80" />
              <span>{estDevis ? 'Recalculer (filet)' : 'Totaux — tableau non chiffré'}</span>
            </button>
            {estDevis ? (
              <Note>
                Les totaux se recalculent SEULS à la validation d&apos;une cellule (⌘⏎ ou clic ailleurs) :
                ils se lisent sur les cellules affichées, pas sur un modèle caché. « Recalculer » reste
                le filet si vous doutez.
              </Note>
            ) : null}
          </>
        )}
      </Section>

      {message ? <Note>{message}</Note> : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EN-TÊTE / PIED / NUMÉROTATION
═══════════════════════════════════════════════════════════════════ */

const GABARIT_NUMERO = 'Page {{page}} / {{pages}}';

/**
 * ⛔ [ENTETE-1] Les champs vivaient dans l'état LOCAL du panneau : changer d'outil
 * le démontait et vidait la saisie — après « Ajouter une page », il fallait retaper
 * l'en-tête entier. Cette mémoire de module survit au démontage ; la source la plus
 * fiable reste toutefois le canevas lui-même (`configDepuisBandes`).
 */
const _memoireBandes = { enTete: '', pied: '', numerotation: true, gabarit: GABARIT_NUMERO };

export function DocumentHeaderFooterPanel() {
  const objets = useObjetsScene();
  const { cle, format, nbPages } = useFormatPage();
  /* Relu UNE fois au montage : ce qui est posé sur la page prime sur la mémoire. */
  const [enTete, poserEnTete] = useState(() => configDepuisBandes(objets, cle)?.enTete?.texte ?? _memoireBandes.enTete);
  const [pied, poserPied] = useState(() => configDepuisBandes(objets, cle)?.pied?.texte ?? _memoireBandes.pied);
  const [numerotation, poserNumerotation] = useState(() => {
    const cfg = configDepuisBandes(objets, cle);
    return cfg ? Boolean(cfg.numerotation) : _memoireBandes.numerotation;
  });
  const [gabarit, poserGabarit] = useState(
    () => configDepuisBandes(objets, cle)?.numerotation?.gabarit ?? _memoireBandes.gabarit,
  );
  const [message, setMessage] = useState('');

  /* Écriture traversante : l'état local ET la mémoire de module, jamais l'un sans l'autre. */
  const setEnTete = useCallback((v) => { _memoireBandes.enTete = v; poserEnTete(v); }, []);
  const setPied = useCallback((v) => { _memoireBandes.pied = v; poserPied(v); }, []);
  const setNumerotation = useCallback((v) => { _memoireBandes.numerotation = v; poserNumerotation(v); }, []);
  const setGabarit = useCallback((v) => { _memoireBandes.gabarit = v; poserGabarit(v); }, []);

  const bandesPosees = useMemo(() => objets.filter(estEntetePied).length, [objets]);

  const appliquer = useCallback(() => {
    const res = remplacerEntetePied(objets, {
      enTete: enTete.trim() ? { texte: enTete.trim(), align: 'left' } : null,
      pied: pied.trim() ? { texte: pied.trim(), align: 'center' } : null,
      numerotation: numerotation ? { gabarit, align: 'right', position: 'pied' } : false,
      nbPages,
      format: cle,
      marges: MARGES_DEFAUT,
    });
    if (!res.ajouts.length && !res.suppressions.length) {
      setMessage('Rien à appliquer : renseignez un en-tête, un pied ou la numérotation.');
      return;
    }
    appliquerMutationDocument({ ...res, selectionner: false });
    setMessage(`${res.ajouts.length} bande(s) posée(s) sur ${nbPages} page(s).${phraseReserve(res)}`);
  }, [objets, enTete, pied, numerotation, gabarit, nbPages, cle]);

  const retirer = useCallback(() => {
    const suppressions = objets.filter(estEntetePied).map((o) => o.id);
    if (!suppressions.length) { setMessage('Aucune bande à retirer.'); return; }
    appliquerMutationDocument({ suppressions, selectionner: false });
    setMessage(`${suppressions.length} bande(s) retirée(s).`);
  }, [objets]);

  const poserDate = useCallback(() => {
    const texte = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    // ⛔ Posée dans la MARGE (y = marge haute − 34), la mention était dénoncée par la
    // critique de l'appli comme mordant la marge. Elle entre dans le flux du corps.
    const y = prochaineOrdonnee(objets, cle);
    appliquerMutationDocument({
      ajouts: [{
        type: 'text',
        x: DOC_PAGE.marginX, y, width: DOC_PAGE.contentWidth, height: 20,
        rotation: 0, layer: 2, visible: true, locked: false, step: 0, visibleFor: 'both', opacity: 1,
        content: { text: `Fait le ${texte}` },
        style: { fontFamily: 'Georgia, serif', fontSize: 10, fill: DOC_INK_SOFT, align: 'right', lineHeight: 1.4 },
      }],
    });
    setMessage('Date insérée — figée à l\'insertion, elle ne se met pas à jour toute seule.');
  }, [objets, cle]);

  return (
    <div className="space-y-3.5 px-1 pb-3">
      <Section titre={`Bandes récurrentes · ${nbPages} page(s)`}>
        <label className="space-y-1">
          <span className="block text-[9px] text-white/35">En-tête (haut de chaque page)</span>
          <input value={enTete} onChange={(e) => setEnTete(e.target.value)} placeholder="Ex : Cabinet Dupont — Confidentiel" className={CLS_INPUT} />
        </label>
        <label className="space-y-1">
          <span className="block text-[9px] text-white/35">Pied de page</span>
          <input value={pied} onChange={(e) => setPied(e.target.value)} placeholder="Ex : 12 rue des Lilas · SIRET …" className={CLS_INPUT} />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5">
          <input type="checkbox" checked={numerotation} onChange={(e) => setNumerotation(e.target.checked)} className="h-3 w-3 accent-[#d4924a]" />
          <span className="text-[10px] text-white/60">Numéroter les pages</span>
        </label>
        {numerotation ? (
          <label className="space-y-1">
            <span className="block text-[9px] text-white/35">Gabarit — jetons {'{{page}}'} et {'{{pages}}'}</span>
            <input value={gabarit} onChange={(e) => setGabarit(e.target.value)} className={CLS_INPUT} />
          </label>
        ) : null}
        <button type="button" onClick={appliquer} className={CLS_BTN_ACCENT}>
          <BookOpen className="h-3.5 w-3.5" />
          Appliquer sur {nbPages} page(s)
        </button>
        <button type="button" onClick={retirer} disabled={bandesPosees === 0} className={CLS_BTN}>
          <Trash2 className="h-3.5 w-3.5 shrink-0 text-rose-300/80" />
          <span>Retirer les bandes ({bandesPosees})</span>
        </button>
        <Note>
          Réappliquer remplace les bandes existantes : elles ne s&apos;empilent pas. Une page ajoutée
          depuis l&apos;outil Pages est couverte automatiquement — rien à retaper ({format.largeur}×{format.hauteur}).
        </Note>
      </Section>

      <Section titre="Mention datée">
        <button type="button" onClick={poserDate} className={CLS_BTN}>
          <Plus className="h-3.5 w-3.5 shrink-0 text-[#e0a458]" />
          <span>Insérer la date du jour</span>
        </button>
      </Section>

      {message ? <Note>{message}</Note> : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGES / PAGINATION
═══════════════════════════════════════════════════════════════════ */

const LIBELLES_FORMAT = {
  a4_portrait: 'A4 portrait',
  a4_paysage: 'A4 paysage',
  a5_portrait: 'A5 portrait',
  a5_paysage: 'A5 paysage',
  letter_portrait: 'Letter portrait',
  letter_paysage: 'Letter paysage',
};

export function DocumentPagePanel() {
  const objets = useObjetsScene();
  const { cle, format, nbPages, hauteurCanevas } = useFormatPage();
  const [message, setMessage] = useState('');

  const diag = useMemo(() => {
    try {
      return paginer(objets, cle, MARGES_DEFAUT);
    } catch {
      return null;
    }
  }, [objets, cle]);

  const pagesNecessaires = Math.max(1, diag?.nbPages ?? 1);

  const changerFormat = useCallback((nouvelleCle) => {
    const f = FORMATS_PAGE[nouvelleCle];
    if (!f) return;
    // La largeur utile et le bas de page changent : les bandes sont refaites au format.
    const bandes = mutationBandesPour(objets, nouvelleCle, nbPages);
    appliquerMutationDocument({
      ...bandes,
      canvas: { width: f.largeur, height: f.hauteur * nbPages },
      selectionner: false,
    });
    setMessage(`${LIBELLES_FORMAT[nouvelleCle] ?? nouvelleCle} — ${nbPages} page(s). Les objets ne bougent pas : lancez « Réorganiser en pages » si besoin.${phraseReserve(bandes)}`);
  }, [objets, nbPages]);

  const ajouterPage = useCallback(() => {
    const bandes = mutationBandesPour(objets, cle, nbPages + 1);
    appliquerMutationDocument({
      ...bandes,
      canvas: { height: hauteurCanevas + format.hauteur },
      selectionner: false,
    });
    setMessage(bandes.ajouts.length
      ? `Page ${nbPages + 1} ajoutée — en-tête/pied reportés dessus (${bandes.ajouts.length} bande(s)).${phraseReserve(bandes)}`
      : `Page ${nbPages + 1} ajoutée.`);
  }, [objets, cle, hauteurCanevas, format.hauteur, nbPages]);

  const retirerPage = useCallback(() => {
    if (nbPages <= 1) return;
    // Les bandes de la page retirée seraient restées HORS canevas : on les régénère.
    const bandes = mutationBandesPour(objets, cle, nbPages - 1);
    appliquerMutationDocument({
      ...bandes,
      canvas: { height: Math.max(format.hauteur, hauteurCanevas - format.hauteur) },
      selectionner: false,
    });
    setMessage(`Page ${nbPages} retirée du canevas — les objets qui s'y trouvaient ne sont PAS supprimés, ils dépassent maintenant.${phraseReserve(bandes)}`);
  }, [objets, cle, nbPages, hauteurCanevas, format.hauteur]);

  const poserSaut = useCallback(() => {
    const y = prochaineOrdonnee(objets, cle);
    const { ajouts } = insererSautDePage(objets, y, { format: cle, marges: MARGES_DEFAUT });
    appliquerMutationDocument({ ajouts });
    setMessage(`Saut de page posé à y = ${y}. « Réorganiser en pages » fera descendre la suite.`);
  }, [objets, cle]);

  /**
   * Repagine : recale le corps dans la zone imprimable de sa page et allonge le
   * canevas de ce qu'il manque.
   *
   * ⛔ Le canevas n'est jamais RÉTRÉCI. L'ancienne version le ramenait au nombre de
   * pages que le contenu réclame : une page laissée vide exprès (verso d'un contrat,
   * page 2 d'un devis) disparaissait sans que personne ne l'ait demandé, en emportant
   * ses bandes hors champ. « Retirer la dernière page » est l'outil pour ça, et la
   * page en trop est désormais SIGNALÉE au lieu d'être supprimée.
   *
   * ⚠️ Les patches de réservation de `mutationBandesPour` sont volontairement écartés :
   * `paginer` applique déjà le plancher des bandes, et ces patches-là ont été calculés
   * sur les positions d'AVANT la repagination — ils se battraient avec elle.
   */
  const reorganiser = useCallback(() => {
    const corps = objets.filter((o) => !estEntetePied(o));
    if (!corps.length) {
      setMessage('Page vide : rien à réorganiser. Posez un bloc, un tableau ou un modèle d\'abord.');
      return;
    }
    const res = paginer(objets, cle, MARGES_DEFAUT);
    const patches = patchesDePagination(res, {});
    const pagesCible = Math.max(nbPages, res.nbPages);
    const hauteurCible = pagesCible * format.hauteur;
    const bandes = pagesCible > nbPages
      ? mutationBandesPour(objets, cle, pagesCible)
      : { ajouts: [], suppressions: [] };

    if (!patches.length && hauteurCible === hauteurCanevas && !bandes.ajouts.length) {
      const vides = nbPages - res.nbPages;
      setMessage(vides > 0
        ? `Déjà organisé : le contenu tient sur ${res.nbPages} page(s) et chaque bloc est dans sa zone. ${vides} page(s) du canevas reste(nt) vide(s) — « Retirer la dernière page » les enlève.`
        : `Déjà organisé : ${res.nbPages} page(s), aucun bloc à recaler.`);
      return;
    }

    appliquerMutationDocument({
      patches,
      ajouts: bandes.ajouts,
      suppressions: bandes.suppressions,
      canvas: { height: hauteurCible },
      selectionner: false,
    });
    const bouts = [];
    if (patches.length) bouts.push(`${patches.length} bloc(s) recalé(s)`);
    if (pagesCible > nbPages) bouts.push(`canevas allongé à ${pagesCible} page(s)`);
    if (bandes.ajouts.length) bouts.push(`en-tête/pied reportés (${bandes.ajouts.length} bande(s))`);
    if (!bouts.length) bouts.push(`canevas remis à ${pagesCible} page(s)`);
    setMessage(`${bouts.join(' · ')}. Ctrl+Z annule.`);
  }, [objets, cle, format.hauteur, hauteurCanevas, nbPages]);

  const dupliquerDernierePage = useCallback(() => {
    const res = paginer(objets, cle, MARGES_DEFAUT);
    const derniere = res.nbPages - 1;
    const idsPage = new Set(
      res.placements.filter((p) => p.page === derniere).map((p) => p.id),
    );
    const source = objets.filter(
      (o) => idsPage.has(o.id) && !estEntetePied(o) && !estSautDePage(o),
    );
    if (!source.length) { setMessage('Dernière page vide : rien à dupliquer.'); return; }
    const pas = format.hauteur;
    const ajouts = source.map((o) => ({
      ...JSON.parse(JSON.stringify(o)),
      id: idAjout(o.type || 'obj'),
      y: (o.y ?? 0) + pas,
    }));
    const bandes = mutationBandesPour(objets, cle, nbPages + 1);
    appliquerMutationDocument({
      ajouts: [...ajouts, ...bandes.ajouts],
      patches: bandes.patches,
      suppressions: bandes.suppressions,
      canvas: { height: hauteurCanevas + pas },
    });
    setMessage(`${ajouts.length} objet(s) recopié(s) sur une nouvelle page${bandes.ajouts.length ? ', en-tête/pied reportés' : ''}.${phraseReserve(bandes)}`);
  }, [objets, cle, format.hauteur, hauteurCanevas, nbPages]);

  return (
    <div className="space-y-3.5 px-1 pb-3">
      <Section titre="Format de page">
        <select value={cle} onChange={(e) => changerFormat(e.target.value)} className={CLS_INPUT}>
          {Object.keys(FORMATS_PAGE).map((k) => (
            <option key={k} value={k}>{LIBELLES_FORMAT[k] ?? k}</option>
          ))}
        </select>
        <Note>
          Canevas : {format.largeur} × {hauteurCanevas} px — {nbPages} page(s) de {format.hauteur} px.
        </Note>
      </Section>

      <Section titre="Pages">
        <button type="button" onClick={ajouterPage} className={CLS_BTN}>
          <Plus className="h-3.5 w-3.5 shrink-0 text-[#7bb06a]" />
          <span>Ajouter une page</span>
        </button>
        <button type="button" onClick={dupliquerDernierePage} className={CLS_BTN}>
          <Copy className="h-3.5 w-3.5 shrink-0 text-[#e0a458]" />
          <span>Dupliquer la dernière page</span>
        </button>
        <button type="button" onClick={retirerPage} disabled={nbPages <= 1} className={CLS_BTN}>
          <Minus className="h-3.5 w-3.5 shrink-0 text-rose-300/80" />
          <span>Retirer la dernière page</span>
        </button>
      </Section>

      <Section titre="Flux">
        <button type="button" onClick={poserSaut} className={CLS_BTN}>
          <FileStack className="h-3.5 w-3.5 shrink-0 text-[#e0a458]" />
          <span>Saut de page ici</span>
        </button>
        <button type="button" onClick={reorganiser} className={CLS_BTN_ACCENT}>
          <RefreshCw className="h-3.5 w-3.5" />
          Réorganiser en pages
        </button>
      </Section>

      {diag && pagesNecessaires > nbPages ? (
        <Note ton="alerte">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          Le contenu réclame {pagesNecessaires} page(s), le canevas n&apos;en montre que {nbPages}.
        </Note>
      ) : null}
      {diag && diag.debordements.length ? (
        <Note ton="alerte">
          {diag.debordements.length} objet(s) plus haut(s) qu&apos;une page : la pagination ne peut pas les couper.
        </Note>
      ) : null}

      {message ? <Note>{message}</Note> : null}
    </div>
  );
}
