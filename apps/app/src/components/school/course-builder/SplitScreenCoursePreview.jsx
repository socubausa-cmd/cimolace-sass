import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { formatSecondsToTimeText, getActiveSegmentIndex, parseTimestampToSeconds } from './segmentUtils';
import CourseSmartboardPanel from './CourseSmartboardPanel';
import { Play, ChevronRight } from 'lucide-react';

export default function SplitScreenCoursePreview({
  videoUrl,
  videoRef,
  /** Styles additionnels sur la balise `<video>` (ex. `filter` NLE) */
  videoStyle = undefined,
  currentTime = 0,
  duration = 0,
  onSeek,
  segments = [],
  aiMap = {},
  mode = 'pedagogical',
  aiStatusText = '',
  activeChapterIdx,
  onSelectChapter,
}) {
  const activeIndex = useMemo(() => getActiveSegmentIndex(segments, currentTime), [segments, currentTime]);

  const resolvedActiveIndex = activeChapterIdx != null ? activeChapterIdx : activeIndex;

  const activeSegment = useMemo(() => {
    if (resolvedActiveIndex == null) return null;
    const row = segments[resolvedActiveIndex];
    if (!row) return null;
    const start = parseTimestampToSeconds(row?.startText);
    const end = parseTimestampToSeconds(row?.endText);
    return {
      ...row,
      index: resolvedActiveIndex,
      startSeconds: Number.isFinite(start) ? start : null,
      endSeconds: Number.isFinite(end) ? end : null,
    };
  }, [resolvedActiveIndex, segments]);

  const activeAi = resolvedActiveIndex != null ? aiMap[String(resolvedActiveIndex)] || null : null;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] overflow-hidden">
      {/* Main split: video | SmartBoard */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 xl:gap-0 min-h-[420px]">
        {/* Left — Video */}
        <div className="relative bg-black flex flex-col">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full flex-1 object-contain"
              style={{ aspectRatio: '16/9', ...(videoStyle || {}) }}
              controls
            />
          ) : (
            <div className="flex-1 aspect-video flex items-center justify-center text-sm text-gray-500">
              <div className="text-center">
                <Play className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <span>URL vidéo manquante</span>
              </div>
            </div>
          )}

          {/* Video progress bar (custom, under video) */}
          <div className="px-3 py-2 bg-black/60 border-t border-white/5 space-y-1 touch-none">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span className="font-mono">{formatSecondsToTimeText(currentTime)}</span>
              <span className="font-mono">{formatSecondsToTimeText(duration)}</span>
            </div>
            <Slider
              value={[progressPct]}
              max={100}
              step={0.1}
              onValueChange={(values) => {
                const pct = Array.isArray(values) ? Number(values[0]) : 0;
                const next = duration > 0 ? (pct / 100) * duration : 0;
                onSeek?.(next);
              }}
              className="h-1.5"
            />
          </div>
        </div>

        {/* Right — SmartBoard (Gamma-like slide) */}
        <div className="relative border-l border-white/5 bg-[#090e1a] min-h-[360px] flex flex-col">
          <CourseSmartboardPanel
            segment={activeSegment}
            aiContent={activeAi}
            mode={mode}
            statusText={aiStatusText}
          />
        </div>
      </div>

      {/* Chapter navigation rail */}
      {segments.length > 0 && (
        <div className="border-t border-white/10 bg-[#070d18] px-3 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold mb-2 px-1">
            Chapitres — navigation
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {segments.map((seg, idx) => {
              const isActive = idx === resolvedActiveIndex;
              const start = parseTimestampToSeconds(seg?.startText);
              const end = parseTimestampToSeconds(seg?.endText);
              const hasAi = Boolean(aiMap[String(idx)]);
              const label = String(seg?.label || '').trim() || `Chapitre ${idx + 1}`;

              // Calculate chapter progress
              let chPct = 0;
              if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
                chPct = Math.max(0, Math.min(100, ((currentTime - start) / (end - start)) * 100));
              }

              return (
                <motion.button
                  key={idx}
                  type="button"
                  onClick={() => onSelectChapter?.(idx)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative shrink-0 rounded-xl border px-3 py-2.5 text-left transition-all min-w-[140px] max-w-[200px] ${
                    isActive
                      ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] shadow-[0_0_16px_rgba(212,175,55,0.15)]'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                  }`}
                >
                  {/* Chapter number */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                      isActive ? 'bg-[var(--school-accent)] text-black' : 'bg-white/10 text-gray-400'
                    }`}>
                      {idx + 1}
                    </span>
                    {hasAi && (
                      <span className="text-[9px] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)] font-semibold uppercase tracking-wider">IA</span>
                    )}
                  </div>

                  {/* Label */}
                  <p className={`text-xs font-medium truncate leading-tight ${isActive ? 'text-white' : 'text-gray-400'}`}>
                    {label}
                  </p>

                  {/* Timecodes */}
                  <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
                    {Number.isFinite(start) ? formatSecondsToTimeText(start) : '--'}
                    {Number.isFinite(end) ? ` → ${formatSecondsToTimeText(end)}` : ''}
                  </p>

                  {/* Chapter progress bar (only for active) */}
                  {isActive && Number.isFinite(start) && Number.isFinite(end) && end > start && (
                    <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full bg-[var(--school-accent)] rounded-full"
                        style={{ width: `${chPct}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                  )}

                  {isActive && (
                    <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
