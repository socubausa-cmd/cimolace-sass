import { describe, expect, it } from 'vitest';
import { nextSortOrder, nextDayNumber, WEEKDAY_GRID_LABELS } from './schoolPathPedagogyConstants';

describe('schoolPathPedagogyConstants', () => {
  it('nextSortOrder', () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([{ sort_order: 0 }, { sort_order: 2 }])).toBe(3);
  });

  it('nextDayNumber', () => {
    expect(nextDayNumber([])).toBe(1);
    expect(nextDayNumber([{ day_number: 1 }, { day_number: 3 }])).toBe(4);
  });

  it('WEEKDAY_GRID_LABELS', () => {
    expect(WEEKDAY_GRID_LABELS).toHaveLength(7);
    expect(WEEKDAY_GRID_LABELS[0].n).toBe(1);
  });
});
