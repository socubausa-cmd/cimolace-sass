import React, { useMemo, useState } from 'react';
import { useUsers } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Search, 
  Edit, 
  Trash2, 
  UserPlus,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const UsersPage = () => {
  const { users, loading, updateUser, inviteUser, refresh } = useUsers();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'visitor',
    status: 'active',
  });

  const roleOptions = useMemo(() => ([
    { value: 'owner', label: 'Owner' },
    { value: 'admin', label: 'Admin' },
    { value: 'creator', label: 'Creator' },
    { value: 'secretariat', label: 'Secrétariat' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'student', label: 'Student' },
    { value: 'visitor', label: 'Visiteur' },
  ]), []);

  const statusOptions = useMemo(() => ([
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
  ]), []);

  const getRoleBadgeClass = (role) => {
    const r = String(role || '').toLowerCase();
    if (r === 'owner') return 'bg-[#D4AF37]/20 text-[#D4AF37]';
    if (r === 'admin') return 'bg-purple-500/20 text-purple-400';
    if (r === 'creator') return 'bg-pink-500/20 text-pink-400';
    if (r === 'secretariat') return 'bg-emerald-500/20 text-emerald-400';
    if (r === 'teacher') return 'bg-blue-500/20 text-blue-400';
    if (r === 'student') return 'bg-cyan-500/20 text-cyan-300';
    if (r === 'visitor') return 'bg-gray-500/20 text-gray-400';
    return 'bg-gray-500/10 text-gray-400';
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStatusChange = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const { error } = await updateUser(id, { status: newStatus });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
  };

  const handleRoleChange = async (id, newRole) => {
    const { error } = await updateUser(id, { role: newRole });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
  };

  const submitInvite = async () => {
    setInviteLoading(true);
    const { error } = await inviteUser(inviteForm);
    setInviteLoading(false);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Invitation envoyée', description: inviteForm.email });
    setInviteForm({ email: '', name: '', role: 'visitor', status: 'active' });
    setIsInviteOpen(false);
  };

  return (
    <div className="min-h-screen premium-dashboard-shell text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold">Gestion des Utilisateurs</h1>
            <p className="text-gray-400 text-sm mt-1">Par défaut les nouveaux comptes sont en profil visiteur, puis passent étudiant après abonnement confirmé.</p>
          </div>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#D4AF37] text-black hover:bg-[#b5952f] gap-2">
                <UserPlus className="w-4 h-4" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0F1419] text-white border-white/10">
              <DialogHeader>
                <DialogTitle>Inviter un utilisateur</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                    className="bg-[#0F1419] border-white/10"
                    placeholder="ex: prof@prorascience.org"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                    className="bg-[#0F1419] border-white/10"
                    placeholder="ex: Professeur X"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Select value={inviteForm.role} onValueChange={(v) => setInviteForm((p) => ({ ...p, role: v }))}>
                      <SelectTrigger className="bg-[#0F1419] border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select value={inviteForm.status} onValueChange={(v) => setInviteForm((p) => ({ ...p, status: v }))}>
                      <SelectTrigger className="bg-[#0F1419] border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteOpen(false)} className="border-white/10">Annuler</Button>
                <Button onClick={submitInvite} disabled={inviteLoading} className="bg-[#D4AF37] text-black hover:bg-[#b5952f]">
                  {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Inviter'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="premium-panel p-4 mb-6 flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input 
              placeholder="Rechercher un utilisateur..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#0F1419] border-white/10"
            />
          </div>
        </div>

        {/* Table */}
        <div className="premium-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-gray-400 uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">Utilisateur</th>
                  <th className="px-6 py-4">Rôle</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Dernière Connexion</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center">
                      <div className="flex justify-center"><Loader2 className="animate-spin text-[#D4AF37]" /></div>
                    </td>
                  </tr>
                ) : filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-white">{user.name || 'Sans nom'}</div>
                        <div className="text-gray-500 text-xs">{user.email || 'Pas d\'email'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Select value={String(user.role || 'student').toLowerCase()} onValueChange={(v) => handleRoleChange(user.id, v)}>
                        <SelectTrigger className={`h-8 w-[160px] border-white/10 ${getRoleBadgeClass(user.role)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleStatusChange(user.id, user.status)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold transition-all ${
                          user.status === 'active' 
                            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' 
                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        {user.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {user.status || 'Inconnu'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Jamais'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;