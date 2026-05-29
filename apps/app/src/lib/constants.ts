/**
 * LIRI system-wide constants.
 */

// ── Canvas ────────────────────────────────────────────────────────────────────
export const DESIGN_WIDTH = 1837;
export const DESIGN_HEIGHT = 1063;
export const DESIGN_ASPECT_RATIO = DESIGN_WIDTH / DESIGN_HEIGHT;

// ── Grid / Snap ───────────────────────────────────────────────────────────────
export const DEFAULT_GRID_SIZE = 8;
export const DEFAULT_SNAP_THRESHOLD = 6;

// ── History ───────────────────────────────────────────────────────────────────
export const MAX_HISTORY_ENTRIES = 50;

// ── Quality thresholds ────────────────────────────────────────────────────────
export const QUALITY_MIN_FONT_SIZE = 14;
export const QUALITY_MAX_TEXT_DENSITY = 0.4;
export const QUALITY_MAX_ELEMENTS = 20;

// ── Zoom ──────────────────────────────────────────────────────────────────────
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5;
export const ZOOM_STEP = 0.1;
export const ZOOM_FIT_DEFAULT = 0.35;

// ── Spotlight opacity levels ──────────────────────────────────────────────────
export const SPOTLIGHT_OPACITY_ACTIVE = 1.0;
export const SPOTLIGHT_OPACITY_GLOBAL = 0.7;
export const SPOTLIGHT_OPACITY_PAST = 0.3;
export const SPOTLIGHT_OPACITY_FUTURE = 0.05;

// ── AI ────────────────────────────────────────────────────────────────────────
export const AI_ENDPOINTS = {
  anthropic: '/api/liri/anthropic',
  openai: '/api/liri/openai',
  removeBackground: '/api/liri/remove-background',
  vectorize: '/api/liri/vectorize',
  unsplash: '/api/liri/unsplash',
} as const;

// ── Local storage keys ────────────────────────────────────────────────────────
export const LS_KEYS = {
  courseBuilderDraft: 'liri-course-builder',
  smartboardSlides: 'liri-smartboard',
  collabRoom: 'liri_collab_room',
  pedagogyQueue: 'liri_pedagogy_hints_queue',
  courseWorkspace: 'liri_course_workspace_v2',
} as const;

// ── Routes ────────────────────────────────────────────────────────────────────
export const ROUTES = {
  studio: '/studio',
  courseBuilder: '/studio/course-builder-pro',
  smartboard: '/studio/smartboard-konva',
  livePreview: '/studio/live-preview',
  exportCenter: '/studio/export-center',
  devSmartboard: '/dev/smartboard',
} as const;

// ── Canvas defaults ───────────────────────────────────────────────────────────
export const DEFAULT_CANVAS_BG = '#0f1117';
export const DEFAULT_SLIDE_DURATION = 3; // minutes

// ── Fonts ─────────────────────────────────────────────────────────────────────
export const SYSTEM_FONTS = [
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Système', value: 'system-ui, sans-serif' },
  { label: 'Mono', value: 'ui-monospace, SFMono-Regular, monospace' },
] as const;
