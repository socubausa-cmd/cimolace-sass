/// <reference lib="deno.ns" />
/**
 * studio-longia-chat — Chat LONGIA dans l’AI Hub (Studio unifié).
 *
 * - mode `coach`  : Groq `LONGIA_GROQ_MODEL` (défaut `llama-3.3-70b-versatile`) puis OpenAI `LONGIA_OPENAI_COACH_MODEL` / `OPENAI_MODEL` (défaut `gpt-4o`).
 * - mode `architect` : chaîne lourde — Claude → DeepSeek → Grok puis repli aiChat.
 * - Routage automatique : upgrade coach→architect si message « lourd » (JSON, plan long, etc.) ; downgrade architect→coach pour salutations triviales.
 * - LONGIA Core (Edge) : analyse synchrone toujours ; intent Groq léger **uniquement en mode coach**. `LONGIA_INTENT_GROQ=0` le désactive.
 * - Response Composer v1 : champ `composed` (schéma longia_response_composer) — fusion caps/dedupe actions·suggestions, understanding, preview, render_hints.
 *
 * POST { mode?: 'coach'|'architect', messages: {role:'user'|'assistant', content:string}[], context?: object }
 * Authorization: Bearer <user jwt>
 */
import { corsHeaders } from '../_shared/cors.ts';
import {
  aiChat,
  aiChatClaudeDeepSeekGrok,
  type ChatMessage,
  type AiUsageInfo,
} from '../_shared/aiClaudeDeepSeekGrok.ts';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildLongiaJsonBody,
  LONGIA_ENVELOPE_MARK,
  longiaEnvelopeSystemAddition,
} from '../_shared/longiaEnvelope.ts';
import { LONGIA_HUB_ORCHESTRATION_CORE } from '../_shared/longiaHubPrompt.ts';
import {
  applyOrchestrationToLongiaBody,
  formatLongiaOrchestratorBrief,
  runLongiaOrchestration,
} from '../_shared/longiaCoreOrchestrator.ts';
import type { LongiaOrchestrationResult } from '../_shared/longiaCoreOrchestrator.ts';
import { composeLongiaPublishedResponseV1 } from '../_shared/longiaResponseComposer.ts';
import { routeLongiaLlmMode, type LongiaClientMode } from '../_shared/longiaIntentRouter.ts';
import { fetchLongiaKnowledgeRagSnippets } from '../_shared/longiaKnowledgeRag.ts';
import { parseDesignerKonvaRequestContext } from '../_shared/longiaDesignerKonvaRequestContext.ts';
import { buildLongiaDesignerKonvaAssistLayer } from '../_shared/liriSmartboardDesignerPrompt.ts';
import { maybeLogLongiaHub, peekLongiaHubFromContext } from '../_shared/longiaHubMeta.ts';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function packageLongiaSuccess(
  baseBody: Record<string, unknown>,
  orchestration: LongiaOrchestrationResult,
  routingMeta: { requestedMode: string; effectiveMode: string; routingReason: string },
  effectiveMode: LongiaClientMode,
): Record<string, unknown> {
  const merged = applyOrchestrationToLongiaBody(baseBody, orchestration, routingMeta);
  const composed = composeLongiaPublishedResponseV1({
    body: merged,
    orchestration,
    effectiveMode,
  });
  return { ...merged, composed, routing: routingMeta };
}

// @ts-ignore Deno
const env = (k: string) => String(Deno.env.get(k) || '').trim();

async function openAICompatChat(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature: number;
}): Promise<{ text: string; tokens_in: number; tokens_out: number } | null> {
  const { baseUrl, apiKey, model, system, messages, max_tokens, temperature } = params;
  const fullMessages = [
    { role: 'system' as const, content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: fullMessages, max_tokens, temperature }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) return null;
  return {
    text: text.trim(),
    tokens_in: data?.usage?.prompt_tokens ?? 0,
    tokens_out: data?.usage?.completion_tokens ?? 0,
  };
}

function coachTemperature(): number {
  const raw = env('LONGIA_COACH_TEMPERATURE');
  if (!raw) return 0.58;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 2 ? n : 0.58;
}

