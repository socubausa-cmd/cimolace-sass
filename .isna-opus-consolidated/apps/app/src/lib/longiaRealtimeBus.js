/**
 * LONGIA bus temps réel — enveloppe canonique sur Supabase Realtime (broadcast).
 * @see src/data/longiaRealtimeBus.json
 */

export const LONGIA_BUS_BROADCAST_EVENT = 'longia_bus';

/** @param {string} sessionId */
export function longiaBusChannelName(sessionId) {
  return sessionId ? `longia-bus-${sessionId}` : '';
}

export const BUS_EVENTS = {
  TRANSCRIPT_PARTIAL: 'transcript.partial',
  TRANSCRIPT_FINAL: 'transcript.final',
  STUDENT_ACTION: 'student.action',
  STUDENT_QUESTION: 'student.question',
  AUDIENCE_METRIC: 'audience.metric',
  SECURE_APP_STATUS: 'secure_app.status',
  LONGIA_PROF_NOTIFICATION: 'longia.prof.notification',
  /** Fil lecture seule côté invités (résumé des alertes LONGIA hôte). */
  LONGIA_SESSION_DIGEST: 'longia.session_digest',
  LONGIA_GUEST_RESPONSE: 'longia.guest.response',
  LONGIA_SMARTBOARD_ACTION: 'longia.smartboard.action',
  /** Sous-titres traduits (live multilingue) — invités choisissent la langue d’affichage. */
  MULTILANG_CAPTION: 'multilang.caption',
};

const AGGREGATABLE_STUDENT_ACTIONS = new Set(['confused', 'teacher_escalation']);

/**
 * @param {string} event
 * @param {Record<string, unknown>} [data]
 */
export function wrapLongiaBusPayload(event, data = {}) {
  return {
    v: 1,
    event,
    timestamp: Math.floor(Date.now() / 1000),
    ...data,
  };
}

/**
 * @param {unknown} raw
 * @returns {{ v: number; event: string; timestamp?: number; [k: string]: unknown } | null}
 */
export function unwrapLongiaBusPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (o.v !== 1 || typeof o.event !== 'string' || !o.event) return null;
  return /** @type {{ v: number; event: string; timestamp?: number; [k: string]: unknown }} */ (o);
}

/**
 * @param {ReturnType<typeof unwrapLongiaBusPayload>} msg
 */
export function shouldAggregateStudentActionForProf(msg) {
  if (!msg || msg.event !== BUS_EVENTS.STUDENT_ACTION) return false;
  const action = typeof msg.action === 'string' ? msg.action : '';
  return AGGREGATABLE_STUDENT_ACTIONS.has(action);
}

