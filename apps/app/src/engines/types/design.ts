// ─── Design Element Types (Konva canvas layer) ────────────────────────────────

export type ElementType =
  | 'text'
  | 'shape'
  | 'image'
  | 'path'
  | 'svg'
  | 'graph'
  | 'group'
  | 'line'
  | 'arrow'
  | 'pedagogical-block';

export type ShapeVariant =
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'star'
  | 'polygon'
  | 'rounded-rect';

export type VisibilityTarget = 'all' | 'student' | 'teacher' | 'both';

export type DesignElement = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
  zIndex?: number;
  sectionId?: string | null;
  step?: number;
  visibleFor?: VisibilityTarget;
  data: Record<string, unknown>;
  style: ElementStyle;
};

export type ElementStyle = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  cornerRadius?: number;
  dash?: number[];
  [key: string]: unknown;
};

export type BoardState = {
  elements: DesignElement[];
  spotlight?: string | null;
  dimmedIds?: string[];
  zoom?: number;
  pan?: { x: number; y: number };
};

export type CanvasConfig = {
  width: number;
  height: number;
  background: string;
  gridEnabled?: boolean;
  gridSize?: number;
  snapEnabled?: boolean;
};

export type SelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TransformHandle =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'rotation';
