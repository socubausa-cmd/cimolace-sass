import React from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NEURO_INK_MODE } from '@/lib/neuroInk';
import {
  designerShellMicroLabel,
  designerShellInput,
  designerShellChipGhost,
  designerShellCardInset,
} from '@/lib/liriDesignerShellClasses';

/** Réglages NeuroInk partagés (annotation diapo + tableau blanc). */
export default function NeuroInkPanel({
  open,
  onOpenChange,
  neuroInk,
  setNeuroInk,
  footerHint = 'Correction appliquée au relâchement du crayon (aperçu brut pendant le tracé).',
  className,
  toggleClassName,
  contentClassName,
  /** Rail latéral : typo réduite, classes shell designer */
  variant = 'default',
}) {
  const rail = variant === 'rail';
  const selectCls = rail
    ? cn(designerShellInput, 'py-1.5 text-[11px]')
    : 'rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white/85 outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]';
  const labelMuted = rail ? designerShellMicroLabel : 'text-white/45';
  const blockGap = rail ? 'gap-1.5 text-[10px] text-white/68' : 'gap-2 text-[10px] text-white/70';

  return (
    <div className={cn(className)}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          rail
            ? cn(
                designerShellChipGhost,
                'flex w-full items-center justify-between gap-2 border-white/[0.09] py-1.5 pl-2 pr-1.5 text-[10px] font-medium text-amber-100/85',
              )
            : 'flex w-full items-center justify-between gap-2 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-2 py-1.5 text-[10px] font-semibold text-[#e8d89a] hover:bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)]',
          toggleClassName,
        )}
        title="Lissage et correction au relâchement du trait (crayon)"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className={cn('shrink-0', rail ? 'h-3 w-3' : 'w-3.5 h-3.5')} />
          NeuroInk
        </span>
        <ChevronDown className={cn('shrink-0 transition-transform', rail ? 'h-3 w-3' : 'w-3.5 h-3.5', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className={cn(
            rail
              ? cn(designerShellCardInset, 'mt-1.5 flex flex-col', blockGap)
              : cn('mt-2 flex flex-col', blockGap),
            contentClassName,
          )}
        >
          <label className="flex flex-col gap-0.5">
            <span className={labelMuted}>Mode</span>
            <select
              value={neuroInk.mode}
              onChange={(e) => setNeuroInk((s) => ({ ...s, mode: e.target.value }))}
              className={selectCls}
            >
              <option value={NEURO_INK_MODE.FREE}>Encre libre</option>
              <option value={NEURO_INK_MODE.ASSISTED}>Écriture assistée</option>
              <option value={NEURO_INK_MODE.SHAPES}>Formes (snap géométrique)</option>
              <option value={NEURO_INK_MODE.AUTO}>Auto</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={cn('flex justify-between', labelMuted)}>
              Stabilisation
              <span className="tabular-nums text-white/55">{neuroInk.stabilization}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={neuroInk.stabilization}
              onChange={(e) => setNeuroInk((s) => ({ ...s, stabilization: Number(e.target.value) }))}
              className="w-full accent-[var(--school-accent)]"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={labelMuted}>Beautify écriture</span>
            <select
              value={neuroInk.beautify}
              onChange={(e) => setNeuroInk((s) => ({ ...s, beautify: e.target.value }))}
              className={selectCls}
            >
              <option value="off">Off</option>
              <option value="low">Faible</option>
              <option value="medium">Moyen</option>
              <option value="high">Fort</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={labelMuted}>Fidélité au geste</span>
            <select
              value={neuroInk.fidelity}
              onChange={(e) => setNeuroInk((s) => ({ ...s, fidelity: e.target.value }))}
              className={selectCls}
            >
              <option value="low">Faible (plus lissé)</option>
              <option value="medium">Moyenne</option>
              <option value="high">Forte (plus brut)</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Détection formes (cercle, rectangle, triangle, flèche…)</span>
            <input
              type="checkbox"
              checked={neuroInk.shapeDetection}
              onChange={(e) => setNeuroInk((s) => ({ ...s, shapeDetection: e.target.checked }))}
              className="accent-[var(--school-accent)]"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Snap ligne droite</span>
            <input
              type="checkbox"
              checked={neuroInk.snapStraight}
              onChange={(e) => setNeuroInk((s) => ({ ...s, snapStraight: e.target.checked }))}
              className="accent-[var(--school-accent)]"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Préserver les courbes</span>
            <input
              type="checkbox"
              checked={neuroInk.curvePreserve}
              onChange={(e) => setNeuroInk((s) => ({ ...s, curvePreserve: e.target.checked }))}
              className="accent-[var(--school-accent)]"
            />
          </label>
          {footerHint ? (
            <p className={cn('leading-snug', rail ? 'text-[8px] text-white/32' : 'text-[9px] text-white/35')}>
              {footerHint}
            </p>
          ) : null}
          <p className={cn('leading-snug', rail ? 'text-[7px] text-white/28' : 'text-[8px] text-white/30')}>
            Le mode Écriture / Croquis au-dessus impose la détection de formes (évite O vs cercle).
          </p>
        </div>
      )}
    </div>
  );
}
