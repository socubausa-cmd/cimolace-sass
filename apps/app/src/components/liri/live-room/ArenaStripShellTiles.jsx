import React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const shellClass =
  'relative h-[56px] w-[80px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#1a1028]/95 via-[#0d0814]/90 to-black/80';

const shellFrameClass =
  'pointer-events-none absolute inset-0 rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.22),0_0_14px_-6px_rgba(212,175,55,0.35)]';

/**
 * Emplacement vide du bandeau Arena (même gabarit que ParticipantStripChip).
 */
export function ArenaStripEmptySlot({ className }) {
  return (
    <div
      className={cn(shellClass, className)}
      title="En attente d'un membre"
      aria-hidden
    >
      <div className={cn(shellFrameClass, 'animate-arena-slot-await')} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(180,150,120,0.12),transparent_55%)]" />
      <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-0.5 px-1 pt-2 pb-4">
        <Plus className="h-3.5 w-3.5 text-[color-mix(in_srgb,var(--school-accent)_55%,transparent)]" strokeWidth={2.25} aria-hidden />
        <span className="text-center text-[8px] font-medium leading-tight text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
          En attente
        </span>
      </div>
    </div>
  );
}

/**
 * Tuile surplus type « +N membres » (même coquille que les emplacements vides).
 */
export function ArenaStripOverflowTile({ extraCount, className }) {
  const n = Math.max(0, Number(extraCount) || 0);
  return (
    <div
      className={cn(shellClass, className)}
      title={`${n} autre${n > 1 ? 's' : ''} membre${n > 1 ? 's' : ''} dans la salle`}
    >
      <div className={shellFrameClass} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(180,150,120,0.14),transparent_55%)]" />
      <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-0 px-1 pt-2 pb-4">
        <Plus className="h-3 w-3 text-[color-mix(in_srgb,var(--school-accent)_65%,transparent)]" strokeWidth={2.5} aria-hidden />
        <span className="font-serif text-[11px] font-semibold tabular-nums text-[#f5dd8a]">
          +{n}
        </span>
        <span className="text-[7px] font-medium uppercase tracking-[0.06em] text-[color-mix(in_srgb,var(--school-accent)_65%,transparent)]">
          membres
        </span>
      </div>
    </div>
  );
}
