/**
 * ArchitectPanel — suggestions Architect actionnables.
 * Connecte useAIStore.coachFeedback.suggestions.
 */
import React, { useState } from 'react';
import { Wand2, CheckCircle, Loader2, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIStore } from '@/stores/ai.store';
import { useSmartboardStore } from '@/stores/smartboard.store';
import { aiRouter } from '@/engines/ai-router';

const PRIORITY_CONFIG = {
  high: { label: 'Critique', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertTriangle },
  medium: { label: 'Important', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Info },
  low: { label: 'Suggestion', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Info },
};

function SuggestionCard({ suggestion, onApply, applying }) {
  const cfg = PRIORITY_CONFIG[suggestion.priority] ?? PRIORITY_CONFIG.low;
  const PriorityIcon = cfg.icon;

  return (
    <div className={cn('rounded-xl border p-3', cfg.border, cfg.bg)}>
      <div className="flex items-start gap-2">
        <PriorityIcon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', cfg.color)} />
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider', cfg.color)}>{cfg.label}</span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">{suggestion.type}</span>
          </div>
          <p className="text-[12px] text-white/75">{suggestion.message}</p>
        </div>
      </div>
      {suggestion.actionLabel && (
        <button
          onClick={() => onApply(suggestion)}
          disabled={applying}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 py-1.5 text-[11px] text-white/60 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
        >
          {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
          {suggestion.actionLabel}
        </button>
      )}
    </div>
  );
}

export default function ArchitectPanel({ className }) {
  const coachFeedback = useAIStore((s) => s.coachFeedback);
  const architectBusy = useAIStore((s) => s.architectBusy);
  const setArchitectBusy = useAIStore((s) => s.setArchitectBusy);
  const addArchitectMessage = useAIStore((s) => s.addArchitectMessage);
  const activeSlide = useSmartboardStore((s) => s.slides.find((sl) => sl.id === s.activeSlideId));
  const updateSlide = useSmartboardStore((s) => s.updateSlide);

  const [applyingId, setApplyingId] = useState(null);

  const handleApply = async (suggestion) => {
    setApplyingId(suggestion.id);
    setArchitectBusy(true);
    try {
      const result = await aiRouter.route({
        taskType: 'architect_redesign',
        payload: {
          suggestion,
          slide: activeSlide ? { title: activeSlide.title, elements: activeSlide.initialState?.elements } : null,
        },
      });
      if (result?.patch && activeSlide) {
        updateSlide(activeSlide.id, result.patch);
      }
      addArchitectMessage('assistant', `Applique : ${suggestion.message}`);
    } catch {
      addArchitectMessage('assistant', 'Erreur lors de l\'application. Reessayez.');
    } finally {
      setApplyingId(null);
      setArchitectBusy(false);
    }
  };

  const handleFullRedesign = async () => {
    if (!activeSlide) return;
    setArchitectBusy(true);
    try {
      const result = await aiRouter.route({
        taskType: 'architect_redesign',
        payload: {
          mode: 'full',
          slide: { title: activeSlide.title, elements: activeSlide.initialState?.elements },
          feedback: coachFeedback,
        },
      });
      if (result?.patch) {
        updateSlide(activeSlide.id, result.patch);
        addArchitectMessage('assistant', 'Redesign complet applique. Verifiez le resultat.');
      }
    } catch {
      addArchitectMessage('assistant', 'Erreur redesign. Reessayez.');
    } finally {
      setArchitectBusy(false);
    }
  };

  const suggestions = coachFeedback?.suggestions ?? [];
  const highCount = suggestions.filter((s) => s.priority === 'high').length;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/8 px-3 py-2">
        <Wand2 className="h-4 w-4 text-[var(--school-accent)]" />
        <span className="text-[12px] font-semibold text-white">Architect</span>
        {highCount > 0 && (
          <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500/20 text-[9px] font-bold text-red-400">
            {highCount}
          </span>
        )}
        {coachFeedback && !architectBusy && suggestions.length > 0 && (
          <button
            onClick={handleFullRedesign}
            className="ml-auto flex items-center gap-1 text-[11px] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)] hover:text-[var(--school-accent)]"
          >
            <Wand2 className="h-3 w-3" />
            Redesign complet
          </button>
        )}
      </div>

      {/* Suggestions */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {!coachFeedback ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Wand2 className="h-7 w-7 text-white/15" />
            <p className="text-[11px] text-white/30">Lance une analyse Coach pour voir les suggestions Architect.</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle className="h-7 w-7 text-emerald-400/40" />
            <p className="text-[11px] text-white/50">Aucune correction critique. Slide bien structure.</p>
          </div>
        ) : (
          suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onApply={handleApply}
              applying={applyingId === s.id}
            />
          ))
        )}

        {architectBusy && (
          <div className="flex items-center gap-2 text-[11px] text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Architect travaille...
          </div>
        )}
      </div>
    </div>
  );
}
