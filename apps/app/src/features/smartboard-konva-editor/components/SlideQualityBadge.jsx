/**
 * SlideQualityBadge — affiche le score qualite de la scene active.
 * Module 2 (score), 12 (anti-surcharge), 16 (memorisation), 17 (impact visuel).
 */
import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const SCORE_LABELS = {
  readability: 'Lisibilite',
  clarity: 'Clarte',
  visual: 'Impact visuel',
  density: 'Anti-surcharge',
  memorization: 'Memorisation',
  pedagogy: 'Pedagogie',
};

function ScoreBar({ value, color }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

export default function SlideQualityBadge({ quality, className }) {
  const [expanded, setExpanded] = useState(false);

  if (!quality) return null;

  const { globalScore, level, levelColor, scores, suggestions, isOverloaded } = quality;

  return (
    <div className={cn('rounded-xl border bg-[#0d1020]/95 shadow-lg', isOverloaded ? 'border-amber-500/40' : 'border-white/[0.08]', className)}>
      {/* Header compact */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2"
      >
        {/* Score circle */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold"
          style={{ borderColor: levelColor, color: levelColor }}
        >
          {globalScore}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Score qualite
          </p>
          <p className="text-[11px] font-bold capitalize" style={{ color: levelColor }}>
            {level}
          </p>
        </div>
        {isOverloaded && (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" title="Slide surchargee" />
        )}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-white/35" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/35" />
        )}
      </button>

      {/* Detail */}
      {expanded && (
        <div className="space-y-3 border-t border-white/[0.07] px-3 pb-3 pt-2">
          {/* Barres de scores */}
          <div className="space-y-1.5">
            {Object.entries(scores).map(([key, val]) => (
              <div key={key}>
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-[8px] text-white/45">{SCORE_LABELS[key]}</span>
                  <span className="text-[8px] font-mono" style={{ color: val >= 70 ? '#22c55e' : val >= 50 ? '#f59e0b' : '#ef4444' }}>
                    {val}
                  </span>
                </div>
                <ScoreBar value={val} color={val >= 70 ? '#22c55e' : val >= 50 ? '#f59e0b' : '#ef4444'} />
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-amber-400/80">
                Suggestions
              </p>
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 rounded-lg bg-amber-900/20 px-2 py-1">
                  <Zap className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                  <p className="text-[9px] leading-snug text-amber-100/80">{s.text}</p>
                </div>
              ))}
            </div>
          )}
          {suggestions.length === 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-green-900/20 px-2 py-1.5">
              <CheckCircle className="h-3 w-3 shrink-0 text-green-400" />
              <p className="text-[9px] text-green-200/80">Slide bien optimisee !</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
