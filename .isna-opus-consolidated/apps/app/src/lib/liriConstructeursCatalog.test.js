import { describe, expect, it } from 'vitest';
import {
  CONSTRUCTEURS_CATALOG,
  CONSTRUCTEURS_BY_FAMILY,
  CONSTRUCTEUR_PIPELINE_STEPS,
  DESIGNER_HREF,
  getConstructeurById,
} from './liriConstructeursCatalog';

describe('liriConstructeursCatalog', () => {
  it('has unique ids and hrefs', () => {
    const ids = CONSTRUCTEURS_CATALOG.map((c) => c.id);
    const hrefs = CONSTRUCTEURS_CATALOG.map((c) => c.href);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('has expected LIRI entries including Agent', () => {
    const liri = CONSTRUCTEURS_BY_FAMILY.liri;
    expect(liri.map((c) => c.id)).toEqual([
      'liri-formation',
      'liri-cours',
      'liri-agent',
      'liri-pedagogie-futur',
    ]);
    const agent = getConstructeurById('liri-agent');
    expect(agent?.href).toBe('/studio/liri-agent');
    expect(agent?.external).toBe(true);
  });

  it('resolves getConstructeurById', () => {
    expect(getConstructeurById('nope')).toBeUndefined();
    expect(getConstructeurById('liri-cours')?.kind).toBe('cours');
  });

  it('exports pipeline and designer path', () => {
    expect(DESIGNER_HREF).toMatch(/^\/studio\//);
    expect(CONSTRUCTEUR_PIPELINE_STEPS).toHaveLength(4);
    expect(CONSTRUCTEUR_PIPELINE_STEPS[2].title).toContain('SmartBoard');
  });
});
