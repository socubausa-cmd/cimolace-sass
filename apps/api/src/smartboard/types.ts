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

export interface SmartboardSlideContent {
  main_text: string;
  support_text?: string;
}

export interface SmartboardSlide {
  slide_id: string;
  chapter_id: string;
  step: string;
  title: string;
  pedagogical_goal: string;
  dominant_mode: 'texte' | 'image' | 'graphique' | 'infographie' | 'interaction' | 'image_graphique';
  content: SmartboardSlideContent;
  visual: SmartboardSlideVisual;
  graphic?: SmartboardSlideGraphic;
  student_action?: string;
  teacher_note?: string;
  transition?: string;
}

export interface SmartboardDeckFormat {
  mode: string;
  width: number;
  height: number;
  ratio: string;
}

export interface SmartboardDeckTheme {
  background: string;
  accent_primary: string;
  accent_secondary: string;
  text_primary: string;
  text_secondary: string;
  card_style: string;
}

export interface SmartboardGlobalRules {
  readability_first: boolean;
  max_title_words: number;
  max_subtitle_words: number;
  max_main_idea_words: number;
  max_development_blocks: number;
  max_words_per_block: number;
  single_view_only: boolean;
  large_text_required: boolean;
  progressive_build_enabled: boolean;
}

export interface SmartboardLayoutZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SmartboardLayout {
  type: string;
  safe_zone: SmartboardLayoutZone;
  zones: Record<string, SmartboardLayoutZone>;
  /**
   * Gabarit live immersif (version mobile, cf. docs/SMARTBOARD_LIVE_IMMERSIF.md) :
   * - `background: 'transparent'` → le smartboard se fond dans la scène live sombre
   *   (pas de carte blanche/opaque).
   * - `camera_zone` → emplacement RÉSERVÉ pour le flux vidéo du présentateur
   *   (vignette « Flux vidéo prof »), autour duquel le contenu s'organise.
   * Renseignés par le constructeur (Architect IA / Masterclass) à la génération.
   */
  background?: 'transparent' | string;
  camera_zone?: SmartboardLayoutZone & { corner?: 'top-right' | 'bottom-right' };
}

export interface SmartboardMasterScript {
  slide_id: string;
  slide_title: string;
  intention: string;
  message_central: string;
  teacher_script: string;
  key_points: string[];
  student_understanding: string;
  transition: string;
  simple_version: string;
}

