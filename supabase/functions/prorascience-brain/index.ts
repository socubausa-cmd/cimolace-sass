/// <reference lib="deno.ns" />
/**
 * prorascience-brain — le CERVEAU d'un tenant rendu par Cimolace OS (realm isolé).
 *
 * L'OS (même moteur) rend un tenant existant (ex. prorascience). Ce cerveau RÉPOND dans le
 * périmètre de CE tenant, à partir de sa MÉMOIRE CENTRALISÉE (knowledge pack sérialisé, envoyé
 * par le front). CLOISON STRICTE : il REFUSE tout ce qui touche Cimolace/cimolace.space ou une
 * autre plateforme (« Restons sur {platformName} »). Il ne vend rien de Cimolace.
 *
 * Générique (piloté par les données) : marche pour n'importe quel tenant via son knowledge pack.
 * Public (pré-signup). Chaîne LLM éco : Groq → DeepSeek → OpenAI.
 * Front : supabase.functions.invoke('prorascience-brain', { body: { message, platformName, knowledge, history } }).
 */
import { corsHeaders } from '../_shared/cors.ts';

// @ts-ignore - Deno runtime
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // @ts-ignore - Deno runtime
    const groqKey = Deno.env.get('GROQ_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!groqKey && !deepseekKey && !openaiKey) return jsonResponse({ error: 'Missing LLM API keys' }, 500);

    const body = await req.json().catch(() => ({}));
    const message: string = String(body?.message || '').trim();
    const platformName: string = String(body?.platformName || 'cette plateforme').trim().slice(0, 80);
    const knowledge: string = String(body?.knowledge || '').trim().slice(0, 6000);
    const history: Array<{ role: string; content: string }> = Array.isArray(body?.history) ? body.history.slice(-6) : [];
    if (!message) return jsonResponse({ error: 'message is required' }, 400);

    const system =
      `Tu es le GUIDE du site « ${platformName} » — chaleureux, incarné, clair. Tu accueilles le visiteur et tu l'orientes DANS le périmètre de ${platformName}, à partir de ce que tu SAIS (ci-dessous). Phrases courtes, français concret, tu/vous naturel, sans markdown.\n\n` +
      `=== CE QUE TU SAIS SUR ${platformName} ===\n${knowledge || '(connaissance non fournie — reste général et invite à préciser)'}\n=== FIN ===\n\n` +
      `RÈGLES STRICTES :\n` +
      `- Réponds UNIQUEMENT dans le périmètre de ${platformName} (son offre, sa vision, ses forfaits, son fondateur, sa méthode, ses pages).\n` +
      `- CLOISON : si on te parle de « Cimolace », « cimolace.space », de créer une plateforme SaaS, ou d'une AUTRE plateforme/marque, REFUSE poliment et recentre : « Ici on est sur ${platformName} — que puis-je vous en dire ? » Tu ne connais rien d'autre que ${platformName} et tu n'y donnes accès d'aucune façon.\n` +
      `- Si l'info n'est pas dans ta connaissance, dis-le et invite à préciser / à voir la page concernée. N'invente pas de faits (prix, dates).\n` +
      `- Oriente vers l'action utile (découvrir un forfait, comprendre la méthode, contacter).\n\n` +
      `Réponds en JSON STRICT (aucun texte hors JSON) : { "reply": "1 à 3 phrases", "onTopic": true|false }. onTopic=false uniquement si la demande sort du périmètre ${platformName} (ex. Cimolace) et que tu as recentré.`;

    const messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: message }];

    const callLLM = async (url: string, key: string, model: string, timeoutMs = 22000): Promise<string | null> => {
      if (!key) return null;
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, temperature: 0.5, max_tokens: 320, response_format: { type: 'json_object' }, messages }),
          signal: abort.signal,
        });
        clearTimeout(t);
        if (!res.ok) return null;
        const data = await res.json();
        return String(data?.choices?.[0]?.message?.content || '').trim() || null;
      } catch (_) { clearTimeout(t); return null; }
    };

    const raw =
      (await callLLM('https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.3-70b-versatile')) ||
      (await callLLM('https://api.deepseek.com/chat/completions', deepseekKey, 'deepseek-chat', 32000)) ||
      (await callLLM('https://api.openai.com/v1/chat/completions', openaiKey, 'gpt-4o-mini'));

    if (!raw) return jsonResponse({ error: 'LLM unavailable' }, 503);

    let parsed: { reply?: string; onTopic?: unknown } = {};
    try { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch (_) { /* défaut */ }

    const reply =
      String(parsed.reply || '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim() ||
      `Restons sur ${platformName} — dites-m'en un peu plus ?`;
    const onTopic = parsed.onTopic === false ? false : true;
    return jsonResponse({ reply, onTopic });
  } catch (e) {
    return jsonResponse({ error: String((e as Error)?.message || e) }, 500);
  }
});
