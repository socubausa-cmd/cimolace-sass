import React, { useState } from 'react';
import { useTeam } from '@/hooks/useTeam';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  UserPlus,
  Link2,
  Loader2,
  Users,
  Mail,
  Copy,
  Trash2,
  Shield,
  History,
  RefreshCw,
  Settings,
  Send,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ROLE_LABELS = {
  owner: 'Propriétaire',
  admin: 'Admin',
  teacher: 'Enseignant',
  secretariat: 'Secrétariat',
  creator: 'Créateur',
  student: 'Élève',
  commercial: 'Commercial',
  support: 'Support',
  content_editor: 'Éditeur de contenu',
  admin_limite: 'Admin limité',
};

const PERMISSION_LABELS = {
  all: 'Tous les droits',
  manage_users: 'Gérer les utilisateurs',
  manage_billing: 'Gérer la facturation',
  manage_content: 'Gérer le contenu',
  manage_invitations: 'Gérer les invitations',
  create_privileged_links: 'Créer des liens privilégiés',
  manage_classes: 'Gérer les classes',
  manage_grades: 'Gérer les notes',
  publish_announcements: 'Publier des annonces',
  process_enrollments: 'Traiter les inscriptions',
  process_billing: 'Traiter la facturation',
  view_inbox: 'Voir la boîte de réception',
};

