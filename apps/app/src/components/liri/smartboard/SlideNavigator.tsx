import React from 'react';
import type { SmartboardSlide } from '@/lib/liri-smartboard/types';

interface Props {
  slides: SmartboardSlide[];
  activeSlideId: string | null;
  onSelect: (slideId: string) => void;
}

export default function SlideNavigator({ slides, activeSlideId, onSelect }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A101D] p-3">
      <p className="mb-2 text-xs font-semibold text-white/70">Slides générés ({slides.length})</p>
      <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
        {slides.map((slide) => {
          const active = activeSlideId === slide.slide_id;
          return (
            <button
              key={slide.slide_id}
              type="button"
              onClick={() => onSelect(slide.slide_id)}
              className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                active ? 'border-violet-400/50 bg-violet-500/15 text-violet-100' : 'border-white/10 bg-white/5 text-white/75'
              }`}
            >
              <p className="font-semibold">{slide.title}</p>
              <p className="text-[10px] text-white/50">{slide.chapter_id} · {slide.step}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

