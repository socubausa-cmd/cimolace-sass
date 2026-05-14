/**
 * Mémoire courte de session — limite tokens / historique.
 */

import type { SessionMemory } from './types';

const MAX_MESSAGES = 10;
const MAX_LIST_ITEMS = 12;

export function createEmptyMemory(partial: Partial<SessionMemory> & Pick<SessionMemory, 'sessionId'>): SessionMemory {
  return {
    sessionId: partial.sessionId,
    userId: partial.userId ?? null,
    liveId: partial.liveId ?? null,
    lastMessages: partial.lastMessages?.slice(-MAX_MESSAGES) ?? [],
    currentTopic: partial.currentTopic ?? null,
    currentSlide: partial.currentSlide ?? null,
    keyPoints: capList(partial.keyPoints),
    questions: capList(partial.questions),
    summaries: capList(partial.summaries),
    actions: capList(partial.actions),
  };
}

function capList(arr?: string[] | null): string[] {
  if (!arr?.length) return [];
  return arr.slice(-MAX_LIST_ITEMS);
}

export function trimMessages(memory: SessionMemory): SessionMemory {
  return {
    ...memory,
    lastMessages: memory.lastMessages.slice(-MAX_MESSAGES),
    keyPoints: capList(memory.keyPoints),
    questions: capList(memory.questions),
    summaries: capList(memory.summaries),
    actions: capList(memory.actions),
  };
}

export function appendUserMessage(memory: SessionMemory, content: string): SessionMemory {
  const next = {
    ...memory,
    lastMessages: [...memory.lastMessages, { role: 'user' as const, content }],
  };
  return trimMessages(next);
}

export function appendAssistantMessage(memory: SessionMemory, content: string): SessionMemory {
  const next = {
    ...memory,
    lastMessages: [...memory.lastMessages, { role: 'assistant' as const, content }],
  };
  return trimMessages(next);
}

/** Résumé textuel compact injecté dans le prompt (pas tout l’historique). */
export function memoryToPromptBlock(memory: SessionMemory): string {
  const lines: string[] = [];
  if (memory.currentTopic) lines.push(`Sujet en cours : ${memory.currentTopic}`);
  if (memory.currentSlide != null) lines.push(`Slide : ${memory.currentSlide}`);
  if (memory.keyPoints.length) lines.push(`Points clés : ${memory.keyPoints.slice(-5).join(' · ')}`);
  if (memory.summaries.length) lines.push(`Derniers résumés : ${memory.summaries.slice(-2).join(' | ')}`);
  return lines.join('\n');
}
