import { describe, expect, it } from 'vitest';
import {
  normalizeArchitectItems,
  parseJsonFromText,
  validateParsedRoot,
} from './architectStructuredValidate.ts';

describe('architectStructuredValidate', () => {
  it('parseJsonFromText extrait le premier objet JSON', () => {
    expect(parseJsonFromText('prefix {"items":[]} suffix')).toEqual({ items: [] });
    expect(parseJsonFromText('{"items":[{"id":"a","title":"Ab","detail":"Cd ef","kind":"layout"}]}'))
      .toMatchObject({ items: expect.any(Array) });
  });

  it('validateParsedRoot rejette racine invalide', () => {
    expect(validateParsedRoot(null)?.code).toBe('JSON_PARSE_FAILED');
    expect(validateParsedRoot([])?.code).toBe('ROOT_NOT_OBJECT');
    expect(validateParsedRoot({})?.code).toBe('MODEL_OUTPUT_INVALID');
    expect(validateParsedRoot({ items: 'nope' })?.code).toBe('ITEMS_NOT_ARRAY');
    expect(validateParsedRoot({ items: [] })).toBeNull();
  });

  it('normalizeArchitectItems filtre et borne les entrées', () => {
    const items = normalizeArchitectItems({
      items: [
        { id: '1', title: 'Ok', detail: 'Assez long', kind: 'visual' },
        { title: 'x', detail: 'short' },
        { title: 'Bad kind', detail: 'Valid detail here', kind: 'unknown' },
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe('visual');
    expect(items[1].kind).toBe('layout');
  });
});
