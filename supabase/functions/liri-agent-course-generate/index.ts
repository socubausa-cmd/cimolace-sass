/// <reference lib="deno.ns" />
/**
 * Profils pédagogiques (UX) → moteurs internes (admin / secrets) :
 * - maitre_pedagogue    → Claude (Anthropic), priorité qualité / structure douce
 * - architecte          → OpenAI, plan & découpage logique
 * - cours_rapide        → Grok (xAI), brouillon rapide
 * - assistant_eco       → DeepSeek, économique
 * - auto                → routeur : Claude → OpenAI → Grok → DeepSeek → secours mini/haiku
 *
 * Secrets : ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, DEEPSEEK_API_KEY
 */

import { handleLiriCourseLlmRequest } from '../_shared/liriAgentCourseLlmShared.ts';
import { LIRI_AGENT_SYSTEM_PROMPT } from '../_shared/liriAgentCoursePrompt.ts';
import { corsHeaders } from '../_shared/cors.ts';

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  try {
    return await handleLiriCourseLlmRequest(req, {
      systemPrompt: LIRI_AGENT_SYSTEM_PROMPT,
      logPrefix: 'liri-agent-course-generate',
      includePipelineMeta: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[liri-agent-course-generate] fatal', message, err);
    return new Response(JSON.stringify({
      error: 'Erreur serveur — réessayez',
      details: message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
