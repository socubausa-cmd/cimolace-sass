import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { GripHorizontal, Maximize2, ChevronDown, ChevronUp } from 'lucide-react';

export interface PanelCardProps {
  panelId: string;
  title: string;
  icon?: string;
  isMain: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  children: React.ReactNode;
  onPromote?: () => void;
}

export function PanelCard({
  panelId,
  title,
  icon,
  isMain,
  collapsed,
  onToggleCollapse,
  children,
  onPromote,
}: PanelCardProps) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, isDragging } =
    useDraggable({ id: panelId });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col rounded-xl border bg-[#0d1b2a] overflow-hidden shadow-md h-full transition-opacity duration-150 ${
        isDragging ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]' : 'border-white/10'
      }`}
    >
      {/* ── Draggable header ── */}
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/30 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
      >
        <GripHorizontal className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" aria-hidden="true" />
        {icon && <span className="text-sm leading-none" aria-hidden="true">{icon}</span>}
        <span className="text-xs font-semibold text-gray-200 truncate flex-1">{title}</span>

        <div className="flex items-center gap-0.5 ml-1">
          {!isMain && onPromote && (
            <button
              type="button"
              aria-label={`Promouvoir ${title} en panneau principal`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onPromote(); }}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-[var(--school-accent)] transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            aria-label={collapsed ? `Déplier ${title}` : `Replier ${title}`}
            aria-expanded={!collapsed}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            {collapsed
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronUp className="w-3 h-3" />
            }
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex-1 overflow-hidden min-h-0 flex flex-col"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
