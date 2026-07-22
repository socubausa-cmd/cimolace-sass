import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  slide: {
    title: string;
    mainText: string;
    studentAction: string;
    transition: string;
    state: string;
  } | null;
}

export function SmartBoardStreamStage({ slide }: Props) {
  const generating = slide?.state === 'generating';
  const validated = slide?.state === 'validated';
  return (
    <div className="relative rounded-3xl border border-[#d97757]/30 bg-[radial-gradient(80%_80%_at_20%_0%,rgba(217, 119, 87,0.25),transparent_60%),#090f1f] p-4">
      <div className="mx-auto aspect-video w-full max-w-[980px] rounded-2xl border border-white/15 bg-black/30 p-6">
        {generating ? (
          <motion.div
            className="h-full w-full rounded-xl bg-gradient-to-r from-white/10 via-white/5 to-white/10"
            animate={{ backgroundPositionX: ['0%', '100%'] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
            style={{ backgroundSize: '200% 100%' }}
          />
        ) : (
          <motion.div className="h-full" initial={{ opacity: 0.65 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            <p className="text-xs uppercase tracking-widest text-[#ebca5e]/70">SmartBoard Live</p>
            <motion.h2
              className="mt-3 text-3xl font-bold text-white"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {slide?.title || 'Slide en attente'}
            </motion.h2>
            <motion.p
              className="mt-4 max-w-3xl text-sm text-white/80"
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.06 }}
            >
              {slide?.mainText || 'Le contenu va apparaitre en direct.'}
            </motion.p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-white/80">Action eleve: {slide?.studentAction || '—'}</div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-white/80">Transition: {slide?.transition || '—'}</div>
            </div>
          </motion.div>
        )}
      </div>
      <div className="absolute right-4 top-4 flex gap-2">
        {generating ? <span className="rounded-full border border-[#d97757]/40 bg-[#d97757]/25 px-3 py-1 text-[10px] text-[#d97757] animate-pulse">LIRI genere...</span> : null}
        {validated ? <span className="rounded-full border border-emerald-300/40 bg-emerald-500/25 px-3 py-1 text-[10px] text-emerald-100">Valide par Quality Agent</span> : null}
      </div>
    </div>
  );
}

export default SmartBoardStreamStage;
