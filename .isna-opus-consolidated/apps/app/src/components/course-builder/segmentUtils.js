export const parseTimestampToSeconds = (value) => {
  const v = String(value || '').trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const m = /^(\d+):(\d{1,2})$/.exec(v);
  if (m) {
    const mm = Number(m[1]);
    const ss = Number(m[2]);
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || mm < 0 || ss < 0 || ss >= 60) return null;
    return mm * 60 + ss;
  }
  return null;
};

export const formatSecondsToTimeText = (seconds) => {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
};

export const getActiveSegmentIndex = (segments, currentSeconds) => {
  const t = Number(currentSeconds);
  if (!Number.isFinite(t) || t < 0) return null;
  const rows = (segments || [])
    .map((segment, index) => {
      const start = parseTimestampToSeconds(segment?.startText);
      const end = parseTimestampToSeconds(segment?.endText);
      return {
        index,
        start: Number.isFinite(start) ? start : null,
        end: Number.isFinite(end) ? end : null,
      };
    })
    .filter((segment) => segment.start != null)
    .sort((a, b) => a.start - b.start);

  if (rows.length === 0) return null;

  for (let i = 0; i < rows.length; i += 1) {
    const current = rows[i];
    const next = rows[i + 1];
    const effectiveEnd = current.end != null ? current.end : (next?.start != null ? next.start : Number.POSITIVE_INFINITY);
    if (t >= current.start && t < effectiveEnd) return current.index;
  }
  return rows[rows.length - 1].index;
};
