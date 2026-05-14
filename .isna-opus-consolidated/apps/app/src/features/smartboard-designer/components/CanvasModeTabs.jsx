/**
 * CanvasModeTabs — Design / Mindmap / Script mode switcher.
 * Connects to useSmartboardStore.canvasMode.
 */
import React from 'react';
import { Monitor, Brain, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartboardStore } from '@/stores/smartboard.store';

const MODES = [
  { id: 'design', label: 'Design', icon: Monitor },
  { id: 'mindmap', label: 'Mindmap', icon: Brain },
  { id: 'script', label: 'Script', icon: ScrollText },
];

export default function CanvasModeTabs({ className }) {
  const canvasMode = useSmartboardStore((s) => s.canvasMode);
  const setCanvasMode = useSmartboardStore((s) => s.setCanvasMode);

  return (
    <div className={cn('flex rounded-lg border border-white/10 bg-black/30 p-0.5', className)}>
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setCanvasMode(id)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-medium transition-colors',
            canvasMode === id
              ? 'bg-[#D4AF37] text-black'
              : 'text-white/45 hover:text-white/70',
          )}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  );
}
