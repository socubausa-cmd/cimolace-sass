/**
 * Glisser-déposer vertical @dnd-kit pour colonnes modules / semaines / jours / blocs.
 */
import React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SchoolPathColumnDnd({ items, onReorder, disabled, children }) {
  const ids = items.map((i) => i.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleDragEnd = (e) => {
    const { active, over } = e;
    if (disabled || !over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove([...ids], oldIndex, newIndex));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableSchoolRow({ id, disabled, className, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !!disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('mb-1 flex overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]', className)}
    >
      <button
        type="button"
        className={cn(
          'flex shrink-0 items-center border-r border-white/[0.06] bg-white/[0.04] px-0.5 text-white/25 hover:text-white/55',
          disabled ? 'pointer-events-none opacity-25' : 'touch-none cursor-grab active:cursor-grabbing',
        )}
        {...attributes}
        {...listeners}
        aria-label="Réordonner"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
