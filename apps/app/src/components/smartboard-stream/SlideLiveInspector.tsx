import React from 'react';

interface Props {
  slide: {
    chapterId: string;
    step: string;
    title: string;
    state: string;
    mainText: string;
  } | null;
  chapterTitle?: string;
}

export function SlideLiveInspector({ slide, chapterTitle = '' }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/65">IA Live</p>
      <div className="space-y-2 text-[11px] text-white/75">
        <p><span className="text-white/50">Chapitre:</span> {chapterTitle || slide?.chapterId || '—'}</p>
        <p><span className="text-white/50">Step:</span> {slide?.step || '—'}</p>
        <p><span className="text-white/50">Etat:</span> {slide?.state || 'waiting'}</p>
        <p><span className="text-white/50">Titre:</span> {slide?.title || '—'}</p>
        <p className="rounded-lg border border-white/10 bg-black/20 p-2 text-[10px] text-white/65">
          {slide?.mainText || 'Le SmartBoard Architect construit ce slide en direct.'}
        </p>
      </div>
    </div>
  );
}

export default SlideLiveInspector;
