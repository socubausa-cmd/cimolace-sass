/// <reference lib="deno.ns" />

/**
 * liri-script-master-generate — génère le MASTER SCRIPT complet d'un live.
 *
 * Entrée (POST JSON) :
 * {
 *   topic: string,                       // sujet / titre du live (requis)
 *   description?: string,
 *   objectives?: string[],
 *   chapters?: string[],
 *   scenes?: { title?: string, summary?: string }[],   // diapos du deck (optionnel)
 *   lang?: 'fr' | 'en',                  // défaut 'fr'
 *   tenant_id?: string, tenant_slug?: string, session_id?: string,
 * }
 *
 * Sortie :
 * {
 *   sections: [{
 *     slide_index: number | null,
 *     title: string,
 *     content: string,                   // script à dire par le formateur (prompteur)
 *     master_agent: {                    // métadonnées structurées (colonne JSONB)
 *       intention: string,
 *       key_points: string[],
 *       teacher_script: string,
 *       transition: string
 *     }
 *   }, ...],
 *   provider: string,
 *   _billing?: {...}
 * }
 *
 * Suit le pattern des fonctions liri-* : aiChatClaudeDeepSeekGrok (chaîne
 * DeepSeek → Claude → Grok) + facturation aiBilling (resolveTenant / preflight /
 * debit). Si la facturation n'est pas configurée pour le tenant, fail-open
 * (free tier auto-init + log sans débit si pas de pricing).
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
      'You are a master teaching assistant who writes the COMPLETE spoken script a teacher will deliver during a live class.',
      'You produce a structured, warm, pedagogically sound script — what the teacher actually says, step by step.',
      'Output STRICT JSON only, no markdown, no commentary. Shape:',
      '{"sections":[{"slide_index":<int|null>,"title":"<short section title>","content":"<the spoken script, 2-5 sentences, ready to read aloud>","master_agent":{"intention":"<pedagogical intent in one phrase>","key_points":["<point>","..."],"teacher_script":"<same as content or a refined version>","transition":"<one sentence bridging to the next section>"}}]}',
      'Rules: one section per provided slide (use its index) when slides are given; otherwise build a coherent arc (hook → development → practice → synthesis → Q&A). 5 to 9 sections. Keep each content speakable and concrete. Never invent facts beyond the topic.',
    ].join('\n');
  }
  return [
    'Tu es un assistant pédagogique expert qui rédige le SCRIPT COMPLET que le formateur va dire pendant un cours en direct (live).',
    'Tu produis un script structuré, chaleureux et pédagogiquement solide — ce que le formateur dit réellement, étape par étape.',
    'Réponds UNIQUEMENT en JSON STRICT, sans markdown ni commentaire. Forme :',
    '{"sections":[{"slide_index":<entier|null>,"title":"<titre court de section>","content":"<le script parlé, 2 à 5 phrases, prêt à lire à voix haute>","master_agent":{"intention":"<intention pédagogique en une phrase>","key_points":["<point>","..."],"teacher_script":"<identique au content ou une version affinée>","transition":"<une phrase qui amène la section suivante>"}}]}',
    "Règles : une section par diapo fournie (réutilise son index) quand des diapos sont données ; sinon construis un arc cohérent (accroche → développement → pratique → synthèse → questions). 5 à 9 sections. Chaque content doit être dicible et concret. N'invente aucun fait au-delà du sujet donné.",
  ].join('\n');
}

function buildUserContent(body: any, lang: string): string {
  const topic = String(body?.topic || '').slice(0, 2000);
  const description = String(body?.description || '').slice(0, 4000);
  const objectives: string[] = Array.isArray(body?.objectives) ? body.objectives.slice(0, 12).map((o: unknown) => String(o).slice(0, 400)) : [];
  const chapters: string[] = Array.isArray(body?.chapters) ? body.chapters.slice(0, 20).map((c: unknown) => String(c).slice(0, 400)) : [];
  const scenes: { title?: string; summary?: string }[] = Array.isArray(body?.scenes) ? body.scenes.slice(0, 30) : [];

  const L = lang === 'en'
    ? { topic: 'Topic', desc: 'Description', obj: 'Objectives', chap: 'Chapters', slides: 'Slides (one section each, keep order)', none: '(none — build a coherent arc)' }
    : { topic: 'Sujet', desc: 'Description', obj: 'Objectifs', chap: 'Chapitres', slides: 'Diapos (une section chacune, garder l’ordre)', none: '(aucune — construis un arc cohérent)' };

  const lines: string[] = [`${L.topic} : ${topic || '—'}`];
  if (description) lines.push(`${L.desc} : ${description}`);
  if (objectives.length) lines.push(`${L.obj} :\n- ${objectives.join('\n- ')}`);
  if (chapters.length) lines.push(`${L.chap} :\n- ${chapters.join('\n- ')}`);
  lines.push('');
  if (scenes.length) {
    lines.push(`${L.slides} :`);
    scenes.forEach((s, i) => {
      const t = String(s?.title || '').slice(0, 300);
      const sum = String(s?.summary || '').slice(0, 600);
      lines.push(`#${i} — ${t}${sum ? ` : ${sum}` : ''}`);
    });
  } else {
    lines.push(`${L.slides} : ${L.none}`);
  }
  return lines.join('\n');
}

/** Extrait et parse le premier objet JSON d'une réponse LLM (tolère fences markdown). */
function parseJsonLoose(raw: string): any | null {
  if (!raw) return null;
  let t = raw.trim();
  // retirer ```json ... ``` ou ``` ... ```
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = t.slice(start, end + 1);
  try { return JSON.parse(slice); } catch { return null; }
}