const MemberPermissionsDialog = ({ member, overrides, onAdd, onRemove, loading }) => {
  const [newKey, setNewKey] = useState('');
  const [newGranted, setNewGranted] = useState(true);
  const availableKeys = Object.keys(PERMISSION_LABELS).filter((k) => !overrides.some((o) => o.permission_key === k));

  return (
    <div className="space-y-4">
      {member && <p className="text-gray-400 text-sm">{member.name || member.email}</p>}
      <div>
        <Label className="text-gray-400">Overrides actuels</Label>
        {overrides.length === 0 ? (
          <p className="text-gray-500 text-sm mt-1">Aucun override</p>
        ) : (
          <div className="mt-2 space-y-1">
            {overrides.map((o) => (
              <div key={o.id} className="flex items-center justify-between py-1 px-2 bg-[#192734] rounded">
                <span className="text-sm">{PERMISSION_LABELS[o.permission_key] || o.permission_key}</span>
                <span className={`text-xs ${o.granted ? 'text-emerald-400' : 'text-red-400'}`}>{o.granted ? 'Oui' : 'Non'}</span>
                <Button size="sm" variant="ghost" className="text-red-400 h-6 w-6 p-0" onClick={() => onRemove(o.permission_key)} disabled={loading}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      {availableKeys.length > 0 && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-gray-400">Ajouter</Label>
            <Select value={newKey || availableKeys[0]} onValueChange={setNewKey}>
              <SelectTrigger className="bg-[#192734] border-white/10 mt-1">
                <SelectValue placeholder="Permission" />
              </SelectTrigger>
              <SelectContent>
                {availableKeys.map((k) => (
                  <SelectItem key={k} value={k}>{PERMISSION_LABELS[k] || k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <Label className="text-gray-400">Accordé</Label>
            <Select value={String(newGranted)} onValueChange={(v) => setNewGranted(v === 'true')}>
              <SelectTrigger className="bg-[#192734] border-white/10 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Oui</SelectItem>
                <SelectItem value="false">Non</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="bg-[var(--school-accent)] text-black" onClick={() => onAdd(newKey || availableKeys[0], newGranted)} disabled={loading}>
            Ajouter
          </Button>
        </div>
      )}
    </div>
  );
};

const getRoleBadgeClass = (role) => {
  const r = String(role || '').toLowerCase();
  if (r === 'owner') return 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]';
  if (r === 'admin') return 'bg-purple-500/20 text-purple-400';
  if (r === 'teacher') return 'bg-blue-500/20 text-blue-400';
  if (r === 'secretariat') return 'bg-emerald-500/20 text-emerald-400';
  return 'bg-gray-500/20 text-gray-400';
};

const TeamManagerPage = () => {
  const {
    loading,
    members,
    invitations,
    privilegedLinks,
    rolePermissions,
    auditLogs,
    isOwner,
    inviteMember,
    createPrivilegedLink,
    getInvitationLink,
    resendInvitation,
    revokeInvitation,
    revokeLink,
    getPermissionOverrides,
    addPermissionOverride,
    removePermissionOverride,
  } = useTeam();

  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '', lastName: '', role: 'teacher', validityDays: 7 });
  const [linkForm, setLinkForm] = useState({
    name: '',
    durationDays: 30,
    maxUses: null,
    singleUse: false,
    restrictedEmail: '',
    validityDays: 30,
    accessType: 'full',
    internalNote: '',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [manageMemberId, setManageMemberId] = useState(null);
  const [memberOverrides, setMemberOverrides] = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDialogData, setLinkDialogData] = useState({ link: '', email: '' });
  const [linkDialogLoading, setLinkDialogLoading] = useState(false);

  const handleInvite = async () => {
    if (!inviteForm.email?.trim()) {
      toast({ title: 'Erreur', description: 'Email requis', variant: 'destructive' });
      return;
    }
    setInviteLoading(true);
    const { error } = await inviteMember(inviteForm);
    setInviteLoading(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Invitation envoyée', description: inviteForm.email });
    setInviteForm({ email: '', firstName: '', lastName: '', role: 'teacher', validityDays: 7 });
    setInviteOpen(false);
  };

  const handleCreateLink = async () => {
    setLinkLoading(true);
    const { error, data } = await createPrivilegedLink(linkForm);
    setLinkLoading(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    if (data?.url) {
      navigator.clipboard?.writeText(data.url);
      toast({ title: 'Lien créé', description: 'URL copiée dans le presse-papier' });
    } else {
      toast({ title: 'Lien créé' });
    }
    setLinkForm({ name: '', durationDays: 30, maxUses: null, singleUse: false, restrictedEmail: '', validityDays: 30, accessType: 'full', internalNote: '' });
    setLinkOpen(false);
  };

  const copyLink = (slug) => {
    const url = `${window.location.origin}/redeem/${slug}`;
    navigator.clipboard?.writeText(url);
    toast({ title: 'Lien copié' });
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--school-accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 premium-dashboard-shell">
      <section className="premium-panel p-6">
        <h1 className="text-3xl font-serif font-bold text-white">Membres de l'équipe</h1>
        <p className="text-gray-400 mt-2">Gestion premium des accès, invitations, rôles et audit.</p>
      </section>
      {/* Bloc A — Membres */}
      <section className="premium-panel p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--school-accent)]" />
            Membres de l'équipe
          </h2>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[var(--school-accent)] text-black hover:bg-[#b5952f] gap-2">
                <UserPlus className="w-4 h-4" /> Inviter
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0F1419] text-white border-white/10 max-w-md">
              <DialogHeader>
                <DialogTitle>Inviter un membre</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Email *</Label>
                  <Input
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                    className="bg-[#192734] border-white/10 mt-1"
                    placeholder="email@exemple.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prénom</Label>
                    <Input
                      value={inviteForm.firstName}
                      onChange={(e) => setInviteForm((p) => ({ ...p, firstName: e.target.value }))}
                      className="bg-[#192734] border-white/10 mt-1"
                    />
                  </div>
                  <div>
                    <Label>Nom</Label>
                    <Input
                      value={inviteForm.lastName}
                      onChange={(e) => setInviteForm((p) => ({ ...p, lastName: e.target.value }))}
                      className="bg-[#192734] border-white/10 mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Rôle</Label>
                  <Select value={inviteForm.role} onValueChange={(v) => setInviteForm((p) => ({ ...p, role: v }))}>
                    <SelectTrigger className="bg-[#192734] border-white/10 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).filter(([k]) => !['owner'].includes(k)).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Validité (jours)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={inviteForm.validityDays}
                    onChange={(e) => setInviteForm((p) => ({ ...p, validityDays: Number(e.target.value) || 7 }))}
                    className="bg-[#192734] border-white/10 mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Annuler</Button>
                <Button onClick={handleInvite} disabled={inviteLoading} className="bg-[var(--school-accent)] text-black">
                  {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="py-3">Nom</th>
                <th className="py-3">Email</th>
                <th className="py-3">Rôle</th>
                <th className="py-3">Statut</th>
                <th className="py-3">Ajouté le</th>
                <th className="py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-white/5">
                  <td className="py-3 text-white">{m.name || '-'}</td>
                  <td className="py-3 text-gray-300">{m.email}</td>
                  <td><span className={`px-2 py-0.5 rounded text-xs ${getRoleBadgeClass(m.role)}`}>{ROLE_LABELS[m.role] || m.role}</span></td>
                  <td className="py-3 text-gray-400">{m.status || 'active'}</td>
                  <td className="py-3 text-gray-500">{formatDate(m.created_at)}</td>
                  <td className="py-3">
                    <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white" onClick={() => { setManageMemberId(m.id); setMemberOverrides([]); getPermissionOverrides(m.id).then(setMemberOverrides); }}>
                      <Settings className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bloc B — Invitations en attente */}
      <section className="premium-panel p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-[var(--school-accent)]" />
          Invitations en attente
        </h2>
        {invitations.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune invitation en attente</p>
        ) : (
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 px-3 bg-[#0F1419] rounded-lg">
                <div>
                  <span className="text-white">{inv.email}</span>
                  <span className="ml-2 px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">{ROLE_LABELS[inv.role] || inv.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">Expire: {formatDate(inv.expires_at)}</span>
                  <Button size="sm" variant="ghost" className="text-emerald-400 hover:text-emerald-300" title="Obtenir le lien d'invitation (si l'email n'a pas été reçu)" onClick={async () => {
                    setLinkDialogLoading(true);
                    setLinkDialogOpen(true);
                    setLinkDialogData({ link: '', email: inv.email });
                    const { data: link, error } = await getInvitationLink(inv.id);
                    setLinkDialogLoading(false);
                    if (error) {
                      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                      setLinkDialogOpen(false);
                      return;
                    }
                    setLinkDialogData({ link: link || '', email: inv.email });
                  }}>
                    <Send className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-[var(--school-accent)] hover:text-[#b5952f]" title="Prolonger la validité" onClick={async () => {
                    const { error } = await resendInvitation(inv.id);
                    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                    else toast({ title: 'Validité prolongée de 7 jours' });
                  }}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={async () => {
                    const { error } = await revokeInvitation(inv.id);
                    if (error) toast({ title: 'Erreur', variant: 'destructive' });
                    else toast({ title: 'Invitation révoquée' });
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dialog : Lien d'invitation à copier (si l'email n'a pas été reçu) */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="bg-[#0F1419] text-white border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle>Lien d'invitation</DialogTitle>
          </DialogHeader>
          {linkDialogLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--school-accent)]" />
              <span className="text-gray-400">Génération du lien…</span>
            </div>
          ) : linkDialogData.link ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Si l'invité n\'a pas reçu l\'email, copiez ce lien et envoyez-le manuellement à {linkDialogData.email} :
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={linkDialogData.link}
                  className="bg-[#192734] border-white/10 text-sm font-mono truncate"
                />
                <Button
                  size="sm"
                  className="bg-[var(--school-accent)] text-black shrink-0"
                  onClick={() => {
                    navigator.clipboard?.writeText(linkDialogData.link);
                    toast({ title: 'Lien copié' });
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Bloc C — Liens privilégiés (owner only) */}
      {isOwner && (
        <section className="premium-panel p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[var(--school-accent)]" />
              Liens privilégiés
            </h2>
            <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[var(--school-accent)] text-black hover:bg-[#b5952f] gap-2">
                  <Link2 className="w-4 h-4" /> Créer un lien
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0F1419] text-white border-white/10 max-w-md">
                <DialogHeader>
                  <DialogTitle>Créer un lien privilégié</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nom (optionnel)</Label>
                    <Input
                      value={linkForm.name}
                      onChange={(e) => setLinkForm((p) => ({ ...p, name: e.target.value }))}
                      className="bg-[#192734] border-white/10 mt-1"
                      placeholder="ex: Test VIP 30j"
                    />
                  </div>
                  <div>
                    <Label>Durée d'accès (jours)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={linkForm.durationDays}
                      onChange={(e) => setLinkForm((p) => ({ ...p, durationDays: Number(e.target.value) || 30 }))}
                      className="bg-[#192734] border-white/10 mt-1"
                    />
                  </div>
                  <div>
                    <Label>Nombre max d'utilisations (vide = illimité)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={linkForm.maxUses ?? ''}
                      onChange={(e) => setLinkForm((p) => ({ ...p, maxUses: e.target.value ? Number(e.target.value) : null }))}
                      className="bg-[#192734] border-white/10 mt-1"
                      placeholder="Illimité"
                    />
                  </div>
                  <div>
                    <Label>Email restreint (optionnel)</Label>
                    <Input
                      value={linkForm.restrictedEmail}
                      onChange={(e) => setLinkForm((p) => ({ ...p, restrictedEmail: e.target.value }))}
                      className="bg-[#192734] border-white/10 mt-1"
                      placeholder="vide = tout le monde"
                    />
                  </div>
                  <div>
                    <Label>Validité du lien (jours)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={linkForm.validityDays}
                      onChange={(e) => setLinkForm((p) => ({ ...p, validityDays: Number(e.target.value) || 30 }))}
                      className="bg-[#192734] border-white/10 mt-1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setLinkOpen(false)}>Annuler</Button>
                  <Button onClick={handleCreateLink} disabled={linkLoading} className="bg-[var(--school-accent)] text-black">
                    {linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {privilegedLinks.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun lien privilégié</p>
          ) : (
            <div className="space-y-3">
              {privilegedLinks.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 px-3 bg-[#0F1419] rounded-lg">
                  <div>
                    <span className="text-white">{l.name || l.slug}</span>
                    <span className="ml-2 text-gray-500 text-xs">{l.duration_days}j</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${l.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>{l.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">{l.use_count ?? 0}/{l.max_uses ?? '∞'}</span>
                    <Button size="sm" variant="ghost" onClick={() => copyLink(l.slug)}><Copy className="w-4 h-4" /></Button>
                    {l.status === 'active' && (
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={async () => {
                        const { error } = await revokeLink(l.id);
                        if (error) toast({ title: 'Erreur', variant: 'destructive' });
                        else toast({ title: 'Lien révoqué' });
                      }}><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Bloc D — Rôles et permissions */}
      <section className="premium-panel p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-[var(--school-accent)]" />
          Rôles et permissions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(ROLE_LABELS).map(([role, label]) => {
            const count = members.filter((m) => String(m.role || '').toLowerCase() === role).length;
            const perms = rolePermissions.filter((p) => p.role === role);
            return (
              <div key={role} className="p-4 bg-[#0F1419] rounded-lg border border-white/5">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-xs ${getRoleBadgeClass(role)}`}>{label}</span>
                  <span className="text-gray-500 text-xs">{count} membre{count !== 1 ? 's' : ''}</span>
                </div>
                {perms.length > 0 && (
                  <p className="text-gray-500 text-xs mt-2">{perms.length} permission(s)</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Dialog Gérer les permissions */}
      <Dialog open={!!manageMemberId} onOpenChange={(o) => !o && setManageMemberId(null)}>
        <DialogContent className="bg-[#0F1419] text-white border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle>Permissions personnalisées</DialogTitle>
          </DialogHeader>
          {manageMemberId && (
            <MemberPermissionsDialog
              member={members.find((m) => m.id === manageMemberId)}
              overrides={memberOverrides}
              onAdd={async (key, granted) => {
                setManageLoading(true);
                const { error } = await addPermissionOverride(manageMemberId, key, granted);
                setManageLoading(false);
                if (error) toast({ title: 'Erreur', variant: 'destructive' });
                else setMemberOverrides(await getPermissionOverrides(manageMemberId));
              }}
              onRemove={async (key) => {
                setManageLoading(true);
                const { error } = await removePermissionOverride(manageMemberId, key);
                setManageLoading(false);
                if (error) toast({ title: 'Erreur', variant: 'destructive' });
                else setMemberOverrides(await getPermissionOverrides(manageMemberId));
              }}
              loading={manageLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bloc E — Journal d'audit */}
      <section className="premium-panel p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-[var(--school-accent)]" />
          Journal des changements d'accès
        </h2>
        {auditLogs.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune entrée récente</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2 px-3 bg-[#0F1419] rounded-lg text-sm">
                <div>
                  <span className="text-[var(--school-accent)] font-medium">{log.action}</span>
                  <span className="text-gray-400 ml-2">{log.resource_type}</span>
                  {log.changes?.email && <span className="text-gray-500 ml-2">→ {log.changes.email}</span>}
                </div>
                <span className="text-gray-500 text-xs">{log.created_at ? new Date(log.created_at).toLocaleString('fr-FR') : ''}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default TeamManagerPage;
