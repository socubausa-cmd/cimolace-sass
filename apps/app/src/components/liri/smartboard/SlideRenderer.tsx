import React from 'react';
import type { SmartboardSlide } from '@/lib/liri-smartboard/types';

interface Props {
  slide: SmartboardSlide | null;
}

export default function SlideRenderer({ slide }: Props) {
  if (!slide) {
    return <div className="rounded-2xl border border-white/10 bg-[#0A101D] p-6 text-sm text-white/60">Sélectionnez une slide.</div>;
  }
  return (
    <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-[#160C2C] via-[#0A101D] to-[#072034] p-6">
      <p className="text-xs uppercase tracking-wide text-violet-300">{slide.chapter_id} · {slide.step}</p>
      <h3 className="mt-2 text-2xl font-bold text-white">{slide.title}</h3>
      <p className="mt-3 text-sm text-violet-100/90">{slide.content?.main_text}</p>
      {slide.content?.support_text ? <p className="mt-2 text-xs text-white/70">{slide.content.support_text}</p> : null}
      <div className="mt-4 grid gap-2 text-xs text-white/70 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/25 p-2">
          <p className="text-[10px] uppercase tracking-wide text-violet-300">Action élève</p>
          <p className="mt-1">{slide.student_action || '—'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 p-2">
          <p className="text-[10px] uppercase tracking-wide text-violet-300">Note professeur</p>
          <p className="mt-1">{slide.teacher_note || '—'}</p>
        </div>
      </div>
    </div>
  );
}

