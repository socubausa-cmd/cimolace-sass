/**
 * LIRI Brain — orchestrateur central (Coach · Architecte · Live IA).
 */

import { ARCHITECT_DEFAULTS, buildArchitectMessages } from './architect';
import { COACH_DEFAULTS, buildCoachMessages } from './coach';
import { LIVE_DEFAULTS, buildLiveMessages } from './live';
import { appendAssistantMessage, appendUserMessage, createEmptyMemory, trimMessages } from './memory';
import { openaiChatCompletionStream, openaiChatCompletionSync } from './openai';
import { MODEL_FAST, classifyIntent, chooseBrainAndIntent } from './router';
import {
  appendDoneEvent,
  encodeError,
  encodeSseLine,
  transformOpenAiSseToBrainTokens,
} from './streaming';
import type { BrainRouteInput, IntentClassification, LiriStructuredOutput, SessionMemory } from './types';

export * from './types';
export * from './prompts';
export * from './actions';
export * from './memory';
export * from './router';
export * from './coach';
export * from './architect';
export * from './live';
export * from './openai';
export * from './streaming';
export { useLiriBrainClient } from './useLiriBrainClient';
export { resolveLiriBrainEndpoint, invokeLiriBrainStream } from './invokeBrowser';
export { adaptBrainToCoachGuestShape } from './brainCoachAdapter';

const ARCHITECT_ABORT_MS = 22_000;

function abortAfter(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

function resolveRuntimeParams(brain: IntentClassification['brain'], cls: IntentClassification) {
  if (brain === 'architect') {
    return {
      temperature: ARCHITECT_DEFAULTS.temperature,
      max_tokens: ARCHITECT_DEFAULTS.max_tokens,
      model: cls.model || ARCHITECT_DEFAULTS.model,
    };
  }
  if (brain === 'live') {
    return {
      temperature: LIVE_DEFAULTS.temperature,
      max_tokens: LIVE_DEFAULTS.max_tokens,
      model: cls.model || LIVE_DEFAULTS.model,
    };
  }
  return {
    temperature: COACH_DEFAULTS.temperature,
    max_tokens: COACH_DEFAULTS.max_tokens,
    model: cls.model || COACH_DEFAULTS.model,
  };
}

function buildMessagesForBrain(
  input: BrainRouteInput,
  cls: IntentClassification,
  memory: SessionMemory,
): ReturnType<typeof buildCoachMessages> {
  const ctx = input.context ?? undefined;
  switch (cls.brain) {
    case 'architect':
      return buildArchitectMessages({
        userMessage: input.message,
        classification: cls,
        memory,
        context: ctx,
      });
    case 'live':
      return buildLiveMessages({
        userMessage: input.message,
        classification: cls,
        memory,
        context: ctx,
      });
    default:
      return buildCoachMessages({
        userMessage: input.message,
        classification: cls,
        memory,
        context: ctx,
      });
  }
}

/**
 * Flux SSE applicatif (`token` puis `done`) — à brancher sur une route HTTP POST.
 */
export async function createBrainResponseStream(
  input: BrainRouteInput,
  apiKey: string,
): Promise<ReadableStream<Uint8Array>> {
  const base = classifyIntent(input.message);
  const cls = chooseBrainAndIntent(input.message, input.mode, base);
  const memory = trimMessages(
    createEmptyMemory({
      sessionId: input.sessionId,
      userId: input.userId ?? null,
      liveId: input.liveId ?? null,
      ...input.memory,
      lastMessages: input.memory?.lastMessages ?? [],
    }),
  );

  const msgsForPrompt = appendUserMessage(memory, input.message);
  const rt = resolveRuntimeParams(cls.brain, cls);
  const messages = buildMessagesForBrain(input, cls, msgsForPrompt);

  const sink = { fullText: '' };

  try {
    const openAiStream = await openaiChatCompletionStream({
      apiKey,
      model: rt.model,
      messages,
      temperature: rt.temperature,
      max_tokens: rt.max_tokens,
      signal: cls.brain === 'architect' ? abortAfter(ARCHITECT_ABORT_MS) : undefined,
    });

    const tokens = transformOpenAiSseToBrainTokens(openAiStream, sink);

    const finalStructured = (): LiriStructuredOutput => ({
      brain: cls.brain,
      intent: cls.intent,
      answer: sink.fullText,
      actions: [],
      notes: [],
      suggestions: [],
      confidence: cls.confidence,
    });

    return appendDoneEvent(tokens, finalStructured);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    /* Fallback rapide si Architecte trop lent ou erreur réseau */
    if (cls.brain === 'architect') {
      try {
        const fallbackText = await openaiChatCompletionSync({
          apiKey,
          model: MODEL_FAST,
          messages: [
            ...messages.slice(0, 1),
            {
              role: 'user',
              content: `${input.message}\n\n(Demande : réponse condensée — analyse approfondie disponible sur demande.)`,
            },
          ],
          temperature: 0.35,
          max_tokens: 600,
        });

        const structured: LiriStructuredOutput = {
          brain: 'architect',
          intent: cls.intent,
          answer: fallbackText,
          actions: [],
          notes: ['Réponse rapide (gpt-4o-mini). Une analyse plus poussée peut être relancée.'],
          suggestions: ['Relancer avec « analyse détaillée » si besoin.'],
          confidence: Math.min(cls.confidence, 0.75),
        };

        const encoder = new TextEncoder();
        return new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(encodeSseLine({ type: 'token', text: fallbackText })));
            controller.enqueue(encoder.encode(encodeSseLine({ type: 'done', structured })));
            controller.close();
          },
        });
      } catch {
        // fall through erreur générique
      }
    }

    return new ReadableStream({
      start(controller) {
        controller.enqueue(encodeError(errMsg));
        controller.close();
      },
    });
  }
}

/** Utilitaire : mémoire après réponse assistant (côté client). */
export function applyAssistantToMemory(
  memory: SessionMemory,
  userLine: string,
  assistantLine: string,
): SessionMemory {
  return trimMessages(appendAssistantMessage(appendUserMessage(memory, userLine), assistantLine));
}
