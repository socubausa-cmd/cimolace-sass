/// <reference lib="deno.ns" />

/**
 * liri-pedagogy-generate — développe UN chapitre en 21 segments pédagogiques LIRI.
 *
 * Entrée : { chapterTitle, chapterContent, chapterObjective?, lang? }
 * Sortie : { segments: { [nomSegment]: string }, provider? }
 *   où nomSegment ∈ CANONICAL_21 (le client Factory ne lit que les clés qu'il connaît :
 *   useMasterclassProject → `CANONICAL_21.map(name => aiSegments?.[name] || '')`).
 *
 * verify_jwt par défaut (true) : la Factory est authentifiée (créateur), Supabase impose le JWT.
 */
import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';

const CANONICAL_21 = [
  'Objectif', 'Compétence', 'Connaissance', 'Mise en situation', 'Tension',
  'Expérience de pensée', 'Révélation', 'Leçon simple', 'Leçon développée', 'Analogies',
  'Exemples', 'Reformulation', 'Atelier', 'Erreurs attendues', 'Correction', 'JE RETIENS',
  'Test', 'Cas réel', 'Lien conceptuel', 'Niveau de maîtrise', 'Transition',
];

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseJsonLoose(text: string): Record<string, unknown> | null {
  const t = String(text || '').trim().replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(t) as Record<string, unknown>; } catch { /* retry */ }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>; } catch { /* noop */ }
  }
  return null;
}

// @ts-ignore Deno global
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body: { chapterTitle?: string; chapterContent?: string; chapterObjective?: string; lang?: string };
  try { body = (await req.json()) as typeof body; } catch { return json(400, { error: 'Invalid JSON' }); }

  const chapterTitle = String(body?.chapterTitle || '').trim();
  const chapterContent = String(body?.chapterContent || '').trim();
  const chapterObjective = String(body?.chapterObjective || '').trim();
  const lang = String(body?.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
  if (!chapterTitle && !chapterContent) return json(400, { error: 'chapterTitle ou chapterContent requis' });

  const segmentsList = CANONICAL_21.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const system = lang === 'en'
    ? `You are the LIRI Pedagogical GPT. You develop ONE course chapter into the 21-segment LIRI method.
Output ONLY a valid JSON object: {"segments": { "<segment name>": "<pedagogical content>", ... }} with EXACTLY these 21 keys (French names, keep them verbatim):
${segmentsList}
Each value: 1–4 concise sentences, teachable aloud, faithful to the chapter, no HTML, no markdown fences.`
    : `Tu es le GPT Pédagogique LIRI. Tu développes UN chapitre de cours selon la méthode LIRI en 21 segments.
Réponds UNIQUEMENT par un objet JSON valide : {"segments": { "<nom du segment>": "<contenu pédagogique>", ... }} avec EXACTEMENT ces 21 clés (garde les noms à l'identique) :
${segmentsList}
Chaque valeur : 1 à 4 phrases claires, enseignables à l'oral, fidèles au chapitre, sans HTML, sans balises markdown. « Atelier » = une consigne/question d'exercice ; « JE RETIENS » = la synthèse mémorisable ; « Test » = une question de vérification.`;

  const userContent = [
    `Titre du chapitre : ${chapterTitle || '(sans titre)'}`,
    chapterObjective ? `Objectif : ${chapterObjective}` : '',
    `Contenu source :\n"""\n${chapterContent.slice(0, 8000)}\n"""`,
    'Produis les 21 segments (UNIQUEMENT le JSON).',
  ].filter(Boolean).join('\n\n');

  let text = '';
  let provider: string | undefined;
  try {
    const r = await aiChatClaudeDeepSeekGrok({
      system,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: 3000,
      temperature: 0.5,
      tier: 'economy',
      deepseekRole: 'heavy',
    });
    text = r.text ?? '';
    provider = r.provider ?? undefined;
  } catch (e) {
    return json(502, { error: 'IA indisponible : ' + String((e as Error)?.message || e) });
  }

  const parsed = parseJsonLoose(text);
  const rawSegments = (parsed?.segments && typeof parsed.segments === 'object')
    ? parsed.segments as Record<string, unknown>
    : parsed; // tolérance : l'IA a pu renvoyer directement l'objet des segments
  if (!rawSegments || typeof rawSegments !== 'object') {
    return json(502, { error: 'Réponse IA non-JSON', raw: String(text).slice(0, 300) });
  }

  // Ne garder que les clés canoniques, en string.
  const segments: Record<string, string> = {};
  for (const name of CANONICAL_21) {
    const v = (rawSegments as Record<string, unknown>)[name];
    if (typeof v === 'string' && v.trim()) segments[name] = v.trim();
  }

  return json(200, { segments, provider });
});
