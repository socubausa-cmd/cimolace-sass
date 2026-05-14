/**
 * LONGIA Hub — métadonnée produit unique (`context.longia_hub`) pour surfaces + moteurs.
 * Les moteurs (Coach, Architect, Events, Input) sont des **rôles** ; le routage côté produit suit `surface` + `mode`.
 *
 * **Contrat v1** (JSON dans `context`, envoyé au Edge puis **retiré** du bloc « Contexte (JSON) » LLM) :
 * - `v` — toujours `1`.
 * - `surface` — d’où part la requête (`live_host`, `studio_konva`, `unknown`, …).
 * - `mode` — `coach` | `architect`, aligné sur le body `studio-longia-chat*`.
 * - `engines` — rôles actifs (`coach`, `architect`, `events`, `input`).
 * - `capabilities` — drapeils (`rag`, `streaming_sse`, `canvas_actions_konva`, `live_signals`, …).
 * - `features` — map libre (flags client, version UI, etc.).
 *
 * Sans hub explicite, `ensureDefaultLongiaHubInContext` attache un hub minimal (`surface: unknown`).
 *
 * **Autres clés `context` (hors `longia_hub`)** :
 * - `longia_captured_intent` — pipeline Input (modalité, confiance, résumé court) ; conservé pour le LLM si présent.
 * - `longia_event_signal` — signaux Events ; **retiré** côté Edge avant le JSON prompt (voir `parseDesignerKonvaRequestContext`).
 */

/** @typedef {'live_host'|'live_student_coach'|'studio_konva'|'studio_image'|'player'|'formateur'|'text_design'|'messaging'|'unknown'} LongiaSurface */

export const LONGIA_SURFACE = {
  LIVE_HOST: 'live_host',
  /** Coach LONGIA privé côté élève (parcours + live). */
  LIVE_STUDENT_COACH: 'live_student_coach',
  STUDIO_KONVA: 'studio_konva',
  STUDIO_IMAGE: 'studio_image',
  PLAYER: 'player',
  FORMATEUR: 'formateur',
  TEXT_DESIGN: 'text_design',
  MESSAGING: 'messaging',
  UNKNOWN: 'unknown',
};

/**
 * Rôles moteur (documentation produit) — pas forcément 1:1 avec `mode` API.
 * @typedef {'coach'|'architect'|'events'|'input'} LongiaEngineRole
 */

export const LONGIA_ENGINE_ROLE = {
  COACH: 'coach',
  ARCHITECT: 'architect',
  EVENTS: 'events',
  INPUT: 'input',
};

export const LONGIA_CAPABILITY = {
  RAG: 'rag',
  STREAMING_SSE: 'streaming_sse',
  /** Actions canvas Konva (bloc longia_canvas_actions) */
  CANVAS_ACTIONS_KONVA: 'canvas_actions_konva',
  LIVE_SIGNALS: 'live_signals',
  IMAGE_GENERATION: 'image_generation',
  MULTIMODAL_INPUT: 'multimodal_input',
};

/**
 * Enveloppe `longia_hub` (JSON dans `context`) — v1 stable.
 * @param {{
 *   surface: string;
 *   mode?: 'coach'|'architect';
 *   engines?: string[];
 *   capabilities?: string[];
 *   features?: Record<string, unknown>;
 * }} p
 */
export function buildLongiaHubV1(p) {
  const surface = typeof p.surface === 'string' && p.surface ? p.surface : LONGIA_SURFACE.UNKNOWN;
  const mode = p.mode === 'architect' ? 'architect' : 'coach';
  return {
    v: 1,
    surface,
    mode,
    engines: Array.isArray(p.engines) ? p.engines : [],
    capabilities: Array.isArray(p.capabilities) ? p.capabilities : [],
    features: p.features && typeof p.features === 'object' && !Array.isArray(p.features) ? p.features : {},
  };
}

/**
 * @param {Record<string, unknown>} context
 * @param {ReturnType<typeof buildLongiaHubV1>} hub
 */
export function attachLongiaHubToContext(context, hub) {
  return {
    ...context,
    longia_hub: hub,
  };
}

/**
 * Attache un hub v1 minimal si `context.longia_hub` est absent (analytics / cohérence transport).
 * @param {'coach'|'architect'} mode
 * @param {Record<string, unknown>} [context]
 * @param {boolean} [useRag]
 */
export function ensureDefaultLongiaHubInContext(mode, context, useRag) {
  const ctx =
    context && typeof context === 'object' && !Array.isArray(context) ? { ...context } : {};
  if (ctx.longia_hub != null && typeof ctx.longia_hub === 'object') return ctx;
  const m = mode === 'architect' ? 'architect' : 'coach';
  return attachLongiaHubToContext(
    ctx,
    buildLongiaHubV1({
      surface: LONGIA_SURFACE.UNKNOWN,
      mode: m,
      engines: [m === 'architect' ? LONGIA_ENGINE_ROLE.ARCHITECT : LONGIA_ENGINE_ROLE.COACH],
      capabilities: useRag === true ? [LONGIA_CAPABILITY.RAG] : [],
    }),
  );
}
