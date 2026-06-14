/**
 * Sidebar des étapes — StudioBuilder
 */
import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StudioSidebar({ steps, currentStep, onStepClick, stepStates = {}, compact = false }) {
  return (
    <nav
      className={cn(
        'w-full space-y-1',
        compact ? 'px-1 py-2' : 'px-3 py-6',
      )}
    >
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        const state = stepStates[step.key] || {};
        const isCompleted = Boolean(state.completed || step.id < currentStep);
        const isLocked = Boolean(state.locked);
        const hasError = Boolean(state.error);
        return (
          <motion.button
            key={step.id}
            type="button"
            onClick={() => !isLocked && onStepClick(step.id)}
            whileHover={!isLocked ? { x: 2 } : undefined}
            whileTap={!isLocked ? { scale: 0.99 } : undefined}
            className={cn(
              'flex w-full items-center rounded-xl text-left transition-all duration-200',
              compact ? 'gap-2 px-3 py-2 rounded-lg' : 'gap-3 px-4 py-3',
              isActive && 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)] border-l-2 border-[var(--school-accent)]',
              isCompleted && 'text-gray-400 hover:bg-white/5 hover:text-white',
              !isActive && !isCompleted && 'text-gray-500 hover:bg-white/5',
              hasError && !isActive && 'text-red-300',
              isLocked && 'opacity-60 cursor-not-allowed'
            )}
          >
            <span
              className={cn(
                'flex flex-shrink-0 items-center justify-center rounded-lg text-sm font-medium',
                compact ? 'h-7 w-7' : 'h-8 w-8',
                isActive && 'bg-[var(--school-accent)] text-black',
                isCompleted && 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]',
                !isActive && !isCompleted && 'bg-white/5',
                hasError && 'bg-red-500/20 text-red-300'
              )}
            >
              {isLocked ? (
                <Lock className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              ) : isCompleted ? (
                <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <Check className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                </motion.span>
              ) : hasError ? (
                <AlertCircle className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              ) : (
                <span className={compact ? '[&_svg]:h-3.5 [&_svg]:w-3.5' : ''}>{step.icon}</span>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Étape {step.id}</span>
                {isCompleted && <span className="text-[10px] text-emerald-400">✓</span>}
                {hasError && <span className="text-[10px] text-red-300">!</span>}
              </div>
              <div
                className={cn(
                  'truncate font-display font-medium tracking-tight',
                  compact ? 'text-sm' : 'text-[15px]',
                )}
              >
                {step.label}
              </div>
              {hasError && state.errorMessage && (
                <p className={cn('mt-0.5 truncate text-red-300', compact ? 'text-[10px]' : 'text-[11px]')}>
                  {state.errorMessage}
                </p>
              )}
            </div>
          </motion.button>
        );
      })}
    </nav>
  );
}
