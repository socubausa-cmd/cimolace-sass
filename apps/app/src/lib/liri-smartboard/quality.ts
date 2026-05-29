import type { SmartboardSlide } from '@/lib/liri-smartboard/types';

export function validateSmartboardSlide(slide: Partial<SmartboardSlide>) {
  const errors: string[] = [];
  if (!slide.slide_id) errors.push('slide_id manquant');
  if (!slide.step) errors.push('step manquant');
  if (!slide.title) errors.push('title manquant');
  if (!slide.pedagogical_goal) errors.push('pedagogical_goal manquant');
  if (!slide.content?.main_text) errors.push('content.main_text manquant');
  if (!slide.visual?.type) errors.push('visual.type manquant');
  if (!slide.visual?.prompt) errors.push('visual.prompt manquant');
  return {
    valid: errors.length === 0,
    errors,
  };
}

