/**
 * Métadonnées `longia_hub` — lecture côté Edge (hors prompt LLM).
 */

export type LongiaHubPeek = {
  v: number;
  surface: string;
  mode: string;
  engines: string[];
  capabilities: string[];
};

export function peekLongiaHubFromContext(
  ctx: Record<string, unknown> | undefined | null,
): LongiaHubPeek | null {
  if (!ctx || typeof ctx !== 'object') return null;
  const h = ctx.longia_hub;
  if (!h || typeof h !== 'object') return null;
  const o = h as Record<string, unknown>;
  const engines = Array.isArray(o.engines)
    ? o.engines.filter((x): x is string => typeof x === 'string')
    : [];
  const capabilities = Array.isArray(o.capabilities)
    ? o.capabilities.filter((x): x is string => typeof x === 'string')
    : [];
  return {
    v: typeof o.v === 'number' ? o.v : 1,
    surface: typeof o.surface === 'string' && o.surface ? o.surface : 'unknown',
    mode: o.mode === 'architect' ? 'architect' : 'coach',
    engines,
    capabilities,
  };
}

/**
 * Journalisation structurée (activer avec `LONGIA_LOG_HUB=1` sur l’Edge).
 */
export function maybeLogLongiaHub(opts: {
  fn: string;
  userId: string;
  hub: LongiaHubPeek | null;
  envGetter: (k: string) => string;
}): void {
  if (opts.envGetter('LONGIA_LOG_HUB') !== '1') return;
  if (!opts.hub) return;
  const uid = opts.userId.length > 12 ? `${opts.userId.slice(0, 8)}…` : opts.userId;
  console.info(
    `[${opts.fn}] longia_hub user=${uid} surface=${opts.hub.surface} mode=${opts.hub.mode} engines=[${opts.hub.engines.join(',')}] caps=[${opts.hub.capabilities.join(',')}]`,
  );
}
