/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LIRI AI Billing Helper — utilisé par toutes les Edge Functions IA
 *
 * Workflow :
 *   1. resolveTenant(req)        → trouve le tenant_id (header, JWT, body)
 *   2. estimateCost(req)         → estime un coût AVANT l'appel IA (token, char, sec…)
 *   3. preflightOrReject()       → vérifie solde >= estimate, sinon 402
 *   4. ... appel IA …
 *   5. debitActualUsage()        → débite atomiquement avec le vrai usage
 *
 * En cas d'usage SDK public (X-Liri-Api-Key) :
 *   le tenant est résolu via tenant_api_keys.
 * Sinon (call frontend depuis app SPA) :
 *   le user JWT → tenant via tenant_memberships.
 *
 * Tous les calls IA sont loggés dans `ai_usage_events` + ledger `ai_credit_transactions`.
 * ═════════════════════════════════════════════════════════════════════════════
 */

// @ts-ignore Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export type AiUnitType = 'tokens_in' | 'tokens_out' | 'chars' | 'seconds' | 'images' | 'requests';

export interface BillingContext {
  tenantId: string;
  userId?: string;
  supabase: ReturnType<typeof createClient>;
}

export interface DebitResult {
  success: boolean;
  balance?: number;
  charged?: number;
  error?: string;
  message?: string;
  required?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1) Résolution du tenant
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Résout l'ID tenant depuis la requête.
 * Cherche dans l'ordre :
 *   1. Header `X-Liri-Api-Key` (lk_live_xxx) → tenant_api_keys
 *   2. Body `tenant_id` (UUID direct)
 *   3. Header `X-Tenant-Slug` → tenants
 *   4. JWT Authorization Bearer → user → tenant_memberships
 */
