import { supabase } from '@/lib/customSupabaseClient';

const TOKEN_EXPIRY_SKEW_MS = 60_000;
const INVALID_REFRESH_BLOCK_MS = 3 * 60 * 1000;

let blockedUntilMs = 0;
let lastWarnAtMs = 0;
let clearingInFlight = null;

/** True après un refresh_token invalide : évite les rafales fetch (billing, Netlify…) pendant la fenêtre de blocage. */
export function authRefreshIsBlocked() {
  return Date.now() < blockedUntilMs;
}

function isExpiringSoon(session) {
  const expiresAtSec = Number(session?.expires_at || 0);
  if (!expiresAtSec) return true;
  return (expiresAtSec * 1000 - Date.now()) < TOKEN_EXPIRY_SKEW_MS;
}

function isInvalidRefreshError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    error?.status === 400 ||
    msg.includes('invalid refresh token') ||
    msg.includes('refresh_token') ||
    msg.includes('invalid grant') ||
    msg.includes('refresh token')
  );
}

async function clearLocalInvalidSession() {
  if (!clearingInFlight) {
    clearingInFlight = supabase.auth
      .signOut({ scope: 'local' })
      .catch(() => null)
      .finally(() => {
        clearingInFlight = null;
      });
  }
  await clearingInFlight;
}

export async function getFreshAccessToken({ forceRefresh = false } = {}) {
  const now = Date.now();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session || null;
  let accessToken = session?.access_token || null;
  const expiringSoon = isExpiringSoon(session);

  if (now < blockedUntilMs) {
    if (!forceRefresh && accessToken && !expiringSoon) return accessToken;
    return null;
  }

  if (!accessToken || expiringSoon || forceRefresh) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      if (isInvalidRefreshError(refreshErr)) {
        blockedUntilMs = Date.now() + INVALID_REFRESH_BLOCK_MS;
        const t = Date.now();
        if (t - lastWarnAtMs > 30_000) {
          lastWarnAtMs = t;
          console.warn('[auth] invalid refresh token detected, local session cleared and refresh paused');
        }
        await clearLocalInvalidSession();
        return null;
      }
      return accessToken;
    }
    accessToken = refreshed?.session?.access_token || accessToken;
  }

  return accessToken;
}
