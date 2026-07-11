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
// CORS local — NE PAS toucher ../_shared/cors.ts (partagé par TOUTES les edges). Cette edge est
// publique (--no-verify-jwt) : on restreint l'origine navigateur aux domaines connus (bloque l'embed
// et le jailbreak du cerveau sous une marque arbitraire). Les appels hors-navigateur (curl) ignorent
// CORS → ils sont freinés par le rate-limit ci-dessous.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-jwt',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get('Origin') || '';
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    const https = u.protocol === 'https:';
    if (https && (host === 'prorascience.org' || host === 'www.prorascience.org')) return origin;
    if (https && (host === 'cimolace.space' || host.endsWith('.cimolace.space'))) return origin; // *.cimolace.space
    if (https && host.endsWith('-cimolace.vercel.app')) return origin;               // preview Vercel
    if (host === 'localhost' || host === '127.0.0.1') return origin;                  // dev local
  } catch { /* origine absente/invalide → non autorisée */ }
  return null;
}
function corsFor(req: Request): Record<string, string> {
  const o = allowedOrigin(req);
  return o ? { ...CORS_HEADERS, 'Access-Control-Allow-Origin': o } : { ...CORS_HEADERS };
}
function withCors(res: Response, cors: Record<string, string>): Response {
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

// Rate-limit LÉGER best-effort (mémoire d'isolat éphémère/multiple = frein anti-flood, pas un quota).
const RL = new Map<string, number[]>();
function rateLimited(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (RL.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  RL.set(ip, hits);
  if (RL.size > 5000) { for (const [k, v] of RL) { if (!v.some((t) => now - t < windowMs)) RL.delete(k); } }
  return hits.length > max;
}

// @ts-ignore - Deno runtime
function jsonResponse(obj: unknown, status = 200): Response {
  // ACAO ajouté par withCors() au niveau du handler (selon l'Origin) — jamais '*' en dur.
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip, 20, 60_000)) return withCors(jsonResponse({ error: 'rate_limited' }, 429), cors);

  try {
    // @ts-ignore - Deno runtime
    const groqKey = Deno.env.get('GROQ_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY') || '';
    // @ts-ignore - Deno runtime
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!groqKey && !deepseekKey && !openaiKey) return withCors(jsonResponse({ error: 'Missing LLM API keys' }, 500), cors);

    const body = await req.json().catch(() => ({}));
    const message: string = String(body?.message || '').trim();
    const platformName: string = String(body?.platformName || 'cette plateforme').trim().slice(0, 80);
    const knowledge: string = String(body?.knowledge || '').trim().slice(0, 6000);
    const history: Array<{ role: string; content: string }> = Array.isArray(body?.history) ? body.history.slice(-6) : [];
    if (!message) return withCors(jsonResponse({ error: 'message is required' }, 400), cors);

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

    if (!raw) return withCors(jsonResponse({ error: 'LLM unavailable' }, 503), cors);

    let parsed: { reply?: string; onTopic?: unknown } = {};
    try { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch (_) { /* défaut */ }

    const reply =
      String(parsed.reply || '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim() ||
      `Restons sur ${platformName} — dites-m'en un peu plus ?`;
    const onTopic = parsed.onTopic === false ? false : true;
    return withCors(jsonResponse({ reply, onTopic }), cors);
  } catch (e) {
    return withCors(jsonResponse({ error: String((e as Error)?.message || e) }, 500), cors);
  }
});
