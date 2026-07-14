/// <reference lib="deno.ns" />

/**
 * liri-script-ai-improve — améliore le SCRIPT parlé d'une slide (copilote SmartBoard).
 *
 * Entrée : { content: string, context?: string|object, mode?: string, slideIndex?: number }
 * Sortie : { result: string, improved: string, provider? } (le client lit result || improved)
 *
 * `mode` guide le type d'amélioration (clarifier / développer / raccourcir / oral…). verify_jwt
 * par défaut (true) : l'éditeur est authentifié, Supabase impose le JWT.
 */
import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const MODE_HINTS: Record<string, string> = {
  clarify: 'Clarifie et simplifie le propos sans perdre le sens. Phrases courtes.',
  clarifier: 'Clarifie et simplifie le propos sans perdre le sens. Phrases courtes.',
  expand: 'Développe et enrichis le propos avec un exemple ou une précision utile.',
  develop: 'Développe et enrichis le propos avec un exemple ou une précision utile.',
  developper: 'Développe et enrichis le propos avec un exemple ou une précision utile.',
  shorten: 'Raccourcis fortement, garde l’essentiel projetable/oralisable.',
  raccourcir: 'Raccourcis fortement, garde l’essentiel projetable/oralisable.',
  oral: 'Réécris pour être dit à l’oral, ton vivant et fluide, rythme d’enseignant.',
  script: 'Transforme en script parlé d’enseignant : accroche, explication, transition.',
  improve: 'Améliore la clarté, le rythme et l’impact pédagogique.',
};

// @ts-ignore Deno global
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body: { content?: string; context?: unknown; mode?: string; slideIndex?: number };
  try { body = (await req.json()) as typeof body; } catch { return json(400, { error: 'Invalid JSON' }); }

  const content = String(body?.content || '').trim();
  if (!content) return json(400, { error: 'content requis' });
  const mode = String(body?.mode || 'improve').toLowerCase().trim();
  const hint = MODE_HINTS[mode] || MODE_HINTS.improve;

  let contextStr = '';
  if (typeof body?.context === 'string') contextStr = body.context;
  else if (body?.context && typeof body.context === 'object') {
    try { contextStr = JSON.stringify(body.context).slice(0, 1500); } catch { /* noop */ }
  }

  const system = `Tu es le copilote pédagogique LIRI qui améliore le SCRIPT parlé d'une slide d'enseignement.
Objectif : ${hint}
Règles : français, pas de markdown ni de balises, pas de préambule ni de guillemets, réponds UNIQUEMENT par le texte amélioré (prêt à être dit/projeté).`;

  const userContent = [
    contextStr ? `Contexte du cours/slide :\n${contextStr}` : '',
    `Script actuel :\n"""\n${content.slice(0, 4000)}\n"""`,
    'Texte amélioré :',
  ].filter(Boolean).join('\n\n');

  let text = '';
  let provider: string | undefined;
  try {
    const r = await aiChatClaudeDeepSeekGrok({
      system,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: 900,
      temperature: 0.5,
      tier: 'economy',
      deepseekRole: 'fast',
    });
    text = r.text ?? '';
    provider = r.provider ?? undefined;
  } catch (e) {
    return json(502, { error: 'IA indisponible : ' + String((e as Error)?.message || e) });
  }

  const result = String(text || '').trim();
  if (!result) return json(502, { error: 'Réponse IA vide' });
  return json(200, { result, improved: result, provider });
});
