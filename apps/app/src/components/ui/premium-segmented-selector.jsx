import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PremiumSegmentedSelector({
  value,
  onChange,
  options = [],
  className,
  railClassName,
  optionClassName,
  layoutId = 'premium-segment-pill',
  showChevron = true,
  compact = false,
}) {
  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'flex flex-wrap gap-2 p-2 rounded-2xl bg-[#30302e]/80 backdrop-blur-xl border border-white/5',
          railClassName
        )}
      >
        {options.map((option) => {
          const isActive = value === option.value;
          const Icon = option.icon;
          return (
            <motion.button
              key={option.value}
              type="button"
              onClick={() => !option.disabled && onChange?.(option.value)}
              disabled={option.disabled}
              whileHover={option.disabled ? undefined : { scale: 1.02 }}
              whileTap={option.disabled ? undefined : { scale: 0.98 }}
              className={cn(
                'relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-left transition-colors',
                compact ? 'min-w-[120px]' : 'min-w-[150px]',
                option.disabled
                  ? 'cursor-not-allowed opacity-50 text-white/40'
                  : isActive
                    ? 'text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5',
                optionClassName
              )}
            >
              {isActive ? (
                <motion.div
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] to-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              ) : null}
              {Icon ? (
                <span
                  className={cn(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-lg',
                    isActive ? 'bg-[var(--school-accent)] text-black' : 'bg-white/5 text-white/50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </span>
              ) : null}
              <span className="relative z-10 min-w-0">
                <span className="block truncate text-sm font-medium">{option.label}</span>
                {option.badge ? <span className="block truncate text-xs text-white/40">{option.badge}</span> : null}
              </span>
              {showChevron && isActive ? (
                <ChevronRight className="relative z-10 ml-auto h-4 w-4 text-[var(--school-accent)]" />
              ) : null}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
