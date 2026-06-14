/// <reference lib="deno.ns" />

/**
 * liri-week-content-generate — génère le CONTENU d'une semaine pédagogique.
 *
 * Le squelette (5 jours / 11 blocs, types canoniques) est FIXÉ en code — il
 * reproduit exactement la structure seedée qui s'affiche déjà côté élève. L'IA
 * ne remplit que le contenu TEXTE (titres, défi, expérience, quiz, synthèse).
 * Les blocs média (vidéos, smartboard) reçoivent un titre + des placeholders
 * que le formateur complète ensuite (URL vidéo, deck_id réel).
 *
 * Entrée (POST JSON) :
 * {
 *   week_title?: string, theme?: string, course_title?: string,
 *   objectives?: string[], week_start?: string (ISO date, ex '2026-09-07'),
 *   lang?: 'fr'|'en', tenant_id?, tenant_slug?
 * }
 * Sortie : { days: [{ day_number, pedagogy_type, title, sort_order,
 *   blocks: [{ type, title, data, sort_order }] }], provider, _billing? }
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

function systemPrompt(lang: string): string {
  if (lang === 'en') {
    return [
      'You are a curriculum designer. For ONE week of a course, you produce the TEXT content of a fixed pedagogical template (5 days).',
      'Output STRICT JSON only, no markdown. Exact shape:',
      '{"day_titles":["<D1>","<D2>","<D3>","<D4>","<D5>"],"teaser_title":"<short>","opening_live_title":"<short>","smartboard_title":"<short>","doctrinal_video_title":"<short>","friction":{"challenge_text":"<a concrete challenge, 1-2 sentences>","hint_text":"<a helpful hint>"},"experiment_instructions":"<numbered steps, use \\n between steps>","recall_title":"<short>","quiz_title":"<short>","quiz_questions":[{"q":"<question>","options":["<a>","<b>","<c>","<d>"],"correct_index":<0-3>}],"mindmap_title":"<short>","summary_title":"<short>","summary_key_points":["<point>","<point>","<point>","<point>"],"closure_live_title":"<short>"}',
      'Rules: 3 to 5 quiz questions, each with exactly 4 options and a correct_index. 3 to 5 summary key points. Keep everything concrete and faithful to the given theme. Never invent facts outside the theme.',
    ].join('\n');
  }
  return [
    "Tu es un concepteur pédagogique. Pour UNE semaine d'un cours, tu produis le contenu TEXTE d'un gabarit pédagogique fixe (5 jours).",
    'Réponds UNIQUEMENT en JSON STRICT, sans markdown. Forme exacte :',
    '{"day_titles":["<J1>","<J2>","<J3>","<J4>","<J5>"],"teaser_title":"<court>","opening_live_title":"<court>","smartboard_title":"<court>","doctrinal_video_title":"<court>","friction":{"challenge_text":"<un défi concret, 1-2 phrases>","hint_text":"<un indice utile>"},"experiment_instructions":"<étapes numérotées, \\n entre les étapes>","recall_title":"<court>","quiz_title":"<court>","quiz_questions":[{"q":"<question>","options":["<a>","<b>","<c>","<d>"],"correct_index":<0-3>}],"mindmap_title":"<court>","summary_title":"<court>","summary_key_points":["<point>","<point>","<point>","<point>"],"closure_live_title":"<court>"}',
    "Règles : 3 à 5 questions de quiz, chacune avec exactement 4 options et un correct_index. 3 à 5 points de synthèse. Tout doit être concret et fidèle au thème donné. N'invente aucun fait hors du thème.",
  ].join('\n');
}

function buildUserContent(body: any, lang: string): string {
  const wk = String(body?.week_title || '').slice(0, 500);
  const theme = String(body?.theme || '').slice(0, 3000);
  const course = String(body?.course_title || '').slice(0, 500);
  const objectives: string[] = Array.isArray(body?.objectives)
    ? body.objectives.slice(0, 10).map((o: unknown) => String(o).slice(0, 300)) : [];
  const L = lang === 'en'
    ? { c: 'Course', w: 'Week', t: 'Theme / content', o: 'Objectives' }
    : { c: 'Cours', w: 'Semaine', t: 'Thème / contenu', o: 'Objectifs' };
  const lines: string[] = [];
  if (course) lines.push(`${L.c} : ${course}`);
  lines.push(`${L.w} : ${wk || '—'}`);
  if (theme) lines.push(`${L.t} : ${theme}`);
  if (objectives.length) lines.push(`${L.o} :\n- ${objectives.join('\n- ')}`);
  return lines.join('\n');
}

function parseJsonLoose(raw: string): any | null {
  if (!raw) return null;
  let t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(t.slice(start, end + 1)); } catch { return null; }
}

function str(v: unknown, max = 500): string { return String(v ?? '').slice(0, max); }

/** ISO datetime à `daysOffset` jours après week_start (date pure), à l'heure `hour`. */
function scheduledAt(weekStart: string | undefined, daysOffset: number, hour: number): string | null {
  if (!weekStart) return null;
  const d = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + daysOffset);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Assemble le gabarit fixe 5 jours / 11 blocs à partir du contenu IA. */
