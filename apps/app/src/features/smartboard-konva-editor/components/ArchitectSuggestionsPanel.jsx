/**
 * Panneau gauche — onglet Suggestions (Architect) : préconisations locales + entrée vers variantes IA.
 */
import React, { useMemo } from 'react';
import { RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getArchitectHeuristicSuggestions } from '../lib/architectHeuristicSuggestions';

export default function ArchitectSuggestionsPanel({
  selectedObj,
  canvasWidth,
  canvasHeight,
  onRegenerateHeuristics,
  onRequestAiVariants,
  architectBusy,
  aiBusy,
  /** Suggestions issues du dernier message Copilot designer (prioritaires) */
  copilotItems = [],
}) {
  const items = useMemo(
    () => getArchitectHeuristicSuggestions(selectedObj, { width: canvasWidth, height: canvasHeight }),
    [selectedObj, canvasWidth, canvasHeight],
  );

  const merged = useMemo(() => {
    const copilot = (copilotItems || []).map((it) => ({
      id: `cp_${it.id}`,
      title: it.title,
      detail: it.detail,
      fromCopilot: true,
      kind: it.kind,
    }));
    const heur = items.map((it) => ({ ...it, fromCopilot: false }));
    return [...copilot, ...heur];
  }, [copilotItems, items]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/[0.07] bg-[#0a0c12]/90 p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--school-accent)_75%,transparent)]">Architect</p>
        <p className="mt-1 text-[11px] leading-snug text-white/40">
          Préconisations selon la sélection et la bibliothèque LIRI. Le moteur logique tourne sans jetons ; les variantes IA
          consomment des tokens.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={architectBusy}
            onClick={onRegenerateHeuristics}
            className="inline-flex items-center gap-1.5 rounded-sm border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[#14100c] px-2.5 py-1.5 text-[11px] font-semibold text-[#f5dd8a] transition-colors hover:bg-[#1a1510] disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', architectBusy && 'animate-spin')} />
            Régénérer
          </button>
          <button
            type="button"
            disabled={aiBusy}
            onClick={onRequestAiVariants}
            title="Appelle le Copilot / variantes de mise en page (consomme des tokens)"
            className="inline-flex items-center gap-1.5 rounded-sm border border-violet-500/35 bg-violet-950/35 px-2.5 py-1.5 text-[11px] font-medium text-violet-200 transition-colors hover:bg-violet-900/45 disabled:opacity-50"
          >
            {aiBusy ? <Sparkles className="h-3.5 w-3.5 animate-pulse" /> : <Wand2 className="h-3.5 w-3.5" />}
            Variantes IA
          </button>
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5 [scrollbar-width:thin]">
        {copilotItems?.length ? (
          <li className="list-none rounded-sm border border-cyan-500/25 bg-cyan-950/20 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200/90">
            Copilot designer
          </li>
        ) : null}
        {merged.map((it) => (
          <li
            key={it.id}
            className={cn(
              'rounded-sm border px-2.5 py-2 text-[12px] leading-snug text-white/75',
              it.fromCopilot
                ? 'border-cyan-500/20 bg-cyan-950/15'
                : 'border-white/[0.07] bg-black/25',
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn('font-semibold', it.fromCopilot ? 'text-cyan-200/95' : 'text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]')}>
                {it.title}
              </span>
              {it.kind && it.fromCopilot ? (
                <span className="rounded border border-white/10 px-1 py-0 text-[8px] uppercase tracking-wider text-white/35">
                  {it.kind}
                </span>
              ) : null}
            </div>
            <span className="mt-0.5 block text-[11px] text-white/45">{it.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
