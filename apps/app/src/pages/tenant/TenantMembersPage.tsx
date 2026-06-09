import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantMembersApi } from '../../lib/api';
import {
  Users, UserPlus, Trash2, RefreshCw, Shield, ChevronDown,
  CheckCircle2, Clock, AlertCircle, Mail,
} from 'lucide-react';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  email?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'owner',        label: 'Propriétaire', color: '#d4af37' },
  { value: 'admin',        label: 'Administrateur', color: '#8b5cf6' },
  { value: 'practitioner', label: 'Praticien',      color: '#0891b2' },
  { value: 'teacher',      label: 'Enseignant',     color: '#0d9488' },
  { value: 'student',      label: 'Étudiant',       color: '#6b7280' },
  { value: 'patient',      label: 'Patient',        color: '#f59e0b' },
  { value: 'receptionist', label: 'Réceptionniste', color: '#ec4899' },
];

function roleLabel(role: string) {
  return ROLES.find(r => r.value === role)?.label ?? role;
}
function roleColor(role: string) {
  return ROLES.find(r => r.value === role)?.color ?? '#6b7280';
}

// ─── RoleBadge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 10,
      fontSize: 12, fontWeight: 600, color: '#fff',
      background: roleColor(role),
    }}>
      {roleLabel(role)}
    </span>
  );
}

// ─── InviteForm ───────────────────────────────────────────────────────────────

function InviteForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState('student');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => tenantMembersApi.inviteMember(email.trim(), role),
    onSuccess: () => {
      setEmail('');
      setError(null);
      onSuccess();
    },
    onError: (e: any) => setError(e?.message ?? "Erreur lors de l'invitation"),
  });

  return (
    <div style={{
      background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14,
      padding: 20, marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <UserPlus size={16} color={T.gold} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.t1 }}>Inviter un membre</h3>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {/* Email */}
        <div style={{ flex: '1 1 260px' }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: T.t2, display: 'block', marginBottom: 4 }}>
            Adresse email
          </label>
          <div style={{ position: 'relative' }}>
            <Mail size={14} color={T.t3} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="prenom@exemple.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 12px 9px 32px', border: `1px solid ${T.border}`,
                borderRadius: 8, fontSize: 14, color: T.t1,
                background: T.surface, outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = T.gold)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>
        </div>

        {/* Role */}
        <div style={{ flex: '0 1 180px' }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: T.t2, display: 'block', marginBottom: 4 }}>
            Rôle
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{
                width: '100%', padding: '9px 32px 9px 12px',
                border: `1px solid ${T.border}`, borderRadius: 8,
                fontSize: 14, color: T.t1, background: T.surface,
                appearance: 'none', outline: 'none', cursor: 'pointer',
              }}
            >
              {ROLES.filter(r => r.value !== 'owner').map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown size={14} color={T.t3} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Submit */}
        <div style={{ flex: '0 1 auto', display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => mutation.mutate()}
            disabled={!email.trim() || mutation.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', background: T.gold, color: '#000',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: email.trim() ? 'pointer' : 'not-allowed',
              opacity: !email.trim() || mutation.isPending ? 0.7 : 1,
            }}
          >
            {mutation.isPending
              ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <UserPlus size={14} />}
            Inviter
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, color: T.danger, fontSize: 13 }}>
          <AlertCircle size={14} />{error}
        </div>
      )}
      {mutation.isSuccess && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, color: T.success, fontSize: 13 }}>
          <CheckCircle2 size={14} />Invitation envoyée avec succès.
        </div>
      )}
    </div>
  );
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

