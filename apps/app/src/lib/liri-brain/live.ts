/**
 * LIRI Live IA — surveillance temps réel, résumés, moments importants.
 */

import { LIVE_JSON_SCHEMA_HINT, SYSTEM_LIRI_LIVE_IA } from './prompts';
import type { BrainRequestContext, IntentClassification, SessionMemory } from './types';
import type { OpenAiChatMessage } from './openai';
import { memoryToPromptBlock } from './memory';

export const LIVE_DEFAULTS = {
  temperature: 0.28,
  max_tokens: 900,
  model: 'gpt-4o-mini',
} as const;

export function buildLiveMessages(params: {
  userMessage: string;
  classification: IntentClassification;
  memory: SessionMemory;
  context?: BrainRequestContext | null;
}): OpenAiChatMessage[] {
  const ctx = params.context;
  const ctxParts: string[] = [];
  if (ctx?.sessionTitle) ctxParts.push(`Séance : ${ctx.sessionTitle}`);
  if (ctx?.stepTitle) ctxParts.push(`Étape en cours : ${ctx.stepTitle}`);
  if (ctx?.chatExcerpt) ctxParts.push(`Chat salle :\n${ctx.chatExcerpt.slice(0, 6000)}`);
  if (ctx?.transcriptSnippet) ctxParts.push(`Transcription live :\n${ctx.transcriptSnippet.slice(0, 12000)}`);
  if (ctx?.transcriptPartial) ctxParts.push(`Brouillon STT :\n${String(ctx.transcriptPartial).slice(0, 4000)}`);
  if (ctx?.smartBoardSnapshot) ctxParts.push(`Aperçu SmartBoard : ${ctx.smartBoardSnapshot.slice(0, 2000)}`);

  const memoryBlock = memoryToPromptBlock(params.memory);
  const systemParts = [
    SYSTEM_LIRI_LIVE_IA,
    LIVE_JSON_SCHEMA_HINT,
    `Intention routeur : ${params.classification.intent}.`,
    memoryBlock ? `Mémo courte :\n${memoryBlock}` : '',
    ctxParts.length ? `Contexte temps réel :\n${ctxParts.join('\n\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const convo = params.memory.lastMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return [{ role: 'system', content: systemParts }, ...convo, { role: 'user', content: params.userMessage }];
}
