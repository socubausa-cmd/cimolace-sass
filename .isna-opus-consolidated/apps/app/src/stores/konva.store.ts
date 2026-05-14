import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DesignElement, BoardState, SelectionBox } from '@/engines/types';

type HistoryEntry = {
  elements: DesignElement[];
  timestamp: number;
};

type KonvaStore = {
  // Canvas state
  elements: DesignElement[];
  zoom: number;
  panX: number;
  panY: number;
  gridEnabled: boolean;
  gridSize: number;
  snapEnabled: boolean;

  // History
  past: HistoryEntry[];
  future: HistoryEntry[];

  // Actions — elements
  setElements: (elements: DesignElement[]) => void;
  addElement: (el: DesignElement) => void;
  addElements: (els: DesignElement[]) => void;
  updateElement: (id: string, patch: Partial<DesignElement>) => void;
  updateElements: (updates: Array<{ id: string; patch: Partial<DesignElement> }>) => void;
  deleteElement: (id: string) => void;
  deleteElements: (ids: string[]) => void;
  reorderElements: (fromIndex: number, toIndex: number) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Actions — canvas
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  setPan: (x: number, y: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;

  // Actions — history
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  // Actions — state serialization
  serializeState: () => BoardState;
  loadState: (state: BoardState) => void;
};

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.1;

export const useKonvaStore = create<KonvaStore>()(
  devtools(
    (set, get) => ({
      elements: [],
      zoom: 1,
      panX: 0,
      panY: 0,
      gridEnabled: false,
      gridSize: 8,
      snapEnabled: false,
      past: [],
      future: [],

      setElements: (elements) => {
        get().pushHistory();
        set({ elements });
      },

      addElement: (el) => {
        get().pushHistory();
        set((s) => ({ elements: [...s.elements, el] }));
      },

      addElements: (els) => {
        get().pushHistory();
        set((s) => ({ elements: [...s.elements, ...els] }));
      },

      updateElement: (id, patch) => set((s) => ({
        elements: s.elements.map((el) => el.id === id ? { ...el, ...patch } : el),
      })),

      updateElements: (updates) => set((s) => {
        const map = new Map(updates.map((u) => [u.id, u.patch]));
        return { elements: s.elements.map((el) => map.has(el.id) ? { ...el, ...map.get(el.id) } : el) };
      }),

      deleteElement: (id) => {
        get().pushHistory();
        set((s) => ({ elements: s.elements.filter((el) => el.id !== id) }));
      },

      deleteElements: (ids) => {
        get().pushHistory();
        const idSet = new Set(ids);
        set((s) => ({ elements: s.elements.filter((el) => !idSet.has(el.id)) }));
      },

      reorderElements: (from, to) => set((s) => {
        const els = [...s.elements];
        const [moved] = els.splice(from, 1);
        els.splice(to, 0, moved);
        return { elements: els };
      }),

      bringForward: (id) => set((s) => {
        const idx = s.elements.findIndex((e) => e.id === id);
        if (idx >= s.elements.length - 1) return s;
        const els = [...s.elements];
        [els[idx], els[idx + 1]] = [els[idx + 1], els[idx]];
        return { elements: els };
      }),

      sendBackward: (id) => set((s) => {
        const idx = s.elements.findIndex((e) => e.id === id);
        if (idx <= 0) return s;
        const els = [...s.elements];
        [els[idx], els[idx - 1]] = [els[idx - 1], els[idx]];
        return { elements: els };
      }),

      bringToFront: (id) => set((s) => {
        const el = s.elements.find((e) => e.id === id);
        if (!el) return s;
        return { elements: [...s.elements.filter((e) => e.id !== id), el] };
      }),

      sendToBack: (id) => set((s) => {
        const el = s.elements.find((e) => e.id === id);
        if (!el) return s;
        return { elements: [el, ...s.elements.filter((e) => e.id !== id)] };
      }),

      setZoom: (zoom) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) }),
      zoomIn: () => set((s) => ({ zoom: Math.min(ZOOM_MAX, Math.round((s.zoom + ZOOM_STEP) * 10) / 10) })),
      zoomOut: () => set((s) => ({ zoom: Math.max(ZOOM_MIN, Math.round((s.zoom - ZOOM_STEP) * 10) / 10) })),
      zoomFit: () => set({ zoom: 1, panX: 0, panY: 0 }),
      setPan: (x, y) => set({ panX: x, panY: y }),
      toggleGrid: () => set((s) => ({ gridEnabled: !s.gridEnabled })),
      toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

      pushHistory: () => set((s) => ({
        past: [...s.past.slice(-49), { elements: s.elements, timestamp: Date.now() }],
        future: [],
      })),

      undo: () => set((s) => {
        if (s.past.length === 0) return s;
        const prev = s.past[s.past.length - 1];
        return {
          elements: prev.elements,
          past: s.past.slice(0, -1),
          future: [{ elements: s.elements, timestamp: Date.now() }, ...s.future],
        };
      }),

      redo: () => set((s) => {
        if (s.future.length === 0) return s;
        const next = s.future[0];
        return {
          elements: next.elements,
          future: s.future.slice(1),
          past: [...s.past, { elements: s.elements, timestamp: Date.now() }],
        };
      }),

      clearHistory: () => set({ past: [], future: [] }),

      serializeState: () => {
        const { elements, zoom, panX: x, panY: y } = get();
        return { elements: structuredClone(elements), zoom, pan: { x, y } };
      },

      loadState: (state) => set({
        elements: state.elements ?? [],
        zoom: state.zoom ?? 1,
        panX: state.pan?.x ?? 0,
        panY: state.pan?.y ?? 0,
        past: [],
        future: [],
      }),
    }),
    { name: 'konva-store' },
  ),
);
