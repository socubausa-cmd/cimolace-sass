import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SelectionBox } from '@/engines/types';

export type DesignerTool =
  | 'select'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'image'
  | 'pencil'
  | 'pen'
  | 'hand'
  | 'zoom'
  | 'templates'
  | 'icons'
  | 'pedagogical-block';

export type EditMode = 'idle' | 'transform' | 'text-edit' | 'path-edit' | 'crop';

type SelectionStore = {
  // State
  selectedIds: string[];
  hoveredId: string | null;
  selectionBox: SelectionBox | null;
  activeTool: DesignerTool;
  editMode: EditMode;
  clipboard: string[];

  // Actions
  selectOnly: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  addToSelection: (id: string) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;
  setSelectionBox: (box: SelectionBox | null) => void;
  setActiveTool: (tool: DesignerTool) => void;
  setEditMode: (mode: EditMode) => void;
  copySelected: () => void;
  getClipboard: () => string[];
  isSelected: (id: string) => boolean;
};

export const useSelectionStore = create<SelectionStore>()(
  devtools(
    (set, get) => ({
      selectedIds: [],
      hoveredId: null,
      selectionBox: null,
      activeTool: 'select',
      editMode: 'idle',
      clipboard: [],

      selectOnly: (id) => set({ selectedIds: [id], editMode: 'idle' }),
      selectMultiple: (ids) => set({ selectedIds: ids, editMode: 'idle' }),

      toggleSelect: (id) => set((s) => ({
        selectedIds: s.selectedIds.includes(id)
          ? s.selectedIds.filter((i) => i !== id)
          : [...s.selectedIds, id],
      })),

      addToSelection: (id) => set((s) => ({
        selectedIds: s.selectedIds.includes(id) ? s.selectedIds : [...s.selectedIds, id],
      })),

      clearSelection: () => set({ selectedIds: [], editMode: 'idle' }),
      setHovered: (id) => set({ hoveredId: id }),
      setSelectionBox: (box) => set({ selectionBox: box }),
      setActiveTool: (tool) => set({ activeTool: tool, editMode: 'idle', selectedIds: [] }),
      setEditMode: (mode) => set({ editMode: mode }),

      copySelected: () => set((s) => ({ clipboard: [...s.selectedIds] })),
      getClipboard: () => get().clipboard,
      isSelected: (id) => get().selectedIds.includes(id),
    }),
    { name: 'selection-store' },
  ),
);
