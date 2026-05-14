import React, { useState } from 'react';
import { useAdminCommunities } from '@/hooks/useAdminCommunities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Loader2, MessageCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const AdminCommunitiesPage = () => {
  const { communities, profiles, loading, error, createCommunity, refresh } = useAdminCommunities();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', creator_id: '' });
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!form.name?.trim() || !form.creator_id) {
      toast({ title: 'Erreur', description: 'Nom et créateur requis', variant: 'destructive' });
      return;
    }
    setCreateLoading(true);
    const { error: err } = await createCommunity({
      name: form.name.trim(),
      description: form.description?.trim() || null,
      creator_id: form.creator_id,
    });
    setCreateLoading(false);
    if (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Communauté créée', description: form.name });
    setForm({ name: '', description: '', creator_id: '' });
    setIsCreateOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-serif font-bold flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-[#D4AF37]" />
            Communautés
          </h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#D4AF37] text-black hover:bg-amber-500 gap-2">
                <Plus className="w-4 h-4" /> Créer une communauté
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#151a21] border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Nouvelle communauté</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nom *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="ex: Communauté Fondements"
                    className="bg-[#0F1419] border-white/10 mt-1"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optionnel"
                    className="bg-[#0F1419] border-white/10 mt-1"
                  />
                </div>
                <div>
                  <Label>Créateur de la communauté *</Label>
                  <Select
                    value={form.creator_id}
                    onValueChange={(v) => setForm((p) => ({ ...p, creator_id: v }))}
                  >
                    <SelectTrigger className="bg-[#0F1419] border-white/10 mt-1">
                      <SelectValue placeholder="Sélectionner un membre" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name || p.email} ({p.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Le créateur pourra inviter des membres et modérer les échanges.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-white/10">
                  Annuler
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createLoading}
                  className="bg-[#D4AF37] text-black hover:bg-amber-500"
                >
                  {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
            {error.message}
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
            </div>
          ) : communities.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-[#151a21]/80 backdrop-blur-xl p-12 text-center"
            >
              <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Aucune communauté. Créez-en une pour commencer.</p>
            </motion.div>
          ) : (
            communities.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-white/10 bg-[#151a21]/80 backdrop-blur-xl p-6 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{c.name}</h3>
                    <p className="text-sm text-gray-400">{c.description || '—'}</p>
                    <p className="text-xs text-[#D4AF37] mt-1">
                      Créateur : {c.creator?.name || c.creator?.email || 'Inconnu'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      c.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#D4AF37]/30 text-[#D4AF37]"
                    onClick={() => (window.location.href = `/community/${c.id}`)}
                  >
                    Voir
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCommunitiesPage;
