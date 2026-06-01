/**
 * FULL_LONGIA_PRO — couche déterministe (local `image membre de isna/FULL_LONGIA_PRO/backend/longia-core.ts`).
 * Sert de pré-analyse + actions suggérées pour guider le LLM (studio-longia-chat) sans remplacer la réponse modèle.
 */
/// <reference lib="deno.ns" />
import type { ChatMessage } from './aiClaudeDeepSeekGrok.ts';

export type LongiaProIntent =
  | 'social_greeting'
  | 'general_help'
  | 'create_document'
  | 'create_visual'
  | 'selection_action'
  | 'tool_help'
  | 'rewrite_text'
  | 'import_rebuild'
  | 'live_assistance'
  | 'app_control'
  | 'unknown';

export type LongiaProMode =
  | 'human'
  | 'coach'
  | 'architect'
  | 'action'
  | 'live'
  | 'app_control'
  | 'vision'
  | 'fallback';

export interface LongiaProRequest {
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  sceneContext: Record<string, unknown>;
}

export interface LongiaProResponse {
  tone_mode: LongiaProMode;
  message: string;
  understanding: {
    intent: LongiaProIntent;
    target?: string;
    selectionType: string;
    appContext?: string;
    confidence: number;
  };
  strategy: string;
  actions: Array<{ id: string; label: string; action: string; variant?: string }>;
  suggestions: Array<unknown>;
}

function analyzeContext(input: LongiaProRequest) {
  const msg = input.userMessage.toLowerCase().trim();
  const selection = input.sceneContext?.selection as { count?: number; type?: string } | undefined;
  const appCtx = input.sceneContext?.appContext as
    | { embeddedControlActive?: boolean; appName?: string }
    | undefined;
  const liveCtx = input.sceneContext?.liveContext as { enabled?: boolean; role?: string } | undefined;
  return {
    userMessageLower: msg,
    hasSelection: Boolean(selection && typeof selection.count === 'number' && selection.count > 0),
    selectionType: selection?.type ?? 'none',
    isGreeting: /(bonjour|salut|hello|bonsoir)/i.test(msg),
    hasEmbeddedApp: Boolean(appCtx?.embeddedControlActive),
    appName: appCtx?.appName,
    isLive: Boolean(liveCtx?.enabled),
    liveRole: liveCtx?.role,
    quickMode: (input.sceneContext?.quickMode as string) ?? (input.sceneContext?.studioQuickMode as string) ?? 'auto',
  };
}

function resolveIntent(ctx: ReturnType<typeof analyzeContext>): {
  type: LongiaProIntent;
  confidence: number;
  target?: string;
  desiredShape?: string;
} {
  const msg = ctx.userMessageLower;
  if (ctx.isGreeting) return { type: 'social_greeting', confidence: 0.99 };
  if (ctx.hasSelection && /(transforme|convertis|mets en|groupe|aligne)/i.test(msg)) {
    let desiredShape: string | undefined;
    if (msg.includes('cercle')) desiredShape = 'circle';
    return {
      type: 'selection_action',
      confidence: 0.95,
      target: ctx.selectionType,
      desiredShape,
    };
  }
  if (ctx.hasEmbeddedApp && /(titre|tableau|insère|ajoute|écris)/i.test(msg)) {
    return { type: 'app_control', confidence: 0.93, target: ctx.appName };
  }
  if (ctx.isLive) return { type: 'live_assistance', confidence: 0.88, target: ctx.liveRole };
  if (/(crée|génère|document|lettre|cv|contrat)/i.test(msg)) {
    return { type: 'create_document', confidence: 0.9 };
  }
  if (/(affiche|visuel|infographie|image|poster)/i.test(msg)) {
    return { type: 'create_visual', confidence: 0.87 };
  }
  if (/(pdf|reproduis|reconstruis|import|capture)/i.test(msg)) {
    return { type: 'import_rebuild', confidence: 0.85 };
  }
  if (/(explique|comment|outil|aide|perdu)/i.test(msg)) {
    return { type: 'tool_help', confidence: 0.8 };
  }
  return { type: 'unknown', confidence: 0.4 };
}

function routeMode(
  ctx: ReturnType<typeof analyzeContext>,
  intent: ReturnType<typeof resolveIntent>,
): LongiaProMode {
  if (intent.type === 'social_greeting') return 'human';
  if (intent.type === 'selection_action') return 'action';
  if (intent.type === 'app_control') return 'app_control';
  if (intent.type === 'live_assistance') return 'live';
  if (intent.type === 'import_rebuild') return 'vision';
  if (intent.type === 'create_document' || intent.type === 'create_visual') return 'architect';
  if (intent.type === 'tool_help' || intent.type === 'rewrite_text') return 'coach';
  if (ctx.quickMode === 'architect') return 'architect';
  if (ctx.quickMode === 'coach') return 'coach';
  return 'fallback';
}

