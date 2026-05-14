import React from 'react';
import { cn } from '@/lib/utils';

export default function SlideSidebar({ slides = [], activeIndex = 0, onSelect }) {
  return (
    <aside className="w-56 rounded-2xl border border-white/10 bg-[#0d1420]/70 backdrop-blur-xl p-2 space-y-1 overflow-y-auto">
      {slides.map((slide, idx) => (
        <button
          key={slide.id}
          type="button"
          onClick={() => onSelect?.(idx)}
          className={cn(
            'w-full text-left rounded-xl px-2.5 py-2 border transition-colors',
            idx === activeIndex
              ? 'border-[#D4AF37]/35 bg-[#D4AF37]/12 text-[#D4AF37]'
              : 'border-white/0 hover:border-white/10 hover:bg-white/[0.03] text-gray-200'
          )}
        >
          <p className="text-[10px] text-gray-500">Slide {String(idx + 1).padStart(2, '0')}</p>
          <p className="text-xs truncate">{slide.title || `Scène ${idx + 1}`}</p>
        </button>
      ))}
    </aside>
  );
}
