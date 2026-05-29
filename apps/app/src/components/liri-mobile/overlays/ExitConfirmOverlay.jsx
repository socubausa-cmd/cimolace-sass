import React from 'react';
import { motion } from 'framer-motion';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';

/**
 * @param {{ onConfirmLeave: () => void }} props
 */
export function ExitConfirmOverlay({ onConfirmLeave }) {
  const closeOverlay = useMobileLiriStore((s) => s.closeOverlay);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      data-liri-no-doubletap
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-sm rounded-2xl border border-white/12 bg-[#0c1118] p-5 shadow-2xl"
      >
        <p className="text-sm font-semibold text-white">Quitter le live ?</p>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          Le live est en cours. Confirmez pour revenir en arrière ou à l'accueil.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={closeOverlay}
            className="flex-1 rounded-xl border border-white/12 bg-white/[0.05] py-2.5 text-xs font-medium text-white"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              closeOverlay();
              onConfirmLeave();
            }}
            className="flex-1 rounded-xl bg-red-500/90 py-2.5 text-xs font-semibold text-white"
          >
            Quitter
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
