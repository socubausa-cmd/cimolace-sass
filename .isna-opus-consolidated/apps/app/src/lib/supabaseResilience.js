/** Small helpers for flaky networks (HTTP/2, timeouts) and JWT expiry on Storage. */

import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Proactive refresh when the access token is close to exp — reduces Storage "exp claim" errors.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {number} marginSeconds refresh if exp is within this many seconds
 */
export async function ensureFreshSession(client, marginSeconds = 120) {
  if (!client?.auth?.getSession) return;
  const { data: { session }, error } = await client.auth.getSession();
  if (error || !session) return;
  const now = Math.floor(Date.now() / 1000);
  const exp = session.expires_at;
  if (typeof exp === 'number' && exp - now < marginSeconds) {
    await client.auth.refreshSession();
  }
}

export function isRetryableSupabaseNetworkError(err) {
  const msg = String(err?.message ?? err?.error_description ?? err ?? '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('http2') ||
    msg.includes('err_http2') ||
    msg.includes('econnreset') ||
    msg.includes('connection reset') ||
    msg.includes('err_connection_reset')
  );
}

export function isExpiredJwtStorageError(err) {
  const msg = String(err?.message ?? err ?? '').toLowerCase();
  return (
    (msg.includes('exp') && msg.includes('claim')) ||
    msg.includes('jwt expired') ||
    msg.includes('token expired') ||
    msg.includes('bad jwt')
  );
}

function shouldRetryStorageAttempt(err) {
  return isExpiredJwtStorageError(err) || isRetryableSupabaseNetworkError(err);
}

/**
 * Run a Storage call that resolves to `{ data, error }`. Refreshes session first; retries once after
 * refresh on JWT/network errors, then one more time on network-only flakes.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {() => Promise<{ data?: unknown, error?: unknown }>} op
 */
export async function runStorageWithAuthRetry(client, op) {
  await ensureFreshSession(client, 180);
  let out = await op();
  let err = out?.error;
  if (err && shouldRetryStorageAttempt(err)) {
    await client.auth.refreshSession();
    await sleep(450);
    out = await op();
    err = out?.error;
  }
  if (err && isRetryableSupabaseNetworkError(err)) {
    await sleep(900);
    out = await op();
    err = out?.error;
  }
  if (err && isRetryableSupabaseNetworkError(err)) {
    await sleep(1800);
    out = await op();
  }
  return out;
}

export function isRetryableMessagingFetchError(err) {
  if (!err) return false;
  return isRetryableSupabaseNetworkError(err);
}

/**
 * Détecte erreurs d’auth JWT côté Edge Functions (401, corps { error: Invalid token }, etc.).
 * @param {unknown} fnError
 * @param {string} [resolvedMessage]
 */
function isEdgeFunctionAuthFailure(fnError, resolvedMessage = '') {
  const m = `${String(fnError?.message ?? '')} ${resolvedMessage}`.toLowerCase();
  return (
    /\b401\b/.test(m) ||
    m.includes('invalid jwt') ||
    m.includes('invalid token') ||
    m.includes('jwt expired') ||
    m.includes('missing authorization') ||
    m.includes('session') && m.includes('expired')
  );
}

/**
 * Appelle une Edge Function avec session fraîche ; en cas d’échec d’auth, `refreshSession` puis 2ᵉ tentative.
 * À utiliser pour les fonctions qui font `getUser(token)` côté serveur (ex. smartboard-ia-generate).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} name
 * @param {import('@supabase/supabase-js').FunctionInvokeOptions} [invokeOptions]
 * @returns {Promise<{ data: unknown, error: Error | null }>}
 */
export async function invokeFunctionWithAuthRetry(client, name, invokeOptions = {}) {
  await ensureFreshSession(client, 300);
  let { data, error } = await client.functions.invoke(name, invokeOptions);
  if (!error) {
    return { data, error: null };
  }
  let detail = '';
  try {
    detail = await getSupabaseFunctionErrorMessage(error);
  } catch {
    detail = '';
  }
  if (isEdgeFunctionAuthFailure(error, detail)) {
    await client.auth.refreshSession();
    await sleep(450);
    const second = await client.functions.invoke(name, invokeOptions);
    return { data: second.data, error: second.error ?? null };
  }
  return { data, error };
}
