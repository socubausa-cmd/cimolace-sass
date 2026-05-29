/** Type `live_session_signals.type` pour les demandes d'accès (phase 4). */
export const LIVE_PERMISSION_REQUEST_SIGNAL_TYPE = 'permission_request';

/** @type {Record<string, string>} */
export const LIVE_PERMISSION_ACTION_LABEL_FR = {
  canUseMic: 'Micro',
  canUseCamera: 'Caméra',
  canUseSignals: 'Signaux (main / réactions)',
  canDrawSmartboard: 'Dessin tableau',
  canMovePanel: 'Déplacement panneaux',
  canUseJoyKit: 'JoyKit',
  canUseNeuronQ: 'NeuronQ',
  canInvitePeople: 'Inviter des personnes',
  canControlScenes: 'Contrôle des scènes',
  canRecord: 'Enregistrement',
  canStopLive: 'Arrêt du live',
  canManagePermissions: 'Gestion des permissions',
};

export function labelLivePermissionAction(action) {
  return LIVE_PERMISSION_ACTION_LABEL_FR[action] || String(action || '?');
}

/**
 * @param {string|null|undefined} rawPayload
 * @returns {{ v?: number, action?: string, status?: string, grant?: string|null, decidedAt?: string|null }}
 */
export function parsePermissionRequestPayload(rawPayload) {
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
 * @param {string} action — LivePermissionAction
 */
export function buildPendingPermissionRequestPayload(action) {
  return JSON.stringify({
    v: 1,
    action,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ liveSessionId: string, userId: string, action: string }} opts
 */
export async function insertGuestPermissionRequest(supabase, { liveSessionId, userId, action }) {
  if (!liveSessionId || !userId || !action) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[LiriLive permission_request] insert ignoré — paramètres manquants', { liveSessionId, userId, action });
    }
    return { data: null, error: new Error('Paramètres manquants') };
  }
  const payload = buildPendingPermissionRequestPayload(action);
  const res = await supabase.from('live_session_signals').insert({
    live_session_id: liveSessionId,
    user_id: userId,
    type: LIVE_PERMISSION_REQUEST_SIGNAL_TYPE,
    payload,
    resolved: false,
  }).select('id').maybeSingle();

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[LiriLive permission_request] invité → INSERT', {
      signalId: res.data?.id,
      liveSessionId,
      userId,
      action,
      status: 'pending',
    });
  }
  return res;
}

/**
 * @param {'reject'|'approve_5min'|'approve_session'} decision
 */
export function buildHostDecisionPayload(action, decision) {
  const decidedAt = new Date().toISOString();
  if (decision === 'reject') {
    return JSON.stringify({ v: 1, action, status: 'rejected', grant: null, decidedAt });
  }
  if (decision === 'approve_5min') {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    return JSON.stringify({
      v: 1, action, status: 'approved', grant: '5min', scope: 'temporary', expiresAt, decidedAt,
    });
  }
  if (decision === 'approve_session') {
    return JSON.stringify({
      v: 1, action, status: 'approved', grant: 'session', scope: 'session', decidedAt,
    });
  }
  return JSON.stringify({ v: 1, action, status: 'rejected', grant: null, decidedAt });
}

/**
 * Agrège les grants effectifs depuis des lignes `live_session_signals` (type permission_request, résolues, approuvées).
 * @param {Array<{ payload?: string|null, resolved?: boolean }>} rows
 * @param {number} [nowMs]
 * @returns {{ sessionGrants: string[], temporaryGrants: Array<{ action: string, expiresAt: number }> }}
 */
export function computeGuestGrantsFromSignalRows(rows, nowMs = Date.now()) {
  const sessionActions = new Set();
  /** @type {Map<string, number>} */
  const tempByAction = new Map();

  for (const row of rows || []) {
    if (!row?.resolved) continue;
    const p = parsePermissionRequestPayload(row.payload);
    if (p.status !== 'approved' || !p.action) continue;
    if (p.grant === 'session') {
      sessionActions.add(String(p.action));
    } else if (p.grant === '5min') {
      let exp = p.expiresAt ? Date.parse(String(p.expiresAt)) : NaN;
      if (!Number.isFinite(exp) && p.decidedAt) {
        exp = Date.parse(String(p.decidedAt)) + 5 * 60 * 1000;
      }
      if (!Number.isFinite(exp) || exp <= nowMs) continue;
      const prev = tempByAction.get(p.action);
      if (prev == null || exp > prev) tempByAction.set(p.action, exp);
    }
  }

  const temporaryGrants = [...tempByAction.entries()].map(([action, expiresAt]) => ({ action, expiresAt }));
  return { sessionGrants: [...sessionActions], temporaryGrants };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ signalId: string, action: string, decision: 'reject'|'approve_5min'|'approve_session' }} opts
 */
export async function applyHostPermissionDecision(supabase, { signalId, action, decision }) {
  const payload = buildHostDecisionPayload(action, decision);
  const res = await supabase
    .from('live_session_signals')
    .update({ resolved: true, payload })
    .eq('id', signalId)
    .eq('type', LIVE_PERMISSION_REQUEST_SIGNAL_TYPE);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[LiriLive permission_request] hôte → décision', { signalId, action, decision, payload });
  }
  return res;
}
