import React from 'react';
import { motion } from 'framer-motion';

export function LiriHeartBurst({ id, onDone }) {
  return (
    <motion.span
      layout={false}
      initial={{ opacity: 0, y: 24, scale: 0.6 }}
      animate={{ opacity: 1, y: -48, scale: 1.1 }}
      exit={{ opacity: 0, y: -90, scale: 0.9 }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={onDone}
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl drop-shadow-[0_4px_20px_rgba(212,175,55,0.45)]"
      aria-hidden
    >
      ❤️
    </motion.span>
  );
}
