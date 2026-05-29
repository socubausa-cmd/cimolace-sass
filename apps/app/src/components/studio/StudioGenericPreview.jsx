import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock3, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StudioGenericPreview({ draft, studioLabel, accent = 'amber' }) {
  const accents = {
    amber: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
    emerald: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
    rose: 'text-rose-300 border-rose-400/30 bg-rose-400/10',
    cyan: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10',
    violet: 'text-violet-300 border-violet-400/30 bg-violet-400/10',
  };

  const accentClass = accents[accent] || accents.amber;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="space-y-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-[#121A25]/70 backdrop-blur-xl p-4"
      >
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Aperçu</p>
        <h4 className="text-white font-semibold text-lg line-clamp-2">
          {draft?.title?.trim() || `Nouveau ${studioLabel}`}
        </h4>
        {draft?.description ? (
          <p className="text-sm text-gray-400 mt-2 line-clamp-3">{draft.description}</p>
        ) : (
          <p className="text-sm text-gray-500 mt-2">Ajoutez une description pour enrichir votre aperçu.</p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="grid grid-cols-2 gap-2"
      >
        <motion.div whileHover={{ y: -2 }} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-gray-500">Date</p>
          <p className="text-sm text-white mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {draft?.date || draft?.scheduled_at || 'À planifier'}
          </p>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-gray-500">Durée</p>
          <p className="text-sm text-white mt-1 flex items-center gap-1.5">
            <Clock3 className="w-3.5 h-3.5 text-gray-400" />
            {draft?.duration_minutes ? `${draft.duration_minutes} min` : 'Flexible'}
          </p>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className={cn('rounded-xl border p-3 flex items-start gap-2', accentClass)}
      >
        <Sparkles className="w-4 h-4 mt-0.5" />
        <p className="text-xs">
          Le studio {studioLabel.toLowerCase()} utilise le même moteur premium (autosave, étapes, transitions, preview).
        </p>
      </motion.div>
    </motion.div>
  );
}
