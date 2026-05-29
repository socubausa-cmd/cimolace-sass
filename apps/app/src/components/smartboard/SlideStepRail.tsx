import React from 'react';
import { SMARTBOARD_STEPS } from '@/lib/liri-smartboard/steps';

interface Props {
  activeStepKey: string | null;
  onSelect: (stepKey: string) => void;
}

export default function SlideStepRail({ activeStepKey, onSelect }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A101D] p-3">
      <p className="mb-2 text-xs font-semibold text-white/70">Étapes pédagogiques (19)</p>
      <div className="grid gap-1.5">
        {SMARTBOARD_STEPS.map((step, idx) => {
          const active = activeStepKey === step.key;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onSelect(step.key)}
              className={`rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                active ? 'bg-violet-600/25 text-violet-200 border border-violet-400/40' : 'bg-white/5 text-white/70 border border-white/10'
              }`}
            >
              {idx + 1}. {step.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

