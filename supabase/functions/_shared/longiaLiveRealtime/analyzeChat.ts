export type ChatEvent = {
  message: string;
  authorId?: string;
  timestampMs?: number;
};

export function analyzeChat(events: ChatEvent[], _roomContext: Record<string, unknown>) {
  const grouped = new Map<string, number>();
  for (const evt of events) {
    const normalized = (evt.message || '').trim().toLowerCase();
    if (!normalized) continue;
    grouped.set(normalized, (grouped.get(normalized) || 0) + 1);
  }

  const signals: Array<Record<string, unknown>> = [];
  for (const [question, count] of grouped.entries()) {
    if (count >= 2) {
      signals.push({
        type: 'chat',
        code: 'repeated_question_cluster',
        title: 'Questions regroupées',
        message: `${count} messages portent sur le même point.`,
        question,
        count,
      });
    }
  }
  return signals;
}
