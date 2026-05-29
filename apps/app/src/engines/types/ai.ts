// ─── AI / LIRI Agent Types ────────────────────────────────────────────────────

export type AITaskType =
  | 'detect_event_type'
  | 'build_course_blueprint'
  | 'generate_mindmap'
  | 'generate_master_script'
  | 'coach_slide'
  | 'architect_redesign'
  | 'suggest_shape_variants'
  | 'auto_text_design'
  | 'generate_visual_prompt'
  | 'analyze_slide_quality'
  | 'generate_progression'
  | 'suggest_analogies';

export type AIProvider = 'openai' | 'anthropic' | 'liri-local';

export type AIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  taskType?: AITaskType;
  metadata?: Record<string, unknown>;
};

export type AIJob = {
  id: string;
  taskType: AITaskType;
  provider: AIProvider;
  status: 'pending' | 'running' | 'done' | 'error';
  payload: unknown;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

export type CoachFeedback = {
  score: number;
  level: 'critique' | 'moyen' | 'bon' | 'excellent';
  structureScore: number;
  readabilityScore: number;
  densityScore: number;
  textImageRatio: number;
  pedagogicalAlignment: number;
  suggestions: CoachSuggestion[];
};

export type CoachSuggestion = {
  id: string;
  type: 'layout' | 'typography' | 'content' | 'visual' | 'progression';
  priority: 'high' | 'medium' | 'low';
  message: string;
  actionLabel?: string;
  action?: ArchitectAction;
};

export type ArchitectAction = {
  type: 'redesign_layout' | 'fix_typography' | 'replace_element' | 'add_element' | 'remove_element' | 'reorder';
  elementIds?: string[];
  patch?: Record<string, unknown>;
};

export type GenerationJob = {
  id: string;
  type: AITaskType;
  progress: number;
  status: 'idle' | 'running' | 'done' | 'error';
  result?: unknown;
};
