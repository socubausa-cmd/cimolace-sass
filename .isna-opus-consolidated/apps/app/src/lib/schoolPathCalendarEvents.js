/**
 * Construit les événements FullCalendar à partir de l’arbre parcours + date d’ancrage.
 * Convention : `starts_on` = date du lundi (jour day_number=1) de la toute première semaine.
 */

/** @param {Date | string} d */
export function toYmd(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(+x)) return null;
  return x.toISOString().slice(0, 10);
}

/** @param {string} ymd */
function parseYmd(ymd) {
  if (!ymd || typeof ymd !== 'string') return null;
  const [y, m, day] = ymd.split('-').map(Number);
  if (!y || !m || !day) return null;
  return new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
}

/** @param {Date} base @param {number} delta */
function addDaysUtc(base, delta) {
  const x = new Date(base);
  x.setUTCDate(x.getUTCDate() + delta);
  return x;
}

/**
 * @param {{ starts_on?: string | null }} path
 * @param {Array<{ id: string; title: string; course_modules?: unknown[] }>} courses
 * @returns {Array<{ id: string; title: string; start: string; allDay: boolean; extendedProps: Record<string, unknown> }>}
 */
export function buildSchoolPathCalendarEvents(path, courses) {
  const anchor = path?.starts_on ? parseYmd(path.starts_on) : null;
  if (!anchor) return [];

  let weekIndex = 0;
  const events = [];
  const list = Array.isArray(courses) ? courses : [];

  for (const course of list) {
    const modules = [...(course.course_modules || [])].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    for (const mod of modules) {
      const weeks = [...(mod.module_weeks || [])].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
      for (const week of weeks) {
        const days = [...(week.week_days || [])].sort(
          (a, b) =>
            (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
            (Number(a.day_number) || 0) - (Number(b.day_number) || 0),
        );
        for (const day of days) {
          const dn = Math.min(7, Math.max(1, Number(day.day_number) || 1));
          const offset = weekIndex * 7 + (dn - 1);
          const start = addDaysUtc(anchor, offset);
          const iso = toYmd(start);
          if (!iso) continue;
          events.push({
            id: String(day.id),
            title: `${course.title} · ${day.title || 'Jour'}`,
            start: iso,
            allDay: true,
            extendedProps: {
              courseId: course.id,
              moduleId: mod.id,
              weekId: week.id,
              dayId: day.id,
              pedagogyType: day.pedagogy_type,
              weekTitle: week.title,
              moduleTitle: mod.title,
            },
          });
        }
        weekIndex += 1;
      }
    }
  }

  return events;
}
