import { JOYKIT_LEVEL_RANK } from './joyKit';

/** Demande JoyKit (invité) — en attente de décision hôte. */
export const LIVE_JOYKIT_REQUEST_SIGNAL_TYPE = 'joykit_request';
/** Grant JoyKit accordé (ligne dédiée, `user_id` = invité bénéficiaire). */
export const LIVE_JOYKIT_GRANTED_SIGNAL_TYPE = 'joykit_granted';

export const JOYKIT_LEVEL_CHOICES = /** @type {const} */ (['light', 'interactive', 'control', 'full']);

/** @param {string} raw */
export function normalizeJoyKitLevel(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'light' || s === 'interactive' || s === 'control' || s === 'full') return s;
  return 'control';
}

/**
 * @param {string|null|undefined} rawPayload
 * @returns {{ v?: number, status?: string, level?: string, createdAt?: string }}
 */
export function parseJoyKitRequestPayload(rawPayload) {
  if (rawPayload == null || rawPayload === '') return { status: 'pending' };
  try {
    const o = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    if (o && typeof o === 'object') return o;
  } catch {
    /* ignore */
  }
  return { status: 'pending' };
}

/**
 * @param {string|null|undefined} rawPayload
 * @returns {{ v?: number, status?: string, level?: string, grant?: string, scope?: string, expiresAt?: string, decidedAt?: string, requestSignalId?: string }}
 */
export function parseJoyKitGrantedPayload(rawPayload) {
  if (rawPayload == null || rawPayload === '') return { status: '' };
  try {
    const o = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    if (o && typeof o === 'object') return o;
  } catch {
    /* ignore */
  }
  return { status: '' };
}

/**
 * @param {string} [level]
 */
export function buildPendingJoyKitRequestPayload(level = 'control') {
  return JSON.stringify({
    v: 1,
    status: 'pending',
    level: normalizeJoyKitLevel(level),
    createdAt: new Date().toISOString(),
  });
}

/**
 * @param {{ level: string, decision: 'approve_5min'|'approve_session', requestSignalId?: string }} opts
 */
export function buildJoyKitGrantedPayloadForInsert(opts) {
  const decidedAt = new Date().toISOString();
  const level = normalizeJoyKitLevel(opts.level);
  const base = {
    v: 1,
    status: 'granted',
    level,
    decidedAt,
    requestSignalId: opts.requestSignalId || null,
  };
  if (opts.decision === 'approve_5min') {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    return JSON.stringify({
      ...base,
      grant: '5min',
      scope: 'temporary',
      expiresAt,
    });
  }
  return JSON.stringify({
    ...base,
    grant: 'session',
    scope: 'session',
  });
}

export function buildJoyKitRequestRejectedPayload(requestSignalId) {
  return JSON.stringify({
    v: 1,
    status: 'rejected',
    decidedAt: new Date().toISOString(),
    requestSignalId: requestSignalId || null,
  });
}

export function buildJoyKitRequestClosedPayload() {
  return JSON.stringify({
    v: 1,
    status: 'closed',
    decidedAt: new Date().toISOString(),
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ liveSessionId: string, userId: string, level?: string }} opts
 */
export async function insertGuestJoyKitRequest(supabase, { liveSessionId, userId, level = 'control' }) {
  if (!liveSessionId || !userId) {
    return { data: null, error: new Error('Paramètres manquants') };
  }
  const payload = buildPendingJoyKitRequestPayload(level);
  const res = await supabase.from('live_session_signals').insert({
    live_session_id: liveSessionId,
    user_id: userId,
    type: LIVE_JOYKIT_REQUEST_SIGNAL_TYPE,
    payload,
    resolved: false,
  }).select('id').maybeSingle();
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[LiriLive joykit_request] invité → INSERT', { signalId: res.data?.id, liveSessionId, userId, level: normalizeJoyKitLevel(level) });
  }
  return res;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ liveSessionId: string, guestUserId: string, requestSignalId: string, level: string, decision: 'approve_5min'|'approve_session'|'reject' }} opts
 */
export async function resolveHostJoyKitRequest(supabase, opts) {
  const {
    liveSessionId, guestUserId, requestSignalId, level, decision,
  } = opts;
  if (!liveSessionId || !requestSignalId) {
    return { error: new Error('Paramètres manquants') };
  }
  if (decision === 'reject') {
    const payload = buildJoyKitRequestRejectedPayload(requestSignalId);
    const res = await supabase
      .from('live_session_signals')
      .update({ resolved: true, payload })
      .eq('id', requestSignalId)
      .eq('type', LIVE_JOYKIT_REQUEST_SIGNAL_TYPE);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[LiriLive joykit_request] hôte → refus', { requestSignalId });
    }
    return res;
  }
  if (!guestUserId) {
    return { error: new Error('Paramètres manquants') };
  }
  const closed = buildJoyKitRequestClosedPayload();
  const up = await supabase
    .from('live_session_signals')
    .update({ resolved: true, payload: closed })
    .eq('id', requestSignalId)
    .eq('type', LIVE_JOYKIT_REQUEST_SIGNAL_TYPE);
  if (up.error) return up;
  const grantPayload = buildJoyKitGrantedPayloadForInsert({
    level,
    decision: decision === 'approve_5min' ? 'approve_5min' : 'approve_session',
    requestSignalId,
  });
  const ins = await supabase.from('live_session_signals').insert({
    live_session_id: liveSessionId,
    user_id: guestUserId,
    type: LIVE_JOYKIT_GRANTED_SIGNAL_TYPE,
    payload: grantPayload,
    resolved: true,
  });
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[LiriLive joykit_granted] hôte → INSERT', { guestUserId, level: normalizeJoyKitLevel(level), decision });
  }
  return ins;
}

/**
 * @param {Array<{ id?: string, payload?: string|null, created_at?: string }>} rows
 * @param {number} [nowMs]
 * @returns {import('./joyKit').JoyKitGrant | null}
 */
export function pickActiveJoyKitGrantFromRows(rows, nowMs = Date.now()) {
  /** @type {import('./joyKit').JoyKitGrant | null} */
  let best = null;
  let bestRank = 0;
  const rankOf = (lvl) => {
    const l = normalizeJoyKitLevel(lvl);
    return JOYKIT_LEVEL_RANK[/** @type {keyof typeof JOYKIT_LEVEL_RANK} */ (l)] || 0;
  };
  for (const row of rows || []) {
    const p = parseJoyKitGrantedPayload(row.payload);
    if (p.status !== 'granted' || !p.level) continue;
    let expMs = null;
    if (p.grant === '5min') {
      if (p.expiresAt) {
        expMs = Date.parse(String(p.expiresAt));
      } else if (p.decidedAt) {
        expMs = Date.parse(String(p.decidedAt)) + 5 * 60 * 1000;
      }
      if (!Number.isFinite(expMs) || expMs <= nowMs) continue;
    } else if (p.grant !== 'session') {
      continue;
    }
    const scope = p.grant === 'session' ? 'session' : 'temporary';
    const r = rankOf(p.level);
    if (r > bestRank) {
      bestRank = r;
      best = {
        level: /** @type {import('./joyKit').JoyKitLevel} */ (normalizeJoyKitLevel(p.level)),
        expiresAt: p.grant === 'session' ? null : expMs,
        scope,
      };
    }
  }
  return best;
}
