import React from 'react';
import { motion } from 'framer-motion';

const PIPELINE = ['Texte brut', 'Analyse', 'Chapitres', 'Visual Map', 'Slides', 'Quality', 'Export'];

interface Props {
  status?: 'idle' | 'running' | 'completed' | 'failed';
}

export function PipelineTimeline({ status = 'running' }: Props) {
  const activeIndex = status === 'completed' ? PIPELINE.length - 1 : status === 'running' ? 4 : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/65">Pipeline Global</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {PIPELINE.map((item, idx) => (
          <React.Fragment key={item}>
            <motion.span
              initial={{ opacity: 0.7, scale: 0.96 }}
              animate={{ opacity: 1, scale: idx <= activeIndex ? 1.03 : 1 }}
              transition={{ duration: 0.2 }}
              className={`rounded-full border px-2 py-1 text-[10px] ${idx <= activeIndex ? 'border-violet-400/50 bg-violet-500/20 text-violet-100 shadow-[0_0_20px_-12px_rgba(124,58,237,0.8)]' : 'border-white/15 bg-white/5 text-white/60'}`}
            >
              {item}
            </motion.span>
            {idx < PIPELINE.length - 1 ? <span className="text-white/35">→</span> : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default PipelineTimeline;
