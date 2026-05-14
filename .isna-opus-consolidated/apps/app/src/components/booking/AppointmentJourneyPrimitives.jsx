import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const ambientBlobs = (
  <>
    <motion.div
      className="absolute -top-28 left-1/2 h-[min(480px,55vh)] w-[min(920px,160vw)] -translate-x-1/2 rounded-full bg-[#D4AF37]/14 blur-[110px]"
      animate={{ opacity: [0.45, 0.9, 0.45], scale: [1, 1.06, 1] }}
      transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute bottom-0 right-[-20%] h-[min(380px,45vh)] w-[min(520px,90vw)] rounded-full bg-violet-600/10 blur-[100px]"
      animate={{ opacity: [0.35, 0.65, 0.35] }}
      transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
    />
    <motion.div
      className="absolute top-1/3 left-[-15%] h-[280px] w-[280px] rounded-full bg-amber-900/15 blur-[90px]"
      animate={{ opacity: [0.25, 0.5, 0.25] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
    />
    <div
      className="absolute inset-0 opacity-[0.035]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0L0 0 0 60' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
      }}
    />
  </>
);

/** Fond animé commun (salle d’attente, salon prospect, etc.) */
export function JourneyAmbient() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {ambientBlobs}
    </div>
  );
}

/**
 * Même ambiance, en position absolute — pour modales plein écran ou panneaux `position: relative`.
 */
export function JourneyAmbientInset({ className }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden', className)}>
      {ambientBlobs}
    </div>
  );
}

export function JourneySectionLabel({ children, className = '' }) {
  return (
    <div
      className={`font-display text-[10px] font-semibold uppercase tracking-[0.24em] text-[#D4AF37]/90 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Barre d’action fixe mobile (safe area) — CTA principal + option secondaire.
 */
export function JourneyMobileDock({ primary, secondary }) {
  if (!primary && !secondary) return null;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D4AF37]/20 bg-[#0a0908]/95 px-4 pt-3 backdrop-blur-xl lg:hidden"
      style={{
        paddingBottom: 'max(0.85rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="mx-auto flex w-full max-w-none flex-col gap-2 px-1">
        {primary}
        {secondary}
      </div>
    </div>
  );
}