function assembleWeek(ai: any, weekStart: string | undefined): any[] {
  const dayTitles: string[] = Array.isArray(ai?.day_titles) ? ai.day_titles : [];
  const dt = (i: number, fb: string) => str(dayTitles[i] || fb, 300);

  const quizQuestions = (Array.isArray(ai?.quiz_questions) ? ai.quiz_questions : [])
    .slice(0, 8)
    .map((q: any) => {
      const options = (Array.isArray(q?.options) ? q.options : []).slice(0, 6).map((o: unknown) => str(o, 300));
      while (options.length < 2) options.push('');
      let ci = Number.isInteger(q?.correct_index) ? q.correct_index : 0;
      if (ci < 0 || ci >= options.length) ci = 0;
      return { q: str(q?.q, 600), options, correct_index: ci };
    })
    .filter((q: any) => q.q);

  const keyPoints = (Array.isArray(ai?.summary_key_points) ? ai.summary_key_points : [])
    .slice(0, 8).map((k: unknown) => str(k, 400)).filter(Boolean);

  return [
    {
      day_number: 1, pedagogy_type: 'opening_live', title: dt(0, 'Ouverture'), sort_order: 0,
      blocks: [
        { type: 'previsualisation_video', title: str(ai?.teaser_title, 300) || 'Teaser', data: { video_url: '', duration_seconds: 0 }, sort_order: 0 },
        { type: 'opening_live', title: str(ai?.opening_live_title, 300) || 'Live d’ouverture', data: { scheduled_at: scheduledAt(weekStart, 1, 10) }, sort_order: 1 },
      ],
    },
    {
      day_number: 2, pedagogy_type: 'smartboard_session', title: dt(1, 'Cours principal'), sort_order: 1,
      blocks: [
        { type: 'smartboard_session', title: str(ai?.smartboard_title, 300) || 'SmartBoard', data: { deck_id: '' }, sort_order: 0 },
        { type: 'doctrinal_video', title: str(ai?.doctrinal_video_title, 300) || 'Vidéo', data: { video_url: '', duration_seconds: 0 }, sort_order: 1 },
      ],
    },
    {
      day_number: 3, pedagogy_type: 'friction_block', title: dt(2, 'Défi & pratique'), sort_order: 2,
      blocks: [
        { type: 'friction_block', title: 'Défi de la semaine', data: { challenge_text: str(ai?.friction?.challenge_text, 1200), hint_text: str(ai?.friction?.hint_text, 800) }, sort_order: 0 },
        { type: 'experiment_block', title: 'Expérience pratique', data: { instructions: str(ai?.experiment_instructions, 2000) }, sort_order: 1 },
      ],
    },
    {
      day_number: 4, pedagogy_type: 'recall_block', title: dt(3, 'Révision & quiz'), sort_order: 3,
      blocks: [
        { type: 'recall_block', title: str(ai?.recall_title, 300) || 'Révision SM-2', data: { auto_from_session: true }, sort_order: 0 },
        { type: 'quiz_block', title: str(ai?.quiz_title, 300) || 'Quiz', data: { questions: quizQuestions }, sort_order: 1 },
      ],
    },
    {
      day_number: 5, pedagogy_type: 'closure_live', title: dt(4, 'Clôture'), sort_order: 4,
      blocks: [
        { type: 'mindmap_block', title: str(ai?.mindmap_title, 300) || 'Mindmap', data: { auto_generate: true }, sort_order: 0 },
        { type: 'summary_block', title: str(ai?.summary_title, 300) || 'Points clés à retenir', data: { key_points: keyPoints }, sort_order: 1 },
        { type: 'closure_live', title: str(ai?.closure_live_title, 300) || 'Live de clôture', data: { scheduled_at: scheduledAt(weekStart, 4, 17) }, sort_order: 2 },
      ],
    },
  ];
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: 'Corps JSON invalide.' }); }

  const lang = body?.lang === 'en' ? 'en' : 'fr';
  const weekStart = (typeof body?.week_start === 'string' && /^\d{4}-\d{2}-\d{2}/.test(body.week_start))
    ? body.week_start.slice(0, 10) : undefined;
  const system = systemPrompt(lang);
  const userContent = buildUserContent(body, lang);

  const ctx = await resolveTenant(req, body);
  if (ctx) {
    const estimate = await estimateLlmCost(ctx, 'anthropic', 'claude-haiku-4-5', userContent, 3072);
    const reject = await preflightCheck(ctx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), { status: reject.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  const result = await aiChatClaudeDeepSeekGrok({
    system,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: 3072,
    temperature: 0.5,
  });

  const text = (result?.text || '').trim();
  if (!text) return json(502, { error: 'Réponse IA vide. Réessayez.', provider: result?.provider || null });

  const ai = parseJsonLoose(text);
  if (!ai) return json(502, { error: 'Génération illisible (JSON IA invalide). Réessayez.', provider: result?.provider || null });

  const days = assembleWeek(ai, weekStart);

  let billingInfo: Record<string, unknown> | undefined;
  if (ctx && result?.usage) {
    const u = result.usage;
    const dIn = await debitUsage(ctx, { functionName: 'liri-week-content-generate', provider: u.provider, model: u.model, unitType: 'tokens_in', unitAmount: u.tokens_in, metadata: { week: str(body?.week_title, 120) } });
    const dOut = await debitUsage(ctx, { functionName: 'liri-week-content-generate', provider: u.provider, model: u.model, unitType: 'tokens_out', unitAmount: u.tokens_out });
    billingInfo = { provider: u.provider, model: u.model, tokens_in: u.tokens_in, tokens_out: u.tokens_out, credits_charged: (dIn.charged ?? 0) + (dOut.charged ?? 0), balance: dOut.balance ?? dIn.balance };
  }

  return json(200, { days, provider: result?.provider || 'unknown', ...(billingInfo ? { _billing: billingInfo } : {}) });
});
