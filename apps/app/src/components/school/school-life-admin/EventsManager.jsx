import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, Plus, Trash, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const EventsManager = () => {
  const { toast } = useToast();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm]     = useState({ title: '', start_at: '', end_at: '', target_role: 'all', location: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('school_events')
      .select('id,title,start_at,end_at,location,target_role,description')
      .order('start_at', { ascending: false })
      .limit(300);
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!form.title || !form.start_at) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('school_events').insert({
      title:       form.title,
      description: form.description || null,
      start_at:    form.start_at,
      end_at:      form.end_at || null,
      location:    form.location || null,
      target_role: form.target_role,
      created_by:  user?.id,
    });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Événement créé' });
    setIsOpen(false);
    setForm({ title: '', start_at: '', end_at: '', target_role: 'all', location: '', description: '' });
    void load();
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('school_events').delete().eq('id', id);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    void load();
  };

  const isPast = (dateStr) => dateStr && new Date(dateStr) < new Date();

  const columns = [
    { key: 'title',      label: 'Titre',    render: (val) => <span className="font-medium text-white">{val}</span> },
    { key: 'start_at',   label: 'Date',     render: (val) => val ? new Date(val).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
    { key: 'location',   label: 'Lieu',     render: (val) => val || '—' },
    { key: 'target_role', label: 'Public',  render: (val) => (
      <Badge variant="outline" className="text-xs capitalize">
        {val === 'all' ? 'Tous' : val === 'student' ? 'Étudiants' : val === 'teacher' ? 'Enseignants' : val}
      </Badge>
    )},
    { key: 'start_at',   label: 'Statut',   render: (val) => (
      <Badge className={isPast(val) ? 'bg-gray-500/20 text-gray-400' : 'bg-green-500/20 text-green-400'}>
        {isPast(val) ? 'Passé' : 'À venir'}
      </Badge>
    )},
    { key: 'id', label: 'Actions', render: (id) => (
      <Button size="sm" variant="destructive" onClick={() => handleDelete(id)}><Trash className="w-3 h-3" /></Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-pink-500" /> Événements ({rows.length})
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/10 text-gray-400">
            <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setIsOpen(true)} className="bg-pink-600 hover:bg-pink-700">
            <Plus className="w-4 h-4 mr-2" /> Créer Événement
          </Button>
        </div>
      </div>

      {loading
        ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0
          ? <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-xl">Aucun événement créé.</div>
          : <DataTable columns={columns} data={rows} searchFields={['title']} />
      }

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white">
          <DialogHeader><DialogTitle>Nouvel Événement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Titre *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Début *</label>
                <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Fin</label>
                <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
              </div>
            </div>
            <Input placeholder="Lieu" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="bg-[#0F1419] border-white/10 text-white" />
            <Select value={form.target_role} onValueChange={(v) => setForm({ ...form, target_role: v })}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="student">Étudiants</SelectItem>
                <SelectItem value="teacher">Enseignants</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSave} className="w-full bg-pink-600">Créer l&apos;événement</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventsManager;
