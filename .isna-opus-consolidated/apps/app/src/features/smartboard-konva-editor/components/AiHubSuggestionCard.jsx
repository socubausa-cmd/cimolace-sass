import React, { useState } from 'react';
import { CheckCircle2, HelpCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Carte suggestion AI Hub (format cahier des charges : label, description, why, actions).
 *
 * @param {{
 *   label: string;
 *   description: string;
 *   why?: string;
 *   applyDisabled?: boolean;
 *   onApply?: () => void;
 *   onExplain?: () => void;
 * }} props
 */
export default function AiHubSuggestionCard({
  label,
  description,
  why,
  applyDisabled = false,
  onApply,
  onExplain,
}) {
  const [showWhy, setShowWhy] = useState(false);
  const canApply = typeof onApply === 'function' && !applyDisabled;

  return (
    <div
      className={cn(
        'rounded-xl border px-2.5 py-2',
        applyDisabled ? 'border-white/[0.06] bg-white/[0.02]' : 'border-violet-500/20 bg-violet-500/[0.06]',
      )}
    >
      <div className="flex items-start gap-2">
        <Sparkles
          className={cn(
            'mt-0.5 h-3.5 w-3.5 shrink-0',
            applyDisabled ? 'text-white/20' : 'text-violet-400/90',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold text-white/80">{label}</p>
          <p className="mt-0.5 text-[9.5px] leading-relaxed text-white/45">{description}</p>
          {why && showWhy ? (
            <p className="mt-1.5 rounded-lg border border-white/[0.06] bg-black/30 px-2 py-1.5 text-[9px] leading-relaxed text-white/50">
              {why}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {canApply ? (
          <button
            type="button"
            onClick={onApply}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-2 py-1 text-[9px] font-semibold text-emerald-200/95 transition-colors hover:bg-emerald-500/20"
          >
            <CheckCircle2 className="h-3 w-3" />
            Appliquer
          </button>
        ) : null}
        {why ? (
          <button
            type="button"
            onClick={() => setShowWhy((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-medium text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/65"
          >
            <HelpCircle className="h-3 w-3" />
            {showWhy ? 'Masquer' : 'Pourquoi ?'}
          </button>
        ) : null}
        {typeof onExplain === 'function' ? (
          <button
            type="button"
            onClick={onExplain}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[9px] font-medium text-amber-200/90 transition-colors hover:bg-amber-500/16"
          >
            Expliquer
          </button>
        ) : null}
      </div>
    </div>
  );
}
