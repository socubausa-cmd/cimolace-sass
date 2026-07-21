/// <reference lib="deno.ns" />

/**
 * liri-konva-course-copilot — un texte de cours / notes / transcription → une STRUCTURE
 * pédagogique JSON complète (plan, slides guidés, mindmap, MasterScript).
 *
 * Entrée  : { sourceText: string, lang?: 'fr' | 'en' }
 * Sortie  : { course: <objet au schéma SYSTEM_LIRI_KONVA_COURSE_COPILOT>, provider?: string }
 *
 * Appelé par apps/app/.../callLiriKonvaCourseCopilot.js AVEC un JWT user (session) ;
 * ce client retombe sur un analyseur local si l'edge renvoie null/erreur. On exige donc
 * un JWT valide (verify_jwt par défaut convient — le client joint toujours le token).
 */
import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';
import {
  SYSTEM_LIRI_KONVA_COURSE_COPILOT_FR,
  SYSTEM_LIRI_KONVA_COURSE_COPILOT_EN,
} from '../_shared/liriKonvaCourseCopilotPrompt.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Extraction JSON tolérante (retire les fences markdown, isole le 1er bloc { … }).
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

  // ── Auth : JWT user requis (le client envoie toujours le token de session) ──
  // @ts-ignore Deno
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore Deno
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return json(401, { error: 'Authentification requise' });
  try {
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return json(401, { error: 'Invalid token' });
  } catch {
    return json(401, { error: 'Invalid token' });
  }

  let body: { sourceText?: string; lang?: string };
  try { body = (await req.json()) as typeof body; } catch { return json(400, { error: 'Invalid JSON' }); }

  const sourceText = String(body?.sourceText || '').trim();
  const lang = String(body?.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
  if (sourceText.length < 20) return json(400, { error: 'sourceText trop court (min 20 caractères)' });

  const system = lang === 'en'
    ? SYSTEM_LIRI_KONVA_COURSE_COPILOT_EN
    : SYSTEM_LIRI_KONVA_COURSE_COPILOT_FR;
  const userContent = `Document source :\n"""\n${sourceText.slice(0, 12000)}\n"""\n\nProduis l'objet JSON du plan de cours au schéma demandé (UNIQUEMENT le JSON).`;

  let text = '';
  let provider: string | undefined;
  try {
    const r = await aiChatClaudeDeepSeekGrok({
      system,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: 4000,
      temperature: 0.4,
      tier: 'premium',
    });
    text = r.text ?? '';
    provider = r.provider ?? undefined;
  } catch (e) {
    return json(502, { error: 'IA indisponible : ' + String((e as Error)?.message || e) });
  }

  const course = parseJsonLoose(text);
  if (!course || typeof course !== 'object' || !course.slides) {
    return json(502, { error: 'Réponse IA non-JSON ou incomplète', raw: String(text).slice(0, 300) });
  }
  return json(200, { course, provider });
});