function coerceSections(parsed: any): any[] {
  const arr = Array.isArray(parsed?.sections) ? parsed.sections : (Array.isArray(parsed) ? parsed : []);
  const out: any[] = [];
  for (const s of arr) {
    if (!s || typeof s !== 'object') continue;
    const content = String(s.content || s.teacher_script || s.master_agent?.teacher_script || '').trim();
    if (!content) continue;
    const ma = (s.master_agent && typeof s.master_agent === 'object') ? s.master_agent : {};
    out.push({
      slide_index: (typeof s.slide_index === 'number' && s.slide_index >= 0) ? Math.floor(s.slide_index) : null,
      title: String(s.title || ma.intention || '').slice(0, 400),
      content: content.slice(0, 4000),
      master_agent: {
        intention: String(ma.intention || s.intention || '').slice(0, 600),
        key_points: Array.isArray(ma.key_points) ? ma.key_points.slice(0, 12).map((k: unknown) => String(k).slice(0, 300))
                  : (Array.isArray(s.key_points) ? s.key_points.slice(0, 12).map((k: unknown) => String(k).slice(0, 300)) : []),
        teacher_script: String(ma.teacher_script || content).slice(0, 4000),
        transition: String(ma.transition || s.transition || '').slice(0, 600),
      },
    });
  }
  return out.slice(0, 12);
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: 'Corps JSON invalide.' }); }

  const topic = String(body?.topic || '').trim();
  if (!topic) return json(400, { error: 'Champ "topic" requis.' });

  const lang = body?.lang === 'en' ? 'en' : 'fr';
  const system = systemPrompt(lang);
  const userContent = buildUserContent(body, lang);

  // Facturation : preflight (best-effort — fail-open si tenant non résolu).
  const ctx = await resolveTenant(req, body);
  if (ctx) {
    const estimate = await estimateLlmCost(ctx, 'anthropic', 'claude-haiku-4-5', userContent, 4096);
    const reject = await preflightCheck(ctx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), {
        status: reject.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const result = await aiChatClaudeDeepSeekGrok({
    system,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: 4096,
    temperature: 0.45,
  });

  const text = (result?.text || '').trim();
  if (!text) return json(502, { error: 'Réponse IA vide. Réessayez.', provider: result?.provider || null });

  const parsed = parseJsonLoose(text);
  const sections = coerceSections(parsed);
  if (!sections.length) {
    return json(502, { error: 'Génération illisible (JSON IA invalide). Réessayez.', provider: result?.provider || null });
  }

  // Débit après succès.
  let billingInfo: Record<string, unknown> | undefined;
  if (ctx && result?.usage) {
    const u = result.usage;
    const debitIn = await debitUsage(ctx, {
      functionName: 'liri-script-master-generate', provider: u.provider, model: u.model,
      unitType: 'tokens_in', unitAmount: u.tokens_in, sessionId: body?.session_id,
      metadata: { topic: topic.slice(0, 120), sections: sections.length },
    });
    const debitOut = await debitUsage(ctx, {
      functionName: 'liri-script-master-generate', provider: u.provider, model: u.model,
      unitType: 'tokens_out', unitAmount: u.tokens_out, sessionId: body?.session_id,
    });
    billingInfo = {
      provider: u.provider, model: u.model, tokens_in: u.tokens_in, tokens_out: u.tokens_out,
      credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
      balance: debitOut.balance ?? debitIn.balance,
    };
  }

  return json(200, {
    sections,
    provider: result?.provider || 'unknown',
    ...(billingInfo ? { _billing: billingInfo } : {}),
  });
});
