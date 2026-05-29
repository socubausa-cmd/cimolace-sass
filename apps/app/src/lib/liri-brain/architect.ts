/**
 * LIRI Architecte — analyse profonde, structure pédagogique.
 */

import { SYSTEM_LIRI_ARCHITECTE } from './prompts';
import type { BrainRequestContext, IntentClassification, SessionMemory } from './types';
import type { OpenAiChatMessage } from './openai';
import { memoryToPromptBlock } from './memory';

export const ARCHITECT_DEFAULTS = {
  temperature: 0.5,
  max_tokens: 2500,
  model: 'gpt-4o',
} as const;

export function buildArchitectMessages(params: {
  userMessage: string;
  classification: IntentClassification;
  memory: SessionMemory;
  context?: BrainRequestContext | null;
}): OpenAiChatMessage[] {
  const ctx = params.context;
  const ctxParts: string[] = [];
  if (ctx?.sessionTitle) ctxParts.push(`Séance : ${ctx.sessionTitle}`);
  if (ctx?.stepTitle) ctxParts.push(`Étape : ${ctx.stepTitle}`);
  if (ctx?.chatExcerpt) ctxParts.push(`Notes / chat :\n${ctx.chatExcerpt.slice(0, 8000)}`);
  if (ctx?.transcriptSnippet) ctxParts.push(`Transcription :\n${ctx.transcriptSnippet.slice(0, 12000)}`);

  const memoryBlock = memoryToPromptBlock(params.memory);
  const systemParts = [
    SYSTEM_LIRI_ARCHITECTE,
    `Intention : ${params.classification.intent}.`,
    memoryBlock ? `Mémo :\n${memoryBlock}` : '',
    ctxParts.length ? `Contexte :\n${ctxParts.join('\n\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const convo = params.memory.lastMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return [{ role: 'system', content: systemParts }, ...convo, { role: 'user', content: params.userMessage }];
}
