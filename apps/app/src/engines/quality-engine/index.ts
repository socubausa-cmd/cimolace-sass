/**
 * Quality Engine — slide and project quality scoring.
 */
import type { DesignElement, SmartboardSlide, SlideQualityReport, SlideQualityIssue } from '@/engines/types';

// ── Configuration ─────────────────────────────────────────────────────────────

export type QualityConfig = {
  canvas: { width: number; height: number };
  thresholds: {
    minFontSize: number;
    maxFontSize: number;
    maxTextDensity: number;
    minTextImageRatio: number;
    maxTextImageRatio: number;
    maxElements: number;
  };
};

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  canvas: { width: 1837, height: 1063 },
  thresholds: {
    minFontSize: 14,
    maxFontSize: 120,
    maxTextDensity: 0.4,
    minTextImageRatio: 0.1,
    maxTextImageRatio: 0.9,
    maxElements: 20,
  },
};

// ── Element analysis ──────────────────────────────────────────────────────────

function getElementArea(el: DesignElement): number {
  return (el.width ?? 0) * (el.height ?? 0);
}

function countByType(elements: DesignElement[], type: string): number {
  return elements.filter((el) => el.type === type).length;
}

function getTextElements(elements: DesignElement[]): DesignElement[] {
  return elements.filter((el) => el.type === 'text');
}

function getImageElements(elements: DesignElement[]): DesignElement[] {
  return elements.filter((el) => el.type === 'image' || el.type === 'svg');
}

// ── Slide quality computation ─────────────────────────────────────────────────

export type SlideQualityInput = {
  elements: DesignElement[];
  title?: string;
  sections?: { id: string; label: string }[];
  durationMinutes?: number;
};

export function computeSlideQuality(
  input: SlideQualityInput,
  config: QualityConfig = DEFAULT_QUALITY_CONFIG,
): SlideQualityReport {
  const issues: SlideQualityIssue[] = [];
  const { elements, sections = [] } = input;
  const { thresholds, canvas } = config;
  const canvasArea = canvas.width * canvas.height;

  const textEls = getTextElements(elements);
  const imageEls = getImageElements(elements);

  // Issue: too many elements
  if (elements.length > thresholds.maxElements) {
    issues.push({
      code: 'TOO_MANY_ELEMENTS',
      severity: 'warning',
      message: `${elements.length} elements sur le slide — recommande max ${thresholds.maxElements}`,
    });
  }

  // Issue: no content
  if (elements.length === 0) {
    issues.push({ code: 'EMPTY_SLIDE', severity: 'error', message: 'Slide vide — aucun contenu' });
  }

  // Issue: tiny fonts
  for (const el of textEls) {
    const fontSize = (el.style as Record<string, number>)?.fontSize ?? 16;
    if (fontSize < thresholds.minFontSize) {
      issues.push({
        code: 'FONT_TOO_SMALL',
        severity: 'warning',
        message: `Texte trop petit (${fontSize}px) — minimum ${thresholds.minFontSize}px`,
        elementId: el.id,
      });
    }
  }

  // Issue: text density too high
  const textArea = textEls.reduce((sum, el) => sum + getElementArea(el), 0);
  const textDensity = textArea / canvasArea;
  if (textDensity > thresholds.maxTextDensity) {
    issues.push({
      code: 'HIGH_TEXT_DENSITY',
      severity: 'warning',
      message: `Densite textuelle trop haute (${Math.round(textDensity * 100)}%) — slide surchargee`,
    });
  }

  // Issue: no image (text-only slides)
  if (textEls.length > 0 && imageEls.length === 0 && elements.length > 2) {
    issues.push({ code: 'NO_IMAGE', severity: 'info', message: 'Aucune image — considerez ajouter un visuel pour renforcer la memorisation' });
  }

  // Issue: no text (image-only)
  if (textEls.length === 0 && imageEls.length > 0) {
    issues.push({ code: 'NO_TEXT', severity: 'warning', message: 'Aucun texte — le slide manque de contenu explicatif' });
  }

  // Issue: no sections
  if (sections.length === 0 && elements.length > 3) {
    issues.push({ code: 'NO_SECTIONS', severity: 'info', message: 'Pas de sections pedagogiques — utile pour le Spotlight' });
  }

  // Issue: elements outside canvas
  const offCanvas = elements.filter((el) => el.x < 0 || el.y < 0 || (el.x + (el.width ?? 0)) > canvas.width || (el.y + (el.height ?? 0)) > canvas.height);
  for (const el of offCanvas) {
    issues.push({ code: 'OFF_CANVAS', severity: 'warning', message: 'Element hors du canvas', elementId: el.id });
  }

  // Score computation
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;
  const rawScore = Math.max(0, 100 - errorCount * 30 - warningCount * 10 - infoCount * 3);

  let level: SlideQualityReport['level'] = 'faible';
  if (rawScore >= 80) level = 'excellent';
  else if (rawScore >= 60) level = 'bon';
  else if (rawScore >= 40) level = 'moyen';

  return { score: rawScore, level, issues };
}

// ── Project quality ───────────────────────────────────────────────────────────

export type ProjectQualityReport = {
  overallScore: number;
  slideReports: Array<{ slideId: string; report: SlideQualityReport }>;
  emptySlides: number;
  totalSlides: number;
  averageScore: number;
};

export function computeProjectQuality(
  slides: SmartboardSlide[],
  config: QualityConfig = DEFAULT_QUALITY_CONFIG,
): ProjectQualityReport {
  const slideReports = slides.map((slide) => ({
    slideId: slide.id,
    report: computeSlideQuality({
      elements: slide.initialState?.elements ?? [],
      sections: slide.sections,
      durationMinutes: slide.durationMinutes,
    }, config),
  }));

  const emptySlides = slideReports.filter((r) => r.report.issues.some((i) => i.code === 'EMPTY_SLIDE')).length;
  const totalSlides = slides.length;
  const averageScore = totalSlides > 0
    ? Math.round(slideReports.reduce((sum, r) => sum + r.report.score, 0) / totalSlides)
    : 0;

  return {
    overallScore: averageScore,
    slideReports,
    emptySlides,
    totalSlides,
    averageScore,
  };
}
