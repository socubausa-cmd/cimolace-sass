import React from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function progressLine(step) {
  return step?.progressLabel || String(step?.label || '').toUpperCase();
}

/**
 * Stepper horizontal — pastille numérotée, libellé capitales, barre or sous l’étape active (maquette).
 */
export function LiveStudioProgress({ steps, currentStep, onStepClick, stepStates = {} }) {
  return (
    <nav
      className="flex w-full justify-center overflow-x-auto pb-1 pt-0.5 scrollbar-thin [-ms-overflow-style:none] [scrollbar-width:thin]"
      aria-label="Progression du studio live"
    >
      <div className="flex min-w-max items-stretch gap-0 sm:gap-0.5">
        {steps.map((step, i) => {
          const isActive = step.id === currentStep;
          const state = stepStates[step.key] || {};
          const isLocked = Boolean(state.locked);
          const hasError = Boolean(state.error);
          const line = progressLine(step);
          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => {
                  if (isLocked) return;
                  onStepClick(step.id);
                }}
                disabled={isLocked}
                className={cn(
                  'group relative shrink-0 rounded-md px-1 pb-2 pt-1 text-left transition-colors sm:px-1.5',
                  isActive && 'cursor-default',
                  !isActive && !isLocked && 'cursor-pointer hover:bg-white/[0.04]',
                  isLocked && 'cursor-not-allowed opacity-50',
                )}
              >
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span
                    className={cn(
                      'flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums sm:h-7 sm:min-w-[1.75rem] sm:text-[11px]',
                      isActive && 'bg-[#7B61FF] text-white shadow-[0_0_16px_-4px_rgba(123,97,255,0.55)]',
                      !isActive && !hasError && 'bg-[#2A2F38] text-gray-400',
                      !isActive && hasError && 'bg-red-500/25 text-red-300',
                    )}
                  >
                    {isLocked ? (
                      <Lock className="h-3 w-3" strokeWidth={2.5} />
                    ) : hasError && !isActive ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : (
                      step.id
                    )}
                  </span>
                  <span
                    className={cn(
                      'max-w-[5rem] truncate whitespace-nowrap text-[8px] font-bold uppercase leading-tight tracking-[0.06em] sm:max-w-none sm:text-[10px]',
                      isActive && 'text-[#7B61FF]',
                      !isActive && !hasError && 'text-gray-500',
                      !isActive && hasError && 'text-red-300/90',
                    )}
                  >
                    {line}
                  </span>
                </div>
                <span
                  className={cn(
                    'absolute bottom-0 left-1 right-1 h-[3px] rounded-full transition-all duration-200',
                    isActive ? 'bg-[#7B61FF]' : 'bg-transparent',
                  )}
                  aria-hidden
                />
              </button>
              {i < steps.length - 1 ? (
                <span
                  className="hidden shrink-0 self-center px-0.5 text-[10px] text-[#3D424C] lg:inline"
                  aria-hidden
                >
                  |
                </span>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
