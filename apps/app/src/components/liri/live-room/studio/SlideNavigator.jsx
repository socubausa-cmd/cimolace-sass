import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

export default function SlideNavigator({ index, total, onPrev, onNext, onAdd }) {
  return (
    <div className="h-10 px-2 rounded-xl border border-white/10 bg-white/[0.03] inline-flex items-center gap-1.5">
      <button type="button" onClick={onPrev} className="h-7 w-7 rounded-lg hover:bg-white/10 text-white/85">
        <ChevronLeft className="w-4 h-4 mx-auto" />
      </button>
      <span className="text-xs text-white/90 tabular-nums">
        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </span>
      <button type="button" onClick={onNext} className="h-7 w-7 rounded-lg hover:bg-white/10 text-white/85">
        <ChevronRight className="w-4 h-4 mx-auto" />
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="h-7 w-7 rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30"
        title="Ajouter une slide"
      >
        <Plus className="w-4 h-4 mx-auto" />
      </button>
    </div>
  );
}
