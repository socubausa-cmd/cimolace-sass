/// <reference lib="deno.ns" />
/**
 * agent-brain — cerveau de l'assistant de création d'organisation (immersif) de Cimolace.
 *
 * Public (pré-signup, aucun tenant → aucun billing). À partir du message libre de
 * l'utilisateur + du contexte (moteur pressenti, sujets abordés), renvoie en JSON :
 *   { reply, product, hooks }
 * - reply   : réponse chaleureuse et vivante (voix « vendeur-Précepteur »).
 * - product : "school" | "medos" | "shop" | null (le moteur qui colle au besoin).
 * - hooks   : jusqu'à 2 relances courtes orientées valeur / prix / décision.
 *
 * Chaîne LLM éco : Groq → DeepSeek → OpenAI (mêmes secrets que les autres edges).
 * Front : supabase.functions.invoke('agent-brain', { body: { message, chosen, covered } }).
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
    const message: string = String(body?.message || '').trim();
    const chosen: string = String(body?.chosen || '').trim();
    const covered: string[] = Array.isArray(body?.covered) ? body.covered.map(String) : [];
    const history: Array<{ role: string; content: string }> = Array.isArray(body?.history)
      ? body.history.slice(-6)
      : [];
    if (!message) return jsonResponse({ error: 'message is required' }, 400);

    const system =
      "Tu es l'assistant de création d'organisation de Cimolace — chaleureux, vif, orienté conseil ET vente HONNÊTE (jamais de fausse urgence ; prix toujours affiché ; on oriente, on ne manipule pas).\n" +
      "Cimolace fournit des « moteurs » métier clés en main, à la marque du client :\n" +
      "- \"school\" = LIRI École (école / cours en ligne) : lives HD, cours, smartboard IA, replay.\n" +
      "- \"medos\" = MedOS (santé / clinique) : dossiers patients, notes SOAP, téléconsultation, RGPD.\n" +
      "- \"shop\" = Virtuel Mbolo (boutique / commerce) : catalogue, panier, mobile money.\n" +
      "Prix : dès 150 €/mois (START), 200 (BUSINESS), 300 (ENTREPRISE) ; installation 500 € une fois ; zéro commission sur les ventes ; espace prêt en quelques minutes.\n" +
      `Contexte — moteur pressenti : ${chosen || 'aucun'} ; sujets déjà abordés : ${covered.join(', ') || 'aucun'}.\n\n` +
      "À partir du message de l'utilisateur, réponds en JSON STRICT (aucun texte hors JSON) :\n" +
      '{\n' +
      '  "reply": "réponse chaleureuse et VIVANTE en français, 1 à 2 phrases ; tu peux poser une question pour faire avancer",\n' +
      '  "product": "school" | "medos" | "shop" | null,\n' +
      '  "topic": "live" | "cours" | "ia" | "replay" | "compare" | "prix" | null,\n' +
      '  "hooks": ["relance courte 1", "relance courte 2"]\n' +
      '}\n' +
      "Règles :\n" +
      "- \"product\" = le moteur qui correspond au besoin (sinon null si ambigu ou question générale).\n" +
      "- \"topic\" = si ta reply EXPLIQUE un aspect précis, lequel : \"live\" (cours en direct), \"cours\" (cours/leçons à la demande), \"ia\" (smartboard / assistant IA), \"replay\" (enregistrements / replay), \"compare\" (pourquoi Cimolace plutôt que Zoom / un concurrent), \"prix\" (tarifs). Sinon null.\n" +
      "- \"reply\" court, jamais robotique, orienté vers la création d'un espace ; tu peux dérouler UN aspect à la fois (comme un tuto vivant) et enchaîner.\n" +
      "- \"hooks\" = 2 max, relances utiles orientées valeur, prix, comparaison, ou passage à la création — de préférence vers un SUJET non encore abordé (voir contexte).\n" +
      "- Plus l'utilisateur a déjà couvert de sujets (voir contexte), plus tu l'orientes clairement vers la CRÉATION de son espace.\n" +
      "Réponds UNIQUEMENT en JSON valide.";

    const messages = [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: message },
    ];

    const callLLM = async (
      url: string,
      key: string,
      model: string,
      timeoutMs = 22000,
    ): Promise<string | null> => {
      if (!key) return null;
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            temperature: 0.6,
            max_tokens: 320,
            response_format: { type: 'json_object' },
            messages,
          }),
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
      (await callLLM('https://api.deepseek.com/chat/completions', deepseekKey, 'deepseek-chat', 32000)) ||
      (await callLLM('https://api.openai.com/v1/chat/completions', openaiKey, 'gpt-4o-mini'));

    if (!raw) return jsonResponse({ error: 'LLM unavailable' }, 503);

    let parsed: { reply?: string; product?: unknown; hooks?: unknown } = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch (_) {
      /* garde le défaut */
    }

    const product = ['school', 'medos', 'shop'].includes(String(parsed.product))
      ? String(parsed.product)
      : null;
    const topic = ['live', 'cours', 'ia', 'replay', 'compare', 'prix'].includes(String(parsed.topic))
      ? String(parsed.topic)
      : null;
    const reply = String(parsed.reply || '').trim() || "Dites-m'en un peu plus sur votre projet ?";
    const trim = (h: unknown) => {
      const s = String(h).trim();
      return s.length > 84 ? s.slice(0, 84).replace(/\s+\S*$/, '') + '…' : s;
    };
    const hooks = Array.isArray(parsed.hooks)
      ? parsed.hooks.filter(Boolean).map(trim).filter((s) => s.length > 1).slice(0, 2)
      : [];

    return jsonResponse({ reply, product, topic, hooks });
  } catch (e) {
    return jsonResponse({ error: String((e as Error)?.message || e) }, 500);
  }
});
