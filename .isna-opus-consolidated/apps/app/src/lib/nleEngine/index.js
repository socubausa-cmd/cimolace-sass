/**
 * Point d’entrée public du moteur NLE (modèle, parsing, sync chapitres).
 */
export {
  NLE_ENGINE_VERSION,
  createEmptyNleProject,
  createClip,
  parseNleProject,
  syncVideoTrackFromChapters,
  recomputeDuration,
  cutTransition,
  crossfadeTransition,
  dipToBlackTransition,
} from './nleProjectModel';
export { applySegmentsFromNleV1Clips } from './applySegmentsFromNleV1Clips.js';
export { applyNleProjectToChapterRows } from './applyNleProjectToChapterRows.js';
