/**
 * useCourseBuilder — bridge hook between useCourseBuilderStore and UI.
 * Provides derived state + AI actions.
 */
import { useCallback } from 'react';
import { useCourseBuilderStore } from '@/stores/course-builder.store';
import { useAIStore } from '@/stores/ai.store';
import { aiRouter } from '@/engines/ai-router';
import { convertCourseToSmartboards } from '@/engines/converters/courseToSmartboard';
import { useSmartboardStore } from '@/stores/smartboard.store';

export function useCourseBuilder() {
  const store = useCourseBuilderStore();
  const aiStore = useAIStore();
  const setSlides = useSmartboardStore((s) => s.setSlides);

  // ── AI: generate full course blueprint ─────────────────────────────────────
  const generateCourseBlueprint = useCallback(async (prompt) => {
    if (!store.courseDraft) return;
    const job = aiStore.createJob('build_course_blueprint');
    try {
      const result = await aiRouter.route({
        taskType: 'build_course_blueprint',
        payload: { title: store.courseDraft.title, theme: store.courseDraft.theme, prompt },
        onProgress: (p) => aiStore.updateJob(job.id, { progress: p }),
      });
      aiStore.completeJob(job.id, result);
      // If result contains chapters, load them
      if (result?.chapters) {
        store.loadCourse({ ...store.courseDraft, chapters: result.chapters });
      }
    } catch (e) {
      aiStore.failJob(job.id);
      console.error('[useCourseBuilder] generateCourseBlueprint failed', e);
    }
  }, [store, aiStore]);

  // ── AI: generate mindmap for a segment ─────────────────────────────────────
  const generateMindmap = useCallback(async (segmentId) => {
    const segment = store.getActiveSegment();
    if (!segment) return;
    store.setGeneratingFor(segmentId);
    const job = aiStore.createJob('generate_mindmap');
    try {
      const result = await aiRouter.route({
        taskType: 'generate_mindmap',
        payload: { title: segment.title, summary: segment.summary, displayText: segment.displayText },
        onProgress: (p) => aiStore.updateJob(job.id, { progress: p }),
      });
      if (result?.root) {
        store.setSegmentMindmap(segmentId, result);
      }
      aiStore.completeJob(job.id, result);
    } catch (e) {
      aiStore.failJob(job.id);
    } finally {
      store.setGeneratingFor(null);
    }
  }, [store, aiStore]);

  // ── AI: generate master script for a segment ────────────────────────────────
  const generateScript = useCallback(async (segmentId) => {
    const segment = store.getActiveSegment();
    if (!segment) return;
    store.setGeneratingFor(segmentId);
    const job = aiStore.createJob('generate_master_script');
    try {
      const result = await aiRouter.route({
        taskType: 'generate_master_script',
        payload: { title: segment.title, summary: segment.summary, displayText: segment.displayText, mindmap: segment.mindmap },
        onProgress: (p) => aiStore.updateJob(job.id, { progress: p }),
      });
      if (result) {
        store.setSegmentScript(segmentId, result);
      }
      aiStore.completeJob(job.id, result);
    } catch (e) {
      aiStore.failJob(job.id);
    } finally {
      store.setGeneratingFor(null);
    }
  }, [store, aiStore]);

  // ── Convert and send to SmartBoard ─────────────────────────────────────────
  const sendToSmartboard = useCallback(() => {
    if (!store.courseDraft) return false;
    const validation = store.validateCourse();
    if (!validation.valid) return false;
    const slides = convertCourseToSmartboards(store.courseDraft);
    setSlides(slides);
    return true;
  }, [store, setSlides]);

  // ── Derived state ───────────────────────────────────────────────────────────
  const totalSegments = store.courseDraft?.chapters.reduce(
    (acc, ch) => acc + ch.subchapters.reduce((a, s) => a + s.segments.length, 0),
    0,
  ) ?? 0;

  const totalSubchapters = store.courseDraft?.chapters.reduce(
    (acc, ch) => acc + ch.subchapters.length,
    0,
  ) ?? 0;

  const isReady = store.validationStatus === 'valid' || (store.courseDraft && totalSubchapters > 0);

  return {
    ...store,
    totalSegments,
    totalSubchapters,
    isReady,
    generateCourseBlueprint,
    generateMindmap,
    generateScript,
    sendToSmartboard,
  };
}
