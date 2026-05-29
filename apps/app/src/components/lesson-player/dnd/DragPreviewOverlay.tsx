import React from 'react';
import { DragOverlay } from '@dnd-kit/core';
import { GripHorizontal } from 'lucide-react';

interface PanelMeta {
  title: string;
  icon?: string;
}

interface DragPreviewOverlayProps {
  activeId: string | null;
  panels: Record<string, PanelMeta>;
}

export function DragPreviewOverlay({ activeId, panels }: DragPreviewOverlayProps) {
  const panel = activeId ? panels[activeId] : null;

  return (
    <DragOverlay
      dropAnimation={{
        duration: 280,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}
    >
      {panel && (
        <div className="w-56 rounded-xl border border-[#D4AF37]/60 bg-[#0d1b2a]/90 shadow-2xl backdrop-blur overflow-hidden pointer-events-none rotate-1 scale-105">
          <div className="flex items-center gap-2 px-3 py-2 bg-black/40 border-b border-white/10">
            <GripHorizontal className="w-3.5 h-3.5 text-[#D4AF37]" />
            {panel.icon && <span className="text-sm leading-none">{panel.icon}</span>}
            <span className="text-xs font-semibold text-white truncate flex-1">{panel.title}</span>
          </div>
          <p className="px-3 py-2 text-[10px] text-gray-400 italic">Déposer pour échanger</p>
        </div>
      )}
    </DragOverlay>
  );
}
