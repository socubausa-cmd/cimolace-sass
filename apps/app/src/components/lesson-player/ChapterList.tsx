import React, { useMemo } from 'react';
import { LessonTimestamp, tsToSeconds, formatTime } from './types';

type Props = {
  timestamps: LessonTimestamp[];
  currentTimeSeconds: number;
  onSeek: (timeSeconds: number) => void;
};

const ChapterList: React.FC<Props> = ({ timestamps, currentTimeSeconds, onSeek }) => {
  const chapters = useMemo(() => {
    return (timestamps || [])
      .map((t) => ({
        label: String(t.label || '').trim(),
        timeSeconds: tsToSeconds(t) ?? 0,
      }))
      .filter((t) => t.label)
      .sort((a, b) => a.timeSeconds - b.timeSeconds);
  }, [timestamps]);

  const activeIdx = useMemo(() => {
    if (chapters.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < chapters.length; i += 1) {
      if (chapters[i].timeSeconds <= currentTimeSeconds + 0.25) idx = i;
    }
    return idx;
  }, [chapters, currentTimeSeconds]);

  return (
    <div className="h-full overflow-auto">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Chapitres</div>
      <div className="space-y-1">
        {chapters.length === 0 ? (
          <div className="text-sm text-gray-500">Aucun chapitre</div>
        ) : (
          chapters.map((c, idx) => {
            const active = idx === activeIdx;
            return (
              <button
                key={`${c.timeSeconds}-${c.label}`}
                type="button"
                onClick={() => onSeek(c.timeSeconds)}
                className={
                  active
                    ? 'w-full text-left px-3 py-2 rounded bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]'
                    : 'w-full text-left px-3 py-2 rounded hover:bg-white/5 border border-white/10'
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className={active ? 'text-sm text-white font-semibold truncate' : 'text-sm text-gray-200 truncate'}>
                    {c.label}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0">{formatTime(c.timeSeconds)}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChapterList;