function agent(
  mode: LongiaProMode,
  ctx: ReturnType<typeof analyzeContext>,
  intent: ReturnType<typeof resolveIntent>,
): { message: string; actions: LongiaProResponse['actions']; suggestions?: unknown[] } {
  if (mode === 'human') {
    return {
      message:
        'Bonjour 👋 Je suis là. Tu veux créer quelque chose, contrôler une app, ou continuer ton live ?',
      actions: [
        { id: 'a1', label: 'Créer un document', action: 'generate_document', variant: 'primary' },
        { id: 'a2', label: 'Créer un visuel', action: 'generate_visual', variant: 'secondary' },
        { id: 'a3', label: "Contrôler l'app", action: 'focus_embedded_app', variant: 'secondary' },
      ],
    };
  }
  if (mode === 'action') {
    return {
      message:
        intent.desiredShape === 'circle'
          ? "J'ai compris. Tu veux transformer l'élément sélectionné en cercle."
          : "J'ai compris que tu veux agir sur la sélection active.",
      actions:
        intent.desiredShape === 'circle'
          ? [
              {
                id: 'a1',
                label: 'Transformer en cercle',
                action: 'convert_selected_to_circle',
                variant: 'primary',
              },
              {
                id: 'a2',
                label: 'Voir aperçu',
                action: 'preview_convert_selected_to_circle',
                variant: 'secondary',
              },
            ]
          : [{ id: 'a1', label: 'Voir actions compatibles', action: 'show_selection_actions', variant: 'primary' }],
    };
  }
  if (mode === 'app_control') {
    return {
      message: `Je peux piloter ${ctx.appName ?? "l'application"} depuis LIRI sans quitter le live.`,
      actions: [
        { id: 'a1', label: 'Créer un titre', action: 'app_create_title', variant: 'primary' },
        { id: 'a2', label: 'Insérer un tableau', action: 'app_insert_table', variant: 'secondary' },
      ],
    };
  }
  if (mode === 'live') {
    return {
      message:
        ctx.liveRole === 'teacher'
          ? 'Je peux t’aider à gouverner le live.'
          : 'Je peux t’aider à suivre le live.',
      actions:
        ctx.liveRole === 'teacher'
          ? [{ id: 'a1', label: 'Voir notifications LONGIA', action: 'open_live_notifications', variant: 'primary' }]
          : [{ id: 'a1', label: 'Expliquer simplement', action: 'guest_simplify_live_topic', variant: 'primary' }],
    };
  }
  if (mode === 'architect') {
    return {
      message: 'Je peux te générer ça proprement.',
      actions: [
        {
          id: 'a1',
          label: 'Générer maintenant',
          action: intent.type === 'create_visual' ? 'generate_visual' : 'generate_document',
          variant: 'primary',
        },
      ],
    };
  }
  if (mode === 'vision') {
    return {
      message: 'Je peux analyser ce fichier et proposer une reconstruction éditable.',
      actions: [{ id: 'a1', label: 'Analyser', action: 'analyze_import', variant: 'primary' }],
    };
  }
  if (mode === 'coach') {
    return {
      message: 'Je peux t’aider pas à pas.',
      actions: [{ id: 'a1', label: 'Expliquer l’outil actif', action: 'explain_active_tool', variant: 'primary' }],
    };
  }
  return {
    message: 'Je peux quand même te proposer un bon point de départ.',
    actions: [{ id: 'a1', label: 'Créer', action: 'fallback_create_flow', variant: 'primary' }],
  };
}

/** Entrée alignée sur le `context` envoyé par le Studio / LiveHost drawer. */
export function buildLongiaProRequestFromStudio(
  userMessage: string,
  messages: ChatMessage[],
  ctx: Record<string, unknown>,
): LongiaProRequest {
  const history = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  const sel = ctx.selection as { count?: number; type?: string } | undefined;
  const countFromCtx = typeof sel?.count === 'number' ? sel.count : undefined;
  const countFromFlat = typeof ctx.selectionCount === 'number' ? (ctx.selectionCount as number) : 0;
  const count = countFromCtx ?? countFromFlat;
  const sceneContext: Record<string, unknown> = {
    ...ctx,
    selection: sel ?? { count, type: count > 0 ? 'items' : 'none' },
    appContext: (ctx.appContext as Record<string, unknown>) ?? (ctx.embeddedApp as Record<string, unknown>) ?? {},
    liveContext: (ctx.liveContext as Record<string, unknown>) ?? {},
    quickMode: (ctx.studioQuickMode as string) ?? (ctx.quickMode as string) ?? 'auto',
  };
  return {
    userMessage,
    history: history.slice(-12),
    sceneContext,
  };
}

export function handleLongiaProRequest(input: LongiaProRequest): LongiaProResponse {
  const ctx = analyzeContext(input);
  const intent = resolveIntent(ctx);
  const mode = routeMode(ctx, intent);
  const out = agent(mode, ctx, intent);
  return {
    tone_mode: mode,
    message: out.message,
    understanding: {
      intent: intent.type,
      target: intent.target,
      selectionType: ctx.selectionType,
      appContext: ctx.appName,
      confidence: intent.confidence,
    },
    strategy: `${mode}_response`,
    actions: out.actions ?? [],
    suggestions: out.suggestions ?? [],
  };
}
