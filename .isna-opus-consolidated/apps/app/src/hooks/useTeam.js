import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export function useTeam() {
  const { supabase, session, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [privilegedLinks, setPrivilegedLinks] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isOwner, setIsOwner] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
      const role = String(profile?.role || '').toLowerCase();
      setIsOwner(role === 'owner');

      const [membersRes, invRes, linksRes, permsRes, auditRes] = await Promise.all([
        supabase.from('profiles').select('id,email,name,role,status,created_at').neq('role', 'visitor').order('created_at', { ascending: false }).limit(100),
        supabase.from('team_invitations').select('id,email,first_name,last_name,role,expires_at,status,invited_by,created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
        role === 'owner' ? supabase.from('privileged_links').select('id,slug,name,plan_id,duration_days,max_uses,use_count,single_use,restricted_email,expires_at,status,created_by,created_at').order('created_at', { ascending: false }).limit(100) : { data: [] },
        supabase.from('role_permissions').select('id,role,permission_key,granted').order('role'),
        (role === 'owner' || role === 'admin') ? supabase.from('access_audit_log').select('id,action,resource_type,resource_id,actor_id,target_user_id,changes,created_at').order('created_at', { ascending: false }).limit(50) : { data: [] },
      ]);

      setMembers(membersRes.data || []);
      setInvitations(invRes.data || []);
      setPrivilegedLinks(linksRes.data || []);
      setRolePermissions(permsRes.data || []);
      setAuditLogs(auditRes.data || []);
    } catch (_) {
      setMembers([]);
      setInvitations([]);
      setPrivilegedLinks([]);
      setRolePermissions([]);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const inviteMember = async (payload) => {
    const token = session?.access_token;
    if (!token) return { error: new Error('Non authentifié') };

    const res = await fetch('/.netlify/functions/team-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: payload.email,
        role: payload.role,
        firstName: payload.firstName,
        lastName: payload.lastName,
        validityDays: payload.validityDays ?? 7,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: new Error(data?.error || 'Erreur') };
    // Mise à jour optimiste : ajouter la nouvelle invitation immédiatement
    if (data?.invitation) {
      setInvitations((prev) => [
        {
          id: data.invitation.id,
          email: data.invitation.email,
          first_name: payload.firstName || null,
          last_name: payload.lastName || null,
          role: data.invitation.role,
          expires_at: data.invitation.expires_at,
          status: data.invitation.status || 'pending',
          invited_by: user?.id,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    await refresh();
    return { data, error: null };
  };

  const createPrivilegedLink = async (payload) => {
    const token = session?.access_token;
    if (!token) return { error: new Error('Non authentifié') };

    const res = await fetch('/.netlify/functions/privileged-link-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: payload.name,
        planId: payload.planId,
        durationDays: payload.durationDays ?? 30,
        maxUses: payload.maxUses,
        singleUse: payload.singleUse ?? false,
        restrictedEmail: payload.restrictedEmail,
        validityDays: payload.validityDays ?? 30,
        roleToAssign: payload.roleToAssign,
        accessType: payload.accessType ?? 'full',
        internalNote: payload.internalNote,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: new Error(data?.error || 'Erreur') };
    await refresh();
    return { data, error: null };
  };

  const getInvitationLink = async (id) => {
    const token = session?.access_token;
    if (!token) return { error: new Error('Non authentifié') };
    const res = await fetch('/.netlify/functions/team-invite-resend-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ invitationId: id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: new Error(data?.error || 'Erreur') };
    return { data: data?.link, email: data?.email, error: null };
  };

  const resendInvitation = async (id, extraDays = 7) => {
    const { data: inv } = await supabase.from('team_invitations').select('expires_at').eq('id', id).eq('status', 'pending').single();
    if (!inv) return { error: new Error('Invitation introuvable') };
    const newExpiry = new Date(inv.expires_at || Date.now());
    newExpiry.setDate(newExpiry.getDate() + extraDays);
    const { error } = await supabase.from('team_invitations').update({ expires_at: newExpiry.toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error };
    await supabase.from('access_audit_log').insert({
      action: 'team_invitation_resent',
      resource_type: 'team_invitation',
      resource_id: id,
      actor_id: user?.id,
      changes: { new_expires_at: newExpiry.toISOString() },
    });
    await refresh();
    return { error: null };
  };

  const revokeInvitation = async (id) => {
    const { error } = await supabase.from('team_invitations').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error };
    await supabase.from('access_audit_log').insert({
      action: 'team_invitation_revoked',
      resource_type: 'team_invitation',
      resource_id: id,
      actor_id: user?.id,
      changes: {},
    });
    await refresh();
    return { error: null };
  };

  const revokeLink = async (id) => {
    const { error } = await supabase.from('privileged_links').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error };
    await supabase.from('access_audit_log').insert({
      action: 'privileged_link_revoked',
      resource_type: 'privileged_link',
      resource_id: id,
      actor_id: user?.id,
      changes: {},
    });
    await refresh();
    return { error: null };
  };

  const getPermissionOverrides = async (userId) => {
    const { data } = await supabase.from('permission_overrides').select('id,permission_key,granted').eq('user_id', userId);
    return data || [];
  };

  const addPermissionOverride = async (userId, permissionKey, granted) => {
    const { error } = await supabase.from('permission_overrides').upsert(
      { user_id: userId, permission_key: permissionKey, granted, created_by: user?.id },
      { onConflict: 'user_id,permission_key' }
    );
    if (error) return { error };
    await supabase.from('access_audit_log').insert({
      action: 'permission_override_added',
      resource_type: 'permission_override',
      actor_id: user?.id,
      target_user_id: userId,
      changes: { permission_key: permissionKey, granted },
    });
    await refresh();
    return { error: null };
  };

  const removePermissionOverride = async (userId, permissionKey) => {
    const { error } = await supabase.from('permission_overrides').delete().eq('user_id', userId).eq('permission_key', permissionKey);
    if (error) return { error };
    await supabase.from('access_audit_log').insert({
      action: 'permission_override_removed',
      resource_type: 'permission_override',
      actor_id: user?.id,
      target_user_id: userId,
      changes: { permission_key: permissionKey },
    });
    await refresh();
    return { error: null };
  };

  return {
    loading,
    members,
    invitations,
    privilegedLinks,
    rolePermissions,
    auditLogs,
    isOwner,
    refresh,
    inviteMember,
    createPrivilegedLink,
    getInvitationLink,
    resendInvitation,
    revokeInvitation,
    revokeLink,
    getPermissionOverrides,
    addPermissionOverride,
    removePermissionOverride,
  };
}
