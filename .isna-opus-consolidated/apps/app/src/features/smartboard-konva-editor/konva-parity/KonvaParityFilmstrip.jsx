/**
 * Filmstrip plan Copilot (timing + scores) — même surface que Polotno, données depuis la scène Konva active.
 */
import React, { useEffect, useMemo } from 'react';
import SmartboardFilmstripBar from '../components/SmartboardFilmstripBar';
import { computeQualityScoresForAllPlanSlidesFromKonvaScene } from '../lib/computeSmartboardQualityScore';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';

/**
 * @param {{ className?: string; onAddScene?: () => void }} props
 */
export default function KonvaParityFilmstrip({ className, onAddScene }) {
  const course = useCourseCopilotStore((s) => s.course);
  const activeSlideIndex = useCourseCopilotStore((s) => s.activeSlideIndex);
  const slideTimingMinutes = useCourseCopilotStore((s) => s.slideTimingMinutes);
  const setSlideTimingAtIndex = useCourseCopilotStore((s) => s.setSlideTimingAtIndex);
  const setActiveSlideIndex = useCourseCopilotStore((s) => s.setActiveSlideIndex);
  const nextSlide = useCourseCopilotStore((s) => s.nextSlide);
  const prevSlide = useCourseCopilotStore((s) => s.prevSlide);
  const syncSlideTimingWithCourse = useCourseCopilotStore((s) => s.syncSlideTimingWithCourse);
  const project = useSmartboardKonvaStore((s) => s.project);

  const activeScene = useMemo(() => {
    const sid = project?.activeSceneId;
    return project?.scenes?.find((sc) => sc.id === sid) ?? project?.scenes?.[0] ?? null;
  }, [project?.activeSceneId, project?.scenes]);

  useEffect(() => {
    syncSlideTimingWithCourse();
  }, [course?.slides?.length, syncSlideTimingWithCourse]);

  const slidePlanScores = useMemo(
    () =>
      course?.slides?.length && activeScene
        ? computeQualityScoresForAllPlanSlidesFromKonvaScene(activeScene, course)
        : null,
    [activeScene, course],
  );

  const recommendedDurationMinutes =
    typeof course?.analysis?.estimatedDurationMinutes === 'number'
      ? course.analysis.estimatedDurationMinutes
      : null;

  return (
    <SmartboardFilmstripBar
      className={className}
      slides={course?.slides}
      activeSlideIndex={activeSlideIndex}
      onSelectSlide={setActiveSlideIndex}
      onPrev={() => prevSlide()}
      onNext={() => nextSlide()}
      slideScores={slidePlanScores}
      slideTimingMinutes={slideTimingMinutes}
      onSlideTimingChange={setSlideTimingAtIndex}
      recommendedDurationMinutes={recommendedDurationMinutes}
      onAddScene={onAddScene}
    />
  );
}
