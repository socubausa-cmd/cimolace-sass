import React from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hauteurDeCadrage, FORMATS_PAGE } from '../lib/documentPagination';

/**
 * Bornes de zoom communes à l'éditeur et à la coque.
 *
 * ⛔ Le plancher DOIT descendre sous 0,20 : une affiche A4 @300 dpi mesure
 * 2480 × 3508 px et ne tient dans un plan de travail de ~1000 × 630 qu'à ~0,18.
 * Avec l'ancien plancher (0,35) elle sortait écrêtée de 1476 px en hauteur, sans
 * aucun moyen de dézoomer.
 */
export const ECHELLE_MIN = 0.05;
export const ECHELLE_MAX = 8;

/** Pas de zoom multiplicatif : constant à l'œil, contrairement à un pas additif. */
const PAS_ZOOM = 1.15;

export function bornerEchelle(valeur) {
  const v = Number(valeur);
  if (!Number.isFinite(v) || v <= 0) return ECHELLE_MIN;
  return Math.max(ECHELLE_MIN, Math.min(ECHELLE_MAX, v));
}

export function echelleZoomee(echelle, sens) {
  const base = bornerEchelle(echelle);
  return bornerEchelle(sens > 0 ? base * PAS_ZOOM : base / PAS_ZOOM);
}

/**
 * Plancher d'échelle à l'ÉDITION D'UN DOCUMENT.
 *
 * ⛔ SEUIL MESURÉ (repris de la coque Studio, où il a été sondé au navigateur) :
 * la cible d'un double-clic dans un tableau est la CELLULE, haute de 15,4 px du
 * repère document ; sa fenêtre de clic vaut 15,4 × échelle. 10 px de fenêtre est
 * le minimum utilisable → 10 / 15,4 ≈ 0,62.
 *
 * ⚠️ Il ne s'applique QU'AUX formats de page reconnus (A4/A5/Letter à 96 dpi),
 * c'est-à-dire au seul pipeline qui pose des tableaux. Une affiche A4 @300 dpi
 * (2480 × 3508) n'en relève pas : lui imposer 0,62 la laisserait écrêtée de
 * 1600 px, exactement la panne qu'on ferme.
 */
export const PLANCHER_ECHELLE_DOCUMENT = 0.62;

/** Le canevas est-il une page du pipeline Document (96 dpi) ? */
function estFormatDePage(canvasW) {
  const w = Number(canvasW) || 0;
  return Object.values(FORMATS_PAGE).some((f) => Math.abs(f.largeur - w) <= 2);
}

/**
 * Échelle d'ajustement mesurée sur le canevas RÉEL.
 *
 * ⛔ CONTRAINTE : l'ajustement historique logeait le gabarit de conception
 * 1037 × 750 dans l'espace disponible, quel que soit le canevas affiché. Un A4
 * @300 dpi (2480 × 3508) recevait donc l'échelle d'un plateau 4/3 — mesuré 0,70,
 * soit 1736 × 2456 px dans un plan de travail de 1004 × 628. Le canevas doit être
 * mesuré, pas supposé.
 *
 * ⚠️ On cadre la HAUTEUR D'UNE PAGE (`hauteurDeCadrage`), pas la pile : sinon
 * l'échelle dépendrait du nombre de pages du document. Les pages suivantes se
 * rejoignent à la molette.
 *
 * @param {number} largeurDispo largeur utile du plan de travail (px écran)
 * @param {number} hauteurDispo hauteur utile du plan de travail (px écran)
 * @param {number} canvasW largeur du canevas (repère document)
 * @param {number} canvasH hauteur du canevas (repère document)
 * @returns {number | null} échelle d'ajustement, ou null si rien n'est mesurable
 */
export function echelleAjustementCanevas(largeurDispo, hauteurDispo, canvasW, canvasH) {
  const lw = Number(largeurDispo) || 0;
  const lh = Number(hauteurDispo) || 0;
  const cw = Number(canvasW) || 0;
  const ch = Number(canvasH) || 0;
  if (lw < 8 || lh < 8 || cw <= 0 || ch <= 0) return null;
  const hCadre = Math.max(1, Number(hauteurDeCadrage(cw, ch)) || ch);
  const s = Math.min(lw / cw, lh / hCadre);
  if (!Number.isFinite(s) || s <= 0) return null;
  if (!estFormatDePage(cw)) return bornerEchelle(s);
  /* Page de document : on ne descend pas sous le seuil de clic tant que la LARGEUR
     le permet. Le dépassement en hauteur qui en résulte est franchissable à la
     molette (cf. `debordementY` dans l'éditeur) — pas l'écrêtage horizontal. */
  const plancher = Math.min(lw / cw, PLANCHER_ECHELLE_DOCUMENT);
  return bornerEchelle(Math.max(s, plancher));
}

/**
 * Contrôle de zoom flottant — le SEUL atteignable quand la coque masque le chrome
 * de l'éditeur (`hideChrome`). Sans lui, le pourcentage n'était qu'un badge posé
 * dans une barre non rendue : aucun bouton, aucune sortie.
 */
export default function CanvasZoomControl({
  scale = 1,
  onZoomIn,
  onZoomOut,
  onFit,
  onSetScale,
  className,
}) {
  const pct = Math.round(bornerEchelle(scale) * 100);
  const paliers = [25, 50, 75, 100, 150, 200];

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-0.5 rounded-xl border border-white/[0.12] bg-[#1f1e1c]/95 p-0.5 shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-sm',
        className,
      )}
    >
      <button
        type="button"
        onClick={onZoomOut}
        title="Zoom arrière (⌘−, ⌘molette)"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/85"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <select
        value={paliers.includes(pct) ? String(pct) : 'custom'}
        onChange={(e) => {
          const v = Number(e.target.value);
          /* ⛔ Une valeur non numérique (« custom ») ne doit RIEN appliquer :
             convertie en nombre elle vaudrait NaN, puis 0 à l'arrivée. */
          if (!Number.isFinite(v) || v <= 0) return;
          onSetScale?.(v / 100);
        }}
        title="Niveau de zoom"
        className="h-7 min-w-[58px] cursor-pointer rounded-lg border-0 bg-transparent px-1 text-center text-[11px] font-semibold text-[#ecc98f] outline-none"
      >
        {!paliers.includes(pct) ? (
          <option value="custom" style={{ background: '#1f1e1c' }}>{pct}%</option>
        ) : null}
        {paliers.map((p) => (
          <option key={p} value={p} style={{ background: '#1f1e1c' }}>{p}%</option>
        ))}
      </select>

      <button
        type="button"
        onClick={onZoomIn}
        title="Zoom avant (⌘+, ⌘molette)"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/85"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <span className="mx-0.5 h-4 w-px bg-white/10" />

      <button
        type="button"
        onClick={onFit}
        title="Ajuster la page à l'écran (⌘0)"
        className="flex h-7 items-center gap-1 rounded-lg px-2 text-[10.5px] font-semibold text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/85"
      >
        <Maximize className="h-3 w-3" />
        Ajuster
      </button>
    </div>
  );
}
