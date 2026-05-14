/**
 * Course → SmartboardSlide Converter
 *
 * Pipeline:
 *   Course (chapters → subchapters → segments)
 *     → each Subchapter becomes 1 SmartboardSlide
 *     → each Segment becomes 1 progressive step (BoardState) within that slide
 *     → Mindmap + MasterScript injected as text elements
 */
import type { Course, Chapter, Subchapter, Segment } from '@/engines/types/course';
import type { SmartboardSlide, BoardState, SlideSection } from '@/engines/types/smartboard';
import type { DesignElement } from '@/engines/types/design';
import { makeTextElement, makeRectElement, DESIGN_WIDTH, DESIGN_HEIGHT } from '@/engines/konva-engine';

function genId() { return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

// ── Layout constants ──────────────────────────────────────────────────────────

const LAYOUT = {
  padding: 80,
  titleY: 60,
  titleFontSize: 48,
  bodyY: 160,
  bodyFontSize: 24,
  lineHeight: 40,
  columnWidth: (DESIGN_WIDTH - 160) / 2,
  rightColumnX: DESIGN_WIDTH / 2 + 40,
};

// ── Element builders ──────────────────────────────────────────────────────────

function buildTitleElement(title: string, sectionId: string | null = null): DesignElement {
  return makeTextElement({
    x: LAYOUT.padding,
    y: LAYOUT.titleY,
    text: title,
    fontSize: LAYOUT.titleFontSize,
    fill: '#f8fafc',
    sectionId,
  });
}

function buildBodyTextElement(
  text: string,
  y: number,
  sectionId: string | null = null,
  step = 0,
): DesignElement {
  return {
    ...makeTextElement({ x: LAYOUT.padding, y, text, fontSize: LAYOUT.bodyFontSize, fill: '#94a3b8', sectionId }),
    step,
    width: DESIGN_WIDTH - LAYOUT.padding * 2,
  };
}

function buildSectionHeaderElement(label: string, y: number, sectionId: string): DesignElement {
  return {
    ...makeTextElement({ x: LAYOUT.padding, y, text: label.toUpperCase(), fontSize: 14, fill: '#f59e0b', sectionId }),
    width: 300,
  };
}

function buildDividerElement(y: number): DesignElement {
  return {
    id: genId(),
    type: 'line',
    x: LAYOUT.padding,
    y,
    width: DESIGN_WIDTH - LAYOUT.padding * 2,
    height: 1,
    opacity: 0.3,
    locked: false,
    hidden: false,
    sectionId: null,
    data: { points: [0, 0, DESIGN_WIDTH - LAYOUT.padding * 2, 0] },
    style: { stroke: '#334155', strokeWidth: 1 },
  };
}

// ── Segment → BoardState ──────────────────────────────────────────────────────

function segmentToBoardState(segment: Segment, sectionId: string, step: number): BoardState {
  const elements: DesignElement[] = [];
  let y = LAYOUT.bodyY;

  // Section label
  elements.push(buildSectionHeaderElement(segment.title, y, sectionId));
  y += 30;

  // Summary
  if (segment.summary) {
    elements.push(buildBodyTextElement(segment.summary, y, sectionId, step));
    y += LAYOUT.lineHeight * 2;
  }

  // Display text (main content)
  if (segment.displayText) {
    elements.push(buildBodyTextElement(segment.displayText, y, sectionId, step));
    y += LAYOUT.lineHeight * 3;
  }

  // Key points from master script
  const keyPoints = segment.masterScript?.keyPoints ?? [];
  for (let i = 0; i < keyPoints.length; i++) {
    elements.push(buildBodyTextElement(`• ${keyPoints[i]}`, y + i * LAYOUT.lineHeight, sectionId, step + i + 1));
  }

  return { elements };
}

// ── Subchapter → SmartboardSlide ──────────────────────────────────────────────

export function subchapterToSlide(
  subchapter: Subchapter,
  chapter: Chapter,
  order: number,
): SmartboardSlide {
  const slideId = genId();
  const sections: SlideSection[] = [];
  const progressiveStates: Record<string, BoardState> = {};

  // Base elements (title + central idea)
  const baseElements: DesignElement[] = [
    buildTitleElement(subchapter.title),
    buildBodyTextElement(subchapter.centralIdea, LAYOUT.titleY + 80, null, 0),
    buildDividerElement(LAYOUT.titleY + 130),
  ];

  // One section per segment
  let globalStep = 1;
  for (const segment of subchapter.segments) {
    const sectionId = genId();
    sections.push({ id: sectionId, label: segment.title, order: sections.length });

    const state = segmentToBoardState(segment, sectionId, globalStep);
    progressiveStates[sectionId] = state;
    globalStep += (segment.masterScript?.keyPoints?.length ?? 0) + 2;
  }

  // Initial state = title + central idea only
  const initialState: BoardState = { elements: baseElements };

  // Live state = all segments revealed
  const allElements: DesignElement[] = [
    ...baseElements,
    ...Object.values(progressiveStates).flatMap((s) => s.elements),
  ];
  const liveState: BoardState = { elements: allElements };

  return {
    id: slideId,
    title: subchapter.title,
    chapterId: chapter.id,
    subchapterId: subchapter.id,
    segmentIds: subchapter.segments.map((s) => s.id),
    order,
    durationMinutes: subchapter.segments.length * 3,
    sections,
    initialState,
    progressiveStates,
    liveState,
    resetState: structuredClone(initialState),
  };
}

// ── Course → SmartboardSlide[] ────────────────────────────────────────────────

export function convertCourseToSmartboards(course: Course): SmartboardSlide[] {
  const slides: SmartboardSlide[] = [];
  let order = 0;

  for (const chapter of course.chapters) {
    // Optional: chapter intro slide
    if (chapter.subchapters.length > 0) {
      for (const subchapter of chapter.subchapters) {
        slides.push(subchapterToSlide(subchapter, chapter, order));
        order++;
      }
    }
  }

  return slides;
}

// ── Merge back (SmartboardSlide[] → Course structure) ────────────────────────

export type SlideIndex = Map<string, SmartboardSlide>;

export function buildSlideIndex(slides: SmartboardSlide[]): SlideIndex {
  return new Map(slides.map((s) => [s.id, s]));
}

export function getSlidesByChapter(slides: SmartboardSlide[], chapterId: string): SmartboardSlide[] {
  return slides.filter((s) => s.chapterId === chapterId).sort((a, b) => a.order - b.order);
}

export function getSlidesBySubchapter(slides: SmartboardSlide[], subchapterId: string): SmartboardSlide[] {
  return slides.filter((s) => s.subchapterId === subchapterId).sort((a, b) => a.order - b.order);
}