/** Coach : Groq — défaut 70B (meilleure conversation que 8B instant). Surcharge : LONGIA_GROQ_MODEL. */
async function groqCoach(system: string, messages: ChatMessage[]): Promise<{ text: string; provider: string; usage: AiUsageInfo } | null> {
  const key = env('GROQ_API_KEY');
  if (!key) return null;
  const model = env('LONGIA_GROQ_MODEL') || 'llama-3.3-70b-versatile';
  const temperature = coachTemperature();
  const r = await openAICompatChat({
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: key,
    model,
    system,
    messages,
    max_tokens: 8192,
    temperature,
  });
  return r ? {
    text: r.text,
    provider: `groq-${model}`,
    usage: { provider: 'groq', model, tokens_in: r.tokens_in, tokens_out: r.tokens_out },
  } : null;
}

/** Coach : repli OpenAI — défaut gpt-4o (plus naturel que mini). Surcharge : LONGIA_OPENAI_COACH_MODEL puis OPENAI_MODEL. */
async function openaiCoachFallback(system: string, messages: ChatMessage[]): Promise<{ text: string; provider: string; usage: AiUsageInfo } | null> {
  const key = env('OPENAI_API_KEY');
  if (!key) return null;
  const model = env('LONGIA_OPENAI_COACH_MODEL') || env('OPENAI_MODEL') || 'gpt-4o';
  const temperature = coachTemperature();
  const r = await openAICompatChat({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: key,
    model,
    system,
    messages,
    max_tokens: 8192,
    temperature,
  });
  return r ? {
    text: r.text,
    provider: `openai-${model}`,
    usage: { provider: 'openai', model, tokens_in: r.tokens_in, tokens_out: r.tokens_out },
  } : null;
}

const COACH_SYSTEM = `${LONGIA_HUB_ORCHESTRATION_CORE}

### Mode COACH
Tu es LONGIA en mode **coach** : tu restes **naturel en conversation** (salutations, questions ouvertes) et **concret** quand il s’agit d’outils ou du canvas.
Réponds en **français**. Ne promets pas de fonctions inexistantes sur le canvas.
Pour une scène JSON très lourd ou une analyse longue, oriente vers le mode **Architect** (quick mode dans l’hub) dans ton texte et dans une action dédiée.`;

