import { describe, expect, it } from 'vitest';
import { mapPoint, mapperForObjectContain, DEFAULT_MAPPER } from './mapper.js';

describe('mapperForObjectContain', () => {
  it('letterboxes when aspect ratios differ', () => {
    const m = mapperForObjectContain(1000, 500, 400, 300);
    expect(m.scaleX).toBeCloseTo(0.4, 5);
    expect(m.scaleY).toBeCloseTo(0.4, 5);
    expect(m.offsetX).toBe(0);
    expect(m.offsetY).toBeCloseTo(50, 5);
  });

  it('returns default when dimensions missing', () => {
    expect(mapperForObjectContain(0, 600, 400, 300)).toEqual(DEFAULT_MAPPER);
  });
});

describe('mapPoint', () => {
  it('applies offset and scale', () => {
    const m = { offsetX: 10, offsetY: 20, scaleX: 2, scaleY: 2 };
    expect(mapPoint(14, 24, m)).toEqual({ x: 2, y: 2 });
  });
});
