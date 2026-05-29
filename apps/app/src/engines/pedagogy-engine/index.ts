/**
 * Pedagogy Engine — progression, spotlight, sections, and pedagogical validation.
 */
import type { SmartboardSlide, SlideSection, BoardState, DesignElement, SpotlightConfig } from '@/engines/types';

// ── Spotlight ────────────────────────────────────────────────────────────────

const DEFAULT_SPOTLIGHT: SpotlightConfig = {
  activeSection: null,
  opacityActive: 1.0,
  opacityGlobal: 0.7,
  opacityPast: 0.3,
  opacityFuture: 0.05,
};

/**
 * Computes the display opacity of an element given the active spotlight section.
 */
export function computeSpotlightOpacity(
  element: DesignElement,
  sections: SlideSection[],
  config: SpotlightConfig = DEFAULT_SPOTLIGHT,
): number {
  const { activeSection } = config;
  if (!activeSection) return element.opacity ?? 1;

  if (!element.sectionId) return Math.min(element.opacity ?? 1, config.opacityGlobal);
  if (element.sectionId === activeSection) return element.opacity ?? 1;

  const sectionOrder = sections.findIndex((s) => s.id === element.sectionId);
  const activeOrder = sections.findIndex((s) => s.id === activeSection);

  if (sectionOrder < 0 || activeOrder < 0) return Math.min(element.opacity ?? 1, config.opacityGlobal);
  if (sectionOrder < activeOrder) return Math.min(element.opacity ?? 1, config.opacityPast);
  return Math.min(element.opacity ?? 1, config.opacityFuture);
}

/**
 * Applies spotlight opacity to all elements and returns the new list.
 */
export function applySpotlight(
  elements: DesignElement[],
  sections: SlideSection[],
  activeSectionId: string | null,
): DesignElement[] {
  if (!activeSectionId) return elements;
  const config: SpotlightConfig = { ...DEFAULT_SPOTLIGHT, activeSection: activeSectionId };
  return elements.map((el) => ({ ...el, opacity: computeSpotlightOpacity(el, sections, config) }));
}

// ── Progressive revelation ───────────────────────────────────────────────────

/**
 * Filters elements visible at a given progression step.
 * Elements without a step are always visible.
 */
export function filterElementsByStep(elements: DesignElement[], step: number): DesignElement[] {
  return elements.filter((el) => !el.step || Number(el.step) <= step);
}

/**
 * Returns the maximum step number defined across all elements.
 */
export function getMaxStep(elements: DesignElement[]): number {
  return elements.reduce((max, el) => Math.max(max, Number(el.step ?? 0)), 0);
}

/**
 * Groups elements by step for ordered revelation.
 */
export function groupElementsByStep(elements: DesignElement[]): Map<number, DesignElement[]> {
  const map = new Map<number, DesignElement[]>();
  for (const el of elements) {
    const step = Number(el.step ?? 0);
    if (!map.has(step)) map.set(step, []);
    map.get(step)!.push(el);
  }
  return map;
}

// ── Section management ───────────────────────────────────────────────────────

/**
 * Returns elements belonging to a specific section.
 */
export function getElementsBySection(elements: DesignElement[], sectionId: string): DesignElement[] {
  return elements.filter((el) => el.sectionId === sectionId);
}

/**
 * Returns unassigned elements (sectionId is null or undefined).
 */
export function getUnassignedElements(elements: DesignElement[]): DesignElement[] {
  return elements.filter((el) => !el.sectionId);
}

/**
 * Assigns a section to a list of element IDs.
 */
export function assignSection(
  elements: DesignElement[],
  elementIds: string[],
  sectionId: string | null,
): DesignElement[] {
  const idSet = new Set(elementIds);
  return elements.map((el) => idSet.has(el.id) ? { ...el, sectionId } : el);
}

// ── Pedagogical alignment score ──────────────────────────────────────────────

export type PedagogyAlignmentResult = {
  score: number;
  hasSections: boolean;
  hasProgression: boolean;
  hasSpotlight: boolean;
  sectionCoverage: number;
  suggestions: string[];
};

/**
 * Evaluates how well a slide uses pedagogical features.
 */
export function evaluatePedagogyAlignment(
  slide: SmartboardSlide,
): PedagogyAlignmentResult {
  const elements = slide.initialState?.elements ?? [];
  const sections = slide.sections ?? [];

  const hasSections = sections.length > 0;
  const hasProgression = elements.some((el) => (el.step ?? 0) > 0);
  const hasSpotlight = hasSections;

  const assignedCount = elements.filter((el) => el.sectionId).length;
  const sectionCoverage = elements.length > 0 ? assignedCount / elements.length : 0;

  const suggestions: string[] = [];
  if (!hasSections) suggestions.push('Ajoutez des sections pour organiser la progression du slide');
  if (!hasProgression) suggestions.push('Utilisez les etapes de revelation pour guider l\'apprenant');
  if (hasSections && sectionCoverage < 0.5) suggestions.push('Associez plus d\'elements aux sections pour le Spotlight');

  const score = Math.round(
    (hasSections ? 30 : 0) +
    (hasProgression ? 30 : 0) +
    sectionCoverage * 40,
  );

  return { score, hasSections, hasProgression, hasSpotlight, sectionCoverage, suggestions };
}
