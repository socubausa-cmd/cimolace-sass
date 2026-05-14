/**
 * LIRI Coach — réponses rapides, conversation privée live.
 */

import { SYSTEM_LIRI_COACH } from './prompts';
import type { BrainRequestContext, IntentClassification, SessionMemory } from './types';
import type { OpenAiChatMessage } from './openai';
import { memoryToPromptBlock } from './memory';

export const COACH_DEFAULTS = {
  temperature: 0.4,
  max_tokens: 300,
  model: 'gpt-4o-mini',
} as const;

export function buildCoachMessages(params: {
  userMessage: string;
  classification: IntentClassification;
  memory: SessionMemory;
  context?: BrainRequestContext | null;
}): OpenAiChatMessage[] {
  const ctxParts: string[] = [];
  const ctx = params.context;
  if (ctx?.sessionTitle) ctxParts.push(`Séance : ${ctx.sessionTitle}`);
  if (ctx?.stepTitle) ctxParts.push(`Étape / scène : ${ctx.stepTitle}`);
  if (ctx?.chatExcerpt) ctxParts.push(`Extraits chat salle :\n${ctx.chatExcerpt.slice(0, 4000)}`);
  if (ctx?.transcriptSnippet) ctxParts.push(`Transcription récente :\n${ctx.transcriptSnippet.slice(0, 6000)}`);

  const memoryBlock = memoryToPromptBlock(params.memory);
  const systemParts = [
    SYSTEM_LIRI_COACH,
    `Intention détectée : ${params.classification.intent} (confiance ${params.classification.confidence}).`,
    memoryBlock ? `Mémo session :\n${memoryBlock}` : '',
    ctxParts.length ? `Contexte :\n${ctxParts.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const convo = params.memory.lastMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return [{ role: 'system', content: systemParts }, ...convo, { role: 'user', content: params.userMessage }];
}
