/**
 * Durées par slide (Module 6) — minutes, alignées sur `course.slides`.
 */

/**
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse | null} course
 * @returns {number[]}
 */
export function buildDefaultSlideTimingMinutes(course) {
  const n = course?.slides?.length ?? 0;
  if (!n) return [];
  return Array.from({ length: n }, () => 5);
}

/**
 * @param {unknown} raw
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse | null} course
 * @returns {number[]}
 */
export function mergeSlideTimingFromExport(raw, course) {
  const n = course?.slides?.length ?? 0;
  if (!n) return [];
  const base = Array.isArray(raw)
    ? raw.map((x) => {
        const v = Number(x);
        return Number.isFinite(v) && v > 0 ? Math.min(480, v) : 5;
      })
    : [];
  const out = base.slice(0, n);
  while (out.length < n) out.push(5);
  return out;
}

/** @param {unknown} minutes */
export function sumSlideTimingMinutes(minutes) {
  if (!Array.isArray(minutes)) return 0;
  return minutes.reduce((acc, x) => {
    const v = Number(x);
    return acc + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);
}
