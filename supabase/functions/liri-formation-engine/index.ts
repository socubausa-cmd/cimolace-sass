/// <reference lib="deno.ns" />
/**
 * Moteur de formation LIRI (pipeline spec v2) — même JSON cours que `liri-agent-course-generate`,
 * prompt système composé (`liriFormationEnginePrompt.ts`).
 */

import { handleLiriCourseLlmRequest } from '../_shared/liriAgentCourseLlmShared.ts';
import { LIRI_FORMATION_ENGINE_SYSTEM_PROMPT } from '../_shared/liriFormationEnginePrompt.ts';
import { corsHeaders } from '../_shared/cors.ts';

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  try {
    return await handleLiriCourseLlmRequest(req, {
      systemPrompt: LIRI_FORMATION_ENGINE_SYSTEM_PROMPT,
      logPrefix: 'liri-formation-engine',
      includePipelineMeta: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[liri-formation-engine] fatal', message, err);
    return new Response(JSON.stringify({
      error: 'Erreur serveur — réessayez',
      details: message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
