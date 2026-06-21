import React, { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import ParticipantFluxCard from './ParticipantFluxCard';
import FluxCounterBadge from './FluxCounterBadge';

export default function ParticipantFluxRail({
  participants = [],
  activeId,
  maxVisible = 6,
  onPromote,
  onOpenMore,
}) {
  const railRef = useRef(null);
  const visible = participants.slice(0, maxVisible);
  const hiddenCount = Math.max(0, participants.length - visible.length);

  const depths = useMemo(
    () =>
      visible.map((_, idx) => {
        const center = (visible.length - 1) / 2;
        const distance = Math.abs(idx - center);
        return Math.max(0.62, 1 - distance * 0.14);
      }),
    [visible]
  );

  const handleWheel = (e) => {
    if (!railRef.current) return;
    railRef.current.scrollLeft += e.deltaY + e.deltaX;
  };

  const nudge = (delta) => {
    if (!railRef.current) return;
    railRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className="absolute top-14 left-72 right-6 z-30 max-md:left-4 max-md:top-16">
      <div
        ref={railRef}
        onWheel={handleWheel}
        className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-white/[0.06] backdrop-blur-xl px-2 py-2 [scrollbar-width:none] shadow-[0_14px_46px_-28px_rgba(255,182,110,0.95)]"
      >
        <button
          type="button"
          onClick={() => nudge(-220)}
          className="flex-shrink-0 h-10 w-10 rounded-xl border border-white/15 bg-black/30 text-white/80 hover:bg-white/10"
          title="Voir les flux précédents"
        >
          <ChevronLeft className="w-4 h-4 mx-auto" />
        </button>
        {visible.map((p, idx) => (
          <ParticipantFluxCard
            key={p.id}
            participant={p}
            active={p.id === activeId}
            depth={depths[idx]}
            onClick={() => onPromote?.(p.id)}
          />
        ))}
        <button
          type="button"
          onClick={onOpenMore}
          className="relative flex-shrink-0 h-14 w-14 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90"
          title="Voir les autres flux"
        >
          <Plus className="w-5 h-5 mx-auto" />
          <FluxCounterBadge count={hiddenCount} />
        </button>
        <button
          type="button"
          onClick={() => nudge(220)}
          className="flex-shrink-0 h-10 w-10 rounded-xl border border-white/15 bg-black/30 text-white/80 hover:bg-white/10"
          title="Voir les flux suivants"
        >
          <ChevronRight className="w-4 h-4 mx-auto" />
        </button>
      </div>
    </div>
  );
}
