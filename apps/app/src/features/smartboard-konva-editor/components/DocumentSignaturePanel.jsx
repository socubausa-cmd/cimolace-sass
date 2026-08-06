/**
 * DocumentSignaturePanel — apposer une signature sur le document, par TROIS voies :
 * tracée à la main, téléversée (photo / scan), ou dactylographiée.
 *
 * ⛔ CE QUE CET ÉCRAN NE PRÉTEND PAS ÊTRE, et qui est écrit noir sur blanc dedans :
 * une signature posée ici est un DESSIN dans le document. Ce n'est pas une signature
 * électronique, ce n'est pas scellé, ce n'est pas horodaté, et la date du bloc est un
 * texte que l'utilisateur écrit lui-même. Aucun libellé de ce fichier ne suggère le
 * contraire.
 *
 * ⛔ AUCUN CHAMP PRÉ-REMPLI : ni nom, ni fonction, ni date. Le bouton « Aujourd'hui »
 * écrit la date du poste — c'est un clic de l'utilisateur, jamais un remplissage
 * automatique.
 *
 * ⛔ AUCUNE VOIE PAR DÉFAUT. Tant qu'aucune n'est choisie, « Poser » reste désactivé et
 * la raison est affichée. Un bouton qui ne fait rien est interdit.
 *
 * ⚠️ CADRE DE SAISIE — dit franchement : le moteur de tracé du Crayon (panneau Formes
 * & Vecteur) est soudé au `Stage` Konva du document (`onStageMouseDown/Move/Up` dans
 * canvas/KonvaBoardStage.jsx) et n'est pas extractible depuis ce périmètre. Le cadre
 * ci-dessous est donc un capteur MINIMAL écrit à part (Pointer Events, donc souris ET
 * doigt). Ce qui est partagé avec le Crayon, c'est la SORTIE : les mêmes objets `line`
 * à `content.points` relatifs — la seule forme que sachent dessiner à la fois le
 * canevas et l'export PDF.
 *
 * ⚠️ POLICE MANUSCRITE : aucune n'est fournie par l'application (aucun webfont, aucune
 * classe Tailwind `font-cursive` définie dans ce dépôt). La voie dactylographiée
 * s'appuie sur les polices du SYSTÈME, et l'export PDF ne les embarque pas
 * (`familleFontPdf` retombe sur les 14 polices standard). D'où le bouton « Figer en
 * image » : il rasterise le nom tel qu'il s'affiche ici, et c'est cette image qui part
 * au PDF.
 *
 * ⚠️ Les images partent dans le bucket PRIVÉ `smartboard-canvas` : on garde la forme
 * durable et on re-signe à l'affichage (`useSmartboardCanvasSrc`).
 *
 * Montage attendu (coque) : `<DocumentSignaturePanel />` dans le rail du Studio
 * Document, ou dans le panneau Identité (il y est déjà appelé pour [SIG-2]).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, Check, Eraser, Image as ImageIcon, Loader2, PenLine, Save, Stamp,
  Trash2, TriangleAlert, Type, Undo2, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import { useDocumentIdentiteStore } from '@/features/smartboard-konva-editor/store/useDocumentIdentiteStore';
import { appliquerMutationDocument } from '@/features/smartboard-konva-editor/components/DocumentBusinessPanels';
import {
  ANCRAGES_SIGNATURE,
  ANCRAGE_DEFAUT,
  EPAISSEUR_TRAIT_MAX,
  EPAISSEUR_TRAIT_MIN,
  HAUTEUR_SIGNATURE_MAX,
  HAUTEUR_SIGNATURE_MIN,
  POLICES_MANUSCRITES,
  TAILLE_DACTYLO_MAX,
  TAILLE_DACTYLO_MIN,
  VOIES_SIGNATURE,
  VOIE_DACTYLO,
  VOIE_TELEVERSEE,
  VOIE_TRACEE,
  appliquerSignature,
  avertissementsSignature,
  detourerFondClair,
  lisserTrait,
  normaliserSignature,
  objetsDeSignature,
  resumeSignature,
  retirerSignature,
  signaturePosee,
  signatureVide,
} from '@/features/smartboard-konva-editor/lib/documentSignature';
import { normaliserIdentite } from '@/features/smartboard-konva-editor/lib/documentIdentite';
import { FORMATS_PAGE, formatDepuisCanevas, MARGES_DEFAUT } from '@/features/smartboard-konva-editor/lib/documentPagination';
import { uploadSmartboardCanvasImage } from '@/lib/uploadSmartboardCanvasImage';
import { useSmartboardCanvasSrc } from '@/lib/smartboardCanvasUrl';

/* ═══════════════════════════════════════════════════════════════════
   Briques d'interface — mêmes classes que DocumentIdentitePanel
═══════════════════════════════════════════════════════════════════ */

