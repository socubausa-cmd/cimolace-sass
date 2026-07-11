/**
 * Client front — lecture d'une page IRI PUBLIÉE pour le tenant courant.
 * Le tenant est résolu côté serveur via le header X-Tenant-Slug (posé par l'intercepteur
 * apiV2 depuis l'hôte). Réécrit : passe désormais par l'endpoint VIVANT `/iri/p/:slug`
 * (avant : fonction Netlify `/.netlify/functions/iri-page` MORTE → pages jamais affichées).
 */

import { iriApi } from '@/lib/api-v2';

const PAGE_CACHE_MS = 30 * 1000;
const cache = new Map();

export async function fetchIriPage(slug, { forceRefresh = false } = {}) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return null;

  const now = Date.now();
  const prev = cache.get(key);
  if (!forceRefresh && prev && now - prev.at < PAGE_CACHE_MS) return prev.value;

  try {
    // getPublicPage renvoie la ligne iri_pages (ou null) — déjà scopée tenant côté API.
    const row = await iriApi.getPublicPage(key);
    if (!row) {
      cache.set(key, { value: null, at: now });
      return null;
    }
    const value = {
      page: row,
      blocks: Array.isArray(row.blocks) ? row.blocks : [],
      tenant: null,
    };
    cache.set(key, { value, at: now });
    return value;
  } catch {
    cache.set(key, { value: null, at: now });
    return null;
  }
}
