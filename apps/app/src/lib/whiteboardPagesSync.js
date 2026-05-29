/** Nombre max d'écrans tableau (pagination). */
export const WHITEBOARD_MAX_PAGES = 32;

export function normalizeWhiteboardPages(pages) {
  if (!Array.isArray(pages)) return [[]];
  const out = pages.filter((p) => Array.isArray(p)).map((p) => p.slice());
  return out.length > 0 ? out : [[]];
}

export function clampWhiteboardPageIndex(idx, pageCount) {
  const n = Math.max(1, pageCount);
  return Math.min(Math.max(0, Math.floor(Number(idx) || 0)), n - 1);
}

/**
 * Construit le patch broadcast (compat : `whiteboardStrokes` = page active).
 */
export function whiteboardBroadcastPatch(pages, pageIndex) {
  const p = normalizeWhiteboardPages(pages).slice(0, WHITEBOARD_MAX_PAGES);
  const idx = clampWhiteboardPageIndex(pageIndex, p.length);
  return {
    whiteboardPages: p,
    whiteboardPageIndex: idx,
    whiteboardStrokes: p[idx] ?? [],
  };
}

/**
 * Interprète un payload reçu (nouveau format pages ou ancien seul tableau).
 */
export function mergeWhiteboardFromPayload(payload, prevPages, prevIndex) {
  const safePrev = normalizeWhiteboardPages(prevPages);
  if (
    payload
    && Array.isArray(payload.whiteboardPages)
    && payload.whiteboardPages.every(Array.isArray)
  ) {
    const pages = normalizeWhiteboardPages(payload.whiteboardPages).slice(0, WHITEBOARD_MAX_PAGES);
    const idx = typeof payload.whiteboardPageIndex === 'number'
      ? clampWhiteboardPageIndex(payload.whiteboardPageIndex, pages.length)
      : clampWhiteboardPageIndex(prevIndex, pages.length);
    return { pages, pageIndex: idx };
  }
  if (payload && Array.isArray(payload.whiteboardStrokes)) {
    return { pages: [payload.whiteboardStrokes], pageIndex: 0 };
  }
  return {
    pages: safePrev,
    pageIndex: clampWhiteboardPageIndex(prevIndex, safePrev.length),
  };
}
