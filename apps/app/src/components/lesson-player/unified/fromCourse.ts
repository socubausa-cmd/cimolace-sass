import { tsToSeconds } from '@/components/lesson-player/types';
import type { LessonContentData } from '@/components/lesson-player/types';
import type { UnifiedPlayerData } from './types';

/**
 * Adapte une ligne formation_day_contents.data (LessonContentData) vers le type
 * normalisé. Reproduit la dérivation de LessonPlayerPage.tsx.
 */
export function fromCourse(
  contentId: string,
  data: LessonContentData,
  opts?: { enableQuiz?: boolean; enableQuestion?: boolean },
): UnifiedPlayerData {
  const timestamps = Array.isArray(data?.timestamps) ? data.timestamps : [];
  const chapters = timestamps
    .map((t) => ({
      label: String(t.label || '').trim(),
      timeSeconds: tsToSeconds(t) ?? 0,
    }))
    .filter((t) => t.label)
    .sort((a, b) => a.timeSeconds - b.timeSeconds);

  return {
    lessonId: contentId,
    title: data?.title || 'Leçon',
    video: {
      url: (data.videoUrl || data.url || '') as string,
      storagePath: data.storagePath,
      type: data.type,
      posterUrl: (data as any).posterUrl, // toléré si présent dans data
      resolution: 'direct',
    },
    chapters,
    timestamps,
    transcript: Array.isArray(data?.transcript) ? data.transcript : [],
    mindmap: (data?.mindmap as any) || null,
    enableQuiz: Boolean(opts?.enableQuiz),
    enableQuestion: Boolean(opts?.enableQuestion),
    notesScope: 'lesson',
    source: 'course',
  };
}
