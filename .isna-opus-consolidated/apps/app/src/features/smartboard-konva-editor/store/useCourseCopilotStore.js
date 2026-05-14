import { create } from 'zustand';
import { analyzeCourseDocument } from '../ai/analyzeCourseDocument';
import { supabase } from '@/lib/customSupabaseClient';
import { defaultCourseTheme, mergeCourseThemeFromExport } from '../lib/liriCourseTheme';
import {
  DEFAULT_VALIDATION_CHECKLIST,
  mergeValidationChecklistFromExport,
} from '../lib/liriValidationChecklist';
import { normalizeDesignerPreviewMode } from '../lib/liriDesignerPreviewModes';
import { buildDefaultSlideTimingMinutes, mergeSlideTimingFromExport } from '../lib/liriSlideTiming';
import { deleteSmartboardCinemaTake } from '@/lib/uploadSmartboardCinemaTake';
import {
  defaultCinemaPedagogy,
  genCinemaTakeId,
  mergeCinemaPedagogyFromExport,
} from '../lib/liriCinemaPedagogy';

/**
 * @typedef {import('../model/courseCopilotTypes').LiriCourseCopilotCourse} LiriCourseCopilotCourse
 */

export const useCourseCopilotStore = create((set, get) => ({
  /** Texte brut / transcription / notes collées */
  sourceText: '',
  /** Cours structuré après analyse (mock local) */
  course: /** @type {LiriCourseCopilotCourse | null} */ (null),
  activeSlideIndex: 0,
  analysisBusy: false,
  /** Suggestions globales finales (étape 7 optionnelle, mock) */
  globalSuggestions: /** @type {string[] | null} */ (null),
  /** Thème visuel & typographique du parcours (Module 4) */
  courseTheme: defaultCourseTheme(),
  /** Checklist validation finale (Module 7) */
  validationChecklist: { ...DEFAULT_VALIDATION_CHECKLIST },
  /** Durées prévues par fiche du plan (minutes), aligné sur course.slides (Module 6) */
  slideTimingMinutes: /** @type {number[]} */ ([]),
  /** Aperçu édition / prof / élève / live (Module 3) */
  designerPreviewMode: /** @type {import('../lib/liriDesignerPreviewModes').DesignerPreviewMode} */ ('editor'),

  /** Prises cinéma pédagogique (slide / durée) — exportées dans le workspace JSON */
  cinemaPedagogy: defaultCinemaPedagogy(),

  /** @param {import('../lib/liriCinemaPedagogy').LiriCinemaPedagogyState | null | undefined} state */
  setCinemaPedagogy: (state) =>
    set({ cinemaPedagogy: state && typeof state === 'object' ? mergeCinemaPedagogyFromExport(state) : defaultCinemaPedagogy() }),

  /**
   * @param {{
   *   slideIndex: number;
   *   sceneId: string | null;
   *   durationSec: number;
   *   note?: string;
   *   previewUrl?: string;
   *   hasRecording?: boolean;
   *   recordingMime?: string;
   *   recordingSizeBytes?: number;
   *   recordingPublicUrl?: string;
   *   recordingStoragePath?: string;
   * }} p
   * @returns {string} id de la prise
   */
  addCinemaTake: ({
    slideIndex,
    sceneId,
    durationSec,
    note,
    previewUrl,
    hasRecording,
    recordingMime,
    recordingSizeBytes,
    recordingPublicUrl,
    recordingStoragePath,
  }) => {
    const take = {
      id: genCinemaTakeId(),
      slideIndex: Math.max(0, Math.floor(slideIndex)),
      sceneId: sceneId || null,
      durationSec: Math.max(0, Number(durationSec) || 0),
      recordedAt: new Date().toISOString(),
      note: typeof note === 'string' && note.trim() ? note.trim() : undefined,
      previewUrl: typeof previewUrl === 'string' && previewUrl.startsWith('blob:') ? previewUrl : undefined,
      hasRecording: Boolean(hasRecording),
      recordingMime: typeof recordingMime === 'string' ? recordingMime : undefined,
      recordingSizeBytes:
        Number.isFinite(Number(recordingSizeBytes)) && Number(recordingSizeBytes) > 0
          ? Math.floor(Number(recordingSizeBytes))
          : undefined,
      recordingPublicUrl:
        typeof recordingPublicUrl === 'string' && recordingPublicUrl.startsWith('http')
          ? recordingPublicUrl
          : undefined,
      recordingStoragePath: typeof recordingStoragePath === 'string' ? recordingStoragePath : undefined,
    };
    set((s) => ({
      cinemaPedagogy: { takes: [...(s.cinemaPedagogy?.takes || []), take] },
    }));
    return take.id;
  },

  /**
   * Met à jour une prise (ex. après upload Storage — retire previewUrl blob).
   * @param {string} takeId
   * @param {Partial<import('../lib/liriCinemaPedagogy').LiriCinemaPedagogyTake>} partial
   */
  updateCinemaTake: (takeId, partial) => {
    set((s) => ({
      cinemaPedagogy: {
        takes: (s.cinemaPedagogy?.takes || []).map((t) => {
          if (t.id !== takeId) return t;
          if (partial.recordingPublicUrl && t.previewUrl?.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(t.previewUrl);
            } catch {
              /* ignore */
            }
          }
          const next = { ...t, ...partial };
          if (partial.recordingPublicUrl) delete next.previewUrl;
          return next;
        }),
      },
    }));
  },

  removeCinemaTake: (takeId) => {
    const prev = get().cinemaPedagogy?.takes || [];
    const removed = prev.find((t) => t.id === takeId);
    if (!removed) return;
    if (removed.recordingStoragePath) void deleteSmartboardCinemaTake(removed.recordingStoragePath);
    if (removed.previewUrl?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(removed.previewUrl);
      } catch {
        /* ignore */
      }
    }
    set({
      cinemaPedagogy: { takes: prev.filter((t) => t.id !== takeId) },
    });
  },

  clearCinemaTakes: () => {
    const { cinemaPedagogy } = get();
    for (const t of cinemaPedagogy?.takes || []) {
      if (t.recordingStoragePath) void deleteSmartboardCinemaTake(t.recordingStoragePath);
      if (t.previewUrl?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(t.previewUrl);
        } catch {
          /* ignore */
        }
      }
    }
    set({ cinemaPedagogy: defaultCinemaPedagogy() });
  },

  /** @param {import('../lib/liriDesignerPreviewModes').DesignerPreviewMode} mode */
  setDesignerPreviewMode: (mode) => set({ designerPreviewMode: normalizeDesignerPreviewMode(mode) }),

  /** Recalcule la longueur du tableau timing selon le cours (sans perdre les valeurs importées). */
  syncSlideTimingWithCourse: () => {
    const { course, slideTimingMinutes } = get();
    const merged = mergeSlideTimingFromExport(slideTimingMinutes, course);
    const same =
      merged.length === slideTimingMinutes.length &&
      merged.every((v, i) => v === slideTimingMinutes[i]);
    if (same) return;
    set({ slideTimingMinutes: merged });
  },

  /**
   * @param {number} index
   * @param {number | string} minutes
   */
  setSlideTimingAtIndex: (index, minutes) => {
    const { course, slideTimingMinutes } = get();
    const n = course?.slides?.length ?? 0;
    if (!n || index < 0 || index >= n) return;
    const raw = typeof minutes === 'number' ? minutes : Number(String(minutes).replace(',', '.'));
    const m = Math.max(0.5, Math.min(480, Number.isFinite(raw) ? raw : 0));
    const next = [...(slideTimingMinutes.length === n ? slideTimingMinutes : mergeSlideTimingFromExport(slideTimingMinutes, course))];
    next[index] = Math.round(m * 10) / 10;
    set({ slideTimingMinutes: next });
  },

  /** @param {import('../lib/liriValidationChecklist').ValidationChecklistKey} key @param {boolean} value */
  setValidationChecklistItem: (key, value) =>
    set((s) => ({
      validationChecklist: { ...s.validationChecklist, [key]: value },
    })),

  /** @param {Partial<ReturnType<typeof defaultCourseTheme>>} partial */
  setCourseTheme: (partial) =>
    set((s) => ({
      courseTheme: { ...s.courseTheme, ...partial },
    })),

  runAnalysis: async () => {
    if (get().analysisBusy) return;
    const { sourceText } = get();
    set({ analysisBusy: true, globalSuggestions: null });
    try {
      const course = await analyzeCourseDocument(sourceText);
      set({
        course,
        activeSlideIndex: 0,
        slideTimingMinutes: buildDefaultSlideTimingMinutes(course),
      });
    } finally {
      set({ analysisBusy: false });
    }
  },

  setActiveSlideIndex: (i) => {
    const { course } = get();
    const idx = course?.slides?.length
      ? Math.max(0, Math.min(i, course.slides.length - 1))
      : Math.max(0, i);
    set({ activeSlideIndex: idx });
  },

  /**
   * Restaure l’état Copilot depuis un bundle workspace (import JSON / brouillon local).
   * @param {Partial<{ sourceText: string; course: LiriCourseCopilotCourse | null; activeSlideIndex: number; globalSuggestions: string[] | null; courseTheme?: unknown; validationChecklist?: unknown; slideTimingMinutes?: unknown; designerPreviewMode?: unknown }>} data
   */
  hydrateFromExport: (data) => {
    const course = data.course ?? null;
    let ai = Number.isFinite(data.activeSlideIndex) ? Math.max(0, data.activeSlideIndex) : 0;
    if (course?.slides?.length) {
      ai = Math.min(ai, course.slides.length - 1);
    }
    set({
      sourceText: typeof data.sourceText === 'string' ? data.sourceText : '',
      course,
      activeSlideIndex: ai,
      globalSuggestions: Array.isArray(data.globalSuggestions) ? data.globalSuggestions : null,
      courseTheme: mergeCourseThemeFromExport(data.courseTheme),
      validationChecklist: mergeValidationChecklistFromExport(data.validationChecklist),
      slideTimingMinutes: mergeSlideTimingFromExport(data.slideTimingMinutes, course),
      designerPreviewMode: normalizeDesignerPreviewMode(data.designerPreviewMode),
      cinemaPedagogy: mergeCinemaPedagogyFromExport(/** @type {any} */ (data).cinemaPedagogy),
    });
  },

  nextSlide: () => {
    const { course, activeSlideIndex } = get();
    if (!course?.slides?.length) return;
    set({
      activeSlideIndex: Math.min(activeSlideIndex + 1, course.slides.length - 1),
    });
  },

  prevSlide: () => {
    const { activeSlideIndex } = get();
    set({ activeSlideIndex: Math.max(0, activeSlideIndex - 1) });
  },

  /** Recommandations globales via Edge `liri-script-ai-improve` (branche Claude focused-morse). */
  runGlobalImprovements: async () => {
    const { course } = get();
    set({ analysisBusy: true, globalSuggestions: null });
    try {
      const context = course?.title || '';
      const content = (course?.slides || [])
        .map(
          (s, i) =>
            `${i + 1}. ${s.title} — ${s.objective || ''}${
              s.masterScript?.discourse ? ` | Script: ${s.masterScript.discourse.slice(0, 120)}` : ''
            }`,
        )
        .join('\n');
      const prompt = `Voici le plan complet du cours (${course?.slides?.length || 0} slides):\n${content}\n\nDonne 4 recommandations pedagogiques globales concretes pour ameliorer ce parcours (transitions, rythme, visuels, engagement). Format: une recommendation par ligne, sans numerotation ni tiret.`;
      const { data, error } = await supabase.functions.invoke('liri-script-ai-improve', {
        body: { content: prompt, context, mode: 'improve' },
      });
      if (error) throw error;
      const raw = String(data?.result || data?.improved || '').trim();
      const lines = raw
        .split('\n')
        .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter((l) => l.length > 8);
      set({ globalSuggestions: lines.length ? lines : [raw] });
    } catch (err) {
      set({ globalSuggestions: [`Erreur : ${err?.message || 'connexion impossible'}`] });
    } finally {
      set({ analysisBusy: false });
    }
  },

  runGlobalImprovementsMock: async () => {
    set({ analysisBusy: true });
    try {
      await new Promise((r) => setTimeout(r, 600));
      set({
        globalSuggestions: [
          'Renforcer la transition entre deux chapitres avec une question orale ciblée.',
          'Prévoir un slide de synthèse intermédiaire avant la partie atelier.',
          'Sur le premier slide, réduire le texte au profit d’un schéma (à construire dans Konva).',
        ],
      });
    } finally {
      set({ analysisBusy: false });
    }
  },

  resetCourse: () =>
    set({
      sourceText: '',
      course: null,
      activeSlideIndex: 0,
      globalSuggestions: null,
      courseTheme: defaultCourseTheme(),
      validationChecklist: { ...DEFAULT_VALIDATION_CHECKLIST },
      slideTimingMinutes: [],
      designerPreviewMode: 'editor',
      cinemaPedagogy: defaultCinemaPedagogy(),
    }),
}));
