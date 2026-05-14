/**
 * Aligné sur `netlify/functions/_lib/nleProjectToFfmpeg.js` — une seule source de vérité côté app
 * (preview) et worker (export).
 */

/**
 * @param {Array<{ index: number, startSeconds: number|null, endSeconds: number|null, label?: string }>} segments
 * @param {unknown} nleProject
 * @returns {typeof segments}
 */
export function applySegmentsFromNleV1Clips(segments, nleProject) {
  if (!Array.isArray(segments) || segments.length === 0) return segments;
  if (!nleProject || typeof nleProject !== 'object') return segments;

  const tracks = /** @type {Record<string, unknown>} */ (nleProject).tracks;
  if (!Array.isArray(tracks)) return segments;

  const v1 = tracks.find((t) => t && typeof t === 'object' && /** @type {Record<string, unknown>} */ (t).id === 'v1');
  if (!v1 || typeof v1 !== 'object') return segments;

  const clips = /** @type {Record<string, unknown>} */ (v1).clips;
  if (!Array.isArray(clips) || clips.length === 0) return segments;

  const primary = clips.filter((c) => {
    if (!c || typeof c !== 'object') return false;
    const st = String(/** @type {Record<string, unknown>} */ (c).sourceType || 'primary_video');
    return st === 'primary_video';
  });

  if (primary.length === segments.length) {
    const sortedSeg = [...segments].sort((a, b) => {
      const as = Number(a.startSeconds) || 0;
      const bs = Number(b.startSeconds) || 0;
      return as - bs;
    });

    const sortedClips = [...primary].sort((a, b) => {
      const at = Number(/** @type {Record<string, unknown>} */ (a).startOnTimeline) || 0;
      const bt = Number(/** @type {Record<string, unknown>} */ (b).startOnTimeline) || 0;
      return at - bt;
    });

    /** @type {Map<number, { startSeconds: number, endSeconds: number }>} */
    const indexToTimes = new Map();
    for (let k = 0; k < sortedSeg.length; k++) {
      const seg = sortedSeg[k];
      const clip = sortedClips[k];
      const start = Number(/** @type {Record<string, unknown>} */ (clip).startOnTimeline);
      const dur = Number(/** @type {Record<string, unknown>} */ (clip).duration);
      if (!Number.isFinite(start) || !Number.isFinite(dur) || dur <= 0.05) continue;
      const end = start + dur;
      if (end <= start) continue;
      indexToTimes.set(seg.index, { startSeconds: start, endSeconds: end });
    }

    if (indexToTimes.size !== segments.length) return segments;

    return segments.map((s) => {
      const t = indexToTimes.get(s.index);
      if (!t) return s;
      return {
        ...s,
        startSeconds: t.startSeconds,
        endSeconds: t.endSeconds,
      };
    });
  }

  if (primary.length === 1) {
    const clip = /** @type {Record<string, unknown>} */ (primary[0]);
    const trimIn = Number(clip.trimIn);
    let trimOut = Number(clip.trimOut);
    const tl0 = Number(clip.startOnTimeline) || 0;
    const tlDur = Number(clip.duration);
    if (!Number.isFinite(trimIn) || !Number.isFinite(tlDur) || tlDur <= 0.05) return segments;
    if (!Number.isFinite(trimOut) || trimOut <= trimIn + 0.02) {
      const maxSeg = segments.reduce((m, s) => Math.max(m, Number(s.endSeconds) || 0), trimIn + 0.1);
      trimOut = Math.max(trimIn + 0.1, maxSeg);
    }
    const span = trimOut - trimIn;
    if (!Number.isFinite(span) || span <= 0.02) return segments;

    return segments.map((s) => {
      const rawS = Number(s.startSeconds);
      const rawE = Number(s.endSeconds);
      if (!Number.isFinite(rawS) || !Number.isFinite(rawE)) return s;
      const sClamped = Math.min(trimOut, Math.max(trimIn, rawS));
      const eClamped = Math.min(trimOut, Math.max(trimIn, rawE));
      const t0 = tl0 + ((sClamped - trimIn) / span) * tlDur;
      const t1 = tl0 + ((eClamped - trimIn) / span) * tlDur;
      return {
        ...s,
        startSeconds: Math.min(t0, t1),
        endSeconds: Math.max(t0, t1),
      };
    });
  }

  return segments;
}