export async function resolveTenant(req: Request, body?: any): Promise<BillingContext | null> {
  // @ts-ignore Deno runtime
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  // @ts-ignore
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1. API Key SDK
  const apiKeyHeader = req.headers.get('x-liri-api-key') ?? '';
  if (apiKeyHeader && apiKeyHeader.startsWith('lk_')) {
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(apiKeyHeader));
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const { data } = await supabase
      .from('tenant_api_keys')
      .select('tenant_id, revoked_at')
      .eq('key_hash', hash)
      .is('revoked_at', null)
      .maybeSingle();
    if (data?.tenant_id) {
      return { tenantId: data.tenant_id, supabase };
    }
  }

  // 2. Body tenant_id direct
  if (body?.tenant_id) {
    return { tenantId: body.tenant_id, userId: body.user_id, supabase };
  }

  // 3. Header X-Tenant-Slug
  const slug = req.headers.get('x-tenant-slug') ?? body?.tenant_slug;
  if (slug) {
    const { data } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle();
    if (data?.id) return { tenantId: data.id, supabase };
  }

  // 4. JWT Authorization Bearer → user → tenant
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data: userRes } = await supabase.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (userId) {
      const { data: membership } = await supabase
        .from('tenant_memberships')
        .select('tenant_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (membership?.tenant_id) {
        return { tenantId: membership.tenant_id, userId, supabase };
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) Pricing lookup (cache 1 min in-memory pour limiter les hits DB)
// ═══════════════════════════════════════════════════════════════════════════

const pricingCache = new Map<string, { value: number; expires: number }>();
const PRICING_TTL_MS = 60_000;

export async function getCreditsPerUnit(
  ctx: BillingContext,
  provider: string,
  model: string,
  unitType: AiUnitType,
): Promise<number> {
  const key = `${provider}/${model}/${unitType}`;
  const cached = pricingCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const { data } = await ctx.supabase
    .from('ai_pricing')
    .select('credits_per_unit')
    .eq('provider', provider)
    .eq('model', model)
    .eq('unit_type', unitType)
    .eq('is_active', true)
    .maybeSingle();

  const value = data ? parseFloat((data as any).credits_per_unit) : 0;
  pricingCache.set(key, { value, expires: Date.now() + PRICING_TTL_MS });
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3) Vérification preflight du solde
// ═══════════════════════════════════════════════════════════════════════════

export async function getBalance(ctx: BillingContext): Promise<number> {
  const { data } = await ctx.supabase
    .from('ai_credit_balances')
    .select('balance_credits, is_blocked')
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();

  if (!data) {
    // Auto-init free tier
    await ctx.supabase.rpc('init_tenant_ai_balance', {
      p_tenant_id: ctx.tenantId,
      p_plan: 'free',
    });
    const { data: fresh } = await ctx.supabase
      .from('ai_credit_balances')
      .select('balance_credits')
      .eq('tenant_id', ctx.tenantId)
      .single();
    return parseFloat((fresh as any)?.balance_credits ?? '0');
  }

  if ((data as any).is_blocked) return -1;
  return parseFloat((data as any).balance_credits);
}

/**
 * Vérifie preflight : si solde < estimate, retourne Response 402.
 * Sinon retourne null (continue).
 */
export async function preflightCheck(
  ctx: BillingContext,
  estimatedCredits: number,
): Promise<Response | null> {
  const balance = await getBalance(ctx);

  if (balance === -1) {
    return new Response(JSON.stringify({
      error: 'TENANT_BLOCKED',
      message: 'Compte IA suspendu — contactez le support.',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  if (balance < estimatedCredits) {
    return new Response(JSON.stringify({
      error: 'INSUFFICIENT_CREDITS',
      message: `Solde IA insuffisant (${balance.toFixed(2)} LCR < ${estimatedCredits.toFixed(2)} LCR requis). Rechargez votre compte.`,
      balance,
      required: estimatedCredits,
      topup_url: '/admin/ai-billing',
    }), { status: 402, headers: { 'Content-Type': 'application/json' } });
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4) Débit atomique après l'appel IA
// ═══════════════════════════════════════════════════════════════════════════

export interface DebitInput {
  functionName: string;
  provider: string;
  model: string;
  unitType: AiUnitType;
  unitAmount: number;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export async function debitUsage(ctx: BillingContext, input: DebitInput): Promise<DebitResult> {
  const creditsPerUnit = await getCreditsPerUnit(ctx, input.provider, input.model, input.unitType);
  const totalCredits = creditsPerUnit * input.unitAmount;

  if (totalCredits === 0) {
    // Pas de pricing défini — on log quand même sans débit
    await ctx.supabase.from('ai_usage_events').insert({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId ?? null,
      function_name: input.functionName,
      provider: input.provider,
      model: input.model,
      unit_type: input.unitType,
      unit_amount: input.unitAmount,
      credits_charged: 0,
      session_id: input.sessionId ?? null,
      metadata: { ...input.metadata, no_pricing: true },
    });
    return { success: true, balance: -1, charged: 0 };
  }

  const { data, error } = await ctx.supabase.rpc('debit_ai_credits', {
    p_tenant_id: ctx.tenantId,
    p_amount: totalCredits,
    p_function_name: input.functionName,
    p_model: input.model,
    p_provider: input.provider,
    p_unit_type: input.unitType,
    p_unit_amount: input.unitAmount,
    p_session_id: input.sessionId ?? null,
    p_user_id: ctx.userId ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    console.error('[aiBilling] debit RPC error:', error.message);
    return { success: false, error: 'DEBIT_FAILED', message: error.message };
  }

  return data as DebitResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) Estimateurs d'usage (à utiliser en preflight)
// ═══════════════════════════════════════════════════════════════════════════

/** Estime ~tokens depuis du texte (règle ~4 chars/token pour le français/anglais) */
export function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4);
}

/** Estime crédits preflight pour un chat LLM */
export async function estimateLlmCost(
  ctx: BillingContext,
  provider: string,
  model: string,
  inputText: string,
  expectedOutputTokens = 500,
): Promise<number> {
  const inputTokens = estimateTokens(inputText);
  const inPrice = await getCreditsPerUnit(ctx, provider, model, 'tokens_in');
  const outPrice = await getCreditsPerUnit(ctx, provider, model, 'tokens_out');
  return inputTokens * inPrice + expectedOutputTokens * outPrice;
}

/** Estime crédits TTS (par caractère) */
export async function estimateTtsCost(
  ctx: BillingContext,
  provider: string,
  model: string,
  text: string,
): Promise<number> {
  const charPrice = await getCreditsPerUnit(ctx, provider, model, 'chars');
  return text.length * charPrice;
}

/** Estime crédits STT (par seconde — durée audio attendue) */
export async function estimateSttCost(
  ctx: BillingContext,
  provider: string,
  model: string,
  durationSeconds: number,
): Promise<number> {
  const secPrice = await getCreditsPerUnit(ctx, provider, model, 'seconds');
  return durationSeconds * secPrice;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6) Wrapper end-to-end (preflightCheck + appel + debitUsage)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrapper pratique : exécute une fonction IA en gérant le billing.
 *
 * Usage :
 *   const result = await withBilling(
 *     req, body,
 *     { functionName: 'generate-quiz', provider: 'deepseek', model: 'deepseek-chat',
 *       estimatedInputTokens: 200, expectedOutputTokens: 300 },
 *     async () => {
 *       const aiResp = await callDeepseek(...);
 *       return { result: aiResp.json, usage: { tokens_in: aiResp.tokens_in, tokens_out: aiResp.tokens_out } };
 *     }
 *   );
 *   if (result instanceof Response) return result; // 402 ou erreur
 *   return new Response(JSON.stringify(result));
 */
export async function withBilling<T>(
  req: Request,
  body: any,
  config: {
    functionName: string;
    provider: string;
    model: string;
    estimatedCredits?: number;
    sessionId?: string;
  },
  exec: () => Promise<{ result: T; usage: { unit_type: AiUnitType; unit_amount: number }; metadata?: Record<string, unknown> }>,
): Promise<T | Response> {
  // 1. Résoudre le tenant
  const ctx = await resolveTenant(req, body);
  if (!ctx) {
    return new Response(JSON.stringify({
      error: 'TENANT_NOT_RESOLVED',
      message: 'Impossible d\'identifier le tenant. Fournissez X-Liri-Api-Key ou body.tenant_id ou JWT user.',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // 2. Preflight check
  if (config.estimatedCredits && config.estimatedCredits > 0) {
    const reject = await preflightCheck(ctx, config.estimatedCredits);
    if (reject) return reject;
  }

  // 3. Exécuter le call IA
  let execResult: { result: T; usage: { unit_type: AiUnitType; unit_amount: number }; metadata?: Record<string, unknown> };
  try {
    execResult = await exec();
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'AI_CALL_FAILED',
      message: (err as Error).message,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // 4. Débiter avec le vrai usage
  const debit = await debitUsage(ctx, {
    functionName: config.functionName,
    provider: config.provider,
    model: config.model,
    unitType: execResult.usage.unit_type,
    unitAmount: execResult.usage.unit_amount,
    sessionId: config.sessionId,
    metadata: execResult.metadata,
  });

  if (!debit.success) {
    console.warn(`[aiBilling] Debit failed but call succeeded: ${debit.message}`);
  }

  return execResult.result;
}
