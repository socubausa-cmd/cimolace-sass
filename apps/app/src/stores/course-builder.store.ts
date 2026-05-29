import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Course, Chapter, Subchapter, Segment, Mindmap, MasterScript, CourseValidationResult } from '@/engines/types';

type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

type CourseBuilderStore = {
  // State
  courseDraft: Course | null;
  validationStatus: ValidationStatus;
  validationResult: CourseValidationResult | null;
  activeChapterId: string | null;
  activeSubchapterId: string | null;
  activeSegmentId: string | null;
  generatingFor: string | null;

  // Getters
  getActiveChapter: () => Chapter | null;
  getActiveSubchapter: () => Subchapter | null;
  getActiveSegment: () => Segment | null;

  // Course actions
  initCourse: (title: string, theme?: string) => void;
  loadCourse: (course: Course) => void;
  updateCourse: (patch: Partial<Omit<Course, 'chapters'>>) => void;
  clearDraft: () => void;

  // Navigation
  setActiveChapter: (id: string | null) => void;
  setActiveSubchapter: (id: string | null) => void;
  setActiveSegment: (id: string | null) => void;

  // Chapter actions
  addChapter: (title: string) => void;
  updateChapter: (id: string, patch: Partial<Chapter>) => void;
  deleteChapter: (id: string) => void;
  reorderChapters: (from: number, to: number) => void;

  // Subchapter actions
  addSubchapter: (chapterId: string, title: string) => void;
  updateSubchapter: (id: string, patch: Partial<Subchapter>) => void;
  deleteSubchapter: (id: string) => void;

  // Segment actions
  addSegment: (subchapterId: string, title: string) => void;
  updateSegment: (id: string, patch: Partial<Segment>) => void;
  deleteSegment: (id: string) => void;
  setSegmentMindmap: (id: string, mindmap: Mindmap) => void;
  setSegmentScript: (id: string, script: MasterScript) => void;

  // Validation
  validateCourse: () => CourseValidationResult;
  setValidationStatus: (status: ValidationStatus) => void;
  setGeneratingFor: (id: string | null) => void;
};

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function emptyMindmap(): Mindmap {
  return { root: { id: genId(), label: 'Concept central', children: [] } };
}

function emptyScript(): MasterScript {
  return { intro: '', keyPoints: [], transitions: [], conclusion: '' };
}

