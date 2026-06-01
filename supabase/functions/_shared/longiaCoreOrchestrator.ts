/**
 * LONGIA Core — orchestration Edge (invisible côté utilisateur) :
 * 1) analyse synchrone du contexte studio (Context Analyzer)
 * 2) résolution d’intention mini-LLM Groq optionnelle (Intent Resolver)
 * 3) injection dans le prompt principal + fusion dans unified.understanding (Response Composer)
 */
/// <reference lib="deno.ns" />
import type { ChatMessage } from './aiClaudeDeepSeekGrok.ts';
import {
  getLongiaLastUserText,
  isLongiaTrivialSocialOrAck,
  type LongiaClientMode,
} from './longiaIntentRouter.ts';
import {
  buildLongiaProRequestFromStudio,
  handleLongiaProRequest,
} from './longiaProCore.ts';

/** `LONGIA_INTENT_GROQ=0|false|off|no` désactive l’appel intent (coach inclus). */
function isIntentGroqDisabledByEnv(envGetter: (k: string) => string): boolean {
  const v = envGetter('LONGIA_INTENT_GROQ').toLowerCase();
  return v === '0' || v === 'false' || v === 'off' || v === 'no';
}

export type LongiaContextAnalysis = {
  designerMode?: string;
  docType?: string;
  studioQuickMode?: string;
  selectionCount: number;
  sceneCount: number;
  activeSceneName?: string | null;
  activeSceneObjectCount: number;
  courseTitle?: string | null;
  courseSlideCount: number;
  activeSlideIndex: number;
  hasSlideObjective: boolean;
};

export type LongiaOrchestrationResult = {
  contextAnalysis: LongiaContextAnalysis;
  intentResolution: Record<string, unknown> | null;
  /** Pré-analyse déterministe FULL_LONGIA_PRO (intent + actions de référence pour le LLM). */
  longiaProDeterministic: Record<string, unknown> | null;
  trace: string[];
};

