import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function SlideNavMarker({ current = 1, total = 1, onPrev, onNext }) {
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30">
      <div className="h-9 px-2 rounded-full border border-white/15 bg-black/40 backdrop-blur-xl flex items-center gap-1.5">
        <button type="button" onClick={onPrev} className="h-7 w-7 rounded-full hover:bg-white/10 text-white/85">
          <ChevronLeft className="w-4 h-4 mx-auto" />
        </button>
        <span className="text-[11px] text-white/90 tabular-nums">
          {String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <button type="button" onClick={onNext} className="h-7 w-7 rounded-full hover:bg-white/10 text-white/85">
          <ChevronRight className="w-4 h-4 mx-auto" />
        </button>
      </div>
    </div>
  );
}
