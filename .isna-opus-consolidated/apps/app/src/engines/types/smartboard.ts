// ─── SmartBoard Designer Types ────────────────────────────────────────────────
import type { BoardState, DesignElement } from './design';

export type SmartboardSlide = {
  id: string;
  title: string;
  chapterId: string;
  subchapterId: string;
  segmentIds: string[];
  order: number;
  durationMinutes?: number;
  sections: SlideSection[];
  initialState: BoardState;
  progressiveStates: Record<string, BoardState>;
  liveState: BoardState;
  resetState: BoardState;
};

export type SlideSection = {
  id: string;
  label: string;
  order: number;
  color?: string;
};

export type CanvasMode = 'design' | 'mindmap' | 'script';

export type ViewMode = 'design' | 'student' | 'teacher' | 'live';

export type ProgressionStep = {
  id: string;
  segmentId: string;
  label: string;
  revealedElementIds: string[];
  spotlightElementId?: string;
};

export type SmartboardProject = {
  id: string;
  title: string;
  courseId?: string;
  slides: SmartboardSlide[];
  activeSlideId: string;
  canvas: {
    width: number;
    height: number;
    background: string;
  };
};

export type SpotlightConfig = {
  activeSection: string | null;
  opacityActive: number;
  opacityGlobal: number;
  opacityPast: number;
  opacityFuture: number;
};

export type SlideQualityReport = {
  score: number;
  level: 'faible' | 'moyen' | 'bon' | 'excellent';
  issues: SlideQualityIssue[];
};

export type SlideQualityIssue = {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  elementId?: string;
};

export type ExportFormat = 'pdf' | 'json' | 'png' | 'pptx' | 'student-pdf' | 'teacher-pdf';

export type ExportJob = {
  id: string;
  format: ExportFormat;
  slideIds: string[];
  status: 'pending' | 'processing' | 'done' | 'error';
  url?: string;
  error?: string;
};
