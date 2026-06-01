import type { TranscriptChunk } from './analyzeTranscript.ts';

/**
 * Niveau 1 — live awareness sur texte encore instable.
 * Au plus un signal par requête pour limiter le bruit UI.
 */
export function analyzeTranscriptPartial(chunk: TranscriptChunk, _roomContext: Record<string, unknown>) {
  const text = (chunk.text || '').trim();
  if (text.length < 14) return [];

  const signals: Array<Record<string, unknown>> = [];

  if (text.includes('?')) {
    signals.push({
      type: 'pedagogical',
      code: 'partial_question_tone',
      title: 'Ton interrogatif (aperçu STT)',
      message: 'La phrase semble poser une question — bon moment pour vérifier la compréhension.',
      excerpt: text.slice(0, 160),
      tier: 'partial',
      strength: 'light',
    });
  } else if (/\b(attention|important|écoutez|rappel|retenez)\b/i.test(text)) {
    signals.push({
      type: 'content',
      code: 'partial_emphasis',
      title: 'Accent oral (aperçu STT)',
      message: 'Le flux parlé marque un point d’attention.',
      excerpt: text.slice(0, 160),
      tier: 'partial',
      strength: 'light',
    });
  }

  return signals.slice(0, 1);
}
