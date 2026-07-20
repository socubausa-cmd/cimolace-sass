/// <reference lib="deno.ns" />

/**
 * liri-script-ai-improve — améliore UNE section de master script.
 *
 * Appelée par useLiveScript.improveSection (boutons Améliorer / Enrichir /
 * Simplifier du MasterScriptPanel).
 *
 * Entrée (POST JSON) : { content: string, slideIndex?: number|null,
 *   mode?: 'improve' | 'expand' | 'simplify', lang?: 'fr'|'en',
 *   tenant_id?, tenant_slug?, session_id? }
 * Sortie : { improvedContent: string, provider: string, _billing?: {...} }
 *
 * Pattern liri-* : aiChatClaudeDeepSeekGrok + aiBilling (fail-open).
 */
import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function systemPrompt(mode: string, lang: string): string {
  const fr: Record<string, string> = {
    improve: "Tu es un coach d'éloquence pédagogique. Réécris ce passage de script de cours pour qu'il soit plus clair, fluide et engageant à dire à voix haute. Garde le sens et la longueur similaire.",
    expand: "Tu es un assistant pédagogique. Enrichis ce passage de script de cours : ajoute un exemple concret ou une précision utile, tout en restant dicible à voix haute. Reste fidèle au sujet.",
    simplify: "Tu es un assistant pédagogique. Simplifie ce passage de script de cours : phrases plus courtes, vocabulaire plus accessible, sans perdre l'essentiel.",
  };
  const en: Record<string, string> = {
    improve: 'You are a teaching delivery coach. Rewrite this class-script passage to be clearer, smoother and more engaging to say aloud. Keep the meaning and a similar length.',
    expand: 'You are a teaching assistant. Enrich this class-script passage: add one concrete example or useful clarification, while staying speakable aloud. Stay faithful to the topic.',
    simplify: 'You are a teaching assistant. Simplify this class-script passage: shorter sentences, more accessible vocabulary, without losing the essentials.',
  };
  const table = lang === 'en' ? en : fr;
  const base = table[mode] || table.improve;
  return base + (lang === 'en'
    ? ' Output ONLY the rewritten passage, no preamble, no quotes, no markdown.'
    : ' Réponds UNIQUEMENT par le passage réécrit, sans préambule, sans guillemets, sans markdown.');
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: 'Corps JSON invalide.' }); }

  const content = String(body?.content || '').trim();
  if (!content) return json(400, { error: 'Champ "content" requis.' });

  const mode = ['improve', 'expand', 'simplify'].includes(body?.mode) ? body.mode : 'improve';
  const lang = body?.lang === 'en' ? 'en' : 'fr';
  const system = systemPrompt(mode, lang);
  const slideIndex = (typeof body?.slideIndex === 'number') ? body.slideIndex : null;

  const userContent = (slideIndex != null ? `[Diapo #${slideIndex + 1}]\n` : '') + content.slice(0, 8000);

  const ctx = await resolveTenant(req, body);
  if (ctx) {
    const estimate = await estimateLlmCost(ctx, 'anthropic', 'claude-haiku-4-5', userContent, 1024);
    const reject = await preflightCheck(ctx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), {
        status: reject.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const result = await aiChatClaudeDeepSeekGrok({
    system,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: mode === 'expand' ? 1400 : 1024,
    temperature: mode === 'simplify' ? 0.35 : 0.55,
  });

  const improvedContent = (result?.text || '').trim().replace(/^["«»\s]+|["«»\s]+$/g, '');
  if (!improvedContent) return json(502, { error: 'Réponse IA vide. Réessayez.', provider: result?.provider || null });

  let billingInfo: Record<string, unknown> | undefined;
  if (ctx && result?.usage) {
    const u = result.usage;
    const debitIn = await debitUsage(ctx, {
      functionName: 'liri-script-ai-improve', provider: u.provider, model: u.model,
      unitType: 'tokens_in', unitAmount: u.tokens_in, sessionId: body?.session_id, metadata: { mode },
    });
    const debitOut = await debitUsage(ctx, {
      functionName: 'liri-script-ai-improve', provider: u.provider, model: u.model,
      unitType: 'tokens_out', unitAmount: u.tokens_out, sessionId: body?.session_id,
    });
    billingInfo = {
      provider: u.provider, model: u.model, tokens_in: u.tokens_in, tokens_out: u.tokens_out,
      credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
      balance: debitOut.balance ?? debitIn.balance,
    };
  }

  return json(200, {
    improvedContent,
    provider: result?.provider || 'unknown',
    ...(billingInfo ? { _billing: billingInfo } : {}),
  });
});
