/// <reference lib="deno.ns" />
/**
 * Logique commune : profils pédagogiques → chaîne LLM → JSON cours LIRI.
 * Utilisé par `liri-agent-course-generate` et `liri-formation-engine`.
 */

import { LIRI_AGENT_COURSE_PROMPT_VERSION } from './liriAgentCoursePrompt.ts';
import { corsHeaders } from './cors.ts';
import { LIRI_PIPELINE_SPEC_VERSION } from './liriPipelineSpec.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from './aiBilling.ts';

const SUJET_MAX_CHARS = 24_000;

type ProfilPedagogique =
  | 'maitre_pedagogue'
  | 'architecte'
  | 'cours_rapide'
  | 'assistant_eco'
  | 'auto';

type ProviderKind = 'anthropic' | 'openai' | 'grok' | 'deepseek';

const PROFIL_LABELS: Record<ProfilPedagogique, string> = {
  maitre_pedagogue: 'Maître Pédagogue',
  architecte: 'Architecte du Cours',
  cours_rapide: 'Cours Rapide',
  assistant_eco: 'Assistant Éco',
  auto: 'Mode Auto',
};

const MOTEUR_TO_PEDAGOGIE: Record<ProviderKind, string> = {
  anthropic: 'Maître Pédagogue',
  openai: 'Architecte du Cours',
  grok: 'Cours Rapide',
  deepseek: 'Assistant Éco',
};

function normalizeProfil(raw: unknown): ProfilPedagogique {
  const s = String(raw ?? 'maitre_pedagogue').trim().toLowerCase();
  const map: Record<string, ProfilPedagogique> = {
    maitre_pedagogue: 'maitre_pedagogue',
    architecte: 'architecte',
    cours_rapide: 'cours_rapide',
    assistant_eco: 'assistant_eco',
    auto: 'auto',
    maitre: 'maitre_pedagogue',
    dialogue: 'architecte',
    allure: 'cours_rapide',
  };
  return map[s] ?? 'maitre_pedagogue';
}

type EngineAttempt = {
  kind: ProviderKind;
  model: string;
};

function extractJsonObject(text: string): Record<string, unknown> | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  let s = raw;
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function bearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const t = String(headerValue).replace(/^Bearer\s+/i, '').trim();
  return t || null;
}

function chatBaseUrl(kind: ProviderKind): string {
  switch (kind) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'grok':
      return 'https://api.x.ai/v1';
    case 'deepseek':
      return 'https://api.deepseek.com';
    default:
      return 'https://api.openai.com/v1';
  }
}

async function fetchAnthropicText(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  signal: AbortSignal;
}): Promise<{ ok: boolean; text: string; status: number; errMsg?: string; tokens_in?: number; tokens_out?: number }> {
  const { apiKey, model, system, user, maxTokens, signal } = params;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.35,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const payload = await res.json().catch(() => ({})) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      ok: false,
      text: '',
      status: res.status,
      errMsg: payload?.error?.message || `Anthropic HTTP ${res.status}`,
    };
  }
  const text = (payload.content || [])
    .map((b) => (b.type === 'text' ? b.text || '' : ''))
    .join('');
  return {
    ok: true,
    text,
    status: res.status,
    tokens_in: payload?.usage?.input_tokens ?? 0,
    tokens_out: payload?.usage?.output_tokens ?? 0,
  };
}

async function fetchChatCompletionsText(params: {
  kind: ProviderKind;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  signal: AbortSignal;
}): Promise<{ ok: boolean; text: string; status: number; errMsg?: string; tokens_in?: number; tokens_out?: number }> {
  const { kind, apiKey, model, system, user, maxTokens, signal } = params;
  const baseUrl = chatBaseUrl(kind);
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const payload = await res.json().catch(() => ({})) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      ok: false,
      text: '',
      status: res.status,
      errMsg: payload?.error?.message || `HTTP ${res.status}`,
    };
  }
  const text = String(payload?.choices?.[0]?.message?.content ?? '');
  return {
    ok: true,
    text,
    status: res.status,
    tokens_in: payload?.usage?.prompt_tokens ?? 0,
    tokens_out: payload?.usage?.completion_tokens ?? 0,
  };
}

