/**
 * Client front — lecture d'une page IRI publiée pour le tenant courant.
 * Le tenant est résolu côté serveur via le Host ; aucun ID à passer.
 */

const PAGE_CACHE_MS = 30 * 1000;
const cache = new Map();

export async function fetchIriPage(slug, { forceRefresh = false } = {}) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return null;

  const now = Date.now();
  const prev = cache.get(key);
  if (!forceRefresh && prev && now - prev.at < PAGE_CACHE_MS) return prev.value;

  try {
    const headers = { Accept: 'application/json' };
    // Revalidation HTTP même avec forceRefresh (on ne court-circuite que le cache mémoire court).
    if (prev?.etag) {
      headers['If-None-Match'] = prev.etag;
    }
    const res = await fetch(
      `/.netlify/functions/iri-page?slug=${encodeURIComponent(key)}`,
      { method: 'GET', credentials: 'same-origin', headers },
    );
    if (res.status === 304 && prev?.value) {
      cache.set(key, { ...prev, at: now });
      return prev.value;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.ok) {
      cache.set(key, { value: null, at: now, etag: null });
      return null;
    }
    const etag = res.headers.get('etag') || res.headers.get('ETag') || null;
    const value = {
      page: body.page,
      blocks: Array.isArray(body.blocks) ? body.blocks : [],
      tenant: body.tenant || null,
    };
    cache.set(key, { value, at: now, etag });
    return value;
  } catch {
    cache.set(key, { value: null, at: now, etag: null });
    return null;
  }
}
