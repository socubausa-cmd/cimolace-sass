import { describe, expect, it } from 'vitest';
import { buildAiHubSuggestions } from './buildAiHubSuggestions.js';
import {
  buildLongiaHubCoachFeed,
  buildLongiaStudioContext,
  computeLongiaClarityScore,
  longiaObjectTypeHistogram,
} from './buildLongiaStudioContext.js';

describe('longiaObjectTypeHistogram', () => {
  it('returns empty object for missing input', () => {
    expect(longiaObjectTypeHistogram(undefined)).toEqual({});
    expect(longiaObjectTypeHistogram([])).toEqual({});
  });

  it('counts types', () => {
    expect(
      longiaObjectTypeHistogram([
        { type: 'text' },
        { type: 'text' },
        { type: 'image' },
        {},
      ]),
    ).toEqual({ text: 2, image: 1, unknown: 1 });
  });
});

describe('buildLongiaStudioContext', () => {
  it('maps course, active slide, and selection previews', () => {
    const ctx = buildLongiaStudioContext({
      scenes: [
        {
          id: 's1',
          name: 'Intro',
          objects: [
            { id: 'a', type: 'text', content: { text: 'Hello world here' } },
            { id: 'b', type: 'rect' },
          ],
        },
      ],
      activeSceneId: 's1',
      selectedIds: ['a'],
      activeSlideIndex: 1,
      course: {
        title: 'Mon cours',
        description: 'Desc',
        slides: [
          { title: 'S0', type: 'intro', objective: '' },
          { title: 'S1', type: 'content', objective: 'Comprendre X' },
        ],
        chapters: [{ title: 'Ch1' }],
        analysis: { mainTopic: 'Physique', complexity: 'intermediaire' },
      },
    });
    expect(ctx.course.slideCount).toBe(2);
    expect(ctx.course.activeSlideIndex).toBe(1);
    expect(ctx.course.activeSlideTitle).toBe('S1');
    expect(ctx.course.activeSlideObjective).toBe('Comprendre X');
    expect(ctx.activeScene.types).toEqual({ text: 1, rect: 1 });
    expect(ctx.selection.count).toBe(1);
    expect(ctx.selection.items[0]).toMatchObject({ type: 'text' });
    expect(ctx.selection.items[0].textPreview).toContain('Hello');
  });

  it('includes lastRouting and documentCoach when set', () => {
    const ctx = buildLongiaStudioContext({
      scenes: [{ id: 'x', name: 'A', objects: [] }],
      activeSceneId: 'x',
      lastRouting: {
        requestedMode: 'architect',
        effectiveMode: 'coach',
        routingReason: 'fallback',
      },
      documentCoach: { isDocumentMode: true, phase: 'editing' },
    });
    expect(ctx.lastRouting).toMatchObject({
      requestedMode: 'architect',
      effectiveMode: 'coach',
    });
    expect(ctx.documentCoach).toEqual({ phase: 'editing' });
  });

  it('includes appContext for LONGIA Pro when embedded control is active', () => {
    const ctx = buildLongiaStudioContext({
      scenes: [{ id: 'x', name: 'A', objects: [] }],
      activeSceneId: 'x',
      appContext: { embeddedControlActive: true, appName: 'Microsoft Word' },
    });
    expect(ctx.appContext).toEqual({
      embeddedControlActive: true,
      appName: 'Microsoft Word',
    });
  });

  it('omits appContext when embeddedControlActive is false', () => {
    const ctx = buildLongiaStudioContext({
      scenes: [{ id: 'x', name: 'A', objects: [] }],
      activeSceneId: 'x',
      appContext: { embeddedControlActive: false, appName: 'X' },
    });
    expect(ctx.appContext).toBeUndefined();
  });
});

describe('buildLongiaHubCoachFeed', () => {
  it('mentions empty scene', () => {
    const feed = buildLongiaHubCoachFeed({
      scene: { name: 'Test', objects: [] },
      course: null,
      activeSceneIndex: 0,
      selectedIds: [],
    });
    expect(feed.some((m) => m.text.includes('vide'))).toBe(true);
  });
});

describe('computeLongiaClarityScore', () => {
  it('returns a bounded score', () => {
    const s = computeLongiaClarityScore({
      scene: { objects: [{ type: 'text' }] },
      course: { title: 'T', slides: [{ objective: 'Oui' }] },
      activeSceneIndex: 0,
    });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(96);
  });
});

describe('buildAiHubSuggestions', () => {
  it('adds routing note when modes differ', () => {
    const list = buildAiHubSuggestions({
      selectedIds: [],
      objectTypes: [],
      sceneObjectCount: 0,
      lastRouting: {
        requestedMode: 'architect',
        effectiveMode: 'coach',
        routingReason: 'quota',
      },
    });
    expect(list.some((s) => s.id === 'sug_routing_note')).toBe(true);
  });

  it('nudges missing slide objective when plan has slides', () => {
    const list = buildAiHubSuggestions({
      selectedIds: [],
      objectTypes: [],
      sceneObjectCount: 0,
      slideCount: 1,
      activeSlideIndex: 0,
      activeSlideObjective: '  ',
    });
    expect(list.some((s) => s.id === 'sug_slide_objective')).toBe(true);
  });

  it('detects image-heavy scene without text', () => {
    const list = buildAiHubSuggestions({
      selectedIds: [],
      objectTypes: [],
      sceneObjectCount: 2,
      sceneObjects: [{ type: 'image' }, { type: 'image' }],
    });
    expect(list.some((s) => s.id === 'sug_visual_labels')).toBe(true);
  });
});
