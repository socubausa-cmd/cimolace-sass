/**
 * Types du moteur natif SmartBoard (alignés sur le modèle web Konva).
 * Le payload JSONB des `liri_course_workspaces` suit la forme `SbKonvaProject`.
 *
 * Le moteur natif rend les objets via Skia. Pour rester compatible avec le web
 * (qui peut ajouter texte/rect/cercle/lignes), on conserve la même enveloppe
 * `SbKonvaObjectBase` mais on ne manipule nativement que les types supportés.
 */

export type SbVisibleFor = 'student' | 'teacher' | 'both';

export type SbKonvaObjectType =
  | 'text'
  | 'rect'
  | 'circle'
  | 'line' // tracé libre (pen) sérialisé sous forme de polyligne
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
  sectionId?: string | null;
  hidden?: boolean;
  opacity?: number;
  style: Record<string, unknown>;
  content: Record<string, unknown>;
}

export interface SbKonvaScene {
  id: string;
  name: string;
  objects: SbKonvaObjectBase[];
  sections?: { id: string; label: string }[];
  stateInitial?: SbKonvaObjectBase[] | null;
  durationMinutes?: number;
}

export interface SbKonvaProject {
  version: number;
  canvas: { width: number; height: number; background: string };
  scenes: SbKonvaScene[];
  activeSceneId: string;
}

/** Ligne d'index d'un workspace (liste des brouillons). */
export interface WorkspaceRow {
  id: string;
  title: string;
  updated_at: string;
  user_id: string;
  lifecycle_status?: string | null;
}

/** Workspace complet avec payload désérialisé. */
export interface WorkspaceFull {
  id: string;
  title: string;
  user_id: string;
  lifecycle_status?: string | null;
  project: SbKonvaProject;
}
