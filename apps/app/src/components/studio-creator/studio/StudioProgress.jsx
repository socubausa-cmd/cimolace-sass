/**
 * Barre de progression générique — StudioBuilder
 */
import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StudioProgress({ steps, currentStep, onStepClick, stepStates = {}, compact = false }) {
  return (
    <div className={cn('items-center gap-1', compact ? 'flex' : 'hidden md:flex')}>
      {steps.map((step, i) => {
        const isActive = step.id === currentStep;
        const state = stepStates[step.key] || {};
        const isCompleted = Boolean(state.completed || step.id < currentStep);
        const isLocked = Boolean(state.locked);
        const hasError = Boolean(state.error);
        const isClickable = !isLocked;
        return (
          <React.Fragment key={step.id}>
            <motion.button
              type="button"
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              whileHover={isClickable ? { y: -1 } : undefined}
              whileTap={isClickable ? { scale: 0.98 } : undefined}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all',
                isActive && 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]',
                isCompleted && 'text-gray-400 hover:text-white',
                !isActive && !isCompleted && 'text-gray-500',
                isClickable && 'cursor-pointer',
                hasError && !isActive && 'text-red-300',
                isLocked && 'opacity-60 cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                  isActive && 'bg-[var(--school-accent)] text-black',
                  isCompleted && 'bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-[var(--school-accent)]',
                  !isActive && !isCompleted && 'bg-white/5',
                  hasError && 'bg-red-500/20 text-red-300'
                )}
              >
                {isLocked ? (
                  <Lock className="w-3 h-3" />
                ) : isCompleted ? (
                  <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <Check className="w-3 h-3" />
                  </motion.span>
                ) : hasError ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  step.id
                )}
              </span>
              <span className={cn('font-display tracking-tight', compact ? 'hidden' : 'hidden md:inline')}>
                {step.label}
              </span>
            </motion.button>
            {i < steps.length - 1 && (
              <motion.div
                className="h-px w-4 bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)]"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isCompleted ? 1 : 0.35 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
