import React from 'react';
import type { SmartboardSlide } from '@/lib/liri-smartboard/types';
import SlideRenderer from '@/components/smartboard/SlideRenderer';

interface Props {
  slide: SmartboardSlide | null;
}

export default function SmartBoardStage({ slide }: Props) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#070B14] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">SmartBoard interactif</p>
      <SlideRenderer slide={slide} />
    </section>
  );
}

