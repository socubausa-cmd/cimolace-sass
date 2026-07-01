import type {
  LessonTimestamp,
  TranscriptLine,
  MindMapNode,
} from '@/components/lesson-player/types';

/**
 * Comment résoudre l'URL jouable :
 * - 'direct'   : `video.url` (+ storagePath signé bucket 'videos') → chemin cours.
 * - 'presign'  : `video.url` est un endpoint /lives/:id/replay/file → fetch Bearer
 *                puis <video src={url}> (pattern MessagingPage.ReplayPlayer).
 */
export type UnifiedVideoResolution = 'direct' | 'presign';

export interface UnifiedPlayerData {
  /** Identifiant stable servant de lessonId à NotesPanel (RLS lesson_notes). */
  lessonId: string;
  title: string;

  video: {
    url?: string;
    storagePath?: string;
    type?: string;
    posterUrl?: string; // vignette (poster frame)
    resolution: UnifiedVideoResolution;
  };

  /** Chapitres normalisés {label, timeSeconds}. */
  chapters: { label: string; timeSeconds: number }[];
  /** Forme brute attendue par ChapterList (accepte time|timeSeconds). */
  timestamps: LessonTimestamp[];
  transcript: TranscriptLine[];
  mindmap: MindMapNode | null;

  /** Active les onglets Quiz/Question. */
  enableQuiz: boolean;
  enableQuestion: boolean;

  /** Notes : où lire/écrire. 'lesson' = table lesson_notes (RLS user+lesson). */
  notesScope: 'lesson' | 'none';

  /** Métadonnée d'origine, utile au wiring forum / debug. */
  source: 'course' | 'replay';
}
