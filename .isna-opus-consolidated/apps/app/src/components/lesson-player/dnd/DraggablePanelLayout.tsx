import React, { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { RotateCcw } from 'lucide-react';
import { usePanelLayout, SLOT_IDS, type SlotId, type PanelSlots } from './usePanelLayout';
import { PanelCard } from './PanelCard';
import { PanelSlot } from './PanelSlot';
import { DragPreviewOverlay } from './DragPreviewOverlay';

export interface PanelMeta {
  title: string;
  icon?: string;
}

const DEFAULT_PANEL_META: Record<string, PanelMeta> = {
  mindmap:     { title: 'Mindmap',       icon: '🗺️' },
  summary:     { title: 'Résumé',        icon: '📋' },
  keypoints:   { title: 'Points clés',   icon: '✨' },
  explanation: { title: 'Explication',   icon: '📖' },
  visuals:     { title: 'Visualisations',icon: '🎨' },
};

export interface DraggablePanelLayoutProps {
  /** Map panelId → ReactNode content */
  panels: Record<string, React.ReactNode>;
  /** Override titles/icons per panelId */
  panelsMeta?: Record<string, PanelMeta>;
  initialLayout?: Partial<PanelSlots>;
  storageKey?: string;
}

export function DraggablePanelLayout({
  panels,
  panelsMeta,
  initialLayout,
  storageKey = 'mindmap-panel-layout',
}: DraggablePanelLayoutProps) {
  const { slots, collapsed, swapPanels, promoteToMain, toggleCollapsed, resetLayout } =
    usePanelLayout(storageKey, initialLayout);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const draggedPanelId = active.id as string;
    const targetSlotId = over.id as SlotId;
    const sourceSlotId = SLOT_IDS.find((s) => slots[s] === draggedPanelId);
    if (!sourceSlotId || sourceSlotId === targetSlotId) return;
    swapPanels(sourceSlotId, targetSlotId);
  }

  function getMeta(panelId: string): PanelMeta {
    return panelsMeta?.[panelId] ?? DEFAULT_PANEL_META[panelId] ?? { title: panelId };
  }

  const mainPanelId = slots.main;
  const sideSlots: SlotId[] = ['side1', 'side2', 'side3', 'side4'];

  const overlayMeta: Record<string, PanelMeta> = {};
  Object.keys(panels).forEach((id) => { overlayMeta[id] = getMeta(id); });

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* ── Desktop: main left + sidebar right │ Mobile: stacked ── */}
      <div className="flex flex-col md:flex-row h-full overflow-hidden gap-2 p-1">

        {/* ── Main panel ── */}
        <PanelSlot slotId="main" isMain>
          <PanelCard
            panelId={mainPanelId}
            title={getMeta(mainPanelId).title}
            icon={getMeta(mainPanelId).icon}
            isMain
            collapsed={collapsed[mainPanelId] ?? false}
            onToggleCollapse={() => toggleCollapsed(mainPanelId)}
          >
            {panels[mainPanelId]}
          </PanelCard>
        </PanelSlot>

        {/* ── Side column ── */}
        <div className="md:w-[280px] flex-shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-hidden overflow-y-visible md:overflow-y-auto pb-1 md:pb-0">
          {sideSlots.map((slotId) => {
            const panelId = slots[slotId];
            if (!panels[panelId]) return null;
            const meta = getMeta(panelId);
            return (
              <div key={slotId} className="min-w-[220px] md:min-w-0 flex-shrink-0 md:flex-shrink md:flex-1">
                <PanelSlot slotId={slotId} isMain={false}>
                  <PanelCard
                    panelId={panelId}
                    title={meta.title}
                    icon={meta.icon}
                    isMain={false}
                    collapsed={collapsed[panelId] ?? false}
                    onToggleCollapse={() => toggleCollapsed(panelId)}
                    onPromote={() => promoteToMain(slotId)}
                  >
                    {panels[panelId]}
                  </PanelCard>
                </PanelSlot>
              </div>
            );
          })}

          {/* Reset button */}
          <button
            type="button"
            aria-label="Réinitialiser la disposition des panneaux"
            onClick={resetLayout}
            className="md:mt-auto flex-shrink-0 flex items-center justify-center gap-1.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors py-1 px-2 whitespace-nowrap"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Réinitialiser
          </button>
        </div>
      </div>

      <DragPreviewOverlay activeId={activeId} panels={overlayMeta} />
    </DndContext>
  );
}
