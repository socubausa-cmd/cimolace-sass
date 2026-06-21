export function devLogLiveHostEnded(reason, detail, sessionId) {
  if (!import.meta.env.DEV) return;

  console.warn('[LiveHost] phase → ENDED', {
    reason,
    detail: detail ?? null,
    sessionId: sessionId ?? null,
    path: typeof window !== 'undefined' ? window.location.pathname : '',
    at: new Date().toISOString(),
  });
}

/** UUID profil Supabase — utilisé pour l'audit serveur des commandes caméra (cible = identité LiveKit). */
export function isLiveProfileUuid(s) {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  );
}

export function randomCorrelationUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nt() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** mm:ss à partir d'un nombre de secondes (timer interne live). */
export function formatTimer(timerSec) {
  const total = Math.max(0, Math.floor(Number(timerSec) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatMeshCountdown(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function evc(t) {
  if (typeof t === 'string' && t.startsWith('longia_')) return '#d4a36a';
  return (['join', 'hand_up'].includes(t)) ? '#c8943e' : (['leave', 'hand_down'].includes(t)) ? '#ef4444' : (t === 'message' ? '#c8943e' : '#888');
}

export function evi(t) {
  if (typeof t === 'string' && t.startsWith('longia_')) return '◆';
  return (t === 'join' || t === 'hand_up') ? '↑' : (t === 'leave' || t === 'hand_down') ? '↓' : (t === 'message' ? '💬' : '●');
}

export function parseLiveKitMetadata(meta) {
  try {
    return meta ? JSON.parse(meta) : {};
  } catch {
    return {};
  }
}

/** `connected` = room LiveKit active ; `off` = UI live sans room (token refusé, erreur connect, etc.) — utile E2E / debug. */
export function setLiriLiveKitDomFlag(state) {
  if (typeof document === 'undefined') return;
  try {
    document.documentElement.setAttribute(
      'data-liri-livekit',
      state === 'connected' ? 'connected' : 'off',
    );
  } catch {
    /* ignore */
  }
}

export function setLiriLiveKitDomError(message) {
  if (typeof document === 'undefined') return;
  try {
    const m = String(message || '').trim();
    if (m) document.documentElement.setAttribute('data-liri-livekit-error', m.slice(0, 400));
    else document.documentElement.removeAttribute('data-liri-livekit-error');
  } catch {
    /* ignore */
  }
}
