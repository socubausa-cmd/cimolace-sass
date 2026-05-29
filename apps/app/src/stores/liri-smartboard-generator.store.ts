import { create } from 'zustand';
import { SMARTBOARD_STEPS } from '@/lib/liri-smartboard/steps';
import { generateSmartboardSlide } from '@/lib/liri-smartboard/engine';
import type { SmartboardSlide } from '@/lib/liri-smartboard/types';

type Status = 'idle' | 'running' | 'done' | 'error';

interface SmartboardChapterInput {
  chapter_id: string;
  title: string;
  objective?: string;
  skill?: string;
  knowledge?: string;
  payload?: Record<string, unknown>;
}

interface SmartboardState {
  sourceText: string;
  chapters: SmartboardChapterInput[];
  slides: SmartboardSlide[];
  status: Status;
  error: string | null;
  progress: { chapterIndex: number; stepIndex: number; total: number; done: number };
  activeChapterId: string | null;
  activeStepKey: string | null;
  setSourceText: (value: string) => void;
  setChapters: (value: SmartboardChapterInput[]) => void;
  setActiveChapter: (chapterId: string) => void;
  setActiveStep: (stepKey: string) => void;
  updateSlideField: (step: string, field: string, value: any) => void;
  clear: () => void;
  generateAll: () => Promise<void>;
  regenerateOne: (chapterId: string, stepKey: string) => Promise<void>;
}

const initialProgress = { chapterIndex: 0, stepIndex: 0, total: 0, done: 0 };

export const useSmartboardStore = create<SmartboardState>((set, get) => ({
  sourceText: '',
  chapters: [],
  slides: [],
  status: 'idle',
  error: null,
  progress: initialProgress,
  activeChapterId: null,
  activeStepKey: null,
  setSourceText: (value) => set({ sourceText: value || '' }),
  setChapters: (value) => set({ chapters: Array.isArray(value) ? value : [] }),
  setActiveChapter: (chapterId) => set({ activeChapterId: chapterId }),
  setActiveStep: (stepKey) => set({ activeStepKey: stepKey }),
  updateSlideField: (step, field, value) =>
    set((state) => ({
      slides: state.slides.map((slide) => {
        if (slide.step !== step) return slide;
        if (field.startsWith('content.')) {
          const key = field.replace('content.', '');
          return {
            ...slide,
            content: {
              ...slide.content,
              [key]: value,
            },
          };
        }
        return {
          ...slide,
          [field]: value,
        };
      }),
    })),
  clear: () => set({ sourceText: '', chapters: [], slides: [], status: 'idle', error: null, progress: initialProgress }),
  generateAll: async () => {
    const { sourceText, chapters } = get();
    if (!sourceText.trim() || !chapters.length) {
      set({ error: 'Source et chapitres requis.', status: 'error' });
      return;
    }
    const total = chapters.length * SMARTBOARD_STEPS.length;
    set({ status: 'running', error: null, progress: { ...initialProgress, total } });
    const created: SmartboardSlide[] = [];
    try {
      for (let c = 0; c < chapters.length; c += 1) {
        for (let s = 0; s < SMARTBOARD_STEPS.length; s += 1) {
          const step = SMARTBOARD_STEPS[s];
          const slideResult = await generateSmartboardSlide({
            sourceText,
            chapter: chapters[c],
            step: step.key,
            previousSlides: created,
          });
          created.push(slideResult.slide);
          set({
            slides: [...created],
            progress: { chapterIndex: c, stepIndex: s, total, done: created.length },
            activeChapterId: chapters[c].chapter_id,
            activeStepKey: step.key,
          });
        }
      }
      set({ status: 'done' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Erreur génération SmartBoard',
      });
    }
  },
  regenerateOne: async (chapterId, stepKey) => {
    const state = get();
    const chapter = state.chapters.find((c) => c.chapter_id === chapterId);
    if (!chapter) return;
    try {
      set({ status: 'running', error: null, activeChapterId: chapterId, activeStepKey: stepKey });
      const previousSlides = state.slides.filter((s) => !(s.chapter_id === chapterId && s.step === stepKey));
      const result = await generateSmartboardSlide({
        sourceText: state.sourceText,
        chapter,
        step: stepKey,
        previousSlides,
      });
      const idx = state.slides.findIndex((s) => s.chapter_id === chapterId && s.step === stepKey);
      const next = [...state.slides];
      if (idx >= 0) next[idx] = result.slide;
      else next.push(result.slide);
      set({ slides: next, status: 'done' });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Erreur régénération' });
    }
  },
}));

