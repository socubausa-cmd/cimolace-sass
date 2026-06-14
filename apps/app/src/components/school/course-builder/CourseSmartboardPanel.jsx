import React from 'react';
import { Sparkles } from 'lucide-react';
import SmartboardSegmentRenderer from './SmartboardSegmentRenderer';
import { formatSecondsToTimeText } from './segmentUtils';

export default function CourseSmartboardPanel({
  segment,
  aiContent,
  mode = 'pedagogical',
  statusText = '',
}) {
  const start = Number(segment?.startSeconds);
  const end = Number(segment?.endSeconds);

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-[#111a2a]/95 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-white/10 bg-black/20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Tableau IA</p>
            <h3 className="text-sm font-semibold text-white mt-0.5">
              {aiContent?.chapter_title || segment?.label || 'Segment'}
            </h3>
          </div>
          <div className="inline-flex items-center h-7 px-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/15 text-[#D4AF37] text-[11px] font-medium">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {mode === 'masterclass' ? 'Masterclass' : mode === 'reformulation' ? 'Reformulation' : 'Pedagogique'}
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {Number.isFinite(start) ? formatSecondsToTimeText(start) : '--'}
          {' -> '}
          {Number.isFinite(end) ? formatSecondsToTimeText(end) : '--'}
          {statusText ? ` • ${statusText}` : ''}
        </div>
      </div>

      <div className="flex-1 p-3 min-h-0">
        <SmartboardSegmentRenderer segment={segment} aiContent={aiContent} mode={mode} className="h-full" />
      </div>
    </div>
  );
}
