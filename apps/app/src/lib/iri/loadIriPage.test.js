import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchIriPage } from './loadIriPage.js';

describe('fetchIriPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns parsed payload on 200', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'W/"x-1"' },
      json: async () => ({
        ok: true,
        page: { id: 'p1', title: 'Accueil' },
        blocks: [{ id: 'b1', type: 'text', position: 0, config: { text: 'Hi' } }],
        tenant: { tenant_id: 't1', slug: 'cimolace' },
      }),
    });
    const out = await fetchIriPage('accueil', { forceRefresh: true });
    expect(out?.page?.title).toBe('Accueil');
    expect(out?.blocks).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalled();
    const call = globalThis.fetch.mock.calls[0];
    expect(call[0]).toContain('slug=accueil');
  });

  it('reuses cached body on 304', async () => {
    const payload = {
      ok: true,
      page: { id: 'p1', title: 'Cached' },
      blocks: [],
      tenant: null,
    };
    globalThis.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'W/"etag-abc"' },
        json: async () => payload,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 304,
        headers: { get: () => '' },
        json: async () => ({}),
      });

    const first = await fetchIriPage('x', { forceRefresh: true });
    expect(first?.page?.title).toBe('Cached');

    const second = await fetchIriPage('x', { forceRefresh: true });
    expect(second?.page?.title).toBe('Cached');

    const hdrs = globalThis.fetch.mock.calls[1][1].headers;
    expect(hdrs['If-None-Match']).toBe('W/"etag-abc"');
  });
});
