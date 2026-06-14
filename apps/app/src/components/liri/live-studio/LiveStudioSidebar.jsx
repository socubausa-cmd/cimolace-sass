import React from 'react';
import { Check, Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function sidebarTitle(step) {
  return step?.progressLabel || String(step?.label || '').toUpperCase();
}

export function LiveStudioSidebar({ steps, currentStep, onStepClick, stepStates = {} }) {
  return (
    <nav className="w-full space-y-1.5">
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        const state = stepStates[step.key] || {};
        const isCompleted = Boolean(state.completed || step.id < currentStep);
        const isLocked = Boolean(state.locked);
        const hasError = Boolean(state.error);
        const StepIcon = step.icon;
        const title = sidebarTitle(step);
        const canClick = !isLocked;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => canClick && onStepClick(step.id)}
            disabled={isLocked}
            title={`Étape ${step.id} — ${step.label}`}
            className={cn(
              'group relative flex min-h-[48px] w-full items-center gap-2.5 overflow-hidden rounded-xl border text-left transition-all duration-200',
              'pl-3 pr-2',
              isActive &&
                'border-[#7B61FF]/35 bg-gradient-to-r from-[#7B61FF]/12 via-[#7B61FF]/05 to-transparent text-white shadow-[inset_4px_0_0_0_#7B61FF]',
              isCompleted &&
                !isActive &&
                !hasError &&
                'border-emerald-500/18 bg-emerald-500/[0.05] text-emerald-200/85',
              hasError &&
                !isActive &&
                'border-red-500/25 bg-red-500/[0.06] text-red-200/90',
              !isActive &&
                !isCompleted &&
                !hasError &&
                'border-[#2D3139] bg-[#14161c]/80 text-gray-500 hover:border-white/10 hover:bg-white/[0.03] hover:text-gray-300',
              isLocked && 'opacity-55 cursor-not-allowed',
            )}
          >
            <span
              className={cn(
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tabular-nums',
                isActive && 'bg-[#7B61FF] text-white shadow-[0_0_12px_-2px_rgba(123,97,255,0.45)]',
                isCompleted && !isActive && !hasError && 'bg-emerald-500/22 text-emerald-300',
                hasError && !isActive && 'bg-red-500/20 text-red-300',
                !isActive && !isCompleted && !hasError && 'bg-[#2A2F38] text-gray-400',
              )}
            >
              {isLocked ? (
                <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />
              ) : isActive ? (
                <Check className="h-3.5 w-3.5 stroke-[2.75]" />
              ) : isCompleted ? (
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              ) : hasError ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                step.id
              )}
            </span>
            <div className="min-w-0 flex-1 pr-6">
              <p
                className={cn(
                  'truncate text-[10px] font-bold uppercase leading-tight tracking-[0.08em]',
                  isActive && 'text-white',
                  !isActive && 'text-gray-500 group-hover:text-gray-400',
                )}
              >
                <span className="tabular-nums text-gray-500">{step.id}</span>{' '}
                <span className={cn(isActive && 'text-white')}>{title}</span>
              </p>
              {hasError && state.errorMessage && (
                <p className="mt-0.5 truncate text-[10px] text-red-300/90">{state.errorMessage}</p>
              )}
            </div>
            <StepIcon
              className={cn(
                'absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 shrink-0',
                isActive && 'text-[#7B61FF]',
                isCompleted && !isActive && !hasError && 'text-emerald-500/65',
                hasError && !isActive && 'text-red-400/80',
                !isActive && !isCompleted && !hasError && 'text-gray-600',
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}
