import React from 'react';
import { motion } from 'framer-motion';

interface ChapterItem {
  chapter_id: string;
  title: string;
  status: string;
}

interface Props {
  chapters: ChapterItem[];
}

const PHASES = ['coach', 'visual', 'smartboard', 'quality'];

function resolvePhase(status: string) {
  if (['draft', 'structured', 'ready_for_visual'].includes(status)) return 'coach';
  if (['visual_mapped', 'ready_for_smartboard'].includes(status)) return 'visual';
  if (['smartboard_generating', 'smartboard_completed'].includes(status)) return 'smartboard';
  if (['completed', 'failed'].includes(status)) return 'quality';
  return 'coach';
}

export default function ChapterGanttLive({ chapters }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/65">Parallel Chapter Timeline</p>
      <div className="mb-2 grid grid-cols-[150px_repeat(4,minmax(0,1fr))] gap-1 text-[10px] text-white/60">
        <span>Chapitre</span>
        {PHASES.map((phase) => (
          <span key={phase} className="text-center uppercase">{phase}</span>
        ))}
      </div>
      <div className="space-y-1.5">
        {(chapters || []).map((chapter) => {
          const active = resolvePhase(chapter.status);
          return (
            <div key={chapter.chapter_id} className="grid grid-cols-[150px_repeat(4,minmax(0,1fr))] items-center gap-1">
              <div className="truncate rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-white/80">
                Ch {chapter.chapter_id} · {chapter.title}
              </div>
              {PHASES.map((phase) => {
                const done = PHASES.indexOf(phase) < PHASES.indexOf(active);
                const isActive = phase === active;
                return (
                  <div key={`${chapter.chapter_id}-${phase}`} className="h-6 rounded-md border border-white/10 bg-black/20 p-0.5">
                    {done ? (
                      <div className="h-full rounded bg-emerald-500/35" />
                    ) : isActive ? (
                      <motion.div
                        className="h-full rounded bg-violet-500/35"
                        animate={{ opacity: [0.45, 0.95, 0.45] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                      />
                    ) : (
                      <div className="h-full rounded bg-white/5" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
