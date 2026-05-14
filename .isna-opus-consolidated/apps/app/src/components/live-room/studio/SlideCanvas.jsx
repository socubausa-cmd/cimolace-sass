import React from 'react';
import SlideParallaxStage from '@/components/live-room/SlideParallaxStage';

export default function SlideCanvas({ slide }) {
  return (
    <div className="flex-1 min-h-[420px] rounded-2xl border border-white/10 bg-[#0b1119]/75 backdrop-blur-xl p-3">
      <div className="h-full rounded-2xl overflow-hidden">
        <SlideParallaxStage slide={slide} />
      </div>
    </div>
  );
}