async function runEngine(
  att: EngineAttempt,
  keys: {
    anthropic: string;
    openai: string;
    grok: string;
    deepseek: string;
  },
  system: string,
  user: string,
  maxTokens: number,
  signal: AbortSignal,
): Promise<{ ok: boolean; text: string; errMsg?: string; tokens_in?: number; tokens_out?: number }> {
  if (att.kind === 'grok' && !keys.grok) {
    return { ok: false, text: '', errMsg: 'no key' };
  }
  if (att.kind === 'deepseek' && !keys.deepseek) {
    return { ok: false, text: '', errMsg: 'no key' };
  }
  if (att.kind === 'anthropic' && !keys.anthropic) {
    return { ok: false, text: '', errMsg: 'no key' };
  }
  if (att.kind === 'openai' && !keys.openai) {
    return { ok: false, text: '', errMsg: 'no key' };
  }

  if (att.kind === 'anthropic') {
    const r = await fetchAnthropicText({
      apiKey: keys.anthropic,
      model: att.model,
      system,
      user,
      maxTokens,
      signal,
    });
    return r.ok
      ? { ok: true, text: r.text, tokens_in: r.tokens_in, tokens_out: r.tokens_out }
      : { ok: false, text: '', errMsg: r.errMsg };
  }

  const key =
    att.kind === 'openai'
      ? keys.openai
      : att.kind === 'grok'
        ? keys.grok
        : keys.deepseek;
  const r = await fetchChatCompletionsText({
    kind: att.kind,
    apiKey: key,
    model: att.model,
    system,
    user,
    maxTokens,
    signal,
  });
  return r.ok
    ? { ok: true, text: r.text, tokens_in: r.tokens_in, tokens_out: r.tokens_out }
    : { ok: false, text: '', errMsg: r.errMsg };
}

