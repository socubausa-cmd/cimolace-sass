/**
 * Moteur **Events** — signaux temps réel (salle, audience, custom) pour orchestration future.
 * Fusionner dans `context.longia_event_signal` ; **strip côté Edge** du prompt LLM (voir parseur partagé).
 */

export const LONGIA_EVENT_SIGNAL_KIND = {
  ROOM: 'room',
  AUDIENCE: 'audience',
  CUSTOM: 'custom',
};

/**
 * @param {{
 *   kind?: string;
 *   severity?: 'info'|'warn'|'urgent';
 *   payload?: Record<string, unknown>;
 * }} p
 */
export function buildLongiaEventSignalV1(p) {
  const kind = String(p?.kind || LONGIA_EVENT_SIGNAL_KIND.CUSTOM).trim() || LONGIA_EVENT_SIGNAL_KIND.CUSTOM;
  const sev = p?.severity;
  const severity = sev === 'warn' || sev === 'urgent' || sev === 'info' ? sev : 'info';
  const payload =
    p?.payload && typeof p.payload === 'object' && !Array.isArray(p.payload) ? { ...p.payload } : {};
  return { v: 1, kind, severity, payload };
}

/**
 * @param {Record<string, unknown>} context
 * @param {ReturnType<typeof buildLongiaEventSignalV1>} signal
 */
export function attachLongiaEventSignalToContext(context, signal) {
  return {
    ...context,
    longia_event_signal: signal,
  };
}