function MemberRow({
  member, currentRole, onRoleChange, onRemove,
}: {
  member: Member;
  currentRole: string;
  onRoleChange: (uid: string, role: string) => void;
  onRemove: (uid: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState(member.role);
  const isOwner = member.role === 'owner';
  const canEdit = currentRole === 'owner' || (currentRole === 'admin' && !isOwner);

  const initials = member.email
    ? member.email.slice(0, 2).toUpperCase()
    : member.user_id.slice(0, 2).toUpperCase();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
      borderBottom: `1px solid ${T.border}`, transition: 'background 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = T.surfaceSoft)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: roleColor(member.role) + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13, color: roleColor(member.role),
      }}>
        {initials}
      </div>

      {/* Identity */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.email ?? member.user_id}
        </div>
        <div style={{ fontSize: 12, color: T.t3, marginTop: 2 }}>
          Ajouté le {new Date(member.created_at).toLocaleDateString('fr-FR')}
        </div>
      </div>

      {/* Status */}
      <div style={{ flexShrink: 0 }}>
        {member.status === 'active'
          ? <CheckCircle2 size={14} color={T.success} />
          : <Clock size={14} color={T.warning} />}
      </div>

      {/* Role — editable */}
      {editing ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.t1, fontSize: 13 }}
          >
            {ROLES.filter(r => r.value !== 'owner').map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={() => { onRoleChange(member.user_id, newRole); setEditing(false); }}
            style={{ padding: '4px 10px', background: T.gold, color: '#000', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >OK</button>
          <button
            onClick={() => setEditing(false)}
            style={{ padding: '4px 10px', background: T.surface2, color: T.t2, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
          >Annuler</button>
        </div>
      ) : (
        <div
          onClick={() => canEdit && !isOwner && setEditing(true)}
          style={{ flexShrink: 0, cursor: canEdit && !isOwner ? 'pointer' : 'default' }}
          title={canEdit && !isOwner ? "Cliquer pour changer le rôle" : undefined}
        >
          <RoleBadge role={member.role} />
        </div>
      )}

      {/* Remove */}
      {canEdit && !isOwner && (
        <button
          onClick={() => onRemove(member.user_id)}
          title="Retirer ce membre"
          style={{
            padding: 6, background: 'none', border: 'none', borderRadius: 6,
            cursor: 'pointer', color: T.t3, flexShrink: 0,
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = T.danger)}
          onMouseLeave={e => (e.currentTarget.style.color = T.t3)}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantMembersPage() {
  const qc = useQueryClient();
  const refetch = () => qc.invalidateQueries({ queryKey: ['tenant-members'] });

  const { data: members = [], isLoading, error } = useQuery<Member[]>({
    queryKey: ['tenant-members'],
    queryFn:  () => tenantMembersApi.listMembers(),
  });

  const { data: tenant } = useQuery({
    queryKey: ['tenant-current'],
    queryFn:  () => tenantMembersApi.getDashboard(),
  });

  const currentUserRole = (tenant as any)?.userRole ?? 'admin';

  const roleChangeMut = useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: string }) =>
      tenantMembersApi.updateMemberRole(uid, role),
    onSuccess: refetch,
  });

  const removeMut = useMutation({
    mutationFn: (uid: string) => tenantMembersApi.removeMember(uid),
    onSuccess:  refetch,
  });

  const handleRemove = (uid: string) => {
    if (window.confirm("Retirer ce membre du tenant ?")) {
      removeMut.mutate(uid);
    }
  };

  // Stats
  const byRole = ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r.value] = members.filter(m => m.role === r.value).length;
    return acc;
  }, {});

  return (
    <TenantAdminShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={22} color={T.gold} />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.t1 }}>
              Membres du tenant
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: T.t2 }}>
              {members.length} membre{members.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={refetch}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: T.goldDim, border: `1px solid ${T.goldMid}`, borderRadius: 8,
            color: T.gold, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} />Actualiser
        </button>
      </div>

      {/* Role stats pills */}
      {members.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {ROLES.filter(r => byRole[r.value] > 0).map(r => (
            <span key={r.value} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: r.color + '15', border: `1px solid ${r.color}40`, color: r.color,
            }}>
              <span style={{ fontWeight: 700 }}>{byRole[r.value]}</span> {r.label}{byRole[r.value] > 1 ? 's' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Invite form — owner/admin only */}
      {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
        <InviteForm onSuccess={refetch} />
      )}

      {/* Member list */}
      <div style={{
        background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 14,
        overflow: 'hidden',
      }}>
        {/* List header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
          background: T.surfaceSoft, borderBottom: `1px solid ${T.border}`,
        }}>
          <Users size={15} color={T.t3} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Membres actifs
          </span>
        </div>

        {isLoading && (
          <div style={{ padding: '40px', textAlign: 'center', color: T.t3 }}>
            <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p style={{ margin: 0 }}>Chargement…</p>
          </div>
        )}

        {error && (
          <div style={{ padding: 20, display: 'flex', gap: 8, color: T.danger, fontSize: 14 }}>
            <AlertCircle size={16} />Impossible de charger les membres.
          </div>
        )}

        {!isLoading && members.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: T.t3 }}>
            <Users size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
            <p style={{ margin: 0 }}>Aucun membre pour le moment. Invitez le premier ci-dessus.</p>
          </div>
        )}

        {members.map(m => (
          <MemberRow
            key={m.id}
            member={m}
            currentRole={currentUserRole}
            onRoleChange={(uid, role) => roleChangeMut.mutate({ uid, role })}
            onRemove={handleRemove}
          />
        ))}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </TenantAdminShell>
  );
}
