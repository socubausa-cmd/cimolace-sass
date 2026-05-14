/**
 * Vérifie côté Supabase qu’un grant `permission_request` approuvé est encore actif.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ liveSessionId: string, userId: string, action: string }} opts
 * @returns {Promise<{ allowed: boolean, error: import('@supabase/supabase-js').PostgrestError|null }>}
 */
export async function assertGuestPermissionActive(supabase, { liveSessionId, userId, action }) {
  if (!liveSessionId || !userId || !action) return { allowed: false, error: null };
  try {
    const { data, error } = await supabase.rpc('live_guest_permission_active', {
      p_live_session_id: liveSessionId,
      p_user_id: userId,
      p_action: action,
    });
    if (!error) return { allowed: data === true, error: null };
    if (import.meta.env.DEV && rpcLooksMissing(error)) {
      // eslint-disable-next-line no-console
      console.warn('[LiriLive] RPC live_guest_permission_active indisponible (dev)', error?.message || error);
    }
    return { allowed: false, error };
  } catch (e) {
    return { allowed: false, error: e };
  }
}

function rpcLooksMissing(error) {
  const msg = String(error?.message || error?.details || '').toLowerCase();
  const c = String(error?.code || '');
  return c === 'PGRST202' || c === '42883' || msg.includes('function') || msg.includes('does not exist');
}

/**
 * Client déjà autorisé par resolveLivePermissions + exécution seulement si le serveur confirme le grant.
 * En dev, si la RPC n’est pas déployée, on s’appuie sur le contexte (évite de bloquer le flux local).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ isAllowed?: (a: string) => boolean }|null|undefined} permCtx
 */
export async function assertGuestLiveAction(supabase, permCtx, { liveSessionId, userId, action }) {
  if (!permCtx?.isAllowed?.(action)) return false;
  const { allowed, error } = await assertGuestPermissionActive(supabase, { liveSessionId, userId, action });
  if (allowed) return true;
  if (import.meta.env.DEV && error && rpcLooksMissing(error)) return true;
  if (!allowed && import.meta.env.DEV && error && !rpcLooksMissing(error)) {
    // eslint-disable-next-line no-console
    console.warn('[LiriLive] Action invité refusée par le serveur', { action, liveSessionId });
  }
  return false;
}
