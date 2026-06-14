import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';

interface PanelSlotProps {
  slotId: string;
  isMain: boolean;
  children: React.ReactNode;
}

export function PanelSlot({ slotId, isMain, children }: PanelSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });

  return (
    <motion.div
      layout
      ref={setNodeRef}
      className={`relative flex flex-col transition-all duration-200 ${isMain ? 'flex-1 min-w-0 min-h-0' : 'flex-1 min-h-0'}`}
    >
      {/* Drop halo */}
      {isOver && (
        <motion.div
          key="halo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 rounded-xl ring-2 ring-[color-mix(in_srgb,var(--school-accent)_70%,transparent)] ring-inset bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] z-20 pointer-events-none"
        />
      )}
      {children}
    </motion.div>
  );
}
