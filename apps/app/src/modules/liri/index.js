/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE — MOTEUR LIRI (STUDIO LIVE)
 * Suite live autonome : live, smartboard, studio, replay, neuro-recall.
 * HORIZONTAL et indépendant — ne dépend PAS du moteur École.
 * Installable seul dans n'importe quelle application (modèle Zoom/Stripe).
 * ═══════════════════════════════════════════════════════════════
 */

// ── Moteurs ───────────────────────────────────────────────────
export { default as LiveEngine } from './live/liveEngine.js';
export { default as SmartboardEngine } from './smartboard/smartboardEngine.js';
export { default as StudioEngine } from './studio/studioEngine.js';
export { default as ReplayEngine } from './replay/replayEngine.js';
export { default as NeuroRecallEngine } from './neuro-recall/neuroRecallEngine.js';

// ── Types ─────────────────────────────────────────────────────
export * from './live/liveTypes.js';
export * from './smartboard/smartboardTypes.js';
export * from './studio/studioTypes.js';
export * from './replay/replayTypes.js';
export * from './neuro-recall/neuroRecallTypes.js';
