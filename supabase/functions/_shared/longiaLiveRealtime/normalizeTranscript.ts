export type TranscriptWire = {
  text?: string;
  startMs?: number;
  endMs?: number;
  language?: string;
  confidence?: number;
  speakerId?: string;
};

export function normalizeTranscriptEcho(
  kind: 'transcript.partial' | 'transcript.final',
  input: TranscriptWire,
  roomContext: Record<string, unknown>,
): Record<string, unknown> {
  const roomId =
    typeof roomContext.sessionId === 'string' && roomContext.sessionId
      ? roomContext.sessionId
      : typeof roomContext.roomId === 'string'
        ? roomContext.roomId
        : 'unknown';
  const text = String(input.text || '').trim();
  const base: Record<string, unknown> = {
    event: kind,
    roomId,
    speakerId: typeof input.speakerId === 'string' ? input.speakerId : 'teacher',
    text,
    startMs: typeof input.startMs === 'number' ? input.startMs : Date.now(),
    endMs: typeof input.endMs === 'number' ? input.endMs : Date.now(),
    language: typeof input.language === 'string' && input.language ? input.language : 'fr',
    isFinal: kind === 'transcript.final',
  };
  if (kind === 'transcript.final' && typeof input.confidence === 'number') {
    base.confidence = input.confidence;
  }
  return base;
}