function buildModels() {
  // @ts-ignore Deno
  const env = (k: string, d: string) => String(Deno.env.get(k) || d).trim();
  return {
    anthropic: env('LIRI_AGENT_ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
    anthropicFast: env('LIRI_AGENT_ANTHROPIC_FAST_MODEL', 'claude-haiku-4-5'),
    openai: env('LIRI_AGENT_OPENAI_MODEL', 'gpt-4o'),
    openaiFast: env('LIRI_AGENT_OPENAI_FAST_MODEL', 'gpt-4o-mini'),
    grok: env('LIRI_AGENT_GROK_MODEL', 'grok-3-mini'),
    deepseek: env('LIRI_AGENT_DEEPSEEK_MODEL', 'deepseek-chat'),
  };
}

function buildAttemptChain(
  profil: ProfilPedagogique,
  m: ReturnType<typeof buildModels>,
): EngineAttempt[] {
  const { anthropic, anthropicFast, openai, openaiFast, grok, deepseek } = m;

  const chains: Record<ProfilPedagogique, EngineAttempt[]> = {
    maitre_pedagogue: [
      { kind: 'anthropic', model: anthropic },
      { kind: 'openai', model: openai },
      { kind: 'grok', model: grok },
      { kind: 'deepseek', model: deepseek },
      { kind: 'openai', model: openaiFast },
      { kind: 'anthropic', model: anthropicFast },
    ],
    architecte: [
      { kind: 'openai', model: openai },
      { kind: 'anthropic', model: anthropic },
      { kind: 'grok', model: grok },
      { kind: 'deepseek', model: deepseek },
      { kind: 'openai', model: openaiFast },
    ],
    cours_rapide: [
      { kind: 'grok', model: grok },
      { kind: 'openai', model: openaiFast },
      { kind: 'anthropic', model: anthropicFast },
      { kind: 'deepseek', model: deepseek },
      { kind: 'openai', model: openai },
    ],
    assistant_eco: [
      { kind: 'deepseek', model: deepseek },
      { kind: 'openai', model: openaiFast },
      { kind: 'grok', model: grok },
      { kind: 'anthropic', model: anthropicFast },
    ],
    auto: [
      { kind: 'anthropic', model: anthropic },
      { kind: 'openai', model: openai },
      { kind: 'grok', model: grok },
      { kind: 'deepseek', model: deepseek },
      { kind: 'openai', model: openaiFast },
      { kind: 'anthropic', model: anthropicFast },
    ],
  };
  return chains[profil];
}

export type LiriCourseLlmHandlerOptions = {
  systemPrompt: string;
  /** Préfixe des logs et messages console, ex. `liri-agent-course-generate` */
  logPrefix: string;
  /** Si true, ajoute `meta.pipeline` (spec v2 + version prompt cours). */
  includePipelineMeta?: boolean;
};

export async function handleLiriCourseLlmRequest(
  req: Request,
  opts: LiriCourseLlmHandlerOptions,
): Promise<Response> {
  const { systemPrompt, logPrefix, includePipelineMeta } = opts;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // @ts-ignore - Deno runtime
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore - Deno runtime
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const token =
    bearerToken(req.headers.get('x-user-jwt')) ||
    bearerToken(req.headers.get('Authorization'));
  if (!token) {
    return jsonResponse(401, { error: 'Missing Authorization' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    return jsonResponse(401, { error: 'Invalid token' });
  }

  let body: {
    sujet?: string;
    niveau?: string;
    contexte?: string;
    profil_pedagogique?: string;
    pipeline?: { version?: string };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonResponse(400, { error: 'Corps JSON invalide' });
  }

  const sujet = String(body.sujet || '').trim();
  const niveau = String(body.niveau || 'intermédiaire').trim();
  const contexte = String(body.contexte || 'Prorascience').trim();
  const profil = normalizeProfil(body.profil_pedagogique);

  if (!sujet) {
    return jsonResponse(400, { error: 'sujet requis' });
  }
  if (sujet.length > SUJET_MAX_CHARS) {
    return jsonResponse(400, {
      error: `Sujet trop long (max ${SUJET_MAX_CHARS.toLocaleString('fr-FR')} caractères)`,
    });
  }

  // @ts-ignore - Deno runtime
  const keys = {
    anthropic: String(Deno.env.get('ANTHROPIC_API_KEY') || '').trim(),
    openai: String(Deno.env.get('OPENAI_API_KEY') || '').trim(),
    grok: String(Deno.env.get('XAI_API_KEY') || '').trim(),
    deepseek: String(Deno.env.get('DEEPSEEK_API_KEY') || '').trim(),
  };

  const models = buildModels();
  // @ts-ignore - Deno runtime
  const maxTokensEnv = Number(Deno.env.get('LIRI_AGENT_MAX_TOKENS')) || 6000;
  const maxTokens = Math.min(8192, Math.max(1024, maxTokensEnv));

  const userPrompt = `Sujet : "${sujet}"
Niveau : ${niveau}
Contexte doctrinal : ${contexte}

Génère le parcours LIRI complet en JSON.`;

  // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
  const ctx = await resolveTenant(req, body);
  if (ctx) {
    const provGuess = profil === 'assistant_eco' ? 'deepseek' : 'anthropic';
    const modelGuess = profil === 'assistant_eco' ? models.deepseek : models.anthropic;
    const estimate = await estimateLlmCost(ctx, provGuess, modelGuess, systemPrompt + userPrompt, maxTokensEnv);
    const reject = await preflightCheck(ctx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), {
        status: reject.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const attempts = buildAttemptChain(profil, models);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 150_000);

  const selectionLabel = PROFIL_LABELS[profil];
  let lastError = '';

  try {
    for (let i = 0; i < attempts.length; i++) {
      const att = attempts[i];
      const result = await runEngine(
        att,
        keys,
        systemPrompt,
        userPrompt,
        maxTokens,
        controller.signal,
      );

      if (!result.ok) {
        if (result.errMsg === 'no key') {
          console.warn(`[${logPrefix}] skip ${att.kind} (no API key)`);
          lastError = 'Clé API manquante pour une étape du secours.';
          continue;
        }
        console.error(`[${logPrefix}]`, att.kind, att.model, result.errMsg);
        lastError = result.errMsg || 'Erreur fournisseur';
        continue;
      }

      const parsed = extractJsonObject(result.text);
      if (!parsed || typeof parsed !== 'object') {
        lastError = 'Réponse IA non JSON exploitable';
        continue;
      }
      if (!Array.isArray(parsed.etapes) || parsed.etapes.length < 1) {
        lastError = 'Structure du cours incorrecte (etapes manquantes)';
        continue;
      }

      const renduPedagogie = MOTEUR_TO_PEDAGOGIE[att.kind];
      const meta: Record<string, unknown> = {
        profil_demande: profil,
        profil_demande_label: selectionLabel,
        profil_rendu_label: renduPedagogie,
      };

      if (includePipelineMeta) {
        meta.pipeline = {
          spec_version: LIRI_PIPELINE_SPEC_VERSION,
          course_prompt_version: LIRI_AGENT_COURSE_PROMPT_VERSION,
        };
      }

      if (profil === 'auto') {
        meta.bascule = false;
        meta.message =
          `Mode Auto : rendu aligné sur le profil « ${renduPedagogie} » (meilleur moteur disponible).`;
      } else {
        const bascule =
          renduPedagogie !== selectionLabel || i > 0;
        meta.bascule = bascule;
        if (bascule) {
          meta.message =
            `Votre choix : « ${selectionLabel} ». Génération avec le profil « ${renduPedagogie} »` +
            (i > 0 ? ' (étape précédente indisponible ou en erreur).' : '.');
        }
      }

      // ─── LIRI Credits — Débit ────────────────────────────────────────────
      let billingInfo: Record<string, unknown> | undefined;
      if (ctx && (result.tokens_in || result.tokens_out)) {
        const provName = att.kind; // 'anthropic'|'openai'|'grok'|'deepseek'
        const debitIn = await debitUsage(ctx, {
          functionName: logPrefix, provider: provName, model: att.model,
          unitType: 'tokens_in', unitAmount: result.tokens_in || 0,
          metadata: { profil, niveau },
        });
        const debitOut = await debitUsage(ctx, {
          functionName: logPrefix, provider: provName, model: att.model,
          unitType: 'tokens_out', unitAmount: result.tokens_out || 0,
        });
        billingInfo = {
          provider: provName, model: att.model,
          tokens_in: result.tokens_in || 0, tokens_out: result.tokens_out || 0,
          credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
          balance: debitOut.balance ?? debitIn.balance,
        };
      }

      return jsonResponse(200, {
        cours: parsed,
        meta,
        ...(billingInfo ? { _billing: billingInfo } : {}),
      });
    }

    const anyKey = keys.anthropic || keys.openai || keys.grok || keys.deepseek;
    if (!anyKey) {
      return jsonResponse(503, {
        error: 'Aucun moteur de génération configuré',
        details:
          'Configurez au moins une clé : ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, DEEPSEEK_API_KEY.',
      });
    }

    return jsonResponse(502, {
      error: 'Génération impossible — réessayez',
      details: lastError || 'Tous les moteurs disponibles ont échoué.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort')) {
      return jsonResponse(504, { error: 'Délai dépassé — réessayez avec un texte plus court.' });
    }
    console.error(`[${logPrefix}]`, message);
    return jsonResponse(500, { error: 'Erreur IA — réessayez', details: message });
  } finally {
    clearTimeout(timeoutId);
  }
}