/** Lecture déterministe du `context` client (pas d’appel modèle). */
export function analyzeLongiaStudioContext(ctx: Record<string, unknown>): LongiaContextAnalysis {
  const sel = ctx.selection as { count?: number } | undefined;
  const scenes = ctx.scenes as { total?: number; activeSceneName?: string | null } | undefined;
  const active = ctx.activeScene as { objectCount?: number } | undefined;
  const course = ctx.course as {
    title?: string | null;
    slideCount?: number;
    activeSlideIndex?: number;
    activeSlideObjective?: string | null;
  } | undefined;

  return {
    designerMode: typeof ctx.designerMode === 'string' ? ctx.designerMode : undefined,
    docType: typeof ctx.docType === 'string' ? ctx.docType : undefined,
    studioQuickMode: typeof ctx.studioQuickMode === 'string' ? ctx.studioQuickMode : undefined,
    selectionCount: typeof sel?.count === 'number' ? sel.count : 0,
    sceneCount: typeof scenes?.total === 'number' ? scenes.total : 0,
    activeSceneName: typeof scenes?.activeSceneName === 'string' ? scenes.activeSceneName : null,
    activeSceneObjectCount: typeof active?.objectCount === 'number' ? active.objectCount : 0,
    courseTitle: course?.title ?? null,
    courseSlideCount: typeof course?.slideCount === 'number' ? course.slideCount : 0,
    activeSlideIndex: typeof course?.activeSlideIndex === 'number' ? course.activeSlideIndex : 0,
    hasSlideObjective: Boolean(course?.activeSlideObjective && String(course.activeSlideObjective).trim()),
  };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(s);
  if (fence) s = fence[1].trim();
  try {
    const o = JSON.parse(s) as unknown;
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function openAICompatChat(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature: number;
}): Promise<string | null> {
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
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === 'string' && text.trim() ? text.trim() : null;
}

const INTENT_SYSTEM = `Tu es le module Intent Resolver de LONGIA (interne, invisible pour l’utilisateur).
Réponds par UN SEUL objet JSON valide, sans markdown ni texte autour :
{"intent":"chat|design|document|analyze|action|create","target":"selection|canvas|course|workspace|unknown","confidence":0.0,"reason_court":"..."}

- intent : chat = conversation/sociale ; design = mise en page / style canvas ; document = courrier/admin/CV ; analyze = analyse ou relecture ; action = manipulation d’objets (grouper, couleur…) ; create = générer nouveau contenu ou structure.
- target : où porte la demande (sélection, canvas, cours…).
- confidence : nombre entre 0 et 1.
- reason_court : français, ≤ 90 caractères, factuel.

Si le message est trop vague, mets intent "chat" et confidence ≤ 0.5.`;

/**
 * Mini-appel Groq — classifie l’intention à partir du dernier message + contexte analysé.
 */
async function groqIntentResolve(
  contextAnalysis: LongiaContextAnalysis,
  lastUserText: string,
  envGetter: (k: string) => string,
): Promise<Record<string, unknown> | null> {
  const key = envGetter('GROQ_API_KEY');
  if (!key) return null;
  const userPayload = `Contexte studio (fiable, JSON) :\n${JSON.stringify(contextAnalysis)}\n\nMessage utilisateur :\n${lastUserText.slice(0, 2800)}`;
  const text = await openAICompatChat({
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: key,
    model: 'llama-3.1-8b-instant',
    system: INTENT_SYSTEM,
    messages: [{ role: 'user', content: userPayload }],
    max_tokens: 220,
    temperature: 0.12,
  });
  if (!text) return null;
  return parseJsonObject(text);
}

export async function runLongiaOrchestration(params: {
  ctx: Record<string, unknown>;
  messages: ChatMessage[];
  envGetter: (k: string) => string;
  /** Mode LLM effectif : en Architect, pas d’intent Groq (le gros modèle suffit, latence moindre). */
  effectiveLlmMode: LongiaClientMode;
}): Promise<LongiaOrchestrationResult> {
  const contextAnalysis = analyzeLongiaStudioContext(params.ctx);
  const trace: string[] = ['context_analyzer'];
  const lastUser = getLongiaLastUserText(params.messages);

  let longiaProDeterministic: Record<string, unknown> | null = null;
  if (lastUser.trim()) {
    try {
      const proInput = buildLongiaProRequestFromStudio(lastUser, params.messages, params.ctx);
      longiaProDeterministic = handleLongiaProRequest(proInput) as unknown as Record<string, unknown>;
      trace.push('longia_pro_pack');
    } catch {
      trace.push('longia_pro_pack_failed');
    }
  } else {
    trace.push('longia_pro_skipped_empty_user');
  }

  let intentResolution: Record<string, unknown> | null = null;

  if (isIntentGroqDisabledByEnv(params.envGetter)) {
    trace.push('intent_resolver_skipped_env_LONGIA_INTENT_GROQ');
  } else if (params.effectiveLlmMode === 'architect') {
    trace.push('intent_resolver_skipped_architect_main_llm');
  } else if (!lastUser.trim()) {
    trace.push('intent_resolver_skipped_empty_user');
  } else if (isLongiaTrivialSocialOrAck(lastUser)) {
    trace.push('intent_resolver_skipped_trivial');
  } else {
    const resolved = await groqIntentResolve(contextAnalysis, lastUser, params.envGetter);
    if (resolved) {
      intentResolution = resolved;
      trace.push('intent_resolver_groq');
    } else {
      trace.push('intent_resolver_failed');
    }
  }

  return { contextAnalysis, intentResolution, longiaProDeterministic, trace };
}

/** Bloc injecté dans le system prompt du modèle principal (coach / architect). */
export function formatLongiaOrchestratorBrief(orch: LongiaOrchestrationResult): string {
  const lines = [
    '### LONGIA Core (interne — l’utilisateur ne voit qu’une seule réponse unifiée)',
    `Contexte analysé : ${JSON.stringify(orch.contextAnalysis)}`,
  ];
  if (orch.longiaProDeterministic) {
    lines.push(
      `Pré-analyse LONGIA Pro (déterministe, pack local) : ${JSON.stringify(orch.longiaProDeterministic)}`,
    );
    lines.push(
      'Tu peux t’en inspirer pour tone_mode / actions / suggestions dans l’enveloppe ; la réponse visible reste conversationnelle et unifiée.',
    );
  }
  if (orch.intentResolution) {
    lines.push(`Intent résolu : ${JSON.stringify(orch.intentResolution)}`);
  } else if (orch.trace.includes('intent_resolver_skipped_architect_main_llm')) {
    lines.push(
      'Intent : déduis-le toi-même (message + contexte) — pas de pré-classifieur léger sur ce chemin Architect.',
    );
  }
  lines.push(
    'Adapte le ton, le contenu et l’enveloppe JSON (actions prioritaires, suggestions complémentaires) à ce contexte et à cet intent. Ne nomme pas d’« orchestrateur » ni de « sous-agents ».',
  );
  lines.push(
    'Ne recopie **pas** ce bloc d’analyse technique en ouverture de ta réponse visible : l’utilisateur doit lire d’abord une réponse **humaine** ; intègre le contexte **implicitement**.',
  );
  return lines.join('\n');
}

/** Fusionne l’orchestration dans body.unified.understanding sans écraser les clés modèle. */
export function applyOrchestrationToLongiaBody(
  body: Record<string, unknown>,
  orch: LongiaOrchestrationResult,
  routing: { requestedMode: string; effectiveMode: string; routingReason: string },
): Record<string, unknown> {
  const unified = body.unified;
  if (!unified || typeof unified !== 'object') return body;
  const u = unified as Record<string, unknown>;
  const prevU = u.understanding;
  const base =
    prevU && typeof prevU === 'object' && !Array.isArray(prevU)
      ? { ...(prevU as Record<string, unknown>) }
      : {};

  const nextUnderstanding = {
    ...base,
    longia_core: {
      studio_context: orch.contextAnalysis,
      intent_resolution: orch.intentResolution,
      longia_pro_pack: orch.longiaProDeterministic,
      pipeline: orch.trace,
      routing: {
        requestedMode: routing.requestedMode,
        effectiveMode: routing.effectiveMode,
        routingReason: routing.routingReason,
      },
    },
  };

  return {
    ...body,
    unified: {
      ...u,
      understanding: nextUnderstanding,
    },
  };
}
