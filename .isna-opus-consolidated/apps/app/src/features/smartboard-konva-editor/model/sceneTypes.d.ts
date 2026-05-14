/** Types documentaires pour le moteur Konva SmartBoard (JSDoc / TS). */

export type SbVisibleFor = 'student' | 'teacher' | 'both';

export type SbKonvaObjectType =
  | 'text'
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'ellipse'
  | 'image'
  | 'icon'
  | 'html';

export interface SbKonvaObjectBase {
  id: string;
  type: SbKonvaObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  layer: number;
  visible: boolean;
  locked: boolean;
  step: number;
  visibleFor: SbVisibleFor;
  mindmapNodeId: string;
  masterScriptRef: string;
  /** Section interne du slide (progression petit a / b / c) */
  sectionId?: string | null;
  hidden?: boolean;
  opacity?: number;
  style: Record<string, unknown>;
  content: Record<string, unknown>;
}

export interface SbKonvaSceneSection {
  id: string;
  label: string;
}

export interface SbKonvaScene {
  id: string;
  name: string;
  objects: SbKonvaObjectBase[];
  sections?: SbKonvaSceneSection[];
  /** Snapshot des objets pour « Réinitialiser » après manip live (J1) */
  stateInitial?: SbKonvaObjectBase[] | null;
  durationMinutes?: number;
}

export interface SbKonvaProject {
  version: number;
  canvas: {
    width: number;
    height: number;
    background: string;
  };
  scenes: SbKonvaScene[];
  activeSceneId: string;
}

export interface SbKonvaSceneExport {
  sceneId: string;
  canvas: SbKonvaProject['canvas'];
  objects: SbKonvaObjectBase[];
}
