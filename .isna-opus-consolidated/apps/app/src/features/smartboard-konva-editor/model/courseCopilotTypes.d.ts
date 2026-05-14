/** LIRI Course Copilot — structure pédagogique (l’IA structure, Konva exécute le design). */

export type CourseSlideType =
  | 'atelier'
  | 'confrontation'
  | 'definition'
  | 'demonstration'
  | 'exemple'
  | 'synthese';

export interface CourseMindmapNode {
  id: string;
  label: string;
  children: CourseMindmapNode[];
}

export interface CourseChapter {
  id: string;
  title: string;
  summary: string;
  subparts: string[];
}

export interface SlideZone {
  id: string;
  role: string;
  hint: string;
}

export interface SlideContent {
  title: string;
  subtitle: string;
  mainText: string;
  blocks: string[];
}

export interface SlideMasterScript {
  discourse: string;
  keyPoints: string[];
  transitions: string;
}

export interface SlideSuggestions {
  visualType: string;
  diagramHint: string;
  layoutTips: string[];
}

export interface CourseSlide {
  id: string;
  title: string;
  type: CourseSlideType;
  objective: string;
  content: SlideContent;
  zones: SlideZone[];
  masterScript: SlideMasterScript;
  suggestions: SlideSuggestions;
}

export interface CourseAnalysisMeta {
  mainTopic: string;
  subthemes: string[];
  complexity: 'debutant' | 'intermediaire' | 'avance';
  estimatedDurationMinutes: number;
}

export interface CoursePlanProgression {
  narrative: string;
  pedagogicalPhases: string[];
}

export interface LiriCourseCopilotCourse {
  title: string;
  description: string;
  analysis: CourseAnalysisMeta;
  progression: CoursePlanProgression;
  chapters: CourseChapter[];
  slides: CourseSlide[];
  mindmap: CourseMindmapNode;
  /** Script global optionnel (agrégat) */
  masterScriptOverview: string;
}
