import { supabase } from '@/lib/customSupabaseClient';
import { normalizeLifecycleStatus } from './liriWorkspaceLifecycle';

/**
 * @param {string | { message?: string } | null | undefined} raw
 * @returns {string}
 */
export function mapLiriWorkspaceError(raw) {
  const msg = typeof raw === 'string' ? raw : raw?.message || String(raw || '');
  const m = msg.toLowerCase();
  if (m.includes('liri_workspace_share_grantee_display')) {
    return 'Fonction d’affichage des partages absente : migration 202604302292.';
  }
  if (
    m.includes('liri_course_workspace_shares')
    || m.includes('liri_course_workspace_versions')
    || (m.includes('liri_course_workspace') && m.includes('prevent_owner'))
  ) {
    return 'Schéma partages / versions : appliquez la migration Supabase 202604302291.';
  }
  if (m.includes('liri_course_workspace_invites') || m.includes('redeem_liri_workspace_invite')) {
    return 'Invitations par lien : appliquez la migration Supabase 202604302294.';
  }
  if (m.includes('lifecycle_status')) {
    return 'Colonne lifecycle_status : appliquez la migration Supabase 202604302295.';
  }
  if (
    m.includes('does not exist')
    || m.includes('schema cache')
    || m.includes('could not find the table')
    || (m.includes('relation') && m.includes('liri_course_workspaces'))
  ) {
    return 'Table `liri_course_workspaces` absente : appliquez la migration 202604302290.';
  }
  if (m.includes('jwt') || m.includes('invalid claim') || msg.includes('401')) {
    return 'Session expirée — reconnectez-vous.';
  }
  if (m.includes('permission denied') || m.includes('rls') || msg.includes('403')) {
    return 'Accès refusé — vérifiez la connexion ou les politiques RLS.';
  }
  return msg;
}

/**
 * @returns {Promise<{ session: import('@supabase/supabase-js').Session | null }>}
 */
export async function getSupabaseSession() {
  const { data } = await supabase.auth.getSession();
  return { session: data.session ?? null };
}

/**
 * @typedef {{
 *   id: string;
 *   title: string;
 *   updated_at: string;
 *   user_id: string;
 *   lifecycle_status?: string;
 *   accessRole: 'owner' | 'viewer' | 'editor';
 * }} LiriWorkspaceListRow
 */

/**
 * @returns {Promise<{ rows: LiriWorkspaceListRow[], error: Error | null }>}
 */
export async function fetchLiriCourseWorkspaceList() {
  const { session } = await getSupabaseSession();
  if (!session) {
    return { rows: [], error: new Error('Connectez-vous pour voir vos brouillons cloud.') };
  }
  const uid = session.user.id;

  const { data: owned, error: e1 } = await supabase
    .from('liri_course_workspaces')
    .select('id, title, updated_at, user_id, lifecycle_status')
    .eq('user_id', uid)
    .order('updated_at', { ascending: false })
    .limit(40);

  if (e1) {
    return { rows: [], error: new Error(mapLiriWorkspaceError(e1)) };
  }

  const { data: shareRows, error: e2 } = await supabase
    .from('liri_course_workspace_shares')
    .select('workspace_id, role')
    .eq('grantee_id', uid);

  if (e2) {
    return { rows: [], error: new Error(mapLiriWorkspaceError(e2)) };
  }

  /** @type {LiriWorkspaceListRow[]} */
  const ownList = (owned || []).map((r) => ({
    ...r,
    accessRole: /** @type {'owner'} */ ('owner'),
  }));

  const byId = new Map(ownList.map((r) => [r.id, r]));
  const uniqueShare = [...new Set((shareRows || []).map((s) => s.workspace_id).filter(Boolean))];

  /** @type {{ id: string; title: string; updated_at: string; user_id: string }[]} */
  let sharedWs = [];
  if (uniqueShare.length > 0) {
    const { data: sw, error: e3 } = await supabase
      .from('liri_course_workspaces')
      .select('id, title, updated_at, user_id, lifecycle_status')
      .in('id', uniqueShare);
    if (e3) {
      return { rows: [], error: new Error(mapLiriWorkspaceError(e3)) };
    }
    sharedWs = sw || [];
  }

  const roleByWid = new Map((shareRows || []).map((s) => [s.workspace_id, s.role]));

  const sharedList = sharedWs
    .filter((w) => !byId.has(w.id))
    .map((w) => ({
      ...w,
      accessRole: /** @type {'viewer' | 'editor'} */ (roleByWid.get(w.id) || 'viewer'),
    }));

  const merged = [...ownList, ...sharedList].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return { rows: merged.slice(0, 40), error: null };
}

