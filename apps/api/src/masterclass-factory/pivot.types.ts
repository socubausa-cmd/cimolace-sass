/**
 * ATELIER DE COURS UNIFIÉ — contrats du PIVOT (lot 1).
 * Spéc : docs/ATELIER_COURS_UNIFIE_SPEC.md
 *
 * Le constat qui fonde ce module : 5 moteurs lisaient la MÊME transcription,
 * appelaient le MÊME modèle et faisaient les MÊMES étapes, pour n'écrire
 * qu'à la fin dans des formats incompatibles. On sépare donc :
 *
 *   SOURCE ──► Comprehension (le FOND, extrait UNE fois) ──► formes ──► rendus
 *
 * Une `Comprehension` coûte cher (segmentation + notions + plan). Une fois
 * produite, elle est réutilisée sans rappeler le modèle : le même cours peut
 * sortir en PDF **et** en parcours élève sans être régénéré.
 */

export type SourceType =
  | 'replay'
  | 'live'
  | 'tiktok'
  | 'document'
  | 'texte'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'url';

export type PivotKind =
  | 'comprehension'
  | 'ecrit'
  | 'joue'
  | 'master_script'
  | 'smartboard_timeline'
  | 'live_scenario'
  | 'replay_postprod';

export type RenderTarget =
  | 'pdf'
  | 'parcours'
  | 'masterclass'
  | 'precepteur'
  | 'smartboard'
  | 'live'
  | 'master_script'
  | 'video_semaine'
  | 'quiz'
  | 'forum'
  | 'faq'
  | 'manuel';

/** Toute source, une fois normalisée. Le noyau ignore d'où vient le contenu. */
export interface NormalizedSource {
  id: string;
  tenantId: string;
  title: string;
  /** Transcription BRUTE, non nettoyée : le nettoyage est le travail du noyau. */
  transcript: string;
  cues?: { t: number; text: string }[];
  durationSec?: number;
}

/** Une notion = une idée enseignable, ancrée dans la source. */
export interface PivotNotion {
  id: string;
  titre: string;
  idee_centrale: string;
  pourquoi: string;
  prerequis?: string[];
  /**
   * ⛔ GARDE-FOU ANTI-INVENTION — obligatoire. Citations ou faits TIRÉS de la
   * source. Une notion sans appui est écartée : c'est la parade éprouvée qui a
   * fait passer une extraction de « 4 modules / 11 leçons inventés » à
   * « 2 modules / 5 leçons, 0 orpheline ».
   */
  appuis: string[];
  /** Traçabilité vers la vidéo (permet de revenir au moment exact du direct). */
  source_spans?: { start_sec: number; end_sec: number }[];
}

/** NIVEAU 1 — le FOND. Aucune décision de mise en forme ici. */
export interface Comprehension {
  schema_version: 1;
  titre: string;
  promesse: string;
  public?: string;
  prerequis?: string[];
  notions: PivotNotion[];
  glossaire: { terme: string; simple: string }[];
  meta: {
    source_type: SourceType;
    source_id: string;
    source_title: string;
    duration_min?: number;
    transcript_chars: number;
    segments: number;
    model: string;
    generated_at: string;
  };
}

/**
 * NIVEAU 2-A — cours ÉCRIT. Reprend TEL QUEL le schéma leçon déjà validé en
 * production dans `apps/worker/src/jobs/course-from-replay.js` : 11 blocs,
 * contrôle anti-copie, quiz obligatoirement expliqué. Ce schéma NE CHANGE PAS —
 * la sortie du moteur PDF (titre/contenu/points-clés) en est un sous-ensemble
 * pauvre, donc un rendu dégradé de celui-ci, et non l'inverse.
 */
export interface LeconEcrite {
  notion_id: string;
  titre: string;
  amorce: { situation: string; question: string };
  intuition: string;
  definition: string | { enonce: string; citation?: string; mots_cles?: { mot: string; sens: string }[] };
  schema?: Record<string, unknown>;
  exemple: { titre: string; deroule: string };
  contre_exemple: { titre: string; pourquoi_faux: string };
  erreur_frequente: string | { erreur: string; correction: string };
  experience_pensee: string | { consigne: string; deroule: string; ce_que_ca_montre?: string };
  mise_en_situation: string | { contexte: string; consigne: string; reussite?: string };
  je_retiens: { phrases: string[]; mots_cles: string[] };
  quiz: { question: string; options: string[]; correctAnswer: number; explication: string }[];
}