const CLS_BTN = 'flex w-full items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-2.5 py-2 text-left text-[11px] font-medium text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35';
const CLS_BTN_ACCENT = 'flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#d4924a]/35 bg-[#d4924a]/15 px-2.5 py-2 text-[11px] font-semibold text-[#ecc98f] transition-all hover:bg-[#d4924a]/25 disabled:cursor-not-allowed disabled:opacity-35';
const CLS_INPUT = 'w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10.5px] text-white/85 placeholder:text-white/25 focus:border-[#d4924a]/40 focus:outline-none';
const CLS_LABEL = 'block text-[9px] font-bold uppercase tracking-[0.14em] text-white/30';

function Champ({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className={CLS_LABEL}>{label}</span>
      {children}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Lecture du document courant
═══════════════════════════════════════════════════════════════════ */

function useObjetsScene() {
  const scenes = useSmartboardKonvaStore((s) => s.project?.scenes ?? []);
  const activeSceneId = useSmartboardKonvaStore((s) => s.project?.activeSceneId);
  return useMemo(
    () => scenes.find((s) => s.id === activeSceneId)?.objects ?? [],
    [scenes, activeSceneId],
  );
}

/**
 * ⚠️ MÊME RÈGLE DE LECTURE que `useFormatPage` (DocumentBusinessPanels) et que le
 * panneau Identité : `formatDepuisCanevas`, qui départage par la HAUTEUR les deux
 * formats larges de 794 px (A4 portrait / A5 paysage). Deux règles différentes
 * donneraient deux nombres de pages pour le même document.
 */
function useFormatCourant() {
  const w = useSmartboardKonvaStore((s) => s.project?.canvas?.width ?? FORMATS_PAGE.a4_portrait.largeur);
  const h = useSmartboardKonvaStore((s) => s.project?.canvas?.height ?? FORMATS_PAGE.a4_portrait.hauteur);
  return useMemo(() => {
    const format = formatDepuisCanevas(w, h) ?? FORMATS_PAGE.a4_portrait;
    return { cle: format.id, format, nbPages: Math.max(1, Math.round(h / format.hauteur)) };
  }, [w, h]);
}

/* ═══════════════════════════════════════════════════════════════════
   Voie 1 — cadre de saisie à la main
═══════════════════════════════════════════════════════════════════ */

const CADRE_L = 300;
const CADRE_H = 130;

/**
 * Cadre de capture MINIMAL (cf. l'avertissement d'en-tête : le Crayon du canevas
 * n'est pas réutilisable ici). Pointer Events : la souris, le stylet et le doigt
 * passent par le même chemin, et `touch-action: none` empêche le défilement de la
 * page d'avaler le geste.
 *
 * Le trait est lissé À LA FIN du geste (`lisserTrait`) : lisser en direct ferait
 * bouger sous le doigt ce qui vient d'être écrit.
 */
function CadreSignature({ traits, onTraits, couleur, epaisseur }) {
  const canvasRef = useRef(null);
  const enCours = useRef(null);
  const [brouillon, setBrouillon] = useState(null);

  const redessiner = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const r = window.devicePixelRatio || 1;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, CADRE_L, CADRE_H);
    // Ligne de base : repère d'écriture, jamais exportée (elle vit dans ce canvas).
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, CADRE_H - 32);
    ctx.lineTo(CADRE_L - 16, CADRE_H - 32);
    ctx.stroke();

    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const tracer = (pts) => {
      if (!pts || pts.length < 4) return;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
    };
    traits.forEach(tracer);
    tracer(brouillon);
  }, [traits, brouillon, couleur, epaisseur]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const r = window.devicePixelRatio || 1;
    cv.width = CADRE_L * r;
    cv.height = CADRE_H * r;
    redessiner();
  }, [redessiner]);

  const point = (e) => {
    const cv = canvasRef.current;
    const b = cv.getBoundingClientRect();
    return [
      ((e.clientX - b.left) / b.width) * CADRE_L,
      ((e.clientY - b.top) / b.height) * CADRE_H,
    ];
  };

  const debut = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignoré */ }
    enCours.current = point(e);
    setBrouillon(enCours.current);
  };
  const bouge = (e) => {
    if (!enCours.current) return;
    e.preventDefault();
    const [x, y] = point(e);
    enCours.current = [...enCours.current, x, y];
    setBrouillon(enCours.current);
  };
  const fin = () => {
    const brut = enCours.current;
    enCours.current = null;
    setBrouillon(null);
    if (!brut || brut.length < 4) return; // un simple clic n'est pas un trait
    onTraits([...traits, lisserTrait(brut)]);
  };

  return (
    <div className="space-y-1.5">
      <canvas
        ref={canvasRef}
        style={{ width: CADRE_L, height: CADRE_H, touchAction: 'none' }}
        className="w-full cursor-crosshair rounded-xl border border-white/[0.12] bg-black/45"
        onPointerDown={debut}
        onPointerMove={bouge}
        onPointerUp={fin}
        onPointerCancel={fin}
        onPointerLeave={fin}
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          className={CLS_BTN}
          disabled={!traits.length}
          onClick={() => onTraits(traits.slice(0, -1))}
        >
          <Undo2 className="h-3 w-3" /> Dernier trait
        </button>
        <button type="button" className={CLS_BTN} disabled={!traits.length} onClick={() => onTraits([])}>
          <Eraser className="h-3 w-3" /> Tout effacer
        </button>
      </div>
      <p className="text-[9px] leading-snug text-white/30">
        {traits.length
          ? `${traits.length} trait(s) — posés en tracé vectoriel, nets à toutes les tailles.`
          : 'Signez dans le cadre, à la souris ou au doigt.'}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Voie 2 — téléversement, avec détourage du fond
═══════════════════════════════════════════════════════════════════ */

/** Mesure locale AVANT téléversement : sans dimensions natives, la boîte est un carré. */
function chargerImage(url) {
  return new Promise((resolve, reject) => {
    const im = new window.Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Image illisible'));
    im.src = url;
  });
}

/**
 * Détourage du fond clair d'un scan.
 * ⚠️ Fait AVANT le téléversement, à partir du fichier local : une image déjà déposée
 * dans le bucket privé reviendrait par une URL signée d'un autre domaine et
 * « salirait » le canvas (`getImageData` lèverait une SecurityError).
 * @returns {Promise<{blob:Blob, largeur:number, hauteur:number, partTransparente:number}>}
 */
async function detourerFichier(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await chargerImage(url);
    const L = im.naturalWidth;
    const H = im.naturalHeight;
    const cv = document.createElement('canvas');
    cv.width = L;
    cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(im, 0, 0);
    const donnees = ctx.getImageData(0, 0, L, H);
    const res = detourerFondClair(donnees.data, { largeur: L, hauteur: H });
    ctx.putImageData(donnees, 0, 0);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!blob) throw new Error('Conversion PNG impossible');
    return { blob, largeur: L, hauteur: H, partTransparente: res.partTransparente };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Voie 3 — rasterisation du nom dactylographié
═══════════════════════════════════════════════════════════════════ */

/**
 * Fige le nom dans une image PNG transparente.
 * ⛔ C'est le SEUL moyen que le PDF garde l'écriture : `familleFontPdf`
 * (documentExport) n'embarque pas les polices web et retomberait sur Times.
 * ⚠️ Ce qui est figé, c'est ce que CETTE machine affiche : la police vient du système.
 */
async function figerNomEnImage({ texte, police, taille, couleur }) {
  const echelle = 4; // net à l'impression
  const mesure = document.createElement('canvas').getContext('2d');
  mesure.font = `${taille}px ${police}`;
  const l = Math.ceil(mesure.measureText(texte).width) + 12;
  const h = Math.ceil(taille * 1.6);
  const cv = document.createElement('canvas');
  cv.width = l * echelle;
  cv.height = h * echelle;
  const ctx = cv.getContext('2d');
  ctx.scale(echelle, echelle);
  ctx.font = `${taille}px ${police}`;
  ctx.fillStyle = couleur;
  ctx.textBaseline = 'middle';
  ctx.fillText(texte, 6, h / 2);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  if (!blob) throw new Error('Conversion PNG impossible');
  return { blob, largeur: cv.width, hauteur: cv.height };
}

/* ═══════════════════════════════════════════════════════════════════
   Aperçu de la signature (fidèle : mêmes objets que la pose)
═══════════════════════════════════════════════════════════════════ */

function ApercuImage({ src, style }) {
  const resolue = useSmartboardCanvasSrc(src);
  if (!resolue) return <div style={style} className="rounded-sm border border-dashed border-black/20" />;
  return <img src={resolue} alt="" style={style} className="object-contain" draggable={false} />;
}

/**
 * Rend les objets RÉELLEMENT produits (`objetsDeSignature`, la fonction même que la
 * pose appelle) — un aperçu redessiné à part mentirait. Seul le placement dans la
 * page diffère : ici l'origine est (0, 0).
 */
function ApercuSignature({ signature }) {
  const largeur = 268;
  const res = useMemo(
    () => objetsDeSignature({ signature, x: 0, y: 0, largeur }),
    [signature],
  );
  const objets = res.objets;
  const hauteur = Math.max(40, res.hauteur);
  const echelle = 1;

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-sm bg-white p-1 shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
      style={{ width: largeur, height: hauteur + 8 }}
    >
      {objets.map((o) => {
        const base = {
          position: 'absolute',
          left: o.x * echelle + 4,
          top: o.y * echelle + 4,
          width: o.width * echelle,
          height: o.height * echelle,
        };
        if (o.type === 'image') return <ApercuImage key={o.id} src={o.content.src} style={base} />;
        if (o.type === 'line') {
          const pts = o.content.points;
          const d = pts.reduce((acc, v, i) => (i % 2 ? `${acc} ${v}` : `${acc}${i ? ' L' : 'M'} ${v}`), '');
          return (
            <svg key={o.id} style={{ ...base, overflow: 'visible' }} viewBox={`0 0 ${o.width} ${o.height}`}>
              <path d={d} fill="none" stroke={o.style.stroke} strokeWidth={o.style.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          );
        }
        return (
          <div
            key={o.id}
            style={{
              ...base,
              height: 'auto',
              fontFamily: o.style.fontFamily,
              fontSize: o.style.fontSize,
              fontWeight: o.style.fontWeight,
              color: o.style.fill,
              lineHeight: o.style.lineHeight,
              whiteSpace: 'pre-wrap',
            }}
          >
            {o.content.text}
          </div>
        );
      })}
      {!objets.length ? (
        <p className="absolute inset-x-2 top-1/2 -translate-y-1/2 text-center text-[8px] text-slate-400">
          {res.raison || 'Rien à poser.'}
        </p>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Panneau
═══════════════════════════════════════════════════════════════════ */

/**
 * @param {{onAppliquer?:Function, signatureInitiale?:object|null, onChangement?:Function,
 *          mode?:'autonome'|'integre'}} p
 *
 * ⚠️ `mode: 'integre'` = monté DANS le panneau Identité ([SIG-2]) : le bouton
 * « Enregistrer dans l'identité active » disparaît, car c'est le bouton
 * « Enregistrer » du panneau parent qui écrit — deux chemins d'écriture concurrents
 * auraient enregistré deux versions de la même signature.
 *
 * ⚠️ En mode intégré, le parent DOIT passer une `key` liée à l'identité éditée : cet
 * écran garde son propre état de saisie et ne relit pas `signatureInitiale` après le
 * montage (sans quoi une frappe en cours serait écrasée à chaque rendu du parent).
 */
export default function DocumentSignaturePanel({
  onAppliquer = appliquerMutationDocument,
  signatureInitiale = null,
  onChangement = null,
  mode = 'autonome',
}) {
  const integre = mode === 'integre';
  const objets = useObjetsScene();
  const { cle: cleFormat, nbPages } = useFormatCourant();

  const collection = useDocumentIdentiteStore((s) => s.collection);
  const chargerIdentites = useDocumentIdentiteStore((s) => s.charger);
  const enregistrerIdentitePure = useDocumentIdentiteStore((s) => s.enregistrerIdentite);

  const [sig, setSig] = useState(() => normaliserSignature(signatureInitiale));
  const [ancrage, setAncrage] = useState(ANCRAGE_DEFAUT);
  const [pageCible, setPageCible] = useState(nbPages - 1);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);
  const fichierRef = useRef(null);

  useEffect(() => { chargerIdentites(); }, [chargerIdentites]);
  useEffect(() => { setPageCible((p) => Math.min(p, nbPages - 1)); }, [nbPages]);

  /* ⛔ AUCUNE normalisation à la frappe : `normaliserSignature` coupe les espaces de
     bord, l'appliquer à chaque touche empêcherait de taper une espace entre deux mots.
     La normalisation a lieu à l'aperçu et à la pose. */
  const maj = useCallback((chemin, valeur) => {
    setSig((s) => {
      const copie = { ...s };
      const bouts = chemin.split('.');
      let cible = copie;
      for (let i = 0; i < bouts.length - 1; i += 1) {
        cible[bouts[i]] = { ...cible[bouts[i]] };
        cible = cible[bouts[i]];
      }
      cible[bouts[bouts.length - 1]] = valeur;
      return copie;
    });
    setMessage(null);
  }, []);

  /* ⛔ La remontée au parent vit dans un effet, PAS dans l'updater de `setSig` :
     React (mode strict) rejoue les updaters, et un effet de bord y serait émis deux
     fois — le panneau Identité recevrait deux fois la même signature. */
  useEffect(() => { onChangement?.(sig); }, [sig, onChangement]);

  const resume = useMemo(() => resumeSignature(sig), [sig]);
  const avertissements = useMemo(() => avertissementsSignature(sig), [sig]);
  const pose = useMemo(() => signaturePosee(objets), [objets]);
  const identiteActive = collection.identites.find((x) => x.id === collection.actifId) ?? null;

  /* ── Voie 2 : téléversement ─────────────────────────────────── */

  const televerser = useCallback(async (e, detourer) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setOccupe(true);
    setErreur(null);
    setMessage(null);
    try {
      let aEnvoyer = file;
      let mesure = null;
      let part = null;
      if (detourer) {
        const d = await detourerFichier(file);
        aEnvoyer = d.blob;
        mesure = { largeurNative: d.largeur, hauteurNative: d.hauteur };
        part = d.partTransparente;
      } else {
        const url = URL.createObjectURL(file);
        try {
          const im = await chargerImage(url);
          mesure = { largeurNative: im.naturalWidth || null, hauteurNative: im.naturalHeight || null };
        } finally { URL.revokeObjectURL(url); }
      }
      const { url } = await uploadSmartboardCanvasImage(aEnvoyer);
      maj('image', { src: url, ...mesure, detoure: Boolean(detourer) });
      maj('voie', VOIE_TELEVERSEE);
      // ⛔ On DIT ce que le détourage a réellement fait : « 0 % » ne veut pas dire
      // « c'est propre », mais « le fond n'était pas assez clair pour être retiré ».
      setMessage(detourer
        ? (part > 0.02
          ? `Fond détouré : ${Math.round(part * 100)} % de l'image rendue transparente.`
          : 'Aucun fond clair détecté : rien n’a été retiré (fond gris, ombré ou photographié).')
        : 'Image téléversée telle quelle : son fond masquera ce qui se trouve dessous.');
    } catch (err) {
      setErreur(err?.message || 'Téléversement impossible');
    } finally {
      setOccupe(false);
    }
  }, [maj]);

  /* ── Voie 3 : figer le nom en image ─────────────────────────── */

  const figerNom = useCallback(async () => {
    const texte = String(sig.dactylographiee.texte || '').trim();
    if (!texte) { setErreur('Écrivez d’abord le nom à figer.'); return; }
    setOccupe(true);
    setErreur(null);
    try {
      const police = sig.dactylographiee.police || POLICES_MANUSCRITES[0].valeur;
      const { blob, largeur, hauteur } = await figerNomEnImage({
        texte,
        police,
        taille: sig.dactylographiee.taille,
        couleur: sig.tracee.couleur,
      });
      const { url } = await uploadSmartboardCanvasImage(blob);
      maj('image', { src: url, largeurNative: largeur, hauteurNative: hauteur, detoure: true });
      maj('voie', VOIE_TELEVERSEE);
      setMessage('Nom figé en image : c’est ce dessin qui partira au PDF, à l’identique.');
    } catch (err) {
      setErreur(err?.message || 'Impossible de figer le nom');
    } finally {
      setOccupe(false);
    }
  }, [sig.dactylographiee, sig.tracee.couleur, maj]);

  /* ── Pose ───────────────────────────────────────────────────── */

  const poser = useCallback(() => {
    setErreur(null);
    const res = appliquerSignature({
      signature: sig,
      objets,
      page: { format: cleFormat, marges: MARGES_DEFAUT, nbPages, index: pageCible },
      position: ancrage,
    });
    if (!res.placee) { setErreur(`Signature non posée — ${res.raison}.`); return; }
    const ok = onAppliquer({
      ajouts: res.ajouts,
      patches: res.patches,
      suppressions: res.suppressions,
      // Sélectionnée à la pose : le Transformer attaché à plusieurs nœuds permet de
      // la déplacer et de la redimensionner d'un bloc, traits compris.
      selectionner: true,
    });
    if (!ok) { setErreur('Le document n’a pas accepté la pose.'); return; }
    const bouts = [`signature posée page ${pageCible + 1} (${res.ajouts.length} objet(s), sélectionnée : déplacez-la ou redimensionnez-la)`];
    if (res.suppressions.length) bouts.push(`${res.suppressions.length} objet(s) de l'ancienne signature retirés`);
    if (!res.mesuree) bouts.push('image non mesurée : posée dans un carré');
    setMessage(`${bouts.join(' · ')}.`);
  }, [sig, objets, cleFormat, nbPages, pageCible, ancrage, onAppliquer]);

  const retirer = useCallback(() => {
    const { suppressions } = retirerSignature(objets);
    if (!suppressions.length) { setMessage('Aucune signature posée sur ce document.'); return; }
    onAppliquer({ suppressions, selectionner: false });
    setMessage(`${suppressions.length} objet(s) de signature retirés.`);
  }, [objets, onAppliquer]);

  /* ── [SIG-2] Enregistrement dans l'identité d'entreprise ────── */

  const enregistrerDansIdentite = useCallback(async () => {
    if (!identiteActive) {
      setErreur('Aucune identité active : créez-en une dans « Identité d’entreprise », puis réessayez.');
      return;
    }
    setOccupe(true);
    setErreur(null);
    try {
      await enregistrerIdentitePure(normaliserIdentite({ ...identiteActive, signature: sig }));
      setMessage(`Signature enregistrée dans « ${identiteActive.libelle || identiteActive.raisonSociale || 'identité active'} » : elle repartira avec elle sur les prochains documents.`);
    } catch (e) {
      setErreur(e?.message || 'Enregistrement impossible');
    } finally {
      setOccupe(false);
    }
  }, [identiteActive, enregistrerIdentitePure, sig]);

  /* ── Rendu ──────────────────────────────────────────────────── */

  const voie = sig.voie;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <PenLine className="h-3.5 w-3.5 text-[#d4924a]" />
        <p className="flex-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Signature</p>
      </div>

      {/* ⛔ Ce que c'est, dit avant tout le reste. */}
      <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 text-[9px] leading-snug text-white/40">
        Une signature posée ici est un dessin dans le document. Ce n’est pas une signature
        électronique, ce n’est ni scellé ni horodaté, et la date écrite ci-dessous est un
        texte comme un autre.
      </p>

      {/* Choix de la voie — aucune n'est cochée d'avance */}
      <div className="space-y-1.5">
        <span className={CLS_LABEL}>Voie</span>
        {VOIES_SIGNATURE.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => maj('voie', voie === v.id ? '' : v.id)}
            className={cn(
              'w-full rounded-xl border px-2.5 py-2 text-left transition-colors',
              voie === v.id
                ? 'border-[#d4924a]/40 bg-[#d4924a]/[0.12]'
                : 'border-white/[0.09] bg-white/[0.02] hover:border-white/20',
            )}
          >
            <span className="flex items-center gap-1.5">
              {v.id === VOIE_TRACEE ? <PenLine className="h-3 w-3 text-white/40" /> : null}
              {v.id === VOIE_TELEVERSEE ? <ImageIcon className="h-3 w-3 text-white/40" /> : null}
              {v.id === VOIE_DACTYLO ? <Type className="h-3 w-3 text-white/40" /> : null}
              <span className={cn('flex-1 text-[11px] font-semibold', voie === v.id ? 'text-[#ecc98f]' : 'text-white/70')}>
                {v.label}
              </span>
              {voie === v.id ? <Check className="h-3 w-3 text-[#ecc98f]" /> : null}
            </span>
            <span className="mt-0.5 block text-[9px] leading-snug text-white/30">{v.aide}</span>
          </button>
        ))}
      </div>

      {voie === VOIE_TRACEE ? (
        <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
          <CadreSignature
            traits={sig.tracee.traits}
            onTraits={(t) => maj('tracee.traits', t)}
            couleur={sig.tracee.couleur}
            epaisseur={sig.tracee.epaisseur}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <Champ label="Encre">
              <input
                type="color"
                value={sig.tracee.couleur}
                className="h-7 w-full cursor-pointer rounded-lg border border-white/10 bg-black/40"
                onChange={(e) => maj('tracee.couleur', e.target.value)}
              />
            </Champ>
            <Champ label={`Trait (${sig.tracee.epaisseur})`}>
              <input
                type="range"
                min={EPAISSEUR_TRAIT_MIN}
                max={EPAISSEUR_TRAIT_MAX}
                step={0.2}
                value={sig.tracee.epaisseur}
                className="w-full accent-[#d4924a]"
                onChange={(e) => maj('tracee.epaisseur', Number(e.target.value))}
              />
            </Champ>
          </div>
        </div>
      ) : null}

      {voie === VOIE_TELEVERSEE ? (
        <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.06]">
              <ApercuImage src={sig.image.src} style={{ maxHeight: '100%', maxWidth: '100%' }} />
            </div>
            <div className="flex-1 space-y-1">
              <button
                type="button"
                className={CLS_BTN}
                disabled={occupe}
                onClick={() => { fichierRef.current.dataset.detourer = '1'; fichierRef.current.click(); }}
              >
                {occupe ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Téléverser et détourer le fond
              </button>
              <button
                type="button"
                className={CLS_BTN}
                disabled={occupe}
                onClick={() => { fichierRef.current.dataset.detourer = ''; fichierRef.current.click(); }}
              >
                <Upload className="h-3 w-3" /> Téléverser sans détourer
              </button>
              {sig.image.src ? (
                <button
                  type="button"
                  className={CLS_BTN}
                  onClick={() => maj('image', { src: '', largeurNative: null, hauteurNative: null, detoure: false })}
                >
                  <Trash2 className="h-3 w-3" /> Retirer l’image
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-[9px] leading-snug text-white/30">
            Le détourage retire le papier clair atteint depuis les bords ; une boucle
            claire enfermée dans l’encre est conservée. Un fond gris, ombré ou
            photographié ne sera pas retiré — c’est dit après coup, chiffres à l’appui.
          </p>
          <input
            ref={fichierRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => televerser(e, e.target.dataset.detourer === '1')}
          />
        </div>
      ) : null}

      {voie === VOIE_DACTYLO ? (
        <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
          <Champ label="Nom à écrire">
            <input
              className={CLS_INPUT}
              value={sig.dactylographiee.texte}
              placeholder="(vide tant que vous ne l’écrivez pas)"
              onChange={(e) => maj('dactylographiee.texte', e.target.value)}
            />
          </Champ>
          <Champ label="Police manuscrite (du système)">
            <select
              className={CLS_INPUT}
              value={sig.dactylographiee.police || POLICES_MANUSCRITES[0].valeur}
              onChange={(e) => maj('dactylographiee.police', e.target.value)}
            >
              {POLICES_MANUSCRITES.map((p) => <option key={p.id} value={p.valeur}>{p.label}</option>)}
            </select>
          </Champ>
          <Champ label={`Taille (${sig.dactylographiee.taille} px)`}>
            <input
              type="range"
              min={TAILLE_DACTYLO_MIN}
              max={TAILLE_DACTYLO_MAX}
              value={sig.dactylographiee.taille}
              className="w-full accent-[#d4924a]"
              onChange={(e) => maj('dactylographiee.taille', Number(e.target.value))}
            />
          </Champ>
          {sig.dactylographiee.texte ? (
            <div
              className="rounded-lg bg-white px-2 py-1.5 text-slate-900"
              style={{
                fontFamily: sig.dactylographiee.police || POLICES_MANUSCRITES[0].valeur,
                fontSize: sig.dactylographiee.taille,
                lineHeight: 1.3,
              }}
            >
              {sig.dactylographiee.texte}
            </div>
          ) : null}
          <button type="button" className={CLS_BTN} disabled={occupe || !sig.dactylographiee.texte} onClick={figerNom}>
            {occupe ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
            Figer en image (garde ce tracé au PDF)
          </button>
        </div>
      ) : null}

      {/* Bloc de texte facultatif */}
      <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
        <p className={CLS_LABEL}>Bloc (facultatif)</p>
        <Champ label="Mention">
          <input className={CLS_INPUT} value={sig.mention} placeholder="ex. Pour la direction," onChange={(e) => maj('mention', e.target.value)} />
        </Champ>
        <Champ label="Nom du signataire">
          <input className={CLS_INPUT} value={sig.nom} onChange={(e) => maj('nom', e.target.value)} />
        </Champ>
        <Champ label="Fonction">
          <input className={CLS_INPUT} value={sig.fonction} onChange={(e) => maj('fonction', e.target.value)} />
        </Champ>
        <Champ label="Date (texte libre)">
          <div className="flex gap-1.5">
            <input className={CLS_INPUT} value={sig.date} placeholder="(vide)" onChange={(e) => maj('date', e.target.value)} />
            <button
              type="button"
              title="Écrire la date de ce poste"
              className="shrink-0 rounded-lg border border-white/10 bg-black/40 px-2 text-white/60 hover:border-white/25"
              onClick={() => { maj('date', new Date().toLocaleDateString('fr-FR')); maj('afficherDate', true); }}
            >
              <CalendarDays className="h-3 w-3" />
            </button>
          </div>
        </Champ>
        <button
          type="button"
          onClick={() => maj('afficherDate', !sig.afficherDate)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-[10.5px] transition-colors',
            sig.afficherDate ? 'border-[#d4924a]/35 bg-[#d4924a]/10 text-[#ecc98f]' : 'border-white/10 bg-black/30 text-white/45',
          )}
        >
          <span>Afficher la date</span>
          {sig.afficherDate ? <Check className="h-3 w-3" /> : <span className="text-[9px] uppercase tracking-wider">non</span>}
        </button>
      </div>

      {/* Taille et emplacement */}
      <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
        <Champ label={`Hauteur du dessin (${sig.hauteur} px)`}>
          <input
            type="range"
            min={HAUTEUR_SIGNATURE_MIN}
            max={HAUTEUR_SIGNATURE_MAX}
            value={sig.hauteur}
            className="w-full accent-[#d4924a]"
            onChange={(e) => maj('hauteur', Number(e.target.value))}
          />
        </Champ>
        <Champ label="Emplacement">
          <select className={CLS_INPUT} value={ancrage} onChange={(e) => setAncrage(e.target.value)}>
            {ANCRAGES_SIGNATURE.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </Champ>
        {nbPages > 1 ? (
          <Champ label="Page">
            <select className={CLS_INPUT} value={pageCible} onChange={(e) => setPageCible(Number(e.target.value))}>
              {Array.from({ length: nbPages }, (_, i) => (
                <option key={i} value={i}>Page {i + 1}{i === nbPages - 1 ? ' (dernière)' : ''}</option>
              ))}
            </select>
          </Champ>
        ) : null}
        <p className="text-[9px] leading-snug text-white/30">
          Posée, la signature est sélectionnée : déplacez-la ou redimensionnez-la
          directement sur la page (⌘Z / Ctrl+Z annule la pose entière).
        </p>
      </div>

      {/* Aperçu fidèle */}
      <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
        <p className={CLS_LABEL}>Aperçu</p>
        <ApercuSignature signature={sig} />
      </div>

      {/* Actions */}
      <div className="space-y-1.5">
        <button type="button" className={CLS_BTN_ACCENT} disabled={!resume.prete || occupe} onClick={poser}>
          <Stamp className="h-3 w-3" /> Poser sur le document
        </button>
        <button type="button" className={CLS_BTN} disabled={!pose.posee} onClick={retirer}>
          <Eraser className="h-3 w-3" /> Retirer la signature du document
        </button>
        {integre ? null : (
          <button type="button" className={CLS_BTN} disabled={occupe || !resume.prete} onClick={enregistrerDansIdentite}>
            {occupe ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Enregistrer dans l’identité active
          </button>
        )}
        <button type="button" className={CLS_BTN} onClick={() => { setSig(signatureVide()); setMessage(null); setErreur(null); }}>
          <Trash2 className="h-3 w-3" /> Repartir d’une signature vierge
        </button>
      </div>

      {!resume.prete && resume.raison ? (
        <p className="text-[9px] leading-snug text-white/35">Rien à poser — {resume.raison}.</p>
      ) : null}

      {avertissements.map((a) => (
        <p key={a} className="flex gap-1.5 rounded-lg border border-[#d4924a]/30 bg-[#d4924a]/10 px-2 py-1.5 text-[9.5px] leading-snug text-[#ecc98f]">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          {a}
        </p>
      ))}

      {message ? (
        <p className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1.5 text-[9.5px] leading-snug text-white/55">{message}</p>
      ) : null}
      {erreur ? (
        <p className="rounded-lg border border-[#e2553f]/30 bg-[#e2553f]/10 px-2 py-1.5 text-[9.5px] leading-snug text-[#f0a08f]">{erreur}</p>
      ) : null}

      {integre ? (
        <p className="text-[9px] leading-snug text-white/25">
          Cette signature part avec l’identité : enregistrez l’identité ci-dessous pour
          la retrouver sur les prochains documents.
        </p>
      ) : (
        <p className="text-[9px] leading-snug text-white/25">
          {identiteActive
            ? `Identité active : ${identiteActive.libelle || identiteActive.raisonSociale || 'sans nom'} (stockage : ce navigateur).`
            : 'Aucune identité active : la signature ne sera pas conservée d’un document à l’autre tant qu’il n’y en a pas.'}
        </p>
      )}
    </div>
  );
}

export { DocumentSignaturePanel };
