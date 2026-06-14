import { formatSecondsToTimeText, parseTimestampToSeconds } from '@/components/school/course-builder/segmentUtils';
import { applySegmentsFromNleV1Clips } from './applySegmentsFromNleV1Clips.js';

/**
 * Applique le même recalage que l'export FFmpeg aux lignes chapitre (IN/OUT texte) pour la preview.
 * @param {Array<{ startText?: string, endText?: string, label?: string }>} chapters
 * @param {unknown} nleProject
 * @returns {typeof chapters}
 */
export function applyNleProjectToChapterRows(chapters, nleProject) {
  if (!Array.isArray(chapters) || chapters.length === 0) return chapters;
  if (!nleProject || typeof nleProject !== 'object') return chapters;

  const segments = chapters.map((c, idx) => ({
    index: idx,
    startSeconds: parseTimestampToSeconds(c?.startText),
    endSeconds: parseTimestampToSeconds(c?.endText),
    label: c?.label,
  }));

  const applied = applySegmentsFromNleV1Clips(segments, nleProject);

  return chapters.map((c, i) => {
    const row = applied[i];
    if (
      !row ||
      !Number.isFinite(row.startSeconds) ||
      !Number.isFinite(row.endSeconds) ||
      row.endSeconds <= row.startSeconds
    ) {
      return c;
    }
    return {
      ...c,
      startText: formatSecondsToTimeText(row.startSeconds),
      endText: formatSecondsToTimeText(row.endSeconds),
    };
  });
}
