import React from 'react';
import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * En-tête colonne gauche maquette LIRI : marque + pastille « événements en direct ».
 */
export function LiriHostBrandHeader({ className }) {
  return (
    <div className={cn('flex flex-col gap-3 border-b border-white/[0.06] pb-4', className)}>
      <div className="flex items-center gap-2.5 px-0.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/[0.18] shadow-[0_0_20px_-4px_rgba(212,163,106,0.45)]"
          aria-hidden
        >
          <Brain className="h-6 w-6 text-amber-200/90" strokeWidth={1.25} />
        </div>
        <span className="font-serif text-[1.65rem] leading-none tracking-[0.04em] text-[#e5c47a]">
          LIRI
        </span>
      </div>
      <div className="flex items-center gap-2 px-0.5">
        <span
          className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.85)]"
          aria-hidden
        />
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#ff8c42]">
          Événements en direct
        </span>
      </div>
    </div>
  );
}
