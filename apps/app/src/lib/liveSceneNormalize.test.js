import { describe, expect, it } from 'vitest';
import {
  buildLiveScenesFromUploadedSlides,
  parsePayload,
  normalizeLiveSceneToSlide,
} from './liveSceneNormalize';

describe('buildLiveScenesFromUploadedSlides', () => {
  it('returns empty array for invalid input', () => {
    expect(buildLiveScenesFromUploadedSlides(null)).toEqual([]);
    expect(buildLiveScenesFromUploadedSlides([])).toEqual([]);
  });

  it('maps url and label to a scene with image element', () => {
    const out = buildLiveScenesFromUploadedSlides([{ url: 'https://x.test/a.png', label: 'Intro' }]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Intro');
    const els = out[0].content_payload_json.elements;
    const img = els.find((e) => e.type === 'image');
    expect(img?.src).toBe('https://x.test/a.png');
  });

  it('maps PDF uploads to a document scene', () => {
    const out = buildLiveScenesFromUploadedSlides([
      { url: 'https://cdn.test/doc.pdf', label: 'Cours', kind: 'pdf' },
    ]);
    expect(out[0].content_payload_json.elements.some((e) => e.type === 'document' && e.documentKind === 'pdf')).toBe(true);
  });

  it('maps PowerPoint uploads to office document scene', () => {
    const out = buildLiveScenesFromUploadedSlides([
      { url: 'https://cdn.test/slides.pptx', label: 'Deck', kind: 'office' },
    ]);
    const doc = out[0].content_payload_json.elements.find((e) => e.type === 'document');
    expect(doc?.documentKind).toBe('office');
  });
});

describe('parsePayload', () => {
  it('parses JSON string', () => {
    expect(parsePayload('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns empty object on invalid JSON string', () => {
    expect(parsePayload('{bad')).toEqual({});
  });
});

describe('normalizeLiveSceneToSlide', () => {
  it('normalizes ia_data at scene root', () => {
    const slide = normalizeLiveSceneToSlide({
      id: 's1',
      name: 'Titre scène',
      ia_data: { title: 'IA Title', core_idea: 'X' },
    });
    expect(slide?.ia_data?.title).toBe('IA Title');
    expect(slide?.title).toBe('Titre scène');
  });

  it('copies image url from url field on element', () => {
    const slide = normalizeLiveSceneToSlide({
      id: 's2',
      name: 'Img',
      content_payload_json: {
        elements: [{ type: 'image', url: 'https://cdn.example/z.jpg' }],
      },
    });
    const img = slide?.elements?.find((e) => e.type === 'image');
    expect(img?.src).toBe('https://cdn.example/z.jpg');
  });

  it('normalizes document elements with src', () => {
    const slide = normalizeLiveSceneToSlide({
      id: 's3',
      name: 'PDF',
      content_payload_json: {
        elements: [{ type: 'document', url: 'https://cdn.example/a.pdf', documentKind: 'pdf' }],
      },
    });
    const doc = slide?.elements?.find((e) => e.type === 'document');
    expect(doc?.src).toBe('https://cdn.example/a.pdf');
    expect(doc?.documentKind).toBe('pdf');
  });
});