export interface CoursEcrit {
  schema_version: 1;
  kind: 'ecrit';
  lecons: LeconEcrite[];
}

/**
 * NIVEAU 2-B — cours JOUÉ (modèle canonique Précepteur). Séquence de scènes
 * narratives, voix orale.
 *
 * ⚠️ DÉCISION DU FONDATEUR (2026-07-26) : le joué se génère INDÉPENDAMMENT
 * depuis la `Comprehension`, il n'est PAS dérivé de l'écrit. La voix orale du
 * Précepteur n'est pas une reformulation d'un texte rédigé.
 */
export type SceneJouee =
  | { type: 'lecon'; narration: string }
  | { type: 'amorce_croquis'; narration: string }
  | { type: 'croquis_placeholder'; sketch?: Record<string, unknown> }
  | {
      type: 'atelier';
      question: string;
      hint?: string;
      expected_answers?: string[];
      expected_errors?: string[];
      reveal_narration?: string;
      reveal_sketch_placeholder?: boolean;
    }
  | { type: 'image_analogie'; analogie: string; image_prompt: string; narration?: string }
  | { type: 'transition'; narration: string };

export interface CoursJoue {
  schema_version: 1;
  kind: 'joue';
  scenes: SceneJouee[];
}

/**
 * NIVEAU 2-C — MASTER SCRIPT. C'est le conducteur pédagogique oral : comment
 * l'enseignant dit le fond, dans quel ordre, avec quelles transitions, et quels
 * moments doivent déclencher une image/tableau/interaction. Il devient la pièce
 * centrale entre `Comprehension`, SmartBoard et Liri Live.
 */
export interface MasterScriptMoment {
  id: string;
  notion_id?: string;
  title: string;
  intention: string;
  message_central: string;
  teacher_script: string;
  key_points: string[];
  student_understanding?: string;
  simple_version?: string;
  transition?: string;
  duration_sec?: number;
  interaction?: {
    question: string;
    expected_answers?: string[];
    expected_errors?: string[];
    remediation?: string;
  };
}

export interface MasterScriptPivot {
  schema_version: 1;
  kind: 'master_script';
  title: string;
  audience?: string;
  intention_generale: string;
  estimated_duration_minutes?: number;
  moments: MasterScriptMoment[];
  meta?: {
    source_kind?: SourceType;
    source_id?: string;
    comprehension_pivot_id?: string;
    generated_at: string;
    model?: string;
  };
}

/**
 * NIVEAU 2-D — SMARTBOARD TIMELINE. Ce n'est pas une slide statique : c'est le
 * tableau vivant décrit dans le cahier des charges. La voix pilote l'apparition
 * des blocs, l'écriture, le surlignage et les schémas.
 */
export interface SmartboardTimelineAction {
  id: string;
  at_sec?: number;
  after_action_id?: string;
  type:
    | 'show'
    | 'write'
    | 'highlight'
    | 'draw'
    | 'zoom'
    | 'pause'
    | 'clear'
    | 'camera_focus'
    | 'student_prompt';
  target_id?: string;
  text?: string;
  payload?: Record<string, unknown>;
  duration_sec?: number;
}

export interface SmartboardTimelineScene {
  id: string;
  script_moment_id?: string;
  title: string;
  visual_intent: string;
  camera_zone?: 'top-right' | 'bottom-right' | 'none';
  blocks: {
    id: string;
    type: 'title' | 'key-idea' | 'formula' | 'retain' | 'paragraph' | 'list' | 'diagram' | 'image';
    text?: string;
    items?: string[];
    asset_url?: string;
    layout?: Record<string, unknown>;
  }[];
  timeline: SmartboardTimelineAction[];
}

export interface SmartboardTimelinePivot {
  schema_version: 1;
  kind: 'smartboard_timeline';
  title: string;
  scenes: SmartboardTimelineScene[];
  meta?: {
    master_script_pivot_id?: string;
    generated_at: string;
    model?: string;
  };
}

