import { describe, expect, it } from 'vitest';
import {
  bridgeableSlideIndexCount,
  hasDuplicateChapterSlideTargets,
  resolveSlideIndexForChapter,
  resolveChapterIndexForSlide,
} from './chapterSlideMap';

describe('bridgeableSlideIndexCount', () => {
  it('returns min when both copilot and scenes exist', () => {
    expect(bridgeableSlideIndexCount(10, 3)).toBe(3);
    expect(bridgeableSlideIndexCount(2, 8)).toBe(2);
  });

  it('returns the non-zero count when only one side exists', () => {
    expect(bridgeableSlideIndexCount(5, 0)).toBe(5);
    expect(bridgeableSlideIndexCount(0, 4)).toBe(4);
  });

  it('returns at least 1', () => {
    expect(bridgeableSlideIndexCount(0, 0)).toBe(1);
  });
});

describe('hasDuplicateChapterSlideTargets', () => {
  it('detects duplicate mapped indices', () => {
    expect(hasDuplicateChapterSlideTargets([0, 1, 1])).toBe(true);
    expect(hasDuplicateChapterSlideTargets([0, 1, 2])).toBe(false);
  });

  it('handles edge cases', () => {
    expect(hasDuplicateChapterSlideTargets(null)).toBe(false);
    expect(hasDuplicateChapterSlideTargets([])).toBe(false);
    expect(hasDuplicateChapterSlideTargets([0])).toBe(false);
  });
});

describe('resolveSlideIndexForChapter', () => {
  it('uses chapterSlideMap when present', () => {
    expect(resolveSlideIndexForChapter(1, [0, 4, 2], 10, 3)).toBe(4);
  });

  it('falls back to chapter index capped by numSlides', () => {
    expect(resolveSlideIndexForChapter(2, [], 3, 5)).toBe(2);
    expect(resolveSlideIndexForChapter(5, [], 3, 10)).toBe(2);
  });
});

describe('resolveChapterIndexForSlide', () => {
  it('returns smallest chapter whose mapping equals slideIdx', () => {
    expect(resolveChapterIndexForSlide(2, [1, 2, 2], 4)).toBe(1);
  });

  it('falls back to slide index capped by chapters when no map match', () => {
    expect(resolveChapterIndexForSlide(0, [], 3)).toBe(0);
  });
});
