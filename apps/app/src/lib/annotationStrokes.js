/**
 * Limite la charge réseau des annotations live (broadcast Supabase).
 */
export const ANNOTATION_BROADCAST_MAX_STROKES = 160;

/**
 * @returns {{ strokes: unknown[], truncated: boolean, removed: number }}
 */
export function sanitizeAnnotationStrokesForBroadcast(
  strokes,
  { maxStrokes = ANNOTATION_BROADCAST_MAX_STROKES } = {},
) {
  if (!Array.isArray(strokes) || strokes.length === 0) {
    return { strokes: [], truncated: false, removed: 0 };
  }
  if (strokes.length <= maxStrokes) {
    return { strokes, truncated: false, removed: 0 };
  }
  const removed = strokes.length - maxStrokes;
  return {
    strokes: strokes.slice(-maxStrokes),
    truncated: true,
    removed,
  };
}
