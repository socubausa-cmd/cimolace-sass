import type {
  LessonTimestamp,
  MindMapNode,
  TranscriptLine,
} from '@/components/lesson-player/types';
import type { UnifiedPlayerData } from './types';

/** Ligne live_neuro_recall_state (colonnes réelles + colonnes migration). */
export interface NeuroRecallStateRow {
  live_session_id: string;
  replay_public_url?: string | null; // endpoint /lives/:id/replay/file
  workflow_status?: string | null;
  chapters?: unknown;                // jsonb, ajouté migration, défaut []
  transcript_text?: string | null;   // texte, ajouté migration
  replay_poster_url?: string | null; // clé/URL vignette
}

export interface ReplaySessionRow {
  id: string;
  title?: string | null;
  started_at?: string | null;
  cover_image_url?: string | null;
}

/** Caption live → offset vidéo (occurred_at - started_at). */
export interface LiveCaptionRow {
  translated_text?: string | null;
  source_text?: string | null;
  occurred_at?: string | null;
}

export interface FromReplayInput {
  session: ReplaySessionRow;
  state: NeuroRecallStateRow | null;
  /** Mindmap persistée (post-prod) ou éphémère (liri-mindmap-generate → nodes[0]). */
  mindmapRoot?: MindMapNode | null;
  /** Fallback transcript live si state.transcript_text absent. */
  captions?: LiveCaptionRow[];
  /** URL vignette prête (posterUrl résolu) ou cover_image_url en fallback. */
  posterUrl?: string | null;
  /** Endpoint presign explicite si state.replay_public_url absent. */
  replayFileUrl?: string;
}

function captionsToTranscript(
  captions: LiveCaptionRow[] | undefined,
  startedAt?: string | null,
): TranscriptLine[] {
  if (!Array.isArray(captions) || !startedAt) return [];
  const base = Date.parse(startedAt);
  if (!Number.isFinite(base)) return [];
  return captions
    .map((c) => {
      const t = c.occurred_at ? Date.parse(c.occurred_at) : NaN;
      const timeSeconds = Number.isFinite(t)
        ? Math.max(0, Math.round((t - base) / 1000))
        : undefined;
      return {
        text: String(c.translated_text || c.source_text || '').trim(),
        timeSeconds,
      };
    })
    .filter((l) => l.text)
    .sort((a, b) => (a.timeSeconds ?? 0) - (b.timeSeconds ?? 0));
}

function normalizeChapters(raw: unknown): {
  chapters: { label: string; timeSeconds: number }[];
  timestamps: LessonTimestamp[];
} {
  const arr = Array.isArray(raw) ? raw : [];
  const chapters = arr
    .map((c: any) => ({
      label: String(c?.label || '').trim(),
      timeSeconds: Number(c?.timeSeconds ?? c?.time_seconds ?? 0) || 0,
    }))
    .filter((c) => c.label)
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
  return {
    chapters,
    timestamps: chapters.map((c) => ({ label: c.label, timeSeconds: c.timeSeconds })),
  };
}

export function fromReplay(input: FromReplayInput): UnifiedPlayerData {
  const { session, state } = input;
  const { chapters, timestamps } = normalizeChapters(state?.chapters);

  const transcript: TranscriptLine[] = state?.transcript_text
    ? state.transcript_text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ text }))
    : captionsToTranscript(input.captions, session.started_at);

  const videoUrl =
    state?.replay_public_url ||
    input.replayFileUrl ||
    `${(import.meta as any).env?.VITE_API_URL ?? 'https://api.cimolace.space'}/lives/${session.id}/replay/file`;

  return {
    lessonId: session.id, // NotesPanel : notes replay indexées par live_session_id
    title: session.title || 'Replay du live',
    video: {
      url: videoUrl,
      posterUrl: input.posterUrl || session.cover_image_url || undefined,
      resolution: 'presign',
    },
    chapters,
    timestamps,
    transcript,
    mindmap: input.mindmapRoot || null,
    enableQuiz: Boolean(input.mindmapRoot),
    enableQuestion: true,
    notesScope: 'lesson',
    source: 'replay',
  };
}