/**
 * @param {{ id?: string | null; title: string; payload: object; lifecycleStatus?: import('./liriWorkspaceLifecycle').LiriWorkspaceLifecycleStatus }} args
 * @returns {Promise<{ id: string | null; error: Error | null }>}
 */
export async function saveLiriCourseWorkspace({ id, title, payload, lifecycleStatus }) {
  const { session } = await getSupabaseSession();
  if (!session) {
    return { id: null, error: new Error('Connectez-vous pour enregistrer sur le cloud.') };
  }
  const safeTitle = (title || 'Sans titre').slice(0, 200);

  if (id) {
    /** @type {{ title: string; payload: object; lifecycle_status?: string }} */
    const patch = { title: safeTitle, payload };
    if (lifecycleStatus !== undefined) {
      patch.lifecycle_status = normalizeLifecycleStatus(lifecycleStatus);
    }
    const { data, error } = await supabase
      .from('liri_course_workspaces')
      .update(patch)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) {
      return { id: null, error: new Error(mapLiriWorkspaceError(error)) };
    }
    return { id: data?.id ?? id, error: null };
  }

  const { data, error } = await supabase
    .from('liri_course_workspaces')
    .insert({
      user_id: session.user.id,
      title: safeTitle,
      payload,
      lifecycle_status: normalizeLifecycleStatus(lifecycleStatus),
    })
    .select('id')
    .single();
  if (error) {
    return { id: null, error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { id: data?.id ?? null, error: null };
}

/**
 * @param {string} workspaceId
 * @returns {Promise<{ row: { id: string; title: string; payload: unknown; user_id: string; lifecycle_status?: string } | null; error: Error | null }>}
 */
export async function fetchLiriCourseWorkspaceById(workspaceId) {
  const { session } = await getSupabaseSession();
  if (!session) {
    return { row: null, error: new Error('Non connecté') };
  }
  const { data, error } = await supabase
    .from('liri_course_workspaces')
    .select('id, title, payload, user_id, lifecycle_status')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error) {
    return { row: null, error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { row: data, error: null };
}

/**
 * @param {string} workspaceId
 * @returns {Promise<{ error: Error | null }>}
 */
export async function deleteLiriCourseWorkspace(workspaceId) {
  const { session } = await getSupabaseSession();
  if (!session) {
    return { error: new Error('Non connecté') };
  }
  const { error } = await supabase.from('liri_course_workspaces').delete().eq('id', workspaceId);
  if (error) {
    return { error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { error: null };
}

/**
 * @param {string} workspaceId
 * @returns {Promise<{ rows: { id: string; grantee_id: string; role: string; created_at: string }[], error: Error | null }>}
 */
export async function fetchWorkspaceShares(workspaceId) {
  const { data, error } = await supabase
    .from('liri_course_workspace_shares')
    .select('id, grantee_id, role, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) {
    return { rows: [], error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { rows: data || [], error: null };
}

/**
 * Partages avec libellé (RPC propriétaire). Retombe sur {@link fetchWorkspaceShares} si la RPC est indisponible.
 * @param {string} workspaceId
 * @returns {Promise<{ rows: { id: string; grantee_id: string; role: string; created_at: string; display_name: string }[], error: Error | null }>}
 */
export async function fetchWorkspaceSharesEnriched(workspaceId) {
  const { data, error } = await supabase.rpc('liri_workspace_share_grantee_display', {
    p_workspace_id: workspaceId,
  });
  if (!error && Array.isArray(data)) {
    return {
      rows: data.map((r) => ({
        id: r.share_id,
        grantee_id: r.grantee_id,
        role: r.role,
        created_at: r.created_at,
        display_name: r.display_name || r.grantee_id,
      })),
      error: null,
    };
  }
  const fb = await fetchWorkspaceShares(workspaceId);
  if (fb.error) {
    return { rows: [], error: fb.error };
  }
  return {
    rows: fb.rows.map((s) => ({
      ...s,
      display_name: `${s.grantee_id.slice(0, 8)}…`,
    })),
    error: null,
  };
}

/**
 * @param {string} workspaceId
 * @param {string} granteeId
 * @param {'viewer' | 'editor'} role
 */
export async function upsertWorkspaceShare(workspaceId, granteeId, role) {
  const { error } = await supabase.from('liri_course_workspace_shares').upsert(
    {
      workspace_id: workspaceId,
      grantee_id: granteeId,
      role,
    },
    { onConflict: 'workspace_id,grantee_id' },
  );
  if (error) {
    return { error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { error: null };
}

/**
 * @param {string} workspaceId
 * @param {string} granteeId
 */
export async function removeWorkspaceShare(workspaceId, granteeId) {
  const { error } = await supabase
    .from('liri_course_workspace_shares')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('grantee_id', granteeId);
  if (error) {
    return { error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { error: null };
}

/**
 * @param {string} workspaceId
 * @param {object} payload
 * @param {string} [titleSnapshot]
 */
export async function insertWorkspaceVersion(workspaceId, payload, titleSnapshot) {
  const { session } = await getSupabaseSession();
  if (!session) {
    return { error: new Error('Non connecté') };
  }
  const { error } = await supabase.from('liri_course_workspace_versions').insert({
    workspace_id: workspaceId,
    payload,
    title_snapshot: titleSnapshot?.slice(0, 200) ?? null,
    created_by: session.user.id,
  });
  if (error) {
    return { error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { error: null };
}

/**
 * @param {string} workspaceId
 * @param {number} [limit]
 */
export async function fetchWorkspaceVersions(workspaceId, limit = 30) {
  const { data, error } = await supabase
    .from('liri_course_workspace_versions')
    .select('id, title_snapshot, created_at, created_by')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    return { rows: [], error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { rows: data || [], error: null };
}

/**
 * @param {string} versionId
 */
export async function fetchWorkspaceVersionPayload(versionId) {
  const { data, error } = await supabase
    .from('liri_course_workspace_versions')
    .select('id, workspace_id, payload, title_snapshot, created_at')
    .eq('id', versionId)
    .maybeSingle();
  if (error) {
    return { row: null, error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { row: data, error: null };
}

/**
 * @param {string} versionId
 */
export async function deleteWorkspaceVersion(versionId) {
  const { error } = await supabase.from('liri_course_workspace_versions').delete().eq('id', versionId);
  if (error) {
    return { error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { error: null };
}

function randomInviteToken() {
  const a = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < a.length; i += 1) a[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {string} workspaceId
 * @param {'viewer' | 'editor'} role
 * @param {number} [ttlDays]
 * @returns {Promise<{ row: { id: string; token: string; expires_at: string; role: string } | null; error: Error | null }>}
 */
export async function createWorkspaceInvite(workspaceId, role, ttlDays = 14) {
  const { session } = await getSupabaseSession();
  if (!session) {
    return { row: null, error: new Error('Connectez-vous pour créer un lien d’invitation.') };
  }
  const token = randomInviteToken();
  const days = Math.max(1, Math.min(90, Number(ttlDays) || 14));
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  const { data, error } = await supabase
    .from('liri_course_workspace_invites')
    .insert({
      workspace_id: workspaceId,
      token,
      role,
      created_by: session.user.id,
      expires_at: expiresAt,
    })
    .select('id, token, expires_at, role')
    .single();

  if (error) {
    return { row: null, error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { row: data, error: null };
}

/**
 * @param {string} token
 * @returns {Promise<{ result: Record<string, unknown> | null; error: Error | null }>}
 */
export async function redeemWorkspaceInvite(token) {
  const { data, error } = await supabase.rpc('redeem_liri_workspace_invite', {
    p_token: String(token || '').trim(),
  });
  if (error) {
    return { result: null, error: new Error(mapLiriWorkspaceError(error)) };
  }
  return { result: data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : null, error: null };
}