export const useCourseBuilderStore = create<CourseBuilderStore>()(
  devtools(
    persist(
      (set, get) => ({
        courseDraft: null,
        validationStatus: 'idle',
        validationResult: null,
        activeChapterId: null,
        activeSubchapterId: null,
        activeSegmentId: null,
        generatingFor: null,

        getActiveChapter: () => {
          const { courseDraft, activeChapterId } = get();
          return courseDraft?.chapters.find((c) => c.id === activeChapterId) ?? null;
        },
        getActiveSubchapter: () => {
          const { courseDraft, activeSubchapterId } = get();
          for (const ch of courseDraft?.chapters ?? []) {
            const sub = ch.subchapters.find((s) => s.id === activeSubchapterId);
            if (sub) return sub;
          }
          return null;
        },
        getActiveSegment: () => {
          const { courseDraft, activeSegmentId } = get();
          for (const ch of courseDraft?.chapters ?? []) {
            for (const sub of ch.subchapters) {
              const seg = sub.segments.find((s) => s.id === activeSegmentId);
              if (seg) return seg;
            }
          }
          return null;
        },

        initCourse: (title, theme = '') => set({
          courseDraft: { id: genId(), title, theme, chapters: [] },
          activeChapterId: null,
          activeSubchapterId: null,
          activeSegmentId: null,
          validationStatus: 'idle',
          validationResult: null,
        }),

        loadCourse: (course) => set({
          courseDraft: course,
          activeChapterId: course.chapters[0]?.id ?? null,
          activeSubchapterId: course.chapters[0]?.subchapters[0]?.id ?? null,
          activeSegmentId: null,
          validationStatus: 'idle',
        }),

        updateCourse: (patch) => set((s) => ({
          courseDraft: s.courseDraft ? { ...s.courseDraft, ...patch } : null,
        })),

        clearDraft: () => set({ courseDraft: null, activeChapterId: null, activeSubchapterId: null, activeSegmentId: null }),

        setActiveChapter: (id) => set({ activeChapterId: id }),
        setActiveSubchapter: (id) => set({ activeSubchapterId: id }),
        setActiveSegment: (id) => set({ activeSegmentId: id }),

        addChapter: (title) => set((s) => {
          if (!s.courseDraft) return s;
          const chapter: Chapter = {
            id: genId(),
            title,
            objective: '',
            order: s.courseDraft.chapters.length,
            subchapters: [],
          };
          return {
            courseDraft: { ...s.courseDraft, chapters: [...s.courseDraft.chapters, chapter] },
            activeChapterId: chapter.id,
          };
        }),

        updateChapter: (id, patch) => set((s) => {
          if (!s.courseDraft) return s;
          return {
            courseDraft: {
              ...s.courseDraft,
              chapters: s.courseDraft.chapters.map((c) => c.id === id ? { ...c, ...patch } : c),
            },
          };
        }),

        deleteChapter: (id) => set((s) => {
          if (!s.courseDraft) return s;
          return {
            courseDraft: {
              ...s.courseDraft,
              chapters: s.courseDraft.chapters.filter((c) => c.id !== id),
            },
            activeChapterId: s.activeChapterId === id ? null : s.activeChapterId,
          };
        }),

        reorderChapters: (from, to) => set((s) => {
          if (!s.courseDraft) return s;
          const chapters = [...s.courseDraft.chapters];
          const [moved] = chapters.splice(from, 1);
          chapters.splice(to, 0, moved);
          return { courseDraft: { ...s.courseDraft, chapters: chapters.map((c, i) => ({ ...c, order: i })) } };
        }),

        addSubchapter: (chapterId, title) => set((s) => {
          if (!s.courseDraft) return s;
          const sub: Subchapter = {
            id: genId(), title,
            centralIdea: '', generalIdea: '', knowledgeTarget: '', competencyTarget: '',
            order: 0, segments: [],
          };
          return {
            courseDraft: {
              ...s.courseDraft,
              chapters: s.courseDraft.chapters.map((c) =>
                c.id === chapterId
                  ? { ...c, subchapters: [...c.subchapters, { ...sub, order: c.subchapters.length }] }
                  : c,
              ),
            },
            activeSubchapterId: sub.id,
          };
        }),

        updateSubchapter: (id, patch) => set((s) => {
          if (!s.courseDraft) return s;
          return {
            courseDraft: {
              ...s.courseDraft,
              chapters: s.courseDraft.chapters.map((c) => ({
                ...c,
                subchapters: c.subchapters.map((sub) => sub.id === id ? { ...sub, ...patch } : sub),
              })),
            },
          };
        }),

        deleteSubchapter: (id) => set((s) => {
          if (!s.courseDraft) return s;
          return {
            courseDraft: {
              ...s.courseDraft,
              chapters: s.courseDraft.chapters.map((c) => ({
                ...c,
                subchapters: c.subchapters.filter((sub) => sub.id !== id),
              })),
            },
            activeSubchapterId: s.activeSubchapterId === id ? null : s.activeSubchapterId,
          };
        }),

        addSegment: (subchapterId, title) => set((s) => {
          if (!s.courseDraft) return s;
          const seg: Segment = {
            id: genId(), title, summary: '', displayText: '', order: 0,
            mindmap: emptyMindmap(), masterScript: emptyScript(),
          };
          return {
            courseDraft: {
              ...s.courseDraft,
              chapters: s.courseDraft.chapters.map((c) => ({
                ...c,
                subchapters: c.subchapters.map((sub) =>
                  sub.id === subchapterId
                    ? { ...sub, segments: [...sub.segments, { ...seg, order: sub.segments.length }] }
                    : sub,
                ),
              })),
            },
            activeSegmentId: seg.id,
          };
        }),

        updateSegment: (id, patch) => set((s) => {
          if (!s.courseDraft) return s;
          return {
            courseDraft: {
              ...s.courseDraft,
              chapters: s.courseDraft.chapters.map((c) => ({
                ...c,
                subchapters: c.subchapters.map((sub) => ({
                  ...sub,
                  segments: sub.segments.map((seg) => seg.id === id ? { ...seg, ...patch } : seg),
                })),
              })),
            },
          };
        }),

        deleteSegment: (id) => set((s) => {
          if (!s.courseDraft) return s;
          return {
            courseDraft: {
              ...s.courseDraft,
              chapters: s.courseDraft.chapters.map((c) => ({
                ...c,
                subchapters: c.subchapters.map((sub) => ({
                  ...sub,
                  segments: sub.segments.filter((seg) => seg.id !== id),
                })),
              })),
            },
          };
        }),

        setSegmentMindmap: (id, mindmap) => get().updateSegment(id, { mindmap }),
        setSegmentScript: (id, script) => get().updateSegment(id, { masterScript: script }),

        validateCourse: () => {
          const { courseDraft } = get();
          const errors: string[] = [];
          const warnings: string[] = [];

          if (!courseDraft) { errors.push('Aucun cours charge'); }
          else {
            if (!courseDraft.title.trim()) errors.push('Le titre du cours est vide');
            if (courseDraft.chapters.length === 0) errors.push('Le cours doit avoir au moins un chapitre');
            for (const ch of courseDraft.chapters) {
              if (!ch.title.trim()) warnings.push(`Chapitre sans titre (${ch.id})`);
              if (ch.subchapters.length === 0) warnings.push(`Chapitre "${ch.title}" sans sous-chapitres`);
              for (const sub of ch.subchapters) {
                if (!sub.centralIdea.trim()) warnings.push(`"${sub.title}" : idee centrale vide`);
                if (sub.segments.length === 0) warnings.push(`"${sub.title}" sans segments`);
              }
            }
          }

          const score = Math.max(0, 100 - errors.length * 30 - warnings.length * 10);
          const result: CourseValidationResult = {
            valid: errors.length === 0,
            score,
            errors,
            warnings,
          };
          set({ validationResult: result, validationStatus: result.valid ? 'valid' : 'invalid' });
          return result;
        },

        setValidationStatus: (status) => set({ validationStatus: status }),
        setGeneratingFor: (id) => set({ generatingFor: id }),
      }),
      { name: 'liri-course-builder', partialize: (s) => ({ courseDraft: s.courseDraft }) },
    ),
    { name: 'course-builder-store' },
  ),
);