/**
 * NIVEAU 2-E — LIVE SCENARIO. C'est la transformation d'un Master Script en
 * séance Liri pilotable : ordre des scènes, instructions hôte, interactions,
 * salle d'attente, clôture et sorties post-live.
 */
export interface LiveScenarioPivot {
  schema_version: 1;
  kind: 'live_scenario';
  live_title: string;
  preparation_notes: string[];
  waiting_room_message?: string;
  closing_sequence?: string;
  scenes: {
    id: string;
    order: number;
    type: 'intro' | 'teaching' | 'smartboard' | 'interaction' | 'qa' | 'summary' | 'closing';
    script_moment_id?: string;
    smartboard_scene_id?: string;
    host_instruction: string;
    student_action?: string;
    duration_minutes?: number;
  }[];
  replay_postprod_targets: RenderTarget[];
  meta?: {
    master_script_pivot_id?: string;
    smartboard_timeline_pivot_id?: string;
    live_session_id?: string;
    generated_at: string;
    model?: string;
  };
}

/**
 * NIVEAU 3 — REPLAY POST-PRODUCTION. Après un live réel, le replay redevient une
 * source Master Factory et propose des sorties : cours, résumé, quiz, vidéo de
 * la semaine, enrichissement précepteur, forum/FAQ.
 */
export interface ReplayPostprodPivot {
  schema_version: 1;
  kind: 'replay_postprod';
  live_session_id: string;
  replay_source_id?: string;
  summary: string;
  chapters: {
    title: string;
    start_sec?: number;
    end_sec?: number;
    key_points: string[];
    suggested_outputs?: RenderTarget[];
  }[];
  suggested_outputs: {
    target: RenderTarget;
    title: string;
    reason: string;
    priority?: 'low' | 'medium' | 'high';
  }[];
  meta?: {
    comprehension_pivot_id?: string;
    transcript_chars?: number;
    generated_at: string;
    model?: string;
  };
}

export type CoursePivotPayload =
  | Comprehension
  | CoursEcrit
  | CoursJoue
  | MasterScriptPivot
  | SmartboardTimelinePivot
  | LiveScenarioPivot
  | ReplayPostprodPivot;

export type RenderablePivotPayload = Exclude<CoursePivotPayload, Comprehension>;

/** Ligne de `course_pivots`. `payload` porte l'un des contrats ci-dessus. */
export interface CoursePivotRow {
  id: string;
  tenant_id: string;
  source_type: SourceType;
  source_id: string;
  kind: PivotKind;
  parent_id: string | null;
  payload: CoursePivotPayload;
  model: string | null;
  created_at: string;
  updated_at: string;
}

/** Adaptateur d'ENTRÉE : rend n'importe quelle source lisible par le noyau. */
export interface SourceAdapter {
  kind: SourceType;
  load(id: string, tenantId: string): Promise<NormalizedSource>;
}

/** Adaptateur de SORTIE : transforme un pivot en livrable. */
export interface RenderAdapter {
  key: RenderTarget;
  /** Forme attendue en entrée — un rendu « joué » ne sait pas lire un « écrit ». */
  accepts: Exclude<PivotKind, 'comprehension'>;
  render(
    pivot: RenderablePivotPayload,
    ctx: { tenantId: string; userId?: string; sourceTitle: string },
  ): Promise<{ ref?: string; url?: string }>;
}

/**
 * ⛔ Écarte les leçons dont les `notion_id` ne pointent AUCUNE notion réelle.
 * Sans ce filtre, le modèle « complète » le plan avec des leçons plausibles mais
 * absentes de la source. Repris du garde-fou de `transcript-course.service.ts`.
 */
export function dropOrphanLessons(
  comprehension: Comprehension,
  cours: CoursEcrit,
): { cours: CoursEcrit; dropped: number } {
  const known = new Set(comprehension.notions.map((n) => n.id));
  const kept = cours.lecons.filter((l) => known.has(l.notion_id));
  return { cours: { ...cours, lecons: kept }, dropped: cours.lecons.length - kept.length };
}