const ARCHITECT_SYSTEM = `${LONGIA_HUB_ORCHESTRATION_CORE}

### Mode ARCHITECT (structuré)
Tu es LONGIA en mode **architect** : tu infères intentions, types de documents, tons, structures ; tu proposes workflows, variantes, et **JSON structuré** quand c’est demandé.
Réponds en **français**. Quand on demande du JSON (scène, plan, mindmap, liste d’objets), inclue un bloc \`\`\`json ... \`\`\` valide **en plus** de ton texte visible et de l’enveloppe après ${LONGIA_ENVELOPE_MARK}.`;

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !serviceKey) return json(401, { error: 'Missing Authorization or server config' });

  const admin = createClient(supabaseUrl, serviceKey);
  const {
    data: { user },
    error: authErr,
  } = await admin.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'Invalid token' });

  let body: {
    mode?: string;
    messages?: ChatMessage[];
    context?: Record<string, unknown>;
    useRag?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const requestedMode: LongiaClientMode =
    String(body?.mode || 'coach') === 'architect' ? 'architect' : 'coach';
  const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
  const messages = rawMessages;
  if (messages.length === 0) return json(400, { error: 'messages required' });

  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') {
      return json(400, { error: 'invalid message role' });
    }
    if (typeof m.content !== 'string' || !m.content.trim()) {
      return json(400, { error: 'invalid message content' });
    }
  }

  const route = routeLongiaLlmMode(requestedMode, messages);
  const effectiveMode = route.effectiveMode;

  // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
  const billingCtx = await resolveTenant(req, body);
  if (billingCtx) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const estProvider = effectiveMode === 'architect' ? 'anthropic' : 'groq';
    const estModel = effectiveMode === 'architect' ? 'claude-haiku-4-5' : 'llama-3.3-70b-versatile';
    const estimate = await estimateLlmCost(billingCtx, estProvider, estModel, lastUser, 8192);
    const reject = await preflightCheck(billingCtx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), {
        status: reject.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  async function attachBilling(payload: Record<string, unknown>, usage: AiUsageInfo | undefined): Promise<Record<string, unknown>> {
    if (!billingCtx || !usage) return payload;
    const debitIn = await debitUsage(billingCtx, {
      functionName: 'studio-longia-chat', provider: usage.provider, model: usage.model,
      unitType: 'tokens_in', unitAmount: usage.tokens_in, metadata: { mode: effectiveMode },
    });
    const debitOut = await debitUsage(billingCtx, {
      functionName: 'studio-longia-chat', provider: usage.provider, model: usage.model,
      unitType: 'tokens_out', unitAmount: usage.tokens_out,
    });
    return {
      ...payload,
      _billing: {
        provider: usage.provider, model: usage.model,
        tokens_in: usage.tokens_in, tokens_out: usage.tokens_out,
        credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
        balance: debitOut.balance ?? debitIn.balance,
      },
    };
  }

  const ctxIn =
    body.context && typeof body.context === 'object'
      ? ({ ...(body.context as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  maybeLogLongiaHub({
    fn: 'studio-longia-chat',
    userId: user.id,
    hub: peekLongiaHubFromContext(ctxIn),
    envGetter: env,
  });
  const parsedCtx = parseDesignerKonvaRequestContext(ctxIn);
  if (parsedCtx.handoffError) {
    return json(400, { error: `coach_architect_handoff: ${parsedCtx.handoffError}` });
  }
  const ctxStr = JSON.stringify(parsedCtx.ctxForJson);
  const designerLayer = parsedCtx.designerKonvaAssist
    ? buildLongiaDesignerKonvaAssistLayer(parsedCtx.langDesigner)
    : '';

  let ragBlock = '';
  if (body.useRag === true) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    ragBlock = await fetchLongiaKnowledgeRagSnippets(admin, lastUser, { matchCount: 500 });
  }

  const envelopeBlock = longiaEnvelopeSystemAddition();
  const routingMeta = {
    requestedMode,
    effectiveMode,
    routingReason: route.reason,
  };

  /** LONGIA Core : contexte synchrone toujours ; intent Groq seulement si effectiveMode === coach. */
  const orchestration = await runLongiaOrchestration({
    ctx: parsedCtx.ctxForJson as Record<string, unknown>,
    messages,
    envGetter: env,
    effectiveLlmMode: effectiveMode,
  });
  const orchestratorBrief = formatLongiaOrchestratorBrief(orchestration);

  if (effectiveMode === 'coach') {
    const system = `${COACH_SYSTEM}${designerLayer}${envelopeBlock}\n\n${orchestratorBrief}${ragBlock}\n\nContexte court (JSON) : ${ctxStr}${parsedCtx.handoffLine}`;
    let out = await groqCoach(system, messages);
    if (!out) out = await openaiCoachFallback(system, messages);
    if (!out) {
      return json(503, {
        error: 'Coach indisponible',
        details: 'Définissez GROQ_API_KEY ou OPENAI_API_KEY sur le projet Supabase (Edge Functions secrets).',
      });
    }
    const coachBody = buildLongiaJsonBody({
      rawAssistant: out.text,
      provider: out.provider,
      mode: effectiveMode,
    }) as Record<string, unknown>;
    const packed = packageLongiaSuccess(coachBody, orchestration, routingMeta, effectiveMode);
    return json(200, await attachBilling(packed, out.usage));
  }

  const system = `${ARCHITECT_SYSTEM}${designerLayer}${envelopeBlock}\n\n${orchestratorBrief}${ragBlock}\n\nContexte projet (JSON) : ${ctxStr}${parsedCtx.handoffLine}`;
  const chain = await aiChatClaudeDeepSeekGrok({
    system,
    messages,
    max_tokens: 16384,
    temperature: 0.38,
  });
  if (chain.text && chain.provider) {
    const archBody = buildLongiaJsonBody({
      rawAssistant: chain.text,
      provider: chain.provider,
      mode: effectiveMode,
    }) as Record<string, unknown>;
    const packed = packageLongiaSuccess(archBody, orchestration, routingMeta, effectiveMode);
    return json(200, await attachBilling(packed, chain.usage));
  }

  const fallback = await aiChat({
    system,
    messages,
    max_tokens: 16384,
    temperature: 0.38,
  });
  if (!fallback.text) {
    return json(503, {
      error: 'Architect indisponible',
      details:
        'Configurez au moins une clé : ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, XAI_API_KEY, OPENAI_API_KEY ou GROQ_API_KEY.',
    });
  }
  const fbBody = buildLongiaJsonBody({
    rawAssistant: fallback.text,
    provider: fallback.provider,
    mode: effectiveMode,
  }) as Record<string, unknown>;
  const packed = packageLongiaSuccess(fbBody, orchestration, routingMeta, effectiveMode);
  return json(200, await attachBilling(packed, fallback.usage));
});
