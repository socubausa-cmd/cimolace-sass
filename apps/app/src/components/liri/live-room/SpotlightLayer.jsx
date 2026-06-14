import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function SpotlightLayer({ active }) {
  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_42%,transparent_0%,rgba(0,0,0,0.12)_24%,rgba(0,0,0,0.5)_64%)]"
        />
      ) : null}
    </AnimatePresence>
  );
}
