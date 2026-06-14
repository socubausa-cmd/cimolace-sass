import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Fond + grain léger + halos or — écrans LIRI mobile (dark premium).
 */
export function LiriMobileScreenShell({ children, className, contentClassName }) {
  return (
    <div className={cn('relative min-h-full overflow-hidden text-white flex flex-col bg-[#080706]', className)}>
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 130% 80% at 50% -18%, rgba(212, 175, 55, 0.14), transparent 55%),
            radial-gradient(circle at 105% 15%, rgba(184, 134, 11, 0.09), transparent 38%),
            radial-gradient(circle at -5% 85%, rgba(212, 175, 55, 0.05), transparent 40%),
            linear-gradient(165deg, #0d0b09 0%, #12100d 38%, #0a0907 100%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.055] mix-blend-soft-light"
        aria-hidden
        style={{
          backgroundImage: `repeating-linear-gradient(
            118deg,
            transparent,
            transparent 3px,
            rgba(212, 175, 55, 0.04) 3px,
            rgba(212, 175, 55, 0.04) 4px
          )`,
        }}
      />
      <div
        className={cn(
          'relative flex flex-1 flex-col px-4 pb-2 max-lg:px-5 sm:px-6',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Sous-titre de section (style maquette LIRI). */
export function LiriSectionLabel({ children, className }) {
  return (
    <p
      className={cn(
        'font-display text-[10px] font-semibold uppercase tracking-[0.24em] text-[color-mix(in_srgb,var(--school-accent)_85%,transparent)]',
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Carte bordure or.
 * @param {'default' | 'hero' | 'subtle'} variant — hero = bloc « Reprendre le cours »
 */
export function LiriGoldCard({ children, className, variant = 'default' }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl backdrop-blur-md',
        variant === 'hero' &&
          'border border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-gradient-to-br from-[#1c1814]/95 via-black/55 to-[#0a0806]/90 shadow-[0_0_48px_-12px_rgba(212,175,55,0.32),inset_0_1px_0_rgba(255,220,150,0.12)]',
        variant === 'default' &&
          'border border-[color-mix(in_srgb,var(--school-accent)_32%,transparent)] bg-black/38 shadow-[0_0_36px_-10px_rgba(212,175,55,0.22)]',
        variant === 'subtle' &&
          'border border-white/[0.09] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(212,175,55,0.06)]',
        className,
      )}
    >
      {variant === 'hero' ? (
        <>
          <div
            className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] to-transparent"
            aria-hidden
          />
        </>
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
