export type TranscriptChunk = {
  text: string;
  startMs?: number;
  endMs?: number;
};

export function analyzeTranscript(chunk: TranscriptChunk, roomContext: Record<string, unknown>) {
  const text = (chunk.text || '').trim();
  const lower = text.toLowerCase();
  const signals: Array<Record<string, unknown>> = [];

  if (!text) return signals;

  if (lower.includes('définition') || lower.includes('cela signifie')) {
    signals.push({
      type: 'content',
      code: 'definition_detected',
      title: 'Définition détectée',
      message: 'Un passage définitoire vient d’être énoncé.',
      excerpt: text,
      tier: 'final',
      strength: 'normal',
    });
  }

  if (!lower.includes('par exemple') && (lower.includes(' est ') || lower.includes(' sont '))) {
    signals.push({
      type: 'pedagogical',
      code: 'possible_missing_example',
      title: 'Exemple possible à ajouter',
      message: 'Le passage semble conceptuel. Un exemple pourrait aider.',
      excerpt: text,
      tier: 'final',
      strength: 'normal',
    });
  }

  return signals;
}
