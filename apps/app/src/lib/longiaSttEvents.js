/**
 * Contrat STT côté client (aligné docs/longia-livekit-realtime/json/stt_event_contract.json).
 */

export const LONGIA_STT_EVENT = {
  PARTIAL: 'transcript.partial',
  FINAL: 'transcript.final',
};

/**
 * @param {object} p
 * @param {'transcript.partial'|'transcript.final'} p.event
 * @param {string} p.roomId
 * @param {string} p.text
 * @param {number} [p.startMs]
 * @param {number} [p.endMs]
 * @param {string} [p.language]
 * @param {string} [p.speakerId]
 * @param {number} [p.confidence]
 */
export function buildLongiaSttClientPayload(p) {
  const base = {
    event: p.event,
    roomId: p.roomId,
    speakerId: p.speakerId || 'teacher',
    text: String(p.text || '').trim(),
    startMs: typeof p.startMs === 'number' ? p.startMs : Date.now(),
    endMs: typeof p.endMs === 'number' ? p.endMs : Date.now(),
    language: p.language || 'fr',
    isFinal: p.event === LONGIA_STT_EVENT.FINAL,
  };
  if (p.event === LONGIA_STT_EVENT.FINAL && typeof p.confidence === 'number') {
    base.confidence = p.confidence;
  }
  return base;
}
