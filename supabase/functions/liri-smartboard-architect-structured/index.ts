/// <reference lib="deno.ns" />

import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';
import {
  SYSTEM_LIRI_ARCHITECT_STRUCTURED_EN,
  SYSTEM_LIRI_ARCHITECT_STRUCTURED_FR,
} from '../_shared/liriArchitectStructuredPrompt.ts';
import {
  normalizeArchitectItems,
  parseJsonFromText,
  validateParsedRoot,
} from '../_shared/architectStructuredValidate.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

  let body: { assistantText?: string; centralIdea?: string; lang?: string; tier?: 'economy' | 'premium' };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  const tier = body?.tier === 'premium' ? 'premium' : 'economy';

  const assistantText = String(body?.assistantText || '').trim();
  if (assistantText.length < 20) {
    return json(400, { error: 'assistantText trop court' });
  }

  const lang = String(body?.lang || 'fr').trim();
  const idea = String(body?.centralIdea || '').trim();
  const system =
    lang === 'en' ? SYSTEM_LIRI_ARCHITECT_STRUCTURED_EN : SYSTEM_LIRI_ARCHITECT_STRUCTURED_FR;

  const userContent =
    lang === 'en'
      ? `Copilot message:\n\n${assistantText.slice(0, 14000)}${idea ? `\n\nCentral idea: ${idea.slice(0, 800)}` : ''}`
      : `Message Copilot :\n\n${assistantText.slice(0, 14000)}${idea ? `\n\nIdée centrale : ${idea.slice(0, 800)}` : ''}`;

  // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
  const ctx = await resolveTenant(req, body);
  if (ctx) {
    // Gating palier : Smartboard IA réservé aux forfaits LIRI (refus 403 en gratuit).
    const { checkSmartboardAiAccess } = await import('../_shared/checkSmartboardAiAccess.ts');
    const deny = await checkSmartboardAiAccess(ctx);
    if (deny) return deny;
    const estimate = await estimateLlmCost(ctx, 'deepseek', 'deepseek-chat', system + userContent, 2500);
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
    max_tokens: 2500,
    temperature: 0.25,
    // Architecture de cours = raisonnement structuré → modèle Mistral capable + DeepSeek « fond ».
    mistralModel: 'mistral-large-latest',
    tier,
    deepseekRole: 'heavy',
  });

  const rawText = result?.text ?? undefined;
  const parsed = parseJsonFromText(rawText);

  if (parsed === null) {
    return json(200, {
      ok: false,
      items: [],
      skipped: true,
      provider: result?.provider ?? null,
      error: {
        code: 'JSON_PARSE_FAILED',
        message: 'Impossible d’extraire un objet JSON depuis la sortie modèle.',
        details: typeof rawText === 'string' ? rawText.slice(0, 240) : undefined,
      },
    });
  }

  const structErr = validateParsedRoot(parsed);
  if (structErr) {
    return json(200, {
      ok: false,
      items: [],
      skipped: true,
      provider: result?.provider ?? null,
      error: structErr,
    });
  }

  const items = normalizeArchitectItems(parsed);

  if (items.length === 0) {
    return json(200, {
      ok: false,
      items: [],
      skipped: true,
      provider: result?.provider ?? null,
      error: {
        code: 'ITEMS_EMPTY_AFTER_NORMALIZE',
        message: 'JSON valide mais aucune suggestion exploitable après filtrage.',
      },
    });
  }

  // ─── LIRI Credits — Débit ────────────────────────────────────────────────
  let billingInfo: Record<string, unknown> | undefined;
  if (ctx && result?.usage) {
    const u = result.usage;
    const debitIn = await debitUsage(ctx, {
      functionName: 'liri-smartboard-architect-structured',
      provider: u.provider, model: u.model, unitType: 'tokens_in', unitAmount: u.tokens_in,
    });
    const debitOut = await debitUsage(ctx, {
      functionName: 'liri-smartboard-architect-structured',
      provider: u.provider, model: u.model, unitType: 'tokens_out', unitAmount: u.tokens_out,
    });
    billingInfo = {
      provider: u.provider, model: u.model, tokens_in: u.tokens_in, tokens_out: u.tokens_out,
      credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
      balance: debitOut.balance ?? debitIn.balance,
    };
  }

  return json(200, {
    ok: true,
    items,
    provider: result?.provider ?? 'unknown',
    ...(billingInfo ? { _billing: billingInfo } : {}),
  });
});
