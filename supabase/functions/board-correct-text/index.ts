/// <reference lib="deno.ns" />
/**
 * board-correct-text — corrige l'orthographe/grammaire d'un texte du TABLEAU BLANC.
 *
 * Input  : { text: string, lang?: 'fr' | 'en' | 'es' }
 * Output : { corrected: string }
 *
 * Corrige UNIQUEMENT fautes/accents/typos, garde le sens, le ton, le vocabulaire et
 * les retours à la ligne. Ne reformule pas, ne traduit pas, n'ajoute/retire rien.
 * Chaîne LLM éco (mêmes secrets que les autres edges) : Groq → DeepSeek → OpenAI.
 * Front : supabase.functions.invoke('board-correct-text', { body: { text, lang } }).
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
    if (!groqKey && !deepseekKey && !openaiKey) {
      return jsonResponse({ error: 'Missing LLM API keys' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const text: string = String(body?.text || '').slice(0, 4000);
    const lang: string = (String(body?.lang || 'fr') || 'fr').slice(0, 5);
    if (!text.trim()) return jsonResponse({ error: 'text is required' }, 400);

    const langName = lang.startsWith('en') ? 'English' : lang.startsWith('es') ? 'Spanish' : 'French';
    const system =
      `You are a spelling and grammar corrector for short whiteboard notes written in ${langName}. ` +
      `Fix ONLY spelling, accents, grammar and obvious typos. Keep the EXACT same meaning, tone, ` +
      `vocabulary, capitalization intent and line breaks. Do NOT rephrase, do NOT add or remove ` +
      `content, do NOT translate, do NOT add commentary. If the text is already correct, return it ` +
      `unchanged. Reply with ONLY the corrected text — no quotes, no explanation, no markdown.`;
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ];

    const callLLM = async (
      url: string,
      key: string,
      model: string,
      timeoutMs = 20000,
    ): Promise<string | null> => {
      if (!key) return null;
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, temperature: 0.1, max_tokens: 1200, messages }),
          signal: abort.signal,
        });
        clearTimeout(t);
        if (!res.ok) return null;
        const data = await res.json();
        return String(data?.choices?.[0]?.message?.content || '').trim() || null;
      } catch (_) {
        clearTimeout(t);
        return null;
      }
    };

    const raw =
      (await callLLM('https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.3-70b-versatile')) ||
      (await callLLM('https://api.deepseek.com/chat/completions', deepseekKey, 'deepseek-chat', 30000)) ||
      (await callLLM('https://api.openai.com/v1/chat/completions', openaiKey, 'gpt-4o-mini'));

    if (!raw) return jsonResponse({ error: 'LLM unavailable' }, 503);

    // Nettoyage léger : retire un éventuel bloc markdown ou des guillemets encadrants.
    let corrected = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    if (
      (corrected.startsWith('"') && corrected.endsWith('"')) ||
      (corrected.startsWith('«') && corrected.endsWith('»'))
    ) {
      corrected = corrected.slice(1, -1).trim();
    }
    return jsonResponse({ corrected: corrected || text });
  } catch (e) {
    return jsonResponse({ error: String((e as Error)?.message || e) }, 500);
  }
});
