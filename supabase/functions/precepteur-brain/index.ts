/// <reference lib="deno.ns" />
/**
 * precepteur-brain — le « cerveau » du Précepteur immersif : « parler à la présence »,
 * mais BORNÉ AU COURS. Jumelle de `agent-brain` (même cascade LLM Groq→DeepSeek→OpenAI),
 * sauf que ce cerveau ENSEIGNE au lieu de vendre, et REFUSE le hors-sujet.
 *
 * Public (le Précepteur /precepteur est capturable déconnecté ; aucun tenant → aucun billing).
 * Entrée  : { question, course: { title, concepts:[{title, lesson}] }, concept? }
 * Sortie  : { reply, onTopic }
 *
 * Front : supabase.functions.invoke('precepteur-brain', { body }). Déployer --no-verify-jwt.
 */
import { corsHeaders } from '../_shared/cors.ts';

// @ts-ignore - Deno runtime
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface ConceptKnowledge { title?: string; lesson?: string }

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
    const question: string = String(body?.question || '').trim();
    if (!question) return jsonResponse({ error: 'question is required' }, 400);

    const course = body?.course && typeof body.course === 'object' ? body.course : {};
    const courseTitle: string = String(course?.title || 'ce cours').slice(0, 120);
    const concepts: ConceptKnowledge[] = Array.isArray(course?.concepts) ? course.concepts.slice(0, 12) : [];
    const currentConcept: string = String(body?.concept || '').slice(0, 120);

    // Base de connaissance = le cours lui-même (le SEUL périmètre autorisé).
    const knowledge = concepts
      .map((c, i) => {
        const t = String(c?.title || `Concept ${i + 1}`).slice(0, 120);
        const l = String(c?.lesson || '').replace(/\s+/g, ' ').trim().slice(0, 600);
        return l ? `- ${t} : ${l}` : `- ${t}`;
      })
      .join('\n')
      .slice(0, 5000);

    const system =
      "Tu es « Le Précepteur », le professeur particulier qui enseigne CE cours à un élève, dans l'esprit d'un grand frère / d'une grande sœur complice (style « Les Sherpas ») : phrases COURTES, tu/on, énergie, une analogie concrète plutôt qu'un jargon. Tu ENSEIGNES — tu ne vends RIEN.\n\n" +
      `PÉRIMÈTRE STRICT — tu ne connais QUE ce cours et tu réponds UNIQUEMENT dans son périmètre.\n` +
      `COURS : ${courseTitle}\n` +
      (knowledge ? `CONTENU DU COURS :\n${knowledge}\n` : '') +
      (currentConcept ? `L'élève en est au concept : « ${currentConcept} ».\n` : '') +
      '\nRègles ABSOLUES :\n' +
      "- Réponds à la question en t'appuyant sur le CONTENU DU COURS ci-dessus, comme un prof qui réexplique autrement, avec une image concrète.\n" +
      "- Si la question SORT du cours (autre matière, demande générale, « vends-moi… », Cimolace, prix, création d'organisation, un autre cours), NE réponds PAS dessus : ramène gentiment au cours en UNE phrase (« Restons sur " + courseTitle + " — … ») et mets onTopic=false.\n" +
      "- Ne parle JAMAIS de Cimolace, de prix, de tarifs, de moteurs, d'abonnement, de création d'espace. Tu es un professeur, pas un vendeur.\n" +
      '- 1 à 3 phrases, incarnées, sans markdown ni astérisques.\n\n' +
      'Réponds en JSON STRICT (aucun texte hors JSON) :\n' +
      '{ "reply": "ta réponse en français (1 à 3 phrases)", "onTopic": true|false }';

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: question },
    ];

    const callLLM = async (url: string, key: string, model: string, timeoutMs = 22000): Promise<string | null> => {
      if (!key) return null;
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, temperature: 0.5, max_tokens: 500, response_format: { type: 'json_object' }, messages }),
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

    let parsed: { reply?: string; onTopic?: unknown } = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch (_) { /* garde le défaut */ }

    const reply =
      String(parsed.reply || '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim() ||
      `Restons sur ${courseTitle} — reformule ta question et je te réexplique.`;
    const onTopic = parsed.onTopic !== false;

    return jsonResponse({ reply, onTopic });
  } catch (e) {
    return jsonResponse({ error: String((e as Error)?.message || e) }, 500);
  }
});
