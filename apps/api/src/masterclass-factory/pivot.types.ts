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

export type SourceType = 'replay' | 'tiktok' | 'document' | 'texte';
export type PivotKind = 'comprehension' | 'ecrit' | 'joue';
export type RenderTarget = 'pdf' | 'parcours' | 'masterclass' | 'precepteur' | 'smartboard';

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
  definition: string;
  schema?: Record<string, unknown>;
  exemple: { titre: string; deroule: string };
  contre_exemple: { titre: string; pourquoi_faux: string };
  erreur_frequente: string;
  experience_pensee: string;
  mise_en_situation: string;
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

/** Ligne de `course_pivots`. `payload` porte l'un des trois contrats ci-dessus. */
export interface CoursePivotRow {
  id: string;
  tenant_id: string;
  source_type: SourceType;
  source_id: string;
  kind: PivotKind;
  parent_id: string | null;
  payload: Comprehension | CoursEcrit | CoursJoue;
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
    pivot: CoursEcrit | CoursJoue,
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
