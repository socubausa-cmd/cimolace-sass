/// <reference lib="deno.ns" />

/**
 * NeuronQ — reformulation (remplace Netlify livekit-neuronq-reformulate + liri-neuronq-reformulate).
 *
 * - Sans `userName` (ou vide) : prompt « arène live » → champ `reformulated` (phrase interrogative).
 * - Avec `userName` : prompt messagerie / Q&R → `reformulatedText` (3e personne, prénom).
 *
 * Toujours renvoyer les deux clés pour compatibilité clients.
 */
import { corsHeaders } from '../_shared/cors.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  // @ts-ignore Deno
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore Deno
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let body: { rawText?: string; userName?: string; sessionId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
  const ctx = await resolveTenant(req, body);
  if (!ctx) {
    // Si JWT user présent mais pas de tenant, fail-soft → continue sans billing
    if (!token) {
      return json(401, {
        error: 'TENANT_NOT_RESOLVED',
        message: 'Fournissez X-Liri-Api-Key, X-Tenant-Slug ou un JWT user authentifié',
      });
    }
    // legacy path : valider le user JWT classique
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return json(401, { error: 'Invalid token' });
    }
  }

  const rawText = String(body?.rawText || '').trim();
  const userName = String(body?.userName || '').trim();

  if (!rawText) {
    return json(400, { error: 'rawText requis' });
  }

  const pedagogical = userName.length > 0;

  if (pedagogical && rawText.length > 600) {
    return json(400, { error: 'Question trop longue (max 600 caractères)' });
  }
  if (!pedagogical && rawText.length < 3) {
    return json(400, { error: 'rawText trop court' });
  }

  const displayName = userName || 'Un élève';

  let system: string;
  let userContent: string;
  let max_tokens: number;

  if (pedagogical) {
    system = `Tu es un assistant pédagogique pour la plateforme Prorascience.
Ton rôle est de reformuler les questions d'élèves de façon claire, en une seule phrase nominale à la 3e personne.
Règles :
- Commence par le prénom de l'élève
- Reformule de façon précise et académique sans dénaturer la question
- Maximum 2 lignes
- Pas de point d'interrogation en fin (c'est une reformulation, pas une question directe)
- Langue française uniquement`;
    userContent = `Prenom de l'élève : ${displayName}\nQuestion brute : "${rawText}"\n\nReformulation :`;
    max_tokens = 200;
  } else {
    system = `Tu reformules des questions d'élèves pour les rendre claires et précises.
Règles :
- Une seule phrase interrogative
- Conserve l'intention originale
- Supprime les fautes, abréviations et hésitations
- Réponds UNIQUEMENT avec la question reformulée, sans guillemets ni ponctuation finale`;
    userContent = `Question originale : "${rawText}"`;
    max_tokens = 150;
  }

  // Preflight (best-effort, only if tenant resolved)
  if (ctx) {
    const promptText = system + userContent;
    const estimate = await estimateLlmCost(ctx, 'deepseek', 'deepseek-chat', promptText, max_tokens);
    const reject = await preflightCheck(ctx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), {
        status: reject.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const { text, provider, usage } = await aiChatClaudeDeepSeekGrok({
    system,
    messages: [{ role: 'user', content: userContent }],
    max_tokens,
    temperature: 0.3,
  });

  if (!text) {
    if (pedagogical) {
      const fallback = `${displayName} souhaite comprendre : ${rawText}`;
      return json(200, {
        reformulatedText: fallback,
        reformulated: fallback,
        fallback: true,
      });
    }
    return json(200, { reformulated: rawText, reformulatedText: rawText });
  }

  const out = text.trim();

  // ─── LIRI Credits — Débit ────────────────────────────────────────────────
  let billingInfo: Record<string, unknown> | undefined;
  if (ctx && usage) {
    const debitIn = await debitUsage(ctx, {
      functionName: 'neuronq-reformulate',
      provider: usage.provider,
      model: usage.model,
      unitType: 'tokens_in',
      unitAmount: usage.tokens_in,
      sessionId: body.sessionId,
      metadata: { pedagogical },
    });
    const debitOut = await debitUsage(ctx, {
      functionName: 'neuronq-reformulate',
      provider: usage.provider,
      model: usage.model,
      unitType: 'tokens_out',
      unitAmount: usage.tokens_out,
      sessionId: body.sessionId,
    });
    billingInfo = {
      provider: usage.provider,
      model: usage.model,
      tokens_in: usage.tokens_in,
      tokens_out: usage.tokens_out,
      credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
      balance: debitOut.balance ?? debitIn.balance,
    };
  }

  return json(200, {
    reformulated: out,
    reformulatedText: out,
    provider,
    ...(billingInfo ? { _billing: billingInfo } : {}),
  });
});
