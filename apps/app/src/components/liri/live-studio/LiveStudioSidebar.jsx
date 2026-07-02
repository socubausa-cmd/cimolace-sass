import React from 'react';
import { Check, Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function sidebarTitle(step) {
  return step?.progressLabel || String(step?.label || '').toUpperCase();
}

/**
 * Timeline verticale progressive — stepper commun du Studio de création (live ET formation) :
 * des nœuds ronds reliés par une ligne qui se colore en ambre au fil de l'avancement —
 * complété = ambre plein + ✓, actif = coral + halo, à venir = contour discret, verrouillé = cadenas.
 */
export function LiveStudioSidebar({ steps, currentStep, onStepClick, stepStates = {}, compact = false }) {
  const nodeSize = compact ? 'h-7 w-7' : 'h-8 w-8';
  const gapBelow = compact ? 'pb-3.5' : 'pb-5';

  return (
    <nav className="w-full">
      <ol className="relative pl-0.5">
        {steps.map((step, idx) => {
          const isActive = step.id === currentStep;
          const state = stepStates[step.key] || {};
          const isCompleted = Boolean(state.completed || step.id < currentStep);
          const isLocked = Boolean(state.locked);
          const hasError = Boolean(state.error);
          const StepIcon = step.icon;
          const isLast = idx === steps.length - 1;
          const canClick = !isLocked;
          // Le segment de ligne SOUS ce nœud est « rempli » dès que l'étape a été dépassée.
          const segmentFilled = step.id < currentStep;
          const title = sidebarTitle(step);

          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => canClick && onStepClick(step.id)}
                disabled={isLocked}
                title={`Étape ${step.id} — ${step.label}`}
                className={cn(
                  'group relative flex w-full items-stretch gap-3 text-left outline-none',
                  isLocked ? 'cursor-not-allowed' : 'cursor-pointer',
                )}
              >
                {/* Colonne timeline : nœud + connecteur */}
                <div className="relative flex flex-col items-center">
                  <span
                    className={cn(
                      'relative z-10 mt-1 flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-all duration-200',
                      nodeSize,
                      isActive &&
                        'bg-[#d97757] text-white ring-4 ring-[#d97757]/18 shadow-[0_0_18px_-3px_rgba(217,119,87,0.6)]',
                      isCompleted && !isActive && !hasError && 'bg-[#d4a36a] text-[#1a1a1a]',
                      hasError && !isActive && 'bg-red-500/85 text-white',
                      !isActive && !isCompleted && !hasError &&
                        cn(
                          'border bg-[#262624]',
                          isLocked
                            ? 'border-white/10 text-gray-600'
                            : 'border-[#d4a36a]/30 text-gray-400 group-hover:border-[#d4a36a]/60 group-hover:text-[#d4a36a]',
                        ),
                    )}
                  >
                    {hasError && !isActive ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : isCompleted && !isActive ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : isLocked && !isActive ? (
                      <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />
                    ) : (
                      step.id
                    )}
                  </span>

                  {/* Connecteur vers l'étape suivante */}
                  {!isLast && (
                    <span
                      className={cn(
                        'w-0.5 flex-1 rounded-full transition-colors duration-300',
                        segmentFilled ? 'bg-[#d4a36a]' : 'bg-white/[0.09]',
                      )}
                    />
                  )}
                </div>

                {/* Colonne libellé */}
                <div className={cn('min-w-0 flex-1 pt-1.5', isLast ? 'pb-1.5' : gapBelow)}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-[10px] font-semibold tabular-nums',
                        isActive ? 'text-[#d97757]' : isCompleted ? 'text-[#d4a36a]/80' : 'text-gray-600',
                      )}
                    >
                      {String(step.id).padStart(2, '0')}
                    </span>
                    <StepIcon
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isActive
                          ? 'text-[#d97757]'
                          : isCompleted && !isActive
                            ? 'text-[#d4a36a]/70'
                            : hasError
                              ? 'text-red-400/80'
                              : 'text-gray-600',
                      )}
                    />
                  </div>
                  <p
                    className={cn(
                      'mt-0.5 truncate font-semibold uppercase leading-tight tracking-[0.05em] transition-colors',
                      compact ? 'text-[10px]' : 'text-[11px]',
                      isActive && 'text-white',
                      isCompleted && !isActive && 'text-gray-200',
                      hasError && !isActive && 'text-red-300',
                      !isActive && !isCompleted && !hasError &&
                        (isLocked ? 'text-gray-600' : 'text-gray-400 group-hover:text-gray-200'),
                    )}
                  >
                    {title}
                  </p>
                  {hasError && state.errorMessage && (
                    <p className="mt-0.5 truncate text-[10px] text-red-300/90">{state.errorMessage}</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
