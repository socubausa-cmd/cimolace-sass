import React from 'react';

interface Props {
  chapters: Array<{
    id?: string;
    chapter_id: string;
    title: string;
    status: string;
    progress?: number;
    slidesGenerated?: number;
    slidesValidated?: number;
    totalSlides?: number;
    slides_count: number;
  }>;
  selectedChapterId?: string | null;
  onSelect?: (id: string) => void;
}

export function ChapterProgressBoard({ chapters, selectedChapterId, onSelect }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/65">Chapitres en Parallel</p>
      <div className="space-y-1.5">
        {(chapters || []).map((chapter) => (
          <button
            key={chapter.chapter_id}
            type="button"
            onClick={() => onSelect?.(chapter.chapter_id)}
            className={`w-full rounded-xl border px-3 py-2 text-left transition ${
              selectedChapterId === chapter.chapter_id
                ? 'border-violet-400/50 bg-violet-500/15'
                : 'border-white/10 bg-black/20 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white">Ch {chapter.chapter_id}</p>
              <span className="text-[10px] text-white/65">{chapter.status}</span>
            </div>
            <p className="mt-1 truncate text-[10px] text-white/65">{chapter.title}</p>
            <p className="mt-1 text-[10px] text-cyan-200/70">
              {(chapter.slidesGenerated ?? chapter.slides_count ?? 0)} / {(chapter.totalSlides ?? 19)} slides
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ChapterProgressBoard;
