import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ChevronDown, ScanEye, WandSparkles, LayoutTemplate, ImagePlus, Loader2, X, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NEURO_INK_MODE } from '@/lib/neuroInk';
import { useLiriEntitlements } from '@/hooks/useLiriEntitlements';
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
  /** Contrôleur NeuroInk IA (useNeuroInkAi) — active la section copilote si fourni. */
  ai = null,
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
          {ai ? <NeuroInkAiSection ai={ai} /> : null}
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

const NEURO_AI_ACTIONS = [
  { kind: 'comprehend', label: 'Comprendre', hint: 'Lire le tableau (IA vision)', Icon: ScanEye, run: (ai) => ai.comprehend() },
  { kind: 'cleanup', label: 'Mettre au propre', hint: 'Réécrire proprement le contenu', Icon: WandSparkles, run: (ai) => ai.cleanup() },
  { kind: 'present', label: 'Présentation', hint: 'Transformer en diapo structurée', Icon: LayoutTemplate, run: (ai) => ai.present() },
  { kind: 'illustrate', label: 'Illustration', hint: 'Générer un visuel du concept', Icon: ImagePlus, run: (ai) => ai.illustrate() },
];

/** Section copilote IA du panneau NeuroInk (hôte) : lecture + transformation du tableau. */
function NeuroInkAiSection({ ai }) {
  // Smartboard IA (copilote du tableau) = feature payante. canSmartboardAI=false en gratuit.
  const { limits } = useLiriEntitlements();
  const canAI = limits?.canSmartboardAI !== false;
  const state = ai?.state || {};
  const { enabled, premium, busy, activeKind, comprehension, error } = state;
  const suggestions = state.suggestions || [];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-100/90">
          <Sparkles className="h-3 w-3" aria-hidden /> Copilote IA
        </span>
        {canAI && (
          <button
            type="button"
            onClick={() => ai.setEnabled(!enabled)}
            aria-pressed={Boolean(enabled)}
            className={cn(
              'rounded-full px-2 py-0.5 text-[9px] font-semibold transition',
              enabled
                ? 'bg-amber-500/25 text-amber-100 ring-1 ring-inset ring-amber-400/40'
                : 'bg-white/[0.06] text-white/55 ring-1 ring-inset ring-white/10',
            )}
          >
            {enabled ? 'Activé' : 'Activer'}
          </button>
        )}
      </div>

      {!canAI ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-amber-400/25 bg-amber-500/[0.06] px-2 py-2">
          <p className="m-0 flex items-center gap-1.5 text-[10px] font-semibold text-amber-100/90">
            <Lock className="h-3 w-3 shrink-0" aria-hidden /> Réservé aux forfaits LIRI
          </p>
          <p className="m-0 text-[9px] leading-snug text-white/55">
            Le copilote IA du tableau (Comprendre, Mettre au propre, Présentation, Illustration) est inclus dès le forfait LIRI.
          </p>
          <Link
            to="/cimolace/billing?upgrade=liri"
            className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/[0.16] px-2 py-0.5 text-[9px] font-semibold text-amber-100 transition hover:bg-amber-500/25"
          >
            Passer au complet
          </Link>
        </div>
      ) : enabled ? (
        <>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/25 p-0.5 text-[9px] font-semibold">
              <button
                type="button"
                onClick={() => ai.setPremium(false)}
                aria-pressed={!premium}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 transition',
                  !premium ? 'bg-amber-500/20 text-amber-100 ring-1 ring-inset ring-amber-400/30' : 'text-white/45 hover:text-white/70',
                )}
              >
                ⚡ Éco
              </button>
              <button
                type="button"
                onClick={() => ai.setPremium(true)}
                aria-pressed={Boolean(premium)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 transition',
                  premium ? 'bg-amber-500/25 text-amber-100 ring-1 ring-inset ring-amber-400/40' : 'text-white/45 hover:text-white/70',
                )}
              >
                ✦ Premium
              </button>
            </div>
            <p className="m-0 px-0.5 text-[8px] leading-snug text-white/35">
              {premium ? 'Claude / OpenAI — qualité max' : 'DeepSeek / Mistral — économie'}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            {NEURO_AI_ACTIONS.map(({ kind, label, hint, Icon, run }) => {
              const isActive = busy && activeKind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={busy}
                  onClick={() => run(ai)}
                  title={hint || label}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-500/[0.08] px-2 py-1.5 text-left text-[10px] font-medium text-amber-50 transition hover:bg-amber-500/[0.16]',
                    busy && 'opacity-50',
                  )}
                >
                  {isActive ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : <Icon className="h-3.5 w-3.5 shrink-0 text-amber-200/90" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </button>
              );
            })}
          </div>

          {busy ? (
            <p className="m-0 flex items-center gap-1.5 text-[9px] text-amber-200/70">
              <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden /> IA en cours…
            </p>
          ) : null}

          {error ? (
            <div className="flex items-start justify-between gap-2 rounded-lg border border-rose-400/30 bg-rose-500/[0.08] px-2 py-1">
              <p className="m-0 text-[9px] leading-snug text-rose-100/85">{error}</p>
              <button type="button" onClick={() => ai.clearError?.()} className="shrink-0 text-rose-200/60 hover:text-rose-100" aria-label="Fermer">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ) : null}

          {comprehension?.description ? (
            <div className="rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5">
              <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-200/60">Lecture IA</p>
              <p className="m-0 max-h-24 overflow-y-auto text-[9px] leading-snug text-white/72">{comprehension.description}</p>
            </div>
          ) : null}

          {suggestions.length ? (
            <div className="flex flex-col gap-1">
              <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-amber-200/55">Suggestions</p>
              {suggestions.map((s) => (
                <div key={s.key} className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-2 py-1">
                  <p className="m-0 text-[9px] leading-snug text-white/85">{s.label}</p>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => ai.runSuggestion(s)}
                      className="flex-1 rounded-md border border-amber-400/40 bg-amber-500/[0.16] px-1.5 py-0.5 text-[9px] font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      Appliquer
                    </button>
                    <button
                      type="button"
                      onClick={() => ai.dismissSuggestion?.(s.key)}
                      className="rounded-md border border-white/12 px-1.5 py-0.5 text-[9px] text-white/50 transition hover:text-white/75"
                    >
                      Ignorer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <p className="m-0 text-[8px] leading-snug text-white/30">
            Lit le tableau et le transforme (texte net, présentation, visuel) via NeuroInk IA.
          </p>
        </>
      ) : (
        <p className="m-0 text-[9px] leading-snug text-white/40">
          Active le copilote pour lire le tableau et le transformer : mise au propre, présentation, illustration.
        </p>
      )}
    </div>
  );
}
