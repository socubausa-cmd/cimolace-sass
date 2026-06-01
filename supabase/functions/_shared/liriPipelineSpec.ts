/**
 * Spécification pipeline « formation » LIRI (v2).
 * Partagée par `liri-formation-engine` et le client (`callLiriFormationEngine.js`).
 */

export const LIRI_PIPELINE_SPEC_VERSION = '2' as const;

export type LiriPipelineSpecVersion = typeof LIRI_PIPELINE_SPEC_VERSION;

/** Corps optionnel étendu pour le moteur de formation (même base que course-generate). */
export type LiriFormationEngineBody = {
  sujet?: string;
  niveau?: string;
  contexte?: string;
  profil_pedagogique?: string;
  /** Ignoré pour l’instant — réservé aux étapes multi-phases futures. */
  pipeline?: { version?: string };
};
