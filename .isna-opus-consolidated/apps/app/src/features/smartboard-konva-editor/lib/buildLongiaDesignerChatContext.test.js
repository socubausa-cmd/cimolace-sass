import { describe, it, expect } from 'vitest';
import { buildLongiaDesignerChatContext } from './buildLongiaDesignerChatContext.js';
import { createEmptyProject } from '../model/sceneModel.js';

describe('buildLongiaDesignerChatContext', () => {
  it('expose workbench.interactionTool et workbench.regionMarquee', () => {
    const project = createEmptyProject();
    const activeScene = project.scenes[0];
    const ctx = buildLongiaDesignerChatContext({
      project,
      activeScene,
      course: null,
      activeSlideIndex: 0,
      selectedIds: [],
      interactionTool: 'marquee-rect',
      regionMarquee: { kind: 'rect', x: 10, y: 20, width: 100, height: 50 },
    });
    expect(ctx.workbench.interactionTool).toBe('marquee-rect');
    expect(ctx.workbench.regionMarquee).toEqual({
      kind: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });

  it('normalise interactionTool inconnu vers pointer', () => {
    const project = createEmptyProject();
    const ctx = buildLongiaDesignerChatContext({
      project,
      activeScene: project.scenes[0],
      course: null,
      activeSlideIndex: 0,
      selectedIds: [],
      interactionTool: '',
      regionMarquee: null,
    });
    expect(ctx.workbench.interactionTool).toBe('pointer');
    expect(ctx.workbench.regionMarquee).toBeNull();
  });

  it('inclut points relatifs pour regionMarquee lasso', () => {
    const project = createEmptyProject();
    const ctx = buildLongiaDesignerChatContext({
      project,
      activeScene: project.scenes[0],
      course: null,
      activeSlideIndex: 0,
      selectedIds: [],
      interactionTool: 'marquee-lasso',
      regionMarquee: {
        kind: 'lasso',
        x: 100,
        y: 200,
        width: 50,
        height: 40,
        points: [
          { x: 100, y: 200 },
          { x: 150, y: 200 },
          { x: 125, y: 240 },
        ],
      },
    });
    expect(ctx.workbench.regionMarquee.kind).toBe('lasso');
    expect(ctx.workbench.regionMarquee.points).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 40 },
    ]);
  });

  it('rejette regionMarquee sans x/y finis', () => {
    const project = createEmptyProject();
    const ctx = buildLongiaDesignerChatContext({
      project,
      activeScene: project.scenes[0],
      course: null,
      activeSlideIndex: 0,
      selectedIds: [],
      regionMarquee: { kind: 'rect', width: 10, height: 10 },
    });
    expect(ctx.workbench.regionMarquee).toBeNull();
  });

  it('rejette regionMarquee sans width/height finis', () => {
    const project = createEmptyProject();
    const ctx = buildLongiaDesignerChatContext({
      project,
      activeScene: project.scenes[0],
      course: null,
      activeSlideIndex: 0,
      selectedIds: [],
      regionMarquee: { kind: 'rect', x: 0, y: 0 },
    });
    expect(ctx.workbench.regionMarquee).toBeNull();
  });
});