export interface SmartboardDeckRow {
  id: string;
  tenant_id: string;
  created_by: string;
  title: string;
  source_text: string;
  format: SmartboardDeckFormat | null;
  theme: SmartboardDeckTheme | null;
  global_rules: SmartboardGlobalRules | null;
  layout: SmartboardLayout | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SmartboardSlideRow {
  id: string;
  deck_id: string;
  tenant_id: string;
  slide_index: number;
  step: string | null;
  title: string;
  subtitle: string | null;
  core_idea: string | null;
  pedagogical_goal: string | null;
  dominant_mode: string | null;
  hero_visual: Record<string, unknown> | null;
  development: Record<string, unknown>[] | null;
  illustration: Record<string, unknown> | null;
  illustration_image_url: string | null;
  slide_summary: string | null;
  progressive_build: Record<string, unknown>[] | null;
  content: SmartboardSlideContent | null;
  visual: SmartboardSlideVisual | null;
  graphic: SmartboardSlideGraphic | null;
  student_action: string | null;
  teacher_note: string | null;
  transition: string | null;
  master_script: SmartboardMasterScript | null;
  created_at: string;
  updated_at: string;
}

export interface SmartboardStepDefinition {
  key: string;
  label: string;
  visualWeights: {
    texte: number;
    image: number;
    graphique: number;
    infographie: number;
    interaction: number;
  };
}

export const SMARTBOARD_STEPS: SmartboardStepDefinition[] = [
  { key: 'titre_chapitre', label: 'Titre chapitre', visualWeights: { texte: 70, image: 20, graphique: 5, infographie: 5, interaction: 0 } },
  { key: 'objectif_competence_connaissance', label: 'Objectif · compétence · connaissance', visualWeights: { texte: 75, image: 10, graphique: 5, infographie: 10, interaction: 0 } },
  { key: 'mise_en_situation', label: 'Mise en situation', visualWeights: { texte: 40, image: 60, graphique: 0, infographie: 0, interaction: 0 } },
  { key: 'tension_pedagogique', label: 'Tension pédagogique', visualWeights: { texte: 60, image: 20, graphique: 20, infographie: 0, interaction: 0 } },
  { key: 'experience_pensee', label: 'Expérience de pensée', visualWeights: { texte: 45, image: 40, graphique: 10, infographie: 0, interaction: 5 } },
  { key: 'revelation', label: 'Révélation', visualWeights: { texte: 90, image: 10, graphique: 0, infographie: 0, interaction: 0 } },
  { key: 'lecon_simple', label: 'Leçon simple', visualWeights: { texte: 80, image: 10, graphique: 10, infographie: 0, interaction: 0 } },
  { key: 'lecon_developpee', label: 'Leçon développée', visualWeights: { texte: 50, image: 10, graphique: 40, infographie: 0, interaction: 0 } },
  { key: 'analogies', label: 'Analogies', visualWeights: { texte: 40, image: 50, graphique: 0, infographie: 10, interaction: 0 } },
  { key: 'exemples', label: 'Exemples', visualWeights: { texte: 55, image: 30, graphique: 10, infographie: 5, interaction: 0 } },
  { key: 'reformulation', label: 'Reformulation', visualWeights: { texte: 85, image: 10, graphique: 0, infographie: 5, interaction: 0 } },
  { key: 'atelier_application', label: 'Atelier / application', visualWeights: { texte: 35, image: 15, graphique: 10, infographie: 10, interaction: 30 } },
  { key: 'erreurs_attendues', label: 'Erreurs attendues', visualWeights: { texte: 70, image: 10, graphique: 20, infographie: 0, interaction: 0 } },
  { key: 'correction_pedagogique', label: 'Correction pédagogique', visualWeights: { texte: 75, image: 5, graphique: 20, infographie: 0, interaction: 0 } },
  { key: 'dictee_je_retiens', label: 'Dictée JE RETIENS', visualWeights: { texte: 100, image: 0, graphique: 0, infographie: 0, interaction: 0 } },
  { key: 'test_comprehension', label: 'Test compréhension', visualWeights: { texte: 45, image: 5, graphique: 15, infographie: 5, interaction: 30 } },
  { key: 'cas_reel', label: 'Cas réel', visualWeights: { texte: 45, image: 35, graphique: 10, infographie: 5, interaction: 5 } },
  { key: 'lien_avec_autres_concepts', label: 'Lien avec autres concepts', visualWeights: { texte: 45, image: 5, graphique: 35, infographie: 15, interaction: 0 } },
  { key: 'transition', label: 'Transition', visualWeights: { texte: 80, image: 15, graphique: 5, infographie: 0, interaction: 0 } },
];

export const DEFAULT_FORMAT: SmartboardDeckFormat = {
  mode: 'smartboard_horizontal',
  width: 1037,
  height: 750,
  ratio: '1037:750',
};

export const DEFAULT_THEME: SmartboardDeckTheme = {
  background: 'dark_cosmic_blue',
  accent_primary: 'gold',
  accent_secondary: 'electric_blue',
  text_primary: '#F5F1E8',
  text_secondary: '#C9D3F2',
  card_style: 'glass_dark_soft',
};

export const DEFAULT_GLOBAL_RULES: SmartboardGlobalRules = {
  readability_first: true,
  max_title_words: 6,
  max_subtitle_words: 10,
  max_main_idea_words: 14,
  max_development_blocks: 3,
  max_words_per_block: 8,
  single_view_only: true,
  large_text_required: true,
  progressive_build_enabled: true,
};

export const DEFAULT_LAYOUT: SmartboardLayout = {
  type: 'horizontal_split',
  safe_zone: { x: 36, y: 28, width: 965, height: 694 },
  // Gabarit live immersif : fond transparent + zone caméra réservée (haut-droite).
  background: 'transparent',
  camera_zone: { x: 760, y: 40, width: 217, height: 150, corner: 'top-right' },
  zones: {
    header: { x: 60, y: 40, width: 697, height: 110 }, // réduit pour libérer la place de camera_zone
    core_idea: { x: 120, y: 160, width: 797, height: 90 },
    development_left: { x: 70, y: 280, width: 360, height: 300 },
    visual_right: { x: 455, y: 280, width: 500, height: 300 },
    insight_footer: { x: 90, y: 610, width: 857, height: 80 },
  },
};
