import { describe, it, expect, vi } from 'vitest';
import { parseLongiaDesignerCanvasActions } from './parseLongiaDesignerCanvasActions';
import { applyLongiaDesignerCanvasActions } from './applyLongiaDesignerCanvasActions';

const SAMPLE_IMAGE_URL = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&q=60';

describe('parseLongiaDesignerCanvasActions', () => {
  it('extrait add_image depuis le bloc longia_canvas_actions', () => {
    const raw = `Voici une image.\n\`\`\`longia_canvas_actions\n{"actions":[{"type":"add_image","url":"${SAMPLE_IMAGE_URL}","x":50,"y":60,"width":200,"height":120}]}\n\`\`\``;
    const { displayText, actions } = parseLongiaDesignerCanvasActions(raw);
    expect(displayText).toContain('Voici une image');
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('add_image');
    expect(actions[0].url).toContain('unsplash.com');
  });

  it('extrait add_image depuis un bloc ```json sans longia_canvas_actions', () => {
    const raw = `OK\n\`\`\`json\n{"actions":[{"type":"add_image","url":"${SAMPLE_IMAGE_URL}"}]}\n\`\`\``;
    const { actions } = parseLongiaDesignerCanvasActions(raw);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('add_image');
  });

  it('extrait un tableau brut [{ type: add_image }]', () => {
    const raw = `Texte\n[{"type":"add_image","url":"${SAMPLE_IMAGE_URL}","x":0,"y":0}]`;
    const { actions } = parseLongiaDesignerCanvasActions(raw);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('add_image');
  });
});

describe('applyLongiaDesignerCanvasActions — group_selected', () => {
  it('appelle groupSelected quand au moins 2 ids sélectionnés', () => {
    const groupSelected = vi.fn();
    const n = applyLongiaDesignerCanvasActions([{ type: 'group_selected' }], {
      addObject: vi.fn(),
      pushHistory: vi.fn(),
      setActiveSlideIndex: vi.fn(),
      slideCount: 1,
      selectedIds: ['a', 'b'],
      groupSelected,
      uniteSelected: vi.fn(),
    });
    expect(n).toBe(1);
    expect(groupSelected).toHaveBeenCalledTimes(1);
  });

  it('ignore group_selected si moins de 2 sélectionnés', () => {
    const groupSelected = vi.fn();
    const n = applyLongiaDesignerCanvasActions([{ type: 'group_selected' }], {
      addObject: vi.fn(),
      pushHistory: vi.fn(),
      setActiveSlideIndex: vi.fn(),
      slideCount: 1,
      selectedIds: ['a'],
      groupSelected,
    });
    expect(n).toBe(0);
    expect(groupSelected).not.toHaveBeenCalled();
  });
});

describe('applyLongiaDesignerCanvasActions — add_image', () => {
  it('crée un objet scène type image avec content.src = url https', () => {
    const added = [];
    const n = applyLongiaDesignerCanvasActions(
      [
        {
          type: 'add_image',
          url: SAMPLE_IMAGE_URL,
          x: 100,
          y: 120,
          width: 300,
          height: 200,
        },
      ],
      {
        addObject: (o) => added.push(o),
        pushHistory: vi.fn(),
        setActiveSlideIndex: vi.fn(),
        slideCount: 1,
      },
    );
    expect(n).toBe(1);
    expect(added).toHaveLength(1);
    expect(added[0].type).toBe('image');
    expect(added[0].content?.src).toBe(SAMPLE_IMAGE_URL);
    expect(added[0].x).toBe(100);
    expect(added[0].y).toBe(120);
    expect(added[0].width).toBe(300);
    expect(added[0].height).toBe(200);
  });

  it('ignore add_image sans url', () => {
    const added = [];
    const n = applyLongiaDesignerCanvasActions([{ type: 'add_image', url: '' }], {
      addObject: (o) => added.push(o),
      pushHistory: vi.fn(),
      setActiveSlideIndex: vi.fn(),
      slideCount: 1,
    });
    expect(n).toBe(0);
    expect(added).toHaveLength(0);
  });

  it('chaîne cercle + image comme un “ballon + photo”', () => {
    const added = [];
    applyLongiaDesignerCanvasActions(
      [
        { type: 'add_circle', x: 200, y: 200, radius: 40, fill: '#f00' },
        { type: 'add_image', url: SAMPLE_IMAGE_URL, x: 300, y: 100, width: 160, height: 100 },
      ],
      {
        addObject: (o) => added.push(o),
        pushHistory: vi.fn(),
        setActiveSlideIndex: vi.fn(),
        slideCount: 1,
      },
    );
    expect(added.map((o) => o.type)).toEqual(['circle', 'image']);
    expect(added[1].content?.src).toBe(SAMPLE_IMAGE_URL);
  });
});
