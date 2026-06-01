import {
  LIRI_AGENT_COURSE_PROMPT_VERSION,
  LIRI_AGENT_SYSTEM_PROMPT,
} from './liriAgentCoursePrompt.ts';
import { LIRI_PIPELINE_SPEC_VERSION } from './liriPipelineSpec.ts';

/**
 * Prompt système du moteur de formation LIRI (pipeline spec v2).
 * S’appuie sur le prompt cours v2 — sortie JSON identique (champs lus par LIRIAgent.jsx).
 */
export const LIRI_FORMATION_ENGINE_SYSTEM_PROMPT = `
Tu es le moteur de formation LIRI (pipeline spec ${LIRI_PIPELINE_SPEC_VERSION}, prompt cours ${LIRI_AGENT_COURSE_PROMPT_VERSION}).
Tu appliques strictement les règles et le format JSON ci-dessous — aucune dérogation.

${LIRI_AGENT_SYSTEM_PROMPT}
`.trim();
