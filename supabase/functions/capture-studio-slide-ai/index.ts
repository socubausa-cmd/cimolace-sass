/// <reference lib="deno.ns" />

/**
 * capture-studio-slide-ai — assistant IA du Capture Studio (SmartBoard live).
 *
 * Le front (CaptureStudioModal) appelait `/.netlify/functions/capture-studio-slide-ai`
 * qui N'EXISTAIT PAS (l'app n'est pas sur Netlify) → les deux boutons IA (enrichir un
 * slide · générer une transition pédagogique) échouaient en silence. Cette fonction
 * remplace ce backend fantôme par une vraie edge function, gatée JWT + crédits LIRI.
 *
 * POST { mode: 'slide' | 'transition', title: string, points?: string[], lang?: 'fr'|'en' }
 * Authorization: Bearer <user jwt>
 *   mode 'slide'      → { title, points[], subtitle, core_idea, progressive_steps[], visual_type, graphic_style, provider }
 *   mode 'transition' → { text, provider }
 */
import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Extrait un objet JSON d'une réponse LLM (retire les clôtures ```json … ```). */
function parseJsonLoose(raw: string): Record<string, unknown> | null {
  const s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(s); } catch { /* continue */ }
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* noop */ } }
  return null;
}

const asStrArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : [];

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Missing Authorization' });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'Invalid token' });

  let body: { mode?: string; title?: string; points?: unknown; lang?: string };
  try { body = (await req.json()) as typeof body; } catch { return json(400, { error: 'Invalid JSON' }); }

  const mode = String(body?.mode || 'slide').toLowerCase() === 'transition' ? 'transition' : 'slide';
  const title = String(body?.title || '').trim();
  const points = asStrArr(body?.points);
  const lang = String(body?.lang || 'fr').toLowerCase() === 'en' ? 'en' : 'fr';
  if (!title && !points.length) return json(400, { error: 'title ou points requis.' });

  const brief = `Titre: ${title}\nPoints:\n${points.map((p) => `- ${p}`).join('\n')}`.slice(0, 8000);

  // ── Gating crédits LIRI (comme liri-coach-slide) ────────────────────────────
  const ctx = await resolveTenant(req, body as Record<string, unknown>);
  if (ctx) {
    const estimate = await estimateLlmCost(ctx, 'anthropic', 'claude-haiku-4-5', brief, 1200);
    const reject = await preflightCheck(ctx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), { status: reject.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  const system = mode === 'transition'
    ? (lang === 'en'
        ? 'You are a teacher. Write a SHORT spoken transition (2–3 sentences) that introduces the next chapter from its title and bullet points. Plain text only, no markdown, no preamble.'
        : "Tu es un enseignant. Rédige une COURTE transition orale (2–3 phrases) qui introduit le prochain chapitre à partir de son titre et de ses points. Texte simple, sans markdown, sans préambule.")
    : (lang === 'en'
        ? 'You are a pedagogical slide designer. Rewrite the given title + bullets into a clearer, richer slide. Respond ONLY with JSON: {"title","points":[],"subtitle","core_idea","progressive_steps":[],"visual_type","graphic_style"}. No markdown, no commentary.'
        : "Tu es un designer pédagogique. Reformule le titre et les points fournis en un slide plus clair et enrichi. Réponds UNIQUEMENT en JSON: {\"title\",\"points\":[],\"subtitle\",\"core_idea\",\"progressive_steps\":[],\"visual_type\",\"graphic_style\"}. Pas de markdown, aucun commentaire.");

  const result = await aiChatClaudeDeepSeekGrok({
    system,
    messages: [{ role: 'user', content: brief }],
    max_tokens: mode === 'transition' ? 400 : 1200,
    temperature: mode === 'transition' ? 0.6 : 0.4,
  });

  const text = (result?.text || '').trim();
  if (!text) return json(502, { error: 'Réponse IA vide. Réessayez.', provider: result?.provider || null });

  // débit crédits (best-effort)
  if (ctx && result?.usage) {
    const u = result.usage;
    try {
      await debitUsage(ctx, { functionName: 'capture-studio-slide-ai', provider: u.provider, model: u.model, unitType: 'tokens_in', unitAmount: u.tokens_in, metadata: { mode } });
      await debitUsage(ctx, { functionName: 'capture-studio-slide-ai', provider: u.provider, model: u.model, unitType: 'tokens_out', unitAmount: u.tokens_out });
    } catch { /* ne bloque pas la réponse */ }
  }

  if (mode === 'transition') {
    return json(200, { text, provider: result?.provider || 'unknown' });
  }

  const parsed = parseJsonLoose(text) || {};
  return json(200, {
    title: String(parsed.title || title).trim(),
    points: asStrArr(parsed.points).length ? asStrArr(parsed.points) : points,
    subtitle: String(parsed.subtitle || '').trim(),
    core_idea: String((parsed as Record<string, unknown>).core_idea || '').trim(),
    progressive_steps: asStrArr((parsed as Record<string, unknown>).progressive_steps),
    visual_type: String((parsed as Record<string, unknown>).visual_type || '').trim(),
    graphic_style: String((parsed as Record<string, unknown>).graphic_style || '').trim(),
    provider: result?.provider || 'unknown',
  });
});
