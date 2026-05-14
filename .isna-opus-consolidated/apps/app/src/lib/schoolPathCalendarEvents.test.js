import { describe, expect, it } from 'vitest';
import { buildSchoolPathCalendarEvents } from '@/lib/schoolPathCalendarEvents';

describe('buildSchoolPathCalendarEvents', () => {
  it('returns empty when no anchor date', () => {
    expect(buildSchoolPathCalendarEvents({}, [])).toEqual([]);
    expect(buildSchoolPathCalendarEvents({ starts_on: null }, [{ id: 'c1', title: 'C', course_modules: [] }])).toEqual([]);
  });

  it('maps week_days to consecutive calendar days from Monday anchor', () => {
    const path = { starts_on: '2026-01-05' };
    const courses = [
      {
        id: 'c1',
        title: 'Physique',
        course_modules: [
          {
            id: 'm1',
            title: 'Mod 1',
            sort_order: 0,
            module_weeks: [
              {
                id: 'w1',
                title: 'S1',
                sort_order: 0,
                week_days: [
                  { id: 'd1', day_number: 1, title: 'Lundi intro', sort_order: 0 },
                  { id: 'd2', day_number: 3, title: 'Mercredi pratique', sort_order: 1 },
                ],
              },
            ],
          },
        ],
      },
    ];
    const ev = buildSchoolPathCalendarEvents(path, courses);
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ id: 'd1', start: '2026-01-05', allDay: true });
    expect(ev[1]).toMatchObject({ id: 'd2', start: '2026-01-07', allDay: true });
    expect(ev[0].title).toContain('Physique');
  });

  it('increments week index across weeks so next week starts +7 days', () => {
    const path = { starts_on: '2026-01-05' };
    const courses = [
      {
        id: 'c1',
        title: 'C',
        course_modules: [
          {
            id: 'm1',
            sort_order: 0,
            module_weeks: [
              {
                id: 'w1',
                sort_order: 0,
                week_days: [{ id: 'a', day_number: 1, title: 'W1D1', sort_order: 0 }],
              },
              {
                id: 'w2',
                sort_order: 1,
                week_days: [{ id: 'b', day_number: 1, title: 'W2D1', sort_order: 0 }],
              },
            ],
          },
        ],
      },
    ];
    const ev = buildSchoolPathCalendarEvents(path, courses);
    expect(ev).toHaveLength(2);
    expect(ev[0].start).toBe('2026-01-05');
    expect(ev[1].start).toBe('2026-01-12');
  });
});
