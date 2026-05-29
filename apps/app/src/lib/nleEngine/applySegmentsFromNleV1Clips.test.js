import { describe, it, expect } from 'vitest';
import { applySegmentsFromNleV1Clips } from './applySegmentsFromNleV1Clips.js';

describe('applySegmentsFromNleV1Clips', () => {
  const v1 = (clips) => ({
    version: 1,
    tracks: [
      {
        id: 'v1',
        type: 'video',
        clips,
      },
    ],
  });

  it('zippe N clips et N segments par ordre timeline', () => {
    const segments = [
      { index: 0, startSeconds: 0, endSeconds: 10, label: 'A' },
      { index: 1, startSeconds: 10, endSeconds: 20, label: 'B' },
    ];
    const nle = v1([
      {
        id: 'a',
        sourceType: 'primary_video',
        startOnTimeline: 100,
        duration: 5,
        trimIn: 0,
        trimOut: 10,
      },
      {
        id: 'b',
        sourceType: 'primary_video',
        startOnTimeline: 200,
        duration: 3,
        trimIn: 0,
        trimOut: 10,
      },
    ]);
    const out = applySegmentsFromNleV1Clips(segments, nle);
    expect(out[0].startSeconds).toBe(100);
    expect(out[0].endSeconds).toBe(105);
    expect(out[1].startSeconds).toBe(200);
    expect(out[1].endSeconds).toBe(203);
  });

  it('mappe un seul clip primary sur plusieurs segments', () => {
    const segments = [
      { index: 0, startSeconds: 0, endSeconds: 50, label: 'A' },
      { index: 1, startSeconds: 50, endSeconds: 100, label: 'B' },
    ];
    const nle = v1([
      {
        id: 'one',
        sourceType: 'primary_video',
        startOnTimeline: 10,
        duration: 20,
        trimIn: 0,
        trimOut: 100,
      },
    ]);
    const out = applySegmentsFromNleV1Clips(segments, nle);
    expect(out[0].startSeconds).toBeCloseTo(10, 5);
    expect(out[0].endSeconds).toBeCloseTo(20, 5);
    expect(out[1].startSeconds).toBeCloseTo(20, 5);
    expect(out[1].endSeconds).toBeCloseTo(30, 5);
  });

  it('laisse les segments inchangés si pas de correspondance NLE', () => {
    const segments = [{ index: 0, startSeconds: 1, endSeconds: 2, label: 'A' }];
    const nle = v1([]);
    expect(applySegmentsFromNleV1Clips(segments, nle)).toEqual(segments);
  });
});
