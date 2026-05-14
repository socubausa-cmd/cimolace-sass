// ─── Course Builder Types ─────────────────────────────────────────────────────

export type Course = {
  id: string;
  title: string;
  theme: string;
  subject?: string;
  level?: string;
  language?: string;
  createdAt?: string;
  updatedAt?: string;
  chapters: Chapter[];
};

export type Chapter = {
  id: string;
  title: string;
  objective: string;
  order: number;
  subchapters: Subchapter[];
};

export type Subchapter = {
  id: string;
  title: string;
  centralIdea: string;
  generalIdea: string;
  knowledgeTarget: string;
  competencyTarget: string;
  order: number;
  segments: Segment[];
};

export type Segment = {
  id: string;
  title: string;
  summary: string;
  displayText: string;
  order: number;
  mindmap: Mindmap;
  masterScript: MasterScript;
};

export type Mindmap = {
  root: MindmapNode;
};

export type MindmapNode = {
  id: string;
  label: string;
  children?: MindmapNode[];
};

export type MasterScript = {
  intro: string;
  keyPoints: string[];
  transitions: string[];
  conclusion: string;
  teacherNotes?: string;
};

export type CourseValidationResult = {
  valid: boolean;
  score: number;
  errors: string[];
  warnings: string[];
};
