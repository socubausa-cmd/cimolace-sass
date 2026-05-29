import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { SmartboardSlide, SlideSection, BoardState, CanvasMode, ViewMode } from '@/engines/types';

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function emptyBoardState(): BoardState {
  return { elements: [] };
}

type SmartboardStore = {
  // State
  slides: SmartboardSlide[];
  activeSlideId: string | null;
  activeSegmentId: string | null;
  canvasMode: CanvasMode;
  viewMode: ViewMode;
  activeSection: string | null;

  // Getters
  getActiveSlide: () => SmartboardSlide | null;

  // Actions — slides
  setSlides: (slides: SmartboardSlide[]) => void;
  addSlide: (slide?: Partial<SmartboardSlide>) => void;
  updateSlide: (id: string, patch: Partial<SmartboardSlide>) => void;
  deleteSlide: (id: string) => void;
  duplicateSlide: (id: string) => void;
  reorderSlides: (from: number, to: number) => void;
  setActiveSlide: (id: string | null) => void;
  setActiveSegment: (id: string | null) => void;

  // Actions — sections
  addSection: (slideId: string, label: string) => void;
  renameSection: (slideId: string, sectionId: string, label: string) => void;
  deleteSection: (slideId: string, sectionId: string) => void;
  setActiveSection: (sectionId: string | null) => void;

  // Actions — states
  saveInitialState: (slideId: string, state: BoardState) => void;
  resetToInitialState: (slideId: string) => BoardState | null;
  saveProgressiveState: (slideId: string, stepId: string, state: BoardState) => void;

  // Actions — mode
  setCanvasMode: (mode: CanvasMode) => void;
  setViewMode: (mode: ViewMode) => void;

  // Actions — bulk
  clearSlides: () => void;
};

function makeEmptySlide(order = 0): SmartboardSlide {
  return {
    id: genId(),
    title: `Slide ${order + 1}`,
    chapterId: '',
    subchapterId: '',
    segmentIds: [],
    order,
    sections: [],
    initialState: emptyBoardState(),
    progressiveStates: {},
    liveState: emptyBoardState(),
    resetState: emptyBoardState(),
  };
}

export const useSmartboardStore = create<SmartboardStore>()(
  devtools(
    persist(
      (set, get) => ({
        slides: [],
        activeSlideId: null,
        activeSegmentId: null,
        canvasMode: 'design',
        viewMode: 'design',
        activeSection: null,

        getActiveSlide: () => {
          const { slides, activeSlideId } = get();
          return slides.find((s) => s.id === activeSlideId) ?? null;
        },

        setSlides: (slides) => set({ slides, activeSlideId: slides[0]?.id ?? null }),

        addSlide: (patch = {}) => set((s) => {
          const slide: SmartboardSlide = { ...makeEmptySlide(s.slides.length), ...patch };
          return { slides: [...s.slides, slide], activeSlideId: slide.id };
        }),

        updateSlide: (id, patch) => set((s) => ({
          slides: s.slides.map((sl) => sl.id === id ? { ...sl, ...patch } : sl),
        })),

        deleteSlide: (id) => set((s) => {
          const remaining = s.slides.filter((sl) => sl.id !== id);
          return {
            slides: remaining,
            activeSlideId: s.activeSlideId === id ? (remaining[0]?.id ?? null) : s.activeSlideId,
          };
        }),

        duplicateSlide: (id) => set((s) => {
          const original = s.slides.find((sl) => sl.id === id);
          if (!original) return s;
          const copy: SmartboardSlide = { ...structuredClone(original), id: genId(), title: `${original.title} (copie)`, order: s.slides.length };
          return { slides: [...s.slides, copy], activeSlideId: copy.id };
        }),

        reorderSlides: (from, to) => set((s) => {
          const slides = [...s.slides];
          const [moved] = slides.splice(from, 1);
          slides.splice(to, 0, moved);
          return { slides: slides.map((sl, i) => ({ ...sl, order: i })) };
        }),

        setActiveSlide: (id) => set({ activeSlideId: id, activeSection: null }),
        setActiveSegment: (id) => set({ activeSegmentId: id }),

        addSection: (slideId, label) => set((s) => ({
          slides: s.slides.map((sl) => sl.id === slideId
            ? { ...sl, sections: [...sl.sections, { id: genId(), label, order: sl.sections.length }] }
            : sl,
          ),
        })),

        renameSection: (slideId, sectionId, label) => set((s) => ({
          slides: s.slides.map((sl) => sl.id === slideId
            ? { ...sl, sections: sl.sections.map((sec) => sec.id === sectionId ? { ...sec, label } : sec) }
            : sl,
          ),
        })),

        deleteSection: (slideId, sectionId) => set((s) => ({
          slides: s.slides.map((sl) => sl.id === slideId
            ? { ...sl, sections: sl.sections.filter((sec) => sec.id !== sectionId) }
            : sl,
          ),
          activeSection: s.activeSection === sectionId ? null : s.activeSection,
        })),

        setActiveSection: (id) => set({ activeSection: id }),

        saveInitialState: (slideId, state) => set((s) => ({
          slides: s.slides.map((sl) => sl.id === slideId ? { ...sl, initialState: structuredClone(state) } : sl),
        })),

        resetToInitialState: (slideId) => {
          const slide = get().slides.find((sl) => sl.id === slideId);
          return slide?.initialState ?? null;
        },

        saveProgressiveState: (slideId, stepId, state) => set((s) => ({
          slides: s.slides.map((sl) =>
            sl.id === slideId
              ? { ...sl, progressiveStates: { ...sl.progressiveStates, [stepId]: structuredClone(state) } }
              : sl,
          ),
        })),

        setCanvasMode: (mode) => set({ canvasMode: mode }),
        setViewMode: (mode) => set({ viewMode: mode }),
        clearSlides: () => set({ slides: [], activeSlideId: null }),
      }),
      { name: 'liri-smartboard', partialize: (s) => ({ slides: s.slides, activeSlideId: s.activeSlideId }) },
    ),
    { name: 'smartboard-store' },
  ),
);
