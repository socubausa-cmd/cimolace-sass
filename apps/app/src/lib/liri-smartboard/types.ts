export interface SmartboardSlideVisual {
  type: string;
  prompt: string;
}

export interface SmartboardSlideGraphic {
  type: string;
  left?: string;
  center?: string;
  right?: string;
  [key: string]: unknown;
}

export interface SmartboardSlide {
  slide_id: string;
  chapter_id: string;
  step: string;
  title: string;
  pedagogical_goal: string;
  dominant_mode: 'texte' | 'image' | 'graphique' | 'infographie' | 'interaction' | 'image_graphique';
  content: {
    main_text: string;
    support_text?: string;
  };
  visual: SmartboardSlideVisual;
  graphic?: SmartboardSlideGraphic;
  student_action?: string;
  teacher_note?: string;
  transition?: string;
}

export interface GenerateSlideInput {
  sourceText: string;
  chapter: {
    chapter_id: string;
    title: string;
    objective?: string;
    skill?: string;
    knowledge?: string;
    payload?: Record<string, unknown>;
  };
  step: string;
  previousSlides: SmartboardSlide[];
}

export interface GenerateSlideOutput {
  success: boolean;
  slide: SmartboardSlide;
  quality: {
    valid: boolean;
    errors: string[];
  };
}

