/// <reference lib="deno.ns" />
/**
 * generate-lesson — génère un COURS ENSEIGNÉ (PrecepteurCourse) à partir d'un SUJET libre.
 *
 * Le Précepteur est le CERVEAU (contenu) ; l'assistant Cimolace est le MOTEUR DE RENDU (l'OS)
 * qui joue le cours NATIVEMENT. Cette edge ne produit donc que des DONNÉES : un cours court,
 * voix « Sherpas » (grand frère/grande sœur, énergie, accroche, payoff), SANS croquis ni image
 * (le rendu natif Cimolace = voix serif + atelier ; zéro géométrie = zéro risque).
 *
 * Public (pré-signup). Chaîne LLM éco : Groq → DeepSeek → OpenAI.
 * Front : supabase.functions.invoke('generate-lesson', { body: { topic, engine?, studentName? } }).
 * Sortie : { course: { title, concepts:[{ title, scenes:[ lecon|atelier|transition ] }] } }.
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
    const topic: string = String(body?.topic || '').trim().slice(0, 120);
    const engine: string = String(body?.engine || '').trim();
    if (!topic) return jsonResponse({ error: 'topic is required' }, 400);

    const engineHint = engine === 'medos'
      ? 'Public : une clinique/un praticien qui découvre MedOS.'
      : engine === 'shop'
        ? 'Public : un commerçant qui découvre la boutique en ligne Virtuel Mbolo.'
        : 'Public : une école/un formateur qui découvre LIRI École.';

    const system =
      "Tu es Le Précepteur — un professeur dans l'esprit « Les Sherpas » : grand frère/grande sœur qui enseigne, énergique, complice, jamais magistral. Tu écris un COURS COURT et VIVANT en français sur le sujet demandé. Voix : tu/on, phrases courtes et incarnées, une ACCROCHE, une analogie concrète, un payoff (« waouh »). AUCUN markdown, aucun astérisque.\n" +
      engineHint + "\n\n" +
      "Rends un JSON STRICT (aucun texte hors JSON) de forme PrecepteurCourse :\n" +
      '{\n' +
      '  "course": {\n' +
      '    "title": "titre court et accrocheur du cours",\n' +
      '    "concepts": [\n' +
      '      { "title": "titre du concept",\n' +
      '        "scenes": [\n' +
      '          { "type": "lecon", "title": "titre court", "board_text": "1 phrase clé (≤180 car.)", "narration": "narration parlée Sherpas, 2 à 4 phrases (≤500 car.)" },\n' +
      '          { "type": "lecon", "title": "…", "board_text": "…", "narration": "…" },\n' +
      '          { "type": "atelier", "question": "UNE question socratique qui fait réfléchir l\'élève sur le sujet", "hint": "petit indice (≤160 car.)", "expected_answers": ["mot-clé attendu", "synonyme", "…"], "expected_errors": ["erreur classique", "…"], "ack_variants": { "ok": ["Exactement.", "C\'est ça."], "partial": ["Presque.", "Bonne piste."], "wrong": ["Pas tout à fait.", "Regarde mieux."] }, "reveal_narration": "la révélation Sherpas qui donne et explique la réponse (≤600 car.)" },\n' +
      '          { "type": "transition", "narration": "phrase de clôture qui ouvre vers la suite (≤160 car.)" }\n' +
      '        ] }\n' +
      '    ]\n' +
      '  }\n' +
      '}\n' +
      "Règles STRICTES : EXACTEMENT 1 concept ; scenes DANS CET ORDRE = 2 x lecon, puis 1 x atelier, puis 1 x transition ; INTERDIT d'inventer d'autres types (jamais de croquis/image/schéma) ; expected_answers = 3 à 6 mots-clés en minuscules, présents dans une bonne réponse ; reveal_narration donne EXPLICITEMENT la réponse. Français concret, sans markdown. Réponds UNIQUEMENT en JSON valide.";

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: `Sujet du cours : ${topic}` },
    ];

    const callLLM = async (url: string, key: string, model: string, timeoutMs = 30000): Promise<string | null> => {
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
            max_tokens: 1400,
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
      (await callLLM('https://api.deepseek.com/chat/completions', deepseekKey, 'deepseek-chat', 40000)) ||
      (await callLLM('https://api.openai.com/v1/chat/completions', openaiKey, 'gpt-4o-mini'));

    if (!raw) return jsonResponse({ error: 'LLM unavailable' }, 503);

    let parsed: any = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch (_) { /* défaut */ }

    // ── Sanitisation (le front re-valide via normalizeLesson ; défense en profondeur) ──
    const clean = (s: unknown, n: number) => String(s == null ? '' : s).replace(/\*+/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
    const arr = (a: unknown, n: number, len: number) =>
      (Array.isArray(a) ? a : []).slice(0, n).map((x) => clean(x, len)).filter(Boolean);

    const src = (parsed && parsed.course) ? parsed.course : parsed;
    const concepts = (Array.isArray(src?.concepts) ? src.concepts : []).slice(0, 1).map((c: any) => {
      const scenes = (Array.isArray(c?.scenes) ? c.scenes : []).map((s: any) => {
        if (!s || typeof s !== 'object') return null;
        if (s.type === 'lecon') {
          const narration = clean(s.narration || s.board_text, 560);
          if (!narration) return null;
          return { type: 'lecon', title: clean(s.title, 80) || undefined, board_text: clean(s.board_text || s.narration, 200), narration };
        }
        if (s.type === 'atelier') {
          if (!s.question) return null;
          const ack = s.ack_variants || {};
          return {
            type: 'atelier', address: '{{student_name}}',
            question: clean(s.question, 320), hint: clean(s.hint, 180) || undefined,
            expected_answers: arr(s.expected_answers, 8, 40), expected_errors: arr(s.expected_errors, 8, 40),
            ack_variants: { ok: arr(ack.ok, 4, 40), partial: arr(ack.partial, 4, 40), wrong: arr(ack.wrong, 4, 40) },
            reveal_narration: clean(s.reveal_narration, 640),
          };
        }
        if (s.type === 'transition') { const n = clean(s.narration, 200); return n ? { type: 'transition', narration: n } : null; }
        return null; // jamais de croquis/image
      }).filter(Boolean);
      return scenes.length ? { title: clean(c?.title, 80) || clean(src?.title, 80) || 'Le cours', scenes } : null;
    }).filter(Boolean);

    const hasLecon = concepts.some((c: any) => c.scenes.some((s: any) => s.type === 'lecon'));
    if (!concepts.length || !hasLecon) return jsonResponse({ error: 'invalid course' }, 502);

    const course = { title: clean(src?.title, 80) || `Cours sur ${topic}`, concepts };
    return jsonResponse({ course });
  } catch (e) {
    return jsonResponse({ error: String((e as Error)?.message || e) }, 500);
  }
});
