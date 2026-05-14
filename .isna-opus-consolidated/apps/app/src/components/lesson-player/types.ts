export type TimeString = string; // e.g. "0:12" or "2:10"

export type LessonTimestamp = {
  timeSeconds?: number;
  time?: TimeString;
  label: string;
};

export type TranscriptLine = {
  timeSeconds?: number;
  time?: TimeString;
  text: string;
};

export type MindMapNode = {
  id: string;
  label: string;
  timeSeconds?: number;
  time?: TimeString;
  summary?: string;
  explanation?: string;
  keyPoints?: string[];
  examples?: string[];
  children?: MindMapNode[];
};

export type LessonContentData = {
  videoUrl?: string;
  url?: string; // legacy
  storagePath?: string;
  type?: string;
  title?: string;
  timestamps?: LessonTimestamp[];
  transcript?: TranscriptLine[];
  mindmap?: MindMapNode;
};

export const parseTimeToSeconds = (value?: string | number | null): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const v = String(value).trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  const m = /^(\d+):(\d{1,2})$/.exec(v);
  if (!m) return null;
  const mm = Number(m[1]);
  const ss = Number(m[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss < 0 || ss >= 60) return null;
  return mm * 60 + ss;
};

export const tsToSeconds = (t?: { timeSeconds?: number; time?: string } | null): number | null => {
  if (!t) return null;
  if (t.timeSeconds != null && Number.isFinite(Number(t.timeSeconds))) return Number(t.timeSeconds);
  return parseTimeToSeconds(t.time);
};

export const formatTime = (seconds: number): string => {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
};
