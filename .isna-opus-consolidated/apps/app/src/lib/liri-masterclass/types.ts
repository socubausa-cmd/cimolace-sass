export interface MasterclassAnalysis {
  global_subject: string;
  intention: string;
  audience: string;
  difficulty: string;
  difficulty_score: number;
  estimated_total_duration: string;
  central_themes: string[];
  global_revelations: string[];
}

export interface MasterclassBlock {
  id: number;
  title: string;
  central_idea: string;
  lines_label: string;
  revelations: string[];
  tensions: string[];
  keywords: string[];
}

export interface MasterclassChapter {
  chapter_id: number;
  title: string;
  objective: string;
  skill_to_acquire: string;
  knowledge_to_transmit: string;
  real_life_situation?: string;
  pedagogical_tension?: string;
  thought_experiment?: string;
  revelation_moment?: string;
  simple_lesson?: string;
  deep_lesson?: string;
  analogies?: Array<{ type?: string; content?: string }>;
  examples?: Array<{ type?: string; content?: string }>;
  reformulation?: string;
  workshop?: {
    instructions?: string;
    questions?: string[];
    expected_answers?: string[];
    expected_errors?: string[];
  };
  deep_error?: string;
  pedagogical_correction?: string;
  je_retiens?: string[];
  understanding_test?: Array<{ question: string; expected_answer: string }>;
  real_application?: string;
  transition_to_next?: string;
}

export interface MasterclassQualityReport {
  valid: boolean;
  errors: string[];
}

export interface MasterclassExportSummary {
  chapters_count: number;
  minutes_total: number;
  slides_count: number;
  exercises_count: number;
  tests_count: number;
}

export interface MasterclassExports {
  summary: MasterclassExportSummary;
  tests: unknown[];
  exercises: unknown[];
  transitions: unknown[];
  downloadable: {
    json: boolean;
    markdown: boolean;
    pdf_professor: boolean;
    pdf_student: boolean;
    smartboard: boolean;
    liri_live: boolean;
  };
}

export interface MasterclassProject {
  rawText: string;
  analysis: MasterclassAnalysis | null;
  blocks: MasterclassBlock[];
  chapters: MasterclassChapter[];
  pedagogy: MasterclassChapter[];
  slides: unknown[];
  scripts: unknown[];
  exports: MasterclassExports;
  status: 'idle' | 'running' | 'ready' | 'error';
}

export interface RunMasterclassFactoryInput {
  rawText: string;
}

export interface RunMasterclassFactoryOutput {
  success: boolean;
  data: {
    analysis: MasterclassAnalysis | null;
    blocks: MasterclassBlock[];
    chapters: MasterclassChapter[];
    pedagogy: MasterclassChapter[];
    slides: unknown[];
    scripts: unknown[];
    exports: MasterclassExports;
    quality: MasterclassQualityReport;
  };
}
