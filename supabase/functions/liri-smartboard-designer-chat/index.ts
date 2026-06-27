/// <reference lib="deno.ns" />

import { corsHeaders } from '../_shared/cors.ts';
import { streamAiChatClaudeDeepSeekGrok } from '../_shared/aiStreamClaudeDeepSeekGrok.ts';
import {
  resolveTenant,
  preflightCheck,
  debitUsage,
  estimateLlmCost,
  estimateTokens,
} from '../_shared/aiBilling.ts';
import {
  SYSTEM_LIRI_SMARTBOARD_DESIGNER_EN,
  SYSTEM_LIRI_SMARTBOARD_DESIGNER_FR,
} from '../_shared/liriSmartboardDesignerPrompt.ts';
import { validateCoachArchitectHandoff } from '../_shared/validateCoachArchitectHandoff.ts';
import { fetchLongiaKnowledgeRagSnippets } from '../_shared/longiaKnowledgeRag.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

type Body = {
  messages?: ChatMsg[];
  lang?: string;
  context?: Record<string, unknown>;
};

function jsonErr(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Jeton utilisateur pour getUser : préfère `x-user-jwt` pour contourner la vérif JWT à l’ingress
 * (qui renvoie souvent 401 « Invalid JWT » sur l’access_token utilisateur alors que la clé anon passe).
 * Sinon repli sur Authorization (ex. dev local avec verify_jwt = false).
 */
function extractUserAccessToken(req: Request): string {
  const custom = (req.headers.get('x-user-jwt') || req.headers.get('X-User-Jwt') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (custom) return custom;
  return (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonErr(405, 'Method not allowed');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const token = extractUserAccessToken(req);
  if (!token) return jsonErr(401, 'Missing user session (x-user-jwt or Authorization)');

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return jsonErr(401, 'Invalid token');

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonErr(400, 'Invalid JSON');
  }

  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const messages: ChatMsg[] = raw
    .filter((m): m is ChatMsg =>
      m &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' &&
      m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
    return jsonErr(400, 'Le dernier message doit être un message utilisateur.');
  }

  const lang = String(body?.lang || 'fr').trim();
  const baseSystem =
    lang === 'en' ? SYSTEM_LIRI_SMARTBOARD_DESIGNER_EN : SYSTEM_LIRI_SMARTBOARD_DESIGNER_FR;

  let ctxStr = '';
  let handoffValidatedLine = '';
  let ragBlock = '';
  try {
    const ctx =
      body?.context && typeof body.context === 'object' && !Array.isArray(body.context)
        ? { ...(body.context as Record<string, unknown>) }
        : {};
    const useRag = ctx.useRag === true;
    delete ctx.useRag;
    const rawHo = ctx.coach_architect_handoff;
    delete ctx.coach_architect_handoff;
    if (rawHo != null) {
      const v = validateCoachArchitectHandoff(rawHo);
      if (!v.ok) {
        return jsonErr(400, `coach_architect_handoff: ${v.errors.join(' ')}`);
      }
      handoffValidatedLine =
        lang === 'en'
          ? `\n\nCoach→Architect handoff (validated: v1 base + optional architect_extension_v2):\n${JSON.stringify(v.value)}`
          : `\n\nPont Coach→Architect (JSON validé : base v1 + architect_extension_v2 optionnel) :\n${JSON.stringify(v.value)}`;
    }
    ctxStr = Object.keys(ctx).length
      ? `\n\nContexte canvas (fourni par l’éditeur) :\n${JSON.stringify(ctx)}`
      : '';
    if (useRag) {
      const lastUser = messages.filter((m) => m.role === 'user').pop()?.content || '';
      ragBlock = await fetchLongiaKnowledgeRagSnippets(admin, lastUser, { matchCount: 500 });
    }
  } catch {
    ctxStr = '';
    ragBlock = '';
  }

  const system = `${baseSystem}${ragBlock}${ctxStr}${handoffValidatedLine}`;

  // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
  const billingCtx = await resolveTenant(req, body);
  if (billingCtx) {
    // Gating palier : Smartboard IA réservé aux forfaits LIRI (refus 403 en gratuit).
    const { checkSmartboardAiAccess } = await import('../_shared/checkSmartboardAiAccess.ts');
    const deny = await checkSmartboardAiAccess(billingCtx);
    if (deny) return deny;
    const lastUser = messages[messages.length - 1]?.content || '';
    const estimate = await estimateLlmCost(billingCtx, 'anthropic', 'claude-haiku-4-5', system + lastUser, 4000);
    const reject = await preflightCheck(billingCtx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), {
        status: reject.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const inputTokenEstimate = estimateTokens(system + messages.map((m) => m.content).join('\n'));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      let assembled = '';
      try {
        for await (const text of streamAiChatClaudeDeepSeekGrok({
          system,
          messages,
          max_tokens: 16384,
          temperature: 0.55,
        })) {
          if (text) {
            assembled += text;
            send({ text });
          }
        }
        // ── Best-effort debit (estimate-based) ──
        if (billingCtx) {
          try {
            const outputTokenEstimate = estimateTokens(assembled);
            const provider = 'anthropic';
            const model = 'claude-haiku-4-5';
            await debitUsage(billingCtx, {
              functionName: 'liri-smartboard-designer-chat',
              provider, model, unitType: 'tokens_in', unitAmount: inputTokenEstimate,
              metadata: { stream: true, estimated: true },
            });
            await debitUsage(billingCtx, {
              functionName: 'liri-smartboard-designer-chat',
              provider, model, unitType: 'tokens_out', unitAmount: outputTokenEstimate,
              metadata: { stream: true, estimated: true },
            });
          } catch (_) { /* debit best-effort */ }
        }
        send({ done: true });
      } catch (e) {
        const msg = (e as Error)?.message || String(e);
        send({ error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
});
