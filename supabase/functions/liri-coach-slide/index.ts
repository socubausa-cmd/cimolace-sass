/// <reference lib="deno.ns" />

/**
 * Coach Slide LIRI + Agent Architect (J4)
 * POST {
 *   slideContent: string,
 *   lang?: 'fr' | 'en',
 *   context?: string,
 *   mode?: 'coach' | 'architect',
 *   architectTier?: 'light' | 'medium' | 'deep' | 'full',
 *   coachScore?: number — optionnel ; sinon défaut medium si absent
 *   coachArchitectHandoff?: object — base JSON v1 + optionnel architect_extension_v2, validé côté serveur
 * }
 * → coach: { analysis, score?, coachTier?, provider }
 * → architect: { analysis, architectTier, mode: 'architect', coachHandoffValidated?, provider }
 */
import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';
import {
  SYSTEM_LIRI_COACH_SLIDE_EN,
  SYSTEM_LIRI_COACH_SLIDE_FR,
} from '../_shared/liriCoachSlideTrainingPrompt.ts';
import { systemArchitectForTier } from '../_shared/liriArchitectPrompts.ts';
import {
  architectTokenBudget,
  coachTierFromScore,
  parseCoachScoreBlock,
} from '../_shared/parseCoachScore.ts';
import {
  buildCoachArchitectHandoffInstructionFr,
  buildCoachArchitectHandoffInstructionEn,
} from '../_shared/coachArchitectHandoffAppendix.ts';
import { validateCoachArchitectHandoff } from '../_shared/validateCoachArchitectHandoff.ts';
import type { CoachArchitectHandoffValidated } from '../_shared/validateCoachArchitectHandoff.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeTier(raw: string | undefined, coachScore: number | null): ArchitectTier {
  const t = String(raw || '').toLowerCase().trim();
  if (t === 'light' || t === 'medium' || t === 'deep' || t === 'full') return t;
  if (coachScore != null && !Number.isNaN(coachScore)) {
    return coachTierFromScore(Math.min(100, Math.max(0, coachScore)));
  }
  return 'medium';
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

  let body: {
    slideContent?: string;
    lang?: string;
    context?: string;
    mode?: string;
    architectTier?: string;
    coachScore?: number;
    coachArchitectHandoff?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const slideContent = String(body?.slideContent || '').trim();
  const lang = String(body?.lang || 'fr').trim();
  const context = String(body?.context || '').trim();
  const mode = String(body?.mode || 'coach').toLowerCase() === 'architect' ? 'architect' : 'coach';

  if (!slideContent) {
    return json(400, { error: 'slideContent est requis.' });
  }

  // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
  const ctx = await resolveTenant(req, body);
  if (ctx) {
    const estimate = await estimateLlmCost(ctx, 'anthropic', 'claude-haiku-4-5', slideContent.slice(0, 24000), 4096);
    const reject = await preflightCheck(ctx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), {
        status: reject.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const trimmed = slideContent.slice(0, 24000);
  const ctxBlock =
    lang === 'en'
      ? (context ? `Context:\n${context.slice(0, 8000)}\n\n` : '')
      : (context ? `Contexte :\n${context.slice(0, 8000)}\n\n` : '');

  if (mode === 'architect') {
    const rawScore = body?.coachScore;
    const coachScore =
      typeof rawScore === 'number' && !Number.isNaN(rawScore)
        ? Math.min(100, Math.max(0, rawScore))
        : null;

    let validatedHandoff: CoachArchitectHandoffValidated | null = null;
    if (body?.coachArchitectHandoff != null) {
      const v = validateCoachArchitectHandoff(body.coachArchitectHandoff);
      if (!v.ok) {
        return json(400, { error: 'coachArchitectHandoff invalide.', details: v.errors });
      }
      validatedHandoff = v.value;
    }

    const tierSource =
      (typeof body?.architectTier === 'string' && body.architectTier.trim())
        ? body.architectTier.trim()
        : validatedHandoff?.intervention_level;

    const tier = normalizeTier(tierSource, coachScore);
    const { max_tokens, temperature } = architectTokenBudget(tier);
    const system = systemArchitectForTier(lang, tier);

    const handoffPrefix = validatedHandoff
      ? (lang === 'en'
          ? `\n--- COACH→ARCHITECT (validated JSON: v1 base + optional v2 extension) ---\n${JSON.stringify(validatedHandoff)}\n---\n`
          : `\n--- COACH→ARCHITECT (JSON validé : base v1 + extension v2 optionnelle) ---\n${JSON.stringify(validatedHandoff)}\n---\n`)
      : '';

    const userContent =
      lang === 'en'
        ? `${handoffPrefix}${ctxBlock}Slide / lesson content to redesign (architect brief):\n\n${trimmed}`
        : `${handoffPrefix}${ctxBlock}Contenu ou description du slide à architecturer :\n\n${trimmed}`;

    const result = await aiChatClaudeDeepSeekGrok({
      system,
      messages: [{ role: 'user', content: userContent }],
      max_tokens,
      temperature,
    });

    const text = (result?.text || '').trim();
    if (!text) {
      return json(502, {
        error: 'Réponse IA vide. Réessayez.',
        provider: result?.provider || null,
      });
    }

    let billingInfo: Record<string, unknown> | undefined;
    if (ctx && result?.usage) {
      const u = result.usage;
      const debitIn = await debitUsage(ctx, {
        functionName: 'liri-coach-slide', provider: u.provider, model: u.model,
        unitType: 'tokens_in', unitAmount: u.tokens_in, metadata: { mode: 'architect', tier },
      });
      const debitOut = await debitUsage(ctx, {
        functionName: 'liri-coach-slide', provider: u.provider, model: u.model,
        unitType: 'tokens_out', unitAmount: u.tokens_out,
      });
      billingInfo = {
        provider: u.provider, model: u.model, tokens_in: u.tokens_in, tokens_out: u.tokens_out,
        credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
        balance: debitOut.balance ?? debitIn.balance,
      };
    }

    return json(200, {
      analysis: text,
      mode: 'architect',
      architectTier: tier,
      coachHandoffValidated: Boolean(validatedHandoff),
      provider: result?.provider || 'unknown',
      ...(billingInfo ? { _billing: billingInfo } : {}),
    });
  }

  // --- coach ---
  const system =
    lang === 'en'
      ? SYSTEM_LIRI_COACH_SLIDE_EN + buildCoachArchitectHandoffInstructionEn()
      : SYSTEM_LIRI_COACH_SLIDE_FR + buildCoachArchitectHandoffInstructionFr();
  const userContent =
    lang === 'en'
      ? `${ctxBlock}Slide / lesson excerpt to coach:\n\n${trimmed}`
      : `${ctxBlock}Contenu ou description du slide à coacher :\n\n${trimmed}`;

  const result = await aiChatClaudeDeepSeekGrok({
    system,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: 4096,
    temperature: 0.45,
  });

  const rawText = (result?.text || '').trim();
  if (!rawText) {
    return json(502, {
      error: 'Réponse IA vide. Réessayez.',
      provider: result?.provider || null,
    });
  }

  const { cleanAnalysis, score } = parseCoachScoreBlock(rawText);
  const analysis = cleanAnalysis || rawText;
  const coachTier = score != null ? coachTierFromScore(score) : null;

  let billingInfo: Record<string, unknown> | undefined;
  if (ctx && result?.usage) {
    const u = result.usage;
    const debitIn = await debitUsage(ctx, {
      functionName: 'liri-coach-slide', provider: u.provider, model: u.model,
      unitType: 'tokens_in', unitAmount: u.tokens_in, metadata: { mode: 'coach' },
    });
    const debitOut = await debitUsage(ctx, {
      functionName: 'liri-coach-slide', provider: u.provider, model: u.model,
      unitType: 'tokens_out', unitAmount: u.tokens_out,
    });
    billingInfo = {
      provider: u.provider, model: u.model, tokens_in: u.tokens_in, tokens_out: u.tokens_out,
      credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
      balance: debitOut.balance ?? debitIn.balance,
    };
  }

  return json(200, {
    analysis,
    score: score ?? undefined,
    coachTier: coachTier ?? undefined,
    provider: result?.provider || 'unknown',
    ...(billingInfo ? { _billing: billingInfo } : {}),
  });
});
